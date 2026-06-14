"""One-time migration: creates anomaly_alerts table in the DB."""
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
CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id           BIGSERIAL PRIMARY KEY,
    detected_at  TIMESTAMPTZ DEFAULT now(),
    season       INT  NOT NULL,
    player_id    TEXT NOT NULL,
    player_name  TEXT NOT NULL,
    pos          TEXT,
    category     TEXT NOT NULL,
    metric       TEXT NOT NULL,
    value        NUMERIC,
    career_avg   NUMERIC,
    career_high  NUMERIC,
    alert_type   TEXT NOT NULL,
    description  TEXT,
    severity     SMALLINT DEFAULT 1
);
CREATE INDEX IF NOT EXISTS anomaly_alerts_season ON anomaly_alerts (season DESC);
CREATE INDEX IF NOT EXISTS anomaly_alerts_detected ON anomaly_alerts (detected_at DESC);
"""

if __name__ == "__main__":
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(SQL))
    print("anomaly_alerts created (or already exists).")
