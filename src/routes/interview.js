/**
 * interview.js — Route handler for POST /api/interview
 *
 * Routing logic based on payload shape (from technical-spec.md):
 *   { sessionId, candidate }              → START a new interview
 *   { sessionId, message }                → TURN (continue existing interview)
 *   { sessionId, message: '__END_INTERVIEW__' } → SENTINEL early termination
 *
 * AI Usage Log:
 *   - Sentinel __END_INTERVIEW__ is a reserved control message handled inside
 *     the existing TURN path (no new endpoint). It skips planner/LLM logic,
 *     marks the session DONE, and calls generateFeedback on whatever exists.
 *     This is spec-compliant: POST /api/interview remains the only endpoint
 *     for interview lifecycle transitions. (UI-support reads /api/candidates
 *     and /api/curriculum are separate, non-lifecycle routes.)
 *   - START and TURN responses include additive meta-fields (question_count,
 *     days_covered, current_topic, plan) for the InterviewOS frontend radar,
 *     timeline, and counter. These do not alter the required response shape.
 */

const express = require('express');
const router = express.Router();

const { createSession, getSession, updateSession } = require('../store/sessionStore');
const { buildPlan, getCurrentTopic, getUncoveredDays, isInterviewComplete } = require('../planner/interviewPlanner');
const { getNextQuestion, isSubstantiveAnswer, shouldAdvanceTopic } = require('../orchestrator/llmOrchestrator');
const { generateFeedback } = require('../feedback/feedbackGenerator');
const { buildInterviewSystemPrompt } = require('../prompts/prompts');

// Load data files once at startup
const curriculum = require('../../data/curriculum.json');
const candidatesData = require('../../data/candidates.json');

// Build a lookup map: candidateId → candidate object
const candidatesById = {};
for (const c of candidatesData.candidates) {
  candidatesById[c.member.id] = c;
}

// ─── POST /api/interview ──────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const body = req.body;

  // --- Validate incoming JSON shape ---
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { sessionId } = body;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required and must be a string' });
  }

  // ─── START: { sessionId, candidate } ───────────────────────────────────────
  if (body.candidate) {
    return handleStart(req, res, sessionId, body.candidate);
  }

  // ─── TURN: { sessionId, message } ──────────────────────────────────────────
  if (typeof body.message === 'string') {
    return handleTurn(req, res, sessionId, body.message);
  }

  // Unknown payload shape
  return res.status(400).json({
    error: 'Invalid request: provide either { sessionId, candidate } to start or { sessionId, message } to continue',
  });
});

// ─── START handler ────────────────────────────────────────────────────────────

async function handleStart(req, res, sessionId, candidatePayload) {
  try {
    // Accept either a full candidate object or just { id } referencing candidates.json
    let candidate;

    if (candidatePayload.member && candidatePayload.missions) {
      // Full candidate object provided directly
      candidate = candidatePayload;
    } else if (candidatePayload.id) {
      // Lookup by ID from candidates.json
      candidate = candidatesById[candidatePayload.id];
      if (!candidate) {
        return res.status(400).json({ error: `Candidate with id "${candidatePayload.id}" not found` });
      }
    } else {
      // Try to match by member.id inside the object
      const id = candidatePayload.member?.id;
      if (id && candidatesById[id]) {
        candidate = candidatesById[id];
      } else {
        return res.status(400).json({ error: 'candidate must have a member.id or id field matching a record in candidates.json' });
      }
    }

    // Build deterministic topic plan
    const plan = buildPlan(candidate, curriculum);

    if (plan.length === 0) {
      return res.status(400).json({ error: 'No eligible topics found for this candidate' });
    }

    // Initialize session
    const session = createSession(sessionId, candidate, plan);

    // Build context and get first question
    const currentTopic = getCurrentTopic(session);
    const uncoveredDays = getUncoveredDays(session);
    const systemPrompt = buildInterviewSystemPrompt(candidate, currentTopic, uncoveredDays);

    // The START has no prior transcript and follow_up_count=0 — always standard path
    const { confidence, question } = await getNextQuestion(systemPrompt, [], currentTopic, 0);

    // Record the opening question in the transcript
    const updatedTranscript = [
      { role: 'assistant', content: question, day_ref: currentTopic?.day || null },
    ];

    // Mark current day as covered when we ask the first question
    const distinct_days_covered = currentTopic ? [currentTopic.day] : [];

    updateSession(sessionId, {
      transcript: updatedTranscript,
      question_count: 1,
      distinct_days_covered,
      follow_up_count: 0,
    });

    console.log(`[START] Session ${sessionId} | Candidate: ${candidate.member.name} | First topic: Day ${currentTopic?.day} | Confidence signal: ${confidence}`);

    // Return additive meta-fields so the InterviewOS frontend can populate
    // the radar, timeline, and question counter without extra API calls.
    return res.json({
      reply: question,
      done: false,
      question_count: 1,
      question_target: 8,
      hard_cap: 10,
      days_covered: distinct_days_covered,
      current_topic: currentTopic ? { day: currentTopic.day, title: currentTopic.title } : null,
      plan: plan.map(t => ({ day: t.day, title: t.title })),
    });

  } catch (err) {
    console.error('[START] Error:', err.message);
    return res.status(500).json({ error: 'Failed to start interview', detail: err.message });
  }
}

// ─── TURN handler ─────────────────────────────────────────────────────────────

