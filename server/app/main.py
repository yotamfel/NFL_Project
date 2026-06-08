"""FastAPI app — wires up the module routers (see app/routers/)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import comparison, draft, players, search

app = FastAPI(title="NFL Data Platform API")

# The React client (stage 7) runs on a different origin (Vite/CRA dev server
# locally, a separate Vercel domain in production) — without this, the
# browser blocks the requests entirely.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(comparison.router)
app.include_router(draft.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok"}
