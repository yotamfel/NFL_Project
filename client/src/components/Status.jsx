export function Loading({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <svg className="animate-spin w-5 h-5 mr-3 text-blue-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {text}
    </div>
  )
}

export function ErrorMsg({ message }) {
  return (
    <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-4 text-sm">
      {message}
    </div>
  )
}
