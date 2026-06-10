import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Label,
} from 'recharts'
import { api } from '../api'
import { Loading, ErrorMsg } from '../components/Status'

// ── Stat catalogue (same whitelist as backend) ────────────────────────────────
const STAT_OPTIONS = {
  passing: [
    { key: 'td',        label: 'Passing TDs',         rate: false },
    { key: 'yds',       label: 'Passing Yards',        rate: false },
    { key: 'int',       label: 'Interceptions',        rate: false },
    { key: 'cmp',       label: 'Completions',          rate: false },
    { key: 'att',       label: 'Attempts',             rate: false },
    { key: 'sk',        label: 'Times Sacked',         rate: false },
    { key: 'rate',      label: 'Passer Rating',        rate: true  },
    { key: 'qbr',       label: 'QBR',                  rate: true  },
    { key: 'y_per_a',   label: 'Yards / Attempt',      rate: true  },
    { key: 'any_per_a', label: 'ANY/A',                rate: true  },
    { key: '_4qc',      label: '4th-Qtr Comebacks',    rate: false },
    { key: 'gwd',       label: 'Game-Winning Drives',  rate: false },
  ],
  offense: [
    { key: 'yscm',            label: 'Scrimmage Yards',    rate: false },
    { key: 'rush_yds',        label: 'Rush Yards',         rate: false },
    { key: 'rec_yds',         label: 'Rec Yards',          rate: false },
    { key: 'rec',             label: 'Receptions',         rate: false },
    { key: 'tgt',             label: 'Targets',            rate: false },
    { key: 'rush_td',         label: 'Rush TDs',           rate: false },
    { key: 'rec_td',          label: 'Rec TDs',            rate: false },
    { key: 'touch',           label: 'Total Touches',      rate: false },
    { key: 'fmb',             label: 'Fumbles',            rate: false },
    { key: 'ctch_pct',        label: 'Catch %',            rate: true  },
    { key: 'y_per_tgt',       label: 'Yards / Target',     rate: true  },
    { key: 'y_per_r',         label: 'Yards / Rush',       rate: true  },
    { key: 'rec_first_downs', label: 'Rec 1st Downs',      rate: false },
    { key: 'rush_first_downs',label: 'Rush 1st Downs',     rate: false },
  ],
  defense: [
    { key: 'sk',          label: 'Sacks',               rate: false },
    { key: 'int',         label: 'Interceptions',        rate: false },
    { key: 'comb',        label: 'Total Tackles',        rate: false },
    { key: 'pd',          label: 'Pass Deflections',     rate: false },
    { key: 'ff',          label: 'Forced Fumbles',       rate: false },
    { key: 'fr',          label: 'Fumble Recoveries',    rate: false },
    { key: 'tfl',         label: 'Tackles for Loss',     rate: false },
    { key: 'qb_hits',     label: 'QB Hits',              rate: false },
    { key: 'int_td',      label: 'INT Return TDs',       rate: false },
    { key: 'sfty',        label: 'Safeties',             rate: false },
  ],
  kicking: [
    { key: 'fgm_total',   label: 'FG Made',              rate: false },
    { key: 'fga_total',   label: 'FG Attempted',         rate: false },
    { key: 'xpm',         label: 'Extra Points Made',    rate: false },
    { key: 'fgm_50_plus', label: 'FG Made 50+',          rate: false },
    { key: 'tb',          label: 'Touchbacks',           rate: false },
    { key: 'tb_pct',      label: 'Touchback %',          rate: true  },
  ],
  punting: [
    { key: 'pnt',      label: 'Punts',                   rate: false },
    { key: 'yds',      label: 'Punt Yards',              rate: false },
    { key: 'y_per_p',  label: 'Yards / Punt',            rate: true  },
    { key: 'ny_per_p', label: 'Net Yards / Punt',        rate: true  },
    { key: 'pnt20',    label: 'Punts Inside 20',         rate: false },
    { key: 'in20_pct', label: 'Inside-20 %',             rate: true  },
    { key: 'blck',     label: 'Blocked Punts',           rate: false },
  ],
  returns: [
    { key: 'kick_ret_yds',   label: 'KR Yards',          rate: false },
    { key: 'punt_ret_yds',   label: 'PR Yards',          rate: false },
    { key: 'kick_ret_td',    label: 'KR TDs',            rate: false },
    { key: 'punt_ret_td',    label: 'PR TDs',            rate: false },
    { key: 'y_per_kick_ret', label: 'Yards / KR',        rate: true  },
    { key: 'y_per_punt_ret', label: 'Yards / PR',        rate: true  },
    { key: 'apyd',           label: 'All-Purpose Yards', rate: false },
  ],
}

