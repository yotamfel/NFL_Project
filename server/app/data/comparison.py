"""Data-layer functions for module 2 (player comparison)."""
from sqlalchemy import text

from app.db import engine
from app.data.players import CATEGORIES


def _player_info(conn, player_ids: list[str]) -> list[dict]:
    rows = conn.execute(
        text("SELECT player_id, player_name, pos, fdv FROM players WHERE player_id = ANY(:pids)"),
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
    for p in players:
        row = by_id.get(p["player_id"])
        if row and row.get("team"):
            p["team"] = row["team"]
    seasons_data = [by_id[p["player_id"]] for p in players if p["player_id"] in by_id]
    return {"players": players, "career": seasons_data}


def compare_career_range(player_ids: list[str], category: str, season_from: int, season_to: int) -> dict:
    """Career totals restricted to [season_from, season_to], aggregated from the seasons table."""
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}; must be one of {CATEGORIES}")

    _MAX_COLS = {"lng", "punt_ret_lng", "kick_ret_lng"}
    _SKIP = {"player_id", "season", "player_name", "pos", "age"}

    with engine.connect() as conn:
        players = _player_info(conn, player_ids)
        rows = conn.execute(
            text(f"""
                SELECT s.*, p.player_name, p.pos
                FROM {category}_seasons s
                JOIN players p ON p.player_id = s.player_id
                WHERE s.player_id = ANY(:pids)
                  AND s.season BETWEEN :sfrom AND :sto
            """),
            {"pids": player_ids, "sfrom": season_from, "sto": season_to},
        ).fetchall()

    agg: dict[str, dict] = {}
    teams: dict[str, set] = {}
    for r in rows:
        rd = dict(r._mapping)
        pid = rd["player_id"]
        if pid not in agg:
            agg[pid] = {"player_id": pid, "player_name": rd.get("player_name"), "pos": rd.get("pos")}
            teams[pid] = set()
        if rd.get("team"):
            teams[pid].add(rd["team"].upper())
        for k, v in rd.items():
            if k in _SKIP or k == "team" or v is None:
                continue
            if isinstance(v, (int, float)):
                if k in _MAX_COLS:
                    agg[pid][k] = max(agg[pid].get(k) or 0, v)
                else:
                    agg[pid][k] = (agg[pid].get(k) or 0) + v

    for p in players:
        pid = p["player_id"]
        if pid in teams and teams[pid]:
            p["teams"] = "/".join(sorted(teams[pid]))

    career = [agg[p["player_id"]] for p in players if p["player_id"] in agg]
    return {"players": players, "career": career}
