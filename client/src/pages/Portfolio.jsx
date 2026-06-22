import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const PLATFORM_URL = 'https://fourth-and-data.up.railway.app'

const P = PLATFORM_URL
const SeeIt = ({ to, label }) => (
  <a href={`${P}${to}`} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-[10px] text-amber-500/70 hover:text-amber-400 transition-colors mt-1">
    See it live: {label} &rarr;
  </a>
)

const Arrow = () => <div className="text-amber-500 text-xl font-bold text-center py-1">&#8595;</div>

const FlowBox = ({ title, sub, color = 'slate' }) => (
  <div className={`rounded-xl border px-4 py-3 text-center bg-${color}-900/40 border-${color}-700/60`}>
    <p className="text-white font-bold text-sm">{title}</p>
    {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
  </div>
)

const Stat = ({ value, label }) => (
  <div className="text-center">
    <p className="text-2xl font-black text-amber-400">{value}</p>
    <p className="text-slate-500 text-xs mt-1">{label}</p>
  </div>
)

const Decision = ({ title, why }) => (
  <div className="border-l-2 border-amber-500/40 pl-4 py-1">
    <p className="text-white font-semibold text-sm">{title}</p>
    <p className="text-slate-400 text-xs leading-relaxed mt-1">{why}</p>
  </div>
)

export default function Portfolio() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Fourth & Data - Portfolio'
    return () => { document.title = 'Fourth & Data' }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">

        {/* Hero */}
        <header className="text-center space-y-4 pt-8">
          <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.25em]">Technical Portfolio</p>
          <h1 className="text-5xl font-black text-white tracking-tight leading-tight">Fourth & Data</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            A full-stack NFL analytics platform built from scratch - from data recovery and pipeline design
            to statistical modeling, AI-powered analysis, and a proprietary career value metric serving 19,000+ players across 56 seasons.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-colors">
              View Live Platform
            </a>
            <a href="https://github.com/yotamfel/NFL_Project" target="_blank" rel="noopener noreferrer"
              className="px-6 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-sm transition-colors">
              GitHub
            </a>
          </div>
        </header>

        {/* Key Numbers */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <Stat value="19,000+" label="Players tracked" />
            <Stat value="875K+" label="Data rows" />
            <Stat value="56" label="Seasons covered (1970-2025)" />
            <Stat value="66" label="API endpoints" />
          </div>
        </section>

        {/* Architecture */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Architecture</p>
            <h2 className="text-2xl font-black text-white">System Overview</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Frontend */}
              <div className="rounded-xl border p-5 space-y-3" style={{ background: 'rgba(23,37,84,0.4)', borderColor: 'rgba(30,64,175,0.4)' }}>
                <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">Frontend</p>
                <p className="text-white font-bold">React 19 + Vite 8</p>
                <ul className="text-xs text-slate-400 space-y-1.5">
                  <li>Tailwind CSS v4 for styling</li>
                  <li>Recharts for interactive charts</li>
                  <li>React Router v7 for navigation</li>
                  <li>html-to-image for PNG export</li>
                  <li>Bilingual UI (English + Hebrew)</li>
                </ul>
              </div>
              {/* Backend */}
              <div className="rounded-xl border p-5 space-y-3" style={{ background: 'rgba(5,46,22,0.4)', borderColor: 'rgba(22,101,52,0.4)' }}>
                <p className="text-green-400 text-xs font-bold uppercase tracking-wider">Backend</p>
                <p className="text-white font-bold">FastAPI + Python</p>
                <ul className="text-xs text-slate-400 space-y-1.5">
                  <li>SQLAlchemy ORM + raw SQL</li>
                  <li>JWT auth with refresh tokens</li>
                  <li>Claude API (Anthropic SDK)</li>
                  <li>scikit-learn for ML models</li>
                  <li>17 router modules, 66 endpoints</li>
                </ul>
              </div>
              {/* Data */}
              <div className="rounded-xl border p-5 space-y-3" style={{ background: 'rgba(46,16,101,0.4)', borderColor: 'rgba(91,33,182,0.4)' }}>
                <p className="text-violet-400 text-xs font-bold uppercase tracking-wider">Data Layer</p>
                <p className="text-white font-bold">PostgreSQL 17 (Neon)</p>
                <ul className="text-xs text-slate-400 space-y-1.5">
                  <li>14 base tables + 6 career views</li>
                  <li>875K+ rows, fully normalized</li>
                  <li>nflverse ETL pipeline (Polars)</li>
                  <li>Automated via run_etl.py</li>
                  <li>Serverless cloud DB</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-600 text-center mt-4">
              Single Docker container on Railway - FastAPI serves the React SPA from the same process.
            </p>
          </div>
        </section>

        {/* Data Pipeline */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">ETL Pipeline</p>
            <h2 className="text-2xl font-black text-white">Data Flow</h2>
            <p className="text-slate-400 text-sm mt-2">
              All data originates from nflverse - an open-source NFL data ecosystem. The pipeline transforms raw play-by-play
              and seasonal statistics into clean, analysis-ready tables through a multi-stage process.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-3">
            {/* Pipeline flow */}
            <div className="rounded-xl border px-4 py-3 text-center" style={{ background: 'rgba(69,26,3,0.3)', borderColor: 'rgba(180,83,9,0.3)' }}>
              <p className="text-amber-400 font-bold text-sm">nflverse Data Sources</p>
              <p className="text-slate-500 text-xs mt-0.5">load_player_stats() &middot; load_pbp() &middot; load_schedules() &middot; load_rosters()</p>
            </div>
            <Arrow />
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3 text-center">
              <p className="text-white font-bold text-sm">Step 1: supplement_seasons.py</p>
              <p className="text-slate-500 text-xs mt-0.5">
                Compute formulas (passer rating, ANY/A, success rates) &middot; Derive games, longest plays, QB records from play-by-play &middot; Seed new players
              </p>
            </div>
            <Arrow />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3 text-center">
                <p className="text-white font-bold text-sm">Step 2: Career Views</p>
                <p className="text-slate-500 text-xs mt-0.5">SUM counting stats &middot; MAX for longest plays &middot; Exclude rate columns</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3 text-center">
                <p className="text-white font-bold text-sm">Step 3: FDV Scoring</p>
                <p className="text-slate-500 text-xs mt-0.5">11 position formulas &middot; Era z-scoring &middot; Longevity decay &middot; Cross-position normalization</p>
              </div>
            </div>
            <Arrow />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Injuries\n2009+', 'Snap Counts\n2013+', 'NGS Stats\n2016+', 'Adv Receiving\n2016+'].map(t => (
                <div key={t} className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-3 py-2.5 text-center">
                  <p className="text-slate-300 text-xs font-semibold whitespace-pre-line">{t}</p>
                </div>
              ))}
            </div>
            <Arrow />
            <div className="rounded-xl border px-4 py-3 text-center" style={{ background: 'rgba(5,46,22,0.3)', borderColor: 'rgba(21,128,61,0.3)' }}>
              <p className="text-green-400 font-bold text-sm">PostgreSQL (Neon Cloud)</p>
              <p className="text-slate-500 text-xs mt-0.5">14 tables &middot; 6 career views &middot; 875K+ rows &middot; Ready for API</p>
            </div>
          </div>

          {/* Pipeline deep-dive */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <p className="text-white font-bold text-sm">Behind the scenes: what the pipeline actually does</p>
            <div className="space-y-3">
              <Decision
                title="supplement_seasons.py - the core transform (1,000+ lines)"
                why="This single script is the backbone of the entire data layer. It pulls raw per-player season stats from nflverse's wide table, but the wide table is incomplete - it's missing games played, longest plays, QB records, success rates, and several touchdown/fumble counts. So the script also loads the full play-by-play (~50K plays per season), and derives 15+ fields by aggregating individual plays. Each derived field was verified against published reference values to 99%+ accuracy. The script handles a circular dependency: new players must exist in the players table before their season rows can be inserted (foreign key), but the players table is built from season data. It breaks the cycle by seeding new players before writing seasons."
              />
              <Decision
                title="run_etl.py - orchestration with dependency order"
                why="The 6 pipeline steps must run in strict order: seasons first (creates the base data), then career views (aggregates seasons), then FDV (needs career views), then secondary loaders (injuries, NGS, snaps - all depend on the players table). The runner wraps each step in error handling so a failure in step 4 doesn't prevent step 5 from running if they're independent. Each step reports timing and row counts."
              />
              <Decision
                title="Idempotent re-runs"
                why="Every ETL step can be safely re-run without duplicating data. Season loaders delete-then-insert for the target years. Career views are SQL views (recreated on each run). FDV writes to a single column on the players table. This means recovery from a partial failure is: just run it again."
              />
            </div>
          </div>
        </section>

        {/* Database Schema */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Database</p>
            <h2 className="text-2xl font-black text-white">Schema Design</h2>
            <p className="text-slate-400 text-sm mt-2">
              Star schema centered on the <code className="text-amber-400/80">players</code> table. Six stat categories each have
              a season-level table and a derived career view. All supplementary tables link back via player_id.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Table</th>
                  <th className="text-right px-5 py-3 font-medium">Rows</th>
                  <th className="text-left px-5 py-3 font-medium">Coverage</th>
                  <th className="text-left px-5 py-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {[
                  ['players', '19,000+', '1970-2025', 'Canonical identity hub + FDV score'],
                  ['passing_seasons', '5,800+', '1970-2025', 'Per-season QB stats with passer rating, ANY/A, 4QC, GWD'],
                  ['offense_seasons', '15,300+', '1970-2025', 'Combined rushing + receiving per player per season'],
                  ['defense_seasons', '38,800+', '1970-2025', 'Tackles, sacks, INTs, PD, FF per season'],
                  ['kicking_seasons', '1,600+', '1970-2025', 'FG/XP by distance bucket, kickoff stats'],
                  ['punting_seasons', '1,100+', '1970-2025', 'Gross/net yards, inside-20, touchbacks'],
                  ['returns_seasons', '5,900+', '1970-2025', 'Punt/kick returns + all-purpose yards'],
                  ['injuries', '59,000+', '2009-2025', 'Weekly injury report status per player'],
                  ['snap_counts', '305,000+', '2013-2025', 'Weekly off/def/ST snap percentages'],
                  ['draft', '16,800+', '1970-2025', 'Every draft pick with college and career link'],
                  ['combine_seasons', '8,600+', '2000-2025', '40-yard dash, vertical, bench, shuttle'],
                  ['adv_receiving', '4,300+', '2016-2025', 'ADOT, YAC, separation, drop rate (NGS + PFR)'],
                  ['ngs_passing', '400+', '2016-2025', 'Time to throw, CPOE, aggressiveness'],
                  ['ngs_rushing', '500+', '2016-2025', 'Efficiency, RYOE, time to LOS, 8-box %'],
                ].map(([name, rows, cov, desc]) => (
                  <tr key={name} className="hover:bg-slate-800/30">
                    <td className="px-5 py-2.5 text-amber-400/90 font-mono font-semibold">{name}</td>
                    <td className="px-5 py-2.5 text-right text-white font-semibold">{rows}</td>
                    <td className="px-5 py-2.5 text-slate-500">{cov}</td>
                    <td className="px-5 py-2.5 text-slate-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Coverage timeline */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <p className="text-white font-bold text-sm">Data coverage timeline:</p>
            <div className="space-y-1.5">
              {[
                { label: 'Box-score stats (6 categories)', from: 1970, to: 2025, color: '#f59e0b' },
                { label: 'Draft picks', from: 1970, to: 2025, color: '#f59e0b' },
                { label: 'Combine measurements', from: 2000, to: 2025, color: '#60a5fa' },
                { label: 'Injury reports', from: 2009, to: 2025, color: '#4ade80' },
                { label: 'Snap counts (weekly)', from: 2013, to: 2025, color: '#4ade80' },
                { label: 'Next Gen Stats (NGS)', from: 2016, to: 2025, color: '#a78bfa' },
                { label: 'Advanced receiving (PFR)', from: 2018, to: 2025, color: '#a78bfa' },
              ].map(d => {
                const span = 2025 - 1970
                const left = ((d.from - 1970) / span) * 100
                const width = ((d.to - d.from) / span) * 100
                return (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-40 shrink-0 text-right">{d.label}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full relative overflow-hidden">
                      <div className="absolute h-full rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: d.color, opacity: 0.6 }} />
                    </div>
                    <span className="text-[10px] text-slate-600 w-20 shrink-0">{d.from}–{d.to}</span>
                  </div>
                )
              })}
              <div className="flex items-center gap-3">
                <span className="w-40 shrink-0" />
                <div className="flex-1 flex justify-between px-1">
                  {[1970, 1980, 1990, 2000, 2010, 2020].map(y => (
                    <span key={y} className="text-[9px] text-slate-700">{y}</span>
                  ))}
                </div>
                <span className="w-20 shrink-0" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <p className="text-white font-bold text-sm">Career Views - Why Not Store Rates?</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              The six <code className="text-amber-400/80">*_career</code> views aggregate season tables into lifetime totals, but deliberately
              <strong className="text-white"> exclude rate columns</strong> (completion %, yards per attempt, FG%, etc.). Averaging a rate across
              seasons of different lengths produces misleading numbers - a QB with 95% completion rate in a 2-game season shouldn't skew his career average.
              Instead, rates are recomputed at query time from summed counting stats: <code className="text-amber-400/80">100.0 * SUM(cmp) / NULLIF(SUM(att), 0)</code>.
            </p>
          </div>
        </section>

        {/* FDV */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Proprietary Metric</p>
            <h2 className="text-2xl font-black text-white">FDV - Fourth & Data Value</h2>
            <p className="text-slate-400 text-sm mt-2">
              A position-aware career quality metric designed to replace PFR's Approximate Value. Built entirely from this platform's own
              statistical data with transparent, auditable formulas.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-6">
            {/* FDV Pipeline */}
            <div className="space-y-3">
              <p className="text-white font-bold text-sm">How FDV is computed (5 layers):</p>
              <div className="space-y-2">
                {[
                  { step: '1', title: 'Position-specific raw score', desc: '11 tailored formulas (QB, RB, WR, TE, EDGE, DT, LB, CB, S, K, P) - each weights the stats that matter most at that position.' },
                  { step: '2', title: 'Era normalization', desc: 'Z-scored against same-position peers in the same season year. A great 1978 season counts the same as a great 2023 season.' },
                  { step: '3', title: 'Season FDV calculation', desc: 'Formula: max(0, 6 + 3z) × (games / full_season), capped at 18 per season. Games-ratio adjustment prevents part-season inflation.' },
                  { step: '4', title: 'Career aggregation with longevity decay', desc: 'Top 10 seasons at full value, seasons 11-13 at 50%, seasons 14+ at 30%. Prevents longevity alone from inflating scores.' },
                  { step: '5', title: 'Cross-position normalization + draft multiplier', desc: 'Career FDV is z-scored within position group, then scaled by a draft-derived positional value multiplier (0.70 for P to 1.20 for EDGE).' },
                ].map(s => (
                  <div key={s.step} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">{s.step}</span>
                    <div>
                      <p className="text-white text-sm font-semibold">{s.title}</p>
                      <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Draft multipliers visual */}
            <div>
              <p className="text-white font-bold text-sm mb-3">Draft-derived positional value multipliers:</p>
              <p className="text-slate-500 text-xs mb-3">Based on 55 years of NFL draft data (average pick + round-1 frequency). Higher = more draft capital invested in the position historically.</p>
              <div className="space-y-1.5">
                {[
                  { pos: 'EDGE', mult: 1.20, color: '#f59e0b' },
                  { pos: 'QB',   mult: 1.14, color: '#f59e0b' },
                  { pos: 'S',    mult: 1.09, color: '#f59e0b' },
                  { pos: 'DT',   mult: 1.07, color: '#f59e0b' },
                  { pos: 'WR',   mult: 0.98, color: '#94a3b8' },
                  { pos: 'RB',   mult: 0.96, color: '#94a3b8' },
                  { pos: 'CB',   mult: 0.95, color: '#94a3b8' },
                  { pos: 'TE',   mult: 0.91, color: '#64748b' },
                  { pos: 'LB',   mult: 0.89, color: '#64748b' },
                  { pos: 'K',    mult: 0.72, color: '#475569' },
                  { pos: 'P',    mult: 0.70, color: '#475569' },
                ].map(p => (
                  <div key={p.pos} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold w-10 text-slate-300 shrink-0">{p.pos}</span>
                    <div className="flex-1 h-4 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.mult / 1.20) * 100}%`, background: p.color, opacity: 0.7 }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right" style={{ color: p.color }}>{p.mult.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FDV Scale */}
            <div>
              <p className="text-white font-bold text-sm mb-3">Scale reference:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { range: '< 30', label: 'Depth / minimal impact', color: '#475569' },
                  { range: '30-50', label: 'Backup / role player', color: '#64748b' },
                  { range: '50-70', label: 'Solid multi-year starter', color: '#3b82f6' },
                  { range: '70-90', label: 'Pro Bowl-level career', color: '#f59e0b' },
                  { range: '90-130', label: 'Star / borderline HOF', color: '#f97316' },
                  { range: '130+', label: 'Hall of Fame level', color: '#a78bfa' },
                ].map(s => (
                  <div key={s.range} className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2">
                    <span className="text-xs font-mono font-bold w-12 shrink-0" style={{ color: s.color }}>{s.range}</span>
                    <span className="text-xs text-slate-400">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-white font-bold text-sm mb-2">Why build a new metric?</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                PFR's Career Approximate Value (AV) uses an undisclosed formula that can't be independently reproduced or
                commercially distributed. FDV provides full transparency - every coefficient, threshold, and normalization
                step is documented and auditable. It also improves on AV by using position-specific formulas rather than
                a one-size-fits-all approach, and by incorporating era adjustment so historical players are compared fairly.
              </p>
              <SeeIt to="/methodology" label="Full FDV methodology" />
            </div>
          </div>
        </section>

        {/* AI Features */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">AI Integration</p>
            <h2 className="text-2xl font-black text-white">AI-Powered Analysis</h2>
            <p className="text-slate-400 text-sm mt-2">
              AI features built on Claude Sonnet 4.6 - each solving a specific analytical problem
              that would be impractical to address with traditional queries or static reports.
            </p>
          </div>

          {/* Smart Search - deep dive */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-white font-bold">Smart Search - Natural Language to SQL</p>
              <p className="text-slate-400 text-xs leading-relaxed mt-1">
                <span className="text-white font-medium">The problem:</span> A database with 14 tables, 100+ columns, and complex join paths
                is inaccessible to anyone who doesn't write SQL. Even analysts spend time looking up column names and table relationships.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed mt-2">
                <span className="text-white font-medium">The solution:</span> Users type questions in plain English. Claude receives
                the full database schema as a system prompt - every table, column, coverage window, and data quirk - and generates a single
                read-only SQL query. The basic tier returns the SQL and a results table. The Pro tier (in development) adds a second AI pass
                that analyzes the results: generating a 2-4 sentence insight summary and an auto-fitted chart (bar, line, or scatter).
              </p>
              <p className="text-slate-400 text-xs leading-relaxed mt-2">
                <span className="text-white font-medium">Why this approach:</span> Rather than building a rigid form-based query builder
                (which constrains users to predefined questions), NL-to-SQL lets users ask anything the data can answer - including complex
                multi-join, GROUP BY, and HAVING queries they might not know how to formulate. The schema prompt includes rules that prevent
                common mistakes (e.g., "never average a career rate column - recompute from summed counts").
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
              <p className="text-slate-300 text-xs font-semibold">Two-tier architecture:</p>
              <div className="flex flex-wrap gap-2 items-center justify-center">
                {['User question', 'Claude generates SQL', 'Regex safety filter', 'Execute read-only', 'Claude analyzes results', 'Return insight + chart'].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg">{s}</span>
                    {i < 5 && <span className="text-amber-500 font-bold text-xs">&rarr;</span>}
                  </div>
                ))}
              </div>
              <p className="text-slate-600 text-[10px] text-center">
                Safety filter rejects INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, and multi-statement queries. Only single SELECT/WITH passes through.
              </p>
              <div className="text-center mt-1"><SeeIt to="/search" label="Smart Search" /></div>
            </div>
          </div>

          {/* Other AI features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
              <p className="text-white font-bold text-sm">Career Insights</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-slate-200">Problem:</span> A stat table shows what happened, not what it means. Users want narrative context -
                was this career arc typical? Was the decline injury-related? How does this compare to peers?
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-slate-200">Approach:</span> Claude receives the player's full career stats across all categories and writes a
                3-5 sentence analytical paragraph. Results are cached 24 hours. Users rate with thumbs up/down - feedback stored in ai_query_log
                for ongoing quality monitoring and prompt iteration.
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
              <p className="text-white font-bold text-sm">Comparison Narrative</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-slate-200">Problem:</span> Comparing 4 players across 15+ columns is information overload.
                Users need someone to synthesize the key differences.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-slate-200">Approach:</span> After loading comparison data, Claude writes a 4-6 sentence analysis:
                who leads in each metric, stylistic contrasts, and an overall verdict. Works across all 6 stat categories
                in both career and single-season modes.
              </p>
            </div>
          </div>

          {/* AI Architecture decisions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <p className="text-white font-bold text-sm">AI Engineering Decisions</p>
            <div className="space-y-3">
              <Decision
                title="Why Claude Sonnet 4.6 for everything"
                why="Sonnet balances quality and cost - accurate enough for SQL generation and narrative writing, fast enough for interactive use (typically under 3 seconds). Opus would be more accurate but 5x the cost and 3x the latency. Haiku is too imprecise for SQL generation where a wrong column name breaks the query."
              />
              <Decision
                title="Full schema in every system prompt"
                why="Rather than training a model or using RAG, we inject the complete schema (table names, columns, data types, coverage windows, and known quirks) directly into the system prompt. This ensures Claude always has current, accurate metadata - no stale embeddings, no retrieval misses. The schema is small enough (~4K tokens) that the cost is negligible."
              />
              <Decision
                title="Thumbs feedback loop over automated evaluation"
                why="AI output quality is subjective - a factually correct but boring insight is worse than a slightly imprecise but engaging one. User thumbs up/down feedback, stored with the full query context in ai_query_log, provides real signal for prompt iteration. Token counts and latency are also logged for cost monitoring."
              />
              <Decision
                title="Two-pass Smart Search (SQL + analysis)"
                why="Generating SQL and analyzing results are fundamentally different tasks. Combining them in one prompt degraded both: Claude would hedge on SQL or skip the analysis. Splitting into two sequential calls - SQL generation, then result analysis - improved quality on both steps."
              />
            </div>
          </div>
        </section>

        {/* Analytical Capabilities */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Analysis</p>
            <h2 className="text-2xl font-black text-white">What The Platform Enables</h2>
            <p className="text-slate-400 text-sm mt-2">
              Beyond storing data, the platform is designed for interactive analysis - combining statistical methods,
              visualization, and AI to surface insights that raw tables can't show.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Cross-era comparison',
                  desc: 'FDV\'s era-normalized z-scoring lets users meaningfully compare a 1978 player to a 2023 player - something raw stats can\'t do because the game changed (rule changes, schedule length, passing evolution).',
                },
                {
                  title: 'Multi-dimensional player comparison',
                  desc: 'Compare up to 4 players across any stat category with visual bar charts, full stat tables (basic + advanced), and AI-written narrative analysis - in career or single-season mode.',
                  link: '/comparison', linkLabel: 'Player Comparison',
                },
                {
                  title: 'Draft ROI analysis',
                  desc: 'Steals/busts identification using composite z-scores across multiple criteria. Position filtering uses career position (not draft-day), with statistical distribution context (percentile thresholds per round cohort).',
                  link: '/draft', linkLabel: 'Draft Analysis',
                },
                {
                  title: 'League-wide trend detection',
                  desc: 'Track any stat\'s evolution across 56 seasons with sum or per-player averages. Historical reference lines mark rule changes (1978 schedule expansion, 2004 illegal contact enforcement) that explain inflection points.',
                  link: '/trends', linkLabel: 'League Trends',
                },
                {
                  title: 'Statistical anomaly detection',
                  desc: 'Automated engine flags career highs, year-over-year surges (40%+), efficiency peaks (1.5σ above career mean), and dual-threat versatility - with severity scoring and volume thresholds to filter noise.',
                  link: '/anomalies', linkLabel: 'Season Highlights',
                },
                {
                  title: 'Injury impact analysis',
                  desc: 'Career charts overlay red injury bands on stat trend lines, making it visually obvious when a decline coincides with missed games. The IR estimation algorithm fills gaps the official injury report leaves.',
                },
              ].map(c => (
                <div key={c.title} className="border-l-2 border-slate-700 pl-4">
                  <p className="text-white font-semibold text-sm">{c.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed mt-1">{c.desc}</p>
                  {c.link && <SeeIt to={c.link} label={c.linkLabel} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Decisions */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Engineering Decisions</p>
            <h2 className="text-2xl font-black text-white">Why We Built It This Way</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-5">
            <Decision
              title="Full rebuild over patching"
              why="Legacy data had 4 distinct corruption patterns from a Power BI export pipeline - date-encoded integers, mangled QB records, broken hyphenated surnames, and UTF-8 mojibake. Surgical fixes would have been fragile. Instead, we rebuilt from raw CSV exports, writing a dedicated corruption_fixes.py module that recovers each pattern deterministically."
            />
            <Decision
              title="nflverse over web scraping"
              why="Originally the platform scraped Pro Football Reference via Selenium. We migrated to nflverse (open-source NFL data ecosystem) for reliability - no Cloudflare challenges, no HTML structure changes, and the data is already cleaned. All formulas (passer rating, ANY/A, success rate) are re-derived from raw counts and verified against published values."
            />
            <Decision
              title="Play-by-play derived stats over pre-computed aggregates"
              why="nflverse's pre-computed wide table had known inaccuracies - games played was off by 38-78% depending on category, and defensive TD counts were provably wrong (Taron Johnson 2024: 2 real TDs, wide table reported 1). We derive games, touchdowns, fumbles, first downs, longest plays, 4QC, and GWD directly from play-by-play, which reproduces PFR's own figures at 99%+ accuracy."
            />
            <Decision
              title="Position-specific FDV over universal scoring"
              why="A single formula can't capture what makes a great kicker vs. a great edge rusher. FDV uses 11 tailored formulas, each weighting the stats that differentiate elite from average at that position. Era z-scoring ensures a dominant 1978 season scores the same as a dominant 2023 season."
            />
            <Decision
              title="Career views exclude rate columns"
              why="Averaging rates across seasons of different lengths is statistically misleading. A 95% completion rate in a 2-game season shouldn't weight equally with 65% over 16 games. Career views only store counting stats (SUM) and longest plays (MAX). Rates are recomputed at query time from the summed counts."
            />
            <Decision
              title="Three-stage draft linking"
              why="Draft picks don't ship with player IDs. We link them in three stages: (1) combine cross-reference for 81% of picks with zero ambiguity, (2) string matching on name + position + school for 16%, and (3) manual review for the remaining 3% of ambiguous cases."
            />
            <Decision
              title="Single Docker container deployment"
              why="The React SPA is built at Docker build time and served as static files from the FastAPI process. No nginx, no separate static host - one container, one port. Simplifies deployment and keeps the free-tier footprint minimal."
            />
          </div>
        </section>

        {/* Data Recovery */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Data Engineering</p>
            <h2 className="text-2xl font-black text-white">Data Recovery & Quality</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              The original dataset was exported through Power BI, which introduced 4 distinct corruption patterns.
              Each was identified, diagnosed, and reversed programmatically:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { pattern: 'Date-encoded integers', desc: 'Small integers (1-31) silently converted to Excel date serial numbers. Reversed by detecting the date-range pattern and inverting the encoding.', example: '15 → 42385 → 15' },
                { pattern: 'QB Win-Loss records', desc: 'Records like "12-5" parsed as dates or fractions. Recovered by pattern-matching the corrupted format back to W-L-T notation.', example: '"12-5" → 0.416... → "12-5"' },
                { pattern: 'Hyphenated surnames', desc: 'Names like "Smith-Schuster" had hyphens stripped or split across columns. Fixed by cross-referencing with the stable player ID column.', example: 'SmithSchuster → Smith-Schuster' },
                { pattern: 'UTF-8 mojibake', desc: 'Non-ASCII characters (accents, special chars) garbled by encoding mismatch. Detected and corrected per-character.', example: 'GarcÃ­a → García' },
              ].map(p => (
                <div key={p.pattern} className="bg-slate-800/60 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold text-sm">{p.pattern}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{p.desc}</p>
                  <p className="text-amber-400/70 text-xs font-mono">{p.example}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PBP Derivation */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Play-by-Play Engineering</p>
            <h2 className="text-2xl font-black text-white">What We Derive from Raw Plays</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Rather than trusting pre-aggregated stats (which have known inaccuracies), we derive 15+ fields directly from
              nflverse play-by-play data - every snap of every game. This gives us provably higher accuracy.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { field: 'Games played (g)', method: 'Distinct game_id per player per category-specific role' },
                { field: 'QB record (qbrec)', method: 'Wins/losses from load_schedules() starting QB data' },
                { field: '4th-quarter comebacks', method: 'Games trailing in Q4/OT where team won, credited to QB with most Q4 pass attempts' },
                { field: 'Game-winning drives', method: 'Last go-ahead scoring play in Q4/OT, credited to the drive\'s QB' },
                { field: 'Success rates', method: 'PFR methodology: 1st down ≥40%, 2nd ≥60%, 3rd/4th = first down or TD' },
                { field: 'Longest plays', method: 'MAX(passing_yards), MAX(rushing_yards), MAX(receiving_yards) from PBP' },
                { field: 'INT return TDs', method: 'Per-play interception attribution (more accurate than wide-table aggregate)' },
                { field: 'Fumble recovery TDs', method: 'fumble_recovery_1/2 player attribution from PBP' },
                { field: 'First downs', method: 'first_down_pass/rush flags per play, attributed to passer/rusher/receiver' },
              ].map(f => (
                <div key={f.field} className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-white text-xs font-semibold">{f.field}</p>
                  <p className="text-slate-500 text-[10px] leading-relaxed mt-1">{f.method}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Validation & Accuracy */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Data Quality</p>
            <h2 className="text-2xl font-black text-white">Validation & Accuracy</h2>
            <p className="text-slate-400 text-sm mt-2">
              Every derived field is verified against published reference data. When the source and our derivation disagree,
              we investigate the root cause and document it - rather than silently accepting the discrepancy.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-4">
            <p className="text-white font-bold text-sm">Verified accuracy (PBP-derived vs. PFR published values):</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 pr-4 font-medium">Field</th>
                    <th className="text-right py-2 pr-4 font-medium">Match rate</th>
                    <th className="text-left py-2 font-medium">Residual cause</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[
                    ['Passing first downs (_1d)', '100.0%', 'Exact match'],
                    ['Rushing first downs', '99.8%', 'Single-play charting disagreement league-wide'],
                    ['Receiving first downs', '99.5%', 'Same single-play family (e.g. Amon-Ra St. Brown: 75 vs PFR 73)'],
                    ['Passer rating formula', '100.0%', 'Verified: Joe Burrow 2024 = 108.5, AY/A = 8.24, NY/A = 6.67'],
                    ['INT return TDs', '100.0%', 'PBP derivation more accurate than wide-table aggregate'],
                    ['Fumbles (fmb)', '99.8%', 'Baker Mayfield: 12 vs PFR 13 (single irreducible disagreement)'],
                    ['Kickoff stats (ko/koyds/tb)', '100.0%', '44/45 kickers exact; 1 rounding quirk (Boswell)'],
                    ['Punting (pnt/yds/lng/tb)', '100.0%', '9 of 11 columns exact match'],
                    ['Combined tackles', '~97%', 'Cross-tracker tackle-crediting noise (industry-known issue)'],
                  ].map(([field, rate, cause]) => (
                    <tr key={field}>
                      <td className="py-2 pr-4 text-slate-300">{field}</td>
                      <td className="py-2 pr-4 text-right font-mono text-green-400">{rate}</td>
                      <td className="py-2 text-slate-500">{cause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
              <p className="text-white font-semibold text-sm">Known cross-tracker discrepancies (documented, not hidden):</p>
              <ul className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
                <li><span className="text-slate-300 font-medium">Penalty-affected return yardage:</span> nflverse records post-penalty enforcement spot, not play-text distance. 76 affected plays, +434 yards league-wide in 2024. Irreducible without free-text parsing.</li>
                <li><span className="text-slate-300 font-medium">Targets (tgt):</span> Off by exactly 1 for ~40 players. PFR doesn't credit targets on plays nullified by offensive penalties; nflverse does.</li>
                <li><span className="text-slate-300 font-medium">Defensive TDs:</span> The wide table's def_tds aggregate is provably wrong - Taron Johnson 2024 had 2 real defensive TDs (confirmed in play text), wide table reported 1. Our PBP derivation is correct.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Anomaly Detection */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Analytics Engine</p>
            <h2 className="text-2xl font-black text-white">Statistical Anomaly Detection</h2>
            <p className="text-slate-400 text-sm mt-2">
              An automated system that flags statistically unusual seasons by comparing each player's current stats
              against their own career baseline - surfacing breakout years, decline signals, and efficiency peaks.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {[
                { type: 'Career High', desc: 'Cumulative season stats surpass previous career best. Can trigger mid-season if player is on record pace.' },
                { type: 'YoY Surge', desc: '40%+ improvement over same player\'s previous season. Catches breakout years and comebacks.' },
                { type: 'Efficiency Peak', desc: 'Rate stat (passer rating, Y/A, Y/Rec) 1.5+ standard deviations above career mean. Highlights quality, not just volume.' },
              ].map(a => (
                <div key={a.type} className="bg-slate-800/60 rounded-xl p-4">
                  <p className="text-white text-sm font-semibold mb-1">{a.type}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{a.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Also detects: <span className="text-slate-300">dual-threat versatility</span> (300+ yards in two categories),
              <span className="text-slate-300"> above-average surges</span> (1.5&sigma; above career mean on counting stats),
              and <span className="text-slate-300">decline signals</span> (1.5&sigma; below). Severity scored on a 3-star scale
              based on magnitude. Volume thresholds (e.g. 200+ pass attempts for QBs) filter out small-sample noise.
            </p>
          </div>
        </section>

        {/* Injury Estimation */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Domain Logic</p>
            <h2 className="text-2xl font-black text-white">Injury Tracking & IR Estimation</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              The NFL's weekly injury report has a blind spot: players placed on Injured Reserve (IR) disappear from the report
              entirely. A player who misses 12 games on IR shows fewer "Out" entries than one who misses 4 games week-by-week.
              The platform solves this with a dual-source estimation:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 rounded-xl p-4">
                <p className="text-white text-sm font-semibold mb-1">Official count</p>
                <p className="text-slate-500 text-xs leading-relaxed">Games listed as "Out" on the weekly injury report. Accurate for week-to-week injuries but undercounts IR absences.</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-4">
                <p className="text-white text-sm font-semibold mb-1">Estimated count</p>
                <p className="text-slate-500 text-xs leading-relaxed">Calculated from: expected games in season minus actual games played. Catches IR stints that the weekly report misses. Marked with a &dagger; symbol.</p>
              </div>
            </div>
            <p className="text-slate-500 text-xs">
              The higher of the two values is displayed. Career charts show red bands for seasons with 4+ missed games (official or estimated), giving a visual injury history at a glance.
            </p>
          </div>
        </section>

        {/* Auth & Security */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Security</p>
            <h2 className="text-2xl font-black text-white">Authentication & Safety</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'JWT authentication', desc: 'Access tokens (short-lived) + refresh tokens (persistent, stored server-side). Bcrypt password hashing. Admin role gating for premium features.' },
                { title: 'SQL injection prevention', desc: 'AI-generated queries pass through a regex safety filter that rejects all write operations, DDL, and multi-statement queries before execution. Only single SELECT/WITH statements reach the database.' },
                { title: 'Rate limiting', desc: 'Login endpoint tracks failed attempts per username. After repeated failures, the account is temporarily locked to prevent brute-force attacks.' },
                { title: 'Role-based access', desc: 'Admin features are gated behind a require_admin dependency - returning 403 for non-admin users. Frontend components are conditionally rendered based on the is_admin flag in the JWT payload.' },
              ].map(s => (
                <div key={s.title} className="bg-slate-800/60 rounded-xl p-4">
                  <p className="text-white text-sm font-semibold mb-1">{s.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Logging & Monitoring */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Observability</p>
            <h2 className="text-2xl font-black text-white">Logging & Monitoring</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              Every AI call, user action, and system event is tracked - not for surveillance, but for debugging,
              cost control, and quality iteration.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
                <p className="text-white text-sm font-semibold">ai_query_log</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Every AI call logged with: feature name, input text, generated SQL, model used, token count,
                  response latency (ms), success/failure, error message, and user feedback (thumbs up/down).
                  Used for: cost tracking, prompt quality iteration, and identifying failure patterns.
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
                <p className="text-white text-sm font-semibold">user_visits</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Every login and token refresh records a timestamped visit. Powers the admin dashboard:
                  daily visit charts, 7-day/30-day activity, per-user engagement tracking. Used for
                  understanding usage patterns and identifying inactive accounts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Admin App */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Mobile</p>
            <h2 className="text-2xl font-black text-white">Admin Mobile App</h2>
            <p className="text-slate-400 text-sm mt-2">
              A companion Android app for platform monitoring - built so the admin dashboard is always one tap away,
              not buried behind a browser login.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: 'Dashboard', desc: 'Real-time stats: total users, visits today/7d/30d, unresolved feedback count. Pull-to-refresh on every screen.' },
                { title: 'Users', desc: 'Full user list with sort options (last active, total visits, 7d visits, join date) and search. Same data as the web admin panel.' },
                { title: 'Feedback', desc: 'Threaded chat interface - read feedback, reply directly from the phone, mark as resolved or delete. Notifications push through the same API.' },
              ].map(s => (
                <div key={s.title} className="bg-slate-800/60 rounded-xl p-4">
                  <p className="text-white text-sm font-semibold mb-1">{s.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
              <p className="text-white text-sm font-semibold">Technical approach</p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Built with React Native (Expo). Calls the exact same REST API as the web admin - no separate backend.
                JWT auth with admin-only gate (non-admin login is rejected at the app level). Over-the-air updates
                via EAS Update + GitHub Actions: pushing code to the repo automatically publishes an update that the
                app downloads on next launch - no reinstall needed.
              </p>
            </div>
          </div>
        </section>

        {/* Tech Stack Summary */}
        <section className="space-y-6">
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Stack</p>
            <h2 className="text-2xl font-black text-white">Full Technology Stack</h2>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { cat: 'Frontend', items: ['React 19', 'Vite 8', 'Tailwind CSS 4', 'Recharts 3.8', 'React Router 7'] },
                { cat: 'Backend', items: ['Python / FastAPI', 'SQLAlchemy 2', 'Pydantic 2', 'Uvicorn', 'JWT (python-jose)'] },
                { cat: 'AI / ML', items: ['Claude Sonnet 4.6', 'Anthropic SDK', 'scikit-learn', 'NL-to-SQL', 'Prompt engineering'] },
                { cat: 'Mobile', items: ['React Native', 'Expo + EAS Build', 'OTA Updates', 'GitHub Actions'] },
                { cat: 'Data / Infra', items: ['PostgreSQL 17', 'Neon (serverless)', 'nflreadpy / Polars', 'Docker', 'Railway'] },
              ].map(g => (
                <div key={g.cat}>
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">{g.cat}</p>
                  <ul className="space-y-1.5">
                    {g.items.map(i => (
                      <li key={i} className="text-slate-300 text-xs">{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="text-center space-y-4 pb-12">
          <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-colors">
            Explore the Live Platform
          </a>
          <p className="text-slate-600 text-xs">
            Built by Yotam &middot; Data Analyst &middot; 2025-2026
          </p>
        </footer>
      </div>
    </div>
  )
}
