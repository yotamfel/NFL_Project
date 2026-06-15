import { Routes, Route, useLocation } from 'react-router-dom'
import { useUser, UserProvider } from './context/UserContext'
import Nav from './components/Nav'
import UsernameSetup from './components/UsernameSetup'
import PlayerSearch from './pages/PlayerSearch'
import PlayerLanding from './pages/PlayerLanding'
import PlayerProfile from './pages/PlayerProfile'
import Comparison from './pages/Comparison'
import DraftAnalysis from './pages/DraftAnalysis'
import NaturalSearch from './pages/NaturalSearch'
import Saved from './pages/Saved'
import LeagueTrends from './pages/LeagueTrends'
import Guide from './pages/Guide'
import AdminAi from './pages/AdminAi'
import Dashboard from './pages/Dashboard'
import DashboardBuilder from './pages/DashboardBuilder'
import Anomalies from './pages/Anomalies'

function AppInner() {
  const { username } = useUser()
  const location = useLocation()
  const isBuilder = /^\/dashboard\/.+/.test(location.pathname)
  return (
    <div className={`flex flex-col bg-slate-950 ${isBuilder ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {!username && <UsernameSetup />}
      <Nav />
      <main className={`flex-1 w-full mx-auto ${isBuilder ? 'min-h-0 overflow-hidden' : 'max-w-6xl px-4 py-6'}`}>
        <Routes>
          <Route path="/" element={<PlayerSearch />} />
          <Route path="/players" element={<PlayerLanding />} />
          <Route path="/player/:id" element={<PlayerProfile />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/draft" element={<DraftAnalysis />} />
          <Route path="/search" element={<NaturalSearch />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/trends" element={<LeagueTrends />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/admin/ai" element={<AdminAi />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:id" element={<DashboardBuilder />} />
          <Route path="/anomalies" element={<Anomalies />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <UserProvider>
      <AppInner />
    </UserProvider>
  )
}
