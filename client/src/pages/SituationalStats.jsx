import { useState, useEffect, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { Loading, ErrorMsg } from '../components/Status'
import SocialPostGenerator from '../components/SocialPostGenerator'
import ProjectPicker from '../components/ProjectPicker'
import TeamPicker, { ALL_TEAMS } from '../components/TeamPicker'

const FALLBACK_YEARS = [2025, 2024, 2023, 2022]
const POSITIONS = ['QB', 'RB', 'WR', 'TE']

const STAT_TIPS = {
  epa_per_play: 'Expected Points Added per play - how many points each play is worth on average. Positive = above average.',
  total_epa: 'Total Expected Points Added across all plays in the season.',
  wpa_per_play: 'Win Probability Added per play - how much each play changes the team\'s chance of winning.',
  total_wpa: 'Total Win Probability Added across all plays.',
  clutch_wpa: 'Total WPA in clutch situations (last 5 min, score within 8 points).',
  clutch_wpa_per_play: 'WPA per play in clutch situations.',
  clutch_epa_per_play: 'EPA per play in clutch situations.',
  success_rate: 'Percentage of plays that are "successful" - gaining 40%+ of needed yards on 1st, 60% on 2nd, or a first down on 3rd/4th.',
  comp_pct: 'Completion percentage - completed passes divided by attempts.',
  sack_rate: 'Percentage of dropbacks that result in a sack.',
  int_rate: 'Percentage of passes that result in an interception.',
  avg_yards: 'Average yards gained per play.',
  avg_air_yards: 'Average distance the ball travels in the air.',
  avg_yac: 'Average Yards After Catch.',
  catchable_pct: 'Percentage of passes that were catchable.',
  int_worthy_pct: 'Percentage of passes that deserved to be intercepted (bad decisions).',
  throwaway_pct: 'Percentage of dropbacks where the QB intentionally threw the ball away.',
  drop_pct: 'Percentage of catchable passes that were dropped by receivers.',
  contested_pct: 'Percentage of targets in contested-catch situations.',
  out_of_pocket_pct: 'Percentage of dropbacks where the QB left the pocket.',
  qb_fault_sack_pct: 'Percentage of sacks that were the QB\'s fault (held ball too long).',
  usage_pct: 'How often this personnel grouping was used (% of total plays).',
  run_location: 'Direction of the run - left, middle, or right side of the line.',
  run_gap: 'Specific gap the runner targeted (end, tackle, guard).',
  pass_location: 'Where the pass was targeted - left, middle, or right of the field.',
  pass_length: 'Short (under 15 air yards) or deep (15+ air yards) pass.',
  read_thrown: 'Which read the QB threw to - 1st, 2nd, 3rd, or checkdown read.',
  epa_dist: 'Percentage of plays with positive EPA. The bar shows the green/red split - more green = more successful plays. A high EPA+% means consistent performance, not just a few big plays.',
  play_down: 'Current down (1st, 2nd, 3rd, or 4th).',
  play_dist: 'Yards to go for a first down.',
  play_ydln: 'Yards from the end zone (1 = goal line, 99 = own 1-yard line).',
  play_players: 'For passes: QB -> Receiver. For runs: ball carrier.',
  play_result: 'TD = touchdown, INT = interception, Sack = QB sacked, Cmp = completed pass, Rush+ = successful rush, Inc = incomplete pass.',
  epa_pctile: 'League percentile - where this player ranks among all players at the same position in this situation. 90th = top 10%.',
}

let _setColTip = null

function Tip({ stat }) {
  const text = STAT_TIPS[stat]
  if (!text) return null
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    _setColTip?.({ text, x: Math.min(r.left, window.innerWidth - 236 - 12), y: r.bottom + 6 })
  }
  return (
    <span className="text-slate-600 text-xs select-none cursor-help ml-1"
      onMouseEnter={show} onMouseLeave={() => _setColTip?.(null)}>ⓘ</span>
  )
}

function ColTipPortal() {
  const [colTip, setColTip] = useState(null)
  useEffect(() => { _setColTip = setColTip; return () => { _setColTip = null } }, [])
  if (!colTip) return null
  return (
    <div style={{ position: 'fixed', top: colTip.y, left: colTip.x, zIndex: 9999 }}
      className="pointer-events-none w-56 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-300 shadow-xl whitespace-normal leading-relaxed">
      {colTip.text}
    </div>
  )
}

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'epa', label: 'EPA Rankings', icon: '📊' },
  { id: 'clutch', label: 'Clutch Rankings', icon: '🔥' },
  { id: 'explorer', label: 'Custom Explorer', icon: '🔍' },
  { id: 'splits', label: 'Situational Splits', icon: '📋' },
  { id: 'matchup', label: 'Matchup Finder', icon: '🆚' },
  { id: 'trend', label: 'Weekly Trend', icon: '📉' },
  { id: 'playaction', label: 'Play-Action', icon: '🎭' },
  { id: 'pressure', label: 'Under Pressure', icon: '💨' },
  { id: 'decisions', label: 'QB Decisions', icon: '🧠' },
  { id: 'runheatmap', label: 'Run Heatmap', icon: '🏃' },
  { id: 'passheatmap', label: 'Pass Heatmap', icon: '🎯' },
  { id: 'formation', label: 'Formations', icon: '📐' },
]

const QUICK_PRESETS = [
  { label: 'Red Zone Kings', filters: ['red_zone'], groupBy: 'team', position: 'QB' },
  { label: 'Clutch QBs', filters: ['clutch'], groupBy: 'team', position: 'QB' },
  { label: 'Best Under Pressure', section: 'pressure' },
  { label: '3rd Down Efficiency', filters: ['third_down'], groupBy: 'team' },
  { label: 'Deep Ball Leaders', filters: ['deep_pass'], groupBy: 'team', position: 'QB' },
  { label: 'Home vs Away', groupBy: 'team', compareFilters: ['home', 'away'] },
]

const TEAMS = ALL_TEAMS

function EpaColorCell({ val }) {
  if (val == null) return <span className="text-slate-500">-</span>
  const color = val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-slate-300'
  return <span className={`font-semibold ${color}`}>{val}</span>
}

