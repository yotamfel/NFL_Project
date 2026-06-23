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
    scheduled_date: Optional[str] = None
    original_text: Optional[str] = None


def _gather_context(query: str) -> str:
    """Search the DB for data relevant to the query and return as context string."""
    ctx_parts = []
    q_lower = query.lower()

    def _q(sql, params=None):
        """Run a query safely, returning rows or empty list."""
        try:
            with engine.connect() as conn:
                return conn.execute(text(sql), params or {}).fetchall()
        except Exception:
            return []

    def _s(sql, params=None):
        """Run a scalar query safely."""
        try:
            with engine.connect() as conn:
                return conn.execute(text(sql), params or {}).scalar()
        except Exception:
            return None

    import re as _re

    words = [w for w in q_lower.split() if len(w) > 2]
    player_ids_found = set()
    team_abbrevs = ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS"]
    found_teams = [t for t in team_abbrevs if t.lower() in q_lower]

    # Fuzzy player search: try direct match first, then try last-name-only
    all_search_words = list(words)
    # Also try pairs of consecutive words as "first last"
    for i in range(len(words) - 1):
        pair = f"%{words[i]}%{words[i+1]}%"
        for p in _q("SELECT player_id, player_name FROM players WHERE LOWER(player_name) LIKE :q ORDER BY fdv DESC NULLS LAST LIMIT 1", {"q": pair}):
            if p.player_id not in player_ids_found:
                all_search_words.append(p.player_name.split()[-1].lower())

    # Players
    for word in all_search_words:
        for p in _q("SELECT player_id, player_name, pos, first_season, last_season, n_seasons, fdv FROM players WHERE LOWER(player_name) LIKE :q ORDER BY fdv DESC NULLS LAST LIMIT 3", {"q": f"%{word}%"}):
            if p.player_id in player_ids_found:
                continue
            player_ids_found.add(p.player_id)
            ctx_parts.append(f"\nPlayer: {p.player_name} ({p.pos}), seasons {p.first_season}-{p.last_season} ({p.n_seasons} seasons), FDV: {p.fdv or 'N/A'}")

            for table in ["passing_seasons", "offense_seasons", "defense_seasons", "kicking_seasons", "punting_seasons", "returns_seasons"]:
                for s in _q(f"SELECT * FROM {table} WHERE player_id = :pid ORDER BY season DESC LIMIT 5", {"pid": p.player_id}):
                    vals = {k: v for k, v in s._mapping.items() if v is not None and k != 'player_id'}
                    ctx_parts.append(f"  {table} {vals.get('season','?')}: {json.dumps({k:str(v) for k,v in vals.items()}, default=str)[:400]}")

            for d in _q("SELECT * FROM draft WHERE player_id = :pid", {"pid": p.player_id}):
                dm = dict(d._mapping)
                ctx_parts.append(f"  Draft: Round {dm.get('round')}, Pick {dm.get('pick')}, {dm.get('draft_year')}, {dm.get('team')}")

            for r in _q("SELECT season, COUNT(*) as weeks_listed, COUNT(*) FILTER (WHERE report_status='Out') as games_out FROM injuries WHERE player_id = :pid GROUP BY season ORDER BY season DESC LIMIT 3", {"pid": p.player_id}):
                ctx_parts.append(f"  Injuries {r.season}: listed {r.weeks_listed} weeks, out {r.games_out} games")

            gsis = _s("SELECT gsis_id FROM players WHERE player_id = :pid", {"pid": p.player_id})
            if gsis:
                for id_col, label in [("passer_player_id","passing"),("rusher_player_id","rushing"),("receiver_player_id","receiving")]:
                    for r in _q(f"SELECT season, COUNT(*) as plays, ROUND(AVG(epa)::numeric,3) as epa, ROUND(AVG(yards_gained)::numeric,1) as avg_yards, SUM(CASE WHEN touchdown=1 THEN 1 ELSE 0 END) as tds, SUM(CASE WHEN interception=1 THEN 1 ELSE 0 END) as ints, ROUND(AVG(CASE WHEN success=1 THEN 100.0 ELSE 0 END)::numeric,1) as success_rate FROM pbp WHERE {id_col}=:gsis AND epa IS NOT NULL GROUP BY season ORDER BY season DESC LIMIT 4", {"gsis": gsis}):
                        ctx_parts.append(f"  PBP {label} {r.season}: {r.plays}p, EPA {r.epa}, {r.avg_yards}y, {r.tds}TD, {r.ints}INT, {r.success_rate}%sr")

                for r in _q("SELECT season, COUNT(*) as plays, ROUND(SUM(wpa)::numeric,3) as clutch_wpa FROM pbp WHERE passer_player_id=:gsis AND wpa IS NOT NULL AND game_seconds_remaining<=300 AND ABS(score_differential)<=8 GROUP BY season ORDER BY season DESC LIMIT 3", {"gsis": gsis}):
                    if r.plays >= 5:
                        ctx_parts.append(f"  Clutch {r.season}: {r.plays}p, WPA {r.clutch_wpa}")

                for g in _q("SELECT season,week,defteam,COUNT(*) as plays,ROUND(SUM(epa)::numeric,1) as game_epa,SUM(CASE WHEN touchdown=1 THEN 1 ELSE 0 END) as tds FROM pbp WHERE passer_player_id=:gsis AND epa IS NOT NULL AND pass_attempt=1 GROUP BY season,week,defteam HAVING COUNT(*)>=15 ORDER BY game_epa DESC LIMIT 3", {"gsis": gsis}):
                    ctx_parts.append(f"  Best game: {g.season} W{g.week} vs {g.defteam}: {g.game_epa} EPA, {g.tds} TDs")

            for r in _q("SELECT 'passing' as cat,SUM(yds) as yds,SUM(td) as td,SUM(int) as ints,COUNT(*) as seasons FROM passing_seasons WHERE player_id=:pid AND yds IS NOT NULL UNION ALL SELECT 'offense',SUM(yds),SUM(td),NULL,COUNT(*) FROM offense_seasons WHERE player_id=:pid AND yds IS NOT NULL", {"pid": p.player_id}):
                if r.yds and r.yds > 0:
                    ctx_parts.append(f"  Career {r.cat}: {r.yds}yds, {r.td}TDs{', '+str(r.ints)+'INT' if r.ints else ''} ({r.seasons} seasons)")

            draft_yr = _s("SELECT draft_year FROM draft WHERE player_id=:pid", {"pid": p.player_id})
            if draft_yr:
                ctx_parts.append(f"  Drafted {draft_yr}, first season {p.first_season}")

            for s in _q("SELECT season,ROUND(AVG(offense_pct)::numeric*100,1) as pct,COUNT(*) as games FROM snap_counts WHERE player_id=:pid AND game_type='REG' GROUP BY season ORDER BY season DESC LIMIT 4", {"pid": p.player_id}):
                if s.pct:
                    ctx_parts.append(f"  Snaps {s.season}: {s.pct}% ({s.games}g)")

    # Teams
    for team in found_teams[:2]:
        for s in _q("SELECT season,COUNT(*) as plays,ROUND(AVG(epa)::numeric,3) as epa,ROUND(AVG(CASE WHEN pass_attempt=1 THEN epa END)::numeric,3) as pass_epa,ROUND(AVG(CASE WHEN rush_attempt=1 THEN epa END)::numeric,3) as rush_epa FROM pbp WHERE posteam=:team AND epa IS NOT NULL AND play_type IN ('pass','run') AND season_type='REG' GROUP BY season ORDER BY season DESC LIMIT 4", {"team": team}):
            ctx_parts.append(f"Team {team} {s.season}: {s.plays}p, EPA {s.epa}, pass {s.pass_epa}, rush {s.rush_epa}")

    # Records
    if any(w in q_lower for w in ["best","most","record","top","leader","highest","worst","lowest"]):
        ctx_parts.append("\n--- LEADERS ---")
        for table, stat, label in [("passing_seasons","td","passing TDs"),("passing_seasons","yds","passing yards"),("offense_seasons","td","rush/rec TDs"),("offense_seasons","yds","rush/rec yards")]:
            for r in _q(f"SELECT p.player_name,SUM(s.{stat}) as total FROM {table} s JOIN players p ON p.player_id=s.player_id WHERE s.{stat} IS NOT NULL GROUP BY p.player_name ORDER BY total DESC LIMIT 5"):
                ctx_parts.append(f"  {label}: {r.player_name} ({r.total})")

    # Year mentions
    for yr in [int(y) for y in _re.findall(r'\b(19[7-9]\d|20[0-2]\d)\b', query)][:2]:
        for r in _q("SELECT passer_player_name as name,ROUND(AVG(epa)::numeric,3) as epa,COUNT(*) as plays FROM pbp WHERE season=:yr AND pass_attempt=1 AND passer_player_id IS NOT NULL AND epa IS NOT NULL AND season_type='REG' GROUP BY passer_player_name HAVING COUNT(*)>=200 ORDER BY epa DESC LIMIT 5", {"yr": yr}):
            ctx_parts.append(f"Top QB EPA {yr}: {r.name} ({r.epa})")

    # Postseason
    if any(w in q_lower for w in ["playoff","postseason","super bowl","superbowl","wild card","divisional","championship"]):
        for r in _q("SELECT passer_player_name as name,COUNT(*) as plays,ROUND(AVG(epa)::numeric,3) as epa,SUM(CASE WHEN touchdown=1 THEN 1 ELSE 0 END) as tds FROM pbp WHERE season_type='POST' AND pass_attempt=1 AND passer_player_id IS NOT NULL AND epa IS NOT NULL GROUP BY passer_player_name HAVING COUNT(*)>=100 ORDER BY epa DESC LIMIT 10"):
            ctx_parts.append(f"Postseason: {r.name} {r.plays}p, EPA {r.epa}, {r.tds}TDs")

    # Divisional
    if any(w in q_lower for w in ["division","divisional","rivalry","afc","nfc"]):
        for r in _q("SELECT posteam,defteam,COUNT(*) as games,ROUND(AVG(epa)::numeric,3) as epa FROM pbp WHERE div_game=1 AND epa IS NOT NULL AND play_type IN ('pass','run') GROUP BY posteam,defteam HAVING COUNT(*)>=200 ORDER BY epa DESC LIMIT 10"):
            ctx_parts.append(f"Div: {r.posteam} vs {r.defteam}: EPA {r.epa} ({r.games}p)")

    # Head-to-head
    if len(found_teams) >= 2:
        t1, t2 = found_teams[0], found_teams[1]
        for r in _q("SELECT posteam,COUNT(*) as plays,ROUND(AVG(epa)::numeric,3) as epa,SUM(CASE WHEN touchdown=1 THEN 1 ELSE 0 END) as tds FROM pbp WHERE ((posteam=:t1 AND defteam=:t2) OR (posteam=:t2 AND defteam=:t1)) AND epa IS NOT NULL AND play_type IN ('pass','run') GROUP BY posteam", {"t1": t1, "t2": t2}):
            ctx_parts.append(f"H2H {r.posteam}: {r.plays}p, EPA {r.epa}, {r.tds}TDs")

    # League avg
    for r in _q("SELECT season,COUNT(*) as plays,ROUND(AVG(epa)::numeric,3) as league_epa FROM pbp WHERE epa IS NOT NULL AND play_type IN ('pass','run') AND season_type='REG' GROUP BY season ORDER BY season DESC LIMIT 4"):
        ctx_parts.append(f"League {r.season}: EPA {r.league_epa} ({r.plays}p)")

    return "\n".join(ctx_parts[:150]) if ctx_parts else "No specific data found."


