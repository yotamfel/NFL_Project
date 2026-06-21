import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const PLATFORM_ICONS = { twitter: '𝕏', reddit: '🔴', youtube: '▶' }
const PLATFORM_LABELS = { twitter: 'Twitter/X', reddit: 'Reddit', youtube: 'YouTube' }

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={copy}
      className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function ContentHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items,      setItems]      = useState(null)
  const [expanded,   setExpanded]   = useState(null)
  const [editingId,  setEditingId]  = useState(null)
  const [editText,   setEditText]   = useState('')
  const [confirming, setConfirming] = useState(null)

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api.getContentHistory().then(setItems).catch(() => setItems([]))
  }, [])

  const deleteItem = async (id) => {
    try {
      await api.deleteContent(id)
      setItems(prev => prev.filter(i => i.id !== id))
      if (expanded === id) setExpanded(null)
    } catch { /* ignore */ }
    setConfirming(null)
  }

  const saveEdit = async (id) => {
    try {
      await api.patchContent(id, { content_text: editText })
      setItems(prev => prev.map(i => i.id === id ? { ...i, content_text: editText } : i))
      setEditingId(null)
    } catch { /* ignore */ }
  }

  if (!user?.is_admin) return null
  if (!items) return <div className="text-slate-500 text-sm text-center py-12 animate-pulse">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-0.5">Admin</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Content History</h1>
        <p className="text-slate-400 text-sm mt-1">{items.length} generated posts</p>
      </div>

      {items.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">No content generated yet.</p>
      )}

      <div className="space-y-2">
        {items.map(item => {
          const preview = (item.content_text || '').slice(0, 120)
          const isOpen = expanded === item.id
          return (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : item.id)}>
                <span className="text-lg shrink-0">{PLATFORM_ICONS[item.platform] || '?'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{PLATFORM_LABELS[item.platform] || item.platform}</span>
                    {item.source_context && (
                      <span className="text-xs text-slate-600 truncate">{item.source_context}</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{preview}{item.content_text?.length > 120 ? '…' : ''}</p>
                </div>
                <span className="text-xs text-slate-600 shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
                <span className="text-xs text-slate-600">{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div className="border-t border-slate-800 px-4 py-3 space-y-3">
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <textarea value={editText} onChange={e => setEditText(e.target.value)}
                        rows={6}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500/60 resize-y" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(item.id)}
                          className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{item.content_text}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CopyBtn text={item.content_text} />
                        <button onClick={() => { setEditingId(item.id); setEditText(item.content_text) }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                          Edit
                        </button>
                        {confirming === item.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-xs">Delete?</span>
                            <button onClick={() => deleteItem(item.id)}
                              className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded transition-colors">
                              Yes
                            </button>
                            <button onClick={() => setConfirming(null)}
                              className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirming(item.id)}
                            className="text-xs px-2.5 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
