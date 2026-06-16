import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api, setAccessToken, setUnauthorizedHandler } from '../api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const logoutRef = useRef(null)

  const logout = useCallback(async () => {
    const rt = localStorage.getItem('nfl_refresh_token')
    if (rt) {
      try { await api.logout(rt) } catch { /* ignore */ }
      localStorage.removeItem('nfl_refresh_token')
    }
    setAccessToken(null)
    setUser(null)
  }, [])

  // Store logout in a ref so setUnauthorizedHandler can close over it
  useEffect(() => { logoutRef.current = logout }, [logout])

  // Register the 401 handler once
  useEffect(() => {
    setUnauthorizedHandler(() => logoutRef.current?.())
  }, [])

  // On mount: attempt silent token refresh
  useEffect(() => {
    const rt = localStorage.getItem('nfl_refresh_token')
    if (!rt) { setIsLoading(false); return }
    api.refresh(rt)
      .then(data => {
        setAccessToken(data.access_token)
        setUser(data.user)
      })
      .catch(() => {
        localStorage.removeItem('nfl_refresh_token')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password)
    localStorage.setItem('nfl_refresh_token', data.refresh_token)
    setAccessToken(data.access_token)
    setUser(data.user)
    await _migrateLocalStorage(username)
    return data.user
  }, [])

  const register = useCallback(async (username, email, password) => {
    const data = await api.register(username, email, password)
    localStorage.setItem('nfl_refresh_token', data.refresh_token)
    setAccessToken(data.access_token)
    setUser(data.user)
    await _migrateLocalStorage(username)
    return data.user
  }, [])

  const updatePreferences = useCallback(async (prefs) => {
    const updated = await api.updatePreferences(prefs)
    setUser(prev => ({ ...prev, ...updated }))
    return updated
  }, [])

  const refreshUnread = useCallback(async () => {
    try {
      const me = await api.me()
      setUser(prev => prev ? {
        ...prev,
        unread_notifications_count: me.unread_notifications_count,
        ...(me.unresolved_feedback_count != null ? { unresolved_feedback_count: me.unresolved_feedback_count } : {}),
      } : prev)
    } catch { /* ignore */ }
  }, [])

  // Poll every 30s while logged in to keep counts live
  useEffect(() => {
    if (!user) return
    const id = setInterval(refreshUnread, 30_000)
    return () => clearInterval(id)
  }, [user?.id, refreshUnread])

  return (
    <AuthCtx.Provider value={{ user, isLoading, login, register, logout, updatePreferences, refreshUnread }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)

// Migrate localStorage saved data to DB on first login
async function _migrateLocalStorage(username) {
  const key = `nfl_saved_${username}`
  const raw = localStorage.getItem(key)
  if (!raw) return
  try {
    const saved = JSON.parse(raw)
    const items = []
    ;(saved.players    || []).forEach(p => items.push({ type: 'player',     label: p.player_name || p.player_id, data: p, note: p.note || '' }))
    ;(saved.comparisons|| []).forEach(c => items.push({ type: 'comparison', label: c.playerNames?.join(' vs ') || 'comparison', data: c, note: c.note || '' }))
    ;(saved.searches   || []).forEach(s => items.push({ type: 'search',     label: s.question || 'search', data: s, note: s.note || '' }))
    ;(saved.charts     || []).forEach(c => items.push({ type: 'chart',      label: c.title || 'chart', data: c, note: '' }))
    ;(saved.tables     || []).forEach(t => items.push({ type: 'table',      label: t.title || 'table', data: t, note: '' }))
    if (items.length) await api.migrateSaved(items)
    localStorage.removeItem(key)
  } catch { /* ignore migration errors */ }
}