@router.post("/generate")
def generate_anecdotes(
    body: AnecdoteRequest,
    user: dict = Depends(require_admin),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured")

    t0 = time.time()
    context = _gather_context(body.query)

    # Learn from past edits
    edit_examples = ""
    try:
        uid = int(user["sub"])
        with engine.connect() as conn:
            edits = conn.execute(text("""
                SELECT data FROM saved_items
                WHERE user_id = :uid AND type = 'anecdote'
                      AND data::text LIKE '%original_text%'
                ORDER BY created_at DESC LIMIT 5
            """), {"uid": uid}).fetchall()
        examples = []
        for row in edits:
            d = json.loads(row.data) if isinstance(row.data, str) else row.data
            if d.get("original_text") and d["original_text"] != d["text"]:
                examples.append(f"AI wrote: {d['original_text'][:200]}\nUser edited to: {d['text'][:200]}")
        if examples:
            edit_examples = "\n\nLEARN FROM PAST EDITS - the user previously edited your output like this:\n" + "\n---\n".join(examples) + "\nApply the same style preferences to new anecdotes."
    except Exception:
        pass

    level_instruction = {
        "casual": "Write for a casual NFL fan. Keep it clear and surprising, but professional - like a sports journalist, not a fanboy. Use one or two key stats.",
        "deep": "Write for an analytics-savvy NFL audience. Use EPA, advanced metrics, historical comparisons. Show something non-obvious that rewards knowledge.",
    }.get(body.level, "casual")

    from datetime import date
    today = date.today()
    today_str = today.strftime("%B %d, %Y")
    today_md = today.strftime("%m-%d")

    prompt = f"""You are an NFL stats expert creating Twitter/X content.
TODAY'S DATE: {today_str}

INPUT: "{body.query}"

NOTE: The input may contain typos or informal names. Interpret the intent - "patrik mahoms" means Patrick Mahomes, "the kc qb" means the Kansas City Chiefs quarterback, etc.

RELEVANT DATA FROM OUR DATABASE:
{context}

If the database returned limited data (e.g. player not found due to typo), use the stats provided for related players/teams that WERE found. Only use stats from the data above - do not invent numbers.
{edit_examples}

TASK: Generate exactly 3 different anecdote options based on the input and data above.
{level_instruction}

IMPORTANT:
- Today is {today_str}. If the input mentions "born", "birthday", a birth year, or any date-related event, START the anecdote with a date hook like "On this day in [year]..." or "X years ago today..." or "Today marks..." and calculate the correct age/anniversary from today's date.
- If the input says "born 1995", that means the person was born on TODAY'S DATE (month and day) in that year. Calculate age as {today.year} minus the birth year.
- The input may mention a specific year, event, or era, but you should draw connections ACROSS seasons and history.
- Think creatively about connections: birthdays, draft classes, team history, career milestones, before/after events, rookie vs veteran comparisons, era comparisons.
- The data provided covers multiple seasons - use cross-season insights, not just the mentioned year.

STYLE RULES:
- Professional sports journalism tone - informative, not hype
- ALWAYS include the team name in parentheses after the player name, e.g. "Patrick Mahomes (Chiefs)"
- ALWAYS add historical context: where does this stat rank? Is it a record? Who else has done it? What record did it break or approach?
- Never end with generic hype phrases like "he dominated", "built different", "not human", etc. End with a fact, a comparison, or a question to the audience
- Each anecdote must be factually based on the data provided - never invent stats
- Include 1-2 relevant emoji (not excessive)
- Always end with #NFL #FourthAndData
- If the text exceeds 280 characters, split it into numbered parts (1/N, 2/N...) each under 280 chars
- Write in English
- Each option should take a DIFFERENT angle (comparison, record/ranking, surprising context)

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
    data_obj = {
        "query": body.query,
        "text": body.text,
        "level": body.level,
        "language": body.language,
        "scheduled_date": body.scheduled_date,
    }
    if body.original_text:
        data_obj["original_text"] = body.original_text
    try:
        data_str = json.dumps(data_obj, ensure_ascii=False)
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO saved_items (user_id, type, label, data, note) VALUES (:uid, 'anecdote', :label, CAST(:data AS jsonb), '')"
            ), {"uid": uid, "label": body.query[:80], "data": data_str})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)[:200]}")
    return {"ok": True}


@router.get("/history")
def anecdote_history(
    month: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    uid = int(user["sub"])
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, label, data, created_at FROM saved_items
            WHERE user_id = :uid AND type = 'anecdote'
            ORDER BY created_at DESC LIMIT 100
        """), {"uid": uid}).fetchall()

        # Calendar summary: count per date
        date_counts = conn.execute(text("""
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM saved_items WHERE user_id = :uid AND type = 'anecdote'
            GROUP BY day ORDER BY day DESC
        """), {"uid": uid}).fetchall()

    return {
        "items": [dict(r._mapping) for r in rows],
        "calendar": {str(r.day): r.count for r in date_counts},
    }
