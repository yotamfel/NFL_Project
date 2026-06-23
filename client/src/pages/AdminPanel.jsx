import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function AdminPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true })
  }, [user, navigate])

  if (!user?.is_admin) return null

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-slate-400 text-sm mt-0.5">Platform management</p>
        </div>
        <a href="/portfolio" target="_blank" rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors">
          Portfolio Page
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {['overview', 'anecdotes', 'visits', 'users', 'feedback', 'usage'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'anecdotes' && <AnecdoteTab />}
      {tab === 'visits'   && <VisitsTab />}
      {tab === 'users'    && <UsersTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'usage'    && <UsageTab />}
    </div>
  )
}

// ── Overview ───────────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.getAdminStats().then(setStats).catch(() => {}) }, [])
  if (!stats) return <Spinner />
  const cards = [
    { label: 'Total Users',         value: stats.total_users },
    { label: 'Total Visits',        value: stats.total_visits },
    { label: 'Visits Today',        value: stats.visits_today, highlight: true },
    { label: 'Visits (7 days)',     value: stats.visits_7d },
    { label: 'Visits (30 days)',    value: stats.visits_30d },
    { label: 'Total Feedback',      value: stats.total_feedback },
    { label: 'Unresolved Feedback', value: stats.unresolved_feedback },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl p-5 border ${c.highlight ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'}`}>
            <p className={`text-xs font-medium mb-1 ${c.highlight ? 'text-amber-400' : 'text-slate-400'}`}>{c.label}</p>
            <p className={`text-3xl font-bold ${c.highlight ? 'text-amber-300' : 'text-white'}`}>{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-5 border border-cyan-800/40 bg-cyan-900/10">
        <p className="text-xs font-bold text-cyan-400 mb-3">Guest Sessions</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-cyan-300">{stats.guest_sessions_total ?? 0}</p>
            <p className="text-xs text-slate-500">Total sessions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-cyan-300">{stats.guest_sessions_today ?? 0}</p>
            <p className="text-xs text-slate-500">Today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-cyan-300">{stats.guest_sessions_7d ?? 0}</p>
            <p className="text-xs text-slate-500">Last 7 days</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-2">{stats.guest_page_views ?? 0} guest page views total</p>
      </div>
    </div>
  )
}

// ── Visits chart ───────────────────────────────────────────────────────────────
function VisitsTab() {
  const [data, setData] = useState(null)
  useEffect(() => {
    api.getAdminVisits().then(rows => {
      setData([...rows].reverse().map(r => ({ day: String(r.day).slice(5), visits: r.visits })))
    }).catch(() => {})
  }, [])
  if (!data) return <Spinner />
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-4">Daily Visits - last 90 days</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} interval={6} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#f59e0b' }} />
          <Line type="monotone" dataKey="visits" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Users management ──────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'last_visit',   label: 'Last Active' },
  { key: 'visit_count',  label: 'Total Visits' },
  { key: 'visits_7d',    label: 'Visits (7d)' },
  { key: 'created_at',   label: 'Join Date' },
]

