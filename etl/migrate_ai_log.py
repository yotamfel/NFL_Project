"""One-time migration: creates ai_query_log table in the DB."""
import sys
from pathlib import Path

_env = Path(__file__).parent.parent / "server" / ".env"
if _env.exists():
    import os
    for line in _env.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
            break

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine
from sqlalchemy import text

SQL = """
CREATE TABLE IF NOT EXISTS ai_query_log (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT now(),
    feature     TEXT NOT NULL,
    input_text  TEXT,
    sql_generated TEXT,
    model_used  TEXT,
    tokens_used INT,
    response_ms INT,
    success     BOOLEAN DEFAULT TRUE,
    error_msg   TEXT,
    thumbs      SMALLINT
);
CREATE INDEX IF NOT EXISTS ai_query_log_feature_created ON ai_query_log (feature, created_at);
CREATE INDEX IF NOT EXISTS ai_query_log_created ON ai_query_log (created_at);
"""

if __name__ == "__main__":
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(SQL))
    print("ai_query_log created (or already exists).")
