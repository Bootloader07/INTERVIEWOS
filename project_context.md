# Project Context — AI Interview Agent (PS 2)

## What this is
A prototype AI agent for the AI Cohort hackathon, Problem Statement 2: "The Interview Agent." It conducts a realistic, multi-turn technical interview personalized to a specific candidate's actual progress through a 31-day AI engineering curriculum.

## Provided data — single source of truth
Three files, all attached to this repo. **Nothing outside them may be used as interview content.**

- `curriculum.json` — 31 days across 8 modules. Each day has `title`, `type`, `tools[]`, `objectives[]`.
- `candidates.json` — 20 candidate profiles. Each has `member` (id, name, jobRole, yearsExperience, education, status), `missions[]` (day, title, passed/skipped, attempts), and `signals` (commitDays, missionsCompleted, missionsFirstTry).
- `technical-spec.md` — the required HTTP API contract (this is a hard constraint, not a suggestion).

All interview questions, follow-ups, topic references, and feedback must be derivable from `curriculum.json` + the specific candidate's record in `candidates.json`. Do not introduce outside AI/ML knowledge, tools, or concepts not present in these files.

## Goal
Build an agent that, for a given candidate:
- Assesses their understanding of the concepts/missions they actually completed
- Adapts naturally to their responses instead of running a fixed script
- Asks intelligent, grounded follow-up questions
- Maintains context across the whole conversation
- Produces structured, actionable feedback at the end

## Hard requirements (from technical-spec.md)
- Single endpoint: `POST /api/interview`, no auth
- State is tracked purely via `sessionId`
- Minimum 8 questions, covering at least 4 distinct curriculum days
- Follow-ups generated based on the candidate's previous responses
- Conversational tone — not a scripted questionnaire
- Final response includes `{ summary, strengths[], gaps[], next[] }`
- `{reply, done}` shape on every non-final turn

## Explicitly out of scope
Voice interaction, user authentication, persistent user accounts, long-term (cross-session) conversation history, mobile apps. Do not spend build time here.

## Personalization logic (how candidate data should drive the interview)
- **Skipped missions** → good candidates for "gap" probing (do they at least understand the concept conceptually, even if they skipped the hands-on mission?)
- **High attempts on a passed mission** → probe *why* it was hard; look for depth of understanding vs. trial-and-error
- **First-try passes** → probe higher-order reasoning ("why this approach over X") rather than basics
- **jobRole / yearsExperience / education** → only affects tone/framing of questions, never which topics are fair game (topics still come only from their actual mission history)
- **signals.missionsFirstTry / missionsCompleted** → rough proxy for overall confidence calibration going into the interview

## Why the hackathon rules matter for how we build (not just what we build)
- **Stage 1 (auto)**: repo must be public, live demo must actually work, AI Usage Log must be present — treat these as release-blocking checks, not afterthoughts.
- **Stage 2 (authenticity)**: commit history is reviewed. A single giant "final" commit or an AI Usage Log that doesn't match the real build reads as suspicious. Build incrementally, log as you go.
- **Stage 3 (judging)**: two independent judges, 100-pt rubric, averaged (median-of-three if they diverge >15 pts) — favors a project that's clearly *working end-to-end* over one with more features half-done.
- **Stage 4 (Live Steer, top 6)**: you may have to extend this exact repo live, in 20 minutes, on an unseen feature request. Code needs to be legible and modular enough for someone (with AI tool help) to safely change under time pressure — this directly informs `coding_rules.md` and `architecture.md`.
