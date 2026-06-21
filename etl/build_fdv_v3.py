"""
etl/build_fdv_v3.py  --  Position-based FDV v3

Architecture:
  1. Each position group (QB, RB, WR, TE, EDGE, DT, LB, CB, S, K, P)
     has a tailored formula for the stats that matter at that role.
  2. Season raw scores are z-scored within (position_group, year).
  3. Career FDV = longevity-decayed sum of season FDVs + 25% returns bonus.
  4. Cross-position normalisation: career FDV is z-scored within position
     group and mapped to a common scale.  Equal z across positions = equal FDV.

Scale (after normalisation):
  < 30   Depth / minimal impact
  30-50  Backup / role player
  50-70  Solid starter career
  70-90  Pro Bowl level
  90-110 Star / borderline HOF
  110+   Hall of Fame / all-time great

Usage:
  python etl/build_fdv_v3.py              # dry-run, print top 50
  python etl/build_fdv_v3.py --write      # write to players.fdv
"""
import argparse, sys
from pathlib import Path
import numpy as np, pandas as pd
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine

def _max_games(yr):
    if yr >= 2021: return 17
    if yr >= 1978: return 16
    return 14

# ── position mapping ──────────────────────────────────────────────────────
_EDGE = frozenset({'DE','LDE','RDE','OLB','LOLB','ROLB','LLB','RLB'})
_DTP  = frozenset({'DT','NT','LDT','RDT'})
_CBP  = frozenset({'CB','LCB','RCB','NCB','DB'})
_SP   = frozenset({'S','FS','SS'})

def _map_def(pos):
    if pd.isna(pos): return 'LB'
    p = str(pos).upper().strip()
    if p in _EDGE: return 'EDGE'
    if p in _DTP:  return 'DT'
    if p in _CBP:  return 'CB'
    if p in _SP:   return 'S'
    return 'LB'

_OFF_MAP = {'RB':'RB','FB':'RB','HB':'RB','WR':'WR','FL':'WR','SE':'WR','TE':'TE'}

_ALL_POS = {
    'QB':'QB',
    'RB':'RB','FB':'RB','HB':'RB',
    'WR':'WR','FL':'WR','SE':'WR',
    'TE':'TE',
    'DE':'EDGE','LDE':'EDGE','RDE':'EDGE',
    'OLB':'EDGE','LOLB':'EDGE','ROLB':'EDGE','LLB':'EDGE','RLB':'EDGE',
    'DT':'DT','NT':'DT','LDT':'DT','RDT':'DT',
    'LB':'LB','ILB':'LB','MLB':'LB','RILB':'LB','LILB':'LB',
    'CB':'CB','LCB':'CB','RCB':'CB','NCB':'CB','DB':'CB',
    'S':'S','FS':'S','SS':'S',
    'K':'K','PK':'K',
    'P':'P',
}

# ── helpers ───────────────────────────────────────────────────────────────
def _s(df, col, fill=0):
    return df.get(col, pd.Series(fill, index=df.index)).fillna(fill)

def _sn(df, col):
    return df.get(col, pd.Series(np.nan, index=df.index))

# ── raw formulas per position ─────────────────────────────────────────────
def _raw_qb(df):
    att=df['att'].fillna(0); yds=df['yds'].fillna(0)
    td=df['td'].fillna(0); i=df['int'].fillna(0)
    gwd=_s(df,'gwd'); qc=_s(df,'_4qc')
    if 'any_per_a' in df.columns:
        any_a=df['any_per_a'].where(df['any_per_a'].notna(),
                (yds+20*td-45*i)/att.clip(lower=1)).fillna(0)
    else:
        any_a=(yds+20*td-45*i)/att.clip(lower=1)
    return (any_a*att/10)+gwd*3+qc*2+_s(df,'rush_yds')*0.04+_s(df,'rush_td')*3

def _raw_rb(df):
    return (_s(df,'rush_yds')*0.08+_s(df,'rush_td')*6+_s(df,'rec')*0.3
            +_s(df,'rec_yds')*0.06+_s(df,'rec_td')*5-_s(df,'fmb')*3)

