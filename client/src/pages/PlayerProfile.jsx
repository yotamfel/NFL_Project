import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { CareerLineChart } from '../components/StatChart'
import { posColor, posGradient, CARD_STRIPES } from '../utils/posColors'

const COLS = {
  passing: [
    { key: 'season', label: 'Season' },
    { key: 'team',   label: 'Team' },
    { key: 'g',      label: 'G' },
    { key: 'cmp',    label: 'Cmp' },
    { key: 'att',    label: 'Att' },
    { key: 'cmp_pct', label: 'Cmp%', format: (_, r) => r.att ? `${(100 * r.cmp / r.att).toFixed(1)}%` : '—' },
    { key: 'yds',    label: 'Yds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'td',     label: 'TD' },
    { key: 'int',    label: 'INT' },
  ],
  offense: [
    { key: 'season',    label: 'Season' },
    { key: 'team',      label: 'Team' },
    { key: 'g',         label: 'G' },
    { key: 'rec',       label: 'Rec' },
    { key: 'rec_yds',   label: 'RecYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'rec_td',    label: 'RecTD' },
    { key: 'att',       label: 'RushAtt' },
    { key: 'rush_yds',  label: 'RushYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'rush_td',   label: 'RushTD' },
  ],
  defense: [
    { key: 'season', label: 'Season' },
    { key: 'team',   label: 'Team' },
    { key: 'g',      label: 'G' },
    { key: 'comb',   label: 'Tkl' },
    { key: 'sk',     label: 'Sacks' },
    { key: 'int',    label: 'INT' },
    { key: 'pd',     label: 'PD' },
    { key: 'ff',     label: 'FF' },
  ],
  kicking: [
    { key: 'season',    label: 'Season' },
    { key: 'team',      label: 'Team' },
    { key: 'g',         label: 'G' },
    { key: 'fgm_total', label: 'FGM' },
    { key: 'fga_total', label: 'FGA' },
    { key: 'fg_pct',    label: 'FG%', format: (_, r) => r.fga_total ? `${(100 * r.fgm_total / r.fga_total).toFixed(1)}%` : '—' },
    { key: 'xpm',       label: 'XPM' },
    { key: 'xpa',       label: 'XPA' },
  ],
  punting: [
    { key: 'season',  label: 'Season' },
    { key: 'team',    label: 'Team' },
    { key: 'g',       label: 'G' },
    { key: 'pnt',     label: 'Punts' },
    { key: 'yds',     label: 'Yds',    format: v => v?.toLocaleString() ?? '—' },
    { key: 'netyds',  label: 'NetYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'tb',      label: 'TB' },
    { key: 'pnt20',   label: 'In20' },
  ],
  returns: [
    { key: 'season',       label: 'Season' },
    { key: 'team',         label: 'Team' },
    { key: 'g',            label: 'G' },
    { key: 'punt_ret',     label: 'PR' },
    { key: 'punt_ret_yds', label: 'PRYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'punt_ret_td',  label: 'PRTD' },
    { key: 'kick_ret',     label: 'KR' },
    { key: 'kick_ret_yds', label: 'KRYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'kick_ret_td',  label: 'KRTD' },
  ],
}

const CHART_LINES = {
  passing: [
    { dataKey: 'yds', label: 'Pass Yards', color: '#3b82f6' },
    { dataKey: 'td',  label: 'TDs',        color: '#22c55e' },
    { dataKey: 'int', label: 'INTs',       color: '#ef4444' },
  ],
  offense: [
    { dataKey: 'yscm', label: 'Scrimmage Yards', color: '#f59e0b' },
    { dataKey: 'rrtd', label: 'TDs',             color: '#22c55e' },
  ],
  defense: [
    { dataKey: 'comb', label: 'Tackles', color: '#f87171' },
    { dataKey: 'sk',   label: 'Sacks',   color: '#fbbf24' },
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
  const c = posColor(player.pos)

  return (
    <div className="space-y-5">

      {/* Header card — trading card style with position gradient */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: posGradient(player.pos), border: `1px solid ${c.mid}33` }}>
        {/* Foil stripe texture overlay */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: CARD_STRIPES }} />
        {/* Top accent bar */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${c.hex}, ${c.mid}, transparent)` }} />

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              {/* Position badge */}
              <span className="inline-block text-xs font-black px-3 py-1 rounded-full mb-3 tracking-widest uppercase"
                style={{ background: c.mid, color: c.hex, border: `1px solid ${c.hex}44` }}>
                {player.pos}
              </span>
              <h1 className="text-4xl font-black text-white tracking-tight leading-none">
                {player.player_name}
              </h1>
              <p className="text-slate-400 text-sm mt-2">
                {player.first_season}–{player.last_season} &nbsp;·&nbsp; {player.n_seasons} seasons
              </p>
            </div>
            {draft && (
              <div className="sm:text-right shrink-0 bg-black/20 rounded-xl px-4 py-3">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Draft</p>
                <p className="text-white font-semibold text-sm">
                  Round {draft.round}, Pick {draft.pick} &middot; {draft.draft_year}
                </p>
                <p className="text-slate-400 text-sm">{draft.team}{draft.college ? ` · ${draft.college}` : ''}</p>
                {draft.career_av != null && (
                  <p className="font-bold mt-1" style={{ color: c.hex }}>Career AV: {draft.career_av}</p>
                )}
              </div>
            )}
          </div>

          {/* Combine measurements */}
          {combine && (
            <div className="mt-5 pt-5 border-t border-white/10">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: c.hex }}>
                Combine
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  ['Height',     fmtHt(combine.ht)],
                  ['Weight',     combine.wt        ? `${combine.wt} lbs`      : null],
                  ['40-yard',    combine._40yd      ? `${combine._40yd}s`      : null],
                  ['Vertical',   combine.vertical   ? `${combine.vertical}"`   : null],
                  ['Broad Jump', combine.broad_jump ? `${combine.broad_jump}"` : null],
                  ['Bench',      combine.bench      ? `${combine.bench} reps`  : null],
                  ['3-Cone',     combine._3cone     ? `${combine._3cone}s`     : null],
                  ['Shuttle',    combine.shuttle    ? `${combine.shuttle}s`    : null],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="rounded-xl px-4 py-2.5 text-center min-w-[4.5rem]"
                    style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${c.mid}44` }}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className="font-bold text-sm mt-0.5" style={{ color: c.hex }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat sections */}
      {categories.map(cat => {
        const cols  = COLS[cat.category]
        const lines = CHART_LINES[cat.category]
        if (!cols) return null
        return (
          <div key={cat.category} className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold capitalize flex items-center gap-2">
              <span className="w-1 h-5 rounded-full" style={{ background: c.hex }} />
              {cat.category}
            </h2>
            {lines && cat.seasons.length > 1 && (
              <CareerLineChart data={cat.seasons} xKey="season" lines={lines} />
            )}
            <StatTable columns={cols} rows={cat.seasons} keyField="season" />
            {cat.career && (
              <div className="rounded-xl px-4 py-3 text-sm text-slate-400"
                style={{ background: 'rgba(0,0,0,0.25)', borderLeft: `3px solid ${c.mid}` }}>
                <span className="text-slate-200 font-semibold">Career: </span>
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
        <Link to="/comparison" className="text-sm transition-colors hover:opacity-80"
          style={{ color: c.hex }}>
          Compare {player.player_name} with another player →
        </Link>
      </div>
    </div>
  )
}
