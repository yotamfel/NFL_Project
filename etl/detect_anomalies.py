"""
Anomaly detection job — runs after the ETL to flag season-level outliers.

Alert types:
  career_high     — player's best-ever value in a counting stat
  above_avg       — counting stat 1.5+ std devs above career mean
  below_avg       — counting stat 1.5+ std devs below career mean
  yoy_surge       — 40%+ improvement vs the immediately previous season
  efficiency_peak — rate/efficiency stat significantly above career mean
  versatile       — meaningful dual-category contribution in one season

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

# ── Counting-stat metrics (career_high / above_avg / below_avg / yoy_surge) ──
COUNTING_METRICS = [
    ("passing_seasons", "yds",      "att",  200, "passing yards"),
    ("passing_seasons", "td",       "att",  200, "passing TDs"),
    ("offense_seasons", "rush_yds", "att",   50, "rushing yards"),
    ("offense_seasons", "rush_td",  "att",   50, "rushing TDs"),
    ("offense_seasons", "rec_yds",  "rec",   30, "receiving yards"),
    ("offense_seasons", "rec_td",   "rec",   30, "receiving TDs"),
    ("defense_seasons", "sk",       "g",      8, "sacks"),
    ("defense_seasons", "int",      "g",      8, "interceptions"),
    ("defense_seasons", "pd",       "g",      8, "passes defended"),
    ("defense_seasons", "comb",     "g",      8, "combined tackles"),
]

# ── Rate/efficiency metrics (efficiency_peak) ─────────────────────────────────
EFFICIENCY_METRICS = [
    ("passing_seasons", "rate",    "att",  200, "passer rating"),
    ("passing_seasons", "y_per_a", "att",  200, "yards per attempt"),
    ("offense_seasons", "y_per_r", "rec",   40, "yards per reception"),
    ("offense_seasons", "y_per_a", "att",   60, "yards per carry"),
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
    severity     SMALLINT DEFAULT 1,
    week         INT,
    opponent     TEXT
);
CREATE INDEX IF NOT EXISTS anomaly_alerts_season ON anomaly_alerts (season DESC);
CREATE INDEX IF NOT EXISTS anomaly_alerts_detected ON anomaly_alerts (detected_at DESC);
"""

ALTER_TABLE = """
ALTER TABLE anomaly_alerts ADD COLUMN IF NOT EXISTS week     INT;
ALTER TABLE anomaly_alerts ADD COLUMN IF NOT EXISTS opponent TEXT;
"""


# ── helpers ───────────────────────────────────────────────────────────────────

def _v(value, decimals=0):
    """Format a numeric value for display."""
    if value is None:
        return "n/a"
    return f"{value:,.{decimals}f}" if decimals else f"{value:,.0f}" if value >= 10 else f"{value:.1f}"


def _row(season, player_id, player_name, pos, category, metric,
         value, career_avg, career_high, alert_type, description, severity,
         week=None, opponent=None):
    return {
        "season": season, "player_id": player_id, "player_name": player_name,
        "pos": pos, "category": category, "metric": metric,
        "value": value, "career_avg": career_avg, "career_high": career_high,
        "alert_type": alert_type, "description": description, "severity": severity,
        "week": week, "opponent": opponent,
    }


# ── 1. Career-high / above-avg / below-avg ───────────────────────────────────

def _counting_severity(value, career_avg, career_high, alert_type):
    if alert_type == "career_high":
        pct = (value - career_high) / career_high if career_high else 0
        return 3 if pct >= 0.30 else 2 if pct >= 0.10 else 1
    if career_avg and career_avg > 0:
        pct = abs(value - career_avg) / career_avg
        return 3 if pct >= 0.50 else 2 if pct >= 0.25 else 1
    return 1


