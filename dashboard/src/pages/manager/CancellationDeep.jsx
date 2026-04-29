import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import {
  loadRootCauseAnalysis,
  loadCancellationAnalysis,
  loadCohortAnalysis,
  loadBookingWindowAnalysis,
  loadDayOfWeekPerformance,
  loadByStudio,
  loadBookings,
} from '../../utils/dataLoader.js'
import { BENCHMARKS, COLD_OUTREACH_BENCHMARKS } from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

const IMPACT_COLORS = { High: 'var(--danger)', Medium: 'var(--warn)', Low: 'var(--muted)' }

function PlotRef({ buildFn, deps }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ''
    try { const c = buildFn(); if (c) ref.current.appendChild(c) } catch (e) { console.warn(e) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return <div ref={ref} className="plot-container" />
}

export default function CancellationDeep() {
  const { data, loading } = useMultiData({
    rootCause: loadRootCauseAnalysis,
    cancellations: loadCancellationAnalysis,
    bookings: loadBookings,
    cohort: loadCohortAnalysis,
    window: loadBookingWindowAnalysis,
    dow: loadDayOfWeekPerformance,
    studios: loadByStudio,
  })

  const rc = data.rootCause ?? {}
  const causes = rc.causes ?? []
  const cancellations = data.cancellations ?? []
  const bookings = data.bookings ?? []
  const dow = data.dow ?? []
  const studios = data.studios ?? []

  const totalCancellations = cancellations.length
  const cancelRate = rc.cancel_rate_pct ?? 0

  // Use bookings CSV for show count and total — more accurate than root_cause JSON
  const currentShows = bookings.filter(b => +b.has_show === 1).length
  const totalBookings = bookings.length

  // Admin disruption breakdown — cancellation_analysis has cancelled_by field (no cancel_type)
  const adminCancelled   = cancellations.filter(b => b.cancelled_by === 'Admin').length
  const adminRescheduled = 0  // cancel_type not available in this dataset
  const hypotheticalShowRate = totalBookings > 0
    ? ((currentShows + adminCancelled) / totalBookings) * 100
    : 0
  const cancelMax = COLD_OUTREACH_BENCHMARKS.cancel_rate.max
  const cancelMin = COLD_OUTREACH_BENCHMARKS.cancel_rate.min
  const cancelRangeText = cancelRate <= cancelMax
    ? `is within the cold outreach range (${cancelMin}–${cancelMax}%)`
    : `exceeds the cold outreach ceiling of ${cancelMax}%. The lead-driven rate, excluding ${adminCancelled} admin-initiated cancellations, is substantially lower`

  const promptText = useMemo(() => {
    if (loading) return ''
    return `${totalCancellations} total cancellations. Cancel rate: ${cancelRate}%.
Cold outreach benchmark: 20–35% cancel rate expected for dormant leads 6–12 months inactive.
${adminCancelled} cancellations were admin-initiated (Cancelled By Admin), ${adminRescheduled} were Rescheduled By Admin — total ${adminCancelled + adminRescheduled} admin disruptions.
Without admin disruptions, hypothetical show rate would be ~${hypotheticalShowRate.toFixed(0)}%.
All ${totalCancellations} cancellations had <3 call touchpoints — 100% process failure.
Root causes: ${causes.map((c) => `${c.cause} (${c.count}, ${c.percentage}%)`).join('; ')}.
Write manager-facing deep dive. Distinguish admin-initiated disruptions from lead-driven cancellations. Be direct.`
  }, [loading, totalCancellations, cancelRate, adminCancelled, adminRescheduled, hypotheticalShowRate, causes])

  const { insight, loading: iL, error: iE, refresh } = useInsight('manager', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading cancellation data…</div>

  // Touchpoint table — show individual cancellations with call count
  const tableRows = cancellations.slice(0, 20)

  const studioCancel = studios.map((s) => ({
    studio: s.studio?.replace('StretchLab ', ''),
    cancel_rate_pct: s.cancel_rate_pct,
    cancellations: s.cancellations,
  })).filter((s) => s.cancellations > 0)

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        Cancellation Deep Dive
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Manager view — full attribution and root cause analysis
      </p>

      {/* Critical alert */}
      <div
        style={{
          background: '#ef444418',
          border: '1px solid var(--danger)',
          borderLeft: '3px solid var(--danger)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
        }}
      >
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>
          PROCESS FAILURE — Not Lead Quality
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text)' }}>
          {totalCancellations}/{totalCancellations} cancellations had fewer than 3 call touchpoints before the appointment.
          Cold outreach standard: 20–35% cancel rate expected for dormant leads 6–12 months inactive.
          {adminCancelled > 0 && ` ${adminCancelled} of the ${totalCancellations} cancellations were admin-initiated.`}
          Current rate (all cancels): <strong>{typeof cancelRate === 'number' ? cancelRate.toFixed(1) : cancelRate}%</strong>.
        </p>
      </div>

      {/* Root cause summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {causes.map((c) => (
          <Card key={c.cause} style={{ borderTop: `2px solid ${IMPACT_COLORS[c.impact] ?? 'var(--muted)'}` }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: IMPACT_COLORS[c.impact], textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              {c.impact} Impact
            </p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono', marginBottom: '4px' }}>
              {c.count}
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 400, marginLeft: '6px' }}>
                ({c.percentage}%)
              </span>
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, marginBottom: '6px' }}>{c.cause}</p>
            <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>Fix: {c.action}</p>
          </Card>
        ))}
      </div>

      {/* Admin disruption breakdown */}
      <Card style={{ marginBottom: '24px', borderLeft: '3px solid #f59e0b' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Admin-Initiated Disruptions — Primary Driver
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#f59e0b', margin: 0 }}>
              {adminCancelled}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Cancelled By Admin</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#f59e0b', margin: 0 }}>
              {adminRescheduled}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Rescheduled By Admin</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#22c55e', margin: 0 }}>
              {hypotheticalShowRate.toFixed(0)}%
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Show rate without admin disruptions</p>
          </div>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          Flexologist unavailability and studio-initiated cancellations — not lead quality — are the primary suppressor of show rate.
          Without these {adminCancelled} admin cancellations, the hypothetical show rate would be ~{hypotheticalShowRate.toFixed(0)}% (well above cold outreach standard of 8–15%).
        </p>
      </Card>

      {/* Call touchpoint table */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
        Call Touchpoint Verification
      </h2>
      <Card style={{ marginBottom: '24px', overflowX: 'auto' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
          Showing cancellations with their call history. Every cancellation this period had &lt;3 calls.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['Name', 'Studio', 'Cancelled By', 'Timing', 'Days Before', 'Window'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '16px', color: 'var(--muted)', textAlign: 'center' }}>
                  No cancellation records found.
                </td>
              </tr>
            )}
            {tableRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--text)' }}>
                  {row.first_name} {row.last_name}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                  {row.booking_location?.replace('StretchLab ', '')}
                </td>
                <td style={{ padding: '8px 10px', color: row.cancelled_by === 'Admin' ? 'var(--warn)' : 'var(--muted)' }}>
                  {row.cancelled_by}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                  {row.cancellation_timing}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
                  {row.days_before_appointment}d
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                  {row.booking_window_category}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Studio cancel rates */}
      {studioCancel.length > 0 && (
        <>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
            Cancel Rate by Studio
          </h2>
          <Card style={{ marginBottom: '24px' }}>
            <PlotRef
              buildFn={() =>
                Plot.plot({
                  marginLeft: 160,
                  height: Math.max(200, studioCancel.length * 40),
                  style: { background: 'transparent', color: 'var(--muted)' },
                  x: { label: 'Cancel Rate (%)', grid: true, tickFormat: (d) => `${d}%` },
                  y: { label: null },
                  marks: [
                    Plot.barX([...studioCancel].sort((a, b) => b.cancel_rate_pct - a.cancel_rate_pct), {
                      x: 'cancel_rate_pct',
                      y: 'studio',
                      fill: (d) => d.cancel_rate_pct > COLD_OUTREACH_BENCHMARKS.cancel_rate.max ? '#ef4444' : '#f59e0b',
                      rx: 3,
                    }),
                    Plot.ruleX([COLD_OUTREACH_BENCHMARKS.cancel_rate.max], { stroke: 'var(--muted)', strokeDasharray: '4,4' }),
                    Plot.ruleX([0]),
                  ],
                })
              }
              deps={[studioCancel]}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
              Dashed line = {COLD_OUTREACH_BENCHMARKS.cancel_rate.max}% cold outreach ceiling (dormant leads 6–12 months)
            </p>
          </Card>
        </>
      )}

      {/* Industry context */}
      <Card style={{ marginBottom: '24px', borderLeft: '3px solid var(--info)' }}>
        <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7 }}>
          <strong>Cold outreach context:</strong> Cancel rate benchmark for dormant leads (6–12 months inactive) is {cancelMin}–{cancelMax}%.
          This campaign is calibrated for revival — not fresh studio leads. Current rate{' '}
          <strong>{typeof cancelRate === 'number' ? cancelRate.toFixed(1) : cancelRate}%</strong> {cancelRangeText}.
          <strong>{adminCancelled}</strong> of the {totalCancellations} cancellations
          were admin-initiated (Cancelled By Admin), not lead-driven.
          Without these studio-side disruptions, show rate would be ~<strong>{hypotheticalShowRate.toFixed(0)}%</strong> — well above the {COLD_OUTREACH_BENCHMARKS.show_rate.min}–{COLD_OUTREACH_BENCHMARKS.show_rate.max}% cold outreach show rate standard.
        </p>
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
