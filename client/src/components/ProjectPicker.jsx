import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function ProjectPicker({ type, label, data, onDone }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open && user?.is_admin) {
      api.getProjects().then(setProjects).catch(() => {})
    }
  }, [open, user?.is_admin])

  if (!user?.is_admin) return null

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createAndSelect = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const p = await api.createProject(name)
      setProjects(prev => [...prev, p])
      setSelected(prev => new Set(prev).add(p.id))
      setNewName('')
    } catch {}
  }

  const save = async () => {
    setSaving(true)
    try {
      const item = await api.createSaved({ type, label, data, note: note.trim() || undefined })
      if (selected.size > 0) {
        await api.assignToProjects(item.id, [...selected])
      }
      onDone?.()
    } catch {}
    setSaving(false)
    setOpen(false)
    setSelected(new Set())
    setNote('')
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-amber-500 hover:text-amber-300 transition-colors ml-2">
        + Project
      </button>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mt-2 space-y-3">
      <p className="text-xs font-semibold text-slate-400">Save to projects:</p>

      {projects.length === 0 && (
        <p className="text-slate-600 text-xs">No projects yet - create one below</p>
      )}

      <div className="space-y-1.5">
        {projects.map(p => (
          <label key={p.id} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
              className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30" />
            <span className="text-slate-300 text-xs">{p.name}</span>
            <span className="text-slate-600 text-xs">({p.item_count ?? 0})</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New project name..."
          onKeyDown={e => e.key === 'Enter' && createAndSelect()}
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/40 placeholder-slate-600" />
        <button onClick={createAndSelect} disabled={!newName.trim()}
          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-40">
          Create
        </button>
      </div>

      <textarea value={note} onChange={e => setNote(e.target.value)}
        placeholder="Add a note (optional)..."
        rows={2}
        className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/40 placeholder-slate-600 resize-none" />

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving}
          className="text-xs px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors disabled:opacity-50">
          {saving ? '...' : selected.size > 0 ? `Save to ${selected.size} project${selected.size > 1 ? 's' : ''}` : 'Save (no project)'}
        </button>
        <button onClick={() => { setOpen(false); setSelected(new Set()) }}
          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
