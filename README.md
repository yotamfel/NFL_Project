# NFL Data Platform

A full-stack web application built on top of a PostgreSQL database of NFL
statistics (2000–2024) — covering passing, offense, defense, kicking,
punting, returns, the annual draft, and the pre-draft combine.

## Features

- **Player search** — instant full-text search across 11,000+ players
- **Player profiles** — season-by-season stats with career trend charts and
  combine measurements
- **Player comparison** — side-by-side career chart for up to four players
  across any statistical category
- **Draft analysis** — browse all picks with filters, plus ML-powered lists
  of steals (round 4+ picks who overdelivered) and busts (round 1–2 picks
  who underdelivered)
- **Smart search** — ask questions in plain English or Hebrew; Claude
  translates them to SQL and runs them live against the database

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 17 |
| API | FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| ML | scikit-learn `HistGradientBoostingRegressor` |
| NL search | Claude Haiku via Anthropic API |
| Frontend | React 19 + React Router v7 + Tailwind CSS v4 + Recharts |
| Build | Vite 8 |

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 17 (running locally, with the NFL database loaded)
- An Anthropic API key (for the Smart Search feature)

## Setup

### 1. Python environment

```powershell
cd server
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment variables

Create `server/.env` (this file is gitignored — never commit it):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/nfl
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. ML model

Train the draft-value prediction model (one-time step):

```powershell
cd server
.\venv\Scripts\python.exe -m ml.train_model
```

This writes `server/ml/draft_value_model.joblib`.

### 4. Node dependencies

```powershell
cd client
npm install
```

## Running

### Development

Two terminals:

```powershell
# Terminal 1 — backend (auto-reloads on code changes)
cd server
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Terminal 2 — frontend dev server (hot module replacement)
cd client
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies all `/api/*` requests to the FastAPI backend at
`http://localhost:8000`.

### Production

```powershell
.\start.ps1
```

This builds the React app (first run only) and starts a single uvicorn
process at `http://localhost:8000` that serves both the API and the UI.

## API Overview

All API routes are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/players/search?q=&limit=` | Full-text player search |
| GET | `/api/players/{id}` | Full player profile |
| GET | `/api/compare?player_ids=&category=&season=` | Career or single-season comparison |
| GET | `/api/draft?team=&draft_year=&pos=&limit=` | Draft picks with filters |
| GET | `/api/draft/steals` | ML-identified draft steals |
| GET | `/api/draft/busts` | ML-identified draft busts |
| POST | `/api/search/natural` | Natural-language → SQL search |

Interactive docs are available at `http://localhost:8000/docs` while the
server is running.

## Project Structure

```
NFL_project/
├── server/
│   ├── app/
│   │   ├── main.py          # FastAPI app, router wiring, static file serving
│   │   ├── config.py        # Settings (DATABASE_URL, ANTHROPIC_API_KEY)
│   │   ├── db.py            # SQLAlchemy engine
│   │   ├── models.py        # Pydantic response models
│   │   ├── nl_search.py     # Natural-language → SQL (Claude Haiku)
│   │   ├── routers/         # One file per feature module
│   │   └── data/            # Data-access layer (no SQL in routers)
│   └── ml/
│       ├── prepare_data.py  # Feature engineering
│       ├── train_model.py   # Model training + evaluation
│       └── draft_value_model.joblib  # Trained model (gitignored)
├── client/
│   ├── src/
│   │   ├── api.js           # All fetch calls in one place
│   │   ├── hooks/useApi.js  # Data-fetching hook with AbortController
│   │   ├── components/      # Nav, StatTable, StatChart, Status
│   │   └── pages/           # One file per route
│   └── vite.config.js
├── start.ps1                # One-command production launcher
└── PROJECT_LOG.md           # Detailed development narrative
```
