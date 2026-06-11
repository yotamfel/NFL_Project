// Generic stats table. columns = [{key, label, format?, desc?}] where:
//   format(value, row) -> string | ReactNode
//   desc -> string shown as hover tooltip on the column header
export default function StatTable({ columns, rows, keyField = 'id' }) {
  if (!rows.length) {
    return <p className="text-slate-500 text-sm py-4 text-center">No data</p>
  }
  return (
    <div className="scroll-x rounded-lg border border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-slate-400">
            {columns.map(col => (
              <th key={col.key} className="relative group px-3 py-2 text-left font-medium whitespace-nowrap">
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.desc && (
                    <span className="text-slate-600 group-hover:text-slate-400 cursor-help text-xs leading-none select-none">ⓘ</span>
                  )}
                </span>
                {col.desc && (
                  <div className="pointer-events-none absolute bottom-full right-0 mb-1 z-50
                    hidden group-hover:block w-56 rounded-lg bg-slate-950 border border-slate-700
                    px-3 py-2 text-xs text-slate-300 shadow-xl font-normal whitespace-normal leading-relaxed">
                    {col.desc}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row[keyField] ?? i}
              className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'} hover:bg-slate-800 transition-colors`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-3 py-2 text-slate-200 whitespace-nowrap">
                  {col.format ? col.format(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
