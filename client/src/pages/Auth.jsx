import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const [tab,      setTab]      = useState('login')
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (tab === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(username, password)
      } else {
        await register(username, email, password)
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="font-black text-2xl tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">FOURTH</span>
            <span className="text-white"> & DATA</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">NFL Analytics Platform</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-6">
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {t === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} required
                placeholder="your_username"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/60 transition-colors" />
            </div>

            {tab === 'register' && (
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} required type="email"
                  placeholder="you@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/60 transition-colors" />
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5">Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} required type="password"
                placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/60 transition-colors" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-colors">
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
