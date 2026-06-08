"""Module 2 endpoint: compare two or more players in one box-score category."""
from fastapi import APIRouter, HTTPException, Query

from app.data.comparison import compare_career, compare_season
from app.data.players import CATEGORIES

router = APIRouter(prefix="/compare", tags=["comparison"])


@router.get("")
def compare(player_ids: list[str] = Query(
                ..., description="Repeat for each player, e.g. ?player_ids=MahoPa00&player_ids=AlleJo02"),
            category: str = Query(..., description=f"One of: {', '.join(CATEGORIES)}"),
            season: int | None = Query(None, description="Omit to compare career totals instead")):
    if len(player_ids) < 2:
        raise HTTPException(status_code=400, detail="provide at least two player_ids to compare")
    if category not in CATEGORIES:
        raise HTTPException(status_code=400,
                            detail=f"unknown category {category!r}; must be one of {CATEGORIES}")

    if season is not None:
        return compare_season(player_ids, category, season)
    return compare_career(player_ids, category)
