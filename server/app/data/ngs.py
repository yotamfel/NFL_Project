"""Read Next Gen Stats from ngs_passing and ngs_rushing tables."""
import sqlalchemy
from app.db import engine


def get_ngs_passing(player_id: str) -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(
            sqlalchemy.text("""
                SELECT season, team,
                       avg_ttt, avg_cay, avg_iay,
                       aggressiveness, cpoe,
                       avg_adot_sticks, max_air_dist
                FROM ngs_passing
                WHERE player_id = :pid
                ORDER BY season
            """),
            {"pid": player_id},
        ).mappings().all()
    return [dict(r) for r in rows]


def get_ngs_rushing(player_id: str) -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(
            sqlalchemy.text("""
                SELECT season, team,
                       efficiency, avg_tlos,
                       ryoe_per_att, rush_pct_oe, pct_8box
                FROM ngs_rushing
                WHERE player_id = :pid
                ORDER BY season
            """),
            {"pid": player_id},
        ).mappings().all()
    return [dict(r) for r in rows]
