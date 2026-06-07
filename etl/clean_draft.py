"""
Cleaning for the raw per-year NFL Draft CSVs (2000-2022).

Unlike the other category exports, the draft files' two-row grouped header
only labels the *first* column of each group ('Passing' over Cmp, then NaN
over Att/Yds/TD/Int) - and the trailing defensive columns (Solo/Int/Sk) carry
no group label at all. Forward-filling the group row would therefore mislabel
those defensive columns as "Receiving". With only a handful of duplicated raw
names (Att, Yds, TD, Int, each appearing 2-3 times), an explicit positional
column list is simpler and more robust than group-aware matching.

Crucially - and the reason this file exists separately from clean.py - these
files carry no PFR player_id at all. Linking draft picks to the `players`
master table is handled separately in link_draft.py.
"""
from pathlib import Path

import pandas as pd

from corruption_fixes import fix_mojibake_name

RAW_BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference"
                r"\Draft Tabels Stats\Draft CSV")

# Positional rename: the 28 real columns, in raw column order (a 29th column,
# the literal text "College Stats", is a dead hyperlink label and is dropped).
DRAFT_COLUMNS = [
    "round", "pick", "team", "player_name", "pos", "age", "last_season",
    "all_pro_yrs", "pro_bowls", "years_started", "career_av", "draft_team_av", "g",
    "pass_cmp", "pass_att", "pass_yds", "pass_td", "pass_int",
    "rush_att", "rush_yds", "rush_td",
    "rec", "rec_yds", "rec_td",
    "solo_tkl", "def_int", "sk",
    "college",
]

_TEXT_COLUMNS = {"team", "player_name", "pos", "college"}
_JUNK_PLAYER_NAMES = {"Player"}


def load_draft(years=range(2000, 2023)) -> pd.DataFrame:
    frames = []
    for year in years:
        path = RAW_BASE / f"Draft {year}.csv"
        if not path.exists():
            continue
        df = pd.read_csv(path, header=None, skiprows=2, encoding="utf-8-sig",
                         dtype=str, low_memory=False)
        df = df.iloc[:, :len(DRAFT_COLUMNS)]
        df.columns = DRAFT_COLUMNS
        df.insert(0, "draft_year", year)
        frames.append(df)

    full = pd.concat(frames, ignore_index=True)
    full = full[full["player_name"].notna() & ~full["player_name"].isin(_JUNK_PLAYER_NAMES)].copy()
    full["player_name"] = fix_mojibake_name(full["player_name"])

    for col in full.columns:
        if col in _TEXT_COLUMNS or col == "draft_year":
            continue
        numeric = pd.to_numeric(full[col], errors="coerce")
        is_whole = numeric.dropna().mod(1).eq(0).all()
        full[col] = numeric.astype("Int64") if is_whole else numeric.astype("float64")

    return full.reset_index(drop=True)


if __name__ == "__main__":
    d = load_draft()
    print(f"draft: {d.shape}")
    print(d.dtypes.to_string())
    print(d[["draft_year", "round", "pick", "player_name", "pos", "college"]].head(5))