function UsersTab() {
  const { user: me } = useAuth()
  const [users,      setUsers]      = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [deleting,   setDeleting]   = useState({})
  const [search,     setSearch]     = useState('')
  const [sortBy,     setSortBy]     = useState('last_visit')

  useEffect(() => { api.getAdminUsers().then(setUsers).catch(() => {}) }, [])

  const deleteUser = async (id) => {
    setDeleting(d => ({ ...d, [id]: true }))
    try {
      await api.deleteAdminUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch { /* ignore */ }
    finally {
      setDeleting(d => ({ ...d, [id]: false }))
      setConfirming(null)
    }
  }

  if (!users) return <Spinner />

  const q = search.toLowerCase()
  const visible = users
    .filter(u => !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sortBy === 'last_visit') {
        const av = a.last_visit ?? '', bv = b.last_visit ?? ''
        return bv > av ? 1 : bv < av ? -1 : 0
      }
      if (sortBy === 'visit_count') return (b.visit_count ?? 0) - (a.visit_count ?? 0)
      if (sortBy === 'visits_7d') return (b.visits_7d ?? 0) - (a.visits_7d ?? 0)
      return (b.created_at ?? '') > (a.created_at ?? '') ? 1 : -1
    })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="flex-1 min-w-40 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-slate-500 placeholder-slate-600" />
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-xs">Sort:</span>
          {SORT_OPTIONS.map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortBy === s.key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-slate-500 text-xs shrink-0">{visible.length} / {users.length}</span>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-slate-400 font-medium">Username</th>
                <th className="px-4 py-3 text-slate-400 font-medium">Email</th>
                <th className="px-4 py-3 text-slate-400 font-medium">Role</th>
                <th className="px-4 py-3 text-slate-400 font-medium">Visits</th>
                <th className="px-4 py-3 text-slate-400 font-medium">7d</th>
                <th className="px-4 py-3 text-slate-400 font-medium">Last Active</th>
                <th className="px-4 py-3 text-slate-400 font-medium">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(u => (
                <tr key={u.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.is_admin
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">admin</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">user</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm font-medium">{u.visit_count ?? 0}</td>
                  <td className="px-4 py-3 text-slate-300 text-sm">{u.visits_7d ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.last_visit ? new Date(u.last_visit).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      confirming === u.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-slate-400 text-xs">Delete {u.username}?</span>
                          <button onClick={() => deleteUser(u.id)} disabled={deleting[u.id]}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">
                            {deleting[u.id] ? '…' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirming(null)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirming(u.id)}
                          className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                          Delete
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Feedback management ────────────────────────────────────────────────────────
function FeedbackTab() {
  const { refreshUnread } = useAuth()
  const [items,      setItems]      = useState(null)
  const [filter,     setFilter]     = useState('open')
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState(null)
  const [threads,    setThreads]    = useState({})
  const [replyText,  setReplyText]  = useState({})
  const [sending,    setSending]    = useState({})
  const [confirming, setConfirming] = useState(null)
  const [deleting,   setDeleting]   = useState({})

  useEffect(() => { api.getAdminFeedback().then(setItems).catch(() => {}) }, [])

  const q = search.toLowerCase()
  const visible = (items || []).filter(i => {
    if (filter === 'open')     { if (i.resolved) return false }
    if (filter === 'resolved') { if (!i.resolved) return false }
    if (q) return i.username.toLowerCase().includes(q) || i.message.toLowerCase().includes(q)
    return true
  })

  const openThread = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!threads[id]) {
      try {
        const msgs = await api.getFeedbackMessages(id)
        setThreads(t => ({ ...t, [id]: msgs }))
      } catch { setThreads(t => ({ ...t, [id]: [] })) }
    }
  }

  const sendReply = async (id) => {
    const msg = replyText[id]?.trim()
    if (!msg) return
    setSending(s => ({ ...s, [id]: true }))
    try {
      await api.adminReplyToFeedback(id, msg)
      const msgs = await api.getFeedbackMessages(id)
      setThreads(t => ({ ...t, [id]: msgs }))
      setReplyText(r => { const n = { ...r }; delete n[id]; return n })
    } catch { /* ignore */ }
    finally { setSending(s => ({ ...s, [id]: false })) }
  }

  const toggleResolved = async (id, resolved) => {
    try {
      await api.patchAdminFeedback(id, { resolved: !resolved })
      setItems(prev => prev.map(i => i.id === id ? { ...i, resolved: !resolved } : i))
      refreshUnread()
    } catch { /* ignore */ }
  }

  const deleteFeedback = async (id) => {
    setDeleting(d => ({ ...d, [id]: true }))
    try {
      await api.deleteAdminFeedback(id)
      setItems(prev => prev.filter(i => i.id !== id))
      if (expanded === id) setExpanded(null)
      refreshUnread()
    } catch { /* ignore */ }
    finally {
      setDeleting(d => ({ ...d, [id]: false }))
      setConfirming(null)
    }
  }

  if (!items) return <Spinner />

  return (
    <div className="space-y-3">
      {/* Filter + search bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {['all', 'open', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {f}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by user or message…"
          className="flex-1 min-w-40 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-500 placeholder-slate-600" />
        <span className="text-slate-500 text-xs shrink-0">{visible.length} items</span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[65vh] pr-1">
        {visible.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No feedback found.</p>
        )}
        {visible.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Row header */}
            <div className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/50 transition-colors">
              <button className="flex items-center gap-3 text-left flex-1 min-w-0"
                onClick={() => openThread(item.id)}>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  item.category === 'bug'     ? 'bg-red-500/20 text-red-400' :
                  item.category === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                  item.category === 'data'    ? 'bg-purple-500/20 text-purple-400' :
                  'bg-slate-700 text-slate-300'
                }`}>{item.category}</span>
                <span className="text-slate-300 text-sm font-medium truncate">{item.username}</span>
                <span className="text-slate-500 text-xs shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${item.resolved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {item.resolved ? 'resolved' : 'open'}
                </span>
                <span className="text-slate-500 text-xs shrink-0">{expanded === item.id ? '▲' : '▼'}</span>
              </button>
              {confirming === item.id ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-400 text-xs">Delete?</span>
                  <button onClick={() => deleteFeedback(item.id)} disabled={deleting[item.id]}
                    className="px-2 py-0.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors">
                    {deleting[item.id] ? '…' : 'Yes'}
                  </button>
                  <button onClick={() => setConfirming(null)}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors">
                    No
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirming(item.id)}
                  className="shrink-0 text-slate-600 hover:text-red-400 text-xs transition-colors px-1">✕</button>
              )}
            </div>

            {/* Chat thread */}
            {expanded === item.id && (
              <div className="border-t border-slate-800">
                {/* Messages */}
                <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
                  {(threads[item.id] ?? []).length === 0 && (
                    <p className="text-slate-600 text-xs text-center py-2">Loading…</p>
                  )}
                  {(threads[item.id] ?? []).map(msg => (
                    <ChatBubble key={msg.id} msg={msg} username={item.username} isAdmin={msg.sender === 'admin'} />
                  ))}
                </div>
                {/* Reply box + controls */}
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Reply (will notify the user)…"
                      rows={2}
                      value={replyText[item.id] ?? ''}
                      onChange={e => setReplyText(r => ({ ...r, [item.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply(item.id) }}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-none"
                    />
                    <button onClick={() => sendReply(item.id)}
                      disabled={sending[item.id] || !replyText[item.id]?.trim()}
                      className="self-end px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-lg transition-colors shrink-0">
                      {sending[item.id] ? '…' : 'Send'}
                    </button>
                  </div>
                  <button onClick={() => toggleResolved(item.id, item.resolved)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    Mark as {item.resolved ? 'Open' : 'Resolved'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatBubble({ msg, username, isAdmin }) {
  const label = isAdmin ? 'You (admin)' : username
  return (
    <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-slate-500 mb-0.5 px-1">{label}</span>
      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
        isAdmin
          ? 'bg-amber-500/20 text-amber-100 rounded-tr-sm'
          : 'bg-slate-700 text-slate-200 rounded-tl-sm'
      }`}>
        {msg.message}
      </div>
      <span className="text-[10px] text-slate-600 mt-0.5 px-1">
        {new Date(msg.created_at).toLocaleString()}
      </span>
    </div>
  )
}

// ── Feature Usage ─────────────────────────────────────────────────────────────
const PAGE_LABELS = {
  players: 'Player Search', profile: 'Player Profile', comparison: 'Compare',
  draft: 'Draft', search: 'Smart Search', trends: 'Trends',
  anomalies: 'Anomalies', saved: 'Saved', guide: 'Guide',
}

function UsageTab() {
  const [data, setData] = useState(null)
  useEffect(() => { api.getFeatureUsage().then(setData).catch(() => {}) }, [])
  if (!data) return <Spinner />

  const totals = data.totals || {}
  const pageViews = data.page_views || []
  const dailyViews = (data.daily_views || []).map(d => ({ day: String(d.day).slice(5), views: d.views }))
  const maxPageTotal = Math.max(...pageViews.map(p => p.total), 1)

  return (
    <div className="space-y-6">
      {/* Top-level totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl p-5 border bg-amber-500/10 border-amber-500/30">
          <p className="text-xs font-medium mb-1 text-amber-400">Page Views</p>
          <p className="text-3xl font-bold text-amber-300">{(totals.total_page_views ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl p-5 border bg-violet-500/10 border-violet-500/30">
          <p className="text-xs font-medium mb-1 text-violet-400">AI Calls</p>
          <p className="text-3xl font-bold text-violet-300">{(totals.total_ai_calls ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl p-5 border border-emerald-800/40 bg-emerald-900/10">
          <p className="text-xs font-medium mb-1 text-emerald-400">AI Thumbs Up</p>
          <p className="text-3xl font-bold text-emerald-300">{totals.thumbs_up ?? 0}</p>
        </div>
        <div className="rounded-xl p-5 border border-red-800/40 bg-red-900/10">
          <p className="text-xs font-medium mb-1 text-red-400">AI Thumbs Down</p>
          <p className="text-3xl font-bold text-red-300">{totals.thumbs_down ?? 0}</p>
        </div>
      </div>

      {/* Page views chart */}
      {pageViews.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Page Popularity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left py-2 pr-4 font-medium">Page</th>
                  <th className="text-right py-2 px-2 font-medium">Today</th>
                  <th className="text-right py-2 px-2 font-medium">7d</th>
                  <th className="text-right py-2 px-2 font-medium">30d</th>
                  <th className="text-right py-2 pl-2 font-medium">Total</th>
                  <th className="py-2 pl-3 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {pageViews.map(p => (
                  <tr key={p.page} className="border-b border-slate-800/40">
                    <td className="py-2.5 pr-4 text-slate-300 font-medium">{PAGE_LABELS[p.page] || p.page}</td>
                    <td className="py-2.5 px-2 text-right text-amber-400 font-semibold">{p.views_today ?? 0}</td>
                    <td className="py-2.5 px-2 text-right text-slate-300">{p.views_7d ?? 0}</td>
                    <td className="py-2.5 px-2 text-right text-slate-400">{p.views_30d ?? 0}</td>
                    <td className="py-2.5 pl-2 text-right text-white font-bold">{p.total}</td>
                    <td className="py-2.5 pl-3">
                      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500/50" style={{ width: `${maxPageTotal > 0 ? (p.total / maxPageTotal) * 100 : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily activity chart */}
      {dailyViews.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Daily Page Views - last 30 days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyViews}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#f59e0b' }} />
              <Bar dataKey="views" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI features breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">AI Features - Last 7 Days</h3>
        {(data.ai_features_7d || []).length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No AI usage in the last 7 days</p>
        ) : (
          <div className="space-y-2">
            {(data.ai_features_7d || []).map(f => (
              <div key={f.feature} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                <span className="text-slate-300 text-sm">{f.feature}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold">{f.count}</span>
                  {f.success_count != null && f.count > 0 && (
                    <span className={`text-xs ${f.success_count === f.count ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {Math.round(100 * f.success_count / f.count)}% success
                    </span>
                  )}
                  {f.avg_ms != null && (
                    <span className="text-slate-500 text-xs">{Math.round(f.avg_ms)}ms</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI features 30 days */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">AI Features - Last 30 Days</h3>
        {(data.ai_features_30d || []).length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No AI usage in the last 30 days</p>
        ) : (
          <div className="space-y-2">
            {(data.ai_features_30d || []).map(f => (
              <div key={f.feature} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                <span className="text-slate-300 text-sm">{f.feature}</span>
                <span className="text-white font-bold">{f.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback by category */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">Feedback by Category</h3>
        {(data.feedback_by_category || []).length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No feedback yet</p>
        ) : (
          <div className="space-y-2">
            {(data.feedback_by_category || []).map(f => (
              <div key={f.category} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                <span className="text-slate-300 text-sm capitalize">{f.category}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold">{f.count}</span>
                  {f.open > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">{f.open} open</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved items */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">Saved Items by Type</h3>
        {(data.saved_by_type || []).length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No saved items yet</p>
        ) : (
          <div className="space-y-2">
            {(data.saved_by_type || []).map(t => (
              <div key={t.type} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                <span className="text-slate-300 text-sm capitalize">{t.type}</span>
                <span className="text-white font-bold">{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Loading...</div>
}


// ── Anecdote Generator ──────────────────────────────────────────────────────

function AnecdoteTab() {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('casual')
  const [anecdotes, setAnecdotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [translation, setTranslation] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)
  const editRef = useRef(null)

  const [calendar, setCalendar] = useState({})
  const [calDate, setCalDate] = useState(null)

  const loadHistory = () => {
    api.getAnecdoteHistory().then(res => {
      setHistory(res.items || res || [])
      setCalendar(res.calendar || {})
    }).catch(() => {})
  }
  useEffect(() => { loadHistory() }, [])

  const generate = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setAnecdotes([]); setSelected(null); setTranslation(null); setFeedback({})
    try {
      const res = await api.generateAnecdotes(query, level)
      setAnecdotes(res.anecdotes || [])
    } catch (e) {
      setError(e.message || 'Generation failed')
    } finally { setLoading(false) }
  }

  const selectAnecdote = (idx) => {
    setSelected(idx)
    setEditing(null)
    setTranslation(null)
    setCopied(false)
  }

  const getDisplayText = (a) => {
    if (a.parts?.length) return a.parts.join('\n\n')
    return a.text
  }

  const copyText = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const translateSelected = async () => {
    if (selected == null) return
    setTranslating(true)
    try {
      const a = anecdotes[selected]
      const text = editing ?? getDisplayText(a)
      const res = await api.translateAnecdote(text)
      setTranslation(res.translation)
    } catch { setTranslation('Translation failed') }
    finally { setTranslating(false) }
  }

  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10))

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const saveSelected = async () => {
    if (selected == null) return
    setSaving(true)
    try {
      const a = anecdotes[selected]
      const original = getDisplayText(a)
      const text = editing ?? original
      const wasEdited = editing != null && editing !== original
      await api.saveAnecdote(query, text, level, 'en', saveDate, wasEdited ? original : null)
      if (translation) {
        await api.saveAnecdote(query, translation, level, 'he', saveDate, null)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      loadHistory()
    } catch (e) {
      alert('Save failed: ' + (e.message || 'Unknown error'))
    } finally { setSaving(false) }
  }

  const giveFeedback = (idx, val) => {
    setFeedback(prev => ({ ...prev, [idx]: val }))
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-slate-900/60 border border-slate-700/30 rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-white font-bold text-sm mb-1">Anecdote Generator</p>
          <p className="text-slate-500 text-xs">Describe a player, event, concept, or anything NFL-related. The AI will find a data-backed anecdote from our database.</p>
        </div>
        <textarea value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate() } }}
          placeholder='e.g. "Patrick Mahomes clutch moments", "best rookie QB seasons ever", "teams that improved the most in 2024"...'
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/60 resize-none placeholder-slate-600" />
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            {['casual', 'deep'].map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${level === l ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {l === 'casual' ? '☕ Casual' : '🔬 Deep'}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={loading || !query.trim()}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-sm transition-colors">
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Results */}
      {anecdotes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Choose an anecdote:</p>
          {anecdotes.map((a, i) => {
            const text = getDisplayText(a)
            const isSelected = selected === i
            const fb = feedback[i]
            return (
              <div key={i} className={`rounded-xl border p-4 transition-all cursor-pointer ${isSelected ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-700/40 bg-slate-900/40 hover:border-slate-600'}`}
                onClick={() => selectAnecdote(i)}>
                <div className="flex justify-between items-start gap-3">
                  <p className="text-slate-200 text-sm whitespace-pre-wrap flex-1">{text}</p>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); giveFeedback(i, 1) }}
                      className={`text-sm px-1.5 py-0.5 rounded transition-colors ${fb === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}>👍</button>
                    <button onClick={e => { e.stopPropagation(); giveFeedback(i, -1) }}
                      className={`text-sm px-1.5 py-0.5 rounded transition-colors ${fb === -1 ? 'bg-red-500/20 text-red-400' : 'text-slate-600 hover:text-red-400'}`}>👎</button>
                  </div>
                </div>
                {a.parts?.length > 1 && <p className="text-[10px] text-slate-600 mt-1">Thread: {a.parts.length} parts</p>}
                {text.length <= 280 && <p className="text-[10px] text-slate-600 mt-1">{text.length}/280</p>}
              </div>
            )
          })}
          <button onClick={generate} disabled={loading} className="text-xs text-slate-500 hover:text-amber-400 transition-colors">
            {loading ? 'Generating...' : '↻ Generate 3 new options'}
          </button>
        </div>
      )}

      {/* Selected anecdote actions */}
      {selected != null && (
        <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-amber-400">SELECTED ANECDOTE</p>

          {/* Edit area */}
          {editing != null ? (
            <textarea ref={editRef} value={editing} onChange={e => setEditing(e.target.value)}
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/60 resize-none" />
          ) : (
            <p className="text-slate-200 text-sm whitespace-pre-wrap">{getDisplayText(anecdotes[selected])}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {editing != null ? (
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-colors">Done editing</button>
            ) : (
              <button onClick={() => setEditing(getDisplayText(anecdotes[selected]))} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-colors">Edit</button>
            )}
            <button onClick={() => copyText(editing ?? getDisplayText(anecdotes[selected]))}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-colors">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button onClick={translateSelected} disabled={translating}
              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-xs hover:bg-blue-500/20 transition-colors">
              {translating ? 'Translating...' : '🇮🇱 Also in Hebrew'}
            </button>
            <input type="date" value={saveDate} onChange={e => setSaveDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-xs" />
            <button onClick={saveSelected} disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'}`}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : `💾 Save for ${saveDate}`}
            </button>
          </div>

          {/* Hebrew translation */}
          {translation && (
            <div className="bg-slate-800/60 border border-blue-500/20 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-blue-400">HEBREW VERSION</p>
              <p className="text-slate-200 text-sm whitespace-pre-wrap" dir="rtl">{translation}</p>
              <button onClick={() => copyText(translation)}
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors">Copy Hebrew</button>
            </div>
          )}
        </div>
      )}

      {/* History with calendar */}
      <div className="bg-slate-900/60 border border-slate-700/30 rounded-2xl p-5 space-y-4">
        <p className="text-white font-bold text-sm">Saved Anecdotes</p>

        {/* Calendar strip */}
        {Object.keys(calendar).length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setCalDate(null)}
                className={`px-2.5 py-1 rounded text-[10px] ${!calDate ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                All ({history.length})
              </button>
              {Object.entries(calendar).sort(([a], [b]) => b.localeCompare(a)).map(([date, count]) => (
                <button key={date} onClick={() => setCalDate(date)}
                  className={`px-2.5 py-1 rounded text-[10px] ${calDate === date ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  {date.slice(5)} <span className="text-slate-600">({count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtered list */}
        {(() => {
          const filtered = calDate
            ? history.filter(h => h.created_at?.startsWith(calDate))
            : history
          return filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map(h => {
                const d = typeof h.data === 'string' ? JSON.parse(h.data) : h.data
                const schedDate = d.scheduled_date
                return (
                  <div key={h.id} className="bg-slate-800/40 border border-slate-700/20 rounded-lg p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="flex gap-2 text-[10px] text-slate-600 mb-1">
                          <span>{h.label}</span>
                          <span>{d.level}</span>
                          <span>{d.language === 'he' ? '🇮🇱' : '🇺🇸'}</span>
                          {schedDate && <span className="text-amber-500/70">📅 {schedDate}</span>}
                        </div>
                        <p className="text-slate-300 text-xs whitespace-pre-wrap" dir={d.language === 'he' ? 'rtl' : 'ltr'}>{d.text}</p>
                      </div>
                      <button onClick={() => copyText(d.text)} className="text-[10px] text-slate-600 hover:text-amber-400 shrink-0">Copy</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-slate-600 text-xs">No anecdotes {calDate ? `for ${calDate}` : 'saved yet'}</p>
        })()}
      </div>
    </div>
  )
}
