// =====================================================================
// Computed status — THE single source of truth.
// Status/colour/urgency is DERIVED from expiry_date vs. today, never
// stored, so it can never go stale. Reuse this everywhere (list rows,
// dashboard counters, reminder engine). Mirror of PLAN.md.
// =====================================================================

export const STATUS = {
  VALID: 'valid',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
}

/** Whole days between today (local) and an ISO date string. Negative = past. */
export function daysLeft(expiryDate, today = new Date()) {
  if (!expiryDate) return null
  const end = new Date(expiryDate)
  // Normalise both to midnight so partial days don't skew the count.
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((b - a) / 86400000)
}

/**
 * Map an item to a status bucket.
 *   expired            -> EXPIRED (red)
 *   days_left <= 30    -> EXPIRED (red, urgent)
 *   days_left <= 60    -> EXPIRING (yellow)
 *   days_left <= 90    -> EXPIRING (yellow, early)
 *   else               -> VALID (green)
 * Items with no expiry_date are treated as VALID (nothing to watch).
 */
export function itemStatus(item, today = new Date()) {
  const d = daysLeft(item?.expiry_date, today)
  if (d === null) return STATUS.VALID
  if (d < 0) return STATUS.EXPIRED
  if (d <= 30) return STATUS.EXPIRED
  if (d <= 90) return STATUS.EXPIRING
  return STATUS.VALID
}

/** Tailwind-ready presentation for each bucket. */
export const STATUS_META = {
  [STATUS.VALID]:    { dot: 'bg-valid',    text: 'text-valid',    ring: 'ring-valid/30',    bg: 'bg-valid/10',    emoji: '🟢' },
  [STATUS.EXPIRING]: { dot: 'bg-expiring', text: 'text-expiring', ring: 'ring-expiring/30', bg: 'bg-expiring/10', emoji: '🟡' },
  [STATUS.EXPIRED]:  { dot: 'bg-expired',  text: 'text-expired',  ring: 'ring-expired/30',  bg: 'bg-expired/10',  emoji: '🔴' },
}

/** Count items into {valid, expiring, expired, total}. */
export function summarize(items, today = new Date()) {
  const acc = { valid: 0, expiring: 0, expired: 0, total: items.length }
  for (const it of items) acc[itemStatus(it, today)] += 1
  return acc
}

/**
 * Readiness score 0–100: share of items that are not red, lightly
 * penalising yellows. Simple, explainable, good enough to demo.
 */
export function readinessScore(items, today = new Date()) {
  if (!items.length) return 100
  const s = summarize(items, today)
  const score = ((s.valid + s.expiring * 0.6) / s.total) * 100
  return Math.round(score)
}
