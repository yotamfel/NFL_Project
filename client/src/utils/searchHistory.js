const key = username => `nfl_history_${username}`

export function addToHistory(username, player) {
  if (!username) return
  const history = getHistory(username)
  const idx = history.findIndex(p => p.player_id === player.player_id)
  if (idx >= 0) {
    history[idx].count += 1
    history[idx].last_ts = Date.now()
  } else {
    history.push({
      player_id: player.player_id,
      player_name: player.player_name,
      pos: player.pos,
      first_season: player.first_season,
      last_season: player.last_season,
      count: 1,
      last_ts: Date.now(),
    })
  }
  localStorage.setItem(key(username), JSON.stringify(history))
}

export function getHistory(username) {
  if (!username) return []
  try { return JSON.parse(localStorage.getItem(key(username)) || '[]') }
  catch { return [] }
}

// Top N players sorted by search count, then recency
export function topSearched(username, n = 5) {
  return getHistory(username)
    .sort((a, b) => b.count - a.count || b.last_ts - a.last_ts)
    .slice(0, n)
}

// Most-searched position group in history (for suggestion targeting)
export function dominantPos(username) {
  const history = getHistory(username)
  if (!history.length) return null
  const counts = {}
  history.forEach(p => { counts[p.pos] = (counts[p.pos] || 0) + p.count })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
