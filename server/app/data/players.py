"""Data-layer functions for module 1 (player page): search and full profile."""
from sqlalchemy import text

from app.db import engine
from app.models import CategoryStats, Player, PlayerProfile

# The six box-score categories sharing the *_seasons / *_career pattern
# (see DB_SCHEMA.md §3). Not user input — safe to interpolate into table names.
CATEGORIES = ["passing", "offense", "defense", "kicking", "punting", "returns"]

# PFR changed team abbreviations over time (e.g. NWE→NE, KAN→KC).
# Both old and new codes coexist in the DB, so map each alias to all variants.
_TEAM_ALIASES: dict[str, list[str]] = {
    "NE":  ["NE",  "NWE"],
    "NWE": ["NE",  "NWE"],
    "KC":  ["KC",  "KAN"],
    "KAN": ["KC",  "KAN"],
    "GB":  ["GB",  "GNB"],
    "GNB": ["GB",  "GNB"],
    "NO":  ["NO",  "NOR"],
    "NOR": ["NO",  "NOR"],
    "SF":  ["SF",  "SFO"],
    "SFO": ["SF",  "SFO"],
    "TB":  ["TB",  "TAM"],
    "TAM": ["TB",  "TAM"],
    "LV":  ["LV",  "LVR", "OAK"],
    "LVR": ["LV",  "LVR", "OAK"],
    "OAK": ["LV",  "LVR", "OAK"],
    "LA":  ["LA",  "LAR", "STL"],
    "LAR": ["LA",  "LAR", "STL"],
    "STL": ["LA",  "LAR", "STL"],
    "LAC": ["LAC", "SDG"],
    "SDG": ["LAC", "SDG"],
}


def _team_codes(team: str) -> list[str]:
    return _TEAM_ALIASES.get(team.upper(), [team.upper()])


