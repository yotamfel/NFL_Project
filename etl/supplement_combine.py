"""
Fill the 2025 gap in `combine_seasons` from nflverse data.

Like `draft`, the combine table's PFR-derived raw exports stop at the 2024
class - the 2025 combine (held in early 2025, ahead of that year's draft)
was never part of this project's source CSVs. nflreadpy's `load_combine()`
ships its own PFR id (`pfr_id`) and the same "team / round / pick / year"
draft-slot fields nflverse exposes for the draft table, so the same two
reshaping steps this project already trusts apply here:

- `ht` arrives as "6-2"; every existing row in this table spells it "6_2"
  (that's PFR's own raw export convention, not a corruption - confirmed zero
  hyphenated values exist anywhere in the column), so the separator is
  normalized to match.
- `drafted_tm_per_rnd_per_yr` doesn't exist as a single field in nflreadpy;
  it's rebuilt from `draft_team`/`draft_round`/`draft_ovr`/`draft_year` in
  the exact "{team} / {round}{suffix} / {pick}{suffix} pick / {year}" shape
  `link_draft.py`'s regex expects (verified against hundreds of existing
  rows spanning every suffix case: 1st/2nd/3rd/4th and the 11th-13th
  exception). Undrafted prospects keep it null, same as in the original data.

`college` is dropped to null for new rows: in the existing data it is either
null or the literal placeholder text "College Stats" (the label of a link to
a page that may not exist) - meaningless either way, and nflreadpy doesn't
carry an equivalent field worth inventing one for.

Of 291 prospects with a `pfr_id`, 184 already exist in `players` (they
recorded a 2025 box-score stat and were seeded by `supplement_players.py`);
the remaining 107 - overwhelmingly offensive line and other no-personal-stat
positions - are stored with a null `player_id`, the same convention used
throughout this dataset for untracked careers.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import nflreadpy as nfl
import pandas as pd

from db import get_engine

from datetime import datetime as _dt
_now = _dt.utcnow()
_cur = _now.year if _now.month >= 9 else _now.year - 1
YEARS = sorted({_cur - 1, _cur})

_OUR_COLUMNS = [
    "season", "player_name", "pos", "school", "college", "ht", "wt",
    "_40yd", "vertical", "bench", "broad_jump", "_3cone", "shuttle",
    "drafted_tm_per_rnd_per_yr", "player_id",
]


def _ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }"


def _drafted_tm_string(row) -> str | None:
    if pd.isna(row["draft_team"]):
        return None
    return (f"{row['draft_team']} / {_ordinal(int(row['draft_round']))} / "
            f"{_ordinal(int(row['draft_ovr']))} pick / {int(row['draft_year'])}")


def supplement_combine():
    raw = nfl.load_combine(seasons=YEARS).to_pandas()

    df = raw.rename(columns={"forty": "_40yd", "cone": "_3cone", "pfr_id": "player_id"})
    df["college"] = None
    df["ht"] = df["ht"].str.replace("-", "_", regex=False)
    df["drafted_tm_per_rnd_per_yr"] = df.apply(_drafted_tm_string, axis=1)
    for col in ["season", "wt", "bench", "broad_jump"]:
        df[col] = df[col].astype("Int64")
    df = df[_OUR_COLUMNS]

    engine = get_engine()
    with engine.begin() as conn:
        known_ids = {
            row[0] for row in conn.exec_driver_sql(
                "select player_id from players where player_id = any(%(ids)s)",
                {"ids": df["player_id"].dropna().unique().tolist()},
            ).fetchall()
        }
        unresolved = (~df["player_id"].isin(known_ids)) & df["player_id"].notna()
        print(f"prospects: {len(df)}, with a players-table match: {(~unresolved & df['player_id'].notna()).sum()}, "
              f"left unlinked (no tracked box-score appearance): {unresolved.sum()}")
        df.loc[unresolved, "player_id"] = None

        df.to_sql("combine_seasons", conn, schema="public", if_exists="append", index=False)
        total, linked = conn.exec_driver_sql(
            "select count(*), count(player_id) from combine_seasons").fetchone()
    print(f"combine_seasons now: {total} prospects total, {linked} linked ({linked / total:.1%})")


if __name__ == "__main__":
    supplement_combine()
