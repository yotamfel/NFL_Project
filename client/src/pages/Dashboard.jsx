import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

function fmt(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

export default function Dashboard() {
  const { username, dashboards, saved, saveDashboard, removeDashboard } = useUser()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const create = e => {
    e.preventDefault()
    if (!name.trim()) return
    const id = saveDashboard(name.trim())
    setName('')
    navigate(`/dashboard/${id}`)
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (confirmDelete === id) {
      removeDashboard(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  const totalSaved = (saved.charts?.length ?? 0) + (saved.tables?.length ?? 0)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-0.5">{username}</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Dashboards</h1>
        <p className="text-slate-500 text-sm mt-1">
          {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}
          {totalSaved > 0 && ` · ${totalSaved} saved item${totalSaved !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* Saved items hint */}
      {totalSaved === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700/60 px-5 py-4 text-sm text-slate-500">
          <span className="text-slate-300 font-medium">Tip:</span> hover over any chart or table and click the{' '}
          <span className="text-amber-400">bookmark icon</span> to save it — then add it to a dashboard here.
        </div>
      )}

      {/* Create new */}
      <form onSubmit={create} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New dashboard name…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
        >
          Create
        </button>
      </form>

      {/* Dashboard grid */}
      {dashboards.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-700/60">
          <div className="text-slate-600 mb-3 flex justify-center">
            <GridIcon />
          </div>
          <p className="text-slate-400 text-sm font-medium">No dashboards yet.</p>
          <p className="text-slate-600 text-xs mt-1">Create one above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <div
              key={d.id}
              onClick={() => navigate(`/dashboard/${d.id}`)}
              className="group relative rounded-xl border border-slate-700/60 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer p-5"
            >
              {/* Delete button */}
              <button
                onClick={e => handleDelete(e, d.id)}
                onBlur={() => setConfirmDelete(null)}
                className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-lg transition-colors ${
                  confirmDelete === d.id
                    ? 'text-red-400 bg-red-400/10 border border-red-400/30'
                    : 'text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
                }`}
              >
                {confirmDelete === d.id ? 'Confirm' : '×'}
              </button>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-700/50 text-slate-400 mt-0.5 shrink-0">
                  <GridIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate pr-6">{d.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {d.widgets.length} widget{d.widgets.length !== 1 ? 's' : ''}
                    {' · '}Updated {fmt(d.updatedAt)}
                  </p>
                </div>
              </div>

              {/* Widget type summary */}
              {d.widgets.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {['chart', 'table', 'heading', 'text'].map(type => {
                    const count = d.widgets.filter(w => w.type === type).length
                    if (!count) return null
                    return (
                      <span key={type} className="text-xs bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">
                        {count} {type}{count !== 1 ? 's' : ''}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
