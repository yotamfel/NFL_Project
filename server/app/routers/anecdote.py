"""Anecdote Generator - AI-powered NFL fact finder for social media content."""
import json
import time

from anthropic import Anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from typing import Optional

from app.auth import require_admin
from app.config import ANTHROPIC_API_KEY
from app.db import engine
from app.ai_log import log_query

router = APIRouter(prefix="/anecdote", tags=["anecdote"])

MODEL = "claude-sonnet-4-6"


class AnecdoteRequest(BaseModel):
    query: str
    level: str = "casual"


class TranslateRequest(BaseModel):
    text: str


class SaveAnecdoteRequest(BaseModel):
    query: str
    text: str
    level: str
    language: str = "en"


def _gather_context(query: str) -> str:
    """Search the DB for data relevant to the query and return as context string."""
    ctx_parts = []
    q_lower = query.lower()

    with engine.connect() as c:
        # Search players by name
        players = c.execute(text("""
            SELECT player_id, player_name, pos, first_season, last_season, n_seasons, fdv
            FROM players
            WHERE LOWER(player_name) LIKE :q
            ORDER BY fdv DESC NULLS LAST LIMIT 5
        """), {"q": f"%{q_lower}%"}).fetchall()

        if players:
            for p in players:
                ctx_parts.append(f"Player: {p.player_name} ({p.pos}), seasons {p.first_season}-{p.last_season} ({p.n_seasons} seasons), FDV: {p.fdv or 'N/A'}")

                # Career stats
                for table in ["passing_seasons", "offense_seasons", "defense_seasons", "kicking_seasons"]:
                    try:
                        stats = c.execute(text(f"""
                            SELECT * FROM {table} WHERE player_id = :pid ORDER BY season DESC LIMIT 5
                        """), {"pid": p.player_id}).fetchall()
                        if stats:
                            cols = stats[0]._mapping.keys()
                            for s in stats:
                                vals = {k: v for k, v in s._mapping.items() if v is not None and k not in ('player_id',)}
                                ctx_parts.append(f"  {table} {vals.get('season', '?')}: {json.dumps({k: str(v) for k, v in vals.items()}, default=str)[:500]}")
                    except Exception:
                        pass

                # Draft info
                draft = c.execute(text("SELECT * FROM draft WHERE player_id = :pid"), {"pid": p.player_id}).fetchone()
                if draft:
                    d = dict(draft._mapping)
                    ctx_parts.append(f"  Draft: Round {d.get('round')}, Pick {d.get('pick')}, {d.get('draft_year')}, {d.get('team')}")

                # PBP summary if available
                try:
                    gsis = c.execute(text("SELECT gsis_id FROM players WHERE player_id = :pid"), {"pid": p.player_id}).scalar()
                    if gsis:
                        for id_col, label in [("passer_player_id", "passing"), ("rusher_player_id", "rushing"), ("receiver_player_id", "receiving")]:
                            pbp = c.execute(text(f"""
                                SELECT season, COUNT(*) as plays, ROUND(AVG(epa)::numeric, 3) as epa,
                                       ROUND(AVG(yards_gained)::numeric, 1) as avg_yards,
                                       SUM(CASE WHEN touchdown=1 THEN 1 ELSE 0 END) as tds
                                FROM pbp WHERE {id_col} = :gsis AND epa IS NOT NULL
                                GROUP BY season ORDER BY season DESC LIMIT 4
                            """), {"gsis": gsis}).fetchall()
                            if pbp:
                                for r in pbp:
                                    ctx_parts.append(f"  PBP {label} {r.season}: {r.plays} plays, EPA {r.epa}, avg {r.avg_yards}y, {r.tds} TDs")
                except Exception:
                    pass

        # Search for team-related data
        teams = c.execute(text("""
            SELECT DISTINCT posteam FROM pbp WHERE LOWER(posteam) LIKE :q LIMIT 3
        """), {"q": f"%{q_lower}%"}).fetchall()
        if teams:
            for t in teams:
                team_stats = c.execute(text("""
                    SELECT season, COUNT(*) as plays, ROUND(AVG(epa)::numeric, 3) as epa
                    FROM pbp WHERE posteam = :team AND epa IS NOT NULL AND play_type IN ('pass','run')
                    GROUP BY season ORDER BY season DESC LIMIT 4
                """), {"team": t.posteam}).fetchall()
                for s in team_stats:
                    ctx_parts.append(f"Team {t.posteam} {s.season}: {s.plays} plays, EPA {s.epa}")

        # General league stats for context
        league = c.execute(text("""
            SELECT season, COUNT(*) as plays, ROUND(AVG(epa)::numeric, 3) as league_epa
            FROM pbp WHERE epa IS NOT NULL AND play_type IN ('pass','run') AND season_type = 'REG'
            GROUP BY season ORDER BY season DESC LIMIT 4
        """)).fetchall()
        for r in league:
            ctx_parts.append(f"League avg {r.season}: EPA {r.league_epa} ({r.plays} plays)")

    return "\n".join(ctx_parts) if ctx_parts else "No specific data found for this query."


