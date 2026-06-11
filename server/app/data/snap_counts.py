"""Data-layer functions for snap count queries."""
from sqlalchemy import text
from app.db import engine


def get_snap_weeks(player_id: str, season: int) -> list[dict]:
    """Weekly snap counts for one player-season."""
    sql = text("""
        SELECT week, game_type, team, opponent,
               offense_snaps, offense_pct,
               defense_snaps, defense_pct,
               st_snaps,      st_pct
        FROM snap_counts
        WHERE player_id = :pid AND season = :season
        ORDER BY week
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pid": player_id, "season": season}).fetchall()
    return [dict(r._mapping) for r in rows]


def get_snap_seasons(player_id: str) -> list[dict]:
    """Per-season averages (REG games only) — used for the career trend."""
    sql = text("""
        SELECT season,
               ROUND(AVG(offense_pct)::numeric,  3) AS avg_off_pct,
               ROUND(AVG(defense_pct)::numeric,  3) AS avg_def_pct,
               ROUND(AVG(st_pct)::numeric,       3) AS avg_st_pct,
               COUNT(*) AS games
        FROM snap_counts
        WHERE player_id = :pid AND game_type = 'REG'
        GROUP BY season
        ORDER BY season
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pid": player_id}).fetchall()
    return [dict(r._mapping) for r in rows]


def get_snap_available_seasons(player_id: str) -> list[int]:
    """Sorted list of seasons that have snap data for this player."""
    sql = text("""
        SELECT DISTINCT season FROM snap_counts
        WHERE player_id = :pid
        ORDER BY season DESC
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pid": player_id}).fetchall()
    return [r[0] for r in rows]
