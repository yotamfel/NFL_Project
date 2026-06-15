import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { api } from '../api'

const LINKS = [
  { to: '/players', label: 'Players' },
  { to: '/comparison', label: 'Compare' },
  { to: '/draft', label: 'Draft' },
  { to: '/search', label: 'Smart Search' },
  { to: '/trends', label: 'Trends' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/saved', label: 'Saved' },
  { to: '/guide', label: 'Guide' },
]

export default function Nav() {
  const [searchQ,        setSearchQ]        = useState('')
  const [searchResults,  setSearchResults]  = useState([])
  const [searchFocused,  setSearchFocused]  = useState(false)
  const { username, setUser } = useUser()
  const navigate    = useNavigate()
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Search with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (searchQ.length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.searchPlayers(searchQ, { limit: 8 })
        setSearchResults(results)
      } catch { setSearchResults([]) }
    }, 280)
    return () => clearTimeout(debounceRef.current)
  }, [searchQ])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectPlayer = (id) => {
    setSearchQ('')
    setSearchResults([])
    setSearchFocused(false)
    navigate(`/player/${id}`)
  }

  const showDropdown = searchFocused && searchResults.length > 0

  return (
    <>
      <nav className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center gap-x-4 gap-y-2 py-2 min-h-14">
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="" className="w-7 h-7" />
            <span className="font-black text-base tracking-tight">
              <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">FOURTH</span>
              <span className="text-white"> & DATA</span>
            </span>
          </NavLink>

          <div className="flex flex-wrap gap-x-1 gap-y-1">
            {LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Quick player search */}
          <div ref={containerRef} className="relative ml-auto">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-slate-500 transition-colors">
              <span className="text-slate-500 text-xs">🔍</span>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Quick player search…"
                className="bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none w-44"
              />
            </div>
            {showDropdown && (
              <ul className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50 max-h-72 overflow-y-auto">
                {searchResults.map(p => (
                  <li key={p.player_id}
                    onMouseDown={() => selectPlayer(p.player_id)}
                    className="px-4 py-2.5 hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm border-b border-slate-700/60 last:border-0">
                    <span className="text-white">{p.player_name}</span>
                    <span className="text-slate-500 text-xs ml-2">{p.pos} · {p.last_season}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {username && (
            <button
              onClick={() => {
                const n = window.prompt('Change username:', username)
                if (n && n.trim().length >= 2) setUser(n.trim())
              }}
              title="Change username"
              className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors font-semibold hidden sm:block"
            >
              {username}
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
