import { useState, useEffect } from 'react'

export default function Footer() {
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    fetch('/api/meta').then(r => r.json()).then(setMeta).catch(() => {})
  }, [])

  return (
    <footer className="border-t border-slate-800 mt-auto py-4 px-4">
      <p className="text-center text-slate-600 text-xs">
        {meta?.data_last_updated
          ? <>NFL stats data last updated: <span className="text-slate-500">{meta.data_last_updated}</span> · Stats cover 1970–2025 regular seasons</>
          : 'NFL stats data · 1970–2025 regular seasons'
        }
      </p>
    </footer>
  )
}