async function handleTurn(req, res, sessionId, message) {
  try {
    const session = getSession(sessionId);

    if (!session) {
      return res.status(400).json({
        error: `No interview session found for sessionId "${sessionId}". Call with { sessionId, candidate } to start.`,
      });
    }

    if (session.phase === 'DONE') {
      return res.json({
        reply: 'This interview session has already concluded.',
        done: true,
      });
    }

    // ─── SENTINEL: Early Interview Termination ──────────────────────────────
    // AI Usage Log: __END_INTERVIEW__ is a reserved control message on the
    // existing endpoint. It does NOT go through planner/LLM question logic.
    // The session is permanently closed (phase=DONE) before feedback runs,
    // so no future turn can resurrect it. Zero-answer edge case is handled
    // by feedbackGenerator's hasUserAnswers guard → all scores = 0.
    if (message === '__END_INTERVIEW__') {
      // Mark DONE first — prevents any concurrent or subsequent turns
      updateSession(sessionId, { phase: 'DONE' });

      // Generate feedback from the current (pre-closure) session snapshot.
      // session variable still holds the original object reference; Object.assign
      // in updateSession mutated it in-place, but transcript/candidate are intact.
      const feedback = await generateFeedback(session);

      const hasAnswers = session.transcript.some(t => t.role === 'user');
      const sentinelReply = hasAnswers
        ? 'Interview session ended early. Here is your evaluation based on what was covered.'
        : 'Interview ended before any answers were submitted.';

      console.log(`[END-EARLY] Session ${sessionId} | Sentinel __END_INTERVIEW__ | User answers: ${session.transcript.filter(t => t.role === 'user').length} | Q count: ${session.question_count}`);

      return res.json({ reply: sentinelReply, done: true, feedback });
    }
    // ─── END SENTINEL ────────────────────────────────────────────────────────

    // Append user's answer to transcript
    const userEntry = { role: 'user', content: message, day_ref: null };
    const transcript = [...session.transcript, userEntry];

    // Handle empty / one-word answers — gentle clarification, don't count as substantive
    if (!isSubstantiveAnswer(message)) {
      const clarifyQuestion = 'Could you elaborate a bit more? Even a brief explanation of your thinking would be helpful.';
      const clarifyEntry = { role: 'assistant', content: clarifyQuestion, day_ref: getCurrentTopic(session)?.day || null };
      updateSession(sessionId, { transcript: [...transcript, clarifyEntry] });
      return res.json({ reply: clarifyQuestion, done: false });
    }

    let currentTopic = getCurrentTopic(session);
    let plan_index = session.plan_index;
    let follow_up_count = session.follow_up_count;
    let distinct_days_covered = [...session.distinct_days_covered];

    // If advance_next_turn is set, we advance the topic NOW before generating the next question
    if (session.advance_next_turn) {
      plan_index = Math.min(plan_index + 1, session.plan.length);
      follow_up_count = 0;
      currentTopic = session.plan[plan_index] || null;
      if (currentTopic && !distinct_days_covered.includes(currentTopic.day)) {
        distinct_days_covered.push(currentTopic.day);
      }
    }

    // Check completion BEFORE generating the next question
    const checkSession = {
      ...session,
      transcript,
      question_count: session.question_count,
      plan_index,
      follow_up_count,
      distinct_days_covered,
    };

    if (isInterviewComplete(checkSession)) {
      checkSession.phase = 'DONE';
      updateSession(sessionId, checkSession);
      const feedback = await generateFeedback(checkSession);
      console.log(`[DONE] Session ${sessionId} | Questions: ${session.question_count} | Days: ${distinct_days_covered.length}`);
      return res.json({
        reply: 'Thank you for completing the interview. Here is your feedback.',
        done: true,
        feedback,
      });
    }

    // Build system prompt with current context
    const uncoveredDays = getUncoveredDays({ ...session, distinct_days_covered });
    const systemPrompt = buildInterviewSystemPrompt(session.candidate, currentTopic, uncoveredDays);

    // Get next question from LLM — follow_up_count > 0 triggers the 2-step extraction path
    const { confidence, question } = await getNextQuestion(
      systemPrompt, transcript, currentTopic, follow_up_count
    );

    // Decide if we should advance AFTER the user answers this new question
    // follow_up_count is how many follow-ups we HAVE asked so far.
    // The question we just generated is follow_up_count + 1 for this topic (if > 0).
    // We increment follow_up_count now to reflect the question we are about to append.
    follow_up_count += 1;
    
    // Evaluate if this new question should be the LAST one for this topic
    const advance = shouldAdvanceTopic({ ...session, follow_up_count }, confidence);
    let advance_next_turn = advance;

    // Append assistant question to transcript
    const assistantEntry = {
      role: 'assistant',
      content: question,
      day_ref: currentTopic?.day || null,
    };
    const fullTranscript = [...transcript, assistantEntry];

    // Increment question count
    const question_count = session.question_count + 1;

    const updatedSession = {
      transcript: fullTranscript,
      question_count,
      plan_index,
      follow_up_count,
      distinct_days_covered,
      advance_next_turn,
    };

    updateSession(sessionId, updatedSession);

    console.log(`[TURN] Session ${sessionId} | Q#${question_count} | Day ${currentTopic?.day} | Confidence: ${confidence} | Follow-ups: ${follow_up_count} | AdvanceNext: ${advance_next_turn}`);

    // Additive meta-fields for InterviewOS frontend
    return res.json({
      reply: question,
      done: false,
      question_count,
      question_target: 8,
      hard_cap: 10,
      days_covered: distinct_days_covered,
      current_topic: currentTopic ? { day: currentTopic.day, title: currentTopic.title } : null,
    });

  } catch (err) {
    console.error('[TURN] Error:', err.message);
    return res.status(500).json({ error: 'Failed to process message', detail: err.message });
  }
}

module.exports = router;
