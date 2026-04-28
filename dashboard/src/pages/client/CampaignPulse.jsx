import React, { useState, useMemo, useEffect } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import {
  loadCalls,
  loadBookings,
  loadRampVsTarget,
  loadValidationReport,
  loadCancellationAnalysis,
  loadRootCauseAnalysis,
  loadPipeline,
  loadForecast30Day,
  loadBenchmarksComparison,
  loadDayOfWeekPerformance,
  loadCohortAnalysis,
  loadVelocityTrend,
  loadInsights,
} from '../../utils/dataLoader.js'
import {
  benchmarkStatus,
  benchmarkLabel,
  benchmarkColor,
  COLD_OUTREACH_BENCHMARKS,
} from '../../utils/config.js'
import { useRole } from '../../context/RoleContext.jsx'
import Card from '../../components/Card.jsx'
import Tooltip from '../../components/Tooltip.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'
import DeltaBanner from '../../components/DeltaBanner.jsx'
import ManagerCancellationInsight from '../../components/ManagerCancellationInsight.jsx'
import { recordVisit, calculateDelta } from '../../utils/deltaTracking.js'

// ─── Month 1 context line (hardcoded fallback — phiwe_insights.json has no month_1_context field) ──
const MONTH1_CONTEXT = 'Month 1 established baseline contact patterns and refined the active lead list across studios.'

// ─── Render-time safety net: strip call-count language from root cause text ───
function sanitiseCauseText(text) {
  if (!text) return text
  return text
    .replace(/<\d+\s*calls?/gi, '')
    .replace(/\d+-call\s*(minimum|protocol)?/gi, 'confirmation follow-up')
    .replace(/\d+-touch\s*(minimum|protocol)?/gi, 'confirmation follow-up protocol')
    .replace(/minimum\s+of\s+\d+\s+calls?/gi, 'confirmation follow-up')
    .replace(/require\s+\d+/gi, 'strengthen')
    .trim()
}

// ─── Client-view safety pass on Groq-generated insight text ──────────────────
function sanitiseInsight(text, isClientView) {
  if (!text) return text
  if (!isClientView) return text
  return text
    .replace(/Studio[^.]*\./gi, '')
    .replace(/\d+\s*(call|touch)(s|points?)?(\s+minimum)?/gi, 'confirmation follow-up')
    .trim()
}

// ─── Hour formatter for heatmap tooltip ──────────────────────────────────────
function formatHour(h) {
  const n = parseInt(h, 10)
  if (isNaN(n)) return String(h)
  return n === 0 ? '12am' : n < 12 ? `${n}am` : n === 12 ? '12pm' : `${n - 12}pm`
}

// ─── Booking buckets — single authoritative implementation ────────────────────
function buildBookingBuckets(bookings) {
  const getStatus = r => String(r['Current Status'] ?? r.current_status ?? r['current_status'] ?? '')
  const getId     = r => String(r['Booking ID']    ?? r.booking_id     ?? r['booking_id']     ?? '')
  const getIsPast = r => { const v = r['is_past'] ?? r.is_past ?? ''; return v === '1' || v === 1 || v === true }
  const getHasShow = r => { const v = r['has_show'] ?? r.has_show; return v === true || v === 1 || String(v).trim() === '1' }

  const attended      = bookings.filter(getHasShow)
  const attendedIds   = new Set(attended.map(getId))
  const notAttended   = r => !attendedIds.has(getId(r))

  const noShow           = bookings.filter(r => notAttended(r) && getStatus(r).includes('No Show'))
  const cancelledAll     = bookings.filter(r => notAttended(r) && getStatus(r).includes('Cancelled'))
  const cancelledAdmin   = cancelledAll.filter(r => getStatus(r).includes('By Admin'))
  const cancelledCustomer = cancelledAll.filter(r => !getStatus(r).includes('By Admin'))
  const rescheduled      = bookings.filter(r => notAttended(r) && getStatus(r).includes('Rescheduled'))
  const upcoming         = bookings.filter(r => notAttended(r) && getStatus(r).includes('Open Booking'))
  const total            = bookings.length

  const sum = attended.length + noShow.length + cancelledAll.length + rescheduled.length + upcoming.length
  if (sum !== total) {
    const allIds = new Set([...attended, ...noShow, ...cancelledAll, ...rescheduled, ...upcoming].map(getId))
    const unmatched = bookings.filter(r => !allIds.has(getId(r)))
    console.warn('[Buckets] mismatch:', sum, '!==', total, '| unmatched statuses:', unmatched.map(getStatus))
  }

  const isPastCount          = bookings.filter(getIsPast).length
  const rescheduledPastCount = bookings.filter(r => getStatus(r).includes('Rescheduled') && getIsPast(r)).length
  const resolved             = isPastCount - rescheduledPastCount
  console.log('[Buckets] isPast:', isPastCount, 'rescheduledPast:', rescheduledPastCount, 'resolved:', resolved)

  const showRate            = resolved > 0 ? attended.length      / resolved : 0
  const cancelRateAll       = resolved > 0 ? cancelledAll.length  / resolved : 0
  const cancelRateCustomer  = resolved > 0 ? cancelledCustomer.length / resolved : 0
  const cancelRateAdmin     = resolved > 0 ? cancelledAdmin.length / resolved : 0

  console.log('[Buckets]', {
    total, sum, attended: attended.length, resolved,
    showRate: (showRate * 100).toFixed(1) + '%',
    cancelAll: (cancelRateAll * 100).toFixed(1) + '%',
  })

  return {
    attended, noShow, cancelledAll, cancelledCustomer, cancelledAdmin,
    rescheduled, upcoming, total,
    resolved, showRate, cancelRateAll, cancelRateCustomer, cancelRateAdmin,
  }
}

// ─── Campaign month boundaries ────────────────────────────────────────────────
const MONTHS = [
  { num: 1, label: 'Month 1', start: new Date('2026-02-24'), end: new Date('2026-03-24'), target: 30, dateRange: 'Feb 24 – Mar 24' },
  { num: 2, label: 'Month 2', start: new Date('2026-03-25'), end: new Date('2026-04-24'), target: 50, dateRange: 'Mar 25 – Apr 24' },
  { num: 3, label: 'Month 3', start: new Date('2026-04-25'), end: new Date('2026-05-24'), target: 77, dateRange: 'Apr 25 – May 24' },
]

// ─── Timeline Bar ─────────────────────────────────────────────────────────────
function CampaignTimeline({ ramp = [], forecast = [], sowTarget = 77 }) {
  const today = new Date()

  // Outlook computation for active month
  const pessRow   = forecast.find(f => f.scenario === 'pessimistic')
  const likelyRow = forecast.find(f => f.scenario === 'likely')
  const optRow    = forecast.find(f => f.scenario === 'optimistic')
  const totalKept = ramp.reduce((s, r) => s + (+r.actual_kept_appts || 0), 0)

  const segments = MONTHS.map((m) => {
    const totalDays = Math.round((m.end - m.start) / 86400000) + 1
    let fillPct = 0
    if (today > m.end) {
      fillPct = 100
    } else if (today >= m.start) {
      const elapsed = Math.floor((today - m.start) / 86400000) + 1
      fillPct = Math.min(100, Math.round((elapsed / totalDays) * 100))
    }
    const isActive   = today >= m.start && today <= m.end
    const isComplete = today > m.end
    const rampRow    = ramp.find(r => +r.month === m.num)
    const actual     = rampRow ? +rampRow.actual_kept_appts : 0
    return { ...m, fillPct, isActive, isComplete, actual }
  })

  return (
    <Card style={{ marginBottom: '24px', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, flex: 1 }}>
          Campaign Progress · SOW Month {segments.find(s => s.isActive)?.num ?? 3} of 3
        </p>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
          Target: {sowTarget} kept appointments by May 24
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        {segments.map((seg) => (
          <div key={seg.num} style={{ flex: 1 }}>
            <div style={{
              height: '6px', borderRadius: '4px', background: 'var(--border)',
              overflow: 'hidden', marginBottom: '8px',
              outline: seg.isActive ? '1px solid var(--accent)' : 'none', outlineOffset: '1px',
            }}>
              <div style={{
                height: '100%', width: `${seg.fillPct}%`,
                background: seg.isComplete ? '#22c55e' : seg.isActive ? 'var(--accent)' : 'var(--muted)',
                borderRadius: '4px', transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{
                fontSize: '11px', fontWeight: seg.isActive ? 700 : 500,
                color: seg.isActive ? 'var(--text)' : seg.isComplete ? '#22c55e' : 'var(--muted)',
              }}>
                {seg.label}
                {seg.isActive && (
                  <span style={{ fontSize: '9px', marginLeft: '5px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Active</span>
                )}
                {seg.isComplete && (
                  <span style={{ fontSize: '9px', marginLeft: '5px', color: '#22c55e', fontWeight: 700 }}>✓</span>
                )}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                {seg.isComplete
                  ? `${seg.actual} kept / ${seg.target} target`
                  : seg.isActive
                  ? `${seg.actual} kept · ${seg.fillPct}% through`
                  : `Target: ${seg.target}`}
              </span>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0' }}>{seg.dateRange}</p>
            {seg.isActive && pessRow && likelyRow && optRow && (
              <div style={{ marginTop: '4px' }}>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '1px 0', fontStyle: 'italic' }}>
                  30-day range: {pessRow.shows} shows (pessimistic) · {likelyRow.shows} likely · {optRow.shows} optimistic
                </p>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '1px 0', fontStyle: 'italic' }}>
                  {Number(likelyRow.shows) + totalKept < sowTarget
                    ? 'At the likely pace, the May 24 target requires a conversation about Month 3 scope.'
                    : 'On track at the likely pace.'}
                </p>
              </div>
            )}
            {seg.num === 1 && (
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '3px 0 0', fontStyle: 'italic' }}>
                {MONTH1_CONTEXT}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit = '%', subLine, annotation, benchmarkDetail, tooltipContent, status, active, onToggle, colorOverride }) {
  const color = colorOverride ?? benchmarkColor(status)

  return (
    <Card
      style={{
        flex: 1, cursor: onToggle ? 'pointer' : 'default',
        outline: active ? `1px solid ${color}` : 'none',
        outlineOffset: '1px',
        transition: 'outline-color 0.15s ease',
      }}
      onClick={onToggle}
    >
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
            {label}
          </p>
          {tooltipContent && (
            <Tooltip content={tooltipContent} position="top">
              <span style={{ fontSize: '9px', opacity: 0.6, color: 'var(--muted)', cursor: 'help' }} onClick={e => e.stopPropagation()}>ⓘ</span>
            </Tooltip>
          )}
        </div>
        <p style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color, margin: '0 0 4px', lineHeight: 1 }}>
          {value}{unit}
        </p>
        <div style={{ marginBottom: annotation ? '8px' : '4px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700,
              color, background: `${color}18`,
              padding: '2px 7px', borderRadius: '4px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {benchmarkLabel(status, COLD_OUTREACH_BENCHMARKS[label.toLowerCase().replace(/ /g, '_')]?.lower_is_better)}
            </span>
          </div>
          {benchmarkDetail && (
            <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
              {benchmarkDetail}
            </p>
          )}
        </div>
        {annotation && (
          <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.5 }}>
            {annotation}
          </p>
        )}
        {subLine && (
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
            {subLine}
          </p>
        )}
        {onToggle && (
          <p style={{ fontSize: '10px', color: active ? color : 'var(--muted)', margin: 0, fontWeight: active ? 600 : 400 }}>
            {active ? 'collapse ▲' : 'see detail ▼'}
          </p>
        )}
      </div>
    </Card>
  )
}

