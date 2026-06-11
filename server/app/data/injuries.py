"""Data-layer for player injury history."""
from sqlalchemy import text
from app.db import engine


def get_injury_seasons(player_id: str) -> list[dict]:
    """Per-season injury summary: games missed, games limited, injuries list."""
    sql = text("""
        SELECT
            season,
            COUNT(*) FILTER (WHERE report_status = 'Out' AND game_type = 'REG')       AS games_missed,
            COUNT(*) FILTER (WHERE report_status = 'Doubtful' AND game_type = 'REG')  AS games_doubtful,
            COUNT(*) FILTER (WHERE report_status = 'Questionable' AND game_type = 'REG') AS games_questionable,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT primary_injury) FILTER (
                WHERE primary_injury IS NOT NULL AND primary_injury != ''
            ), NULL) AS injuries
        FROM injuries
        WHERE player_id = :pid
        GROUP BY season
        ORDER BY season
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pid": player_id}).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d['injuries'] = list(d.get('injuries') or [])
        result.append(d)
    return result


def get_injury_weeks(player_id: str, season: int) -> list[dict]:
    """Weekly injury entries for one player-season."""
    sql = text("""
        SELECT week, game_type, team, report_status, primary_injury
        FROM injuries
        WHERE player_id = :pid AND season = :season
        ORDER BY week
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pid": player_id, "season": season}).fetchall()
    return [dict(r._mapping) for r in rows]
