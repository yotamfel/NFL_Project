import { useState } from 'react'
import { exportTableAsCsv, csvFilename } from '../utils/exportCsv'

function CsvIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

// Reusable CSV download button — place inside a parent with className="relative group"
export function CsvDownloadButton({ columns, rows, title }) {
  return (
    <button
      onClick={() => exportTableAsCsv(columns, rows, csvFilename(title))}
      title="Download as CSV"
      className="absolute top-1 right-1 z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
    >
      <CsvIcon />
    </button>
  )
}

// Generic stats table. columns = [{key, label, format?, desc?}] where:
//   format(value, row) -> string | ReactNode
//   desc -> string shown as hover tooltip on the column header
//   title -> used as CSV filename when export is enabled
export default function StatTable({ columns, rows, keyField = 'id', title }) {
  const [tooltip, setTooltip] = useState(null) // { text, x, y }

  const showTooltip = (e, text) => {
    const r = e.currentTarget.getBoundingClientRect()
    const TW = 224 // w-56
    const x = Math.min(r.left, window.innerWidth - TW - 12)
    setTooltip({ text, x, y: r.bottom + 6 })
  }

  if (!rows.length) {
    return <p className="text-slate-500 text-sm py-4 text-center">No data</p>
  }

  const csvCols = columns.map(({ key, label }) => ({ key, label }))

  return (
    <>
      <div className="relative group">
        {title && (
          <CsvDownloadButton columns={csvCols} rows={rows} title={title} />
        )}
        <div className="scroll-x rounded-lg border border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-400">
                {columns.map(col => (
                  <th key={col.key}
                    className="px-3 py-2 text-left font-medium whitespace-nowrap"
                    onMouseEnter={col.desc ? e => showTooltip(e, col.desc) : undefined}
                    onMouseLeave={col.desc ? () => setTooltip(null) : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.desc && (
                        <span className="text-slate-600 text-xs leading-none select-none cursor-help">ⓘ</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row[keyField] ?? i}
                  className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'} hover:bg-slate-800 transition-colors`}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2 text-slate-200 whitespace-nowrap">
                      {col.format ? col.format(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {tooltip && (
        <div
          style={{ position: 'fixed', top: tooltip.y, left: tooltip.x, zIndex: 9999 }}
          className="pointer-events-none w-56 rounded-lg bg-slate-950 border border-slate-700
            px-3 py-2 text-xs text-slate-300 shadow-xl whitespace-normal leading-relaxed"
        >
          {tooltip.text}
        </div>
      )}
    </>
  )
}
