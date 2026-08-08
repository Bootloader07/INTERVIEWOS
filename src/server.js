/**
 * server.js — Express entry point for the AI Interview Agent.
 *
 * Starts the server, mounts routes, serves the static chat UI.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const interviewRouter = require('./routes/interview');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static files (chat UI)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/interview', interviewRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Candidates list — returns full candidate objects (member + missions + signals)
// Extended for InterviewOS lobby UI (mission dots, focus areas, signals display)
app.get('/api/candidates', (req, res) => {
  const candidatesData = require('../data/candidates.json');
  res.json(candidatesData.candidates);
});

// Curriculum summary — used by Landing stat pills and radar axis labels
app.get('/api/curriculum', (req, res) => {
  const curriculum = require('../data/curriculum.json');
  res.json({
    cohort: curriculum.cohort,
    totalDays: curriculum.days.length,
    modules: curriculum.modules,
  });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎤 AI Interview Agent running at http://localhost:${PORT}`);
  console.log(`   Chat UI:  http://localhost:${PORT}/`);
  console.log(`   Endpoint: POST http://localhost:${PORT}/api/interview`);
  console.log(`   Health:   GET  http://localhost:${PORT}/health\n`);
});

module.exports = app;
