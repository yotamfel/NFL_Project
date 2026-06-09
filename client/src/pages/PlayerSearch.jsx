import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { posColor } from '../utils/posColors'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const YEARS = Array.from({ length: 26 }, (_, i) => 2025 - i)
const TEAMS = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
  'DAL','DEN','DET','GB', 'HOU','IND','JAX','KC',
  'LA', 'LAC','LV', 'MIA','MIN','NE', 'NO', 'NYG',
  'NYJ','PHI','PIT','SEA','SF', 'TB', 'TEN','WAS',
]

const FEATURE_CARDS = [
  {
    icon: '📊', title: 'Career Stats',
    desc: 'Season-by-season breakdowns with trend charts',
    href: '/player/MahoPa00',
    color: '#3b82f6', dark: '#1e3a5f',
  },
  {
    icon: '⚖️', title: 'Compare Players',
    desc: 'Side-by-side career comparison across any category',
    href: '/comparison',
    color: '#fbbf24', dark: '#451a03',
  },
  {
    icon: '🎯', title: 'Draft Analysis',
    desc: 'ML-powered steals, busts and combine value model',
    href: '/draft',
    color: '#4ade80', dark: '#14532d',
  },
]

export default function PlayerSearch() {
  const [query,     setQuery]     = useState('')
  const [pos,       setPos]       = useState('')
  const [season,    setSeason]    = useState('')
  const [team,      setTeam]      = useState('')
  const [posOpen,   setPosOpen]   = useState(false)
  const [yearOpen,  setYearOpen]  = useState(false)
  const [teamOpen,  setTeamOpen]  = useState(false)
  const [results,   setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const posRef      = useRef(null)
  const yearRef     = useRef(null)
  const teamRef     = useRef(null)
  const navigate    = useNavigate()

  const hasFilter = pos || season || team

  useEffect(() => {
    const handler = e => {
      if (posRef.current  && !posRef.current.contains(e.target))  setPosOpen(false)
      if (yearRef.current && !yearRef.current.contains(e.target)) setYearOpen(false)
      if (teamRef.current && !teamRef.current.contains(e.target)) setTeamOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const select = player => { setResults([]); setQuery(''); navigate(`/player/${player.player_id}`) }
  const clearFilters = () => { setPos(''); setSeason(''); setTeam('') }

  return (
    <div className="max-w-2xl mx-auto pt-10 pb-24">

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black tracking-tighter mb-3 leading-none">
          <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">NFL</span>
          <span className="text-white"> DATA</span>
        </h1>
        <p className="text-slate-400 text-sm tracking-wide">
          11,000+ players &nbsp;·&nbsp; 25 seasons &nbsp;·&nbsp; 32 teams
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a player…"
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
        <FilterDropdown label="Team" value={team} open={teamOpen} setOpen={setTeamOpen} ref_={teamRef}
          clearLabel="All teams" onClear={() => setTeam('')}
          items={TEAMS}
          onSelect={t => { setTeam(t); setTeamOpen(false) }}
          listClass="max-h-56 overflow-y-auto"
        />
        {hasFilter && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Results */}
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

      {!searching && hasFilter && results.length === 0 && (
        <p className="mt-4 text-center text-slate-500 text-sm">No players match these filters.</p>
      )}

      {/* Feature cards */}
      {!results.length && !hasFilter && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14">
          {FEATURE_CARDS.map(card => (
            <button key={card.href} onClick={() => navigate(card.href)}
              className="rounded-2xl overflow-hidden text-left hover:scale-[1.02] transition-transform"
              style={{ background: `linear-gradient(160deg, ${card.dark} 0%, #1e293b 100%)`, border: `1px solid ${card.color}22` }}>
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${card.color}, transparent)` }} />
              <div className="p-5">
                <div className="text-2xl mb-3">{card.icon}</div>
                <h3 className="text-white font-bold mb-1">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            </button>
          ))}
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
              {clearLabel ?? `All`}
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
