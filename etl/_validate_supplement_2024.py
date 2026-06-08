"""
Throwaway validation harness (not part of the pipeline): build the 2024
supplement output and diff it against the real PFR-sourced 2024 rows already
in the database, to confirm every discrepancy falls into a documented family
before trusting this pipeline on a season with no ground truth (2025).

PFR lists traded players multiple times - once per team plus an aggregate
"2TM"/"3TM" row. Our pipeline (mirroring nflverse's wide table) stores one
combined row per player-season. `pick_total_row` resolves that mismatch by
preferring the aggregate row when one exists, so the comparison is apples to
apples.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd

from db import get_engine
from supplement_seasons import build_seasons, _OUR_COLUMNS

YEAR = 2024

_SKIP = {"season", "rk", "player_name", "age", "team", "pos", "g", "gs", "qbrec",
         "awards", "qbr", "succ_pct", "lng", "_4qc", "gwd", "rec_succ_pct",
         "rec_lng", "rush_succ_pct", "rush_lng", "y_per_g", "r_per_g",
         "rec_y_per_g", "rush_y_per_g", "a_per_g", "player_id"}

_TOTAL_TEAM = re.compile(r"^\d+TM$")


def pick_total_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Collapse PFR's per-player rows to one per player-season, preferring the
    "2TM"/"3TM" aggregate row when a player was traded (so a single combined
    row - what our pipeline stores - compares against a single combined row,
    not one of several team-split fragments)."""
    is_total = df["team"].str.match(_TOTAL_TEAM, na=False)
    return (df.assign(_is_total=is_total)
            .sort_values("_is_total", ascending=False)
            .drop_duplicates(subset="player_id", keep="first")
            .drop(columns="_is_total"))


def main():
    engine = get_engine()
    ours = build_seasons([YEAR])

    for cat, our_df in ours.items():
        table = f"{cat}_seasons"
        cols = [c for c in _OUR_COLUMNS[cat] if c not in _SKIP]
        with engine.begin() as conn:
            theirs = pd.read_sql(
                f"select player_id, team, {', '.join(cols)} from {table} where season = %(y)s and player_id is not null",
                conn, params={"y": YEAR})

        theirs = pick_total_rows(theirs)
        merged = our_df.merge(theirs, on="player_id", suffixes=("_ours", "_pfr"))
        print(f"\n=== {cat}: {len(our_df)} ours, {len(theirs)} pfr-total-rows, {len(merged)} matched on player_id ===")

        for col in cols:
            o, p = merged[f"{col}_ours"], merged[f"{col}_pfr"]
            o_num = pd.to_numeric(o, errors="coerce")
            p_num = pd.to_numeric(p, errors="coerce")
            diff = (o_num - p_num).abs()
            n_mismatch = (diff > 0.05).sum()
            if n_mismatch:
                worst = merged.loc[diff.nlargest(3).index, ["player_id", f"{col}_ours", f"{col}_pfr"]]
                print(f"  {col}: {n_mismatch}/{len(merged)} differ (max {diff.max():.2f})")
                print(f"    worst: {worst.to_dict('records')}")
            else:
                print(f"  {col}: exact match ({len(merged)} rows)")


if __name__ == "__main__":
    main()
