import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const YEARS = Array.from({ length: 26 }, (_, i) => 2025 - i)  // 2025 down to 2000

export default function PlayerSearch() {
  const [query,      setQuery]      = useState('')
  const [pos,        setPos]        = useState('')
  const [season,     setSeason]     = useState('')
  const [team,       setTeam]       = useState('')
  const [posOpen,    setPosOpen]    = useState(false)
  const [yearOpen,   setYearOpen]   = useState(false)
  const [results,    setResults]    = useState([])
  const [searching,  setSearching]  = useState(false)
  const debounceRef  = useRef(null)
  const posRef       = useRef(null)
  const yearRef      = useRef(null)
  const navigate     = useNavigate()

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = e => {
      if (posRef.current  && !posRef.current.contains(e.target))  setPosOpen(false)
      if (yearRef.current && !yearRef.current.contains(e.target)) setYearOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasFilter = pos || season || team

  useEffect(() => {
    if (query.length < 2 && !hasFilter) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await api.searchPlayers(query, {
          pos:    pos    || undefined,
          season: season || undefined,
          team:   team   || undefined,
          limit:  20,
        }))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, pos, season, team])

  const select = player => {
    setResults([])
    setQuery('')
    navigate(`/player/${player.player_id}`)
  }

  const clearFilters = () => { setPos(''); setSeason(''); setTeam('') }

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-24">
      <h1 className="text-4xl font-bold text-white mb-2 text-center tracking-tight">
        NFL Player Data
      </h1>
      <p className="text-slate-400 text-center mb-10">
        Search players, compare careers, analyze draft value — 2000–2025
      </p>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {searching && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">…</div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-3 flex gap-2 items-center">
        {/* Position dropdown */}
        <div className="relative" ref={posRef}>
          <button
            onClick={() => setPosOpen(o => !o)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              pos
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {pos || 'Position'}
            <span className="text-xs opacity-60">▾</span>
          </button>
          {posOpen && (
            <ul className="absolute top-full mt-1 left-0 w-32 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-20">
              {pos && (
                <li
                  onClick={() => { setPos(''); setPosOpen(false) }}
                  className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-700 cursor-pointer border-b border-slate-700"
                >
                  All positions
                </li>
              )}
              {POSITIONS.map(p => (
                <li
                  key={p}
                  onClick={() => { setPos(p); setPosOpen(false) }}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-slate-700 ${
                    pos === p ? 'text-blue-400 font-medium' : 'text-slate-200'
                  }`}
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Year dropdown */}
        <div className="relative" ref={yearRef}>
          <button
            onClick={() => setYearOpen(o => !o)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              season
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {season || 'Year'}
            <span className="text-xs opacity-60">▾</span>
          </button>
          {yearOpen && (
            <ul className="absolute top-full mt-1 left-0 w-24 max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20">
              {season && (
                <li
                  onClick={() => { setSeason(''); setYearOpen(false) }}
                  className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-700 cursor-pointer border-b border-slate-700 sticky top-0 bg-slate-800"
                >
                  All years
                </li>
              )}
              {YEARS.map(y => (
                <li
                  key={y}
                  onClick={() => { setSeason(String(y)); setYearOpen(false) }}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-slate-700 ${
                    season === String(y) ? 'text-blue-400 font-medium' : 'text-slate-200'
                  }`}
                >
                  {y}
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="text"
          value={team}
          onChange={e => setTeam(e.target.value.toUpperCase())}
          placeholder="Team"
          maxLength={3}
          className="w-20 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />

        {hasFilter && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {results.length > 0 && (
        <ul className="mt-1 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
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

      {/* Empty state when filters are set but no results */}
      {!searching && hasFilter && results.length === 0 && (
        <p className="mt-4 text-center text-slate-500 text-sm">No players match these filters.</p>
      )}

      {/* Feature cards */}
      {!results.length && !hasFilter && (
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
      )}
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
