import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Players', end: true },
  { to: '/comparison', label: 'Compare' },
  { to: '/draft', label: 'Draft' },
  { to: '/search', label: 'Smart Search' },
]

export default function Nav() {
  return (
    <nav className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center gap-x-6 gap-y-2 py-2 min-h-14">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🏈</span>
          <span className="font-black text-base tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">NFL</span>
            <span className="text-white"> DATA</span>
          </span>
        </NavLink>
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          {LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
