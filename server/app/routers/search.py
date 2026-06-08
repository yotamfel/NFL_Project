"""
Module 4 endpoint: natural-language search.

The contract is defined here in stage 4 — POST a free-text question, get
back results — so the client (stage 7) can be built against a stable shape.
The actual question -> SQL translation via Claude is stage 6's job; until
then this honestly reports "not implemented" rather than faking a result.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/search", tags=["natural-language search"])


class NaturalLanguageQuery(BaseModel):
    question: str


@router.post("/natural")
def natural_language_search(query: NaturalLanguageQuery):
    raise HTTPException(status_code=501,
                        detail="natural-language search isn't implemented yet — see stage 6")
