import { useState } from 'react'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Link, useNavigate } from 'react-router-dom'

const FILTERS = [
  { key: null,              label: 'All' },
  { key: 'game_high',      label: 'Game Highs' },
  { key: 'game_milestone', label: 'Milestones' },
  { key: 'career_high',    label: 'Season Highs' },
  { key: 'yoy_surge',      label: 'YoY Surge' },
  { key: 'efficiency_peak',label: 'Efficiency' },
  { key: 'versatile',      label: 'Versatile' },
  { key: 'above_avg',      label: 'Above Avg' },
  { key: 'below_avg',      label: 'Decline' },
]

const TYPE_STYLE = {
  game_high:       { bg: '#7c2d1222', border: '#7c2d1244', dot: '#fb923c' },
  game_milestone:  { bg: '#17255222', border: '#17255244', dot: '#38bdf8' },
  career_high:     { bg: '#4c1d9522', border: '#4c1d9544', dot: '#a78bfa' },
  above_avg:       { bg: '#14532d22', border: '#14532d44', dot: '#4ade80' },
  below_avg:       { bg: '#7f1d1d22', border: '#7f1d1d44', dot: '#f87171' },
  yoy_surge:       { bg: '#1e3a5f22', border: '#1e3a5f44', dot: '#60a5fa' },
  efficiency_peak: { bg: '#78350f22', border: '#78350f44', dot: '#fbbf24' },
  versatile:       { bg: '#164e6322', border: '#164e6344', dot: '#22d3ee' },
}

const TYPE_LABEL = {
  game_high:       'Game High',
  game_milestone:  'Milestone',
  career_high:     'Season High',
  above_avg:       'Above Avg',
  below_avg:       'Decline',
  yoy_surge:       'YoY Surge',
  efficiency_peak: 'Efficiency',
  versatile:       'Versatile',
}

const SEV_STARS = { 2: '★★', 3: '★★★' }

function AlertCard({ alert }) {
  const style = TYPE_STYLE[alert.alert_type] ?? TYPE_STYLE.career_high
  const label = TYPE_LABEL[alert.alert_type] ?? alert.alert_type
  const isGame = alert.week != null
  return (
    <div className="rounded-xl p-4 space-y-1.5"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: style.dot }} />
          <span className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: style.dot }}>{label}</span>
          {SEV_STARS[alert.severity] && (
            <span className="text-xs" style={{ color: style.dot }}>{SEV_STARS[alert.severity]}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isGame && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ background: style.border, color: style.dot }}>
              Wk {alert.week}{alert.opponent ? ` vs ${alert.opponent}` : ''}
            </span>
          )}
          <span className="text-xs text-slate-600">{alert.season}</span>
        </div>
      </div>
      <p className="text-sm text-slate-200 leading-snug">
        {alert.player_id
          ? <Link to={`/player/${alert.player_id}`}
              className="font-semibold hover:underline" style={{ color: style.dot }}>
              {alert.player_name}
            </Link>
          : <span className="font-semibold" style={{ color: style.dot }}>{alert.player_name}</span>
        }
        {' '}
        <span className="text-slate-400">
          {alert.description?.replace(alert.player_name, '').replace(/^[:\s–-]+/, '').trim()}
        </span>
      </p>
    </div>
  )
}

export default function AnomalyFeed({ limit = 12, compact = false }) {
  const [activeFilter, setActiveFilter] = useState(null)
  const navigate = useNavigate()

  const { data, loading } = useApi(
    () => api.getAnomalies({ limit, alert_type: activeFilter ?? undefined }),
    [activeFilter, limit]
  )

  const season = data?.[0]?.season

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-0.5">Season Highlights</p>
          <h2 className="text-xl font-black text-white tracking-tight">
            Statistical Anomalies
            {season && <span className="text-slate-600 font-normal text-sm ml-2">{season}</span>}
          </h2>
        </div>
        {compact && (
          <button
            onClick={() => navigate('/anomalies')}
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors border border-violet-800 hover:border-violet-600 px-3 py-1.5 rounded-lg"
          >
            View all →
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => {
          const style = f.key ? TYPE_STYLE[f.key] : null
          const active = activeFilter === f.key
          return (
            <button
              key={f.key ?? 'all'}
              onClick={() => setActiveFilter(f.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={active && style
                ? { background: style.bg, border: `1px solid ${style.border}`, color: style.dot }
                : active
                ? { background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }
                : { background: 'transparent', border: '1px solid #334155', color: '#64748b' }
              }
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="text-slate-600 text-sm py-4 text-center animate-pulse">Loading…</div>
      )}

      {!loading && (!data || data.length === 0) && (
        <p className="text-slate-600 text-sm text-center py-4">No alerts for this filter.</p>
      )}

      {!loading && data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}
    </div>
  )
}
