import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Label, Legend,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'
import { api } from '../api'
import { Loading, ErrorMsg } from '../components/Status'

// ── Stat catalogue ────────────────────────────────────────────────────────────
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
    { key: 'sk',      label: 'Sacks',              rate: false },
    { key: 'int',     label: 'Interceptions',       rate: false },
    { key: 'comb',    label: 'Total Tackles',       rate: false },
    { key: 'pd',      label: 'Pass Deflections',    rate: false },
    { key: 'ff',      label: 'Forced Fumbles',      rate: false },
    { key: 'fr',      label: 'Fumble Recoveries',   rate: false },
    { key: 'tfl',     label: 'Tackles for Loss',    rate: false },
    { key: 'qb_hits', label: 'QB Hits',             rate: false },
    { key: 'int_td',  label: 'INT Return TDs',      rate: false },
    { key: 'sfty',    label: 'Safeties',            rate: false },
  ],
  kicking: [
    { key: 'fgm_total',   label: 'FG Made',          rate: false },
    { key: 'fga_total',   label: 'FG Attempted',     rate: false },
    { key: 'xpm',         label: 'Extra Points Made',rate: false },
    { key: 'fgm_50_plus', label: 'FG Made 50+',      rate: false },
    { key: 'tb',          label: 'Touchbacks',       rate: false },
    { key: 'tb_pct',      label: 'Touchback %',      rate: true  },
  ],
  punting: [
    { key: 'pnt',      label: 'Punts',              rate: false },
    { key: 'yds',      label: 'Punt Yards',         rate: false },
    { key: 'y_per_p',  label: 'Yards / Punt',       rate: true  },
    { key: 'ny_per_p', label: 'Net Yards / Punt',   rate: true  },
    { key: 'pnt20',    label: 'Punts Inside 20',    rate: false },
    { key: 'in20_pct', label: 'Inside-20 %',        rate: true  },
    { key: 'blck',     label: 'Blocked Punts',      rate: false },
  ],
  returns: [
    { key: 'kick_ret_yds',   label: 'KR Yards',         rate: false },
    { key: 'punt_ret_yds',   label: 'PR Yards',         rate: false },
    { key: 'kick_ret_td',    label: 'KR TDs',           rate: false },
    { key: 'punt_ret_td',    label: 'PR TDs',           rate: false },
    { key: 'y_per_kick_ret', label: 'Yards / KR',       rate: true  },
    { key: 'y_per_punt_ret', label: 'Yards / PR',       rate: true  },
    { key: 'apyd',           label: 'All-Purpose Yards',rate: false },
  ],
}

const CATEGORIES = Object.keys(STAT_OPTIONS)
const POSITIONS  = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const TEAMS = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
  'DAL','DEN','DET','GB', 'HOU','IND','JAX','KC',
  'LA', 'LAC','LV', 'MIA','MIN','NE', 'NO', 'NYG',
  'NYJ','PHI','PIT','SEA','SF', 'TB', 'TEN','WAS',
]

const TEAM_COLORS = {
  ARI: '#97233F', ATL: '#A71930', BAL: '#9E7C0C', BUF: '#00338D',
  CAR: '#0085CA', CHI: '#C83803', CIN: '#FB4F14', CLE: '#FF3C00',
  DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB:  '#203731',
  HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC:  '#E31837',
  LA:  '#003594', LAC: '#0080C6', LV:  '#A5ACAF', MIA: '#008E97',
  MIN: '#4F2683', NE:  '#002244', NO:  '#B3995D', NYG: '#0B2265',
  NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SEA: '#69BE28',
  SF:  '#AA0000', TB:  '#D50A0A', TEN: '#4B92DB', WAS: '#5A1414',
}
function teamColor(team) { return TEAM_COLORS[team] ?? '#3b82f6' }

const AGG_OPTIONS = [
  { key: 'sum',      label: 'Total (sum)',         hint: 'Sum across all players each season' },
  { key: 'avg',      label: 'Per-player avg',      hint: 'Average value per contributing player' },
  { key: 'per_game', label: 'Per game (sum ÷ GP)', hint: 'Total divided by total games played — normalizes for season length' },
]

const NOTABLE = [
  { season: 2020, label: 'COVID',    color: '#f59e0b', desc: 'COVID-19 pandemic — no fans in most stadiums, compressed offseason, modified protocols' },
  { season: 2021, label: '17 games', color: '#6366f1', desc: 'NFL expanded from 16 to 17 regular-season games per team' },
]

const LINE_COLORS = ['#3b82f6', '#f97316']

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

