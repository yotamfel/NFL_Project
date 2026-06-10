"""Endpoints for league-wide trend aggregation."""
from fastapi import APIRouter, HTTPException, Query

from app.data.trends import get_league_trend, get_trend_season_range

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("/aggregate")
def aggregate(
    category:    str       = Query(...),
    stat:        str       = Query(...),
    agg:         str       = Query("sum"),
    pos:         str | None = Query(None),
    team:        str | None = Query(None),
    season_from: int | None = Query(None),
    season_to:   int | None = Query(None),
):
    try:
        return get_league_trend(
            category=category, stat=stat, agg=agg,
            pos=pos, team=team,
            season_from=season_from, season_to=season_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/meta/{category}")
def meta(category: str):
    try:
        return get_trend_season_range(category)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
