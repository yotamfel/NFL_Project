"""
Anomaly detection job — runs after the ETL to flag season-level outliers.

For each tracked metric, finds players whose most-recent-season value is:
  - a career high (alert_type = 'career_high'), or
  - 1.5+ std deviations above their historical avg (alert_type = 'above_avg'), or
  - 1.5+ std deviations below their historical avg (alert_type = 'below_avg').

Deletes and re-inserts for the target season so reruns are idempotent.
"""
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

# Metrics to monitor: (table, metric, min_volume_col, min_volume, label)
METRICS = [
    # Passing
    ("passing_seasons", "yds",  "att",     200, "passing yards"),
    ("passing_seasons", "td",   "att",     200, "passing TDs"),
    # Rushing (offense table)
    ("offense_seasons", "rush_yds", "att", 50,  "rushing yards"),
    ("offense_seasons", "rush_td",  "att", 50,  "rushing TDs"),
    # Receiving
    ("offense_seasons", "rec_yds", "rec",  30,  "receiving yards"),
    ("offense_seasons", "rec_td",  "rec",  30,  "receiving TDs"),
    # Defense
    ("defense_seasons", "sk",    "g",      8,   "sacks"),
    ("defense_seasons", "int",   "g",      8,   "interceptions"),
]

CREATE_TABLE = """
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


def _severity(value, career_avg, career_high, alert_type):
    if career_avg is None or career_avg == 0:
        return 1
    pct_above = (value - career_avg) / career_avg if career_avg else 0
    if alert_type == "career_high":
        pct_above_prev = (value - career_high) / career_high if career_high else 0
        if pct_above_prev >= 0.30:
            return 3
        if pct_above_prev >= 0.10:
            return 2
        return 1
    if pct_above >= 0.50:
        return 3
    if pct_above >= 0.25:
        return 2
    return 1


def _description(player_name, metric_label, value, career_avg, career_high, alert_type):
    val_str = f"{value:,.0f}" if value >= 10 else f"{value:.1f}"
    avg_str = f"{career_avg:,.0f}" if career_avg and career_avg >= 10 else (f"{career_avg:.1f}" if career_avg else "n/a")
    if alert_type == "career_high":
        return f"{player_name} set a career high with {val_str} {metric_label} (prev. best: {f'{career_high:,.0f}' if career_high >= 10 else f'{career_high:.1f}'})"
    if alert_type == "above_avg":
        return f"{player_name} posted {val_str} {metric_label}, well above their career avg of {avg_str}"
    return f"{player_name} posted only {val_str} {metric_label}, well below their career avg of {avg_str}"


def detect(target_season: int, conn) -> list[dict]:
    rows = []
    for table, metric, vol_col, min_vol, metric_label in METRICS:
        category = table.replace("_seasons", "")
        results = conn.execute(text(f"""
            WITH history AS (
                SELECT player_id,
                       AVG({metric})    AS avg_val,
                       STDDEV({metric}) AS std_val,
                       MAX({metric})    AS prev_high,
                       COUNT(*)         AS n_seasons
                FROM {table}
                WHERE season < :tgt AND {vol_col} >= :minvol
                GROUP BY player_id
                HAVING COUNT(*) >= 2
            ),
            current AS (
                SELECT s.player_id, s.player_name, p.pos, s.{metric} AS value
                FROM {table} s
                JOIN players p USING (player_id)
                WHERE s.season = :tgt AND s.{vol_col} >= :minvol
                  AND s.{metric} IS NOT NULL AND s.{metric} > 0
            )
            SELECT
                c.player_id, c.player_name, c.pos,
                c.value,
                h.avg_val  AS career_avg,
                h.std_val  AS career_std,
                h.prev_high AS career_high,
                CASE
                  WHEN c.value > h.prev_high THEN 'career_high'
                  WHEN h.std_val > 0 AND c.value > h.avg_val + 1.5 * h.std_val THEN 'above_avg'
                  WHEN h.std_val > 0 AND c.value < h.avg_val - 1.5 * h.std_val THEN 'below_avg'
                END AS alert_type
            FROM current c
            JOIN history h USING (player_id)
            WHERE
                c.value > h.prev_high
                OR (h.std_val > 0 AND ABS(c.value - h.avg_val) > 1.5 * h.std_val)
            ORDER BY c.value DESC
            LIMIT 20
        """), {"tgt": target_season, "minvol": min_vol}).fetchall()

        for r in results:
            if not r.alert_type:
                continue
            sev = _severity(float(r.value), float(r.career_avg) if r.career_avg else None,
                            float(r.career_high) if r.career_high else None, r.alert_type)
            desc = _description(r.player_name, metric_label, float(r.value),
                                float(r.career_avg) if r.career_avg else None,
                                float(r.career_high) if r.career_high else None, r.alert_type)
            rows.append({
                "season": target_season,
                "player_id": r.player_id,
                "player_name": r.player_name,
                "pos": r.pos,
                "category": category,
                "metric": metric,
                "value": float(r.value),
                "career_avg": float(r.career_avg) if r.career_avg else None,
                "career_high": float(r.career_high) if r.career_high else None,
                "alert_type": r.alert_type,
                "description": desc,
                "severity": sev,
            })
    return rows


if __name__ == "__main__":
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(CREATE_TABLE))

        # Find the most recent season with meaningful data
        row = conn.execute(text(
            "SELECT MAX(season) AS s FROM passing_seasons WHERE att >= 100"
        )).fetchone()
        target = int(row.s) if row and row.s else None
        if not target:
            print("No season data found — skipping anomaly detection.")
            sys.exit(0)

        print(f"Detecting anomalies for season {target}…")
        conn.execute(text("DELETE FROM anomaly_alerts WHERE season = :s"), {"s": target})

        alerts = detect(target, conn)
        if alerts:
            conn.execute(text("""
                INSERT INTO anomaly_alerts
                    (season, player_id, player_name, pos, category, metric,
                     value, career_avg, career_high, alert_type, description, severity)
                VALUES
                    (:season, :player_id, :player_name, :pos, :category, :metric,
                     :value, :career_avg, :career_high, :alert_type, :description, :severity)
            """), alerts)
        print(f"Inserted {len(alerts)} anomaly alerts for season {target}.")
