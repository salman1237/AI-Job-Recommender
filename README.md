# 🚀 AI Job Recommender — Full-Stack AI-Powered Opportunity Discovery Platform

> An end-to-end full-stack application that **automatically aggregates** scholarships, fellowships, grants, jobs, and internships from multiple live sources, **parses your PDF CV with Gemini AI**, and returns a **personalised, AI-ranked list** of the best matching opportunities — complete with a 0–100 match score and a human-readable reason for each match.

**Live Demo:** [https://ai-job-recommender-flame.vercel.app](https://ai-job-recommender-flame.vercel.app)

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [Data Sources](#data-sources)
5. [Database Schema](#database-schema)
6. [Data Ingestion Pipeline](#data-ingestion-pipeline)
7. [CV Parsing Pipeline](#cv-parsing-pipeline)
8. [AI Scoring & Ranking Pipeline](#ai-scoring--ranking-pipeline)
9. [Caching Strategy](#caching-strategy)
10. [Frontend Pages (Detailed)](#frontend-pages-detailed)
11. [API Reference (Detailed)](#api-reference-detailed)
12. [Project Structure](#project-structure)
13. [Environment Variables](#environment-variables)
14. [Deployment](#deployment)
15. [Local Setup](#local-setup)
16. [Historical Backfill](#historical-backfill)

---

## Overview

AI Job Recommender solves a critical problem for students and early-career professionals: thousands of high-quality opportunities are scattered across dozens of websites, making it nearly impossible to find ones that actually match your specific background.

This platform fully automates that process:

1. **Aggregates** opportunities daily from 6 live sources (WordPress sites, BDJobs, Shomvob)
2. **Parses** your uploaded PDF resume using Gemini AI to extract a structured profile in JSON
3. **Scores** every relevant opportunity against your profile using Gemini AI (0–100), with a DB fallback scoring mechanism if AI rate limits or timeouts occur
4. **Displays** results in a beautiful Light Mode UI with rich filters, animated cards, and instant-load caching
5. **Notifies** users with automated daily email digests of new matches and approaching deadline alerts

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                              │
│        https://ai-job-recommender-flame.vercel.app                   │
│        Next.js 16 · TypeScript · Tailwind CSS · Framer Motion        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS (Axios · JWT Bearer Token)
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│            FastAPI Backend v2.0.0 (Python 3.11)                      │
│        https://ai-job-recommender.fastapicloud.dev                   │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  ┌──────────────┐   │
│  │  /auth   │  │  /users  │  │ /opportunities │  │   /admin     │   │
│  │ register │  │    me    │  │  recommended   │  │   ingest     │   │
│  │  login   │  │  avatar  │  │  types/search  │  │   runs       │   │
│  └──────────┘  │    cv    │  └───────┬────────┘  └──────────────┘   │
│                └──────────┘          │              ┌────────────┐   │
│                                      │              │  /stats    │   │
│     Argon2id hashing · JWT HS256 · CORS whitelist   └────────────┘   │
└──────────┬──────────────────┬────────────────────────────┬───────────┘
           │                  │                            │
           ▼                  ▼                            ▼
┌──────────────────┐  ┌───────────────────┐    ┌───────────────────────┐
│  Neon PostgreSQL │  │   Google Gemini   │    │  Local Filesystem      │
│  (Serverless DB) │  │   (flash-latest)  │    │  uploads/avatars/      │
│                  │  │                   │    │  uploads/cvs/          │
│  opportunities   │  │  ① CV Parsing     │    └───────────────────────┘
│  users           │  │  ② Opp Scoring    │
│  ingestion_runs  │  └───────────────────┘
│  (GIN Indexed    │
│   Full-Text      │
│   Search)        │
└──────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | Next.js (App Router) | 16 | React framework with SSR |
| **Language** | TypeScript | 5.x | Type-safe frontend code |
| **Styling** | Tailwind CSS | v4 | Utility-first CSS |
| **Animations** | Framer Motion | latest | Animated card grids, transitions |
| **HTTP Client** | Axios | latest | API calls with JWT interceptor |
| **Icons** | Lucide React | latest | Icon library |
| **Toasts** | React Hot Toast | latest | User feedback notifications |
| **Backend Framework** | FastAPI | latest | Async Python REST API |
| **Python Version** | Python | 3.11+ | Runtime |
| **ORM** | SQLAlchemy (async) | 2.x | Database models and queries |
| **DB Driver** | asyncpg | latest | Async PostgreSQL driver |
| **Database** | Neon PostgreSQL | 16 | Serverless cloud DB |
| **Migrations** | Alembic | latest | Schema version control |
| **Auth** | python-jose (JWT HS256) | latest | Stateless authentication |
| **Password Hashing** | argon2-cffi | latest | Secure Argon2id hashing |
| **AI / LLM** | Google Gemini (flash-latest) | latest | CV parsing + opportunity scoring |
| **PDF Parsing** | PyPDF2 | latest | Extract text from PDF resumes |
| **Scheduler** | APScheduler | latest | Nightly automated ingestion |
| **HTTP Requests** | httpx (async) | latest | Gemini API + scraper requests |
| **Frontend Hosting** | Vercel | - | Auto-deploy on git push |
| **Backend Hosting** | FastAPI Cloud | - | Serverless Python hosting |

---

## Data Sources

The ingestion pipeline pulls from **6 live sources** covering jobs, scholarships, and fellowships:

| Source ID | Website | Type | Adapter |
|-----------|---------|------|---------|
| `opportunitydesk` | opportunitydesk.org | Scholarship | WordPress REST API |
| `opp4youth` | opportunitiesforyouth.org | Scholarship | WordPress REST API |
| `opp4africans` | opportunitiesforafricans.com | Scholarship | WordPress REST API |
| `uri_fellowships` | web.uri.edu/fellowships | Fellowship | WordPress REST API |
| `bdjobs` | bdjobs.com | Job | Custom HTML scraper |
| `shomvob` | shomvob.com | Job | JSON API (JWT auth) |

---

## Database Schema

### `users` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | BigInt PK | Auto-incremented ID |
| `email` | String(255) UNIQUE | Login email |
| `hashed_password` | Text | Argon2id hash |
| `full_name` | Text | Display name |
| `role` | String(20) | `"user"` or `"admin"` |
| `avatar_path` | Text | Path to uploaded profile image |
| `parsed_cv` | JSONB | Structured CV data from Gemini |
| `cached_recommendations` | JSONB | Full AI-ranked opportunity list |
| `recommendations_cached_at` | DateTime TZ | When the cache was last saved |
| `created_at` | DateTime TZ | Account creation time |
| `updated_at` | DateTime TZ | Last profile update time |

### `opportunities` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | BigInt PK | Auto-incremented ID |
| `source` | Text | Source identifier (e.g., `bdjobs`) |
| `external_id` | Text | Original ID from the source |
| `content_hash` | Text | SHA-256 of content (for change detection) |
| `type` | Text | `job`, `scholarship`, `fellowship`, `grant`, `internship` |
| `title` | Text | Opportunity title |
| `organization` | Text | Posting organization |
| `description` | Text | Full description |
| `url` | Text | Link to the listing |
| `apply_url` | Text | Direct application URL |
| `location` / `country` | Text | Geographic info |
| `category` / `tags` | Text / JSONB | Categorization |
| `salary` | Text | Salary info (if available) |
| `deadline` | Date | Application deadline |
| `posted_at` | DateTime TZ | When originally posted |
| `is_active` | Boolean | `true` while not expired |
| `search_tsv` | TSVECTOR | **Auto-generated** full-text search vector (GIN indexed) |

**Full-text search weighting:**
- Title → Weight **A** (highest)
- Organization, Location, Category → Weight **B**
- Description → Weight **C** (lowest)

### `ingestion_runs` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | BigInt PK | Auto-incremented ID |
| `source` | Text | Which source was ingested |
| `started_at` | DateTime TZ | Run start time |
| `finished_at` | DateTime TZ | Run end time |
| `fetched` | Integer | Total items fetched |
| `created` | Integer | New records inserted |
| `updated` | Integer | Existing records updated |
| `status` | Text | `"success"` or `"error"` |
| `error` | Text | Error details if failed |

### `email_logs` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | BigInt PK | Auto-incremented ID |
| `user_id` | BigInt FK | Reference to `users.id` |
| `email_type` | String(50) | `"daily_digest"` or `"deadline_alert"` |
| `status` | String(20) | `"success"` or `"error"` |
| `error_message` | Text | Error details if failed |
| `sent_at` | DateTime TZ | When the email was sent |

---

## Data Ingestion Pipeline

```
External Sources (6 APIs)
        │
        ▼
  Ingestion Runner (app/ingest/runner.py)
        │
        │  For each adapter (run in sequence, 1s delay between):
        │
        │    1. Start a new IngestionRun record (status="running")
        │    2. Fetch from external source:
        │         • WordPress: paginated wp/v2/posts REST API
        │         • BDJobs: HTML scrape with pagination
        │         • Shomvob: JSON REST API with JWT auth
        │    3. Normalize each item into a standard Normalized object:
        │         title, org, type, url, description, tags, deadline, posted_at
        │    4. For each normalized item → upsert into opportunities table:
        │         • NEW item     → INSERT (status: "created")
        │         • Changed hash → UPDATE fields (status: "updated")
        │         • Unchanged    → SKIP (no DB write)
        │    5. Finish IngestionRun with counts and status
        │    6. Run lifecycle sweep: mark past-deadline items as is_active=False
        │
        ▼
  PostgreSQL opportunities table
  (GIN index on search_tsv for fast full-text queries)
```

The ingestion can be triggered in two ways:
1. **Nightly schedule** — APScheduler fires automatically at 02:07 UTC every day
2. **Admin dashboard** — Click "Trigger Manual Ingest" on the `/admin` page

---

## CV Parsing Pipeline

```
User uploads PDF via /profile page
        │
        ▼
  POST /users/me/cv (FastAPI)
        │
        ├─→ Validate: file must be application/pdf
        │
        ├─→ Read file bytes into memory (no disk write in production)
        │
        ├─→ PyPDF2: extract raw text from every page
        │     └─ Raises HTTP 422 if PDF is empty or image-only
        │
        ├─→ Build Gemini prompt asking for structured JSON with keys:
        │     • skills          → string[]
        │     • education       → { degree, institution, year }
        │     • achievements    → string[]
        │     • projects        → [{ name, description }]
        │     • job_keywords    → string[]  ← drives all future searching
        │
        ├─→ Call Google Gemini API (gemini-flash-latest, timeout 60s)
        │     response_mime_type: "application/json"
        │
        ├─→ Strip any markdown code fences from response
        │     (e.g. ```json ... ``` → clean JSON)
        │
        ├─→ json.loads() the clean text
        │
        └─→ Save parsed JSON into users.parsed_cv (JSONB column)
```

**Example of data stored in `users.parsed_cv`:**
```json
{
  "skills": ["Python", "React", "PostgreSQL", "Machine Learning", "FastAPI"],
  "education": {
    "degree": "BSc Computer Science",
    "institution": "University of Dhaka",
    "year": "2024"
  },
  "achievements": ["Dean's List 2023", "National Hackathon Winner"],
  "projects": [
    {
      "name": "AI Sentiment Analyzer",
      "description": "NLP model achieving 94% accuracy on Bengali social media text"
    }
  ],
  "job_keywords": [
    "software engineer", "backend developer", "machine learning engineer",
    "python developer", "data scientist", "research assistant",
    "full stack developer", "fastapi", "react"
  ]
}
```

---

## AI Scoring & Ranking Pipeline

Called via `GET /opportunities/recommended`:

```
Step 1: Check Cache
   └─ users.cached_recommendations is not null AND ?refresh=false?
        └─ YES → Return cached list instantly (0 Gemini calls, ~50ms response)
        └─ NO  → Continue to Step 2

Step 2: Full-Text Search (PostgreSQL GIN Index)
   └─ Run OR query across all job_keywords from parsed_cv (capped at 15 keywords)
        SELECT * FROM opportunities
        WHERE is_active = true
        AND (
          search_tsv @@ plainto_tsquery('simple', 'software engineer')
          OR search_tsv @@ plainto_tsquery('simple', 'python')
          OR ...
        )
        ORDER BY posted_at DESC
        LIMIT 1000

Step 3: Build Gemini Prompt
   └─ Candidate summary (max ~200 tokens):
        "Skills: Python, React... Keywords: software engineer...
         Projects: AI Sentiment Analyzer... Achievements: Hackathon Winner..."
   └─ Opportunities context (max 30 items × 400 char descriptions)

Step 4: Call Gemini AI (gemini-flash-latest, timeout 45s)
   └─ response_mime_type: "application/json"
   └─ Returns a scored array:
        [
          { "id": 42, "match_score": 94, "match_reason": "Strong Python + ML match" },
          { "id": 17, "match_score": 78, "match_reason": "React experience aligns with frontend role" },
          ...
        ]
   └─ Fallback: If Gemini times out or fails, falls back to an internal DB scoring heuristic based on keyword matches.

Step 5: Merge & Sort
   └─ Join Gemini scores back to full opportunity records from DB
   └─ Sort all results by match_score DESC

Step 6: Save Cache & Return
   └─ Save enriched list to users.cached_recommendations (JSONB)
   └─ Save users.recommendations_cached_at = NOW()
   └─ Return RerankedList { total, cached: false, items: [...] }
```

### Match Score Legend

| Score | Label | Meaning |
|-------|-------|---------|
| **80–100** | 🟢 Strong | Directly aligned skills, title, or domain |
| **50–79** | 🟡 Moderate | Some overlap; worth applying |
| **0–49** | 🔴 Weak | Only tangentially related |

> Gemini is instructed: *"Only give high scores (80+) for genuinely strong matches. Be precise."*

---

## Caching Strategy

| Scenario | Behaviour | Gemini Calls |
|----------|-----------|-------------|
| First visit after CV upload | Calls Gemini, saves enriched list to DB | **1 call** |
| Page refresh / navigate back | Reads `users.cached_recommendations` from DB | **0 calls (~50ms)** |
| Click "Refresh with AI" | `?refresh=true` → re-calls Gemini, updates cache | **1 call** |
| Upload new CV | Cache is **not** auto-cleared; user should click Refresh | 0 calls |
| New opportunities ingested | Cache is **not** auto-cleared; user should click Refresh | 0 calls |

---

## Frontend Pages (Detailed)

### `/login` — Authentication
- Glassmorphism animated login card
- Email + password form with validation
- On success: JWT token stored in localStorage, user redirected to `/opportunities`
- Link to `/register` for new users

### `/register` — Sign Up
- Full name, email, and password fields
- On success: account created, JWT stored, redirect to `/profile`

### `/profile` — AI Resume Profile
- **Avatar section**: Upload a profile image (JPEG/PNG/WebP/GIF). Shows current avatar or a placeholder icon.
- **CV Upload section**: Upload any PDF resume. While uploading, shows a step-by-step animated AI loading panel with tips:
  - Uploading PDF → Extracting text → Gemini reading CV → Identifying skills → Building profile
- **Parsed CV display**: After successful parsing, shows a structured breakdown:
  - **Extracted Skills** — e.g. Python, React, PostgreSQL
  - **Target Keywords** — the AI-generated job search terms (shown in cyan badges)
  - **Projects & Experience** — each project with a name and description card

### `/opportunities` — AI-Ranked Opportunity Feed
This is the core page of the application.

**Initial load (no CV):** Shows a prompt to go upload a CV first.

**Loading state (first Gemini call):**
- Shows 6 animated skeleton cards as placeholders
- Shows an AI progress panel with steps:
  1. Fetching latest opportunities
  2. Reading your CV profile
  3. Scoring each match with Gemini AI
  4. Sorting by best fit
  5. Almost ready!
- Shows rotating helpful tips while waiting

**Loaded state:**
- **Header**: "For You ✨" with a cache indicator and "Refresh with AI" button
- **Filter bar** (animated, appears after load):
  - **Type toggles**: Job / Scholarship / Fellowship / Grant / Internship (colored pills, dynamic from DB)
  - **Hide <50% matches**: Toggle switch (default ON) — filters out weak matches
  - **Hide expired**: Toggle switch (default ON) — hides past-deadline items
  - **Result counter**: Shows "X / Y" total after filtering
- **Opportunity cards** (animated grid):
  - Colored type badge (e.g., "scholarship" in cyan)
  - AI match score badge (colored by score: green/yellow/red)
  - Score glow effect in the card corner (color reflects match quality)
  - Title, organization, location, deadline
  - AI match reason in an italic quote block
  - "View Details" button linking to the original source

**Re-ranking state (Refresh clicked):**
- Cards stay visible while a banner appears at the top
- Banner shows a spinner and animated progress bar
- On completion: toast notification "Refreshed with latest AI rankings!"

### `/admin` — Admin Dashboard
- Requires admin role (enforced by `require_admin` dependency)
- **Trigger Manual Ingest** button — fires `POST /admin/ingest` → starts background ingestion
- **Trigger Manual Emails** button — fires `POST /admin/trigger-emails` → dispatches automated emails
- **Ingestion Run Logs** table — shows last 50 runs with:
  - Source name
  - Start/end times
  - Fetched, created, updated counts
  - Status (success/error) with color coding
  - Error message if failed

---

## API Reference (Detailed)

**Base URL (Production):** `https://ai-job-recommender.fastapicloud.dev`  
**Interactive Docs (Production):** `https://ai-job-recommender.fastapicloud.dev/docs`

---

### Authentication Endpoints

#### `POST /auth/register`
Create a new user account.

**Request Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "mysecurepassword",
  "full_name": "John Doe"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "token_type": "bearer"
}
```

**Errors:** `400` — email already registered

---

#### `POST /auth/login`
Login and receive a JWT token.

**Request Body (form-data):**
```
username=user@example.com
password=mysecurepassword
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "token_type": "bearer"
}
```

**Errors:** `401` — invalid credentials

---

### User Endpoints

All user endpoints require: `Authorization: Bearer <token>`

#### `GET /users/me`
Get the current user's profile.

**Response `200 OK`:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "avatar_path": "/uploads/avatars/user_1.jpg",
  "parsed_cv": {
    "skills": ["Python", "React"],
    "education": { "degree": "BSc CS", "institution": "DU", "year": "2024" },
    "achievements": ["Hackathon Winner"],
    "projects": [{ "name": "My App", "description": "A cool app" }],
    "job_keywords": ["software engineer", "python developer"]
  }
}
```

---

#### `POST /users/me/avatar`
Upload a profile picture. Replaces any existing avatar.

**Request:** `multipart/form-data` with field `file` (JPEG/PNG/WebP/GIF only)

**Response `200 OK`:** Updated user object (same as `GET /users/me`)

**Errors:** `400` — invalid file type

---

#### `POST /users/me/cv`
Upload a PDF resume and have it parsed by Gemini AI.

**Request:** `multipart/form-data` with field `file` (PDF only)

**Process:**
1. Reads PDF bytes into memory
2. Extracts text using PyPDF2
3. Sends to Gemini AI for structured extraction
4. Saves result to `parsed_cv` JSONB column

**Response `200 OK`:** Updated user object with populated `parsed_cv`

**Errors:**
- `400` — file is not a PDF
- `422` — PDF is empty or image-only (no extractable text)
- `502` — Gemini API error
- `503` — Gemini API key not configured

---

### Opportunity Endpoints

#### `GET /opportunities`
Browse all opportunities with search, filter, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | `string[]` | `[]` | Keywords (OR logic). Use multiple: `?q=Python&q=React` |
| `type` | `string` | `null` | Filter by type: `job`, `scholarship`, `fellowship`, `grant`, `internship` |
| `source` | `string` | `null` | Filter by source ID (e.g., `bdjobs`, `opportunitydesk`) |
| `country` | `string` | `null` | Filter by country |
| `active_only` | `boolean` | `true` | Only return non-expired items |
| `page` | `integer` | `1` | Page number (minimum: 1) |
| `page_size` | `integer` | `20` | Results per page (1–100) |

**Response `200 OK`:**
```json
{
  "total": 1542,
  "page": 1,
  "page_size": 20,
  "items": [
    {
      "id": 101,
      "source": "opportunitydesk",
      "external_id": "98765",
      "type": "scholarship",
      "title": "XYZ International Scholarship 2025",
      "organization": "XYZ Foundation",
      "description": "Full scholarship for...",
      "url": "https://opportunitydesk.org/...",
      "apply_url": "https://...",
      "location": "USA",
      "country": "United States",
      "category": "scholarship",
      "tags": ["engineering", "stem"],
      "salary": null,
      "deadline": "2025-08-15",
      "posted_at": "2025-06-01T10:00:00Z",
      "is_active": true,
      "created_at": "2025-06-01T12:00:00Z",
      "updated_at": "2025-06-01T12:00:00Z"
    }
  ]
}
```

---

#### `GET /opportunities/types`
Get all distinct opportunity types currently in the database.

**Response `200 OK`:**
```json
{
  "types": ["fellowship", "job", "scholarship"]
}
```

---

#### `GET /opportunities/recommended`
Get AI-ranked opportunities personalised for the logged-in user.

**Auth Required:** Yes (Bearer token)  
**CV Required:** User must have uploaded a CV first

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `top_n` | `integer` | `30` | How many candidates to send to Gemini (max 30) |
| `refresh` | `boolean` | `false` | Force re-call to Gemini, ignoring cached results |

**Response `200 OK`:**
```json
{
  "total": 87,
  "cached": true,
  "items": [
    {
      "id": 42,
      "source": "bdjobs",
      "type": "job",
      "title": "Senior Python Engineer",
      "organization": "TechCorp BD",
      "match_score": 94,
      "match_reason": "Strong Python and FastAPI experience directly matches the job requirements.",
      "deadline": "2025-07-30",
      "url": "https://bdjobs.com/...",
      "is_active": true
    }
  ]
}
```

**Errors:**
- `422` — No CV found on profile
- `422` — CV has no job keywords (try re-uploading)
- `502` — Gemini API error

---

#### `POST /opportunities/rerank`
Rerank opportunities against an arbitrary candidate profile (no auth required; for API testing).

**Request Body (JSON):**
```json
{
  "skills": ["Python", "Django", "PostgreSQL"],
  "education": { "degree": "MSc Data Science" },
  "achievements": ["Published ML Paper"],
  "projects": [{ "name": "Fraud Detector", "description": "ML model for fraud detection" }],
  "job_keywords": ["data scientist", "machine learning engineer", "python developer"]
}
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `string` | `null` | Filter by opportunity type |
| `top_n` | `integer` | `20` | Number of DB candidates (max 50) |

**Response `200 OK`:** Same shape as `/opportunities/recommended`

---

#### `GET /opportunities/{id}`
Get full details for a single opportunity including the raw source data.

**Response `200 OK`:** Full `OpportunityOut` object plus `raw: { ... }` (original API response)

---

### Admin Endpoints

All admin endpoints require header: `X-Api-Key: <your-admin-api-key>`

#### `POST /admin/ingest`
Trigger a full ingestion cycle for all 6 sources in the background.

**Response `200 OK`:**
```json
{
  "status": "started",
  "detail": "Ingestion started in the background. Check /admin/runs for progress."
}
```

> Note: The ingestion runs asynchronously. Use `GET /admin/runs` to monitor progress.

---

#### `POST /admin/trigger-emails`
Trigger a manual dispatch of daily digest and deadline alert emails to eligible users. Can also be triggered by an external cron via the `admin-key` header.

**Response `200 OK`:**
```json
{
  "status": "success",
  "detail": "Email sending triggered"
}
```

---

#### `GET /admin/runs`
Get recent ingestion run logs.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `integer` | `50` | Max number of runs to return |

**Response `200 OK`:**
```json
[
  {
    "id": 42,
    "source": "bdjobs",
    "started_at": "2025-07-05T02:07:00Z",
    "finished_at": "2025-07-05T02:07:35Z",
    "fetched": 120,
    "created": 15,
    "updated": 3,
    "status": "success",
    "error": null
  }
]
```

---

### Utility Endpoints

#### `GET /health`
Simple health check.

**Response `200 OK`:** `{ "status": "ok" }`

---

#### `GET /stats`
Aggregated database statistics.

**Response `200 OK`:**
```json
{
  "total": 5482,
  "active": 4901,
  "by_type": {
    "job": 2100,
    "scholarship": 1800,
    "fellowship": 650,
    "internship": 351
  },
  "sources": [
    {
      "source": "bdjobs",
      "count": 2100,
      "last_success": "2025-07-05T02:07:35Z",
      "last_status": "success"
    }
  ]
}
```

---

#### `GET /sources`
List all sources with opportunity counts.

**Response `200 OK`:**
```json
[
  { "source": "bdjobs", "count": 2100 },
  { "source": "opportunitydesk", "count": 980 }
]
```

---

#### `GET /uploads/avatars/{filename}`
Serve a user's uploaded avatar image (static file serving).

---

## Project Structure

```
AI-Job-Recommender/
│
├── .env                          ← Environment variables (never commit!)
├── requirements.txt              ← Python dependencies
├── historical_backfill.py        ← Local script: bulk-load all historical data
├── set_admin.py                  ← Utility script: promote a user to admin role
│
├── app/                          ← FastAPI application
│   ├── main.py                   ← App factory, CORS, routers, lifespan events
│   ├── config.py                 ← Pydantic Settings (reads .env)
│   ├── db.py                     ← Async SQLAlchemy engine + session factory
│   ├── models.py                 ← SQLAlchemy ORM: User, Opportunity, IngestionRun
│   ├── schemas.py                ← Pydantic request/response models
│   ├── security.py               ← Argon2id hashing + JWT encode/decode
│   ├── dependencies.py           ← get_current_user, require_admin deps
│   ├── crud.py                   ← upsert, start_run, finish_run helpers
│   ├── scheduler.py              ← APScheduler: daily ingest at 02:07 UTC
│   │
│   ├── routers/
│   │   ├── auth.py               ← POST /auth/register, /auth/login
│   │   ├── users.py              ← GET/POST /users/me, /me/avatar, /me/cv
│   │   ├── opportunities.py      ← GET/POST all opportunity endpoints
│   │   ├── admin.py              ← POST /admin/ingest, GET /admin/runs
│   │   └── stats.py              ← GET /stats, /sources
│   │
│   └── ingest/
│       ├── base.py               ← Adapter ABC + Normalized dataclass
│       ├── runner.py             ← Multi-source orchestrator
│       ├── wordpress.py          ← WordPress wp/v2 REST adapter (4 sites)
│       ├── bdjobs.py             ← BDJobs HTML scraper adapter
│       ├── shomvob.py            ← Shomvob JSON API adapter
│       └── http.py               ← Shared httpx client with retry logic
│
├── alembic/                      ← Database migrations
│   └── versions/                 ← Auto-generated migration files
│
└── frontend/                     ← Next.js 16 App Router
    ├── .env.local                 ← NEXT_PUBLIC_API_URL (not committed)
    ├── package.json
    ├── tsconfig.json
    │
    ├── lib/
    │   └── api.ts                ← Axios client + all typed API functions
    │
    ├── context/
    │   └── AuthContext.tsx       ← React context: user, token, login, logout, refreshUser
    │
    ├── components/
    │   ├── Navbar.tsx            ← Sticky glassmorphism nav with auth state
    │   ├── AILoadingState.tsx    ← Animated step-by-step AI progress panel
    │   └── SkeletonCard.tsx      ← Animated placeholder card during loading
    │
    └── app/
        ├── globals.css           ← Design system: CSS variables, glass styles, badges
        ├── layout.tsx            ← Root layout: AuthProvider + Toaster wrapper
        ├── page.tsx              ← Root redirect: /login or /opportunities
        ├── login/page.tsx        ← JWT login form
        ├── register/page.tsx     ← Registration form
        ├── profile/page.tsx      ← Avatar + CV upload + parsed CV display
        ├── opportunities/page.tsx ← AI-ranked card feed with filters
        └── admin/page.tsx        ← Ingest trigger + run logs table
```

---

## Environment Variables

### Backend — `.env`

```env
# Neon PostgreSQL connection string
DATABASE_URL=postgresql+asyncpg://user:password@ep-xxx.neon.tech/dbname

# Admin API key for /admin/* endpoints
ADMIN_API_KEY=your-very-secret-admin-key

# Scheduler: hour and minute (UTC) to run daily ingestion
INGEST_HOUR_UTC=2
INGEST_MINUTE_UTC=7

# Shomvob JWT token for their private API
SHOMVOB_TOKEN=your-shomvob-jwt-token

# Google Gemini API key (get one free at aistudio.google.com)
GEMINI_API_KEY=your-gemini-api-key

# JWT auth settings
JWT_SECRET=a-random-secret-string-min-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# CORS origins (JSON array string)
CORS_ORIGINS=["http://localhost:3000", "https://your-vercel-app.vercel.app"]

# Local upload directory
UPLOAD_DIR=uploads

# SMTP Configuration (For Daily Digests and Alerts)
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=your_email@gmail.com
MAIL_FROM_NAME="AI Job Recommender"
```

### Frontend — `frontend/.env.local`

```env
# Backend API URL
NEXT_PUBLIC_API_URL=https://ai-job-recommender.fastapicloud.dev
```

---

## Deployment

### Architecture
The app is deployed fully serverless:

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend** | Vercel | `https://ai-job-recommender-flame.vercel.app` |
| **Backend API** | FastAPI Cloud | `https://ai-job-recommender.fastapicloud.dev` |
| **Database** | Neon (Serverless PostgreSQL) | Private connection string |

### Deploying the Backend
```bash
# From the project root:
.\.venv\Scripts\fastapi deploy
```

### Deploying the Frontend
Vercel auto-deploys when you push to GitHub. You can also trigger manually from the Vercel dashboard.

**Required Vercel Environment Variables:**
- `NEXT_PUBLIC_API_URL` = `https://ai-job-recommender.fastapicloud.dev`

**Required FastAPI Cloud Environment Variables:**
- All variables from the `.env` section above
- `CORS_ORIGINS` must include your Vercel URL

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 22+
- A PostgreSQL database (local or Neon)
- A Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### 1. Backend
```bash
# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate          # Windows
# source .venv/bin/activate       # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env .env.local  # or create .env manually
# Edit .env: fill in DATABASE_URL, GEMINI_API_KEY, etc.

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API available at: `http://127.0.0.1:8000`  
Swagger docs at: `http://127.0.0.1:8000/docs`

### 2. Frontend
```bash
cd frontend
npm install

# Create frontend/.env.local with:
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

npm run dev
```

App available at: `http://localhost:3000`

### 3. SMTP Local Testing (Optional)
If you want to test the email sending feature locally without using a real email account, you can run Python's built-in dummy SMTP server in a separate terminal:
```bash
python -m smtpd -n -c DebuggingServer localhost:1025
```
Then, update your local `.env` file to point to it:
```env
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USERNAME=
MAIL_PASSWORD=
```
Emails will be printed directly to your terminal instead of being sent.

### 4. SMTP Production Setup (Gmail)
To send emails in production using Gmail:
1. Go to your Google Account -> Security.
2. Enable 2-Step Verification.
3. Search for "App Passwords" and create a new app password.
4. Add the 16-character password to your `.env` (or FastAPI Cloud dashboard) as `MAIL_PASSWORD`.
5. Set `MAIL_HOST=smtp.gmail.com` and `MAIL_PORT=587`.

---

## Historical Backfill

Because FastAPI Cloud has a 60-second execution limit, the cloud scheduler can only fetch incremental updates. To populate the database with **all historical data** (thousands of records), run this script locally — it has no time limit and writes directly to your live Neon database:

```bash
.\.venv\Scripts\python historical_backfill.py
```

The script shows a live progress bar per source and takes approximately 10–15 minutes to complete. Once done, all records appear instantly on the live website.

---

## Notes & Limitations

- **PDF parsing**: PyPDF2 works on text-based PDFs only. Scanned or image-only PDFs will return little or no extractable text. Advise users to upload the original digital PDF.
- **Gemini scoring**: Results are deterministic for a given prompt and profile, but reflect the model's interpretation of fit — not a guarantee of application success.
- **Cache invalidation**: The recommendation cache is not auto-cleared when new opportunities are ingested. Users should click **"Refresh with AI"** after a manual ingest to receive updated rankings.
- **Serverless timeouts**: Cloud ingestion fetches a limited number of pages per source per run (3 pages for WordPress sources). Use `historical_backfill.py` for a full data load.
