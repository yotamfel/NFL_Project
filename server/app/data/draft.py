"""Data-layer functions for module 3 (draft analysis).

FDV (Fourth & Data Value) is our proprietary career-value metric stored in
players.fdv.  Every query that previously used draft.career_av now JOINs
the players table and uses p.fdv instead.
"""
from sqlalchemy import text

from app.db import engine

# Allowed stat columns per stat category — column name is interpolated into SQL
# after this whitelist check, so this is the sole injection guard.
_STAT_WHITELIST: dict[str, frozenset[str]] = {
    "passing": frozenset({
        "yds", "td", "int", "cmp", "att", "sk", "g",
        "rate", "qbr", "y_per_a", "ay_per_a", "ny_per_a", "any_per_a",
        "sk_pct", "_4qc", "gwd",
    }),
    "offense": frozenset({
        "rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "yscm", "touch", "att", "g",
        "tgt", "ctch_pct", "y_per_tgt", "y_per_r",
        "rec_first_downs", "rush_first_downs", "fmb",
    }),
    "defense": frozenset({
        "comb", "solo", "ast", "sk", "int", "pd", "ff", "fr", "g",
        "tfl", "qb_hits", "int_ret_yds", "int_td", "fr_td", "sfty",
    }),
    "kicking": frozenset({
        "fgm_total", "fga_total", "xpm", "xpa", "g",
        "fgm_40_49", "fga_40_49", "fgm_50_plus", "fga_50_plus",
        "ko", "koyds", "koavg", "tb", "tb_pct",
    }),
    "punting": frozenset({
        "pnt", "yds", "netyds", "tb", "pnt20", "g",
        "y_per_p", "ny_per_p", "retyds", "blck", "in20_pct",
    }),
    "returns": frozenset({
        "punt_ret", "punt_ret_yds", "punt_ret_td",
        "kick_ret", "kick_ret_yds", "kick_ret_td", "apyd", "g",
        "y_per_punt_ret", "y_per_kick_ret",
    }),
}

DEFAULT_MIN_SEASONING_YEARS = 4
DEFAULT_MIN_GAMES_CAREER    = 16   # one full NFL season — filters "cup of coffee" careers


def _latest_draft_year(conn) -> int:
    return conn.execute(text("SELECT max(draft_year) FROM draft")).scalar()


