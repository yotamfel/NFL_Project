/**
 * Export a Recharts chart (inside wrapperEl) as a PNG.
 * Finds the SVG, draws it on a canvas with a dark background and optional
 * title row above, then triggers a browser download.
 */
export async function exportChartAsPng(wrapperEl, title, filename = 'chart.png') {
  // Skip SVGs inside buttons (e.g. the download icon itself)
  const svg = [...wrapperEl.querySelectorAll('svg')].find(s => !s.closest('button'))
  if (!svg) return

  const { width: W, height: H } = svg.getBoundingClientRect()
  const TITLE_H = title ? 38 : 0
  const DPR = window.devicePixelRatio || 1

  // Clone + make self-contained
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', W)
  clone.setAttribute('height', H)

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)],
             { type: 'image/svg+xml;charset=utf-8' })
  )

  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(W  * DPR)
  canvas.height = Math.round((H + TITLE_H) * DPR)
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)

  // Dark background
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, W, H + TITLE_H)

  // Title row
  if (title) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(title, 16, 26)
  }

  // Chart SVG
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl })
  ctx.drawImage(img, 0, TITLE_H, W, H)
  URL.revokeObjectURL(svgUrl)

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: filename }).click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
