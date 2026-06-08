"""
Module 4 endpoint: natural-language search.

The contract was defined back in stage 4 — POST a free-text question, get
back results — so the client (stage 7) could be built against a stable
shape early. The actual question -> SQL translation now lives in
app.nl_search; this router stays a thin HTTP layer that maps its one
exception type to one honest status code.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models import NaturalLanguageResult
from app.nl_search import TranslationError, answer_question

router = APIRouter(prefix="/search", tags=["natural-language search"])


class NaturalLanguageQuery(BaseModel):
    question: str


@router.post("/natural", response_model=NaturalLanguageResult)
def natural_language_search(query: NaturalLanguageQuery):
    try:
        return answer_question(query.question)
    except TranslationError as exc:
        # Every TranslationError — "couldn't translate", "unsafe query",
        # "query failed to run" — means the same thing to the caller: this
        # question couldn't be answered. 422 names that honestly, the same
        # way a malformed comparison does in comparison.py.
        raise HTTPException(status_code=422, detail=str(exc))
