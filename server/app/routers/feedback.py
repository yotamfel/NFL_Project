"""POST /api/feedback — attaches thumbs rating to an ai_query_log row."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.ai_log import set_thumbs

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackBody(BaseModel):
    log_id: int
    thumbs: int

    @field_validator("thumbs")
    @classmethod
    def must_be_vote(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("thumbs must be 1 or -1")
        return v


@router.post("")
def submit_feedback(body: FeedbackBody):
    try:
        set_thumbs(body.log_id, body.thumbs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True}
