/* eslint-disable */
import { useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UserProvider } from './context/UserContext'
import Nav from './components/Nav'
import Auth from './pages/Auth'
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
import Anomalies from './pages/Anomalies'
import Feedback from './pages/Feedback'
import AdminPanel from './pages/AdminPanel'
import About from './pages/About'
import Privacy from './pages/Privacy'
import FdvPage from './pages/FdvPage'
import SourcesPage from './pages/SourcesPage'
import Onboarding from './components/Onboarding'
import Footer from './components/Footer'

function AppInner() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  useEffect(() => {
    const html = document.documentElement
    const theme = user?.theme || 'dark'
    html.classList.toggle('dark',  theme === 'dark')
    html.classList.toggle('light', theme === 'light')
  }, [user?.theme])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="text-slate-400 text-sm animate-pulse">Loading…</span>
      </div>
    )
  }

  if (location.pathname === '/login') {
    return user ? <Navigate to="/" replace /> : <Auth />
  }

  if (['/about', '/privacy', '/methodology'].includes(location.pathname)) {
    if (location.pathname === '/about')       return <About />
    if (location.pathname === '/privacy')     return <Privacy />
    if (location.pathname === '/methodology') return <FdvPage />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <UserProvider>
      <div className="flex flex-col bg-slate-950 min-h-screen">
        <Nav />
        <Onboarding />
        <main className="flex-1 w-full mx-auto max-w-6xl px-4 py-6">
          <Routes>
            <Route path="/"                element={<PlayerSearch />} />
            <Route path="/players"         element={<PlayerLanding />} />
            <Route path="/player/:id"      element={<PlayerProfile />} />
            <Route path="/comparison"      element={<Comparison />} />
            <Route path="/draft"           element={<DraftAnalysis />} />
            <Route path="/search"          element={<NaturalSearch />} />
            <Route path="/saved"           element={<Saved />} />
            <Route path="/trends"          element={<LeagueTrends />} />
            <Route path="/guide"           element={<Guide />} />
            <Route path="/admin/ai"        element={<AdminAi />} />
            <Route path="/admin"           element={<AdminPanel />} />
            <Route path="/anomalies"       element={<Anomalies />} />
            <Route path="/feedback"        element={<Feedback />} />
            <Route path="/about"           element={<About />} />
            <Route path="/privacy"         element={<Privacy />} />
            <Route path="/methodology"     element={<FdvPage />} />
            <Route path="/sources"          element={<SourcesPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </UserProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
