import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScatterChart, Scatter, BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { ExportableChart } from '../components/StatChart'

const DRAFT_COLS = [
  { key: 'draft_year',  label: 'Year' },
  { key: 'round',       label: 'Rd' },
  { key: 'pick',        label: 'Pick' },
  { key: 'player_name', label: 'Player' },
  { key: 'pos',         label: 'Pos',
    format: (v, row) => row.draft_pos && row.draft_pos !== v ? `${v} (${row.draft_pos})` : v },
  { key: 'team',        label: 'Team' },
  { key: 'fdv',         label: 'FDV' },
]

const POSITIONS  = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const ROUNDS     = [1, 2, 3, 4, 5, 6, 7]

const STAT_OPTIONS = {
  passing: [
    { key: 'yds',      label: 'Pass Yards' },
    { key: 'td',       label: 'Touchdowns' },
    { key: 'int',      label: 'Interceptions' },
    { key: 'cmp',      label: 'Completions' },
    { key: 'att',      label: 'Attempts' },
    { key: 'rate',     label: 'Passer Rating' },
    { key: 'qbr',      label: 'QBR' },
    { key: 'y_per_a',  label: 'Yards / Attempt' },
    { key: 'any_per_a',label: 'ANY/A' },
    { key: 'sk_pct',   label: 'Sack %' },
    { key: '_4qc',     label: '4th-Qtr Comebacks' },
    { key: 'gwd',      label: 'Game-Winning Drives' },
    { key: 'sk',       label: 'Times Sacked' },
  ],
  offense: [
    { key: 'yscm',            label: 'Scrimmage Yards' },
    { key: 'rush_yds',        label: 'Rush Yards' },
    { key: 'rec_yds',         label: 'Rec Yards' },
    { key: 'rec',             label: 'Receptions' },
    { key: 'tgt',             label: 'Targets' },
    { key: 'rush_td',         label: 'Rush TDs' },
    { key: 'rec_td',          label: 'Rec TDs' },
    { key: 'touch',           label: 'Total Touches' },
    { key: 'ctch_pct',        label: 'Catch %' },
    { key: 'y_per_tgt',       label: 'Yards / Target' },
    { key: 'y_per_r',         label: 'Yards / Rush' },
    { key: 'rec_first_downs', label: 'Rec 1st Downs' },
    { key: 'rush_first_downs',label: 'Rush 1st Downs' },
    { key: 'fmb',             label: 'Fumbles' },
  ],
  defense: [
    { key: 'comb',        label: 'Total Tackles' },
    { key: 'solo',        label: 'Solo Tackles' },
    { key: 'ast',         label: 'Assisted Tackles' },
    { key: 'sk',          label: 'Sacks' },
    { key: 'int',         label: 'Interceptions' },
    { key: 'pd',          label: 'Pass Deflections' },
    { key: 'ff',          label: 'Forced Fumbles' },
    { key: 'fr',          label: 'Fumble Recoveries' },
    { key: 'tfl',         label: 'Tackles for Loss' },
    { key: 'qb_hits',     label: 'QB Hits' },
    { key: 'int_ret_yds', label: 'INT Return Yards' },
    { key: 'int_td',      label: 'INT Return TDs' },
    { key: 'fr_td',       label: 'Fumble Return TDs' },
    { key: 'sfty',        label: 'Safeties' },
  ],
  kicking: [
    { key: 'fgm_total',   label: 'FG Made (total)' },
    { key: 'fga_total',   label: 'FG Attempted' },
    { key: 'xpm',         label: 'Extra Points Made' },
    { key: 'xpa',         label: 'Extra Points Attempted' },
    { key: 'fgm_40_49',   label: 'FG Made 40–49 yds' },
    { key: 'fgm_50_plus', label: 'FG Made 50+ yds' },
    { key: 'ko',          label: 'Kickoffs' },
    { key: 'koyds',       label: 'Kickoff Yards' },
    { key: 'tb',          label: 'Touchbacks' },
    { key: 'tb_pct',      label: 'Touchback %' },
    { key: 'koavg',       label: 'Kickoff Avg' },
  ],
  punting: [
    { key: 'pnt',      label: 'Punts' },
    { key: 'yds',      label: 'Punt Yards' },
    { key: 'netyds',   label: 'Net Yards' },
    { key: 'y_per_p',  label: 'Yards / Punt' },
    { key: 'ny_per_p', label: 'Net Yards / Punt' },
    { key: 'pnt20',    label: 'Punts Inside 20' },
    { key: 'in20_pct', label: 'Inside-20 %' },
    { key: 'blck',     label: 'Blocked Punts' },
    { key: 'retyds',   label: 'Return Yards Allowed' },
  ],
  returns: [
    { key: 'kick_ret_yds',   label: 'KR Yards' },
    { key: 'punt_ret_yds',   label: 'PR Yards' },
    { key: 'kick_ret',       label: 'Kick Returns' },
    { key: 'punt_ret',       label: 'Punt Returns' },
    { key: 'kick_ret_td',    label: 'KR Touchdowns' },
    { key: 'punt_ret_td',    label: 'PR Touchdowns' },
    { key: 'y_per_kick_ret', label: 'Yards / KR' },
    { key: 'y_per_punt_ret', label: 'Yards / PR' },
    { key: 'apyd',           label: 'All-Purpose Yards' },
  ],
}

