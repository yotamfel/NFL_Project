import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Link } from 'react-router-dom'

const TYPE_STYLE = {
  career_high: { label: 'Career High',  bg: '#7c3aed22', border: '#7c3aed44', dot: '#a78bfa' },
  above_avg:   { label: 'Above Avg',   bg: '#15803d22', border: '#15803d44', dot: '#4ade80' },
  below_avg:   { label: 'Below Avg',   bg: '#b91c1c22', border: '#b91c1c44', dot: '#f87171' },
}

const SEV_STARS = { 1: '★', 2: '★★', 3: '★★★' }

function AlertCard({ alert }) {
  const style = TYPE_STYLE[alert.alert_type] ?? TYPE_STYLE.career_high
  return (
    <div className="rounded-xl p-4 space-y-1.5"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: style.dot }} />
          <span className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: style.dot }}>{style.label}</span>
          {alert.severity > 1 && (
            <span className="text-xs" style={{ color: style.dot }}>
              {SEV_STARS[alert.severity]}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-600">{alert.season} season</span>
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
        <span className="text-slate-400">{alert.description?.replace(alert.player_name, '').trim()}</span>
      </p>
    </div>
  )
}

export default function AnomalyFeed({ limit = 12 }) {
  const { data, loading } = useApi(() => api.getAnomalies({ limit }), [limit])

  if (loading) return null
  if (!data || data.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-0.5">Season Highlights</p>
          <h2 className="text-xl font-black text-white tracking-tight">Statistical Anomalies</h2>
        </div>
        <span className="text-xs text-slate-600">{data[0]?.season} season</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.map(a => <AlertCard key={a.id} alert={a} />)}
      </div>
    </div>
  )
}