def _raw_wr(df):
    return (_s(df,'rec_yds')*0.09+_s(df,'rec_td')*7+_s(df,'rec')*0.5
            +_s(df,'rush_yds')*0.03+_s(df,'rush_td')*3-_s(df,'fmb')*2)

def _raw_te(df):
    return _s(df,'rec_yds')*0.10+_s(df,'rec_td')*8+_s(df,'rec')*0.6-_s(df,'fmb')*2

def _def_redist(df, sk_b, tfl_b, qbh_b, extra):
    sk=_s(df,'sk'); tc=_sn(df,'tfl'); qc=_sn(df,'qb_hits')
    tfl=tc.fillna(0); qbh=qc.fillna(0)
    tm=tc.isna(); qm=qc.isna()
    sw=sk_b+np.where(tm,tfl_b,0.0)+np.where(qm,qbh_b,0.0)
    tw=np.where(tm,0.0,tfl_b); qw=np.where(qm,0.0,qbh_b)
    return sk*sw+tfl*tw+qbh*qw+extra

def _raw_edge(df):
    return _def_redist(df,10,4,2,
        _s(df,'ff')*5+_s(df,'int')*5+_s(df,'pd')*1.5+_s(df,'comb')*0.1+_s(df,'sfty')*6)

def _raw_dt(df):
    return _def_redist(df,9,5,3,
        _s(df,'ff')*5+_s(df,'comb')*0.3+_s(df,'pd')*1+_s(df,'sfty')*6)

def _raw_lb(df):
    sk=_s(df,'sk'); comb=_s(df,'comb')
    tc=_sn(df,'tfl'); tfl=tc.fillna(0); tm=tc.isna()
    sw=np.where(tm,7.5,6.0); cw=np.where(tm,0.65,0.5); tw=np.where(tm,0.0,4.0)
    return (sk*sw+comb*cw+tfl*tw+_s(df,'int')*7+_s(df,'pd')*2.5
            +_s(df,'ff')*4+_s(df,'sfty')*6)

def _raw_cb(df):
    return (_s(df,'int')*10+_s(df,'pd')*3+_s(df,'ff')*4
            +_s(df,'comb')*0.2+_s(df,'sk')*3+_s(df,'sfty')*6)

def _raw_safety(df):
    return _def_redist(df,5,3,1.5,
        _s(df,'int')*8+_s(df,'pd')*2.5+_s(df,'comb')*0.3+_s(df,'ff')*4+_s(df,'sfty')*6)

def _raw_kicking(df):
    fgm=_s(df,'fgm_total'); fga=_s(df,'fga_total')
    return fgm*5+_s(df,'fgm_50_plus')*4+_s(df,'xpm')*0.4-(fga-fgm)*3

def _raw_punting(df):
    return _s(df,'netyds')*0.015+_s(df,'pnt20')*2.5-_s(df,'blck')*4

def _raw_returns(df):
    return (_s(df,'kick_ret_yds')*0.02+_s(df,'punt_ret_yds')*0.025
            +(_s(df,'kick_ret_td')+_s(df,'punt_ret_td'))*8)

_RAW = {'QB':_raw_qb,'RB':_raw_rb,'WR':_raw_wr,'TE':_raw_te,
        'EDGE':_raw_edge,'DT':_raw_dt,'LB':_raw_lb,'CB':_raw_cb,'S':_raw_safety,
        'K':_raw_kicking,'P':_raw_punting}

_QUAL = {
    'QB':   lambda d: d['att'].fillna(0)>=200,
    'RB':   lambda d: d['att'].fillna(0)>=50,
    'WR':   lambda d: _s(d,'rec')>=20,
    'TE':   lambda d: _s(d,'rec')>=15,
    'EDGE': lambda d: d['g'].fillna(0)>=10,
    'DT':   lambda d: d['g'].fillna(0)>=10,
    'LB':   lambda d: d['g'].fillna(0)>=10,
    'CB':   lambda d: d['g'].fillna(0)>=10,
    'S':    lambda d: d['g'].fillna(0)>=10,
    'K':    lambda d: _s(d,'fga_total')>=10,
    'P':    lambda d: _s(d,'pnt')>=15,
}