function PlayerSearch({ onSelect, placeholder }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try { setResults(await api.searchPlayers(q, { limit: 8 })) }
      catch { setResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder={placeholder || 'Search player...'}
        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/40 placeholder-slate-500" />
      {results.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-20 max-h-60 overflow-y-auto">
          {results.map(p => (
            <li key={p.player_id} onClick={() => { onSelect(p); setQ(''); setResults([]) }}
              className="px-4 py-2.5 hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm">
              <span className="text-white">{p.player_name}</span>
              <span className="text-slate-500 text-xs">{p.pos}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Section Components ----

function EpaBar({ val, max }) {
  if (val == null || max === 0) return null
  const pct = Math.min(Math.abs(val) / max * 100, 100)
  const color = val > 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'
  return <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden inline-block align-middle ml-1.5"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
}

function SortHeader({ label, field, sort, setSort, tip, align = 'right' }) {
  const active = sort.field === field
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th className={`py-2 px-2 font-medium cursor-pointer hover:text-slate-300 transition-colors select-none ${align === 'left' ? 'text-left' : 'text-right'}`}
      onClick={() => setSort(prev => ({ field, dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc' }))}>
      {label}{arrow}{tip && <Tip stat={tip} />}
    </th>
  )
}

function EpaRankingsSection({ seasons }) {
  const [pos, setPos] = useState('QB')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [seasonType, setSeasonType] = useState('REG')
  const [minPlays, setMinPlays] = useState(null)
  const [teamFilter, setTeamFilter] = useState([])
  const [sort, setSort] = useState({ field: 'epa_per_play', dir: 'desc' })

  useEffect(() => {
    setLoading(true)
    const params = { position: pos, seasons, season_type: seasonType }
    if (minPlays) params.min_plays = minPlays
    if (teamFilter.length) params.teams = teamFilter
    api.getEpaRankings(params).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [pos, seasons.join(','), seasonType, minPlays, teamFilter.join(',')])

  const sorted = (data?.data || [])
    .sort((a, b) => {
      const va = a[sort.field] ?? -999, vb = b[sort.field] ?? -999
      return sort.dir === 'desc' ? vb - va : va - vb
    })

  const maxEpa = Math.max(...sorted.map(r => Math.abs(r.epa_per_play || 0)), 0.01)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {POSITIONS.map(p => (
          <button key={p} onClick={() => setPos(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pos === p ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {p}
          </button>
        ))}
        <span className="text-slate-700">|</span>
        {['REG', 'POST', 'ALL'].map(st => (
          <button key={st} onClick={() => setSeasonType(st)}
            className={`px-2.5 py-1 rounded text-xs ${seasonType === st ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {st}
          </button>
        ))}
        <span className="text-slate-700">|</span>
        <TeamPicker selected={teamFilter} setSelected={setTeamFilter} />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Min plays:
          <input type="number" value={minPlays || ''} onChange={e => setMinPlays(e.target.value ? Number(e.target.value) : null)}
            placeholder="auto" className="w-16 bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs" />
        </label>
      </div>
      {loading && <Loading text="Loading EPA rankings..." />}
      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 pr-2 w-8">#</th>
                <th className="text-left py-2 pr-2">Player</th>
                <th className="text-left py-2 pr-2">Team</th>
                <SortHeader label="EPA/play" field="epa_per_play" sort={sort} setSort={setSort} tip="epa_per_play" />
                <SortHeader label="Total EPA" field="total_epa" sort={sort} setSort={setSort} tip="total_epa" />
                <SortHeader label="WPA/play" field="wpa_per_play" sort={sort} setSort={setSort} tip="wpa_per_play" />
                <SortHeader label="Plays" field="plays" sort={sort} setSort={setSort} />
                <SortHeader label="Success%" field="success_rate" sort={sort} setSort={setSort} tip="success_rate" />
                <SortHeader label="FDV" field="fdv" sort={sort} setSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.player_id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="py-2 pr-2 text-slate-600 text-xs">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <a href={`/player/${r.pfr_id || r.player_id}`} className="text-white hover:text-amber-400 transition-colors font-medium">{r.player_name}</a>
                    {r.draft_round && <span className="text-slate-600 text-xs ml-1.5">Rd{r.draft_round}</span>}
                  </td>
                  <td className="py-2 pr-2 text-slate-400">{r.team}</td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.epa_per_play} /><EpaBar val={r.epa_per_play} max={maxEpa} /></td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.total_epa} /></td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.wpa_per_play} /></td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.plays}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.success_rate}%</td>
                  <td className="py-2 px-2 text-right text-amber-400/70">{r.fdv ? Math.round(r.fdv) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-600 mt-2">{sorted.length} players | Click any column header to sort</p>
        </div>
      )}
    </div>
  )
}

function ClutchRankingsSection({ seasons }) {
  const [pos, setPos] = useState('QB')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [teamFilter, setTeamFilter] = useState([])
  const [sort, setSort] = useState({ field: 'clutch_wpa', dir: 'desc' })

  useEffect(() => {
    setLoading(true)
    const params = { position: pos, seasons }
    if (teamFilter.length) params.teams = teamFilter
    api.getClutchRankings(params).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [pos, seasons.join(','), teamFilter.join(',')])

  const sorted = (data?.data || []).sort((a, b) => {
    const va = a[sort.field] ?? -999, vb = b[sort.field] ?? -999
    return sort.dir === 'desc' ? vb - va : va - vb
  })

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">Last 5 minutes, score within 8 points</p>
      <div className="flex gap-2 flex-wrap items-center">
        {['QB', 'RB', 'WR'].map(p => (
          <button key={p} onClick={() => setPos(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pos === p ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {p}
          </button>
        ))}
        <span className="text-slate-700">|</span>
        <TeamPicker selected={teamFilter} setSelected={setTeamFilter} />
      </div>
      {loading && <Loading text="Loading clutch rankings..." />}
      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 pr-2">#</th>
                <SortHeader label="Player" field="player_name" sort={sort} setSort={setSort} align="left" />
                <th className="text-left py-2 pr-2">Team</th>
                <SortHeader label="Clutch WPA" field="clutch_wpa" sort={sort} setSort={setSort} tip="clutch_wpa" />
                <SortHeader label="WPA/play" field="clutch_wpa_per_play" sort={sort} setSort={setSort} tip="clutch_wpa_per_play" />
                <SortHeader label="EPA/play" field="clutch_epa_per_play" sort={sort} setSort={setSort} tip="clutch_epa_per_play" />
                <SortHeader label="Plays" field="clutch_plays" sort={sort} setSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.player_id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="py-2 pr-2 text-slate-600 text-xs">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <a href={`/player/${r.player_id}`} className="text-white hover:text-amber-400 transition-colors font-medium">{r.player_name}</a>
                  </td>
                  <td className="py-2 pr-2 text-slate-400">{r.team}</td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.clutch_wpa} /></td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.clutch_wpa_per_play} /></td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.clutch_epa_per_play} /></td>
                  <td className="py-2 px-2 text-right text-slate-500">{r.clutch_plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-600 mt-2">{sorted.length} players | Click any column header to sort</p>
        </div>
      )}
    </div>
  )
}

function PercentileBar({ pct }) {
  if (pct == null) return null
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : pct >= 25 ? 'bg-orange-500' : 'bg-red-500'
  const textColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : pct >= 25 ? 'text-orange-400' : 'text-red-400'
  return (
    <div className="inline-flex items-center gap-1 ml-1.5">
      <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <span className={`text-[9px] font-bold ${textColor}`}>{pct}th</span>
    </div>
  )
}

function RadarChart({ players, data, splitKeys }) {
  const radarKeys = splitKeys.filter(k => !['overall'].includes(k)).slice(0, 10)
  const [hover, setHover] = useState(null)
  if (radarKeys.length < 3) return null
  const colors = ['#f59e0b', '#3b82f6']
  const cx = 150, cy = 140, R = 110
  const n = radarKeys.length
  const angle = (i) => (Math.PI * 2 * i / n) - Math.PI / 2

  const allEpas = radarKeys.flatMap(k => players.map(p => data[p.player_id]?.splits?.[k]?.epa_per_play ?? 0))
  const maxAbs = Math.max(...allEpas.map(Math.abs), 0.1)

  const polygon = (pIdx) => radarKeys.map((k, i) => {
    const epa = data[players[pIdx]?.player_id]?.splits?.[k]?.epa_per_play ?? 0
    const r = Math.max((epa + maxAbs) / (2 * maxAbs), 0.05) * R
    return `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`
  }).join(' ')

  const scaleValues = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map(v => Math.round(v * 100) / 100)

  return (
    <div className="flex justify-center">
      <svg width={300} height={290} className="overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((s, si) => (
          <g key={s}>
            <polygon points={radarKeys.map((_, i) => `${cx + R * s * Math.cos(angle(i))},${cy + R * s * Math.sin(angle(i))}`).join(' ')}
              fill="none" stroke="#334155" strokeWidth={0.5} />
            {si === 1 && <text x={cx + 2} y={cy - R * s - 2} className="fill-slate-600 text-[7px]">{scaleValues[3]}</text>}
          </g>
        ))}
        <text x={cx + 2} y={cy + 2} className="fill-slate-600 text-[7px]">{scaleValues[2]}</text>
        <text x={cx + 2} y={cy - R - 2} className="fill-slate-600 text-[7px]">{scaleValues[4]}</text>
        <line x1={cx - 4} y1={cy} x2={cx + R + 4} y2={cy} stroke="#475569" strokeWidth={0.3} strokeDasharray="2,2" />
        {radarKeys.map((k, i) => {
          const lbl = data[players[0]?.player_id]?.splits?.[k]?.label || k
          const lx = cx + (R + 18) * Math.cos(angle(i)), ly = cy + (R + 18) * Math.sin(angle(i))
          return <g key={k}>
            <line x1={cx} y1={cy} x2={cx + R * Math.cos(angle(i))} y2={cy + R * Math.sin(angle(i))} stroke="#334155" strokeWidth={0.5} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[8px]">{lbl.length > 12 ? lbl.slice(0, 12) + '..' : lbl}</text>
          </g>
        })}
        {players.map((p, pi) => (
          <polygon key={pi} points={polygon(pi)} fill={colors[pi]} fillOpacity={0.15} stroke={colors[pi]} strokeWidth={1.5} />
        ))}
        {players.map((p, pi) => radarKeys.map((k, i) => {
          const split = data[p.player_id]?.splits?.[k] || {}
          const epa = split.epa_per_play ?? 0
          const r = Math.max((epa + maxAbs) / (2 * maxAbs), 0.05) * R
          const dx = cx + r * Math.cos(angle(i)), dy = cy + r * Math.sin(angle(i))
          const isHovered = hover?.pi === pi && hover?.i === i
          return <g key={`${pi}-${i}`}>
            <circle cx={dx} cy={dy} r={isHovered ? 5 : 3} fill={colors[pi]} opacity={isHovered ? 1 : 0.8}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHover({ pi, i, x: dx, y: dy, epa, label: split.label || k, player: p.player_name, sr: split.success_rate, plays: split.plays })}
              onMouseLeave={() => setHover(null)} />
            {/* invisible larger hit area */}
            <circle cx={dx} cy={dy} r={10} fill="transparent"
              onMouseEnter={() => setHover({ pi, i, x: dx, y: dy, epa, label: split.label || k, player: p.player_name, sr: split.success_rate, plays: split.plays })}
              onMouseLeave={() => setHover(null)} />
          </g>
        }))}
        {hover && (
          <foreignObject x={hover.x + 8} y={hover.y - 40} width={160} height={50} className="pointer-events-none overflow-visible">
            <div className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-xl text-[10px] whitespace-nowrap">
              <p className="font-bold" style={{ color: colors[hover.pi] }}>{hover.player}</p>
              <p className="text-slate-300">{hover.label}: <span className={hover.epa >= 0 ? 'text-emerald-400' : 'text-red-400'}>{hover.epa} EPA</span> | {hover.sr}% | {hover.plays}p</p>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  )
}

function SplitsSection({ players, season, ctxParams = {} }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')

  const ctxKey = JSON.stringify(ctxParams)
  useEffect(() => {
    if (players.length === 0) return
    setLoading(true); setError(null)
    Promise.all(players.map(p => api.getSituationalSplits(p.player_id, ctxParams)))
      .then(results => {
        const d = {}
        results.forEach((r, i) => { d[players[i].player_id] = r })
        setData(d)
      })
      .catch(e => { setError(e.message || 'Failed to load splits') })
      .finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), ctxKey])

  if (players.length === 0) return <p className="text-slate-500 text-sm">Search for a player above to see splits</p>
  if (loading) return <Loading text="Loading splits..." />
  if (error) return <p className="text-red-400 text-sm">{error}</p>

  const isCompare = players.length === 2
  const p0data = data[players[0]?.player_id]
  const splitKeys = Object.keys(p0data?.splits || {})
  const percentiles = p0data?.percentiles || {}

  // Strength / weakness cards
  const ranked = splitKeys
    .filter(k => k !== 'overall' && (p0data?.splits?.[k]?.plays ?? 0) >= 10)
    .map(k => ({ key: k, label: p0data?.splits?.[k]?.label || k, epa: p0data?.splits?.[k]?.epa_per_play ?? null }))
    .filter(r => r.epa !== null)
    .sort((a, b) => b.epa - a.epa)
  const best = ranked.slice(0, 3)
  const worst = ranked.slice(-3).reverse()

  // Split comparison
  const cmpSplitA = p0data?.splits?.[compareA] || {}
  const cmpSplitB = p0data?.splits?.[compareB] || {}
  const cmpMetrics = ['epa_per_play', 'success_rate', 'avg_yards', 'plays']

  return (
    <div className="space-y-5">
      {/* Enrichment badges */}
      {players.map(p => {
        const e = data[p.player_id]?.enrichment || {}
        return (
          <div key={p.player_id} className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{p.player_name}</span>
            {e.fdv && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">FDV: {Math.round(e.fdv)}</span>}
            {e.avg_snap_pct && <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{e.avg_snap_pct}% snaps</span>}
            {e.games_missed > 0 && <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400">{e.games_missed} games missed</span>}
            {e.draft && <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">Rd{e.draft.round} Pick {e.draft.pick} ({e.draft.year})</span>}
          </div>
        )
      })}

      {/* Strength / Weakness cards */}
      {ranked.length >= 4 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-semibold text-emerald-400">Strongest Situations</p>
            {best.map(s => (
              <div key={s.key} className="flex justify-between text-xs">
                <span className="text-slate-300">{s.label}</span>
                <span className="text-emerald-400 font-bold">{s.epa} EPA{percentiles[s.key] != null && <span className="text-emerald-500/60 ml-1">{percentiles[s.key]}th</span>}</span>
              </div>
            ))}
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-400">Weakest Situations</p>
            {worst.map(s => (
              <div key={s.key} className="flex justify-between text-xs">
                <span className="text-slate-300">{s.label}</span>
                <span className="text-red-400 font-bold">{s.epa} EPA{percentiles[s.key] != null && <span className="text-red-500/60 ml-1">{percentiles[s.key]}th</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Radar chart */}
      <div className="space-y-2">
        <RadarChart players={players} data={data} splitKeys={splitKeys} />
        <div className="text-center space-y-1">
          <div className="flex justify-center gap-4">
            {players.map((p, i) => (
              <span key={p.player_id} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded-full" style={{ background: ['#f59e0b', '#3b82f6'][i] }} />
                <span className="text-white font-medium">{p.player_name}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-600">Each axis is a game situation. Further from center = higher EPA. Overlapping areas show similar performance.</p>
        </div>
      </div>

      {/* Split comparison builder */}
      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 space-y-3">
        <p className="text-xs text-slate-400 font-semibold">Compare Two Situations</p>
        <div className="flex gap-3 items-center flex-wrap">
          <select value={compareA} onChange={e => setCompareA(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs flex-1 min-w-[140px]">
            <option value="">Pick situation A...</option>
            {splitKeys.map(k => <option key={k} value={k}>{p0data?.splits?.[k]?.label || k}</option>)}
          </select>
          <span className="text-slate-600 text-xs">vs</span>
          <select value={compareB} onChange={e => setCompareB(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs flex-1 min-w-[140px]">
            <option value="">Pick situation B...</option>
            {splitKeys.map(k => <option key={k} value={k}>{p0data?.splits?.[k]?.label || k}</option>)}
          </select>
        </div>
        {compareA && compareB && compareA !== compareB && (
          <div className="grid grid-cols-2 gap-3">
            {cmpMetrics.map(m => {
              const va = cmpSplitA[m] ?? 0, vb = cmpSplitB[m] ?? 0
              const delta = (va - vb)
              const label = { epa_per_play: 'EPA/play', success_rate: 'Success%', avg_yards: 'Avg Yards', plays: 'Plays' }[m]
              return (
                <div key={m} className="bg-slate-800/60 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-bold">{va}</span>
                    <span className={`font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {delta > 0 ? '+' : ''}{m === 'plays' ? delta : typeof delta === 'number' ? delta.toFixed(3) : delta}
                    </span>
                    <span className="text-blue-400 font-bold">{vb}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Main splits table with percentile bars */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              <th className="text-left py-2 pr-3">Situation</th>
              {players.map(p => (
                <Fragment key={p.player_id}>
                  <th colSpan={isCompare ? 3 : 4} className="text-center py-2 px-1 text-amber-400/80">{isCompare ? p.player_name : ''}</th>
                </Fragment>
              ))}
            </tr>
            <tr className="text-slate-600 text-xs border-b border-slate-800">
              <th></th>
              {players.map(p => (
                <Fragment key={`h-${p.player_id}`}>
                  <th className="text-right py-1 px-1">EPA/play<Tip stat="epa_per_play" /></th>
                  {!isCompare && <th className="text-right py-1 px-1">Rank<Tip stat="epa_pctile" /></th>}
                  <th className="text-right py-1 px-1">Success%<Tip stat="success_rate" /></th>
                  <th className="text-right py-1 px-1">Plays</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {splitKeys.map(key => {
              const splits = players.map(p => data[p.player_id]?.splits?.[key] || {})
              return (
                <tr key={key} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                  <td className="py-2 pr-3 text-slate-300 text-xs font-medium">{splits[0]?.label || key}</td>
                  {splits.map((s, i) => (
                    <Fragment key={`${i}-${key}`}>
                      <td className="py-2 px-1 text-right"><EpaColorCell val={s.epa_per_play} /></td>
                      {!isCompare && <td className="py-2 px-1 text-right"><PercentileBar pct={percentiles[key]} /></td>}
                      <td className="py-2 px-1 text-right text-slate-300">{s.success_rate ?? '-'}%</td>
                      <td className="py-2 px-1 text-right text-slate-500">{s.plays ?? '-'}</td>
                    </Fragment>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SimpleSection({ title, fetchFn, players, season, renderData, ctxParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const ctxKey = ctxParams ? JSON.stringify(ctxParams) : season

  useEffect(() => {
    if (players.length === 0) { setData(null); setError(null); return }
    setLoading(true); setError(null)
    Promise.all(players.map(p => fetchFn(p.player_id, season, ctxParams)))
      .then(results => setData(results))
      .catch(e => { setData(null); setError(e.message || 'Failed to load data') })
      .finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), ctxKey])

  if (players.length === 0) return <p className="text-slate-500 text-sm">Search for a player above</p>
  if (loading) return <Loading text={`Loading ${title}...`} />
  if (error) return <p className="text-red-400 text-sm">{error}</p>
  if (!data) return null

  const hasNoData = data.every(d => d.no_data)
  return (
    <div className="space-y-4">
      {hasNoData && data[0]?.coverage && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm">
          <p className="text-amber-400">{data[0].coverage}</p>
          {data[0].available_seasons?.length > 0 && (
            <p className="text-slate-400 text-xs mt-1">Try switching to one of the available seasons above.</p>
          )}
        </div>
      )}
      {data.map((d, i) => renderData(d, players[i]))}
    </div>
  )
}

// ---- Main Page ----

export default function SituationalStats() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initSection = searchParams.get('tab') || 'dashboard'
  const initSeason = searchParams.get('seasons')?.split(',').map(Number).filter(Boolean)?.[0]
  const initSeasons = initSeason ? [initSeason] : []
  const initST = searchParams.get('st') || 'REG'
  const initOpp = searchParams.get('opp')?.split(',').filter(Boolean) || []
  const initLoc = searchParams.get('loc') || ''
  const initWF = searchParams.get('wf') || ''
  const initWT = searchParams.get('wt') || ''

  const [section, setSection] = useState(initSection)
  const [season, setSeason] = useState(2025)
  const [selectedSeasons, setSelectedSeasons] = useState(initSeasons)
  const [players, setPlayers] = useState([])
  const [availableYears, setAvailableYears] = useState(FALLBACK_YEARS)
  const [urlInited, setUrlInited] = useState(false)
  const [ctxOpponent, setCtxOpponent] = useState(initOpp)
  const [ctxSeasonType, setCtxSeasonType] = useState(initST)
  const [ctxWeekFrom, setCtxWeekFrom] = useState(initWF)
  const [ctxWeekTo, setCtxWeekTo] = useState(initWT)
  const [ctxLocation, setCtxLocation] = useState(initLoc)
  const [ctxApplied, setCtxApplied] = useState(0)
  const [finderPos, setFinderPos] = useState('')
  const [finderTeam, setFinderTeam] = useState([])
  const [finderResults, setFinderResults] = useState([])
  const [finderLoading, setFinderLoading] = useState(false)

  const multiSeasonSections = ['epa', 'clutch', 'explorer', 'splits', 'trend', 'playaction', 'pressure', 'decisions', 'runheatmap', 'passheatmap', 'formation']

  useEffect(() => {
    api.getSituationalSeasons().then(years => {
      if (years?.length) {
        setAvailableYears(years)
        if (!initSeasons.length) { setSelectedSeasons([years[0]]) }
        setSeason(years[0])
      }
      const pids = searchParams.get('p')?.split(',').filter(Boolean) || []
      if (pids.length) {
        Promise.all(pids.map(pid => api.getPlayer(pid).catch(() => null)))
          .then(results => setPlayers(results.filter(Boolean).map(r => ({ player_id: r.player_id, player_name: r.player_name, pos: r.pos }))))
      }
      setUrlInited(true)
    }).catch(() => { setUrlInited(true) })
  }, [])

  const urlSyncKey = `${section}|${selectedSeasons}|${players.map(p => p.player_id)}|${ctxSeasonType}|${ctxOpponent}|${ctxLocation}|${ctxWeekFrom}|${ctxWeekTo}`
  useEffect(() => {
    if (!urlInited) return
    const p = new URLSearchParams()
    if (section !== 'dashboard') p.set('tab', section)
    if (selectedSeasons.length) p.set('seasons', selectedSeasons.join(','))
    if (players.length) p.set('p', players.map(pl => pl.player_id).join(','))
    if (ctxSeasonType !== 'REG') p.set('st', ctxSeasonType)
    if (ctxOpponent.length) p.set('opp', ctxOpponent.join(','))
    if (ctxLocation) p.set('loc', ctxLocation)
    if (ctxWeekFrom) p.set('wf', ctxWeekFrom)
    if (ctxWeekTo) p.set('wt', ctxWeekTo)
    setSearchParams(p, { replace: true })
  }, [urlSyncKey, urlInited])

  const finderKey = `${finderPos}|${finderTeam.join(',')}|${selectedSeasons.join(',')}`
  useEffect(() => {
    if (!finderPos && !finderTeam.length) { setFinderResults([]); return }
    setFinderLoading(true); setFinderResults([])
    const key = finderKey
    api.browseSituationalPlayers({
      pos: finderPos || undefined,
      team: finderTeam.length ? finderTeam.join(',') : undefined,
      seasons: selectedSeasons,
    }).then(r => { if (finderKey === key) setFinderResults(r) })
      .catch(() => { if (finderKey === key) setFinderResults([]) })
      .finally(() => { if (finderKey === key) setFinderLoading(false) })
  }, [finderKey])

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => { api.trackPage('situational') }, [])

  if (!user?.is_admin) return null

  // Saved reports
  const [savedReports, setSavedReports] = useState([])
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    api.getSaved().then(items => setSavedReports(items.filter(i => i.type === 'situational_report'))).catch(() => {})
  }, [])

  const saveCurrentState = () => {
    const state = { section, seasons: selectedSeasons, players: players.map(p => ({ player_id: p.player_id, player_name: p.player_name, pos: p.pos })), ctxSeasonType, ctxOpponent, ctxLocation, ctxWeekFrom, ctxWeekTo }
    const label = `${SECTIONS.find(s => s.id === section)?.label || section}${players.length ? ` - ${players.map(p => p.player_name).join(' vs ')}` : ''}`
    const name = prompt('Report name:', label)
    if (!name) return
    api.createSaved({ type: 'situational_report', label: name, data: state })
      .then(() => api.getSaved().then(items => setSavedReports(items.filter(i => i.type === 'situational_report'))))
      .catch(() => {})
  }

  const loadReport = (report) => {
    const s = report.data
    if (s.section) setSection(s.section)
    if (s.seasons?.length) setSelectedSeasons(s.seasons)
    if (s.players?.length) setPlayers(s.players)
    if (s.ctxSeasonType) setCtxSeasonType(s.ctxSeasonType)
    if (s.ctxOpponent) setCtxOpponent(s.ctxOpponent)
    if (s.ctxLocation) setCtxLocation(s.ctxLocation)
    if (s.ctxWeekFrom) setCtxWeekFrom(s.ctxWeekFrom)
    if (s.ctxWeekTo) setCtxWeekTo(s.ctxWeekTo)
    setShowSaved(false)
    setCtxApplied(v => v + 1)
  }

  const deleteReport = (id) => {
    api.deleteSaved(id).then(() => setSavedReports(prev => prev.filter(r => r.id !== id))).catch(() => {})
  }

  const ctxParams = {
    seasons: selectedSeasons,
    opponent: ctxOpponent.length ? ctxOpponent.join(',') : undefined,
    season_type: ctxSeasonType,
    week_from: ctxWeekFrom || undefined,
    week_to: ctxWeekTo || undefined,
    location: ctxLocation || undefined,
    _v: ctxApplied,
  }
  const hasCtxFilters = ctxSeasonType !== 'REG' || ctxOpponent.length > 0 || ctxLocation || ctxWeekFrom || ctxWeekTo
  const applyFilters = () => setCtxApplied(v => v + 1)

  const singlePlayerSections = ['pressure', 'matchup', 'runheatmap', 'passheatmap']
  const maxPlayers = singlePlayerSections.includes(section) ? 1 : 2

  const addPlayer = (p) => {
    if (players.length < maxPlayers && !players.find(x => x.player_id === p.player_id)) {
      setPlayers(prev => [...prev, p])
    }
  }
  const removePlayer = (id) => setPlayers(prev => prev.filter(p => p.player_id !== id))

  useEffect(() => {
    if (players.length > maxPlayers) setPlayers(prev => prev.slice(0, maxPlayers))
  }, [section])

  const needsPlayer = !['epa', 'clutch', 'formation', 'explorer', 'dashboard'].includes(section)
  const hideCtxFilters = section === 'matchup'

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-48 shrink-0 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Situational Stats</p>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              section === s.id ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
        <div className="border-t border-slate-800 pt-2 mt-2 space-y-1">
          <button onClick={saveCurrentState}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors flex items-center gap-2">
            <span>💾</span> Save Report
          </button>
          <div className="relative">
            <button onClick={() => setShowSaved(!showSaved)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${showSaved ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
              <span>📂</span> Saved ({savedReports.length})
            </button>
            {showSaved && savedReports.length > 0 && (
              <div className="absolute left-full top-0 ml-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-2 w-64 max-h-80 overflow-y-auto">
                {savedReports.map(r => (
                  <div key={r.id} className="flex items-center gap-1 group">
                    <button onClick={() => loadReport(r)}
                      className="flex-1 text-left px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-400 transition-colors truncate">
                      {r.label}
                    </button>
                    <button onClick={() => deleteReport(r.id)}
                      className="text-slate-700 hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100">x</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Season + Player selectors */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {availableYears.map(y => (
              <button key={y} onClick={() => setSelectedSeasons([y])}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSeasons[0] === y ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                {y}
              </button>
            ))}
          </div>

          {needsPlayer && players.length < maxPlayers && (
            <div className="flex-1 min-w-[200px]">
              <PlayerSearch onSelect={addPlayer} placeholder={players.length === 0 ? 'Search player...' : 'Add 2nd player to compare...'} />
            </div>
          )}
          {needsPlayer && players.map(p => (
            <div key={p.player_id} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-white font-medium">{p.player_name}</span>
              <span className="text-slate-500 text-xs">{p.pos}</span>
              <button onClick={() => removePlayer(p.player_id)} className="text-slate-600 hover:text-red-400 ml-1">x</button>
            </div>
          ))}
        </div>

        {/* Player finder by position/team + context filters */}
        {needsPlayer && (
          <div className="space-y-2">
            {/* Browse by position/team */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-slate-600">Browse:</span>
              <select value={finderPos} onChange={e => setFinderPos(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs">
                <option value="">Position...</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <TeamPicker selected={finderTeam} setSelected={setFinderTeam} />
              {finderResults.length > 0 && (
                <div className="flex gap-1 flex-wrap max-w-xl">
                  {finderResults.slice(0, 20).map(p => (
                    <button key={p.player_id} onClick={() => addPlayer(p)}
                      disabled={players.some(x => x.player_id === p.player_id)}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/40 hover:text-amber-400 transition-colors disabled:opacity-30">
                      {p.player_name} <span className="text-slate-600">{p.team}</span>
                    </button>
                  ))}
                  {finderResults.length > 20 && <span className="text-[10px] text-slate-600">+{finderResults.length - 20} more</span>}
                </div>
              )}
              {finderLoading && <span className="text-[10px] text-slate-600">...</span>}
            </div>

            {/* Context filters */}
            {!hideCtxFilters && <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-slate-600">Filters:</span>
              {['REG', 'POST', 'ALL'].map(st => (
                <button key={st} onClick={() => setCtxSeasonType(st)}
                  className={`px-2 py-0.5 rounded text-[10px] ${ctxSeasonType === st ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {st}
                </button>
              ))}
              <span className="text-slate-700">|</span>
              <span className="text-[10px] text-slate-600">vs</span>
              <TeamPicker selected={ctxOpponent} setSelected={setCtxOpponent} />
              <span className="text-slate-700">|</span>
              <select value={ctxLocation} onChange={e => setCtxLocation(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 text-[10px]">
                <option value="">Home/Away</option>
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
              <span className="text-slate-700">|</span>
              <span className="text-[10px] text-slate-600">Weeks</span>
              <input type="number" min={1} max={18} value={ctxWeekFrom} onChange={e => setCtxWeekFrom(e.target.value)}
                placeholder="1" className="w-10 bg-slate-800 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[10px]" />
              <span className="text-slate-600 text-[10px]">-</span>
              <input type="number" min={1} max={18} value={ctxWeekTo} onChange={e => setCtxWeekTo(e.target.value)}
                placeholder="18" className="w-10 bg-slate-800 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[10px]" />
              <span className="text-slate-700">|</span>
              <button onClick={applyFilters}
                className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${hasCtxFilters ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                Apply Filters
              </button>
              {hasCtxFilters && (
                <button onClick={() => { setCtxSeasonType('REG'); setCtxOpponent([]); setCtxLocation(''); setCtxWeekFrom(''); setCtxWeekTo(''); setCtxApplied(v => v + 1) }}
                  className="text-[10px] text-red-400 hover:text-red-300">Reset</button>
              )}
            </div>}
          </div>
        )}

        {/* Content */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
          {section === 'dashboard' && <DashboardSection season={selectedSeasons[0]} onNavigate={setSection} />}
          {section === 'epa' && <EpaRankingsSection seasons={selectedSeasons} />}
          {section === 'clutch' && <ClutchRankingsSection seasons={selectedSeasons} />}
          {section === 'explorer' && <ExplorerSection seasons={selectedSeasons} />}
          {section === 'matchup' && <MatchupSection players={players} season={selectedSeasons[0]} />}
          {section === 'splits' && <SplitsSection players={players} ctxParams={ctxParams} />}
          {section === 'trend' && <WeeklyTrendSection players={players} season={selectedSeasons[0]} ctxParams={ctxParams} />}
          {section === 'playaction' && (<>
            <p className="text-slate-600 text-[10px]">Play-action: QB fakes a handoff before passing, freezing defenders to create open receivers.</p>
            <SimpleSection title="Play-Action" fetchFn={api.getPlayAction} players={players} season={selectedSeasons[0]} ctxParams={ctxParams}
              renderData={(d, p) => {
                const pa = d?.data?.with_play_action, noPa = d?.data?.without_play_action
                const delta = pa && noPa ? (pa.epa_per_play - noPa.epa_per_play).toFixed(3) : null
                return (
                <div key={p.player_id} className="space-y-4">
                  <p className="text-white font-semibold text-sm">{d?.player || p.player_name} <span className="text-slate-600 text-xs font-normal">{d?.season || selectedSeasons[0]}</span>
                    {d?.pa_percentile != null && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">Play-action: top {100 - d.pa_percentile}%</span>}
                  </p>
                  {d?.no_data && d.coverage && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-400">{d.coverage}</div>
                  )}
                  {pa || noPa ? (<>
                    {/* Main comparison + delta */}
                    <div className="grid grid-cols-3 gap-3">
                      {[{ s: pa, label: 'With Play-Action' }, { s: null, label: 'delta' }, { s: noPa, label: 'Without Play-Action' }].map(({ s, label }, idx) => {
                        if (idx === 1) return (
                          <div key="delta" className="bg-slate-900/80 border border-slate-700/40 rounded-xl p-4 flex flex-col items-center justify-center">
                            <p className="text-[10px] text-slate-500 mb-1">Play-Action Boost</p>
                            {delta && <p className={`text-2xl font-black ${Number(delta) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(delta) >= 0 ? '+' : ''}{delta}</p>}
                            <p className="text-[10px] text-slate-600">EPA/play difference</p>
                          </div>
                        )
                        if (!s) return <div key={idx} />
                        return (
                          <div key={label} className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-300">{label}</p>
                            <p className="text-2xl font-bold"><EpaColorCell val={s.epa_per_play} /> <span className="text-xs text-slate-600 font-normal">EPA</span></p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                              <span className="text-slate-500">Comp%</span><span className="text-slate-200 text-right">{s.comp_pct}%</span>
                              <span className="text-slate-500">Yards</span><span className="text-slate-200 text-right">{s.avg_yards}</span>
                              <span className="text-slate-500">Air Yds</span><span className="text-slate-200 text-right">{s.avg_air_yards}</span>
                              <span className="text-slate-500">YAC</span><span className="text-slate-200 text-right">{s.avg_yac}</span>
                              <span className="text-slate-500">Success%</span><span className="text-slate-200 text-right">{s.success_rate}%</span>
                              <span className="text-slate-500">Plays</span><span className="text-slate-200 text-right">{s.plays}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Depth split */}
                    {d?.depth && Object.keys(d.depth).length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">PASS DEPTH SPLIT</p>
                        <div className="grid grid-cols-2 gap-3">
                          {['short', 'deep'].map(dep => {
                            const paD = d.depth[`pa_${dep}`], noPaD = d.depth[`no_pa_${dep}`]
                            if (!paD && !noPaD) return null
                            return (
                              <div key={dep} className="bg-slate-900/40 border border-slate-700/20 rounded-lg p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-slate-300">{dep === 'short' ? 'Short (<15 air yds)' : 'Deep (15+ air yds)'}</p>
                                <div className="grid grid-cols-3 gap-1 text-[10px]">
                                  <span></span><span className="text-center text-slate-500">PA</span><span className="text-center text-slate-500">No PA</span>
                                  <span className="text-slate-500">EPA</span>
                                  <span className="text-center"><EpaColorCell val={paD?.epa} /></span>
                                  <span className="text-center"><EpaColorCell val={noPaD?.epa} /></span>
                                  <span className="text-slate-500">Comp%</span>
                                  <span className="text-center text-slate-300">{paD?.comp_pct ?? '-'}%</span>
                                  <span className="text-center text-slate-300">{noPaD?.comp_pct ?? '-'}%</span>
                                  <span className="text-slate-500">Plays</span>
                                  <span className="text-center text-slate-400">{paD?.plays ?? '-'}</span>
                                  <span className="text-center text-slate-400">{noPaD?.plays ?? '-'}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Receiver breakdown */}
                    {d?.receivers?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">BY RECEIVER</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-600 border-b border-slate-800">
                                <th className="text-left py-1 px-1">Receiver</th>
                                <th className="text-right py-1 px-1">PA EPA</th>
                                <th className="text-right py-1 px-1">PA Plays</th>
                                <th className="text-right py-1 px-1">No-PA EPA</th>
                                <th className="text-right py-1 px-1">No-PA Plays</th>
                                <th className="text-right py-1 px-1">Boost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.receivers.map(r => {
                                const boost = r.pa && r.no_pa ? (r.pa.epa - r.no_pa.epa).toFixed(3) : null
                                return (
                                  <tr key={r.name} className="border-b border-slate-800/30">
                                    <td className="py-1 px-1 text-slate-300">{r.name}</td>
                                    <td className="py-1 px-1 text-right"><EpaColorCell val={r.pa?.epa} /></td>
                                    <td className="py-1 px-1 text-right text-slate-500">{r.pa?.plays ?? '-'}</td>
                                    <td className="py-1 px-1 text-right"><EpaColorCell val={r.no_pa?.epa} /></td>
                                    <td className="py-1 px-1 text-right text-slate-500">{r.no_pa?.plays ?? '-'}</td>
                                    <td className="py-1 px-1 text-right font-bold"><span className={Number(boost) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{boost ? (Number(boost) >= 0 ? '+' : '') + boost : '-'}</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>) : <p className="text-slate-500 text-sm">No play-action data for this player/season</p>}
                </div>
                )
              }}
            />
          </>)}
          {section === 'pressure' && (<>
            <p className="text-slate-600 text-[10px] mb-2">How the QB performs when the pass rush reaches him vs when he has a clean pocket.</p>
            <PressureSection players={players} season={selectedSeasons[0]} ctxParams={ctxParams} />
          </>)}
          {section === 'decisions' && (<>
            <p className="text-slate-600 text-[10px] mb-2">FTN Charting data on throw quality, decision-making, and read progression.</p>
            <DecisionsSection players={players} season={selectedSeasons[0]} ctxParams={ctxParams} />
          </>)}
          {section === 'runheatmap' && (
            <SimpleSection title="Run Heatmap" fetchFn={api.getRunHeatmap} players={players} season={selectedSeasons[0]} ctxParams={ctxParams}
              renderData={(d, p) => (
                <div key={p.player_id} className="space-y-3">
                  <p className="text-white font-semibold">{d.player}</p>
                  {(!d.data || d.data.length === 0) && <p className="text-slate-500 text-sm">No rushing data for this player in {d.season}</p>}
                  <div className="grid grid-cols-3 gap-2 max-w-md">
                    {['left', 'middle', 'right'].map(loc => {
                      const cells = (d.data || []).filter(r => r.run_location === loc)
                      return (
                        <div key={loc} className="space-y-1">
                          <p className="text-xs text-slate-500 text-center capitalize">{loc}</p>
                          {cells.length > 0 ? cells.map(cell => {
                            const epa = cell.epa_per_play || 0
                            const bg = epa > 0 ? `rgba(74,222,128,${Math.min(Math.abs(epa) * 3, 0.6)})` : `rgba(248,113,113,${Math.min(Math.abs(epa) * 3, 0.6)})`
                            return (
                              <div key={cell.run_gap || 'none'} className="rounded-lg p-3 text-center" style={{ background: bg }}>
                                <p className="text-white font-bold text-sm">{cell.avg_yards} yds</p>
                                <p className="text-xs text-slate-200">{cell.plays} plays | EPA: {cell.epa_per_play}</p>
                                {cell.run_gap && <p className="text-xs text-slate-300">{cell.run_gap}</p>}
                              </div>
                            )
                          }) : <div className="rounded-lg p-3 bg-slate-800 text-center text-slate-600 text-xs">No data</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            />
          )}
          {section === 'passheatmap' && (
            <SimpleSection title="Pass Heatmap" fetchFn={(pid, s, ctx) => api.getPassHeatmap(pid, s, ctx)} players={players} season={selectedSeasons[0]} ctxParams={ctxParams}
              renderData={(d, p) => (
                <div key={p.player_id} className="space-y-3">
                  <p className="text-white font-semibold">{d.player}</p>
                  {(!d.data || d.data.length === 0) && <p className="text-slate-500 text-sm">No passing data for this player in {d.season}</p>}
                  <div className="grid grid-cols-3 gap-2 max-w-lg">
                    {['left', 'middle', 'right'].map(loc => {
                      const cells = (d.data || []).filter(r => r.pass_location === loc)
                      return (
                        <div key={loc} className="space-y-1">
                          <p className="text-xs text-slate-500 text-center capitalize">{loc}</p>
                          {cells.length > 0 ? cells.map(cell => {
                            const epa = cell.epa_per_play || 0
                            const bg = epa > 0 ? `rgba(74,222,128,${Math.min(Math.abs(epa) * 3, 0.6)})` : `rgba(248,113,113,${Math.min(Math.abs(epa) * 3, 0.6)})`
                            return (
                              <div key={cell.pass_length || 'none'} className="rounded-lg p-3 text-center" style={{ background: bg }}>
                                <p className="text-white font-bold text-sm">{cell.comp_pct}%</p>
                                <p className="text-xs text-slate-200">{cell.avg_yards} yds | {cell.plays} plays | EPA: {cell.epa_per_play}</p>
                                {cell.pass_length && <p className="text-xs text-slate-300">{cell.pass_length}</p>}
                              </div>
                            )
                          }) : <div className="rounded-lg p-3 bg-slate-800 text-center text-slate-600 text-xs">No data</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            />
          )}
          {section === 'formation' && <FormationSection season={selectedSeasons[0]} />}
        </div>

        {/* Content Creator */}
        {user?.is_admin && players.length > 0 && (
          <SocialPostGenerator
            data={players.map(p => ({ player_name: p.player_name, pos: p.pos }))}
            context={`Situational Stats - ${SECTIONS.find(s => s.id === section)?.label} - ${season}`}
          />
        )}
      </div>
      <ColTipPortal />
    </div>
  )
}

// ── Custom Explorer ──────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { id: 'red_zone', label: 'Red Zone', group: 'Field' },
  { id: 'goal_to_go', label: 'Goal to Go', group: 'Field' },
  { id: 'third_down', label: '3rd Down', group: 'Situation' },
  { id: 'clutch', label: 'Clutch (late & close)', group: 'Situation' },
  { id: 'leading', label: 'Leading', group: 'Score' },
  { id: 'trailing', label: 'Trailing', group: 'Score' },
  { id: 'shotgun', label: 'Shotgun', group: 'Formation' },
  { id: 'no_huddle', label: 'No Huddle', group: 'Formation' },
  { id: 'home', label: 'Home', group: 'Context' },
  { id: 'dome', label: 'Dome', group: 'Context' },
  { id: 'cold', label: 'Cold (<40F)', group: 'Context' },
  { id: 'deep_pass', label: 'Deep Pass (20+ air yds)', group: 'Pass' },
  { id: 'short_pass', label: 'Short Pass (<10 air yds)', group: 'Pass' },
]

const GROUP_OPTIONS = [
  { id: 'team', label: 'Team' },
  { id: 'down', label: 'Down' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'play_type', label: 'Run vs Pass' },
  { id: 'week', label: 'Week' },
  { id: 'field_zone', label: 'Field Position' },
  { id: 'score_diff', label: 'Score Margin' },
  { id: 'pass_depth', label: 'Pass Depth' },
]

function EpaSplitBar({ buckets, onClick }) {
  if (!buckets?.length) return null
  let pos = 0, neg = 0
  buckets.forEach(b => { if (b.epa >= 0) pos += b.count; else neg += b.count })
  const total = pos + neg
  if (!total) return null
  const pct = Math.round(pos / total * 100)
  return (
    <div className="inline-flex items-center gap-1.5 align-middle cursor-pointer group" onClick={onClick}>
      <div className="w-14 h-2 rounded-full overflow-hidden flex bg-slate-800 group-hover:h-3 transition-all">
        <div className="bg-emerald-500 h-full" style={{ width: `${pct}%` }} />
        <div className="bg-red-500 h-full flex-1" />
      </div>
      <span className={`text-[10px] font-medium ${pct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{pct}%</span>
    </div>
  )
}

function EpaDistDetail({ buckets, label, onClose }) {
  if (!buckets?.length) return null
  const sorted = [...buckets].sort((a, b) => a.epa - b.epa)
  const maxCount = Math.max(...sorted.map(b => b.count))
  let pos = 0, neg = 0, totalEpa = 0
  sorted.forEach(b => {
    if (b.epa >= 0) pos += b.count; else neg += b.count
    totalEpa += b.epa * b.count
  })
  const total = pos + neg
  const barH = 100

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white font-semibold">EPA Distribution - {label}</p>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-emerald-400">{pos} positive plays ({Math.round(pos / total * 100)}%)</span>
        <span className="text-red-400">{neg} negative plays ({Math.round(neg / total * 100)}%)</span>
        <span className="text-slate-400">{total} total</span>
      </div>
      <div className="flex items-end gap-0.5" style={{ height: barH + 30 }}>
        {sorted.map((b, i) => {
          const h = Math.max((b.count / maxCount) * barH, 3)
          return (
            <div key={i} className="flex-1 flex flex-col items-center group/bar">
              <div className="relative w-full flex justify-center" style={{ height: barH }}>
                <div className={`w-full rounded-t-sm ${b.epa >= 0 ? 'bg-emerald-500' : 'bg-red-500'} absolute bottom-0`}
                  style={{ height: h }} />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap z-10 pointer-events-none">
                  EPA {b.epa}: {b.count} plays
                </div>
              </div>
              <span className="text-[8px] text-slate-600 mt-1">{b.epa}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const RESULT_FILTERS = [
  { id: 'td', label: 'TD', cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  { id: 'int', label: 'INT', cls: 'text-red-400 border-red-500/40 bg-red-500/10' },
  { id: 'sack', label: 'Sack', cls: 'text-red-400 border-red-500/40 bg-red-500/10' },
  { id: 'cmp', label: 'Cmp', cls: 'text-slate-300 border-slate-600 bg-slate-700/30' },
  { id: 'rush_success', label: 'Rush+', cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  { id: 'inc', label: 'Inc', cls: 'text-red-300 border-red-500/30 bg-red-500/5' },
]

function PlayLogPanel({ body, onClose }) {
  const [plays, setPlays] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortCol, setSortCol] = useState('epa')
  const [sortDir, setSortDir] = useState('desc')
  const [resultFilter, setResultFilter] = useState([])
  const limit = 50

  const load = (off = 0, col = sortCol, dir = sortDir, rf = resultFilter) => {
    setLoading(true); setError(null)
    const req = { ...body, offset: off, limit, sort: col, sort_dir: dir }
    if (rf.length) req.result_filter = rf
    api.postExplorerPlays(req)
      .then(d => { setPlays(d.plays); setTotal(d.total); setOffset(off) })
      .catch(e => setError(e.message || 'Failed to load plays'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(0) }, [])

  const toggleSort = (col) => {
    const dir = sortCol === col && sortDir === 'desc' ? 'asc' : 'desc'
    setSortCol(col); setSortDir(dir); load(0, col, dir, resultFilter)
  }

  const toggleResult = (id) => {
    const next = resultFilter.includes(id) ? resultFilter.filter(r => r !== id) : [...resultFilter, id]
    setResultFilter(next); load(0, sortCol, sortDir, next)
  }

  const exportCsv = () => {
    const headers = ['Week','Qtr','Down','Dist','YdLine','Type','Yards','EPA','WPA','Success','Player','Team','Def']
    const rows = plays.map(p => [
      p.week, p.qtr, p.down, p.ydstogo, p.yardline_100, p.play_type, p.yards_gained,
      p.epa, p.wpa, p.success, p.passer_player_name || p.rusher_player_name || '', p.posteam, p.defteam
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plays.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const SortTh = ({ label, col, tip }) => (
    <th className="py-1 px-1.5 text-right cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort(col)}>
      {label}{sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}{tip && <Tip stat={tip} />}
    </th>
  )

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{total.toLocaleString()} plays found</p>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="text-xs text-amber-400 hover:text-amber-300">Export CSV</button>
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {RESULT_FILTERS.map(rf => (
          <button key={rf.id} onClick={() => toggleResult(rf.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${resultFilter.includes(rf.id) ? rf.cls : 'text-slate-600 border-slate-700/50 bg-slate-800/50 hover:text-slate-400'}`}>
            {rf.label}
          </button>
        ))}
        {resultFilter.length > 0 && <button onClick={() => { setResultFilter([]); load(0, sortCol, sortDir, []) }} className="text-[10px] text-slate-600 hover:text-slate-400 ml-1">Clear</button>}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {loading ? <Loading text="Loading plays..." /> : (
        <>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="text-slate-600 border-b border-slate-800">
                  <th className="py-1 px-1.5 text-left">Wk</th>
                  <th className="py-1 px-1.5 text-left">Q</th>
                  <th className="py-1 px-1.5 text-left">Down<Tip stat="play_down" /></th>
                  <th className="py-1 px-1.5 text-right">Dist<Tip stat="play_dist" /></th>
                  <th className="py-1 px-1.5 text-right">YdLn<Tip stat="play_ydln" /></th>
                  <th className="py-1 px-1.5 text-left">Type</th>
                  <SortTh label="Yards" col="yards_gained" tip="avg_yards" />
                  <SortTh label="EPA" col="epa" tip="epa_per_play" />
                  <SortTh label="WPA" col="wpa" tip="wpa_per_play" />
                  <th className="py-1 px-1.5 text-left">Player(s)<Tip stat="play_players" /></th>
                  <th className="py-1 px-1.5 text-left">Teams</th>
                  <th className="py-1 px-1.5 text-center">Result<Tip stat="play_result" /></th>
                </tr>
              </thead>
              <tbody>
                {plays.map((p, i) => {
                  const playerStr = p.pass_attempt
                    ? `${p.passer_player_name || '?'}${p.receiver_player_name ? ` -> ${p.receiver_player_name}` : ''}`
                    : p.rusher_player_name || '-'
                  return (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/30">
                    <td className="py-1 px-1.5 text-slate-400">{p.week}</td>
                    <td className="py-1 px-1.5 text-slate-500">Q{p.qtr}</td>
                    <td className="py-1 px-1.5 text-slate-400">{p.down ? `${p.down}` : '-'}</td>
                    <td className="py-1 px-1.5 text-right text-slate-400">{p.ydstogo ?? '-'}</td>
                    <td className="py-1 px-1.5 text-right text-slate-500">{p.yardline_100 ?? '-'}</td>
                    <td className="py-1 px-1.5"><span className={p.play_type === 'pass' ? 'text-blue-400' : 'text-orange-400'}>{p.play_type}</span></td>
                    <td className="py-1 px-1.5 text-right text-white font-medium">{p.yards_gained}</td>
                    <td className="py-1 px-1.5 text-right"><EpaColorCell val={p.epa != null ? Math.round(p.epa * 1000) / 1000 : null} /></td>
                    <td className="py-1 px-1.5 text-right"><EpaColorCell val={p.wpa != null ? Math.round(p.wpa * 10000) / 10000 : null} /></td>
                    <td className="py-1 px-1.5 text-slate-300 truncate max-w-[140px]">{playerStr}</td>
                    <td className="py-1 px-1.5 text-slate-500">{p.posteam} v {p.defteam}</td>
                    <td className="py-1 px-1.5 text-center">
                      {p.touchdown ? <span className="text-emerald-400">TD</span> : p.interception ? <span className="text-red-400">INT</span> : p.sack ? <span className="text-red-400">Sack</span> : p.complete_pass ? <span className="text-slate-400">Cmp</span> : p.rush_attempt && p.success ? <span className="text-emerald-400/70">Rush+</span> : p.pass_attempt && !p.complete_pass ? <span className="text-red-400/60">Inc</span> : ''}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 items-center text-xs">
            <button onClick={() => load(Math.max(0, offset - limit))} disabled={offset === 0} className="px-2 py-1 rounded bg-slate-800 text-slate-400 disabled:opacity-30">Prev</button>
            <span className="text-slate-500">{offset + 1}-{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
            <button onClick={() => load(offset + limit)} disabled={offset + limit >= total} className="px-2 py-1 rounded bg-slate-800 text-slate-400 disabled:opacity-30">Next</button>
          </div>
        </>
      )}
    </div>
  )
}

function ComparePanel({ rows, onClose }) {
  if (rows.length !== 2) return null
  const [a, b] = rows
  const metrics = [
    { key: 'epa_per_play', label: 'EPA/play' },
    { key: 'total_epa', label: 'Total EPA' },
    { key: 'success_rate', label: 'Success%' },
    { key: 'avg_yards', label: 'Avg Yards' },
    { key: 'pass_pct', label: 'Pass%' },
    { key: 'wpa_per_play', label: 'WPA/play' },
    { key: 'plays', label: 'Plays' },
  ]
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white font-semibold">Comparing: <span className="text-amber-400">{a._label}</span> vs <span className="text-blue-400">{b._label}</span></p>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {metrics.map(m => {
          const va = a[m.key] ?? 0, vb = b[m.key] ?? 0
          const winner = Math.abs(va) > Math.abs(vb) ? 'a' : Math.abs(vb) > Math.abs(va) ? 'b' : null
          return (
            <div key={m.key} className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-2">{m.label}<Tip stat={m.key} /></p>
              <div className="flex items-center justify-between gap-3">
                <div className="text-center flex-1">
                  <p className={`text-lg font-bold ${winner === 'a' ? 'text-amber-400' : 'text-amber-400/50'}`}>{va}</p>
                  <div className="h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(Math.abs(va) / Math.max(Math.abs(va), Math.abs(vb), 0.01) * 100, 4)}%` }} />
                  </div>
                </div>
                <span className="text-slate-600 text-xs">vs</span>
                <div className="text-center flex-1">
                  <p className={`text-lg font-bold ${winner === 'b' ? 'text-blue-400' : 'text-blue-400/50'}`}>{vb}</p>
                  <div className="h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(Math.abs(vb) / Math.max(Math.abs(va), Math.abs(vb), 0.01) * 100, 4)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExplorerSection({ seasons }) {
  const season = seasons[0]
  const [filters, setFilters] = useState([])
  const [groupBy, setGroupBy] = useState('team')
  const [teamFilter, setTeamFilter] = useState([])
  const [position, setPosition] = useState('')
  const [seasonType, setSeasonType] = useState('REG')
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerId, setPlayerId] = useState(null)
  const [playerName, setPlayerName] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState({ field: 'epa_per_play', dir: 'desc' })
  const [expandedRow, setExpandedRow] = useState(null)
  const [expandedDist, setExpandedDist] = useState(null)
  const [compareRows, setCompareRows] = useState([])
  const [showCheckedPlays, setShowCheckedPlays] = useState(false)
  const [drillStack, setDrillStack] = useState([])

  useEffect(() => {
    if (playerSearch.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      try { setSearchResults(await api.searchPlayers(playerSearch, { limit: 6 })) }
      catch { setSearchResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [playerSearch])

  const buildBody = () => ({
    season, filters, group_by: groupBy,
    team: teamFilter.length ? teamFilter.join(',') : undefined,
    position: position || undefined,
    player_id: playerId || undefined,
    season_type: seasonType,
    drill: drillStack.length ? drillStack[drillStack.length - 1] : undefined,
  })

  const run = () => {
    setLoading(true); setExpandedRow(null); setCompareRows([])
    api.postExplorer(buildBody())
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }

  useEffect(() => { run() }, [season])

  const drillDown = (field, value) => {
    setDrillStack(prev => [...prev, { field, value }])
    setLoading(true); setExpandedRow(null); setCompareRows([])
    const nextGroupMap = { team: 'down', down: 'play_type', quarter: 'down', play_type: 'field_zone', week: 'down', field_zone: 'play_type', score_diff: 'play_type', pass_depth: 'team' }
    const nextGroup = nextGroupMap[groupBy] || 'team'
    api.postExplorer({ ...buildBody(), group_by: nextGroup, drill: { field, value } })
      .then(d => { setData(d); setSort({ field: 'epa_per_play', dir: 'desc' }) })
      .catch(() => setData(null)).finally(() => setLoading(false))
  }

  const popDrill = () => {
    setDrillStack(prev => prev.slice(0, -1))
    setTimeout(run, 0)
  }

  const toggleFilter = (id) => setFilters(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])

  const toggleCompare = (row, label) => {
    setCompareRows(prev => {
      const exists = prev.find(r => r._label === label)
      if (exists) return prev.filter(r => r._label !== label)
      return [...prev, { ...row, _label: label }]
    })
    setShowCheckedPlays(false)
  }

  const exportCsv = () => {
    const headers = [GROUP_OPTIONS.find(g => g.id === (data?.group_by || groupBy))?.label || 'Group', 'EPA/play', 'Total EPA', 'Success%', 'Avg Yards', 'Pass%', 'WPA/play', 'Plays']
    const rows = (data?.data || []).map(r => {
      const gKey = r[data?.group_by || groupBy] || Object.values(r)[0]
      return [gKey, r.epa_per_play, r.total_epa, r.success_rate, r.avg_yards, r.pass_pct, r.wpa_per_play, r.plays]
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'explorer_results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const sorted = (data?.data || []).sort((a, b) => {
    const va = a[sort.field] ?? -999, vb = b[sort.field] ?? -999
    return sort.dir === 'desc' ? vb - va : va - vb
  })

  const maxEpa = Math.max(...sorted.map(r => Math.abs(r.epa_per_play || 0)), 0.01)
  const groups = [...new Set(FILTER_OPTIONS.map(f => f.group))]
  const activeGroupBy = data?.group_by || groupBy

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">Build custom queries - pick filters, group results, drill down into rows, compare, and export.</p>

      {/* Filters */}
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-600 text-xs w-16 shrink-0">{g}</span>
            {FILTER_OPTIONS.filter(f => f.group === g).map(f => (
              <button key={f.id} onClick={() => toggleFilter(f.id)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${filters.includes(f.id) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 hover:text-slate-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex gap-2 flex-wrap items-center">
        <label className="text-xs text-slate-500">Group by:</label>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs">
          {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <select value={seasonType} onChange={e => setSeasonType(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs">
          <option value="REG">Regular</option>
          <option value="POST">Playoffs</option>
          <option value="ALL">All</option>
        </select>
        <TeamPicker selected={teamFilter} setSelected={setTeamFilter} />
        <select value={position} onChange={e => setPosition(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs">
          <option value="">All positions</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="relative">
          <input value={playerSearch} onChange={e => { setPlayerSearch(e.target.value); if (!e.target.value) { setPlayerId(null); setPlayerName('') } }}
            placeholder={playerName || 'Filter by player...'} className="w-40 bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs placeholder-slate-500" />
          {searchResults.length > 0 && (
            <ul className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl z-20 max-h-40 overflow-y-auto">
              {searchResults.map(p => (
                <li key={p.player_id} onClick={() => { setPlayerId(p.player_id); setPlayerName(p.player_name); setPlayerSearch(''); setSearchResults([]) }}
                  className="px-3 py-1.5 hover:bg-slate-700 cursor-pointer text-xs text-white">{p.player_name} <span className="text-slate-500">{p.pos}</span></li>
              ))}
            </ul>
          )}
        </div>
        {playerName && <button onClick={() => { setPlayerId(null); setPlayerName(''); setPlayerSearch('') }} className="text-xs text-red-400 hover:text-red-300">x {playerName}</button>}
        <button onClick={() => { setDrillStack([]); run() }} className="px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors">
          Run Query
        </button>
      </div>

      {/* Drill breadcrumb */}
      {drillStack.length > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <button onClick={() => { setDrillStack([]); run() }} className="text-amber-400 hover:text-amber-300">Root</button>
          {drillStack.map((d, i) => (
            <span key={i} className="text-slate-500">
              <span className="mx-1">/</span>
              <button onClick={() => { setDrillStack(prev => prev.slice(0, i + 1)); setTimeout(run, 0) }} className="text-slate-300 hover:text-white">{d.field}={d.value}</button>
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      {data?.totals && (
        <div className="flex gap-3 flex-wrap items-center">
          {[
            { label: 'Plays', val: data.totals.plays?.toLocaleString() },
            { label: 'EPA/play', val: data.totals.epa_per_play, epa: true },
            { label: 'Success%', val: `${data.totals.success_rate}%` },
            { label: 'Avg Yards', val: data.totals.avg_yards },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-lg px-3 py-2 text-center min-w-[80px]">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-sm font-bold ${s.epa ? (s.val > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>{s.val ?? '-'}</p>
            </div>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={exportCsv} className="px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-xs hover:text-white transition-colors">Export CSV</button>
          </div>
        </div>
      )}

      {loading && <Loading text="Running query..." />}

      {/* Compare panel */}
      {compareRows.length === 2 && <ComparePanel rows={compareRows} onClose={() => setCompareRows([])} />}

      {/* Checked rows actions */}
      {compareRows.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{compareRows.length} selected</span>
          <button onClick={() => setShowCheckedPlays(!showCheckedPlays)}
            className="px-3 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg text-xs hover:bg-amber-500/25 transition-colors">
            {showCheckedPlays ? 'Hide plays' : `View plays (${compareRows.length} groups)`}
          </button>
          <button onClick={() => { setCompareRows([]); setShowCheckedPlays(false) }} className="text-xs text-slate-600 hover:text-slate-400">Clear</button>
        </div>
      )}
      {showCheckedPlays && compareRows.length > 0 && (
        <PlayLogPanel
          body={{ ...buildBody(), drill: { field: activeGroupBy, values: compareRows.map(r => r._label) } }}
          onClose={() => setShowCheckedPlays(false)} />
      )}

      {/* Results table */}
      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="w-6 py-2"></th>
                <SortHeader label={GROUP_OPTIONS.find(g => g.id === activeGroupBy)?.label || activeGroupBy} field={activeGroupBy} sort={sort} setSort={setSort} align="left" />
                <th className="py-2 px-1 text-right text-[10px]">EPA+%<Tip stat="epa_dist" /></th>
                <SortHeader label="EPA/play" field="epa_per_play" sort={sort} setSort={setSort} tip="epa_per_play" />
                <SortHeader label="Total EPA" field="total_epa" sort={sort} setSort={setSort} tip="total_epa" />
                <SortHeader label="Success%" field="success_rate" sort={sort} setSort={setSort} tip="success_rate" />
                <SortHeader label="Avg Yds" field="avg_yards" sort={sort} setSort={setSort} />
                <SortHeader label="Pass%" field="pass_pct" sort={sort} setSort={setSort} />
                <SortHeader label="WPA/play" field="wpa_per_play" sort={sort} setSort={setSort} tip="wpa_per_play" />
                <SortHeader label="Plays" field="plays" sort={sort} setSort={setSort} />
                <th className="py-2 px-1 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const gKey = r[activeGroupBy] || r[Object.keys(r).find(k => !['plays','epa_per_play','total_epa','success_rate','avg_yards','pass_pct','wpa_per_play'].includes(k))]
                const isCompared = compareRows.some(c => c._label === gKey)
                const isExpanded = expandedRow === gKey
                return (
                  <Fragment key={gKey}>
                    <tr className={`border-b border-slate-800/40 hover:bg-slate-800/30 ${isCompared ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-2 pl-1">
                        <input type="checkbox" checked={isCompared} onChange={() => toggleCompare(r, gKey)}
                          className="w-3 h-3 accent-amber-500 cursor-pointer" />
                      </td>
                      <td className="py-2 pr-2 text-white font-medium cursor-pointer hover:text-amber-400" onClick={() => drillDown(activeGroupBy, gKey)}>
                        {gKey} <span className="text-slate-600 text-[10px] ml-0.5">drill</span>
                      </td>
                      <td className="py-2 px-1 text-right"><EpaSplitBar buckets={data?.histograms?.[String(gKey)]} onClick={() => setExpandedDist(expandedDist === gKey ? null : gKey)} /></td>
                      <td className="py-2 px-2 text-right"><EpaColorCell val={r.epa_per_play} /><EpaBar val={r.epa_per_play} max={maxEpa} /></td>
                      <td className="py-2 px-2 text-right"><EpaColorCell val={r.total_epa} /></td>
                      <td className="py-2 px-2 text-right text-slate-300">{r.success_rate}%</td>
                      <td className="py-2 px-2 text-right text-slate-300">{r.avg_yards}</td>
                      <td className="py-2 px-2 text-right text-slate-400">{r.pass_pct}%</td>
                      <td className="py-2 px-2 text-right"><EpaColorCell val={r.wpa_per_play} /></td>
                      <td className="py-2 px-2 text-right text-slate-500">{r.plays}</td>
                      <td className="py-2 px-1">
                        <button onClick={() => setExpandedRow(isExpanded ? null : gKey)}
                          className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                          {isExpanded ? 'Hide' : 'Plays'}
                        </button>
                      </td>
                    </tr>
                    {expandedDist === gKey && data?.histograms?.[String(gKey)] && (
                      <tr><td colSpan={11} className="p-2">
                        <EpaDistDetail buckets={data.histograms[String(gKey)]} label={gKey} onClose={() => setExpandedDist(null)} />
                      </td></tr>
                    )}
                    {isExpanded && (
                      <tr><td colSpan={11} className="p-0">
                        <PlayLogPanel
                          body={{ ...buildBody(), drill: { field: activeGroupBy, value: gKey } }}
                          onClose={() => setExpandedRow(null)} />
                      </td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-slate-600 mt-2">{sorted.length} groups | Click group name to drill down | Check 2 rows to compare</p>
        </div>
      )}
    </div>
  )
}


// ── Weekly Trend ─────────────────────────────────────────────────────────────

function WeeklyTrendSection({ players, season, ctxParams }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [hoverBar, setHoverBar] = useState(null)
  const [drillWeek, setDrillWeek] = useState(null)
  const ctxKey = ctxParams ? JSON.stringify(ctxParams) : season

  useEffect(() => {
    if (players.length === 0) { setData({}); return }
    setLoading(true)
    Promise.all(players.map(p => api.getWeeklyTrend(p.player_id, season, ctxParams)))
      .then(results => {
        const d = {}
        results.forEach((r, i) => { d[players[i].player_id] = r })
        setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), ctxKey])

  if (players.length === 0) return <p className="text-slate-500 text-sm">Search for a player above to see their weekly EPA trend</p>
  if (loading) return <Loading text="Loading weekly trend..." />

  const colors = ['#f59e0b', '#3b82f6']
  const allWeeks = [...new Set(Object.values(data).flatMap(d => (d.data || []).map(w => w.week)))].sort((a, b) => a - b)
  if (allWeeks.length === 0) return <p className="text-slate-500 text-sm">No weekly data found</p>

  const maxAbsEpa = Math.max(...Object.values(data).flatMap(d => (d.data || []).map(w => Math.abs(w.epa_per_play || 0))), 0.1)
  const barH = 160

  // Season averages
  const avgs = players.map(p => {
    const weeks = data[p.player_id]?.data || []
    const totalEpa = weeks.reduce((s, w) => s + (w.epa_per_play || 0), 0)
    return weeks.length ? (totalEpa / weeks.length) : 0
  })

  // Best/worst weeks
  const extremes = players.map(p => {
    const weeks = data[p.player_id]?.data || []
    if (!weeks.length) return null
    const sorted = [...weeks].sort((a, b) => (b.epa_per_play || 0) - (a.epa_per_play || 0))
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  })

  const showBar = (e, pi, wd, week) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHoverBar({ x: Math.min(r.left, window.innerWidth - 200), y: r.top - 60, pi, wd, week })
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">EPA per play by week - track performance consistency through the season</p>

      {/* Summary cards */}
      <div className="flex gap-3 flex-wrap">
        {players.map((p, pi) => (
          <div key={p.player_id} className="bg-slate-900/60 rounded-xl p-3 flex-1 min-w-[200px] space-y-1.5">
            <p className="text-xs font-semibold" style={{ color: colors[pi] }}>{p.player_name}</p>
            <div className="flex gap-3 text-xs">
              <span className="text-slate-400">Avg EPA: <span className={avgs[pi] >= 0 ? 'text-emerald-400' : 'text-red-400'}>{avgs[pi].toFixed(3)}</span></span>
              {extremes[pi] && <>
                <span className="text-slate-400">Best: <span className="text-emerald-400">W{extremes[pi].best.week} ({extremes[pi].best.epa_per_play})</span></span>
                <span className="text-slate-400">Worst: <span className="text-red-400">W{extremes[pi].worst.week} ({extremes[pi].worst.epa_per_play})</span></span>
              </>}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <div className="relative min-w-[600px]" style={{ height: barH + 55 }}>
          <div className="flex items-end gap-1 absolute inset-0" style={{ height: barH }}>
            {allWeeks.map((week, wi) => (
              <div key={week} className="flex-1 flex flex-col items-center">
                <div className="relative w-full flex justify-center gap-0.5" style={{ height: barH }}>
                  {players.map((p, pi) => {
                    const wd = (data[p.player_id]?.data || []).find(w => w.week === week)
                    if (!wd) return <div key={pi} className="w-4" />
                    const epa = wd.epa_per_play || 0
                    const h = Math.max(Math.abs(epa) / maxAbsEpa * (barH / 2), 2)
                    const isPos = epa >= 0
                    return (
                      <div key={pi} className="relative w-4 cursor-pointer" style={{ height: barH }}
                        onMouseEnter={e => showBar(e, pi, wd, week)} onMouseLeave={() => setHoverBar(null)}
                        onClick={() => setDrillWeek(drillWeek?.week === week && drillWeek?.pi === pi ? null : { week, pi })}>
                        <div className={`absolute ${isPos ? 'bottom-1/2' : 'top-1/2'} left-0 right-0 rounded-sm transition-all`}
                          style={{ height: h, background: colors[pi], opacity: drillWeek?.week === week ? 1 : 0.8 }} />
                      </div>
                    )
                  })}
                </div>
                {/* Win/loss + week label */}
                <div className="h-px w-full bg-slate-700" />
                <div className="flex gap-0.5 mt-0.5">
                  {players.map((p, pi) => {
                    const wd = (data[p.player_id]?.data || []).find(w => w.week === week)
                    if (!wd?.result) return <span key={pi} className="text-[7px] w-3 text-center text-slate-800">-</span>
                    return <span key={pi} className={`text-[7px] w-3 text-center font-bold ${wd.result === 'W' ? 'text-emerald-500' : 'text-red-400'}`}>{wd.result}</span>
                  })}
                </div>
                <span className="text-[9px] text-slate-600">{week}</span>
              </div>
            ))}
          </div>
          {/* Rolling average SVG overlay */}
          <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${allWeeks.length * 100} ${barH}`} preserveAspectRatio="none" style={{ width: '100%', height: barH }}>
            {players.map((p, pi) => {
              const weeks = (data[p.player_id]?.data || []).sort((a, b) => a.week - b.week)
              if (weeks.length < 3) return null
              const svgW = allWeeks.length * 100
              const rollingPts = []
              for (let j = 1; j < weeks.length - 1; j++) {
                const avg3 = (weeks[j-1].epa_per_play + weeks[j].epa_per_play + weeks[j+1].epa_per_play) / 3
                const wi = allWeeks.indexOf(weeks[j].week)
                if (wi < 0) continue
                const x = (wi + 0.5) / allWeeks.length * svgW
                const y = barH / 2 - (avg3 / maxAbsEpa) * (barH / 2)
                rollingPts.push(`${x},${y}`)
              }
              if (rollingPts.length < 2) return null
              return <polyline key={pi} points={rollingPts.join(' ')} fill="none" stroke={colors[pi]} strokeWidth={3} strokeDasharray="8,6" opacity={0.7} vectorEffect="non-scaling-stroke" />
            })}
          </svg>
        </div>
      </div>

      {/* Legend below chart */}
      <div className="flex items-center gap-4 flex-wrap text-[10px] text-slate-600">
        {players.map((p, i) => (
          <span key={p.player_id} className="flex items-center gap-1 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i] }} />
            <span className="text-slate-300 font-medium">{p.player_name}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-5 border-t-2 border-dashed" style={{ borderColor: '#94a3b8' }} /> 3-wk avg
        </span>
        <span><span className="text-emerald-500 font-bold">W</span>/<span className="text-red-400 font-bold">L</span> = game result</span>
        <span className="ml-auto">Click bar or row to see plays</span>
      </div>

      {/* Fixed tooltip */}
      {hoverBar && (
        <div style={{ position: 'fixed', top: hoverBar.y, left: hoverBar.x, zIndex: 9999 }}
          className="pointer-events-none bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs whitespace-nowrap">
          <p className="font-bold" style={{ color: colors[hoverBar.pi] }}>Week {hoverBar.week} - {players[hoverBar.pi]?.player_name}</p>
          <p className="text-slate-300">
            EPA/play: <span className={hoverBar.wd.epa_per_play >= 0 ? 'text-emerald-400' : 'text-red-400'}>{hoverBar.wd.epa_per_play}</span>
            {' '}| Total: {hoverBar.wd.total_epa} | Success: {hoverBar.wd.success_rate}%
            {' '}| {hoverBar.wd.plays} plays | {hoverBar.wd.avg_yards} yds
          </p>
          {hoverBar.wd.opponent && <p className="text-slate-500">vs {hoverBar.wd.opponent} {hoverBar.wd.score && `(${hoverBar.wd.score})`} {hoverBar.wd.result && <span className={hoverBar.wd.result === 'W' ? 'text-emerald-400' : 'text-red-400'}>{hoverBar.wd.result}</span>}</p>}
        </div>
      )}

      {/* Drill into week plays */}
      {drillWeek && (
        <PlayLogPanel
          body={{
            season,
            filters: [],
            season_type: 'REG',
            player_id: players[drillWeek.pi]?.player_id,
            drill: { field: 'week', value: drillWeek.week },
          }}
          onClose={() => setDrillWeek(null)} />
      )}

      {/* Weekly table */}
      {players.map((p, pi) => {
        const weeks = data[p.player_id]?.data || []
        if (weeks.length === 0) return null
        return (
          <div key={p.player_id} className="space-y-2">
            <p className="text-xs font-medium" style={{ color: colors[pi] }}>{p.player_name} - Weekly Breakdown</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-600 border-b border-slate-800">
                    <th className="text-left py-1 px-1">Week</th>
                    <th className="text-left py-1 px-1">Opp</th>
                    <th className="text-center py-1 px-1">W/L</th>
                    <th className="text-right py-1 px-1">EPA/play<Tip stat="epa_per_play" /></th>
                    <th className="text-right py-1 px-1">Total EPA<Tip stat="total_epa" /></th>
                    <th className="text-right py-1 px-1">Success%<Tip stat="success_rate" /></th>
                    <th className="text-right py-1 px-1">Avg Yds</th>
                    <th className="text-right py-1 px-1">Plays</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(w => (
                    <tr key={w.week} className="border-b border-slate-800/30 hover:bg-slate-800/20 cursor-pointer"
                      onClick={() => setDrillWeek({ week: w.week, pi })}>
                      <td className="py-1 px-1 text-slate-400">W{w.week}</td>
                      <td className="py-1 px-1 text-slate-400">{w.opponent || '-'}</td>
                      <td className="py-1 px-1 text-center">
                        {w.result && <span className={`font-bold ${w.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>{w.result}</span>}
                        {w.score && <span className="text-slate-600 ml-0.5 text-[9px]">{w.score}</span>}
                      </td>
                      <td className="py-1 px-1 text-right"><EpaColorCell val={w.epa_per_play} /></td>
                      <td className="py-1 px-1 text-right"><EpaColorCell val={w.total_epa} /></td>
                      <td className="py-1 px-1 text-right text-slate-300">{w.success_rate}%</td>
                      <td className="py-1 px-1 text-right text-slate-300">{w.avg_yards}</td>
                      <td className="py-1 px-1 text-right text-slate-500">{w.plays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ── Dashboard ────────────────────────────────────────────────────────────────

function DashboardSection({ season, onNavigate }) {
  const [data, setData] = useState(null)
  const [trend, setTrend] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getDashboard(season),
      api.getTrending(season),
    ]).then(([d, t]) => { setData(d); setTrend(t) })
      .catch(() => { setData(null); setTrend(null) })
      .finally(() => setLoading(false))
  }, [season])

  if (loading) return <Loading text="Loading dashboard..." />
  if (!data) return null

  const avg = data.league_avg || {}

  return (
    <div className="space-y-5">
      {/* League averages */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'League EPA/play', val: avg.epa },
          { label: 'Success Rate', val: `${avg.success_rate}%` },
          { label: 'Avg Yards', val: avg.avg_yards },
          { label: 'Total Plays', val: avg.total_plays?.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 rounded-lg px-4 py-2.5 text-center flex-1 min-w-[100px]">
            <p className="text-[10px] text-slate-500">{s.label}</p>
            <p className="text-sm font-bold text-white">{s.val ?? '-'}</p>
          </div>
        ))}
      </div>

      {/* Top players row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Top QBs', data: data.top_qbs },
          { title: 'Top RBs', data: data.top_rbs },
          { title: 'Top WRs', data: data.top_wrs },
        ].map(({ title, data: pl }) => (
          <div key={title} className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-amber-400">{title} by EPA/play</p>
            {(pl || []).map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-white">{i + 1}. {r.name} <span className="text-slate-600">{r.team}</span></span>
                <EpaColorCell val={r.epa} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Clutch + Teams row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-red-400">Most Clutch QBs (WPA)</p>
          {(data.most_clutch || []).map((r, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-white">{i + 1}. {r.name} <span className="text-slate-600">{r.team}</span></span>
              <span className="text-emerald-400 font-bold">{r.clutch_wpa}</span>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-blue-400">Team EPA Rankings</p>
          <style>{`.team-scroll::-webkit-scrollbar{width:4px}.team-scroll::-webkit-scrollbar-track{background:transparent}.team-scroll::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}`}</style>
          <div className="max-h-40 overflow-y-auto space-y-0.5 team-scroll">
            <div className="flex justify-between text-[9px] text-slate-600 px-0.5 mb-1 sticky top-0 bg-slate-900/90">
              <span>Team</span>
              <span className="flex gap-3"><span className="w-12 text-right">Pass</span><span className="w-12 text-right">Rush</span><span className="w-12 text-right">Avg</span></span>
            </div>
            {(data.team_epa || []).map((r, i) => (
              <div key={r.team} className="flex justify-between text-[10px] items-center">
                <span className="text-slate-300">{i + 1}. {r.team}</span>
                <span className="flex gap-3">
                  <span className="w-12 text-right"><EpaColorCell val={r.pass_epa} /></span>
                  <span className="w-12 text-right"><EpaColorCell val={r.rush_epa} /></span>
                  <span className="w-12 text-right font-bold"><EpaColorCell val={r.epa} /></span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trending */}
      {trend && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2">TRENDING {trend.recent_weeks && <span className="font-normal text-slate-600">- last 3 weeks ({trend.recent_weeks}) vs earlier ({trend.earlier_weeks})</span>}</p>
          {trend.too_early ? (
            <p className="text-slate-600 text-xs">Not enough data yet - trending starts from week 3.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: 'QBs Rising', players: trend.qb_improved, color: '#34d399', icon: '↗' },
                { title: 'QBs Falling', players: trend.qb_declined, color: '#f87171', icon: '↘' },
                { title: 'RBs Rising', players: trend.rb_improved, color: '#34d399', icon: '↗' },
                { title: 'RBs Falling', players: trend.rb_declined, color: '#f87171', icon: '↘' },
              ].map(({ title, players: pl, color, icon }) => pl?.length > 0 && (
                <div key={title} className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] font-bold" style={{ color }}>{icon} {title}</p>
                  {pl.map((r, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="text-slate-300">{r.name} <span className="text-slate-600">{r.team}</span></span>
                      <span className={`font-bold ${r.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.delta > 0 ? '+' : ''}{r.delta}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Presets */}
      <div>
        <p className="text-xs font-bold text-slate-500 mb-2">QUICK PRESETS</p>
        <div className="flex gap-2 flex-wrap">
          {QUICK_PRESETS.map(p => (
            <button key={p.label} onClick={() => onNavigate(p.section || 'explorer')}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs hover:border-amber-500/40 hover:text-amber-400 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}


// ── Trending ─────────────────────────────────────────────────────────────────

function TrendingSection({ season, addPlayer }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getTrending(season).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [season])

  if (loading) return <Loading text="Loading trends..." />
  if (!data) return null

  const TrendCard = ({ title, players, color, icon }) => (
    <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4 space-y-2">
      <p className="text-xs font-bold" style={{ color }}>{icon} {title}</p>
      {players.map((r, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <button onClick={() => addPlayer({ player_id: r.gsis_id, player_name: r.name, pos: 'QB' })} className="text-white hover:text-amber-400 transition-colors text-left">
            {r.name} <span className="text-slate-600">{r.team}</span>
          </button>
          <div className="flex gap-3 text-right">
            <span className="text-slate-500">H1: <EpaColorCell val={r.epa_h1} /></span>
            <span className="text-slate-500">H2: <EpaColorCell val={r.epa_h2} /></span>
            <span className={`font-bold ${r.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.delta > 0 ? '+' : ''}{r.delta}</span>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">First half (weeks 1-9) vs second half (weeks 10+) EPA comparison</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrendCard title="QBs - Most Improved" players={data.qb_improved || []} color="#34d399" icon="↗" />
        <TrendCard title="QBs - Biggest Decline" players={data.qb_declined || []} color="#f87171" icon="↘" />
        <TrendCard title="RBs - Most Improved" players={data.rb_improved || []} color="#34d399" icon="↗" />
        <TrendCard title="RBs - Biggest Decline" players={data.rb_declined || []} color="#f87171" icon="↘" />
      </div>
    </div>
  )
}


// ── Matchup Finder ──────────────────────────────────────────────────────────

function MatchupSection({ players, season }) {
  const [defRank, setDefRank] = useState('top10')
  const [customTeams, setCustomTeams] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState(null)
  const mode = customTeams.length > 0 ? 'custom' : 'preset'

  useEffect(() => {
    if (!players.length) return
    setLoading(true)
    api.getMatchup(players[0].player_id, mode === 'preset' ? defRank : null, season, mode === 'custom' ? customTeams : null)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [players[0]?.player_id, defRank, season, customTeams.join(',')])

  if (!players.length) return <p className="text-slate-500 text-sm">Search for a player above to see matchup analysis</p>
  if (loading) return <Loading text="Loading matchup data..." />
  if (!data || data.error) return <p className="text-red-400 text-sm">{data?.error || 'Failed to load'}</p>

  const overall = data.overall || {}
  const vsDef = data.vs_defense || {}
  const delta = vsDef.epa_per_play != null && overall.epa_per_play != null ? (vsDef.epa_per_play - overall.epa_per_play).toFixed(3) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-white font-semibold text-sm">{data.player}</p>
        <span className="text-slate-600 text-xs">vs</span>
        {['top5', 'top10', 'bottom10', 'bottom5'].map(r => (
          <button key={r} onClick={() => { setDefRank(r); setCustomTeams([]) }}
            className={`px-2.5 py-1 rounded text-xs ${mode === 'preset' && defRank === r ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
            {r === 'top5' ? 'Top 5' : r === 'top10' ? 'Top 10' : r === 'bottom10' ? 'Bot 10' : 'Bot 5'}
          </button>
        ))}
        <span className="text-slate-700">|</span>
        <TeamPicker selected={customTeams} setSelected={setCustomTeams} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400">Overall</p>
          <p className="text-2xl font-bold"><EpaColorCell val={overall.epa_per_play} /></p>
          <p className="text-xs text-slate-500">Success: {overall.success_rate}% | {overall.avg_yards} yds | {overall.plays}p</p>
        </div>
        <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-400">vs {data.defense_label}</p>
          <p className="text-2xl font-bold"><EpaColorCell val={vsDef.epa_per_play} /></p>
          <p className="text-xs text-slate-500">Success: {vsDef.success_rate}% | {vsDef.avg_yards} yds | {vsDef.plays}p</p>
          {delta && <p className="text-xs"><span className={Number(delta) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{Number(delta) >= 0 ? '+' : ''}{delta} EPA</span></p>}
        </div>
        <div className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400">League Rank</p>
          {data.league_rank && <p className="text-2xl font-bold text-white">#{data.league_rank} <span className="text-xs text-slate-600 font-normal">of {data.league_total}</span></p>}
          {data.overall_air_yards && <p className="text-xs text-slate-500">Avg air yards: {data.overall_air_yards}</p>}
        </div>
      </div>

      {/* Per-team breakdown - expandable */}
      {data.per_team?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Per-Team Breakdown - click to expand</p>
          <div className="space-y-1.5">
            {data.per_team.map(t => {
              const isExp = expandedTeam === t.team
              const airDelta = t.avg_air_yards && data.overall_air_yards ? (t.avg_air_yards - data.overall_air_yards).toFixed(1) : null
              return (
                <div key={t.team}>
                  <button onClick={() => !t.no_matchup && setExpandedTeam(isExp ? null : t.team)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${t.no_matchup ? 'bg-slate-900/20 opacity-50' : isExp ? 'bg-slate-800 border border-slate-700' : 'bg-slate-900/40 hover:bg-slate-800/60'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{t.team}</span>
                      {t.def_rank && <span className="text-slate-600">#{t.def_rank} DEF</span>}
                      {t.result && <span className={`font-bold ${t.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>{t.result}</span>}
                      {t.score && <span className="text-slate-600">{t.score}</span>}
                      {t.no_matchup && <span className="text-slate-600 italic">No matchup this season</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {!t.no_matchup && <><span className="font-bold"><EpaColorCell val={t.epa_per_play} /></span>
                      <span className="text-slate-500">{t.plays}p</span>
                      <span className="text-slate-600">{isExp ? '▲' : '▼'}</span></>}
                    </div>
                  </button>
                  {isExp && (
                    <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-3 mt-1 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-600 text-[10px]">Success%</p>
                        <p className="text-slate-200">{t.success_rate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">Avg Yards</p>
                        <p className="text-slate-200">{t.avg_yards}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">Air Yards</p>
                        <p className="text-slate-200">{t.avg_air_yards ?? '-'} {airDelta && <span className={Number(airDelta) >= 0 ? 'text-emerald-400' : 'text-red-400'}>({Number(airDelta) >= 0 ? '+' : ''}{airDelta} vs avg)</span>}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">Pass%</p>
                        <p className="text-slate-200">{t.pass_pct}%</p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">Big Plays (20+)</p>
                        <p className="text-slate-200">{t.big_plays ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">Turnovers</p>
                        <p className="text-slate-200">{(t.ints ?? 0) + (t.fumbles ?? 0)} <span className="text-slate-600">({t.ints ?? 0} INT, {t.fumbles ?? 0} FUM)</span></p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">Sacks</p>
                        <p className="text-slate-200">{t.sacks ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 text-[10px]">3rd & Long</p>
                        <p className="text-slate-200">{t.third_long ?? 0} plays {t.third_long_epa != null && <span>(<EpaColorCell val={t.third_long_epa} /> EPA)</span>}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


const DECISION_METRICS = [
  { k: 'catchable_pct', label: 'Catchable', good: true, desc: 'Passes that were catchable' },
  { k: 'int_worthy_pct', label: 'INT-worthy', good: false, desc: 'Bad decisions deserving interception' },
  { k: 'throwaway_pct', label: 'Throwaway', neutral: true, desc: 'Intentional throw-aways' },
  { k: 'drop_pct', label: 'Drops', neutral: true, desc: 'Catchable passes dropped by receivers' },
  { k: 'contested_pct', label: 'Contested', neutral: true, desc: 'Throws into contested coverage' },
  { k: 'out_of_pocket_pct', label: 'Out of Pocket', neutral: true, desc: 'Left the pocket before throwing' },
  { k: 'qb_fault_sack_pct', label: 'QB-fault Sack', good: false, desc: 'Sacks caused by holding too long' },
]

function DecisionsSection({ players, season, ctxParams }) {
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(false)
  const [showReads, setShowReads] = useState(false)
  const ctxKey = ctxParams ? JSON.stringify(ctxParams) : season

  useEffect(() => {
    if (!players.length) { setAllData([]); return }
    setLoading(true)
    Promise.all(players.map(p => api.getQbDecisions(p.player_id, season, ctxParams)))
      .then(setAllData).catch(() => setAllData([])).finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), ctxKey])

  if (!players.length) return <p className="text-slate-500 text-sm">Search for a player above</p>
  if (loading) return <Loading text="Loading decisions..." />
  if (!allData.length) return null

  const colors = ['#f59e0b', '#3b82f6']
  const isCompare = players.length === 2 && allData.length === 2

  return (
    <div className="space-y-4">
      {/* Horizontal bar comparison for each metric */}
      <div className="space-y-2">
        {DECISION_METRICS.map(({ k, label, good, desc }) => {
          const vals = allData.map(d => d.decisions?.[k] ?? null)
          if (vals.every(v => v === null)) return null
          const max = Math.max(...vals.filter(v => v != null), 1)
          return (
            <div key={k} className="bg-slate-900/40 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">{label}<Tip stat={k} /></span>
                <div className="flex gap-3">
                  {vals.map((v, i) => (
                    <span key={i} className="text-xs font-bold" style={{ color: isCompare ? colors[i] : (good === true ? '#34d399' : good === false ? '#f87171' : '#e2e8f0') }}>
                      {v ?? '-'}%
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                {vals.map((v, i) => (
                  <div key={i} className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${v != null ? (v / max) * 100 : 0}%`, background: isCompare ? colors[i] : (good === true ? '#34d399' : good === false ? '#f87171' : '#94a3b8'), opacity: 0.7 }} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* EPA */}
      <div className="flex gap-3">
        {allData.map((d, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-700/30 rounded-lg px-4 py-2 flex-1">
            <p className="text-[10px] font-medium" style={{ color: colors[i] }}>{d.player || players[i]?.player_name}</p>
            <p className="text-sm">EPA/play: <span className="font-bold"><EpaColorCell val={d.decisions?.epa_per_play} /></span> <span className="text-slate-600 text-[10px]">{d.decisions?.total_passes ?? '-'} passes</span></p>
          </div>
        ))}
      </div>

      {/* Read distribution - expandable */}
      {allData.some(d => d.read_distribution?.length > 0) && (
        <div>
          <button onClick={() => setShowReads(!showReads)} className="text-xs text-slate-500 hover:text-amber-400 transition-colors">
            {showReads ? '▲ Hide read distribution' : '▼ Show read distribution'}
          </button>
          {showReads && (
            <div className={`grid ${isCompare ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mt-2`}>
              {allData.map((d, i) => {
                const reads = d.read_distribution || []
                if (!reads.length) return null
                const total = reads.reduce((s, r) => s + r.count, 0)
                return (
                  <div key={i} className="bg-slate-900/40 rounded-lg p-3">
                    {isCompare && <p className="text-[10px] font-medium mb-2" style={{ color: colors[i] }}>{d.player || players[i]?.player_name}</p>}
                    <div className="space-y-1">
                      {reads.map(r => {
                        const pct = total > 0 ? (r.count / total * 100).toFixed(1) : 0
                        return (
                          <div key={r.read_thrown} className="flex items-center gap-2 text-[10px]">
                            <span className="text-slate-400 w-20">{r.read_thrown}</span>
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i], opacity: 0.7 }} />
                            </div>
                            <span className="text-slate-300 w-14 text-right">{r.count} ({pct}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function PressureSection({ players, season, ctxParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDeep, setShowDeep] = useState(false)
  const ctxKey = ctxParams ? JSON.stringify(ctxParams) : season

  useEffect(() => {
    if (!players.length) { setData(null); return }
    setLoading(true)
    api.getPressureAnalysis(players[0].player_id, season, ctxParams)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [players[0]?.player_id, ctxKey])

  if (!players.length) return <p className="text-slate-500 text-sm">Search for a player above</p>
  if (loading) return <Loading text="Loading pressure data..." />
  if (!data) return null
  if (data.no_data) return <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-400">{data.coverage}</div>

  const cp = data.data?.clean_pocket, up = data.data?.under_pressure
  const delta = cp && up ? (up.epa_per_play - cp.epa_per_play).toFixed(3) : null
  const p = players[0]

  if (!cp && !up) return <p className="text-slate-500 text-sm">No pressure data for this player/season</p>

  return (
    <div className="space-y-4">
      <p className="text-white font-semibold text-sm">{data.player || p.player_name} <span className="text-slate-600 text-xs font-normal">{data.season || season}</span>
        {data.pressure_percentile != null && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">Under pressure: top {100 - data.pressure_percentile}%</span>}
      </p>
      <div className="flex gap-3 flex-wrap text-xs">
        <span className="bg-slate-900/60 rounded-lg px-3 py-1.5"><span className="text-slate-500">Pressure rate: </span><span className="text-white font-bold">{data.pressure_rate ?? '-'}%</span></span>
        <span className="bg-slate-900/60 rounded-lg px-3 py-1.5"><span className="text-slate-500">Dropbacks: </span><span className="text-white font-bold">{data.total_dropbacks ?? '-'}</span></span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cp && (
          <div className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300">Clean Pocket</p>
            <p className="text-2xl font-bold"><EpaColorCell val={cp.epa_per_play} /></p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <span className="text-slate-500">Comp%</span><span className="text-slate-200 text-right">{cp.comp_pct}%</span>
              <span className="text-slate-500">INT%</span><span className="text-slate-200 text-right">{cp.int_rate}%</span>
              <span className="text-slate-500">Yards</span><span className="text-slate-200 text-right">{cp.avg_yards}</span>
              <span className="text-slate-500">Plays</span><span className="text-slate-200 text-right">{cp.plays}</span>
            </div>
          </div>
        )}
        {delta && (
          <div className="bg-slate-900/80 border border-slate-700/40 rounded-xl p-4 flex flex-col items-center justify-center">
            <p className="text-[10px] text-slate-500 mb-1">Pressure Cost</p>
            <p className={`text-2xl font-black ${Number(delta) <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{delta}</p>
            <p className="text-[10px] text-slate-600">EPA drop</p>
          </div>
        )}
        {up && (
          <div className="bg-slate-900/60 border border-red-500/20 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-red-400">Under Pressure</p>
            <p className="text-2xl font-bold"><EpaColorCell val={up.epa_per_play} /></p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <span className="text-slate-500">Comp%</span><span className="text-slate-200 text-right">{up.comp_pct}%</span>
              <span className="text-slate-500">Sack%</span><span className="text-slate-200 text-right">{up.sack_rate}%</span>
              <span className="text-slate-500">INT%</span><span className="text-slate-200 text-right">{up.int_rate}%</span>
              <span className="text-slate-500">Plays</span><span className="text-slate-200 text-right">{up.plays}</span>
            </div>
          </div>
        )}
      </div>
      <button onClick={() => setShowDeep(!showDeep)} className="text-xs text-slate-500 hover:text-amber-400 transition-colors">
        {showDeep ? '▲ Hide details' : '▼ Show blitz, scramble & sack breakdown'}
      </button>
      {showDeep && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.blitz && Object.keys(data.blitz).length > 0 && (
            <div className="bg-slate-900/40 border border-slate-700/20 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400">BLITZ vs STANDARD RUSH</p>
              {['blitz', 'no_blitz'].map(k => {
                const b = data.blitz[k]; if (!b) return null
                return <div key={k} className="text-[10px]">
                  <span className="text-slate-300 font-medium">{k === 'blitz' ? 'Blitz (5+ rushers)' : 'Standard (4-)'}</span>
                  <div className="flex gap-2 text-slate-400 mt-0.5">
                    <span>EPA: <EpaColorCell val={b.epa} /></span>
                    <span>Comp: {b.comp_pct}%</span>
                    <span>Sack: {b.sack_rate}%</span>
                    <span>{b.plays}p</span>
                  </div>
                </div>
              })}
            </div>
          )}
          {data.sack_split && Object.keys(data.sack_split).length > 0 && (
            <div className="bg-slate-900/40 border border-slate-700/20 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400">WHEN PRESSURED</p>
              {['escaped', 'sacked'].map(k => {
                const s = data.sack_split[k]; if (!s) return null
                return <div key={k} className="text-[10px]">
                  <span className={`font-medium ${k === 'escaped' ? 'text-emerald-400' : 'text-red-400'}`}>{k === 'escaped' ? 'Escaped pressure' : 'Sacked'}</span>
                  <div className="flex gap-2 text-slate-400 mt-0.5">
                    <span>EPA: <EpaColorCell val={s.epa} /></span>
                    {s.comp_pct != null && <span>Comp: {s.comp_pct}%</span>}
                    <span>{s.avg_yards}y</span>
                    <span>{s.plays}p</span>
                  </div>
                </div>
              })}
            </div>
          )}
          {data.scramble && Object.keys(data.scramble).length > 0 && (
            <div className="bg-slate-900/40 border border-slate-700/20 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400">ESCAPE ACTION</p>
              {['pocket', 'scramble'].map(k => {
                const s = data.scramble[k]; if (!s) return null
                return <div key={k} className="text-[10px]">
                  <span className="text-slate-300 font-medium">{k === 'scramble' ? 'Scrambled' : 'Stayed in pocket'}</span>
                  <div className="flex gap-2 text-slate-400 mt-0.5">
                    <span>EPA: <EpaColorCell val={s.epa} /></span>
                    <span>{s.avg_yards}y</span>
                    <span>{s.plays}p</span>
                  </div>
                </div>
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function FormationSection({ season }) {
  const [teamSel, setTeamSel] = useState(['KC'])
  const team = teamSel[0] || 'KC'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getFormation(team, season).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [team, season])

  return (
    <div className="space-y-4">
      <TeamPicker selected={teamSel} setSelected={setTeamSel} />
      {loading && <Loading text="Loading formations..." />}
      {data?.no_data && data.coverage && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm">
          <p className="text-amber-400">{data.coverage}</p>
          {data.available_seasons?.length > 0 && (
            <p className="text-slate-400 text-xs mt-1">Try switching to one of the available seasons above.</p>
          )}
        </div>
      )}
      {data?.data?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 pr-2">Personnel</th>
                <th className="text-right py-2 px-2">Usage%<Tip stat="usage_pct" /></th>
                <th className="text-right py-2 px-2">EPA/play<Tip stat="epa_per_play" /></th>
                <th className="text-right py-2 px-2">Success%<Tip stat="success_rate" /></th>
                <th className="text-right py-2 px-2">Avg Yards</th>
                <th className="text-right py-2 px-2">Plays</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(r => (
                <tr key={r.personnel} className="border-b border-slate-800/40">
                  <td className="py-2 pr-2 text-white font-medium">{r.personnel}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.usage_pct}%</td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.epa_per_play} /></td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.success_rate}%</td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.avg_yards}</td>
                  <td className="py-2 px-2 text-right text-slate-500">{r.plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
