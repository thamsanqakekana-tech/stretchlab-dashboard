/**
 * Named data loaders — each maps to an exact pipeline output filename.
 * All CSV loaders return Promise<Array<Object>>.
 * JSON loaders return Promise<Object|null>.
 *
 * All CSV loaders read from local pipeline output files in /data/.
 * Supabase helpers (loadFromSupabase, loadCSV) are retained but not used by default.
 * JSON files: local fetch only.
 */

import Papa from 'papaparse'
import { supabase } from '../lib/supabaseClient.js'

const BASE = '/data'

// ─── Supabase table fetch (paginated) ────────────────────────────────────────
// PostgREST enforces a server-side max-rows cap (typically 1,000) regardless of
// the JS .limit() call. We use .range() to paginate and collect all pages.
async function loadFromSupabase(tableName) {
  if (!supabase) throw new Error('Supabase client not initialised')
  const PAGE    = 1000
  const allData = []
  let   from    = 0
  for (let page = 0; page < 200; page++) {
    const { data, error } = await supabase.from(tableName).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    allData.push(...data)
    if (data.length < PAGE) break  // last page — no more rows
    from += PAGE
  }
  if (allData.length === 0) throw new Error('empty result')
  return allData
}

// ─── Local CSV fallback ───────────────────────────────────────────────────────
function loadCSVLocal(filename) {
  return new Promise((resolve) => {
    Papa.parse(`${BASE}/${filename}`, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => {
        console.warn(`[dataLoader] Failed to load ${filename}:`, err)
        resolve([])
      },
    })
  })
}

// ─── Primary loader: Supabase → CSV fallback ──────────────────────────────────
function loadCSV(filename) {
  const tableName = filename.replace('.csv', '')
  return loadFromSupabase(tableName).catch((err) => {
    console.info(`[dataLoader] Supabase unavailable for ${tableName} (${err.message}) — using local CSV`)
    return loadCSVLocal(filename)
  })
}

function loadJSON(filename) {
  return fetch(`${BASE}/${filename}`)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .catch((err) => { console.warn(`[dataLoader] Failed to load ${filename}:`, err); return null })
}

/**
 * Some pipeline CSVs are stored in "pivot" format: each row is {metric, value}.
 * This converts that array to a flat key→value object so components can do obj.show_rate etc.
 */
export function pivotToObject(rows) {
  if (!Array.isArray(rows)) return {}
  return rows.reduce((acc, row) => {
    if (row.metric != null) acc[row.metric] = row.value
    return acc
  }, {})
}

/**
 * Parse a percentage string that may arrive as "11.9%" or as a raw number.
 */
export function parsePct(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  const s = String(v).replace('%', '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ─── BASE (transform.py) ────────────────────────────────────────────────────
export const loadCalls                = () => loadCSVLocal('phiwe_calls.csv')
export const loadBookings             = () => loadCSVLocal('phiwe_bookings.csv')
export const loadDailyPerformance     = () => loadCSVLocal('phiwe_daily_performance.csv')
export const loadByStudio             = () => loadCSVLocal('phiwe_by_studio.csv')
export const loadByAreaCode           = () => loadCSVLocal('phiwe_by_area_code.csv')
export const loadPipeline             = () => loadCSVLocal('phiwe_pipeline.csv')
export const loadCallTiming           = () => loadCSVLocal('phiwe_call_timing.csv')
export const loadLeadFunnel           = () => loadCSVLocal('phiwe_lead_funnel.csv')
export const loadUnifiedLeads         = () => loadCSVLocal('phiwe_unified_leads.csv')
export const loadCancellationAnalysis = () => loadCSVLocal('phiwe_cancellation_analysis.csv')
export const loadBookingOutcomes      = () => loadCSVLocal('phiwe_booking_outcomes.csv')
export const loadBookingWindowAnalysis= () => loadCSVLocal('phiwe_booking_window_analysis.csv')
export const loadDayOfWeekPerformance = () => loadCSVLocal('phiwe_day_of_week_performance.csv')
export const loadRootCauseAnalysis    = () => loadJSON('root_cause_analysis.json')
export const loadValidationReport     = () => loadJSON('validation_report.json')

// ─── ENHANCED (enhance_pipeline.py) ─────────────────────────────────────────
export const loadBenchmarksComparison = () => loadCSVLocal('phiwe_benchmarks_comparison.csv')
export const loadRevenueIntelligence  = () => loadCSVLocal('phiwe_revenue_intelligence.csv')
export const loadForecast30Day        = () => loadCSVLocal('phiwe_forecast_30_day.csv')
export const loadCampaignHealth       = () => loadCSVLocal('phiwe_campaign_health.csv')
export const loadCohortAnalysis       = () => loadCSVLocal('phiwe_cohort_analysis.csv')
export const loadCallTimingOptimized  = () => loadCSVLocal('phiwe_call_timing_optimized.csv')

// ─── NEW (added to transform.py) ─────────────────────────────────────────────
export const loadConversionTrends     = () => loadCSVLocal('phiwe_conversion_trends.csv')
export const loadLoyalsnapEngagement  = () => loadCSVLocal('phiwe_loyalsnap_engagement.csv')
export const loadFlexologistPerformance=() => loadCSVLocal('phiwe_flexologist_performance.csv')
export const loadRampVsTarget          = () => loadCSVLocal('phiwe_ramp_vs_target.csv')
export const loadVelocityTrend         = () => loadCSVLocal('phiwe_velocity_trend.csv')

// ─── DATA INTEGRITY ──────────────────────────────────────────────────────────
export const loadUnattributedFlags     = () => loadCSVLocal('phiwe_unattributed_flags.csv')
export const loadValidationLeadDetails = () => loadCSVLocal('phiwe_validation_lead_details.csv')

// ─── NARRATIVE (Groq-generated insights written by pipeline) ─────────────────
export const loadInsights              = () => loadJSON('phiwe_insights.json')
