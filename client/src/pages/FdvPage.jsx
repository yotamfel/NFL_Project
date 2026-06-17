import { useNavigate } from 'react-router-dom'

export default function FdvPage() {
  const section  = 'text-xs font-bold uppercase tracking-widest text-slate-500 mb-3'
  const card     = 'rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 space-y-3'
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 py-6">

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Hero */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-1">Metric Methodology</p>
        <h1 className="text-3xl font-black text-white tracking-tight">FDV — Fourth & Data Value</h1>
        <p className="text-slate-400 mt-2 leading-relaxed">
          FDV is our proprietary career value metric built entirely from the statistics and draft
          data in this platform. It replaces the third-party Career AV metric with a fully
          transparent, position-aware, independently computed alternative.
        </p>
      </div>

      {/* Why we built it */}
      <div className={card}>
        <p className={section}>Why We Built FDV</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Career Approximate Value (AV), produced by Pro Football Reference, was previously
          the primary career quality signal on this platform. AV is useful but it is a
          third-party proprietary metric — its exact formula is not fully disclosed,
          and it cannot be independently reproduced or freely distributed in a commercial context.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed">
          FDV is our answer: a metric we compute ourselves from our own data, whose formula
          is completely transparent, and which we can update as our dataset grows. Every number
          you see is traceable to a specific formula and a specific row in our database.
        </p>
      </div>

      {/* Core algorithm */}
      <div className={card}>
        <p className={section}>Core Algorithm — Three Layers</p>
        <ol className="space-y-3 text-sm text-slate-400 list-decimal list-inside">
          <li>
            <span className="text-slate-200 font-semibold">Position-specific raw score</span>
            {' '}— Each of the 11 position groups (QB, RB, WR, TE, EDGE, DT, LB, CB, S, K, P)
            has its own formula tailored to the statistics that matter most at that role.
            A QB is evaluated on passing efficiency and clutch play; a CB on interceptions and
            pass deflections; a DT on sacks and tackles for loss.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Within-position era normalisation</span>
            {' '}— Raw scores are z-scored against same-position peers in the same season-year.
            A dominant 1978 CB is measured against 1978 CBs; a dominant 2022 CB against 2022 CBs.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Season FDV</span>
            {' '}— <code className="text-violet-300 text-xs">max(0, 6 + 3 × z) × (games / full_season)</code>,
            capped at 18 per season. Returns are added as a 25% bonus.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Career aggregation with longevity decay</span>
            {' '}— Top 10 seasons count at full value, seasons 11–13 at 50%, and seasons 14+ at 30%.
            This prevents long-but-average careers from outscoring shorter dominant ones.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Cross-position normalisation</span>
            {' '}— Career FDV is z-scored within each position group, then mapped to a common scale
            so that equal dominance at any position produces comparable final scores.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Positional value multiplier</span>
            {' '}— A final multiplier (0.70–1.20) is derived from 55 years of NFL draft data
            (1970–2025). Positions that historically command more draft capital — reflecting
            the league's consensus on positional impact — receive a higher multiplier.
            This is computed automatically from our draft database, not manually assigned.
          </li>
        </ol>
      </div>

      {/* Formulas by position */}
      <div className={card}>
        <p className={section}>Raw Score Formulas by Position</p>
        <p className="text-slate-500 text-xs mb-3">
          Each position group has a tailored formula. Raw scores are then era-normalised
          within the position group before contributing to FDV.
        </p>
        <div className="space-y-4">

          {[
            {
              cat: 'QB',
              color: '#60a5fa',
              formula: '(ANY/A × att / 10) + GWD × 3 + 4QC × 2 + rush_yds × 0.04 + rush_td × 3',
              notes: 'Efficiency via ANY/A, volume via attempts, clutch via GWD/4QC, dual-threat via rushing. Min 200 pass attempts to qualify.',
            },
            {
              cat: 'RB',
              color: '#4ade80',
              formula: 'rush_yds × 0.08 + rush_td × 6 + rec × 0.3 + rec_yds × 0.06 + rec_td × 5 − fumbles × 3',
              notes: 'Rushing production + receiving versatility. Fumbles penalised heavily. Min 50 rush attempts to qualify.',
            },
            {
              cat: 'WR',
              color: '#22d3ee',
              formula: 'rec_yds × 0.09 + rec_td × 7 + rec × 0.5 + rush_yds × 0.03 + rush_td × 3 − fumbles × 2',
              notes: 'Receiving volume and scoring + gadget play value. Min 20 receptions to qualify.',
            },
            {
              cat: 'TE',
              color: '#a3e635',
              formula: 'rec_yds × 0.10 + rec_td × 8 + rec × 0.6 − fumbles × 2',
              notes: 'Higher per-catch weights than WR to reflect scarcity of receiving production at TE. Min 15 receptions to qualify.',
            },
            {
              cat: 'EDGE (DE / OLB)',
              color: '#f87171',
              formula: 'sacks × 10 + TFL × 4 + QB hits × 2 + FF × 5 + INTs × 5 + PD × 1.5 + tackles × 0.1 + safeties × 6',
              notes: 'Sack-primary with disruption bonuses. When TFL / QB hits are unavailable (pre-1999), their weight is redistributed to sacks. Min 10 games to qualify.',
            },
            {
              cat: 'DT / NT',
              color: '#fb923c',
              formula: 'sacks × 9 + TFL × 5 + QB hits × 3 + FF × 5 + tackles × 0.3 + PD × 1 + safeties × 6',
              notes: 'Interior disruption weighted more than EDGE. Missing-stat redistribution applies. Min 10 games.',
            },
            {
              cat: 'LB (ILB / MLB)',
              color: '#fbbf24',
              formula: 'sacks × 6 + tackles × 0.5 + TFL × 4 + INTs × 7 + PD × 2.5 + FF × 4 + safeties × 6',
              notes: 'Balanced across run stopping, coverage, and pass rush. When TFL is missing, weight shifts to sacks and tackles. Min 10 games.',
            },
            {
              cat: 'CB',
              color: '#c084fc',
              formula: 'INTs × 10 + PD × 3 + FF × 4 + tackles × 0.2 + sacks × 3 + safeties × 6',
              notes: 'Ball production (INTs, PDs) dominates. Min 10 games.',
            },
            {
              cat: 'S (FS / SS)',
              color: '#e879f9',
              formula: 'INTs × 8 + PD × 2.5 + tackles × 0.3 + sacks × 5 + FF × 4 + TFL × 3 + safeties × 6',
              notes: 'Hybrid role: coverage + run support + blitz. Missing-stat redistribution applies. Min 10 games.',
            },
            {
              cat: 'K',
              color: '#fb923c',
              formula: 'FGM × 5 + FGM 50+ × 4 + XPM × 0.4 − missed FGs × 3',
              notes: 'Long field goals receive a difficulty bonus. Min 10 FG attempts.',
            },
            {
              cat: 'P',
              color: '#a78bfa',
              formula: 'net yards × 0.015 + inside-20 × 2.5 − blocked punts × 4',
              notes: 'Field-position impact. Min 15 punts.',
            },
          ].map(({ cat, color, formula, notes }) => (
            <div key={cat} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 space-y-2">
              <p className="text-sm font-semibold" style={{ color }}>{cat}</p>
              <code className="block text-xs text-slate-300 bg-black/30 rounded px-3 py-2 leading-relaxed">
                {formula}
              </code>
              <p className="text-xs text-slate-500 leading-relaxed">{notes}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Era adjustment */}
      <div className={card}>
        <p className={section}>Era Adjustment</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          The NFL has changed dramatically since 1970 — passing volumes are much higher today,
          rule changes have affected scoring, and specialisation has increased. Without era
          adjustment, a 2022 QB who threw 5,000 yards in a pass-friendly era would score much
          higher than a 1978 QB who threw 3,200 yards in a run-first era, even if the 1978
          passer was equally dominant relative to his peers.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mt-2">
          FDV solves this by computing a <strong className="text-white">z-score per position group per season-year</strong>{' '}
          among qualified players. A z-score of +2 means "2 standard deviations above the average
          starter at your position in that specific year."
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mt-2">
          For early seasons where fewer than 8 qualified players exist
          (e.g. kickers in the 1970s), we fall back to the all-years mean and standard deviation
          for that position group.
        </p>
      </div>

      {/* Positional value */}
      <div className={card}>
        <p className={section}>Positional Value Multiplier</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Not all positions contribute equally to winning football games. A franchise QB impacts
          outcomes more than a franchise punter. FDV accounts for this with a draft-derived
          multiplier applied after cross-position normalisation.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mt-2">
          The multiplier is computed from our draft database (1970–2025, 16,800+ picks) using
          a composite of two signals: <strong className="text-white">average draft position</strong>{' '}
          (how early is the position picked?) and <strong className="text-white">round-1 frequency</strong>{' '}
          (what percentage of picks at this position are in the first round?). The result is
          scaled to a 0.70–1.20 range.
        </p>
        <div className="mt-3 space-y-1.5">
          {[
            { pos: 'EDGE',  mult: '1.20', color: '#f87171' },
            { pos: 'QB',    mult: '1.14', color: '#60a5fa' },
            { pos: 'S',     mult: '1.09', color: '#e879f9' },
            { pos: 'DT',    mult: '1.07', color: '#fb923c' },
            { pos: 'WR',    mult: '0.98', color: '#22d3ee' },
            { pos: 'RB',    mult: '0.96', color: '#4ade80' },
            { pos: 'CB',    mult: '0.95', color: '#c084fc' },
            { pos: 'TE',    mult: '0.91', color: '#a3e635' },
            { pos: 'LB',    mult: '0.89', color: '#fbbf24' },
            { pos: 'K',     mult: '0.72', color: '#fb923c' },
            { pos: 'P',     mult: '0.70', color: '#a78bfa' },
          ].map(({ pos, mult, color }) => (
            <div key={pos} className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold w-12 shrink-0" style={{ color }}>{pos}</span>
              <div className="flex-1 h-px bg-slate-700/40" />
              <span className="text-xs font-mono text-slate-300">{mult}x</span>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs pt-2">
          These multipliers are not hand-picked — they are derived automatically from how
          NFL teams have historically allocated premium draft capital across positions.
        </p>
      </div>

      {/* Scale */}
      <div className={card}>
        <p className={section}>FDV Scale</p>
        <div className="space-y-2">
          {[
            { range: '< 30',     label: 'Depth / minimal NFL impact',              color: '#475569' },
            { range: '30–50',    label: 'Backup / role player',                    color: '#64748b' },
            { range: '50–70',    label: 'Solid multi-year starter',                color: '#3b82f6' },
            { range: '70–90',    label: 'Pro Bowl-level career',                   color: '#f59e0b' },
            { range: '90–130',   label: 'Star / borderline Hall of Fame',          color: '#f97316' },
            { range: '130–180',  label: 'Hall of Fame level',                      color: '#a78bfa' },
            { range: '180+',     label: 'All-time great / inner-circle HOF',       color: '#ec4899' },
          ].map(({ range, label, color }) => (
            <div key={range} className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold w-20 shrink-0" style={{ color }}>{range}</span>
              <div className="flex-1 h-px" style={{ background: `${color}40` }} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Limitations */}
      <div className={card}>
        <p className={section}>Known Limitations</p>
        <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside">
          <li>
            <span className="text-slate-300 font-medium">Offensive linemen</span>
            {' '}have no reliable per-season statistics in our database.
            OL players will show FDV = 0 until stat tracking improves.
          </li>
          <li>
            <span className="text-slate-300 font-medium">Pre-1999 data gaps</span>
            {' '}exist for some advanced defensive stats (TFL, QB hits).
            When these columns are missing, their formula weight is redistributed to
            available stats (primarily sacks and tackles) so older players are not penalised.
          </li>
          <li>
            <span className="text-slate-300 font-medium">Post-season stats</span>
            {' '}are not included. FDV is computed from regular-season data only.
          </li>
          <li>
            <span className="text-slate-300 font-medium">Blocking contribution</span>
            {' '}is not captured for any position (TEs, FBs, RBs).
            Players whose primary value is blocking will score lower than their true impact.
          </li>
        </ul>
      </div>

      {/* Footer */}
      <p className="text-slate-600 text-xs text-center pb-4">
        FDV is computed by <code>etl/build_fdv_v3.py</code> and updated whenever new season data is loaded.
        The formula is fully open and auditable in the project repository.
      </p>
    </div>
  )
}
