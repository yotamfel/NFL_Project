"""FastAPI app — wires up the module routers (see app/routers/)."""
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.db import engine
from app.routers import admin, anomalies, comparison, draft, feedback, players, search, trends

app = FastAPI(title="NFL Data Platform API")

# Kept for development: in production the client and server share an origin
# so the browser never sends a cross-origin request anyway.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# All API routes live under /api so they don't conflict with React Router
# paths like /draft or /search.
app.include_router(players.router, prefix="/api")
app.include_router(comparison.router, prefix="/api")
app.include_router(draft.router, prefix="/api")
app.include_router(search.router,  prefix="/api")
app.include_router(trends.router,   prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(anomalies.router, prefix="/api")
app.include_router(admin.router,    prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


_meta_cache: dict = {}
_META_TTL = 3600  # refresh counts once per hour


@app.get("/api/meta")
def meta():
    now = time.time()
    if _meta_cache and now - _meta_cache["ts"] < _META_TTL:
        return _meta_cache["data"]
    with engine.connect() as conn:
        n_players = conn.execute(text("SELECT COUNT(*) FROM players")).scalar() or 0
        n_seasons = conn.execute(text("""
            SELECT COUNT(DISTINCT season) FROM (
                SELECT season FROM passing_seasons
                UNION SELECT season FROM offense_seasons
                UNION SELECT season FROM defense_seasons
            ) s
        """)).scalar() or 0
    data = {"players": n_players, "seasons": n_seasons, "teams": 32}
    _meta_cache.update({"ts": now, "data": data})
    return data


# --- Production static-file serving -----------------------------------------
# When client/dist exists (after `npm run build`) serve the React SPA from the
# same uvicorn process.  In development Vite's own dev-server is used instead.
_DIST = Path(__file__).parent.parent.parent / "client" / "dist"

if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_ui(full_path: str):
        return FileResponse(_DIST / "index.html")
