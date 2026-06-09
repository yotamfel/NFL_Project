import { useState, useEffect, useRef } from 'react'
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

const POSITIONS  = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const ROUNDS     = [1, 2, 3, 4, 5, 6, 7]

const STAT_OPTIONS = {
  passing: [
    { key: 'yds', label: 'Pass Yards' },
    { key: 'td',  label: 'Touchdowns' },
    { key: 'int', label: 'Interceptions' },
    { key: 'cmp', label: 'Completions' },
    { key: 'att', label: 'Attempts' },
  ],
  offense: [
    { key: 'yscm',     label: 'Scrimmage Yards' },
    { key: 'rush_yds', label: 'Rush Yards' },
    { key: 'rec_yds',  label: 'Rec Yards' },
    { key: 'rec',      label: 'Receptions' },
    { key: 'rush_td',  label: 'Rush TDs' },
    { key: 'rec_td',   label: 'Rec TDs' },
  ],
  defense: [
    { key: 'comb', label: 'Total Tackles' },
    { key: 'sk',   label: 'Sacks' },
    { key: 'int',  label: 'INTs' },
    { key: 'pd',   label: 'Pass Deflections' },
    { key: 'ff',   label: 'Forced Fumbles' },
  ],
  kicking: [
    { key: 'fgm_total', label: 'FG Made' },
    { key: 'fga_total', label: 'FG Attempted' },
    { key: 'xpm',       label: 'Extra Points Made' },
  ],
  punting: [
    { key: 'pnt',    label: 'Punts' },
    { key: 'yds',    label: 'Punt Yards' },
    { key: 'netyds', label: 'Net Yards' },
  ],
  returns: [
    { key: 'kick_ret_yds', label: 'KR Yards' },
    { key: 'punt_ret_yds', label: 'PR Yards' },
  ],
}

const STAT_CATEGORIES = ['career_av', 'passing', 'offense', 'defense', 'kicking', 'punting', 'returns']

const AV_SCALE = [
  { range: '0–10',   label: 'Minimal NFL impact',    color: '#475569' },
  { range: '10–30',  label: 'Backup / role player',  color: '#64748b' },
  { range: '30–60',  label: 'Solid starter',         color: '#3b82f6' },
  { range: '60–100', label: 'Star (multi-Pro Bowl)', color: '#f59e0b' },
  { range: '100+',   label: 'All-time elite',        color: '#a78bfa' },
]

const DEFAULT_STEAL = { roundVal: 4, pos: '', category: 'career_av', scope: 'career', stat: '', statVal: '50' }
const DEFAULT_BUST  = { roundVal: 2, pos: '', category: 'career_av', scope: 'career', stat: '', statVal: '15' }

function isComplete(def) {
  const val = parseFloat(def.statVal)
  if (isNaN(val)) return false
  if (def.category === 'career_av') return true
  return !!(def.category && def.stat)
}

