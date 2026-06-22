import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SOURCES = [
  {
    name: 'nflverse / nflreadpy',
    url: 'nflverse.nflreadr.com',
    badge: 'Primary',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    icon: '📦',
    coverage: '1999 – present',
    sections: [
      {
        title: 'What it is',
        body: 'nflverse is an open-source ecosystem of NFL data maintained by a community of independent developers and data scientists - not affiliated with the NFL or any team. It is the most widely used free NFL data resource in the data science and analytics community. The Python client is called nflreadpy; the R client is nflreadr. Both connect to the same underlying datasets hosted on GitHub.',
      },
      {
        title: 'Who builds it',
        body: 'nflverse is maintained by a small team of volunteer contributors who have built pipelines that pull data from the official NFL API, ESPN feeds, and other public sources, then clean, structure, and publish it as machine-readable datasets updated weekly during the season. Key contributors include Ben Baldwin, Sebastian Carl, and Lee Sharpe, all of whom are well known in the NFL analytics community.',
      },
      {
        title: 'Why we need it alongside PFR',
        body: 'PFR is excellent for historical breadth but its data is accessed through web scraping, which is time-consuming and requires significant cleanup. nflverse provides clean, structured, rapidly-updated datasets that are especially strong for recent seasons (2019 onward) and for data types that PFR does not expose in machine-readable form - such as snap counts, week-by-week game logs, and detailed tracking-based metrics.',
      },
      {
        title: 'Data it provides to this platform',
        body: 'Through nflreadpy we ingest recent season statistics that supplement the PFR historical base; per-game player logs going back to 1999; snap count percentages by week (how much of each team\'s offensive, defensive, or special teams snaps a player was on the field for); official NFL injury report filings by week and body part; and advanced receiving metrics such as average depth of target, yards after catch, broken tackles, and drop rate.',
      },
    ],
  },
  {
    name: 'FDV - Fourth & Data Value',
    url: '/methodology',
    badge: 'Proprietary',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    icon: '📐',
    coverage: '1970 – present',
    sections: [
      {
        title: 'What it is',
        body: 'FDV (Fourth & Data Value) is a proprietary career value metric built entirely from the statistics and draft data in this platform. It replaces PFR\'s Career Approximate Value (AV) as the primary career quality signal - with a fully transparent, position-aware, independently computed alternative.',
      },
      {
        title: 'Why we built it',
        body: 'Career AV is a useful benchmark but it is a third-party metric whose exact formula is not fully disclosed and cannot be independently reproduced. FDV is our answer: every number is traceable to a specific formula and a specific row in our database. The full methodology is documented at /methodology.',
      },
      {
        title: 'How it is computed',
        body: 'Each of 11 position groups (QB, RB, WR, TE, EDGE, DT, LB, CB, S, K, P) has a tailored formula. Per-season raw scores are z-scored within position and year, then converted to season FDV (max 18). Career FDV uses longevity decay (top-10 seasons full value, 11-13 at 50%, 14+ at 30%). Scores are cross-normalised across positions and weighted by a draft-derived positional value multiplier (0.70–1.20).',
      },
      {
        title: 'Where it appears',
        body: 'FDV is displayed on every player profile page, is the primary career quality signal in Draft Analysis (custom queries, steals/busts, round stats), and is available as a leaderboard filter in Player Comparison. It is updated by running etl/build_fdv_v3.py after any new season data is loaded.',
      },
    ],
  },
  {
    name: 'NFL Next Gen Stats (NGS)',
    url: 'nextgenstats.nfl.com',
    badge: 'Tracking',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    icon: '📡',
    coverage: '2016 – present',
    sections: [
      {
        title: 'What it is',
        body: 'Next Gen Stats is the NFL\'s official player tracking system, operated in partnership with AWS (Amazon Web Services). It uses a network of RFID chips embedded in each player\'s shoulder pads and in the game ball to capture player position and movement data 10 times per second during every play of every game.',
      },
      {
        title: 'What makes it unique',
        body: 'Unlike traditional box-score stats, which only measure outcomes (yards gained, touchdowns scored), NGS measures the context and process behind those outcomes. It can tell you how much separation a receiver had from the nearest defender at the exact moment the ball was thrown, how quickly a running back accelerates through the hole, or what percentage of a quarterback\'s passes were thrown into tight windows.',
      },
      {
        title: 'Metrics on this platform',
        body: 'We incorporate NGS data for quarterbacks (time to throw, intended and completed air yards, aggressiveness rate, completion percentage over expectation), running backs (rushing efficiency score, time to reach the line of scrimmage, rush yards over expectation), and wide receivers and tight ends (average separation, cushion from the corner at the snap, and yards after catch above expectation). All NGS metrics are available from the 2016 season onward.',
      },
    ],
  },
  {
    name: 'Pro Football Reference (PFR)',
    url: 'pro-football-reference.com',
    badge: 'Historical',
    badgeColor: 'bg-slate-500/20 text-slate-400',
    icon: '🏈',
    coverage: '1970 – 2024 (one-time scrape)',
    sections: [
      {
        title: 'What it is',
        body: 'Pro Football Reference is widely regarded as the most comprehensive and authoritative NFL statistics database available to the public. It is part of the Sports Reference family of sites and has been the go-to resource for journalists, analysts, and researchers for over two decades.',
      },
      {
        title: 'Role in this platform',
        body: 'PFR was used as a one-time historical source to build the foundational dataset - all season statistics from 1970 through 2024, draft records, and combine measurements. It is not an active live dependency. New season data is handled by nflverse.',
      },
      {
        title: 'What we took from it',
        body: 'All passing, rushing, receiving, defense, kicking, punting, and return statistics by season (1970–2024); draft pick records including round, pick, position, and college; combine measurements (height, weight, 40-yard dash, vertical jump, broad jump, bench press, 3-cone, shuttle). PFR\'s Career AV column is stored in the draft table as a legacy field but is no longer used - it has been replaced by our own FDV metric.',
      },
      {
        title: 'Why it is no longer the primary source',
        body: 'PFR data is accessed via web scraping, which is brittle, slow, and subject to rate limits. Their Career AV metric is also opaque - the formula is not fully disclosed and cannot be independently reproduced. Going forward, nflverse provides cleaner, machine-readable, regularly updated data, and FDV replaces AV as the career quality signal.',
      },
    ],
  },
]