def get_draft_picks(team: str | None = None, draft_year: int | None = None,
                     pos: str | None = None, limit: int = 50) -> list[dict]:
    """Draft picks with optional filters — any combination of team/year/position."""
    clauses, params = [], {"limit": limit}
    if team is not None:
        clauses.append("d.team = :team")
        params["team"] = team
    if draft_year is not None:
        clauses.append("d.draft_year = :draft_year")
        params["draft_year"] = draft_year
    if pos is not None:
        clauses.append("d.pos = :pos")
        params["pos"] = pos
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    sql = text(f"""
        SELECT d.draft_year, d.round, d.pick, d.team, d.player_name, d.pos, d.college,
               p.fdv, d.g, d.player_id
        FROM draft d
        LEFT JOIN players p ON p.player_id = d.player_id
        {where}
        ORDER BY d.draft_year DESC, d.pick
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
    category: str = "fdv",
    stat: str | None = None,
    scope: str = "career",  # "career" or "season" (best single season)
    pos: str | None = None,
    draft_year_from: int | None = None,
    draft_year_to: int | None = None,
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
                 "pos": pos, "limit": limit,
                 "year_from": draft_year_from, "year_to": draft_year_to}

    with engine.connect() as conn:
        params["cutoff"] = _latest_draft_year(conn) - min_seasoning_years

        if category == "fdv":
            sql = text(f"""
                SELECT d.draft_year, d.round, d.pick, d.player_name, d.pos, d.team,
                       p.fdv, p.fdv AS stat_value
                FROM draft d
                LEFT JOIN players p ON p.player_id = d.player_id
                WHERE d.round {round_sql} :round_val
                  AND p.fdv IS NOT NULL
                  AND p.fdv {stat_sql} :stat_val
                  AND d.draft_year <= :cutoff
                  AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                  AND (:year_from IS NULL OR d.draft_year >= :year_from)
                  AND (:year_to   IS NULL OR d.draft_year <= :year_to)
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
                           p.fdv, c.{stat} AS stat_value
                    FROM draft d
                    LEFT JOIN players p ON p.player_id = d.player_id
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
                           p.fdv, MAX(s.{stat}) AS stat_value
                    FROM draft d
                    LEFT JOIN players p ON p.player_id = d.player_id
                    JOIN {category}_seasons s ON s.player_id = d.player_id
                    WHERE d.round {round_sql} :round_val
                      AND d.draft_year <= :cutoff
                      AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                    GROUP BY d.draft_year, d.round, d.pick, d.player_name,
                             d.pos, d.team, p.fdv
                    HAVING MAX(s.{stat}) IS NOT NULL
                       AND MAX(s.{stat}) {stat_sql} :stat_val
                    ORDER BY stat_value {order}
                    LIMIT :limit
                """)

        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]


def get_draft_round_stats(
    round_val: int,
    round_op: str,            # "gte" or "lte"
    category: str = "fdv",
    stat: str | None = None,
    scope: str = "career",    # "career" | "season"
    pos: str | None = None,
    min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
    draft_year_from: int | None = None,
    draft_year_to: int | None = None,
) -> dict:
    """Percentile distribution of a stat for a round/position cohort."""
    if round_op not in ("gte", "lte"):
        raise ValueError("round_op must be 'gte' or 'lte'")
    if scope not in ("career", "season"):
        raise ValueError("scope must be 'career' or 'season'")

    round_sql = ">=" if round_op == "gte" else "<="
    params: dict = {"round_val": round_val, "pos": pos, "year_from": draft_year_from, "year_to": draft_year_to}

    with engine.connect() as conn:
        params["cutoff"] = _latest_draft_year(conn) - min_seasoning_years

        if category == "fdv":
            sql = text(f"""
                SELECT
                    COUNT(*) AS count,
                    ROUND(AVG(p.fdv)::numeric, 1) AS avg,
                    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY p.fdv)::numeric, 0) AS p25,
                    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY p.fdv)::numeric, 0) AS p50,
                    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY p.fdv)::numeric, 0) AS p75,
                    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY p.fdv)::numeric, 0) AS p90
                FROM draft d
                LEFT JOIN players p ON p.player_id = d.player_id
                WHERE d.round {round_sql} :round_val
                  AND p.fdv IS NOT NULL AND p.fdv > 0
                  AND d.draft_year <= :cutoff
                  AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                  AND (:year_from IS NULL OR d.draft_year >= :year_from)
                  AND (:year_to   IS NULL OR d.draft_year <= :year_to)
            """)
        else:
            valid = _STAT_WHITELIST.get(category, frozenset())
            if not stat or stat not in valid:
                raise ValueError(f"stat {stat!r} not allowed for category {category!r}")

            if scope == "career":
                params["min_games"] = DEFAULT_MIN_GAMES_CAREER
                sql = text(f"""
                    SELECT
                        COUNT(*) AS count,
                        ROUND(AVG(c.{stat})::numeric, 1)                                              AS avg,
                        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.{stat})::numeric, 1)    AS p25,
                        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY c.{stat})::numeric, 1)    AS p50,
                        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.{stat})::numeric, 1)    AS p75,
                        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY c.{stat})::numeric, 1)    AS p90,
                        ROUND(AVG(c.{stat}::numeric / c.g)::numeric, 2)                              AS avg_pg,
                        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.{stat}::numeric / c.g)::numeric, 2) AS p25_pg,
                        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY c.{stat}::numeric / c.g)::numeric, 2) AS p50_pg,
                        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.{stat}::numeric / c.g)::numeric, 2) AS p75_pg,
                        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY c.{stat}::numeric / c.g)::numeric, 2) AS p90_pg
                    FROM draft d
                    JOIN {category}_career c ON c.player_id = d.player_id
                    WHERE d.round {round_sql} :round_val
                      AND c.{stat} IS NOT NULL AND c.{stat} > 0
                      AND c.g >= :min_games
                      AND d.draft_year <= :cutoff
                      AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                      AND (:year_from IS NULL OR d.draft_year >= :year_from)
                      AND (:year_to   IS NULL OR d.draft_year <= :year_to)
                """)
            else:
                sql = text(f"""
                    SELECT
                        COUNT(*) AS count,
                        ROUND(AVG(best_stat)::numeric, 1) AS avg,
                        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY best_stat)::numeric, 1) AS p25,
                        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY best_stat)::numeric, 1) AS p50,
                        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY best_stat)::numeric, 1) AS p75,
                        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY best_stat)::numeric, 1) AS p90
                    FROM (
                        SELECT d.player_id, MAX(s.{stat}) AS best_stat
                        FROM draft d
                        JOIN {category}_seasons s ON s.player_id = d.player_id
                        WHERE d.round {round_sql} :round_val
                          AND d.draft_year <= :cutoff
                          AND (:pos IS NULL OR UPPER(d.pos) = UPPER(:pos))
                          AND (:year_from IS NULL OR d.draft_year >= :year_from)
                          AND (:year_to   IS NULL OR d.draft_year <= :year_to)
                        GROUP BY d.player_id
                    ) sub
                    WHERE best_stat IS NOT NULL AND best_stat > 0
                """)

        row = conn.execute(sql, params).fetchone()

    if row is None:
        return {"count": 0}
    return dict(row._mapping)


_VALID_CATEGORIES = frozenset(["fdv", "passing", "offense", "defense", "kicking", "punting", "returns"])


def get_combined_draft(
    criteria: list[dict],
    round_val: int,
    round_op: str,           # "gte" or "lte"
    pos: str,
    draft_year_from: int | None = None,
    draft_year_to: int | None = None,
    limit: int = 100,
    min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
) -> list[dict]:
    """Return players matching ALL criteria (AND-joined) for a given round/position."""
    if round_op not in ("gte", "lte"):
        raise ValueError("round_op must be 'gte' or 'lte'")
    if not criteria:
        raise ValueError("at least one criterion required")
    if not pos:
        raise ValueError("pos is required for combined queries")

    round_sql = ">=" if round_op == "gte" else "<="
    order = "DESC" if round_op == "gte" else "ASC"

    params: dict = {
        "round_val": round_val, "pos": pos,
        "year_from": draft_year_from, "year_to": draft_year_to, "limit": limit,
    }

    extra_select: list[str] = []
    extra_where:  list[str] = []

    for i, crit in enumerate(criteria):
        cat      = crit["category"]
        stat     = crit.get("stat")
        scope    = crit.get("scope", "career")
        stat_val = crit["stat_val"]
        stat_op_sql = ">=" if crit.get("stat_op", "gte") == "gte" else "<="

        if cat not in _VALID_CATEGORIES:
            raise ValueError(f"invalid category {cat!r}")

        val_key = f"crit_{i}_val"
        params[val_key] = stat_val

        if cat == "fdv":
            extra_where.append(f"AND p.fdv {stat_op_sql} :{val_key}")
        else:
            valid_stats = _STAT_WHITELIST.get(cat, frozenset())
            if not stat or stat not in valid_stats:
                raise ValueError(f"stat {stat!r} not allowed for category {cat!r}")
            if scope == "career":
                sub = f"(SELECT c.{stat} FROM {cat}_career c WHERE c.player_id = d.player_id)"
            else:
                sub = f"(SELECT MAX(s.{stat}) FROM {cat}_seasons s WHERE s.player_id = d.player_id)"
            extra_select.append(f"{sub} AS crit_{i}_value")
            extra_where.append(f"AND ({sub}) {stat_op_sql} :{val_key}")

    select_extra = (",\n               " + ",\n               ".join(extra_select)) if extra_select else ""
    where_extra  = "\n          ".join(extra_where)

    sql = text(f"""
        SELECT d.draft_year, d.round, d.pick, d.player_name, d.pos, d.team,
               p.fdv, d.player_id
               {select_extra}
        FROM draft d
        LEFT JOIN players p ON p.player_id = d.player_id
        WHERE d.round {round_sql} :round_val
          AND UPPER(d.pos) = UPPER(:pos)
          AND p.fdv IS NOT NULL
          AND d.draft_year <= :cutoff
          AND (:year_from IS NULL OR d.draft_year >= :year_from)
          AND (:year_to   IS NULL OR d.draft_year <= :year_to)
          {where_extra}
        ORDER BY p.fdv {order}
        LIMIT :limit
    """)

    with engine.connect() as conn:
        params["cutoff"] = _latest_draft_year(conn) - min_seasoning_years
        rows = conn.execute(sql, params).fetchall()

    return [dict(r._mapping) for r in rows]


def find_steals(min_round: int = 4, min_fdv: float = 40,
                min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
                limit: int = 20) -> list[dict]:
    """Picks from round `min_round` or later whose FDV beat their draft slot."""
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT d.draft_year, d.round, d.pick, d.team, d.player_name, d.pos, d.college,
                   p.fdv, d.g, d.player_id
            FROM draft d
            LEFT JOIN players p ON p.player_id = d.player_id
            WHERE d.round >= :min_round AND p.fdv >= :min_fdv AND d.draft_year <= :cutoff
            ORDER BY p.fdv DESC
            LIMIT :limit
        """)
        rows = conn.execute(sql, {"min_round": min_round, "min_fdv": min_fdv,
                                  "cutoff": cutoff, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]


def find_busts(max_round: int = 1, max_fdv: float = 20,
               min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
               limit: int = 20) -> list[dict]:
    """Picks from round `max_round` or earlier whose FDV fell short of their slot."""
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT d.draft_year, d.round, d.pick, d.team, d.player_name, d.pos, d.college,
                   p.fdv, d.g, d.player_id
            FROM draft d
            LEFT JOIN players p ON p.player_id = d.player_id
            WHERE d.round <= :max_round AND p.fdv <= :max_fdv AND d.draft_year <= :cutoff
            ORDER BY d.pick, d.draft_year DESC
            LIMIT :limit
        """)
        rows = conn.execute(sql, {"max_round": max_round, "max_fdv": max_fdv,
                                  "cutoff": cutoff, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]