# Whitelisted stat columns per category — stat is interpolated into SQL after
# this check, so the whitelist is the sole injection guard.
_ALLOWED_STATS: dict[str, frozenset[str]] = {
    "passing": frozenset({"yds", "td", "int", "cmp", "att", "sk", "g"}),
    "offense": frozenset({"rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "yscm", "touch", "att", "g"}),
    "defense": frozenset({"comb", "solo", "ast", "sk", "int", "pd", "ff", "fr", "g"}),
    "kicking": frozenset({"fgm_total", "fga_total", "xpm", "xpa", "g"}),
    "punting": frozenset({"pnt", "yds", "netyds", "tb", "pnt20", "g"}),
    "returns": frozenset({"punt_ret", "punt_ret_yds", "punt_ret_td", "kick_ret", "kick_ret_yds", "kick_ret_td", "apyd", "g"}),
}


def top_players_by_stat(
    category: str,
    stat: str,
    pos: str | None = None,
    season: int | None = None,
    min_val: float = 0,
    limit: int = 20,
) -> list[dict]:
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}")
    if stat not in _ALLOWED_STATS.get(category, frozenset()):
        raise ValueError(f"stat {stat!r} not allowed for category {category!r}")

    sql = text(f"""
        SELECT p.player_id, p.player_name, p.pos,
               MAX(s.{stat}) AS best_value
        FROM {category}_seasons s
        JOIN players p ON p.player_id = s.player_id
        WHERE (:pos    IS NULL OR UPPER(p.pos) = UPPER(:pos))
          AND (:season IS NULL OR s.season = :season)
          AND s.{stat} IS NOT NULL
        GROUP BY p.player_id, p.player_name, p.pos
        HAVING MAX(s.{stat}) >= :min_val
        ORDER BY best_value DESC
        LIMIT :limit
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"pos": pos, "season": season, "min_val": min_val, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]


def search_players(
    query: str,
    limit: int = 10,
    pos: str | None = None,
    season: int | None = None,
    team: str | None = None,
) -> list[Player]:
    params: dict = {"pattern": f"%{query}%", "limit": limit, "pos": pos, "season": season, "teams": []}

    if team:
        # team lives on the *_seasons tables, not on players directly.
        # Use ANY(:teams) to cover all historical abbreviations for the same franchise.
        params["teams"] = _team_codes(team)
        sql = text("""
            WITH team_players AS (
                SELECT DISTINCT player_id FROM passing_seasons WHERE UPPER(team) = ANY(:teams)
                UNION
                SELECT DISTINCT player_id FROM offense_seasons  WHERE UPPER(team) = ANY(:teams)
                UNION
                SELECT DISTINCT player_id FROM defense_seasons  WHERE UPPER(team) = ANY(:teams)
                UNION
                SELECT DISTINCT player_id FROM kicking_seasons  WHERE UPPER(team) = ANY(:teams)
                UNION
                SELECT DISTINCT player_id FROM punting_seasons  WHERE UPPER(team) = ANY(:teams)
                UNION
                SELECT DISTINCT player_id FROM returns_seasons  WHERE UPPER(team) = ANY(:teams)
            )
            SELECT p.player_id, p.player_name, p.pos, p.first_season, p.last_season, p.n_seasons
            FROM players p
            JOIN team_players tp ON tp.player_id = p.player_id
            WHERE p.player_name ILIKE :pattern
              AND (:pos    IS NULL OR UPPER(p.pos) = UPPER(:pos))
              AND (:season IS NULL OR (p.first_season <= :season AND p.last_season >= :season))
            ORDER BY p.last_season DESC NULLS LAST, p.player_name
            LIMIT :limit
        """)
    else:
        sql = text("""
            SELECT player_id, player_name, pos, first_season, last_season, n_seasons
            FROM players
            WHERE player_name ILIKE :pattern
              AND (:pos    IS NULL OR UPPER(pos) = UPPER(:pos))
              AND (:season IS NULL OR (first_season <= :season AND last_season >= :season))
            ORDER BY last_season DESC NULLS LAST, player_name
            LIMIT :limit
        """)

    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [Player(**row._mapping) for row in rows]


def _category_stats(conn, player_id: str, category: str) -> CategoryStats | None:
    """
    A player only "has" a category if they have *_seasons rows — e.g. an
    offensive lineman will have a defense_career row of all-zeroes-or-null
    from the aggregation, not because they ever played defense. Returning
    None here (and filtering it out) keeps a profile from listing six
    categories when a player meaningfully appears in two.
    """
    seasons = conn.execute(
        text(f"SELECT * FROM {category}_seasons WHERE player_id = :pid ORDER BY season"),
        {"pid": player_id},
    ).fetchall()
    if not seasons:
        return None
    career_row = conn.execute(
        text(f"SELECT * FROM {category}_career WHERE player_id = :pid"),
        {"pid": player_id},
    ).fetchone()
    return CategoryStats(
        category=category,
        seasons=[dict(r._mapping) for r in seasons],
        career=dict(career_row._mapping) if career_row else None,
    )


def get_player_profile(player_id: str) -> PlayerProfile | None:
    """
    Full profile for one player: identity, every category they actually
    appear in, and their draft/combine record if one exists. Both of the
    latter are commonly absent — undrafted players have no `draft` row,
    and not every draftee attended (or was tracked at) the combine — so
    both are Optional and the caller must handle None.
    """
    with engine.connect() as conn:
        player_row = conn.execute(
            text("SELECT player_id, player_name, pos, first_season, last_season, n_seasons "
                 "FROM players WHERE player_id = :pid"),
            {"pid": player_id},
        ).fetchone()
        if player_row is None:
            return None
        player = Player(**player_row._mapping)

        categories = [
            stats for stats in (_category_stats(conn, player_id, cat) for cat in CATEGORIES)
            if stats is not None
        ]

        draft_row = conn.execute(
            text("SELECT * FROM draft WHERE player_id = :pid ORDER BY draft_year DESC LIMIT 1"),
            {"pid": player_id},
        ).fetchone()

        combine_row = conn.execute(
            text("SELECT * FROM combine_seasons WHERE player_id = :pid ORDER BY season DESC LIMIT 1"),
            {"pid": player_id},
        ).fetchone()

    return PlayerProfile(
        player=player,
        categories=categories,
        draft=dict(draft_row._mapping) if draft_row else None,
        combine=dict(combine_row._mapping) if combine_row else None,
    )
