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

// ─── Widget type config ──────────────────────────────────────────────────────
const DEFAULT_SIZE = {
  chart:   { w: 6, h: 5 },
  table:   { w: 6, h: 6 },
  heading: { w: 12, h: 1 },
  text:    { w: 6, h: 2 },
}

const MIN_SIZE = {
  chart:   { minW: 3, minH: 4 },
  table:   { minW: 3, minH: 3 },
  heading: { minW: 2, minH: 1 },
  text:    { minW: 2, minH: 1 },
}

// CSS injected once for resize handle styling
const HANDLE_CSS = `
  .react-grid-item .react-resizable-handle { opacity: 0; transition: opacity 0.15s; background-color: rgba(148,163,184,0.5); border-radius: 3px; }
  .react-grid-item:hover .react-resizable-handle { opacity: 0.6; }
  .react-grid-item:hover .react-resizable-handle:hover { opacity: 1; background-color: rgba(251,191,36,0.7); }

  /* Edge handles – override corner arrow to a clean bar */
  .react-resizable-handle-n, .react-resizable-handle-s {
    left: 50% !important; width: 44px !important; height: 6px !important;
    margin-left: -22px !important; background-image: none !important; padding: 0 !important;
  }
  .react-resizable-handle-n { top: 2px !important; transform: none !important; }
  .react-resizable-handle-s { bottom: 2px !important; transform: none !important; }

  .react-resizable-handle-e, .react-resizable-handle-w {
    top: 50% !important; height: 44px !important; width: 6px !important;
    margin-top: -22px !important; background-image: none !important; padding: 0 !important;
  }
  .react-resizable-handle-e { right: 2px !important; transform: none !important; }
  .react-resizable-handle-w { left: 2px !important; transform: none !important; }

  /* Corner handles – smaller, cleaner */
  .react-resizable-handle-se, .react-resizable-handle-sw,
  .react-resizable-handle-ne, .react-resizable-handle-nw {
    width: 10px !important; height: 10px !important;
    padding: 0 !important; background-size: 8px !important;
  }
`

// ─── Chart renderer ───────────────────────────────────────────────────────────
// Charts always render at their original fixed scale (260px).
// The widget content div clips with overflow:hidden — the chart never squishes.
const CHART_HEIGHT = 260

