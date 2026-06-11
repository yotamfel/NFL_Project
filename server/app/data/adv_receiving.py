"""Data-layer for advanced receiving stats."""
from sqlalchemy import text
from app.db import engine


def get_adv_receiving(player_id: str) -> list[dict]:
    """Per-season advanced receiving stats for one player."""
    sql = text("""
        SELECT season, team,
               adot, ybc_r, yac_r, brk_tkl, drop, drop_pct, tgt_rating,
               avg_sep, avg_cushion, ngs_adot, yac_oe
        FROM adv_receiving
        WHERE player_id = :pid
        ORDER BY season
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"pid": player_id}).fetchall()
    return [dict(r._mapping) for r in rows]
