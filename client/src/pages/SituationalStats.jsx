import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
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
  { id: 'epa', label: 'EPA Rankings', icon: '📊' },
  { id: 'clutch', label: 'Clutch Rankings', icon: '🔥' },
  { id: 'explorer', label: 'Custom Explorer', icon: '🔍' },
  { id: 'splits', label: 'Situational Splits', icon: '📋' },
  { id: 'trend', label: 'Weekly Trend', icon: '📈' },
  { id: 'playaction', label: 'Play-Action', icon: '🎭' },
  { id: 'pressure', label: 'Under Pressure', icon: '💨' },
  { id: 'decisions', label: 'QB Decisions', icon: '🧠' },
  { id: 'runheatmap', label: 'Run Heatmap', icon: '🏃' },
  { id: 'passheatmap', label: 'Pass Heatmap', icon: '🎯' },
  { id: 'formation', label: 'Formations', icon: '📐' },
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

function SplitsSection({ players, season }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (players.length === 0) return
    setLoading(true); setError(null)
    Promise.all(players.map(p => api.getSituationalSplits(p.player_id, season)))
      .then(results => {
        const d = {}
        results.forEach((r, i) => { d[players[i].player_id] = r })
        setData(d)
      })
      .catch(e => { setError(e.message || 'Failed to load splits') })
      .finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), season])

  if (players.length === 0) return <p className="text-slate-500 text-sm">Search for a player above to see splits</p>
  if (loading) return <Loading text="Loading splits..." />
  if (error) return <p className="text-red-400 text-sm">{error}</p>

  const isCompare = players.length === 2
  const splitKeys = Object.keys(data[players[0]?.player_id]?.splits || {})

  return (
    <div className="space-y-4">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              <th className="text-left py-2 pr-3">Situation</th>
              {players.map(p => (
                <th key={p.player_id} colSpan={3} className="text-center py-2 px-1 text-amber-400/80">{isCompare ? p.player_name : ''}</th>
              ))}
            </tr>
            <tr className="text-slate-600 text-xs border-b border-slate-800">
              <th></th>
              {players.map(p => (
                <>
                  <th key={`${p.player_id}-epa`} className="text-right py-1 px-1">EPA/play<Tip stat="epa_per_play" /></th>
                  <th key={`${p.player_id}-sr`} className="text-right py-1 px-1">Success%<Tip stat="success_rate" /></th>
                  <th key={`${p.player_id}-plays`} className="text-right py-1 px-1">Plays</th>
                </>
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
                    <>
                      <td key={`${i}-epa`} className="py-2 px-1 text-right"><EpaColorCell val={s.epa_per_play} /></td>
                      <td key={`${i}-sr`} className="py-2 px-1 text-right text-slate-300">{s.success_rate ?? '-'}%</td>
                      <td key={`${i}-plays`} className="py-2 px-1 text-right text-slate-500">{s.plays ?? '-'}</td>
                    </>
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

function SimpleSection({ title, fetchFn, players, season, renderData }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (players.length === 0) { setData(null); setError(null); return }
    setLoading(true); setError(null)
    Promise.all(players.map(p => fetchFn(p.player_id, season)))
      .then(results => setData(results))
      .catch(e => { setData(null); setError(e.message || 'Failed to load data') })
      .finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), season])

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
  const [section, setSection] = useState('epa')
  const [season, setSeason] = useState(2025)
  const [selectedSeasons, setSelectedSeasons] = useState([])
  const [players, setPlayers] = useState([])
  const [availableYears, setAvailableYears] = useState(FALLBACK_YEARS)
  const multiSeasonSections = ['epa', 'clutch', 'explorer']

  useEffect(() => {
    api.getSituationalSeasons().then(years => {
      if (years?.length) { setAvailableYears(years); setSeason(years[0]); setSelectedSeasons([years[0]]) }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => { api.trackPage('situational') }, [])

  if (!user?.is_admin) return null

  const addPlayer = (p) => {
    if (players.length < 2 && !players.find(x => x.player_id === p.player_id)) {
      setPlayers(prev => [...prev, p])
    }
  }
  const removePlayer = (id) => setPlayers(prev => prev.filter(p => p.player_id !== id))

  const needsPlayer = !['epa', 'clutch', 'formation', 'explorer'].includes(section)

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
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Season + Player selectors */}
        <div className="flex items-center gap-3 flex-wrap">
          {multiSeasonSections.includes(section) ? (
            <div className="flex items-center gap-1.5">
              {availableYears.map(y => (
                <button key={y} onClick={() => setSelectedSeasons(prev =>
                  prev.includes(y) ? (prev.length > 1 ? prev.filter(s => s !== y) : prev) : [...prev, y]
                )}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSeasons.includes(y) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <select value={season} onChange={e => setSeason(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          {needsPlayer && (
            <>
              <div className="flex-1 min-w-[200px]">
                <PlayerSearch onSelect={addPlayer} placeholder={players.length === 0 ? 'Search player...' : 'Add 2nd player to compare...'} />
              </div>
              {players.map(p => (
                <div key={p.player_id} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-white font-medium">{p.player_name}</span>
                  <span className="text-slate-500 text-xs">{p.pos}</span>
                  <button onClick={() => removePlayer(p.player_id)} className="text-slate-600 hover:text-red-400 ml-1">x</button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
          {section === 'epa' && <EpaRankingsSection seasons={selectedSeasons} />}
          {section === 'clutch' && <ClutchRankingsSection seasons={selectedSeasons} />}
          {section === 'explorer' && <ExplorerSection seasons={selectedSeasons} />}
          {section === 'splits' && <SplitsSection players={players} season={season} />}
          {section === 'trend' && <WeeklyTrendSection players={players} season={season} />}
          {section === 'playaction' && (
            <SimpleSection title="Play-Action" fetchFn={api.getPlayAction} players={players} season={season}
              renderData={(d, p) => (
                <div key={p.player_id} className="space-y-2">
                  <p className="text-white font-semibold">{d.player}</p>
                  {d.coverage && <p className="text-slate-600 text-xs">{d.coverage}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    {['with_play_action', 'without_play_action'].map(key => {
                      const s = d.data?.[key]
                      return s ? (
                        <div key={key} className="bg-slate-900/60 rounded-xl p-4 space-y-1">
                          <p className="text-xs text-slate-400 font-medium">{key === 'with_play_action' ? 'With Play-Action' : 'Without'}</p>
                          <p className="text-white">EPA/play<Tip stat="epa_per_play" />: <EpaColorCell val={s.epa_per_play} /></p>
                          <p className="text-slate-300 text-sm">Comp%<Tip stat="comp_pct" />: {s.comp_pct}% | Yards: {s.avg_yards}</p>
                          <p className="text-slate-300 text-sm">Air Yds<Tip stat="avg_air_yards" />: {s.avg_air_yards} | YAC<Tip stat="avg_yac" />: {s.avg_yac}</p>
                          <p className="text-slate-400 text-xs">{s.plays} plays | Success%<Tip stat="success_rate" />: {s.success_rate}%</p>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            />
          )}
          {section === 'pressure' && (
            <SimpleSection title="Pressure" fetchFn={api.getPressureAnalysis} players={players} season={season}
              renderData={(d, p) => (
                <div key={p.player_id} className="space-y-2">
                  <p className="text-white font-semibold">{d.player}</p>
                  {d.coverage && <p className="text-slate-600 text-xs">{d.coverage}</p>}
                  {(!d.data || Object.keys(d.data).length === 0) && !d.no_data && (
                    <p className="text-slate-500 text-sm">No pressure data found for this player in {d.season}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {['clean_pocket', 'under_pressure'].map(key => {
                      const s = d.data?.[key]
                      return s ? (
                        <div key={key} className={`bg-slate-900/60 rounded-xl p-4 space-y-1 ${key === 'under_pressure' ? 'border border-red-500/20' : ''}`}>
                          <p className="text-xs text-slate-400 font-medium">{key === 'clean_pocket' ? 'Clean Pocket' : 'Under Pressure'}</p>
                          <p className="text-white">EPA/play<Tip stat="epa_per_play" />: <EpaColorCell val={s.epa_per_play} /></p>
                          <p className="text-slate-300 text-sm">Comp%<Tip stat="comp_pct" />: {s.comp_pct}% | Sack%<Tip stat="sack_rate" />: {s.sack_rate}% | INT%<Tip stat="int_rate" />: {s.int_rate}%</p>
                          <p className="text-slate-400 text-xs">{s.plays} plays | Avg {s.avg_yards} yds</p>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            />
          )}
          {section === 'decisions' && (
            <SimpleSection title="Decisions" fetchFn={api.getQbDecisions} players={players} season={season}
              renderData={(d, p) => (
                <div key={p.player_id} className="space-y-3">
                  <p className="text-white font-semibold">{d.player}</p>
                  {d.coverage && <p className="text-slate-600 text-xs">{d.coverage}</p>}
                  {d.decisions && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { k: 'catchable_pct', label: 'Catchable%', good: true },
                        { k: 'int_worthy_pct', label: 'INT-worthy%', good: false },
                        { k: 'throwaway_pct', label: 'Throwaway%' },
                        { k: 'drop_pct', label: 'Drop%' },
                        { k: 'contested_pct', label: 'Contested%' },
                        { k: 'out_of_pocket_pct', label: 'Out of Pocket%' },
                        { k: 'qb_fault_sack_pct', label: 'QB-fault Sack%', good: false },
                      ].map(({ k, label, good }) => (
                        <div key={k} className="bg-slate-900/60 rounded-lg p-3 text-center">
                          <p className="text-xs text-slate-500">{label}<Tip stat={k} /></p>
                          <p className={`text-lg font-bold ${good === true ? 'text-emerald-400' : good === false ? 'text-red-400' : 'text-white'}`}>
                            {d.decisions[k] ?? '-'}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {d.read_distribution?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Read Distribution</p>
                      <div className="flex gap-2">
                        {d.read_distribution.map(r => (
                          <div key={r.read_thrown} className="bg-slate-900/60 rounded-lg px-3 py-2 text-center">
                            <p className="text-white font-bold">{r.count}</p>
                            <p className="text-xs text-slate-500">{r.read_thrown}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            />
          )}
          {section === 'runheatmap' && (
            <SimpleSection title="Run Heatmap" fetchFn={api.getRunHeatmap} players={players} season={season}
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
            <SimpleSection title="Pass Heatmap" fetchFn={(pid, s) => api.getPassHeatmap(pid, s)} players={players} season={season}
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
          {section === 'formation' && <FormationSection season={season} />}
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

function WeeklyTrendSection({ players, season }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (players.length === 0) { setData({}); return }
    setLoading(true)
    Promise.all(players.map(p => api.getWeeklyTrend(p.player_id, season)))
      .then(results => {
        const d = {}
        results.forEach((r, i) => { d[players[i].player_id] = r })
        setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [players.map(p => p.player_id).join(','), season])

  if (players.length === 0) return <p className="text-slate-500 text-sm">Search for a player above to see their weekly EPA trend</p>
  if (loading) return <Loading text="Loading weekly trend..." />

  const colors = ['#f59e0b', '#3b82f6']
  const allWeeks = [...new Set(Object.values(data).flatMap(d => (d.data || []).map(w => w.week)))].sort((a, b) => a - b)
  if (allWeeks.length === 0) return <p className="text-slate-500 text-sm">No weekly data found</p>

  const maxAbsEpa = Math.max(...Object.values(data).flatMap(d => (d.data || []).map(w => Math.abs(w.epa_per_play || 0))), 0.1)
  const barH = 120

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">EPA per play by week - track performance consistency through the season</p>
      <div className="flex items-center gap-4 mb-2">
        {players.map((p, i) => (
          <span key={p.player_id} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ background: colors[i] }} />
            <span className="text-white font-medium">{p.player_name}</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1 min-w-[600px]" style={{ height: barH + 40 }}>
          {allWeeks.map(week => (
            <div key={week} className="flex-1 flex flex-col items-center">
              <div className="relative w-full flex justify-center gap-0.5" style={{ height: barH }}>
                {players.map((p, pi) => {
                  const wd = (data[p.player_id]?.data || []).find(w => w.week === week)
                  if (!wd) return <div key={pi} className="w-3" />
                  const epa = wd.epa_per_play || 0
                  const h = Math.max(Math.abs(epa) / maxAbsEpa * (barH / 2), 2)
                  const isPos = epa >= 0
                  return (
                    <div key={pi} className="relative w-3 group" style={{ height: barH }}>
                      <div className={`absolute ${isPos ? 'bottom-1/2' : 'top-1/2'} left-0 right-0 rounded-sm transition-all`}
                        style={{ height: h, background: colors[pi], opacity: 0.8 }} />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs whitespace-nowrap">
                          <span className="text-white font-bold">{epa}</span>
                          <span className="text-slate-400 ml-1">EPA | {wd.plays}p | {wd.avg_yards}y</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="h-px w-full bg-slate-700 mt-0" />
              <span className="text-xs text-slate-600 mt-1">W{week}</span>
            </div>
          ))}
        </div>
      </div>
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
                    <th className="text-right py-1 px-1">EPA/play<Tip stat="epa_per_play" /></th>
                    <th className="text-right py-1 px-1">Total EPA<Tip stat="total_epa" /></th>
                    <th className="text-right py-1 px-1">Success%<Tip stat="success_rate" /></th>
                    <th className="text-right py-1 px-1">Avg Yds</th>
                    <th className="text-right py-1 px-1">Plays</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(w => (
                    <tr key={w.week} className="border-b border-slate-800/30">
                      <td className="py-1 px-1 text-slate-400">Week {w.week}</td>
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