function ChartWidgetContent({ savedChart, colorOverrides, showInjuries }) {
  if (!savedChart) return <div className="text-slate-600 text-sm p-4">Chart not found</div>
  const { chartType, config, data } = savedChart

  if (chartType === 'CareerLine') {
    const lines = (config.lines || []).map(l => ({
      ...l, color: colorOverrides?.[l.dataKey] || l.color,
    }))
    const injuryMap = showInjuries ? (config.injuryMap || {}) : {}
    return (
      <CareerLineChart
        data={data}
        xKey={config.xKey || 'season'}
        lines={lines}
        injuryMap={injuryMap}
        height={CHART_HEIGHT}
        hideActions
      />
    )
  }

  if (chartType === 'GenericLine' && config.lines) {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={config.xKey || 'x'} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {config.lines.map(l => (
            <Line key={l.dataKey} type="monotone" dataKey={l.dataKey} name={l.label}
              stroke={colorOverrides?.[l.dataKey] || l.color || '#3b82f6'} strokeWidth={2} dot={{ r: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'GenericBar' && config.bars) {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={config.xKey || 'x'} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {config.bars.map(b => (
            <Bar key={b.dataKey} dataKey={b.dataKey} name={b.label}
              fill={colorOverrides?.[b.dataKey] || b.color || '#3b82f6'} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return <div className="text-slate-600 text-sm p-4">Chart type "{chartType}" not supported</div>
}

// ─── Table renderer ───────────────────────────────────────────────────────────
function TableWidgetContent({ savedTable }) {
  if (!savedTable) return <div className="text-slate-600 text-sm p-4">Table not found</div>
  const { columns, rows } = savedTable
  const visible = rows.slice(0, 50)
  return (
    <div className="overflow-auto h-full text-xs">
      <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-2 py-1.5 text-left text-slate-500 font-medium whitespace-nowrap bg-slate-800/80 sticky top-0">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-slate-900/60' : ''}>
              {columns.map(col => (
                <td key={col.key} className="px-2 py-1 text-slate-300 whitespace-nowrap border-t border-slate-800">
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <p className="text-slate-600 text-xs p-2 text-center">{rows.length - 50} more rows…</p>
      )}
    </div>
  )
}

// ─── Widget wrapper ───────────────────────────────────────────────────────────
function WidgetWrapper({ widget, savedChart, savedTable, onDelete, onUpdateConfig, isSelected, onSelect }) {
  const [editingText, setEditingText] = useState(false)
  const [localContent, setLocalContent] = useState(widget.config.content || '')
  const { config } = widget

  const commitText = () => {
    setEditingText(false)
    onUpdateConfig({ content: localContent })
  }

  // ── Overlay mode: text/heading float directly on the canvas background ──────
  if (widget.type === 'heading' || widget.type === 'text') {
    return (
      <div
        className="drag-handle relative h-full group cursor-grab active:cursor-grabbing"
        onClick={onSelect}
      >
        {/* Selection ring */}
        {isSelected && (
          <div className="absolute inset-0 ring-2 ring-amber-500/50 rounded pointer-events-none z-10" />
        )}
        {/* Delete button — floats top-right, visible on hover */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute top-1 right-1 z-20 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-red-400 bg-slate-800/70 rounded opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
        >×</button>

        {widget.type === 'heading' && (
          editingText ? (
            <input
              autoFocus
              value={localContent}
              onChange={e => setLocalContent(e.target.value)}
              onBlur={commitText}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitText() }}
              onClick={e => e.stopPropagation()}
              className="w-full h-full bg-transparent text-white text-2xl font-bold px-2 py-1 outline-none cursor-text"
              style={{ caretColor: '#f59e0b' }}
            />
          ) : (
            <h2
              onClick={e => { e.stopPropagation(); setEditingText(true) }}
              className="h-full w-full px-2 py-1 text-white text-2xl font-bold flex items-center cursor-text"
            >
              {config.content || <span className="text-slate-700 italic font-normal text-base">Heading…</span>}
            </h2>
          )
        )}

        {widget.type === 'text' && (
          editingText ? (
            <textarea
              autoFocus
              value={localContent}
              onChange={e => setLocalContent(e.target.value)}
              onBlur={commitText}
              onKeyDown={e => { if (e.key === 'Escape') commitText() }}
              onClick={e => e.stopPropagation()}
              className="w-full h-full bg-transparent text-slate-300 text-sm px-2 py-1 outline-none resize-none cursor-text"
              style={{ caretColor: '#f59e0b' }}
            />
          ) : (
            <p
              onClick={e => { e.stopPropagation(); setEditingText(true) }}
              className="h-full w-full px-2 py-1 text-slate-300 text-sm leading-relaxed cursor-text whitespace-pre-wrap overflow-hidden"
            >
              {config.content || <span className="text-slate-700 italic">Text…</span>}
            </p>
          )
        )}
      </div>
    )
  }

  // ── Card mode: chart / table ─────────────────────────────────────────────────
  return (
    <div
      className={`flex flex-col h-full rounded-xl border overflow-hidden transition-colors ${
        isSelected
          ? 'border-amber-500/60 shadow-lg shadow-amber-500/10'
          : 'border-slate-700/60'
      } bg-slate-900`}
      onClick={onSelect}
    >
      {/* Title bar / drag handle */}
      <div className="drag-handle flex items-center gap-2 px-3 py-2 bg-slate-800/70 cursor-grab active:cursor-grabbing select-none border-b border-slate-700/60 shrink-0">
        <span className="text-slate-600 text-xs">⠿</span>
        <span className="text-slate-300 text-xs font-medium truncate flex-1">
          {widget.type === 'chart' ? (savedChart?.title || 'Chart') : (savedTable?.title || 'Table')}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-slate-600 hover:text-red-400 transition-colors text-sm leading-none ml-1 shrink-0"
        >×</button>
      </div>

      {/* Content — overflow:hidden so chart clips instead of squishing when widget is small */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {widget.type === 'chart' && (
          <ChartWidgetContent
            savedChart={savedChart}
            colorOverrides={config.colorOverrides}
            showInjuries={config.showInjuries ?? true}
          />
        )}
        {widget.type === 'table' && <TableWidgetContent savedTable={savedTable} />}
      </div>
    </div>
  )
}

// ─── Widget settings panel ────────────────────────────────────────────────────
function WidgetSettings({ widget, savedChart, onUpdateConfig, onClose }) {
  const { config } = widget

  return (
    <div className="border-t border-slate-700/60 p-4 bg-slate-900/80 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-300 text-sm font-medium">Widget Settings</p>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">✕</button>
      </div>

      {widget.type === 'chart' && savedChart && (
        <div className="flex flex-wrap items-center gap-4">
          {/* Injury overlay toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => onUpdateConfig({ showInjuries: !(config.showInjuries ?? true) })}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                (config.showInjuries ?? true) ? 'bg-amber-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                (config.showInjuries ?? true) ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
            <span className="text-slate-400 text-xs">Injury overlay</span>
          </label>

          {/* Color overrides for each line */}
          {(savedChart.config?.lines || []).map(line => (
            <div key={line.dataKey} className="flex items-center gap-1.5">
              <input
                type="color"
                value={config.colorOverrides?.[line.dataKey] || line.color || '#3b82f6'}
                onChange={e => onUpdateConfig({
                  colorOverrides: { ...(config.colorOverrides || {}), [line.dataKey]: e.target.value }
                })}
                className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent"
              />
              <span className="text-slate-400 text-xs">{line.label}</span>
            </div>
          ))}
        </div>
      )}

      {(widget.type === 'heading' || widget.type === 'text') && (
        <p className="text-slate-500 text-xs">Click the widget content to edit the text.</p>
      )}

      {widget.type === 'table' && (
        <p className="text-slate-500 text-xs">Table data is read-only. Showing up to 50 rows.</p>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ saved, widgets, onAddWidget }) {
  const [sideTab, setSideTab] = useState('charts')
  const usedSourceIds = new Set(widgets.map(w => w.sourceId).filter(Boolean))

  return (
    <div className="w-64 shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-900">
      {/* Tabs */}
      <div className="flex border-b border-slate-700/60">
        {[['charts', 'Charts'], ['tables', 'Tables'], ['widgets', 'Text']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSideTab(id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              sideTab === id
                ? 'text-white border-b-2 border-amber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
            {id !== 'widgets' && saved[id]?.length > 0 && (
              <span className="ml-1 text-slate-600">({saved[id].length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {sideTab === 'charts' && (
          <>
            {(saved.charts || []).length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8 leading-relaxed">
                No saved charts yet.<br/>
                Hover over a chart and click the bookmark icon.
              </p>
            ) : (
              (saved.charts || []).map(chart => {
                const inDash = usedSourceIds.has(chart.id)
                return (
                  <button
                    key={chart.id}
                    onClick={() => onAddWidget('chart', chart.id)}
                    className="w-full text-left rounded-lg border border-slate-700/60 px-2.5 py-2 hover:bg-slate-800 hover:border-slate-600 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-slate-200 text-xs font-medium leading-tight">{chart.title}</p>
                      {inDash && (
                        <span className="text-green-400 text-xs shrink-0 mt-0.5">✓</span>
                      )}
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5">{chart.chartType}</p>
                    <p className="text-amber-500 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {inDash ? '+ Add again' : '+ Add to dashboard'}
                    </p>
                  </button>
                )
              })
            )}
          </>
        )}

        {sideTab === 'tables' && (
          <>
            {(saved.tables || []).length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8 leading-relaxed">
                No saved tables yet.<br/>
                Hover over a table and click the bookmark icon.
              </p>
            ) : (
              (saved.tables || []).map(table => {
                const inDash = usedSourceIds.has(table.id)
                return (
                  <button
                    key={table.id}
                    onClick={() => onAddWidget('table', table.id)}
                    className="w-full text-left rounded-lg border border-slate-700/60 px-2.5 py-2 hover:bg-slate-800 hover:border-slate-600 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-slate-200 text-xs font-medium leading-tight">{table.title}</p>
                      {inDash && (
                        <span className="text-green-400 text-xs shrink-0 mt-0.5">✓</span>
                      )}
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5">{table.columns?.length} cols · {table.rows?.length} rows</p>
                    <p className="text-amber-500 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {inDash ? '+ Add again' : '+ Add to dashboard'}
                    </p>
                  </button>
                )
              })
            )}
          </>
        )}

        {sideTab === 'widgets' && (
          <div className="space-y-1.5">
            {[
              { type: 'heading', label: 'Heading', desc: 'Large bold title' },
              { type: 'text', label: 'Text block', desc: 'Paragraph or notes' },
            ].map(w => (
              <button
                key={w.type}
                onClick={() => onAddWidget(w.type)}
                className="w-full text-left rounded-lg border border-slate-700/60 px-2.5 py-2 hover:bg-slate-800 hover:border-slate-600 transition-colors group"
              >
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

  // Compute dashboard early (not a hook) so useState can use it for initial value
  const dashboard = getDashboard(id)

  const exportRef = useRef(null)
  const [gridWidth, setGridWidth] = useState(900)
  const [selectedId, setSelectedId] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const [exporting, setExporting] = useState(false)

  // Local layout state — updated on every drag/resize move (no localStorage write)
  // Persisted to dashboard only on drag/resize STOP
  const [localLayout, setLocalLayout] = useState(() =>
    (dashboard?.widgets ?? []).map(w => ({
      i: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h, minW: 2, minH: 1,
    }))
  )

  useEffect(() => {
    const node = exportRef.current
    if (!node) return
    const obs = new ResizeObserver(entries => {
      setGridWidth(entries[0]?.contentRect.width ?? 900)
    })
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  const widgets = dashboard?.widgets ?? []

  // Add widget — also updates local layout immediately so grid shows it right away
  const addWidget = useCallback((type, sourceId) => {
    const widgetId = Date.now().toString()
    const size = DEFAULT_SIZE[type]
    const mins = MIN_SIZE[type]
    const maxY = localLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0)
    setLocalLayout(prev => [...prev, { i: widgetId, x: 0, y: maxY, ...size, ...mins }])
    updateDashboard(id, {
      widgets: [...widgets, {
        id: widgetId, type, sourceId: sourceId || null,
        layout: { x: 0, y: maxY, w: size.w, h: size.h },
        config: { showInjuries: true, colorOverrides: {}, content: '' },
      }],
    })
  }, [id, widgets, localLayout, updateDashboard])

  // Remove widget — also removes from local layout
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

  // Called during drag/resize — only update local state, NO localStorage write
  const handleLayoutChange = useCallback(newLayout => {
    setLocalLayout(newLayout)
  }, [])

  // Called when drag/resize ENDS — persist positions to dashboard
  const persistLayout = useCallback(newLayout => {
    const updated = widgets.map(w => {
      const l = newLayout.find(li => li.i === w.id)
      if (!l) return w
      return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }
    })
    updateDashboard(id, { widgets: updated })
  }, [id, widgets, updateDashboard])

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Dashboard not found.{' '}
        <button onClick={() => navigate('/dashboard')} className="ml-2 text-amber-400 hover:underline">
          Back to Dashboards
        </button>
      </div>
    )
  }

  const selectedWidget = widgets.find(w => w.id === selectedId)
  const selectedChart = selectedWidget?.type === 'chart'
    ? saved.charts?.find(c => c.id === selectedWidget.sourceId)
    : null

  const commitName = () => {
    if (nameVal.trim()) updateDashboard(id, { name: nameVal.trim() })
    setEditingName(false)
  }

  const handleExport = async () => {
    if (!exportRef.current || exporting) return
    setExporting(true)
    try {
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: '#020617',
        pixelRatio: 2,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${dashboard.name.replace(/[^a-z0-9 \-]/gi, '').replace(/\s+/g, '_')}.png`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Inject resize-handle styles once */}
      <style>{HANDLE_CSS}</style>
      {/* Sidebar */}
      <Sidebar saved={saved} widgets={widgets} onAddWidget={addWidget} />

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/80 shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
          >
            ← Back
          </button>
          <div className="w-px h-4 bg-slate-700" />
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitName() }}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-white text-sm font-semibold outline-none focus:border-amber-500/50"
            />
          ) : (
            <h1
              onClick={() => { setEditingName(true); setNameVal(dashboard.name) }}
              className="text-white font-semibold text-sm cursor-text hover:text-amber-300 transition-colors"
            >
              {dashboard.name}
            </h1>
          )}
          <span className="text-slate-600 text-xs">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <button
            onClick={handleExport}
            disabled={exporting || widgets.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-semibold text-xs transition-colors"
          >
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>

        {/* Canvas + settings */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Canvas — overflow-auto so large dashboards can scroll */}
          <div className="flex-1 overflow-auto bg-slate-950 p-4" ref={exportRef} style={{ minHeight: 0 }}>
            {widgets.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-slate-600 text-sm mb-2">Your dashboard is empty.</p>
                  <p className="text-slate-700 text-xs">Add charts, tables, or text elements from the left panel.</p>
                </div>
              </div>
            ) : (
              <GridLayout
                className="layout"
                layout={localLayout}
                cols={12}
                rowHeight={60}
                width={Math.max(600, gridWidth - 32)}
                margin={[8, 8]}
                onLayoutChange={handleLayoutChange}
                onDragStop={persistLayout}
                onResizeStop={persistLayout}
                draggableHandle=".drag-handle"
                draggableCancel="input,textarea"
                resizeHandles={['n', 's', 'e', 'w', 'sw', 'nw', 'se', 'ne']}
              >
                {widgets.map(w => {
                  const savedChart = w.type === 'chart'
                    ? saved.charts?.find(c => c.id === w.sourceId)
                    : null
                  const savedTable = w.type === 'table'
                    ? saved.tables?.find(t => t.id === w.sourceId)
                    : null
                  return (
                    <div key={w.id}>
                      <WidgetWrapper
                        widget={w}
                        savedChart={savedChart}
                        savedTable={savedTable}
                        onDelete={() => removeWidget(w.id)}
                        onUpdateConfig={changes => updateWidgetConfig(w.id, changes)}
                        isSelected={selectedId === w.id}
                        onSelect={() => setSelectedId(prev => prev === w.id ? null : w.id)}
                      />
                    </div>
                  )
                })}
              </GridLayout>
            )}
          </div>

          {/* Settings panel (only when a widget is selected) */}
          {selectedWidget && (
            <WidgetSettings
              widget={selectedWidget}
              savedChart={selectedChart}
              onUpdateConfig={changes => updateWidgetConfig(selectedId, changes)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
