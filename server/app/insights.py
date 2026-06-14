"""
Player Insights (Phase 3): generates a short Claude-written narrative about
a player's career stats. Results are cached in-memory for 24 hours so
repeated profile-page loads don't burn API tokens.
"""
import time
from typing import Any, Optional

from anthropic import Anthropic

from app.ai_log import log_query
from app.config import ANTHROPIC_API_KEY
from app.data.players import get_player_profile

MODEL = "claude-sonnet-4-6"
_TTL = 86_400  # 24 h in seconds

# {player_id: (expires_at, insight_text, log_id)}
_cache: dict[str, tuple[float, str, Optional[int]]] = {}

# Key career columns per category — used to build the stats summary
_CAREER_KEYS: dict[str, list[str]] = {
    "passing": ["g", "att", "cmp", "yds", "td", "int", "rate", "gwd", "_4qc"],
    "offense": ["g", "att", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "yscm"],
    "defense": ["g", "comb", "solo", "sk", "int", "pd", "ff", "tfl"],
    "kicking": ["g", "fgm_total", "fga_total", "xpm", "xpa"],
    "punting": ["g", "pnt", "yds", "y_per_p", "pnt20"],
    "returns": ["g", "punt_ret", "punt_ret_yds", "punt_ret_td", "kick_ret", "kick_ret_yds", "kick_ret_td"],
}

_SYSTEM = """\
You are a concise NFL analyst. Given a player's career stats summary, write a
3-to-5 sentence analytical paragraph (no bullet points, no headers). Mention
their position, career longevity, key statistical achievements, and one
interesting observation about their career arc. If the data note says stats
start from 2000, acknowledge the incomplete coverage in one short phrase.
Write in English, in present-perfect tense where appropriate. Be specific —
use the numbers provided."""


def _fmt_career(category: str, career: dict[str, Any]) -> str:
    keys = _CAREER_KEYS.get(category, [])
    parts = []
    for k in keys:
        v = career.get(k)
        if v is not None and v != 0:
            parts.append(f"{k}={v}")
    return f"[{category}] " + ", ".join(parts) if parts else ""


def _build_prompt(profile) -> str:
    p = profile.player
    lines = [
        f"Player: {p.player_name}",
        f"Position: {p.pos or 'unknown'}",
        f"Seasons in DB: {p.first_season}–{p.last_season} ({p.n_seasons} seasons)",
    ]

    pre2000_names = {
        "Brett Favre", "Jerry Rice", "Emmitt Smith", "Barry Sanders",
        "Peyton Manning", "Randy Moss", "Marvin Harrison", "Tim Brown",
        "Reggie White", "Bruce Smith", "Junior Seau", "Ray Lewis",
        "Champ Bailey", "Terrell Davis", "Shannon Sharpe", "Derrick Brooks",
        "John Lynch", "Warren Sapp", "Tony Gonzalez", "Jason Taylor",
    }
    if p.player_name in pre2000_names:
        lines.append("Note: this player's career started before 2000 — stats are from 2000 onward only.")

    lines.append("")
    lines.append("Career stats:")
    for cat_stats in profile.categories:
        if cat_stats.career:
            line = _fmt_career(cat_stats.category, cat_stats.career)
            if line:
                lines.append(line)

    if profile.draft:
        d = profile.draft
        round_pick = f"Round {d.get('round')}, Pick {d.get('pick')}" if d.get("round") else "undrafted"
        lines.append(f"Draft: {d.get('draft_year')} {round_pick} by {d.get('team')} from {d.get('college')}")
        if d.get("career_av"):
            lines.append(f"Career AV (PFR): {d['career_av']}")

    return "\n".join(lines)


def _safe_log(**kwargs) -> Optional[int]:
    try:
        return log_query(**kwargs)
    except Exception:
        return None


def get_insight(player_id: str) -> dict[str, Any]:
    """Return {insight, log_id, cached}. Raises ValueError if player not found."""
    now = time.monotonic()
    cached = _cache.get(player_id)
    if cached and cached[0] > now:
        return {"insight": cached[1], "log_id": cached[2], "cached": True}

    profile = get_player_profile(player_id)
    if profile is None:
        raise ValueError(f"no player with id {player_id!r}")

    prompt = _build_prompt(profile)
    t0 = time.monotonic()

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=MODEL,
        max_tokens=400,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    ms = int((time.monotonic() - t0) * 1000)
    tokens = response.usage.input_tokens + response.usage.output_tokens
    insight = response.content[0].text.strip()

    log_id = _safe_log(
        feature="player_insight",
        input_text=profile.player.player_name,
        model_used=MODEL,
        tokens_used=tokens,
        response_ms=ms,
        success=True,
    )

    _cache[player_id] = (now + _TTL, insight, log_id)
    return {"insight": insight, "log_id": log_id, "cached": False}
