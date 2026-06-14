import { Routes, Route } from 'react-router-dom'
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

function AppInner() {
  const { username } = useUser()
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {!username && <UsernameSetup />}
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
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
