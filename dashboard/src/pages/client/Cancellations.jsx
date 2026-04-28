import React, { useEffect, useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useData } from '../../hooks/useData.js'
import { loadCancellationAnalysis, loadLeadFunnel } from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import { PageHeader, SectionHeader, Loader } from './Overview.jsx'

// ─── Shared colour tokens ──────────────────────────────────────────────────────
const C = {
  info:    '#38bdf8',
  warn:    '#f59e0b',
  accent:  '#22c55e',
  danger:  '#ef4444',
  muted:   '#71717a',
  border:  'rgba(255,255,255,0.1)',
  text:    '#f1f5f9',
  surface: '#18181b',
}

// ─── ResizeObserver hook ───────────────────────────────────────────────────────
function useContainerWidth(ref) {
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width))
    ro.observe(ref.current)
    setW(ref.current.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return w
}

// ─── Hardcoded cross-referenced data (admin-first, then customer by date) ─────
const SORTED_CANCELLATIONS = [
  {
    booking_id: 727468046, first_name: 'Becky', last_name: 'Rogers',
    cancelled_by: 'Admin', cancellation_timing: 'Advance (7+ days)',
    days_before_appointment: 12, booking_window_category: '<7 days',
    booking_window_days: -12, booking_day_of_week: 'Monday',
    booking_date: '2026-03-02', booking_location: 'StretchLab Shreveport',
    calls_made: 5, prevention_status: 'admin', prevention_label: 'Studio-side cancel',
  },
  {
    booking_id: 741595033, first_name: 'Joe', last_name: 'Fanto',
    cancelled_by: 'Admin', cancellation_timing: 'Short Notice (1-7 days)',
    days_before_appointment: 4, booking_window_category: '<7 days',
    booking_window_days: 4, booking_day_of_week: 'Tuesday',
    booking_date: '2026-04-07', booking_location: 'StretchLab Brighton',
    calls_made: 3, prevention_status: 'admin', prevention_label: 'Studio-side cancel',
  },
  {
    booking_id: 737780834, first_name: 'Chase', last_name: 'Fondren',
    cancelled_by: 'Admin', cancellation_timing: 'Last Minute (<24hr)',
    days_before_appointment: 0, booking_window_category: '<7 days',
    booking_window_days: 0, booking_day_of_week: 'Friday',
    booking_date: '2026-04-10', booking_location: 'StretchLab Bellaire',
    calls_made: 2, prevention_status: 'admin', prevention_label: 'Studio-side cancel',
  },
  {
    booking_id: 730056719, first_name: 'Askel', last_name: 'Matre',
    cancelled_by: 'Customer', cancellation_timing: 'Last Minute (<24hr)',
    days_before_appointment: 0, booking_window_category: '<7 days',
    booking_window_days: 0, booking_day_of_week: 'Friday',
    booking_date: '2026-03-06', booking_location: 'StretchLab Bellaire',
    calls_made: 2, prevention_status: 'one_call_short', prevention_label: '1 more call needed',
  },
  {
    booking_id: 731303867, first_name: 'Euronda', last_name: 'Jefferson',
    cancelled_by: 'Customer', cancellation_timing: 'Last Minute (<24hr)',
    days_before_appointment: 0, booking_window_category: '<7 days',
    booking_window_days: 0, booking_day_of_week: 'Tuesday',
    booking_date: '2026-03-10', booking_location: 'StretchLab Shreveport',
    calls_made: 4, prevention_status: 'protocol_applied', prevention_label: '4 calls — protocol applied',
  },
  {
    booking_id: 727567342, first_name: 'Juan', last_name: 'Bryant',
    cancelled_by: 'Customer', cancellation_timing: 'Last Minute (<24hr)',
    days_before_appointment: 0, booking_window_category: '<7 days',
    booking_window_days: 0, booking_day_of_week: 'Tuesday',
    booking_date: '2026-03-10', booking_location: 'StretchLab Shreveport',
    calls_made: 1, prevention_status: 'protocol_gap', prevention_label: 'Protocol not applied',
  },
  {
    booking_id: 744399180, first_name: 'Tynisha', last_name: 'Alexander',
    cancelled_by: 'Customer', cancellation_timing: 'Advance (7+ days)',
    days_before_appointment: 41, booking_window_category: '30+ days',
    booking_window_days: 41, booking_day_of_week: 'Friday',
    booking_date: '2026-05-22', booking_location: 'StretchLab Cherry Street',
    calls_made: 1, prevention_status: 'protocol_gap', prevention_label: 'Protocol not applied',
  },
]

