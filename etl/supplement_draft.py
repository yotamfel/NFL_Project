"""
Fill `draft` table gaps from nflverse data - originally written for the
2023-2024 backfill, now reused for 2025.

PFR's raw per-season CSV exports - the only ground truth this project has
ever loaded `draft` from - simply stop getting produced for this category, so
every new draft class is a gap of the same kind, recurring every year
(distinct from `supplement_seasons.py`'s job, which extends the seven
box-score categories that nflverse *does* keep current). nflreadpy's
`load_draft_picks()` covers 1980-2026 and, helpfully, ships its own PFR
player-id column (`pfr_player_id`) - no id crosswalk needed, unlike the
three-stage effort `link_draft.py` required for the original 2000-2022 range.

Original 2023-2024 backfill: of 516 picks, all 516 carried a `pfr_player_id`,
and 470 already existed in `players` (a tracked stat sometime in 2023-2024).
The remaining 46 - overwhelmingly offensive linemen and similar
no-personal-stat positions with real, lengthy careers (e.g. Cody Mauch, T, 36
games) - never appear in any of the seven box-score categories `players` is
built from, exactly like ~400 picks from the original link_draft.py effort.
They're inserted with a null `player_id`, consistent with how every other
such case in this dataset is represented; the foreign key to `players` still
holds. The 2025 run (257 picks, run after `supplement_players.py` had already
seeded that season's rookies) reproduced the same shape: 100% `pfr_player_id`
coverage, the unmatched minority concentrated in the same no-stat positions.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import nflreadpy as nfl

from db import get_engine

from datetime import datetime as _dt
_now = _dt.utcnow()
_cur = _now.year if _now.month >= 9 else _now.year - 1
YEARS = sorted({_cur - 1, _cur})

# nflreadpy column -> our `draft` column. wAV/DrAV are exposed as `w_av`/`dr_av`
# (nflreadpy's own `car_av` is an unrelated, currently-empty field).
_RENAME = {
    "season": "draft_year",
    "pfr_player_name": "player_name",
    "position": "pos",
    "to": "last_season",
    "allpro": "all_pro_yrs",
    "probowls": "pro_bowls",
    "seasons_started": "years_started",
    "w_av": "career_av",
    "dr_av": "draft_team_av",
    "games": "g",
    "pass_completions": "pass_cmp",
    "pass_attempts": "pass_att",
    "pass_yards": "pass_yds",
    "pass_tds": "pass_td",
    "pass_ints": "pass_int",
    "rush_atts": "rush_att",
    "rush_yards": "rush_yds",
    "rush_tds": "rush_td",
    "receptions": "rec",
    "rec_yards": "rec_yds",
    "rec_tds": "rec_td",
    "def_solo_tackles": "solo_tkl",
    "def_ints": "def_int",
    "def_sacks": "sk",
    "pfr_player_id": "player_id",
}

_OUR_COLUMNS = [
    "draft_year", "round", "pick", "team", "player_name", "pos", "age",
    "last_season", "all_pro_yrs", "pro_bowls", "years_started", "career_av",
    "draft_team_av", "g", "pass_cmp", "pass_att", "pass_yds", "pass_td",
    "pass_int", "rush_att", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td",
    "solo_tkl", "def_int", "sk", "college", "player_id",
]


def supplement_draft():
    picks = nfl.load_draft_picks(seasons=YEARS).rename(_RENAME)
    df = picks.select(_OUR_COLUMNS).to_pandas()

    engine = get_engine()
    with engine.begin() as conn:
        ids = df["player_id"].dropna().unique().tolist()
        known_ids = {
            row[0] for row in conn.exec_driver_sql(
                "select player_id from players where player_id = any(%(ids)s)",
                {"ids": ids},
            ).fetchall()
        } if ids else set()
        unresolved = (~df["player_id"].isin(known_ids)) & df["player_id"].notna()
        print(f"picks: {len(df)}, with a players-table match: {(~unresolved & df['player_id'].notna()).sum()}, "
              f"left unlinked (no tracked box-score appearance): {unresolved.sum()}")
        df.loc[unresolved, "player_id"] = None

        conn.exec_driver_sql("delete from draft where draft_year = any(%(years)s)", {"years": YEARS})
        df.to_sql("draft", conn, schema="public", if_exists="append", index=False)
        total, linked = conn.exec_driver_sql(
            "select count(*), count(player_id) from draft").fetchone()
    print(f"draft now: {total} picks total, {linked} linked ({linked / total:.1%})")


if __name__ == "__main__":
    supplement_draft()
