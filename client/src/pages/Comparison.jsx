import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../api'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable, { CsvDownloadButton } from '../components/StatTable'
import { MetricBarChart } from '../components/StatChart'
import { exportTableAsCsv, csvFilename } from '../utils/exportCsv'
import { useUser } from '../context/UserContext'
import { STAT_DEFS } from '../utils/statDefinitions'
import AiFeedback from '../components/AiFeedback'

const CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']
const BAR_COLORS = ['#60a5fa', '#fbbf24', '#4ade80', '#f87171']
const POSITIONS  = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const YEARS      = Array.from({ length: 56 }, (_, i) => 2025 - i)

const STAT_OPTIONS = {
  passing: [
    { key: 'yds',      label: 'Pass Yards' },
    { key: 'td',       label: 'Touchdowns' },
    { key: 'int',      label: 'Interceptions' },
    { key: 'att',      label: 'Attempts' },
    { key: 'cmp',      label: 'Completions' },
    { key: 'rate',     label: 'Passer Rating' },
    { key: 'qbr',      label: 'ESPN QBR' },
    { key: 'any_per_a',label: 'ANY/A' },
    { key: 'y_per_a',  label: 'Y/A' },
    { key: 'sk',       label: 'Sacks Taken' },
    { key: '_4qc',     label: '4th-Qtr Comebacks' },
    { key: 'gwd',      label: 'Game-Winning Drives' },
  ],
  offense: [
    { key: 'yscm',            label: 'Scrimmage Yards' },
    { key: 'rush_yds',        label: 'Rush Yards' },
    { key: 'rec_yds',         label: 'Rec Yards' },
    { key: 'rec',             label: 'Receptions' },
    { key: 'rush_td',         label: 'Rush TDs' },
    { key: 'rec_td',          label: 'Rec TDs' },
    { key: 'tgt',             label: 'Targets' },
    { key: 'y_per_tgt',       label: 'Yards Per Target' },
    { key: 'y_per_r',         label: 'Yards Per Reception' },
    { key: 'rec_first_downs', label: 'Receiving First Downs' },
    { key: 'rush_first_downs',label: 'Rushing First Downs' },
    { key: 'fmb',             label: 'Fumbles' },
  ],
  defense: [
    { key: 'comb',        label: 'Total Tackles' },
    { key: 'sk',          label: 'Sacks' },
    { key: 'int',         label: 'INTs' },
    { key: 'pd',          label: 'Pass Deflections' },
    { key: 'ff',          label: 'Forced Fumbles' },
    { key: 'tfl',         label: 'Tackles For Loss' },
    { key: 'qb_hits',     label: 'QB Hits' },
    { key: 'int_td',      label: 'Pick-Sixes' },
    { key: 'sfty',        label: 'Safeties' },
  ],
  kicking: [
    { key: 'fgm_total',   label: 'FG Made' },
    { key: 'fga_total',   label: 'FG Attempted' },
    { key: 'xpm',         label: 'Extra Points Made' },
    { key: 'fgm_40_49',   label: 'FG Made 40-49 yds' },
    { key: 'fgm_50_plus', label: 'FG Made 50+ yds' },
  ],
  punting: [
    { key: 'pnt',    label: 'Punts' },
    { key: 'yds',    label: 'Punt Yards' },
    { key: 'netyds', label: 'Net Yards' },
    { key: 'pnt20',  label: 'Punts Inside 20' },
    { key: 'blck',   label: 'Blocked Punts' },
  ],
  returns: [
    { key: 'kick_ret_yds',  label: 'KR Yards' },
    { key: 'punt_ret_yds',  label: 'PR Yards' },
    { key: 'kick_ret_td',   label: 'KR Touchdowns' },
    { key: 'punt_ret_td',   label: 'PR Touchdowns' },
    { key: 'apyd',          label: 'All-Purpose Yards' },
  ],
}

