import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  {
    title: 'Welcome to Fourth & Data',
    text: 'Explore stats for 19,000+ NFL players from 1970 to 2025. Here\'s a quick tour.',
    icon: '🏈',
  },
  {
    title: 'Find Any Player',
    text: 'Search by name, filter by position, season, or team. Open a player profile to see career stats, charts, injuries, snap counts, and more.',
    icon: '🔍',
  },
  {
    title: 'Ask Questions in Plain English',
    text: 'Use Smart Search to ask anything — "Who had the most rushing yards in 2022?" or "Top QBs by passer rating since 2015".',
    icon: '🤖',
  },
  {
    title: 'Save Your Work',
    text: 'Bookmark players, save comparisons, and add your own notes. Everything syncs to your account.',
    icon: '★',
  },
]

export default function Onboarding() {
  const { user, updatePreferences } = useAuth()
  const [step, setStep] = useState(0)

  if (!user || user.onboarding_complete) return null

  const dismiss = async () => {
    await updatePreferences({ onboarding_complete: true }).catch(() => {})
  }

  const isLast = step === STEPS.length - 1
  const s = STEPS[step]

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-5xl mb-4 text-center">{s.icon}</div>
        <h2 className="text-xl font-bold text-white text-center mb-3">{s.title}</h2>
        <p className="text-slate-400 text-sm leading-relaxed text-center mb-8">{s.text}</p>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-amber-400' : 'bg-slate-700'}`} />
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={dismiss}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm transition-colors">
            Skip
          </button>
          <button onClick={() => isLast ? dismiss() : setStep(s => s + 1)}
            className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors">
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