def detect_counting(target: int, conn) -> list[dict]:
    rows = []
    for table, metric, vol_col, min_vol, label in COUNTING_METRICS:
        category = table.replace("_seasons", "")
        results = conn.execute(text(f"""
            WITH history AS (
                SELECT player_id,
                       AVG({metric})    AS avg_val,
                       STDDEV({metric}) AS std_val,
                       MAX({metric})    AS prev_high
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
            SELECT c.player_id, c.player_name, c.pos, c.value,
                   h.avg_val AS career_avg, h.prev_high AS career_high,
                   CASE
                     WHEN c.value > h.prev_high                                 THEN 'career_high'
                     WHEN h.std_val > 0 AND c.value > h.avg_val + 1.5*h.std_val THEN 'above_avg'
                     WHEN h.std_val > 0 AND c.value < h.avg_val - 1.5*h.std_val THEN 'below_avg'
                   END AS alert_type
            FROM current c
            JOIN history h USING (player_id)
            WHERE c.value > h.prev_high
               OR (h.std_val > 0 AND ABS(c.value - h.avg_val) > 1.5 * h.std_val)
            ORDER BY c.value DESC
            LIMIT 20
        """), {"tgt": target, "minvol": min_vol}).fetchall()

        for r in results:
            if not r.alert_type:
                continue
            v  = float(r.value)
            ca = float(r.career_avg) if r.career_avg else None
            ch = float(r.career_high) if r.career_high else None
            sev = _counting_severity(v, ca, ch, r.alert_type)
            if r.alert_type == "career_high":
                desc = f"{r.player_name} set a career high with {_v(v)} {label} (prev. best: {_v(ch)})"
            elif r.alert_type == "above_avg":
                desc = f"{r.player_name} posted {_v(v)} {label}, well above their career avg of {_v(ca)}"
            else:
                desc = f"{r.player_name} posted only {_v(v)} {label}, well below their career avg of {_v(ca)}"
            rows.append(_row(target, r.player_id, r.player_name, r.pos,
                             category, metric, v, ca, ch, r.alert_type, desc, sev))
    return rows


# ── 2. Year-over-year surge ───────────────────────────────────────────────────

YOY_METRICS = [
    ("passing_seasons", "yds",      "att",  200, "passing yards"),
    ("passing_seasons", "td",       "att",  200, "passing TDs"),
    ("offense_seasons", "rush_yds", "att",   50, "rushing yards"),
    ("offense_seasons", "rec_yds",  "rec",   30, "receiving yards"),
    ("defense_seasons", "sk",       "g",      8, "sacks"),
]


def detect_yoy_surge(target: int, conn) -> list[dict]:
    rows = []
    for table, metric, vol_col, min_vol, label in YOY_METRICS:
        category = table.replace("_seasons", "")
        results = conn.execute(text(f"""
            WITH prev AS (
                SELECT player_id, {metric} AS prev_val
                FROM {table}
                WHERE season = :prev AND {vol_col} >= :minvol AND {metric} > 0
            ),
            current AS (
                SELECT s.player_id, s.player_name, p.pos, s.{metric} AS value
                FROM {table} s
                JOIN players p USING (player_id)
                WHERE s.season = :tgt AND s.{vol_col} >= :minvol
                  AND s.{metric} IS NOT NULL AND s.{metric} > 0
            )
            SELECT c.player_id, c.player_name, c.pos,
                   c.value, pr.prev_val,
                   (c.value - pr.prev_val)::float / pr.prev_val AS pct_change
            FROM current c
            JOIN prev pr USING (player_id)
            WHERE pr.prev_val > 0
              AND (c.value - pr.prev_val)::float / pr.prev_val >= 0.40
            ORDER BY pct_change DESC
            LIMIT 10
        """), {"tgt": target, "prev": target - 1, "minvol": min_vol}).fetchall()

        for r in results:
            pct = float(r.pct_change) * 100
            v   = float(r.value)
            pv  = float(r.prev_val)
            sev = 3 if pct >= 100 else 2 if pct >= 60 else 1
            desc = (f"{r.player_name} surged from {_v(pv)} to {_v(v)} {label} "
                    f"(+{pct:.0f}% vs prior season)")
            rows.append(_row(target, r.player_id, r.player_name, r.pos,
                             category, metric, v, pv, None, "yoy_surge", desc, sev))
    return rows


