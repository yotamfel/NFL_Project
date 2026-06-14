import { useRef } from 'react'
import {
  LineChart, Line,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { exportChartAsPng } from '../utils/exportChart'

const CHART_STYLE = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#cbd5e1' },
}

function InjuryTooltip({ active, payload, label, injuryMap, xKey }) {
  if (!active || !payload?.length) return null
  const season = label
  const missed = injuryMap[season]
  return (
    <div style={{
      backgroundColor: '#1e293b', border: '1px solid #334155',
      borderRadius: '8px', padding: '10px 14px', fontSize: 13,
    }}>
      <p style={{ color: '#94a3b8', marginBottom: missed ? 6 : 4, fontWeight: 600 }}>{season}</p>
      {payload.map(entry => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{entry.value}</span>
        </p>
      ))}
      {missed && (
        <p style={{
          color: '#f87171', marginTop: 8, paddingTop: 8,
          borderTop: '1px solid #334155', fontWeight: 600,
        }}>
          ⚕ {missed} game{missed !== 1 ? 's' : ''} missed
        </p>
      )}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

// lines = [{dataKey, label, color}]
// injuryMap = { season: games_missed } — seasons with 4+ missed games get a red marker
// exportPrefix = prepended to line labels in the exported PNG title (e.g. "Patrick Mahomes — passing")
export function CareerLineChart({ data, xKey, lines, injuryMap = {}, height = 260, exportPrefix }) {
  const wrapperRef = useRef(null)
  const injurySeasons = Object.entries(injuryMap)
    .filter(([, missed]) => missed >= 4)
    .map(([s]) => Number(s))

  const handleExport = () => {
    if (!wrapperRef.current) return
    const statLabel = lines.map(l => l.label).join(' / ')
    const title    = exportPrefix ? `${exportPrefix} — ${statLabel}` : statLabel
    const filename = `${title.replace(/[^a-z0-9 \-—]/gi, '').replace(/\s+/g, '_')}.png`
    exportChartAsPng(wrapperRef.current, title, filename)
  }

  return (
    <div ref={wrapperRef} className="relative group">
      <button
        onClick={handleExport}
        title="Download chart as PNG"
        className="absolute top-1 right-1 z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
      >
        <DownloadIcon />
      </button>
      <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={xKey} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Tooltip content={(props) => <InjuryTooltip {...props} injuryMap={injuryMap} xKey={xKey} />} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        {injurySeasons.map(s => (
          <ReferenceLine key={s} x={s} stroke="#ef4444" strokeOpacity={0.35}
            strokeWidth={8} strokeDasharray={null} />
        ))}
        {lines.map(({ dataKey, label, color }) => (
          <Line
            key={dataKey}
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color || '#3b82f6'}
            strokeWidth={2}
            dot={{ r: 3, fill: color || '#3b82f6' }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </div>
  )
}

// Generic wrapper that adds a hover download button to any chart
export function ExportableChart({ title, filename, children }) {
  const wrapperRef = useRef(null)
  const handleExport = () => {
    if (!wrapperRef.current) return
    const fn = filename
      || `${(title || 'chart').replace(/[^a-z0-9 \-—]/gi, '').replace(/\s+/g, '_')}.png`
    exportChartAsPng(wrapperRef.current, title, fn)
  }
  return (
    <div ref={wrapperRef} className="relative group">
      <button onClick={handleExport} title="Download as PNG"
        className="absolute top-1 right-1 z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-200 hover:bg-slate-700/60">
        <DownloadIcon />
      </button>
      {children}
    </div>
  )
}

// data = [{name, value, color?}, ...] — one entry per player, all for the same metric
export function MetricBarChart({ title, data, colors }) {
  return (
    <ExportableChart title={title}>
      <div className="rounded-xl p-3 border border-slate-700/40" style={{ background: 'rgba(15,23,42,0.7)' }}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }} width={42}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={v => [v?.toLocaleString(), '']}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={60}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ExportableChart>
  )
}

// bars = [{dataKey, label, color}]
export function ComparisonBarChart({ data, xKey, bars }) {
  const title = bars.map(b => b.label).join(' vs ')
  return (
    <ExportableChart title={title}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={xKey} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <Tooltip {...CHART_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          {bars.map(({ dataKey, label, color }) => (
            <Bar key={dataKey} dataKey={dataKey} name={label} fill={color || '#3b82f6'} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ExportableChart>
  )
}
