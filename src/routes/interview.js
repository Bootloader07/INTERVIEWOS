/**
 * interview.js — Route handler for POST /api/interview
 *
 * Routing logic based on payload shape (from technical-spec.md):
 *   { sessionId, candidate } → START a new interview
 *   { sessionId, message }   → TURN (continue existing interview)
 *
 * When completion condition is met on a TURN, the response is the final
 * { reply, done: true, feedback } shape — no separate /end call needed.
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

    return res.json({ reply: question, done: false });

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

    // --- Topic advancement logic (server-side, not LLM-side) ---
    let currentTopic = getCurrentTopic(session);
    let plan_index = session.plan_index;
    let follow_up_count = session.follow_up_count;
    let distinct_days_covered = [...session.distinct_days_covered];

    // Always ensure the current topic's day is tracked (covers follow-up case too)
    if (currentTopic && !distinct_days_covered.includes(currentTopic.day)) {
      distinct_days_covered.push(currentTopic.day);
    }

    // Build system prompt with current context
    const uncoveredDays = getUncoveredDays({ ...session, distinct_days_covered });
    const systemPrompt = buildInterviewSystemPrompt(session.candidate, currentTopic, uncoveredDays);

    // Get next question from LLM — pass follow_up_count so it knows
    // whether to use the two-step claim-extract path (follow_up_count > 0)
    // or the standard new-topic question path (follow_up_count === 0).
    const { confidence, question } = await getNextQuestion(
      systemPrompt, transcript, currentTopic, follow_up_count
    );

    // Decide whether to advance to next topic
    const advance = shouldAdvanceTopic({ ...session, follow_up_count }, confidence);

    if (advance) {
      plan_index = Math.min(plan_index + 1, session.plan.length);
      follow_up_count = 0;
      currentTopic = session.plan[plan_index] || null;
      // Add newly advanced day
      if (currentTopic && !distinct_days_covered.includes(currentTopic.day)) {
        distinct_days_covered.push(currentTopic.day);
      }
    } else {
      follow_up_count += 1;
    }

    // Append assistant question to transcript
    const assistantEntry = {
      role: 'assistant',
      content: question,
      day_ref: currentTopic?.day || null,
    };
    const fullTranscript = [...transcript, assistantEntry];

    // Increment question count
    const question_count = session.question_count + 1;

    // Check completion condition (server-side enforcement)
    const updatedSession = {
      transcript: fullTranscript,
      question_count,
      plan_index,
      follow_up_count,
      distinct_days_covered,
    };

    // Temporarily merge to check completion
    const tempSession = { ...session, ...updatedSession };
    const complete = isInterviewComplete(tempSession);

    if (complete) {
      // Generate feedback
      updatedSession.phase = 'DONE';
      updateSession(sessionId, updatedSession);

      const feedback = await generateFeedback({ ...session, ...updatedSession });

      console.log(`[DONE] Session ${sessionId} | Questions: ${question_count} | Days: ${distinct_days_covered.length}`);

      return res.json({
        reply: 'Thank you for completing the interview. Here is your feedback.',
        done: true,
        feedback,
      });
    }

    // Not yet complete — return the next question
    updateSession(sessionId, updatedSession);

    console.log(`[TURN] Session ${sessionId} | Q#${question_count} | Day ${currentTopic?.day} | Confidence: ${confidence} | Follow-ups: ${follow_up_count}`);

    return res.json({ reply: question, done: false });

  } catch (err) {
    console.error('[TURN] Error:', err.message);
    return res.status(500).json({ error: 'Failed to process message', detail: err.message });
  }
}

module.exports = router;
