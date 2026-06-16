import { useNavigate } from 'react-router-dom'

export default function About() {
  const navigate = useNavigate()
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <button onClick={() => navigate('/')}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4 flex items-center gap-1">
          ← Back to homepage
        </button>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">FOURTH & DATA</p>
        <h1 className="text-3xl font-black text-white tracking-tight">About</h1>
      </div>

      <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-8 space-y-6 text-slate-300 text-sm leading-relaxed">
        <p>Fourth & Data is a statistics explorer built for fans who want to go deeper than the box score.</p>
        <p>Search and compare thousands of players across more than five decades of NFL football — from career totals to advanced metrics, draft history, combine measurements, and much more. Ask questions in plain English and get answers directly from the data.</p>

        <div>
          <h2 className="text-white font-bold mb-2">The data</h2>
          <p>Statistics are sourced from multiple data providers and currently cover the 1970–2025 regular seasons, with new seasons added each year as they are completed. Different data types have different coverage windows — see the in-app Guide for full details.</p>
        </div>

        <div>
          <h2 className="text-white font-bold mb-2">Built by</h2>
          <p>Yotam — data analyst and NFL fan. Built as a personal project to make NFL statistics accessible to everyone.</p>
        </div>
      </div>

      <button onClick={() => navigate('/')}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
        ← Back to homepage
      </button>
    </div>
  )
}
