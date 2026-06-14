import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'

const fmt = v => v != null ? Number(v).toLocaleString() : '—'
const fmtMs = v => v != null ? `${Number(v).toLocaleString()}ms` : '—'
const fmtDate = s => s ? new Date(s).toLocaleString() : '—'

const FEATURE_LABEL = {
  nl_search:              'Smart Search',
  player_insight:         'Player Insights',
  comparison_narrative:   'Comparison Narrative',
}

export default function AdminAi() {
  const { data, loading, error } = useApi(() => api.getAdminAi(), [])

  if (loading) return <Loading text="Loading admin data…" />
  if (error)   return <ErrorMsg message={error} />
  if (!data)   return null

  const { feature_stats, daily_volume, recent_logs, anomaly_stats } = data

  const totalTokens = feature_stats.reduce((s, r) => s + (r.total_tokens ?? 0), 0)
  const totalQueries = feature_stats.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalUp   = feature_stats.reduce((s, r) => s + (r.thumbs_up ?? 0), 0)
  const totalDown = feature_stats.reduce((s, r) => s + (r.thumbs_down ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-1">Internal</p>
        <h1 className="text-3xl font-black text-white tracking-tight">AI Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Last 30 days</p>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Queries', value: fmt(totalQueries) },
          { label: 'Total Tokens',  value: fmt(totalTokens) },
          { label: 'Thumbs Up',    value: fmt(totalUp) },
          { label: 'Thumbs Down',  value: fmt(totalDown) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Feature breakdown */}
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-4">By Feature</h2>
        <div className="scroll-x">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                {['Feature','Total','Success','Errors','Avg ms','Tokens','👍','👎'].map(h => (
                  <th key={h} className="py-2 pr-4 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feature_stats.map(r => (
                <tr key={r.feature} className="border-t border-slate-800/60">
                  <td className="py-2 pr-4 font-semibold text-violet-300">{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                  <td className="py-2 pr-4 text-slate-200">{fmt(r.total)}</td>
                  <td className="py-2 pr-4 text-emerald-400">{fmt(r.success_count)}</td>
                  <td className="py-2 pr-4 text-rose-400">{fmt(r.error_count)}</td>
                  <td className="py-2 pr-4 text-slate-400">{fmtMs(r.avg_ms)}</td>
                  <td className="py-2 pr-4 text-slate-400">{fmt(r.total_tokens)}</td>
                  <td className="py-2 pr-4 text-emerald-400">{fmt(r.thumbs_up)}</td>
                  <td className="py-2 pr-4 text-rose-400">{fmt(r.thumbs_down)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily volume */}
      {daily_volume.length > 0 && (
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
          <h2 className="text-white font-bold mb-4">Daily Volume (14 days)</h2>
          <div className="flex items-end gap-1.5 h-20">
            {daily_volume.map(d => {
              const max = Math.max(...daily_volume.map(x => x.queries), 1)
              const pct = (d.queries / max) * 100
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.queries}`}>
                  <div className="w-full rounded-t bg-violet-500/60" style={{ height: `${pct}%`, minHeight: 2 }} />
                  <span className="text-slate-600 text-xs" style={{ fontSize: 9 }}>
                    {String(d.day).slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Anomaly stats */}
      {anomaly_stats.length > 0 && (
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
          <h2 className="text-white font-bold mb-4">Anomaly Alerts by Season</h2>
          <div className="scroll-x">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  {['Season','Total','Career Highs','YoY Surge','Efficiency','Versatile','Above Avg','Below Avg'].map(h => (
                    <th key={h} className="py-2 pr-4 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomaly_stats.map(r => (
                  <tr key={r.season} className="border-t border-slate-800/60">
                    <td className="py-2 pr-4 font-semibold text-slate-200">{r.season}</td>
                    <td className="py-2 pr-4 text-slate-300">{fmt(r.total)}</td>
                    <td className="py-2 pr-4 text-violet-400">{fmt(r.career_highs)}</td>
                    <td className="py-2 pr-4 text-blue-400">{fmt(r.yoy_surge)}</td>
                    <td className="py-2 pr-4 text-amber-400">{fmt(r.efficiency_peak)}</td>
                    <td className="py-2 pr-4 text-cyan-400">{fmt(r.versatile)}</td>
                    <td className="py-2 pr-4 text-emerald-400">{fmt(r.above_avg)}</td>
                    <td className="py-2 pr-4 text-rose-400">{fmt(r.below_avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent logs */}
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-4">Recent Queries</h2>
        <div className="scroll-x">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                {['Time','Feature','Input','Tokens','ms','OK','Thumbs'].map(h => (
                  <th key={h} className="py-2 pr-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent_logs.map(r => (
                <tr key={r.id} className="border-t border-slate-800/40">
                  <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="py-1.5 pr-3 text-violet-400">{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                  <td className="py-1.5 pr-3 text-slate-300 max-w-xs truncate">{r.input_preview ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{fmt(r.tokens_used)}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{fmtMs(r.response_ms)}</td>
                  <td className="py-1.5 pr-3">
                    {r.success
                      ? <span className="text-emerald-400">✓</span>
                      : <span className="text-rose-400" title={r.error_msg}>✗</span>}
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.thumbs === 1 ? '👍' : r.thumbs === -1 ? '👎' : <span className="text-slate-700">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
