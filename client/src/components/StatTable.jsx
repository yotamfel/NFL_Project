// Generic stats table. columns = [{key, label, format?}] where format(value, row) -> string.
export default function StatTable({ columns, rows, keyField = 'id' }) {
  if (!rows.length) {
    return <p className="text-slate-500 text-sm py-4 text-center">No data</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-slate-400">
            {columns.map(col => (
              <th key={col.key} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {col.label}
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
