# Ai — Modern AI Chatbot & Study Platform

A modern, minimalist black-and-white AI chatbot and study platform featuring real-time streaming conversations, Firebase authentication, Firestore persistence, PDF processing, educational study tools, and Groq-powered high-throughput AI responses.

![Ai Logo](public/logo.jpg)

---

## Features

- **Groq Free Tier AI Integration**: Real-time streaming powered by `qwen/qwen3.8-27b` with intelligent token budgeting, automatic retry handling, and rate-limit preservation.
- **Minimalist Monochrome UI**: Clean, ChatGPT-inspired dark design with high-contrast typography and smooth animations.
- **Firebase Authentication & Firestore**: Secure email/password login, password recovery, guest demo sessions, and isolated user data persistence.
- **Interactive Educational Modes**:
  - **Explain a Topic**: Intuitive, step-by-step conceptual breakdowns.
  - **Coding & Algorithms**: Detailed algorithmic analysis, complexity breakdowns, and code snippets.
  - **Exam Preparation**: High-scoring university model answers.
  - **PDF Document Analysis (RAG)**: Upload lecture slides and notes for grounded citations and synthesis.
- **Academic Study Suite**:
  - **My Notes**: Save AI explanations directly into searchable subject notes.
  - **Interactive Quizzes**: Auto-generate multiple-choice questions with instant scoring.
  - **Flashcards**: Interactive study cards with flip animations and recall tracking.
  - **Study Planner**: Subject tracking, exam countdowns, and automated 7-day study schedules.
- **Robust Dev Orchestration**: Concurrent frontend (port 3000) and backend (port 5000) management with automatic port cleanup on Windows.

---

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Framer Motion
- **Backend**: Express, Node.js, `tsx`, Server-Sent Events (SSE)
- **Serverless**: Vercel Serverless Functions (`/api/*`)
- **Authentication & Database**: Firebase Authentication, Cloud Firestore
- **AI Engine**: Groq Free API (`qwen/qwen3.8-27b`)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/P6i2y0u3s7h/Ai.git
cd Ai
```

### 2. Install Dependencies

Install root dependencies and backend dependencies:

```bash
npm install
npm --prefix server install
```

### 3. Environment Configuration

Copy the example environment files:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Configure your environment variables:
- **`GROQ_API_KEY`**: Obtain a free API key at [console.groq.com](https://console.groq.com/keys).
- **`VITE_FIREBASE_*`**: Your Firebase web app configuration credentials.

### 4. Run the Development Server

Start both the frontend and backend with a single command:

```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend**: [http://localhost:5000](http://localhost:5000)

---

## Available Scripts

- `npm run dev`: Starts both frontend (port 3000) and backend (port 5000) concurrently.
- `npm run dev:frontend`: Starts only the Vite frontend dev server.
- `npm run dev:server`: Starts only the Express AI backend server.
- `npm test`: Runs the automated test suite (isolation verification, Groq rate limiting, and study tools).
- `npm run build`: Type-checks and creates the production bundle.
- `npm run preview`: Locally previews the production build.

---

## License

MIT
