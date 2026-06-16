import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const LINKS = [
  { to: '/players',    label: 'Players' },
  { to: '/comparison', label: 'Compare' },
  { to: '/draft',      label: 'Draft' },
  { to: '/search',     label: 'Search' },
  { to: '/trends',     label: 'Trends' },
  { to: '/anomalies',  label: 'Anomalies' },
  { to: '/saved',      label: 'Saved' },
  { to: '/guide',      label: 'Guide' },
  { to: '/feedback',   label: 'Feedback' },
  { to: '/admin',      label: 'Admin', adminOnly: true },
]

export default function Nav() {
  const [searchQ,       setSearchQ]       = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [bellOpen,      setBellOpen]      = useState(false)
  const [notifs,        setNotifs]        = useState([])
  const [localUnread,   setLocalUnread]   = useState(0)

  const { user, logout, updatePreferences } = useAuth()
  const navigate    = useNavigate()
  const debounceRef = useRef(null)
  const searchRef   = useRef(null)
  const settingsRef = useRef(null)
  const bellRef     = useRef(null)

  useEffect(() => {
    setLocalUnread(user?.unread_notifications_count ?? 0)
  }, [user?.unread_notifications_count])

  // Search debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (searchQ.length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try { setSearchResults(await api.searchPlayers(searchQ, { limit: 8 })) }
      catch { setSearchResults([]) }
    }, 280)
    return () => clearTimeout(debounceRef.current)
  }, [searchQ])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = e => {
      if (searchRef.current   && !searchRef.current.contains(e.target))   setSearchFocused(false)
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false)
      if (bellRef.current     && !bellRef.current.contains(e.target))     setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectPlayer = id => {
    setSearchQ(''); setSearchResults([]); setSearchFocused(false)
    navigate(`/player/${id}`)
  }

  const openBell = async () => {
    const opening = !bellOpen
    setBellOpen(opening)
    if (opening) {
      try {
        const list = await api.getNotifications()
        setNotifs(list)
        const unreadIds = list.filter(n => !n.is_read).map(n => n.id)
        if (unreadIds.length) {
          await Promise.all(unreadIds.map(id => api.markNotifRead(id)))
          setLocalUnread(0)
        }
      } catch { /* ignore */ }
    }
  }

  const handleLogout = async () => {
    setSettingsOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const showDropdown = searchFocused && searchResults.length > 0

  return (
    <nav className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
      {/*
        Split into two sections so overflow-x-auto on the links section
        does NOT clip the absolutely-positioned dropdowns on the right.
        (Setting overflow-x on a container implicitly changes overflow-y
        from 'visible', which hides children that extend below the nav.)
      */}
      <div className="px-4 flex items-center h-12">

        {/* Logo — never shrinks */}
        <NavLink to="/" className="flex items-center gap-1.5 shrink-0 mr-2">
          <img src="/logo.png" alt="" className="w-6 h-6" />
          <span className="font-black text-sm tracking-tight whitespace-nowrap">
            <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">FOURTH</span>
            <span className="text-white"> & DATA</span>
          </span>
        </NavLink>

        {/* Scrollable links section — overflow only here, not on parent */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 mr-3" style={{ scrollbarWidth: 'none' }}>
          {LINKS.filter(({ adminOnly }) => !adminOnly || user?.is_admin).map(({ to, label, adminOnly }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? adminOnly ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-white'
                  : adminOnly ? 'text-amber-500 hover:text-amber-300 hover:bg-amber-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`
            }>
              {label}
            </NavLink>
          ))}
        </div>

        {/* Player search */}
        <div ref={searchRef} className="relative shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 focus-within:border-slate-500 transition-colors">
            <span className="text-slate-500 text-xs">🔍</span>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Player search…"
              className="bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-32" />
          </div>
          {showDropdown && (
            <ul className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50 max-h-72 overflow-y-auto">
              {searchResults.map(p => (
                <li key={p.player_id} onMouseDown={() => selectPlayer(p.player_id)}
                  className="px-4 py-2.5 hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm border-b border-slate-700/60 last:border-0">
                  <span className="text-white">{p.player_name}</span>
                  <span className="text-slate-500 text-xs ml-2">{p.pos} · {p.last_season}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notification bell */}
        <div ref={bellRef} className="relative shrink-0">
          <button onClick={openBell}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Notifications">
            <span className="text-base">🔔</span>
            {localUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold px-0.5">
                {localUnread > 9 ? '9+' : localUnread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-slate-200 text-sm font-semibold">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">No notifications yet</p>
                ) : notifs.map(n => (
                  <div key={n.id} className="px-4 py-3 border-b border-slate-700/60 last:border-0">
                    <p className="text-slate-200 text-sm leading-relaxed">{n.message}</p>
                    <p className="text-slate-500 text-xs mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings gear */}
        <div ref={settingsRef} className="relative shrink-0">
          <button onClick={() => setSettingsOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-lg"
            title="Settings">
            ⚙
          </button>
          {settingsOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-slate-200 text-sm font-semibold">{user?.username}</p>
                <p className="text-slate-500 text-xs truncate">{user?.email}</p>
              </div>
              <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-300 text-sm">Guide language</span>
                <div className="flex gap-1">
                  {[['en', 'EN'], ['he', 'עב']].map(([code, label]) => (
                    <button key={code}
                      onClick={() => updatePreferences({ guide_lang: code })}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        (user?.guide_lang ?? 'en') === code
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-4 py-2 border-b border-slate-700/60 flex gap-3">
                <Link to="/about" onClick={() => setSettingsOpen(false)}
                  className="text-slate-400 hover:text-white text-xs transition-colors">About</Link>
                <Link to="/share" onClick={() => setSettingsOpen(false)}
                  className="text-slate-400 hover:text-white text-xs transition-colors">Share</Link>
              </div>
              <div className="px-4 py-3">
                <button onClick={handleLogout}
                  className="w-full py-2 rounded-lg bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-sm font-medium transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </nav>
  )
}
