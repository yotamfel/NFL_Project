import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
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

// Each category maps to an array of chart groups.
// Each group is rendered as a separate CareerLineChart with its own Y-axis.
const CHART_GROUPS = {
  passing: [
    [{ dataKey: 'yds', label: 'Pass Yards', color: '#3b82f6' }],
    [
      { dataKey: 'td',  label: 'TDs',  color: '#22c55e' },
      { dataKey: 'int', label: 'INTs', color: '#ef4444' },
    ],
  ],
  offense: [
    [{ dataKey: 'yscm', label: 'Scrimmage Yards', color: '#f59e0b' }],
    [
      { dataKey: 'rec_td',  label: 'Rec TDs',  color: '#22c55e' },
      { dataKey: 'rush_td', label: 'Rush TDs', color: '#a78bfa' },
    ],
  ],
  defense: [
    [
      { dataKey: 'comb', label: 'Tackles', color: '#f87171' },
      { dataKey: 'sk',   label: 'Sacks',   color: '#fbbf24' },
    ],
  ],
}

function fmtHt(ht) {
  if (!ht) return null
  const [ft, inch] = ht.split('_')
  return `${ft}'${inch}"`
}

// ── Injury History section ────────────────────────────────────────────────────
const STATUS_COLOR = { Out: '#ef4444', Doubtful: '#f97316', Questionable: '#f59e0b', Note: '#94a3b8' }

