import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useUser } from '../context/UserContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { posColor } from '../utils/posColors'
import { CsvDownloadButton } from '../components/StatTable'
import { CareerLineChart } from '../components/StatChart'

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'saved',       label: 'Saved & Notes', icon: '📊' },
  { id: 'players',     label: 'Players',        icon: '⭐' },
  { id: 'comparisons', label: 'Comparisons',    icon: '⚖️' },
  { id: 'searches',    label: 'Searches',       icon: '🔍' },
]

const DEFAULT_HEADER_COL = '#1e293b'
const DEFAULT_ROW_EVEN   = '#0f172a'
const DEFAULT_ROW_ODD    = '#020617'

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Generic chart renderer (GenericLine / GenericBar) ────────────────────────
function GenericChartRenderer({ chart, colorOverrides }) {
  const { chartType, config, data } = chart
  if (chartType === 'GenericLine' && config?.lines) {
    return (
      <ResponsiveContainer width="100%" height={240}>
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
  if (chartType === 'GenericBar' && config?.bars) {
    return (
      <ResponsiveContainer width="100%" height={240}>
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
  return null
}

// ─── Chart card ───────────────────────────────────────────────────────────────
function ChartCard({ chart, overrides, onUpdate, onRemove }) {
  const exportRef    = useRef(null)
  const [exporting, setExporting] = useState(false)
  const colorOverrides = overrides?.colorOverrides || {}
  const showInjuries   = overrides?.showInjuries ?? true
  const isCareerLine   = chart.chartType === 'CareerLine'
  const configItems    = chart.config?.lines || chart.config?.bars || []

  const lines = (chart.config?.lines || []).map(l => ({
    ...l, color: colorOverrides[l.dataKey] || l.color,
  }))

  const handleExport = async () => {
    if (!exportRef.current || exporting) return
    setExporting(true)
    try {
      const png = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#0f172a' })
      const a = document.createElement('a')
      a.href = png
      a.download = `${chart.title.replace(/[^a-z0-9 \-—]/gi, '').replace(/\s+/g, '_')}.png`
      a.click()
    } finally { setExporting(false) }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/80">
        <span className="text-white font-medium text-sm truncate flex-1">{chart.title}</span>
        {chart.sourceUrl && (
          <Link to={chart.sourceUrl} className="text-amber-500/70 hover:text-amber-400 text-xs transition-colors shrink-0">
            View source
          </Link>
        )}
        <button onClick={handleExport} disabled={exporting}
          className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition-colors disabled:opacity-40 shrink-0">
          {exporting ? 'Saving…' : 'Export PNG'}
        </button>
        <button onClick={onRemove}
          className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
      </div>

      {/* Chart — this div is captured for export */}
      <div ref={exportRef} className="p-3" style={{ backgroundColor: '#0f172a' }}>
        {isCareerLine ? (
          <CareerLineChart
            data={chart.data}
            xKey={chart.config?.xKey || 'season'}
            lines={lines}
            injuryMap={showInjuries ? (chart.config?.injuryMap || {}) : {}}
            hideActions
          />
        ) : (
          <GenericChartRenderer chart={chart} colorOverrides={colorOverrides} />
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-2.5 border-t border-slate-700/40 flex flex-wrap items-center gap-4">
        {isCareerLine && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button"
              onClick={() => onUpdate({ showInjuries: !showInjuries })}
              className={`relative w-8 h-4 rounded-full transition-colors ${showInjuries ? 'bg-amber-500' : 'bg-slate-600'}`}>
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${showInjuries ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-slate-400 text-xs">Injury bands</span>
          </label>
        )}
        {configItems.map(item => (
          <div key={item.dataKey} className="flex items-center gap-1.5">
            <input type="color"
              value={colorOverrides[item.dataKey] || item.color || '#3b82f6'}
              onChange={e => onUpdate({ colorOverrides: { ...colorOverrides, [item.dataKey]: e.target.value } })}
              className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent shrink-0" />
            <span className="text-slate-400 text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Table card ───────────────────────────────────────────────────────────────
function TableCard({ table, config, onUpdate, onRemove }) {
  const exportRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const headerBg = config?.headerColor || DEFAULT_HEADER_COL
  const rowEven  = config?.rowEvenColor || DEFAULT_ROW_EVEN
  const rowOdd   = config?.rowOddColor  || DEFAULT_ROW_ODD

  const handleExport = async () => {
    if (!exportRef.current || exporting) return
    setExporting(true)
    try {
      const png = await toPng(exportRef.current, { pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = png
      a.download = `${table.title.replace(/[^a-z0-9 \-—]/gi, '').replace(/\s+/g, '_')}.png`
      a.click()
    } finally { setExporting(false) }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/80">
        <span className="text-white font-medium text-sm truncate flex-1">{table.title}</span>
        {table.sourceUrl && (
          <Link to={table.sourceUrl} className="text-amber-500/70 hover:text-amber-400 text-xs transition-colors shrink-0">
            View source
          </Link>
        )}
        <button onClick={handleExport} disabled={exporting}
          className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition-colors disabled:opacity-40 shrink-0">
          {exporting ? 'Saving…' : 'Export PNG'}
        </button>
        <button onClick={onRemove}
          className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
      </div>

      {/* Table — scroll wrapper for UI, exportRef captures full content */}
      <div className="overflow-auto max-h-72">
        <div ref={exportRef}>
          <table className="min-w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {(table.columns || []).map(col => (
                  <th key={col.key}
                    className="px-3 py-2 text-left text-slate-300 font-medium whitespace-nowrap"
                    style={{ backgroundColor: headerBg }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(table.rows || []).map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? rowEven : rowOdd }}>
                  {(table.columns || []).map(col => (
                    <td key={col.key} className="px-3 py-2 text-slate-300 whitespace-nowrap border-t border-slate-800">
                      {row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(table.rows?.length || 0) > 60 && (
            <p className="text-slate-500 text-xs p-2 text-center">+{table.rows.length - 60} more rows</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2.5 border-t border-slate-700/40 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <input type="color" value={headerBg}
            onChange={e => onUpdate({ headerColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent shrink-0" />
          <span className="text-slate-400 text-xs">Header</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="color" value={rowEven}
            onChange={e => onUpdate({ rowEvenColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent shrink-0" />
          <span className="text-slate-400 text-xs">Row (even)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="color" value={rowOdd}
            onChange={e => onUpdate({ rowOddColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent shrink-0" />
          <span className="text-slate-400 text-xs">Row (odd)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Saved() {
  const { user } = useAuth()
  const {
    username, saved,
    removePlayer, removeComparison, removeSearch,
    removeNote, addNote, updateNote,
    updatePlayerNote, updateComparisonNote, updateSearchNote,
    removeChart, removeTable,
  } = useUser()

  const [tab,            setTab]           = useState('saved')
  const [note,           setNote]          = useState('')
  const [editingNote,    setEditingNote]   = useState(null)
  const [noteText,       setNoteText]      = useState('')
  const [chartOverrides, setChartOverrides] = useState({})
  const [tableConfigs,   setTableConfigs]   = useState({})
  const navigate = useNavigate()

  const startEditNote = (type, id, current) => { setEditingNote({ type, id }); setNoteText(current ?? '') }
  const isEditingNote = (type, id) => editingNote?.type === type && editingNote?.id === id
  const commitNote = () => {
    if (!editingNote) return
    const text = noteText.trim()
    if (editingNote.type === 'player')     updatePlayerNote(editingNote.id, text)
    if (editingNote.type === 'comparison') updateComparisonNote(editingNote.id, text)
    if (editingNote.type === 'search')     updateSearchNote(editingNote.id, text)
    if (editingNote.type === 'note')       updateNote(editingNote.id, text)
    setEditingNote(null)
  }

  const updateChartOverride = (chartId, changes) =>
    setChartOverrides(prev => ({ ...prev, [chartId]: { ...(prev[chartId] || {}), ...changes } }))

  const updateTableConfig = (tableId, changes) =>
    setTableConfigs(prev => ({ ...prev, [tableId]: { ...(prev[tableId] || {}), ...changes } }))

  const countFor = id => {
    if (id === 'saved')       return (saved.charts?.length ?? 0) + (saved.tables?.length ?? 0) + (saved.notes?.length ?? 0)
    if (id === 'players')     return saved.players?.length ?? 0
    if (id === 'comparisons') return saved.comparisons?.length ?? 0
    if (id === 'searches')    return saved.searches?.length ?? 0
    return 0
  }

  const total = (saved.players?.length ?? 0) + (saved.comparisons?.length ?? 0) +
                (saved.searches?.length ?? 0) + (saved.charts?.length ?? 0) +
                (saved.tables?.length ?? 0) + (saved.notes?.length ?? 0)

  const hasCharts  = (saved.charts  || []).length > 0
  const hasTables  = (saved.tables  || []).length > 0
  const hasMedia   = hasCharts || hasTables

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-0.5">{username}</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Saved</h1>
        <p className="text-slate-500 text-sm mt-1">{total} saved item{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {/* Projects tab hidden until premium launch */}
      {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}>
            <span>{t.icon}</span>
            {t.label}
            {countFor(t.id) > 0 && (
              <span className="text-xs bg-slate-600 text-slate-300 rounded-full px-1.5 py-0.5 leading-none">
                {countFor(t.id)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Saved & Notes ─────────────────────────────────────────────── */}
      {tab === 'saved' && (
        <div className="space-y-6">

          {/* Charts */}
          {hasCharts && (
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Charts</p>
              {(saved.charts || []).map(c => (
                <ChartCard key={c.id} chart={c}
                  overrides={chartOverrides[c.id]}
                  onUpdate={changes => updateChartOverride(c.id, changes)}
                  onRemove={() => removeChart(c.title)} />
              ))}
            </section>
          )}

          {/* Tables */}
          {hasTables && (
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tables</p>
              {(saved.tables || []).map(t => (
                <TableCard key={t.id} table={t}
                  config={tableConfigs[t.id]}
                  onUpdate={changes => updateTableConfig(t.id, changes)}
                  onRemove={() => removeTable(t.title)} />
              ))}
            </section>
          )}

          {/* Notes */}
          <section className="space-y-3">
            {hasMedia && (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Notes</p>
            )}
            <div className="flex gap-2">
              <input
                type="text" value={note}
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && note.trim()) { addNote(note.trim()); setNote('') } }}
                placeholder="Write a discovery or note… (Enter to save)"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <button
                onClick={() => { if (note.trim()) { addNote(note.trim()); setNote('') } }}
                disabled={!note.trim()}
                className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap">
                Save
              </button>
            </div>

            {saved.notes.length === 0 && !hasMedia && (
              <Empty text="Nothing here yet." sub="Save charts or tables from any chart, or write a note below." />
            )}
            {saved.notes.length === 0 && hasMedia && (
              <Empty text="No notes yet." sub="Type something interesting and press Enter." />
            )}

            {saved.notes.map(n => (
              <div key={n.id} className="rounded-xl px-4 py-3 border border-slate-700/60 bg-slate-800/50">
                {isEditingNote('note', n.id) ? (
                  <div className="flex gap-2">
                    <textarea
                      autoFocus value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onBlur={commitNote}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNote() }
                        if (e.key === 'Escape') setEditingNote(null)
                      }}
                      rows={Math.max(2, noteText.split('\n').length)}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                    <button onMouseDown={e => { e.preventDefault(); commitNote() }}
                      className="text-xs text-amber-400 hover:text-amber-300 px-2 font-medium self-start mt-1">
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <p onClick={() => startEditNote('note', n.id, n.text)}
                      className="flex-1 text-slate-200 text-sm leading-relaxed cursor-text hover:text-white transition-colors">
                      {n.text}
                    </p>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span className="text-slate-600 text-xs hidden sm:block">{fmt(n.saved_at)}</span>
                      <button onClick={() => removeNote(n.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ── Players ───────────────────────────────────────────────────── */}
      {tab === 'players' && (
        <div className="space-y-2">
          {saved.players.length === 0 && <Empty text="No saved players yet." sub="Open a player profile and click the ⭐ button." />}
          {saved.players.map(p => {
            const c = posColor(p.pos)
            return (
              <div key={p.player_id} className="rounded-xl px-4 py-3 border border-slate-700/60 bg-slate-800/50 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/player/${p.player_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                      style={{ background: c.dark, color: c.hex, border: `1px solid ${c.mid}` }}>
                      {p.pos}
                    </span>
                    <span className="text-white font-semibold truncate">{p.player_name}</span>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-slate-600 text-xs hidden sm:block">{fmt(p.saved_at)}</span>
                    <button onClick={() => removePlayer(p.player_id)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                  </div>
                </div>
                <NoteField
                  value={p.note} editing={isEditingNote('player', p.player_id)}
                  noteText={noteText} setNoteText={setNoteText}
                  onStart={() => startEditNote('player', p.player_id, p.note)}
                  onCommit={commitNote} onCancel={() => setEditingNote(null)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* ── Comparisons ───────────────────────────────────────────────── */}
      {tab === 'comparisons' && (
        <div className="space-y-2">
          {saved.comparisons.length === 0 && <Empty text="No saved comparisons yet." sub='Go to Compare and click "Save comparison".' />}
          {saved.comparisons.map((c, i) => (
            <div key={i} className="rounded-xl px-4 py-3 border border-slate-700/60 bg-slate-800/50 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => navigate(`/comparison?players=${c.playerIds.join(',')}&category=${c.category}`)}
                  className="flex-1 text-left min-w-0 hover:opacity-80 transition-opacity">
                  <p className="text-white font-semibold truncate">{c.playerNames.join(' vs ')}</p>
                  <p className="text-slate-500 text-xs capitalize">{c.category} · {fmt(c.saved_at)}</p>
                </button>
                <button onClick={() => removeComparison(i)}
                  className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
              </div>
              <NoteField
                value={c.note} editing={isEditingNote('comparison', i)}
                noteText={noteText} setNoteText={setNoteText}
                onStart={() => startEditNote('comparison', i, c.note)}
                onCommit={commitNote} onCancel={() => setEditingNote(null)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Searches ──────────────────────────────────────────────────── */}
      {tab === 'searches' && (
        <div className="space-y-3">
          {saved.searches.length === 0 && <Empty text="No saved searches yet." sub='Ask a question in Smart Search and click "Save result".' />}
          {saved.searches.map((s, i) => (
            <details key={i} className="rounded-xl border border-slate-700/60 bg-slate-800/50 overflow-hidden group">
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{s.question}</p>
                  <p className="text-slate-500 text-xs">{s.rows.length} rows preview · {fmt(s.saved_at)}</p>
                  <div onClick={e => e.preventDefault()}>
                    <NoteField
                      value={s.note} editing={isEditingNote('search', i)}
                      noteText={noteText} setNoteText={setNoteText}
                      onStart={() => startEditNote('search', i, s.note)}
                      onCommit={commitNote} onCancel={() => setEditingNote(null)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform inline-block">▼</span>
                  <button onClick={e => { e.preventDefault(); removeSearch(i) }}
                    className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                </div>
              </summary>
              {s.rows.length > 0 && (
                <div className="border-t border-slate-700/60 relative group scroll-x">
                  <CsvDownloadButton
                    columns={Object.keys(s.rows[0]).map(k => ({ key: k, label: k }))}
                    rows={s.rows}
                    title={s.question || 'search results'}
                  />
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900/60">
                        {Object.keys(s.rows[0]).map(k => (
                          <th key={k} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((row, j) => (
                        <tr key={j} className="border-t border-slate-800">
                          {Object.values(row).map((v, k) => (
                            <td key={k} className="px-3 py-2 text-slate-300">
                              {typeof v === 'number' ? v.toLocaleString() : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          ))}
        </div>
      )}
      {/* Projects tab hidden until premium launch
      {tab === 'projects' && user?.is_admin && <ProjectsTab />}
      */}
    </div>
  )
}


// ─── Projects Tab (admin only) ───────────────────────────────────────────────
function ProjectsTab() {
  const [projects,     setProjects]     = useState([])
  const [dbItems,      setDbItems]      = useState([])
  const [expanded,     setExpanded]     = useState(null)
  const [projItems,    setProjItems]    = useState({})
  const [newName,      setNewName]      = useState('')
  const [renaming,     setRenaming]     = useState(null)
  const [renameText,   setRenameText]   = useState('')
  const [confirming,   setConfirming]   = useState(null)
  const [loading,      setLoading]      = useState(true)

  const load = async () => {
    try {
      const [p, items] = await Promise.all([api.getProjects(), api.getSaved()])
      setProjects(p)
      setDbItems(items)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }
  useState(() => { load() })

  const unsorted = dbItems.filter(i => !i.project_id)

  const toggle = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!projItems[id]) {
      try {
        const items = await api.getProjectItems(id)
        setProjItems(prev => ({ ...prev, [id]: items }))
      } catch { setProjItems(prev => ({ ...prev, [id]: [] })) }
    }
  }

  const create = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const p = await api.createProject(name)
      setProjects(prev => [p, ...prev])
      setNewName('')
    } catch { /* ignore */ }
  }

  const rename = async (id) => {
    const name = renameText.trim()
    if (!name) return
    try {
      await api.renameProject(id, name)
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
      setRenaming(null)
    } catch { /* ignore */ }
  }

  const remove = async (id) => {
    try {
      await api.deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      setConfirming(null)
      load()
    } catch { /* ignore */ }
  }

  const moveItem = async (itemId, projectId) => {
    try {
      await api.moveSavedToProject(itemId, projectId)
      load()
      setProjItems({})
      setExpanded(null)
    } catch { /* ignore */ }
  }

  if (loading) return <div className="text-slate-500 text-sm text-center py-8 animate-pulse">Loading...</div>

  return (
    <div className="space-y-4">
      {/* New project input */}
      <div className="flex gap-2">
        <input
          type="text" value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') create() }}
          placeholder="New project name..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
        />
        <button onClick={create} disabled={!newName.trim()}
          className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          Create
        </button>
      </div>

      {/* Projects list */}
      {projects.map(p => (
        <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => toggle(p.id)} className="flex-1 text-left flex items-center gap-2">
              <span className="text-slate-500 text-xs">{expanded === p.id ? '▼' : '▶'}</span>
              {renaming === p.id ? (
                <input autoFocus value={renameText}
                  onChange={e => setRenameText(e.target.value)}
                  onBlur={() => rename(p.id)}
                  onKeyDown={e => { if (e.key === 'Enter') rename(p.id); if (e.key === 'Escape') setRenaming(null) }}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="text-white text-sm font-medium">{p.name}</span>
              )}
              <span className="text-slate-600 text-xs">{p.item_count} items</span>
            </button>
            <button onClick={() => { setRenaming(p.id); setRenameText(p.name) }}
              className="text-slate-600 hover:text-slate-300 text-xs transition-colors px-1">Rename</button>
            {confirming === p.id ? (
              <div className="flex gap-1">
                <button onClick={() => remove(p.id)}
                  className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold">Yes</button>
                <button onClick={() => setConfirming(null)}
                  className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(p.id)}
                className="text-slate-600 hover:text-red-400 text-xs transition-colors px-1">Delete</button>
            )}
          </div>

          {expanded === p.id && (
            <div className="border-t border-slate-800 px-4 py-3 space-y-2">
              {(projItems[p.id] ?? []).length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-2">No items in this project</p>
              ) : (
                (projItems[p.id] ?? []).map(item => (
                  <SavedItemRow key={item.id} item={item} projects={projects} onMove={moveItem} />
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {/* Unsorted items */}
      {unsorted.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Unsorted ({unsorted.length})</p>
          {unsorted.map(item => (
            <SavedItemRow key={item.id} item={item} projects={projects} onMove={moveItem} />
          ))}
        </div>
      )}

      {projects.length === 0 && unsorted.length === 0 && (
        <div className="text-center py-12 rounded-2xl border border-dashed border-slate-700/60">
          <p className="text-slate-400 text-sm font-medium">No projects yet</p>
          <p className="text-slate-600 text-xs mt-1">Create a project above to start organising your saved items</p>
        </div>
      )}
    </div>
  )
}

function SavedItemRow({ item, projects, onMove }) {
  const [showMove, setShowMove] = useState(false)
  return (
    <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
        item.type === 'chart'      ? 'bg-blue-500/20 text-blue-400' :
        item.type === 'table'      ? 'bg-green-500/20 text-green-400' :
        item.type === 'player'     ? 'bg-amber-500/20 text-amber-400' :
        item.type === 'comparison' ? 'bg-purple-500/20 text-purple-400' :
        item.type === 'search'     ? 'bg-cyan-500/20 text-cyan-400' :
        'bg-slate-700 text-slate-300'
      }`}>{item.type}</span>
      <span className="text-slate-200 text-sm truncate flex-1">{item.label}</span>
      <span className="text-slate-600 text-xs shrink-0">{fmt(item.created_at)}</span>
      <div className="relative shrink-0">
        <button onClick={() => setShowMove(!showMove)}
          className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Move</button>
        {showMove && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
            <button onClick={() => { onMove(item.id, null); setShowMove(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60">
              Unsorted
            </button>
            {projects.map(p => (
              <button key={p.id} onClick={() => { onMove(item.id, p.id); setShowMove(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700/60 ${
                  item.project_id === p.id ? 'text-amber-400 font-semibold' : 'text-slate-300'
                }`}>
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


// ─── Shared sub-components ────────────────────────────────────────────────────
function NoteField({ value, editing, noteText, setNoteText, onStart, onCommit, onCancel }) {
  if (editing) {
    return (
      <div className="flex gap-2 mt-1">
        <input
          autoFocus type="text" value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
          placeholder="Add a note…"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <button onMouseDown={e => { e.preventDefault(); onCommit() }}
          className="text-xs text-amber-400 hover:text-amber-300 px-2 font-medium">Save</button>
      </div>
    )
  }
  return (
    <button onClick={onStart} className="text-left w-full group mt-1">
      {value
        ? <span className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-200 transition-colors">{value}</span>
        : <span className="text-slate-700 text-xs italic group-hover:text-slate-500 transition-colors">+ Add a note…</span>
      }
    </button>
  )
}

function Empty({ text, sub }) {
  return (
    <div className="text-center py-12 rounded-2xl border border-dashed border-slate-700/60">
      <p className="text-slate-400 text-sm font-medium">{text}</p>
      <p className="text-slate-600 text-xs mt-1">{sub}</p>
    </div>
  )
}
