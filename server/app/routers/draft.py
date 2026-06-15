"""Module 3 endpoints: draft picks with filters, plus steals/busts."""
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app.data.draft import (DEFAULT_MIN_SEASONING_YEARS, find_busts, find_steals,
                             get_combined_draft, get_custom_draft_rank, get_draft_picks,
                             get_draft_round_stats)


class CriterionItem(BaseModel):
    category: str
    stat: Optional[str] = None
    scope: str = "career"
    stat_val: float
    stat_op: str = "gte"

class CombinedDraftRequest(BaseModel):
    criteria: list[CriterionItem]
    round_val: int = 4
    round_op: str = "gte"
    pos: str
    draft_year_from: Optional[int] = None
    draft_year_to: Optional[int] = None
    limit: int = 100

router = APIRouter(prefix="/draft", tags=["draft"])


@router.post("/combined")
def combined_draft(req: CombinedDraftRequest):
    try:
        return get_combined_draft(
            criteria=[c.model_dump() for c in req.criteria],
            round_val=req.round_val,
            round_op=req.round_op,
            pos=req.pos,
            draft_year_from=req.draft_year_from,
            draft_year_to=req.draft_year_to,
            limit=req.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("")
def picks(team: str | None = Query(None, description="Three-letter team code, e.g. KAN"),
          draft_year: int | None = Query(None),
          pos: str | None = Query(None, description="Position abbreviation, e.g. QB"),
          limit: int = Query(50, ge=1, le=200)):
    return get_draft_picks(team=team, draft_year=draft_year, pos=pos, limit=limit)


@router.get("/custom")
def custom_rank(
    round_val:       int   = Query(4, ge=1, le=7),
    round_op:        str   = Query("gte"),
    stat_val:        float = Query(50.0, ge=0),
    stat_op:         str   = Query("gte"),
    category:        str   = Query("career_av"),
    stat:            str | None = Query(None),
    scope:           str   = Query("career"),
    pos:             str | None = Query(None),
    draft_year_from: int | None = Query(None),
    draft_year_to:   int | None = Query(None),
    limit:           int   = Query(50, ge=1, le=100),
):
    try:
        return get_custom_draft_rank(
            round_val=round_val,           round_op=round_op,
            stat_val=stat_val,             stat_op=stat_op,
            category=category,             stat=stat,
            scope=scope,                   pos=pos,
            draft_year_from=draft_year_from, draft_year_to=draft_year_to,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/round_stats")
def round_stats(
    round_val:       int       = Query(4, ge=1, le=7),
    round_op:        str       = Query("gte"),
    category:        str       = Query("career_av"),
    stat:            str | None = Query(None),
    scope:           str       = Query("career"),
    pos:             str | None = Query(None),
    draft_year_from: int | None = Query(None),
    draft_year_to:   int | None = Query(None),
):
    try:
        return get_draft_round_stats(
            round_val=round_val, round_op=round_op,
            category=category, stat=stat, scope=scope, pos=pos,
            draft_year_from=draft_year_from, draft_year_to=draft_year_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
