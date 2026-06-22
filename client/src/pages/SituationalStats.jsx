import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { Loading, ErrorMsg } from '../components/Status'
import SocialPostGenerator from '../components/SocialPostGenerator'
import ProjectPicker from '../components/ProjectPicker'

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
}

function Tip({ stat }) {
  const text = STAT_TIPS[stat]
  if (!text) return null
  return (
    <span className="relative group cursor-help">
      <span className="text-slate-600 text-xs ml-0.5">i</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-700 text-slate-200 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 max-w-xs text-center" style={{whiteSpace: 'normal', width: '200px'}}>
        {text}
      </span>
    </span>
  )
}

const SECTIONS = [
  { id: 'epa', label: 'EPA Rankings', icon: '📊' },
  { id: 'clutch', label: 'Clutch Rankings', icon: '🔥' },
  { id: 'splits', label: 'Situational Splits', icon: '📋' },
  { id: 'playaction', label: 'Play-Action', icon: '🎭' },
  { id: 'pressure', label: 'Under Pressure', icon: '💨' },
  { id: 'decisions', label: 'QB Decisions', icon: '🧠' },
  { id: 'runheatmap', label: 'Run Heatmap', icon: '🏃' },
  { id: 'passheatmap', label: 'Pass Heatmap', icon: '🎯' },
  { id: 'formation', label: 'Formations', icon: '📐' },
]

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

function EpaRankingsSection({ season }) {
  const [pos, setPos] = useState('QB')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getEpaRankings({ position: pos, season }).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [pos, season])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {POSITIONS.map(p => (
          <button key={p} onClick={() => setPos(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pos === p ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {p}
          </button>
        ))}
      </div>
      {loading && <Loading text="Loading EPA rankings..." />}
      {data?.data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 pr-2">#</th>
                <th className="text-left py-2 pr-2">Player</th>
                <th className="text-left py-2 pr-2">Team</th>
                <th className="text-right py-2 px-2">EPA/play<Tip stat="epa_per_play" /></th>
                <th className="text-right py-2 px-2">Total EPA<Tip stat="total_epa" /></th>
                <th className="text-right py-2 px-2">WPA/play<Tip stat="wpa_per_play" /></th>
                <th className="text-right py-2 px-2">Plays</th>
                <th className="text-right py-2 px-2">Success%<Tip stat="success_rate" /></th>
                <th className="text-right py-2 px-2">FDV</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((r, i) => (
                <tr key={r.player_id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="py-2 pr-2 text-slate-600 text-xs">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <a href={`/player/${r.player_id}`} className="text-white hover:text-amber-400 transition-colors font-medium">{r.player_name}</a>
                    {r.draft_round && <span className="text-slate-600 text-xs ml-1.5">Rd{r.draft_round}</span>}
                  </td>
                  <td className="py-2 pr-2 text-slate-400">{r.team}</td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.epa_per_play} /></td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.total_epa} /></td>
                  <td className="py-2 px-2 text-right"><EpaColorCell val={r.wpa_per_play} /></td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.plays}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{r.success_rate}%</td>
                  <td className="py-2 px-2 text-right text-amber-400/70">{r.fdv ? Math.round(r.fdv) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ClutchRankingsSection({ season }) {
  const [pos, setPos] = useState('QB')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getClutchRankings({ position: pos, season }).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [pos, season])

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">Last 5 minutes, score within 8 points</p>
      <div className="flex gap-2">
        {['QB', 'RB', 'WR'].map(p => (
          <button key={p} onClick={() => setPos(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pos === p ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {p}
          </button>
        ))}
      </div>
      {loading && <Loading text="Loading clutch rankings..." />}
      {data?.data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 pr-2">#</th>
                <th className="text-left py-2 pr-2">Player</th>
                <th className="text-left py-2 pr-2">Team</th>
                <th className="text-right py-2 px-2">Clutch WPA<Tip stat="clutch_wpa" /></th>
                <th className="text-right py-2 px-2">WPA/play<Tip stat="clutch_wpa_per_play" /></th>
                <th className="text-right py-2 px-2">EPA/play<Tip stat="clutch_epa_per_play" /></th>
                <th className="text-right py-2 px-2">Plays</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((r, i) => (
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
  const [players, setPlayers] = useState([])
  const [availableYears, setAvailableYears] = useState(FALLBACK_YEARS)

  useEffect(() => {
    api.getSituationalSeasons().then(years => {
      if (years?.length) { setAvailableYears(years); setSeason(years[0]) }
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

  const needsPlayer = !['epa', 'clutch', 'formation'].includes(section)

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
          <select value={season} onChange={e => setSeason(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

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
          {section === 'epa' && <EpaRankingsSection season={season} />}
          {section === 'clutch' && <ClutchRankingsSection season={season} />}
          {section === 'splits' && <SplitsSection players={players} season={season} />}
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
    </div>
  )
}

function FormationSection({ season }) {
  const [team, setTeam] = useState('KC')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const TEAMS = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']

  useEffect(() => {
    setLoading(true)
    api.getFormation(team, season).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [team, season])

  return (
    <div className="space-y-4">
      <select value={team} onChange={e => setTeam(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm">
        {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
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
