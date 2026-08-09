# INTERVIEWOS 🎙️

### Train Like You're Already Hired.

**INTERVIEWOS** is an adaptive AI-powered technical interview platform that conducts realistic, multi-turn interviews tailored to each candidate's actual learning journey.

Instead of asking the same predefined questions to everyone, INTERVIEWOS analyzes a candidate's curriculum progress, mission history, attempts, and previous answers to dynamically decide what to ask next.

Powered by **Groq + Llama 3.3 70B**, INTERVIEWOS is designed to simulate the reasoning, depth, and follow-up behavior of a real technical interviewer.

---

## ✨ Features

### 🧠 Adaptive AI Interviewing

INTERVIEWOS doesn't follow a fixed questionnaire.

The interviewer dynamically adapts based on what the candidate says during the interview.

* Generates contextual follow-up questions
* Tracks conversation history
* Detects answer depth
* Uses confidence signals to control topic progression
* Limits follow-ups to prevent the interview from getting stuck on one topic

### 🎯 Candidate-Specific Personalization

Every interview is built around the candidate's actual curriculum journey.

The system considers:

* Completed missions
* Skipped missions
* Number of attempts
* First-try completions
* Curriculum days covered
* Candidate role and experience

This allows INTERVIEWOS to ask questions that are relevant to what the candidate has actually worked on.

### 🔍 Claim-Based Follow-Ups

Rather than asking generic questions like:

> "Tell me more about embeddings."

INTERVIEWOS extracts a **specific claim from the candidate's answer** and challenges it.

For example:

**Candidate:**
"I chose Pinecone because it was easier to scale."

**INTERVIEWOS:**
"What made Pinecone a better scaling choice for your workload, and how would you validate that decision?"

This creates a much more realistic technical interview experience.

### 📊 Intelligent Evaluation

At the end of the interview, INTERVIEWOS generates a structured evaluation containing:

* **Overall Score**
* **Technical Knowledge**
* **System Design**
* **Communication**
* **Problem Solving**
* **Strengths**
* **Knowledge Gaps**
* **Recommended Next Steps**

The goal isn't just to give a score — it's to tell the candidate **what to improve next**.

### 📈 Live Interview Analytics

During the interview, candidates can see:

* Question progress
* Interview timer
* Current topic
* Adaptive interview status
* Skills radar
* Curriculum journey
* Covered curriculum days

### 💻 Technical Response Workspace

Candidates can provide:

* Technical explanations
* Code / implementation approaches
* A dedicated code scratchpad

Both can be submitted as part of the same interview response.

### 🛡️ Reliable AI Execution

INTERVIEWOS is designed to remain usable even when an LLM request fails.

The backend includes:

* LLM retry logic
* Scripted fallback questions
* Safe feedback fallback
* Invalid-session handling
* Empty-answer handling
* Interview turn limits

---

## 🏗️ Architecture

```text
                    ┌─────────────────────────┐
                    │       INTERVIEWOS       │
                    │       Web Interface     │
                    └────────────┬────────────┘
                                 │
                                 │ HTTP
                                 ▼
                    ┌─────────────────────────┐
                    │     Express Server      │
                    │                         │
                    │  /api/interview         │
                    │  /api/candidates        │
                    │  /api/curriculum        │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
      ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
      │ Interview    │   │ LLM          │   │ Feedback     │
      │ Planner      │   │ Orchestrator │   │ Generator    │
      └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
             │                  │                  │
             ▼                  ▼                  ▼
      Candidate +         Groq / Llama       Structured
      Curriculum          3.3 70B            Evaluation
             │
             └──────────────────┬──────────────────┘
                                ▼
                       ┌──────────────────┐
                       │ Session Store    │
                       │ In-Memory State   │
                       └──────────────────┘
```

---

## 🔄 Interview Flow

```text
Candidate Selection
        │
        ▼
Build Personalized Interview Plan
        │
        ▼
Generate Opening Question
        │
        ▼
Candidate Answers
        │
        ▼
Analyze Response
        │
        ├── Strong Answer ──────► Move Deeper / New Topic
        │
        ├── Partial Answer ─────► Targeted Follow-up
        │
        └── Weak Answer ────────► Clarify / Probe
        │
        ▼
Cover Required Curriculum Areas
        │
        ▼
Interview Complete
        │
        ▼
AI Evaluation
        │
        ▼
Scores + Strengths + Gaps + Next Steps
```

---

## 📚 Curriculum Coverage

Interview coverage is enforced by the backend rather than relying entirely on the LLM.

The planner prioritizes:

1. Skipped missions
2. Missions requiring multiple attempts
3. First-try / low-attempt missions
4. Additional mission history when more coverage is needed

The interview tracks:

* Number of questions
* Distinct curriculum days covered
* Current topic
* Interview plan
* Maximum interview length