// ─── SOW Progress Mini ────────────────────────────────────────────────────────
function SowProgressMini({ confirmedShows, upcoming, sowTarget = 77 }) {
  const remaining    = Math.max(0, sowTarget - confirmedShows)
  const confirmedPct = Math.min((confirmedShows / sowTarget) * 100, 100)
  const upcomingPct  = Math.min((upcoming / sowTarget) * 100, 100 - confirmedPct)

  return (
    <div style={{ marginBottom: 0 }}>
      <div style={{ height: '8px', borderRadius: '6px', background: 'var(--border)', overflow: 'hidden', display: 'flex', marginBottom: '10px' }}>
        <div style={{ width: `${confirmedPct}%`, background: '#22c55e', transition: 'width 0.4s ease' }} />
        <div style={{ width: `${upcomingPct}%`, background: 'var(--warn)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
          ● {confirmedShows} sessions attended
        </span>
        <span style={{ fontSize: '12px', color: 'var(--warn)', fontWeight: 600 }}>
          ● {upcoming} appointments booked
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {remaining > 0
            ? `${remaining} more sessions needed to hit the May 24 target`
            : `On track for the ${sowTarget}-session target`}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
          {confirmedShows} / {sowTarget}
        </span>
      </div>
    </div>
  )
}

// ─── Conversion Funnel ────────────────────────────────────────────────────────
function ConversionFunnel({ totalCalls, meaningfulConvs, bookingCount, confirmedShows, convRate, bookingConvRate, showRate, resolved, bookings }) {
  const [drill, setDrill] = useState(null)

  const nodes = [
    { key: 'calls',    label: 'Calls Made',    count: totalCalls,      color: 'var(--muted)',  canDrill: false },
    { key: 'convs',    label: 'Connections',   count: meaningfulConvs, color: 'var(--accent)', canDrill: true  },
    { key: 'bookings', label: 'Bookings',       count: bookingCount,    color: 'var(--text)',   canDrill: true  },
    { key: 'shows',    label: 'Kept Sessions', count: confirmedShows,  color: '#22c55e',       canDrill: true  },
  ]

  const funnelBookingRate = meaningfulConvs > 0 ? (bookingCount / meaningfulConvs) * 100 : 0

  // Show rate uses resolved denominator (matches KPI scorecard) — pending appointments
  // excluded because they haven't had an outcome yet and would dilute the rate.
  const arrows = [
    { rate: convRate,          status: benchmarkStatus('connect_rate', convRate),        note: null },
    { rate: funnelBookingRate, status: benchmarkStatus('booking_rate', bookingConvRate), note: 'of conversations' },
    { rate: showRate,          status: benchmarkStatus('show_rate',    showRate),        note: `of ${resolved} outcomes` },
  ]

  // Bookings drill: all bookings sorted by date desc
  const bookingsDrill = useMemo(() =>
    [...bookings].sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date)),
    [bookings]
  )

  // Shows drill: attended only (has_show flag — pipeline-authoritative), sorted by date desc
  const showsDrill = useMemo(() =>
    bookings
      .filter(b => +b.has_show === 1)
      .sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date)),
    [bookings]
  )

  return (
    <Card style={{ marginBottom: '24px', padding: '20px 24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
        Lead Journey — from first call to session kept
      </p>

      {/* Funnel row */}
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
        {nodes.map((node, i) => (
          <React.Fragment key={node.key}>
            {i > 0 && (() => {
              const arrow = arrows[i - 1]
              const color = benchmarkColor(arrow.status)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', minWidth: '84px' }}>
                  <span style={{ fontSize: '20px', color, lineHeight: 1 }}>→</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', margin: '2px 0' }}>
                    {arrow.rate.toFixed(1)}%
                  </span>
                  {arrow.note && (
                    <span style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '3px', textAlign: 'center' }}>
                      {arrow.note}
                    </span>
                  )}
                </div>
              )
            })()}

            <div
              onClick={() => node.canDrill && setDrill(drill === node.key ? null : node.key)}
              style={{
                flex: '0 0 auto',
                minWidth: '120px',
                textAlign: 'center',
                background: drill === node.key ? `${node.color}12` : 'var(--bg)',
                border: `1px solid ${drill === node.key ? node.color : 'var(--border)'}`,
                borderRadius: '10px',
                padding: '14px 12px',
                cursor: node.canDrill ? 'pointer' : 'default',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              <p style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: node.color, margin: '0 0 4px', lineHeight: 1 }}>
                {node.count.toLocaleString()}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, fontWeight: 500 }}>{node.label}</p>
              {node.canDrill && (
                <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '5px 0 0', opacity: 0.6 }}>
                  {drill === node.key ? 'collapse ▲' : 'see detail ▼'}
                </p>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Drill-down: Connections — what conversations produced */}
      {drill === 'convs' && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            What {meaningfulConvs.toLocaleString()} conversations produced
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 16px' }}>
            {meaningfulConvs.toLocaleString()} calls became real conversations.
            {' '}{bookingCount} of those led directly to a booked session — a {meaningfulConvs > 0 ? (bookingCount / meaningfulConvs * 100).toFixed(1) : '0.0'}% conversion from conversation to commitment.
            {' '}The remaining {(meaningfulConvs - bookingCount).toLocaleString()} answered but didn't book: leads who weren't ready, had an existing membership, or need another touchpoint before they commit.
            {' '}These are not lost — they're the next wave of the pipeline.
          </p>
          {[
            { label: 'Committed to a session', count: bookingCount,                   color: '#1D9E75' },
            { label: 'Still in outreach pool',  count: meaningfulConvs - bookingCount, color: '#378ADD' },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontSize: '12px', color: row.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                  {row.count.toLocaleString()} · {meaningfulConvs > 0 ? (row.count / meaningfulConvs * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${meaningfulConvs > 0 ? row.count / meaningfulConvs * 100 : 0}%`, background: row.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
            Conversations are calls where the lead stayed on for at least 30 seconds — enough for Phiwe to make the case for coming back.
          </p>
        </div>
      )}

      {/* Drill-down: Bookings — individual leads */}
      {drill === 'bookings' && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            {bookingCount} Booked Leads
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['Name', 'Studio', 'Date', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookingsDrill.map((b, i) => {
                const name   = [b.first_name, b.last_name].filter(Boolean).join(' ') || '—'
                const studio = (b.booking_location || '').replace('StretchLab ', '')
                const date   = b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                const cs = String(b.current_status || b['Current Status'] || '')
                const isAttended    = +b.has_show === 1
                const isUpcoming    = cs.includes('Open Booking')
                const isCancelled   = cs.includes('Cancelled')
                const isNoShow      = cs.includes('No Show')
                const isRescheduled = cs.includes('Rescheduled')
                const status      = isAttended ? 'Attended' : isUpcoming ? 'Upcoming' : isRescheduled ? 'Rescheduled' : isNoShow ? 'No Show' : isCancelled ? 'Cancelled' : '—'
                const statusColor = isAttended ? '#22c55e' : isUpcoming ? '#f59e0b' : isCancelled || isNoShow ? 'var(--danger)' : 'var(--muted)'
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 500 }}>{name}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{studio}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>{date}</td>
                    <td style={{ padding: '8px 10px', color: statusColor, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down: Shows — attended sessions */}
      {drill === 'shows' && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            {confirmedShows} Sessions Attended
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['Name', 'Studio', 'Session Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showsDrill.map((b, i) => {
                const name   = [b.first_name, b.last_name].filter(Boolean).join(' ') || '—'
                const studio = (b.booking_location || '').replace('StretchLab ', '')
                const date   = b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 500 }}>{name}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{studio}</td>
                    <td style={{ padding: '8px 10px', color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>{date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── Studio Strip ─────────────────────────────────────────────────────────────
function StudioStrip({ studios = [], bookings = [], isClientView = false }) {
  const studioStats = useMemo(() => {
    const map = {}
    bookings.forEach(r => {
      const loc = (r['Booking Location'] || r.booking_location || '').trim()
      if (!loc) return
      if (!map[loc]) map[loc] = {
        bookings: 0, shows: 0,
        cancelledAll: 0, cancelledAdmin: 0, cancelledCustomer: 0,
        noShow: 0, rescheduled: 0, upcoming: 0, isPast: 0,
      }
      const st = map[loc]
      const cs = String(r['Current Status'] || r.current_status || '')
      st.bookings++
      const hasShow = r.has_show === true || r.has_show === 1 || String(r.has_show ?? '').trim() === '1'
      const isPast  = String(r.is_past  ?? '') === '1'
      if (hasShow)                                st.shows++
      if (cs.includes('Cancelled') && !hasShow) {
        st.cancelledAll++
        if (cs.includes('By Admin')) st.cancelledAdmin++
        else st.cancelledCustomer++
      }
      if (cs.includes('No Show'))      st.noShow++
      if (cs.includes('Rescheduled'))  st.rescheduled++
      if (cs.includes('Open Booking')) st.upcoming++
      if (isPast)                      st.isPast++
    })
    Object.values(map).forEach(st => {
      // Cap rescheduledPast at isPast to prevent resolved going negative when
      // rescheduled count includes future rows
      const rescheduledPast = Math.min(st.rescheduled, st.isPast)
      st.resolved   = st.isPast - rescheduledPast
      st.showRate   = st.resolved > 0 ? st.shows / st.resolved : null
      st.cancelRate = st.resolved > 0 ? st.cancelledAll / st.resolved : null
      st.state      = st.bookings === 0 ? 'inactive'
                    : st.resolved === 0 ? 'activating'
                    : 'active'
      st.smallSample = st.resolved > 0 && st.resolved <= 3
    })
    return map
  }, [bookings])

  const studioAssessment = (st) => {
    if (!st || st.state === 'inactive') return null
    if (st.state === 'activating')
      return `${st.bookings} booked · ${st.upcoming} upcoming · awaiting first session outcome`
    const rate = st.showRate != null ? Math.round(st.showRate * 100) : 0
    if (rate >= 50) return 'Strong hold rate'
    if (rate >= 25) return 'Holding at range'
    if (rate > 0)   return 'Below benchmark — follow-up priority'
    if (st.upcoming > 0) return 'No shows yet — upcoming to protect'
    return 'No shows yet'
  }

  if (!studios.length) return null
  return (
    <Card style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
        Studio Breakdown
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {studios.map((s, i) => {
          const studioKey     = String(s.studio || '').trim()
          const name          = studioKey.replace('StretchLab ', '')
          const normalise     = (s) => String(s || '').trim().toLowerCase()
          const studioKeyNorm = normalise(studioKey)
          const st            = Object.entries(studioStats).find(
            ([k]) => normalise(k) === studioKeyNorm
          )?.[1] ?? null
          if (process.env.NODE_ENV !== 'production' && !st && studioKey) {
            console.warn(`[StudioStrip] No stats found for studio key: "${studioKey}". Available keys:`, Object.keys(studioStats))
          }
          const total       = st?.bookings    ?? 0
          const resolved    = st?.resolved    ?? 0
          const attended    = st?.shows       ?? 0
          const cancelled   = st?.cancelledAll ?? 0
          const upcoming    = st?.upcoming    ?? 0
          const rescheduled = st?.rescheduled ?? 0

          const showRatePct   = st?.showRate   != null ? st.showRate   * 100 : null
          const cancelRatePct = st?.cancelRate != null ? st.cancelRate * 100 : null
          const pendingPct    = total > 0 ? (rescheduled + upcoming) / total * 100 : null

          const studioState = st?.state ?? 'inactive'
          const sampleNote  = st?.smallSample ? ' · small sample' : ''

          const srColor     = studioState !== 'active' ? 'var(--muted)'
                            : showRatePct === null ? 'var(--muted)'
                            : showRatePct >= 15 ? 'var(--positive)' : showRatePct >= 8 ? 'var(--warn)' : 'var(--danger)'
          const borderStyle = studioState !== 'active' ? '1px dashed var(--border)' : '1px solid var(--border)'

          return (
            <div key={i} style={{
              flex: '1 1 160px', minWidth: '150px',
              background: 'var(--bg)',
              border: borderStyle,
              borderTop: studioState === 'active' ? `2px solid ${srColor}` : undefined,
              borderRadius: '8px',
              padding: '12px 14px',
              opacity: studioState === 'inactive' ? 0.5 : 1,
            }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </p>
              {studioState === 'inactive' ? (
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Pipeline inactive</p>
              ) : studioState === 'activating' ? (
                <p style={{ fontSize: '11px', color: 'var(--warn)', margin: 0 }}>
                  {total} booked · {upcoming} upcoming — awaiting first resolved outcome
                </p>
              ) : isClientView ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: srColor, lineHeight: 1 }}>
                      {showRatePct !== null ? `${showRatePct.toFixed(0)}%` : '—'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>show rate</span>
                  </div>
                  {(() => {
                    const attendedPct  = total > 0 ? Math.round(attended  / total * 100) : 0
                    const cancelledPct = total > 0 ? Math.round(cancelled / total * 100) : 0
                    const pendingPct   = total > 0 ? Math.max(0, 100 - attendedPct - cancelledPct) : 0
                    return (
                      <div style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '6px', background: 'var(--border)' }}>
                        <div style={{ width: `${attendedPct}%`,  background: '#1D9E75', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${cancelledPct}%`, background: '#E24B4A', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${pendingPct}%`,   background: '#EF9F27', transition: 'width 0.4s ease' }} />
                      </div>
                    )
                  })()}
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px' }}>
                    {total} booked · {upcoming} upcoming{sampleNote}
                  </p>
                  {studioAssessment(st) && (
                    <p style={{ fontSize: '11px', color: srColor, margin: 0, fontStyle: 'italic' }}>
                      {studioAssessment(st)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: srColor, lineHeight: 1 }}>
                      {showRatePct !== null ? `${showRatePct.toFixed(0)}%` : '—'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>show rate</span>
                  </div>
                  {(() => {
                    const attendedPct  = total > 0 ? Math.round(attended  / total * 100) : 0
                    const cancelledPct = total > 0 ? Math.round(cancelled / total * 100) : 0
                    const pendingPct   = total > 0 ? Math.max(0, 100 - attendedPct - cancelledPct) : 0
                    return (
                      <div style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '6px', background: 'var(--border)' }}>
                        <div style={{ width: `${attendedPct}%`,  background: '#1D9E75', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${cancelledPct}%`, background: '#E24B4A', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${pendingPct}%`,   background: '#EF9F27', transition: 'width 0.4s ease' }} />
                      </div>
                    )
                  })()}
                  {cancelRatePct !== null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', lineHeight: 1 }}>
                        {cancelRatePct.toFixed(0)}%
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>cancel rate</span>
                    </div>
                  )}
                  {pendingPct !== null && pendingPct > 0 && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', lineHeight: 1 }}>
                        {pendingPct.toFixed(0)}%
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>pending outcome</span>
                    </div>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '4px 0 2px' }}>
                    {attended} attended · {cancelled} cancelled · {upcoming} upcoming · {rescheduled} rescheduled
                  </p>
                  <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>
                    rates based on {resolved} resolved appointments{sampleNote}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Narrative Card ───────────────────────────────────────────────────────────
function NarrativeCard({ totalCalls, meaningfulConvs, convRate, bookingCount, upcoming, activeMonth, cancelRate, cancels, cancelledCustomer, attended, isClientView, pipeline = [], benchmarksData: _benchmarksData = [], lastMinuteCancelPct = null }) {
  const cancelAboveRange = cancelRate > COLD_OUTREACH_BENCHMARKS.cancel_rate.max

  const highRiskLeads = pipeline
    .filter(r => r.risk_level === 'High')
    .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
    .slice(0, 2)

  return (
    <Card style={{ borderLeft: '3px solid var(--accent)', marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
        Month {activeMonth} of 3 — where things stand
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>

        <div style={{ borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>The Challenge</p>
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
            {bookingCount > 0 && cancelledCustomer > 0
              ? <>
                  Of {bookingCount} appointments booked, {cancelledCustomer} were cancelled by the lead —
                  {lastMinuteCancelPct !== null
                    ? ` ${lastMinuteCancelPct}% of them on the day of the appointment.`
                    : '.'
                  }
                  {' '}These leads already know StretchLab — they signed up, showed real interest, then went quiet.
                  {' '}The window between booking and showing up is where re-engagement campaigns are won or lost.
                  {' '}Closing that final-hour gap is the primary lever for Month 3.
                </>
              : <>
                  These leads already know StretchLab. They signed up, showed genuine interest, and went quiet for months.
                  {' '}The opportunity in Month 3 is converting booked appointments into attended sessions — that is where this campaign delivers its ROI.
                </>
            }
            {!isClientView && bookingCount > 0 && cancels > 0 && (
              <>
                {' '}The expected range for dormant lead reactivation is {COLD_OUTREACH_BENCHMARKS.cancel_rate.min}–{COLD_OUTREACH_BENCHMARKS.cancel_rate.max}%.
                {cancelAboveRange ? ' Reducing that rate is the primary lever for Month 3.' : ' Maintaining it as the pipeline builds into Month 3 is the target.'}
              </>
            )}
          </p>
        </div>

        <div style={{ borderRight: '1px solid var(--border)', padding: '0 20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>What Phiwe Is Doing</p>
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
            Before every upcoming session, Phiwe runs a confirmation sequence — verifying attendance, confirming payment, and closing any changes before the appointment date.
            {' '}{upcoming > 0
              ? `There ${upcoming !== 1 ? 'are' : 'is'} ${upcoming} booked appointment${upcoming !== 1 ? 's' : ''} where this matters most right now.`
              : 'With no open appointments in the pipeline at this moment, the focus shifts to generating the next batch of bookings.'
            }
            {' '}Every held session is a re-engaged lead Execo has delivered back to the studio — and an opportunity for StretchLab to convert that visit into an active membership.
          </p>
        </div>

        <div style={{ paddingLeft: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>What&apos;s Next</p>
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
            {upcoming} appointment{upcoming !== 1 ? 's are' : ' is'} confirmed and coming up.
            {highRiskLeads.length > 0 && (
              <>
                {' '}{highRiskLeads.map((r, i) => (
                  <span key={i}>
                    {r.first_name} {r.last_name} at {String(r.booking_location || '').replace('StretchLab ', '')}
                    {' '}({new Date(r.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                    {i < highRiskLeads.length - 1 ? ' and ' : ''}
                  </span>
                ))} {highRiskLeads.length === 1 ? 'is' : 'are'} the highest priority for confirmation follow-up this week.
              </>
            )}
            {' '}Every one of these sessions is a re-engaged contact Execo has confirmed back through the studio door.
            {' '}StretchLab's opportunity is to convert each attended session into an active membership — that is where the value of this partnership compounds.
            {isClientView && (
              <>
                {attended > 0 && (
                  <>{' '}{attended} session{attended !== 1 ? 's have' : ' has'} already been attended.
                  {' '}Let Execo know how each one went — it sharpens the picture for the sessions still to come.</>
                )}
              </>
            )}
          </p>
        </div>

      </div>
    </Card>
  )
}

// ─── Pipeline Section ─────────────────────────────────────────────────────────
function PipelineSection({ pipeline = [], isClientView = false }) {
  if (!pipeline.length) return null

  const riskOrder = { High: 0, Medium: 1, Low: 2 }
  const sorted = [...pipeline].sort((a, b) => {
    const dateA = new Date(a.booking_date), dateB = new Date(b.booking_date)
    if (dateA - dateB !== 0) return dateA - dateB
    return (riskOrder[a.risk_level] ?? 3) - (riskOrder[b.risk_level] ?? 3)
  })

  const highRisk   = pipeline.filter(r => r.risk_level === 'High').length
  const totalCount = pipeline.length

  const riskColor = (level) =>
    level === 'High'   ? '#E24B4A' :
    level === 'Medium' ? '#EF9F27' : '#1D9E75'

  const appointmentContext = (r) => {
    const calls = Number(r.total_calls_made || 0)
    const days  = Number(r.days_until || 0)
    const name  = r.first_name
    if (r.risk_level === 'High' && calls <= 1)
      return `${name} has had ${calls === 0 ? 'no' : '1'} call — pre-visit confirmation is the priority this week`
    if (r.risk_level === 'High' && days <= 5)
      return `${days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} away`} — final confirmation window is now`
    if (r.risk_level === 'Medium')
      return `${calls} call${calls !== 1 ? 's' : ''} made — follow-up on track`
    if (r.risk_level === 'Low')
      return `${calls} call${calls !== 1 ? 's' : ''} made — well-protected`
    return `${calls} call${calls !== 1 ? 's' : ''} made`
  }

  const clientPipelineContext = (r) => {
    const days   = Number(r.days_until || 0)
    const name   = r.first_name
    const studio = String(r.booking_location || '').replace('StretchLab ', '')
    const date   = r.booking_date
      ? new Date(r.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—'
    if (days <= 0)  return `${name}'s session is today at ${studio}.`
    if (days === 1) return `${name}'s session is tomorrow at ${studio}.`
    if (days <= 3)  return `Session at ${studio} in ${days} days.`
    if (days <= 7)  return `Session at ${studio} on ${date}.`
    if (days <= 14) return `${name} confirmed on ${date} at ${studio}.`
    return `${name} — ${studio}, ${date}.`
  }

  return (
    <Card style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Active Pipeline — {totalCount} upcoming session{totalCount !== 1 ? 's' : ''}
        </p>
        {!isClientView && highRisk > 0 && (
          <span style={{ fontSize: '11px', color: '#E24B4A', fontWeight: 600 }}>
            {highRisk} high-risk · priority this week
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map((r, i) => {
          const name    = [r.first_name, r.last_name].filter(Boolean).join(' ')
          const studio  = String(r.booking_location || '').replace('StretchLab ', '')
          const date    = r.booking_date
            ? new Date(r.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—'
          const days    = Number(r.days_until || 0)
          const color   = riskColor(r.risk_level)
          const context = isClientView ? clientPipelineContext(r) : appointmentContext(r)
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${isClientView ? 'var(--accent)' : color}`,
              borderRadius: '6px',
            }}>
              {!isClientView && (
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 7px',
                  borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: `${color}18`, color, flexShrink: 0,
                }}>
                  {r.risk_level}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{studio}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>{date}</p>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                  {days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d away`}
                </p>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic', margin: 0, flexShrink: 0, maxWidth: '280px', textAlign: 'right' }}>
                {context}
              </p>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '12px 0 0', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        Execo has confirmed {totalCount} upcoming session{totalCount !== 1 ? 's' : ''} for the pipeline — each one a dormant lead Phiwe has brought back to the studio door.
      </p>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CampaignPulse() {
  const { role, setRole } = useRole()
  const isClientView  = role === 'client'
  const isManagerView = role === 'manager'

  // Persist role preference across page loads
  useEffect(() => {
    const saved = localStorage.getItem('dashboardView')
    if (saved && saved !== role) setRole(saved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleViewChange = (newView) => {
    setRole(newView)
    localStorage.setItem('dashboardView', newView)
  }

  const { data, loading } = useMultiData({
    calls:            loadCalls,
    bookings:         loadBookings,
    rampVsTarget:     loadRampVsTarget,
    validationReport: loadValidationReport,

    cancellations:    loadCancellationAnalysis,
    rootCause:        loadRootCauseAnalysis,
    pipeline:         loadPipeline,
    forecast:         loadForecast30Day,
    benchmarks:       loadBenchmarksComparison,
    dayData:          loadDayOfWeekPerformance,
    cohortData:       loadCohortAnalysis,
    velocity:         loadVelocityTrend,
    insights:         loadInsights,
  })

  const calls          = data.calls        ?? []
  const bookings       = data.bookings     ?? []
  const ramp           = data.rampVsTarget ?? []
  const vr             = data.validationReport

  const cancellations  = data.cancellations ?? []
  const rootCause      = data.rootCause    ?? {}
  const forecast       = data.forecast     ?? []
  const benchmarks     = data.benchmarks   ?? []
  const dayData        = data.dayData      ?? []
  const cohortData     = data.cohortData   ?? []
  const pipeline       = (data.pipeline ?? []).filter(r => +r.days_until >= 0)
  const velocityData   = data.velocity     ?? []
  const insightsData   = data.insights     ?? {}

  // ── Delta detection ──────────────────────────────────────────────────────────
  const [delta, setDelta] = useState(null)
  useEffect(() => {
    if (bookings.length === 0) return
    const buckets_ = buildBookingBuckets(bookings)
    const currentData = {
      bookings:      bookings.length,
      shows:         buckets_.attended.length,
      cancellations: buckets_.cancelledAll.length,
      pipeline,
    }
    setDelta(calculateDelta(currentData))
    recordVisit(currentData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.length, pipeline.length])

  // ── Core metrics ────────────────────────────────────────────────────────────
  const meaningfulConvs  = useMemo(() => calls.filter(c => parseFloat(c.live_talk_min || 0) >= 0.5).length, [calls])
  const totalCalls       = calls.length
  const convRate         = totalCalls > 0 ? (meaningfulConvs / totalCalls) * 100 : 0
  const bookingConvRate  = totalCalls > 0 ? (bookings.length / totalCalls) * 100 : 0
  const lastUpdated      = vr?.generated_at ?? null

  // ── Booking buckets — uses buildBookingBuckets() defined at module scope ──────
  const buckets = useMemo(() => buildBookingBuckets(bookings), [bookings])

  const confirmedShows     = buckets.attended.length
  const resolved           = buckets.resolved
  const showRate           = buckets.showRate * 100
  const cancels            = buckets.cancelledAll.length
  const cancelRate         = buckets.cancelRateAll * 100
  const cancelRateCustomer = buckets.cancelRateCustomer * 100
  const cancelRateAdmin    = buckets.cancelRateAdmin * 100
  const upcoming           = buckets.upcoming.length

  // ── SOW target (derived from ramp CSV; fallback 77) ─────────────────────────
  const sowTarget = useMemo(
    () => ramp.length > 0 ? Math.max(...ramp.map(r => +r.target_kept_appts || 0)) : 77,
    [ramp]
  )

  // ── Root causes (active only — count > 0) ───────────────────────────────────
  const activeCauses = useMemo(
    () => (rootCause?.causes ?? []).filter(c => (c.count ?? 0) > 0).sort((a, b) => b.count - a.count),
    [rootCause]
  )

  // ── Active month ─────────────────────────────────────────────────────────────
  const today       = new Date()
  const activeMonth = MONTHS.find(m => today >= m.start && today <= m.end)?.num ?? 3

  // ── KPI drill-down state ─────────────────────────────────────────────────────
  const [activeKpi, setActiveKpi] = useState(null)

  // ── Benchmark statuses ──────────────────────────────────────────────────────
  const convStatus    = benchmarkStatus('connect_rate', convRate)
  const bookingStatus = benchmarkStatus('booking_rate', bookingConvRate)
  const showStatus    = benchmarkStatus('show_rate', showRate)
  const cancelStatus  = benchmarkStatus('cancel_rate', cancelRate)

  // ── AI Insight — read from phiwe_insights.json by role ────────────────────
  const rawInsight  = !loading
    ? (role === 'admin'   ? insightsData.admin   ?? '' :
       role === 'manager' ? insightsData.manager  ?? '' :
                            insightsData.client   ?? '')
    : ''
  const pageInsight = sanitiseInsight(rawInsight, isClientView)

  // ── Velocity signal — shift in days from first call to booking ────────────
  const velocitySignal = useMemo(() => {
    if (!velocityData.length || velocityData.length < 4) return null
    const recent = velocityData.filter(r => Number(r.total_bookings_that_week) > 0)
    if (recent.length < 2) return null
    const earliest   = recent[0]
    const latest     = recent[recent.length - 1]
    const earlyDays  = Number(earliest.median_days_first_call_to_booking)
    const latestDays = Number(latest.median_days_first_call_to_booking)
    if (isNaN(earlyDays) || isNaN(latestDays)) return null
    return { earlyDays, latestDays, increased: latestDays > earlyDays }
  }, [velocityData])

  // ── Last-minute cancel % — for NarrativeCard Challenge column ────────────
  const lastMinuteCancelPct = useMemo(() => {
    if (!cancellations.length) return null
    const lastMin = cancellations.filter(r =>
      String(r.cancellation_timing || '').includes('Last Minute')
    ).length
    return Math.round(lastMin / cancellations.length * 100)
  }, [cancellations])

  // Cancel rate color: green ≤20%, yellow ≤35%, red >35%
  const cancelColor = cancelRate <= 20 ? 'var(--positive)' : cancelRate <= 35 ? 'var(--warn)' : 'var(--danger)'

  // ── Benchmark detail strings (show actual vs. standard in badge sub-line) ────
  const bmRowLookup = (key) => benchmarks.find(r => r.metric === key) ?? {}
  const bm = {
    show:   bmRowLookup('show_rate'),
    cancel: bmRowLookup('cancel_rate'),
  }
  const { connect_rate: crBm, booking_rate: brBm } = COLD_OUTREACH_BENCHMARKS
  const connectBmDetail = `benchmark: ${crBm.min}–${crBm.max}% · cold re-engagement`
  const bookingBmDetail = `benchmark: ${brBm.min}–${brBm.max}% · cold re-engagement`
  const stripPct = (val) => String(val || '').replace(/%$/, '').trim()
  const showBmDetail    = bm.show.benchmark_pct
    ? `benchmark: ${stripPct(bm.show.benchmark_pct)}% · cold re-engagement`
    : `benchmark: ${COLD_OUTREACH_BENCHMARKS.show_rate.min}–${COLD_OUTREACH_BENCHMARKS.show_rate.max}%`
  const cancelBmDetail  = bm.cancel.benchmark_pct
    ? `benchmark: ≤${stripPct(bm.cancel.benchmark_pct)}% · gap: +${Math.max(0, cancelRate - +stripPct(bm.cancel.benchmark_pct)).toFixed(1)}%`
    : `benchmark: ≤${COLD_OUTREACH_BENCHMARKS.cancel_rate.max}%`

  // ── KPI annotations (one-line "so what?" per card) ───────────────────────────
  const connectAnnotation =
    convStatus === 'above'  ? "Connect rate is above the benchmark for dormant lead reactivation — Phiwe is reaching real people at a strong rate" :
    convStatus === 'within' ? "Connect rate is within the expected range for dormant lead reactivation" :
                              "Connect rate is below the benchmark for this lead type — call timing is the priority lever"

  const bookingAnnotation = `${(bookings.length / totalCalls * 100).toFixed(1)}% of all calls resulted in a booked session`

  const showVsBm      = showRate >= 20 ? 'excellent' : showRate >= 15 ? 'good' : showRate >= 10 ? 'average' : 'poor'
  const showAnnotation =
    showVsBm === 'excellent' ? "Show rate is above the benchmark for this lead type — pre-visit confirmation is holding" :
    showVsBm === 'good'      ? "Show rate is within the expected range for this lead type" :
    showVsBm === 'average'   ? "Show rate is approaching the expected benchmark — protecting the show rate on upcoming appointments is the priority" :
                               "Show rate is below the benchmark — booking timing and pre-visit confirmation are the focus"

  const cancelAnnotation = `Lead-initiated cancel rate is ${cancelRateCustomer.toFixed(1)}% — studio-initiated cancellations account for the balance`

  // ── KPI tooltips ─────────────────────────────────────────────────────────────
  const convTooltip    = `${convRate.toFixed(1)}% of all calls resulted in a real two-way conversation — someone picked up and talked with Phiwe for at least 30 seconds. Cold re-engagement benchmark: ${crBm.min}–${crBm.max}%.`
  const bookingTooltip = `Of all ${totalCalls.toLocaleString()} calls made, ${bookingConvRate.toFixed(1)}% resulted in a booked appointment. Cold re-engagement benchmark: ${brBm.min}–${brBm.max}%.`
  const showTooltip    = `Of the ${resolved} appointments with a confirmed outcome (past sessions where the result is known — rescheduled and upcoming excluded), ${confirmedShows} were attended — ${showRate.toFixed(1)}%. Cold re-engagement benchmark: ${COLD_OUTREACH_BENCHMARKS.show_rate.min}–${COLD_OUTREACH_BENCHMARKS.show_rate.max}%.`
  const cancelTooltip  = `Of the ${resolved} resolved appointments, ${cancels} carry a cancelled status — a ${cancelRate.toFixed(1)}% cancel rate. Lead-initiated: ${cancelRateCustomer.toFixed(1)}%, studio-initiated: ${cancelRateAdmin.toFixed(1)}%. Expected range for re-engagement outreach: ${COLD_OUTREACH_BENCHMARKS.cancel_rate.min}–${COLD_OUTREACH_BENCHMARKS.cancel_rate.max}%.`


  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[Lead Journey] sanity check:', { totalCalls, connections: meaningfulConvs, connectRatePct: convRate.toFixed(1), totalBookings: bookings.length, keptSessions: confirmedShows })
    if (meaningfulConvs === 0 || totalCalls === 0)
      // eslint-disable-next-line no-console
      console.warn('[Lead Journey] data may not be loaded correctly')
  }

  // ── Connect Rate drill data (computed from calls — real conversations, not answer rate) ──
  const HEATMAP_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const HEATMAP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
  const connectSlotMap = useMemo(() => {
    const m = {}
    calls.forEach(r => {
      const hr = parseInt(r.hour, 10)
      if (hr >= 8 && hr <= 17) {
        const key = `${r.day_of_week}|${hr}`
        if (!m[key]) m[key] = { total: 0, connected: 0, day: r.day_of_week, hour: hr }
        m[key].total += 1
        if (parseFloat(r.live_talk_min || 0) >= 0.5) m[key].connected += 1
      }
    })
    return m
  }, [calls])
  const top2ConnectSlots = useMemo(() => {
    const slots = Object.values(connectSlotMap)
      .filter(s => s.total >= 5)
      .map(s => ({ ...s, connectRate: s.connected / s.total }))
    return slots.sort((a, b) => b.connectRate - a.connectRate).slice(0, 2)
  }, [connectSlotMap])


  // ── Booking Conversion drill data ─────────────────────────────────────────────
  const totalBookings = bookings.length

  // ── Show Rate drill data ──────────────────────────────────────────────────────
  // Enrich dayData with resolved-denominator rates (consistent with main show rate scorecard)
  const enrichedDays  = useMemo(() =>
    dayData.map(r => {
      const resolved = +r.shows + +r.cancellations + +r.no_shows
      const pending  = +r.total_bookings - resolved
      return {
        ...r,
        resolved,
        pending,
        resolvedShowPct:   resolved > 0 ? (+r.shows   / resolved * 100) : null,
        resolvedCancelPct: resolved > 0 ? (+r.cancellations / resolved * 100) : null,
      }
    }),
    [dayData]
  )
  const bestDay       = useMemo(
    () => [...enrichedDays].filter(r => r.resolved > 0 && r.resolvedShowPct > 0).sort((a, b) => b.resolvedShowPct - a.resolvedShowPct)[0] ?? null,
    [enrichedDays]
  )
  const sortedDays    = useMemo(
    () => [...enrichedDays].filter(r => +r.total_bookings > 0).sort((a, b) => +b.total_bookings - +a.total_bookings),
    [enrichedDays]
  )
  const worstActiveDay = useMemo(() =>
    [...enrichedDays]
      .filter(r => +r.total_bookings >= 3 && r.resolvedShowPct != null)
      .sort((a, b) => a.resolvedShowPct - b.resolvedShowPct)[0] ?? null,
    [enrichedDays]
  )

  // Best connect-rate day (weighted avg across all qualifying slots)
  const dayAvg = useMemo(() => {
    const byDay = {}
    Object.values(connectSlotMap).forEach(s => {
      if (s.total < 5) return
      if (!byDay[s.day]) byDay[s.day] = { total: 0, connected: 0, day: s.day }
      byDay[s.day].total     += s.total
      byDay[s.day].connected += s.connected
    })
    return Object.values(byDay)
      .map(d => ({ ...d, rate: d.connected / d.total }))
      .sort((a, b) => b.rate - a.rate)
  }, [connectSlotMap])
  const bestConnectDay = dayAvg[0] ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading campaign data…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Campaign Pulse
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            {activeMonth === 2
              ? `Month 2 closing Apr 24 · ${upcoming} appointment${upcoming !== 1 ? 's' : ''} in the pipeline`
              : activeMonth === 3
              ? `Month 3 active · ${upcoming} upcoming · ${confirmedShows} sessions confirmed`
              : 'Campaign complete'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '99px',
            border: '1px solid rgba(99,102,241,0.3)',
            background: 'rgba(99,102,241,0.07)',
            fontSize: '11px', fontWeight: 600, color: 'var(--accent)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            {role === 'client' ? 'Client View' : role === 'manager' ? 'Manager View' : 'Admin View'}
          </span>
          <div style={{
            display: 'flex', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: '8px',
            padding: '2px', gap: '2px',
          }}>
            {['client', 'manager', 'admin'].map(v => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                style={{
                  padding: '4px 12px', fontSize: '11px', border: 'none', cursor: 'pointer',
                  borderRadius: '6px', outline: 'none', transition: 'all 0.15s',
                  fontWeight: role === v ? 600 : 400,
                  background: role === v ? 'rgba(99,102,241,0.125)' : 'transparent',
                  color: role === v ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Delta — what changed since last visit */}
      <DeltaBanner delta={delta} />

      {/* AI Insight — action frame after seeing pipeline context */}
      <InsightBlock insight={pageInsight} style={{ marginTop: 0 }} />

      {/* Timeline */}
      <CampaignTimeline ramp={ramp} forecast={forecast} sowTarget={sowTarget} />

      {/* 4 KPI cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '0', flexWrap: 'wrap' }}>
        <KpiCard
          label="Connect Rate"
          value={convRate.toFixed(1)}
          status={convStatus}
          annotation={connectAnnotation}
          benchmarkDetail={connectBmDetail}
          tooltipContent={convTooltip}
          subLine={`${meaningfulConvs.toLocaleString()} real conversations · ${totalCalls.toLocaleString()} calls`}
          active={activeKpi === 'connect'}
          onToggle={() => setActiveKpi(activeKpi === 'connect' ? null : 'connect')}
        />
        <KpiCard
          label="Booking Conversion Rate"
          value={bookingConvRate.toFixed(1)}
          status={bookingStatus}
          annotation={bookingAnnotation}
          benchmarkDetail={bookingBmDetail}
          tooltipContent={bookingTooltip}
          subLine={`${bookings.length} appointments booked`}
          active={activeKpi === 'booking'}
          onToggle={() => setActiveKpi(activeKpi === 'booking' ? null : 'booking')}
        />
        <KpiCard
          label="Show Rate"
          value={showRate.toFixed(1)}
          status={showStatus}
          annotation={showAnnotation}
          benchmarkDetail={showBmDetail}
          tooltipContent={showTooltip}
          subLine={`${confirmedShows} confirmed · ${resolved} with a confirmed outcome`}
          active={activeKpi === 'show'}
          onToggle={() => setActiveKpi(activeKpi === 'show' ? null : 'show')}
        />
        {!isClientView && (
          <KpiCard
            label="Cancel Rate"
            value={cancelRate.toFixed(1)}
            status={cancelStatus}
            annotation={cancelAnnotation}
            benchmarkDetail={cancelBmDetail}
            tooltipContent={cancelTooltip}
            subLine={`${cancels} cancelled · ${bookings.length} bookings made`}
            active={activeKpi === 'cancel'}
            onToggle={() => setActiveKpi(activeKpi === 'cancel' ? null : 'cancel')}
            colorOverride={cancelColor}
          />
        )}
      </div>

      {/* Booking accountability — answers "what happened to the other X%?" */}
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '8px 0 20px', lineHeight: 1.5 }}>
        {isClientView
          ? `Of ${bookings.length} appointments booked: ${confirmedShows} attended · ${upcoming} upcoming · ${cancels} did not proceed · ${buckets.noShow.length} no-show · ${buckets.rescheduled.length} rescheduled`
          : `Of ${bookings.length} appointments booked: ${confirmedShows} attended · ${upcoming} upcoming · ${buckets.cancelledCustomer.length} lead-cancelled · ${buckets.cancelledAdmin.length} studio-cancelled · ${buckets.noShow.length} no-show · ${buckets.rescheduled.length} rescheduled`
        }
      </p>

      {/* Manager insight — cancellation root causes */}
      {isManagerView && (
        <ManagerCancellationInsight rootCauses={rootCause} />
      )}

      {/* ── Drill: Connect Rate — By Day & Hour ── */}
      {activeKpi === 'connect' && (
        <div style={{ marginBottom: '24px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            Connect Rate by Day &amp; Hour
          </p>
          {(() => {
            const highRiskPipeline = pipeline.filter(r => r.risk_level === 'High')
            const highRiskLeadsList = highRiskPipeline
              .sort((a, b) => +a.days_until - +b.days_until)
              .slice(0, 4)
              .map(r => {
                const studio = String(r.booking_location || '').replace('StretchLab ', '')
                const d = r.booking_date ? new Date(r.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
                const days = +r.days_until
                return `${r.first_name} at ${studio}${d ? ` (${days === 0 ? 'today' : d})` : ''}`
              })
              .join(', ')
            const fridayDayData = dayData.find(d => String(d.day_of_week).toLowerCase().startsWith('fri'))
            const fridayCancels = fridayDayData ? +fridayDayData.cancellations : 0
            const allCancels    = dayData.reduce((s, d) => s + (+d.cancellations || 0), 0)
            const fridayCancelPct = allCancels > 0 ? Math.round(fridayCancels / allCancels * 100) : 0
            return (
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 20px' }}>
                {top2ConnectSlots.length >= 2
                  ? <>{top2ConnectSlots[0].day} {formatHour(top2ConnectSlots[0].hour)} and {top2ConnectSlots[1].day} {formatHour(top2ConnectSlots[1].hour)} are where real conversations happen — {Math.round(top2ConnectSlots[0].connectRate * 100)}% and {Math.round(top2ConnectSlots[1].connectRate * 100)}% connect rate respectively.</>
                  : <>The heatmap shows when real conversations concentrate.</>
                }
                {bestConnectDay && <>{' '}{bestConnectDay.day}s are the most consistent day across the week at {(bestConnectDay.rate * 100).toFixed(1)}% — that consistency matters when working the pipeline.</>}
                {highRiskPipeline.length > 0 && (
                  <>{' '}{highRiskPipeline.length} of the {pipeline.length} upcoming appointments need confirmation contact this week — prioritise{highRiskLeadsList ? `: ${highRiskLeadsList}` : ' these first'}.</>
                )}
                {fridayCancelPct > 0 && (
                  <>{' '}Friday books well but accounts for {fridayCancelPct}% of cancellations — if a lead can only do Friday, confirm twice.</>
                )}
              </p>
            )
          })()}

          {/* Connect rate heatmap */}
          {calls.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                Connect Rate by Day &amp; Hour
              </p>
              <div style={{ display: 'inline-block', minWidth: '100%' }}>
                {/* Hour headers */}
                <div style={{ display: 'flex', gap: '2px', marginBottom: '2px', paddingLeft: '72px' }}>
                  {HEATMAP_HOURS.map(h => (
                    <div key={h} style={{ width: '28px', textAlign: 'center', fontSize: '9px', color: 'var(--muted)', flexShrink: 0 }}>
                      {formatHour(h)}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {HEATMAP_DAYS.map(day => (
                  <div key={day} style={{ display: 'flex', gap: '2px', marginBottom: '2px', alignItems: 'center' }}>
                    <div style={{ width: '68px', fontSize: '10px', color: 'var(--muted)', textAlign: 'right', paddingRight: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {day.slice(0, 3)}
                    </div>
                    {HEATMAP_HOURS.map(h => {
                      const slot = connectSlotMap[`${day}|${h}`]
                      const rate = slot && slot.total >= 5 ? slot.connected / slot.total : null
                      const n    = slot?.total ?? 0
                      const bg   = rate === null ? 'var(--border)'
                                 : rate >= 0.245 ? '#0C447C'
                                 : rate >= 0.200 ? '#378ADD'
                                 : rate >= 0.150 ? '#85B7EB'
                                 : rate >= 0.100 ? '#B5D4F4'
                                 : '#E0EEF9'
                      return (
                        <Tooltip
                          key={h}
                          content={rate !== null ? `${day} ${formatHour(h)} — ${Math.round(rate * 100)}% connect rate · ${n} calls` : `${day} ${formatHour(h)} — insufficient data`}
                          position="top"
                        >
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '3px',
                            background: bg, flexShrink: 0,
                          }} />
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div style={{ display: 'flex', gap: '12px', paddingLeft: '72px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[['#0C447C', '≥24.5%'], ['#378ADD', '20–24.5%'], ['#85B7EB', '15–20%'], ['#B5D4F4', '10–15%'], ['#E0EEF9', '<10%']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c }} />
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{l} connect rate</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', margin: '8px 0 0', paddingLeft: '72px' }}>
                  Showing calls that became real conversations (30+ seconds). Slots with fewer than 5 calls are excluded.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Drill: Booking Conversion — Commitment Quality ── */}
      {activeKpi === 'booking' && (() => {
        const fastCohort    = cohortData.find(r => String(r.cohort || '').startsWith('Fast'))
        const fastPct       = fastCohort && totalBookings > 0 ? Math.round(+fastCohort.total_bookings / totalBookings * 100) : null
        const fastCancelPct = fastCohort ? Math.round(+fastCohort.cancel_rate * 100) : null
        const pending     = totalBookings - confirmedShows - cancels - buckets.noShow.length
        const pendingPct  = Math.round(pending / totalBookings * 100)
        const attendedPct = Math.round(confirmedShows / totalBookings * 100)
        const cancelPct   = Math.round(cancels / totalBookings * 100)
        const noShowPct   = Math.round(buckets.noShow.length / totalBookings * 100)
        const outcomes = [
          { label: 'Attended',        count: confirmedShows,        pct: attendedPct, color: '#1D9E75' },
          { label: 'Pending outcome', count: pending,               pct: pendingPct,  color: '#EF9F27' },
          { label: 'Cancelled',       count: cancels,               pct: cancelPct,   color: '#E24B4A' },
          { label: 'No-show',         count: buckets.noShow.length, pct: noShowPct,   color: 'var(--muted)' },
        ].filter(o => o.count > 0)
        return (
          <div style={{ marginBottom: '24px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
              What happened to every booking
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Total booked',    value: totalBookings },
                { label: 'Attended',        value: confirmedShows },
                { label: 'Active pipeline', value: `${upcoming} upcoming${buckets.rescheduled.length > 0 ? ` · ${buckets.rescheduled.length} rescheduled` : ''}` },
              ].map(box => (
                <div key={box.label} style={{ flex: '1 1 120px', background: 'var(--bg)', borderRadius: '6px', padding: '10px 14px' }}>
                  <p style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', margin: '0 0 4px', lineHeight: 1 }}>{box.value}</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{box.label}</p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Getting to a booking is the first commitment. What matters more is what happens after.
              {' '}Of {totalBookings} appointments booked, {confirmedShows} were attended — a {showRate.toFixed(1)}% show rate on {resolved} appointments with a confirmed outcome.
              {fastPct !== null && fastCancelPct !== null && (
                <>{' '}{fastPct}% of bookings came together within the first few days of contact — and those fast commitments carry the highest cancel risk at {fastCancelPct}%. A quick yes is only as good as what follows it.</>
              )}
              {velocitySignal && (
                <>{' '}Leads are taking {velocitySignal.increased ? 'longer' : 'less time'} to commit — median days from first call to booking has shifted from {velocitySignal.earlyDays} to {velocitySignal.latestDays} days, which means {velocitySignal.increased ? 'the confirmation rhythm for recent bookings needs to be stronger' : 'outreach is landing faster as the campaign matures'}.</>
              )}
              {' '}Phiwe confirms every open booking before the session date — that is how a fast yes becomes a held session.
            </p>

            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
              Where every booking stands
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {outcomes.map(o => (
                <div key={o.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{o.label}</span>
                    <span style={{ fontSize: '12px', color: o.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{o.count} · {o.pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${o.pct}%`, background: o.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                  {o.label === 'Attended' && (
                    <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '3px 0 0', textAlign: 'right' }}>
                      = {showRate.toFixed(1)}% show rate on {resolved} appointments with a confirmed outcome
                    </p>
                  )}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '0 0 10px', fontStyle: 'italic' }}>
              All percentages are of {totalBookings} total bookings. Show rate ({showRate.toFixed(1)}%) is calculated on {resolved} appointments with a confirmed outcome.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>
              Phiwe confirms every booked lead before their session — the primary protection for the {upcoming} active appointments.
            </p>
          </div>
        )
      })()}

      {/* ── Drill: Show Rate — Session Outcomes ── */}
      {activeKpi === 'show' && (
        <div style={{ marginBottom: '24px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            Session Outcomes
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 20px' }}>
            Of {resolved} appointments with a confirmed outcome, {confirmedShows} were attended — a {showRate.toFixed(1)}% show rate that sits {showStatus === 'above' ? 'above' : showStatus === 'within' ? 'within' : 'below'} the outreach benchmark of {COLD_OUTREACH_BENCHMARKS.show_rate.min}–{COLD_OUTREACH_BENCHMARKS.show_rate.max}%.
            {bestDay && worstActiveDay && worstActiveDay.day_of_week !== bestDay.day_of_week && (
              <>{' '}{worstActiveDay.day_of_week} books the most sessions — {worstActiveDay.total_bookings} booked — but holds at just {Math.round(worstActiveDay.resolvedShowPct)}%.
              {' '}{bestDay.day_of_week} and the sessions around it hold at {Math.round(bestDay.resolvedShowPct)}% — the clearest signal on what works.</>
            )}
            {' '}Every appointment in the pipeline receives a confirmation follow-up from Phiwe before the session date — that is the primary protection for the {upcoming} still to come.
          </p>

          {/* Day-of-week bars — total bookings denominator so pending is visible */}
          {sortedDays.filter(d => +d.total_bookings > 0).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                Show &amp; cancel rate by day of week
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedDays.filter(d => +d.total_bookings > 0).map((d, i) => {
                  const hasResolved    = d.resolved > 0
                  const total          = +d.total_bookings
                  const showSegPct     = Math.floor(+d.shows         / total * 100)
                  const cancelSegPct   = Math.floor(+d.cancellations / total * 100)
                  const noShowSegPct   = Math.floor(+d.no_shows      / total * 100)
                  const pendingSegPct  = Math.max(0, 100 - showSegPct - cancelSegPct - noShowSegPct)
                  const noShowCount    = +d.no_shows
                  const showRateLbl    = hasResolved ? Math.round(d.resolvedShowPct)   : null
                  const cancelRateLbl  = hasResolved ? Math.round(d.resolvedCancelPct) : null
                  const noShowRateLbl  = hasResolved && noShowCount > 0 ? Math.round(noShowCount / d.resolved * 100) : null
                  return (
                    <div key={i} style={{ marginBottom: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
                          {d.day_of_week}
                          <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {total} booked{d.pending > 0 ? ` · ${d.pending} pending` : ''}</span>
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {hasResolved
                            ? `${+d.shows} show · ${+d.cancellations} cancel${noShowCount > 0 ? ` · ${noShowCount} no-show` : ''}`
                            : 'no resolved outcomes yet'
                          }
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${showSegPct}%`,    background: '#1D9E75', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${cancelSegPct}%`,  background: '#E24B4A', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${noShowSegPct}%`,  background: '#C25E1B', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${pendingSegPct}%`, background: '#EF9F27', transition: 'width 0.4s ease' }} />
                      </div>
                      {hasResolved && (
                        <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0', textAlign: 'right' }}>
                          {showRateLbl}% show rate{noShowRateLbl !== null ? ` · ${noShowRateLbl}% no-show` : ''}{cancelRateLbl !== null ? ` · ${cancelRateLbl}% cancel` : ''} of {d.resolved} resolved
                        </p>
                      )}
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {[
                    { color: '#1D9E75', label: 'Attended' },
                    { color: '#E24B4A', label: 'Cancelled' },
                    { color: '#C25E1B', label: 'No-show' },
                    { color: '#EF9F27', label: 'Pending outcome' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color }} />
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '4px 0 0', fontStyle: 'italic' }}>
                  Bars show all {totalBookings} bookings. Rate labels are of resolved appointments only — {totalBookings - resolved} bookings are still pending an outcome.
                </p>
              </div>
            </div>
          )}

          {/* Who is cancelling */}
          {!isClientView && cancellations.length > 0 && (() => {
            const byCustomer = cancellations.filter(c => String(c.cancelled_by || '').toLowerCase() === 'customer').length
            const byAdmin    = cancellations.length - byCustomer
            const total      = cancellations.length
            return (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                  Who initiated cancellations
                </p>
                {[
                  { label: 'Lead-initiated', count: byCustomer, color: '#E24B4A' },
                  { label: 'Studio-initiated', count: byAdmin, color: '#EF9F27' },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{row.label}</span>
                      <span style={{ fontSize: '12px', color: row.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{row.count} of {total}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((row.count / total) * 100)}%`, background: row.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>
            Show rate is of appointments with a confirmed outcome — {buckets.rescheduled.length} rescheduled and {upcoming} upcoming appointments are excluded because their outcome is not yet known.
          </p>
        </div>
      )}

      {/* ── Drill: Cancel Rate — What's Driving It ── */}
      {activeKpi === 'cancel' && (
        <div style={{ marginBottom: '24px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            What&apos;s Driving Cancellations
          </p>
          {(() => {
            const total      = cancellations.length
            const lastMin    = cancellations.filter(c => String(c.cancellation_timing || '').includes('Last Minute')).length
            const lastMinPct = total > 0 ? Math.round((lastMin / total) * 100) : 0
            const topCause   = activeCauses[0]
            const causeLabel = topCause ? String(topCause.cause).replace(/\d+ calls?|3-touch|call touchpoints/gi, 'confirmation follow-up') : null
            const benchmarkCancelPct = +(stripPct(bm.cancel.benchmark_pct) || 15)
            return (
              <>
                {/* Part 1 — what the number actually means */}
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 12px' }}>
                  The cancel rate shown ({cancelRate.toFixed(1)}%) reflects all {cancels} cancellations across all {totalBookings} appointments booked.
                  {' '}Of those, {buckets.cancelledAdmin.length} were studio-initiated — appointments cancelled by the studio, not by the lead.
                  {' '}Excluding studio-initiated cancellations, the lead cancel rate is {cancelRateCustomer.toFixed(1)}% — which is within the expected range for this outreach type.
                </p>

                {/* Part 2 — what's driving it */}
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 16px' }}>
                  Of lead-initiated cancellations, {lastMinPct}% happened within 24 hours of the appointment — the highest-risk window.
                  {causeLabel && ` The pattern most worth addressing: ${causeLabel.toLowerCase()}.`}
                  {' '}Phiwe&apos;s pre-visit outreach targets this window directly.
                </p>

                {/* Cancel rate comparison: full vs lead-only vs benchmark */}
                {resolved > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                      Cancel rate breakdown
                    </p>
                    {[
                      { label: 'Full cancel rate',         pct: cancelRate,         note: 'all cancellations',         color: cancelRate > 35 ? '#E24B4A' : cancelRate > 20 ? '#EF9F27' : '#1D9E75' },
                      { label: 'Lead-initiated only',      pct: cancelRateCustomer, note: 'excludes studio-initiated', color: cancelRateCustomer > 35 ? '#E24B4A' : cancelRateCustomer > 20 ? '#EF9F27' : '#1D9E75' },
                      { label: 'Cold re-engagement std',   pct: benchmarkCancelPct, note: 'reference',                 color: 'var(--muted)' },
                    ].map(row => (
                      <div key={row.label} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontSize: '12px', color: row.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{row.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(row.pct, 100)}%`, background: row.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '4px 0 0' }}>
                      The {(cancelRate - cancelRateCustomer).toFixed(1)}% difference between the full rate and the lead-initiated rate is accounted for by studio-initiated cancellations — a shared pattern both sides should track.
                    </p>
                  </div>
                )}

                {/* Timing bars */}
                {total > 0 && (() => {
                  const groups = {}
                  cancellations.forEach(c => {
                    const t = String(c.cancellation_timing || 'Unknown')
                    groups[t] = (groups[t] || 0) + 1
                  })
                  const timingRows = Object.entries(groups).sort((a, b) => b[1] - a[1])
                  const timingColor = (t) =>
                    t.includes('Last Minute') ? '#E24B4A' :
                    t.includes('Short Notice') ? '#EF9F27' : '#1D9E75'
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                        When leads cancelled
                      </p>
                      {timingRows.map(([timing, count]) => (
                        <div key={timing} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{timing}</span>
                            <span style={{ fontSize: '12px', color: timingColor(timing), fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{count} cancel{count !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round((count / total) * 100)}%`, background: timingColor(timing), borderRadius: '4px', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Who initiated */}
                {total > 0 && (() => {
                  const byCustomer = cancellations.filter(c => String(c.cancelled_by || '').toLowerCase() === 'customer').length
                  const byAdmin    = total - byCustomer
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                        Initiated by
                      </p>
                      {[
                        { label: 'Lead-initiated', count: byCustomer, color: '#E24B4A' },
                        { label: 'Studio-initiated', count: byAdmin, color: '#EF9F27' },
                      ].map(row => (
                        <div key={row.label} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{row.label}</span>
                            <span style={{ fontSize: '12px', color: row.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{row.count} of {total}</span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round((row.count / total) * 100)}%`, background: row.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Root causes */}
                {activeCauses.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                      Root causes
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {activeCauses.map((c, i) => {
                        const pct       = parseFloat(c.percentage || 0)
                        const barColor  = i === 0 ? '#E24B4A' : '#EF9F27'
                        const actionText = sanitiseCauseText(String(c.action || ''))
                        return (
                          <div key={i} style={{ background: 'var(--bg)', borderRadius: '6px', padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{sanitiseCauseText(c.cause)}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase',
                                  background: c.impact === 'High' ? '#EF9F2720' : '#378ADD20',
                                  color: c.impact === 'High' ? '#EF9F27' : '#378ADD',
                                }}>{c.impact} impact</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: barColor, fontFamily: 'JetBrains Mono, monospace' }}>
                                  {c.count} · {pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                              <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Response: {actionText}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>
            The confirmation follow-up Phiwe runs before each session is the primary lever for reducing last-minute drops.
          </p>
        </div>
      )}

      {/* Session progress bar */}
      <Card style={{ marginBottom: '24px', padding: '14px 16px' }}>
        <SowProgressMini confirmedShows={confirmedShows} upcoming={upcoming} sowTarget={sowTarget} />
      </Card>

      {/* Pipeline — named upcoming appointments */}
      <PipelineSection pipeline={pipeline} isClientView={isClientView} />

      {/* Conversion funnel */}
      <ConversionFunnel
        totalCalls={totalCalls}
        meaningfulConvs={meaningfulConvs}
        bookingCount={bookings.length}
        confirmedShows={confirmedShows}
        convRate={convRate}
        bookingConvRate={bookingConvRate}
        showRate={showRate}
        resolved={resolved}
        bookings={bookings}
      />

      {/* Narrative card */}
      <NarrativeCard
        totalCalls={totalCalls}
        meaningfulConvs={meaningfulConvs}
        convRate={convRate}
        bookingCount={bookings.length}
        upcoming={upcoming}
        activeMonth={activeMonth}
        cancelRate={cancelRate}
        cancels={cancels}
        cancelledCustomer={buckets.cancelledCustomer.length}
        cancelRateCustomer={cancelRateCustomer}
        attended={confirmedShows}
        isClientView={isClientView}
        pipeline={pipeline}
        benchmarksData={benchmarks}
        lastMinuteCancelPct={lastMinuteCancelPct}
      />

      {/* Show gaps — manager/admin only */}
      {!isClientView && (() => {
        const sg = vr?.show_gaps
        if (!sg || sg.gap_count === 0) return null
        return (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--warn)', borderRadius: '8px', padding: '12px 16px', marginTop: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
              Unconfirmed Sessions — Tracker Gap
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 6px' }}>
              {sg.gap_count} session{sg.gap_count !== 1 ? 's' : ''} recorded as held in the manual tracker {sg.gap_count !== 1 ? 'are' : 'is'} not yet confirmed in ClubReady.
              {' '}{sg.note}
              {' '}Once updated, {sg.gap_count !== 1 ? 'these' : 'this'} will be reflected in the show rate.
            </p>
            {sg.gap_leads && sg.gap_leads.length > 0 && (
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                {sg.gap_leads.map(l => l.name).join(' · ')}
              </p>
            )}
          </div>
        )
      })()}

      {/* Data freshness */}
      <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'right', marginTop: '8px' }}>
        {lastUpdated
          ? `Data last updated: ${new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : 'Data freshness unknown'}
        {' '}· Pipeline runs nightly at 02:00 SAST
      </p>

    </div>
  )
}
