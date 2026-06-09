"""Data-layer functions for module 2 (player comparison)."""
from sqlalchemy import text

from app.db import engine
from app.data.players import CATEGORIES


def _player_info(conn, player_ids: list[str]) -> list[dict]:
    rows = conn.execute(
        text("SELECT player_id, player_name, pos FROM players WHERE player_id = ANY(:pids)"),
        {"pids": player_ids},
    ).fetchall()
    # Preserve the caller's order so the frontend can pair colours with players
    by_id = {r.player_id: dict(r._mapping) for r in rows}
    return [by_id[pid] for pid in player_ids if pid in by_id]


def compare_career(player_ids: list[str], category: str) -> dict:
    """
    Career totals for several players in one category.
    Returns {"players": [{player_id, player_name, pos}, ...],
             "career":  [{...career view columns + player_name}, ...]}
    preserving the caller's order so the frontend can pair colours.
    """
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}; must be one of {CATEGORIES}")

    with engine.connect() as conn:
        players = _player_info(conn, player_ids)
        rows = conn.execute(
            text(f"""
                SELECT c.*, p.player_name, p.pos
                FROM {category}_career c
                JOIN players p ON p.player_id = c.player_id
                WHERE c.player_id = ANY(:pids)
            """),
            {"pids": player_ids},
        ).fetchall()

    by_id = {r.player_id: dict(r._mapping) for r in rows}
    career = [by_id[p["player_id"]] for p in players if p["player_id"] in by_id]
    return {"players": players, "career": career}


def compare_season(player_ids: list[str], category: str, season: int) -> dict:
    """Same shape as compare_career, but for a single season."""
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}; must be one of {CATEGORIES}")

    with engine.connect() as conn:
        players = _player_info(conn, player_ids)
        rows = conn.execute(
            text(f"""
                SELECT s.*, p.player_name, p.pos
                FROM {category}_seasons s
                JOIN players p ON p.player_id = s.player_id
                WHERE s.player_id = ANY(:pids) AND s.season = :season
            """),
            {"pids": player_ids, "season": season},
        ).fetchall()

    by_id = {r.player_id: dict(r._mapping) for r in rows}
    seasons_data = [by_id[p["player_id"]] for p in players if p["player_id"] in by_id]
    return {"players": players, "career": seasons_data}
