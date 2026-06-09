import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import PlayerSearch from './pages/PlayerSearch'
import PlayerProfile from './pages/PlayerProfile'
import Comparison from './pages/Comparison'
import DraftAnalysis from './pages/DraftAnalysis'
import NaturalSearch from './pages/NaturalSearch'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<PlayerSearch />} />
          <Route path="/player/:id" element={<PlayerProfile />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/draft" element={<DraftAnalysis />} />
          <Route path="/search" element={<NaturalSearch />} />
        </Routes>
      </main>
    </div>
  )
}
