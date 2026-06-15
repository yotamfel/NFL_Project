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
