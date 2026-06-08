"""Data-layer functions for module 1 (player page): search and full profile."""
from sqlalchemy import text

from app.db import engine
from app.models import CategoryStats, Player, PlayerProfile

# The six box-score categories sharing the *_seasons / *_career pattern
# (see DB_SCHEMA.md §3). Not user input — safe to interpolate into table names.
CATEGORIES = ["passing", "offense", "defense", "kicking", "punting", "returns"]


def search_players(query: str, limit: int = 10) -> list[Player]:
    sql = text("""
        SELECT player_id, player_name, pos, first_season, last_season, n_seasons
        FROM players
        WHERE player_name ILIKE :pattern
        ORDER BY last_season DESC NULLS LAST, player_name
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pattern": f"%{query}%", "limit": limit}).fetchall()
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
