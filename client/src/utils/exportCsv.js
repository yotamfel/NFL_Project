export function exportTableAsCsv(columns, rows, filename = 'data.csv') {
  const esc = v => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    columns.map(c => esc(c.label ?? c.key)).join(','),
    ...rows.map(row => columns.map(c => esc(row[c.key])).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

export function csvFilename(title) {
  return `${(title || 'data').replace(/[^a-z0-9 \--]/gi, '').replace(/\s+/g, '_')}.csv`
}