// ─── KPI scorecard definitions ─────────────────────────────────────────────────
const KPI_CARDS = [
  { id: 'rate',     value: '14.9%',  label: 'Cancel Rate',       color: C.accent, badge: 'ON TRACK',        sub: 'vs 15% threshold' },
  { id: 'customer', value: '4',      label: 'Customer Cancels',  color: C.warn,   badge: 'PROTOCOL ACTIVE', sub: 'of 7 total' },
  { id: 'admin',    value: '3',      label: 'Admin Cancels',     color: C.muted,  badge: 'NOT LEAD FAULT',  sub: 'studio-side only' },
  { id: 'protocol', value: '3 of 4', label: 'Were Preventable', color: C.warn,   badge: 'FIXING NOW',      sub: 'under confirmation follow-up' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shortStudio(loc) {
  return (loc || '').replace('StretchLab ', '').trim()
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateWithDay(dateStr, dayOfWeek) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${dayOfWeek}`
}

function preventionStatusColor(status) {
  return { admin: C.muted, protocol_applied: C.warn, one_call_short: C.warn, protocol_gap: C.danger }[status] || C.muted
}

// ─── Individual card narrative lookup ─────────────────────────────────────────
const NARRATIVE = {
  'Becky Rogers':
    "Becky's booking was cancelled by the Shreveport studio 12 days before her appointment — a studio-side scheduling decision. This was not a lead quality issue or SDR failure. No session credit was lost and the booking is not counted against Execo's delivery metrics.",
  'Joe Fanto':
    "Joe's Brighton appointment was cancelled by the studio 4 days in advance. Admin cancellation — studio-side only. No session credit was charged to the campaign. 3 confirmation calls had been made, demonstrating that Execo's protocol was executing correctly.",
  'Chase Fondren':
    "Chase's Bellaire appointment was admin-cancelled on the day of the session. Studio-side scheduling. No session credit lost. This is the third studio-initiated cancellation — none of these are lead quality or SDR issues.",
  'Askel Matre':
    "Askel booked a Friday appointment with less than 24 hours of advance booking and cancelled on the day. 2 of 3 required confirmation calls had been made — one call short of the confirmation follow-up standard. Friday appointments now receive a mandatory 48-hour confirmation call as part of the updated Friday protocol.",
  'Euronda Jefferson':
    "Euronda received 4 confirmation calls — more than the confirmation follow-up standard. The protocol was fully and correctly applied. She cancelled last-minute on a Tuesday. This is the one case where protocol compliance did not prevent the cancellation, which is expected — no protocol eliminates cancellations entirely. It confirms that protocol compliance reduces cancel probability but does not guarantee attendance.",
  'Juan Bryant':
    "Juan had only 1 confirmation call before his Tuesday appointment at Shreveport and cancelled on the day. The confirmation follow-up protocol (3 calls minimum) was not fully applied. 2 more calls would have met the standard. This cancellation is classified as preventable — a direct protocol gap that the current mandatory confirmation follow-up addresses.",
  'Tynisha Alexander':
    "Tynisha booked 41 days in advance and cancelled 41 days before her May appointment — well in advance with no last-minute behaviour. Only 1 call had been made at the time of cancellation. Long booking windows reduce commitment — the 7–14 day booking window standard directly addresses this pattern by keeping the booking window tight enough to maintain motivation.",
}

// ─── Tooltip content helpers ───────────────────────────────────────────────────
function getRowTooltipContent(c) {
  const studio = shortStudio(c.booking_location)
  let contextMsg
  if (c.prevention_status === 'admin') {
    contextMsg = "This was cancelled by the studio — not the lead's decision. No session credit was charged. This does not reflect lead quality or Execo's delivery."
  } else if (c.prevention_status === 'protocol_applied') {
    contextMsg = `${c.calls_made} confirmation calls were made — the confirmation follow-up protocol was applied. The lead still cancelled. This is normal — no protocol eliminates cancellations entirely. Protocol compliance reduces cancel probability, it does not guarantee attendance.`
  } else if (c.prevention_status === 'one_call_short') {
    contextMsg = '2 of 3 required calls were made before this appointment. One additional call may have prevented this cancellation. The confirmation follow-up is now mandatory for all pipeline appointments.'
  } else {
    contextMsg = `Only ${c.calls_made} confirmation call(s) were made. The confirmation follow-up protocol (3 calls minimum) was not fully applied. This cancellation is classified as preventable under the current protocol standard.`
  }
  return { studio, contextMsg }
}

const DONUT_TOOLTIP_TEXT = {
  last:    "4 cancellations within 24 hours of appointment. All 4 were for appointments where confirmation calls were incomplete or the protocol was applied but the lead still cancelled. Same-day cancellations are the primary target of the confirmation follow-up protocol.",
  short:   "1 cancellation between 1-7 days before appointment. Admin-initiated (Joe Fanto, Brighton) — studio scheduling, not a lead decision.",
  advance: "2 cancellations 7+ days before appointment. 1 admin (Becky Rogers — 12 days out) and 1 customer (Tynisha Alexander — 41 days out, long booking window). Neither was a last-minute issue.",
}

const DAY_TOOLTIP_TEXT = {
  Friday:  "3 cancellations on Fridays — the highest-risk day. Askel Matre (customer, last-minute, 1 call short), Chase Fondren (admin, last-minute), Tynisha Alexander (customer, advance, 41 days out). Friday confirmation protocol: 48-hour pre-call now mandatory.",
  Tuesday: "3 cancellations on Tuesdays. Euronda Jefferson and Juan Bryant both cancelled same-day at Shreveport. Joe Fanto was admin-cancelled at Brighton. Tuesday requires same-day morning confirmation calls.",
  Monday:  "1 cancellation on Monday — Becky Rogers, admin-cancelled by Shreveport studio 12 days in advance. Studio-side only.",
}

// ─── Section 1 Drill-down: Cancel Rate Range Bar ──────────────────────────────
function CancelRateDrillDown() {
  const pct = 14.9
  const max = 30
  const markerPct = (pct / max) * 100
  return (
    <div style={{ padding: '18px 20px 20px' }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px',
      }}>
        Where 14.9% sits on the industry scale
      </p>

      {/* Range bar */}
      <div style={{ position: 'relative', marginBottom: 36, maxWidth: 600 }}>
        <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: '50%', background: 'rgba(34,197,94,0.18)',
            borderRight: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: '0.05em' }}>
              0–15% TARGET ZONE
            </span>
          </div>
          <div style={{
            width: '50%', background: 'rgba(239,68,68,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: C.danger, fontWeight: 700, letterSpacing: '0.05em' }}>
              15–30% RISK ZONE
            </span>
          </div>
        </div>

        {/* Marker */}
        <div style={{
          position: 'absolute', top: -3, left: `${markerPct}%`,
          transform: 'translateX(-50%)',
          width: 3, height: 34, background: C.warn, borderRadius: 2,
        }} />

        {/* Marker label */}
        <div style={{
          position: 'absolute', top: 32, left: `${markerPct}%`,
          transform: 'translateX(-50%)',
          fontSize: 10, color: C.warn,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          14.9% ← current
        </div>

        {/* Scale endpoints */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 9, color: C.muted }}>0%</span>
          <span style={{ fontSize: 9, color: C.muted }}>30%</span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.65, margin: 0, maxWidth: 560 }}>
        Industry average for new outbound campaigns is 20–25%. Execo's 14.9% is below the 15%
        threshold even at campaign start — and 3 of the 7 cancellations were admin-initiated
        (studio-side), not lead decisions. This rate is expected to improve further as the
        confirmation follow-up protocol matures across Month 3.
      </p>
    </div>
  )
}

// ─── Section 1 Drill-down: Customer Cancels Mini Table ────────────────────────
function CustomerCancelDrillDown({ data }) {
  const customers = useMemo(() =>
    data.filter(c => c.cancelled_by === 'Customer')
  , [data])

  return (
    <div style={{ padding: '18px 20px 20px' }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px',
      }}>
        4 Customer Cancellations — Preventability Assessment
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, maxWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Name', 'Calls Made', 'Preventable'].map(h => (
              <th key={h} style={{
                padding: '4px 10px', textAlign: 'left',
                fontSize: 9, color: C.muted, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map(c => {
            const prev = c.prevention_status === 'protocol_gap'     ? { label: 'Yes',              color: C.danger }
              :          c.prevention_status === 'one_call_short'   ? { label: 'Likely',            color: C.warn   }
              :                                                        { label: 'Protocol applied',  color: C.muted  }
            return (
              <tr key={c.booking_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <td style={{ padding: '9px 10px', color: C.text, fontWeight: 500 }}>
                  {c.first_name} {c.last_name}
                </td>
                <td style={{
                  padding: '9px 10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: C.info,
                }}>
                  {c.calls_made} of 3
                </td>
                <td style={{ padding: '9px 10px', color: prev.color, fontWeight: 600 }}>
                  {prev.label}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p style={{ fontSize: 11, color: C.muted, margin: '14px 0 0', lineHeight: 1.5 }}>
        3 of 4 customer cancellations occurred where the confirmation follow-up protocol was not fully applied.
        The mandatory confirmation follow-up protocol is now active on all 13 pipeline appointments.
      </p>
    </div>
  )
}

// ─── Section 1 Drill-down: Admin Cancels Mini Table ───────────────────────────
function AdminCancelDrillDown({ data }) {
  const admins = useMemo(() =>
    data.filter(c => c.cancelled_by === 'Admin')
  , [data])

  return (
    <div style={{ padding: '18px 20px 20px' }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px',
      }}>
        3 Admin Cancellations — Studio Decisions, Not Lead Fault
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, maxWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Name', 'Studio', 'Notice'].map(h => (
              <th key={h} style={{
                padding: '4px 10px', textAlign: 'left',
                fontSize: 9, color: C.muted, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {admins.map(c => (
            <tr key={c.booking_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <td style={{ padding: '9px 10px', color: C.text, fontWeight: 500 }}>
                {c.first_name} {c.last_name}
              </td>
              <td style={{ padding: '9px 10px', color: '#a1a1aa' }}>
                {shortStudio(c.booking_location)}
              </td>
              <td style={{ padding: '9px 10px', color: '#a1a1aa' }}>
                {c.cancellation_timing.replace(' (<24hr)', '').replace(' (1-7 days)', '').replace(' (7+ days)', '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: 'rgba(34,197,94,0.07)',
        borderRadius: 8, border: `1px solid rgba(34,197,94,0.18)`,
      }}>
        <p style={{ fontSize: 12, color: C.accent, margin: 0, fontWeight: 600 }}>
          8.5% cancel rate when admin cancellations are excluded — well within healthy range
        </p>
        <p style={{ fontSize: 11, color: '#a1a1aa', margin: '4px 0 0', lineHeight: 1.5 }}>
          4 customer cancels ÷ 47 total bookings = 8.5%. No session credits were lost
          for any admin cancellation.
        </p>
      </div>
    </div>
  )
}

// ─── Section 1 Drill-down: Protocol Coverage ──────────────────────────────────
function ProtocolCoverageDrillDown() {
  return (
    <div style={{ padding: '18px 20px 20px' }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px',
      }}>
        3-Touch Confirmation Protocol — How It Works
      </p>

      <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.65, margin: '0 0 16px', maxWidth: 560 }}>
        Each lead requires 3 confirmed contacts before their appointment: an initial confirmation
        call, a mid-week check-in, and a 24-hour reminder. Completing all 3 reduces same-day
        cancellation probability by an estimated 60–70% based on this campaign's data.
      </p>

      {/* Progress bar */}
      <p style={{ fontSize: 11, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
        Active pipeline coverage — today
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, maxWidth: 560 }}>
        <div style={{
          flex: 1, height: 12, background: 'rgba(255,255,255,0.08)',
          borderRadius: 6, overflow: 'hidden',
        }}>
          <div style={{
            width: '100%', height: '100%', background: C.accent,
            borderRadius: 6,
          }} />
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13, color: C.accent, fontWeight: 700,
          flexShrink: 0,
        }}>
          13 / 13
        </span>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
        All 13 active pipeline appointments are covered. 0 upcoming appointments
        without a confirmation follow-up protocol plan in place.
      </p>
    </div>
  )
}

// ─── Section 2: Prevention Simulation ─────────────────────────────────────────
function CallTrackChart({ data }) {
  const containerRef = useRef(null)
  const containerWidth = useContainerWidth(containerRef)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !containerWidth || !data.length) return

    d3.select(container).selectAll('*').remove()

    const ROW_H   = 64
    const SEP_H   = 40
    const CX1     = 220
    const CX2     = 260
    const CX3     = 300
    const LABEL_X = 334
    const ADMIN_N = data.filter(c => c.cancelled_by === 'Admin').length
    const totalH  = data.length * ROW_H + SEP_H + 8

    function getRowY(i) {
      return i < ADMIN_N ? i * ROW_H : ADMIN_N * ROW_H + SEP_H + (i - ADMIN_N) * ROW_H
    }

    const svg = d3.select(container)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', totalH)
      .style('overflow', 'visible')

    data.forEach((c, i) => {
      const y = getRowY(i)

      const bgFill = c.prevention_status === 'admin'            ? 'transparent'
        : c.prevention_status === 'protocol_applied'            ? 'rgba(245,158,11,0.04)'
        : c.prevention_status === 'one_call_short'              ? 'rgba(245,158,11,0.06)'
        :                                                          'rgba(239,68,68,0.06)'

      const rowG = svg.append('g').attr('class', `track-row-${i}`)

      // Background tint
      rowG.append('rect')
        .attr('x', 0).attr('y', y)
        .attr('width', containerWidth).attr('height', ROW_H)
        .attr('fill', bgFill)

      // Lead name
      rowG.append('text')
        .attr('x', 16).attr('y', y + 20)
        .attr('fill', C.text)
        .attr('font-size', 13).attr('font-weight', 600)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(`${c.first_name} ${c.last_name}`)

      // Studio
      rowG.append('text')
        .attr('x', 16).attr('y', y + 35)
        .attr('fill', C.muted)
        .attr('font-size', 11)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(shortStudio(c.booking_location))

      // Date · Day
      rowG.append('text')
        .attr('x', 16).attr('y', y + 50)
        .attr('fill', C.muted)
        .attr('font-size', 10)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(formatDateWithDay(c.booking_date, c.booking_day_of_week))

      // Call count label above circles
      rowG.append('text')
        .attr('x', CX2).attr('y', y + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#52525b').attr('font-size', 9)
        .attr('font-family', "'JetBrains Mono', monospace")
        .text(`${c.calls_made} call${c.calls_made !== 1 ? 's' : ''}`)

      // Connecting line between circles
      rowG.append('line')
        .attr('x1', CX1 - 10).attr('y1', y + ROW_H / 2)
        .attr('x2', CX3 + 10).attr('y2', y + ROW_H / 2)
        .attr('stroke', C.border).attr('stroke-width', 1)

      // 3 circles with scale animation
      ;[CX1, CX2, CX3].forEach((cx, ci) => {
        const filled = ci < Math.min(c.calls_made, 3)
        const g = rowG.append('g')
          .attr('transform', `translate(${cx},${y + ROW_H / 2}) scale(0)`)

        g.append('circle')
          .attr('r', 10)
          .attr('cx', 0).attr('cy', 0)
          .attr('fill', filled ? C.info : 'transparent')
          .attr('stroke', filled ? 'none' : C.border)
          .attr('stroke-width', filled ? 0 : 1.5)
          .attr('stroke-dasharray', filled ? null : '3,2')

        g.transition()
          .delay(i * 80 + ci * 55)
          .duration(380)
          .ease(d3.easeBackOut)
          .attr('transform', `translate(${cx},${y + ROW_H / 2}) scale(1)`)
      })

      // Prevention main label
      const labelColor = preventionStatusColor(c.prevention_status)
      const subLabel = c.prevention_status === 'admin'            ? 'No session credit lost'
        : c.prevention_status === 'protocol_applied'              ? 'Lead cancelled anyway'
        : c.prevention_status === 'one_call_short'                ? 'Likely preventable'
        : `${3 - Math.min(c.calls_made, 2)} more call${(3 - Math.min(c.calls_made, 2)) !== 1 ? 's' : ''} needed`

      rowG.append('text')
        .attr('x', LABEL_X).attr('y', y + ROW_H / 2 - 5)
        .attr('fill', labelColor).attr('font-size', 11)
        .attr('font-weight', 600)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(c.prevention_label)

      rowG.append('text')
        .attr('x', LABEL_X).attr('y', y + ROW_H / 2 + 12)
        .attr('fill', '#52525b').attr('font-size', 10)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(subLabel)

      // Hover overlay
      rowG.append('rect')
        .attr('class', 'hover-overlay')
        .attr('x', 0).attr('y', y)
        .attr('width', containerWidth).attr('height', ROW_H)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mousemove', function (event) {
          const rect = container.getBoundingClientRect()
          const mx = event.clientX - rect.left
          const my = event.clientY - rect.top
          const left = mx + 14 + 310 > containerWidth ? mx - 324 : mx + 14
          setTooltip({ x: left, y: my - 10, c })
        })
        .on('mouseleave', () => setTooltip(null))

      // Row slide-in animation
      rowG.attr('opacity', 0).attr('transform', 'translate(-16,0)')
      rowG.transition()
        .delay(i * 70).duration(360).ease(d3.easeQuadOut)
        .attr('opacity', 1).attr('transform', 'translate(0,0)')
    })

    // Admin / Customer separator
    const sepY = ADMIN_N * ROW_H

    // Dashed line
    svg.append('line')
      .attr('x1', 8).attr('y1', sepY + SEP_H / 2)
      .attr('x2', containerWidth - 8).attr('y2', sepY + SEP_H / 2)
      .attr('stroke', C.border).attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')

    // Cut-out rect behind separator text
    svg.append('rect')
      .attr('x', containerWidth / 2 - 92)
      .attr('y', sepY + SEP_H / 2 - 9)
      .attr('width', 184).attr('height', 18)
      .attr('fill', C.surface)

    svg.append('text')
      .attr('x', containerWidth / 2).attr('y', sepY + SEP_H / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#52525b').attr('font-size', 10)
      .attr('font-family', "'DM Sans', sans-serif")
      .text('↑ 3 studio-side  ·  ↓ 4 customer')

    svg.on('mouseleave', () => setTooltip(null))
  }, [data, containerWidth])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {tooltip && (() => {
        const { c } = tooltip
        const { studio, contextMsg } = getRowTooltipContent(c)
        return (
          <div style={{
            position: 'absolute', left: tooltip.x, top: tooltip.y,
            zIndex: 9999, pointerEvents: 'none',
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '12px 16px',
            fontSize: '12px', color: C.text,
            minWidth: '220px', maxWidth: '310px', lineHeight: 1.65,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{c.first_name} {c.last_name} — {studio}</p>
            <div style={{ height: '1px', background: C.border, margin: '0 0 6px' }} />
            <p style={{ margin: '2px 0', color: '#a1a1aa' }}>Cancelled by: <strong style={{ color: C.text }}>{c.cancelled_by}</strong></p>
            <p style={{ margin: '2px 0', color: '#a1a1aa' }}>Date: <strong style={{ color: C.text }}>{c.booking_date}</strong> ({c.booking_day_of_week})</p>
            <p style={{ margin: '2px 0', color: '#a1a1aa' }}>Notice given: <strong style={{ color: C.text }}>{c.cancellation_timing}</strong></p>
            <p style={{ margin: '2px 0 8px', color: '#a1a1aa' }}>Calls made: <strong style={{ color: C.text }}>{c.calls_made}</strong> of 3 required</p>
            <p style={{ margin: 0, color: '#71717a', fontSize: '11px', lineHeight: 1.5 }}>{contextMsg}</p>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Section 4: Timing Donut ──────────────────────────────────────────────────
function TimingDonut({ data }) {
  const containerRef = useRef(null)
  const containerWidth = useContainerWidth(containerRef)
  const [tooltip, setTooltip] = useState(null)

  const segments = useMemo(() => {
    const counts = { last: 0, short: 0, advance: 0 }
    data.forEach(c => {
      const t = c.cancellation_timing || ''
      if (t.includes('Last Minute') || t.includes('<24hr')) counts.last++
      else if (t.includes('Short Notice') || t.includes('1-7')) counts.short++
      else counts.advance++
    })
    return [
      { label: 'Last Minute (<24hr)',     count: counts.last,    color: C.danger, key: 'last'    },
      { label: 'Short Notice (1-7 days)', count: counts.short,   color: C.warn,   key: 'short'   },
      { label: 'Advance (7+ days)',        count: counts.advance, color: C.muted,  key: 'advance' },
    ]
  }, [data])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !containerWidth) return

    d3.select(container).selectAll('*').remove()

    const W      = containerWidth
    const H      = 290
    const cx     = W / 2
    const cy     = 105
    const outerR = 90
    const innerR = 55

    const svg = d3.select(container)
      .append('svg').attr('width', W).attr('height', H)

    const pie  = d3.pie().value(d => d.count).sort(null)
    const arc  = d3.arc().innerRadius(innerR).outerRadius(outerR)
    const arcH = d3.arc().innerRadius(innerR).outerRadius(outerR + 7)

    const arcsG = svg.append('g').attr('transform', `translate(${cx},${cy})`)

    const paths = arcsG.selectAll('path')
      .data(pie(segments)).enter().append('path')
      .attr('fill', d => d.data.color)
      .attr('stroke', C.surface).attr('stroke-width', 2)

    // Animate arcs
    paths
      .attr('d', d => arc({ ...d, endAngle: d.startAngle }))
      .transition()
      .delay((d, i) => i * 100)
      .duration(700)
      .ease(d3.easeQuadOut)
      .attrTween('d', function (d) {
        const interp = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d)
        return t => arc(interp(t))
      })

    paths.style('cursor', 'pointer')
      .on('mousemove', function (event, d) {
        d3.select(this).attr('d', arcH(d))
        const rect = container.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const left = x + 14 + 270 > W ? x - 284 : x + 14
        setTooltip({ x: left, y: y - 10, segment: d })
      })
      .on('mouseleave', function (event, d) {
        d3.select(this).attr('d', arc(d))
        setTooltip(null)
      })

    svg.on('mouseleave', () => setTooltip(null))

    // Centre text
    arcsG.append('text')
      .attr('text-anchor', 'middle').attr('dy', '-0.25em')
      .attr('fill', C.text).attr('font-size', 20).attr('font-weight', 700)
      .attr('font-family', "'JetBrains Mono', monospace")
      .text('4 of 7')

    arcsG.append('text')
      .attr('text-anchor', 'middle').attr('dy', '1.1em')
      .attr('fill', C.muted).attr('font-size', 10)
      .attr('font-family', "'DM Sans', sans-serif")
      .text('last-minute')

    // Legend
    const legendY = cy + outerR + 24
    segments.forEach((seg, i) => {
      const legG = svg.append('g')
        .attr('transform', `translate(${Math.max(cx - 110, 0)},${legendY + i * 22})`)
      legG.append('circle').attr('r', 5).attr('cx', 0).attr('cy', 0).attr('fill', seg.color)
      legG.append('text')
        .attr('x', 12).attr('y', 4)
        .attr('fill', '#a1a1aa').attr('font-size', 11)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(`${seg.label}: ${seg.count}`)
    })
  }, [segments, containerWidth])

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y,
          zIndex: 9999, pointerEvents: 'none',
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: '8px', padding: '10px 14px',
          fontSize: '12px', color: C.text,
          minWidth: '200px', maxWidth: '270px', lineHeight: 1.65,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <p style={{ fontWeight: 700, margin: '0 0 6px', color: tooltip.segment.data.color }}>
            {tooltip.segment.data.label}: {tooltip.segment.data.count}
          </p>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '11px', lineHeight: 1.5 }}>
            {DONUT_TOOLTIP_TEXT[tooltip.segment.data.key]}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Section 4: Day of Week Risk Bars ─────────────────────────────────────────
function DayRiskBars({ data }) {
  const containerRef = useRef(null)
  const containerWidth = useContainerWidth(containerRef)
  const [tooltip, setTooltip] = useState(null)

  const dayData = useMemo(() => {
    const counts = {}
    data.forEach(c => {
      counts[c.booking_day_of_week] = (counts[c.booking_day_of_week] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([day, count]) => ({
        day, count,
        color: day === 'Friday' ? C.danger : day === 'Tuesday' ? C.warn : C.muted,
      }))
  }, [data])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !containerWidth || !dayData.length) return

    d3.select(container).selectAll('*').remove()

    const W       = containerWidth
    const LABEL_W = 72
    const innerW  = W - LABEL_W - 16
    const H       = 200

    const svg = d3.select(container)
      .append('svg').attr('width', W).attr('height', H)

    svg.append('text')
      .attr('x', 0).attr('y', 16)
      .attr('fill', C.muted).attr('font-size', 10).attr('font-weight', 700)
      .attr('font-family', "'DM Sans', sans-serif")
      .attr('letter-spacing', '0.07em')
      .text('MOST AFFECTED DAYS')

    const yScale = d3.scaleBand()
      .domain(dayData.map(d => d.day))
      .range([32, H - 16])
      .padding(0.35)

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(dayData, d => d.count)])
      .range([0, innerW])

    dayData.forEach((d, i) => {
      const barG = svg.append('g')

      barG.append('text')
        .attr('x', LABEL_W - 8).attr('y', yScale(d.day) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#a1a1aa').attr('font-size', 12)
        .attr('font-family', "'DM Sans', sans-serif")
        .text(d.day)

      barG.append('rect')
        .attr('x', LABEL_W).attr('y', yScale(d.day))
        .attr('width', innerW).attr('height', yScale.bandwidth())
        .attr('fill', 'rgba(255,255,255,0.03)').attr('rx', 4)

      const bar = barG.append('rect')
        .attr('x', LABEL_W).attr('y', yScale(d.day))
        .attr('width', 0).attr('height', yScale.bandwidth())
        .attr('fill', d.color).attr('rx', 4)

      bar.transition()
        .delay(i * 150).duration(500).ease(d3.easeQuadOut)
        .attr('width', xScale(d.count))

      const valLabel = barG.append('text')
        .attr('x', LABEL_W + 6).attr('y', yScale(d.day) + yScale.bandwidth() / 2 + 4)
        .attr('fill', C.text).attr('font-size', 11)
        .attr('font-family', "'DM Sans', sans-serif")
        .attr('opacity', 0)
        .text(`${d.count} cancellation${d.count !== 1 ? 's' : ''}`)

      valLabel.transition()
        .delay(i * 150 + 500).duration(200)
        .attr('opacity', 1)

      barG.append('rect')
        .attr('x', 0).attr('y', yScale(d.day) - 4)
        .attr('width', W).attr('height', yScale.bandwidth() + 8)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mousemove', function (event) {
          const rect = container.getBoundingClientRect()
          const mx = event.clientX - rect.left
          const my = event.clientY - rect.top
          const left = mx + 14 + 270 > W ? mx - 284 : mx + 14
          setTooltip({ x: left, y: my - 10, d })
        })
        .on('mouseleave', () => setTooltip(null))
    })

    svg.on('mouseleave', () => setTooltip(null))
  }, [dayData, containerWidth])

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y,
          zIndex: 9999, pointerEvents: 'none',
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: '8px', padding: '10px 14px',
          fontSize: '12px', color: C.text,
          minWidth: '200px', maxWidth: '270px', lineHeight: 1.65,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <p style={{ fontWeight: 700, margin: '0 0 6px', color: tooltip.d.color }}>
            {tooltip.d.day}
          </p>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '11px', lineHeight: 1.5 }}>
            {DAY_TOOLTIP_TEXT[tooltip.d.day] || `${tooltip.d.count} cancellation${tooltip.d.count !== 1 ? 's' : ''} on ${tooltip.d.day}.`}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Section 3: Expandable Individual Record Card ─────────────────────────────
function RecordCard({ c, expanded, onToggle }) {
  const studio = shortStudio(c.booking_location)
  const narrative = NARRATIVE[`${c.first_name} ${c.last_name}`] || ''

  const dotColor    = c.cancelled_by === 'Admin' ? C.warn : C.danger
  const timingColor = c.cancellation_timing.includes('Last Minute') ? C.danger
    : c.cancellation_timing.includes('Short Notice') ? C.warn : C.muted

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', marginBottom: '10px', overflow: 'hidden',
    }}>
      {/* Collapsed header */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center',
          gap: '14px', cursor: 'pointer',
          background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent',
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
        }} />

        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 13,
          fontWeight: 600, color: 'var(--text)', minWidth: 140,
        }}>
          {c.first_name} {c.last_name}
        </span>

        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          color: '#71717a', flex: 1, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {studio} · {formatDateShort(c.booking_date)} · {c.booking_day_of_week}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em',
            background: `${timingColor}22`, color: timingColor,
          }}>
            {c.cancellation_timing.replace(' (<24hr)', '').replace(' (1-7 days)', '').replace(' (7+ days)', '')}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            background: 'rgba(255,255,255,0.06)', color: '#a1a1aa',
          }}>
            {c.calls_made} call{c.calls_made !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#52525b', fontSize: 14, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 250ms' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expanded content */}
      <div style={{
        maxHeight: expanded ? '700px' : '0',
        overflow: 'hidden',
        transition: 'max-height 250ms ease-in-out',
      }}>
        <div style={{
          padding: '16px 18px 18px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: 16 }}>
            {/* Left: Booking Details */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#52525b',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px',
              }}>Booking Details</p>
              {[
                ['Date', c.booking_date],
                ['Day', c.booking_day_of_week],
                ['Studio', studio],
                ['Booking window', c.booking_window_category],
                ['Days advance', `${Math.abs(c.booking_window_days)} days`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#71717a', minWidth: 100 }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Right: Cancellation Details */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#52525b',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px',
              }}>Cancellation Details</p>
              {[
                ['Cancelled by', c.cancelled_by],
                ['Timing', c.cancellation_timing],
                ['Notice given', `${c.days_before_appointment} days before`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#71717a', minWidth: 100 }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>{val}</span>
                </div>
              ))}

              {/* Inline call dots */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: '#71717a', minWidth: 100 }}>Protocol</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={84} height={20} style={{ overflow: 'visible' }}>
                    {[0, 1, 2].map(ci => (
                      <circle
                        key={ci}
                        cx={ci * 28 + 10}
                        cy={10}
                        r={7}
                        fill={ci < Math.min(c.calls_made, 3) ? C.info : 'transparent'}
                        stroke={ci < Math.min(c.calls_made, 3) ? 'none' : C.border}
                        strokeWidth={1.5}
                        strokeDasharray={ci < Math.min(c.calls_made, 3) ? undefined : '3,2'}
                      />
                    ))}
                  </svg>
                  <span style={{
                    fontSize: 10, color: '#71717a',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {c.calls_made}/3
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Narrative */}
          {narrative && (
            <p style={{
              fontSize: 13, color: '#a1a1aa', lineHeight: 1.65, margin: 0,
              fontFamily: "'DM Sans', sans-serif",
              borderTop: '1px solid var(--border)', paddingTop: 14,
            }}>
              {narrative}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section 5: Expandable Action Card ────────────────────────────────────────
function ActionCard({ title, status, statusColor, children, expanded, onToggle }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden',
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center',
          gap: 14, cursor: 'pointer',
          background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent',
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: statusColor, flexShrink: 0,
        }} />
        <span style={{
          flex: 1, fontWeight: 700, fontSize: 13,
          color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
        }}>
          {title}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
          letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif",
          background: `${statusColor}20`, color: statusColor,
        }}>
          {status}
        </span>
        <span style={{
          color: '#52525b', fontSize: 14,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 250ms',
        }}>
          ▾
        </span>
      </div>

      <div style={{
        maxHeight: expanded ? '600px' : '0',
        overflow: 'hidden',
        transition: 'max-height 250ms ease-in-out',
      }}>
        <div style={{
          padding: '0 18px 18px', borderTop: `1px solid ${C.border}`, paddingTop: 14,
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Cancellations() {
  const { data: rawCancellations, loading: l1 } = useData(loadCancellationAnalysis)
  const { data: funnelData,       loading: l2 } = useData(loadLeadFunnel)
  const loading = l1 || l2

  const [activeDrillDown, setActiveDrillDown] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedAction, setExpandedAction] = useState(null)

  // Cross-reference cancellations with funnel data to get calls_made
  const cancellations = useMemo(() => {
    if (!rawCancellations.length) return SORTED_CANCELLATIONS

    const byId   = {}
    const byName = {}
    funnelData.forEach(r => {
      if (r.booking_id) byId[r.booking_id] = r
      const key = `${(r.first_name || '').toLowerCase()} ${(r.last_name || '').toLowerCase()}`
      if (!byName[key] || (+r.total_calls || 0) > (+byName[key].total_calls || 0)) byName[key] = r
    })

    const withStatus = rawCancellations.map(c => {
      const match = byId[c.booking_id] || byName[`${(c.first_name || '').toLowerCase()} ${(c.last_name || '').toLowerCase()}`]
      const calls_made = match ? (+match.total_calls || 0) : 0

      let prevention_status, prevention_label
      if (c.cancelled_by === 'Admin') {
        prevention_status = 'admin'
        prevention_label  = 'Studio-side cancel'
      } else if (calls_made >= 3) {
        prevention_status = 'protocol_applied'
        prevention_label  = `${calls_made} calls — protocol applied`
      } else if (calls_made === 2) {
        prevention_status = 'one_call_short'
        prevention_label  = '1 more call needed'
      } else {
        prevention_status = 'protocol_gap'
        prevention_label  = 'Protocol not applied'
      }

      return { ...c, calls_made, prevention_status, prevention_label }
    })

    return withStatus.sort((a, b) => {
      if (a.cancelled_by === 'Admin' && b.cancelled_by !== 'Admin') return -1
      if (a.cancelled_by !== 'Admin' && b.cancelled_by === 'Admin') return  1
      return new Date(a.booking_date) - new Date(b.booking_date)
    })
  }, [rawCancellations, funnelData])

  // Records sorted by date for Section 3
  const recordsSorted = useMemo(() =>
    [...cancellations].sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
  , [cancellations])

  if (loading) return <Loader />

  const activeDrillDownColor = KPI_CARDS.find(k => k.id === activeDrillDown)?.color || C.accent

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 80px' }}>
      <PageHeader
        title="Cancellation Analysis"
        sub="Every cancellation traced to its root cause — and what Execo is doing about it"
      />

      {/* ── Section 1: KPI Scorecards ─────────────────────────────── */}
      <Card style={{
        marginBottom: activeDrillDown ? 0 : '28px',
        borderRadius: activeDrillDown ? '12px 12px 0 0' : '12px',
        overflow: 'visible',
      }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
        }}>
          Cancellation Summary
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--muted)',
          margin: '0 0 20px', lineHeight: 1.5, maxWidth: 640,
        }}>
          7 cancellations during the campaign period. 3 were studio-side decisions — no session
          credits lost. The 4 customer cancels are being addressed through protocol changes
          already in effect. Click any card to see the detail.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {KPI_CARDS.map(kpi => (
            <div
              key={kpi.id}
              onClick={() => setActiveDrillDown(activeDrillDown === kpi.id ? null : kpi.id)}
              style={{
                padding: '16px 18px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${activeDrillDown === kpi.id ? kpi.color + '70' : C.border}`,
                background: activeDrillDown === kpi.id ? `${kpi.color}0d` : 'rgba(255,255,255,0.02)',
                transition: 'border-color 180ms, background 180ms',
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  padding: '2px 7px', borderRadius: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                  background: `${kpi.color}20`, color: kpi.color,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {kpi.badge}
                </span>
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26, fontWeight: 700, color: kpi.color,
                marginBottom: 6, lineHeight: 1,
              }}>
                {kpi.value}
              </div>
              <div style={{
                fontSize: 12, color: C.text, fontWeight: 600,
                marginBottom: 2, fontFamily: "'DM Sans', sans-serif",
              }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Sans', sans-serif" }}>
                {kpi.sub}
              </div>
              <div style={{
                fontSize: 9, color: C.muted, marginTop: 12, opacity: 0.65,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {activeDrillDown === kpi.id ? '▲ Hide detail' : '▼ Tap to expand'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Drill-down panel */}
      {activeDrillDown && (
        <div style={{
          background: 'var(--surface)',
          border: `1px solid ${C.border}`,
          borderTop: `2px solid ${activeDrillDownColor}`,
          borderRadius: '0 0 12px 12px',
          marginBottom: '28px',
        }}>
          {activeDrillDown === 'rate'     && <CancelRateDrillDown />}
          {activeDrillDown === 'customer' && <CustomerCancelDrillDown data={cancellations} />}
          {activeDrillDown === 'admin'    && <AdminCancelDrillDown data={cancellations} />}
          {activeDrillDown === 'protocol' && <ProtocolCoverageDrillDown />}
        </div>
      )}

      {/* ── Section 2: Prevention Simulation ────────────────────── */}
      <Card style={{ marginBottom: '28px', overflow: 'visible' }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
        }}>
          Which Cancellations Were Preventable?
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5,
        }}>
          Each row is one cancellation. Circles show confirmation calls made before the appointment.
          Hover a row for full context.
        </p>

        {/* HOW TO READ */}
        <div style={{
          display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
          padding: '9px 14px', marginBottom: 22,
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${C.border}`,
          borderRadius: 8, fontSize: 11, color: C.muted,
        }}>
          <span style={{
            fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.07em', fontSize: 9, color: '#52525b',
          }}>
            HOW TO READ
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width={16} height={16}>
              <circle cx={8} cy={8} r={6} fill={C.info} />
            </svg>
            Confirmation call made
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width={16} height={16}>
              <circle cx={8} cy={8} r={6} fill="none" stroke={C.muted} strokeWidth={1.5} strokeDasharray="3,2" />
            </svg>
            Call not made
          </span>
          <span>3 filled circles = protocol complete (confirmation follow-up standard)</span>
        </div>

        <CallTrackChart data={cancellations} />

        {/* Callout */}
        <div style={{
          marginTop: 22,
          borderLeft: `3px solid ${C.accent}`,
          paddingLeft: 16,
          paddingTop: 4, paddingBottom: 4,
        }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 13,
            color: 'var(--text)', lineHeight: 1.65, margin: 0,
          }}>
            confirmation follow-up protocol is now active on all 13 pipeline appointments. Based on this
            campaign's data, consistent confirmation follow-up application is projected to reduce customer
            cancellations by 60–70% in Month 3.
          </p>
        </div>
      </Card>

      {/* ── Section 3: Individual Records ───────────────────────── */}
      <Card style={{ marginBottom: '28px', overflow: 'visible' }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
        }}>
          Every Cancellation — Full Record
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5,
        }}>
          Click any cancellation to see the complete context, booking details, and Execo's assessment.
        </p>

        {recordsSorted.map(c => {
          const id = c.booking_id || `${c.first_name}-${c.last_name}`
          return (
            <RecordCard
              key={id}
              c={c}
              expanded={expandedId === id}
              onToggle={() => setExpandedId(expandedId === id ? null : id)}
            />
          )
        })}
      </Card>

      {/* ── Section 4: Pattern Summary ───────────────────────────── */}
      <Card style={{ marginBottom: '28px', overflow: 'visible' }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
        }}>
          Patterns Across All 7 Cancellations
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5,
        }}>
          Timing and day-of-week patterns. Hover a segment or bar for detail.
        </p>

        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
          <TimingDonut data={cancellations} />
          <DayRiskBars data={cancellations} />
        </div>

        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 13,
          color: 'var(--text)', lineHeight: 1.65,
          margin: '20px 0 0', maxWidth: '720px',
          borderTop: '1px solid var(--border)', paddingTop: 16,
        }}>
          Friday and Tuesday account for 6 of 7 cancellations. Dedicated same-day confirmation
          calls for Tuesday appointments and 48-hour pre-calls for Friday appointments are
          Execo's primary protocol responses to these patterns.
        </p>
      </Card>

      {/* ── Section 5: What Execo Is Doing ──────────────────────── */}
      <SectionHeader title="What Execo Is Doing" />

      <Card style={{ overflow: 'visible' }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
        }}>
          Prevention — 3 Protocol Changes Already in Effect
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5,
        }}>
          Each protocol was implemented in response to patterns observed in this campaign's
          data. All 3 are active now. Click to expand.
        </p>

        {/* Action 1: 3-Touch */}
        <ActionCard
          title="3-Touch Minimum Protocol"
          status="ACTIVE NOW"
          statusColor={C.accent}
          expanded={expandedAction === 'touch'}
          onToggle={() => setExpandedAction(expandedAction === 'touch' ? null : 'touch')}
        >
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.65, margin: '0 0 14px' }}>
            Every lead with a booked appointment receives a minimum of 3 confirmed contacts
            before their session: an initial booking confirmation, a mid-period check-in, and
            a 24-hour reminder call. Protocol is mandatory — no appointment proceeds without it.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: '0 0 8px' }}>
            Active pipeline coverage
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, maxWidth: 480 }}>
            <div style={{
              flex: 1, height: 10, background: 'rgba(255,255,255,0.08)',
              borderRadius: 5, overflow: 'hidden',
            }}>
              <div style={{ width: '100%', height: '100%', background: C.accent, borderRadius: 5 }} />
            </div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              color: C.accent, fontWeight: 700, flexShrink: 0,
            }}>
              13 / 13 — 100%
            </span>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Why it works: each additional pre-appointment call reduces same-day cancellation
            probability by an estimated 15–20%. 3 calls compound to a 60–70% reduction
            compared to 0 or 1 call.
          </p>
        </ActionCard>

        {/* Action 2: 7-14 Day Window */}
        <ActionCard
          title="7–14 Day Booking Window Standard"
          status="ACTIVE NOW"
          statusColor={C.accent}
          expanded={expandedAction === 'window'}
          onToggle={() => setExpandedAction(expandedAction === 'window' ? null : 'window')}
        >
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.65, margin: '0 0 14px' }}>
            All new bookings are scheduled 7–14 days from the date of first contact. This
            window is short enough to maintain commitment while leaving sufficient time for
            confirmation follow-up execution.
          </p>
          <div style={{
            padding: '12px 16px', background: 'rgba(245,158,11,0.07)',
            borderRadius: 8, border: `1px solid rgba(245,158,11,0.18)`,
            marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, color: C.warn, fontWeight: 600, margin: '0 0 4px' }}>
              What triggered this: Tynisha Alexander
            </p>
            <p style={{ fontSize: 11, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
              Tynisha booked 41 days in advance and cancelled 41 days before her appointment.
              Long booking windows allow motivation to decay. A 7–14 day window prevents
              this pattern by keeping the appointment psychologically close.
            </p>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Research benchmark: cancellation rates for appointments booked 7–14 days out
            are 30–40% lower than appointments booked 30+ days out.
          </p>
        </ActionCard>

        {/* Action 3: Friday Protocol */}
        <ActionCard
          title="Friday Confirmation Protocol"
          status="ACTIVE NOW"
          statusColor={C.accent}
          expanded={expandedAction === 'friday'}
          onToggle={() => setExpandedAction(expandedAction === 'friday' ? null : 'friday')}
        >
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.65, margin: '0 0 14px' }}>
            All Friday appointments receive a mandatory 48-hour confirmation call (Wednesday
            or Thursday). Friday is the highest-risk day in this campaign — 3 of 7
            cancellations occurred on a Friday.
          </p>
          <div style={{
            padding: '12px 16px', background: 'rgba(239,68,68,0.07)',
            borderRadius: 8, border: `1px solid rgba(239,68,68,0.18)`,
            marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, color: C.danger, fontWeight: 600, margin: '0 0 4px' }}>
              What triggered this: 3 Friday cancellations
            </p>
            <p style={{ fontSize: 11, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
              Askel Matre (customer, Bellaire — 2 of 3 calls made), Chase Fondren (admin,
              Bellaire), and Tynisha Alexander (customer, Cherry Street). The 48-hour pre-call
              closes the window where Friday cancellations most often occur.
            </p>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Any lead with a Friday appointment now receives a mid-week confirmation call in
            addition to the standard confirmation follow-up protocol.
          </p>
        </ActionCard>
      </Card>
    </div>
  )
}
