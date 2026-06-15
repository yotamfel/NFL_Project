export default function EmptyState({ message, icon = '○' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-3xl mb-3 opacity-30">{icon}</span>
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  )
}
