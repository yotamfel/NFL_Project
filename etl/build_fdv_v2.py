"""
etl/build_fdv_v2.py
===================
FDV v2 — improved Fourth & Data Value metric.

Changes from v1
----------------
1. **Steeper longevity decay**: top-10 seasons at 100 %, seasons 11-13 at 40 %,
   seasons 14+ at 25 %.  Prevents long-but-mediocre careers from approaching
   shorter dominant ones.
2. **Dual-threat bonus**: instead of max(primary categories), a player gets
   best_primary + 0.30 × second_best_primary.  Rewards QBs who rush, LBs who
   cover, etc.
3. **Missing-stat redistribution (defense)**: when TFL / QB hits are NULL
   (pre-1999 data), their formula weight is redistributed to sacks and tackles
   so older defenders aren't penalised by missing columns.
4. **Playoff bonus**: 5 % of a player's total playoff FDV (computed identically
   to regular-season FDV) is added to their career total.
5. **Cap per season**: 18 FDV (unchanged from v1).

Career formula
--------------
  season_fdv     = max(0, 6 + 3×z) × game_ratio   (capped at 18)
  season_total   = best_primary + 0.30 × 2nd_primary + returns_bonus
  career_fdv     = Σ(season_total × decay_weight) + 0.05 × Σ(playoff_fdv)

  decay_weight:  rank 1-10 → 1.0,  rank 11-13 → 0.40,  rank 14+ → 0.25

Usage
-----
  python etl/build_fdv_v2.py              # compute and print top 50 (dry-run)
  python etl/build_fdv_v2.py --write      # write to players.fdv column
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine


# ── Era: maximum regular-season games per year ────────────────────────────────
def _max_games(year: int) -> int:
    if year >= 2021:
        return 17
    if year >= 1978:
        return 16
    return 14


# ── Raw score formulas ────────────────────────────────────────────────────────

def _raw_passing(df: pd.DataFrame) -> pd.Series:
    att  = df['att'].fillna(0)
    yds  = df['yds'].fillna(0)
    td   = df['td'].fillna(0)
    int_ = df['int'].fillna(0)
    gwd  = df['gwd'].fillna(0)  if 'gwd'  in df.columns else pd.Series(0, index=df.index)
    qc   = df['_4qc'].fillna(0) if '_4qc' in df.columns else pd.Series(0, index=df.index)

    if 'any_per_a' in df.columns:
        any_a = df['any_per_a'].where(
            df['any_per_a'].notna(),
            (yds + 20 * td - 45 * int_) / att.clip(lower=1),
        ).fillna(0)
    else:
        any_a = (yds + 20 * td - 45 * int_) / att.clip(lower=1)

    return (any_a * att / 10) + gwd * 3 + qc * 2


def _raw_offense(df: pd.DataFrame) -> pd.Series:
    rush_yds = df.get('rush_yds', pd.Series(0, index=df.index)).fillna(0)
    rush_td  = df.get('rush_td',  pd.Series(0, index=df.index)).fillna(0)
    rec_yds  = df.get('rec_yds',  pd.Series(0, index=df.index)).fillna(0)
    rec_td   = df.get('rec_td',   pd.Series(0, index=df.index)).fillna(0)
    rec      = df.get('rec',      pd.Series(0, index=df.index)).fillna(0)
    fmb      = df.get('fmb',      pd.Series(0, index=df.index)).fillna(0)
    return rush_yds * 0.06 + rush_td * 5 + rec_yds * 0.07 + rec_td * 7 + rec * 0.5 - fmb * 2


def _raw_defense(df: pd.DataFrame) -> pd.Series:
    """Defense raw score with missing-column weight redistribution.

    When TFL or QB hits are entirely NULL (pre-1999 data), their weight is
    redistributed: TFL weight → sacks, QB hits weight → sacks.  This keeps
    older defenders competitive with modern ones who benefit from fuller stats.
    """
    sk      = df.get('sk',      pd.Series(0, index=df.index)).fillna(0)
    int_    = df.get('int',     pd.Series(0, index=df.index)).fillna(0)
    pd_     = df.get('pd',      pd.Series(0, index=df.index)).fillna(0)
    ff      = df.get('ff',      pd.Series(0, index=df.index)).fillna(0)
    comb    = df.get('comb',    pd.Series(0, index=df.index)).fillna(0)
    sfty    = df.get('sfty',    pd.Series(0, index=df.index)).fillna(0)

    tfl_col     = df.get('tfl',     pd.Series(np.nan, index=df.index))
    qbhits_col  = df.get('qb_hits', pd.Series(np.nan, index=df.index))

    tfl     = tfl_col.fillna(0)
    qb_hits = qbhits_col.fillna(0)

    # Per-row redistribution: if a row's TFL is NaN, boost sack weight
    tfl_missing    = tfl_col.isna()
    qbhits_missing = qbhits_col.isna()

    sk_weight   = 8.0 + np.where(tfl_missing, 3.0, 0.0) + np.where(qbhits_missing, 1.5, 0.0)
    tfl_weight  = np.where(tfl_missing, 0.0, 3.0)
    qbh_weight  = np.where(qbhits_missing, 0.0, 1.5)

    return (sk * sk_weight + int_ * 8 + pd_ * 2 + ff * 4 +
            tfl * tfl_weight + comb * 0.25 + qb_hits * qbh_weight + sfty * 6)


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

# ── Defense position sub-groups ───────────────────────────────────────────────
_PASS_RUSH_POS = frozenset({
    'DE', 'LDE', 'RDE', 'OLB', 'LOLB', 'ROLB', 'LLB', 'RLB',
})
_COVERAGE_POS  = frozenset({'CB', 'LCB', 'RCB', 'NCB', 'DB', 'S', 'FS', 'SS'})
_DT_POS        = frozenset({'DT', 'NT', 'LDT', 'RDT'})


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


def _qualify(df: pd.DataFrame, category: str) -> pd.Series:
    if category == 'passing':
        return df['att'].fillna(0) >= 200
    if category == 'offense':
        att = df['att'].fillna(0)
        rec = df.get('rec', pd.Series(0, index=df.index)).fillna(0)
        return (att + rec) >= 30
    if category == 'defense':
        return df['g'].fillna(0) >= 13
    if category == 'kicking':
        return df.get('fga_total', pd.Series(0, index=df.index)).fillna(0) >= 10
    if category == 'punting':
        return df.get('pnt', pd.Series(0, index=df.index)).fillna(0) >= 15
    if category == 'returns':
        kr = df.get('kick_ret', pd.Series(0, index=df.index)).fillna(0)
        pr = df.get('punt_ret', pd.Series(0, index=df.index)).fillna(0)
        return (kr + pr) >= 10
    return pd.Series(True, index=df.index)


# Playoff qualification is looser — fewer games
def _qualify_playoff(df: pd.DataFrame, category: str) -> pd.Series:
    if category == 'passing':
        return df['att'].fillna(0) >= 30
    if category == 'offense':
        att = df['att'].fillna(0)
        rec = df.get('rec', pd.Series(0, index=df.index)).fillna(0)
        return (att + rec) >= 5
    if category == 'defense':
        return df['g'].fillna(0) >= 1
    if category == 'kicking':
        return df.get('fga_total', pd.Series(0, index=df.index)).fillna(0) >= 1
    if category == 'punting':
        return df.get('pnt', pd.Series(0, index=df.index)).fillna(0) >= 1
    if category == 'returns':
        kr = df.get('kick_ret', pd.Series(0, index=df.index)).fillna(0)
        pr = df.get('punt_ret', pd.Series(0, index=df.index)).fillna(0)
        return (kr + pr) >= 1
    return pd.Series(True, index=df.index)


def _fdv_for_category(df: pd.DataFrame, category: str,
                      qualify_fn=None) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=['player_id', 'season', 'fdv_season'])

    if qualify_fn is None:
        qualify_fn = _qualify

    df = df.copy()
    df['raw'] = _RAW_FUNCS[category](df).fillna(0).clip(lower=0)
    df['game_ratio'] = (
        df['g'].fillna(0) / df['season'].apply(_max_games)
    ).clip(0, 1.0)

    q_mask = qualify_fn(df, category)
    weight = 0.4 if category == 'returns' else 1.0

    if category == 'defense' and 'pos' in df.columns:
        df['_grp_key'] = df['pos'].apply(_def_group)
    else:
        df['_grp_key'] = 'all'
    norm_cols = ['_grp_key', 'season']

    df_q = df[q_mask]

    year_stats = (
        df_q.groupby(norm_cols)['raw']
        .agg(q_mean='mean', q_std='std', q_count='count')
        .reset_index()
    )
    global_stats = (
        df_q.groupby('_grp_key')['raw']
        .agg(g_mean='mean', g_std='std')
        .reset_index()
    )

    df = df.merge(year_stats,   on=norm_cols,  how='left')
    df = df.merge(global_stats, on='_grp_key', how='left')

    use_year = df['q_count'] >= 8
    df['mean_r'] = np.where(use_year, df['q_mean'], df['g_mean']).astype(float)
    df['std_r']  = np.where(
        use_year,
        df['q_std'].clip(lower=1e-6),
        df['g_std'].clip(lower=1e-6),
    ).astype(float)
    df['std_r'] = df['std_r'].fillna(1e-6)

    z = (df['raw'] - df['mean_r']) / df['std_r']
    df['fdv_season'] = np.minimum(18.0, np.maximum(0.0, 6 + 3 * z)) * df['game_ratio'] * weight

    return df[['player_id', 'season', 'fdv_season']].reset_index(drop=True)


# ── Aggregate season FDV across categories ────────────────────────────────────

def _aggregate_seasons(all_season_fdv: list[pd.DataFrame]) -> pd.DataFrame:
    """Combine per-category season FDVs with dual-threat bonus.

    Returns DataFrame[player_id, season, fdv_total].
    """
    if not all_season_fdv:
        return pd.DataFrame(columns=['player_id', 'season', 'fdv_total'])

    all_df = pd.concat(all_season_fdv, ignore_index=True)

    primary = all_df[all_df['category'] != 'returns']
    returns = all_df[all_df['category'] == 'returns']

    # --- Dual-threat: best + 30 % of second-best primary ---
    primary_wide = (
        primary.groupby(['player_id', 'season', 'category'])['fdv_season']
        .max().reset_index()
    )
    primary_ranked = (
        primary_wide.sort_values('fdv_season', ascending=False)
        .groupby(['player_id', 'season'])
    )

    best = primary_ranked.nth(0).rename(columns={'fdv_season': 'fdv_1st'})[['player_id', 'season', 'fdv_1st']]
    second = primary_ranked.nth(1)
    if not second.empty:
        second = second.rename(columns={'fdv_season': 'fdv_2nd'})[['player_id', 'season', 'fdv_2nd']]
    else:
        second = pd.DataFrame(columns=['player_id', 'season', 'fdv_2nd'])

    merged = best.merge(second, on=['player_id', 'season'], how='left')
    merged['fdv_2nd'] = merged['fdv_2nd'].fillna(0)
    merged['fdv_primary'] = merged['fdv_1st'] + 0.30 * merged['fdv_2nd']

    # --- Returns bonus ---
    ret_bonus = (
        returns.groupby(['player_id', 'season'])['fdv_season']
        .sum().reset_index().rename(columns={'fdv_season': 'fdv_returns'})
    )

    result = merged.merge(ret_bonus, on=['player_id', 'season'], how='outer')
    result['fdv_primary'] = result['fdv_primary'].fillna(0)
    result['fdv_returns'] = result['fdv_returns'].fillna(0)
    result['fdv_total']   = result['fdv_primary'] + result['fdv_returns']

    return result[['player_id', 'season', 'fdv_total']]


def _career_from_seasons(season_df: pd.DataFrame) -> pd.DataFrame:
    """Apply longevity decay and sum to career FDV."""
    if season_df.empty:
        return pd.DataFrame(columns=['player_id', 'fdv'])

    s = season_df.sort_values(['player_id', 'fdv_total'], ascending=[True, False]).copy()
    s['_rank'] = s.groupby('player_id').cumcount() + 1

    # Steeper decay: 100 % for top-10, 40 % for 11-13, 25 % for 14+
    s['_w'] = np.where(
        s['_rank'] <= 10, 1.0,
        np.where(s['_rank'] <= 13, 0.40, 0.25)
    )
    s['_wfdv'] = s['fdv_total'] * s['_w']

    career = (
        s.groupby('player_id')['_wfdv']
        .sum().reset_index()
        .rename(columns={'_wfdv': 'fdv'})
    )
    career['fdv'] = pd.to_numeric(career['fdv'], errors='coerce').fillna(0).round(1)
    return career


# ── Main build ────────────────────────────────────────────────────────────────

def build_fdv_v2(engine) -> pd.DataFrame:
    CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']

    # --- Load regular season tables ---
    print('Loading regular-season tables…')
    raw_tables: dict[str, pd.DataFrame] = {}
    for cat in CATEGORIES:
        print(f'  {cat}…', end=' ', flush=True)
        try:
            df = pd.read_sql(f'SELECT * FROM {cat}_seasons', engine)
            raw_tables[cat] = df
            print(f'{len(df):,} rows')
        except Exception as exc:
            print(f'SKIP ({exc})')

    # --- Load playoff tables ---
    print('Loading playoff tables…')
    playoff_tables: dict[str, pd.DataFrame] = {}
    for cat in CATEGORIES:
        table_name = f'{cat}_playoff_seasons'
        print(f'  {table_name}…', end=' ', flush=True)
        try:
            df = pd.read_sql(f'SELECT * FROM {table_name}', engine)
            playoff_tables[cat] = df
            print(f'{len(df):,} rows')
        except Exception as exc:
            print(f'SKIP ({exc})')

    engine.dispose()

    # --- Regular season FDV ---
    print('\nComputing regular-season FDV…')
    reg_season_fdv: list[pd.DataFrame] = []
    for cat in CATEGORIES:
        if cat not in raw_tables or raw_tables[cat].empty:
            continue
        print(f'  {cat}…', end=' ', flush=True)
        cat_fdv = _fdv_for_category(raw_tables[cat], cat)
        cat_fdv['category'] = cat
        reg_season_fdv.append(cat_fdv)
        print(f'{len(cat_fdv):,} player-seasons')

    reg_seasons = _aggregate_seasons(reg_season_fdv)
    reg_career = _career_from_seasons(reg_seasons)

    # --- Playoff FDV (5 % bonus) ---
    print('\nComputing playoff FDV…')
    po_season_fdv: list[pd.DataFrame] = []
    for cat in CATEGORIES:
        if cat not in playoff_tables or playoff_tables[cat].empty:
            continue
        print(f'  {cat}…', end=' ', flush=True)
        cat_fdv = _fdv_for_category(
            playoff_tables[cat], cat, qualify_fn=_qualify_playoff
        )
        cat_fdv['category'] = cat
        po_season_fdv.append(cat_fdv)
        print(f'{len(cat_fdv):,} player-seasons')

    if po_season_fdv:
        po_seasons = _aggregate_seasons(po_season_fdv)
        po_career = (
            po_seasons.groupby('player_id')['fdv_total']
            .sum().round(1).reset_index()
            .rename(columns={'fdv_total': 'playoff_fdv'})
        )
    else:
        po_career = pd.DataFrame(columns=['player_id', 'playoff_fdv'])

    # --- Combine ---
    career = reg_career.merge(po_career, on='player_id', how='left')
    career['playoff_fdv'] = pd.to_numeric(career['playoff_fdv'], errors='coerce').fillna(0)
    career['fdv'] = pd.to_numeric(career['fdv'], errors='coerce').fillna(0)
    career['fdv'] = (career['fdv'] + 0.05 * career['playoff_fdv']).round(1)

    return career


def main():
    parser = argparse.ArgumentParser(description='Compute FDV v2 for all players')
    parser.add_argument('--write', action='store_true',
                        help='Write results to players.fdv column')
    args = parser.parse_args()

    engine = get_engine()
    players_df = pd.read_sql('SELECT player_id, player_name, pos FROM players', engine)

    # Also load v1 for comparison
    try:
        v1_df = pd.read_sql('SELECT player_id, fdv as fdv_v1 FROM players WHERE fdv IS NOT NULL', engine)
    except Exception:
        v1_df = pd.DataFrame(columns=['player_id', 'fdv_v1'])

    career_fdv = build_fdv_v2(engine)

    if career_fdv.empty:
        print('No data.')
        return

    val = career_fdv.merge(players_df, on='player_id', how='left')
    val = val.merge(v1_df, on='player_id', how='left')
    val['fdv_v1'] = val['fdv_v1'].fillna(0)
    val['delta'] = val['fdv'] - val['fdv_v1']
    val = val.sort_values('fdv', ascending=False)

    print(f'\n{"="*70}')
    print(f'FDV v2 -- {len(career_fdv):,} players computed')
    print(f'{"="*70}')

    print('\nDistribution:')
    print(career_fdv['fdv'].describe().round(1).to_string())

    print(f'\n{"-"*70}')
    print(f'  {"#":<4} {"Player":<28} {"Pos":<5} {"FDV v2":>8} {"FDV v1":>8} {"Delta":>8}')
    print(f'{"-"*70}')
    for i, (_, row) in enumerate(val.head(50).iterrows(), 1):
        name = str(row['player_name'])[:27]
        pos  = str(row['pos'] or '')[:4]
        v2   = row['fdv']
        v1   = row['fdv_v1']
        d    = row['delta']
        sign = '+' if d > 0 else ''
        print(f'  {i:<4} {name:<28} {pos:<5} {v2:>8.1f} {v1:>8.1f} {sign}{d:>7.1f}')

    if not args.write:
        print(f'\n[dry-run] DB not modified. Use --write to save.')
        return

    print('\nWriting to players.fdv…')
    engine2 = get_engine()
    with engine2.begin() as conn:
        conn.execute(text(
            'ALTER TABLE players ADD COLUMN IF NOT EXISTS fdv NUMERIC(6,1)'
        ))
        for _, row in career_fdv.iterrows():
            conn.execute(
                text('UPDATE players SET fdv = :fdv WHERE player_id = :pid'),
                {'fdv': row['fdv'], 'pid': row['player_id']},
            )
    print('Done — players.fdv updated.')


if __name__ == '__main__':
    main()
