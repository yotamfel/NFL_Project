// All API calls in one place. The Vite dev-server proxy rewrites /api/*
// to http://localhost:8000/* so these work without CORS in development;
// in production the client and server will be served from the same origin.

const BASE = '/api'

// Access token lives in memory (not localStorage) for security.
// AuthContext sets this via setAccessToken() after login/refresh.
let _accessToken = null
let _onUnauthorized = null   // callback set by AuthContext to trigger logout

export function setAccessToken(token) { _accessToken = token }
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn }

async function request(method, path, body, { skipAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (!skipAuth && _accessToken) headers['Authorization'] = `Bearer ${_accessToken}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Network error. Check your connection.')
  }

  if (res.status === 401 && !skipAuth) {
    // Try to refresh the access token once, then retry
    const refreshed = await _tryRefresh()
    if (refreshed) {
      const retryHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_accessToken}` }
      let retry
      try {
        retry = await fetch(`${BASE}${path}`, {
          method, headers: retryHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
      } catch {
        throw new Error('Network error. Check your connection.')
      }
      if (retry.ok) return retry.status === 204 ? null : retry.json()
      const rb = await retry.json().catch(() => ({}))
      throw new Error(rb.detail ?? `${retry.status} ${retry.statusText}`)
    }
    _onUnauthorized?.()
    throw new Error('Session expired. Please log in again.')
  }

  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}

async function _tryRefresh() {
  const rt = localStorage.getItem('nfl_refresh_token')
  if (!rt) return false
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setAccessToken(data.access_token)
    return true
  } catch { return false }
}

