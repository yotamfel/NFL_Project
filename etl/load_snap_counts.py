"""
Load NFL snap counts (2013–present) from nflreadpy into the snap_counts table.

Data source: nflverse snap counts via nflreadpy.load_snap_counts()
Linked to players table via pfr_player_id (same PFR IDs used everywhere else).

Table: snap_counts
  player_id   TEXT  — FK to players.player_id
  season      INT
  week        INT
  game_type   TEXT  — 'REG' or 'POST'
  team        TEXT
  opponent    TEXT
  offense_snaps  INT
  offense_pct    NUMERIC(5,3)
  defense_snaps  INT
  defense_pct    NUMERIC(5,3)
  st_snaps       INT
  st_pct         NUMERIC(5,3)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import warnings
warnings.filterwarnings("ignore")

import nflreadpy as nfl
import pandas as pd
from sqlalchemy import text
from db import get_engine

FIRST_YEAR = 2013   # nflreadpy snap counts start from 2013
CURRENT_YEAR = 2025


def create_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS snap_counts (
            player_id      TEXT    NOT NULL,
            season         INT     NOT NULL,
            week           INT     NOT NULL,
            game_type      TEXT,
            team           TEXT,
            opponent       TEXT,
            offense_snaps  INT,
            offense_pct    NUMERIC(5,3),
            defense_snaps  INT,
            defense_pct    NUMERIC(5,3),
            st_snaps       INT,
            st_pct         NUMERIC(5,3),
            PRIMARY KEY (player_id, season, week, team)
        )
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS snap_counts_player_season
        ON snap_counts (player_id, season)
    """))
    conn.commit()
    print("Table snap_counts ready.")


def load_year(year: int, engine) -> int:
    print(f"  Fetching {year}...", end=" ", flush=True)
    try:
        df = nfl.load_snap_counts(seasons=year)
    except Exception as e:
        print(f"SKIP ({e})")
        return 0

    if df is None or len(df) == 0:
        print("no data")
        return 0

    # Convert polars → pandas
    df = df.to_pandas()

    # Keep only rows with a valid pfr_player_id
    df = df[df["pfr_player_id"].notna() & (df["pfr_player_id"] != "")]

    # Only REG + POST, drop Pro Bowl etc.
    df = df[df["game_type"].isin(["REG", "POST"])]

    # Rename columns to match DB schema
    df = df.rename(columns={
        "pfr_player_id": "player_id",
        "position":      "pos",
    })

    # Select and coerce
    cols = ["player_id", "season", "week", "game_type", "team", "opponent",
            "offense_snaps", "offense_pct", "defense_snaps", "defense_pct",
            "st_snaps", "st_pct"]
    df = df[cols].copy()

    for c in ["offense_snaps", "defense_snaps", "st_snaps"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    for c in ["offense_pct", "defense_pct", "st_pct"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").round(3)

    # Only keep players that exist in the players table
    with engine.connect() as conn:
        existing = pd.read_sql("SELECT player_id FROM players", conn)
    df = df[df["player_id"].isin(existing["player_id"])]

    if df.empty:
        print("0 matched rows")
        return 0

    # Upsert: delete existing rows for this year, then insert
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM snap_counts WHERE season = :yr"), {"yr": year})
        df.to_sql("snap_counts", conn, if_exists="append", index=False, method="multi")

    print(f"{len(df):,} rows")
    return len(df)


def load_snap_counts(years=None):
    if years is None:
        years = list(range(FIRST_YEAR, CURRENT_YEAR + 1))

    engine = get_engine()
    with engine.begin() as conn:
        create_table(conn)

    total = 0
    for yr in years:
        total += load_year(yr, engine)

    print(f"\nDone. {total:,} total rows inserted.")


if __name__ == "__main__":
    load_snap_counts()
