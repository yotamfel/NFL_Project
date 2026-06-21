import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
         XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { useUser } from '../context/UserContext'
import { useAuth } from '../context/AuthContext'
import AiFeedback from '../components/AiFeedback'
import SocialPostGenerator from '../components/SocialPostGenerator'
import { CsvDownloadButton } from '../components/StatTable'

const EXAMPLES = [
  'Who had the most passing touchdowns between 2015 and 2020?',
  'Top 5 running backs by career rushing yards',
  "What was Tom Brady's career completion percentage?",
  'Show me 2017 draft picks with the highest FDV',
  'Which wide receivers had over 1000 receiving yards in 2022?',
  'QBs with the best FDV who were drafted outside round 1',
  'Defensive players with 50+ career sacks and 10+ interceptions',
  'Top 10 RBs by rushing yards per game since 2015',
]

function InsightChart({ spec }) {
  if (!spec || !spec.data || !spec.x_key || !spec.y_key) return null
  const common = {
    data: spec.data,
    margin: { top: 10, right: 20, left: 0, bottom: 10 },
  }
  const xAxis = <XAxis dataKey={spec.x_key} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
  const yAxis = <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
  const grid  = <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
  const tip   = <RTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />

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

export default function NaturalSearch() {
  const [question, setQuestion] = useState('')
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [saved,    setSaved]    = useState(false)
  const { saveSearch } = useUser()
  const { user } = useAuth()

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
          Ask any question about NFL stats in plain English — get answers, insights, and charts.
        </p>
      </div>

      {/* Search box */}
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
          Analyzing your question…
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* AI Insight */}
          {result.summary && (
            <div className="rounded-2xl border border-violet-500/20 p-5 space-y-2"
              style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b2e 100%)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-500">AI Insight</p>
              <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Chart */}
          {result.chart && <InsightChart spec={result.chart} />}

          {/* Save + Feedback row */}
          <div className="flex items-center justify-between">
            <AiFeedback logId={result.log_id} />
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

          {/* Content Creator (admin only) */}
          {user?.is_admin && result.rows?.length > 0 && (
            <SocialPostGenerator
              data={result.rows}
              context={`Smart Search query: "${question}"`}
            />
          )}

          {/* Data-coverage notice */}
          <div className="flex items-start gap-2 text-xs text-amber-500/70 bg-amber-500/5 border border-amber-500/15 rounded-lg px-4 py-2.5">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>
              Seasonal stats &amp; Draft cover <strong className="text-amber-400/80">1970–2025</strong>.
              Combine data starts 2000. Players who debuted before 1970 have partial coverage.
            </span>
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
            <div className="relative group scroll-x">
              <CsvDownloadButton
                columns={Object.keys(result.rows[0] ?? {}).map(k => ({ key: k, label: k }))}
                rows={result.rows}
                title="Smart Search results"
              />
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
