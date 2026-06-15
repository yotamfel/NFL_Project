"""
Playoff stats for a player: aggregated from weekly_stats (POST rows), 1999–2025.

weekly_stats covers offense only (passing + rushing + receiving). Defense,
kicking, punting, and returns playoff stats are not available from this source.
"""
from sqlalchemy import text
from app.db import engine

_OFF_CATS = {"passing", "offense"}


def _passer_rating(cmp, att, yds, td, int_) -> float | None:
    if not att:
        return None
    def _clamp(x): return max(0.0, min(x, 2.375))
    a = _clamp((cmp / att - 0.3) * 5)
    b = _clamp((yds / att - 3)   * 0.25)
    c = _clamp((td / att)         * 20)
    d = _clamp(2.375 - (int_ / att) * 25)
    return round((a + b + c + d) / 6 * 100, 1)


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
                MAX(team)           AS team,
                COUNT(*)            AS g,
                SUM(pass_cmp)       AS pass_cmp,
                SUM(pass_att)       AS pass_att,
                SUM(pass_yds)       AS pass_yds,
                SUM(pass_td)        AS pass_td,
                SUM(pass_int)       AS pass_int,
                SUM(sk)             AS sk,
                SUM(sack_yds_lost)  AS sack_yds_lost,
                SUM(rush_att)       AS rush_att,
                SUM(rush_yds)       AS rush_yds,
                SUM(rush_td)        AS rush_td,
                SUM(rec)            AS rec,
                SUM(rec_yds)        AS rec_yds,
                SUM(rec_td)         AS rec_td,
                SUM(targets)        AS tgt
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
            att = row.get("pass_att") or 0
            if att == 0:
                continue
            cmp  = row.get("pass_cmp") or 0
            yds  = row.get("pass_yds") or 0
            td   = row.get("pass_td")  or 0
            int_ = row.get("pass_int") or 0
            sk   = row.get("sk")       or 0
            sk_y = row.get("sack_yds_lost") or 0
            sk_att = att + sk
            pass_seasons.append({
                "season":        row["season"],
                "team":          row["team"],
                "g":             row["g"],
                "cmp":           cmp or None,
                "att":           att,
                "yds":           yds,
                "td":            td,
                "int":           int_,
                "sk":            sk or None,
                "sack_yds_lost": sk_y or None,
                "y_per_a":   round(yds / att, 1)                                       if att else None,
                "ay_per_a":  round((yds + 20*td - 45*int_) / att, 1)                   if att else None,
                "ny_per_a":  round((yds - sk_y) / sk_att, 2)                           if sk_att else None,
                "any_per_a": round((yds - sk_y + 20*td - 45*int_) / sk_att, 2)         if sk_att else None,
                "sk_pct":    round(100 * sk / sk_att, 1)                                if sk_att else None,
                "rate":      _passer_rating(cmp, att, yds, td, int_)                    if cmp and att else None,
                # QBs often rush; include so the combined view works
                "rush_att":  row.get("rush_att"),
                "rush_yds":  row.get("rush_yds"),
                "rush_td":   row.get("rush_td"),
            })
        if pass_seasons:
            sum_keys = ["g", "cmp", "att", "yds", "td", "int", "sk", "sack_yds_lost",
                        "rush_att", "rush_yds", "rush_td"]
            career = {k: sum((s.get(k) or 0) for s in pass_seasons) for k in sum_keys}
            c_att   = career["att"]
            c_cmp   = career["cmp"]
            c_yds   = career["yds"]
            c_td    = career["td"]
            c_int   = career["int"]
            c_sk    = career["sk"]
            c_sky   = career["sack_yds_lost"]
            c_sk_att = c_att + c_sk
            career["y_per_a"]   = round(c_yds / c_att, 1)                                    if c_att else None
            career["ay_per_a"]  = round((c_yds + 20*c_td - 45*c_int) / c_att, 1)             if c_att else None
            career["ny_per_a"]  = round((c_yds - c_sky) / c_sk_att, 2)                       if c_sk_att else None
            career["any_per_a"] = round((c_yds - c_sky + 20*c_td - 45*c_int) / c_sk_att, 2)  if c_sk_att else None
            career["sk_pct"]    = round(100 * c_sk / c_sk_att, 1)                             if c_sk_att else None
            career["rate"]      = _passer_rating(c_cmp, c_att, c_yds, c_td, c_int)           if c_cmp and c_att else None
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