function trendArrow(vals) {
  if (!vals || vals.length < 3) return null
  const last  = vals.slice(-3)
  const slope = last[2] - last[0]
  if (Math.abs(slope) < 0.5) return { icon: '→', cls: 'text-slate-400', label: 'Flat' }
  return slope > 0
    ? { icon: '▲', cls: 'text-emerald-400', label: 'Rising' }
    : { icon: '▼', cls: 'text-rose-400',    label: 'Falling' }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function TrendTooltip({ active, payload, label, prevByKey, lineLabels }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm shadow-xl min-w-36">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map(p => {
        const prev = prevByKey?.[p.dataKey]?.[label]
        const chg  = yoyChange(p.value, prev)
        return (
          <div key={p.dataKey} className="mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-slate-400 text-xs">{lineLabels[p.dataKey]}</span>
            </div>
            <p className="text-white font-bold text-base ml-4">{fmtVal(p.value)}</p>
            {chg != null && (
              <p className={`text-xs ml-4 ${chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}% vs prior year
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeagueTrends() {
  const [category,   setCategory]   = useState('passing')
  const [stat,       setStat]       = useState('td')
  const [agg,        setAgg]        = useState('sum')
  const [pos,        setPos]        = useState('')
  const [team1,      setTeam1]      = useState('')
  const [team2,      setTeam2]      = useState('')
  const [seasonFrom, setSeasonFrom] = useState('')
  const [seasonTo,   setSeasonTo]   = useState('')
  const [metaRange,  setMetaRange]  = useState({ min: 1999, max: 2025 })

  const [viewMode, setViewMode] = useState('over_time') // 'over_time' | 'by_team'

  const [raw1, setRaw1] = useState(null)
  const [raw2, setRaw2] = useState(null)
  const [teamData, setTeamData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const timer = useRef()

  const comparing = Boolean(team2)

  // Fetch season range meta when category changes
  useEffect(() => {
    api.getTrendMeta(category).then(m => setMetaRange(m)).catch(() => {})
  }, [category])

  // Auto-select first stat when category changes
  useEffect(() => {
    const opts = STAT_OPTIONS[category] ?? []
    if (opts.length) setStat(opts[0].key)
  }, [category])

  // Auto-set aggregation based on stat type
  useEffect(() => {
    const info = (STAT_OPTIONS[category] ?? []).find(s => s.key === stat)
    setAgg(info?.rate ? 'avg' : 'sum')
  }, [stat, category])

  // Fetch data (debounced)
  useEffect(() => {
    clearTimeout(timer.current)
    setLoading(true); setError(null)
    timer.current = setTimeout(async () => {
      const params = {
        category, stat, agg,
        pos:        pos        || undefined,
        seasonFrom: seasonFrom || undefined,
        seasonTo:   seasonTo   || undefined,
      }
      try {
        if (viewMode === 'by_team') {
          const td = await api.getTeamBreakdown(params)
          setTeamData(td); setRaw1(null); setRaw2(null)
        } else {
          const [d1, d2] = await Promise.all([
            api.getTrend({ ...params, team: team1 || undefined }),
            comparing ? api.getTrend({ ...params, team: team2 }) : Promise.resolve(null),
          ])
          setRaw1(d1); setRaw2(d2); setTeamData(null)
        }
        setLoading(false)
      } catch (e) {
        setError(e.message); setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [category, stat, agg, pos, team1, team2, seasonFrom, seasonTo, comparing, viewMode])

  // Merge datasets for chart
  const chartData = useMemo(() => {
    if (!raw1) return []
    if (!raw2) return raw1.map(r => ({ season: r.season, t1: r.value, pc1: r.player_count }))
    const map = {}
    raw1.forEach(r => { map[r.season] = { season: r.season, t1: r.value, pc1: r.player_count } })
    raw2.forEach(r => {
      if (!map[r.season]) map[r.season] = { season: r.season }
      map[r.season].t2 = r.value
      map[r.season].pc2 = r.player_count
    })
    return Object.values(map).sort((a, b) => a.season - b.season)
  }, [raw1, raw2])

  // Build per-key prev-year lookups for tooltip YoY
  const prevByKey = useMemo(() => {
    const build = (rows, key) => {
      if (!rows) return {}
      const m = {}
      rows.forEach((r, i) => { if (i > 0) m[r.season] = rows[i - 1].value })
      return m
    }
    return { t1: build(raw1, 't1'), t2: build(raw2, 't2') }
  }, [raw1, raw2])

  const team1Label = team1 || 'All teams'
  const team2Label = team2

  const lineLabels = { t1: team1Label, t2: team2Label }

  const statInfo = STAT_OPTIONS[category]?.find(s => s.key === stat)
  const aggInfo  = AGG_OPTIONS.find(a => a.key === agg)

  // Summary for primary line
  const summary = useMemo(() => {
    if (!raw1 || !raw1.length) return null
    const vals = raw1.map(d => d.value).filter(v => v != null)
    const peak   = raw1.reduce((a, b) => b.value > a.value ? b : a, raw1[0])
    const trough = raw1.reduce((a, b) => b.value < a.value ? b : a, raw1[0])
    const avg    = vals.reduce((a, b) => a + b, 0) / vals.length
    return { peak, trough, avg, latest: raw1[raw1.length - 1], trend: trendArrow(vals) }
  }, [raw1])

  const yFmt = v => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
    return v
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500'
  const labelCls = 'text-xs text-slate-500 font-medium mb-1'

  const hasData = chartData.length > 0

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

        {/* Stat row */}
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

        <div className="border-t border-slate-800" />

        {/* Filters row */}
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
              <p className={labelCls}>From season</p>
              <input type="number" value={seasonFrom} onChange={e => setSeasonFrom(e.target.value)}
                placeholder={String(metaRange.min)} min={metaRange.min} max={metaRange.max}
                className={inputCls} />
            </div>
            <div>
              <p className={labelCls}>To season</p>
              <input type="number" value={seasonTo} onChange={e => setSeasonTo(e.target.value)}
                placeholder={String(metaRange.max)} min={metaRange.min} max={metaRange.max}
                className={inputCls} />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800" />

        {/* Team comparison row */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Teams</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: LINE_COLORS[0] }} />
                Team 1
              </p>
              <select value={team1} onChange={e => setTeam1(e.target.value)} className={inputCls}>
                <option value="">All teams</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p className={labelCls}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: LINE_COLORS[1] }} />
                Team 2 <span className="text-slate-600">(optional — for comparison)</span>
              </p>
              <select value={team2} onChange={e => setTeam2(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1">
        {[
          { id: 'over_time', label: '📈 Over Time' },
          { id: 'by_team',   label: '🏟️ By Team'   },
        ].map(v => (
          <button key={v.id} onClick={() => setViewMode(v.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === v.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && <Loading text="Loading trend data…" />}
      {error   && <ErrorMsg message={error} />}
      {!loading && !error && viewMode === 'over_time' && raw1 && raw1.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-10">No data found for this combination.</p>
      )}
      {!loading && !error && viewMode === 'by_team' && teamData && teamData.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-10">No data found for this combination.</p>
      )}

      {/* ── By Team view ── */}
      {viewMode === 'by_team' && teamData && teamData.length > 0 && !loading && (
        <div className="space-y-5">
          {/* Top 3 tiles */}
          <div className="grid grid-cols-3 gap-3">
            {teamData.slice(0, 3).map((row, i) => (
              <div key={row.team} className="rounded-xl bg-slate-900/60 border border-slate-700/50 px-4 py-3">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {['🥇', '🥈', '🥉'][i]} {i === 0 ? 'Top team' : i === 1 ? '2nd' : '3rd'}
                </p>
                <p className="text-xl font-black text-white mt-0.5">{row.team}</p>
                <p className="text-sm text-slate-400 font-semibold">{fmtVal(row.value)}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <p className="text-sm font-semibold text-slate-300 mb-4">
              {statInfo?.label ?? stat} by team — {aggInfo?.label}
              {(seasonFrom || seasonTo) && (
                <span className="text-slate-500 font-normal ml-2">
                  {seasonFrom || metaRange.min}–{seasonTo || metaRange.max}
                </span>
              )}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(320, teamData.length * 22)}>
              <BarChart data={teamData} layout="vertical"
                margin={{ top: 0, right: 60, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false}
                  tickFormatter={yFmt} />
                <YAxis type="category" dataKey="team" stroke="#475569"
                  tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }} tickLine={false} width={44} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                        <p className="text-white font-bold">{label}</p>
                        <p className="text-slate-300">{fmtVal(payload[0]?.value)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {teamData.map((row, i) => (
                    <Cell key={i}
                      fill={teamColor(row.team)}
                      fillOpacity={i < 3 ? 1 : 0.75} />
                  ))}
                  <LabelList dataKey="value" position="right"
                    formatter={v => fmtVal(v)}
                    style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Team table */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">All teams</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left py-2 pr-4 font-medium w-8">#</th>
                    <th className="text-left py-2 pr-6 font-medium">Team</th>
                    <th className="text-right py-2 pr-6 font-medium">{statInfo?.label ?? stat}</th>
                    <th className="text-right py-2 font-medium">Players</th>
                  </tr>
                </thead>
                <tbody>
                  {teamData.map((row, i) => (
                    <tr key={row.team}
                      className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 pr-4 text-slate-600 font-mono text-xs">{i + 1}</td>
                      <td className="py-2 pr-6 text-white font-bold">{row.team}</td>
                      <td className="py-2 pr-6 text-right text-white font-semibold">{fmtVal(row.value)}</td>
                      <td className="py-2 text-right text-slate-500 text-xs">{row.player_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {hasData && !loading && viewMode === 'over_time' && (
        <>
          {/* Summary tiles — primary line only */}
          {summary && !comparing && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Latest',  val: summary.latest?.value, sub: summary.latest?.season },
                { label: 'Peak',    val: summary.peak?.value,   sub: summary.peak?.season   },
                { label: 'Lowest',  val: summary.trough?.value, sub: summary.trough?.season },
                { label: 'Average', val: summary.avg,           sub: `${raw1[0].season}–${raw1[raw1.length-1].season}` },
              ].map(({ label, val, sub }) => (
                <div key={label} className="rounded-xl bg-slate-900/60 border border-slate-700/50 px-4 py-3">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                  <p className="text-xl font-black text-white mt-0.5">{fmtVal(val)}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trend indicator */}
          {summary?.trend && !comparing && (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${summary.trend.cls}`}>{summary.trend.icon}</span>
              <span className="text-slate-400 text-sm">{summary.trend.label} trend (last 3 seasons)</span>
            </div>
          )}

          {/* Chart */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <p className="text-sm font-semibold text-slate-300 mb-1">
              {statInfo?.label ?? stat} — {aggInfo?.label}
              {comparing && (
                <span className="ml-2 text-slate-500 font-normal">
                  <span style={{ color: LINE_COLORS[0] }}>{team1Label}</span>
                  {' vs '}
                  <span style={{ color: LINE_COLORS[1] }}>{team2Label}</span>
                </span>
              )}
            </p>

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="season" stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} />
                <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={yFmt} width={52} />
                <Tooltip content={
                  <TrendTooltip prevByKey={prevByKey} lineLabels={lineLabels} />
                } />
                {comparing && (
                  <Legend
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{lineLabels[value]}</span>}
                  />
                )}
                {NOTABLE.map(n =>
                  chartData.some(d => d.season === n.season) && (
                    <ReferenceLine key={n.season} x={n.season} stroke={n.color}
                      strokeDasharray="4 3" strokeOpacity={0.6}>
                      <Label value={n.label} position="top"
                        style={{ fill: n.color, fontSize: 10, opacity: 0.8 }} />
                    </ReferenceLine>
                  )
                )}
                <Line type="monotone" dataKey="t1" name="t1"
                  stroke={LINE_COLORS[0]} strokeWidth={2.5}
                  dot={{ r: 3, fill: LINE_COLORS[0], strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#60a5fa' }} connectNulls />
                {comparing && (
                  <Line type="monotone" dataKey="t2" name="t2"
                    stroke={LINE_COLORS[1]} strokeWidth={2.5}
                    dot={{ r: 3, fill: LINE_COLORS[1], strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#fb923c' }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>

            {/* Reference line legend */}
            {NOTABLE.some(n => chartData.some(d => d.season === n.season)) && (
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-x-6 gap-y-2">
                {NOTABLE.map(n =>
                  chartData.some(d => d.season === n.season) && (
                    <div key={n.season} className="flex items-start gap-2">
                      <div className="mt-1.5 w-5 flex-shrink-0 border-t-2 border-dashed"
                        style={{ borderColor: n.color }} />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        <span className="font-semibold" style={{ color: n.color }}>{n.season} — {n.label}:</span>
                        {' '}{n.desc}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
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
                    <th className="text-right py-2 pr-6 font-medium">
                      <span style={{ color: LINE_COLORS[0] }}>●</span> {team1Label}
                    </th>
                    {comparing && (
                      <th className="text-right py-2 pr-6 font-medium">
                        <span style={{ color: LINE_COLORS[1] }}>●</span> {team2Label}
                      </th>
                    )}
                    {!comparing && <th className="text-right py-2 pr-6 font-medium">YoY change</th>}
                    <th className="text-right py-2 font-medium">Players</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((row, i, arr) => {
                    const prevRow = arr[i + 1]
                    const chg    = yoyChange(row.t1, prevRow?.t1)
                    return (
                      <tr key={row.season}
                        className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 pr-6 text-slate-300 font-medium">{row.season}</td>
                        <td className="py-2 pr-6 text-right text-white font-semibold">{fmtVal(row.t1)}</td>
                        {comparing && (
                          <td className="py-2 pr-6 text-right text-white font-semibold">{fmtVal(row.t2)}</td>
                        )}
                        {!comparing && (
                          <td className="py-2 pr-6 text-right">
                            {chg == null
                              ? <span className="text-slate-600">—</span>
                              : <span className={chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
                                </span>
                            }
                          </td>
                        )}
                        <td className="py-2 text-right text-slate-500 text-xs">
                          {row.pc1 ?? '—'}{comparing && row.pc2 != null ? ` / ${row.pc2}` : ''}
                        </td>
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
