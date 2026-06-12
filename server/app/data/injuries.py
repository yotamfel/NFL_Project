"""Data-layer for player injury history."""
from sqlalchemy import text
from app.db import engine

# NFL expanded to 17 games starting in 2021
def _expected_games(season: int) -> int:
    return 17 if season >= 2021 else 16


def get_injury_seasons(player_id: str) -> list[dict]:
    """Per-season injury summary merged with actual games played from stats."""
    injury_sql = text("""
        SELECT
            season,
            COUNT(*) FILTER (WHERE report_status = 'Out' AND game_type = 'REG')          AS games_missed,
            COUNT(*) FILTER (WHERE report_status = 'Doubtful' AND game_type = 'REG')     AS games_doubtful,
            COUNT(*) FILTER (WHERE report_status = 'Questionable' AND game_type = 'REG') AS games_questionable,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT primary_injury) FILTER (
                WHERE primary_injury IS NOT NULL AND primary_injury != ''
            ), NULL) AS injuries
        FROM injuries
        WHERE player_id = :pid
        GROUP BY season
        ORDER BY season
    """)
    # Games actually played — used to catch IR absences not in weekly reports
    stats_sql = text("""
        SELECT season, SUM(g) AS games_played
        FROM stats
        WHERE player_id = :pid AND game_type = 'REG'
        GROUP BY season
        ORDER BY season
    """)
    with engine.connect() as conn:
        injury_rows = conn.execute(injury_sql, {"pid": player_id}).fetchall()
        stats_rows  = conn.execute(stats_sql,  {"pid": player_id}).fetchall()

    injury_map = {}
    for r in injury_rows:
        d = dict(r._mapping)
        d['injuries'] = list(d.get('injuries') or [])
        injury_map[d['season']] = d

    stats_map = {int(r._mapping['season']): int(r._mapping['games_played'] or 0)
                 for r in stats_rows}

    all_seasons = sorted(set(injury_map) | set(stats_map))
    result = []
    for season in all_seasons:
        inj = injury_map.get(season, {})
        gp  = stats_map.get(season)
        exp = _expected_games(season)
        games_missed_approx = max(0, exp - gp) if gp is not None else None

        result.append({
            'season':              season,
            'games_missed':        inj.get('games_missed', 0),
            'games_doubtful':      inj.get('games_doubtful', 0),
            'games_questionable':  inj.get('games_questionable', 0),
            'injuries':            inj.get('injuries', []),
            'games_played':        gp,
            'games_expected':      exp,
            'games_missed_approx': games_missed_approx,
        })
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
