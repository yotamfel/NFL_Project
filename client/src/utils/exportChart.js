import { toPng } from 'html-to-image'

export async function exportChartAsPng(wrapperEl, title, filename = 'chart.png') {
  // Hide the download button so it doesn't appear in the export
  const btn = wrapperEl.querySelector('button')
  if (btn) btn.style.display = 'none'

  try {
    const { width: W, height: H } = wrapperEl.getBoundingClientRect()
    const TITLE_H = title ? 38 : 0
    const DPR = window.devicePixelRatio || 1

    // Capture the wrapper element exactly as rendered (CSS included)
    const chartDataUrl = await toPng(wrapperEl, {
      backgroundColor: '#1e293b',
      pixelRatio: DPR,
      width: W,
      height: H,
    })

    if (!title) {
      Object.assign(document.createElement('a'), { href: chartDataUrl, download: filename }).click()
      return
    }

    // Add a title bar above the chart
    const chartImg = new Image()
    await new Promise((res, rej) => { chartImg.onload = res; chartImg.onerror = rej; chartImg.src = chartDataUrl })

    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(W * DPR)
    canvas.height = Math.round((H + TITLE_H) * DPR)
    const ctx = canvas.getContext('2d')
    ctx.scale(DPR, DPR)

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, W, H + TITLE_H)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(title, 16, 26)

    ctx.drawImage(chartImg, 0, TITLE_H, W, H)

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: filename }).click()
      URL.revokeObjectURL(url)
    }, 'image/png')

  } finally {
    if (btn) btn.style.display = ''
  }
}
