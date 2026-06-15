import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {['overview', 'visits', 'feedback'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'visits'   && <VisitsTab />}
      {tab === 'feedback' && <FeedbackTab />}
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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl p-5 border ${c.highlight ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'}`}>
          <p className={`text-xs font-medium mb-1 ${c.highlight ? 'text-amber-400' : 'text-slate-400'}`}>{c.label}</p>
          <p className={`text-3xl font-bold ${c.highlight ? 'text-amber-300' : 'text-white'}`}>{c.value.toLocaleString()}</p>
        </div>
      ))}
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
      <h2 className="text-white font-semibold mb-4">Daily Visits — last 90 days</h2>
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

// ── Feedback management ────────────────────────────────────────────────────────
function FeedbackTab() {
  const [items,    setItems]    = useState(null)
  const [filter,   setFilter]   = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [replies,  setReplies]  = useState({})
  const [saving,   setSaving]   = useState({})

  useEffect(() => { api.getAdminFeedback().then(setItems).catch(() => {}) }, [])

  const filtered = (items || []).filter(i => {
    if (filter === 'open')     return !i.resolved
    if (filter === 'resolved') return i.resolved
    return true
  })

  const sendReply = async (id) => {
    const reply = replies[id]?.trim()
    if (!reply) return
    setSaving(s => ({ ...s, [id]: true }))
    try {
      await api.patchAdminFeedback(id, { admin_reply: reply })
      setItems(prev => prev.map(i => i.id === id ? { ...i, admin_reply: reply, replied_at: new Date().toISOString() } : i))
      setReplies(r => { const n = { ...r }; delete n[id]; return n })
    } catch { /* ignore */ }
    finally { setSaving(s => ({ ...s, [id]: false })) }
  }

  const toggleResolved = async (id, resolved) => {
    try {
      await api.patchAdminFeedback(id, { resolved: !resolved })
      setItems(prev => prev.map(i => i.id === id ? { ...i, resolved: !resolved } : i))
    } catch { /* ignore */ }
  }

  if (!items) return <Spinner />

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {['all', 'open', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-slate-500 text-xs self-center">{filtered.length} items</span>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No feedback found.</p>
        )}
        {filtered.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Row header */}
            <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-800/50 transition-colors"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                item.category === 'bug'     ? 'bg-red-500/20 text-red-400' :
                item.category === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                item.category === 'data'    ? 'bg-purple-500/20 text-purple-400' :
                'bg-slate-700 text-slate-300'
              }`}>{item.category}</span>
              <span className="text-slate-300 text-sm font-medium truncate flex-1">{item.username}</span>
              <span className="text-slate-500 text-xs shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${item.resolved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {item.resolved ? 'resolved' : 'open'}
              </span>
              <span className="text-slate-500 text-xs shrink-0">{expanded === item.id ? '▲' : '▼'}</span>
            </button>

            {/* Expanded */}
            {expanded === item.id && (
              <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3">
                <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{item.message}</p>

                {item.admin_reply && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-400 font-medium mb-1">Your reply</p>
                    <p className="text-slate-200 text-sm">{item.admin_reply}</p>
                  </div>
                )}

                {/* Reply box */}
                <div>
                  <textarea
                    placeholder="Reply to this feedback (will notify the user)…"
                    rows={3}
                    value={replies[item.id] ?? ''}
                    onChange={e => setReplies(r => ({ ...r, [item.id]: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => sendReply(item.id)} disabled={saving[item.id] || !replies[item.id]?.trim()}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-lg transition-colors">
                      {saving[item.id] ? 'Sending…' : 'Send Reply'}
                    </button>
                    <button onClick={() => toggleResolved(item.id, item.resolved)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors">
                      Mark as {item.resolved ? 'Open' : 'Resolved'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Loading…</div>
}
