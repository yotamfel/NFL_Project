"""
Load Next Gen Stats (2016–present) for QBs (passing) and RBs (rushing).

NGS receiving is already stored in adv_receiving via load_adv_receiving.py.

Tables:
  ngs_passing  — QB metrics: time to throw, air yards, aggressiveness, CPOE
  ngs_rushing  — RB/HB metrics: efficiency, RYOE, time to LOS, % vs heavy box

ID linking: player_gsis_id -> pfr_id via load_ff_playerids().
Season aggregate = week 0, season_type = 'REG'.
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

FIRST_YEAR = 2016
CURRENT    = 2025


def create_tables(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ngs_passing (
            player_id      TEXT NOT NULL,
            season         INT  NOT NULL,
            team           TEXT,
            avg_ttt        NUMERIC(5,3),  -- avg time to throw (seconds)
            avg_cay        NUMERIC(5,2),  -- avg completed air yards
            avg_iay        NUMERIC(5,2),  -- avg intended air yards
            aggressiveness NUMERIC(5,2),  -- % throws into tight windows
            cpoe           NUMERIC(6,3),  -- completion % above expectation
            avg_adot_sticks NUMERIC(5,2), -- avg air yards relative to first-down marker
            max_air_dist   NUMERIC(6,2),  -- max completed air distance
            PRIMARY KEY (player_id, season)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ngs_rushing (
            player_id    TEXT NOT NULL,
            season       INT  NOT NULL,
            team         TEXT,
            efficiency   NUMERIC(6,3),  -- NGS rushing efficiency score
            avg_tlos     NUMERIC(5,3),  -- avg time to line of scrimmage
            ryoe_per_att NUMERIC(6,3),  -- rush yards over expected per attempt
            rush_pct_oe  NUMERIC(6,3),  -- rush % over expected
            pct_8box     NUMERIC(5,2),  -- % of rushes vs 8+ defenders in box
            PRIMARY KEY (player_id, season)
        )
    """))
    conn.commit()
    print("Tables ngs_passing and ngs_rushing ready.")


def _build_id_map():
    return (
        nfl.load_ff_playerids().to_pandas()
        [['gsis_id', 'pfr_id']]
        .dropna()
        .query("gsis_id != '' and pfr_id != ''")
        .set_index('gsis_id')['pfr_id']
        .to_dict()
    )


def _load_passing(years, id_map):
    frames = []
    for yr in years:
        try:
            df = nfl.load_nextgen_stats(seasons=yr, stat_type='passing').to_pandas()
            df = df[(df['week'] == 0) & (df['season_type'] == 'REG')].copy()
            df['season']    = yr
            df['player_id'] = df['player_gsis_id'].map(id_map)
            frames.append(df)
        except Exception as e:
            print(f"  passing {yr}: skip ({e})")
    if not frames:
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True).dropna(subset=['player_id'])
    df = df.rename(columns={
        'team_abbr':                              'team',
        'avg_time_to_throw':                      'avg_ttt',
        'avg_completed_air_yards':                'avg_cay',
        'avg_intended_air_yards':                 'avg_iay',
        'completion_percentage_above_expectation':'cpoe',
        'avg_air_yards_to_sticks':                'avg_adot_sticks',
        'max_completed_air_distance':             'max_air_dist',
    })
    for c in ['avg_ttt','avg_cay','avg_iay','aggressiveness','cpoe','avg_adot_sticks','max_air_dist']:
        df[c] = pd.to_numeric(df.get(c), errors='coerce').round(3)
    df = df.drop_duplicates(['player_id', 'season'])
    return df[['player_id','season','team','avg_ttt','avg_cay','avg_iay',
               'aggressiveness','cpoe','avg_adot_sticks','max_air_dist']].copy()


def _load_rushing(years, id_map):
    frames = []
    for yr in years:
        try:
            df = nfl.load_nextgen_stats(seasons=yr, stat_type='rushing').to_pandas()
            df = df[(df['week'] == 0) & (df['season_type'] == 'REG')].copy()
            df['season']    = yr
            df['player_id'] = df['player_gsis_id'].map(id_map)
            frames.append(df)
        except Exception as e:
            print(f"  rushing {yr}: skip ({e})")
    if not frames:
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True).dropna(subset=['player_id'])
    df = df.rename(columns={
        'team_abbr':                            'team',
        'avg_time_to_los':                      'avg_tlos',
        'rush_yards_over_expected_per_att':     'ryoe_per_att',
        'rush_pct_over_expected':               'rush_pct_oe',
        'percent_attempts_gte_eight_defenders': 'pct_8box',
    })
    for c in ['efficiency','avg_tlos','ryoe_per_att','rush_pct_oe','pct_8box']:
        df[c] = pd.to_numeric(df.get(c), errors='coerce').round(3)
    df = df.drop_duplicates(['player_id', 'season'])
    return df[['player_id','season','team','efficiency','avg_tlos',
               'ryoe_per_att','rush_pct_oe','pct_8box']].copy()


def load_ngs_stats(years=None):
    if years is None:
        years = list(range(FIRST_YEAR, CURRENT + 1))

    engine = get_engine()
    with engine.begin() as conn:
        create_tables(conn)

    print("Building player ID map...")
    id_map = _build_id_map()

    print(f"Loading NGS passing ({FIRST_YEAR}-{CURRENT})...")
    passing = _load_passing(years, id_map)

    print(f"Loading NGS rushing ({FIRST_YEAR}-{CURRENT})...")
    rushing = _load_rushing(years, id_map)

    # Filter to players in our DB
    with engine.connect() as conn:
        existing = set(pd.read_sql("SELECT player_id FROM players", conn)['player_id'])
    passing = passing[passing['player_id'].isin(existing)]
    rushing = rushing[rushing['player_id'].isin(existing)]

    print(f"  Passing: {len(passing)} rows, Rushing: {len(rushing)} rows")

    with engine.begin() as conn:
        for yr in years:
            conn.execute(text("DELETE FROM ngs_passing WHERE season = :yr"), {"yr": yr})
            conn.execute(text("DELETE FROM ngs_rushing WHERE season = :yr"), {"yr": yr})
        if not passing.empty:
            passing.to_sql("ngs_passing", conn, if_exists="append", index=False, method="multi")
        if not rushing.empty:
            rushing.to_sql("ngs_rushing", conn, if_exists="append", index=False, method="multi")

    print(f"Done. {len(passing)} passing + {len(rushing)} rushing rows inserted.")


if __name__ == "__main__":
    load_ngs_stats()
