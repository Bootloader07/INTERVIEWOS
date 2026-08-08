/**
 * feedbackGenerator.js — Final feedback LLM call with JSON safety.
 *
 * This module generates structured end-of-interview feedback.
 * It NEVER throws — it retries once, then returns a safe default.
 */

const Groq = require('groq-sdk');
const { buildFeedbackSystemPrompt } = require('../prompts/prompts');

const MODEL = 'llama-3.3-70b-versatile';

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Strips markdown code fences from an LLM response string.
 * The model sometimes wraps JSON in ```json ... ``` despite instructions.
 * @param {string} text
 * @returns {string}
 */
function stripMarkdownFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Safe default feedback structure — returned if both LLM attempts fail or produce bad JSON.
 * @param {string} reason - Why we fell back (for server logs)
 * @returns {Object}
 */
function safeDefault(reason = 'unknown') {
  console.warn(`[Feedback] Falling back to safe default. Reason: ${reason}`);
  return {
    summary: 'The interview was completed. A detailed assessment could not be generated at this time.',
    strengths: ['Completed the interview session'],
    gaps: ['Detailed gap analysis unavailable'],
    next: ['Review the curriculum days covered during this interview'],
  };
}

/**
 * Builds the transcript string to send to the feedback LLM.
 * @param {Array} transcript - [{ role, content, day_ref }]
 * @returns {string}
 */
function formatTranscriptForFeedback(transcript) {
  return transcript
    .map(t => `[${t.role.toUpperCase()}${t.day_ref ? ` - Day ${t.day_ref}` : ''}]: ${t.content}`)
    .join('\n\n');
}

/**
 * Generates structured feedback for the completed interview.
 * Retries once on JSON parse failure, then returns a safe default.
 *
 * @param {Object} session - Full session state
 * @returns {Promise<{ summary: string, strengths: string[], gaps: string[], next: string[] }>}
 */
async function generateFeedback(session) {
  const transcriptText = formatTranscriptForFeedback(session.transcript);
  const systemPrompt = buildFeedbackSystemPrompt();

  const userMessage = `Here is the complete interview transcript:\n\n${transcriptText}\n\nCandidate profile: ${session.candidate.member.name}, ${session.candidate.member.jobRole}, ${session.candidate.member.yearsExperience} years experience.\nTopics covered (days): ${session.distinct_days_covered.join(', ')}\nTotal questions: ${session.question_count}`;

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
        temperature: 0.3,  // lower temperature for structured output
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