const CHART_METRICS = {
  passing: [
    { key: 'yds', label: 'Pass Yards' },
    { key: 'td',  label: 'Touchdowns' },
    { key: 'int', label: 'Interceptions' },
    { key: 'cmp', label: 'Completions' },
  ],
  offense: [
    { key: 'rush_yds', label: 'Rush Yards' },
    { key: 'rec_yds',  label: 'Rec Yards' },
    { key: 'rush_td',  label: 'Rush TDs' },
    { key: 'rec_td',   label: 'Rec TDs' },
  ],
  defense: [
    { key: 'comb', label: 'Tackles' },
    { key: 'sk',   label: 'Sacks' },
    { key: 'int',  label: 'INTs' },
    { key: 'pd',   label: 'Pass Deflections' },
  ],
  kicking: [
    { key: 'fgm_total', label: 'FG Made' },
    { key: 'fga_total', label: 'FG Attempted' },
    { key: 'xpm',       label: 'XP Made' },
    { key: 'xpa',       label: 'XP Attempted' },
  ],
  punting: [
    { key: 'pnt',    label: 'Punts' },
    { key: 'yds',    label: 'Total Yards' },
    { key: 'netyds', label: 'Net Yards' },
    { key: 'pnt20',  label: 'Inside 20' },
  ],
  returns: [
    { key: 'kick_ret_yds', label: 'KR Yards' },
    { key: 'punt_ret_yds', label: 'PR Yards' },
    { key: 'kick_ret_td',  label: 'KR TDs' },
    { key: 'punt_ret_td',  label: 'PR TDs' },
  ],
}

const TABLE_COLS = {
  passing: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',   label: 'G' },
    { key: 'yds', label: 'Yards', format: v => v?.toLocaleString() ?? '—' },
    { key: 'td',  label: 'TD' },
    { key: 'int', label: 'INT' },
    { key: 'cmp', label: 'Cmp',  format: v => v?.toLocaleString() ?? '—' },
    { key: 'att', label: 'Att',  format: v => v?.toLocaleString() ?? '—' },
  ],
  offense: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',        label: 'G' },
    { key: 'rush_yds', label: 'RushYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'rush_td',  label: 'RushTD' },
    { key: 'rec',      label: 'Rec' },
    { key: 'rec_yds',  label: 'RecYds',  format: v => v?.toLocaleString() ?? '—' },
    { key: 'rec_td',   label: 'RecTD' },
  ],
  defense: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',    label: 'G' },
    { key: 'comb', label: 'Tkl' },
    { key: 'sk',   label: 'Sacks' },
    { key: 'int',  label: 'INT' },
    { key: 'pd',   label: 'PD' },
    { key: 'ff',   label: 'FF' },
  ],
  kicking: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',         label: 'G' },
    { key: 'fgm_total', label: 'FGM', format: v => v?.toLocaleString() ?? '—' },
    { key: 'fga_total', label: 'FGA', format: v => v?.toLocaleString() ?? '—' },
    { key: 'xpm',       label: 'XPM', format: v => v?.toLocaleString() ?? '—' },
    { key: 'xpa',       label: 'XPA', format: v => v?.toLocaleString() ?? '—' },
  ],
  punting: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',      label: 'G' },
    { key: 'pnt',    label: 'Punts' },
    { key: 'yds',    label: 'Yards',  format: v => v?.toLocaleString() ?? '—' },
    { key: 'netyds', label: 'NetYds', format: v => v?.toLocaleString() ?? '—' },
  ],
  returns: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',            label: 'G' },
    { key: 'kick_ret_yds', label: 'KRYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'kick_ret_td',  label: 'KRTD' },
    { key: 'punt_ret_yds', label: 'PRYds', format: v => v?.toLocaleString() ?? '—' },
    { key: 'punt_ret_td',  label: 'PRTD' },
  ],
}

// Full column sets (all career stats) shown when user toggles "All stats"
const loc = v => v?.toLocaleString() ?? '—'
const d1  = v => v != null ? Number(v).toFixed(1) : '—'

