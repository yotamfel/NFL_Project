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
          FDV is our proprietary, position-neutral career value metric built entirely
          from the statistics in this platform. It replaces the third-party Career AV
          metric with a fully transparent, independently computed alternative.
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
        <p className={section}>Core Algorithm</p>
        <ol className="space-y-3 text-sm text-slate-400 list-decimal list-inside">
          <li>
            <span className="text-slate-200 font-semibold">Raw score per player-season</span>
            {' '}— A category-specific weighted formula converts raw statistics into a single
            number representing how impactful that player was that season.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Era normalisation</span>
            {' '}— For each season-year and category, raw scores are z-scored relative to
            qualified starters in that year. This ensures a great 1978 season is valued the
            same as a great 2018 season, even though the game has changed dramatically.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Season FDV</span>
            {' '}— <code className="text-violet-300 text-xs">max(0, 6 + 3 × z) × (games_played / full_season)</code>.
            The game-participation ratio weights seasons by how much the player actually played.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Multi-category handling</span>
            {' '}— A player who appears in multiple categories (e.g. a RB who also returns kicks)
            gets credit for their primary role (maximum of passing / offense / defense / kicking / punting)
            plus a 40%-weighted returns bonus.
          </li>
          <li>
            <span className="text-slate-200 font-semibold">Career FDV</span>
            {' '}— Sum of all season FDVs, plus a 10% peak bonus equal to 10% of the player's
            top-3 season scores. The peak bonus rewards players with sustained elite seasons
            without penalising longevity.
          </li>
        </ol>
      </div>

      {/* Formulas by category */}
      <div className={card}>
        <p className={section}>Raw Score Formulas</p>
        <p className="text-slate-500 text-xs mb-3">
          All formulas produce a raw score that is then era-normalised before contributing to FDV.
          Coefficients were calibrated so an average full-time starter season yields a z-score near 0.
        </p>
        <div className="space-y-4">

          {[
            {
              cat: 'Passing (QBs)',
              color: '#60a5fa',
              formula: '(ANY/A × attempts / 10) + game-winning drives × 3 + 4th-quarter comebacks × 2',
              notes: 'ANY/A (Adjusted Net Yards per Attempt) is the most predictive single-season QB efficiency metric. Volume is captured via attempts. Clutch performance is rewarded via GWD and 4QC. Minimum 200 attempts to qualify for era normalisation.',
            },
            {
              cat: 'Offense (RB / WR / TE / FB)',
              color: '#4ade80',
              formula: 'rush_yds × 0.06 + rush_td × 5 + rec_yds × 0.07 + rec_td × 7 + receptions × 0.5 − fumbles × 2',
              notes: 'Receiving TDs and yards are weighted slightly more than rushing to reflect scarcity. Fumbles penalise ball-security issues. Minimum 30 combined rush attempts + receptions to qualify.',
            },
            {
              cat: 'Defense (LB / DL / CB / S)',
              color: '#f87171',
              formula: 'sacks × 8 + INTs × 8 + pass deflections × 2 + forced fumbles × 4 + TFL × 3 + tackles × 0.25 + QB hits × 1.5 + safeties × 6',
              notes: 'High-value turnovers (sacks, INTs) are heavily weighted. Tackles are included at a lower weight because their quality varies widely. Minimum 8 games played to qualify.',
            },
            {
              cat: 'Kicking',
              color: '#fb923c',
              formula: 'FGM × 5 + FGM 50+ yds × 4 + XPM × 0.4 − missed FGs × 3',
              notes: 'Long field goals receive a bonus for difficulty. Misses are penalised to capture accuracy. Minimum 10 FG attempts to qualify.',
            },
            {
              cat: 'Punting',
              color: '#a78bfa',
              formula: 'net yards × 0.015 + punts inside-20 × 2.5 − blocked punts × 4',
              notes: 'Net yards capture both distance and return-yards allowed. Inside-20 punts capture field-position impact. Minimum 15 punts to qualify.',
            },
            {
              cat: 'Returns (bonus)',
              color: '#38bdf8',
              formula: 'KR yards × 0.02 + PR yards × 0.025 + return TDs × 8',
              notes: 'Returns are a secondary bonus category added on top of a player\'s primary category score, at 40% weight. This avoids double-counting when a WR also returns punts.',
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
          FDV solves this by computing a <strong className="text-white">z-score per season-year</strong>{' '}
          among qualified players. A z-score of +2 means "2 standard deviations above the average
          starter in that specific year" — the same interpretation whether the year is 1975 or 2024.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mt-2">
          For early seasons where fewer than 8 qualified players exist in a category
          (e.g. kickers in the 1970s), we fall back to the all-years mean and standard deviation
          for that category to keep scores stable.
        </p>
      </div>

      {/* Scale */}
      <div className={card}>
        <p className={section}>FDV Scale</p>
        <div className="space-y-2">
          {[
            { range: '0–20',    label: 'Minimal NFL impact / depth player',     color: '#475569' },
            { range: '20–50',   label: 'Backup / role player',                  color: '#64748b' },
            { range: '50–90',   label: 'Solid multi-year starter',              color: '#3b82f6' },
            { range: '90–130',  label: 'Quality Pro Bowl-level career',         color: '#f59e0b' },
            { range: '130–180', label: 'Star player / borderline Hall of Fame', color: '#f97316' },
            { range: '180+',    label: 'Hall of Fame level',                    color: '#a78bfa' },
          ].map(({ range, label, color }) => (
            <div key={range} className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold w-20 shrink-0" style={{ color }}>{range}</span>
              <div className="flex-1 h-px" style={{ background: `${color}40` }} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs pt-1">
          An "average starter season" in any era yields approximately 6 FDV for a full 16-/17-game season.
          Pro Bowl-calibre seasons yield 9–12 FDV. Legendary seasons yield 15–18 FDV.
        </p>
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
            {' '}exist for some advanced stats (e.g. TFL, QB hits, targets).
            Seasons with missing columns still compute FDV from available data.
          </li>
          <li>
            <span className="text-slate-300 font-medium">Team context</span>
            {' '}is not captured — a great player on a bad team may be
            undervalued relative to the same player on a winning team.
          </li>
          <li>
            <span className="text-slate-300 font-medium">Post-season stats</span>
            {' '}are not included. FDV is computed from regular-season data only.
          </li>
        </ul>
      </div>

      {/* Footer */}
      <p className="text-slate-600 text-xs text-center pb-4">
        FDV is computed by <code>etl/build_fdv.py</code> and updated whenever new season data is loaded.
        The formula is fully open and auditable in the project repository.
      </p>
    </div>
  )
}