This keeps the interview structured while still allowing the conversation to feel natural.

---

## 🧩 Project Structure

```text
INTERVIEWOS/
│
├── src/
│   ├── server.js
│   │
│   ├── routes/
│   │   └── interview.js
│   │
│   ├── planner/
│   │   └── interviewPlanner.js
│   │
│   ├── orchestrator/
│   │   └── llmOrchestrator.js
│   │
│   ├── feedback/
│   │   └── feedbackGenerator.js
│   │
│   ├── prompts/
│   │   └── prompts.js
│   │
│   └── store/
│       └── sessionStore.js
│
├── data/
│   ├── curriculum.json
│   └── candidates.json
│
├── public/
│   ├── index.html
│   └── loading.css
│
├── architecture.md
├── technical-spec.md
├── project_context.md
├── coding_rules.md
├── package.json
└── README.md
```

---

## ⚙️ Tech Stack

| Layer         | Technology                    |
| ------------- | ----------------------------- |
| Runtime       | Node.js                       |
| Backend       | Express.js                    |
| LLM           | Groq API                      |
| Model         | Llama 3.3 70B Versatile       |
| Frontend      | HTML, CSS, Vanilla JavaScript |
| Session State | In-memory JavaScript store    |
| API           | REST                          |
| Configuration | dotenv                        |
| CORS          | Express CORS                  |

The project currently uses Express, Groq SDK, dotenv, CORS and UUID dependencies.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd INTERVIEWOS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file:

```env
GROQ_API_KEY=your_groq_api_key
PORT=3000
```

> Never commit your `.env` file or expose your API key publicly.

### 4. Start the application

```bash
npm start
```

For development:

```bash
npm run dev
```

### 5. Open INTERVIEWOS

```text
http://localhost:3000
```

---

## 🔌 API

### Start an Interview

```http
POST /api/interview
```

```json
{
  "sessionId": "abc-123",
  "candidate": {
    "id": "CAND-003"
  }
}
```

### Submit an Answer

```http
POST /api/interview
```

```json
{
  "sessionId": "abc-123",
  "message": "My answer to the interview question..."
}
```

### End Interview Early

```http
POST /api/interview
```

```json
{
  "sessionId": "abc-123",
  "message": "__END_INTERVIEW__"
}
```

### Helper Endpoints

| Method | Endpoint          | Purpose                     |
| ------ | ----------------- | --------------------------- |
| GET    | `/health`         | Server health check         |
| GET    | `/api/candidates` | Retrieve candidate profiles |
| GET    | `/api/curriculum` | Retrieve curriculum summary |

---

## 🧾 Evaluation Output

A completed interview returns structured feedback:

```json
{
  "summary": "Overall candidate assessment...",
  "strengths": [
    "Strong technical reasoning",
    "Clear communication"
  ],
  "gaps": [
    "Needs deeper system design reasoning"
  ],
  "next": [
    "Practice production-scale architecture"
  ],
  "scores": {
    "technical": 82,
    "systemDesign": 76,
    "communication": 88,
    "problemSolving": 81
  }
}
```

---

## 🔐 Environment Variables

| Variable       | Required | Description                     |
| -------------- | -------- | ------------------------------- |
| `GROQ_API_KEY` | Yes      | Groq API authentication key     |
| `PORT`         | No       | Server port, defaults to `3000` |

---

## 🛡️ Reliability

INTERVIEWOS includes defensive handling for common runtime failures.

| Failure                    | Behavior                                   |
| -------------------------- | ------------------------------------------ |
| Groq request fails         | Retry + fallback question                  |
| Invalid feedback JSON      | Retry + safe fallback                      |
| Empty answer               | Request clarification                      |
| Unknown session            | Return clean `400` response                |
| Early termination          | Generate evaluation from available answers |
| Excessive interview length | Enforce hard limit                         |

---

## 🎨 Product Philosophy

INTERVIEWOS is built around one principle:

> **A good interview should respond to the candidate — not just read questions to them.**

The system combines deterministic planning with LLM-driven conversation so that the interview remains both:

**Structured enough to evaluate.**
**Flexible enough to feel real.**

---

## 🚧 Roadmap

* [ ] Voice interview mode
* [ ] Speech-to-text responses
* [ ] Text-to-speech interviewer
* [ ] Persistent interview history
* [ ] User authentication
* [ ] Resume-based interview personalization
* [ ] Job-description based interviews
* [ ] Interview history & performance trends
* [ ] More detailed skill analytics
* [ ] Multi-interview session comparison

---

## 👨‍💻 Project

**INTERVIEWOS** — an adaptive AI technical interview platform built to make interview preparation more realistic, personalized, and actionable.

**Train Like You're Already Hired.** 🎙️

