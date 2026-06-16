import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'

const Ctx = createContext(null)

const EMPTY_SAVED = { players: [], comparisons: [], searches: [], notes: [], charts: [], tables: [] }

export function UserProvider({ children }) {
  const { user } = useAuth()
  const username  = user?.username ?? ''

  const [saved, setSaved] = useState(() => EMPTY_SAVED)

  useEffect(() => {
    if (!username) { setSaved(EMPTY_SAVED); return }
    try {
      const data = JSON.parse(localStorage.getItem(`nfl_saved_${username}`)) ?? EMPTY_SAVED
      setSaved({ ...EMPTY_SAVED, ...data })
    } catch { setSaved(EMPTY_SAVED) }
  }, [username])

  const upd = useCallback(fn => {
    setSaved(prev => {
      const next = fn(prev)
      if (username) localStorage.setItem(`nfl_saved_${username}`, JSON.stringify(next))
      return next
    })
  }, [username])

  const savePlayer   = p  => upd(d => ({
    ...d,
    players: d.players.some(x => x.player_id === p.player_id)
      ? d.players
      : [{ player_id: p.player_id, player_name: p.player_name, pos: p.pos, note: '', saved_at: new Date().toISOString() }, ...d.players],
  }))
  const removePlayer     = id   => upd(d => ({ ...d, players: d.players.filter(p => p.player_id !== id) }))
  const isPlayerSaved    = id   => saved.players.some(p => p.player_id === id)
  const updatePlayerNote = (id, note) => upd(d => ({ ...d, players: d.players.map(p => p.player_id === id ? { ...p, note } : p) }))

  const saveComparison       = (playerIds, playerNames, category) => upd(d => ({
    ...d,
    comparisons: [{ playerIds, playerNames, category, note: '', saved_at: new Date().toISOString() }, ...d.comparisons].slice(0, 20),
  }))
  const removeComparison     = idx => upd(d => ({ ...d, comparisons: d.comparisons.filter((_, i) => i !== idx) }))
  const updateComparisonNote = (idx, note) => upd(d => ({ ...d, comparisons: d.comparisons.map((c, i) => i === idx ? { ...c, note } : c) }))

  const saveSearch      = (question, sql, rows) => upd(d => ({
    ...d,
    searches: [{ question, sql, rows: rows.slice(0, 5), note: '', saved_at: new Date().toISOString() }, ...d.searches].slice(0, 20),
  }))
  const removeSearch    = idx => upd(d => ({ ...d, searches: d.searches.filter((_, i) => i !== idx) }))
  const updateSearchNote = (idx, note) => upd(d => ({ ...d, searches: d.searches.map((s, i) => i === idx ? { ...s, note } : s) }))

  const addNote    = text => upd(d => ({ ...d, notes: [{ id: Date.now().toString(), text, saved_at: new Date().toISOString() }, ...d.notes] }))
  const removeNote = id   => upd(d => ({ ...d, notes: d.notes.filter(n => n.id !== id) }))
  const updateNote = (id, text) => upd(d => ({ ...d, notes: d.notes.map(n => n.id === id ? { ...n, text } : n) }))

  const saveChart  = chart => upd(d => {
    if (d.charts.find(c => c.title === chart.title)) return d
    return { ...d, charts: [{ ...chart, id: Date.now().toString(), savedAt: new Date().toISOString() }, ...d.charts] }
  })
  const removeChart  = title => upd(d => ({ ...d, charts: d.charts.filter(c => c.title !== title) }))
  const isChartSaved = title => saved.charts.some(c => c.title === title)

  const saveTable  = table => upd(d => {
    if (d.tables.find(t => t.title === table.title)) return d
    return { ...d, tables: [{ ...table, id: Date.now().toString(), savedAt: new Date().toISOString() }, ...d.tables] }
  })
  const removeTable  = title => upd(d => ({ ...d, tables: d.tables.filter(t => t.title !== title) }))
  const isTableSaved = title => saved.tables.some(t => t.title === title)

  return (
    <Ctx.Provider value={{
      username, saved,
      savePlayer, removePlayer, isPlayerSaved, updatePlayerNote,
      saveComparison, removeComparison, updateComparisonNote,
      saveSearch, removeSearch, updateSearchNote,
      addNote, removeNote, updateNote,
      saveChart, removeChart, isChartSaved,
      saveTable, removeTable, isTableSaved,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useUser = () => useContext(Ctx)
