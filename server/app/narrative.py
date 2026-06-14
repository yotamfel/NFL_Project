"""
AI Comparison Narrative (Phase 4): generates a Claude-written paragraph
comparing two or more players in one stat category.
"""
import time
from typing import Any, Optional

from anthropic import Anthropic

from app.ai_log import log_query
from app.config import ANTHROPIC_API_KEY
from app.data.comparison import compare_career, compare_season

MODEL = "claude-sonnet-4-6"

_SYSTEM = """\
You are a concise NFL analyst. Given career or single-season stats for
two or more players in one stat category, write a 4-to-6 sentence
comparative paragraph. Highlight who leads in each key metric, note
interesting stylistic or efficiency differences, and give a brief
overall verdict. No bullet points. No headers. Write in English,
in an analytical but engaging tone."""


def _fmt_stats(row: dict[str, Any], skip_keys=("player_id",)) -> str:
    parts = []
    for k, v in row.items():
        if k in skip_keys or v is None or v == 0:
            continue
        if k == "player_name":
            continue
        if isinstance(v, float):
            parts.append(f"{k}={v:.2f}")
        else:
            parts.append(f"{k}={v}")
    return ", ".join(parts)


def _build_prompt(players: list[dict], stats: list[dict], category: str, season: Optional[int]) -> str:
    scope = f"{season} season" if season else "career totals"
    lines = [f"Stat category: {category} — {scope}", ""]
    for i, p in enumerate(players):
        stat_row = next((s for s in stats if s.get("player_id") == p["player_id"]), None)
        name = p["player_name"]
        pos  = p.get("pos", "")
        if stat_row:
            lines.append(f"{name} ({pos}): {_fmt_stats(stat_row)}")
        else:
            lines.append(f"{name} ({pos}): no data for this scope")
    return "\n".join(lines)


def _safe_log(**kwargs) -> Optional[int]:
    try:
        return log_query(**kwargs)
    except Exception:
        return None


def generate_narrative(
    player_ids: list[str],
    category: str,
    season: Optional[int] = None,
) -> dict[str, Any]:
    """Return {narrative, log_id}. Raises ValueError on bad input, RuntimeError if API missing."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    comp = compare_season(player_ids, category, season) if season else compare_career(player_ids, category)
    players = comp["players"]
    stats   = comp["career"]

    prompt = _build_prompt(players, stats, category, season)
    names  = ", ".join(p["player_name"] for p in players)

    t0 = time.monotonic()
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=MODEL,
        max_tokens=400,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    ms     = int((time.monotonic() - t0) * 1000)
    tokens = response.usage.input_tokens + response.usage.output_tokens
    narrative = response.content[0].text.strip()

    log_id = _safe_log(
        feature="comparison_narrative",
        input_text=f"{names} | {category} | {season or 'career'}",
        model_used=MODEL,
        tokens_used=tokens,
        response_ms=ms,
        success=True,
    )
    return {"narrative": narrative, "log_id": log_id}
