import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_SEARCH_RESULTS } from '../data/mock'

export default function PlayerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const navigate = useNavigate()

  const handleInput = value => {
    setQuery(value)
    if (value.length < 2) { setResults([]); return }
    // Stage 8: replace with GET /api/players/search?q=value
    setResults(
      MOCK_SEARCH_RESULTS.filter(p =>
        p.player_name.toLowerCase().includes(value.toLowerCase())
      )
    )
  }

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-24">
      <h1 className="text-4xl font-bold text-white mb-2 text-center tracking-tight">
        NFL Player Data
      </h1>
      <p className="text-slate-400 text-center mb-10">
        Search players, compare careers, analyze draft value — 2000-2025
      </p>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Search for a player..."
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {results.length > 0 && (
          <ul className="absolute w-full mt-1 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-10">
            {results.map(p => (
              <li
                key={p.player_id}
                onClick={() => { setResults([]); setQuery(''); navigate(`/player/${p.player_id}`) }}
                className="px-5 py-3.5 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-blue-900 text-blue-300 text-xs font-medium px-2 py-0.5 rounded">
                    {p.pos}
                  </span>
                  <span className="text-white font-medium">{p.player_name}</span>
                </div>
                <span className="text-slate-500 text-xs">
                  {p.first_season}–{p.last_season}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16">
        <FeatureCard
          icon="📊"
          title="Career Stats"
          desc="Full season-by-season breakdowns with career totals and graphs"
          href="/player/MahoPa00"
        />
        <FeatureCard
          icon="⚖️"
          title="Compare Players"
          desc="Side-by-side career comparison across any stat category"
          href="/comparison"
        />
        <FeatureCard
          icon="🎯"
          title="Draft Analysis"
          desc="Steals, busts, and combine-measurables value model"
          href="/draft"
        />
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, href }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(href)}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left hover:border-blue-600 hover:bg-slate-750 transition-colors"
    >
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </button>
  )
}
