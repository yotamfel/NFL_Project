import { useState, useRef } from 'react'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'

const DRAFT_COLS = [
  { key: 'draft_year',  label: 'Year' },
  { key: 'round',       label: 'Rd' },
  { key: 'pick',        label: 'Pick' },
  { key: 'player_name', label: 'Player' },
  { key: 'pos',         label: 'Pos' },
  { key: 'team',        label: 'Team' },
  { key: 'career_av',   label: 'Career AV' },
]

const ROUNDS = [1, 2, 3, 4, 5, 6, 7]

const AV_SCALE = [
  { range: '0–10',   label: 'Minimal NFL impact',      color: '#475569' },
  { range: '10–30',  label: 'Backup / role player',    color: '#64748b' },
  { range: '30–60',  label: 'Solid starter',           color: '#3b82f6' },
  { range: '60–100', label: 'Star (multi-Pro Bowl)',    color: '#f59e0b' },
  { range: '100+',   label: 'All-time elite',          color: '#a78bfa' },
]

export default function DraftAnalysis() {
  const [tab,     setTab]     = useState('picks')
  const [avInfo,  setAvInfo]  = useState(false)
  const [filters, setFilters] = useState({ year: '', team: '', pos: '' })
  const set = key => e => setFilters(f => ({ ...f, [key]: e.target.value }))

  // Steal thresholds
  const [stealMinRound, setStealMinRound] = useState(4)
  const [stealMinAv,    setStealMinAv]    = useState(50)
  const [stealAvInput,  setStealAvInput]  = useState('50')
  const stealAvTimer = useRef()

  // Bust thresholds
  const [bustMaxRound, setBustMaxRound] = useState(2)
  const [bustMaxAv,    setBustMaxAv]    = useState(15)
  const [bustAvInput,  setBustAvInput]  = useState('15')
  const bustAvTimer = useRef()

  const { data: picks,  loading: pl, error: pe } = useApi(
    () => api.getDraftPicks({ draft_year: filters.year || undefined, team: filters.team || undefined, pos: filters.pos || undefined, limit: 100 }),
    [filters.year, filters.team, filters.pos]
  )
  const { data: steals, loading: sl, error: se } = useApi(
    () => api.getSteals({ minRound: stealMinRound, minAv: stealMinAv }),
    [stealMinRound, stealMinAv]
  )
  const { data: busts, loading: bl, error: be } = useApi(
    () => api.getBusts({ maxRound: bustMaxRound, maxAv: bustMaxAv }),
    [bustMaxRound, bustMaxAv]
  )

  const handleStealAv = val => {
    setStealAvInput(val)
    clearTimeout(stealAvTimer.current)
    stealAvTimer.current = setTimeout(() => {
      const n = parseInt(val); if (!isNaN(n) && n >= 0) setStealMinAv(n)
    }, 400)
  }
  const handleBustAv = val => {
    setBustAvInput(val)
    clearTimeout(bustAvTimer.current)
    bustAvTimer.current = setTimeout(() => {
      const n = parseInt(val); if (!isNaN(n) && n >= 0) setBustMaxAv(n)
    }, 400)
  }

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">NFL</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Draft Analysis</h1>
        </div>
        <button onClick={() => setAvInfo(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            avInfo
              ? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
              : 'border-slate-700 text-slate-500 hover:text-slate-300'
          }`}>
          {avInfo ? '▲' : '▼'} What is Career AV?
        </button>
      </div>

      {/* Career AV explanation */}
      {avInfo && (
        <div className="rounded-2xl border border-slate-700/60 p-5 space-y-4"
          style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b2e 100%)' }}>
          <div>
            <h2 className="text-white font-bold mb-1">Career Approximate Value (AV)</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              AV is Pro Football Reference's position-neutral metric for career quality.
              It aggregates a player's season-by-season contributions into a single number
              that can be compared across positions — a career AV of 50 means roughly the
              same thing whether the player was a QB, DE, or kicker.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Scale</p>
            <div className="flex flex-col gap-1.5">
              {AV_SCALE.map(({ range, label, color }) => (
                <div key={range} className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold w-14 shrink-0" style={{ color }}>{range}</span>
                  <div className="flex-1 h-px" style={{ background: `${color}40` }} />
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Reference points</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['Tom Brady',         273],
                ['Peyton Manning',    234],
                ['Jerry Rice',        197],
                ['Ray Lewis',         167],
                ['Average starter',   '~45 / career'],
                ['Typical rookie',    '2–4 / season'],
              ].map(([name, av]) => (
                <div key={name} className="rounded-lg px-3 py-1.5 border border-slate-700/60 bg-slate-800/40">
                  <span className="text-slate-400 text-xs">{name}: </span>
                  <span className="text-white text-xs font-semibold">{av}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-600 text-xs">
            Note: AV is a rough approximation — it's most useful for comparing career trajectories
            and draft-class outcomes, not fine-grained individual season comparisons.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {[
          { id: 'picks',  label: 'Draft Picks', icon: '📋', active: 'bg-blue-600 shadow-blue-900/40' },
          { id: 'steals', label: 'Steals',      icon: '💎', active: 'bg-emerald-600 shadow-emerald-900/40' },
          { id: 'busts',  label: 'Busts',       icon: '📉', active: 'bg-rose-700 shadow-rose-900/40' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? `${t.active} text-white shadow-lg`
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Draft Picks */}
      {tab === 'picks' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            {[
              { key: 'year', ph: 'Year',     type: 'number', cls: 'w-full sm:w-28' },
              { key: 'team', ph: 'Team',     type: 'text',   cls: 'w-full sm:w-36' },
              { key: 'pos',  ph: 'Position', type: 'text',   cls: 'w-full sm:w-32' },
            ].map(f => (
              <input key={f.key} type={f.type} value={filters[f.key]} onChange={set(f.key)}
                placeholder={f.ph}
                className={`${f.cls} bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500`} />
            ))}
          </div>
          {pl && <Loading text="Loading picks…" />}
          {pe && <ErrorMsg message={pe} />}
          {picks && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
              <StatTable columns={DRAFT_COLS} rows={picks} keyField="pick" />
            </div>
          )}
        </div>
      )}

      {/* Steals */}
      {tab === 'steals' && (
        <div className="space-y-4">
          {/* Definition card */}
          <div className="rounded-2xl overflow-hidden border border-emerald-900/60"
            style={{ background: 'linear-gradient(135deg, #052e16 0%, #0f172a 100%)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #22c55e, transparent)' }} />
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💎</span>
                <p className="text-emerald-400 font-bold">Draft Steals</p>
              </div>

              {/* Threshold controls */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Define a "Steal"</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">Round ≥</span>
                    <select value={stealMinRound} onChange={e => setStealMinRound(parseInt(e.target.value))}
                      className="bg-slate-800 border border-emerald-900/60 text-white rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:border-emerald-500">
                      {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <span className="text-slate-600 text-sm">and</span>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">Career AV ≥</span>
                    <input type="number" min="0" max="300" value={stealAvInput}
                      onChange={e => handleStealAv(e.target.value)}
                      className="w-20 bg-slate-800 border border-emerald-900/60 text-white rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:border-emerald-500" />
                  </label>
                </div>
                <p className="text-slate-500 text-xs">
                  Round {stealMinRound}+ picks with Career AV ≥ {stealMinAv} — players who over-delivered on their draft investment.
                </p>
              </div>
            </div>
          </div>

          {sl && <Loading text="Loading steals…" />}
          {se && <ErrorMsg message={se} />}
          {steals && (
            <div className="bg-slate-800/70 border border-emerald-900/40 rounded-2xl p-5">
              <p className="text-xs text-slate-600 mb-3">{steals.length} players found</p>
              <StatTable columns={DRAFT_COLS} rows={steals} keyField="player_name" />
            </div>
          )}
        </div>
      )}

      {/* Busts */}
      {tab === 'busts' && (
        <div className="space-y-4">
          {/* Definition card */}
          <div className="rounded-2xl overflow-hidden border border-rose-900/60"
            style={{ background: 'linear-gradient(135deg, #4c0519 0%, #0f172a 100%)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #f43f5e, transparent)' }} />
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📉</span>
                <p className="text-rose-400 font-bold">Draft Busts</p>
              </div>

              {/* Threshold controls */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Define a "Bust"</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">Round ≤</span>
                    <select value={bustMaxRound} onChange={e => setBustMaxRound(parseInt(e.target.value))}
                      className="bg-slate-800 border border-rose-900/60 text-white rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:border-rose-500">
                      {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <span className="text-slate-600 text-sm">and</span>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">Career AV ≤</span>
                    <input type="number" min="0" max="300" value={bustAvInput}
                      onChange={e => handleBustAv(e.target.value)}
                      className="w-20 bg-slate-800 border border-rose-900/60 text-white rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:border-rose-500" />
                  </label>
                </div>
                <p className="text-slate-500 text-xs">
                  Round {bustMaxRound} or earlier picks with Career AV ≤ {bustMaxAv} — high-capital selections whose careers fell short of their slot.
                </p>
              </div>
            </div>
          </div>

          {bl && <Loading text="Loading busts…" />}
          {be && <ErrorMsg message={be} />}
          {busts && (
            <div className="bg-slate-800/70 border border-rose-900/40 rounded-2xl p-5">
              <p className="text-xs text-slate-600 mb-3">{busts.length} players found</p>
              <StatTable columns={DRAFT_COLS} rows={busts} keyField="player_name" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