# ── season FDV for one position group ─────────────────────────────────────
def _season_fdv(df, grp):
    if df.empty:
        return pd.DataFrame(columns=['player_id','season','fdv_season'])
    df = df.copy()
    df['raw'] = _RAW[grp](df).fillna(0).clip(lower=0)
    df['gr'] = (df['g'].fillna(0)/df['season'].apply(_max_games)).clip(0,1)
    q = _QUAL[grp](df)
    dq = df[q]
    if dq.empty:
        df['fdv_season'] = 0.0
        return df[['player_id','season','fdv_season']].reset_index(drop=True)
    ys = dq.groupby('season')['raw'].agg(qm='mean',qs='std',qc='count').reset_index()
    gm = float(dq['raw'].mean())
    gs = max(float(dq['raw'].std()), 1e-6)
    df = df.merge(ys, on='season', how='left')
    ok = df['qc'].fillna(0)>=8
    mn = np.where(ok, df['qm'], gm).astype(float)
    sd = np.where(ok, np.maximum(df['qs'].fillna(gs),1e-6), gs).astype(float)
    z = (df['raw']-mn)/sd
    df['fdv_season'] = np.minimum(18.0, np.maximum(0.0, 6+3*z))*df['gr']
    return df[['player_id','season','fdv_season']].reset_index(drop=True)

# ── main build ────────────────────────────────────────────────────────────
def _draft_multipliers(engine, pid_grp):
    """Compute positional value multipliers from historical draft capital.

    Composite of two signals:
      - inverse mean draft pick (how early is the position picked on average)
      - round-1 frequency (what % of picks at this position are in round 1)
    Scaled to [0.70, 1.20].
    """
    try:
        draft = pd.read_sql('SELECT player_id, pick FROM draft', engine)
    except Exception:
        return {}
    draft['grp'] = draft['player_id'].map(pid_grp)
    draft = draft[draft['grp'].isin(_ALL_POS.values()) & draft['pick'].notna()]
    if draft.empty:
        return {}
    st = draft.groupby('grp').agg(
        mean_pick=('pick','mean'),
        pct_rd1=('pick', lambda x: (x <= 32).mean()),
    )
    inv = 1.0 / st['mean_pick']
    n1 = (inv - inv.min()) / max(inv.max() - inv.min(), 1e-9)
    n2 = (st['pct_rd1'] - st['pct_rd1'].min()) / max(st['pct_rd1'].max() - st['pct_rd1'].min(), 1e-9)
    mults = (0.70 + ((n1 + n2) / 2) * 0.50)
    return mults.round(3).to_dict()


