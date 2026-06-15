/** Converts a season start year to NFL season label, e.g. 2025 → "2025-26" */
export const fmtSeason = yr => yr ? `${yr}-${String(yr + 1).slice(2)}` : ''
