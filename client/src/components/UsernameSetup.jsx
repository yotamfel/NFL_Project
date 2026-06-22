import { useState } from 'react'
import { useUser } from '../context/UserContext'

export default function UsernameSetup() {
  const { setUser } = useUser()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    const name = input.trim()
    if (!name) { setError('Please enter a username.'); return }
    if (name.length < 2) { setError('At least 2 characters.'); return }
    setUser(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' }}>

        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24, transparent)' }} />

        <div className="p-8 text-center">
          <div className="text-4xl mb-4">🏈</div>
          <h2 className="text-2xl font-black text-white mb-1">
            <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">NFL DATA</span>
          </h2>
          <p className="text-slate-400 text-sm mb-6">Choose a username to save your discoveries.</p>

          <input
            autoFocus
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && confirm()}
            placeholder="e.g. John"
            maxLength={30}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors mb-3"
          />

          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <button
            onClick={confirm}
            disabled={!input.trim()}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-black py-3 rounded-xl transition-colors"
          >
            Let's go
          </button>

          <p className="text-slate-700 text-xs mt-4">
            No account needed - everything stays in your browser.
          </p>
        </div>
      </div>
    </div>
  )
}
