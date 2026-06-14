import { useState } from 'react'
import { api } from '../api'

export default function AiFeedback({ logId }) {
  const [vote, setVote] = useState(null)

  if (!logId) return null

  const submit = async v => {
    if (vote !== null) return
    setVote(v)
    try { await api.submitFeedback(logId, v) } catch { /* silently ignore */ }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>Was this helpful?</span>
      <button
        onClick={() => submit(1)}
        disabled={vote !== null}
        className={`px-2 py-1 rounded transition-colors ${
          vote === 1
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40'
        }`}
        title="Helpful"
      >
        👍
      </button>
      <button
        onClick={() => submit(-1)}
        disabled={vote !== null}
        className={`px-2 py-1 rounded transition-colors ${
          vote === -1
            ? 'text-rose-400 bg-rose-500/10'
            : 'hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40'
        }`}
        title="Not helpful"
      >
        👎
      </button>
      {vote !== null && <span className="text-slate-600 ml-1">Thanks!</span>}
    </div>
  )
}
