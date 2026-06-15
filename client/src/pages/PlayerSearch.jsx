import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks/useApi'
import AnomalyFeed from '../components/AnomalyFeed'

const FEATURE_CARDS = [
  {
    icon: '📊', title: 'Career Stats',
    desc: 'Season-by-season breakdowns with trend charts, advanced metrics, NGS and snap counts',
    href: '/player/MahoPa00',
    color: '#3b82f6', dark: '#1e3a5f',
  },
  {
    icon: '⚖️', title: 'Compare Players',
    desc: 'Side-by-side career comparison across any stat category',
    href: '/comparison',
    color: '#fbbf24', dark: '#451a03',
  },
  {
    icon: '🎯', title: 'Draft Analysis',
    desc: 'ML-powered steals, busts and combine value model',
    href: '/draft',
    color: '#4ade80', dark: '#14532d',
  },
  {
    icon: '🤖', title: 'Smart Search',
    desc: 'Ask anything in plain English — AI translates to stats',
    href: '/search',
    color: '#a78bfa', dark: '#2e1065',
  },
  {
    icon: '📈', title: 'League Trends',
    desc: 'Track how the whole league has evolved season by season',
    href: '/trends',
    color: '#f472b6', dark: '#500724',
  },
  {
    icon: '📋', title: 'Dashboard',
    desc: 'Build custom dashboards with charts, tables and text widgets — drag, resize, and export',
    href: '/dashboard',
    color: '#22d3ee', dark: '#083344',
  },
]

function fmtPlayers(n) {
  if (!n) return '20,000+'
  const k = Math.floor(n / 1000) * 1000
  return `${k.toLocaleString()}+`
}

export default function PlayerSearch() {
  const navigate = useNavigate()
  const { data: meta } = useApi(() => api.getMeta(), [])

  const playerLabel  = fmtPlayers(meta?.players)
  const seasonLabel  = meta?.seasons ? `${meta.seasons} seasons` : '56 seasons'
  const teamLabel    = `${meta?.teams ?? 32} teams`

  return (
    <div className="max-w-3xl mx-auto pt-10 pb-24">

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black tracking-tighter mb-3 leading-none">
          <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">NFL</span>
          <span className="text-white"> DATA</span>
        </h1>
        <p className="text-slate-400 text-sm tracking-wide">
          {playerLabel} &nbsp;·&nbsp; {seasonLabel} &nbsp;·&nbsp; {teamLabel}
        </p>
        <p className="text-slate-400 text-sm mt-4 leading-relaxed max-w-md mx-auto">
          An NFL analytics platform built on a full historical database.
          Search players, compare careers, explore the draft, run AI-powered queries, track league trends, and save your work.
          <br />
          <span className="text-slate-500 text-xs mt-1 inline-block">
            Full details in the <a href="/guide" className="text-amber-500/70 hover:text-amber-400 transition-colors">Guide</a>.
          </span>
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {FEATURE_CARDS.map(card => (
          <button key={card.href} onClick={() => navigate(card.href)}
            className="rounded-2xl overflow-hidden text-left hover:scale-[1.02] transition-transform"
            style={{ background: `linear-gradient(160deg, ${card.dark} 0%, #1e293b 100%)`, border: `1px solid ${card.color}22` }}>
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${card.color}, transparent)` }} />
            <div className="p-5">
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="text-white font-bold mb-1">{card.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12">
        <AnomalyFeed limit={10} compact sort="latest" />
      </div>
    </div>
  )
}
