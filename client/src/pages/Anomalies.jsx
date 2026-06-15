import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api'
import AnomalyFeed from '../components/AnomalyFeed'
import { fmtSeason } from '../utils'

export default function Anomalies() {
  const navigate = useNavigate()
  const [season, setSeason] = useState(null)

  const { data: seasons } = useApi(() => api.getAnomalySeasons(), [])

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span>←</span> Back to home
        </button>

        {/* Year filter */}
        {seasons && seasons.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Season</span>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSeason(null)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={season === null
                  ? { background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }
                  : { background: 'transparent', border: '1px solid #334155', color: '#64748b' }
                }
              >
                All
              </button>
              {seasons.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSeason(yr)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={season === yr
                    ? { background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }
                    : { background: 'transparent', border: '1px solid #334155', color: '#64748b' }
                  }
                >
                  {fmtSeason(yr)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnomalyFeed limit={500} season={season} />
    </div>
  )
}
