import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const CHART_STYLE = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#cbd5e1' },
}

// lines = [{dataKey, label, color}]
export function CareerLineChart({ data, xKey, lines }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={xKey} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Tooltip {...CHART_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
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
  )
}

// bars = [{dataKey, label, color}]
export function ComparisonBarChart({ data, xKey, bars }) {
  return (
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
  )
}