# ── 3. Efficiency peak ────────────────────────────────────────────────────────

def detect_efficiency(target: int, conn) -> list[dict]:
    rows = []
    for table, metric, vol_col, min_vol, label in EFFICIENCY_METRICS:
        category = table.replace("_seasons", "")
        results = conn.execute(text(f"""
            WITH history AS (
                SELECT player_id,
                       AVG({metric})    AS avg_val,
                       STDDEV({metric}) AS std_val,
                       MAX({metric})    AS prev_high
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
            SELECT c.player_id, c.player_name, c.pos, c.value,
                   h.avg_val AS career_avg, h.prev_high AS career_high,
                   (c.value - h.avg_val) / NULLIF(h.std_val, 0) AS z_score
            FROM current c
            JOIN history h USING (player_id)
            WHERE h.std_val > 0 AND c.value > h.avg_val + 1.5 * h.std_val
            ORDER BY z_score DESC
            LIMIT 10
        """), {"tgt": target, "minvol": min_vol}).fetchall()

        for r in results:
            v   = float(r.value)
            ca  = float(r.career_avg) if r.career_avg else None
            ch  = float(r.career_high) if r.career_high else None
            z   = float(r.z_score) if r.z_score else 0
            sev = 3 if z >= 3.0 else 2 if z >= 2.0 else 1
            dec = 2 if metric in ("rate", "y_per_a", "y_per_r") else 1
            desc = (f"{r.player_name} posted {_v(v, dec)} {label}, "
                    f"a career-best efficiency (career avg: {_v(ca, dec)})")
            rows.append(_row(target, r.player_id, r.player_name, r.pos,
                             category, metric, v, ca, ch, "efficiency_peak", desc, sev))
    return rows


# ── 4. Versatility ────────────────────────────────────────────────────────────

def detect_versatile(target: int, conn) -> list[dict]:
    rows = []

    # Dual-threat RBs / offensive weapons: 300+ rush AND 300+ rec yards
    results = conn.execute(text("""
        SELECT s.player_id, s.player_name, p.pos,
               s.rush_yds, s.rec_yds,
               s.rush_yds + s.rec_yds AS total_yscm,
               s.rush_td + s.rec_td   AS total_td
        FROM offense_seasons s
        JOIN players p USING (player_id)
        WHERE s.season = :tgt
          AND s.rush_yds >= 300 AND s.rec_yds >= 300
        ORDER BY total_yscm DESC
        LIMIT 10
    """), {"tgt": target}).fetchall()

    for r in results:
        ry, recy = float(r.rush_yds), float(r.rec_yds)
        total = float(r.total_yscm)
        sev = 3 if ry >= 700 and recy >= 700 else 2 if ry >= 500 and recy >= 500 else 1
        desc = (f"{r.player_name}: {_v(ry)} rush yards + {_v(recy)} rec yards "
                f"({_v(total)} from scrimmage) — elite dual-threat")
        rows.append(_row(target, r.player_id, r.player_name, r.pos,
                         "offense", "yscm", total, None, None, "versatile", desc, sev))

    # Dual-threat QBs: 200+ pass attempts AND 50+ rush attempts
    results = conn.execute(text("""
        SELECT ps.player_id, ps.player_name, p.pos,
               ps.yds AS pass_yds, ps.td AS pass_td,
               os.rush_yds, os.rush_td
        FROM passing_seasons ps
        JOIN offense_seasons os USING (player_id, season)
        JOIN players p ON p.player_id = ps.player_id
        WHERE ps.season = :tgt
          AND ps.att >= 200 AND os.att >= 50
        ORDER BY os.rush_yds DESC
        LIMIT 5
    """), {"tgt": target}).fetchall()

    for r in results:
        py, ry = float(r.pass_yds), float(r.rush_yds)
        sev = 3 if ry >= 700 else 2 if ry >= 400 else 1
        desc = (f"{r.player_name}: {_v(py)} passing yards + {_v(ry)} rushing yards "
                f"— dual-threat QB")
        rows.append(_row(target, r.player_id, r.player_name, r.pos,
                         "passing", "rush_yds", ry, None, None, "versatile", desc, sev))

    return rows


