import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { posColor } from '../utils/posColors'
import { useUser } from '../context/UserContext'
import { addToHistory, topSearched, dominantPos } from '../utils/searchHistory'
import TeamPicker from '../components/TeamPicker'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const YEARS = Array.from({ length: 56 }, (_, i) => 2025 - i)
const TEAMS = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
  'DAL','DEN','DET','GB', 'HOU','IND','JAX','KC',
  'LA', 'LAC','LV', 'MIA','MIN','NE', 'NO', 'NYG',
  'NYJ','PHI','PIT','SEA','SF', 'TB', 'TEN','WAS',
]

function PlayerCard({ player, onClick }) {
  const c = posColor(player.pos)
  return (
    <button onClick={() => onClick(player)}
      className="w-full text-left rounded-xl p-4 border border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/60 transition-all group"
      style={{ background: 'rgba(15,23,42,0.7)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
            style={{ background: c.dark, color: c.hex, border: `1px solid ${c.mid}` }}>
            {player.pos}
          </span>
          <span className="text-white font-semibold text-sm group-hover:text-amber-300 transition-colors truncate">
            {player.player_name}
          </span>
        </div>
        <span className="text-slate-600 text-xs shrink-0 ml-2">
          {player.first_season}–{player.last_season}
        </span>
      </div>
      {player.count > 1 && (
        <p className="text-slate-600 text-xs mt-1.5 pl-1">
          Searched {player.count}×
        </p>
      )}
    </button>
  )
}

export default function PlayerLanding() {
  const { username } = useUser()
  const navigate     = useNavigate()

  const [query,    setQuery]    = useState('')
  const [pos,      setPos]      = useState('')
  const [season,   setSeason]   = useState('')
  const [teamSel,  setTeamSel]  = useState([])
  const team = teamSel[0] || ''
  const [posOpen,  setPosOpen]  = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [results,  setResults]  = useState([])
  const [searching,setSearching]= useState(false)

  const [recent,      setRecent]      = useState([])
  const [suggestions, setSuggestions] = useState([])

  const debounceRef = useRef(null)
  const posRef      = useRef(null)
  const yearRef     = useRef(null)

  const hasFilter = pos || season || team

  // Load history + suggestions on mount / username change
  useEffect(() => {
    const hist = topSearched(username, 5)
    setRecent(hist)

    const topPos   = dominantPos(username)
    const histIds  = new Set(topSearched(username, 200).map(p => p.player_id))

    api.getPopularPlayers(topPos, 20)
      .then(players => setSuggestions(
        players.filter(p => !histIds.has(p.player_id)).slice(0, 6)
      ))
      .catch(() => {})
  }, [username])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = e => {
      if (posRef.current  && !posRef.current.contains(e.target))  setPosOpen(false)
      if (yearRef.current && !yearRef.current.contains(e.target)) setYearOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2 && !hasFilter) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await api.searchPlayers(query, {
          pos: pos || undefined, season: season || undefined,
          team: team || undefined, limit: 20,
        }))
      } catch { setResults([]) }
      finally  { setSearching(false) }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, pos, season, team])

  const select = player => {
    addToHistory(username, player)
    setRecent(topSearched(username, 5))
    setResults([])
    setQuery('')
    navigate(`/player/${player.player_id}`)
  }

  const clearFilters = () => { setPos(''); setSeason(''); setTeamSel([]) }

  const showDefault = !results.length && !searching && !(query.length < 2 && hasFilter)

  return (
    <div className="max-w-3xl mx-auto pt-10 pb-24">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-1">Player Search</h1>
        <p className="text-slate-500 text-sm">19,000+ players · 1970–2025</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.1)] transition-all"
        />
        {searching && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">…</div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-3 flex gap-2 items-center">
        <FilterDropdown label="Position" value={pos} open={posOpen} setOpen={setPosOpen} ref_={posRef}
          onClear={() => setPos('')}
          items={POSITIONS}
          onSelect={p => { setPos(p); setPosOpen(false) }}
          renderItem={p => <span style={{ color: posColor(p).hex }}>{p}</span>}
        />
        <FilterDropdown label="Year" value={season} open={yearOpen} setOpen={setYearOpen} ref_={yearRef}
          clearLabel="All years" onClear={() => setSeason('')}
          items={YEARS.map(String)}
          onSelect={y => { setSeason(y); setYearOpen(false) }}
          listClass="max-h-56 overflow-y-auto"
        />
        <TeamPicker selected={teamSel} setSelected={setTeamSel} />
        {hasFilter && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <ul className="mt-2 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          {results.map(p => {
            const c = posColor(p.pos)
            return (
              <li key={p.player_id} onClick={() => select(p)}
                className="px-5 py-3 hover:bg-slate-700/60 cursor-pointer flex items-center justify-between border-b border-slate-700/60 last:border-0 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                    style={{ background: c.dark, color: c.hex, border: `1px solid ${c.mid}` }}>
                    {p.pos}
                  </span>
                  <span className="text-white font-medium">{p.player_name}</span>
                </div>
                <span className="text-slate-500 text-xs">{p.first_season}–{p.last_season}</span>
              </li>
            )
          })}
        </ul>
      )}

      {!searching && hasFilter && results.length === 0 && query.length >= 2 && (
        <p className="mt-4 text-center text-slate-500 text-sm">No players match these filters.</p>
      )}

      {/* History + suggestions (shown when not actively showing results) */}
      {showDefault && (
        <div className="mt-10 space-y-10">

          {recent.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
                Most Searched
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recent.map(p => <PlayerCard key={p.player_id} player={p} onClick={select} />)}
              </div>
            </section>
          )}

          {suggestions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
                {recent.length > 0 ? 'Suggested for You' : 'Popular Players'}
              </h2>
              {recent.length > 0 && (
                <p className="text-slate-600 text-xs mb-4">
                  Based on your searches
                </p>
              )}
              {recent.length === 0 && (
                <p className="text-slate-600 text-xs mb-4">
                  Top players by career value
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map(p => <PlayerCard key={p.player_id} player={p} onClick={select} />)}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}

function FilterDropdown({ label, value, open, setOpen, ref_, onClear, clearLabel, items, onSelect, renderItem, listClass = '' }) {
  return (
    <div className="relative" ref={ref_}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
          value
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
        }`}
      >
        {value || label}
        <span className="text-xs opacity-60">▾</span>
      </button>
      {open && (
        <ul className={`absolute top-full mt-1 left-0 w-28 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 ${listClass}`}>
          {value && (
            <li onClick={() => { onClear(); setOpen(false) }}
              className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-700 cursor-pointer border-b border-slate-700 sticky top-0 bg-slate-800">
              {clearLabel ?? 'All'}
            </li>
          )}
          {items.map(item => (
            <li key={item} onClick={() => onSelect(item)}
              className={`px-4 py-2 text-sm cursor-pointer hover:bg-slate-700 ${value === item ? 'text-amber-400 font-medium' : 'text-slate-200'}`}>
              {renderItem ? renderItem(item) : item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
