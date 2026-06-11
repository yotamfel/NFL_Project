"""
Load advanced receiving stats into adv_receiving table.

Two sources, merged by player_id + season:

1. PFR advanced receiving (2018–2025) via load_pfr_advstats:
   adot, ybc_r, yac_r, broken tackles, drops, drop%, passer rating when targeted
   Linked via pfr_id (same IDs already in our players table).

2. Next Gen Stats receiving (2016–2025) via load_nextgen_stats:
   avg_separation, avg_cushion, avg_intended_air_yards, yac_above_expectation
   Linked via gsis_id → pfr_id using load_ff_playerids().
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

PFR_FIRST = 2018
NGS_FIRST = 2016
CURRENT   = 2025


def create_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS adv_receiving (
            player_id    TEXT NOT NULL,
            season       INT  NOT NULL,
            team         TEXT,
            -- PFR advanced
            adot         NUMERIC(5,2),   -- Avg Depth of Target
            ybc_r        NUMERIC(5,2),   -- Yards Before Catch / reception
            yac_r        NUMERIC(5,2),   -- Yards After Catch / reception
            brk_tkl      INT,            -- Broken tackles
            drop         INT,            -- Drops
            drop_pct     NUMERIC(5,3),   -- Drop %
            tgt_rating   NUMERIC(6,2),   -- Passer rating when targeted
            -- Next Gen Stats
            avg_sep      NUMERIC(5,2),   -- Avg separation at target (ft)
            avg_cushion  NUMERIC(5,2),   -- Avg cushion at snap (ft)
            ngs_adot     NUMERIC(5,2),   -- NGS avg intended air yards
            yac_oe       NUMERIC(5,2),   -- YAC above expectation
            PRIMARY KEY (player_id, season)
        )
    """))
    conn.commit()
    print("Table adv_receiving ready.")


def _load_pfr(years):
    frames = []
    for yr in years:
        if yr < PFR_FIRST:
            continue
        try:
            df = nfl.load_pfr_advstats(seasons=yr, stat_type='rec', summary_level='season').to_pandas()
            df['season'] = yr
            frames.append(df)
        except Exception as e:
            print(f"    PFR {yr}: skip ({e})")
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    df = df.rename(columns={'pfr_id': 'player_id', 'tm': 'team',
                             'drop_percent': 'drop_pct', 'rat': 'tgt_rating'})
    for c in ['adot', 'ybc_r', 'yac_r', 'tgt_rating', 'drop_pct']:
        df[c] = pd.to_numeric(df.get(c), errors='coerce').round(2)
    df['brk_tkl'] = pd.to_numeric(df.get('brk_tkl'), errors='coerce').round(0).astype('Int64')
    df['drop']    = pd.to_numeric(df.get('drop'),    errors='coerce').round(0).astype('Int64')
    # Keep one row per player-season (pick row with most targets if dupes)
    df = df.sort_values('tgt', ascending=False).drop_duplicates(['player_id', 'season'])
    return df[['player_id', 'season', 'team', 'adot', 'ybc_r', 'yac_r',
               'brk_tkl', 'drop', 'drop_pct', 'tgt_rating']].copy()


def _load_ngs(years):
    # Build gsis → pfr_id map once
    id_map = (
        nfl.load_ff_playerids().to_pandas()
        [['gsis_id', 'pfr_id']]
        .dropna()
        .query("gsis_id != '' and pfr_id != ''")
        .set_index('gsis_id')['pfr_id']
        .to_dict()
    )
    frames = []
    for yr in years:
        if yr < NGS_FIRST:
            continue
        try:
            df = (nfl.load_nextgen_stats(seasons=yr, stat_type='receiving')
                  .to_pandas())
            # season aggregate = week 0, REG
            df = df[(df['week'] == 0) & (df['season_type'] == 'REG')].copy()
            df['season']    = yr
            df['player_id'] = df['player_gsis_id'].map(id_map)
            frames.append(df)
        except Exception as e:
            print(f"    NGS {yr}: skip ({e})")
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    df = df.dropna(subset=['player_id'])
    df = df.rename(columns={
        'avg_separation':             'avg_sep',
        'avg_intended_air_yards':     'ngs_adot',
        'avg_yac_above_expectation':  'yac_oe',
    })
    for c in ['avg_sep', 'avg_cushion', 'ngs_adot', 'yac_oe']:
        df[c] = pd.to_numeric(df.get(c), errors='coerce').round(2)
    df = df.drop_duplicates(['player_id', 'season'])
    return df[['player_id', 'season', 'avg_sep', 'avg_cushion', 'ngs_adot', 'yac_oe']].copy()


def load_adv_receiving(years=None):
    if years is None:
        years = list(range(NGS_FIRST, CURRENT + 1))

    engine = get_engine()
    with engine.begin() as conn:
        create_table(conn)

    print(f"Loading PFR advanced receiving ({PFR_FIRST}–{CURRENT})...")
    pfr = _load_pfr(years)
    print(f"  {len(pfr)} player-season rows from PFR")

    print(f"Loading NGS receiving ({NGS_FIRST}–{CURRENT})...")
    ngs = _load_ngs(years)
    print(f"  {len(ngs)} player-season rows from NGS")

    # Outer-join on player_id + season
    if pfr.empty and ngs.empty:
        print("No data loaded.")
        return
    elif pfr.empty:
        merged = ngs.copy()
    elif ngs.empty:
        merged = pfr.copy()
    else:
        merged = pfr.merge(ngs, on=['player_id', 'season'], how='outer')
        # Prefer PFR team when available
        if 'team' not in merged:
            merged['team'] = None

    # Keep only players in the players table
    with engine.connect() as conn:
        existing = pd.read_sql("SELECT player_id FROM players", conn)
    merged = merged[merged['player_id'].isin(existing['player_id'])]
    print(f"  {len(merged)} rows after player filter")

    # Upsert: delete affected seasons then insert
    seasons = sorted(merged['season'].unique())
    with engine.begin() as conn:
        for yr in seasons:
            conn.execute(text("DELETE FROM adv_receiving WHERE season = :yr"), {"yr": int(yr)})
        merged.to_sql("adv_receiving", conn, if_exists="append", index=False, method="multi")

    print(f"Done. {len(merged):,} rows in adv_receiving.")


if __name__ == "__main__":
    load_adv_receiving()
