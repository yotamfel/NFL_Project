import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
         XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import SocialPostGenerator from '../components/SocialPostGenerator'

const EXAMPLES = [
  'WRs drafted after round 4 with 1000+ career receiving yards',
  'QBs with the best FDV who were drafted outside round 1',
  'Defensive players with 50+ career sacks and 10+ interceptions',
  'Top 10 RBs by rushing yards per game since 2015',
  'Which undrafted players have the highest FDV?',
]

function ScoutChart({ spec }) {
  if (!spec || !spec.data || !spec.x_key || !spec.y_key) return null
  const common = {
    data: spec.data,
    margin: { top: 10, right: 20, left: 0, bottom: 10 },
  }
  const xAxis = <XAxis dataKey={spec.x_key} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
  const yAxis = <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
  const grid  = <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
  const tip   = <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
      {spec.title && <p className="text-slate-300 text-sm font-semibold mb-3">{spec.title}</p>}
      <ResponsiveContainer width="100%" height={280}>
        {spec.type === 'line' ? (
          <LineChart {...common}>{grid}{xAxis}{yAxis}{tip}
            <Line type="monotone" dataKey={spec.y_key} stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        ) : spec.type === 'scatter' ? (
          <ScatterChart {...common}>{grid}{xAxis}{yAxis}{tip}
            <Scatter dataKey={spec.y_key} fill="#fbbf24" />
          </ScatterChart>
        ) : (
          <BarChart {...common}>{grid}{xAxis}{yAxis}{tip}
            <Bar dataKey={spec.y_key} fill="#60a5fa" radius={[3, 3, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export default function Scout() {
  const [question, setQuestion] = useState('')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const navigate = useNavigate()

  const submit = async (q) => {
    const text = (q || question).trim()
    if (!text) return
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await api.scoutQuery(text)
      setResult(data)
      if (q) setQuestion(q)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-6">

      <button onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Home
      </button>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1">Premium</p>
        <h1 className="text-3xl font-black text-white tracking-tight">AI Scout</h1>
        <p className="text-slate-400 text-sm mt-1">Ask analytical questions about NFL data. Supports complex filters, comparisons, and rankings.</p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Ask an analytical question..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
        />
        <button onClick={() => submit()} disabled={loading || !question.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-6 py-3 rounded-xl text-sm font-bold transition-colors">
          {loading ? '...' : 'Scout'}
        </button>
      </div>

      {/* Example chips */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => submit(ex)}
              className="text-xs bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600 rounded-full px-3 py-1.5 transition-colors">
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm animate-pulse">Analyzing your question...</p>
        </div>
      )}

      {/* Results */}
      {result && !result.cannot_answer && (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4">
              <p className="text-amber-200 text-sm leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Chart */}
          {result.chart && <ScoutChart spec={result.chart} />}

          {/* Results table */}
          {result.results && result.results.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-slate-300 text-sm font-semibold">{result.results.length} results</p>
              </div>
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="border-b border-slate-800">
                      {Object.keys(result.results[0]).map(k => (
                        <th key={k} className="text-left px-3 py-2 text-slate-500 text-xs font-medium whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row, i) => (
                      <tr key={i} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                            {v === null ? '—' : typeof v === 'number' ? v.toLocaleString() : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Social post generator */}
          <SocialPostGenerator data={result.results?.slice(0, 20)} context={question} />

          {/* SQL (collapsible) */}
          {result.sql && (
            <details className="text-xs">
              <summary className="text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">Show generated SQL</summary>
              <pre className="mt-2 bg-black/30 rounded-lg px-4 py-3 text-slate-400 overflow-x-auto">{result.sql}</pre>
            </details>
          )}
        </div>
      )}

      {/* Cannot answer */}
      {result?.cannot_answer && (
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl px-5 py-8 text-center">
          <p className="text-slate-400 text-sm">I couldn't find a way to answer that from the available data.</p>
          {result.reason && <p className="text-slate-600 text-xs mt-1">{result.reason}</p>}
          <p className="text-slate-600 text-xs mt-2">Try rephrasing or asking something more specific.</p>
        </div>
      )}
    </div>
  )
}