def build_fdv_v3(engine):
    print('Loading tables...')
    passing = pd.read_sql('SELECT * FROM passing_seasons', engine)
    offense = pd.read_sql('SELECT * FROM offense_seasons', engine)
    defense = pd.read_sql('SELECT * FROM defense_seasons', engine)
    kicking = pd.read_sql('SELECT * FROM kicking_seasons', engine)
    punting = pd.read_sql('SELECT * FROM punting_seasons', engine)
    returns = pd.read_sql('SELECT * FROM returns_seasons', engine)
    players = pd.read_sql('SELECT player_id, player_name, pos FROM players', engine)


    # Assign each player to exactly one position group via players.pos
    players['grp'] = players['pos'].apply(
        lambda p: _ALL_POS.get(str(p).upper().strip(),'') if pd.notna(p) else '')
    pid_grp = players.set_index('player_id')['grp'].to_dict()

    print('Computing draft-based multipliers...')
    mults = _draft_multipliers(engine, pid_grp)
    for g in ['QB','RB','WR','TE','EDGE','DT','LB','CB','S','K','P']:
        print(f'  {g:>5}: x{mults.get(g, 1.0):.3f}')
    engine.dispose()

    def _ids(grp):
        return {pid for pid, g in pid_grp.items() if g == grp}

    # QB: passing + rush stats from offense
    qb_ids = _ids('QB')
    qb_data = passing[passing['player_id'].isin(qb_ids)].copy()
    if not offense.empty:
        rcols = ['player_id','season']
        for c in ['rush_yds','rush_td']:
            if c in offense.columns: rcols.append(c)
        if len(rcols) > 2:
            rush = offense[offense['player_id'].isin(qb_ids)][rcols].drop_duplicates(
                subset=['player_id','season'])
            qb_data = qb_data.merge(rush, on=['player_id','season'], how='left')

    groups = {
        'QB':   qb_data,
        'RB':   offense[offense['player_id'].isin(_ids('RB'))].copy(),
        'WR':   offense[offense['player_id'].isin(_ids('WR'))].copy(),
        'TE':   offense[offense['player_id'].isin(_ids('TE'))].copy(),
        'EDGE': defense[defense['player_id'].isin(_ids('EDGE'))].copy(),
        'DT':   defense[defense['player_id'].isin(_ids('DT'))].copy(),
        'LB':   defense[defense['player_id'].isin(_ids('LB'))].copy(),
        'CB':   defense[defense['player_id'].isin(_ids('CB'))].copy(),
        'S':    defense[defense['player_id'].isin(_ids('S'))].copy(),
        'K':    kicking[kicking['player_id'].isin(_ids('K'))].copy(),
        'P':    punting[punting['player_id'].isin(_ids('P'))].copy(),
    }

    print('Computing season FDV per position...')
    all_season = []
    for grp, data in groups.items():
        if data.empty:
            print(f'  {grp}: 0 rows'); continue
        sfdv = _season_fdv(data, grp)
        sfdv['pos_group'] = grp
        print(f'  {grp}: {len(sfdv):,} player-seasons')
        all_season.append(sfdv)

    if not all_season:
        return pd.DataFrame()
    season_df = pd.concat(all_season, ignore_index=True)

    # Returns bonus (25 %)
    if not returns.empty:
        r = returns.copy()
        r['raw'] = _raw_returns(r).fillna(0).clip(lower=0)
        r['gr'] = (r['g'].fillna(0)/r['season'].apply(_max_games)).clip(0,1)
        q = (_s(r,'kick_ret')+_s(r,'punt_ret'))>=10
        dq = r[q]
        if not dq.empty:
            ys = dq.groupby('season')['raw'].agg(qm='mean',qs='std',qc='count').reset_index()
            gm=float(dq['raw'].mean()); gs=max(float(dq['raw'].std()),1e-6)
            r = r.merge(ys, on='season', how='left')
            ok = r['qc'].fillna(0)>=8
            mn = np.where(ok, r['qm'], gm).astype(float)
            sd = np.where(ok, np.maximum(r['qs'].fillna(gs),1e-6), gs).astype(float)
            z = (r['raw']-mn)/sd
            r['ret_fdv'] = np.minimum(18.0, np.maximum(0.0, 6+3*z))*r['gr']*0.25
            rb = r.groupby(['player_id','season'])['ret_fdv'].sum().reset_index()
            season_df = season_df.merge(rb, on=['player_id','season'], how='left')
            season_df['fdv_season'] += season_df['ret_fdv'].fillna(0)
            season_df.drop(columns='ret_fdv', inplace=True)

    # Best position per season (if player appears in multiple groups)
    best = (season_df.sort_values('fdv_season', ascending=False)
            .groupby(['player_id','season']).first().reset_index())

    # Career with decay: top-10 x1.0, 11-13 x0.50, 14+ x0.30
    s = best.sort_values(['player_id','fdv_season'], ascending=[True,False]).copy()
    s['_r'] = s.groupby('player_id').cumcount()+1
    s['_w'] = np.where(s['_r']<=10, 1.0, np.where(s['_r']<=13, 0.50, 0.30))
    s['_wf'] = s['fdv_season']*s['_w']

    career = s.groupby('player_id')['_wf'].sum().reset_index().rename(columns={'_wf':'career_fdv'})
    career['career_fdv'] = pd.to_numeric(career['career_fdv'], errors='coerce').fillna(0)

    # Position from players table (authoritative)
    pm = players[['player_id','grp']].rename(columns={'grp':'pos_group'})
    career = career.merge(pm, on='player_id', how='left')

    # Cross-position normalisation: z-score within group -> common scale
    print('Normalising across positions...')
    parts = []
    for grp, gdf in career.groupby('pos_group'):
        gdf = gdf.copy()
        mn = gdf['career_fdv'].mean()
        sd = max(gdf['career_fdv'].std(), 1e-6)
        gdf['fdv'] = np.maximum(0, 50+25*((gdf['career_fdv']-mn)/sd)).round(1)
        n = len(gdf)
        top = gdf.nlargest(1,'fdv')['fdv'].iloc[0] if n else 0
        print(f'  {grp:>5}: {n:>5} players, mean_raw={mn:.1f}, top_fdv={top:.1f}')
        parts.append(gdf)

    final = pd.concat(parts, ignore_index=True)

    # Apply draft-based positional value multipliers
    if mults:
        final['mult'] = final['pos_group'].map(mults).fillna(1.0)
        final['fdv'] = (final['fdv'] * final['mult']).round(1)
        final.drop(columns='mult', inplace=True)

    return final[['player_id','pos_group','career_fdv','fdv']]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    engine = get_engine()
    players = pd.read_sql('SELECT player_id, player_name, pos FROM players', engine)
    try:
        v1 = pd.read_sql('SELECT player_id, fdv as fdv_v1 FROM players WHERE fdv IS NOT NULL', engine)
    except Exception:
        v1 = pd.DataFrame(columns=['player_id','fdv_v1'])

    result = build_fdv_v3(engine)
    if result.empty:
        print('No data.'); return

    val = result.merge(players, on='player_id', how='left')
    val = val.merge(v1, on='player_id', how='left')
    val['fdv_v1'] = val['fdv_v1'].fillna(0)
    val['delta'] = val['fdv']-val['fdv_v1']
    val = val.sort_values('fdv', ascending=False)

    print(f'\n{"="*78}')
    print(f' FDV v3 -- {len(result):,} players  |  Position-based, cross-normalised')
    print(f'{"="*78}')
    print(f'  {"#":<4} {"Player":<28} {"Grp":<6} {"Pos":<5} {"FDV":>7} {"v1":>7} {"D":>7}')
    print(f'{"-"*78}')
    for i, (_, r) in enumerate(val.head(50).iterrows(), 1):
        nm = str(r['player_name'])[:27]
        sign = '+' if r['delta']>0 else ''
        print(f'  {i:<4} {nm:<28} {str(r["pos_group"]):<6} {str(r["pos"] or ""):<5}'
              f' {r["fdv"]:>7.1f} {r["fdv_v1"]:>7.1f} {sign}{r["delta"]:>6.1f}')

    # Top 5 per position
    print(f'\n{"="*78}')
    print(' Top 5 per position group')
    print(f'{"="*78}')
    for grp in ['QB','RB','WR','TE','EDGE','DT','LB','CB','S','K','P']:
        gv = val[val['pos_group']==grp].head(5)
        if gv.empty: continue
        print(f'\n  {grp}:')
        for j, (_, r) in enumerate(gv.iterrows(), 1):
            print(f'    {j}. {str(r["player_name"]):<28} {r["fdv"]:>7.1f}  (v1: {r["fdv_v1"]:.1f})')

    if not args.write:
        print(f'\n[dry-run] Use --write to save to DB.')
        return

    print('\nWriting to players.fdv ...')
    eng2 = get_engine()
    with eng2.begin() as conn:
        conn.execute(text('ALTER TABLE players ADD COLUMN IF NOT EXISTS fdv NUMERIC(6,1)'))
        conn.execute(text(
            'CREATE TEMP TABLE _fdv_tmp (player_id TEXT PRIMARY KEY, fdv NUMERIC(6,1))'
        ))
        from io import StringIO
        import csv as _csv
        buf = StringIO()
        w = _csv.writer(buf)
        for _, r in result.iterrows():
            w.writerow([r['player_id'], round(float(r['fdv']), 1)])
        buf.seek(0)
        raw = conn.connection.cursor()
        raw.copy_expert('COPY _fdv_tmp FROM STDIN WITH CSV', buf)
        conn.execute(text(
            'UPDATE players p SET fdv = t.fdv FROM _fdv_tmp t WHERE p.player_id = t.player_id'
        ))
        conn.execute(text(
            'UPDATE players SET fdv = NULL WHERE player_id NOT IN (SELECT player_id FROM _fdv_tmp)'
        ))
    print(f'Done. {len(result):,} players updated.')


if __name__ == '__main__':
    main()