# ── main ──────────────────────────────────────────────────────────────────────

# ── 5. Game-level career highs ───────────────────────────────────────────────

GAME_HIGH_METRICS = [
    # (col, label, min_val)  — min_val keeps garbage backup snaps out
    ("pass_yds", "passing yards",   200),
    ("pass_td",  "passing TDs",       3),
    ("rush_yds", "rushing yards",    80),
    ("rush_td",  "rushing TDs",       2),
    ("rec_yds",  "receiving yards",  80),
    ("rec_td",   "receiving TDs",     2),
]


def detect_game_highs(target: int, conn) -> list[dict]:
    """Flag current-season games where a player exceeded their career single-game best."""
    try:
        conn.execute(text("SELECT 1 FROM weekly_stats LIMIT 1"))
    except Exception:
        print("  weekly_stats table missing — skipping game highs (run load_weekly_stats.py first)")
        return []

    rows = []
    for metric, label, min_val in GAME_HIGH_METRICS:
        results = conn.execute(text(f"""
            WITH career_best AS (
                SELECT player_id, MAX({metric}) AS prev_best
                FROM weekly_stats
                WHERE season < :tgt AND game_type = 'REG' AND {metric} >= :min_val
                GROUP BY player_id
                HAVING COUNT(*) >= 3
            ),
            this_season AS (
                SELECT w.player_id, w.week, w.opponent, w.{metric} AS value,
                       p.player_name, p.pos
                FROM weekly_stats w
                JOIN players p USING (player_id)
                WHERE w.season = :tgt AND w.game_type = 'REG'
                  AND w.{metric} >= :min_val
            )
            SELECT ts.player_id, ts.player_name, ts.pos,
                   ts.week, ts.opponent, ts.value,
                   cb.prev_best
            FROM this_season ts
            LEFT JOIN career_best cb USING (player_id)
            WHERE ts.value > COALESCE(cb.prev_best, :min_val - 1)
            ORDER BY ts.week DESC, ts.value DESC
            LIMIT 30
        """), {"tgt": target, "min_val": min_val}).fetchall()

        for r in results:
            v  = int(r.value)
            pb = int(r.prev_best) if r.prev_best else None
            if pb:
                pct_above = (v - pb) / pb
                sev = 3 if pct_above >= 0.25 else 2 if pct_above >= 0.10 else 1
                desc = (f"{r.player_name} posted {_v(v)} {label} in Week {r.week} "
                        f"vs {r.opponent} — career single-game high (prev. best: {_v(pb)})")
            else:
                sev = 2
                desc = (f"{r.player_name} posted {_v(v)} {label} in Week {r.week} "
                        f"vs {r.opponent} — first career game at this level")
            rows.append(_row(target, r.player_id, r.player_name, r.pos,
                             "game", metric, v, None, pb,
                             "game_high", desc, sev,
                             week=r.week, opponent=r.opponent))
    return rows


# ── 6. Single-game milestones ─────────────────────────────────────────────────

MILESTONES = [
    # (col, threshold, label)
    ("pass_yds", 300, "passing yards in a game"),
    ("pass_td",    4, "TD passes in a game"),
    ("rush_yds", 100, "rushing yards in a game"),
    ("rec_yds",  100, "receiving yards in a game"),
    ("rush_td",    3, "rushing TDs in a game"),
    ("rec_td",     3, "receiving TDs in a game"),
]


