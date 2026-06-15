import { useState } from 'react'

const PLATFORM_URL = 'https://nfl-project-production.up.railway.app'

export default function Share() {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(PLATFORM_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 py-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">FOURTH & DATA</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Share the Platform</h1>
        <p className="text-slate-400 text-sm mt-1">Share this link with anyone — no account needed to browse.</p>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Platform link</p>

        <div className="flex gap-2">
          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-sm font-mono truncate select-all">
            {PLATFORM_URL}
          </div>
          <button onClick={copy}
            className={`shrink-0 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
              copied
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <a href={`https://wa.me/?text=Check out this NFL stats platform: ${PLATFORM_URL}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors border border-slate-700">
            <span>WhatsApp</span>
          </a>
          <a href={`https://twitter.com/intent/tweet?text=Check out this NFL stats platform&url=${PLATFORM_URL}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors border border-slate-700">
            <span>X / Twitter</span>
          </a>
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 text-sm text-slate-400 leading-relaxed">
        <p className="font-semibold text-slate-300 mb-1">What they'll find</p>
        <p>Stats for 18,000+ NFL players from 1970–2025 — career totals, advanced metrics, draft history, combine measurements, and AI-powered natural language search.</p>
      </div>
    </div>
  )
}
