"""AI Scout — analytical multi-condition queries with summary and chart."""
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
from app.ai.scout_prompts import SQL_SYSTEM, SUMMARY_PROMPT
from app.nl_search import _validate_sql, _strip_fences, TranslationError

router = APIRouter(prefix="/scout", tags=["scout"])

MODEL = "claude-sonnet-4-6"


class ScoutBody(BaseModel):
    question: str


def _client() -> Anthropic:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI features not configured")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


@router.post("")
def scout_query(body: ScoutBody, user: dict = Depends(require_admin)):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question is required")

    client = _client()
    t0 = time.monotonic()

    # Step 1 — Generate SQL
    try:
        resp1 = client.messages.create(
            model=MODEL, max_tokens=1024,
            system=SQL_SYSTEM,
            messages=[{"role": "user", "content": question}],
            timeout=20,
        )
        raw_sql = _strip_fences("".join(b.text for b in resp1.content if b.type == "text"))
        tokens1 = resp1.usage.input_tokens + resp1.usage.output_tokens
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log_query(feature="ai_scout", input_text=question, model_used=MODEL,
                  response_ms=ms, success=False, error_msg=str(exc)[:200])
        raise HTTPException(status_code=503, detail="AI service unavailable")

    if raw_sql.upper().startswith("CANNOT_ANSWER"):
        msg = raw_sql.split(":", 1)[1].strip() if ":" in raw_sql else raw_sql
        ms = int((time.monotonic() - t0) * 1000)
        log_query(feature="ai_scout", input_text=question, model_used=MODEL,
                  tokens_used=tokens1, response_ms=ms, success=False, error_msg=msg)
        return {"cannot_answer": True, "reason": msg}

    try:
        sql = _validate_sql(raw_sql)
    except TranslationError as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log_query(feature="ai_scout", input_text=question, sql_generated=raw_sql,
                  model_used=MODEL, tokens_used=tokens1, response_ms=ms,
                  success=False, error_msg=str(exc))
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        with engine.connect() as conn:
            rows = [dict(r._mapping) for r in conn.execute(text(sql))]
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log_query(feature="ai_scout", input_text=question, sql_generated=sql,
                  model_used=MODEL, tokens_used=tokens1, response_ms=ms,
                  success=False, error_msg=str(getattr(exc, "orig", exc))[:200])
        raise HTTPException(status_code=422, detail=f"Query failed: {getattr(exc, 'orig', exc)}")

    # Step 2 — Generate summary + chart spec
    summary = ""
    chart = None
    tokens2 = 0

    if rows:
        data_sample = rows[:100]
        # Convert non-serializable types
        for r in data_sample:
            for k, v in r.items():
                if hasattr(v, 'isoformat'):
                    r[k] = str(v)
                elif isinstance(v, (bytes, memoryview)):
                    r[k] = str(v)

        try:
            prompt2 = SUMMARY_PROMPT.format(
                question=question,
                data=json.dumps(data_sample, default=str)[:8000],
            )
            resp2 = client.messages.create(
                model=MODEL, max_tokens=1500,
                messages=[{"role": "user", "content": prompt2}],
                timeout=20,
            )
            raw2 = "".join(b.text for b in resp2.content if b.type == "text").strip()
            tokens2 = resp2.usage.input_tokens + resp2.usage.output_tokens

            parsed = json.loads(raw2)
            summary = parsed.get("summary", "")
            chart = parsed.get("chart")
        except (json.JSONDecodeError, Exception):
            summary = f"Query returned {len(rows)} results."
            chart = None

    ms = int((time.monotonic() - t0) * 1000)
    log_query(feature="ai_scout", input_text=question, sql_generated=sql,
              model_used=MODEL, tokens_used=tokens1 + tokens2,
              response_ms=ms, success=True)

    return {
        "sql": sql,
        "results": rows,
        "summary": summary,
        "chart": chart,
        "cannot_answer": False,
    }
