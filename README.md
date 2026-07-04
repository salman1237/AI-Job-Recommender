# AI Job Recommender — AI-Powered Opportunity Discovery Platform

> An end-to-end full-stack system that aggregates scholarships, fellowships, grants, and jobs from multiple sources, parses candidate CVs using **Gemini AI**, and returns a personalised, AI-ranked list of the best opportunities for each user.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [Data Ingestion Pipeline](#data-ingestion-pipeline)
5. [CV Parsing Pipeline](#cv-parsing-pipeline)
6. [AI Scoring & Ranking Pipeline](#ai-scoring--ranking-pipeline)
7. [Caching Strategy](#caching-strategy)
8. [Deployment](#deployment)
9. [Local Setup](#local-setup)

---

## Overview

AI Job Recommender solves a common problem for students and early-career professionals: there are thousands of jobs, scholarships, and fellowships scattered across the internet, but no easy way to find the ones that actually match *your* profile.

This platform:
- **Automatically ingests** opportunities from multiple external sources (WordPress, BDJobs, Shomvob, etc.)
- **Parses your CV** using Google Gemini (Flash Latest) to extract a structured profile (skills, projects, keywords)
- **Ranks every relevant opportunity** against your profile using Gemini, with a 0–100 match score and a one-sentence reason
- **Caches results** in the database so subsequent page loads are instant

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                              │
│           Next.js 16 · TypeScript · Tailwind · Framer Motion        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP (Axios · JWT Bearer)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Python 3.11)                     │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  /auth   │  │  /users  │  │ /opportunities│  │    /admin     │  │
│  │ register │  │    me    │  │  recommended  │  │    ingest     │  │
│  │  login   │  │  avatar  │  │  types/search │  │    runs       │  │
│  └──────────┘  │    cv    │  └──────┬────────┘  └───────────────┘  │
│                └──────────┘         │                               │
│                                     │                               │
│         Argon2 hashing  ·  JWT (HS256)  ·  CORS                    │
└────────────┬──────────────────┬──────────────────────────┬──────────┘
             │                  │                          │
             ▼                  ▼                          ▼
  ┌──────────────────┐  ┌───────────────────┐   ┌──────────────────┐
  │   PostgreSQL DB   │  │    Gemini AI      │   │  Local Filesystem│
  │     (Neon DB)    │  │  (Google AI API)  │   │  uploads/avatars │
  │  opportunities   │  │                   │   │  uploads/cvs     │
  │  users           │  │  CV Parsing       │   └──────────────────┘
  │  ingestion_runs  │  │  Opportunity      │
  │                  │  │  Scoring          │
  │  SQLAlchemy ORM  │  └───────────────────┘
  │  asyncpg driver  │
  └──────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 (App Router) | React framework |
| **Frontend Styling** | Tailwind CSS v4 | Clean UI & components |
| **Animations** | Framer Motion | Page transitions, filter animations |
| **HTTP Client** | Axios | API calls with JWT interceptor |
| **Backend** | FastAPI (Python 3.11) | Async REST API |
| **ORM** | SQLAlchemy 2.x (async) | Database models |
| **DB Driver** | asyncpg | Async PostgreSQL driver |
| **Database** | Neon (PostgreSQL) | Primary cloud data store |
| **Auth** | JWT (HS256) via python-jose | Stateless auth |
| **Password Hashing** | argon2-cffi | Secure password storage |
| **AI / LLM** | Google Gemini (flash-latest) | CV parsing + opportunity scoring |
| **PDF Parsing** | PyPDF2 | Extract raw text from resume PDFs |
| **Deployment** | Vercel (Frontend), FastAPI Cloud (Backend) | Cloud hosting |

---

## Data Ingestion Pipeline

Opportunities are pulled from external sources. The backend supports fetching from BDJobs, Shomvob, and multiple WordPress sites (OpportunityDesk, Opp4Youth, etc.).

A massive initial sync is achieved via the `historical_backfill.py` script which bypasses serverless execution timeouts, while regular syncing can be triggered from the admin dashboard to fetch incremental updates.

---

## CV Parsing Pipeline

When a user uploads a PDF resume:
1. PyPDF2 extracts raw text from the file.
2. The backend sends the text to the Gemini API (`models/gemini-flash-latest`) requesting structured JSON.
3. The response is heavily cleaned (Markdown code blocks stripped) and parsed.
4. The structured skills, education, projects, and keywords are saved directly to the database.

---

## AI Scoring & Ranking Pipeline

1. **Full-Text Search:** PostgreSQL quickly fetches the top 20-100 matching opportunities using the `job_keywords` extracted from the CV.
2. **Gemini Ranking:** The list of opportunities and the user's profile are sent to the Gemini API (`gemini-flash-latest`) in a single bulk request.
3. **Scoring:** Gemini scores each opportunity (0-100) and provides a 1-sentence explanation of why it fits the user.
4. **Caching:** The enriched list is saved in PostgreSQL as a JSONB cache column on the User model for instant retrieval on future visits.

---

## Deployment

The application is deployed in a fully serverless cloud architecture:

1. **Frontend:** Deployed on **Vercel** (`https://ai-job-recommender-flame.vercel.app/`). It builds automatically when code is pushed to GitHub.
2. **Backend:** Deployed on **FastAPI Cloud** (`https://ai-job-recommender.fastapicloud.dev`). Deploys via the `fastapi deploy` CLI command.
3. **Database:** Hosted securely on **Neon** (Serverless PostgreSQL).

### CORS & Security
The backend is strictly configured to only accept requests from the Vercel frontend domain and `localhost:3000` via the `CORS_ORIGINS` environment variable.

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 22+
- A **Google Gemini API key**

### 1. Backend Setup
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env # Configure your DB and Gemini key
alembic upgrade head # Run migrations
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
# Ensure .env.local has NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

### 3. Historical Backfill (Massive Ingestion)
To load thousands of jobs and scholarships initially without hitting cloud execution timeouts:
```bash
.\.venv\Scripts\python historical_backfill.py
```
