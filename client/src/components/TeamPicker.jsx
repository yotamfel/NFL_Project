import { useState } from 'react'

export const NFL_STRUCTURE = {
  AFC: {
    East: ['BUF','MIA','NE','NYJ'],
    North: ['BAL','CIN','CLE','PIT'],
    South: ['HOU','IND','JAX','TEN'],
    West: ['DEN','KC','LAC','LV'],
  },
  NFC: {
    East: ['DAL','NYG','PHI','WAS'],
    North: ['CHI','DET','GB','MIN'],
    South: ['ATL','CAR','NO','TB'],
    West: ['ARI','LAR','SEA','SF'],
  },
}

export const ALL_TEAMS = Object.values(NFL_STRUCTURE).flatMap(conf => Object.values(conf).flat()).sort()

export default function TeamPicker({ selected, setSelected }) {
  const [open, setOpen] = useState(false)

  const toggleTeams = (teams) => {
    const allIn = teams.every(t => selected.includes(t))
    setSelected(prev => allIn ? prev.filter(t => !teams.includes(t)) : [...new Set([...prev, ...teams])])
  }
  const confTeams = (conf) => Object.values(NFL_STRUCTURE[conf]).flat()
  const divTeams = (conf, div) => NFL_STRUCTURE[conf][div]

  const label = selected.length === 0 ? 'All teams'
    : selected.length <= 3 ? selected.join(', ')
    : `${selected.length} teams`

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`px-2.5 py-1 rounded text-xs border transition-colors flex items-center gap-1 ${selected.length > 0 ? 'bg-amber-500/15 text-amber-400 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
        {label} <span className="text-slate-600 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-3 w-[340px] max-h-[400px] overflow-y-auto">
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-xs text-red-400 hover:text-red-300 mb-2">Clear all</button>
          )}
          {Object.entries(NFL_STRUCTURE).map(([conf, divs]) => (
            <div key={conf} className="mb-3">
              <button onClick={() => toggleTeams(confTeams(conf))}
                className={`text-xs font-bold mb-1 px-2 py-0.5 rounded transition-colors ${confTeams(conf).every(t => selected.includes(t)) ? 'bg-amber-500/20 text-amber-400' : 'text-slate-300 hover:text-white'}`}>
                {conf}
              </button>
              {Object.entries(divs).map(([div, teams]) => (
                <div key={div} className="flex items-center gap-1 mb-1 ml-2">
                  <button onClick={() => toggleTeams(divTeams(conf, div))}
                    className={`text-[10px] w-14 text-left px-1 py-0.5 rounded transition-colors ${teams.every(t => selected.includes(t)) ? 'text-amber-400 font-semibold' : 'text-slate-500 hover:text-slate-300'}`}>
                    {div}
                  </button>
                  {teams.map(t => (
                    <button key={t} onClick={() => toggleTeams([t])}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${selected.includes(t) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700/50 hover:text-slate-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
