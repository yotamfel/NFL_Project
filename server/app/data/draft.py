"""Data-layer functions for module 3 (draft analysis)."""
from sqlalchemy import text

from app.db import engine

# A "steal"/"bust" verdict needs the player to have had enough time to prove
# (or disprove) themselves. Stage 2's exploration found that a naive query
# for low-career_av round-1 picks returned almost entirely 2024-2025 rookies
# — their career_av is low because they've barely played, not because they
# failed. Default to four years (a typical rookie-contract span) before a
# draft class is judged at all. See server/docs/exploration_findings.md.
DEFAULT_MIN_SEASONING_YEARS = 4


def _latest_draft_year(conn) -> int:
    return conn.execute(text("SELECT max(draft_year) FROM draft")).scalar()


def get_draft_picks(team: str | None = None, draft_year: int | None = None,
                     pos: str | None = None, limit: int = 50) -> list[dict]:
    """Draft picks with optional filters — any combination of team/year/position."""
    clauses, params = [], {"limit": limit}
    if team is not None:
        clauses.append("team = :team")
        params["team"] = team
    if draft_year is not None:
        clauses.append("draft_year = :draft_year")
        params["draft_year"] = draft_year
    if pos is not None:
        clauses.append("pos = :pos")
        params["pos"] = pos
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    sql = text(f"""
        SELECT draft_year, round, pick, team, player_name, pos, college,
               career_av, g, player_id
        FROM draft
        {where}
        ORDER BY draft_year DESC, pick
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]


def find_steals(min_round: int = 4, min_career_av: int = 50,
                min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
                limit: int = 20) -> list[dict]:
    """Picks from round `min_round` or later whose career_av beat their slot."""
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT draft_year, round, pick, team, player_name, pos, college,
                   career_av, g, player_id
            FROM draft
            WHERE round >= :min_round AND career_av >= :min_av AND draft_year <= :cutoff
            ORDER BY career_av DESC
            LIMIT :limit
        """)
        rows = conn.execute(sql, {"min_round": min_round, "min_av": min_career_av,
                                  "cutoff": cutoff, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]


def find_busts(max_round: int = 1, max_career_av: int = 15,
               min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS,
               limit: int = 20) -> list[dict]:
    """Picks from round `max_round` or earlier whose career_av fell short of their slot."""
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT draft_year, round, pick, team, player_name, pos, college,
                   career_av, g, player_id
            FROM draft
            WHERE round <= :max_round AND career_av <= :max_av AND draft_year <= :cutoff
            ORDER BY pick, draft_year DESC
            LIMIT :limit
        """)
        rows = conn.execute(sql, {"max_round": max_round, "max_av": max_career_av,
                                  "cutoff": cutoff, "limit": limit}).fetchall()
    return [dict(r._mapping) for r in rows]