const STAT_CATEGORIES = ['fdv', 'passing', 'offense', 'defense', 'kicking', 'punting', 'returns']

const FDV_SCALE = [
  { range: '0–20',    label: 'Minimal NFL impact',           color: '#475569' },
  { range: '20–50',   label: 'Backup / role player',         color: '#64748b' },
  { range: '50–90',   label: 'Solid multi-year starter',     color: '#3b82f6' },
  { range: '90–130',  label: 'Star (probable Pro Bowls)',     color: '#f59e0b' },
  { range: '130–180', label: 'Elite (borderline HOF)',        color: '#f97316' },
  { range: '180+',    label: 'Hall of Fame level',           color: '#a78bfa' },
]

const LS_STEAL_CRITERIA = 'draft_steal_criteria_v3'
const LS_BUST_CRITERIA  = 'draft_bust_criteria_v3'

const DEFAULT_CRITERION = {
  roundVal: 4, pos: '', category: 'fdv',
  stat: '', scope: 'career', statVal: '',
}

const POS_COLORS = {
  QB: '#60a5fa', RB: '#4ade80', WR: '#fbbf24', TE: '#f97316',
  OL: '#94a3b8', DL: '#f87171', LB: '#c084fc', CB: '#34d399',
  S: '#38bdf8',  K: '#fb923c',  P: '#a78bfa',
}
function posColor(pos) { return POS_COLORS[pos?.toUpperCase()] ?? '#64748b' }

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

function statLabel(def) {
  if (def.category === 'fdv') return 'FDV'
  const opts = STAT_OPTIONS[def.category] ?? []
  const name = opts.find(s => s.key === def.stat)?.label ?? def.stat
  return def.scope === 'season' ? `${name} (best season)` : `${name} (career)`
}

function isCriterionComplete(c) {
  if (!c.pos) return false
  if (isNaN(parseFloat(c.statVal))) return false
  if (c.category !== 'fdv' && !c.stat) return false
  return true
}

function criterionLabel(c, mode) {
  const isSteal = mode === 'steal'
  const roundPart = isSteal ? `Rd ${c.roundVal}+` : `Rd 1–${c.roundVal}`
  const op = isSteal ? '≥' : '≤'
  return `${c.pos} · ${roundPart} · ${statLabel(c)} ${op} ${Number(c.statVal).toLocaleString()}`
}

function loadCriteria(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? [] } catch { return [] }
}