const get  = (path, opts) => request('GET',    path, undefined, opts)
const post = (path, body, opts) => request('POST',   path, body, opts)
const patch = (path, body, opts) => request('PATCH',  path, body, opts)
const del   = (path, opts) => request('DELETE', path, undefined, opts)

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (username, email, password) => post('/auth/register', { username, email, password }, { skipAuth: true }),
  login:    (username, password)        => post('/auth/login',    { username, password },         { skipAuth: true }),
  refresh:  (refresh_token)             => post('/auth/refresh',  { refresh_token },               { skipAuth: true }),
  logout:   (refresh_token)             => post('/auth/logout',   { refresh_token }),
  me:       ()                          => get('/auth/me'),

  // ── Preferences ───────────────────────────────────────────────────────────
  updatePreferences: (prefs) => patch('/users/preferences', prefs),

  // ── Saved items ───────────────────────────────────────────────────────────
  getSaved:    ()             => get('/saved'),
  createSaved: (item)         => post('/saved', item),
  updateSaved: (id, note)     => patch(`/saved/${id}`, { note }),
  deleteSaved: (id)           => del(`/saved/${id}`),
  migrateSaved: (items)       => post('/saved/migrate', { items }),
  moveSavedToProject: (id, projectId) => patch(`/saved/${id}/project`, { project_id: projectId }),

  getProjects:     ()             => get('/projects'),
  createProject:   (name)         => post('/projects', { name }),
  renameProject:   (id, name)     => patch(`/projects/${id}`, { name }),
  deleteProject:   (id)           => del(`/projects/${id}`),
  getProjectItems: (id)           => get(`/projects/${id}/items`),

  // ── User feedback ─────────────────────────────────────────────────────────
  submitUserFeedback: (category, message) => post('/feedback', { category, message }),
  getFeedbackMessages: (feedbackId) => get(`/feedback/${feedbackId}/messages`),
  replyToFeedback: (feedbackId, message) => post(`/feedback/${feedbackId}/reply`, { message }),

  // ── Notifications ─────────────────────────────────────────────────────────
  getNotifications:      ()   => get('/notifications'),
  markNotifRead:         (id) => patch(`/notifications/${id}/read`, {}),
  deleteNotification:    (id) => del(`/notifications/${id}`),
  deleteAllNotifications: ()  => del('/notifications'),

  // ── Admin ─────────────────────────────────────────────────────────────────
  getAdminFeedback: ()              => get('/admin/feedback'),
  patchAdminFeedback: (id, body)    => patch(`/admin/feedback/${id}`, body),
  deleteAdminFeedback: (id)         => del(`/admin/feedback/${id}`),
  adminReplyToFeedback: (id, message) => post(`/admin/feedback/${id}/reply`, { message }),
  getAdminVisits: ()                => get('/admin/visits'),
  getAdminStats: ()                 => get('/admin/stats'),
  getAdminAi: ()                    => get('/admin/ai'),
  getAdminUsers: ()                 => get('/admin/users'),
  deleteAdminUser: (id)             => del(`/admin/users/${id}`),

  // ── Players ───────────────────────────────────────────────────────────────
  searchPlayers: (q = '', { pos, season, team, limit = 10 } = {}) => {
    const p = new URLSearchParams({ q, limit })
    if (pos)    p.set('pos', pos)
    if (season) p.set('season', season)
    if (team)   p.set('team', team)
    return get(`/players/search?${p}`)
  },
  getPlayer:         id => get(`/players/${id}`),
  getPopularPlayers: (pos, limit = 10) => {
    const p = new URLSearchParams({ limit })
    if (pos) p.set('pos', pos)
    return get(`/players/popular?${p}`)
  },

  compareCareer: (ids, category, { seasonFrom, seasonTo } = {}) => {
    let url = `/compare?${ids.map(id => `player_ids=${encodeURIComponent(id)}`).join('&')}&category=${category}`
    if (seasonFrom) url += `&season_from=${seasonFrom}`
    if (seasonTo)   url += `&season_to=${seasonTo}`
    return get(url)
  },
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
  getCustomDraft: ({ roundVal, roundOp, statVal, statOp, category = 'fdv', stat, scope = 'career', pos, draftYearFrom, draftYearTo, limit = 50 } = {}) => {
    const p = new URLSearchParams({ round_val: roundVal, round_op: roundOp, stat_val: statVal, stat_op: statOp, category, scope, limit })
    if (pos)           p.set('pos', pos)
    if (stat)          p.set('stat', stat)
    if (draftYearFrom) p.set('draft_year_from', draftYearFrom)
    if (draftYearTo)   p.set('draft_year_to',   draftYearTo)
    return get(`/draft/custom?${p}`)
  },

  topPlayersByStat: (category, stat, { pos, season, min = 0, limit = 20 } = {}) => {
    const p = new URLSearchParams({ category, stat, min, limit })
    if (pos)    p.set('pos', pos)
    if (season) p.set('season', season)
    return get(`/players/top_by_stat?${p}`)
  },

  getSimilarPlayers: (playerId) => get(`/players/${playerId}/similar`),
  scoutQuery: (question) => post('/scout', { question }),
  generateContent: (platform, data, context) => post('/content/generate', { platform, data, context }),

  topPlayersByFdv: ({ pos, limit = 50 } = {}) => {
    const p = new URLSearchParams({ limit })
    if (pos) p.set('pos', pos)
    return get(`/players/top_by_fdv?${p}`)
  },

  getCombinedDraft: (body) => post('/draft/combined', body),

  getDraftRoundStats: ({ roundVal, roundOp, category = 'fdv', stat, scope = 'career', pos, draftYearFrom, draftYearTo } = {}) => {
    const p = new URLSearchParams({ round_val: roundVal, round_op: roundOp, category, scope })
    if (stat)          p.set('stat', stat)
    if (pos)           p.set('pos', pos)
    if (draftYearFrom) p.set('draft_year_from', draftYearFrom)
    if (draftYearTo)   p.set('draft_year_to',   draftYearTo)
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

  getPlayerPlayoffs: id => get(`/players/${id}/playoffs`),
  getAdvReceiving:  id => get(`/players/${id}/adv_receiving`),
  getInjuries: (id, season) => {
    const p = new URLSearchParams()
    if (season) p.set('season', season)
    return get(`/players/${id}/injuries?${p}`)
  },

  getPlayerSnaps: (id, season) => {
    const p = new URLSearchParams()
    if (season) p.set('season', season)
    return get(`/players/${id}/snaps?${p}`)
  },

  getNgsStats: (id, statType) => {
    const p = new URLSearchParams()
    if (statType) p.set('stat_type', statType)
    return get(`/players/${id}/ngs?${p}`)
  },

  askQuestion: question => post('/search/natural', { question }),
  submitFeedback: (log_id, thumbs) => post('/ai/feedback', { log_id, thumbs }),

  getPlayerInsights: id => get(`/players/${id}/insights`),

  getComparisonNarrative: (player_ids, category, season) =>
    post('/compare/narrative', { player_ids, category, season: season || null }),

  getAnomalies: ({ limit = 20, season, alert_type, sort } = {}) => {
    const p = new URLSearchParams({ limit })
    if (season)     p.set('season', season)
    if (alert_type) p.set('alert_type', alert_type)
    if (sort)       p.set('sort', sort)
    return get(`/anomalies?${p}`)
  },

  getAnomalySeasons: () => get('/anomalies/seasons'),

  getMeta: () => get('/meta'),
}
