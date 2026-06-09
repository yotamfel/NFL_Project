import { useState } from 'react'
import { MOCK_STEALS, MOCK_BUSTS, MOCK_DRAFT_PICKS } from '../data/mock'
import StatTable from '../components/StatTable'

const DRAFT_COLS = [
  { key: 'draft_year', label: 'Year' },
  { key: 'round', label: 'Rd' },
  { key: 'pick', label: 'Pick' },
  { key: 'player_name', label: 'Player' },
  { key: 'pos', label: 'Pos' },
  { key: 'team', label: 'Team' },
  { key: 'career_av', label: 'Career AV' },
]

const TABS = [
  { id: 'picks', label: 'Draft Picks' },
  { id: 'steals', label: 'Steals' },
  { id: 'busts', label: 'Busts' },
]

export default function DraftAnalysis() {
  const [tab, setTab] = useState('picks')
  const [filters, setFilters] = useState({ year: '', team: '', pos: '' })

  const set = key => e => setFilters(f => ({ ...f, [key]: e.target.value }))

  const filteredPicks = MOCK_DRAFT_PICKS.filter(p => {
    if (filters.year && String(p.draft_year) !== filters.year) return false
    if (filters.team && !p.team.toLowerCase().includes(filters.team.toLowerCase())) return false
    if (filters.pos && !p.pos.toLowerCase().includes(filters.pos.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Draft Analysis</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'picks' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input
              type="number"
              value={filters.year}
              onChange={set('year')}
              placeholder="Year"
              className="w-28 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              value={filters.team}
              onChange={set('team')}
              placeholder="Team (e.g. KAN)"
              className="w-36 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              value={filters.pos}
              onChange={set('pos')}
              placeholder="Position"
              className="w-32 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="bg-slate-800 rounded-2xl p-5">
            <StatTable columns={DRAFT_COLS} rows={filteredPicks} keyField="pick" />
          </div>
        </div>
      )}

      {tab === 'steals' && (
        <div className="space-y-3">
          <div className="bg-slate-800 border border-green-900 rounded-2xl p-4">
            <p className="text-green-400 text-sm font-medium">Steals — Round 4+ picks with Career AV ≥ 50</p>
            <p className="text-slate-400 text-xs mt-1">
              Players whose combine+slot profile significantly under-predicted their career value
            </p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-5">
            <StatTable columns={DRAFT_COLS} rows={MOCK_STEALS} keyField="player_name" />
          </div>
        </div>
      )}

      {tab === 'busts' && (
        <div className="space-y-3">
          <div className="bg-slate-800 border border-red-900 rounded-2xl p-4">
            <p className="text-red-400 text-sm font-medium">Busts — Round 1–2 picks with Career AV ≤ 15</p>
            <p className="text-slate-400 text-xs mt-1">
              High-capital picks whose careers fell far short of what their draft slot predicted
            </p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-5">
            <StatTable columns={DRAFT_COLS} rows={MOCK_BUSTS} keyField="player_name" />
          </div>
        </div>
      )}
    </div>
  )
}
