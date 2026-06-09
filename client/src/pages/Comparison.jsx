import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { ComparisonBarChart } from '../components/StatChart'

const CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']
const BAR_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444']

const CAREER_COLS = [
  { key: 'player_name', label: 'Player' },
  { key: 'g',   label: 'Games' },
  { key: 'yds', label: 'Yards',  format: v => v?.toLocaleString() ?? '—' },
  { key: 'td',  label: 'TD',     format: v => v?.toLocaleString() ?? '—' },
  { key: 'int', label: 'INT' },
  { key: 'cmp', label: 'Cmp',    format: v => v != null ? v.toLocaleString() : '—' },
  { key: 'att', label: 'Att',    format: v => v != null ? v.toLocaleString() : '—' },
]

export default function Comparison() {
  const [category, setCategory] = useState('passing')
  const [playerIds, setPlayerIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (playerIds.length === 0) { setData(null); return }
    let cancelled = false
    setLoading(true); setError(null)
    api.compareCareer(playerIds, category)
      .then(r  => { if (!cancelled) { setData(r);         setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [playerIds.join(','), category])

  // Player search for adding more
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
    if (!playerIds.includes(id) && playerIds.length < 4) {
      setPlayerIds(prev => [...prev, id])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const removePlayer = id => setPlayerIds(prev => prev.filter(p => p !== id))

  const chartData = data
    ? [
        { metric: 'Yds',   ...Object.fromEntries(data.career.map(p => [p.player_name, p.yds  ?? 0])) },
        { metric: 'TD',    ...Object.fromEntries(data.career.map(p => [p.player_name, p.td   ?? 0])) },
        { metric: 'INT',   ...Object.fromEntries(data.career.map(p => [p.player_name, p.int  ?? 0])) },
        { metric: 'Games', ...Object.fromEntries(data.career.map(p => [p.player_name, p.g    ?? 0])) },
      ]
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Player Comparison</h1>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Player chips + add */}
      <div className="flex gap-2 flex-wrap items-center">
        {playerIds.length === 0 && (
          <p className="text-slate-500 text-sm">Add players below to start comparing.</p>
        )}
        {(data?.players ?? playerIds.map(id => ({ player_id: id, player_name: id, pos: '' }))).map((p, i) => (
          <span key={p.player_id} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-full px-4 py-1.5 text-sm text-white">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: BAR_COLORS[i] }} />
            {p.player_name}
            {p.pos && <span className="text-slate-400 text-xs">{p.pos}</span>}
            <button onClick={() => removePlayer(p.player_id)} className="text-slate-500 hover:text-red-400 ml-1">×</button>
          </span>
        ))}

        {playerIds.length < 4 && (
          <div className="relative">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="+ Add player"
              className="bg-slate-800 border border-slate-700 border-dashed rounded-full px-4 py-1.5 text-sm text-slate-400 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
            />
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
          <div className="bg-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Career totals — {category}</h2>
            <ComparisonBarChart
              data={chartData}
              xKey="metric"
              bars={data.players.map((p, i) => ({
                dataKey: p.player_name,
                label: p.player_name,
                color: BAR_COLORS[i],
              }))}
            />
          </div>
          <div className="bg-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Head-to-head</h2>
            <StatTable columns={CAREER_COLS} rows={data.career} keyField="player_id" />
          </div>
        </>
      )}
    </div>
  )
}
