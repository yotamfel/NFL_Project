// All API calls in one place. The Vite dev-server proxy rewrites /api/*
// to http://localhost:8000/* so these work without CORS in development;
// in production the client and server will be served from the same origin.

const BASE = '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  searchPlayers: (q = '', { pos, season, team, limit = 10 } = {}) => {
    const p = new URLSearchParams({ q, limit })
    if (pos)    p.set('pos', pos)
    if (season) p.set('season', season)
    if (team)   p.set('team', team)
    return get(`/players/search?${p}`)
  },
  getPlayer:     id => get(`/players/${id}`),

  compareCareer: (ids, category) =>
    get(`/compare?${ids.map(id => `player_ids=${encodeURIComponent(id)}`).join('&')}&category=${category}`),
  compareSeason: (ids, category, season) =>
    get(`/compare?${ids.map(id => `player_ids=${encodeURIComponent(id)}`).join('&')}&category=${category}&season=${season}`),

  getDraftPicks: ({ team, draft_year, pos, limit = 50 } = {}) => {
    const p = new URLSearchParams()
    if (team)       p.set('team', team)
    if (draft_year) p.set('draft_year', draft_year)
    if (pos)        p.set('pos', pos)
    p.set('limit', limit)
    return get(`/draft?${p}`)
  },
  getCustomDraft: ({ roundVal, roundOp, statVal, statOp, category = 'career_av', stat, scope = 'career', pos, limit = 50 } = {}) => {
    const p = new URLSearchParams({ round_val: roundVal, round_op: roundOp, stat_val: statVal, stat_op: statOp, category, scope, limit })
    if (pos)  p.set('pos', pos)
    if (stat) p.set('stat', stat)
    return get(`/draft/custom?${p}`)
  },

  topPlayersByStat: (category, stat, { pos, season, min = 0, limit = 20 } = {}) => {
    const p = new URLSearchParams({ category, stat, min, limit })
    if (pos)    p.set('pos', pos)
    if (season) p.set('season', season)
    return get(`/players/top_by_stat?${p}`)
  },

  getDraftRoundStats: ({ roundVal, roundOp, category = 'career_av', stat, scope = 'career', pos } = {}) => {
    const p = new URLSearchParams({ round_val: roundVal, round_op: roundOp, category, scope })
    if (stat) p.set('stat', stat)
    if (pos)  p.set('pos', pos)
    return get(`/draft/round_stats?${p}`)
  },

  getTrend: ({ category, stat, agg = 'sum', pos, team, seasonFrom, seasonTo } = {}) => {
    const p = new URLSearchParams({ category, stat, agg })
    if (pos)        p.set('pos', pos)
    if (team)       p.set('team', team)
    if (seasonFrom) p.set('season_from', seasonFrom)
    if (seasonTo)   p.set('season_to', seasonTo)
    return get(`/trends/aggregate?${p}`)
  },
  getTrendMeta: category => get(`/trends/meta/${category}`),
  getTeamBreakdown: ({ category, stat, agg = 'sum', pos, seasonFrom, seasonTo } = {}) => {
    const p = new URLSearchParams({ category, stat, agg })
    if (pos)        p.set('pos', pos)
    if (seasonFrom) p.set('season_from', seasonFrom)
    if (seasonTo)   p.set('season_to', seasonTo)
    return get(`/trends/by_team?${p}`)
  },

  getAdvReceiving: id => get(`/players/${id}/adv_receiving`),

  getPlayerSnaps: (id, season) => {
    const p = new URLSearchParams()
    if (season) p.set('season', season)
    return get(`/players/${id}/snaps?${p}`)
  },

  askQuestion: question => post('/search/natural', { question }),
}
