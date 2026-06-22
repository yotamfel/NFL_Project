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
import ContentHistory from './pages/ContentHistory'
import SituationalStats from './pages/SituationalStats'
import Portfolio from './pages/Portfolio'
import Onboarding from './components/Onboarding'
import Footer from './components/Footer'

function GuestBlocked({ feature }) {
  return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-4">
      <p className="text-4xl">🔒</p>
      <h2 className="text-white text-xl font-bold">{feature}</h2>
      <p className="text-slate-400 text-sm">Sign up for a free account to access this feature.</p>
      <a href="/login" className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">Create Account</a>
    </div>
  )
}

function GuestSessionEnded() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <img src="/logo.png" alt="" className="w-16 h-16 mx-auto" />
        <h1 className="text-white text-2xl font-black">Guest Session Ended</h1>
        <p className="text-slate-400 text-sm">Your 10-minute guest session has expired. Sign up for free to get full, unlimited access.</p>
        <a href="/login" className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-8 rounded-lg text-sm transition-colors">Sign Up</a>
      </div>
    </div>
  )
}

function AppInner() {
  const { user, isLoading, guestExpired } = useAuth()
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

  if (['/about', '/privacy', '/methodology', '/portfolio'].includes(location.pathname)) {
    if (location.pathname === '/about')       return <About />
    if (location.pathname === '/privacy')     return <Privacy />
    if (location.pathname === '/methodology') return <FdvPage />
    if (location.pathname === '/portfolio')   return <Portfolio />
  }

  if (!user && guestExpired) {
    return <GuestSessionEnded />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const isGuest = user.isGuest

  return (
    <UserProvider>
      <div className="flex flex-col bg-slate-950 min-h-screen">
        <Nav />
        {!isGuest && <Onboarding />}
        {isGuest && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 text-center py-1.5">
            <span className="text-amber-400 text-xs">Guest mode</span>
            <span className="text-slate-500 text-xs mx-2">-</span>
            <a href="/login" className="text-amber-400 text-xs font-semibold hover:text-amber-300">Sign up for full access</a>
          </div>
        )}
        <main className="flex-1 w-full mx-auto max-w-6xl px-4 py-6">
          <Routes>
            <Route path="/"                element={<PlayerSearch />} />
            <Route path="/players"         element={<PlayerLanding />} />
            <Route path="/player/:id"      element={<PlayerProfile />} />
            <Route path="/comparison"      element={<Comparison />} />
            <Route path="/draft"           element={<DraftAnalysis />} />
            <Route path="/search"          element={isGuest ? <GuestBlocked feature="Smart Search" /> : <NaturalSearch />} />
            <Route path="/saved"           element={isGuest ? <GuestBlocked feature="Saved Items" /> : <Saved />} />
            <Route path="/trends"          element={<LeagueTrends />} />
            <Route path="/guide"           element={<Guide />} />
            {user?.is_admin && <Route path="/admin/ai" element={<AdminAi />} />}
            {user?.is_admin && <Route path="/admin"   element={<AdminPanel />} />}
            <Route path="/anomalies"       element={<Anomalies />} />
            <Route path="/feedback"        element={isGuest ? <GuestBlocked feature="Feedback" /> : <Feedback />} />
            <Route path="/about"           element={<About />} />
            <Route path="/privacy"         element={<Privacy />} />
            <Route path="/methodology"     element={<FdvPage />} />
            {user?.is_admin && <Route path="/content-history" element={<ContentHistory />} />}
            {user?.is_admin && <Route path="/situational" element={<SituationalStats />} />}
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
