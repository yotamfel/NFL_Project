"""Module 1 endpoints: player search and full profile."""
from fastapi import APIRouter, HTTPException, Query

from app.data.players import get_player_profile, search_players
from app.models import Player, PlayerProfile

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/search", response_model=list[Player])
def search(
    q: str = Query("", description="Partial, case-insensitive name match"),
    limit: int = Query(10, ge=1, le=50),
    pos: str | None = Query(None, description="Position code, e.g. QB"),
    season: int | None = Query(None, description="Player was active this year"),
    team: str | None = Query(None, description="3-letter team code, e.g. NWE"),
):
    if not q and not pos and not season and not team:
        return []
    return search_players(q, limit=limit, pos=pos, season=season, team=team)


@router.get("/{player_id}", response_model=PlayerProfile)
def profile(player_id: str):
    result = get_player_profile(player_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no player with id {player_id!r}")
    return result
