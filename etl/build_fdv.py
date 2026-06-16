"""
etl/build_fdv.py
================
Compute FDV (Fourth & Data Value) — Fourth & Data's proprietary
position-neutral career value metric.  Replaces Career AV.

Algorithm
---------
For each category (passing, offense, defense, kicking, punting, returns):
  1. Compute a raw weighted score per player-season using category-specific
     formulas that reward the statistics that matter most per position.
  2. Per season-year, z-score the raw scores among "qualified" players
     (starters with meaningful playing time).  If fewer than 8 qualified
     players exist for a year, fall back to the global mean/std for that
     category so thin early-era data doesn't skew results.
  3. FDV_season = max(0,  6 + 3 × z)  × (g / max_games(year))
     Returns are a secondary bonus at 40 % weight.

Player's season FDV = max(primary categories) + returns_bonus.

Career FDV = Σ season_FDV  +  0.10 × Σ top-3-seasons
             (peak bonus rewards excellence without penalising longevity)

Scale reference
---------------
  < 20   FDV  →  Minimal NFL impact / depth player
  20–50  FDV  →  Backup / role player
  50–90  FDV  →  Solid multi-year starter
  90–130 FDV  →  Quality Pro Bowl-level career
  130–180 FDV →  Star player / borderline Hall of Fame
  180+   FDV  →  Hall of Fame level

Usage
-----
  # compute and write to players.fdv in the database
  python etl/build_fdv.py

  # preview top results without touching the DB
  python etl/build_fdv.py --dry-run

  Requires DATABASE_URL env var (or a local postgres fallback — see db.py).
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine


# ── Era: maximum regular-season games per year ─────────────────────────────────
def _max_games(year: int) -> int:
    if year >= 2021:
        return 17
    if year >= 1978:
        return 16
    return 14  # 1970-1977 (AFL/NFL pre-expansion)


# ── Raw score formulas ─────────────────────────────────────────────────────────

def _raw_passing(df: pd.DataFrame) -> pd.Series:
    att  = df['att'].fillna(0)
    yds  = df['yds'].fillna(0)
    td   = df['td'].fillna(0)
    int_ = df['int'].fillna(0)
    gwd  = df['gwd'].fillna(0)  if 'gwd'  in df.columns else pd.Series(0, index=df.index)
    qc   = df['_4qc'].fillna(0) if '_4qc' in df.columns else pd.Series(0, index=df.index)

    if 'any_per_a' in df.columns:
        # Prefer the DB-stored ANY/A (accounts for sack yards where available)
        any_a = df['any_per_a'].where(
            df['any_per_a'].notna(),
            (yds + 20 * td - 45 * int_) / att.clip(lower=1),
        ).fillna(0)
    else:
        any_a = (yds + 20 * td - 45 * int_) / att.clip(lower=1)

    # Volume × efficiency + clutch bonuses
    return (any_a * att / 10) + gwd * 3 + qc * 2


def _raw_offense(df: pd.DataFrame) -> pd.Series:
    # In offense_seasons, rush attempts are stored as 'att' (PFR convention)
    rush_yds = df.get('rush_yds', pd.Series(0, index=df.index)).fillna(0)
    rush_td  = df.get('rush_td',  pd.Series(0, index=df.index)).fillna(0)
    rec_yds  = df.get('rec_yds',  pd.Series(0, index=df.index)).fillna(0)
    rec_td   = df.get('rec_td',   pd.Series(0, index=df.index)).fillna(0)
    rec      = df.get('rec',      pd.Series(0, index=df.index)).fillna(0)
    fmb      = df.get('fmb',      pd.Series(0, index=df.index)).fillna(0)
    return rush_yds * 0.06 + rush_td * 5 + rec_yds * 0.07 + rec_td * 7 + rec * 0.5 - fmb * 2


# Four defensive sub-groups — each z-scored independently so every position
# type competes only with its true peers:
#   pass_rush : edge rushers (DE, OLB in 3-4, outside LBs) — sack-primary
#   coverage  : cornerbacks and safeties
#   dt        : interior defensive linemen (DT / NT)
#   lb        : true inside / middle linebackers (ILB, MLB, RILB, LILB)
#
# Outside linebackers (LLB, RLB) go to pass_rush because many accumulated
# sack totals comparable to DEs — comparing them to ILBs distorts z-scores.
_PASS_RUSH_POS = frozenset({
    'DE', 'LDE', 'RDE', 'OLB', 'LOLB', 'ROLB', 'LLB', 'RLB',
})
_COVERAGE_POS  = frozenset({'CB', 'LCB', 'RCB', 'NCB', 'DB', 'S', 'FS', 'SS'})
_DT_POS        = frozenset({'DT', 'NT', 'LDT', 'RDT'})
# ILB, MLB, RILB, LILB, and bare 'LB' → 'lb'


def _def_group(pos) -> str:
    if pd.isna(pos):
        return 'lb'
    p = str(pos).upper().strip()
    if p in _PASS_RUSH_POS:
        return 'pass_rush'
    if p in _COVERAGE_POS:
        return 'coverage'
    if p in _DT_POS:
        return 'dt'
    return 'lb'


def _raw_defense(df: pd.DataFrame) -> pd.Series:
    sk      = df.get('sk',      pd.Series(0, index=df.index)).fillna(0)
    int_    = df.get('int',     pd.Series(0, index=df.index)).fillna(0)
    pd_     = df.get('pd',      pd.Series(0, index=df.index)).fillna(0)
    ff      = df.get('ff',      pd.Series(0, index=df.index)).fillna(0)
    tfl     = df.get('tfl',     pd.Series(0, index=df.index)).fillna(0)
    comb    = df.get('comb',    pd.Series(0, index=df.index)).fillna(0)
    qb_hits = df.get('qb_hits', pd.Series(0, index=df.index)).fillna(0)
    sfty    = df.get('sfty',    pd.Series(0, index=df.index)).fillna(0)
    return sk * 8 + int_ * 8 + pd_ * 2 + ff * 4 + tfl * 3 + comb * 0.25 + qb_hits * 1.5 + sfty * 6


def _raw_kicking(df: pd.DataFrame) -> pd.Series:
    fgm   = df.get('fgm_total',   pd.Series(0, index=df.index)).fillna(0)
    fga   = df.get('fga_total',   pd.Series(0, index=df.index)).fillna(0)
    fgm50 = df.get('fgm_50_plus', pd.Series(0, index=df.index)).fillna(0)
    xpm   = df.get('xpm',         pd.Series(0, index=df.index)).fillna(0)
    return fgm * 5 + fgm50 * 4 + xpm * 0.4 - (fga - fgm) * 3


def _raw_punting(df: pd.DataFrame) -> pd.Series:
    netyds = df.get('netyds', pd.Series(0, index=df.index)).fillna(0)
    pnt20  = df.get('pnt20',  pd.Series(0, index=df.index)).fillna(0)
    blck   = df.get('blck',   pd.Series(0, index=df.index)).fillna(0)
    return netyds * 0.015 + pnt20 * 2.5 - blck * 4


def _raw_returns(df: pd.DataFrame) -> pd.Series:
    kry = df.get('kick_ret_yds', pd.Series(0, index=df.index)).fillna(0)
    pry = df.get('punt_ret_yds', pd.Series(0, index=df.index)).fillna(0)
    krt = df.get('kick_ret_td',  pd.Series(0, index=df.index)).fillna(0)
    prt = df.get('punt_ret_td',  pd.Series(0, index=df.index)).fillna(0)
    return kry * 0.02 + pry * 0.025 + (krt + prt) * 8


_RAW_FUNCS = {
    'passing': _raw_passing,
    'offense': _raw_offense,
    'defense': _raw_defense,
    'kicking': _raw_kicking,
    'punting': _raw_punting,
    'returns': _raw_returns,
}


def _qualify(df: pd.DataFrame, category: str) -> pd.Series:
    """Boolean mask: 'qualified starter' rows used for era normalisation."""
    if category == 'passing':
        return df['att'].fillna(0) >= 200
    if category == 'offense':
        att = df['att'].fillna(0)  # rush attempts
        rec = df.get('rec', pd.Series(0, index=df.index)).fillna(0)
        return (att + rec) >= 30
    if category == 'defense':
        return df['g'].fillna(0) >= 13  # true starters only (≥ 75 % of 16/17-game season)
    if category == 'kicking':
        return df.get('fga_total', pd.Series(0, index=df.index)).fillna(0) >= 10
    if category == 'punting':
        return df.get('pnt', pd.Series(0, index=df.index)).fillna(0) >= 15
    if category == 'returns':
        kr = df.get('kick_ret', pd.Series(0, index=df.index)).fillna(0)
        pr = df.get('punt_ret', pd.Series(0, index=df.index)).fillna(0)
        return (kr + pr) >= 10
    return pd.Series(True, index=df.index)


def _fdv_for_category(df: pd.DataFrame, category: str) -> pd.DataFrame:
    """Returns DataFrame[player_id, season, fdv_season] for one category.

    Fully vectorised — no Python-level loops over years or position groups.
    For defense, z-scores are computed within position sub-groups so that
    pass rushers (DE/OLB) compete with pass rushers, coverage (CB/S) with
    coverage, and interior defenders with interior defenders.
    """
    if df.empty:
        return pd.DataFrame(columns=['player_id', 'season', 'fdv_season'])

    df = df.copy()
    df['raw'] = _RAW_FUNCS[category](df).fillna(0).clip(lower=0)
    df['game_ratio'] = (
        df['g'].fillna(0) / df['season'].apply(_max_games)
    ).clip(0, 1.0)

    q_mask = _qualify(df, category)
    weight = 0.4 if category == 'returns' else 1.0

    # Choose grouping key: defense uses (pos_group, season), others use season only
    if category == 'defense' and 'pos' in df.columns:
        df['_grp_key'] = df['pos'].apply(_def_group)
        norm_cols = ['_grp_key', 'season']
    else:
        df['_grp_key'] = 'all'
        norm_cols = ['_grp_key', 'season']

    df_q = df[q_mask]

    # Per (group, year) stats among qualified players
    year_stats = (
        df_q.groupby(norm_cols)['raw']
        .agg(q_mean='mean', q_std='std', q_count='count')
        .reset_index()
    )

    # Global fallback per group (used when a year has fewer than 8 qualified)
    global_stats = (
        df_q.groupby('_grp_key')['raw']
        .agg(g_mean='mean', g_std='std')
        .reset_index()
    )

    df = df.merge(year_stats,   on=norm_cols,   how='left')
    df = df.merge(global_stats, on='_grp_key',  how='left')

    use_year = df['q_count'] >= 8
    df['mean_r'] = np.where(use_year, df['q_mean'], df['g_mean']).astype(float)
    df['std_r']  = np.where(
        use_year,
        df['q_std'].clip(lower=1e-6),
        df['g_std'].clip(lower=1e-6),
    ).astype(float)
    df['std_r'] = df['std_r'].fillna(1e-6)

    z = (df['raw'] - df['mean_r']) / df['std_r']
    # Cap at 18 per season (≈ legendary MVP-calibre year) so thin position
    # pools or hybrid players don't produce absurdly high z-scores.
    df['fdv_season'] = np.minimum(18.0, np.maximum(0.0, 6 + 3 * z)) * df['game_ratio'] * weight

    return df[['player_id', 'season', 'fdv_season']].reset_index(drop=True)


def build_fdv(engine) -> pd.DataFrame:
    """Main computation. Returns DataFrame[player_id, fdv]."""
    CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']

    # Load all tables upfront in one burst so the DB connection doesn't time out
    # between reads while Python is busy with computation.
    print('Loading tables…')
    raw_tables: dict[str, pd.DataFrame] = {}
    for cat in CATEGORIES:
        print(f'  {cat}…', end=' ', flush=True)
        try:
            df = pd.read_sql(f'SELECT * FROM {cat}_seasons', engine)
            raw_tables[cat] = df
            print(f'{len(df):,} rows')
        except Exception as exc:
            print(f'SKIP ({exc})')
    engine.dispose()  # release all pooled connections before heavy computation

    print('Computing FDV…')
    all_season_fdv: list[pd.DataFrame] = []
    for cat in CATEGORIES:
        if cat not in raw_tables or raw_tables[cat].empty:
            continue
        print(f'  {cat}…', end=' ', flush=True)
        cat_fdv = _fdv_for_category(raw_tables[cat], cat)
        cat_fdv['category'] = cat
        all_season_fdv.append(cat_fdv)
        print(f'{len(cat_fdv):,} player-seasons')

    if not all_season_fdv:
        return pd.DataFrame(columns=['player_id', 'fdv'])

    all_df = pd.concat(all_season_fdv, ignore_index=True)

    primary = all_df[all_df['category'] != 'returns']
    returns = all_df[all_df['category'] == 'returns']

    best_primary = (
        primary.groupby(['player_id', 'season'])['fdv_season']
        .max().reset_index().rename(columns={'fdv_season': 'fdv_primary'})
    )
    ret_bonus = (
        returns.groupby(['player_id', 'season'])['fdv_season']
        .sum().reset_index().rename(columns={'fdv_season': 'fdv_returns'})
    )

    merged = best_primary.merge(ret_bonus, on=['player_id', 'season'], how='outer')
    merged['fdv_primary'] = merged['fdv_primary'].fillna(0)
    merged['fdv_returns'] = merged['fdv_returns'].fillna(0)
    merged['fdv_total']   = merged['fdv_primary'] + merged['fdv_returns']

    def _career(grp):
        s    = grp['fdv_total'].values
        base  = float(s.sum())
        top3  = sorted(s, reverse=True)[:3]
        bonus = 0.10 * sum(top3)
        return round(base + bonus, 1)

    career = (
        merged.groupby('player_id')
        .apply(_career)
        .reset_index()
        .rename(columns={0: 'fdv'})
    )
    return career


def main():
    parser = argparse.ArgumentParser(description='Compute FDV for all players')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print top results without writing to the DB')
    args = parser.parse_args()

    engine = get_engine()

    print('Computing FDV…')
    career_fdv = build_fdv(engine)

    if career_fdv.empty:
        print('No data. Nothing to write.')
        return

    players_df = pd.read_sql(
        'SELECT player_id, player_name, pos FROM players', engine
    )
    val = career_fdv.merge(players_df, on='player_id', how='left')
    val = val.sort_values('fdv', ascending=False)

    print(f'\n{len(career_fdv):,} players computed.')
    print('\nDistribution:')
    print(career_fdv['fdv'].describe().round(1).to_string())

    print('\nTop 30 by FDV:')
    for _, row in val.head(30).iterrows():
        print(f"  {str(row['player_name']):<28}  {str(row['pos'] or ''):<4}  {row['fdv']:.1f}")

    if args.dry_run:
        print('\n[dry-run] DB not modified.')
        return

    print('\nWriting to players.fdv…')
    with engine.begin() as conn:
        conn.execute(text(
            'ALTER TABLE players ADD COLUMN IF NOT EXISTS fdv NUMERIC(6,1)'
        ))
        for _, row in career_fdv.iterrows():
            conn.execute(
                text('UPDATE players SET fdv = :fdv WHERE player_id = :pid'),
                {'fdv': row['fdv'], 'pid': row['player_id']},
            )
    print('Done.')


if __name__ == '__main__':
    main()