function statLabel(def) {
  if (def.category === 'career_av') return 'Career AV'
  const opts = STAT_OPTIONS[def.category] ?? []
  const name = opts.find(s => s.key === def.stat)?.label ?? def.stat
  return def.scope === 'season' ? `${name} (best season)` : `${name} (career)`
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── Definition builder ────────────────────────────────────────────────────────
function DefinitionBuilder({ def, onChange, mode }) {
  const isSteal  = mode === 'steal'
  const accent   = isSteal ? 'emerald' : 'rose'
  const roundLabel = isSteal ? '≥ round' : '≤ round'
  const statLabel2 = isSteal ? '≥' : '≤'

  const inputCls = `bg-slate-800 border border-${accent}-900/60 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-${accent}-500`

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Define a "{isSteal ? 'Steal' : 'Bust'}"
      </p>

      {/* Row 1: Round + Position */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Draft {roundLabel}</span>
          <select value={def.roundVal} onChange={e => onChange({ ...def, roundVal: parseInt(e.target.value) })}
            className={inputCls}>
            {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Position</span>
          <select value={def.pos} onChange={e => onChange({ ...def, pos: e.target.value })}
            className={inputCls}>
            <option value="">All</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      {/* Row 2: Stat definition */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-slate-500 text-sm">with</span>

        {/* Category */}
        <select value={def.category}
          onChange={e => onChange({ ...def, category: e.target.value, stat: '', statVal: '' })}
          className={inputCls}>
          {STAT_CATEGORIES.map(c => (
            <option key={c} value={c}>{c === 'career_av' ? 'Career AV' : cap(c)}</option>
          ))}
        </select>

        {/* Scope — only for non-career_av */}
        {def.category !== 'career_av' && (
          <select value={def.scope} onChange={e => onChange({ ...def, scope: e.target.value })}
            className={inputCls}>
            <option value="career">Career total</option>
            <option value="season">Best season</option>
          </select>
        )}

        {/* Stat — only for non-career_av */}
        {def.category !== 'career_av' && (
          <select value={def.stat}
            onChange={e => onChange({ ...def, stat: e.target.value })}
            className={inputCls}>
            <option value="">Select stat…</option>
            {(STAT_OPTIONS[def.category] ?? []).map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        )}

        <span className="text-slate-400 text-sm font-bold">{statLabel2}</span>

        <input type="number" min="0" value={def.statVal}
          onChange={e => onChange({ ...def, statVal: e.target.value })}
          placeholder="value"
          className={`w-24 ${inputCls}`} />
      </div>

      {/* Summary sentence */}
      {isComplete(def) && (
        <p className="text-xs" style={{ color: isSteal ? '#6ee7b7' : '#fca5a5' }}>
          {isSteal ? 'Round' : 'Round 1–'}
          {isSteal ? ` ${def.roundVal}+` : `${def.roundVal}`} picks
          {def.pos ? ` (${def.pos})` : ''} with {statLabel(def)}{' '}
          {isSteal ? '≥' : '≤'} {Number(def.statVal).toLocaleString()}
        </p>
      )}
    </div>
  )
}

// ── Custom results hook ───────────────────────────────────────────────────────
function useCustomDraft(def, mode) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const timer = useRef()

  useEffect(() => {
    clearTimeout(timer.current)
    if (!isComplete(def)) { setResults(null); setError(null); return }
    timer.current = setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const data = await api.getCustomDraft({
          roundVal: def.roundVal,
          roundOp:  mode === 'steal' ? 'gte' : 'lte',
          statVal:  parseFloat(def.statVal),
          statOp:   mode === 'steal' ? 'gte' : 'lte',
          category: def.category,
          stat:     def.category !== 'career_av' ? def.stat : undefined,
          scope:    def.scope,
          pos:      def.pos || undefined,
        })
        setResults(data)
      } catch(e) { setError(e.message) }
      finally    { setLoading(false) }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [JSON.stringify(def), mode])

  return { results, loading, error }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DraftAnalysis() {
  const [tab,     setTab]     = useState('picks')
  const [avInfo,  setAvInfo]  = useState(false)
  const [filters, setFilters] = useState({ year: '', team: '', pos: '' })
  const [stealDef, setStealDef] = useState(DEFAULT_STEAL)
  const [bustDef,  setBustDef]  = useState(DEFAULT_BUST)

  const set = key => e => setFilters(f => ({ ...f, [key]: e.target.value }))

  const { data: picks, loading: pl, error: pe } = useApi(
    () => api.getDraftPicks({ draft_year: filters.year || undefined, team: filters.team || undefined, pos: filters.pos || undefined, limit: 100 }),
    [filters.year, filters.team, filters.pos]
  )

  const { results: steals, loading: sl, error: se } = useCustomDraft(stealDef, 'steal')
  const { results: busts,  loading: bl, error: be } = useCustomDraft(bustDef,  'bust')

  const stealCols = [...DRAFT_COLS, { key: 'stat_value', label: statLabel(stealDef), format: v => v?.toLocaleString() ?? '—' }]
  const bustCols  = [...DRAFT_COLS, { key: 'stat_value', label: statLabel(bustDef),  format: v => v?.toLocaleString() ?? '—' }]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">NFL</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Draft Analysis</h1>
        </div>
        <button onClick={() => setAvInfo(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            avInfo ? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
                   : 'border-slate-700 text-slate-500 hover:text-slate-300'
          }`}>
          {avInfo ? '▲' : '▼'} What is Career AV?
        </button>
      </div>

      {/* Career AV explainer */}
      {avInfo && (
        <div className="rounded-2xl border border-slate-700/60 p-5 space-y-4"
          style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b2e 100%)' }}>
          <div>
            <h2 className="text-white font-bold mb-1">Career Approximate Value (AV)</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              AV is Pro Football Reference's position-neutral metric for career quality.
              It aggregates season-by-season contributions into a single number comparable
              across all positions — a career AV of 50 means roughly the same thing for
              a QB, a DE, or a kicker.
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
              {[['Tom Brady', 273], ['Peyton Manning', 234], ['Jerry Rice', 197],
                ['Ray Lewis', 167], ['Average starter', '~45 career'], ['Typical rookie', '2–4/season']
              ].map(([name, av]) => (
                <div key={name} className="rounded-lg px-3 py-1.5 border border-slate-700/60 bg-slate-800/40">
                  <span className="text-slate-400 text-xs">{name}: </span>
                  <span className="text-white text-xs font-semibold">{av}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-600 text-xs">
            AV is best used for comparing career trajectories and draft outcomes — not for fine-grained single-season comparisons.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {[
          { id: 'picks',  label: 'Draft Picks', icon: '📋', cls: 'bg-blue-600 shadow-blue-900/40' },
          { id: 'steals', label: 'Steals',      icon: '💎', cls: 'bg-emerald-600 shadow-emerald-900/40' },
          { id: 'busts',  label: 'Busts',       icon: '📉', cls: 'bg-rose-700 shadow-rose-900/40' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id ? `${t.cls} text-white shadow-lg` : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Draft Picks ── */}
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

      {/* ── Steals ── */}
      {tab === 'steals' && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-emerald-900/60"
            style={{ background: 'linear-gradient(135deg, #052e16 0%, #0f172a 100%)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #22c55e, transparent)' }} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">💎</span>
                <p className="text-emerald-400 font-bold">Draft Steals</p>
                <span className="text-slate-600 text-xs ml-auto">Players who over-delivered on their draft slot</span>
              </div>
              <DefinitionBuilder def={stealDef} onChange={setStealDef} mode="steal" />
            </div>
          </div>

          {!isComplete(stealDef) && (
            <p className="text-slate-600 text-sm text-center py-6">
              Complete the definition above to see results.
            </p>
          )}
          {sl && <Loading text="Searching…" />}
          {se && <ErrorMsg message={se} />}
          {steals && (
            <div className="bg-slate-800/70 border border-emerald-900/40 rounded-2xl p-5">
              <p className="text-xs text-slate-600 mb-3">{steals.length} players found</p>
              <StatTable columns={stealCols} rows={steals} keyField="player_name" />
            </div>
          )}
        </div>
      )}

      {/* ── Busts ── */}
      {tab === 'busts' && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-rose-900/60"
            style={{ background: 'linear-gradient(135deg, #4c0519 0%, #0f172a 100%)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #f43f5e, transparent)' }} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📉</span>
                <p className="text-rose-400 font-bold">Draft Busts</p>
                <span className="text-slate-600 text-xs ml-auto">High picks whose careers fell short</span>
              </div>
              <DefinitionBuilder def={bustDef} onChange={setBustDef} mode="bust" />
            </div>
          </div>

          {!isComplete(bustDef) && (
            <p className="text-slate-600 text-sm text-center py-6">
              Complete the definition above to see results.
            </p>
          )}
          {bl && <Loading text="Searching…" />}
          {be && <ErrorMsg message={be} />}
          {busts && (
            <div className="bg-slate-800/70 border border-rose-900/40 rounded-2xl p-5">
              <p className="text-xs text-slate-600 mb-3">{busts.length} players found</p>
              <StatTable columns={bustCols} rows={busts} keyField="player_name" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
