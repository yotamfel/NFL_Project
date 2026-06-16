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
        {['overview', 'visits', 'users', 'feedback', 'sources'].map(t => (
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
      {tab === 'users'    && <UsersTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'sources'  && <SourcesTab />}
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

// ── Users management ──────────────────────────────────────────────────────────
function UsersTab() {
  const { user: me } = useAuth()
  const [users,      setUsers]      = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [deleting,   setDeleting]   = useState({})
  const [search,     setSearch]     = useState('')

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
  const visible = users.filter(u =>
    !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-slate-500 placeholder-slate-600" />
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

// ── Data Sources ───────────────────────────────────────────────────────────────
const SOURCES = [
  {
    name: 'Pro Football Reference (PFR)',
    url: 'pro-football-reference.com',
    badge: 'Historical',
    badgeColor: 'bg-slate-500/20 text-slate-400',
    icon: '🏈',
    coverage: '1970 – 2024 (one-time scrape)',
    sections: [
      {
        title: 'What it is',
        body: 'Pro Football Reference is widely regarded as the most comprehensive and authoritative NFL statistics database available to the public. It is part of the Sports Reference family of sites and has been the go-to resource for journalists, analysts, and researchers for over two decades.',
      },
      {
        title: 'Role in this platform',
        body: 'PFR was used as a one-time historical source to build the foundational dataset — all season statistics from 1970 through 2024, draft records, and combine measurements. It is not an active live dependency. The platform no longer scrapes PFR for ongoing updates; new season data is handled by nflverse.',
      },
      {
        title: 'What we took from it',
        body: 'All passing, rushing, receiving, defense, kicking, punting, and return statistics by season (1970–2024); draft pick records including round, pick, position, and college; combine measurements (height, weight, 40-yard dash, vertical jump, broad jump, bench press, 3-cone, shuttle). PFR\'s Career AV column is stored in the draft table as a legacy field but is no longer used — it has been replaced by our own FDV metric.',
      },
      {
        title: 'Why we moved away from it',
        body: 'PFR data is accessed via web scraping, which is brittle, slow, and subject to rate limits. Their Career AV metric is also opaque — the formula is not fully disclosed and cannot be independently reproduced. Going forward, nflverse provides cleaner, machine-readable, regularly updated data, and FDV replaces AV as the career quality signal.',
      },
    ],
  },
  {
    name: 'nflverse / nflreadpy',
    url: 'nflverse.nflreadr.com',
    badge: 'Primary',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    icon: '📦',
    coverage: '1999 – present',
    sections: [
      {
        title: 'What it is',
        body: 'nflverse is an open-source ecosystem of NFL data maintained by a community of independent developers and data scientists — not affiliated with the NFL or any team. It is the most widely used free NFL data resource in the data science and analytics community. The Python client is called nflreadpy; the R client is nflreadr. Both connect to the same underlying datasets hosted on GitHub.',
      },
      {
        title: 'Who builds it',
        body: 'nflverse is maintained by a small team of volunteer contributors who have built pipelines that pull data from the official NFL API, ESPN feeds, and other public sources, then clean, structure, and publish it as machine-readable datasets updated weekly during the season. Key contributors include Ben Baldwin, Sebastian Carl, and Lee Sharpe, all of whom are well known in the NFL analytics community. The project started around 2019 and grew rapidly as interest in NFL analytics expanded.',
      },
      {
        title: 'Why we need it alongside PFR',
        body: 'PFR is excellent for historical breadth but its data is accessed through web scraping, which is time-consuming and requires significant cleanup. nflverse provides clean, structured, rapidly-updated datasets that are especially strong for recent seasons (2019 onward) and for data types that PFR does not expose in machine-readable form — such as snap counts, week-by-week game logs, and detailed tracking-based metrics. For seasons from 2021 onward in particular, nflverse is the primary mechanism for keeping the platform current without requiring a full re-scrape of PFR each year.',
      },
      {
        title: 'Data it provides to this platform',
        body: 'Through nflreadpy we ingest recent season statistics that supplement the PFR historical base; per-game player logs going back to 1999; snap count percentages by week (how much of each team\'s offensive, defensive, or special teams snaps a player was on the field for); official NFL injury report filings by week and body part; and advanced receiving metrics such as average depth of target, yards after catch, broken tackles, and drop rate.',
      },
    ],
  },
  {
    name: 'FDV — Fourth & Data Value',
    url: '/methodology',
    badge: 'Proprietary',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    icon: '📐',
    coverage: '1970 – present',
    sections: [
      {
        title: 'What it is',
        body: 'FDV (Fourth & Data Value) is a proprietary career value metric built entirely from the statistics in this platform. It replaces PFR\'s Career Approximate Value (AV) as the primary career quality signal — with a fully transparent, independently computed alternative whose formula is completely open.',
      },
      {
        title: 'Why we built it',
        body: 'Career AV is a useful benchmark but it is a third-party metric whose exact formula is not fully disclosed and cannot be independently reproduced. FDV is our answer: every number is traceable to a specific formula and a specific row in our database. The full methodology is documented at /methodology.',
      },
      {
        title: 'How it is computed',
        body: 'For each player-season, a category-specific raw score is computed (passing, offense, defense, kicking, punting, returns). That raw score is then era-normalised via z-score relative to qualified starters in the same year and the same position group — pass rushers compete with pass rushers, coverage players with coverage players. Season FDV = max(0, 6 + 3×z) × game_ratio. Career FDV = sum of season FDVs plus a 10% peak bonus on the top 3 seasons.',
      },
      {
        title: 'Where it appears',
        body: 'FDV is displayed on every player profile page, is the primary career quality signal in Draft Analysis (custom queries, steals/busts, round stats, ranking chart), and is used to rank players on the player landing page. It is updated by running etl/build_fdv.py after any new season data is loaded.',
      },
    ],
  },
  {
    name: 'NFL Next Gen Stats (NGS)',
    url: 'nextgenstats.nfl.com',
    badge: 'Tracking',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    icon: '📡',
    coverage: '2016 – present',
    sections: [
      {
        title: 'What it is',
        body: 'Next Gen Stats is the NFL\'s official player tracking system, operated in partnership with AWS (Amazon Web Services). It uses a network of RFID chips embedded in each player\'s shoulder pads and in the game ball, along with a receiver grid installed in every NFL stadium, to capture player position and movement data 10 times per second during every play of every game.',
      },
      {
        title: 'What makes it unique',
        body: 'Unlike traditional box-score stats, which only measure outcomes (yards gained, touchdowns scored), NGS measures the context and process behind those outcomes. It can tell you how much separation a receiver had from the nearest defender at the exact moment the ball was thrown, how quickly a running back accelerates through the hole, or what percentage of a quarterback\'s passes were thrown into tight windows. This kind of data was previously only available to NFL teams through proprietary systems.',
      },
      {
        title: 'History',
        body: 'The NFL began collecting tracking data in 2016 and started releasing aggregated season-level NGS metrics to the public in 2018. The data became more widely accessible to developers through the nflverse ecosystem, which publishes clean versions of the public NGS datasets. Full granular tracking data (every player\'s exact position on every frame of every play) remains proprietary and is only available to NFL teams and official broadcast partners.',
      },
      {
        title: 'Metrics on this platform',
        body: 'We incorporate NGS data for quarterbacks (time to throw, intended and completed air yards, aggressiveness rate, completion percentage over expectation), running backs (rushing efficiency score, time to reach the line of scrimmage, rush yards over expectation), and wide receivers and tight ends (average separation from the nearest defender, cushion from the corner at the snap, and yards after catch above expectation). All NGS metrics on this platform are available from the 2016 season onward.',
      },
      {
        title: 'AWS partnership',
        body: 'Since 2017 the NFL has partnered with AWS to power NGS infrastructure and to build public-facing analytics products. AWS processes roughly 3TB of data per game from the tracking system. The partnership also funds research into injury prevention, officiating support tools, and broadcast enhancements — making NGS one of the most technologically advanced tracking systems in professional sports.',
      },
    ],
  },
]

function SourcesTab() {
  const [open, setOpen] = useState({})
  const toggle = (sourceIdx, sectionIdx) => {
    const key = `${sourceIdx}-${sectionIdx}`
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-semibold text-lg">Data Sources</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          The platform is built on three external data sources plus our own proprietary FDV metric. PFR provided the historical foundation (one-time scrape); nflverse is the active ongoing source for new season data; NGS provides tracking-based metrics. Career quality is measured by our own FDV, not PFR's Career AV.
        </p>
      </div>

      {SOURCES.map((src, si) => (
        <div key={si} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Source header */}
          <div className="px-6 py-5 border-b border-slate-800 flex items-start gap-4">
            <span className="text-3xl mt-0.5">{src.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-lg">{src.name}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${src.badgeColor}`}>{src.badge}</span>
              </div>
              <p className="text-slate-500 text-xs font-mono">{src.url}</p>
              <p className="text-slate-400 text-sm mt-1">Coverage: <span className="text-slate-300 font-medium">{src.coverage}</span></p>
            </div>
          </div>

          {/* Expandable sections */}
          <div className="divide-y divide-slate-800">
            {src.sections.map((sec, idx) => {
              const key = `${si}-${idx}`
              const isOpen = open[key]
              return (
                <div key={idx}>
                  <button
                    onClick={() => toggle(si, idx)}
                    className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors">
                    <span className="text-slate-200 text-sm font-medium">{sec.title}</span>
                    <span className="text-slate-500 text-xs ml-4 shrink-0">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1">
                      <p className="text-slate-400 text-sm leading-relaxed">{sec.body}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Spinner() {
  return <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Loading…</div>
}
