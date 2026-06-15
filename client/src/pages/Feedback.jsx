import { useState } from 'react'
import { api } from '../api'

const CATEGORIES = [
  { value: 'bug',     label: 'Bug Report',       icon: '🐛' },
  { value: 'feature', label: 'Feature Request',  icon: '💡' },
  { value: 'data',    label: 'Data Issue',        icon: '📊' },
  { value: 'general', label: 'General',           icon: '💬' },
]

export default function Feedback() {
  const [category, setCategory] = useState('general')
  const [message,  setMessage]  = useState('')
  const [status,   setStatus]   = useState(null) // null | 'sending' | 'sent' | 'error'
  const [error,    setError]    = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('sending')
    setError('')
    try {
      await api.submitUserFeedback(category, message.trim())
      setStatus('sent')
      setMessage('')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Feedback</h1>
        <p className="text-slate-400 text-sm mt-1">Help us improve — report bugs, suggest features, or share any thoughts.</p>
      </div>

      {status === 'sent' ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-white font-semibold text-lg mb-1">Thanks for your feedback!</h2>
          <p className="text-slate-400 text-sm mb-4">We'll review it and may reply via notifications.</p>
          <button onClick={() => setStatus(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors">
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">

          {/* Category selector */}
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map(c => (
                <button type="button" key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-colors ${
                    category === c.value
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}>
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-xs">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={6}
              placeholder="Describe your feedback in detail…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-none transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={status === 'sending' || !message.trim()}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-colors">
            {status === 'sending' ? 'Sending…' : 'Send Feedback'}
          </button>
        </form>
      )}
    </div>
  )
}
