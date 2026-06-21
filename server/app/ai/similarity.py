"""Player Similarity — cosine similarity on per-game career stat vectors."""
import time
import json
from typing import Optional

import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import text
from anthropic import Anthropic

from app.db import engine
from app.config import ANTHROPIC_API_KEY
from app.ai_log import log_query, Timer

MODEL = "claude-sonnet-4-6"

POSITION_GROUPS = {
    "QB":  {"view": "passing_career",  "cols": ["yds", "td", "int", "att", "cmp", "sk", "gwd"]},
    "RB":  {"view": "offense_career",  "cols": ["rush_yds", "rush_td", "rec", "rec_yds", "rec_td", "fmb"]},
    "WR":  {"view": "offense_career",  "cols": ["rec", "rec_yds", "rec_td", "tgt"]},
    "TE":  {"view": "offense_career",  "cols": ["rec", "rec_yds", "rec_td", "tgt"]},
    "DEF": {"view": "defense_career",  "cols": ["sk", "int", "comb", "ff", "pd", "tfl", "qb_hits"]},
}

_POS_TO_GROUP = {
    "QB": "QB",
    "RB": "RB", "FB": "RB", "HB": "RB",
    "WR": "WR", "FL": "WR", "SE": "WR",
    "TE": "TE",
    "DE": "DEF", "LDE": "DEF", "RDE": "DEF", "DT": "DEF", "NT": "DEF",
    "LDT": "DEF", "RDT": "DEF",
    "OLB": "DEF", "LOLB": "DEF", "ROLB": "DEF",
    "LB": "DEF", "ILB": "DEF", "MLB": "DEF", "RILB": "DEF", "LILB": "DEF",
    "LLB": "DEF", "RLB": "DEF",
    "CB": "DEF", "LCB": "DEF", "RCB": "DEF", "NCB": "DEF", "DB": "DEF",
    "S": "DEF", "FS": "DEF", "SS": "DEF",
    "K": None, "PK": None, "P": None,
}


def pos_to_group(pos: str | None) -> str | None:
    if not pos:
        return None
    return _POS_TO_GROUP.get(pos.upper().strip())


def get_similar_players(player_id: str, pos_group: str, top_n: int = 5) -> list[dict]:
    cfg = POSITION_GROUPS.get(pos_group)
    if not cfg:
        return []

    view = cfg["view"]
    cols = cfg["cols"]
    col_list = ", ".join(f"c.{c}" for c in cols)

    sql = text(f"""
        SELECT c.player_id, p.player_name, p.pos, c.g, {col_list}
        FROM {view} c
        JOIN players p ON p.player_id = c.player_id
        WHERE c.g > 0 AND c.g IS NOT NULL
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql).fetchall()

    if len(rows) < 10:
        return []

    data = []
    player_info = {}
    target_idx = None

    for i, r in enumerate(rows):
        d = dict(r._mapping)
        g = max(float(d["g"]), 1)
        vec = []
        for c in cols:
            val = d.get(c)
            vec.append(float(val) / g if val is not None else 0.0)
        data.append(vec)
        player_info[i] = {
            "player_id": d["player_id"],
            "player_name": d["player_name"],
            "pos": d["pos"],
            "games": int(d["g"]),
            "stats": {c: round(float(d.get(c) or 0) / g, 2) for c in cols},
        }
        if d["player_id"] == player_id:
            target_idx = i

    if target_idx is None:
        return []

    X = np.array(data)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    sims = cosine_similarity(X_scaled[target_idx:target_idx+1], X_scaled)[0]

    ranked = sorted(enumerate(sims), key=lambda x: -x[1])
    results = []
    for idx, score in ranked:
        if idx == target_idx:
            continue
        if len(results) >= top_n:
            break
        info = player_info[idx]
        results.append({
            "player_id": info["player_id"],
            "player_name": info["player_name"],
            "pos": info["pos"],
            "similarity_score": round(float(score), 4),
            "stats": info["stats"],
        })

    return results, player_info[target_idx]


def explain_similarities(target: dict, similar: list[dict], pos_group: str) -> list[str]:
    if not ANTHROPIC_API_KEY or not similar:
        return [""] * len(similar)

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    target_stats = ", ".join(f"{k}={v}" for k, v in target["stats"].items())
    players_text = "\n".join(
        f'{i+1}. {p["player_name"]}: {", ".join(f"{k}={v}" for k,v in p["stats"].items())} (similarity: {p["similarity_score"]})'
        for i, p in enumerate(similar)
    )

    prompt = f"""You are an NFL analyst writing for a knowledgeable audience. A cosine-similarity
algorithm compared per-game career stats and found these players statistically similar to
{target["player_name"]} ({target["pos"]}).

Target player per-game averages: {target_stats}

Similar players (ranked by similarity score, 1.0 = identical):
{players_text}

For each similar player, write a short cohesive paragraph (3-4 sentences that flow naturally
together, not a bullet list). Cover:
- Which specific per-game stats are closest and why that drives the similarity score
- What style, role, or era similarities exist beyond raw numbers
- One honest difference — where they diverge most

Use specific numbers from the stats. Explain WHY this player matched at this percentage —
what makes a 99% match different from a 95% match. Write in an engaging, analytical tone.

Return ONLY a valid JSON array of strings (one paragraph per player, same order):
["paragraph for player 1", "paragraph for player 2", ...]"""

    with Timer() as t:
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text.strip()
            tokens = (resp.usage.input_tokens or 0) + (resp.usage.output_tokens or 0)
        except Exception as e:
            log_query(feature="similarity", input_text=target["player_name"],
                      model_used=MODEL, success=False, error_msg=str(e)[:200])
            return [""] * len(similar)

    log_query(
        feature="similarity",
        input_text=target["player_name"],
        model_used=MODEL,
        tokens_used=tokens,
        response_ms=t.ms,
        success=True,
    )

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        explanations = json.loads(cleaned)
        if isinstance(explanations, list) and len(explanations) >= len(similar):
            return explanations[:len(similar)]
    except (json.JSONDecodeError, TypeError):
        pass

    return [""] * len(similar)
