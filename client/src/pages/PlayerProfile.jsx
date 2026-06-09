import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { CareerLineChart } from '../components/StatChart'

const COLS = {
  passing: [
    { key: 'season', label: 'Season' },
    { key: 'team', label: 'Team' },
    { key: 'g', label: 'G' },
    { key: 'cmp', label: 'Cmp' },
    { key: 'att', label: 'Att' },
    { key: 'cmp_pct', label: 'Cmp%', format: (_, r) => r.att ? `${(100 * r.cmp / r.att).toFixed(1)}%` : '—' },
    { key: 'yds', label: 'Yds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'td', label: 'TD' },
    { key: 'int', label: 'INT' },
  ],
  offense: [
    { key: 'season', label: 'Season' },
    { key: 'team', label: 'Team' },
    { key: 'g', label: 'G' },
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yds', label: 'RecYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'rec_td', label: 'RecTD' },
    { key: 'att', label: 'RushAtt' },
    { key: 'rush_yds', label: 'RushYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'rush_td', label: 'RushTD' },
  ],
  defense: [
    { key: 'season', label: 'Season' },
    { key: 'team', label: 'Team' },
    { key: 'g', label: 'G' },
    { key: 'comb', label: 'Tkl' },
    { key: 'sk', label: 'Sacks' },
    { key: 'int', label: 'INT' },
    { key: 'pd', label: 'PD' },
    { key: 'ff', label: 'FF' },
  ],
  kicking: [
    { key: 'season', label: 'Season' },
    { key: 'team', label: 'Team' },
    { key: 'g', label: 'G' },
    { key: 'fgm_total', label: 'FGM' },
    { key: 'fga_total', label: 'FGA' },
    { key: 'fg_pct', label: 'FG%', format: (_, r) => r.fga_total ? `${(100 * r.fgm_total / r.fga_total).toFixed(1)}%` : '—' },
    { key: 'xpm', label: 'XPM' },
    { key: 'xpa', label: 'XPA' },
  ],
  punting: [
    { key: 'season', label: 'Season' },
    { key: 'team', label: 'Team' },
    { key: 'g', label: 'G' },
    { key: 'pnt', label: 'Punts' },
    { key: 'yds', label: 'Yds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'netyds', label: 'NetYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'tb', label: 'TB' },
    { key: 'pnt20', label: 'In20' },
  ],
  returns: [
    { key: 'season', label: 'Season' },
    { key: 'team', label: 'Team' },
    { key: 'g', label: 'G' },
    { key: 'punt_ret', label: 'PR' },
    { key: 'punt_ret_yds', label: 'PRYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'punt_ret_td', label: 'PRTD' },
    { key: 'kick_ret', label: 'KR' },
    { key: 'kick_ret_yds', label: 'KRYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'kick_ret_td', label: 'KRTD' },
  ],
}

const CHART_LINES = {
  passing: [
    { dataKey: 'yds', label: 'Pass Yards', color: '#3b82f6' },
    { dataKey: 'td', label: 'TDs', color: '#22c55e' },
    { dataKey: 'int', label: 'INTs', color: '#ef4444' },
  ],
  offense: [
    { dataKey: 'yscm', label: 'Scrimmage Yards', color: '#3b82f6' },
    { dataKey: 'rrtd', label: 'TDs', color: '#22c55e' },
  ],
  defense: [
    { dataKey: 'comb', label: 'Tackles', color: '#3b82f6' },
    { dataKey: 'sk', label: 'Sacks', color: '#f59e0b' },
  ],
}

function fmtHt(ht) {
  if (!ht) return null
  const [ft, inch] = ht.split('_')
  return `${ft}'${inch}"`
}

export default function PlayerProfile() {
  const { id } = useParams()
  const { data: profile, loading, error } = useApi(() => api.getPlayer(id), [id])

  if (loading) return <Loading text="Loading player…" />
  if (error)   return <ErrorMsg message={error} />
  if (!profile) return null

  const { player, categories, draft, combine } = profile

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{player.player_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {player.pos}
              </span>
              <span className="text-slate-400 text-sm">
                {player.first_season}–{player.last_season} · {player.n_seasons} seasons
              </span>
            </div>
          </div>
          {draft && (
            <div className="text-right shrink-0">
              <p className="text-slate-400 text-sm">Round {draft.round}, Pick {draft.pick} ({draft.draft_year})</p>
              <p className="text-slate-400 text-sm">{draft.team}{draft.college ? ` · ${draft.college}` : ''}</p>
              {draft.career_av != null && (
                <p className="text-blue-400 font-semibold mt-1">Career AV: {draft.career_av}</p>
              )}
            </div>
          )}
        </div>

        {/* Combine measurements */}
        {combine && (
          <div className="mt-5 pt-5 border-t border-slate-700">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Combine</p>
            <div className="flex gap-3 flex-wrap">
              {[
                ['Height',     fmtHt(combine.ht)],
                ['Weight',     combine.wt         ? `${combine.wt} lbs`       : null],
                ['40-yard',    combine._40yd       ? `${combine._40yd}s`       : null],
                ['Vertical',   combine.vertical    ? `${combine.vertical}"`    : null],
                ['Broad Jump', combine.broad_jump  ? `${combine.broad_jump}"`  : null],
                ['Bench',      combine.bench       ? `${combine.bench} reps`   : null],
                ['3-Cone',     combine._3cone      ? `${combine._3cone}s`      : null],
                ['Shuttle',    combine.shuttle     ? `${combine.shuttle}s`     : null],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} className="bg-slate-900 rounded-xl px-4 py-2.5 text-center min-w-[4.5rem]">
                  <p className="text-slate-500 text-xs">{label}</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* One card per box-score category */}
      {categories.map(cat => {
        const cols = COLS[cat.category]
        const lines = CHART_LINES[cat.category]
        if (!cols) return null
        return (
          <div key={cat.category} className="bg-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-semibold capitalize">{cat.category}</h2>
            {lines && cat.seasons.length > 1 && (
              <CareerLineChart data={cat.seasons} xKey="season" lines={lines} />
            )}
            <StatTable columns={cols} rows={cat.seasons} keyField="season" />
            {cat.career && (
              <div className="bg-slate-900 rounded-xl px-4 py-3 text-sm text-slate-400">
                <span className="text-slate-200 font-medium">Career: </span>
                {Object.entries(cat.career)
                  .filter(([k]) => k !== 'player_id')
                  .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toLocaleString() : v}`)
                  .join(' · ')}
              </div>
            )}
          </div>
        )
      })}

      <div className="text-center pb-4">
        <Link to="/comparison" className="text-blue-400 hover:text-blue-300 text-sm">
          Compare {player.player_name} with another player →
        </Link>
      </div>
    </div>
  )
}
