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

    def _strip_fences(s):
        s = s.strip()
        if s.startswith("```"):
            s = s.split("\n", 1)[-1]
        if s.endswith("```"):
            s = s.rsplit("```", 1)[0]
        return s.strip()

    if body.platform == "twitter":
        content = _strip_fences(raw)[:280]
    else:
        cleaned = _strip_fences(raw)
        try:
            content = json.loads(cleaned)
        except json.JSONDecodeError:
            try:
                resp2 = client.messages.create(
                    model=MODEL, max_tokens=1000,
                    messages=[
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": raw},
                        {"role": "user", "content": "Return only valid JSON, no markdown fences, no backticks."},
                    ],
                    timeout=15,
                )
                raw2 = "".join(b.text for b in resp2.content if b.type == "text").strip()
                content = json.loads(_strip_fences(raw2))
            except (json.JSONDecodeError, Exception):
                content = cleaned

    uid = int(user["sub"])
    content_str = content if isinstance(content, str) else json.dumps(content)
    data_str = json.dumps(body.data, default=str)[:10000]
    with engine.begin() as conn:
        row = conn.execute(text("""
            INSERT INTO generated_content (user_id, platform, content_text, source_context, source_data)
            VALUES (:uid, :platform, :content, :context, :data)
            RETURNING id, created_at
        """), {"uid": uid, "platform": body.platform,
               "content": content_str, "context": body.context[:500],
               "data": data_str}).fetchone()

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


class PatchContentBody(BaseModel):
    content_text: str | None = None
    regenerate: bool = False


@router.patch("/{content_id}")
def patch_content(content_id: int, body: PatchContentBody, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT id, platform, source_context, source_data, regenerate_count FROM generated_content WHERE id = :id AND user_id = :uid"
        ), {"id": content_id, "uid": uid}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Content not found")

        if body.regenerate:
            if row.regenerate_count >= 3:
                raise HTTPException(status_code=422, detail="Regeneration limit reached (max 3)")
            if not ANTHROPIC_API_KEY:
                raise HTTPException(status_code=503, detail="AI features not configured")
            if not row.source_data:
                raise HTTPException(status_code=422, detail="No source data stored for regeneration")

            prompt = PROMPTS[row.platform].format(
                data=row.source_data[:6000],
                context=(row.source_context or "")[:500],
            )
            client = Anthropic(api_key=ANTHROPIC_API_KEY)
            resp = client.messages.create(
                model=MODEL, max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
                timeout=20,
            )
            raw = "".join(b.text for b in resp.content if b.type == "text").strip()
            if row.platform == "twitter":
                new_content = raw[:280]
            else:
                try:
                    new_content = json.dumps(json.loads(raw))
                except json.JSONDecodeError:
                    new_content = raw

            updated = conn.execute(text("""
                UPDATE generated_content
                SET content_text = :content, regenerate_count = regenerate_count + 1, updated_at = now()
                WHERE id = :id AND user_id = :uid
                RETURNING id, platform, content_text, source_context, regenerate_count, created_at, updated_at
            """), {"content": new_content, "id": content_id, "uid": uid}).fetchone()
            return dict(updated._mapping)

        if body.content_text is not None:
            updated = conn.execute(text("""
                UPDATE generated_content
                SET content_text = :content, updated_at = now()
                WHERE id = :id AND user_id = :uid
                RETURNING id, platform, content_text, source_context, regenerate_count, created_at, updated_at
            """), {"content": body.content_text, "id": content_id, "uid": uid}).fetchone()
            return dict(updated._mapping)

    return {"ok": True}


@router.delete("/{content_id}", status_code=204)
def delete_content(content_id: int, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.begin() as conn:
        result = conn.execute(text(
            "DELETE FROM generated_content WHERE id = :id AND user_id = :uid"
        ), {"id": content_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Content not found")
