# NFL Data Platform

A full-stack web application that makes NFL statistics accessible to any user — no technical knowledge required. Search players, compare careers, analyze draft value, explore league-wide trends, and ask questions in plain language.

Deployed on Railway at **https://nfl-data-platform-production.up.railway.app/**

---

## Features

| Feature | Description |
|---|---|
| **Player Search** | Instant search across 11,000+ players with filters for position, season, and team |
| **Player Profiles** | Season-by-season stats (Basic + Advanced) with selectable career charts, combine measurements, and draft info |
| **Injury History** | Per-season injury summary (2009+): official Out/Doubtful/Questionable counts plus estimated missed games from games-played data to catch IR absences |
| **Snap Counts** | Season and week-by-week snap percentage (2013+) — offensive, defensive, and special-teams |
| **Advanced Receiving** | ADOT, YAC/Rec, YBC/Rec, broken tackles, drop rate, target rating, NGS separation/cushion/YAC+ (WR/TE/RB, PFR 2018+, NGS 2016+) |
| **Next Gen Stats** | QB: Time to Throw, IAY, CAY, ADOTS, Aggressiveness, CPOE, MaxDist. RB: Efficiency, TLOS, RYOE/A, RPOE%, 8-Box% (2016+) |
| **Player Comparison** | Side-by-side career or single-season comparison for up to 4 players across all stat categories |
| **Draft Analysis** | Browse all picks 2000–2025, ML-powered steal/bust detection, combine-based career-value predictions, per-round stats |
| **League Trends** | Season-over-season and team-by-team breakdowns for any stat in any category |
| **Smart Search** | Ask questions in plain English or Hebrew — Claude translates them to SQL and runs them live against the database |
| **Saved** | Save players, comparisons, and searches; add personal notes to any saved item |
| **Guide** | Full in-app user guide in English and Hebrew |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 17 (Neon, serverless) |
| API | FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| ML | scikit-learn `HistGradientBoostingRegressor` |
| NL Search | Claude Haiku via Anthropic API |
| Frontend | React 19 + React Router v7 + Tailwind CSS v4 + Recharts |
| Build | Vite 8 |
| Deployment | Railway (single Docker container — FastAPI serves both API and built React app) |

---

## Local Setup

### 1. Python environment

```powershell
python -m venv server\venv
server\venv\Scripts\activate
pip install -r server\requirements.txt
```

### 2. Environment variables

Create `server/.env` (gitignored — never commit):

```env
DATABASE_URL=postgresql+psycopg2://user:password@host/dbname?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. ML model

Train the draft-value prediction model (one-time):

```powershell
server\venv\Scripts\python.exe -m ml.train_model
```

This writes `server/ml/draft_value_model.joblib`.

### 4. Node dependencies

```powershell
npm --prefix client install
```

### Running (development)

Two terminals:

```powershell
# Terminal 1 — backend
server\venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir server

# Terminal 2 — frontend
npm --prefix client run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to FastAPI at `http://localhost:8000`.

---

## API Reference

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/players/search?q=&limit=&pos=&season=&team=` | Player search with filters |
| GET | `/api/players/{id}` | Full player profile (stats, draft, combine) |
| GET | `/api/players/{id}/injuries?season=` | Injury history (seasons or weekly breakdown) |
| GET | `/api/players/{id}/snaps?season=` | Snap count data (seasons or weekly breakdown) |
| GET | `/api/players/{id}/adv_receiving` | Advanced receiving stats |
| GET | `/api/players/{id}/ngs?stat_type=passing\|rushing` | Next Gen Stats |
| GET | `/api/players/top_by_stat?category=&stat=&pos=&season=&min=&limit=` | Leaderboard |
| GET | `/api/compare?player_ids=&category=&season=` | Multi-player comparison |
| GET | `/api/draft?team=&draft_year=&pos=&limit=` | Draft picks with filters |
| GET | `/api/draft/steals` | ML-identified draft steals |
| GET | `/api/draft/busts` | ML-identified draft busts |
| GET | `/api/draft/round_stats` | Average/median stats by draft round |
| GET | `/api/trends?category=&stat=&pos=&start=&end=&agg=` | League-wide season trends |
| GET | `/api/trends/by_team` | Same stat broken down by team |
| POST | `/api/search/natural` | Natural-language → SQL query |

Interactive docs: `http://localhost:8000/docs`

---

## Project Structure

```
NFL_project/
├── server/
│   ├── app/
│   │   ├── main.py              # FastAPI app, router wiring, static-file serving
│   │   ├── db.py                # SQLAlchemy engine (reads DATABASE_URL from .env)
│   │   ├── models.py            # Pydantic response models
│   │   ├── routers/
│   │   │   ├── players.py       # Player profile, injuries, snaps, NGS, adv. receiving
│   │   │   ├── comparison.py    # Multi-player comparison + leaderboard
│   │   │   ├── draft.py         # Draft browser + ML steals/busts/round stats
│   │   │   ├── search.py        # Natural-language SQL search (Claude)
│   │   │   └── trends.py        # League trends by season and by team
│   │   └── data/
│   │       ├── players.py       # Player profile query
│   │       ├── injuries.py      # Injury history (weekly reports + games-played merge)
│   │       ├── snap_counts.py   # Snap count seasons + weekly breakdown
│   │       ├── adv_receiving.py # Advanced receiving + NGS receiving metrics
│   │       ├── ngs.py           # Next Gen Stats (passing + rushing)
│   │       └── ...              # Other data-access modules
│   ├── ml/
│   │   ├── train_model.py       # Draft-value model training
│   │   └── draft_value_model.joblib  # Trained model (gitignored)
│   └── etl/                     # One-time data loaders (run against Neon DB)
├── client/
│   ├── src/
│   │   ├── api.js               # All fetch calls in one place
│   │   ├── context/UserContext.jsx  # Saved items + notes (localStorage)
│   │   ├── hooks/useApi.js      # Data-fetching hook with AbortController
│   │   ├── components/
│   │   │   ├── Nav.jsx          # Navigation + quick player search
│   │   │   ├── StatTable.jsx    # Reusable stat table with column tooltips
│   │   │   └── StatChart.jsx    # Career line charts + bar charts
│   │   └── pages/
│   │       ├── PlayerProfile.jsx  # Player profile (stats, charts, injuries, snaps, NGS)
│   │       ├── Comparison.jsx     # Multi-player comparison
│   │       ├── DraftAnalysis.jsx  # Draft browser + ML analysis
│   │       ├── NaturalSearch.jsx  # Smart Search
│   │       ├── Trends.jsx         # League Trends
│   │       ├── Saved.jsx          # Saved items with notes
│   │       └── Guide.jsx          # In-app guide (EN + HE)
│   └── vite.config.js
├── Dockerfile                   # Multi-stage build (Node → Python, single container)
├── start.ps1                    # Local production launcher
└── DB_SCHEMA.md                 # Database schema reference
```

---

## Data Notes

- Stats cover **2000–2025** regular seasons
- Injury data available from **2009+** (weekly reports from nflverse)
- Snap counts available from **2013+**
- Next Gen Stats available from **2016+**
- Advanced Receiving (PFR) from **2018+**, NGS receiving metrics from **2016+**
- All user saves and notes are stored in **localStorage** (per username, no backend account system)
