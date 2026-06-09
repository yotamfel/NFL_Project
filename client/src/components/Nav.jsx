import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Players', end: true },
  { to: '/comparison', label: 'Compare' },
  { to: '/draft', label: 'Draft' },
  { to: '/search', label: 'Smart Search' },
]

export default function Nav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-6 h-14">
        <NavLink to="/" className="text-white font-bold text-base flex items-center gap-2">
          🏈 <span>NFL Data</span>
        </NavLink>
        <div className="flex gap-5 ml-4">
          {LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-100'
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
