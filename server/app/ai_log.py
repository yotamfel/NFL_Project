"""Logging helper for all AI feature calls."""
import time
from typing import Optional

from sqlalchemy import text

from app.db import engine


def log_query(
    feature: str,
    input_text: Optional[str] = None,
    sql_generated: Optional[str] = None,
    model_used: Optional[str] = None,
    tokens_used: Optional[int] = None,
    response_ms: Optional[int] = None,
    success: bool = True,
    error_msg: Optional[str] = None,
) -> int:
    """Insert a log row and return its id (used to attach thumbs feedback)."""
    with engine.begin() as conn:
        row = conn.execute(text("""
            INSERT INTO ai_query_log
                (feature, input_text, sql_generated, model_used,
                 tokens_used, response_ms, success, error_msg)
            VALUES
                (:feature, :input_text, :sql_generated, :model_used,
                 :tokens_used, :response_ms, :success, :error_msg)
            RETURNING id
        """), {
            "feature": feature,
            "input_text": input_text,
            "sql_generated": sql_generated,
            "model_used": model_used,
            "tokens_used": tokens_used,
            "response_ms": response_ms,
            "success": success,
            "error_msg": error_msg,
        })
        return row.scalar()


def set_thumbs(log_id: int, value: int) -> None:
    """Update thumbs on an existing log row. value must be 1 or -1."""
    if value not in (1, -1):
        raise ValueError("thumbs must be 1 or -1")
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE ai_query_log SET thumbs = :v WHERE id = :id"),
            {"v": value, "id": log_id},
        )


class Timer:
    """Context manager that measures elapsed ms."""
    def __enter__(self):
        self._start = time.monotonic()
        return self

    def __exit__(self, *_):
        self.ms = int((time.monotonic() - self._start) * 1000)
