"""
Natural-language search (module 4): translates a free-text question
(Hebrew or English) into a single read-only SQL query via Claude, validates
that it's safe to run, executes it, and returns the rows.

Two independent safety layers, deliberately not just one:
  1. A fast pre-filter (`_validate_sql`) that rejects anything that isn't a
     single SELECT/WITH statement, or that contains a write/DDL keyword —
     gives a clear, immediate error without ever reaching the database.
  2. The query actually runs inside a PostgreSQL READ ONLY transaction
     (`postgresql_readonly=True`) — enforced by the database engine itself,
     so a write hidden in something the regex didn't anticipate (a function
     call, an unusual keyword) is refused at the source, not just by string
     matching.
Neither alone would be enough to trust: regexes can be fooled by something
creative, and a read-only transaction alone would still let an unbounded or
multi-statement query through. Together they cover each other's blind spots
— the kind of defense-in-depth that's appropriate when the SQL itself is
machine-generated from untrusted free text.
"""
import re
from typing import Any

from anthropic import Anthropic
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import ANTHROPIC_API_KEY
from app.db import engine

# Haiku is deliberately the choice here, not a budget compromise: this is a
# narrow, structured translation task (free text -> one SQL statement against
# a schema described in full in the system prompt) — exactly the kind of job
# a fast, cheap model handles as well as a larger one would.
MODEL = "claude-haiku-4-5-20251001"
ROW_LIMIT = 200

SYSTEM_PROMPT = """\
You translate natural-language questions about NFL data — asked in Hebrew \
or English — into a single read-only PostgreSQL query.

## Schema (PostgreSQL, all in `public`)

players(player_id PK, player_name, pos, first_season, last_season, n_seasons)
  Canonical player identity, 2000-2025. Everything else links to it via player_id.

Six box-score categories, each a `*_seasons` (one row per player-season-team)
/ `*_career` (one row per player, lifetime totals) view pair:
  passing_seasons / passing_career   - cmp, att, yds, td, int, rate, sk, "_1d", ...
  offense_seasons / offense_career   - rushing+receiving: att, rush_yds, rush_td,
                                        tgt, rec, rec_yds, rec_td, touch, yscm, ...
  defense_seasons / defense_career   - comb, solo, ast, sk, int, pd, ff, fr, ...
  kicking_seasons / kicking_career   - fga_0_19..fga_50_plus, fgm_*, fg_pct, xpa, xpm, ...
  punting_seasons / punting_career   - pnt, yds, netyds, tb, ...
  returns_seasons / returns_career   - punt_ret_yds/td, kick_ret_yds/td, apyd, ...
  Common *_seasons columns: season, player_id, player_name, age, team, pos, g, gs, awards.

draft(draft_year, round, pick, team, player_name, pos, age, college,
      career_av, g, player_id, ...)
  One row per draft pick, 2000-2025. career_av = Approximate Value, PFR's
  single cross-position career-quality score - the standard "how good was
  this pick" number. player_id is null for ~8% of picks (see rule 3).

combine_seasons(season, player_id, player_name, pos, school, ht, wt,
                "_40yd", vertical, bench, broad_jump, "_3cone", shuttle, ...)
  Pre-draft workout measurements. ht is text "feet_inches", e.g. '6_2'.

## Rules - breaking these produces a wrong answer, not just an ugly one

1. NEVER sum or average a `*_career` rate/percentage column - there are
   none; *_career views deliberately exclude them (cmp_pct, y_per_a, fg_pct,
   qbr, ...). To get a career rate, recompute it from summed counts, e.g.
   100.0 * sum(cmp) / NULLIF(sum(att), 0).
2. For career totals, prefer draft.player_id -> players -> *_career (a live
   aggregation) over draft's own pass_*/rush_*/g columns, which are a
   scrape-time snapshot that drifts out of date - career_av is the one
   exception, since it exists only on draft.
3. A null player_id does NOT mean "never had a real career" - many real
   players (especially offensive linemen) have no tracked box-score stats.
   Never treat a null player_id as evidence of a "bust".
4. Quote columns whose names start with a digit, e.g. "_40yd", "_3cone",
   "_1d", "_4qc" (the leading underscore is a Postgres-identifier
   workaround for PFR source names that started with digits).
5. *_career views carry ONLY player_id plus aggregated numeric stats - no
   player_name, pos, or team. To show who a career-stat row belongs to,
   JOIN it back to players on player_id.

## How to respond

Respond with ONLY the SQL - no prose, no markdown fences. PostgreSQL
dialect, a single SELECT or WITH...SELECT statement, always ending with a
LIMIT clause (50 unless the question clearly implies a different count).

If the question cannot be answered from this database - it isn't about the
data described above, it's too vague to turn into a query, or it needs data
this database doesn't have - respond with EXACTLY one line:
CANNOT_ANSWER: <a short reason, written in the same language as the question>
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
    """Defense layer 2 (see module docstring) - PostgreSQL itself refuses any write inside this transaction."""
    with engine.connect().execution_options(postgresql_readonly=True) as conn:
        result = conn.execute(text(sql))
        return [dict(row._mapping) for row in result]


def answer_question(question: str) -> dict[str, Any]:
    """
    Translates `question` to SQL, validates and runs it, and returns
    {"sql": ..., "rows": [...]}. Raises TranslationError - covering "Claude
    declined", "unsafe query", and "query failed to run" alike - on any
    failure to produce a result.
    """
    reply = _ask_claude(question)
    if reply.upper().startswith("CANNOT_ANSWER"):
        raise TranslationError(reply.split(":", 1)[1].strip() if ":" in reply else reply)

    sql = _validate_sql(reply)
    try:
        rows = _run_readonly(sql)
    except SQLAlchemyError as exc:
        raise TranslationError(f"the generated query failed to run: {getattr(exc, 'orig', exc)}") from exc

    return {"sql": sql, "rows": rows}
