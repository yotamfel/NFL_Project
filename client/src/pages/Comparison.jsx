import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { Loading, ErrorMsg } from '../components/Status'
import StatTable from '../components/StatTable'
import { MetricBarChart } from '../components/StatChart'
import { useUser } from '../context/UserContext'

const CATEGORIES = ['passing', 'offense', 'defense', 'kicking', 'punting', 'returns']
const BAR_COLORS = ['#60a5fa', '#fbbf24', '#4ade80', '#f87171']
const POSITIONS  = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const YEARS      = Array.from({ length: 26 }, (_, i) => 2025 - i)

const STAT_OPTIONS = {
  passing: [
    { key: 'yds', label: 'Pass Yards' },
    { key: 'td',  label: 'Touchdowns' },
    { key: 'int', label: 'Interceptions' },
    { key: 'att', label: 'Attempts' },
    { key: 'cmp', label: 'Completions' },
  ],
  offense: [
    { key: 'yscm',     label: 'Scrimmage Yards' },
    { key: 'rush_yds', label: 'Rush Yards' },
    { key: 'rec_yds',  label: 'Rec Yards' },
    { key: 'rec',      label: 'Receptions' },
    { key: 'rush_td',  label: 'Rush TDs' },
    { key: 'rec_td',   label: 'Rec TDs' },
  ],
  defense: [
    { key: 'comb', label: 'Total Tackles' },
    { key: 'sk',   label: 'Sacks' },
    { key: 'int',  label: 'INTs' },
    { key: 'pd',   label: 'Pass Deflections' },
    { key: 'ff',   label: 'Forced Fumbles' },
  ],
  kicking: [
    { key: 'fgm_total', label: 'FG Made' },
    { key: 'fga_total', label: 'FG Attempted' },
    { key: 'xpm',       label: 'Extra Points Made' },
  ],
  punting: [
    { key: 'pnt',    label: 'Punts' },
    { key: 'yds',    label: 'Punt Yards' },
    { key: 'netyds', label: 'Net Yards' },
  ],
  returns: [
    { key: 'kick_ret_yds', label: 'KR Yards' },
    { key: 'punt_ret_yds', label: 'PR Yards' },
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

  // Filters
  const [filterPos,    setFilterPos]    = useState('')
  const [filterSeason, setFilterSeason] = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [filterStat,   setFilterStat]   = useState('')
  const [filterMin,    setFilterMin]    = useState('')

  const debounceRef = useRef(null)
  const { saveComparison } = useUser()

  // Load comparison data
  useEffect(() => {
    if (playerIds.length === 0) { setData(null); return }
    let cancelled = false
    setLoading(true); setError(null)
    api.compareCareer(playerIds, category)
      .then(r  => { if (!cancelled) { setData(r);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [playerIds.join(','), category])

  // Search players to add
  useEffect(() => {
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
  }, [searchQuery, filterPos, filterSeason, filterCat, filterStat, filterMin])

  const addPlayer = id => {
    if (!playerIds.includes(id) && playerIds.length < 4) setPlayerIds(p => [...p, id])
    setSearchQuery(''); setSearchResults([])
    setSaved(false)
  }
  const removePlayer = id => { setPlayerIds(p => p.filter(x => x !== id)); setSaved(false) }

  const handleSave = () => {
    if (!data) return
    saveComparison(playerIds, data.players.map(p => p.player_name), category)
    setSaved(true)
  }

  const displayPlayers = data?.players ?? playerIds.map(id => ({ player_id: id, player_name: id, pos: '' }))
  const metrics   = CHART_METRICS[category] ?? CHART_METRICS.passing
  const tableCols = TABLE_COLS[category]    ?? TABLE_COLS.passing
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

      {/* Active player chips */}
      {playerIds.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {displayPlayers.map((p, i) => (
            <div key={p.player_id} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              style={{ background: `${BAR_COLORS[i]}15`, border: `1px solid ${BAR_COLORS[i]}40` }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BAR_COLORS[i] }} />
              <span className="text-white font-semibold">{p.player_name}</span>
              {p.pos && <span className="text-xs" style={{ color: BAR_COLORS[i], opacity: 0.8 }}>{p.pos}</span>}
              <button onClick={() => removePlayer(p.player_id)}
                className="ml-1 text-slate-600 hover:text-red-400 transition-colors text-base leading-none">×</button>
            </div>
          ))}
          {playerIds.length >= 2 && <span className="text-xs font-black text-slate-600 px-1">VS</span>}
        </div>
      )}

      {/* Add player panel */}
      {playerIds.length < 4 && (
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
                  <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setFilterStat(''); setFilterMin('') }}
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
                  <p className="text-xs text-slate-600">
                    Showing top players by {STAT_OPTIONS[filterCat]?.find(s => s.key === filterStat)?.label ?? filterStat}
                    {filterMin ? ` (min ${Number(filterMin).toLocaleString()})` : ''}
                    {filterSeason ? ` in ${filterSeason}` : ' (career best)'}
                  </p>
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
                  <li key={p.player_id} onClick={() => addPlayer(p.player_id)}
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

          {/* Chart grid */}
          <div className="rounded-2xl border border-slate-700/60 p-5 space-y-4"
            style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-white font-bold capitalize">Career totals — {category}</h2>
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
            <h2 className="text-white font-bold mb-4 capitalize">Career stats — {category}</h2>
            <StatTable columns={tableCols} rows={data.career} keyField="player_id" />
          </div>
        </>
      )}
    </div>
  )
}
