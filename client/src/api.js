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
  searchPlayers: q => get(`/players/search?q=${encodeURIComponent(q)}&limit=10`),
  getPlayer:     id => get(`/players/${id}`),

  compareCareer: (ids, category) =>
    get(`/comparison/career?${ids.map(id => `ids=${encodeURIComponent(id)}`).join('&')}&category=${category}`),
  compareSeason: (ids, category, season) =>
    get(`/comparison/season?${ids.map(id => `ids=${encodeURIComponent(id)}`).join('&')}&category=${category}&season=${season}`),

  getDraftPicks: ({ team, draft_year, pos, limit = 50 } = {}) => {
    const p = new URLSearchParams()
    if (team)       p.set('team', team)
    if (draft_year) p.set('draft_year', draft_year)
    if (pos)        p.set('pos', pos)
    p.set('limit', limit)
    return get(`/draft/picks?${p}`)
  },
  getSteals: () => get('/draft/steals'),
  getBusts:  () => get('/draft/busts'),

  askQuestion: question => post('/search/natural', { question }),
}