// ── Criterion builder ─────────────────────────────────────────────────────────
function CriterionBuilder({ value, onChange, onAdd, mode }) {
  const isSteal = mode === 'steal'
  const inputCls = isSteal
    ? 'bg-slate-800 border border-emerald-900/60 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500'
    : 'bg-slate-800 border border-rose-900/60 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-rose-500'
  const labelCls = 'text-xs text-slate-500 font-medium mb-1'
  const canAdd = isCriterionComplete(value)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Add a criterion</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

        {/* Round */}
        <div>
          <p className={labelCls}>Draft round {isSteal ? '≥' : '≤'}</p>
          <select value={value.roundVal}
            onChange={e => onChange({ ...value, roundVal: parseInt(e.target.value) })}
            className={`w-full ${inputCls}`}>
            {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Position — required */}
        <div>
          <p className={labelCls}>Position <span className="text-rose-500">*</span></p>
          <select value={value.pos}
            onChange={e => onChange({ ...value, pos: e.target.value })}
            className={`w-full ${inputCls}`}>
            <option value="">Select…</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Stat category */}
        <div>
          <p className={labelCls}>Stat category</p>
          <select value={value.category}
            onChange={e => {
              const newCat = e.target.value
              const firstStat = newCat !== 'fdv' ? (STAT_OPTIONS[newCat]?.[0]?.key ?? '') : ''
              onChange({ ...value, category: newCat, stat: firstStat, statVal: '' })
            }}
            className={`w-full ${inputCls}`}>
            {STAT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'fdv' ? 'FDV' : cap(c)}</option>
            ))}
          </select>
        </div>

        {/* Stat */}
        {value.category !== 'fdv' && (
          <div className="sm:col-span-2">
            <p className={labelCls}>Stat</p>
            <select value={value.stat}
              onChange={e => onChange({ ...value, stat: e.target.value })}
              className={`w-full ${inputCls}`}>
              <option value="">Select a stat…</option>
              {(STAT_OPTIONS[value.category] ?? []).map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Scope */}
        {value.category !== 'fdv' && (
          <div>
            <p className={labelCls}>Scope</p>
            <select value={value.scope}
              onChange={e => onChange({ ...value, scope: e.target.value })}
              className={`w-full ${inputCls}`}>
              <option value="career">Career total</option>
              <option value="season">Best season</option>
            </select>
          </div>
        )}

        {/* Threshold */}
        <div>
          <p className={labelCls}>Threshold {isSteal ? '≥' : '≤'}</p>
          <input type="number" min="0" value={value.statVal}
            onChange={e => onChange({ ...value, statVal: e.target.value })}
            placeholder="value"
            className={`w-full ${inputCls}`} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {canAdd && (
          <p className="text-xs text-slate-500 flex-1 truncate">
            {value.pos} · {mode === 'steal' ? `Round ${value.roundVal}+` : `Round 1–${value.roundVal}`} · {statLabel(value)} {mode === 'steal' ? '≥' : '≤'} {Number(value.statVal).toLocaleString()}
          </p>
        )}
        <button onClick={onAdd} disabled={!canAdd}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ml-auto shrink-0 ${
            canAdd
              ? mode === 'steal'
                ? 'border-emerald-700/60 text-emerald-400 hover:bg-emerald-900/30'
                : 'border-rose-700/60 text-rose-400 hover:bg-rose-900/30'
              : 'border-slate-700/40 text-slate-600 cursor-not-allowed'
          }`}>
          + Add to list
        </button>
      </div>
    </div>
  )
}

// ── System recommendation ─────────────────────────────────────────────────────
function SystemRecommendation({ def, mode, onApply }) {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef()

  const hasValidStat = def.category === 'fdv' || !!def.stat

  useEffect(() => {
    if (!hasValidStat) { setStats(null); return }
    clearTimeout(timer.current)
    setStats(null)
    setLoading(true)
    timer.current = setTimeout(() => {
      api.getDraftRoundStats({
        roundVal:      def.roundVal,
        roundOp:       mode === 'steal' ? 'gte' : 'lte',
        category:      def.category,
        stat:          def.category !== 'fdv' ? def.stat : undefined,
        scope:         def.scope,
        pos:           def.pos || undefined,
        draftYearFrom: def.yearFrom || undefined,
        draftYearTo:   def.yearTo   || undefined,
      })
        .then(s => { setStats(s); setLoading(false) })
        .catch(() => setLoading(false))
    }, 400)
    return () => clearTimeout(timer.current)
  }, [def.roundVal, def.pos, def.category, def.stat, def.scope, def.yearFrom, def.yearTo, mode])

  const isSteal = mode === 'steal'
  const S = isSteal
    ? { border: 'border-emerald-900/50', bg: 'bg-emerald-950/30', head: 'text-emerald-400', btn: 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/40' }
    : { border: 'border-rose-900/50',    bg: 'bg-rose-950/30',    head: 'text-rose-400',    btn: 'border-rose-800/60 text-rose-400 hover:bg-rose-900/40' }

  if (!hasValidStat) return null
  if (loading) return <p className="text-slate-600 text-xs animate-pulse pt-1">Computing recommendation…</p>
  if (!stats || stats.count < 10) return null

  const suggestion    = isSteal ? stats.p75 : stats.p25
  const roundLabel    = isSteal ? `Round ${def.roundVal}+` : `Rounds 1–${def.roundVal}`
  const posLabel      = def.pos ? ` ${def.pos}` : ''
  const statName      = statLabel(def)
  const isCareerNonAv = def.category !== 'fdv' && def.scope !== 'season'
  const filterNote    = isCareerNonAv
    ? 'Players with ≥16 career games and non-zero production only.'
    : def.scope === 'season' ? 'Players with non-zero best season only.' : ''
  const yearNote = def.yearFrom && def.yearTo
    ? `${def.yearFrom}–${def.yearTo}, `
    : def.yearFrom ? `from ${def.yearFrom}, `
    : def.yearTo   ? `up to ${def.yearTo}, `
    : ''

  return (
    <div className={`rounded-xl border ${S.border} ${S.bg} p-3 space-y-2`}>
      <p className={`text-xs font-bold uppercase tracking-wider ${S.head}`}>System recommendation</p>

      <p className="text-xs text-slate-400 leading-relaxed">
        Among <span className="text-white font-semibold">{stats.count}</span> {roundLabel}{posLabel} picks
        ({yearNote}≥4 seasons elapsed) — <span className="text-slate-300">{statName}</span>:
        avg = <span className="text-white font-semibold">{stats.avg}</span>,
        median = <span className="text-white font-semibold">{stats.p50}</span>.
        {filterNote && <span className="text-slate-600"> {filterNote}</span>}
      </p>

      <div className="flex items-center gap-1 text-xs text-slate-500 pt-0.5">
        <span className="w-5 text-right shrink-0">p25</span>
        <span className="text-slate-600 px-1 font-mono shrink-0">{stats.p25}</span>
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: '25%', background: isSteal ? '#22c55e40' : '#f43f5e80' }} />
          <div className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: '50%', background: isSteal ? '#22c55e60' : '#f43f5e60' }} />
          <div className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: '75%', background: isSteal ? '#22c55e40' : '#f43f5e40' }} />
        </div>
        <span className="text-slate-600 px-1 font-mono shrink-0">{stats.p90}</span>
        <span className="w-5 shrink-0">p90</span>
      </div>
      <div className="flex justify-between text-xs text-slate-600 px-6">
        <span>p50: {stats.p50}</span>
        <span>p75: {stats.p75}</span>
      </div>

      {isCareerNonAv && stats.p50_pg != null && (
        <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 px-3 py-2 space-y-1">
          <p className="text-xs text-slate-500 font-medium">Per game (normalized)</p>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-slate-600">p25 <span className="text-slate-400">{stats.p25_pg}</span></span>
            <span className="text-slate-600">p50 <span className="text-slate-400">{stats.p50_pg}</span></span>
            <span className="text-slate-600">p75 <span className="text-slate-400">{stats.p75_pg}</span></span>
            <span className="text-slate-600">p90 <span className="text-slate-400">{stats.p90_pg}</span></span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Per-game rates normalize for career length.{' '}
            {isSteal
              ? <>Top 25%: ≥ <span className="text-slate-400">{stats.p75_pg}</span> {statName}/game.</>
              : <>Bottom 25%: ≤ <span className="text-slate-400">{stats.p25_pg}</span> {statName}/game.</>
            }
            {' '}The Apply button sets the career-total threshold.
          </p>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 pt-1">
        <p className="text-xs text-slate-400 leading-relaxed flex-1">
          {isSteal
            ? <>The top 25% of these picks had {statName} ≥ <span className="text-white font-semibold">{stats.p75}</span>. A late-round pick clearing that bar is a genuine steal.</>
            : <>The bottom 25% of these picks had {statName} ≤ <span className="text-white font-semibold">{stats.p25}</span>. A high pick below that bar is considered a bust.</>
          }
        </p>
        <button onClick={() => onApply(suggestion)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${S.btn}`}>
          Apply ({suggestion})
        </button>
      </div>
    </div>
  )
}

