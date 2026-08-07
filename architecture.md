# Architecture — AI Interview Agent

## High-level flow
1. **START** — client `POST`s `{sessionId, candidate}`. Server creates session state, builds a candidate-specific interview plan from `candidate.missions` + `curriculum.json`, returns a welcome `reply`.
2. **TURN** — client `POST`s `{sessionId, message}`. Server appends the answer to the transcript, decides whether to follow up on the current topic or advance to the next planned topic, returns the next `reply`.
3. **END** — once the completion condition is met, the next turn's response is the final one: structured `feedback` + `done: true`, instead of another question.

## Components

**1. API layer**
FastAPI (or equivalent), single route `POST /api/interview`. Routing is based on payload shape:
- has `candidate` → START
- has `message` → TURN (requires existing session)

**2. Session Store**
Keyed by `sessionId`. In-memory dict is fine for a prototype; swap for Redis only if time allows and it's genuinely useful for the live-demo/steer-round story. Holds the shape below.

**3. Interview Planner** (pure function, no LLM)
Input: `candidate.missions` + `curriculum.json`. Output: an ordered queue of topics to probe:
```
[{ day, title, objectives, tools, priority_reason }]
```
Prioritization (see `project_context.md` for the reasoning):
- skipped missions → "probe conceptual awareness despite the skip"
- high-attempt passes → "probe why it was hard"
- first-try passes → "probe deeper reasoning / trade-offs"

This must stay independent of the LLM so it's deterministic and unit-testable, and so the ≥4-distinct-days requirement is guaranteed by construction, not by hoping the LLM remembers.

**4. LLM Orchestrator**
One system prompt containing: candidate context, the current planned topic, and a recent window of the transcript. On each TURN it should either:
(a) ask a grounded follow-up on the current topic (if the last answer was vague/incomplete), or
(b) advance to the next topic in the plan and ask a new question.
Follow-ups are capped (e.g., max 2 per topic) so the 8-question/4-day minimum stays reachable within a sane turn budget.

**5. Progress Tracker** (server-side, not LLM-side)
Increments `question_count` and adds to `distinct_days_covered` only when a *new* topic question is asked (not on follow-ups). This is what actually enforces the spec's hard minimums — don't leave that enforcement to LLM judgment alone.

**6. Feedback Generator**
Fires once the Progress Tracker reports the plan is exhausted. One final LLM call over the full transcript + planned objectives, mapped back to curriculum day titles, producing:
```
{ summary: str, strengths: string[], gaps: string[], next: string[] }
```

**7. Memory layer — optional (Breeth)**
If used: write one fact/episode per assessed topic during the QUESTIONING phase, and let the Feedback Generator pull from it as a secondary signal instead of purely re-reading the raw transcript. Must degrade gracefully — wrap in try/except, fall back to transcript-only summarization if Breeth is slow/unreachable/quota-exceeded. Never a hard dependency for the live demo.

## Session state shape
```json
{
  "sessionId": "abc-123",
  "candidate": { "...": "candidate.json shape" },
  "plan": [{ "day": 7, "title": "Embeddings Explained", "objectives": ["..."], "tools": ["..."], "priority_reason": "first-try pass, probe depth" }],
  "plan_index": 0,
  "transcript": [{ "role": "assistant|user", "content": "...", "day_ref": 7 }],
  "distinct_days_covered": [7, 8, 12],
  "question_count": 3,
  "phase": "INTRO | QUESTIONING | CLOSING | DONE"
}
```

## Completion condition
```
question_count >= 8
AND len(distinct_days_covered) >= 4
AND (plan_index >= len(plan) OR turn_count >= max_turns_safety_cap)
```
`max_turns_safety_cap` (e.g. 20) exists purely so a stuck LLM loop can't run forever during the demo.

## Error handling
- Missing/invalid `sessionId` → 400, but keep response JSON-shaped where feasible
- `message` sent for an unknown `sessionId` → clear error, don't silently create a new session
- LLM call fails → one retry, then fall back to a safe scripted question pulled straight from the plan queue — the interview must never hard-crash mid-demo
- Every response, success or error, should be valid JSON — graders are checking contract compliance programmatically

## Default tech stack
FastAPI + Python (matches the curriculum's own stack), in-memory session store for the prototype, Claude or an OpenAI-compatible chat completion for orchestration, optional Breeth REST calls for topic-level memory. Deviate only with a clear reason — the rubric rewards a working, legible system over a novel stack.