export default function SourcesPage() {
  const [open, setOpen] = useState({})
  const navigate = useNavigate()
  const toggle = (sourceIdx, sectionIdx) => {
    const key = `${sourceIdx}-${sectionIdx}`
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 py-6">

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Home
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">Data Sources</h1>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
          The platform is built on three external data sources plus our own proprietary FDV metric.
          Career quality is measured by FDV (Fourth & Data Value), computed entirely from our own data.
        </p>
      </div>

      {SOURCES.map((src, si) => (
        <div key={si} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800 flex items-start gap-4">
            <span className="text-3xl mt-0.5">{src.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-lg">{src.name}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${src.badgeColor}`}>{src.badge}</span>
              </div>
              <p className="text-slate-500 text-xs font-mono">{src.url}</p>
              <p className="text-slate-400 text-sm mt-1">Coverage: <span className="text-slate-300 font-medium">{src.coverage}</span></p>
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {src.sections.map((sec, idx) => {
              const key = `${si}-${idx}`
              const isOpen = open[key]
              return (
                <div key={idx}>
                  <button
                    onClick={() => toggle(si, idx)}
                    className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors">
                    <span className="text-slate-200 text-sm font-medium">{sec.title}</span>
                    <span className="text-slate-500 text-xs ml-4 shrink-0">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1">
                      <p className="text-slate-400 text-sm leading-relaxed">{sec.body}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
