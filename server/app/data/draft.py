"""Data-layer functions for module 3 (draft analysis)."""
from sqlalchemy import text

from app.db import engine

# Allowed stat columns per stat category — column name is interpolated into SQL
# after this whitelist check, so this is the sole injection guard.
_STAT_WHITELIST: dict[str, frozenset[str]] = {
    "passing": frozenset({"yds", "td", "int", "cmp", "att", "sk", "g"}),
    "offense": frozenset({"rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "yscm", "touch", "att", "g"}),
    "defense": frozenset({"comb", "solo", "ast", "sk", "int", "pd", "ff", "fr", "g"}),
    "kicking": frozenset({"fgm_total", "fga_total", "xpm", "xpa", "g"}),
    "punting": frozenset({"pnt", "yds", "netyds", "tb", "pnt20", "g"}),
    "returns": frozenset({"punt_ret", "punt_ret_yds", "punt_ret_td", "kick_ret",
                          "kick_ret_yds", "kick_ret_td", "apyd", "g"}),
}

# A "steal"/"bust" verdict needs the player to have had enough time to prove
# (or disprove) themselves. Stage 2's exploration found that a naive query
# for low-career_av round-1 picks returned almost entirely 2024-2025 rookies
# — their career_av is low because they've barely played, not because they
# failed. Default to four years (a typical rookie-contract span) before a
# draft class is judged at all. See server/docs/exploration_findings.md.
DEFAULT_MIN_SEASONING_YEARS = 4


def _latest_draft_year(conn) -> int:
    return conn.execute(text("SELECT max(draft_year) FROM draft")).scalar()


def get_draft_picks(team: str | None = None, draft_year: int | None = None,
                     pos: str | None = None, limit: int = 50) -> list[dict]:
    """Draft picks with optional filters — any combination of team/year/position."""
    clauses, params = [], {"limit": limit}
    if team is not None:
        clauses.append("team = :team")
        params["team"] = team
    if draft_year is not None:
        clauses.append("draft_year = :draft_year")
        params["draft_year"] = draft_year
    if pos is not None:
        clauses.append("pos = :pos")
        params["pos"] = pos
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    sql = text(f"""
        SELECT draft_year, round, pick, team, player_name, pos, college,
               career_av, g, player_id
        FROM draft
        {where}
        ORDER BY draft_year DESC, pick
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]


def get_custom_draft_rank(
    round_val: int,
    round_op: str,          # "gte" (round >=) or "lte" (round <=)
    stat_val: float,
    stat_op: str,           # "gte" (stat >=) or "lte" (stat <=)
    category: str = "career_av",
    stat: str | None = None,
    scope: str = "career",  # "career" or "season" (best single season)
    pos: str | None = None,
    min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
    limit: int = 50,
) -> list[dict]:
    if round_op not in ("gte", "lte"):
        raise ValueError("round_op must be 'gte' or 'lte'")
    if stat_op not in ("gte", "lte"):
        raise ValueError("stat_op must be 'gte' or 'lte'")
    if scope not in ("career", "season"):
        raise ValueError("scope must be 'career' or 'season'")

    round_sql = ">=" if round_op == "gte" else "<="
    stat_sql  = ">=" if stat_op  == "gte" else "<="
    order     = "DESC" if stat_op == "gte" else "ASC"
    params    = {"round_val": round_val, "stat_val": stat_val,
                 "pos": pos, "limit": limit}

    with engine.connect() as conn:
        params["cutoff"] = _latest_draft_year(conn) - min_seasoning_years

        if category == "career_av":
            sql = text(f"""
                SELECT d.draft_year, d.round, d.pick, d.player_name, d.pos, d.team,
                       d.career_av, d.career_av AS stat_value
                FROM draft d
                WHERE d.round {round_sql} :round_val
                  AND d.career_av IS NOT NULL
                  AND d.career_av {stat_sql} :stat_val
                  AND d.draft_year <= :cutoff
                  AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                ORDER BY stat_value {order}
                LIMIT :limit
            """)
        else:
            valid = _STAT_WHITELIST.get(category, frozenset())
            if not stat or stat not in valid:
                raise ValueError(f"stat {stat!r} not allowed for category {category!r}")

            if scope == "career":
                sql = text(f"""
                    SELECT d.draft_year, d.round, d.pick, d.player_name, d.pos, d.team,
                           d.career_av, c.{stat} AS stat_value
                    FROM draft d
                    JOIN {category}_career c ON c.player_id = d.player_id
                    WHERE d.round {round_sql} :round_val
                      AND c.{stat} IS NOT NULL
                      AND c.{stat} {stat_sql} :stat_val
                      AND d.draft_year <= :cutoff
                      AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                    ORDER BY stat_value {order}
                    LIMIT :limit
                """)
            else:
                sql = text(f"""
                    SELECT d.draft_year, d.round, d.pick, d.player_name, d.pos, d.team,
                           d.career_av, MAX(s.{stat}) AS stat_value
                    FROM draft d
                    JOIN {category}_seasons s ON s.player_id = d.player_id
                    WHERE d.round {round_sql} :round_val
                      AND d.draft_year <= :cutoff
                      AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                    GROUP BY d.draft_year, d.round, d.pick, d.player_name,
                             d.pos, d.team, d.career_av
                    HAVING MAX(s.{stat}) IS NOT NULL
                       AND MAX(s.{stat}) {stat_sql} :stat_val
                    ORDER BY stat_value {order}
                    LIMIT :limit
                """)

        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]


def find_steals(min_round: int = 4, min_career_av: int = 50,
                min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
                limit: int = 20) -> list[dict]:
    """Picks from round `min_round` or later whose career_av beat their slot."""
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT draft_year, round, pick, team, player_name, pos, college,
                   career_av, g, player_id
            FROM draft
            WHERE round >= :min_round AND career_av >= :min_av AND draft_year <= :cutoff
            ORDER BY career_av DESC
            LIMIT :limit
        """)
        rows = conn.execute(sql, {"min_round": min_round, "min_av": min_career_av,
                                  "cutoff": cutoff, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]


def find_busts(max_round: int = 1, max_career_av: int = 15,
               min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
               limit: int = 20) -> list[dict]:
    """Picks from round `max_round` or earlier whose career_av fell short of their slot."""
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT draft_year, round, pick, team, player_name, pos, college,
                   career_av, g, player_id
            FROM draft
            WHERE round <= :max_round AND career_av <= :max_av AND draft_year <= :cutoff
            ORDER BY pick, draft_year DESC
            LIMIT :limit
        """)
        rows = conn.execute(sql, {"max_round": max_round, "max_av": max_career_av,
                                  "cutoff": cutoff, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]