const CATEGORIES  = Object.keys(STAT_OPTIONS)
const POSITIONS   = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']

const AGG_OPTIONS = [
  { key: 'sum',      label: 'Total (sum)',          hint: 'Sum across all players each season' },
  { key: 'avg',      label: 'Per-player avg',       hint: 'Average value per contributing player' },
  { key: 'per_game', label: 'Per game (sum ÷ GP)',  hint: 'Total divided by total games played — normalizes for season length' },
]

// Reference lines for notable NFL seasons
const NOTABLE = [
  { season: 2020, label: 'COVID', color: '#f59e0b' },
  { season: 2021, label: '17-game season', color: '#6366f1' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtVal(v) {
  if (v == null) return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)
}

function yoyChange(curr, prev) {
  if (prev == null || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function trendArrow(data) {
  if (data.length < 3) return null
  const last = data.slice(-3)
  const slope = last[2].value - last[0].value
  if (Math.abs(slope) < 0.5) return { icon: '→', cls: 'text-slate-400', label: 'Flat' }
  return slope > 0
    ? { icon: '▲', cls: 'text-emerald-400', label: 'Rising' }
    : { icon: '▼', cls: 'text-rose-400',    label: 'Falling' }
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function TrendTooltip({ active, payload, label, prevData }) {
  if (!active || !payload?.length) return null
  const val  = payload[0]?.value
  const prev = prevData?.[label]
  const chg  = yoyChange(val, prev)
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="text-slate-400 font-semibold mb-1">{label}</p>
      <p className="text-white font-bold text-lg">{fmtVal(val)}</p>
      {chg != null && (
        <p className={chg >= 0 ? 'text-emerald-400 text-xs' : 'text-rose-400 text-xs'}>
          {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}% vs prior year
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeagueTrends() {
  const [category,   setCategory]   = useState('passing')
  const [stat,       setStat]       = useState('td')
  const [agg,        setAgg]        = useState('sum')
  const [pos,        setPos]        = useState('')
  const [team,       setTeam]       = useState('')
  const [teamInput,  setTeamInput]  = useState('')
  const [seasonFrom, setSeasonFrom] = useState('')
  const [seasonTo,   setSeasonTo]   = useState('')
  const [metaRange,  setMetaRange]  = useState({ min: 2000, max: 2024 })

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const timer = useRef()

  // Fetch season range meta when category changes
  useEffect(() => {
    api.getTrendMeta(category)
      .then(m => setMetaRange(m))
      .catch(() => {})
  }, [category])

  // Auto-select first stat when category changes
  useEffect(() => {
    const opts = STAT_OPTIONS[category] ?? []
    if (opts.length) setStat(opts[0].key)
  }, [category])

  // Auto-set default aggregation based on stat type
  useEffect(() => {
    const opts = STAT_OPTIONS[category] ?? []
    const info = opts.find(s => s.key === stat)
    if (info?.rate) setAgg('avg')
    else            setAgg('sum')
  }, [stat, category])

  // Fetch trend data
  useEffect(() => {
    clearTimeout(timer.current)
    setLoading(true); setError(null)
    timer.current = setTimeout(() => {
      api.getTrend({
        category,
        stat,
        agg,
        pos:        pos  || undefined,
        team:       team || undefined,
        seasonFrom: seasonFrom || undefined,
        seasonTo:   seasonTo   || undefined,
      })
        .then(d => { setData(d); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
    }, 350)
    return () => clearTimeout(timer.current)
  }, [category, stat, agg, pos, team, seasonFrom, seasonTo])

  // Build prev-year lookup for YoY tooltip
  const prevData = useMemo(() => {
    if (!data) return {}
    const m = {}
    data.forEach((row, i) => { if (i > 0) m[row.season] = data[i - 1].value })
    return m
  }, [data])

  const statInfo   = STAT_OPTIONS[category]?.find(s => s.key === stat)
  const aggInfo    = AGG_OPTIONS.find(a => a.key === agg)
  const chartTitle = `${statInfo?.label ?? stat} — ${aggInfo?.label}`

  // Summary stats
  const summary = useMemo(() => {
    if (!data || !data.length) return null
    const values = data.map(d => d.value).filter(v => v != null)
    const peak   = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
    const trough = data.reduce((a, b) => (b.value < a.value ? b : a), data[0])
    const avg    = values.reduce((a, b) => a + b, 0) / values.length
    return { peak, trough, avg, latest: data[data.length - 1], trend: trendArrow(data) }
  }, [data])

  // Y-axis formatter
  const yFmt = v => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
    return v
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500'
  const labelCls = 'text-xs text-slate-500 font-medium mb-1'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">NFL</p>
        <h1 className="text-3xl font-black text-white tracking-tight">League Trends</h1>
        <p className="text-slate-500 text-sm mt-1">
          Aggregate statistics by season — identify how the league has evolved over time.
        </p>
      </div>

      {/* Config card */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 space-y-4">

        {/* Row 1: Stat selection */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Stat</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className={labelCls}>Category</p>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <p className={labelCls}>Stat</p>
              <select value={stat} onChange={e => setStat(e.target.value)} className={inputCls}>
                {(STAT_OPTIONS[category] ?? []).map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className={labelCls}>Aggregation</p>
              <select value={agg} onChange={e => setAgg(e.target.value)} className={inputCls}>
                {AGG_OPTIONS.map(a => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
              {aggInfo && <p className="text-xs text-slate-600 mt-1">{aggInfo.hint}</p>}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* Row 2: Filters */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Filters</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className={labelCls}>Position</p>
              <select value={pos} onChange={e => setPos(e.target.value)} className={inputCls}>
                <option value="">All positions</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className={labelCls}>Team</p>
              <input
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                onBlur={() => setTeam(teamInput.trim().toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && setTeam(teamInput.trim().toUpperCase())}
                placeholder="e.g. NWE, KC, DAL"
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}>From season</p>
              <input
                type="number"
                value={seasonFrom}
                onChange={e => setSeasonFrom(e.target.value)}
                placeholder={String(metaRange.min)}
                min={metaRange.min}
                max={metaRange.max}
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}>To season</p>
              <input
                type="number"
                value={seasonTo}
                onChange={e => setSeasonTo(e.target.value)}
                placeholder={String(metaRange.max)}
                min={metaRange.min}
                max={metaRange.max}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>

      {/* States */}
      {loading && <Loading text="Loading trend data…" />}
      {error   && <ErrorMsg message={error} />}

      {data && data.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-10">
          No data found for this combination of filters.
        </p>
      )}

      {data && data.length > 0 && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Latest',  val: summary.latest?.value,   sub: summary.latest?.season  },
              { label: 'Peak',    val: summary.peak?.value,     sub: summary.peak?.season    },
              { label: 'Lowest',  val: summary.trough?.value,   sub: summary.trough?.season  },
              { label: 'Average', val: summary.avg,             sub: `${data[0].season}–${data[data.length-1].season}` },
            ].map(({ label, val, sub }) => (
              <div key={label} className="rounded-xl bg-slate-900/60 border border-slate-700/50 px-4 py-3">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                <p className="text-xl font-black text-white mt-0.5">{fmtVal(val)}</p>
                <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Trend indicator */}
          {summary.trend && (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${summary.trend.cls}`}>{summary.trend.icon}</span>
              <span className="text-slate-400 text-sm">{summary.trend.label} trend (last 3 seasons)</span>
            </div>
          )}

          {/* Chart */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <p className="text-sm font-semibold text-slate-300 mb-4">{chartTitle}</p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="season"
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={yFmt}
                  width={52}
                />
                <Tooltip content={<TrendTooltip prevData={prevData} />} />
                {NOTABLE.map(n => (
                  data.some(d => d.season === n.season) && (
                    <ReferenceLine key={n.season} x={n.season} stroke={n.color}
                      strokeDasharray="4 3" strokeOpacity={0.6}>
                      <Label value={n.label} position="top"
                        style={{ fill: n.color, fontSize: 10, opacity: 0.8 }} />
                    </ReferenceLine>
                  )
                ))}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={statInfo?.label ?? stat}
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#60a5fa' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Season table */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Season breakdown
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left py-2 pr-6 font-medium">Season</th>
                    <th className="text-right py-2 pr-6 font-medium">{statInfo?.label ?? stat}</th>
                    <th className="text-right py-2 pr-6 font-medium">YoY change</th>
                    <th className="text-right py-2 font-medium">Players</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((row, i, arr) => {
                    const prevRow = arr[i + 1]
                    const chg    = yoyChange(row.value, prevRow?.value)
                    return (
                      <tr key={row.season}
                        className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 pr-6 text-slate-300 font-medium">{row.season}</td>
                        <td className="py-2 pr-6 text-right text-white font-semibold">{fmtVal(row.value)}</td>
                        <td className="py-2 pr-6 text-right">
                          {chg == null ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            <span className={chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-slate-500 text-xs">{row.player_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
