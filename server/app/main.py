"""FastAPI app — wires up the module routers (see app/routers/)."""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import engine
from app.routers import (
    admin, anomalies, comparison, content, draft, feedback, players, projects,
    scout, search, similarity, situational, trends, auth as auth_router, saved,
    user_feedback, notifications, users,
)

app = FastAPI(title="NFL Data Platform API")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(422)
async def validation_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": "Invalid input"})


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(request, exc):
    import traceback
    traceback.print_exc()
    return JSONResponse(status_code=503, content={"detail": f"Database error: {str(exc)[:200]}"})


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
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
        """))
        conn.execute(text("""
            ALTER TABLE anomaly_alerts
            ADD COLUMN IF NOT EXISTS team TEXT
        """))
        conn.execute(text("""
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS feedback_id BIGINT
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS feedback_messages (
                id          BIGSERIAL PRIMARY KEY,
                feedback_id BIGINT NOT NULL,
                sender      TEXT NOT NULL,
                message     TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        # Migrate existing feedback initial messages
        conn.execute(text("""
            INSERT INTO feedback_messages (feedback_id, sender, message, created_at)
            SELECT id, 'user', message, created_at FROM feedback
            WHERE message IS NOT NULL AND message != ''
              AND id NOT IN (
                SELECT DISTINCT feedback_id FROM feedback_messages WHERE sender = 'user'
              )
        """))
        # Migrate existing admin replies
        conn.execute(text("""
            INSERT INTO feedback_messages (feedback_id, sender, message, created_at)
            SELECT id, 'admin', admin_reply, COALESCE(replied_at, created_at) FROM feedback
            WHERE admin_reply IS NOT NULL AND admin_reply != ''
              AND id NOT IN (
                SELECT DISTINCT feedback_id FROM feedback_messages WHERE sender = 'admin'
              )
        """))
        conn.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS fdv NUMERIC(6,1)"
        ))
        conn.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS gsis_id TEXT"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_query_log (
                id           BIGSERIAL PRIMARY KEY,
                created_at   TIMESTAMPTZ DEFAULT now(),
                feature      TEXT,
                input_text   TEXT,
                sql_generated TEXT,
                model_used   TEXT,
                tokens_used  INT,
                response_ms  INT,
                success      BOOLEAN DEFAULT TRUE,
                error_msg    TEXT,
                thumbs       INT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS projects (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id, name)
        """))
        conn.execute(text("""
            ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS
                project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS generated_content (
                id               BIGSERIAL PRIMARY KEY,
                user_id          BIGINT REFERENCES users(id) ON DELETE CASCADE,
                platform         TEXT NOT NULL,
                content_text     TEXT NOT NULL,
                source_context   TEXT,
                source_data      TEXT,
                regenerate_count INT DEFAULT 0,
                created_at       TIMESTAMPTZ DEFAULT now(),
                updated_at       TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text("""
            ALTER TABLE generated_content
                ADD COLUMN IF NOT EXISTS source_data TEXT,
                ADD COLUMN IF NOT EXISTS regenerate_count INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS page_views (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
                page       TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_page_views_page_date ON page_views (page, created_at DESC)
        """))


_run_migrations()

allowed_origins = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
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
app.include_router(projects.router, prefix="/api")
app.include_router(similarity.router, prefix="/api")
app.include_router(scout.router,      prefix="/api")
app.include_router(content.router,    prefix="/api")
app.include_router(situational.router, prefix="/api")
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
        _meta_cache.update({
            "players": n_players,
            "seasons": n_seasons,
            "teams": 32,
            "data_last_updated": os.getenv("DATA_LAST_UPDATED", "2025-01-01"),
        })
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