const ALL_TABLE_COLS = {
  passing: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',       label: 'G',      desc: STAT_DEFS.g },
    { key: 'cmp',     label: 'Cmp',    format: loc },
    { key: 'att',     label: 'Att',    format: loc },
    { key: 'cmp_pct', label: 'Cmp%',   format: (_, r) => r.att ? `${(100*r.cmp/r.att).toFixed(1)}%` : '—' },
    { key: 'yds',     label: 'Yds',    format: loc },
    { key: 'td',      label: 'TD',     desc: STAT_DEFS.td },
    { key: 'int',     label: 'INT',    desc: STAT_DEFS.int },
    { key: 'y_a',     label: 'Y/A',    desc: STAT_DEFS.y_per_a,  format: (_, r) => r.att ? (r.yds/r.att).toFixed(1) : '—' },
    { key: 'td_pct',  label: 'TD%',    format: (_, r) => r.att ? `${(100*r.td/r.att).toFixed(1)}%` : '—' },
    { key: 'int_pct', label: 'INT%',   format: (_, r) => r.att ? `${(100*r.int/r.att).toFixed(1)}%` : '—' },
    { key: 'sk',      label: 'Sacks',  desc: STAT_DEFS.sk },
    { key: '_4qc',    label: '4QC',    desc: STAT_DEFS._4qc },
    { key: 'gwd',     label: 'GWD',    desc: STAT_DEFS.gwd },
  ],
  offense: [
    { key: 'player_name',     label: 'Player' },
    { key: 'g',               label: 'G',        desc: STAT_DEFS.g },
    { key: 'rec',             label: 'Rec',       desc: STAT_DEFS.rec },
    { key: 'tgt',             label: 'Tgt',       desc: STAT_DEFS.tgt },
    { key: 'ctch_pct',        label: 'Ctch%',     desc: STAT_DEFS.ctch_pct,   format: (_, r) => r.tgt ? `${(100*r.rec/r.tgt).toFixed(1)}%` : '—' },
    { key: 'rec_yds',         label: 'RecYds',    format: loc },
    { key: 'rec_td',          label: 'RecTD',     desc: STAT_DEFS.rec_td },
    { key: 'y_per_r',         label: 'Y/Rec',     desc: STAT_DEFS.y_per_r,    format: (_, r) => r.rec ? (r.rec_yds/r.rec).toFixed(1) : '—' },
    { key: 'y_per_tgt',       label: 'Y/Tgt',     desc: STAT_DEFS.y_per_tgt,  format: (_, r) => r.tgt ? (r.rec_yds/r.tgt).toFixed(1) : '—' },
    { key: 'rec_first_downs', label: 'RecFD',     desc: STAT_DEFS.rec_first_downs },
    { key: 'att',             label: 'RushAtt' },
    { key: 'rush_yds',        label: 'RushYds',   format: loc },
    { key: 'rush_td',         label: 'RushTD',    desc: STAT_DEFS.rush_td },
    { key: 'ypc',             label: 'Y/Carry',   format: (_, r) => r.att ? (r.rush_yds/r.att).toFixed(1) : '—' },
    { key: 'rush_first_downs',label: 'RushFD',    desc: STAT_DEFS.rush_first_downs },
    { key: 'yscm',            label: 'ScrmYds',   desc: STAT_DEFS.yscm,        format: loc },
    { key: 'fmb',             label: 'Fmb',       desc: STAT_DEFS.fmb },
  ],
  defense: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',           label: 'G',        desc: STAT_DEFS.g },
    { key: 'comb',        label: 'Tkl',      desc: STAT_DEFS.comb },
    { key: 'solo',        label: 'Solo',     desc: STAT_DEFS.solo },
    { key: 'ast',         label: 'Ast',      desc: STAT_DEFS.ast },
    { key: 'tfl',         label: 'TFL',      desc: STAT_DEFS.tfl },
    { key: 'sk',          label: 'Sacks',    desc: STAT_DEFS.sk },
    { key: 'qb_hits',     label: 'QB Hits',  desc: STAT_DEFS.qb_hits },
    { key: 'int',         label: 'INT',      desc: STAT_DEFS.int },
    { key: 'int_ret_yds', label: 'INT Yds',  desc: STAT_DEFS.int_ret_yds, format: loc },
    { key: 'int_td',      label: 'Pick-6',   desc: STAT_DEFS.int_td },
    { key: 'pd',          label: 'PD',       desc: STAT_DEFS.pd },
    { key: 'ff',          label: 'FF',       desc: STAT_DEFS.ff },
    { key: 'fr',          label: 'FR',       desc: STAT_DEFS.fr },
    { key: 'sfty',        label: 'Sfty',     desc: STAT_DEFS.sfty },
  ],
  kicking: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',           label: 'G',          desc: STAT_DEFS.g },
    { key: 'fgm_total',   label: 'FGM',        desc: STAT_DEFS.fgm_total },
    { key: 'fga_total',   label: 'FGA',        desc: STAT_DEFS.fga_total },
    { key: 'fg_pct',      label: 'FG%',        format: (_, r) => r.fga_total ? `${(100*r.fgm_total/r.fga_total).toFixed(1)}%` : '—' },
    { key: 'fgm_20_29',   label: 'FGM 20-29',  desc: STAT_DEFS.fgm_20_29 },
    { key: 'fgm_30_39',   label: 'FGM 30-39',  desc: STAT_DEFS.fgm_30_39 },
    { key: 'fgm_40_49',   label: 'FGM 40-49',  desc: STAT_DEFS.fgm_40_49 },
    { key: 'fgm_50_plus', label: 'FGM 50+',    desc: STAT_DEFS.fgm_50_plus },
    { key: 'fga_40_49',   label: 'FGA 40-49',  desc: STAT_DEFS.fga_40_49 },
    { key: 'fga_50_plus', label: 'FGA 50+',    desc: STAT_DEFS.fga_50_plus },
    { key: 'xpm',         label: 'XPM',        desc: STAT_DEFS.xpm },
    { key: 'xpa',         label: 'XPA',        desc: STAT_DEFS.xpa },
    { key: 'ko',          label: 'KO',          desc: STAT_DEFS.ko },
    { key: 'koavg',       label: 'KO Avg',      desc: STAT_DEFS.koavg,    format: d1 },
    { key: 'tb',          label: 'TB',           desc: STAT_DEFS.tb },
  ],
  punting: [
    { key: 'player_name', label: 'Player' },
    { key: 'g',       label: 'G',          desc: STAT_DEFS.g },
    { key: 'pnt',     label: 'Punts',      desc: STAT_DEFS.pnt },
    { key: 'yds',     label: 'Gross Yds',  format: loc },
    { key: 'y_per_p', label: 'Y/Punt',     desc: STAT_DEFS.y_per_p,  format: (_, r) => r.pnt ? (r.yds/r.pnt).toFixed(1) : '—' },
    { key: 'netyds',  label: 'Net Yds',    desc: STAT_DEFS.netyds,   format: loc },
    { key: 'ny_per_p',label: 'Net Y/Punt', desc: STAT_DEFS.ny_per_p, format: (_, r) => r.pnt ? (r.netyds/r.pnt).toFixed(1) : '—' },
    { key: 'tb',      label: 'TB',          desc: STAT_DEFS.tb },
    { key: 'pnt20',   label: 'In20',        desc: STAT_DEFS.pnt20 },
    { key: 'retyds',  label: 'Ret Yds',     desc: STAT_DEFS.retyds,   format: loc },
    { key: 'blck',    label: 'Blk',          desc: STAT_DEFS.blck },
  ],
  returns: [
    { key: 'player_name',    label: 'Player' },
    { key: 'g',              label: 'G',          desc: STAT_DEFS.g },
    { key: 'punt_ret',       label: 'PR',          desc: STAT_DEFS.punt_ret },
    { key: 'punt_ret_yds',   label: 'PR Yds',      desc: STAT_DEFS.punt_ret_yds,   format: loc },
    { key: 'y_per_pr',       label: 'Y/PR',        desc: STAT_DEFS.y_per_punt_ret, format: (_, r) => r.punt_ret ? (r.punt_ret_yds/r.punt_ret).toFixed(1) : '—' },
    { key: 'punt_ret_td',    label: 'PR TD',       desc: STAT_DEFS.punt_ret_td },
    { key: 'punt_ret_lng',   label: 'PR Lng',      desc: STAT_DEFS.punt_ret_lng },
    { key: 'kick_ret',       label: 'KR',          desc: STAT_DEFS.kick_ret },
    { key: 'kick_ret_yds',   label: 'KR Yds',      desc: STAT_DEFS.kick_ret_yds,   format: loc },
    { key: 'y_per_kr',       label: 'Y/KR',        desc: STAT_DEFS.y_per_kick_ret, format: (_, r) => r.kick_ret ? (r.kick_ret_yds/r.kick_ret).toFixed(1) : '—' },
    { key: 'kick_ret_td',    label: 'KR TD',       desc: STAT_DEFS.kick_ret_td },
    { key: 'kick_ret_lng',   label: 'KR Lng',      desc: STAT_DEFS.kick_ret_lng },
    { key: 'apyd',           label: 'All-Purpose', desc: STAT_DEFS.apyd,            format: loc },
  ],
}

