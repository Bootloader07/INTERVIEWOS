/**
 * sessionStore.js — In-memory session store keyed by sessionId.
 * No database required for this prototype.
 */

const sessions = {};

/**
 * Creates a new session.
 * @param {string} sessionId
 * @param {Object} candidate  - Full candidate object from candidates.json
 * @param {Array}  plan       - Ordered topic queue from interviewPlanner
 * @returns {Object} The new session state
 */
function createSession(sessionId, candidate, plan) {
  sessions[sessionId] = {
    sessionId,
    candidate,
    plan,
    plan_index: 0,
    transcript: [],          // [{ role: 'assistant'|'user', content, day_ref }]
    distinct_days_covered: [],
    question_count: 0,
    follow_up_count: 0,      // follow-ups on the CURRENT topic
    phase: 'QUESTIONING',    // QUESTIONING | DONE
  };
  return sessions[sessionId];
}

/**
 * Retrieves an existing session by ID.
 * @param {string} sessionId
 * @returns {Object|null}
 */
function getSession(sessionId) {
  return sessions[sessionId] || null;
}

/**
 * Updates a session in place.
 * @param {string} sessionId
 * @param {Object} updates - Partial object to merge into session
 * @returns {Object} Updated session
 */
function updateSession(sessionId, updates) {
  if (!sessions[sessionId]) {
    throw new Error(`Session ${sessionId} not found`);
  }
  Object.assign(sessions[sessionId], updates);
  return sessions[sessionId];
}

/**
 * Deletes a session (optional cleanup).
 * @param {string} sessionId
 */
function deleteSession(sessionId) {
  delete sessions[sessionId];
}

module.exports = { createSession, getSession, updateSession, deleteSession };
