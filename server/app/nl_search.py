"""
Natural-language search (module 4): translates a free-text question
(Hebrew or English) into a single read-only SQL query via Claude, validates
that it's safe to run, executes it, and returns the rows.

Safety layer: `_validate_sql` rejects anything that isn't a single
SELECT/WITH statement, or that contains any write/DDL keyword — gives a
clear, immediate error without ever reaching the database. Neon's PgBouncer
pooler does not support BEGIN READ ONLY transactions, so
`postgresql_readonly=True` is not used; the regex pre-filter is the sole
safety gate, which is sufficient for this schema.
"""
import re
from typing import Any

from anthropic import Anthropic
from sqlalchemy import text

from app.config import ANTHROPIC_API_KEY
from app.db import engine

MODEL = "claude-sonnet-4-6"
ROW_LIMIT = 200

SYSTEM_PROMPT = """\
You translate natural-language questions about NFL data — asked in Hebrew \
or English — into a single read-only PostgreSQL query.

## Schema (PostgreSQL, all in `public`)

### Core identity
players(player_id PK, player_name, pos, first_season, last_season, n_seasons)
  Canonical player identity, 2000-2025. Everything else links to it via player_id.

### Box-score stats
Six categories, each with a `*_seasons` table (one row per player-season)
and a `*_career` view (lifetime totals per player):

  passing_seasons / passing_career
    cmp, att, yds, td, int, sk, sack_yds_lost, rate (passer rating),
    cmp_pct, y_per_a, ay_per_a, ny_per_a, any_per_a, y_per_c,
    "_1d" (first downs), "_4qc" (4th-quarter comebacks), gwd (game-winning drives)

  offense_seasons / offense_career   (rushing + receiving combined)
    att (rush attempts), rush_yds, rush_td, rush_first_downs,
    tgt, rec, rec_yds, rec_td, rec_first_downs,
    y_per_a (rush), y_per_r (rec), ctch_pct, y_per_tgt,
    touch, yscm (yards from scrimmage), rrtd (rush+rec TDs), fmb

  defense_seasons / defense_career
    comb (combined tackles), solo, ast, sk (sacks), int,
    int_ret_yds, int_td, pd (passes defended), ff (forced fumbles),
    fr (fumble recoveries), fum_ret_yds, fr_td, tfl, qb_hits, sfty, lng

  kicking_seasons / kicking_career
    fgm_total, fga_total, fg_pct,
    fgm_0_19/20_29/30_39/40_49/50_plus (makes by distance),
    fga_0_19/20_29/30_39/40_49/50_plus (attempts by distance),
    lng (longest FG), xpm, xpa, xp_pct,
    ko (kickoffs), koyds, tb (touchbacks), tb_pct, koavg

  punting_seasons / punting_career
    pnt, yds, y_per_p, netyds, ny_per_p, retyds,
    tb, tb_pct, pnt20 (inside 20), in20_pct, blck, lng

  returns_seasons / returns_career
    punt_ret, punt_ret_yds, punt_ret_td, punt_ret_lng, y_per_punt_ret,
    kick_ret, kick_ret_yds, kick_ret_td, kick_ret_lng, y_per_kick_ret, apyd

  Common *_seasons columns: season, player_id, player_name, age, team, pos, g, gs, awards.

### Draft & combine
draft(draft_year, round, pick, team, player_name, pos, age, college,
      career_av, g, pass_yds, pass_td, rush_yds, rush_td, rec_yds, rec_td,
      solo_tkl, def_int, sk, player_id)
  One row per pick, 2000-2025. career_av = PFR Approximate Value (best
  cross-position career-quality metric). player_id null for ~8% of picks.

combine_seasons(season, player_id, player_name, pos, school, ht, wt,
                "_40yd", vertical, bench, broad_jump, "_3cone", shuttle,
                drafted_tm_per_rnd_per_yr)
  Pre-draft workout measurements. ht is text "feet_inches" e.g. '6_2'.

### Supplementary tables (newer data)
snap_counts(player_id, season, week, game_type, team, opponent,
            offense_snaps, offense_pct, defense_snaps, defense_pct,
            st_snaps, st_pct)
  Weekly snap count data. game_type: 'REG' or 'POST'.
  offense_pct/defense_pct/st_pct = share of team snaps (0-1 scale).
  Coverage: 2012-2025.

adv_receiving(player_id, season, team,
              adot (avg depth of target), ybc_r (yards before catch/reception),
              yac_r (yards after catch/reception), brk_tkl (broken tackles),
              drop, drop_pct, tgt_rating (passer rating when targeted),
              avg_sep (avg separation in yards), avg_cushion,
              ngs_adot, yac_oe (YAC over expected))
  Advanced receiving metrics from NGS. Coverage: 2016-2025.

ngs_passing(player_id, season, team,
            avg_ttt (avg time to throw, seconds),
            avg_cay (completed air yards), avg_iay (intended air yards),
            aggressiveness (% of throws into tight windows),
            cpoe (completion % over expected),
            avg_adot_sticks, max_air_dist)
  Next Gen Stats for QBs. Coverage: 2016-2025.

ngs_rushing(player_id, season, team,
            efficiency (NGS rushing efficiency score),
            avg_tlos (avg time to line of scrimmage, seconds),
            ryoe_per_att (rushing yards over expected per attempt),
            rush_pct_oe (rush % over expected),
            pct_8box (% of runs vs 8+ defenders in box))
  Next Gen Stats for RBs/rushers. Coverage: 2016-2025.

injuries(player_id, season, week, game_type, team,
         primary_injury (body part/type as text),
         report_status ('Out', 'Doubtful', 'Questionable', 'Full'))
  Weekly injury report entries. One row per player per week they appeared
  on a report. Coverage: 2009-2025.

## Rules — breaking these produces wrong answers

1. NEVER sum or average a `*_career` rate/percentage column — there are none;
   *_career views deliberately exclude them (cmp_pct, y_per_a, fg_pct, ...).
   To compute a career rate, derive it from summed counts:
   e.g. 100.0 * sum(cmp) / NULLIF(sum(att), 0).
2. For career totals use players -> *_career (live aggregation), not draft's
   own pass_*/rush_*/g columns (snapshot that drifts). career_av is the
   one exception — it only exists on draft.
3. A null player_id does NOT mean "no career" — many real players (OL, etc.)
   have no tracked box-score stats. Never treat null player_id as a bust.
4. Always quote underscore-prefixed columns: "_40yd", "_3cone", "_1d", "_4qc".
5. *_career views have ONLY player_id + numeric stats — no player_name/pos/team.
   JOIN to players for identity info.
6. snap_counts offense_pct/defense_pct/st_pct are fractions (0.0-1.0), not
   percentages. Multiply by 100 if displaying as "% of snaps".
7. adv_receiving, ngs_passing, ngs_rushing, snap_counts only cover 2016-2025
   (snap_counts from 2012). Do not query these for seasons before their
   coverage start.
8. For NGS leaderboards (cpoe, ryoe_per_att, efficiency, avg_ttt, etc.) always
   add a minimum volume filter to avoid small-sample distortion:
   ngs_passing: HAVING SUM(att) >= 100  (join passing_seasons for att)
   or at minimum: COUNT(ng.season) >= 2 seasons.
   ngs_rushing: HAVING COUNT(nr.season) >= 1 AND MIN(nr.season) is enough,
   but prefer joining offense_seasons and filtering att >= 50.
   Without this, players with 1-2 games dominate leaderboards nonsensically.
9. injuries.report_status 'Out' = missed the game; 'Questionable'/'Doubtful'
   = may have played. To count games missed, filter on report_status = 'Out'
   AND game_type = 'REG'.
9. DATA STARTS AT 2000. IMPORTANT: players.first_season is NOT the player's
   actual NFL debut year — it is the earliest season in this database (floor
   of 2000). Every player in the DB has first_season >= 2000, including
   players who debuted in 1985 or 1998. You CANNOT use first_season to
   detect pre-2000 starters. Use your own knowledge instead.

   Players whose careers started before 2000 (incomplete in this DB):
   Brett Favre, Jerry Rice, Emmitt Smith, Barry Sanders, Peyton Manning,
   Randy Moss, Marvin Harrison, Tim Brown, Reggie White, Bruce Smith,
   Junior Seau, Ray Lewis, Champ Bailey, Terrell Davis, Shannon Sharpe,
   Derrick Brooks, John Lynch, Warren Sapp, Tony Gonzalez, Jason Taylor.

   - Career LEADERBOARD (top N by career stat): alias columns as
     career_X_since_2000, e.g. "yds AS career_yds_since_2000". Do NOT
     add a WHERE filter on first_season (it won't work — see above).
   - Individual player career query: if the player is on the list above,
     add 'stats from 2000 only — career began before 2000' AS data_note.
     For players NOT on the list, no data_note needed.

## How to respond

Respond with ONLY the SQL — no prose, no markdown fences. PostgreSQL dialect,
a single SELECT or WITH...SELECT, always ending with a LIMIT clause (50 unless
the question clearly implies a different count).

If the question cannot be answered from this database — it isn't about the data
above, it's too vague, or it needs data this database doesn't have — respond
with EXACTLY one line:
CANNOT_ANSWER: <a short reason, in the same language as the question>
"""

