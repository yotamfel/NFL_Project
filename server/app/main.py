"""FastAPI app — wires up the module routers (see app/routers/)."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.db import engine
from app.routers import (
    admin, anomalies, comparison, draft, feedback, players, search, trends,
    auth as auth_router, saved, user_feedback, notifications, users,
)

app = FastAPI(title="NFL Data Platform API")


def _run_migrations():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id            BIGSERIAL PRIMARY KEY,
                username      TEXT NOT NULL,
                email         TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
                guide_lang    TEXT NOT NULL DEFAULT 'en',
                theme         TEXT NOT NULL DEFAULT 'dark',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
            ON users (LOWER(username))
        """))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
            ON users (LOWER(email))
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token      TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_visits (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id          BIGSERIAL PRIMARY KEY,
                user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message     TEXT NOT NULL,
                feedback_id BIGINT,
                is_read     BOOLEAN NOT NULL DEFAULT FALSE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS saved_items (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type       TEXT NOT NULL,
                label      TEXT NOT NULL DEFAULT '',
                data       JSONB NOT NULL DEFAULT '{}',
                note       TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        conn.execute(text("""
            ALTER TABLE feedback
            ADD COLUMN IF NOT EXISTS user_id    BIGINT,
            ADD COLUMN IF NOT EXISTS username   TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS category   TEXT NOT NULL DEFAULT 'general',
            ADD COLUMN IF NOT EXISTS resolved   BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS admin_reply TEXT,
            ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ
        """))


_run_migrations()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(comparison.router, prefix="/api")
app.include_router(draft.router, prefix="/api")
app.include_router(search.router,  prefix="/api")
app.include_router(trends.router,   prefix="/api")
app.include_router(feedback.router, prefix="/api")   # AI thumbs → /api/ai/feedback
app.include_router(anomalies.router, prefix="/api")
app.include_router(admin.router,    prefix="/api")
app.include_router(saved.router,    prefix="/api")
app.include_router(user_feedback.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(users.router,    prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


_meta_cache: dict = {}


@app.get("/api/meta")
def meta():
    if not _meta_cache:
        with engine.connect() as conn:
            n_players = conn.execute(text("SELECT COUNT(*) FROM players")).scalar() or 0
            n_seasons = conn.execute(text("""
                SELECT COUNT(DISTINCT season) FROM (
                    SELECT season FROM passing_seasons
                    UNION SELECT season FROM offense_seasons
                    UNION SELECT season FROM defense_seasons
                ) s
            """)).scalar() or 0
        _meta_cache.update({"players": n_players, "seasons": n_seasons, "teams": 32})
    return _meta_cache


# --- Production static-file serving -----------------------------------------
# When client/dist exists (after `npm run build`) serve the React SPA from the
# same uvicorn process.  In development Vite's own dev-server is used instead.
_DIST = Path(__file__).parent.parent.parent / "client" / "dist"

if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_ui(full_path: str):
        file = _DIST / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_DIST / "index.html")
