import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { CareerLineChart } from '../components/StatChart'
import { posColor, posGradient, CARD_STRIPES } from '../utils/posColors'
import { useUser } from '../context/UserContext'
import { STAT_DEFS } from '../utils/statDefinitions'

const pct1  = v => v != null ? `${Number(v).toFixed(1)}%`   : '—'
const dec1  = v => v != null ? Number(v).toFixed(1)          : '—'
const loc   = v => v?.toLocaleString() ?? '—'

// Each category has { basic: [...cols], advanced: [...cols] }
const COLS = {
  passing: {
    basic: [
      { key: 'season',  label: 'Season' },
      { key: 'team',    label: 'Team' },
      { key: 'g',       label: 'G',    desc: STAT_DEFS.g },
      { key: 'cmp',     label: 'Cmp',  desc: STAT_DEFS.cmp },
      { key: 'att',     label: 'Att',  desc: STAT_DEFS.att },
      { key: 'cmp_pct', label: 'Cmp%', format: (_, r) => r.att ? `${(100 * r.cmp / r.att).toFixed(1)}%` : '—' },
      { key: 'yds',     label: 'Yds',  desc: STAT_DEFS.yds,  format: loc },
      { key: 'td',      label: 'TD',   desc: STAT_DEFS.td },
      { key: 'int',     label: 'INT',  desc: STAT_DEFS.int },
    ],
    advanced: [
      { key: 'season',   label: 'Season' },
      { key: 'team',     label: 'Team' },
      { key: 'g',        label: 'G',      desc: STAT_DEFS.g },
      { key: 'rate',     label: 'Rate',   desc: STAT_DEFS.rate,     format: dec1 },
      { key: 'qbr',      label: 'QBR',    desc: STAT_DEFS.qbr,      format: dec1 },
      { key: 'y_per_a',  label: 'Y/A',    desc: STAT_DEFS.y_per_a,  format: dec1 },
      { key: 'ay_per_a', label: 'AY/A',   desc: STAT_DEFS.ay_per_a, format: dec1 },
      { key: 'any_per_a',label: 'ANY/A',  desc: STAT_DEFS.any_per_a,format: dec1 },
      { key: 'sk',       label: 'Sacks',  desc: STAT_DEFS.sk },
      { key: 'sk_pct',   label: 'Sk%',    desc: STAT_DEFS.sk_pct,   format: pct1 },
      { key: '_4qc',     label: '4QC',    desc: STAT_DEFS._4qc },
      { key: 'gwd',      label: 'GWD',    desc: STAT_DEFS.gwd },
    ],
  },

  offense: {
    basic: [
      { key: 'season',   label: 'Season' },
      { key: 'team',     label: 'Team' },
      { key: 'g',        label: 'G',        desc: STAT_DEFS.g },
      { key: 'rec',      label: 'Rec',      desc: STAT_DEFS.rec },
      { key: 'rec_yds',  label: 'RecYds',   desc: STAT_DEFS.rec_yds,  format: loc },
      { key: 'rec_td',   label: 'RecTD',    desc: STAT_DEFS.rec_td },
      { key: 'att',      label: 'RushAtt' },
      { key: 'rush_yds', label: 'RushYds',  desc: STAT_DEFS.rush_yds, format: loc },
      { key: 'rush_td',  label: 'RushTD',   desc: STAT_DEFS.rush_td },
    ],
    advanced: [
      { key: 'season',          label: 'Season' },
      { key: 'team',            label: 'Team' },
      { key: 'g',               label: 'G',       desc: STAT_DEFS.g },
      { key: 'tgt',             label: 'Tgt',     desc: STAT_DEFS.tgt },
      { key: 'ctch_pct',        label: 'Ctch%',   desc: STAT_DEFS.ctch_pct,        format: pct1 },
      { key: 'y_per_tgt',       label: 'Y/Tgt',   desc: STAT_DEFS.y_per_tgt,       format: dec1 },
      { key: 'y_per_r',         label: 'Y/Rec',   desc: STAT_DEFS.y_per_r,         format: dec1 },
      { key: 'rec_lng',         label: 'RecLng',  desc: STAT_DEFS.rec_lng },
      { key: 'rush_lng',        label: 'RushLng', desc: STAT_DEFS.rush_lng },
      { key: 'rec_first_downs', label: 'RecFD',   desc: STAT_DEFS.rec_first_downs },
      { key: 'rush_first_downs',label: 'RushFD',  desc: STAT_DEFS.rush_first_downs },
      { key: 'fmb',             label: 'Fmb',     desc: STAT_DEFS.fmb },
    ],
  },

  defense: {
    basic: [
      { key: 'season', label: 'Season' },
      { key: 'team',   label: 'Team' },
      { key: 'g',      label: 'G',     desc: STAT_DEFS.g },
      { key: 'comb',   label: 'Tkl',   desc: STAT_DEFS.comb },
      { key: 'sk',     label: 'Sacks', desc: STAT_DEFS.sk },
      { key: 'int',    label: 'INT',   desc: STAT_DEFS.int },
      { key: 'pd',     label: 'PD',    desc: STAT_DEFS.pd },
      { key: 'ff',     label: 'FF',    desc: STAT_DEFS.ff },
    ],
    advanced: [
      { key: 'season',      label: 'Season' },
      { key: 'team',        label: 'Team' },
      { key: 'g',           label: 'G',        desc: STAT_DEFS.g },
      { key: 'solo',        label: 'Solo',      desc: STAT_DEFS.solo },
      { key: 'ast',         label: 'Ast',       desc: STAT_DEFS.ast },
      { key: 'tfl',         label: 'TFL',       desc: STAT_DEFS.tfl },
      { key: 'qb_hits',     label: 'QB Hits',   desc: STAT_DEFS.qb_hits },
      { key: 'int_ret_yds', label: 'INT Yds',   desc: STAT_DEFS.int_ret_yds, format: loc },
      { key: 'int_td',      label: 'Pick-6',    desc: STAT_DEFS.int_td },
      { key: 'fr_td',       label: 'FR TD',     desc: STAT_DEFS.fr_td },
      { key: 'sfty',        label: 'Sfty',      desc: STAT_DEFS.sfty },
    ],
  },

  kicking: {
    basic: [
      { key: 'season',    label: 'Season' },
      { key: 'team',      label: 'Team' },
      { key: 'g',         label: 'G',    desc: STAT_DEFS.g },
      { key: 'fgm_total', label: 'FGM',  desc: STAT_DEFS.fgm_total },
      { key: 'fga_total', label: 'FGA',  desc: STAT_DEFS.fga_total },
      { key: 'fg_pct',    label: 'FG%',  format: (_, r) => r.fga_total ? `${(100 * r.fgm_total / r.fga_total).toFixed(1)}%` : '—' },
      { key: 'xpm',       label: 'XPM',  desc: STAT_DEFS.xpm },
      { key: 'xpa',       label: 'XPA',  desc: STAT_DEFS.xpa },
    ],
    advanced: [
      { key: 'season',      label: 'Season' },
      { key: 'team',        label: 'Team' },
      { key: 'g',           label: 'G',        desc: STAT_DEFS.g },
      { key: 'fgm_20_29',   label: 'FGM 20-29',desc: STAT_DEFS.fgm_20_29 },
      { key: 'fgm_30_39',   label: 'FGM 30-39',desc: STAT_DEFS.fgm_30_39 },
      { key: 'fgm_40_49',   label: 'FGM 40-49',desc: STAT_DEFS.fgm_40_49 },
      { key: 'fgm_50_plus', label: 'FGM 50+',  desc: STAT_DEFS.fgm_50_plus },
      { key: 'fga_40_49',   label: 'FGA 40-49',desc: STAT_DEFS.fga_40_49 },
      { key: 'fga_50_plus', label: 'FGA 50+',  desc: STAT_DEFS.fga_50_plus },
      { key: 'koavg',       label: 'KO Avg',   desc: STAT_DEFS.koavg,  format: dec1 },
      { key: 'tb',          label: 'TB',        desc: STAT_DEFS.tb },
      { key: 'tb_pct',      label: 'TB%',       desc: STAT_DEFS.tb_pct, format: pct1 },
    ],
  },

  punting: {
    basic: [
      { key: 'season',  label: 'Season' },
      { key: 'team',    label: 'Team' },
      { key: 'g',       label: 'G',      desc: STAT_DEFS.g },
      { key: 'pnt',     label: 'Punts',  desc: STAT_DEFS.pnt },
      { key: 'yds',     label: 'Yds',    format: loc },
      { key: 'netyds',  label: 'NetYds', desc: STAT_DEFS.netyds, format: loc },
      { key: 'tb',      label: 'TB',     desc: STAT_DEFS.tb },
      { key: 'pnt20',   label: 'In20',   desc: STAT_DEFS.pnt20 },
    ],
    advanced: [
      { key: 'season',   label: 'Season' },
      { key: 'team',     label: 'Team' },
      { key: 'g',        label: 'G',         desc: STAT_DEFS.g },
      { key: 'y_per_p',  label: 'Y/Punt',    desc: STAT_DEFS.y_per_p,  format: dec1 },
      { key: 'ny_per_p', label: 'Net Y/Punt', desc: STAT_DEFS.ny_per_p, format: dec1 },
      { key: 'retyds',   label: 'Ret Yds',   desc: STAT_DEFS.retyds,   format: loc },
      { key: 'blck',     label: 'Blk',        desc: STAT_DEFS.blck },
      { key: 'in20_pct', label: 'In20%',      desc: STAT_DEFS.in20_pct, format: pct1 },
    ],
  },

  returns: {
    basic: [
      { key: 'season',       label: 'Season' },
      { key: 'team',         label: 'Team' },
      { key: 'g',            label: 'G',      desc: STAT_DEFS.g },
      { key: 'punt_ret',     label: 'PR',     desc: STAT_DEFS.punt_ret },
      { key: 'punt_ret_yds', label: 'PRYds',  desc: STAT_DEFS.punt_ret_yds, format: loc },
      { key: 'punt_ret_td',  label: 'PRTD',   desc: STAT_DEFS.punt_ret_td },
      { key: 'kick_ret',     label: 'KR',     desc: STAT_DEFS.kick_ret },
      { key: 'kick_ret_yds', label: 'KRYds',  desc: STAT_DEFS.kick_ret_yds, format: loc },
      { key: 'kick_ret_td',  label: 'KRTD',   desc: STAT_DEFS.kick_ret_td },
    ],
    advanced: [
      { key: 'season',         label: 'Season' },
      { key: 'team',           label: 'Team' },
      { key: 'g',              label: 'G',          desc: STAT_DEFS.g },
      { key: 'y_per_punt_ret', label: 'Y/PR',       desc: STAT_DEFS.y_per_punt_ret, format: dec1 },
      { key: 'y_per_kick_ret', label: 'Y/KR',       desc: STAT_DEFS.y_per_kick_ret, format: dec1 },
      { key: 'punt_ret_lng',   label: 'PR Lng',     desc: STAT_DEFS.punt_ret_lng },
      { key: 'kick_ret_lng',   label: 'KR Lng',     desc: STAT_DEFS.kick_ret_lng },
      { key: 'apyd',           label: 'All-Purpose',desc: STAT_DEFS.apyd, format: loc },
    ],
  },
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
  const [advancedSections, setAdvancedSections] = useState(new Set())

  const toggleAdvanced = cat => setAdvancedSections(prev => {
    const next = new Set(prev)
    if (next.has(cat)) next.delete(cat) else next.add(cat)
    return next
  })

  if (loading) return <Loading text="Loading player…" />
  if (error)   return <ErrorMsg message={error} />
  if (!profile) return null

  const { player, categories, draft, combine } = profile
  const c = posColor(player.pos)
  const { savePlayer, removePlayer, isPlayerSaved } = useUser()
  const saved = isPlayerSaved(player.player_id)

  return (
    <div className="space-y-5">

      {/* Header card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: posGradient(player.pos), border: `1px solid ${c.mid}33` }}>
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: CARD_STRIPES }} />
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${c.hex}, ${c.mid}, transparent)` }} />

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
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
            <button
              onClick={() => saved ? removePlayer(player.player_id) : savePlayer(player)}
              title={saved ? 'Remove from saved' : 'Save player'}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all"
              style={{
                background: saved ? `${c.mid}40` : 'rgba(0,0,0,0.3)',
                border: `1px solid ${saved ? c.hex : 'rgba(255,255,255,0.1)'}`,
                color: saved ? c.hex : '#64748b',
              }}
            >
              {saved ? '★' : '☆'}
            </button>

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
        const colSet = COLS[cat.category]
        if (!colSet) return null
        const isAdv = advancedSections.has(cat.category)
        const cols  = isAdv ? colSet.advanced : colSet.basic
        const lines = CHART_LINES[cat.category]

        return (
          <div key={cat.category} className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold capitalize flex items-center gap-2">
                <span className="w-1 h-5 rounded-full" style={{ background: c.hex }} />
                {cat.category}
              </h2>
              {/* Basic / Advanced toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
                <button
                  onClick={() => isAdv && toggleAdvanced(cat.category)}
                  className={`px-3 py-1 transition-colors ${!isAdv ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  Basic
                </button>
                <button
                  onClick={() => !isAdv && toggleAdvanced(cat.category)}
                  className={`px-3 py-1 transition-colors ${isAdv ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  Advanced
                </button>
              </div>
            </div>

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