function InjurySection({ playerId, accentColor }) {
  const { data, loading } = useApi(() => api.getInjuries(playerId), [playerId])
  if (loading) return null
  const seasons = data?.seasons ?? []
  if (!seasons.length) return null

  // Show seasons with official Out/Doubtful entries OR 4+ estimated missed games (IR)
  const significant = seasons.filter(s =>
    s.games_missed > 0 ||
    s.games_doubtful > 0 ||
    (s.games_missed_approx ?? 0) >= 4
  )
  if (!significant.length) return null

  // Whether any row uses estimated missed games (shows footnote)
  const hasEst = significant.some(s =>
    (s.games_missed_approx ?? 0) > s.games_missed && (s.games_missed_approx ?? 0) >= 4
  )

  return (
    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-4">
      <h2 className="text-white font-bold flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: accentColor }} />
        Injury History
        <span className="text-slate-600 text-xs font-normal ml-1">2009+</span>
      </h2>

      <div className="scroll-x">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              <th className="text-left py-2 pr-4 font-medium">Season</th>
              <th className="text-center py-2 pr-4 font-medium">G</th>
              <th className="text-center py-2 pr-4 font-medium">
                <span className="text-red-400">Missed</span>
              </th>
              <th className="text-center py-2 pr-4 font-medium">
                <span className="text-orange-400">Doubtful</span>
              </th>
              <th className="text-center py-2 pr-4 font-medium">
                <span className="text-amber-400">Quest.</span>
              </th>
              <th className="text-left py-2 font-medium">Injuries</th>
            </tr>
          </thead>
          <tbody>
            {significant.map(row => {
              const approx = row.games_missed_approx ?? 0
              // Show estimated if it's higher than official (IR absences)
              const showEst = approx >= 4 && approx > row.games_missed
              const missedDisplay = showEst ? approx : row.games_missed
              return (
                <tr key={row.season}
                  className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-4 text-slate-300 font-medium">{row.season}</td>
                  <td className="py-2 pr-4 text-center text-slate-400 text-xs">
                    {row.games_played != null
                      ? `${row.games_played}/${row.games_expected}`
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {missedDisplay > 0
                      ? <span className="font-bold text-red-400">
                          {missedDisplay}{showEst ? <sup className="text-slate-500 font-normal ml-0.5">†</sup> : null}
                        </span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {row.games_doubtful > 0
                      ? <span className="font-semibold text-orange-400">{row.games_doubtful}</span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {row.games_questionable > 0
                      ? <span className="text-amber-400">{row.games_questionable}</span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {(row.injuries ?? []).map(inj => (
                        <span key={inj} className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                          {inj}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">
        G = games played / expected. Missed = games listed Out on official injury report.
        {hasEst && <> <sup>†</sup> estimated from games played — player likely on IR.</>}
        {' '}Seasons with 4+ missed games show red bands on career charts.
      </p>
    </div>
  )
}

// ── Advanced Receiving section ────────────────────────────────────────────────
const ADV_REC_POS = new Set(['WR','TE','RB','HB','FB'])

function AdvReceivingSection({ playerId, pos, accentColor }) {
  const { data, loading } = useApi(() => api.getAdvReceiving(playerId), [playerId])
  const [colTip, setColTip] = useState(null)
  if (!ADV_REC_POS.has(pos?.toUpperCase())) return null
  if (loading) return null
  if (!data || data.length === 0) return null

  const fmt1 = v => v != null ? Number(v).toFixed(1) : '—'
  const fmt2 = v => v != null ? Number(v).toFixed(2) : '—'
  const fmtPct = v => v != null ? `${(Number(v)*100).toFixed(1)}%` : '—'

  const showTip = (e, text) => {
    const r = e.currentTarget.getBoundingClientRect()
    setColTip({ text, x: Math.min(r.left, window.innerWidth - 236 - 12), y: r.bottom + 6 })
  }

  const cols = [
    { key: 'season',     label: 'Season' },
    { key: 'adot',       label: 'ADOT',    desc: 'Average Depth of Target — how deep (yards) the ball travels on passes thrown to this receiver.',         format: fmt1 },
    { key: 'yac_r',      label: 'YAC/Rec', desc: 'Yards After Catch per reception — yards gained after the ball is caught.',                               format: fmt1 },
    { key: 'ybc_r',      label: 'YBC/Rec', desc: 'Yards Before Catch per reception — air yards on completions only.',                                      format: fmt1 },
    { key: 'brk_tkl',    label: 'BrkTkl',  desc: 'Broken Tackles — number of tackle attempts the player evaded after the catch.',                          format: v => v ?? '—' },
    { key: 'drop',       label: 'Drops',   desc: 'Dropped Passes — catchable targets that were not held.',                                                  format: v => v ?? '—' },
    { key: 'drop_pct',   label: 'Drop%',   desc: 'Drop Percentage — drops divided by catchable targets. Lower is better.',                                  format: fmtPct },
    { key: 'tgt_rating', label: 'TgtRtg',  desc: 'Passer Rating when this player is the intended target (0–158.3 scale).',                                 format: fmt1 },
    { key: 'avg_sep',    label: 'Sep',     desc: 'Avg Separation (ft) from the nearest defender at the moment of the throw. Higher = more open. (NGS)',    format: fmt2 },
    { key: 'avg_cushion',label: 'Cush',    desc: 'Avg Cushion (ft) between receiver and corner at the snap. Higher = more room to work. (NGS)',            format: fmt2 },
    { key: 'yac_oe',     label: 'YAC+',    desc: 'YAC Above Expectation per reception — positive means the player gains more YAC than models predict. (NGS)', format: fmt2 },
  ]

  // Chart: ADOT + separation career trend
  const chartData = data.map(r => ({
    season: r.season,
    adot:    r.adot    != null ? Number(r.adot).toFixed(1)    : null,
    sep:     r.avg_sep != null ? Number(r.avg_sep).toFixed(2) : null,
    yac_oe:  r.yac_oe  != null ? Number(r.yac_oe).toFixed(2)  : null,
  }))

  return (
    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-4">
      <h2 className="text-white font-bold flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: accentColor }} />
        Advanced Receiving
        <span className="text-slate-600 text-xs font-normal ml-1">PFR 2018+ · NGS 2016+</span>
      </h2>

      {/* Mini chart: ADOT + YAC OE trend */}
      {data.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'adot',   label: 'ADOT (Avg Depth of Target)', color: accentColor },
            { key: 'yac_oe', label: 'YAC Above Expectation',       color: '#34d399' },
          ].map(({ key, label, color }) => {
            const pts = chartData.filter(d => d[key] != null)
            if (pts.length < 2) return null
            return (
              <div key={key}>
                <p className="text-xs text-slate-500 mb-2">{label}</p>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={pts} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="season" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} stroke="#475569" />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} stroke="#475569" width={30} />
                    <RTooltip cursor={{ fill: '#1e293b' }}
                      content={({ active, payload, label: l }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                            <p className="text-white font-bold">{l}</p>
                            <p style={{ color }}>{label}: {payload[0]?.value}</p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey={key} fill={color} fillOpacity={0.75} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="scroll-x">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              {cols.map((c, i) => (
                <th key={c.key}
                  className={`py-2 px-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
                  onMouseEnter={c.desc ? e => showTip(e, c.desc) : undefined}
                  onMouseLeave={c.desc ? () => setColTip(null) : undefined}
                >
                  {c.label}
                  {c.desc && <span className="text-slate-600 text-xs select-none cursor-help ml-1">ⓘ</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.season} className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                {cols.map((c, i) => (
                  <td key={c.key} className={`py-2 px-2 ${i === 0 ? 'text-slate-300 font-medium' : 'text-right text-white font-semibold'}`}>
                    {c.format ? c.format(row[c.key]) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">Sep/Cush/YAC+ from Next Gen Stats (2016+).</p>
      {colTip && (
        <div style={{ position: 'fixed', top: colTip.y, left: colTip.x, zIndex: 9999 }}
          className="pointer-events-none w-56 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-300 shadow-xl whitespace-normal leading-relaxed">
          {colTip.text}
        </div>
      )}
    </div>
  )
}

// ── Snap Counts section ───────────────────────────────────────────────────────
const SNAP_OFFENSE_POS = new Set(['QB','RB','WR','TE','OL','OT','OG','C','HB','FB'])
const SNAP_DEFENSE_POS = new Set(['DE','DT','DL','NT','LB','ILB','OLB','MLB','CB','S','FS','SS','DB'])

function SnapCountsSection({ playerId, pos, accentColor }) {
  const [snapData,     setSnapData]     = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [weekData,     setWeekData]     = useState(null)
  const [loading,      setLoading]      = useState(true)

  // Primary snap type for this position
  const snapKey = SNAP_DEFENSE_POS.has(pos?.toUpperCase()) ? 'defense_pct'
    : pos?.toUpperCase() === 'K' || pos?.toUpperCase() === 'P' ? 'st_pct'
    : 'offense_pct'
  const snapLabel = snapKey === 'defense_pct' ? 'Def Snap %'
    : snapKey === 'st_pct' ? 'ST Snap %' : 'Off Snap %'

  useEffect(() => {
    setLoading(true)
    api.getPlayerSnaps(playerId).then(d => {
      setSnapData(d)
      if (d.available?.length) setSelectedSeason(d.available[0])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [playerId])

  useEffect(() => {
    if (!selectedSeason) return
    api.getPlayerSnaps(playerId, selectedSeason).then(d => setWeekData(d.weeks))
  }, [playerId, selectedSeason])

  if (loading) return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-5">
      <p className="text-slate-500 text-xs animate-pulse">Loading snap counts…</p>
    </div>
  )
  if (!snapData || !snapData.available?.length) return null

  const seasons    = snapData.seasons ?? []
  const available  = snapData.available ?? []

  // Weekly bars for the selected season
  const weeks = (weekData ?? []).filter(w => w.game_type === 'REG').map(w => ({
    week: `W${w.week}`,
    pct:  Math.round((w[snapKey] ?? 0) * 100),
    opp:  w.opponent,
  }))

  // Career trend bars
  const careerBars = seasons.map(s => ({
    season: s.season,
    pct: Math.round(((s[snapKey === 'defense_pct' ? 'avg_def_pct' : snapKey === 'st_pct' ? 'avg_st_pct' : 'avg_off_pct']) ?? 0) * 100),
  }))

  return (
    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-white font-bold flex items-center gap-2">
          <span className="w-1 h-5 rounded-full" style={{ background: accentColor }} />
          Snap Counts
        </h2>
        <select
          value={selectedSeason ?? ''}
          onChange={e => setSelectedSeason(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
          {available.map(yr => <option key={yr} value={yr}>{yr}</option>)}
        </select>
      </div>

      {/* Weekly breakdown for selected season */}
      {weeks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {selectedSeason} — {snapLabel} by week
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeks} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="week" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={v => `${v}%`} width={36} />
              <ReferenceLine y={100} stroke="#334155" strokeDasharray="3 3" />
              <RTooltip
                cursor={{ fill: '#1e293b' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                      <p className="text-white font-bold">{label} vs {d.opp}</p>
                      <p style={{ color: accentColor }}>{snapLabel}: {d.pct}%</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="pct" radius={[2, 2, 0, 0]} fill={accentColor} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Career snap % trend */}
      {careerBars.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Career — avg {snapLabel} per season
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={careerBars} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="season" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={v => `${v}%`} width={36} />
              <RTooltip
                cursor={{ fill: '#1e293b' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                      <p className="text-white font-bold">{label}</p>
                      <p style={{ color: accentColor }}>{snapLabel}: {payload[0]?.value}%</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="pct" radius={[2, 2, 0, 0]} fill={accentColor} fillOpacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Next Gen Stats section ────────────────────────────────────────────────────
const NGS_QB_POS  = new Set(['QB'])
const NGS_RB_POS  = new Set(['RB','HB','FB'])

function NgsSection({ playerId, pos, accentColor }) {
  const isQB = NGS_QB_POS.has(pos?.toUpperCase())
  const isRB = NGS_RB_POS.has(pos?.toUpperCase())
  const [colTip, setColTip] = useState(null)
  if (!isQB && !isRB) return null

  const statType = isQB ? 'passing' : 'rushing'
  const { data, loading } = useApi(() => api.getNgsStats(playerId, statType), [playerId, statType])
  if (loading) return null

  const rows = isQB ? (data?.passing ?? []) : (data?.rushing ?? [])
  if (!rows.length) return null

  const dec2 = v => v != null ? Number(v).toFixed(2) : '—'
  const dec1 = v => v != null ? Number(v).toFixed(1) : '—'
  const pct1 = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

  const showTip = (e, text) => {
    const r = e.currentTarget.getBoundingClientRect()
    setColTip({ text, x: Math.min(r.left, window.innerWidth - 236 - 12), y: r.bottom + 6 })
  }

  const passingCols = [
    { key: 'season',          label: 'Season' },
    { key: 'avg_ttt',         label: 'TT',      desc: 'Avg Time to Throw (sec) — how long the QB holds the ball before releasing. Lower = quicker release.',                                                    format: dec2 },
    { key: 'avg_iay',         label: 'IAY',     desc: 'Avg Intended Air Yards — average depth of all pass attempts (completed or not). Measures how deep the QB throws.',                                       format: dec1 },
    { key: 'avg_cay',         label: 'CAY',     desc: 'Avg Completed Air Yards — air yards on completions only. Compared to IAY, shows how much the QB converts deep attempts.',                               format: dec1 },
    { key: 'avg_adot_sticks', label: 'ADOTS',   desc: 'Avg Air Yards to the Sticks — how far past (positive) or short of (negative) the first-down marker the QB targets.',                                    format: dec1 },
    { key: 'aggressiveness',  label: 'Aggr%',   desc: 'Aggressiveness — % of throws into tight windows (≤1 yard of separation). Higher = more willing to test the defense.',                                   format: pct1 },
    { key: 'cpoe',            label: 'CPOE',    desc: 'Completion % Over Expected — how much better or worse the QB completes passes vs. model predictions based on throw difficulty. Best single accuracy metric.', format: dec2 },
    { key: 'max_air_dist',    label: 'MaxDist', desc: 'Max Completed Air Distance — the longest completed pass (air yards) in a single game that season.',                                                      format: dec1 },
  ]

  const rushingCols = [
    { key: 'season',       label: 'Season' },
    { key: 'efficiency',   label: 'Eff',    desc: 'NGS Rushing Efficiency Score — composite metric measuring how efficiently the RB uses blocks and hits gaps.',                                              format: dec2 },
    { key: 'avg_tlos',     label: 'TLOS',   desc: 'Avg Time to Line of Scrimmage (sec) — how quickly the RB reaches the LOS. Lower can indicate decisiveness.',                                             format: dec2 },
    { key: 'ryoe_per_att', label: 'RYOE/A', desc: 'Rush Yards Over Expected per Attempt — yards gained above what an average back would given the same blocking. Best single metric for true RB impact.',    format: dec2 },
    { key: 'rush_pct_oe',  label: 'RPOE%',  desc: 'Rush % Over Expected — similar to RYOE but expressed as a rate rather than raw yards.',                                                                   format: dec1 },
    { key: 'pct_8box',     label: '8-Box%', desc: '% of rush attempts where 8+ defenders were in the box. Higher = the offense faced stacked fronts, making rushing harder.',                               format: pct1 },
  ]

  const cols = isQB ? passingCols : rushingCols

  // Chart lines config
  const passingLines = [
    { dataKey: 'cpoe',         label: 'CPOE',   color: accentColor },
    { dataKey: 'aggressiveness',label: 'Aggr%', color: '#f59e0b' },
  ]
  const rushingLines = [
    { dataKey: 'ryoe_per_att', label: 'RYOE/A',   color: accentColor },
    { dataKey: 'efficiency',   label: 'Efficiency',color: '#34d399' },
  ]
  const chartLines = isQB ? passingLines : rushingLines

  const title = isQB ? 'Next Gen Stats — Passing' : 'Next Gen Stats — Rushing'

  return (
    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-4">
      <h2 className="text-white font-bold flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: accentColor }} />
        {title}
        <span className="text-slate-600 text-xs font-normal ml-1">NGS 2016+</span>
      </h2>

      {rows.length > 1 && (
        <CareerLineChart data={rows} xKey="season" lines={chartLines} />
      )}

      <div className="scroll-x">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              {cols.map((c, i) => (
                <th key={c.key}
                  className={`py-2 px-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
                  onMouseEnter={c.desc ? e => showTip(e, c.desc) : undefined}
                  onMouseLeave={c.desc ? () => setColTip(null) : undefined}
                >
                  {c.label}
                  {c.desc && <span className="text-slate-600 text-xs select-none cursor-help ml-1">ⓘ</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.season} className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                {cols.map((c, i) => (
                  <td key={c.key}
                    className={`py-2 px-2 ${i === 0 ? 'text-slate-300 font-medium' : 'text-right text-white font-semibold'}`}>
                    {c.format ? c.format(row[c.key]) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {colTip && (
        <div style={{ position: 'fixed', top: colTip.y, left: colTip.x, zIndex: 9999 }}
          className="pointer-events-none w-56 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-300 shadow-xl whitespace-normal leading-relaxed">
          {colTip.text}
        </div>
      )}
    </div>
  )
}

export default function PlayerProfile() {
  const { id } = useParams()
  const { data: profile, loading, error } = useApi(() => api.getPlayer(id), [id])
  const { data: injData } = useApi(() => api.getInjuries(id), [id])
  const [advancedSections, setAdvancedSections] = useState(new Set())

  // Build season -> games_missed map for chart annotations
  // Use the larger of official Out count vs. estimated missed (catches IR absences)
  const injuryMap = Object.fromEntries(
    (injData?.seasons ?? []).map(s => [
      s.season,
      Math.max(s.games_missed ?? 0, s.games_missed_approx ?? 0)
    ])
  )

  const toggleAdvanced = cat => setAdvancedSections(prev => {
    const next = new Set(prev)
    if (next.has(cat)) { next.delete(cat) } else { next.add(cat) }
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
        const isAdv      = advancedSections.has(cat.category)
        const cols       = isAdv ? colSet.advanced : colSet.basic
        const chartGroups = CHART_GROUPS[cat.category]

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

            {chartGroups && cat.seasons.length > 1 && (
              <div className={chartGroups.length > 1 ? 'grid grid-cols-2 gap-3' : ''}>
                {chartGroups.map((lines, i) => (
                  <CareerLineChart key={i} data={cat.seasons} xKey="season" lines={lines} injuryMap={injuryMap} />
                ))}
              </div>
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

      <InjurySection playerId={player.player_id} accentColor={c.hex} />
      <AdvReceivingSection playerId={player.player_id} pos={player.pos} accentColor={c.hex} />
      <NgsSection playerId={player.player_id} pos={player.pos} accentColor={c.hex} />
      <SnapCountsSection playerId={player.player_id} pos={player.pos} accentColor={c.hex} />

      <div className="text-center pb-4">
        <Link to="/comparison" className="text-sm transition-colors hover:opacity-80"
          style={{ color: c.hex }}>
          Compare {player.player_name} with another player →
        </Link>
      </div>
    </div>
  )
}
