"""
Load NFL weekly injury report data (2009–present) into the injuries table.

Source: nflreadpy.load_injuries() — official NFL injury report filings.
Linked via gsis_id → pfr_id using load_ff_playerids().

Only stores rows where report_status is set (Out/Doubtful/Questionable/Note).
Rows with null status (full participation / no designation) are dropped.

Table: injuries
  player_id       TEXT  — FK to players.player_id
  season          INT
  week            INT
  game_type       TEXT  — REG / WC / DIV / CON / SB
  team            TEXT
  report_status   TEXT  — Out | Doubtful | Questionable | Note
  primary_injury  TEXT  — e.g. Knee, Shoulder, Hamstring…
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

FIRST_YEAR = 2009
CURRENT    = 2025


def create_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS injuries (
            player_id      TEXT NOT NULL,
            season         INT  NOT NULL,
            week           INT  NOT NULL,
            game_type      TEXT,
            team           TEXT,
            report_status  TEXT,
            primary_injury TEXT,
            PRIMARY KEY (player_id, season, week, team)
        )
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS injuries_player_season
        ON injuries (player_id, season)
    """))
    conn.commit()
    print("Table injuries ready.")


def _build_id_map(engine):
    """Primary map: gsis_id -> pfr_id via ff_playerids (only pfr_ids in our DB).
    Fallback map: (full_name, pos) -> pfr_id — unique name+position combos only."""
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT player_name, pos, player_id FROM players")).fetchall()

    our_pfr_ids: set[str] = {r[2] for r in rows}

    # name+pos map: unique (name, pos) combos only
    np_counts: dict[tuple, int] = {}
    np_to_pfr:  dict[tuple, str] = {}
    # also name-only map for unique names
    name_counts: dict[str, int] = {}
    name_to_pfr:  dict[str, str] = {}
    for player_name, pos, player_id in rows:
        key = (player_name, pos)
        np_counts[key] = np_counts.get(key, 0) + 1
        np_to_pfr[key] = player_id
        name_counts[player_name] = name_counts.get(player_name, 0) + 1
        name_to_pfr[player_name] = player_id

    np_to_pfr   = {k: v for k, v in np_to_pfr.items()   if np_counts[k]   == 1}
    name_to_pfr = {k: v for k, v in name_to_pfr.items() if name_counts[k] == 1}

    # Primary map: only keep ff_playerids entries where pfr_id is in our DB
    ids = (nfl.load_ff_playerids().to_pandas()
           [['gsis_id', 'pfr_id']]
           .dropna()
           .query("gsis_id != '' and pfr_id != ''")
           .pipe(lambda df: df[df['pfr_id'].isin(our_pfr_ids)])
           .set_index('gsis_id')['pfr_id']
           .to_dict())

    return ids, np_to_pfr, name_to_pfr


def load_year(year: int, id_map: dict, np_map: dict, name_map: dict, engine) -> int:
    print(f"  {year}...", end=" ", flush=True)
    try:
        df = nfl.load_injuries(seasons=year).to_pandas()
    except Exception as e:
        print(f"SKIP ({e})")
        return 0

    if df is None or len(df) == 0:
        print("no data")
        return 0

    # Keep only rows with an actual status designation
    df = df[df['report_status'].notna() & (df['report_status'] != '')]

    # Primary link: gsis_id -> pfr_id
    df['player_id'] = df['gsis_id'].map(id_map)

    # Fallback 1: match by (full_name, position) — handles duplicate names
    unlinked = df['player_id'].isna()
    if unlinked.any() and 'full_name' in df.columns and 'position' in df.columns:
        df.loc[unlinked, 'player_id'] = df.loc[unlinked].apply(
            lambda r: np_map.get((r['full_name'], r['position'])), axis=1
        )
    # Fallback 2: match by full_name alone (unique names only)
    unlinked = df['player_id'].isna()
    if unlinked.any() and 'full_name' in df.columns:
        df.loc[unlinked, 'player_id'] = df.loc[unlinked, 'full_name'].map(name_map)

    df = df[df['player_id'].notna()]

    df = df.rename(columns={'report_primary_injury': 'primary_injury'})
    df['season'] = year
    df['week']   = df['week'].astype(int)

    cols = ['player_id', 'season', 'week', 'game_type', 'team',
            'report_status', 'primary_injury']
    df = df[cols].copy()
    df = df.drop_duplicates(['player_id', 'season', 'week', 'team'])

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM injuries WHERE season = :yr"), {"yr": year})
        df.to_sql("injuries", conn, if_exists="append", index=False, method="multi")

    print(f"{len(df):,} rows")
    return len(df)


def load_injuries(years=None):
    if years is None:
        years = list(range(FIRST_YEAR, CURRENT + 1))

    engine = get_engine()
    with engine.begin() as conn:
        create_table(conn)

    print("Building player ID map...")
    id_map, np_map, name_map = _build_id_map(engine)
    print(f"  {len(id_map):,} gsis->pfr mappings, {len(np_map):,} name+pos fallbacks, {len(name_map):,} name-only fallbacks")

    total = 0
    for yr in years:
        total += load_year(yr, id_map, np_map, name_map, engine)

    print(f"\nDone. {total:,} total rows inserted.")


if __name__ == "__main__":
    load_injuries()
