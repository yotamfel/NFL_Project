import { useState } from 'react'
import { api } from '../api'

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X', icon: '𝕏', desc: 'Single tweet, max 280 chars' },
  { id: 'reddit',  label: 'Reddit',    icon: '🔴', desc: 'Title + analytical discussion post' },
  { id: 'youtube', label: 'YouTube',   icon: '▶', desc: '5 talking points for a video script' },
]

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
      className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0">
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function contentToText(result) {
  if (!result) return ''
  const c = result.content
  if (typeof c === 'string') return c
  if (c?.title && c?.body) return `${c.title}\n\n${c.body}`
  if (c?.talking_points) return c.talking_points.map((p, i) => `${i + 1}. ${p}`).join('\n')
  return JSON.stringify(c, null, 2)
}

export default function SocialPostGenerator({ data, context }) {
  const [open,     setOpen]     = useState(false)
  const [platform, setPlatform] = useState(null)
  const [language, setLanguage] = useState('English')
  const [customLang, setCustomLang] = useState('')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [editing,  setEditing]  = useState(false)
  const [editText, setEditText] = useState('')
  const [regenCount, setRegenCount] = useState(0)
  const [regenLoading, setRegenLoading] = useState(false)

  const effectiveLang = customLang.trim() || language

  const generate = async (p) => {
    setPlatform(p)
    setLoading(true); setError(null); setResult(null); setEditing(false)
    setRegenCount(0)
    const langCtx = effectiveLang !== 'English' ? ` (write in ${effectiveLang})` : ''
    try {
      const res = await api.generateContent(p, data, context + langCtx)
      setResult(res)
      setEditText(contentToText(res))
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  const regenerate = async () => {
    if (!result?.id || regenCount >= 3) return
    setRegenLoading(true); setError(null)
    try {
      const res = await api.patchContent(result.id, { regenerate: true })
      const parsed = typeof res.content_text === 'string' ? res.content_text : JSON.stringify(res.content_text)
      setResult(prev => ({ ...prev, content: tryParseJson(parsed, platform), id: res.id }))
      setEditText(parsed)
      setRegenCount(res.regenerate_count ?? regenCount + 1)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Regeneration failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const saveEdit = async () => {
    if (!result?.id) return
    try {
      await api.patchContent(result.id, { content_text: editText })
      setEditing(false)
    } catch { /* ignore */ }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-amber-500 hover:text-amber-300 transition-colors font-medium">
        Content Creator
      </button>
    )
  }

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-300 text-sm font-semibold">Content Creator</p>
        <button onClick={() => { setOpen(false); setResult(null); setPlatform(null); setEditing(false) }}
          className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Close</button>
      </div>

      {/* Language selection */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Language:</span>
        <button onClick={() => { setLanguage('English'); setCustomLang('') }}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            !customLang && language === 'English'
              ? 'bg-slate-700 border-slate-600 text-white'
              : 'border-slate-700 text-slate-500 hover:text-slate-300'
          }`}>English</button>
        <input value={customLang} onChange={e => setCustomLang(e.target.value)}
          placeholder="Other language…"
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1 w-32 focus:outline-none focus:border-slate-500 placeholder-slate-600" />
      </div>

      {/* Platform picker */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => generate(p.id)} disabled={loading || regenLoading}
            className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              platform === p.id
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}>
            <span className="flex items-center gap-1.5">{p.icon} {p.label}</span>
            <span className="text-[10px] text-slate-600 font-normal">{p.desc}</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-500 text-xs animate-pulse">Generating...</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-2">
          {editing ? (
            <div className="space-y-2">
              <textarea value={editText} onChange={e => setEditText(e.target.value)}
                rows={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500/60 resize-y" />
              <div className="flex gap-2">
                <button onClick={saveEdit}
                  className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors">
                  Save
                </button>
                <button onClick={() => { setEditing(false); setEditText(contentToText(result)) }}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <ContentDisplay result={result} />
              <div className="flex items-center gap-2 flex-wrap">
                <CopyBtn text={contentToText(result)} />
                <button onClick={() => setEditing(true)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                  Edit
                </button>
                <button onClick={regenerate} disabled={regenCount >= 3 || regenLoading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-40"
                  title={regenCount >= 3 ? 'Regeneration limit reached (3/3)' : `Regenerate (${regenCount}/3)`}>
                  {regenLoading ? '...' : `Regenerate (${regenCount}/3)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function tryParseJson(text, platform) {
  if (platform === 'twitter') return text
  try { return JSON.parse(text) }
  catch { return text }
}

function ContentDisplay({ result }) {
  const c = result.content
  if (result.platform === 'twitter' && typeof c === 'string') {
    return (
      <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
        <p className="text-white text-sm leading-relaxed">{c}</p>
        <p className="text-slate-600 text-xs mt-2">{c.length}/280</p>
      </div>
    )
  }
  if (result.platform === 'reddit' && c?.title) {
    return (
      <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40 space-y-2">
        <p className="text-white text-sm font-bold">{c.title}</p>
        <div className="border-t border-slate-700/40 pt-2">
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{c.body}</p>
        </div>
      </div>
    )
  }
  if (result.platform === 'youtube' && c?.talking_points) {
    return (
      <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          {c.talking_points.map((p, i) => (
            <li key={i} className="leading-relaxed">{p}</li>
          ))}
        </ol>
      </div>
    )
  }
  return (
    <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
        {typeof c === 'string' ? c : JSON.stringify(c, null, 2)}
      </p>
    </div>
  )
}
