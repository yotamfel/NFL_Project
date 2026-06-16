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


# PFR stores side-specific position tags (LCB, RCB, FS, SS, …).
# Map each variant → canonical position the platform uses.
_POS_NORMALIZE: dict[str, str] = {
    "LCB": "CB", "RCB": "CB", "NCB": "CB", "DB": "CB",
    "FS": "S", "SS": "S",
    "ILB": "LB", "OLB": "LB", "MLB": "LB",
    "LILB": "LB", "RILB": "LB", "ROLB": "LB", "LOLB": "LB",
    "DE": "DL", "DT": "DL", "NT": "DL",
    "T": "OL", "G": "OL", "C": "OL",
    "LT": "OL", "RT": "OL", "LG": "OL", "RG": "OL",
    "OT": "OL", "OG": "OL", "LS": "OL",
}
_POS_EXPAND: dict[str, list[str]] = {
    "CB": ["CB", "LCB", "RCB", "NCB", "DB"],
    "S":  ["S", "FS", "SS"],
    "LB": ["LB", "ILB", "OLB", "MLB", "LILB", "RILB", "ROLB", "LOLB"],
    "DL": ["DL", "DE", "DT", "NT"],
    "OL": ["OL", "T", "G", "C", "LT", "RT", "LG", "RG", "OT", "OG", "LS"],
}


def _normalize_pos(pos: str | None) -> str | None:
    if not pos:
        return pos
    return _POS_NORMALIZE.get(pos.upper(), pos.upper())


def _pos_variants(pos: str | None) -> list[str] | None:
    """All DB-level pos values that map to a canonical pos (for WHERE filtering)."""
    if not pos:
        return None
    up = pos.upper()
    return _POS_EXPAND.get(up, [up])


# Whitelisted stat columns per category — stat is interpolated into SQL after
# this check, so the whitelist is the sole injection guard.
_ALLOWED_STATS: dict[str, frozenset[str]] = {
    "passing": frozenset({
        "yds", "td", "int", "cmp", "att", "sk", "g",
        # advanced
        "rate", "qbr", "y_per_a", "ay_per_a", "ny_per_a", "any_per_a",
        "sk_pct", "_4qc", "gwd", "_1d",
    }),
    "offense": frozenset({
        "rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "yscm", "touch", "att", "g",
        # advanced
        "tgt", "ctch_pct", "y_per_tgt", "y_per_r",
        "rec_first_downs", "rush_first_downs", "fmb",
        "rec_lng", "rush_lng",
    }),
    "defense": frozenset({
        "comb", "solo", "ast", "sk", "int", "pd", "ff", "fr", "g",
        # advanced
        "tfl", "qb_hits", "int_ret_yds", "int_td", "fr_td", "fum_ret_yds", "sfty",
    }),
    "kicking": frozenset({
        "fgm_total", "fga_total", "xpm", "xpa", "g",
        # advanced — by distance
        "fgm_0_19", "fga_0_19", "fgm_20_29", "fga_20_29",
        "fgm_30_39", "fga_30_39", "fgm_40_49", "fga_40_49",
        "fgm_50_plus", "fga_50_plus",
        # kickoffs
        "ko", "koyds", "koavg", "tb", "tb_pct",
    }),
    "punting": frozenset({
        "pnt", "yds", "netyds", "tb", "pnt20", "g",
        # advanced
        "y_per_p", "ny_per_p", "retyds", "blck", "in20_pct",
    }),
    "returns": frozenset({
        "punt_ret", "punt_ret_yds", "punt_ret_td",
        "kick_ret", "kick_ret_yds", "kick_ret_td", "apyd", "g",
        # advanced
        "y_per_punt_ret", "y_per_kick_ret", "punt_ret_lng", "kick_ret_lng",
    }),
}


def popular_players(pos: str | None = None, limit: int = 10) -> list[dict]:
    """Top players by FDV — used for landing-page suggestions."""
    sql = text("""
        SELECT player_id, player_name, pos, first_season, last_season, fdv
        FROM players
        WHERE (:pos IS NULL OR UPPER(pos) = ANY(:pos_variants))
          AND fdv IS NOT NULL
        ORDER BY fdv DESC
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pos": pos, "pos_variants": _pos_variants(pos), "limit": limit}).fetchall()
    return [{**dict(r._mapping), "pos": _normalize_pos(r._mapping.get("pos"))} for r in rows]


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
        WHERE (:pos    IS NULL OR UPPER(p.pos) = ANY(:pos_variants))
          AND (:season IS NULL OR s.season = :season)
          AND s.{stat} IS NOT NULL
        GROUP BY p.player_id, p.player_name, p.pos
        HAVING MAX(s.{stat}) >= :min_val
        ORDER BY best_value DESC
        LIMIT :limit
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"pos": pos, "pos_variants": _pos_variants(pos), "season": season, "min_val": min_val, "limit": limit}).fetchall()
    return [{**dict(r._mapping), "pos": _normalize_pos(r._mapping.get("pos"))} for r in rows]


def search_players(
    query: str,
    limit: int = 10,
    pos: str | None = None,
    season: int | None = None,
    team: str | None = None,
) -> list[Player]:
    params: dict = {"pattern": f"%{query}%", "limit": limit, "pos": pos, "pos_variants": _pos_variants(pos), "season": season, "teams": []}

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
              AND (:pos    IS NULL OR UPPER(p.pos) = ANY(:pos_variants))
              AND (:season IS NULL OR (p.first_season <= :season AND p.last_season >= :season))
            ORDER BY p.last_season DESC NULLS LAST, p.player_name
            LIMIT :limit
        """)
    else:
        sql = text("""
            SELECT player_id, player_name, pos, first_season, last_season, n_seasons
            FROM players
            WHERE player_name ILIKE :pattern
              AND (:pos    IS NULL OR UPPER(pos) = ANY(:pos_variants))
              AND (:season IS NULL OR (first_season <= :season AND last_season >= :season))
            ORDER BY last_season DESC NULLS LAST, player_name
            LIMIT :limit
        """)

    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    players = [Player(**row._mapping) for row in rows]
    for p in players:
        p.pos = _normalize_pos(p.pos)
    return players


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
            text("SELECT player_id, player_name, pos, first_season, last_season, n_seasons, fdv "
                 "FROM players WHERE player_id = :pid"),
            {"pid": player_id},
        ).fetchone()
        if player_row is None:
            return None
        player = Player(**player_row._mapping)
        player.pos = _normalize_pos(player.pos)

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
