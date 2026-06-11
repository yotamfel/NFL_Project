import { useState } from 'react'
import { api } from '../api'
import { useUser } from '../context/UserContext'

const EXAMPLES = [
  'Who had the most passing touchdowns between 2015 and 2020?',
  'Top 5 running backs by career rushing yards',
  "What was Tom Brady's career completion percentage?",
  'Show me 2017 draft picks with the highest career AV',
  'Which wide receivers had over 1000 receiving yards in 2022?',
]

export default function NaturalSearch() {
  const [question, setQuestion] = useState('')
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [saved,    setSaved]    = useState(false)
  const { saveSearch } = useUser()

  const ask = async text => {
    const q = (text ?? question).trim()
    if (!q) return
    setQuestion(q); setLoading(true); setError(null); setResult(null); setSaved(false)
    try { setResult(await api.askQuestion(q)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-1">Powered by Claude</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Smart Search</h1>
        <p className="text-slate-400 text-sm mt-1">
          Ask any question about NFL data in English or Hebrew.
        </p>
      </div>

      {/* Search box — violet glow */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask a question about NFL stats…"
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-5 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all"
        />
        <button
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-6 py-3.5 rounded-xl font-semibold transition-colors whitespace-nowrap"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>

      {/* Example chips */}
      <div>
        <p className="text-slate-600 text-xs uppercase tracking-wider mb-2">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(q => (
            <button key={q} onClick={() => ask(q)}
              className="text-xs bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-violet-700/50 rounded-full px-3 py-1.5 transition-colors">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-950/60 border border-rose-800/60 text-rose-300 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-slate-400 text-sm flex items-center gap-2 py-4">
          <svg className="animate-spin w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Translating question and running query…
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={() => { saveSearch(question, result.sql, result.rows); setSaved(true) }}
              disabled={saved}
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors border ${
                saved
                  ? 'border-emerald-700/60 text-emerald-400 bg-emerald-900/30 cursor-default'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-violet-700/40 bg-slate-800/60'
              }`}
            >
              {saved ? '✓ Saved' : '💾 Save result'}
            </button>
          </div>

          <details className="rounded-xl overflow-hidden group border border-slate-800"
            style={{ background: '#0a0a0f' }}>
            <summary className="px-5 py-3 text-sm text-slate-500 cursor-pointer hover:text-slate-300 select-none flex items-center gap-2">
              <span className="text-slate-700 group-open:text-violet-500 transition-colors">▶</span>
              Generated SQL
            </summary>
            <pre className="px-5 pb-4 pt-2 text-xs text-violet-300 font-mono scroll-x border-t border-slate-800">
              {result.sql}
            </pre>
          </details>

          <div className="rounded-xl overflow-hidden border border-slate-700/60"
            style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b2e 100%)' }}>
            <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Results</span>
              <span className="text-xs text-violet-400 font-semibold">{result.rows.length} rows</span>
            </div>
            <div className="scroll-x">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(139,92,246,0.08)' }}>
                    {Object.keys(result.rows[0] ?? {}).map(k => (
                      <th key={k} className="px-4 py-2.5 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-800/60 hover:bg-violet-500/5 transition-colors">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-4 py-2.5 text-slate-200">
                          {typeof v === 'number' ? v.toLocaleString() : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