@router.post("/generate")
def generate_anecdotes(
    body: AnecdoteRequest,
    user: dict = Depends(require_admin),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured")

    t0 = time.time()
    context = _gather_context(body.query)

    level_instruction = {
        "casual": "Write for a casual NFL fan. Keep it simple, fun, and surprising. Use one key stat that makes people go 'wow'. No jargon.",
        "deep": "Write for an analytics-savvy NFL audience. Use EPA, advanced metrics, historical comparisons. Show something non-obvious that rewards knowledge.",
    }.get(body.level, "casual")

    prompt = f"""You are an NFL stats expert creating Twitter/X content.

INPUT: "{body.query}"

RELEVANT DATA FROM OUR DATABASE:
{context}

TASK: Generate exactly 3 different anecdote options based on the input and data above.
{level_instruction}

RULES:
- Each anecdote must be factually based on the data provided
- Twitter-ready: engaging, concise, shareable
- Include 1-2 relevant emoji (not excessive)
- Include 1-2 hashtags at the end
- If the text exceeds 280 characters, split it into numbered parts (1/N, 2/N...) each under 280 chars
- Write in English
- Each option should take a DIFFERENT angle on the data

Return a JSON array of 3 objects:
[
  {{"text": "The tweet text", "parts": ["part1", "part2"] or null if under 280 chars}},
  ...
]

Return ONLY the JSON array, no other text."""

    try:
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        anecdotes = json.loads(raw)
    except json.JSONDecodeError:
        anecdotes = [{"text": raw, "parts": None}]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)[:200]}")

    elapsed = int((time.time() - t0) * 1000)
    log_query("anecdote", body.query, raw[:500], elapsed)

    return {"anecdotes": anecdotes, "query": body.query, "level": body.level}


@router.post("/translate")
def translate_anecdote(
    body: TranslateRequest,
    user: dict = Depends(require_admin),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured")

    try:
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": f"""Translate this NFL tweet/thread to Hebrew. Keep emoji, hashtags, and player names in English. Keep the same tone and format.
If there are multiple parts (thread), translate each part separately.

Text:
{body.text}

Return ONLY the translated text, nothing else."""}],
        )
        return {"translation": resp.content[0].text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)[:200]}")


@router.post("/save")
def save_anecdote(
    body: SaveAnecdoteRequest,
    user: dict = Depends(require_admin),
):
    uid = int(user["sub"])
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO saved_items (user_id, type, label, data, note)
            VALUES (:uid, 'anecdote', :label, :data::jsonb, '')
        """), {
            "uid": uid,
            "label": body.query[:80],
            "data": json.dumps({"query": body.query, "text": body.text, "level": body.level, "language": body.language}),
        })
    return {"ok": True}


@router.get("/history")
def anecdote_history(user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, label, data, created_at FROM saved_items
            WHERE user_id = :uid AND type = 'anecdote'
            ORDER BY created_at DESC LIMIT 50
        """), {"uid": uid}).fetchall()
    return [dict(r._mapping) for r in rows]
