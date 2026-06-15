import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { GridLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useUser } from '../context/UserContext'
import { CareerLineChart } from '../components/StatChart'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 60

const DEFAULT_SIZE = {
  chart:   { w: 6, h: 4 },
  table:   { w: 6, h: 4 },
  heading: { w: 6, h: 1 },
  text:    { w: 4, h: 1 },
}

const DEFAULT_CANVAS_BG  = '#020617'
const DEFAULT_WIDGET_BG  = '#0f172a'
const DEFAULT_HEADER_COL = '#1e293b'
const DEFAULT_ROW_EVEN   = '#0f172a99'
const DEFAULT_ROW_ODD    = 'transparent'

const CANVAS_PRESETS = [
  { label: 'Night',  color: '#020617' },
  { label: 'Slate',  color: '#0f172a' },
  { label: 'Navy',   color: '#0c1a3a' },
  { label: 'Forest', color: '#0a1f14' },
  { label: 'Wine',   color: '#1a0a12' },
  { label: 'Gray',   color: '#18181b' },
  { label: 'Light',  color: '#e2e8f0' },
  { label: 'White',  color: '#ffffff' },
]

const HANDLE_CSS = `
  .react-grid-item .react-resizable-handle {
    opacity: 0.35; transition: opacity 0.15s;
    background-color: rgba(148,163,184,0.7); border-radius: 4px;
  }
  .react-grid-item:hover .react-resizable-handle { opacity: 0.75; }
  .react-grid-item .react-resizable-handle:hover { opacity: 1 !important; background-color: rgba(251,191,36,0.95) !important; }

  .react-resizable-handle-n, .react-resizable-handle-s {
    left: 50% !important; width: 60px !important; height: 10px !important;
    margin-left: -30px !important; background-image: none !important; padding: 0 !important;
  }
  .react-resizable-handle-n { top: 0 !important; transform: none !important; }
  .react-resizable-handle-s { bottom: 0 !important; transform: none !important; }
  .react-resizable-handle-e, .react-resizable-handle-w {
    top: 50% !important; height: 60px !important; width: 10px !important;
    margin-top: -30px !important; background-image: none !important; padding: 0 !important;
  }
  .react-resizable-handle-e { right: 0 !important; transform: none !important; }
  .react-resizable-handle-w { left: 0 !important; transform: none !important; }
  .react-resizable-handle-se,.react-resizable-handle-sw,
  .react-resizable-handle-ne,.react-resizable-handle-nw {
    width: 14px !important; height: 14px !important;
    padding: 0 !important; background-size: 10px !important;
  }
`

