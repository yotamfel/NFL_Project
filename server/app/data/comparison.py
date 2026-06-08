"""Data-layer functions for module 2 (player comparison)."""
from sqlalchemy import text

from app.db import engine
from app.data.players import CATEGORIES


def compare_career(player_ids: list[str], category: str) -> list[dict]:
    """
    Career totals for several players in one category, one round trip.
    `category` must be one of CATEGORIES — never build this from raw user
    input, since it's interpolated directly into the table name.
    """
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}; must be one of {CATEGORIES}")

    sql = text(f"SELECT * FROM {category}_career WHERE player_id = ANY(:pids)")
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pids": player_ids}).fetchall()
    return [dict(r._mapping) for r in rows]


def compare_season(player_ids: list[str], category: str, season: int) -> list[dict]:
    """Same idea, but for a single season — for 'how did they each do in 2024' views."""
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}; must be one of {CATEGORIES}")

    sql = text(f"SELECT * FROM {category}_seasons WHERE player_id = ANY(:pids) AND season = :season")
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pids": player_ids, "season": season}).fetchall()
    return [dict(r._mapping) for r in rows]
