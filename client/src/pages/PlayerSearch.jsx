import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function PlayerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await api.searchPlayers(query))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const select = player => {
    setResults([])
    setQuery('')
    navigate(`/player/${player.player_id}`)
  }

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-24">
      <h1 className="text-4xl font-bold text-white mb-2 text-center tracking-tight">
        NFL Player Data
      </h1>
      <p className="text-slate-400 text-center mb-10">
        Search players, compare careers, analyze draft value — 2000-2025
      </p>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a player..."
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {searching && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">…</div>
        )}
        {results.length > 0 && (
          <ul className="absolute w-full mt-1 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-10">
            {results.map(p => (
              <li
                key={p.player_id}
                onClick={() => select(p)}
                className="px-5 py-3.5 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-blue-900 text-blue-300 text-xs font-medium px-2 py-0.5 rounded">
                    {p.pos}
                  </span>
                  <span className="text-white font-medium">{p.player_name}</span>
                </div>
                <span className="text-slate-500 text-xs">{p.first_season}–{p.last_season}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16">
        <FeatureCard icon="📊" title="Career Stats"
          desc="Full season-by-season breakdowns with career totals and graphs"
          href="/player/MahoPa00" />
        <FeatureCard icon="⚖️" title="Compare Players"
          desc="Side-by-side career comparison across any stat category"
          href="/comparison" />
        <FeatureCard icon="🎯" title="Draft Analysis"
          desc="Steals, busts, and combine-measurables value model"
          href="/draft" />
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, href }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(href)}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left hover:border-blue-600 transition-colors"
    >
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </button>
  )
}
