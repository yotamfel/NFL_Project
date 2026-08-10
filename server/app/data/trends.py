"""Data-layer for league-wide trend aggregation."""
from sqlalchemy import text

from app.db import engine
from app.data.players import _ALLOWED_STATS, _team_codes

_AGG_MAP = {
    "sum":     lambda s: f"ROUND(SUM(s.{s})::numeric, 1)",
    "avg":     lambda s: f"ROUND(AVG(s.{s})::numeric, 2)",
    "per_game": lambda s: f"ROUND((SUM(s.{s})::numeric / NULLIF(SUM(COALESCE(s.g, CASE WHEN s.season >= 2021 THEN 17 WHEN s.season >= 1978 THEN 16 ELSE 14 END)), 0)), 2)",
}

# Derived rate stats (e.g. completion %, yards/attempt) are pre-computed per
# player-season in the source tables, but naively averaging that column treats a
# QB with 3 attempts the same as one with 500 - modern rosters carry many more
# low-volume backups than in past decades, which biases a plain average of the
# per-player rate (verified: unweighted avg(y_per_a) for QBs drifted from -0.16
# below the true rate in 1970 to -0.65 below it by 2025, as backup QB counts grew).
# These stats are instead computed as a volume-weighted ratio (sum of the
# numerator over sum of the denominator across all contributing players), which
# is what "league-wide rate" actually means and matches how these rates are
# computed anywhere else they're reported.
_RATIO_STATS: dict[str, dict[str, tuple[str, str, float]]] = {
    "passing": {
        "cmp_pct": ("cmp", "att", 100.0),
        "int_pct": ("int", "att", 100.0),
        "td_pct":  ("td", "att", 100.0),
        "y_per_a": ("yds", "att", 1.0),
    },
}


def _ratio_expr(category: str, stat: str) -> str | None:
    triple = _RATIO_STATS.get(category, {}).get(stat)
    if not triple:
        return None
    num, den, scale = triple
    scale_sql = f"{scale} * " if scale != 1.0 else ""
    return f"ROUND({scale_sql}SUM(s.{num})::numeric / NULLIF(SUM(s.{den}), 0), 2)"


def get_league_trend(
    category: str,
    stat: str,
    agg: str = "sum",
    pos: str | None = None,
    team: str | None = None,
    season_from: int | None = None,
    season_to: int | None = None,
) -> list[dict]:
    if category not in _ALLOWED_STATS:
        raise ValueError(f"unknown category {category!r}")
    if stat not in _ALLOWED_STATS[category]:
        raise ValueError(f"stat {stat!r} not allowed for category {category!r}")
    if agg not in _AGG_MAP:
        raise ValueError(f"agg must be one of {list(_AGG_MAP)}")

    ratio_expr = _ratio_expr(category, stat)
    agg_expr = ratio_expr or _AGG_MAP[agg](stat)
    null_check = stat if not ratio_expr else _RATIO_STATS[category][stat][1]
    params: dict = {
        "pos": pos,
        "season_from": season_from,
        "season_to": season_to,
    }

    if team:
        params["teams"] = _team_codes(team)
        team_clause = "AND UPPER(s.team) = ANY(:teams)"
    else:
        team_clause = ""

    sql = text(f"""
        SELECT s.season,
               {agg_expr} AS value,
               COUNT(DISTINCT s.player_id) AS player_count
        FROM {category}_seasons s
        JOIN players p ON p.player_id = s.player_id
        WHERE s.{null_check} IS NOT NULL
          AND (:pos IS NULL OR UPPER(p.pos) = UPPER(:pos))
          {team_clause}
          AND (:season_from IS NULL OR s.season >= :season_from)
          AND (:season_to   IS NULL OR s.season <= :season_to)
        GROUP BY s.season
        ORDER BY s.season
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]


# Maps historical/alternate PFR abbreviations to the canonical modern code.
# Allows the by-team view to group all eras of a franchise together.
_CANONICAL_TEAM: dict[str, str] = {
    "NWE": "NE",  "KAN": "KC",  "GNB": "GB",  "NOR": "NO",
    "SFO": "SF",  "TAM": "TB",  "LVR": "LV",  "OAK": "LV",
    "LAR": "LA",  "STL": "LA",  "SDG": "LAC", "CLT": "IND",
    "HTX": "HOU", "JAC": "JAX", "RAI": "LV",  "RAM": "LA",
}

def _canonical_team_sql() -> str:
    """CASE expression that normalises alternate PFR team codes."""
    cases = "\n".join(
        f"    WHEN '{old}' THEN '{new}'"
        for old, new in _CANONICAL_TEAM.items()
    )
    return f"CASE UPPER(s.team)\n{cases}\n    ELSE UPPER(s.team)\nEND"


def get_team_breakdown(
    category: str,
    stat: str,
    agg: str = "sum",
    pos: str | None = None,
    season_from: int | None = None,
    season_to: int | None = None,
) -> list[dict]:
    if category not in _ALLOWED_STATS:
        raise ValueError(f"unknown category {category!r}")
    if stat not in _ALLOWED_STATS[category]:
        raise ValueError(f"stat {stat!r} not allowed for category {category!r}")
    if agg not in _AGG_MAP:
        raise ValueError(f"agg must be one of {list(_AGG_MAP)}")

    ratio_expr = _ratio_expr(category, stat)
    agg_expr = ratio_expr or _AGG_MAP[agg](stat)
    null_check = stat if not ratio_expr else _RATIO_STATS[category][stat][1]
    team_expr = _canonical_team_sql()
    params: dict = {"pos": pos, "season_from": season_from, "season_to": season_to}

    sql = text(f"""
        SELECT ({team_expr}) AS team,
               {agg_expr} AS value,
               COUNT(DISTINCT s.player_id) AS player_count
        FROM {category}_seasons s
        JOIN players p ON p.player_id = s.player_id
        WHERE s.{null_check} IS NOT NULL
          AND s.team IS NOT NULL
          AND UPPER(s.team) NOT IN ('2TM', '3TM', '4TM')
          AND (:pos IS NULL OR UPPER(p.pos) = UPPER(:pos))
          AND (:season_from IS NULL OR s.season >= :season_from)
          AND (:season_to   IS NULL OR s.season <= :season_to)
        GROUP BY ({team_expr})
        ORDER BY value DESC NULLS LAST
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]


def get_trend_season_range(category: str) -> dict:
    sql = text(f"SELECT MIN(season) AS min_s, MAX(season) AS max_s FROM {category}_seasons")
    with engine.connect() as conn:
        row = conn.execute(sql).fetchone()
    return {"min": int(row.min_s), "max": int(row.max_s)}
