import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { ComparisonBarChart } from '../components/StatChart'

const CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']
const BAR_COLORS = ['#60a5fa', '#fbbf24', '#4ade80', '#f87171']

const CAREER_COLS = [
  { key: 'player_name', label: 'Player' },
  { key: 'g',   label: 'G' },
  { key: 'yds', label: 'Yards', format: v => v?.toLocaleString() ?? '—' },
  { key: 'td',  label: 'TD',    format: v => v?.toLocaleString() ?? '—' },
  { key: 'int', label: 'INT' },
  { key: 'cmp', label: 'Cmp',   format: v => v != null ? v.toLocaleString() : '—' },
  { key: 'att', label: 'Att',   format: v => v != null ? v.toLocaleString() : '—' },
]

export default function Comparison() {
  const [category,    setCategory]    = useState('passing')
  const [playerIds,   setPlayerIds]   = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (playerIds.length === 0) { setData(null); return }
    let cancelled = false
    setLoading(true); setError(null)
    api.compareCareer(playerIds, category)
      .then(r  => { if (!cancelled) { setData(r);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [playerIds.join(','), category])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try { setSearchResults(await api.searchPlayers(searchQuery)) }
      catch { setSearchResults([]) }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery])

  const addPlayer = id => {
    if (!playerIds.includes(id) && playerIds.length < 4) setPlayerIds(p => [...p, id])
    setSearchQuery(''); setSearchResults([])
  }
  const removePlayer = id => setPlayerIds(p => p.filter(x => x !== id))

  const displayPlayers = data?.players ?? playerIds.map(id => ({ player_id: id, player_name: id, pos: '' }))

  const chartData = data ? [
    { metric: 'Yds',   ...Object.fromEntries(data.career.map(p => [p.player_name, p.yds  ?? 0])) },
    { metric: 'TD',    ...Object.fromEntries(data.career.map(p => [p.player_name, p.td   ?? 0])) },
    { metric: 'INT',   ...Object.fromEntries(data.career.map(p => [p.player_name, p.int  ?? 0])) },
    { metric: 'Games', ...Object.fromEntries(data.career.map(p => [p.player_name, p.g    ?? 0])) },
  ] : []

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Head to Head</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Player Comparison</h1>
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Player lane cards */}
      <div className="flex gap-2 flex-wrap items-center">
        {playerIds.length === 0 && (
          <p className="text-slate-500 text-sm">Add players below to start comparing.</p>
        )}
        {displayPlayers.map((p, i) => (
          <div key={p.player_id} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
            style={{
              background: `${BAR_COLORS[i]}15`,
              border: `1px solid ${BAR_COLORS[i]}40`,
            }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BAR_COLORS[i] }} />
            <span className="text-white font-semibold">{p.player_name}</span>
            {p.pos && <span className="text-xs" style={{ color: BAR_COLORS[i], opacity: 0.8 }}>{p.pos}</span>}
            <button onClick={() => removePlayer(p.player_id)}
              className="ml-1 text-slate-600 hover:text-red-400 transition-colors text-base leading-none">×</button>
          </div>
        ))}

        {/* VS divider when 2+ players */}
        {playerIds.length >= 2 && (
          <span className="text-xs font-black text-slate-600 px-1">VS</span>
        )}

        {playerIds.length < 4 && (
          <div className="relative">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="+ Add player"
              className="bg-slate-800/60 border border-slate-700 border-dashed rounded-xl px-4 py-2 text-sm text-slate-400 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-36" />
            {searchResults.length > 0 && (
              <ul className="absolute top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-10">
                {searchResults.map(p => (
                  <li key={p.player_id} onClick={() => addPlayer(p.player_id)}
                    className="px-4 py-2.5 hover:bg-slate-700 cursor-pointer flex justify-between text-sm">
                    <span className="text-white">{p.player_name}</span>
                    <span className="text-slate-400 text-xs">{p.pos}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {loading && <Loading text="Loading comparison…" />}
      {error   && <ErrorMsg message={error} />}

      {data && (
        <>
          {/* Chart section */}
          <div className="rounded-2xl overflow-hidden border border-slate-700/60"
            style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' }}>
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <h2 className="text-white font-bold capitalize">
                Career totals &mdash; {category}
              </h2>
              <span className="text-xs text-slate-600 uppercase tracking-wider">Career</span>
            </div>
            <div className="px-5 pb-5">
              <ComparisonBarChart
                data={chartData} xKey="metric"
                bars={data.players.map((p, i) => ({ dataKey: p.player_name, label: p.player_name, color: BAR_COLORS[i] }))}
              />
            </div>
          </div>

          {/* Stats table */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
            <h2 className="text-white font-bold mb-4">Head-to-head</h2>
            <StatTable columns={CAREER_COLS} rows={data.career} keyField="player_id" />
          </div>
        </>
      )}
    </div>
  )
}
