/**
 * llmOrchestrator.js — LLM call + confidence-tag parsing + targeted follow-ups.
 *
 * Wraps all Groq API calls with retry logic and safe fallbacks.
 * The interview must never hard-crash during a live demo.
 *
 * Bug 2 fix: follow-ups are now two-step:
 *   1. extractClaim()       — pull one concrete claim verbatim from the candidate's answer
 *   2. getFollowUpQuestion() — challenge/quantify/defend that exact claim
 * This prevents the generic "tell me more about X" pattern where X is just
 * the topic name rather than something the candidate actually said.
 */

const Groq = require('groq-sdk');

let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

const MODEL = 'llama-3.3-70b-versatile';
const MAX_FOLLOW_UPS_PER_TOPIC = 2; // cap follow-ups so 8q/4day target stays reachable

// ─── Core Groq call ──────────────────────────────────────────────────────────

/**
 * Calls Groq with the given system prompt + messages and returns raw text.
 * @param {string} systemPrompt
 * @param {Array}  messages - [{ role, content }]
 * @param {number} [maxTokens=512]
 * @param {number} [temperature=0.7]
 * @returns {Promise<string>}
 */
async function callGroq(systemPrompt, messages, maxTokens = 512, temperature = 0.7) {
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature,
    max_tokens: maxTokens,
  });
  return response.choices[0]?.message?.content || '';
}

// ─── Parse two-line interview format ─────────────────────────────────────────

/**
 * Parses the two-line LLM output format:
 *   CONFIDENCE: high|medium|low
 *   [question text]
 *
 * @param {string} rawText
 * @returns {{ confidence: string, question: string }}
 */
function parseInterviewResponse(rawText) {
  const lines = rawText.trim().split('\n').filter(l => l.trim());
  let confidence = 'medium';
  const questionLines = [];

  for (const line of lines) {
    if (line.trim().toUpperCase().startsWith('CONFIDENCE:')) {
      const tag = line.split(':')[1]?.trim().toLowerCase();
      if (['high', 'medium', 'low'].includes(tag)) confidence = tag;
    } else {
      questionLines.push(line.trim());
    }
  }

  const question = questionLines.join(' ').trim() || rawText.trim();
  return { confidence, question };
}

// ─── Bug 2 fix: two-step follow-up generation ────────────────────────────────

/**
 * Step 1 — Extract one concrete claim from the candidate's last answer.
 *
 * A "concrete claim" is a specific tool choice, number, decision, or trade-off
 * the candidate stated verbatim — NOT a summary of the topic area.
 *
 * Examples of good extracted claims:
 *   "chose ChromaDB over Pinecone because the dataset was small and cost mattered"
 *   "switched to OpenAI embeddings in production because the data was de-identified"
 *   "used PCA with 2 principal components to visualise the clusters"
 *
 * Returns a short (≤30 word) verbatim-style claim string, or null if the
 * answer doesn't contain a specific enough claim to probe.
 *
 * @param {string} candidateAnswer - The candidate's last substantive answer
 * @param {Object} currentTopic    - Current plan topic for context
 * @returns {Promise<string|null>}
 */
async function extractClaim(candidateAnswer, currentTopic) {
  const systemPrompt = `You are a precise text analyser. Your job is to extract ONE concrete, specific claim from a candidate's interview answer.

A concrete claim is:
- A specific tool or library they chose and the reason they gave (e.g. "used ChromaDB because it runs in-process")
- A specific number, threshold, or configuration they mentioned (e.g. "used top-5 retrieval chunks")
- A specific trade-off decision they made with a stated reason (e.g. "chose Pinecone over ChromaDB for production because of managed scaling")
- A specific outcome they described (e.g. "few-shot with 3 examples improved consistency noticeably")

NOT a concrete claim:
- A restatement of the topic (e.g. "embeddings capture semantic meaning")
- A vague general statement (e.g. "I used best practices")
- A description of what the technology does in general

Output format: reply with ONLY the extracted claim in ≤30 words, written as a third-person statement starting with "The candidate".
If no concrete specific claim exists, reply with exactly: NONE`;

  const topicContext = currentTopic
    ? `Current interview topic: Day ${currentTopic.day} — ${currentTopic.title}`
    : '';

  try {
    const raw = await callGroq(systemPrompt, [
      { role: 'user', content: `${topicContext}\n\nCandidate's answer:\n"${candidateAnswer}"` },
    ], 128, 0.3);

    const cleaned = raw.trim();
    if (!cleaned || cleaned === 'NONE' || cleaned.toUpperCase().includes('NONE')) return null;
    return cleaned;
  } catch (err) {
    console.warn('[extractClaim] Failed:', err.message);
    return null;
  }
}

/**
 * Step 2 — Generate a follow-up question that probes the extracted claim.
 *
 * The prompt explicitly includes the verbatim claim and instructs the model
 * to challenge, quantify, or defend it — NOT ask a generic topic question.
 *
 * @param {string} systemPrompt    - The standard interview system prompt (from prompts.js)
 * @param {Array}  transcript      - Session transcript as [{ role, content }]
 * @param {Object} currentTopic    - Current plan topic
 * @param {string} extractedClaim  - The claim extracted in step 1
 * @returns {Promise<{ confidence: string, question: string }>}
 */
