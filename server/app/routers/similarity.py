"""Player Similarity endpoint — admin-only."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.auth import require_admin
from app.db import engine
from app.ai.similarity import pos_to_group, get_similar_players, explain_similarities

router = APIRouter(prefix="/players", tags=["similarity"])


@router.get("/{player_id}/similar")
def similar_players(player_id: str, user: dict = Depends(require_admin)):
    with engine.connect() as conn:
        row = conn.execute(text(
            "SELECT player_id, player_name, pos FROM players WHERE player_id = :pid"
        ), {"pid": player_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Player not found")

    grp = pos_to_group(row.pos)
    if not grp:
        return []

    result = get_similar_players(player_id, grp)
    if not result:
        return []

    similar, target = result
    explanations = explain_similarities(target, similar, grp)

    for i, s in enumerate(similar):
        s["explanation"] = explanations[i] if i < len(explanations) else ""

    return similar
