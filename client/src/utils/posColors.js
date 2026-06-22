const PALETTE = {
  QB: { hex: '#60a5fa', dark: '#1e3a5f', mid: '#1d4ed8' },
  RB: { hex: '#4ade80', dark: '#14532d', mid: '#15803d' },
  WR: { hex: '#fbbf24', dark: '#451a03', mid: '#b45309' },
  TE: { hex: '#fb923c', dark: '#431407', mid: '#c2410c' },
  OL: { hex: '#94a3b8', dark: '#1e293b', mid: '#475569' },
  DL: { hex: '#f87171', dark: '#450a0a', mid: '#b91c1c' },
  LB: { hex: '#f87171', dark: '#450a0a', mid: '#b91c1c' },
  CB: { hex: '#e879f9', dark: '#3b0764', mid: '#a21caf' },
  S:  { hex: '#e879f9', dark: '#3b0764', mid: '#a21caf' },
  K:  { hex: '#a78bfa', dark: '#2e1065', mid: '#6d28d9' },
  P:  { hex: '#a78bfa', dark: '#2e1065', mid: '#6d28d9' },
}
const FALLBACK = { hex: '#94a3b8', dark: '#1e293b', mid: '#475569' }

export function posColor(pos) {
  return PALETTE[pos?.toUpperCase()] ?? FALLBACK
}

// Returns a CSS gradient string for use in style={{ background: ... }}
export function posGradient(pos) {
  const c = posColor(pos)
  return `linear-gradient(135deg, ${c.dark} 0%, #0f172a 60%)`
}

// Diagonal stripe overlay - gives the "trading card foil" texture
export const CARD_STRIPES =
  'repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(255,255,255,0.03) 14px, rgba(255,255,255,0.03) 28px)'
