"""
Cleaning pipeline for raw per-year Pro-Football-Reference CSV exports.

Each category folder holds one CSV per season (2000-2024). The raw files share
a few structural quirks (documented in PROJECT_LOG.md):
  - a UTF-8 BOM and, for several categories, a two-row grouped header
  - a "junk" row per file: a `League Average` row and/or a literal header row
    that leaked into the data
  - the official PFR player-id column survives intact but its header was
    mangled to '-9999' / '#NAME?' by a prior Excel round-trip
  - a handful of count/record columns were corrupted the same way (see
    corruption_fixes.py) and need reversing

load_category() returns one tidy, concatenated DataFrame per category with
clean snake_case column names, a `season` column, a `player_id` column, and
junk rows removed.
"""
import re
from pathlib import Path

import pandas as pd

from corruption_fixes import fix_corrupted_count, fix_corrupted_name, fix_qbrec

RAW_BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference")

_SPECIAL = {
    "%": "_pct",
    "/": "_per_",
    "+": "_plus",
    "-": "_",
    " ": "_",
}


def clean_column_name(name: str) -> str:
    name = str(name).strip()
    for char, repl in _SPECIAL.items():
        name = name.replace(char, repl)
    name = re.sub(r"[^0-9a-zA-Z_]", "", name)
    name = re.sub(r"_+", "_", name).strip("_").lower()
    if name and name[0].isdigit():
        name = f"_{name}"
    return name


# Junk values PFR export tools leave behind as literal data rows.
_JUNK_PLAYER_NAMES = {"League Average", "Player", "Avg/Throw", "Avg Team"}

# The combine page links every prospect's name to a profile - even those with
# no PFR page of their own - and renders the missing link as one of these two
# literal placeholder strings. Every other category simply leaves the cell
# blank (-> NaN) for the same case, so these are normalized to NaN here too:
# "no profile page" should mean the same thing everywhere in the dataset.
_ID_SENTINELS = {"-9999", "_9999"}

# Three combine prospects share their exact name (and draft class) with a more
# famous NFL player, and PFR's combine page mistakenly links their name to that
# player's profile instead of leaving it unlinked - a PFR-side scraping quirk,
# not a Power BI corruption (the id is real, just doesn't belong to this row).
# Each pair is told apart by position: e.g. the 2007 'Buster Davis' linked to
# DaviBu99 (the actual DaviBu99 played LB/ILB - PFR mislinked the WR prospect's
# name to his page). Clearing these prevents a false (player_id, season)
# collision and a false combine<->career link.
_COMBINE_ID_MISLINKS = {
    ("DaviBu99", 2007, "WR"),
    ("GreeMi00", 2000, "S"),
    ("JohnDe25", 2005, "CB"),
}


