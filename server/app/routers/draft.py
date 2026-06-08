"""Module 3 endpoints: draft picks with filters, plus steals/busts."""
from fastapi import APIRouter, Query

from app.data.draft import DEFAULT_MIN_SEASONING_YEARS, find_busts, find_steals, get_draft_picks

router = APIRouter(prefix="/draft", tags=["draft"])


@router.get("")
def picks(team: str | None = Query(None, description="Three-letter team code, e.g. KAN"),
          draft_year: int | None = Query(None),
          pos: str | None = Query(None, description="Position abbreviation, e.g. QB"),
          limit: int = Query(50, ge=1, le=200)):
    return get_draft_picks(team=team, draft_year=draft_year, pos=pos, limit=limit)


@router.get("/steals")
def steals(min_round: int = Query(4, ge=1, le=7),
           min_career_av: int = Query(50, ge=0),
           min_seasoning_years: int = Query(DEFAULT_MIN_SEASONING_YEARS, ge=0,
                                            description="Exclude classes too recent to judge fairly"),
           limit: int = Query(20, ge=1, le=100)):
    return find_steals(min_round=min_round, min_career_av=min_career_av,
                       min_seasoning_years=min_seasoning_years, limit=limit)


@router.get("/busts")
def busts(max_round: int = Query(1, ge=1, le=7),
          max_career_av: int = Query(15, ge=0),
          min_seasoning_years: int = Query(DEFAULT_MIN_SEASONING_YEARS, ge=0,
                                           description="Exclude classes too recent to judge fairly"),
          limit: int = Query(20, ge=1, le=100)):
    return find_busts(max_round=max_round, max_career_av=max_career_av,
                      min_seasoning_years=min_seasoning_years, limit=limit)
