"""Content Creator Mode — generate social media posts from NFL data."""
import json
import time
from typing import Any

from anthropic import Anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.auth import require_admin
from app.config import ANTHROPIC_API_KEY
from app.db import engine
from app.ai_log import log_query
from app.ai.content_prompts import PROMPTS

router = APIRouter(prefix="/content", tags=["content"])

MODEL = "claude-sonnet-4-6"


class ContentBody(BaseModel):
    platform: str
    data: Any
    context: str


@router.post("/generate")
def generate_content(body: ContentBody, user: dict = Depends(require_admin)):
    if body.platform not in PROMPTS:
        raise HTTPException(status_code=422, detail=f"Platform must be one of: {', '.join(PROMPTS.keys())}")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI features not configured")

    prompt = PROMPTS[body.platform].format(
        data=json.dumps(body.data, default=str)[:6000],
        context=body.context[:500],
    )

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    t0 = time.monotonic()

    try:
        resp = client.messages.create(
            model=MODEL, max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
            timeout=20,
        )
        raw = "".join(b.text for b in resp.content if b.type == "text").strip()
        tokens = resp.usage.input_tokens + resp.usage.output_tokens
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log_query(feature="content_creator", input_text=body.context,
                  model_used=MODEL, response_ms=ms, success=False,
                  error_msg=str(exc)[:200])
        raise HTTPException(status_code=503, detail="AI service unavailable")

    ms = int((time.monotonic() - t0) * 1000)
    log_query(feature="content_creator", input_text=body.context,
              model_used=MODEL, tokens_used=tokens, response_ms=ms, success=True)

    if body.platform == "twitter":
        content = raw[:280]
    else:
        try:
            content = json.loads(raw)
        except json.JSONDecodeError:
            try:
                resp2 = client.messages.create(
                    model=MODEL, max_tokens=1000,
                    messages=[
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": raw},
                        {"role": "user", "content": "Please return only valid JSON, no other text."},
                    ],
                    timeout=15,
                )
                raw2 = "".join(b.text for b in resp2.content if b.type == "text").strip()
                content = json.loads(raw2)
            except (json.JSONDecodeError, Exception):
                content = raw

    uid = int(user["sub"])
    content_str = content if isinstance(content, str) else json.dumps(content)
    with engine.begin() as conn:
        row = conn.execute(text("""
            INSERT INTO generated_content (user_id, platform, content_text, source_context)
            VALUES (:uid, :platform, :content, :context)
            RETURNING id, created_at
        """), {"uid": uid, "platform": body.platform,
               "content": content_str, "context": body.context[:500]}).fetchone()

    return {"id": row.id, "platform": body.platform, "content": content,
            "created_at": str(row.created_at)}


@router.get("/history")
def content_history(user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, platform, content_text, source_context, created_at
            FROM generated_content
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 100
        """), {"uid": uid}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.delete("/{content_id}", status_code=204)
def delete_content(content_id: int, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.begin() as conn:
        result = conn.execute(text(
            "DELETE FROM generated_content WHERE id = :id AND user_id = :uid"
        ), {"id": content_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Content not found")