async function getFollowUpQuestion(systemPrompt, transcript, currentTopic, extractedClaim) {
  const claimInstruction = `\n\n--- FOLLOW-UP INSTRUCTION (override general rules for this turn only) ---
The candidate specifically claimed: "${extractedClaim}"
Write ONE follow-up question that probes THIS EXACT CLAIM.
- Challenge it: "Why X instead of Y?"
- Quantify it: "How did you measure that?"
- Defend it: "What would break if you had done Z instead?"
Do NOT ask a generic new question about ${currentTopic?.title || 'the topic'}. Stay on the specific claim above.
Output format: CONFIDENCE: high|medium|low on line 1, then the question on line 2. Nothing else.`;

  const augmentedPrompt = systemPrompt + claimInstruction;
  const messages = transcript.map(t => ({ role: t.role, content: t.content }));

  let attempt = 0;
  while (attempt < 2) {
    try {
      const raw = await callGroq(augmentedPrompt, messages);
      const parsed = parseInterviewResponse(raw);
      if (parsed.question && parsed.question.length > 10) return parsed;
    } catch (err) {
      console.error(`[getFollowUpQuestion] Attempt ${attempt + 1} failed:`, err.message);
    }
    attempt++;
  }

  // Scripted fallback that still references the claim
  const fallback = extractedClaim
    ? `You mentioned that ${extractedClaim.replace(/^The candidate /i, 'you ')} — can you walk me through why you made that specific choice over the alternatives?`
    : `Can you elaborate on that decision — what made you confident it was the right approach?`;

  return { confidence: 'medium', question: fallback };
}

// ─── Main question entry point ────────────────────────────────────────────────

/**
 * Gets the next interview question from the LLM.
 *
 * - On first question for a topic (follow_up_count === 0): standard question generation.
 * - On follow-up (follow_up_count > 0): two-step claim-extract → targeted follow-up.
 *
 * Includes retry + scripted fallback so the interview never crashes.
 *
 * @param {string} systemPrompt    - Built by prompts.js
 * @param {Array}  transcript      - Session transcript as [{ role, content }]
 * @param {Object} currentTopic    - Current plan topic (for fallback scripting)
 * @param {number} [follow_up_count=0] - How many follow-ups on this topic so far
 * @returns {Promise<{ confidence: string, question: string }>}
 */
async function getNextQuestion(systemPrompt, transcript, currentTopic, follow_up_count = 0) {
  const messages = transcript.map(t => ({ role: t.role, content: t.content }));

  // ── Follow-up path: two-step claim extraction ───────────────────────────
  if (follow_up_count > 0 && transcript.length >= 2) {
    // Get the candidate's most recent answer (last user message in transcript)
    const lastUserMsg = [...transcript].reverse().find(t => t.role === 'user');
    const candidateAnswer = lastUserMsg?.content || '';

    if (candidateAnswer) {
      // Step 1: extract the specific claim to probe
      const claim = await extractClaim(candidateAnswer, currentTopic);
      console.log(`[FollowUp] Extracted claim: ${claim || 'none — falling back to standard'}`);

      if (claim) {
        // Step 2: generate a targeted challenge question for that claim
        return getFollowUpQuestion(systemPrompt, transcript, currentTopic, claim);
      }
      // If no claim found, fall through to standard question generation
    }
  }

  // ── Standard path: first question on a topic (or fallback) ──────────────
  let attempt = 0;
  while (attempt < 2) {
    try {
      const raw = await callGroq(systemPrompt, messages);
      const parsed = parseInterviewResponse(raw);
      if (parsed.question && parsed.question.length > 5) return parsed;
    } catch (err) {
      console.error(`[LLM] Attempt ${attempt + 1} failed:`, err.message);
    }
    attempt++;
  }

  // Scripted fallback
  console.warn('[LLM] Both attempts failed — using scripted fallback question');
  const fallbackQuestion = currentTopic
    ? `Can you walk me through what you learned in "${currentTopic.title}"? What was the main objective you worked on?`
    : 'Can you describe one of the most challenging things you built during the cohort?';

  return { confidence: 'medium', question: fallbackQuestion };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines if the LLM answer was substantive (not empty/one-word).
 * @param {string} answer
 * @returns {boolean}
 */
function isSubstantiveAnswer(answer) {
  const cleaned = answer?.trim() || '';
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return wordCount >= 4 && cleaned.length >= 15;
}

/**
 * Determines whether to advance to the next topic based on session state and confidence.
 * @param {Object} session
 * @param {string} confidence - 'high'|'medium'|'low'
 * @returns {boolean}
 */
function shouldAdvanceTopic(session, confidence) {
  const { follow_up_count } = session;
  if (follow_up_count >= MAX_FOLLOW_UPS_PER_TOPIC) return true;
  if (confidence === 'high' && follow_up_count >= 1) return true;
  return false;
}

module.exports = {
  getNextQuestion,
  isSubstantiveAnswer,
  shouldAdvanceTopic,
  parseInterviewResponse,
  extractClaim,          // exported for unit testing
  getFollowUpQuestion,   // exported for unit testing
};
