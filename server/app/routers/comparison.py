"""Module 2 endpoint: compare two or more players in one box-score category."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.data.comparison import compare_career, compare_career_range, compare_season
from app.data.players import CATEGORIES
from app.narrative import generate_narrative

router = APIRouter(prefix="/compare", tags=["comparison"])


class NarrativeRequest(BaseModel):
    player_ids: list[str]
    category: str
    season: int | None = None


@router.post("/narrative")
def narrative(body: NarrativeRequest):
    if len(body.player_ids) < 2:
        raise HTTPException(status_code=400, detail="provide at least two player_ids")
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400,
                            detail=f"unknown category {body.category!r}; must be one of {CATEGORIES}")
    try:
        return generate_narrative(body.player_ids, body.category, body.season)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("")
def compare(player_ids: list[str] = Query(
                ..., description="Repeat for each player, e.g. ?player_ids=MahoPa00&player_ids=AlleJo02"),
            category: str = Query(..., description=f"One of: {', '.join(CATEGORIES)}"),
            season: int | None = Query(None, description="Omit to compare career totals instead"),
            season_from: int | None = Query(None, description="Year range start (career mode only)"),
            season_to: int | None = Query(None, description="Year range end (career mode only)")):
    if len(player_ids) < 2:
        raise HTTPException(status_code=400, detail="provide at least two player_ids to compare")
    if category not in CATEGORIES:
        raise HTTPException(status_code=400,
                            detail=f"unknown category {category!r}; must be one of {CATEGORIES}")

    if season is not None:
        return compare_season(player_ids, category, season)
    if season_from is not None or season_to is not None:
        sfrom = season_from or 1970
        sto   = season_to   or 2025
        return compare_career_range(player_ids, category, sfrom, sto)
    return compare_career(player_ids, category)