def detect_game_milestones(target: int, conn) -> list[dict]:
    """Flag any game this season that crossed a round-number milestone threshold."""
    try:
        conn.execute(text("SELECT 1 FROM weekly_stats LIMIT 1"))
    except Exception:
        return []

    rows = []
    for metric, threshold, label in MILESTONES:
        results = conn.execute(text(f"""
            SELECT w.player_id, w.week, w.opponent, w.{metric} AS value,
                   p.player_name, p.pos
            FROM weekly_stats w
            JOIN players p USING (player_id)
            WHERE w.season = :tgt AND w.game_type = 'REG'
              AND w.{metric} >= :thr
            ORDER BY w.week DESC, w.{metric} DESC
            LIMIT 20
        """), {"tgt": target, "thr": threshold}).fetchall()

        for r in results:
            v   = int(r.value)
            sev = 3 if v >= threshold * 1.5 else 2 if v >= threshold * 1.2 else 1
            desc = (f"{r.player_name} had {_v(v)} {label} in Week {r.week} vs {r.opponent}")
            rows.append(_row(target, r.player_id, r.player_name, r.pos,
                             "game", metric, v, None, None,
                             "game_milestone", desc, sev,
                             week=r.week, opponent=r.opponent))
    return rows


INSERT_SQL = """
    INSERT INTO anomaly_alerts
        (season, player_id, player_name, pos, category, metric,
         value, career_avg, career_high, alert_type, description, severity,
         week, opponent)
    VALUES
        (:season, :player_id, :player_name, :pos, :category, :metric,
         :value, :career_avg, :career_high, :alert_type, :description, :severity,
         :week, :opponent)
"""

if __name__ == "__main__":
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(CREATE_TABLE))
        conn.execute(text(ALTER_TABLE))

        # Latest completed season (has full passing_seasons data)
        row = conn.execute(text(
            "SELECT MAX(season) AS s FROM passing_seasons WHERE att >= 100"
        )).fetchone()
        season_target = int(row.s) if row and row.s else None

        # Latest season with any game data (may be the current in-progress season)
        row2 = conn.execute(text(
            "SELECT MAX(season) AS s FROM weekly_stats WHERE game_type = 'REG'"
        )).fetchone()
        game_target = int(row2.s) if row2 and row2.s else season_target

        if not season_target:
            print("No season data found — skipping.")
            sys.exit(0)

        # ── Season-level anomalies (completed season) ────────────────────────
        print(f"Detecting season anomalies for {season_target}…")
        conn.execute(text("DELETE FROM anomaly_alerts WHERE season = :s AND alert_type NOT IN ('game_high','game_milestone')"), {"s": season_target})

        season_alerts: list[dict] = []
        season_alerts += detect_counting(season_target, conn)
        season_alerts += detect_yoy_surge(season_target, conn)
        season_alerts += detect_efficiency(season_target, conn)
        season_alerts += detect_versatile(season_target, conn)

        if season_alerts:
            conn.execute(text(INSERT_SQL), season_alerts)

        # ── Game-level anomalies (current active season) ─────────────────────
        print(f"Detecting game anomalies for {game_target}…")
        conn.execute(text("DELETE FROM anomaly_alerts WHERE season = :s AND alert_type IN ('game_high','game_milestone')"), {"s": game_target})

        game_alerts: list[dict] = []
        game_alerts += detect_game_highs(game_target, conn)
        game_alerts += detect_game_milestones(game_target, conn)

        if game_alerts:
            conn.execute(text(INSERT_SQL), game_alerts)

        all_alerts = season_alerts + game_alerts
        by_type: dict[str, int] = {}
        for a in all_alerts:
            by_type[a["alert_type"]] = by_type.get(a["alert_type"], 0) + 1

        print(f"\nTotal: {len(all_alerts)} anomaly alerts inserted:")
        for t, n in sorted(by_type.items()):
            print(f"  {t}: {n}")
