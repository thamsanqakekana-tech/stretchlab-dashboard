/**
 * Dashboard config — single source of truth for benchmarks, role-gating, and thresholds.
 *
 * Two benchmark sets:
 *   COLD_OUTREACH_BENCHMARKS — used in client view and as the primary benchmark everywhere.
 *     These are calibrated for dormant leads (6–12 months inactive).
 *   FRESH_LEAD_BENCHMARKS — manager view only, shown alongside cold benchmarks for context.
 *     These apply to fresh studio inquiries (0–14 days).
 */

// ─── Cold outreach benchmarks (primary — client + manager views) ──────────────
export const COLD_OUTREACH_BENCHMARKS = {
  connect_rate: {
    min: 10, max: 18, target: 15,
    label: 'Connect Rate',
    unit: '%',
    definition: 'Calls where the lead picked up and spoke with Phiwe for 30+ seconds — real two-way contact. Excludes voicemails, immediate hang-ups, and unanswered calls.',
    why_cold: 'Calibrated for dormant leads (6–12 months inactive). Fresh leads answer 50–70% of calls; cold revival campaigns achieve 10–18% real connect rate.',
    lower_is_better: false,
  },
  booking_rate: {
    min: 0.5, max: 1.5, target: 1.0,
    label: 'Booking Conversion',
    unit: '%',
    definition: 'Percentage of all calls that resulted in a booked appointment (bookings ÷ total calls).',
    why_cold: 'Cold dormant outreach: 0.5–1.5% calls-to-booking is the typical range. Higher than this indicates strong qualification; lower suggests the lead list or script needs review.',
    lower_is_better: false,
  },
  show_rate: {
    min: 8, max: 15, target: 12,
    label: 'Show Rate',
    unit: '%',
    definition: 'Booked appointments where the lead actually attended the intro session.',
    why_cold: 'Cold revival benchmark. Fresh studio leads show at 25–40%; leads reactivated from 6–12 months of dormancy show at 8–15%. This campaign uses the cold standard.',
    lower_is_better: false,
  },
  cancel_rate: {
    min: 20, max: 35, target: 25,
    label: 'Cancellation Rate',
    unit: '%',
    definition: 'Booked appointments that were cancelled before the session occurred.',
    why_cold: 'Higher than fresh leads — expected. Cold leads have lower immediate commitment at point of booking. 20–35% is the normal range for cold revival campaigns.',
    lower_is_better: true,
  },
}

// ─── Fresh-lead benchmarks (manager view only — shown alongside cold for context) ──
export const FRESH_LEAD_BENCHMARKS = {
  show_rate:    { target: 30, range: '25–40%', label: 'Fresh lead benchmark' },
  booking_rate: { target: 2,  range: '1.5–3%', label: 'Fresh lead benchmark' },
  cancel_rate:  { target: 12, range: '10–15%', label: 'Fresh lead benchmark' },
}

// Legacy alias — kept for backward compatibility with existing manager/admin pages
export const BENCHMARKS = {
  show_rate:       { industry_min: 8,  industry_max: 15, target: 12  },
  booking_rate:    { industry_min: 0.5, industry_max: 1.5, target: 1.0 },
  cancel_rate:     { industry_max: 35, target: 25 },
  engagement_rate: { industry_min: 10, target: 15 },
}

// ─── Role-gating ──────────────────────────────────────────────────────────────
export const CLIENT_HIDDEN_METRICS = [
  'first_visits',
  'first_visit_rate',
  'percentiles',
  'engagement_rate',
  'ringing_time',
  'days_call_to_booking',
  'days_booking_to_show',
  'reschedule_rate',
  'attribution_percentage',
]

export const ACCESS_LEVELS = {
  client: {
    domain: '@stretchlab.com',
    pages: ['Campaign Pulse', 'Results', 'Partnership Actions'],
    hiddenMetrics: CLIENT_HIDDEN_METRICS,
    messaging: 'constructive',
  },
  manager: {
    domain: '@execo.com',
    pages: ['Campaign Pulse', 'Results', 'Partnership Actions', 'Campaign Status', 'Cancellation Dive', 'Call Timing', 'At-Risk Pipeline', 'Action Plan', 'LoyalSnap'],
    hiddenMetrics: [],
    messaging: 'honest',
  },
  admin: {
    email: 'thamsanqa.kekana@execo.com',
    pages: ['all'],
    hiddenMetrics: [],
    messaging: 'honest',
    features: ['data_upload', 'validation_log', 'manual_tracker_comparison'],
  },
}

export const VALIDATION_THRESHOLDS = {
  attribution_gap_pct: 10,
  manual_tracker_drift_pct: 10,
  min_calls_per_day: 50,
  max_cancel_rate: 80,
}

// SOW ramp targets by month
export const RAMP_TARGETS = { 1: 30, 2: 50, 3: 77 }

// Campaign pricing — read by dashboard components; sourced from phiwe_revenue_intelligence.csv
// at runtime when available, falling back to these config values.
export const SESSION_INTRO_PRICE      = 69   // $69 introductory session
export const MEMBERSHIP_MONTHLY_PRICE = 338  // $338 average monthly membership

// SOW campaign date boundaries
export const CAMPAIGN_MONTHS = [
  { num: 1, label: 'Month 1', start: '2026-02-24', end: '2026-03-24', target: 30 },
  { num: 2, label: 'Month 2', start: '2026-03-25', end: '2026-04-24', target: 50 },
  { num: 3, label: 'Month 3', start: '2026-04-25', end: '2026-05-24', target: 77 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns benchmark object for a metric key from the cold outreach set. */
export function getColdBenchmark(metricKey) {
  return COLD_OUTREACH_BENCHMARKS[metricKey] ?? null
}

/** Status relative to cold outreach benchmark: 'above' | 'within' | 'below' */
export function benchmarkStatus(metricKey, actualValue) {
  const bm = COLD_OUTREACH_BENCHMARKS[metricKey]
  if (!bm) return 'within'
  if (bm.lower_is_better) {
    if (actualValue <= bm.min)  return 'above'   // better than best
    if (actualValue <= bm.max)  return 'within'
    return 'below'
  } else {
    if (actualValue >= bm.max)  return 'above'
    if (actualValue >= bm.min)  return 'within'
    return 'below'
  }
}

/** Status label text for a benchmarkStatus result */
export function benchmarkLabel(status, lowerIsBetter = false) {
  if (status === 'above')  return lowerIsBetter ? 'Excellent' : 'Above range'
  if (status === 'within') return 'On track'
  return lowerIsBetter ? 'High — monitor' : 'Below range'
}

/** Status color for a benchmarkStatus result */
export function benchmarkColor(status) {
  if (status === 'above')  return 'var(--status-above)'
  if (status === 'within') return 'var(--status-within)'
  return 'var(--status-below)'
}

/** Returns true if a metric key should be hidden for the given role. */
export function isMetricHidden(metricKey, role) {
  const level = ACCESS_LEVELS[role]
  if (!level) return false
  return (level.hiddenMetrics ?? []).includes(metricKey)
}

/** Legacy — used by existing manager/admin pages. */
export function isBelowBenchmark(metricKey, actualValue) {
  const bm = BENCHMARKS[metricKey]
  if (!bm) return false
  if (metricKey === 'cancel_rate') return actualValue > bm.target
  if (bm.industry_min !== undefined) return actualValue < bm.industry_min
  return false
}
