import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { exportTableAsCsv, csvFilename } from '../utils/exportCsv'
import { useUser } from '../context/UserContext'
import { useAuth } from '../context/AuthContext'
import ProjectPicker from './ProjectPicker'

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

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function TableExportModal({ columns, rows, title, onClose }) {
  const [count, setCount] = useState(Math.min(rows.length, 25))
  const previewRef = useRef(null)
  const sliced = rows.slice(0, count)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDownload = async () => {
    if (!previewRef.current) return
    const fn = csvFilename(title).replace('.csv', '.png')
    const dataUrl = await toPng(previewRef.current, {
      backgroundColor: '#0f172a',
      pixelRatio: window.devicePixelRatio || 1,
    })
    Object.assign(document.createElement('a'), { href: dataUrl, download: fn }).click()
    onClose()
  }

  // Resolve format fn to a plain value for PNG (ReactNodes fallback to raw)
  const cellVal = (col, row) => {
    if (!col.format) return row[col.key] ?? '—'
    const v = col.format(row[col.key], row)
    return (typeof v === 'string' || typeof v === 'number') ? v : (row[col.key] ?? '—')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col gap-4 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Export table as PNG</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors text-2xl leading-none"
          >×</button>
        </div>

        {/* Row count control */}
        <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3">
          <span className="text-slate-400 text-sm font-medium shrink-0">Rows:</span>
          <input
            type="range" min={1} max={rows.length} value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="flex-1 accent-amber-400"
          />
          <input
            type="number" min={1} max={rows.length} value={count}
            onChange={e => setCount(Math.min(rows.length, Math.max(1, Number(e.target.value) || 1)))}
            className="w-16 bg-slate-700 border border-slate-600 text-white text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
          />
          <span className="text-slate-500 text-sm shrink-0">/ {rows.length}</span>
          <button
            onClick={() => setCount(rows.length)}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors shrink-0"
          >All</button>
        </div>

        {/* Preview (this element is captured as PNG) */}
        <div className="overflow-auto flex-1 rounded-xl border border-slate-700/40">
          <div ref={previewRef} style={{ backgroundColor: '#0f172a', padding: 16 }}>
            {title && (
              <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                {title}
              </p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} style={{
                      backgroundColor: '#1e293b', color: '#94a3b8',
                      padding: '8px 12px', textAlign: 'left',
                      fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
                      borderBottom: '1px solid #334155',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sliced.map((row, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#0f172a' : '#0c1524' }}>
                    {columns.map(col => (
                      <td key={col.key} style={{
                        padding: '7px 12px', color: '#e2e8f0',
                        whiteSpace: 'nowrap', borderBottom: '1px solid #1e293b', fontSize: 13,
                      }}>
                        {cellVal(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm"
          >Cancel</button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors"
          >Download PNG</button>
        </div>
      </div>
    </div>
  )
}

// Combined CSV + PNG + Save buttons — place inside a parent with className="relative group"
export function TableExportButtons({ columns, rows, title }) {
  const [modal, setModal] = useState(false)
  const { saveTable, removeTable, isTableSaved } = useUser() || {}
  const { user: tblUser } = useAuth() || {}

  if (!rows?.length) return null

  const csvCols = columns.map(({ key, label }) => ({ key, label }))
  const isSaved = title ? (isTableSaved?.(title) ?? false) : false

  const handleSave = () => {
    if (isSaved) {
      removeTable?.(title)
    } else {
      saveTable?.({
        title,
        columns: csvCols,
        rows,
        sourceUrl: window.location.pathname,
      })
    }
  }

  return (
    <>
      {title && (
        <button
          onClick={handleSave}
          title={isSaved ? 'Remove from saved' : 'Save table'}
          className={`absolute top-1 right-[60px] z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700/60 ${
            isSaved ? 'text-amber-400' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <BookmarkIcon filled={isSaved} />
        </button>
      )}
      {tblUser?.is_admin && title && (
        <div className="absolute top-1 right-[88px] z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProjectPicker type="table" label={title} data={{ title, columns: columns.map(c => ({ key: c.key, label: c.label })), rows: rows.slice(0, 50) }} />
        </div>
      )}
      <button
        onClick={() => setModal(true)}
        title="Download as PNG"
        className="absolute top-1 right-8 z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
      >
        <ImageIcon />
      </button>
      <button
        onClick={() => exportTableAsCsv(csvCols, rows, csvFilename(title))}
        title="Download as CSV"
        className="absolute top-1 right-1 z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
      >
        <CsvIcon />
      </button>
      {modal && (
        <TableExportModal columns={columns} rows={rows} title={title} onClose={() => setModal(false)} />
      )}
    </>
  )
}

// Legacy alias kept for backward compat
export function CsvDownloadButton({ columns, rows, title }) {
  return <TableExportButtons columns={columns} rows={rows} title={title} />
}

// Generic stats table
// columns = [{key, label, format?, desc?}], title = used for export filename + PNG
export default function StatTable({ columns, rows, keyField = 'id', title }) {
  const [tooltip, setTooltip] = useState(null)

  const showTooltip = (e, text) => {
    const r = e.currentTarget.getBoundingClientRect()
    const TW = 224
    const x = Math.min(r.left, window.innerWidth - TW - 12)
    setTooltip({ text, x, y: r.bottom + 6 })
  }

  if (!rows.length) {
    return <p className="text-slate-500 text-sm py-4 text-center">No data</p>
  }

  return (
    <>
      <div className="relative group">
        {title && <TableExportButtons columns={columns} rows={rows} title={title} />}
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
