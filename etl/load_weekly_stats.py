"""
Load per-game player stats (1999–present) from nflreadpy into weekly_stats.
Used by detect_anomalies.py to detect career single-game highs.

Table schema:
  weekly_stats(player_id, season, week, game_type, team, opponent,
               pass_yds, pass_td, pass_int, pass_att,
               rush_yds, rush_td, rush_att,
               rec_yds, rec_td, rec, targets)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

_env = Path(__file__).parent.parent / "server" / ".env"
if _env.exists():
    import os
    for line in _env.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
            break

import warnings
warnings.filterwarnings("ignore")

import nflreadpy as nfl
import pandas as pd
from sqlalchemy import text
from db import get_engine

FIRST_YEAR  = 1999
CURRENT_YEAR = 2025

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS weekly_stats (
    player_id  TEXT NOT NULL,
    season     INT  NOT NULL,
    week       INT  NOT NULL,
    game_type  TEXT,
    team       TEXT,
    opponent   TEXT,
    pass_yds   INT,
    pass_td    INT,
    pass_int   INT,
    pass_att   INT,
    rush_yds   INT,
    rush_td    INT,
    rush_att   INT,
    rec_yds    INT,
    rec_td     INT,
    rec        INT,
    targets    INT,
    PRIMARY KEY (player_id, season, week, game_type)
);
CREATE INDEX IF NOT EXISTS weekly_stats_player ON weekly_stats (player_id, season);
CREATE INDEX IF NOT EXISTS weekly_stats_season ON weekly_stats (season, week);
"""

INT_COLS = [
    "pass_yds", "pass_td", "pass_int", "pass_att",
    "rush_yds", "rush_td", "rush_att",
    "rec_yds",  "rec_td",  "rec",      "targets",
]


def _build_id_map() -> dict:
    """GSIS player_id → PFR player_id."""
    try:
        ids = nfl.load_ff_playerids().to_pandas()
        ids = ids[ids["gsis_id"].notna() & ids["pfr_id"].notna()
                  & (ids["gsis_id"] != "") & (ids["pfr_id"] != "")]
        return dict(zip(ids["gsis_id"].astype(str), ids["pfr_id"].astype(str)))
    except Exception as e:
        print(f"  Warning: ID map failed ({e}); 0 rows will match")
        return {}


def load_year(year: int, id_map: dict, known_players: set, engine) -> int:
    print(f"  {year}…", end=" ", flush=True)
    try:
        raw = nfl.load_player_stats(seasons=year).to_pandas()
    except Exception as e:
        print(f"skip ({e})")
        return 0

    if raw is None or raw.empty:
        print("no data")
        return 0

    # Map GSIS → PFR
    raw["player_id"] = raw["player_id"].astype(str).map(id_map)
    raw = raw[raw["player_id"].notna() & raw["player_id"].isin(known_players)]
    if raw.empty:
        print("0 matched")
        return 0

    # Keep REG + POST only
    raw = raw[raw["season_type"].isin(["REG", "POST"])].copy()

    raw = raw.rename(columns={
        "season_type":    "game_type",
        "recent_team":    "team",
        "opponent_team":  "opponent",
        "attempts":       "pass_att",
        "passing_yards":  "pass_yds",
        "passing_tds":    "pass_td",
        "interceptions":  "pass_int",
        "carries":        "rush_att",
        "rushing_yards":  "rush_yds",
        "rushing_tds":    "rush_td",
        "receptions":     "rec",
        "receiving_yards": "rec_yds",
        "receiving_tds":  "rec_td",
    })

    keep = ["player_id", "season", "week", "game_type", "team", "opponent"] + INT_COLS
    raw = raw[[c for c in keep if c in raw.columns]].copy()

    # Fill missing stat cols with 0 and coerce to int
    for c in INT_COLS:
        if c in raw.columns:
            raw[c] = pd.to_numeric(raw[c], errors="coerce").fillna(0).astype(int)
        else:
            raw[c] = 0

    # Deduplicate — a traded player can appear for 2 teams in same week;
    # keep the row with more combined yards
    raw["_yards"] = raw["pass_yds"] + raw["rush_yds"] + raw["rec_yds"]
    raw = (raw.sort_values("_yards", ascending=False)
              .drop_duplicates(subset=["player_id", "season", "week", "game_type"])
              .drop(columns=["_yards"]))

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM weekly_stats WHERE season = :yr"), {"yr": year})
        raw.to_sql("weekly_stats", conn, if_exists="append", index=False, method="multi")

    print(f"{len(raw):,} rows")
    return len(raw)


def load_weekly_stats(years=None):
    if years is None:
        years = list(range(FIRST_YEAR, CURRENT_YEAR + 1))

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(CREATE_TABLE))

    id_map = _build_id_map()
    with engine.connect() as conn:
        known_players = {r[0] for r in conn.execute(text("SELECT player_id FROM players"))}

    total = 0
    for yr in years:
        total += load_year(yr, id_map, known_players, engine)

    print(f"\nDone. {total:,} total rows.")


if __name__ == "__main__":
    import sys
    years = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else None
    load_weekly_stats(years)
