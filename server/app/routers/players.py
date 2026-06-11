"""Module 1 endpoints: player search and full profile."""
from fastapi import APIRouter, HTTPException, Query

from app.data.players import get_player_profile, search_players, top_players_by_stat
from app.data.snap_counts import get_snap_weeks, get_snap_seasons, get_snap_available_seasons
from app.data.adv_receiving import get_adv_receiving
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


@router.get("/top_by_stat")
def top_by_stat(
    category: str = Query(...),
    stat:     str = Query(...),
    pos:      str | None  = Query(None),
    season:   int | None  = Query(None),
    min:      float       = Query(0.0, ge=0),
    limit:    int         = Query(20, ge=1, le=50),
):
    try:
        return top_players_by_stat(category, stat, pos=pos, season=season, min_val=min, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{player_id}/adv_receiving")
def adv_receiving(player_id: str):
    return get_adv_receiving(player_id)


@router.get("/{player_id}/snaps")
def snaps(
    player_id: str,
    season: int | None = Query(None, description="Specific season for weekly breakdown"),
):
    if season:
        return {"weeks": get_snap_weeks(player_id, season), "season": season}
    seasons = get_snap_seasons(player_id)
    available = get_snap_available_seasons(player_id)
    return {"seasons": seasons, "available": available}


@router.get("/{player_id}", response_model=PlayerProfile)
def profile(player_id: str):
    result = get_player_profile(player_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no player with id {player_id!r}")
    return result