// Auto-select best comparison category based on player position
const POS_CATEGORY = {
  QB: 'passing',
  RB: 'offense', FB: 'offense', HB: 'offense',
  WR: 'offense', TE: 'offense',
  OL: 'offense', OT: 'offense', OG: 'offense', C: 'offense', T: 'offense', G: 'offense',
  DE: 'defense', DT: 'defense', DL: 'defense', NT: 'defense',
  LB: 'defense', ILB: 'defense', OLB: 'defense', MLB: 'defense',
  CB: 'defense', S: 'defense', FS: 'defense', SS: 'defense', DB: 'defense',
  K: 'kicking',
  P: 'punting',
}

const SUFFIXES = new Set(['II', 'III', 'IV', 'V', 'Jr.', 'Sr.', 'Jr', 'Sr'])
function shortName(full = '') {
  const parts = full.trim().split(/\s+/).filter(p => !SUFFIXES.has(p))
  return parts.length >= 2 ? parts[parts.length - 1] : (parts[0] || full)
}

export default function Comparison() {
  const [category,      setCategory]      = useState('passing')
  const [playerIds,     setPlayerIds]     = useState([])
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [saved,         setSaved]         = useState(false)
  const [filtersOpen,   setFiltersOpen]   = useState(false)
  const [showAllStats,  setShowAllStats]  = useState(false)
  const [addPanelOpen,  setAddPanelOpen]  = useState(true)
  const [compSeason,    setCompSeason]    = useState('')
  const [seasonFrom,    setSeasonFrom]    = useState('')
  const [seasonTo,      setSeasonTo]      = useState('')
  const [lbStat,        setLbStat]        = useState('')
  const [lbData,        setLbData]        = useState(null)
  const [narState,      setNarState]      = useState('idle')  // idle | loading | done | error
  const [narrative,     setNarrative]     = useState(null)
  const [narLogId,      setNarLogId]      = useState(null)

  // Filters
  const [filterPos,    setFilterPos]    = useState('')
  const [filterSeason, setFilterSeason] = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [filterStat,   setFilterStat]   = useState('')
  const [filterMin,    setFilterMin]    = useState('')

  const debounceRef  = useRef(null)
  const lbDebounce   = useRef(null)
  const { saveComparison } = useUser()

  // Auto-select first stat for leaderboard when category changes
  useEffect(() => {
    const first = STAT_OPTIONS[category]?.[0]?.key ?? ''
    setLbStat(first)
  }, [category])

  // Fetch leaderboard
  useEffect(() => {
    clearTimeout(lbDebounce.current)
    if (!lbStat) return
    lbDebounce.current = setTimeout(() => {
      api.topPlayersByStat(category, lbStat, {
        season: compSeason ? parseInt(compSeason) : undefined,
        limit: 20,
      })
        .then(setLbData)
        .catch(() => setLbData(null))
    }, 300)
    return () => clearTimeout(lbDebounce.current)
  }, [category, lbStat, compSeason])

  // Load comparison data (career or specific season)
  useEffect(() => {
    if (playerIds.length === 0) { setData(null); setError(null); setAddPanelOpen(true); return }
    let cancelled = false
    setLoading(true); setError(null)
    const req = compSeason
      ? api.compareSeason(playerIds, category, parseInt(compSeason))
      : api.compareCareer(playerIds, category, { seasonFrom: seasonFrom || undefined, seasonTo: seasonTo || undefined })
    req
      .then(r  => { if (!cancelled) { setData(r);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [playerIds.join(','), category, compSeason, seasonFrom, seasonTo])

  // Search players to add
  useEffect(() => {
    if (!addPanelOpen) return
    clearTimeout(debounceRef.current)
    const useStatSearch = filterCat && filterStat

    debounceRef.current = setTimeout(async () => {
      try {
        if (useStatSearch) {
          const results = await api.topPlayersByStat(filterCat, filterStat, {
            pos:    filterPos    || undefined,
            season: filterSeason ? parseInt(filterSeason) : undefined,
            min:    parseFloat(filterMin) || 0,
            limit:  20,
          })
          const filtered = searchQuery.length >= 2
            ? results.filter(r => r.player_name.toLowerCase().includes(searchQuery.toLowerCase()))
            : results
          setSearchResults(filtered)
        } else if (searchQuery.length >= 2 || filterPos || filterSeason) {
          setSearchResults(await api.searchPlayers(searchQuery, {
            pos:    filterPos    || undefined,
            season: filterSeason ? parseInt(filterSeason) : undefined,
            limit:  20,
          }))
        } else {
          setSearchResults([])
        }
      } catch { setSearchResults([]) }
    }, 280)

    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, filterPos, filterSeason, filterCat, filterStat, filterMin, addPanelOpen])

  const resetNarrative = () => { setNarState('idle'); setNarrative(null); setNarLogId(null) }

  const addPlayer = (id, pos) => {
    if (!playerIds.includes(id) && playerIds.length < 4) {
      setPlayerIds(p => [...p, id])
      // Auto-set category from first player's position
      if (playerIds.length === 0 && pos) {
        const cat = POS_CATEGORY[pos.toUpperCase()]
        if (cat) setCategory(cat)
      }
    }
    setSearchQuery(''); setSearchResults([])
    setSaved(false)
    resetNarrative()
    setAddPanelOpen(false)
  }
  const removePlayer = id => { setPlayerIds(p => p.filter(x => x !== id)); setSaved(false); resetNarrative() }

  const loadNarrative = async () => {
    setNarState('loading')
    try {
      const res = await api.getComparisonNarrative(playerIds, category, compSeason ? parseInt(compSeason) : null)
      setNarrative(res.narrative)
      setNarLogId(res.log_id ?? null)
      setNarState('done')
    } catch {
      setNarState('error')
    }
  }

  const handleSave = () => {
    if (!data) return
    saveComparison(playerIds, data.players.map(p => p.player_name), category)
    setSaved(true)
  }

  const displayPlayers = data?.players ?? playerIds.map(id => ({ player_id: id, player_name: id, pos: '' }))
  const metrics   = CHART_METRICS[category] ?? CHART_METRICS.passing
  const tableCols = (showAllStats ? ALL_TABLE_COLS[category] : TABLE_COLS[category]) ?? TABLE_COLS.passing
  const hasActiveFilter = filterPos || filterSeason || filterCat

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Head to Head</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Player Comparison</h1>
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Active player chips + Add player toggle */}
      {playerIds.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {displayPlayers.map((p, i) => (
            <div key={p.player_id} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              style={{ background: `${BAR_COLORS[i]}15`, border: `1px solid ${BAR_COLORS[i]}40` }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BAR_COLORS[i] }} />
              <span className="text-white font-semibold">{p.player_name}</span>
              {p.pos && <span className="text-xs" style={{ color: BAR_COLORS[i], opacity: 0.8 }}>{p.pos}</span>}
              {(p.team || p.teams) && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ background: `${BAR_COLORS[i]}20`, color: BAR_COLORS[i] }}>
                  {p.team || p.teams}
                </span>
              )}
              <button onClick={() => removePlayer(p.player_id)}
                className="ml-1 text-slate-600 hover:text-red-400 transition-colors text-base leading-none">×</button>
            </div>
          ))}
          {playerIds.length >= 2 && <span className="text-xs font-black text-slate-600 px-1">VS</span>}
          {playerIds.length < 4 && (
            <button onClick={() => setAddPanelOpen(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                addPanelOpen
                  ? 'border-slate-600 text-slate-300 bg-slate-700/60'
                  : 'border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}>
              {addPanelOpen ? '✕ Close' : '＋ Add player'}
            </button>
          )}
        </div>
      )}

      {/* Add player panel */}
      {playerIds.length < 4 && addPanelOpen && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Add player {playerIds.length > 0 ? `· ${playerIds.length}/4` : ''}
            </p>
            <button onClick={() => setFiltersOpen(v => !v)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                hasActiveFilter
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  : 'border-slate-700 text-slate-500 hover:text-slate-300'
              }`}>
              {filtersOpen ? '▲' : '▼'} Filters{hasActiveFilter ? ' •' : ''}
            </button>
          </div>

          {/* Expandable filters */}
          {filtersOpen && (
            <div className="space-y-3 border-t border-slate-700/60 pt-3">

              {/* Position + Season row */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs text-slate-500">Position:</span>
                <select value={filterPos} onChange={e => setFilterPos(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-slate-500">
                  <option value="">All</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="text-xs text-slate-500 ml-2">Season:</span>
                <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-slate-500">
                  <option value="">Any</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Stat filter */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Filter by stat</p>
                <div className="flex gap-2 flex-wrap items-center">
                  <select value={filterCat} onChange={e => { const c = e.target.value; setFilterCat(c); setFilterStat(''); setFilterMin(''); if (c) setCategory(c) }}
                    className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-slate-500">
                    <option value="">Category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>

                  {filterCat && (
                    <select value={filterStat} onChange={e => setFilterStat(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-slate-500">
                      <option value="">Stat…</option>
                      {(STAT_OPTIONS[filterCat] ?? []).map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  )}

                  {filterStat && (
                    <input type="number" value={filterMin} onChange={e => setFilterMin(e.target.value)}
                      placeholder="min value"
                      className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
                  )}

                  {hasActiveFilter && (
                    <button onClick={() => { setFilterPos(''); setFilterSeason(''); setFilterCat(''); setFilterStat(''); setFilterMin('') }}
                      className="text-xs text-slate-600 hover:text-red-400 transition-colors ml-1">
                      Reset
                    </button>
                  )}
                </div>
                {filterCat && filterStat && (
                  <div>
                    <p className="text-xs text-slate-600">
                      Showing top players by {STAT_OPTIONS[filterCat]?.find(s => s.key === filterStat)?.label ?? filterStat}
                      {filterMin ? ` (min ${Number(filterMin).toLocaleString()})` : ''}
                      {filterSeason ? ` in ${filterSeason}` : ' (career best)'}
                    </p>
                    {STAT_DEFS[filterStat] && (
                      <p className="text-xs text-slate-500 mt-1 italic">{STAT_DEFS[filterStat]}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Name search */}
          <div className="relative">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={filterCat && filterStat ? 'Filter by name…' : 'Search player name…'}
              className="w-full bg-slate-900/60 border border-dashed border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />

            {searchResults.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-10 max-h-72 overflow-y-auto">
                {searchResults.map((p, i) => (
                  <li key={p.player_id} onClick={() => addPlayer(p.player_id, p.pos)}
                    className="px-4 py-2.5 hover:bg-slate-700/80 cursor-pointer flex items-center justify-between text-sm border-b border-slate-700/60 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BAR_COLORS[i % 4] }} />
                      <span className="text-white">{p.player_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {p.pos && <span className="text-slate-500">{p.pos}</span>}
                      {p.best_value != null && (
                        <span className="text-amber-400/70 font-medium">{p.best_value.toLocaleString()}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {playerIds.length === 0 && !searchQuery && !hasActiveFilter && (
            <p className="text-slate-600 text-xs text-center pb-1">
              Search by name · or open Filters to browse by position, season, or stat
            </p>
          )}
        </div>
      )}

      {/* Career / Season toggle — visible once players are selected */}
      {playerIds.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Comparing:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
            <button
              onClick={() => setCompSeason('')}
              className={`px-3 py-1.5 transition-colors ${!compSeason ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              Career totals
            </button>
            <button
              onClick={() => { if (!compSeason) { setCompSeason(String(YEARS[0])); setSeasonFrom(''); setSeasonTo('') } }}
              className={`px-3 py-1.5 transition-colors ${compSeason ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              Single season
            </button>
          </div>
          {compSeason && (
            <select value={compSeason} onChange={e => setCompSeason(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-slate-500">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {!compSeason && (
            <>
              <span className="text-xs text-slate-600">From:</span>
              <select value={seasonFrom} onChange={e => setSeasonFrom(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-slate-500">
                <option value="">All</option>
                {YEARS.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-xs text-slate-600">To:</span>
              <select value={seasonTo} onChange={e => setSeasonTo(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-slate-500">
                <option value="">All</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {(seasonFrom || seasonTo) && (
                <button onClick={() => { setSeasonFrom(''); setSeasonTo('') }}
                  className="text-xs text-slate-600 hover:text-slate-300 transition-colors">
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      )}

      {loading && <Loading text="Loading comparison…" />}
      {error   && <ErrorMsg message={error} />}

      {data && (
        <>
          {/* Save */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saved}
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors border ${
                saved
                  ? 'border-emerald-700/60 text-emerald-400 bg-emerald-900/30 cursor-default'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 bg-slate-800/60'
              }`}>
              {saved ? '✓ Saved' : '💾 Save comparison'}
            </button>
          </div>

          {/* AI Narrative */}
          {narState === 'idle' && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-white font-bold">AI Comparison Narrative</p>
                <p className="text-slate-500 text-xs mt-0.5">Claude-written analysis of this matchup</p>
              </div>
              <button onClick={loadNarrative}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20">
                Generate Narrative
              </button>
            </div>
          )}
          {narState === 'loading' && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 flex items-center gap-3">
              <svg className="animate-spin w-4 h-4 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-slate-400 text-sm">Generating narrative…</span>
            </div>
          )}
          {narState === 'error' && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
              <p className="text-rose-400 text-sm">Could not generate narrative. Try again later.</p>
            </div>
          )}
          {narState === 'done' && narrative && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-4">
              <h2 className="text-white font-bold">AI Comparison Narrative</h2>
              <p className="text-slate-300 text-sm leading-relaxed">{narrative}</p>
              <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
                <AiFeedback logId={narLogId} />
                <p className="text-xs text-slate-600">Powered by Claude Sonnet 4.6</p>
              </div>
            </div>
          )}

          {/* Chart grid */}
          <div className="rounded-2xl border border-slate-700/60 p-5 space-y-4"
            style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-white font-bold capitalize">
                {compSeason
                  ? `${compSeason} season`
                  : (seasonFrom || seasonTo)
                    ? `${seasonFrom || '1970'}–${seasonTo || '2025'}`
                    : 'Career totals'} — {category}
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                {data.players.map((p, i) => (
                  <span key={p.player_id} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BAR_COLORS[i] }} />
                    {shortName(p.player_name)}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map(({ key, label }) => {
                const chartData = data.players.map((p, i) => {
                  const row = data.career.find(c => c.player_id === p.player_id)
                  return { name: shortName(p.player_name), value: row?.[key] ?? 0 }
                })
                return <MetricBarChart key={key} title={label} data={chartData} colors={BAR_COLORS} />
              })}
            </div>
          </div>

          {/* Stats table */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold capitalize">
                {compSeason
                  ? `${compSeason} stats`
                  : (seasonFrom || seasonTo)
                    ? `${seasonFrom || '1970'}–${seasonTo || '2025'} stats`
                    : 'Career stats'} — {category}
              </h2>
              <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
                <button
                  onClick={() => setShowAllStats(false)}
                  className={`px-3 py-1 transition-colors ${!showAllStats ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  Basic
                </button>
                <button
                  onClick={() => setShowAllStats(true)}
                  className={`px-3 py-1 transition-colors ${showAllStats ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  All stats
                </button>
              </div>
            </div>
            <StatTable columns={tableCols} rows={data.career} keyField="player_id"
              title={`${compSeason ? compSeason : (seasonFrom || seasonTo) ? `${seasonFrom || '1970'}–${seasonTo || '2025'}` : 'Career'} stats — ${category}`} />
          </div>
        </>
      )}

      {/* Leaderboard — always visible */}
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-white font-bold">Top 20 Leaderboard</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {compSeason ? `${compSeason} season` : 'Career totals'} — {playerIds.length > 0 ? 'compared players highlighted' : 'add players above to highlight them'}
            </p>
          </div>
          <select
            value={lbStat}
            onChange={e => setLbStat(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
            {(STAT_OPTIONS[category] ?? []).map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        {lbData && lbData.length > 0 ? (
          <div className="relative group scroll-x">
            <CsvDownloadButton
              columns={[
                { key: '_rank', label: '#' },
                { key: 'player_name', label: 'Player' },
                { key: 'pos', label: 'Pos' },
                { key: 'best_value', label: STAT_OPTIONS[category]?.find(s => s.key === lbStat)?.label ?? lbStat },
              ]}
              rows={lbData.map((p, i) => ({ ...p, _rank: i + 1 }))}
              title={`Leaderboard — ${STAT_OPTIONS[category]?.find(s => s.key === lbStat)?.label ?? lbStat}`}
            />
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 pr-4 font-medium w-8">#</th>
                <th className="text-left py-2 pr-4 font-medium">Player</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-600">Pos</th>
                <th className="text-right py-2 font-medium">
                  {STAT_OPTIONS[category]?.find(s => s.key === lbStat)?.label ?? lbStat}
                </th>
              </tr>
            </thead>
            <tbody>
              {lbData.map((p, i) => {
                const idx = playerIds.indexOf(p.player_id)
                const isCompared = idx !== -1
                return (
                  <tr key={p.player_id}
                    className={`border-t border-slate-800/60 transition-colors ${
                      isCompared ? 'bg-amber-900/20 hover:bg-amber-900/30' : 'hover:bg-slate-800/30'
                    }`}>
                    <td className="py-2 pr-4 text-slate-600 font-mono text-xs">{i + 1}</td>
                    <td className="py-2 pr-4">
                      <span className={isCompared ? 'text-amber-300 font-semibold' : 'text-slate-200'}>
                        {p.player_name}
                      </span>
                      {isCompared && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: `${BAR_COLORS[idx]}25`, color: BAR_COLORS[idx] }}>
                          compared
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-500 text-xs">{p.pos}</td>
                    <td className="py-2 text-right text-white font-semibold">
                      {p.best_value?.toLocaleString() ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-slate-600 text-sm text-center py-4">No data.</p>
        )}
      </div>
    </div>
  )
}
