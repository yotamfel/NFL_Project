"""
Fill the 2023-2024 gap in the `draft` table from nflverse data.

While evaluating nflreadpy as a source for keeping this database current, a
comparison of season ranges across all tables turned up a real gap that
predates this project: every `*_seasons` table (and `combine_seasons`) covers
2000-2024, but `draft` stops at 2022 - the original raw CSV exports for the
draft category simply never included the 2023 and 2024 classes. nflreadpy's
`load_draft_picks()` covers 1980-2026 and, helpfully, ships its own PFR
player-id column (`pfr_player_id`) - no id crosswalk needed.

Of the 516 picks across these two classes, all 516 carry a `pfr_player_id`,
and 470 of those already exist in our `players` table (they recorded a
tracked stat sometime in 2023-2024, which is in range). The remaining 46 are
overwhelmingly offensive linemen and similar no-personal-stat positions who
have real, lengthy careers (e.g. Cody Mauch, T, 36 games) but - exactly like
roughly 400 picks from the original 2000-2022 linking effort (see
link_draft.py / PROJECT_LOG.md) - never appear in any of the seven box-score
categories the `players` table is built from. They're inserted with a null
`player_id`, consistent with how every other such case in this dataset is
represented; the foreign key to `players` still holds.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import nflreadpy as nfl

from db import get_engine

YEARS = [2023, 2024]

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
        known_ids = {
            row[0] for row in conn.exec_driver_sql(
                "select player_id from players where player_id = any(%(ids)s)",
                {"ids": df["player_id"].dropna().unique().tolist()},
            ).fetchall()
        }
        unresolved = (~df["player_id"].isin(known_ids)) & df["player_id"].notna()
        print(f"picks: {len(df)}, with a players-table match: {(~unresolved & df['player_id'].notna()).sum()}, "
              f"left unlinked (no tracked box-score appearance): {unresolved.sum()}")
        df.loc[unresolved, "player_id"] = None

        df.to_sql("draft", conn, schema="public", if_exists="append", index=False)
        total, linked = conn.exec_driver_sql(
            "select count(*), count(player_id) from draft").fetchone()
    print(f"draft now: {total} picks total, {linked} linked ({linked / total:.1%})")


if __name__ == "__main__":
    supplement_draft()
