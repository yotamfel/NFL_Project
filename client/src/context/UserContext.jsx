import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

const EMPTY = { players: [], comparisons: [], searches: [], notes: [], charts: [], tables: [] }

function loadSaved(username) {
  if (!username) return EMPTY
  try {
    const data = JSON.parse(localStorage.getItem(`nfl_saved_${username}`)) ?? EMPTY
    return { ...EMPTY, ...data }
  }
  catch { return EMPTY }
}

function loadDashboards(username) {
  if (!username) return []
  try { return JSON.parse(localStorage.getItem(`nfl_dashboards_${username}`)) ?? [] }
  catch { return [] }
}

function persist(username, data) {
  if (username) localStorage.setItem(`nfl_saved_${username}`, JSON.stringify(data))
}

function persistDashboards(username, dashboards) {
  if (username) localStorage.setItem(`nfl_dashboards_${username}`, JSON.stringify(dashboards))
}

export function UserProvider({ children }) {
  const [username, setUsername] = useState(() => localStorage.getItem('nfl_username') ?? '')
  const [saved, setSaved]       = useState(() => loadSaved(localStorage.getItem('nfl_username') ?? ''))
  const [dashboards, setDashboards] = useState(() => loadDashboards(localStorage.getItem('nfl_username') ?? ''))

  const setUser = name => {
    const n = name.trim()
    localStorage.setItem('nfl_username', n)
    setUsername(n)
    setSaved(loadSaved(n))
    setDashboards(loadDashboards(n))
  }

  const upd = useCallback(fn => {
    setSaved(prev => { const next = fn(prev); persist(username, next); return next })
  }, [username])

  const updDash = useCallback(fn => {
    setDashboards(prev => { const next = fn(prev); persistDashboards(username, next); return next })
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
  const updateNote = (id, text) => upd(d => ({
    ...d,
    notes: d.notes.map(n => n.id === id ? { ...n, text } : n),
  }))

  // ── Charts ────────────────────────────────────────────────────────────
  const saveChart = chart => upd(d => {
    const existing = d.charts.find(c => c.title === chart.title)
    if (existing) return d
    return { ...d, charts: [{ ...chart, id: Date.now().toString(), savedAt: new Date().toISOString() }, ...d.charts] }
  })
  const removeChart   = title => upd(d => ({ ...d, charts: d.charts.filter(c => c.title !== title) }))
  const isChartSaved  = title => saved.charts.some(c => c.title === title)

  // ── Tables ────────────────────────────────────────────────────────────
  const saveTable = table => upd(d => {
    const existing = d.tables.find(t => t.title === table.title)
    if (existing) return d
    return { ...d, tables: [{ ...table, id: Date.now().toString(), savedAt: new Date().toISOString() }, ...d.tables] }
  })
  const removeTable   = title => upd(d => ({ ...d, tables: d.tables.filter(t => t.title !== title) }))
  const isTableSaved  = title => saved.tables.some(t => t.title === title)

  // ── Dashboards ────────────────────────────────────────────────────────
  const saveDashboard = name => {
    const id = Date.now().toString()
    updDash(ds => [{
      id,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      widgets: [],
    }, ...ds])
    return id
  }
  const removeDashboard  = id => updDash(ds => ds.filter(d => d.id !== id))
  const updateDashboard  = (id, changes) => updDash(ds =>
    ds.map(d => d.id === id ? { ...d, ...changes, updatedAt: new Date().toISOString() } : d)
  )
  const getDashboard     = id => dashboards.find(d => d.id === id)

  return (
    <Ctx.Provider value={{
      username, setUser, saved, dashboards,
      savePlayer, removePlayer, isPlayerSaved, updatePlayerNote,
      saveComparison, removeComparison, updateComparisonNote,
      saveSearch, removeSearch, updateSearchNote,
      addNote, removeNote, updateNote,
      saveChart, removeChart, isChartSaved,
      saveTable, removeTable, isTableSaved,
      saveDashboard, removeDashboard, updateDashboard, getDashboard,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useUser = () => useContext(Ctx)