_FENCE = re.compile(r"^```(?:sql)?\s*\n(.*?)\n```$", re.IGNORECASE | re.DOTALL)
_LEADING_KEYWORD = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)
_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|"
    r"EXEC|EXECUTE|CALL|COPY|MERGE|ATTACH|VACUUM|REINDEX|CLUSTER|"
    r"LISTEN|NOTIFY|LOCK|REFRESH|SET|RESET|DO)\b",
    re.IGNORECASE,
)
_LIMIT = re.compile(r"\bLIMIT\b", re.IGNORECASE)


class TranslationError(Exception):
    """
    Raised for every flavor of "couldn't turn this into a result": Claude
    declined to translate, the translation wasn't a query we'll run, or the
    query failed against the database. The router maps all three to the same
    honest 4xx - from the caller's seat, each one means "couldn't answer
    that", and the difference is an implementation detail, not their problem.
    """


def _client() -> Anthropic:
    if not ANTHROPIC_API_KEY:
        raise TranslationError(
            "natural-language search isn't configured on this server "
            "(no ANTHROPIC_API_KEY) - see server/.env.example"
        )
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def _strip_fences(reply: str) -> str:
    """Claude is told not to use markdown fences; this is a safety net for when it does anyway."""
    m = _FENCE.match(reply.strip())
    return m.group(1).strip() if m else reply.strip()


