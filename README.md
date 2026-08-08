# AI Interview Agent 🎤

An adaptive, multi-turn technical interview agent built for the **31-day AI Engineering Cohort**. It conducts personalized, LLM-powered interviews based on a candidate's actual curriculum progress — using the Groq API with `llama-3.3-70b-versatile`.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your Groq API key in .env
echo "GROQ_API_KEY=your_key_here" > .env

# 3. Start the server
npm start

# 4. Open the chat UI
open http://localhost:3000
```

---

## Project Structure

```
Interview-Agent/
├── src/
│   ├── server.js                  # Express entry point
│   ├── routes/interview.js        # POST /api/interview — all phases
│   ├── store/sessionStore.js      # In-memory session store
│   ├── planner/interviewPlanner.js# Pure fn: candidate → topic queue
│   ├── orchestrator/llmOrchestrator.js  # Groq API + confidence parsing
│   ├── feedback/feedbackGenerator.js    # End-of-interview feedback
│   └── prompts/prompts.js         # All prompt templates (single source)
├── data/
│   ├── curriculum.json            # 31-day curriculum (8 modules)
│   └── candidates.json            # 20 candidate profiles
├── public/
│   └── index.html                 # Chat UI (plain HTML + JS)
├── .env                           # GROQ_API_KEY (never committed)
└── package.json
```

---

## API Endpoint

**Single endpoint, three phases** — all via `POST /api/interview`.

### Phase 1 — Start Interview

```http
POST /api/interview
Content-Type: application/json

{
  "sessionId": "abc-123",
  "candidate": { "id": "CAND-003" }
}
```

The `candidate` field can be:
- `{ "id": "CAND-001" }` — looks up by ID from `candidates.json`
- The full candidate object (as per `candidates.json` schema)

**Response:**
```json
{
  "reply": "Welcome, Emily. Let's start with embeddings — can you walk me through how you used Sentence Transformers to generate embeddings for your knowledge base on Day 7?",
  "done": false
}
```

---

### Phase 2 — Conversation Turn

```http
POST /api/interview
Content-Type: application/json

{
  "sessionId": "abc-123",
  "message": "I used Sentence Transformers to embed each chunk of text..."
}
```

**Response:**
```json
{
  "reply": "Interesting. You mentioned comparing embedding models — what made you choose OpenAI Embeddings over Sentence Transformers for production?",
  "done": false
}
```

---

### Phase 3 — Interview Complete (automatic)

When the completion condition is met, the next turn response automatically includes feedback:

```json
{
  "reply": "Thank you for completing the interview. Here is your feedback.",
  "done": true,
  "feedback": {
    "summary": "Emily demonstrated strong...",
    "strengths": ["Deep understanding of vector embeddings...", "..."],
    "gaps": ["Limited discussion of fine-tuning trade-offs", "..."],
    "next": ["Explore LoRA fine-tuning hands-on", "..."]
  }
}
```

---

### Helper Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/candidates` | List all 20 candidates (for UI dropdown) |

---

## How Adaptiveness Works (Confidence-Tag Mechanism)

Every LLM response for a question uses a strict two-line output format:

```
CONFIDENCE: high|medium|low
[the actual question text]
```

The server **strips the CONFIDENCE tag** before returning the question to the client. The tag drives topic advancement logic server-side:

| Confidence | Follow-up count | Action |
|------------|-----------------|--------|
| `high` | ≥ 1 | Advance to next topic (candidate showed depth) |
| `medium` | ≥ 2 | Advance after follow-up cap is hit |
| `low` | ≥ 2 | Advance after follow-up cap is hit |
| Any | ≥ 2 | **Hard advance** — max 2 follow-ups per topic enforced server-side |

If an answer is fewer than 4 words or 15 characters, the server sends a gentle clarification request without incrementing `question_count` or changing the topic.

---

## How Coverage is Guaranteed (≥ 8 Questions / ≥ 4 Days)

Coverage is enforced **server-side by the Interview Planner**, never by trusting the LLM alone.

### Step 1 — Deterministic Topic Queue (no LLM)

`interviewPlanner.buildPlan(candidate, curriculum)` produces an ordered queue sorted by priority:

1. **Skipped missions** → probe conceptual awareness despite the skip
2. **High-attempt passes (≥3 attempts)** → probe *why* it was hard, depth vs trial-and-error  
3. **First-try / low-attempt passes** → probe deeper reasoning and trade-offs
4. **Minimum padding** → if fewer than 4 topics exist, supplements from mission history

### Step 2 — Server-Side Progress Tracker

`distinct_days_covered[]` and `question_count` are tracked in session state. They are only incremented in route handler code, not by the LLM.

### Step 3 — Completion Condition

```
question_count >= 8
AND distinct_days_covered.length >= 4
AND (plan_index >= plan.length OR question_count >= 20)
```

The hard cap of 20 turns prevents infinite loops during demos.

---

## Reliability & Error Handling

| Situation | Handling |
|-----------|----------|
| LLM call fails | Retry once → scripted fallback question from plan topic |
| Feedback JSON malformed | Retry once → safe default structure (never 500s) |
| Empty/one-word answer | Gentle clarification, doesn't count as a turn |
| Skipped topic probed | Framed as "did you explore independently?" |
| Unknown sessionId on TURN | Returns clean 400 — never silently creates session |
| Hard turn cap (20) reached | Triggers feedback generation automatically |

---

## Sample Transcript — Emily Chen (CAND-003, AI Engineer)

```
🤖 Let's start with embeddings. On Day 7, you used Sentence Transformers to
   generate embeddings. Can you explain what a vector embedding actually
   represents, and why similar concepts end up close together in that space?

👤 Embeddings convert text into high-dimensional vectors that capture semantic
   meaning. Similar words cluster together. I used PCA to visualize how
   healthcare concepts grouped...

🤖 Great. You mentioned comparing Sentence Transformers with OpenAI Embeddings.
   What drove the switch to OpenAI for production — was it purely quality,
   or were there other factors like latency or API reliability?

👤 The OpenAI embeddings had better semantic similarity out of the box, but
   also the production environment had data that could be sent to an external
   API. For cost at scale, OpenAI per-token was actually cheaper than running
   our own GPU...

🤖 Moving to Day 8 — you compared ChromaDB and Pinecone. If you had to
   deploy this to production with 10M documents, which would you choose
   and why?

[... continues for 8+ turns across 4+ curriculum days ...]

🤖 Thank you for completing the interview. Here is your feedback.
   done: true

FEEDBACK:
  Summary: Emily demonstrated strong depth in core AI engineering skills
           including embeddings, RAG, and multi-agent systems...
  Strengths:
    ✅ Strong conceptual clarity on vector embeddings and retrieval
    ✅ Thoughtful trade-off analysis between local and hosted solutions
    ✅ Clear understanding of function calling and structured outputs
  Gaps:
    ⚠️  Limited discussion of monitoring and observability patterns
    ⚠️  Fine-tuning concepts (LoRA/QLoRA) not explored
  Next Steps:
    🚀 Practice hands-on LoRA fine-tuning with the PEFT library
    🚀 Build a simple Prometheus + Grafana monitoring dashboard
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ Yes | Your Groq API key |
| `PORT` | No | Server port (default: 3000) |

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **LLM**: Groq API — `llama-3.3-70b-versatile`
- **Session Store**: In-memory JS object (no database)
- **Frontend**: Plain HTML + Vanilla CSS + Vanilla JS

---

## AI Usage Log

| Step | Tool / Prompt | What was accepted / edited |
|------|--------------|---------------------------|
| Architecture design | Claude Sonnet 4.6 (Antigravity) | Full architecture derived from `architecture.md` and `coding_rules.md` spec |
| `interviewPlanner.js` | Claude Sonnet 4.6 | Pure function with 3-pass prioritisation; reviewed and verified output manually |
| `llmOrchestrator.js` | Claude Sonnet 4.6 | Confidence tag parser and retry logic; tested with live Groq calls |
| `feedbackGenerator.js` | Claude Sonnet 4.6 | JSON safety pattern (strip fences → parse → retry → default) |
| `routes/interview.js` | Claude Sonnet 4.6 | Route handler with single-endpoint multi-phase routing |
| Chat UI `index.html` | Claude Sonnet 4.6 | Premium dark-mode UI; visual design reviewed manually |
| System prompts | Human-authored (project spec) | Used exactly as specified, injected with candidate data |
| End-to-end testing | Live curl mock interview | Verified 8 questions / 4+ days / feedback JSON |