def _strip_junk_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Drop blank padding rows (an export artifact: every file is padded to a
    fixed row count with fully-empty rows) and literal junk-data rows."""
    has_name = df["player_name"].notna()
    return df[has_name & ~df["player_name"].isin(_JUNK_PLAYER_NAMES)].copy()


def _read_year(path: Path, header_rows) -> pd.DataFrame:
    """Read one season file. header_rows is either an int (single header row)
    or a 2-tuple (group_row, name_row) for grouped headers."""
    if isinstance(header_rows, tuple):
        group_idx, name_idx = header_rows
        raw_header = pd.read_csv(path, header=None, encoding="utf-8-sig",
                                 nrows=name_idx + 1, dtype=str)
        group_row = list(raw_header.iloc[group_idx])
        name_row = list(raw_header.iloc[name_idx])
        # One source file (2018 offense) carries ~17 fully-blank leading
        # columns - a Power BI export artifact. A real column always has a
        # name, so columns with no name in the header row are dropped.
        keep = [i for i, name in enumerate(name_row) if pd.notna(name)]
        group_row = [group_row[i] for i in keep]
        name_row = [name_row[i] for i in keep]
        df = pd.read_csv(path, header=None, skiprows=name_idx + 1,
                         encoding="utf-8-sig", dtype=str, low_memory=False)
        df = df.iloc[:, keep]
        df.columns = name_row
        df.attrs["group_row"] = group_row
        df.attrs["name_row"] = name_row
        return df
    df = pd.read_csv(path, header=header_rows, encoding="utf-8-sig", dtype=str, low_memory=False)
    df.attrs["group_row"] = [None] * len(df.columns)
    df.attrs["name_row"] = list(df.columns)
    return df


def _rename_columns(df: pd.DataFrame, id_column_raw, overrides: dict) -> pd.DataFrame:
    id_aliases = {id_column_raw} if isinstance(id_column_raw, str) else set(id_column_raw)
    group_row = df.attrs.get("group_row", [None] * len(df.columns))
    name_row = df.attrs.get("name_row", list(df.columns))
    new_names = []
    for group, name in zip(group_row, name_row):
        if name in id_aliases:
            new_names.append("player_id")
        elif (group, name) in overrides:
            new_names.append(overrides[(group, name)])
        elif name in overrides:
            new_names.append(overrides[name])
        elif name in _BASE_COLS_RENAME:
            new_names.append(_BASE_COLS_RENAME[name])
        else:
            new_names.append(clean_column_name(name))
    df = df.copy()
    df.columns = new_names
    return df


# Per-category configuration -------------------------------------------------
#
# header: int for a single header row, or (group_row_index, name_row_index)
# id_column_raw: the raw column name holding the official PFR player id
#                (mangled to '-9999'/'#NAME?' for the grouped-header categories)
# overrides: explicit renames for columns that collide once cleaned, keyed
#            either by (group_label, raw_name) or by raw_name
# numeric_fix / qbrec_fix: raw column names needing corruption recovery

CATEGORIES = {
    "passing": dict(
        folder="Passing Tables", file_tpl="{year} passing.csv",
        header=0, id_column_raw="Player-additional",
        overrides={"Yds.1": "sack_yds_lost"},
        qbrec_fix=["QBrec"],
    ),
    "offense": dict(
        folder="Offense Tables", file_tpl="{year} offense.csv",
        header=(0, 1), id_column_raw="-9999",
        overrides={
            ("Receiving", "Yds"): "rec_yds", ("Rushing", "Yds"): "rush_yds",
            ("Receiving", "TD"): "rec_td", ("Rushing", "TD"): "rush_td",
            ("Receiving", "1D"): "rec_first_downs", ("Rushing", "1D"): "rush_first_downs",
            ("Receiving", "Succ%"): "rec_succ_pct", ("Rushing", "Succ%"): "rush_succ_pct",
            ("Receiving", "Lng"): "rec_lng", ("Rushing", "Lng"): "rush_lng",
            ("Receiving", "Y/G"): "rec_y_per_g", ("Rushing", "Y/G"): "rush_y_per_g",
        },
        numeric_fix=["Tgt"],
    ),
    "defense": dict(
        folder="Defense Tables", file_tpl="{year} defense.csv",
        header=(0, 1), id_column_raw="-9999",
        overrides={
            ("Def Interceptions", "Yds"): "int_ret_yds", ("Fumbles", "Yds"): "fum_ret_yds",
            "IntTD": "int_td", "FRTD": "fr_td", "QBHits": "qb_hits",
        },
        numeric_fix=["Int"],
    ),
    "kicking": dict(
        folder="Kicking Tables", file_tpl="{year} kicking.csv",
        header=(0, 1), id_column_raw="-9999",
        overrides={
            ("0-19", "FGA"): "fga_0_19", ("0-19", "FGM"): "fgm_0_19",
            ("20-29", "FGA"): "fga_20_29", ("20-29", "FGM"): "fgm_20_29",
            ("30-39", "FGA"): "fga_30_39", ("30-39", "FGM"): "fgm_30_39",
            ("40-49", "FGA"): "fga_40_49", ("40-49", "FGM"): "fgm_40_49",
            ("50+", "FGA"): "fga_50_plus", ("50+", "FGM"): "fgm_50_plus",
            ("Scoring", "FGA"): "fga_total", ("Scoring", "FGM"): "fgm_total",
        },
        # Of the 6 raw FGA columns, only the "0-19 yard" one is corrupted
        # (75% of its values); the other 5 distance buckets are clean.
        numeric_fix=["fga_0_19"],
    ),
    "punting": dict(
        folder="Punting Tables", file_tpl="{year} punting.csv",
        header=(0, 1), id_column_raw="-9999",
        overrides={},
    ),
    "returns": dict(
        folder="Returns Tables", file_tpl="{year} Returns.csv",
        header=(0, 1), id_column_raw="-9999",
        overrides={
            ("Punt Returns", "Ret"): "punt_ret", ("Kick Returns", "Ret"): "kick_ret",
            ("Punt Returns", "Yds"): "punt_ret_yds", ("Kick Returns", "Yds"): "kick_ret_yds",
            ("Punt Returns", "Lng"): "punt_ret_lng", ("Kick Returns", "Lng"): "kick_ret_lng",
            ("Punt Returns", "Y/Ret"): "y_per_punt_ret", ("Kick Returns", "Y/Ret"): "y_per_kick_ret",
            "PRTD": "punt_ret_td", "KRTD": "kick_ret_td",
        },
    ),
    "combine": dict(
        folder="Combine Tables", file_tpl="{year} combine.csv",
        header=0, id_column_raw=("Player-additional", "Player_additional"),
        overrides={},
    ),
}

# Columns shared by all season-level tables, after the player-id rename.
_BASE_COLS_RENAME = {"Player": "player_name", "Age": "age", "Team": "team",
                     "Pos": "pos", "G": "g", "GS": "gs", "Rk": "rk",
                     "Awards": "awards"}

# Columns that are genuinely textual and must never be coerced to numeric,
# either across all categories or for one category in particular.
_TEXT_COLUMNS = {"season", "player_name", "team", "pos", "awards", "qbrec",
                 "drafted_tm_per_rnd_per_yr", "ht", "college", "school", "player_id"}


def _infer_numeric_types(df: pd.DataFrame) -> pd.DataFrame:
    """Every value in these CSVs arrives as text. Columns that convert to
    numeric without turning any existing value into a new NaN are genuinely
    numeric and get cast to a nullable Int64 (whole numbers) or float64
    (e.g. percentages, yards-per-attempt); anything else - and any column in
    _TEXT_COLUMNS - is left as text."""
    df = df.copy()
    for col in df.columns:
        if col in _TEXT_COLUMNS or pd.api.types.is_numeric_dtype(df[col]):
            continue
        numeric = pd.to_numeric(df[col], errors="coerce")
        if numeric.isna().sum() != df[col].isna().sum():
            continue
        is_whole = numeric.dropna().mod(1).eq(0).all()
        df[col] = numeric.astype("Int64") if is_whole else numeric.astype("float64")
    return df


def load_category(category: str, years=range(2000, 2025)) -> pd.DataFrame:
    cfg = CATEGORIES[category]
    folder = RAW_BASE / cfg["folder"]
    frames = []
    for year in years:
        path = folder / cfg["file_tpl"].format(year=year)
        if not path.exists():
            continue
        df = _read_year(path, cfg["header"])
        df = _rename_columns(df, cfg["id_column_raw"], cfg["overrides"])
        df.insert(0, "season", year)
        frames.append(df)

    full = pd.concat(frames, ignore_index=True)
    full = _strip_junk_rows(full)
    full["player_name"] = fix_corrupted_name(full["player_name"])
    full["player_id"] = full["player_id"].where(~full["player_id"].isin(_ID_SENTINELS))
    if category == "combine":
        mislinked = full[["player_id", "season", "pos"]].apply(tuple, axis=1).isin(_COMBINE_ID_MISLINKS)
        full.loc[mislinked, "player_id"] = None

    for col in cfg.get("numeric_fix", []):
        clean_name = clean_column_name(col) if col not in _BASE_COLS_RENAME else col
        if clean_name in full.columns:
            full[clean_name] = fix_corrupted_count(full[clean_name])
    for col in cfg.get("qbrec_fix", []):
        clean_name = clean_column_name(col)
        if clean_name in full.columns:
            full[clean_name] = fix_qbrec(full[clean_name])

    full = _infer_numeric_types(full)
    return full.reset_index(drop=True)


if __name__ == "__main__":
    for cat in CATEGORIES:
        df = load_category(cat)
        print(f"{cat}: {df.shape}, columns: {list(df.columns)[:8]}...")
        print(f"   seasons: {df['season'].min()}-{df['season'].max()}, "
              f"player_id non-null: {df['player_id'].notna().mean():.1%}")