// ─── Chart live renderer ──────────────────────────────────────────────────────
function ChartRenderer({ savedChart, colorOverrides = {}, showInjuries = true }) {
  if (!savedChart) return null
  const { chartType, config, data } = savedChart
  const lines = (config.lines || []).map(l => ({ ...l, color: colorOverrides[l.dataKey] || l.color }))

  if (chartType === 'CareerLine') {
    return <CareerLineChart data={data} xKey={config.xKey || 'season'} lines={lines}
      injuryMap={showInjuries ? (config.injuryMap || {}) : {}} fill hideActions />
  }
  if (chartType === 'GenericLine' && config.lines) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={config.xKey || 'x'} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {config.lines.map(l => (
            <Line key={l.dataKey} type="monotone" dataKey={l.dataKey} name={l.label}
              stroke={colorOverrides[l.dataKey] || l.color || '#3b82f6'} strokeWidth={2} dot={{ r: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (chartType === 'GenericBar' && config.bars) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={config.xKey || 'x'} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {config.bars.map(b => (
            <Bar key={b.dataKey} dataKey={b.dataKey} name={b.label}
              fill={colorOverrides[b.dataKey] || b.color || '#3b82f6'} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return <div className="text-slate-500 text-sm p-4">Unsupported chart type</div>
}

// ─── Table live renderer ──────────────────────────────────────────────────────
function TableRenderer({ savedTable, config = {} }) {
  if (!savedTable?.columns?.length) return <div className="text-slate-600 text-sm p-4">Table not found</div>
  const { columns, rows } = savedTable
  const headerBg = config.headerColor || DEFAULT_HEADER_COL
  const rowEven  = config.rowEvenColor || DEFAULT_ROW_EVEN
  const rowOdd   = config.rowOddColor  || DEFAULT_ROW_ODD
  return (
    <div className="overflow-auto h-full text-xs">
      <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-2 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap sticky top-0"
                style={{ backgroundColor: headerBg }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).slice(0, 60).map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? rowEven : rowOdd }}>
              {columns.map(col => (
                <td key={col.key} className="px-2 py-1 text-slate-300 whitespace-nowrap border-t border-slate-800">
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(rows?.length || 0) > 60 && (
        <p className="text-slate-500 text-xs p-2 text-center">+{rows.length - 60} more rows</p>
      )}
    </div>
  )
}

const TEXT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96]

// ─── Widget wrapper ───────────────────────────────────────────────────────────
function WidgetWrapper({ widget, savedItem, onDelete, onUpdateConfig, isSelected, onSelect }) {
  const cardRef = useRef(null)   // ref on the FULL card — captured PNG includes frame+title
  const [capturing, setCapturing] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const [localContent, setLocalContent] = useState(widget.config.content || '')
  const { config, type } = widget

  const commitText = () => { setEditingText(false); onUpdateConfig({ content: localContent }) }

  // Capture the full card as PNG (includes frame + title bar).
  // When displaying, we show the PNG fullscreen with no outer wrapper,
  // so the frame appears exactly once.
  useEffect(() => {
    if (type !== 'chart' && type !== 'table') return
    if (config.snapshot) return
    if (!savedItem) return

    setCapturing(true)
    const delay = type === 'table' ? 400 : 1600
    const t = setTimeout(async () => {
      const el = cardRef.current
      if (!el) { setCapturing(false); return }
      try {
        const png = await toPng(el, { pixelRatio: 2 })
        onUpdateConfig({ snapshot: png })
      } catch (e) {
        console.warn('Widget snapshot failed:', e)
      } finally {
        setCapturing(false)
      }
    }, delay)
    return () => { clearTimeout(t); setCapturing(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, config.snapshot, savedItem?.title])

  // ── Snapshot display: PNG fills the slot fullscreen (frame is inside the PNG) ──
  if ((type === 'chart' || type === 'table') && config.snapshot) {
    return (
      <div className="drag-handle h-full relative group" onClick={onSelect}>
        {isSelected && (
          <div className="absolute inset-0 ring-2 ring-amber-500/60 rounded-xl pointer-events-none z-10" />
        )}
        <img
          src={config.snapshot}
          alt={savedItem?.title || type}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', borderRadius: '12px' }}
        />
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-slate-900/80 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
        >×</button>
      </div>
    )
  }

  // ── Text / heading ────────────────────────────────────────────────────────────
  if (type === 'heading' || type === 'text') {
    const defaultFs = type === 'heading' ? 24 : 14
    const fontSize  = config.fontSize || defaultFs
    const textColor = config.textColor || (type === 'heading' ? '#ffffff' : '#cbd5e1')
    const bgColor   = config.bgColor || 'transparent'

    return (
      <div className="drag-handle relative h-full group cursor-grab active:cursor-grabbing rounded-lg overflow-visible"
        style={{ backgroundColor: bgColor }} onClick={onSelect}>
        {isSelected && <div className="absolute inset-0 ring-2 ring-amber-500/50 rounded-lg pointer-events-none z-10" />}

        {/* Inline formatting toolbar — visible when selected */}
        {isSelected && (
          <div
            className="absolute -top-9 left-0 z-30 flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            {/* Font size */}
            <select
              value={fontSize}
              onChange={e => onUpdateConfig({ fontSize: Number(e.target.value) })}
              className="bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-200 text-xs"
            >
              {TEXT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
            </select>
            {/* Text color */}
            <label className="flex items-center gap-1 cursor-pointer" title="Text color">
              <span className="text-slate-400 text-xs">A</span>
              <input type="color" value={textColor}
                onChange={e => onUpdateConfig({ textColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border border-slate-600 bg-transparent" />
            </label>
            {/* Background color */}
            <label className="flex items-center gap-1 cursor-pointer" title="Background">
              <span className="text-slate-400 text-xs">Bg</span>
              <input type="color" value={bgColor === 'transparent' ? '#020617' : bgColor}
                onChange={e => onUpdateConfig({ bgColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border border-slate-600 bg-transparent" />
            </label>
            <div className="w-px h-4 bg-slate-600" />
            <button onClick={onDelete} className="text-slate-500 hover:text-red-400 text-sm leading-none">×</button>
          </div>
        )}

        {/* Text content */}
        {editingText ? (
          type === 'heading'
            ? <input autoFocus value={localContent} onChange={e => setLocalContent(e.target.value)}
                onBlur={commitText} onKeyDown={e => (e.key === 'Enter' || e.key === 'Escape') && commitText()}
                onClick={e => e.stopPropagation()}
                className="w-full h-full bg-transparent px-2 py-1 outline-none cursor-text"
                style={{ fontSize, fontWeight: 700, caretColor: '#f59e0b', color: textColor }} />
            : <textarea autoFocus value={localContent} onChange={e => setLocalContent(e.target.value)}
                onBlur={commitText} onKeyDown={e => e.key === 'Escape' && commitText()}
                onClick={e => e.stopPropagation()}
                className="w-full h-full bg-transparent px-2 py-1 outline-none resize-none cursor-text"
                style={{ fontSize, caretColor: '#f59e0b', color: textColor }} />
        ) : (
          <div onClick={e => { e.stopPropagation(); setEditingText(true) }}
            className="h-full w-full px-2 py-1 flex items-center cursor-text overflow-hidden"
            style={{ fontSize, fontWeight: type === 'heading' ? 700 : 400, color: textColor }}>
            {config.content
              ? <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{config.content}</span>
              : <span style={{ color: '#4b5563', fontStyle: 'italic', fontWeight: 400, fontSize: 13 }}>
                  {type === 'heading' ? 'Click to add heading…' : 'Click to add text…'}
                </span>}
          </div>
        )}
      </div>
    )
  }

  // ── Chart / table live card (before snapshot is ready) ────────────────────────
  const widgetBg = config.bgColor || DEFAULT_WIDGET_BG
  return (
    <div ref={cardRef}
      className={`flex flex-col h-full rounded-xl border overflow-hidden ${
        isSelected ? 'border-amber-500/60 shadow-lg shadow-amber-500/10' : 'border-slate-700/60'
      }`}
      style={{ backgroundColor: widgetBg }}
      onClick={onSelect}>

      <div className="drag-handle flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none border-b border-slate-700/60 shrink-0"
        style={{ backgroundColor: `${widgetBg}ee` }}>
        <span className="text-slate-500 text-xs select-none">⠿</span>
        <span className="text-slate-300 text-xs font-medium truncate flex-1">
          {savedItem?.title || (type === 'chart' ? 'Chart' : 'Table')}
        </span>
        {capturing && <span className="text-amber-400 text-xs animate-pulse shrink-0">saving…</span>}
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-slate-600 hover:text-red-400 transition-colors text-sm leading-none ml-1 shrink-0">×</button>
      </div>

      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <div className="absolute inset-0 overflow-hidden">
          {type === 'chart' && (
            <ChartRenderer savedChart={savedItem} colorOverrides={config.colorOverrides} showInjuries={config.showInjuries ?? true} />
          )}
          {type === 'table' && <TableRenderer savedTable={savedItem} config={config} />}
        </div>
      </div>
    </div>
  )
}

// ─── Color picker ─────────────────────────────────────────────────────────────
function ColorPicker({ label, value, defaultValue, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value || defaultValue} onChange={e => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent shrink-0" />
      <span className="text-slate-400 text-xs">{label}</span>
    </div>
  )
}

// ─── Widget settings panel ────────────────────────────────────────────────────

function WidgetSettings({ widget, savedItem, onUpdateConfig, onClose }) {
  const { config, type } = widget
  const isText = type === 'heading' || type === 'text'

  return (
    <div className="border-t border-slate-700/60 p-3 bg-slate-900/90 shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-slate-300 text-sm font-medium">Widget Settings</p>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">✕</button>
      </div>
      <div className="flex flex-wrap items-center gap-5">

        {type === 'chart' && savedItem && (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => onUpdateConfig({ showInjuries: !(config.showInjuries ?? true), snapshot: null })}
                className={`relative w-8 h-4 rounded-full transition-colors ${(config.showInjuries ?? true) ? 'bg-amber-500' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${(config.showInjuries ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-slate-400 text-xs">Injury overlay</span>
            </label>
            {(savedItem.config?.lines || []).map(line => (
              <ColorPicker key={line.dataKey} label={line.label}
                value={config.colorOverrides?.[line.dataKey]} defaultValue={line.color || '#3b82f6'}
                onChange={v => onUpdateConfig({ colorOverrides: { ...(config.colorOverrides || {}), [line.dataKey]: v }, snapshot: null })} />
            ))}
          </>
        )}

        {type === 'table' && (
          <>
            <ColorPicker label="Header" value={config.headerColor} defaultValue={DEFAULT_HEADER_COL}
              onChange={v => onUpdateConfig({ headerColor: v, snapshot: null })} />
            <ColorPicker label="Row (even)" value={config.rowEvenColor} defaultValue={DEFAULT_ROW_EVEN}
              onChange={v => onUpdateConfig({ rowEvenColor: v, snapshot: null })} />
            <ColorPicker label="Row (odd)" value={config.rowOddColor} defaultValue={DEFAULT_ROW_ODD}
              onChange={v => onUpdateConfig({ rowOddColor: v, snapshot: null })} />
          </>
        )}

        {isText && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Size</span>
            <select value={config.fontSize || (type === 'heading' ? 24 : 14)}
              onChange={e => onUpdateConfig({ fontSize: Number(e.target.value) })}
              className="bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-200 text-xs">
              {TEXT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
            </select>
          </div>
        )}

        <ColorPicker label={isText ? 'Background' : 'Card background'}
          value={config.bgColor} defaultValue={isText ? 'transparent' : DEFAULT_WIDGET_BG}
          onChange={v => onUpdateConfig({ bgColor: v, ...(isText ? {} : { snapshot: null }) })} />

        {isText && (
          <ColorPicker label="Text color" value={config.textColor}
            defaultValue={type === 'heading' ? '#ffffff' : '#cbd5e1'}
            onChange={v => onUpdateConfig({ textColor: v })} />
        )}

        {(type === 'chart' || type === 'table') && (
          <button onClick={() => onUpdateConfig({ snapshot: null })}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-xs transition-colors">
            ↺ Refresh image
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ saved, widgets, onAddWidget }) {
  const [tab, setTab] = useState('charts')
  const usedIds = new Set(widgets.map(w => w.sourceId).filter(Boolean))

  return (
    <div className="w-60 shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-900">
      <div className="flex border-b border-slate-700/60">
        {[['charts', 'Charts'], ['tables', 'Tables'], ['widgets', 'Text']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? 'text-white border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tab === 'charts' && (!(saved.charts || []).length
          ? <p className="text-slate-600 text-xs text-center py-8 leading-relaxed">No saved charts yet.<br />Hover a chart → bookmark icon.</p>
          : (saved.charts || []).map(c => (
              <button key={c.id} onClick={() => onAddWidget('chart', c.id)}
                className="w-full text-left rounded-lg border border-slate-700/60 px-2.5 py-2 hover:bg-slate-800 hover:border-slate-600 transition-colors group">
                <div className="flex justify-between gap-1">
                  <p className="text-slate-200 text-xs font-medium leading-tight">{c.title}</p>
                  {usedIds.has(c.id) && <span className="text-green-400 text-xs">✓</span>}
                </div>
                <p className="text-slate-600 text-xs mt-0.5">{c.chartType}</p>
                <p className="text-amber-500 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">+ Add to dashboard</p>
              </button>
            ))
        )}
        {tab === 'tables' && (!(saved.tables || []).length
          ? <p className="text-slate-600 text-xs text-center py-8 leading-relaxed">No saved tables yet.<br />Hover a table → bookmark icon.</p>
          : (saved.tables || []).map(t => (
              <button key={t.id} onClick={() => onAddWidget('table', t.id)}
                className="w-full text-left rounded-lg border border-slate-700/60 px-2.5 py-2 hover:bg-slate-800 hover:border-slate-600 transition-colors group">
                <div className="flex justify-between gap-1">
                  <p className="text-slate-200 text-xs font-medium leading-tight">{t.title}</p>
                  {usedIds.has(t.id) && <span className="text-green-400 text-xs">✓</span>}
                </div>
                <p className="text-slate-600 text-xs mt-0.5">{t.columns?.length} cols · {t.rows?.length} rows</p>
                <p className="text-amber-500 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">+ Add to dashboard</p>
              </button>
            ))
        )}
        {tab === 'widgets' && (
          <div className="space-y-1.5">
            {[{ type: 'heading', label: 'Heading', desc: 'Bold title' }, { type: 'text', label: 'Text block', desc: 'Notes / description' }].map(w => (
              <button key={w.type} onClick={() => onAddWidget(w.type)}
                className="w-full text-left rounded-lg border border-slate-700/60 px-2.5 py-2 hover:bg-slate-800 hover:border-slate-600 transition-colors group">
                <p className="text-slate-200 text-xs font-medium">{w.label}</p>
                <p className="text-slate-600 text-xs mt-0.5">{w.desc}</p>
                <p className="text-amber-500 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">+ Add to dashboard</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main builder ─────────────────────────────────────────────────────────────
export default function DashboardBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { saved, getDashboard, updateDashboard } = useUser()

  const dashboard = getDashboard(id)

  const canvasRef = useRef(null)
  const gridRef   = useRef(null)

  const [gridWidth, setGridWidth]     = useState(900)
  const [selectedId, setSelectedId]   = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal]         = useState('')
  const [exporting, setExporting]     = useState(false)
  const [zoom, setZoom]               = useState(1.0)

  const [localLayout, setLocalLayout] = useState(() =>
    (dashboard?.widgets ?? []).map(w => ({
      i: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h, minW: 1, minH: 1,
    }))
  )

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => setGridWidth(entries[0]?.contentRect.width ?? 900))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Dashboard not found.{' '}
        <button onClick={() => navigate('/dashboard')} className="ml-2 text-amber-400 hover:underline">Back</button>
      </div>
    )
  }

  const widgets  = dashboard.widgets ?? []
  const canvasBg = dashboard.bgColor || DEFAULT_CANVAS_BG

  const addWidget = useCallback((type, sourceId) => {
    const widgetId = Date.now().toString()
    const size = DEFAULT_SIZE[type]
    const maxY = localLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0)
    setLocalLayout(prev => [...prev, { i: widgetId, x: 0, y: maxY, ...size, minW: 1, minH: 1 }])
    updateDashboard(id, {
      widgets: [...widgets, {
        id: widgetId, type, sourceId: sourceId || null,
        layout: { x: 0, y: maxY, w: size.w, h: size.h },
        config: { showInjuries: true, colorOverrides: {}, content: '' },
      }],
    })
  }, [id, widgets, localLayout, updateDashboard])

  const removeWidget = useCallback(widgetId => {
    setLocalLayout(prev => prev.filter(l => l.i !== widgetId))
    updateDashboard(id, { widgets: widgets.filter(w => w.id !== widgetId) })
    if (selectedId === widgetId) setSelectedId(null)
  }, [id, widgets, updateDashboard, selectedId])

  const updateWidgetConfig = useCallback((widgetId, configChanges) => {
    updateDashboard(id, {
      widgets: widgets.map(w =>
        w.id === widgetId ? { ...w, config: { ...w.config, ...configChanges } } : w
      ),
    })
  }, [id, widgets, updateDashboard])

  const handleLayoutChange = useCallback(l => setLocalLayout(l), [])
  const handleResizeStop = useCallback((newLayout, oldItem, newItem) => {
    // Size changed → clear the snapshot so it re-captures at the new dimensions
    updateDashboard(id, {
      widgets: widgets.map(w => {
        const l = newLayout.find(li => li.i === w.id)
        if (!l) return w
        const cleared = w.id === newItem.i ? { ...w.config, snapshot: null } : w.config
        return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h }, config: cleared }
      }),
    })
    setLocalLayout(newLayout)
  }, [id, widgets, updateDashboard])
  const persistLayout = useCallback(newLayout => {
    updateDashboard(id, {
      widgets: widgets.map(w => {
        const l = newLayout.find(li => li.i === w.id)
        return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w
      }),
    })
  }, [id, widgets, updateDashboard])

  const handleExport = async () => {
    if (!gridRef.current || exporting) return
    setExporting(true)
    try {
      const png = await toPng(gridRef.current, { backgroundColor: canvasBg, pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = png
      a.download = `${dashboard.name.replace(/[^a-z0-9 \-]/gi, '').replace(/\s+/g, '_')}.png`
      a.click()
    } finally { setExporting(false) }
  }

  const selectedWidget = widgets.find(w => w.id === selectedId)
  const selectedSavedItem = selectedWidget
    ? (selectedWidget.type === 'chart' ? saved.charts?.find(c => c.id === selectedWidget.sourceId)
       : selectedWidget.type === 'table' ? saved.tables?.find(t => t.id === selectedWidget.sourceId)
       : null)
    : null

  const commitName = () => { if (nameVal.trim()) updateDashboard(id, { name: nameVal.trim() }); setEditingName(false) }

  const gw = Math.max(600, gridWidth - 32)
  const maxGridRow = localLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
  const naturalGridH = maxGridRow * ROW_HEIGHT + Math.max(0, maxGridRow - 1) * 8

  const fitZoom = () => {
    if (!canvasRef.current || naturalGridH === 0) return
    const available = canvasRef.current.clientHeight - 32
    setZoom(Math.min(1.0, Math.max(0.3, Math.round((available / naturalGridH) * 10) / 10)))
  }

  return (
    <div className="flex h-full">
      <style>{HANDLE_CSS}</style>
      <Sidebar saved={saved} widgets={widgets} onAddWidget={addWidget} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 bg-slate-900/80 shrink-0 flex-wrap">
          <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-slate-300 text-sm">← Back</button>
          <div className="w-px h-4 bg-slate-700" />

          {editingName
            ? <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
                onBlur={commitName} onKeyDown={e => (e.key === 'Enter' || e.key === 'Escape') && commitName()}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-white text-sm font-semibold outline-none focus:border-amber-500/50" />
            : <h1 onClick={() => { setEditingName(true); setNameVal(dashboard.name) }}
                className="text-white font-semibold text-sm cursor-text hover:text-amber-300 transition-colors">
                {dashboard.name}
              </h1>
          }
          <div className="flex-1" />

          {/* Canvas color presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs shrink-0">Canvas</span>
            {CANVAS_PRESETS.map(p => (
              <button key={p.color} title={p.label} onClick={() => updateDashboard(id, { bgColor: p.color })}
                className={`w-5 h-5 rounded-full border-2 transition-all ${canvasBg === p.color ? 'border-amber-400 scale-125' : 'border-slate-600 hover:border-slate-400'}`}
                style={{ backgroundColor: p.color }} />
            ))}
            <input type="color" value={canvasBg} onChange={e => updateDashboard(id, { bgColor: e.target.value })}
              title="Custom color" className="w-5 h-5 rounded-full cursor-pointer border border-slate-600 bg-transparent" />
          </div>

          <div className="w-px h-4 bg-slate-700" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))}
              className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 text-base leading-none">−</button>
            <button onClick={fitZoom} title="Click to fit all content on screen"
              className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 text-xs min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom(z => Math.min(1.0, Math.round((z + 0.1) * 10) / 10))}
              className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 text-base leading-none">+</button>
          </div>

          <div className="w-px h-4 bg-slate-700" />

          <button onClick={handleExport} disabled={exporting || widgets.length === 0}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-semibold text-xs transition-colors">
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <div ref={canvasRef} className="flex-1 overflow-auto p-4"
            style={{ minHeight: 0, backgroundColor: canvasBg }}
            onClick={() => setSelectedId(null)}>
            {widgets.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center pointer-events-none">
                <div>
                  <p className="text-slate-600 text-sm mb-2">Your dashboard is empty.</p>
                  <p className="text-slate-700 text-xs">Add charts, tables, or text from the left panel.</p>
                </div>
              </div>
            ) : (
              <div style={{ height: naturalGridH * zoom + 16, position: 'relative' }}>
                <div ref={gridRef}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: zoom < 1 ? `${gw / zoom}px` : `${gw}px`,
                    position: 'absolute', top: 0, left: 0,
                    backgroundColor: canvasBg,
                  }}>
                  <GridLayout
                    className="layout"
                    layout={localLayout}
                    cols={12}
                    rowHeight={ROW_HEIGHT}
                    width={gw}
                    margin={[8, 8]}
                    compactType="vertical"
                    onLayoutChange={handleLayoutChange}
                    onDragStop={persistLayout}
                    onResizeStop={handleResizeStop}
                    draggableHandle=".drag-handle"
                    draggableCancel="input,textarea,select"
                    resizeHandles={['n', 's', 'e', 'w', 'sw', 'nw', 'se', 'ne']}
                  >
                    {widgets.map(w => {
                      const si = w.type === 'chart' ? saved.charts?.find(c => c.id === w.sourceId)
                        : w.type === 'table' ? saved.tables?.find(t => t.id === w.sourceId)
                        : null
                      return (
                        <div key={w.id} onClick={e => e.stopPropagation()}>
                          <WidgetWrapper
                            widget={w} savedItem={si}
                            onDelete={() => removeWidget(w.id)}
                            onUpdateConfig={changes => updateWidgetConfig(w.id, changes)}
                            isSelected={selectedId === w.id}
                            onSelect={() => setSelectedId(prev => prev === w.id ? null : w.id)}
                          />
                        </div>
                      )
                    })}
                  </GridLayout>
                </div>
              </div>
            )}
          </div>

          {selectedWidget && (
            <WidgetSettings
              widget={selectedWidget} savedItem={selectedSavedItem}
              onUpdateConfig={changes => updateWidgetConfig(selectedId, changes)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
