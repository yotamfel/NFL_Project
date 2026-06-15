export default function Skeleton({ type = 'line', height, rows = 5, cols = 4 }) {
  if (type === 'line') {
    return <div className="h-4 bg-slate-700/60 rounded animate-pulse w-full" />
  }
  if (type === 'block') {
    return <div className={`bg-slate-700/60 rounded-xl animate-pulse w-full`} style={{ height: height ?? 250 }} />
  }
  if (type === 'table') {
    return (
      <div className="space-y-2">
        <div className="h-8 bg-slate-700/60 rounded-lg animate-pulse" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-6 bg-slate-800/80 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    )
  }
  return null
}