// ── Scatter chart ─────────────────────────────────────────────────────────────
function DraftScatter({ results, yKey = 'fdv', statLabel: yLabel }) {
  const navigate = useNavigate()
  if (!results || results.length < 3) return null
  const dots = results
    .filter(r => r.round != null && r[yKey] != null)
    .map(r => ({ x: r.round, y: r[yKey], name: r.player_name, pos: r.pos, id: r.player_id }))
  if (dots.length < 3) return null

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
        Scatter — Round vs {yLabel}
      </p>
      <ExportableChart title={`Draft — Round vs ${yLabel}`}>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="x" type="number" name="Round"
              domain={[1, 7]} ticks={[1,2,3,4,5,6,7]}
              stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false}
              label={{ value: 'Round', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 11 }} />
            <YAxis dataKey="y" type="number" name={yLabel}
              stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} width={48} />
            <RTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                    <p className="text-white font-semibold">{d.name}</p>
                    <p className="text-slate-400">{d.pos} · Round {d.x}</p>
                    <p className="text-amber-300 font-mono">{yLabel}: {Number(d.y).toLocaleString()}</p>
                  </div>
                )
              }}
            />
            <Scatter data={dots} onClick={d => d.id && navigate(`/player/${d.id}`)}
              style={{ cursor: 'pointer' }}>
              {dots.map((d, i) => (
                <Cell key={i} fill={posColor(d.pos)} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ExportableChart>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {[...new Set(dots.map(d => d.pos))].filter(Boolean).sort().map(p => (
          <span key={p} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: posColor(p) }} />{p}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Composite ranking ─────────────────────────────────────────────────────────
// For each player, compute a z-score across all stat columns (fdv + extra criteria).
// For steals: high z-score = big over-performer. For busts: invert so big under-performer
// floats to the top. Normalise the composite to 0-100 for display.
function computeRanking(results, selectedCriteria, isSteal) {
  if (!results.length) return []

  const scoreCols = [
    'fdv',
    ...selectedCriteria
      .map((c, i) => c.category !== 'fdv' ? `crit_${i}_value` : null)
      .filter(Boolean),
  ]

  const colStats = scoreCols.map(col => {
    const vals = results.map(r => r[col]).filter(v => v != null && !isNaN(v))
    if (vals.length < 2) return { col, mean: 0, std: 1 }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length
    return { col, mean, std: Math.sqrt(variance) || 1 }
  })

  const scored = results.map(r => {
    const zs = colStats.map(({ col, mean, std }) => {
      const v = r[col]
      return v != null && !isNaN(v) ? (v - mean) / std : 0
    })
    const composite = zs.reduce((a, b) => a + b, 0) / (zs.length || 1)
    return { ...r, _composite: isSteal ? composite : -composite }
  })

  scored.sort((a, b) => b._composite - a._composite)

  const maxC = scored[0]._composite
  const minC = scored[scored.length - 1]._composite
  const range = maxC - minC || 1

  return scored.map((r, i) => ({
    ...r,
    _rank:  i + 1,
    _score: Math.round(((r._composite - minC) / range) * 100),
  }))
}

// ── Ranking chart ─────────────────────────────────────────────────────────────
function RankingChart({ ranked, isSteal, selectedCriteria }) {
  const [showInfo, setShowInfo] = useState(false)
  const top = ranked.slice(0, 15)
  if (top.length < 2) return null

  const scoreColor = isSteal ? '#22c55e' : '#f43f5e'
  const label = isSteal ? 'Steal Score' : 'Bust Score'

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex-1">
          {label} Ranking — top {top.length}
        </p>
        <button
          onClick={() => setShowInfo(v => !v)}
          className="w-5 h-5 rounded-full border border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300 transition-colors text-[11px] font-bold leading-none flex items-center justify-center"
          aria-label="How scoring works">
          ?
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 space-y-2 text-xs text-slate-400 leading-relaxed">
          <p className="text-slate-200 font-semibold text-sm">How the {label} is calculated</p>
          <p>
            Each player is scored across <span className="text-white">every criterion you combined</span> (including FDV, which is always included).
            For each stat, we compute how many standard deviations the player is above or below the <span className="text-white">average of all players in this result set</span> — this is called a <span className="text-white">z-score</span>.
          </p>
          <p>
            {isSteal
              ? <>A player who dominated in <em>every</em> criterion — e.g. high FDV <em>and</em> high passing yards for a Round 5+ pick — gets a high average z-score. That makes them the <span className="text-white">biggest steal</span>.</>
              : <>A player who underperformed in <em>every</em> criterion — e.g. low FDV <em>and</em> low passing yards for a Round 1–2 pick — gets a very negative average z-score. That makes them the <span className="text-white">biggest bust</span>.</>
            }
          </p>
          <p>
            Finally, the composite z-scores are <span className="text-white">normalised to 0–100</span> within this result set, so the {isSteal ? 'best steal' : 'biggest bust'} always shows 100 and the lowest-ranked player always shows 0. The score is <span className="text-white">relative to this specific query</span> — not an all-time absolute ranking.
          </p>
          <p className="text-slate-600">
            All criteria are weighted equally. FDV is always included as one component even if you didn't add it as an explicit criterion, since it is our position-neutral proxy for overall career quality.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-600 mb-5">
        {isSteal ? 'Highest = biggest over-performer relative to draft slot.' : 'Highest = biggest under-performer relative to draft slot.'}
      </p>

      <ResponsiveContainer width="100%" height={top.length * 32 + 20}>
        <BarChart layout="vertical" data={top}
          margin={{ left: 8, right: 55, top: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="player_name" width={150}
            tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <RTooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0]?.payload
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl space-y-1">
                  <p className="text-white font-semibold">{p.player_name}</p>
                  <p className="text-slate-400">
                    {p.pos}{p.draft_pos && p.draft_pos !== p.pos ? ` (drafted ${p.draft_pos})` : ''} · Rd {p.round}, Pick {p.pick} · {p.draft_year} · {p.team}
                  </p>
                  <p className="text-slate-400">
                    FDV: <span className="text-white font-semibold">{p.fdv != null ? Math.round(p.fdv) : '—'}</span>
                  </p>
                  {selectedCriteria.map((c, i) => {
                    if (c.category === 'fdv') return null
                    const val = p[`crit_${i}_value`]
                    return (
                      <p key={i} className="text-slate-400">
                        {statLabel(c)}: <span className="text-white font-semibold">{val?.toLocaleString() ?? '—'}</span>
                      </p>
                    )
                  })}
                  <p style={{ color: scoreColor }} className="font-semibold pt-0.5">
                    {label}: {p._score}/100
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="_score" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="_score" position="right"
              style={{ fill: '#64748b', fontSize: 11 }}
              formatter={v => v} />
            {top.map((p, i) => (
              <Cell key={i} fill={posColor(p.pos)}
                fillOpacity={0.45 + 0.55 * (p._score / 100)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {[...new Set(top.map(p => p.pos))].filter(Boolean).sort().map(pos => (
          <span key={pos} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: posColor(pos) }} />{pos}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Steal / Bust panel ────────────────────────────────────────────────────────
function StealBustPanel({ mode }) {
  const isSteal = mode === 'steal'
  const LS_KEY  = isSteal ? LS_STEAL_CRITERIA : LS_BUST_CRITERIA

  const [criteria,    setCriteria]    = useState(() => loadCriteria(LS_KEY))
  const [builder,     setBuilder]     = useState(DEFAULT_CRITERION)
  const [selectedIds, setSelectedIds] = useState([])
  const [yearFrom,    setYearFrom]    = useState('')
  const [yearTo,      setYearTo]      = useState('')
  const [results,     setResults]     = useState(null)
  const [ranked,      setRanked]      = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const timer = useRef()

  // Persist criteria
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(criteria))
  }, [criteria, LS_KEY])

  // Derived
  const selectedCriteria = criteria.filter(c => selectedIds.includes(c.id))
  const firstSel = selectedCriteria[0]
  const isCompatible = c => !firstSel || (c.pos === firstSel.pos && c.roundVal === firstSel.roundVal)

  // Add criterion
  const addCriterion = () => {
    if (!isCriterionComplete(builder)) return
    setCriteria(prev => [...prev, { ...builder, id: crypto.randomUUID() }])
    setBuilder(DEFAULT_CRITERION)
  }

  // Toggle selection (enforce pos+round compatibility)
  const toggleSelect = id => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      const c = criteria.find(x => x.id === id)
      if (!c || !isCompatible(c)) return prev
      return [...prev, id]
    })
  }

  // Delete criterion
  const deleteCriterion = id => {
    setCriteria(prev => prev.filter(c => c.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  // Update a criterion's threshold (from SystemRecommendation Apply)
  const updateThreshold = (id, val) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, statVal: String(val) } : c))
  }

  // Fetch combined results
  const fetchKey = JSON.stringify({
    ids: selectedIds,
    vals: selectedCriteria.map(c => c.statVal),
    yearFrom, yearTo,
  })

  useEffect(() => {
    clearTimeout(timer.current)
    if (!selectedIds.length || !selectedCriteria.every(isCriterionComplete)) {
      setResults(null); setRanked(null); setError(null); return
    }
    setLoading(true); setError(null)
    timer.current = setTimeout(async () => {
      try {
        const data = await api.getCombinedDraft({
          criteria: selectedCriteria.map(c => ({
            category: c.category,
            stat:     c.category !== 'fdv' ? c.stat : undefined,
            scope:    c.scope,
            stat_val: parseFloat(c.statVal),
            stat_op:  isSteal ? 'gte' : 'lte',
          })),
          round_val:       firstSel.roundVal,
          round_op:        isSteal ? 'gte' : 'lte',
          pos:             firstSel.pos,
          draft_year_from: yearFrom ? parseInt(yearFrom) : null,
          draft_year_to:   yearTo   ? parseInt(yearTo)   : null,
        })
        setResults(data)
        setRanked(computeRanking(data, selectedCriteria, isSteal))
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [fetchKey])

  // Build result columns dynamically (ranked: add # and Score columns)
  const extraCols = selectedCriteria
    .map((c, i) => ({ ...c, idx: i }))
    .filter(c => c.category !== 'fdv')
    .map(c => ({
      key:    `crit_${c.idx}_value`,
      label:  statLabel(c),
      format: v => v?.toLocaleString() ?? '—',
    }))
  const rankCol  = { key: '_rank',  label: '#' }
  const scoreCol = { key: '_score', label: isSteal ? 'Steal Score' : 'Bust Score', format: v => `${v}/100` }
  const resultCols = [rankCol, ...DRAFT_COLS, ...extraCols, scoreCol]

  // Colour palette
  const C = isSteal
    ? {
        border:     'border-emerald-900/60',
        bgGrad:     'linear-gradient(135deg, #052e16 0%, #0f172a 100%)',
        barColor:   '#22c55e',
        head:       'text-emerald-400',
        selBorder:  'border-emerald-700/60 bg-emerald-950/40',
        resBorder:  'border-emerald-900/40',
        inputFocus: 'focus:border-emerald-500',
        checkBg:    'bg-emerald-500 border-emerald-400',
      }
    : {
        border:     'border-rose-900/60',
        bgGrad:     'linear-gradient(135deg, #4c0519 0%, #0f172a 100%)',
        barColor:   '#f43f5e',
        head:       'text-rose-400',
        selBorder:  'border-rose-700/60 bg-rose-950/40',
        resBorder:  'border-rose-900/40',
        inputFocus: 'focus:border-rose-500',
        checkBg:    'bg-rose-500 border-rose-400',
      }

  return (
    <div className="space-y-4">

      {/* Builder card */}
      <div className={`rounded-2xl overflow-hidden border ${C.border}`} style={{ background: C.bgGrad }}>
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.barColor}, transparent)` }} />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{isSteal ? '💎' : '📉'}</span>
            <p className={`font-bold ${C.head}`}>{isSteal ? 'Draft Steals' : 'Draft Busts'}</p>
            <span className="text-slate-600 text-xs ml-auto">
              {isSteal ? 'Players who over-delivered on their draft slot' : 'High picks whose careers fell short'}
            </span>
          </div>
          <CriterionBuilder value={builder} onChange={setBuilder} onAdd={addCriterion} mode={mode} />
          {/* Live recommendation preview — helps user decide what threshold to enter */}
          <SystemRecommendation
            def={builder}
            mode={mode}
            onApply={v => setBuilder(b => ({ ...b, statVal: String(v) }))}
          />
        </div>
      </div>

      {/* Saved criteria list */}
      {criteria.length > 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex-1">
              Saved criteria — select to combine
            </p>
            {firstSel && (
              <p className="text-xs text-slate-600">
                {firstSel.pos} · {isSteal ? `Round ${firstSel.roundVal}+` : `Round 1–${firstSel.roundVal}`} · {selectedIds.length} selected
              </p>
            )}
            <button onClick={() => { setCriteria([]); setSelectedIds([]) }}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors">
              Clear all
            </button>
          </div>

          <div className="space-y-2">
            {criteria.map(c => {
              const selected    = selectedIds.includes(c.id)
              const compatible  = isCompatible(c)
              const disabled    = !selected && !compatible
              return (
                <div key={c.id}
                  onClick={() => !disabled && toggleSelect(c.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors ${
                    disabled
                      ? 'border-slate-800/30 bg-slate-900/20 opacity-40 cursor-default'
                      : selected
                        ? `${C.selBorder} cursor-pointer`
                        : 'border-slate-700/40 bg-slate-800/40 hover:border-slate-600/60 cursor-pointer'
                  }`}>
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    selected ? C.checkBg : 'border-slate-600'
                  }`}>
                    {selected && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
                  </div>
                  {/* Label */}
                  <p className="flex-1 text-xs text-slate-300 truncate">{criterionLabel(c, mode)}</p>
                  {/* Group badge */}
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-800/60 rounded px-1.5 py-0.5 shrink-0">
                    {c.pos} Rd{c.roundVal}{isSteal ? '+' : '−'}
                  </span>
                  {/* Delete */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteCriterion(c.id) }}
                    className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0 ml-1">
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          {!firstSel && (
            <p className="text-xs text-slate-600 text-center pt-1">
              Click criteria to select. Only criteria with the same position and round can be combined.
            </p>
          )}
        </div>
      )}

      {/* Year filter + System Recommendations (when criteria are selected) */}
      {selectedIds.length > 0 && (
        <div className="space-y-4">
          {/* Year filter */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-slate-500 font-medium shrink-0">Draft year range:</p>
            <input type="number" min="1970" max="2025" value={yearFrom}
              onChange={e => setYearFrom(e.target.value)} placeholder="From"
              className={`w-28 bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ${C.inputFocus}`} />
            <span className="text-slate-600 text-xs">–</span>
            <input type="number" min="1970" max="2025" value={yearTo}
              onChange={e => setYearTo(e.target.value)} placeholder="To"
              className={`w-28 bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ${C.inputFocus}`} />
            {(yearFrom || yearTo) && (
              <button onClick={() => { setYearFrom(''); setYearTo('') }}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                Clear
              </button>
            )}
          </div>

          {/* System Recommendation per selected criterion */}
          <div className={selectedCriteria.length > 1 ? 'grid md:grid-cols-2 gap-4' : ''}>
            {selectedCriteria.map(c => (
              <div key={c.id} className="space-y-1">
                {selectedCriteria.length > 1 && (
                  <p className="text-[10px] font-mono text-slate-600 px-1">{criterionLabel(c, mode)}</p>
                )}
                <SystemRecommendation
                  def={{ ...c, yearFrom, yearTo }}
                  mode={mode}
                  onApply={v => updateThreshold(c.id, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!selectedIds.length && criteria.length === 0 && (
        <p className="text-slate-600 text-sm text-center py-8">
          Build your first criterion above and add it to the list.
        </p>
      )}
      {!selectedIds.length && criteria.length > 0 && (
        <p className="text-slate-600 text-sm text-center py-6">
          Select criteria above to see results.
        </p>
      )}

      {/* Results */}
      {loading && <Loading text="Searching…" />}
      {error   && <ErrorMsg message={error} />}
      {ranked && (
        <>
          <RankingChart ranked={ranked} isSteal={isSteal} selectedCriteria={selectedCriteria} />
          <DraftScatter results={ranked} yKey="fdv" statLabel="FDV" />
          <div className={`bg-slate-800/70 border rounded-2xl p-5 ${C.resBorder}`}>
            <p className="text-xs text-slate-600 mb-3">
              {ranked.length} players found — sorted by {isSteal ? 'Steal' : 'Bust'} Score
            </p>
            <StatTable columns={resultCols} rows={ranked} keyField="player_name"
              title={isSteal ? 'Draft Steals' : 'Draft Busts'} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DraftAnalysis() {
  const [tab,     setTab]    = useState('picks')
  const [avInfo,  setAvInfo] = useState(false)
  const [filters, setFilters] = useState({ year: '', team: '', pos: '' })

  const set = key => e => setFilters(f => ({ ...f, [key]: e.target.value }))

  const { data: picks, loading: pl, error: pe } = useApi(
    () => api.getDraftPicks({ draft_year: filters.year || undefined, team: filters.team || undefined, pos: filters.pos || undefined, limit: 100 }),
    [filters.year, filters.team, filters.pos]
  )

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
          {avInfo ? '▲' : '▼'} What is FDV?
        </button>
      </div>

      {/* FDV explainer */}
      {avInfo && (
        <div className="rounded-2xl border border-slate-700/60 p-5 space-y-4"
          style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b2e 100%)' }}>
          <div>
            <h2 className="text-white font-bold mb-1">FDV — Fourth & Data Value</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              FDV is our proprietary, position-neutral career value metric built entirely
              from the statistics in this platform. It uses era-adjusted z-scores so a
              great season in 1978 counts the same as a great season in 2018 — an FDV
              of 90 means roughly the same thing for a QB, a DE, or a kicker.
            </p>
            <p className="text-violet-400 text-xs mt-2">
              <a href="/methodology" className="hover:text-violet-300 transition-colors underline underline-offset-2">
                Full methodology →
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Scale</p>
            <div className="flex flex-col gap-1.5">
              {FDV_SCALE.map(({ range, label, color }) => (
                <div key={range} className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold w-20 shrink-0" style={{ color }}>{range}</span>
                  <div className="flex-1 h-px" style={{ background: `${color}40` }} />
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Approximate reference points</p>
            <div className="flex flex-wrap gap-2">
              {[['Tom Brady', '~280'], ['Peyton Manning', '~240'], ['Jerry Rice', '~220'],
                ['Lawrence Taylor', '~190'], ['Quality 10-yr starter', '~100'], ['Average rookie season', '4–7/season']
              ].map(([name, fdv]) => (
                <div key={name} className="rounded-lg px-3 py-1.5 border border-slate-700/60 bg-slate-800/40">
                  <span className="text-slate-400 text-xs">{name}: </span>
                  <span className="text-white text-xs font-semibold">{fdv}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-600 text-xs">
            FDV is best used for comparing career trajectories and draft outcomes.
            Run <code className="text-slate-500">python etl/build_fdv.py</code> to compute it for all players in the database.
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
              <StatTable columns={DRAFT_COLS} rows={picks} keyField="pick" title="Draft Picks" />
            </div>
          )}
        </div>
      )}

      {tab === 'steals' && <StealBustPanel mode="steal" />}
      {tab === 'busts'  && <StealBustPanel mode="bust"  />}
    </div>
  )
}
