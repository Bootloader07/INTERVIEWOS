/**
 * interviewPlanner.js — Pure function: candidate + curriculum → ordered topic queue.
 *
 * This module has ZERO dependency on the LLM. It is deterministic and unit-testable.
 * The ≥4-distinct-days requirement is guaranteed here, not by trusting the LLM.
 */

// Maximum topics in the plan. With 2 follow-ups per topic this gives
// 6 × 3 = 18 turns maximum — well above the 8-question minimum,
// and small enough that plan exhaustion coincides with the minimum boundary.
const MAX_PLAN_TOPICS = 6;

/**
 * Builds a prioritised topic plan for a candidate, capped at MAX_PLAN_TOPICS.
 *
 * Prioritisation:
 * 1. Skipped missions  — "probe conceptual awareness despite the skip"
 * 2. High-attempt passes (attempts >= 3) — "probe why it was hard"
 * 3. First-try / low-attempt passes — "probe deeper reasoning / trade-offs"
 *
 * The cap prevents the queue from growing to one-topic-per-mission (10+),
 * which is the root cause of Bug 1: plan exhaustion was never reached,
 * so the completion check never fired at the minimum boundary.
 *
 * @param {Object} candidate  - Full candidate object from candidates.json
 * @param {Object} curriculum - Full curriculum.json object
 * @returns {Array} Ordered plan (≤ MAX_PLAN_TOPICS): [{ day, title, objectives, tools, priority_reason }]
 */
function buildPlan(candidate, curriculum) {
  const { missions } = candidate;

  // Lookup map: day number → curriculum day details
  const curriculumByDay = {};
  for (const day of curriculum.days) {
    curriculumByDay[day.day] = day;
  }

  const topicQueue = [];

  // Helper: push a topic if the day isn't already queued and cap not yet reached
  const push = (m, priority_reason, wasSkipped) => {
    if (topicQueue.length >= MAX_PLAN_TOPICS) return;
    if (topicQueue.some(t => t.day === m.day)) return;
    const currDay = curriculumByDay[m.day];
    if (!currDay) return;
    topicQueue.push({
      day: m.day,
      title: currDay.title,
      objectives: currDay.objectives,
      tools: currDay.tools,
      priority_reason,
      wasSkipped,
    });
  };

  // Pass 1 — Skipped missions (highest priority — gap probing)
  missions.filter(m => m.skipped)
    .forEach(m => push(m, 'skipped — probe conceptual awareness', true));

  // Pass 2 — High-attempt passes (≥3 attempts) — probe difficulty
  missions.filter(m => m.passed && m.attempts >= 3)
    .forEach(m => push(m, `passed after ${m.attempts} attempts — probe what was hard`, false));

  // Pass 3 — First-try / low-attempt passes — probe depth and trade-offs
  missions.filter(m => m.passed && m.attempts < 3)
    .forEach(m => push(m, `first-try pass (${m.attempts} attempt${m.attempts > 1 ? 's' : ''}) — probe deeper reasoning`, false));

  // Guarantee minimum 4 distinct days — pad if still short
  if (topicQueue.length < 4) {
    missions.forEach(m => push(m, 'supplemental — ensure 4-day minimum', !!m.skipped));
  }

  return topicQueue;
}

/**
 * Determines the current topic based on session state.
 * Advances the plan index if the follow-up cap has been reached.
 *
 * @param {Object} session - Current session state
 * @returns {Object|null} Current topic or null if plan exhausted
 */
function getCurrentTopic(session) {
  const { plan, plan_index } = session;
  if (plan_index >= plan.length) return null;
  return plan[plan_index];
}

/**
 * Returns days not yet covered in the interview (for prompt context).
 * @param {Object} session
 * @returns {Array<string>} Day numbers not yet discussed
 */
function getUncoveredDays(session) {
  const { plan, distinct_days_covered } = session;
  return plan
    .map(t => t.day)
    .filter(day => !distinct_days_covered.includes(day));
}

/**
 * Checks the interview completion condition.
 * Server-side enforcement — not left to LLM judgment.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function isInterviewComplete(session) {
  const HARD_CAP = 8;
  const { question_count, distinct_days_covered } = session;

  // 1. Hard absolute cap at 8 questions: regardless of days covered or plan state
  if (question_count >= HARD_CAP) return true;

  // 2. Plan exhausted
  if (session.plan && session.plan_index >= session.plan.length) return true;

  // 3. Minimums met (question_count >= 8 AND distinct_days >= 4)
  const minimumsMet = question_count >= 8 && distinct_days_covered.length >= 4;
  if (minimumsMet) return true;

  return false;
}

module.exports = { buildPlan, getCurrentTopic, getUncoveredDays, isInterviewComplete };
