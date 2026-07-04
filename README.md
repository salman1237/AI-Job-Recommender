# Opportunity Finder — AI-Powered Opportunity Discovery Platform

> An end-to-end full-stack system that aggregates scholarships, fellowships, grants, and jobs from multiple sources, parses candidate CVs using **Gemini 2.5 Flash**, and returns a personalised, AI-ranked list of the best opportunities for each user.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [Data Ingestion Pipeline](#data-ingestion-pipeline)
5. [CV Parsing Pipeline](#cv-parsing-pipeline)
6. [AI Scoring & Ranking Pipeline](#ai-scoring--ranking-pipeline)
7. [Caching Strategy](#caching-strategy)
8. [Project Structure](#project-structure)
9. [API Reference](#api-reference)
10. [Frontend Pages](#frontend-pages)
11. [Environment Variables](#environment-variables)
12. [Local Setup](#local-setup)
13. [Running the Project](#running-the-project)

---

## Overview

Opportunity Finder solves a common problem for students and early-career professionals: there are thousands of jobs, scholarships, and fellowships scattered across the internet, but no easy way to find the ones that actually match *your* profile.

This platform:
- **Automatically ingests** opportunities from multiple external sources on a daily schedule
- **Parses your CV** using Google Gemini 2.5 Flash to extract a structured profile (skills, projects, keywords)
- **Ranks every relevant opportunity** against your profile using Gemini, with a 0–100 match score and a one-sentence reason
- **Caches results** in the database so subsequent page loads are instant — only re-calls Gemini when you explicitly ask for a refresh

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                              │
│                    http://localhost:3000                             │
│           Next.js 16 · TypeScript · Tailwind · Framer Motion        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP (Axios · JWT Bearer)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Python 3.11)                     │
│                    http://127.0.0.1:8000                             │
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
  │   PostgreSQL DB   │  │  Gemini 2.5 Flash │   │  Local Filesystem│
  │                  │  │  (Google AI API)  │   │  uploads/avatars │
  │  opportunities   │  │                  │   │  uploads/cvs     │
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
| **Frontend Styling** | Tailwind CSS v4 + Vanilla CSS | Glassmorphism UI |
| **Animations** | Framer Motion | Page transitions, filter animations |
| **HTTP Client** | Axios | API calls with JWT interceptor |
| **Backend** | FastAPI (Python 3.11) | Async REST API |
| **ORM** | SQLAlchemy 2.x (async) | Database models |
| **DB Driver** | asyncpg | Async PostgreSQL driver |
| **Database** | PostgreSQL | Primary data store |
| **Migrations** | Alembic | Schema versioning |
| **Auth** | JWT (HS256) via python-jose | Stateless auth |
| **Password Hashing** | argon2-cffi | Secure password storage |
| **AI / LLM** | Google Gemini 2.5 Flash | CV parsing + opportunity scoring |
| **PDF Parsing** | PyPDF2 | Extract raw text from resume PDFs |
| **Scheduler** | APScheduler | Daily automated ingestion |
| **Task Queue** | FastAPI BackgroundTasks | Non-blocking ingest jobs |
| **HTTP Requests** | httpx (async) | Calling Gemini API |

---

## Data Ingestion Pipeline

Opportunities are pulled from external sources **automatically every day at 02:07 UTC** via a scheduled job (APScheduler), or manually via the Admin Dashboard.

```
External Source APIs
        │
        ▼
  Ingestion Runner (app/ingest/runner.py)
        │
        │  For each source:
        │    1. Fetch raw listings via HTTP
        │    2. Normalize fields → title, org, type, deadline, tags, url
        │    3. Hash content (SHA-256) for deduplication
        │    4. Upsert into `opportunities` table
        │       • New record   → INSERT
        │       • Changed hash → UPDATE
        │       • Unchanged    → SKIP
        │    5. Log result to `ingestion_runs` table
        │
        ▼
  PostgreSQL `opportunities` table
        │
        │  Auto-generated column (STORED):
        │    search_tsv = weighted tsvector
        │      title       → weight A (highest)
        │      organization → weight B
        │      location    → weight B
        │      category    → weight B
        │      description → weight C (lowest)
        │
        ▼
  GIN index on search_tsv → fast full-text search
```

### How Full-Text Search Works

When a user's CV has keywords like `["Python", "Machine Learning", "Data Science"]`, the backend runs:

```sql
WHERE search_tsv @@ plainto_tsquery('simple', 'Python')
   OR search_tsv @@ plainto_tsquery('simple', 'Machine Learning')
   OR search_tsv @@ plainto_tsquery('simple', 'Data Science')
ORDER BY posted_at DESC
LIMIT 100
```

This instantly returns the top 100 most recent relevant listings, which are then sent to Gemini for fine-grained scoring.

---

## CV Parsing Pipeline

When a user uploads a PDF resume:

```
User uploads PDF
        │
        ▼
  FastAPI: POST /users/me/cv
        │
        ├─→ Save PDF to disk: uploads/cvs/cv_user_{id}.pdf
        │
        ├─→ PyPDF2: Extract all text from every page
        │
        ├─→ Gemini 2.5 Flash prompt:
        │     "Extract the following from this resume text and
        │      return as JSON:
        │        - skills: string[]
        │        - education: { degree, institution, year }
        │        - achievements: string[]
        │        - projects: [{ name, description }]
        │        - job_keywords: string[]   ← most important field"
        │
        │   response_mime_type: "application/json"  ← enforces valid JSON
        │
        ├─→ Parse JSON response
        │
        └─→ Save to users.parsed_cv (JSONB column)
```

**Example output stored in DB:**
```json
{
  "skills": ["Python", "React", "PostgreSQL", "Machine Learning"],
  "education": {
    "degree": "BSc Computer Science",
    "institution": "University of Dhaka",
    "year": "2024"
  },
  "achievements": ["Dean's List 2023", "Hackathon Winner"],
  "projects": [
    { "name": "Sentiment Analyzer", "description": "NLP model with 94% accuracy" }
  ],
  "job_keywords": [
    "software engineer", "backend developer", "data science",
    "machine learning", "python developer", "research assistant"
  ]
}
```

The `job_keywords` field drives the PostgreSQL full-text search — Gemini automatically generates the right search terms based on your experience.

---

## AI Scoring & Ranking Pipeline

This is the core of the platform. After loading a user's CV, the system calls `GET /opportunities/recommended`:

```
Step 1: Check Cache
   └─ If users.cached_recommendations is not null AND ?refresh=false
        └─ Return cached list instantly (0 Gemini calls, ~50ms)

Step 2: Full-Text Search (PostgreSQL)
   └─ Fetch top 100 matching opportunities using CV's job_keywords
   └─ Sorted by posted_at DESC (most recent first)

Step 3: Build Gemini Prompt
   └─ Candidate summary:
        "Skills: Python, React...
         Keywords: software engineer, backend developer...
         Projects: Sentiment Analyzer...
         Achievements: Dean's List 2023..."
   └─ Opportunities context (top 100):
        [{ id, title, organization, type, description[:400], tags }]

Step 4: Call Gemini 2.5 Flash
   └─ Model: gemini-2.5-flash
   └─ Timeout: 60 seconds
   └─ response_mime_type: "application/json"
   └─ Returns:
        [
          { "id": 123, "match_score": 92, "match_reason": "Strong Python + ML match" },
          { "id": 456, "match_score": 71, "match_reason": "Backend skills align well" },
          ...
        ]

Step 5: Merge & Sort
   └─ Join Gemini scores back to full opportunity records
   └─ Sort by match_score DESC
   └─ Save full enriched list to users.cached_recommendations (JSONB)

Step 6: Return to Frontend
   └─ RerankedList { total, cached, items: RerankedOpportunity[] }
```

### Scoring Principles

| Score | Meaning |
|-------|---------|
| **80–100** | Strong match — directly aligned skills, title, or domain |
| **50–79** | Moderate match — some overlap but not an exact fit |
| **0–49** | Weak match — only tangentially related |

> Gemini is instructed: *"Only give high scores (80+) for genuinely strong matches. Be precise."*
> This prevents score inflation and keeps the top results meaningful.

### Frontend Filters (client-side, no extra API calls)

Once the ranked list is loaded, all filtering is instant (in-browser):

| Filter | Default | Behaviour |
|--------|---------|-----------|
| **Type toggles** | All types shown | Click to show only Job / Scholarship / Fellowship etc. |
| **Hide <50% matches** | **ON** | Hides weak matches; toggle off to see all |
| **Hide expired** | **ON** | Hides past-deadline items; toggle off to see them (greyed out) |

---

## Caching Strategy

| Scenario | Behaviour | Gemini Calls |
|----------|-----------|-------------|
| First visit after CV upload | Calls Gemini, saves to DB | 1 call |
| Page refresh / navigate back | Reads from `users.cached_recommendations` | **0 calls** |
| Click "Refresh with AI" button | Passes `?refresh=true`, re-calls Gemini, updates cache | 1 call |
| Upload new CV | Cache is NOT auto-invalidated; user should click Refresh | 0 calls |

The cache lives in the `users` table as a JSONB column alongside the full opportunity data (title, score, reason, deadline, etc.), so no DB joins are needed on cache hits.

---

## Project Structure

```
campus365_career/
│
├── .env                        ← Environment variables (see below)
│
├── app/                        ← FastAPI application
│   ├── main.py                 ← App factory, CORS, routers, lifespan
│   ├── config.py               ← Pydantic Settings (reads .env)
│   ├── db.py                   ← Async SQLAlchemy engine + session
│   ├── models.py               ← SQLAlchemy ORM models
│   │     User                  ←   id, email, hashed_password, role,
│   │                           │    avatar_path, parsed_cv, cached_recommendations
│   │     Opportunity           ←   id, title, type, org, description,
│   │                           │    deadline, tags, search_tsv (GIN indexed)
│   │     IngestionRun          ←   per-source run log
│   │
│   ├── schemas.py              ← Pydantic request/response models
│   ├── security.py             ← Argon2 hashing + JWT encode/decode
│   ├── dependencies.py         ← get_current_user, require_admin FastAPI deps
│   ├── scheduler.py            ← APScheduler daily ingest job
│   │
│   ├── routers/
│   │   ├── auth.py             ← POST /auth/register, /auth/login
│   │   ├── users.py            ← GET/POST /users/me, /me/avatar, /me/cv
│   │   ├── opportunities.py    ← GET /opportunities, /recommended, /types, /{id}
│   │   │                           POST /opportunities/rerank
│   │   ├── admin.py            ← POST /admin/ingest, GET /admin/runs
│   │   └── stats.py            ← GET /stats
│   │
│   └── ingest/
│       └── runner.py           ← Multi-source ingestion orchestrator
│
├── alembic/                    ← Database migrations
│   └── versions/               ← Auto-generated migration files
│
├── uploads/                    ← Created at runtime
│   ├── avatars/                ← Profile pictures (user_{id}.ext)
│   └── cvs/                    ← Uploaded PDFs (cv_user_{id}.pdf)
│
└── frontend/                   ← Next.js 16 App Router
    ├── .env.local               ← NEXT_PUBLIC_API_URL
    ├── lib/
    │   └── api.ts              ← Axios client + all typed API functions
    ├── context/
    │   └── AuthContext.tsx     ← React context: user, token, login, logout
    ├── components/
    │   └── Navbar.tsx          ← Sticky glassmorphism nav
    └── app/
        ├── globals.css         ← Design system (CSS variables, glass, badges)
        ├── layout.tsx          ← Root layout: AuthProvider + Toaster
        ├── page.tsx            ← Auto-redirect to /login or /opportunities
        ├── login/page.tsx      ← JWT login form
        ├── register/page.tsx   ← Registration form
        ├── profile/page.tsx    ← Avatar upload + CV upload + parsed display
        ├── opportunities/page.tsx  ← AI-ranked cards with filters
        └── admin/page.tsx      ← Ingest trigger + run log table
```

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | None | Create account, returns JWT |
| `POST` | `/auth/login` | None | Login (form data), returns JWT |

### User
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/users/me` | Bearer | Get current user profile |
| `POST` | `/users/me/avatar` | Bearer | Upload profile picture (JPEG/PNG/WebP) |
| `POST` | `/users/me/cv` | Bearer | Upload PDF → Gemini parses → stores JSON |

### Opportunities
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/opportunities` | None | List all with search/filter/pagination |
| `GET`  | `/opportunities/types` | None | Distinct types in DB |
| `GET`  | `/opportunities/recommended` | Bearer | AI-ranked list (cached). `?refresh=true` to re-run |
| `POST` | `/opportunities/rerank` | None | Rerank with arbitrary candidate profile (body) |
| `GET`  | `/opportunities/{id}` | None | Full detail for one opportunity |

### Admin (API Key required)
| Method | Endpoint | Header | Description |
|--------|----------|--------|-------------|
| `POST` | `/admin/ingest` | `X-Api-Key` | Trigger background ingestion |
| `GET`  | `/admin/runs` | `X-Api-Key` | List recent ingestion run logs |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Health check |
| `GET`  | `/stats` | DB stats by type and source |
| `GET`  | `/uploads/avatars/{file}` | Serve uploaded avatars (static) |

---

## Frontend Pages

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Any | Auto-redirects based on auth state |
| `/login` | Guest | Animated auth card |
| `/register` | Guest | Sign-up form, redirects to `/profile` |
| `/profile` | Auth | Upload avatar & CV; view AI-extracted skills/projects/keywords |
| `/opportunities` | Auth | AI-ranked cards with type/score/expiry filters |
| `/admin` | Admin role | Manual ingest trigger + run logs |

---

## Environment Variables

### Backend — `campus365_career/.env`

```env
# PostgreSQL connection (asyncpg)
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname

# Admin API key (for /admin/* endpoints)
ADMIN_API_KEY=your-secret-admin-key

# Scheduler: hour in UTC to run daily ingestion (0-23)
INGEST_HOUR_UTC=2

# Source API tokens
SHOMVOB_TOKEN=your-shomvob-jwt-token

# Google Gemini API key
GEMINI_API_KEY=your-gemini-api-key

# JWT settings
JWT_SECRET=your-random-secret-min-32-chars
# JWT_ALGORITHM=HS256 (default)
# JWT_EXPIRE_MINUTES=10080 (default = 7 days)

# Upload directory (relative to project root)
UPLOAD_DIR=uploads
```

### Frontend — `campus365_career/frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 22+
- PostgreSQL 14+ (running locally)
- A **Google Gemini API key** (free tier available at [aistudio.google.com](https://aistudio.google.com))

### 1. Clone & Set Up Backend

```bash
cd campus365_career

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example and fill in your values:

```bash
cp .env.example .env
# Edit .env with your DB credentials, Gemini API key, etc.
```

### 3. Run Database Migrations

```bash
alembic upgrade head
```

This creates three tables: `opportunities`, `users`, `ingestion_runs`.

### 4. Set Up Frontend

```bash
cd frontend
npm install --legacy-peer-deps
```

---

## Running the Project

### Start Backend

```bash
cd campus365_career
.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.  
Interactive docs: `http://127.0.0.1:8000/docs`

### Start Frontend

```bash
cd campus365_career/frontend
npm run dev
```

The app will be available at `http://localhost:3000`.

### Trigger First Data Ingestion

Option A — via Admin Dashboard UI at `http://localhost:3000/admin`  
Option B — via curl:

```bash
curl -X POST http://127.0.0.1:8000/admin/ingest \
  -H "X-Api-Key: your-admin-api-key"
```

---

## User Journey

```
1. Register at /register
        │
        ▼
2. Upload profile picture at /profile (optional)
        │
        ▼
3. Upload PDF resume at /profile
        │    └─ Gemini extracts skills, keywords, projects (~15s)
        │    └─ Structured JSON saved to your DB profile
        ▼
4. Visit /opportunities
        │    └─ PostgreSQL finds top 100 relevant listings using your keywords
        │    └─ Gemini scores each 0-100 with a match reason (~10-20s)
        │    └─ Results saved to DB cache
        │    └─ Page shows ranked cards instantly on next visit
        ▼
5. Use filters to narrow down:
        │    ├─ Toggle: Job / Scholarship / Fellowship / Grant / Internship
        │    ├─ Toggle: Hide matches below 50%
        │    └─ Toggle: Hide expired deadlines
        ▼
6. Click "View Details" to apply on the source website
        │
        ▼
7. Click "Refresh with AI" anytime to re-score with latest listings
```

---

## Notes & Limitations

- **Gemini token limits**: The prompt for 100 opportunities with 400-char descriptions is ~15K tokens, well within Gemini 2.5 Flash's 1M token context window.
- **PDF parsing**: PyPDF2 works best on text-based PDFs. Scanned/image PDFs will extract little or no text — advise users to upload the original digital PDF.
- **Score subjectivity**: Gemini's scoring is deterministic for a given prompt but reflects the model's interpretation of match quality. It is not a guaranteed indicator of application success.
- **Cache invalidation**: The cache is not automatically cleared when new opportunities are ingested. Users should click "Refresh with AI" after a manual ingest to get updated rankings.
