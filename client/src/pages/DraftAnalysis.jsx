import { useState } from 'react'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'

const DRAFT_COLS = [
  { key: 'draft_year',  label: 'Year' },
  { key: 'round',       label: 'Rd' },
  { key: 'pick',        label: 'Pick' },
  { key: 'player_name', label: 'Player' },
  { key: 'pos',         label: 'Pos' },
  { key: 'team',        label: 'Team' },
  { key: 'career_av',   label: 'Career AV' },
]

const TABS = [
  { id: 'picks',  label: 'Draft Picks', icon: '📋' },
  { id: 'steals', label: 'Steals',      icon: '💎' },
  { id: 'busts',  label: 'Busts',       icon: '📉' },
]

export default function DraftAnalysis() {
  const [tab, setTab]       = useState('picks')
  const [filters, setFilters] = useState({ year: '', team: '', pos: '' })
  const set = key => e => setFilters(f => ({ ...f, [key]: e.target.value }))

  const { data: picks,  loading: pl, error: pe } = useApi(
    () => api.getDraftPicks({ draft_year: filters.year || undefined, team: filters.team || undefined, pos: filters.pos || undefined, limit: 100 }),
    [filters.year, filters.team, filters.pos]
  )
  const { data: steals, loading: sl, error: se } = useApi(() => api.getSteals(), [])
  const { data: busts,  loading: bl, error: be } = useApi(() => api.getBusts(),  [])

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">NFL</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Draft Analysis</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? t.id === 'steals' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : t.id === 'busts' ? 'bg-rose-700 text-white shadow-lg shadow-rose-900/40'
                  : 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Draft Picks */}
      {tab === 'picks' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            {[
              { key: 'year', ph: 'Year',     type: 'number', cls: 'w-full sm:w-28' },
              { key: 'team', ph: 'Team',      type: 'text',   cls: 'w-full sm:w-36' },
              { key: 'pos',  ph: 'Position',  type: 'text',   cls: 'w-full sm:w-32' },
            ].map(f => (
              <input key={f.key} type={f.type} value={filters[f.key]} onChange={set(f.key)}
                placeholder={f.ph}
                className={`${f.cls} bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500`} />
            ))}
          </div>
          {pl && <Loading text="Loading picks…" />}
          {pe && <ErrorMsg message={pe} />}
          {picks && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
              <StatTable columns={DRAFT_COLS} rows={picks} keyField="pick" />
            </div>
          )}
        </div>
      )}

      {/* Steals */}
      {tab === 'steals' && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-emerald-900/60"
            style={{ background: 'linear-gradient(135deg, #052e16 0%, #0f172a 100%)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #22c55e, transparent)' }} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💎</span>
                <p className="text-emerald-400 font-bold">Draft Steals</p>
              </div>
              <p className="text-slate-400 text-sm">
                Round 4+ picks with Career AV ≥ 50 — players whose combine profile dramatically under-predicted their career value.
              </p>
            </div>
          </div>
          {sl && <Loading text="Loading steals…" />}
          {se && <ErrorMsg message={se} />}
          {steals && (
            <div className="bg-slate-800/70 border border-emerald-900/40 rounded-2xl p-5">
              <StatTable columns={DRAFT_COLS} rows={steals} keyField="player_name" />
            </div>
          )}
        </div>
      )}

      {/* Busts */}
      {tab === 'busts' && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-rose-900/60"
            style={{ background: 'linear-gradient(135deg, #4c0519 0%, #0f172a 100%)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #f43f5e, transparent)' }} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">📉</span>
                <p className="text-rose-400 font-bold">Draft Busts</p>
              </div>
              <p className="text-slate-400 text-sm">
                Round 1–2 picks with Career AV ≤ 15 — high-capital selections whose careers fell far short of what their draft slot predicted.
              </p>
            </div>
          </div>
          {bl && <Loading text="Loading busts…" />}
          {be && <ErrorMsg message={be} />}
          {busts && (
            <div className="bg-slate-800/70 border border-rose-900/40 rounded-2xl p-5">
              <StatTable columns={DRAFT_COLS} rows={busts} keyField="player_name" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