def _ask_claude(question: str) -> str:
    response = _client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": question}],
    )
    return _strip_fences("".join(block.text for block in response.content if block.type == "text"))


def _validate_sql(sql: str) -> str:
    """Defense layer 1 (see module docstring) - never lets anything but a single bare SELECT/WITH through."""
    cleaned = sql.strip().rstrip(";").strip()
    if not cleaned:
        raise TranslationError("the model returned an empty query")
    if ";" in cleaned:
        raise TranslationError("the generated query contained more than one statement - refusing to run it")
    if not _LEADING_KEYWORD.match(cleaned):
        raise TranslationError("the generated query wasn't a SELECT - refusing to run it")
    if _FORBIDDEN.search(cleaned):
        raise TranslationError("the generated query contained a disallowed keyword - refusing to run it")
    if not _LIMIT.search(cleaned):
        cleaned += f" LIMIT {ROW_LIMIT}"
    return cleaned


def _run_readonly(sql: str) -> list[dict[str, Any]]:
    """Runs the validated SELECT query. Layer 1 (_validate_sql) already ensures
    only a bare SELECT/WITH can reach here; no additional DB-level read-only flag
    is needed, and postgresql_readonly=True is intentionally omitted because
    Neon's PgBouncer pooler does not support BEGIN READ ONLY transactions."""
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        return [dict(row._mapping) for row in result]


def answer_question(question: str) -> dict[str, Any]:
    """
    Translates `question` to SQL, validates and runs it, and returns
    {"sql": ..., "rows": [...]}. Raises TranslationError - covering "Claude
    declined", "unsafe query", and "query failed to run" alike - on any
    failure to produce a result.
    """
    try:
        reply = _ask_claude(question)
    except Exception as exc:
        raise TranslationError(f"could not reach the AI service: {exc}") from exc

    if reply.upper().startswith("CANNOT_ANSWER"):
        raise TranslationError(reply.split(":", 1)[1].strip() if ":" in reply else reply)

    sql = _validate_sql(reply)
    try:
        rows = _run_readonly(sql)
    except Exception as exc:
        raise TranslationError(f"the generated query failed to run: {getattr(exc, 'orig', exc)}") from exc

    return {"sql": sql, "rows": rows}
