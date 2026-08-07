# Coding Rules

## Ground-truth constraint (highest priority)
Every question, topic reference, tool mention, and feedback point must trace back to `curriculum.json` or the specific candidate's record in `candidates.json`. If a question cites a tool or concept, that tool/concept must actually appear in the matched day's `tools[]` or `objectives[]`. Never fill gaps with outside AI/ML trivia — if the data doesn't cover it, don't ask about it.

## API contract compliance (non-negotiable)
- Exactly one endpoint: `POST /api/interview`
- Every response is valid JSON matching either `{ reply, done }` or the final `{ reply, done: true, feedback }` shape — no missing fields, no extras, no renamed keys
- `sessionId` is the only state key required — do not add auth headers, cookies, or assume any of that exists
- Never deviate from field names/casing given in `technical-spec.md`

## Code structure
- Keep these as separate modules, not logic inlined in route handlers: API layer / session store / interview planner / LLM orchestrator / feedback generator
- Interview Planner (candidate → topic queue) must be pure and unit-testable, with zero dependency on the LLM
- One system prompt template, versioned in a single prompts/constants file — not duplicated or reworded ad hoc across the codebase

## LLM prompting rules
- System prompt must explicitly state: only reference the provided curriculum/candidate data, ask one question at a time, follow up if the last answer was vague before moving on, keep the tone conversational rather than quiz-show
- Never let the LLM invent candidate history not present in `candidates.json`
- Cap follow-ups per topic (e.g. max 2) so the 8-question/4-day minimum stays reachable in a reasonable number of turns
- Topic advancement and question-count/day-count tracking happen in code (Progress Tracker), not purely by trusting the LLM's own judgment

## Commit & authenticity discipline (Stage 2 depends on this)
- Commit early and often in small, logical chunks — e.g. scaffold → session store → planner → orchestrator → feedback generator → polish. No single large "final" commit.
- Each commit message should describe what actually changed
- Maintain the AI Usage Log continuously as you build (prompt, tool, what was accepted/edited), not reconstructed afterward — it needs to genuinely correspond to the implemented features

## Reliability rules (the live demo must not break)
- Wrap all LLM calls and any optional external calls (e.g. Breeth) in try/except with a safe fallback
- A missing/failing optional feature must never 500 the endpoint
- Validate incoming JSON shape before touching it; return clean 400s instead of crashing
- Add a hard turn-count safety cap so a stuck LLM loop can't run the interview forever

## Things to explicitly avoid
- No auth, no persistent DB, no voice, no mobile-specific code — these are out of scope, don't spend time here
- No fixed, identical 8-question script reused for every candidate — the plan must be derived per-candidate from their actual mission history
- No silent renaming or restructuring of the spec's request/response fields
- No hardcoded secrets/API keys in the repo — use environment variables
