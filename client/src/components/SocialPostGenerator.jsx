import { useState } from 'react'
import { api } from '../api'

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X', icon: '𝕏' },
  { id: 'reddit',  label: 'Reddit',    icon: '🔴' },
  { id: 'youtube', label: 'YouTube',   icon: '▶' },
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

export default function SocialPostGenerator({ data, context }) {
  const [open,     setOpen]     = useState(false)
  const [platform, setPlatform] = useState(null)
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const generate = async (p) => {
    setPlatform(p)
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.generateContent(p, data, context)
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-amber-500 hover:text-amber-300 transition-colors font-medium">
        Generate Social Post
      </button>
    )
  }

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-300 text-sm font-semibold">Generate Social Post</p>
        <button onClick={() => { setOpen(false); setResult(null); setPlatform(null) }}
          className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Close</button>
      </div>

      {/* Platform picker */}
      <div className="flex gap-2">
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => generate(p.id)} disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              platform === p.id
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}>
            <span>{p.icon}</span> {p.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-500 text-xs animate-pulse">Generating...</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Twitter result */}
      {result?.platform === 'twitter' && typeof result.content === 'string' && (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
            <p className="text-white text-sm leading-relaxed">{result.content}</p>
            <p className="text-slate-600 text-xs mt-2">{result.content.length}/280</p>
          </div>
          <CopyBtn text={result.content} />
        </div>
      )}

      {/* Reddit result */}
      {result?.platform === 'reddit' && result.content?.title && (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-white text-sm font-bold">{result.content.title}</p>
              <CopyBtn text={result.content.title} />
            </div>
            <div className="border-t border-slate-700/40 pt-2">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{result.content.body}</p>
            </div>
          </div>
          <CopyBtn text={`${result.content.title}\n\n${result.content.body}`} />
        </div>
      )}

      {/* YouTube result */}
      {result?.platform === 'youtube' && result.content?.talking_points && (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
            <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
              {result.content.talking_points.map((p, i) => (
                <li key={i} className="leading-relaxed">{p}</li>
              ))}
            </ol>
          </div>
          <CopyBtn text={result.content.talking_points.map((p, i) => `${i + 1}. ${p}`).join('\n')} />
        </div>
      )}

      {/* Fallback for raw string response */}
      {result && typeof result.content === 'string' && result.platform !== 'twitter' && (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-xl px-4 py-3 border border-slate-700/40">
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{result.content}</p>
          </div>
          <CopyBtn text={result.content} />
        </div>
      )}
    </div>
  )
}
