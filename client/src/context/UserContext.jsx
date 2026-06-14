import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

const EMPTY = { players: [], comparisons: [], searches: [], notes: [] }

function loadSaved(username) {
  if (!username) return EMPTY
  try { return JSON.parse(localStorage.getItem(`nfl_saved_${username}`)) ?? EMPTY }
  catch { return EMPTY }
}

function persist(username, data) {
  if (username) localStorage.setItem(`nfl_saved_${username}`, JSON.stringify(data))
}

export function UserProvider({ children }) {
  const [username, setUsername] = useState(() => localStorage.getItem('nfl_username') ?? '')
  const [saved, setSaved]       = useState(() => loadSaved(localStorage.getItem('nfl_username') ?? ''))

  const setUser = name => {
    const n = name.trim()
    localStorage.setItem('nfl_username', n)
    setUsername(n)
    setSaved(loadSaved(n))
  }

  const upd = useCallback(fn => {
    setSaved(prev => { const next = fn(prev); persist(username, next); return next })
  }, [username])

  // ── Players ──────────────────────────────────────────────────────────
  const savePlayer   = p  => upd(d => ({
    ...d,
    players: d.players.some(x => x.player_id === p.player_id)
      ? d.players
      : [{ player_id: p.player_id, player_name: p.player_name, pos: p.pos, note: '', saved_at: new Date().toISOString() }, ...d.players],
  }))
  const removePlayer      = id   => upd(d => ({ ...d, players: d.players.filter(p => p.player_id !== id) }))
  const isPlayerSaved     = id   => saved.players.some(p => p.player_id === id)
  const updatePlayerNote  = (id, note) => upd(d => ({
    ...d,
    players: d.players.map(p => p.player_id === id ? { ...p, note } : p),
  }))

  // ── Comparisons ───────────────────────────────────────────────────────
  const saveComparison      = (playerIds, playerNames, category) => upd(d => ({
    ...d,
    comparisons: [{ playerIds, playerNames, category, note: '', saved_at: new Date().toISOString() }, ...d.comparisons].slice(0, 20),
  }))
  const removeComparison    = idx => upd(d => ({ ...d, comparisons: d.comparisons.filter((_, i) => i !== idx) }))
  const updateComparisonNote = (idx, note) => upd(d => ({
    ...d,
    comparisons: d.comparisons.map((c, i) => i === idx ? { ...c, note } : c),
  }))

  // ── Searches ──────────────────────────────────────────────────────────
  const saveSearch      = (question, sql, rows) => upd(d => ({
    ...d,
    searches: [{ question, sql, rows: rows.slice(0, 5), note: '', saved_at: new Date().toISOString() }, ...d.searches].slice(0, 20),
  }))
  const removeSearch    = idx => upd(d => ({ ...d, searches: d.searches.filter((_, i) => i !== idx) }))
  const updateSearchNote = (idx, note) => upd(d => ({
    ...d,
    searches: d.searches.map((s, i) => i === idx ? { ...s, note } : s),
  }))

  // ── Notes ─────────────────────────────────────────────────────────────
  const addNote    = text => upd(d => ({
    ...d,
    notes: [{ id: Date.now().toString(), text, saved_at: new Date().toISOString() }, ...d.notes],
  }))
  const removeNote = id   => upd(d => ({ ...d, notes: d.notes.filter(n => n.id !== id) }))

  return (
    <Ctx.Provider value={{
      username, setUser, saved,
      savePlayer, removePlayer, isPlayerSaved, updatePlayerNote,
      saveComparison, removeComparison, updateComparisonNote,
      saveSearch, removeSearch, updateSearchNote,
      addNote, removeNote,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useUser = () => useContext(Ctx)
