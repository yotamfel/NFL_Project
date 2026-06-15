export default function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
      <span className="shrink-0 mt-0.5">⚠</span>
      <span>{message}</span>
    </div>
  )
}
