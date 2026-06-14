import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { posColor } from '../utils/posColors'

const TABS = [
  { id: 'players',     label: 'Players',     icon: '⭐' },
  { id: 'comparisons', label: 'Comparisons', icon: '⚖️' },
  { id: 'searches',    label: 'Searches',    icon: '🔍' },
  { id: 'notes',       label: 'Notes',       icon: '📝' },
]

function fmt(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Saved() {
  const { username, saved, removePlayer, removeComparison, removeSearch, removeNote, addNote,
          updatePlayerNote, updateComparisonNote, updateSearchNote } = useUser()
  const [tab, setTab]         = useState('players')
  const [note, setNote]       = useState('')
  const [editingNote, setEditingNote] = useState(null)  // { type: 'player'|'comparison'|'search', id }
  const [noteText, setNoteText]       = useState('')
  const navigate              = useNavigate()

  const startEditNote = (type, id, current) => { setEditingNote({ type, id }); setNoteText(current ?? '') }
  const isEditingNote = (type, id) => editingNote?.type === type && editingNote?.id === id
  const commitNote = () => {
    if (!editingNote) return
    const text = noteText.trim()
    if (editingNote.type === 'player')      updatePlayerNote(editingNote.id, text)
    if (editingNote.type === 'comparison')  updateComparisonNote(editingNote.id, text)
    if (editingNote.type === 'search')      updateSearchNote(editingNote.id, text)
    setEditingNote(null)
  }

  const total = saved.players.length + saved.comparisons.length + saved.searches.length + saved.notes.length

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
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}>
            <span>{t.icon}</span>
            {t.label}
            {saved[t.id]?.length > 0 && (
              <span className="text-xs bg-slate-600 text-slate-300 rounded-full px-1.5 py-0.5 leading-none">
                {saved[t.id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Players ────────────────────────────────────────────── */}
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
                    <button onClick={() => removePlayer(p.player_id)} className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
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

      {/* ── Comparisons ─────────────────────────────────────────── */}
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
                <button onClick={() => removeComparison(i)} className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
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

      {/* ── Searches ────────────────────────────────────────────── */}
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
                  <button onClick={e => { e.preventDefault(); removeSearch(i) }} className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                </div>
              </summary>
              {s.rows.length > 0 && (
                <div className="border-t border-slate-700/60 scroll-x">
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

      {/* ── Notes ───────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && note.trim()) { addNote(note.trim()); setNote('') } }}
              placeholder="Write a discovery or note… (Enter to save)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              onClick={() => { if (note.trim()) { addNote(note.trim()); setNote('') } }}
              disabled={!note.trim()}
              className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
            >
              Save
            </button>
          </div>

          {saved.notes.length === 0 && <Empty text="No notes yet." sub="Type something interesting you discovered and press Enter." />}

          {saved.notes.map(n => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl px-4 py-3 border border-slate-700/60 bg-slate-800/50">
              <p className="flex-1 text-slate-200 text-sm leading-relaxed">{n.text}</p>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span className="text-slate-600 text-xs hidden sm:block">{fmt(n.saved_at)}</span>
                <button onClick={() => removeNote(n.id)} className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteField({ value, editing, noteText, setNoteText, onStart, onCommit, onCancel }) {
  if (editing) {
    return (
      <div className="flex gap-2 mt-1">
        <input
          autoFocus
          type="text"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
          placeholder="Add a note…"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <button
          onMouseDown={e => { e.preventDefault(); onCommit() }}
          className="text-xs text-amber-400 hover:text-amber-300 px-2 font-medium"
        >Save</button>
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
