import { useState } from 'react'

const EXAMPLES = [
  'Who had the most passing touchdowns between 2015 and 2020?',
  'מי הרבעי גב עם הכי הרבה טאצ׳דאונים בין 2015 ל-2020?',
  'Top 5 running backs by career rushing yards',
  "What was Tom Brady's career completion percentage?",
  'Show me 2017 draft picks with the highest career AV',
]

// Placeholder result — stage 8 replaces this with POST /api/search/natural
const MOCK_RESULT = {
  sql: `SELECT player_name, SUM(td) AS total_td\nFROM passing_seasons\nWHERE season BETWEEN 2015 AND 2020\n  AND pos = 'QB'\nGROUP BY player_id, player_name\nORDER BY total_td DESC\nLIMIT 5`,
  rows: [
    { player_name: 'Russell Wilson', total_td: 195 },
    { player_name: 'Tom Brady', total_td: 171 },
    { player_name: 'Matthew Stafford', total_td: 168 },
    { player_name: 'Drew Brees', total_td: 167 },
    { player_name: 'Aaron Rodgers', total_td: 163 },
  ],
}

export default function NaturalSearch() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const ask = async text => {
    const q = (text ?? question).trim()
    if (!q) return
    setQuestion(q)
    setLoading(true)
    setError(null)
    setResult(null)

    // Stage 8: replace with POST /api/search/natural
    await new Promise(r => setTimeout(r, 700))
    setResult(MOCK_RESULT)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Smart Search</h1>
        <p className="text-slate-400 text-sm">
          Ask any question about NFL data in English or Hebrew — powered by Claude
        </p>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask a question about NFL stats..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-3.5 rounded-xl font-medium transition-colors whitespace-nowrap"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>

      {/* Example chips */}
      <div>
        <p className="text-slate-600 text-xs uppercase tracking-wider mb-2">Examples</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(q => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-full px-3 py-1.5 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* SQL disclosure */}
          <details className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden group">
            <summary className="px-5 py-3 text-sm text-slate-400 cursor-pointer hover:text-slate-200 select-none flex items-center gap-2">
              <span className="text-slate-600 group-open:rotate-90 transition-transform inline-block">▶</span>
              Generated SQL
            </summary>
            <pre className="px-5 pb-4 pt-2 text-xs text-green-400 font-mono overflow-x-auto border-t border-slate-700">
              {result.sql}
            </pre>
          </details>

          {/* Results table */}
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
              <span className="text-xs text-slate-500">{result.rows.length} rows returned</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900">
                    {Object.keys(result.rows[0] ?? {}).map(k => (
                      <th key={k} className="px-4 py-2.5 text-left text-slate-400 font-medium whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-700/50 transition-colors">
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
