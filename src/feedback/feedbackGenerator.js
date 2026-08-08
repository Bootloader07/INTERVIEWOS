/**
 * feedbackGenerator.js — Final feedback LLM call with JSON safety.
 *
 * AI Usage Log:
 *   - Added scores: { technical, systemDesign, communication, problemSolving }
 *     (0–100 integers) to the feedback output schema. This is an additive
 *     extension to the existing { summary, strengths, gaps, next } shape and
 *     does NOT alter the POST /api/interview API contract.
 *   - Prompt is defined locally (buildFeedbackPromptWithScores) to include
 *     the scoring rubric without modifying prompts.js.
 *   - safeDefault() now includes zeroed scores for the INCOMPLETE edge-case path
 *     (e.g. session ended via __END_INTERVIEW__ sentinel before any answers).
 *   - hasUserAnswers guard sends a targeted "no answers" instruction to the LLM
 *     to prevent hallucinated non-zero scores on empty transcripts.
 */

const Groq = require('groq-sdk');

const MODEL = 'llama-3.3-70b-versatile';

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Strips markdown code fences from an LLM response string.
 */
function stripMarkdownFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Safe default — returned when both LLM attempts fail or produce bad JSON.
 * Includes zeroed scores for the INCOMPLETE / premature-termination path.
 */
function safeDefault(reason = 'unknown') {
  console.warn(`[Feedback] Falling back to safe default. Reason: ${reason}`);
  return {
    summary: 'The interview was completed. A detailed assessment could not be generated at this time.',
    strengths: ['Completed the interview session'],
    gaps: ['Detailed gap analysis unavailable'],
    next: ['Review the curriculum days covered during this interview'],
    scores: { technical: 0, systemDesign: 0, communication: 0, problemSolving: 0 },
  };
}

/**
 * Formats the transcript for the feedback LLM.
 */
function formatTranscriptForFeedback(transcript) {
  return transcript
    .map(t => `[${t.role.toUpperCase()}${t.day_ref ? ` - Day ${t.day_ref}` : ''}]: ${t.content}`)
    .join('\n\n');
}

/**
 * Returns the feedback system prompt that requests category scores in addition
 * to the standard summary / strengths / gaps / next fields.
 *
 * Scoring rubric:
 *   technical      — depth and accuracy of AI/ML technical knowledge
 *   systemDesign   — architectural thinking, trade-off reasoning, system-level thinking
 *   communication  — clarity, structure, conciseness of explanations
 *   problemSolving — approach to decomposing and addressing problems
 *
 * If the transcript contains NO candidate (user) responses, all scores must be 0.
 */
function buildFeedbackPromptWithScores() {
  return `You are a senior technical interviewer generating structured post-interview feedback for an AI engineering cohort.

Return a SINGLE JSON object with EXACTLY these fields — no markdown fences, no extra keys, no preamble:

{
  "summary": "2-3 sentence overall assessment of the candidate",
  "strengths": ["concise strength 1", "concise strength 2"],
  "gaps": ["concise gap 1", "concise gap 2"],
  "next": ["actionable next step 1", "actionable next step 2"],
  "scores": {
    "technical": <integer 0-100>,
    "systemDesign": <integer 0-100>,
    "communication": <integer 0-100>,
    "problemSolving": <integer 0-100>
  }
}

Scoring rubric:
  technical (0-100)      — Accuracy and depth of AI/ML knowledge demonstrated in answers
  systemDesign (0-100)   — Quality of architectural thinking, trade-offs, and system-level reasoning
  communication (0-100)  — Clarity, structure, and conciseness of explanations
  problemSolving (0-100) — Approach to decomposing problems and arriving at solutions

CRITICAL RULE: If the transcript contains NO [USER] responses, you MUST:
  - Set all four scores to exactly 0
  - Set summary to indicate no candidate answers were submitted
  - Set strengths to []
  - Set gaps to ["No answers submitted for evaluation"]
  - Set next to ["Complete the full interview session to receive a detailed evaluation"]`;
}

/**
 * Generates structured feedback for the completed interview.
 * Retries once on JSON parse failure, then returns a safe default.
 *
 * @param {Object} session - Full session state
 * @returns {Promise<{ summary, strengths, gaps, next, scores }>}
 */
async function generateFeedback(session) {
  const transcriptText = formatTranscriptForFeedback(session.transcript);
  const systemPrompt = buildFeedbackPromptWithScores();

  const hasUserAnswers = session.transcript.some(t => t.role === 'user');

  const userMessage = hasUserAnswers
    ? `Here is the complete interview transcript:\n\n${transcriptText}\n\nCandidate profile: ${session.candidate.member.name}, ${session.candidate.member.jobRole}, ${session.candidate.member.yearsExperience} years experience.\nTopics covered (days): ${session.distinct_days_covered.join(', ')}\nTotal questions asked by interviewer: ${session.question_count}`
    : `The interview was ended before the candidate submitted any answers.\n\nCandidate: ${session.candidate.member.name}, ${session.candidate.member.jobRole}.\n\nTranscript (interviewer-only):\n\n${transcriptText}\n\nNo [USER] turns exist. Return INCOMPLETE feedback with all four scores set to 0.`;

  let attempt = 0;

  while (attempt < 2) {
    try {
      const client = getGroqClient();
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const rawText = response.choices[0]?.message?.content || '';
      const cleaned = stripMarkdownFences(rawText);
      const parsed = JSON.parse(cleaned);

      // Validate required fields
      if (
        typeof parsed.summary === 'string' &&
        Array.isArray(parsed.strengths) &&
        Array.isArray(parsed.gaps) &&
        Array.isArray(parsed.next)
      ) {
        // Ensure scores object exists — gracefully default if LLM omitted it
        if (!parsed.scores || typeof parsed.scores !== 'object') {
          parsed.scores = { technical: 0, systemDesign: 0, communication: 0, problemSolving: 0 };
        } else {
          // Clamp each score to integer 0–100
          for (const key of ['technical', 'systemDesign', 'communication', 'problemSolving']) {
            parsed.scores[key] = Math.min(100, Math.max(0, Math.round(Number(parsed.scores[key]) || 0)));
          }
        }

        // Enforce zero scores when there were no user answers (safety override)
        if (!hasUserAnswers) {
          parsed.scores = { technical: 0, systemDesign: 0, communication: 0, problemSolving: 0 };
        }

        return parsed;
      } else {
        throw new Error('Missing required fields in feedback JSON');
      }
    } catch (err) {
      console.error(`[Feedback] Attempt ${attempt + 1} failed:`, err.message);
      attempt++;
    }
  }

  return safeDefault('both LLM attempts failed or returned invalid JSON');
}

module.exports = { generateFeedback };
