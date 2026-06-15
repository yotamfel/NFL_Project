"""
Playoff stats for a player: aggregated from weekly_stats (POST rows), 1999–2025.

weekly_stats covers offense only (passing + rushing + receiving). Defense,
kicking, punting, and returns playoff stats are not available from this source.
"""
from sqlalchemy import text
from app.db import engine

_OFF_CATS = {"passing", "offense"}


def _has_category(conn, player_id: str, category: str) -> bool:
    return bool(conn.execute(
        text(f"SELECT 1 FROM {category}_seasons WHERE player_id = :pid LIMIT 1"),
        {"pid": player_id},
    ).fetchone())


def get_player_playoff_stats(player_id: str) -> list[dict]:
    """
    Return playoff stats per season for a player, shaped like the profile's
    categories list.  Only 'passing' and 'offense' are populated (weekly_stats
    doesn't track defense/kicking/punting/returns).

    Returns [] if no POST game-log rows exist for the player.
    """
    with engine.connect() as conn:
        existing = {cat for cat in _OFF_CATS if _has_category(conn, player_id, cat)}
        if not existing:
            return []

        rows = conn.execute(text("""
            SELECT
                season,
                MAX(team)       AS team,
                COUNT(*)        AS g,
                SUM(pass_att)   AS pass_att,
                SUM(pass_yds)   AS pass_yds,
                SUM(pass_td)    AS pass_td,
                SUM(pass_int)   AS pass_int,
                SUM(rush_att)   AS rush_att,
                SUM(rush_yds)   AS rush_yds,
                SUM(rush_td)    AS rush_td,
                SUM(rec)        AS rec,
                SUM(rec_yds)    AS rec_yds,
                SUM(rec_td)     AS rec_td,
                SUM(targets)    AS tgt
            FROM weekly_stats
            WHERE player_id = :pid AND game_type = 'POST'
            GROUP BY season
            ORDER BY season
        """), {"pid": player_id}).fetchall()

    if not rows:
        return []

    seasons_data = [dict(r._mapping) for r in rows]
    result = []

    # ── Passing ───────────────────────────────────────────────────────────────
    if "passing" in existing:
        pass_seasons = []
        for row in seasons_data:
            if (row.get("pass_att") or 0) == 0:
                continue
            pass_seasons.append({
                "season":   row["season"],
                "team":     row["team"],
                "g":        row["g"],
                "att":      row["pass_att"],
                "yds":      row["pass_yds"],
                "td":       row["pass_td"],
                "int":      row["pass_int"],
                # QBs often rush; include here so the combined view works
                "rush_att": row["rush_att"],
                "rush_yds": row["rush_yds"],
                "rush_td":  row["rush_td"],
            })
        if pass_seasons:
            sum_keys = ["g", "att", "yds", "td", "int", "rush_att", "rush_yds", "rush_td"]
            career = {k: sum((s.get(k) or 0) for s in pass_seasons) for k in sum_keys}
            career["player_id"] = player_id
            result.append({"category": "passing", "seasons": pass_seasons, "career": career})

    # ── Offense (rushing + receiving) ─────────────────────────────────────────
    if "offense" in existing:
        off_seasons = []
        for row in seasons_data:
            if (row.get("rush_att") or 0) + (row.get("rec") or 0) == 0:
                continue
            off_seasons.append({
                "season":   row["season"],
                "team":     row["team"],
                "g":        row["g"],
                "att":      row["rush_att"],
                "rush_yds": row["rush_yds"],
                "rush_td":  row["rush_td"],
                "rec":      row["rec"],
                "rec_yds":  row["rec_yds"],
                "rec_td":   row["rec_td"],
                "tgt":      row["tgt"],
                "yscm":     (row["rush_yds"] or 0) + (row["rec_yds"] or 0),
            })
        if off_seasons:
            sum_keys = ["g", "att", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "tgt", "yscm"]
            career = {k: sum((s.get(k) or 0) for s in off_seasons) for k in sum_keys}
            career["player_id"] = player_id
            result.append({"category": "offense", "seasons": off_seasons, "career": career})

    return result
