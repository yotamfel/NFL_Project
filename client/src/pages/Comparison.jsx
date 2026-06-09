import { useState } from 'react'
import { MOCK_COMPARISON } from '../data/mock'
import StatTable from '../components/StatTable'
import { ComparisonBarChart } from '../components/StatChart'

const PASSING_COLS = [
  { key: 'player_name', label: 'Player' },
  { key: 'g', label: 'Games' },
  { key: 'cmp', label: 'Cmp', format: v => v?.toLocaleString() ?? '—' },
  { key: 'att', label: 'Att', format: v => v?.toLocaleString() ?? '—' },
  { key: 'cmp_pct', label: 'Cmp%', format: (_, r) => r.att ? `${(100 * r.cmp / r.att).toFixed(1)}%` : '—' },
  { key: 'yds', label: 'Yards', format: v => v?.toLocaleString() ?? '—' },
  { key: 'td', label: 'TD', format: v => v?.toLocaleString() ?? '—' },
  { key: 'int', label: 'INT' },
]

const BAR_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444']
const CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']

export default function Comparison() {
  const [category, setCategory] = useState('passing')
  // Stage 8: replace with GET /api/comparison/career?ids=...&category=...
  const data = MOCK_COMPARISON

  // Build bar chart data — one bar group per metric
  const METRICS = [
    { key: 'yds', label: 'Yds' },
    { key: 'td', label: 'TD' },
    { key: 'int', label: 'INT' },
    { key: 'g', label: 'Games' },
  ]
  const chartData = METRICS.map(({ key, label }) => ({
    metric: label,
    ...Object.fromEntries(data.career.map(p => [p.player_name, p[key] ?? 0])),
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Player Comparison</h1>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Player chips */}
      <div className="flex gap-2 flex-wrap">
        {data.players.map((p, i) => (
          <span
            key={p.player_id}
            className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-full px-4 py-1.5 text-sm text-white"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: BAR_COLORS[i] }} />
            {p.player_name}
            <span className="text-slate-400 text-xs">{p.pos}</span>
          </span>
        ))}
        <button className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 border-dashed rounded-full px-4 py-1.5 text-sm text-slate-400 transition-colors">
          + Add player
        </button>
      </div>

      {/* Bar chart */}
      <div className="bg-slate-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Career totals — {category}</h2>
        <ComparisonBarChart
          data={chartData}
          xKey="metric"
          bars={data.players.map((p, i) => ({
            dataKey: p.player_name,
            label: p.player_name,
            color: BAR_COLORS[i],
          }))}
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Head-to-head</h2>
        <StatTable columns={PASSING_COLS} rows={data.career} keyField="player_id" />
      </div>
    </div>
  )
}
