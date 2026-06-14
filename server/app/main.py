"""FastAPI app — wires up the module routers (see app/routers/)."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routers import anomalies, comparison, draft, feedback, players, search, trends

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


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Production static-file serving -----------------------------------------
# When client/dist exists (after `npm run build`) serve the React SPA from the
# same uvicorn process.  In development Vite's own dev-server is used instead.
_DIST = Path(__file__).parent.parent.parent / "client" / "dist"

if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_ui(full_path: str):
        return FileResponse(_DIST / "index.html")
