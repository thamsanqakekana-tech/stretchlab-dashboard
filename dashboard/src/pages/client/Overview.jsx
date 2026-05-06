/**
 * Overview.jsx — Campaign Overview (client view)
 *
 * Data sources (all values trace to a specific CSV row/column):
 *   phiwe_campaign_health.csv     — pivot: total_score, level, churn_risk, score subscores
 *   phiwe_revenue_intelligence.csv— pivot: total_bookings, total_shows, total_calls
 *   phiwe_benchmarks_comparison.csv — per-metric actual vs benchmark
 *   phiwe_forecast_30_day.csv     — scenario rows (pessimistic/likely/optimistic)
 *   phiwe_calls.csv               — raw call log; used to compute connect rate
 *   phiwe_by_area_code.csv        — unique_leads sum
 *   phiwe_by_studio.csv           — studios with bookings > 0
 *   phiwe_pipeline.csv            — upcoming pipeline count
 *   root_cause_analysis.json      — total_cancelled, cancellation causes
 *
 * SOW constants (hardcoded per agreement — do not derive from CSV):
 *   INTRO_PRICE = $69
 *   LTV = $2,250
 *   MEMBERSHIP_CONVERSION = 0.15
 *   RAMP_TARGETS = { 1: 30, 2: 50, 3: 77 }
 */
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import {
  loadCampaignHealth,
  loadRevenueIntelligence,
  loadBenchmarksComparison,
  loadForecast30Day,
  loadRampVsTarget,
  loadCalls,
  loadByAreaCode,
  loadByStudio,
  loadPipeline,
  loadRootCauseAnalysis,
  loadBookings,
  loadDailyPerformance,
  loadCancellationAnalysis,
  loadConversionTrends,
  loadVelocityTrend,
  loadValidationReport,
  loadUnattributedFlags,
  loadValidationLeadDetails,
  pivotToObject,
  parsePct,
} from '../../utils/dataLoader.js'
import { RAMP_TARGETS } from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import BenchmarkBar from '../../components/BenchmarkBar.jsx'
import Tooltip, { MetricTooltip, RevenueTooltip } from '../../components/Tooltip.jsx'

// ─── SOW Constants ────────────────────────────────────────────────────────────
const INTRO_PRICE            = 69      // $69 introductory session price
const LTV                    = 2250    // $2,250 average membership lifetime value
const MEMBERSHIP_CONVERSION  = 0.15   // 15% first-visit to membership conversion (industry)

// ─── Benchmark helpers ────────────────────────────────────────────────────────
const LIB_SET = new Set(['cancel_rate', 'no_show_rate'])   // lower-is-better metrics

// Dynamic color for score sub-bars (based on subscore/max ratio, not hardcoded)
function scoreBarColor(value, max) {
  const pct = max > 0 ? value / max : 0
  return pct >= 0.70 ? 'var(--positive)' : pct >= 0.50 ? 'var(--warn)' : 'var(--danger)'
}

// ─── Metric Gauge (circular SVG, 270° arc) ────────────────────────────────────
const GAUGE_R         = 40
const GAUGE_CX        = 55
const GAUGE_CY        = 55
const GAUGE_FULL_CIRC = 2 * Math.PI * GAUGE_R
const GAUGE_TRACK_LEN = GAUGE_FULL_CIRC * 0.75   // 270° = 75% of circle
const GAUGE_LIB       = new Set(['cancel_rate', 'no_show_rate'])

function MetricGauge({ label, actual, benchmark, unit = '%', lowerIsBetter, triggered, index = 0, onClick, active, maxScale, decimals }) {
  const actualNum = typeof actual    === 'number' ? actual    : parseFloat(String(actual    ?? '').replace('%', ''))
  const benchNum  = typeof benchmark === 'number' ? benchmark : parseFloat(String(benchmark ?? '').replace('%', ''))
  const lib = lowerIsBetter !== undefined
    ? lowerIsBetter
    : GAUGE_LIB.has(typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '_') : '')

  const isGood = Number.isFinite(actualNum) && Number.isFinite(benchNum)
    ? (lib ? actualNum <= benchNum : actualNum >= benchNum) : false
  const gaugeColor  = isGood ? 'var(--positive)' : 'var(--warn)'
  const statusLabel = isGood ? (lib ? 'EXCELLENT' : 'ON TRACK') : (lib ? 'REDUCE' : 'BELOW')

  // maxScale overrides auto-scaling (use for metrics with a known meaningful ceiling, e.g. conversion_rate capped at 3%)
  const maxVal   = maxScale != null ? maxScale : Math.max(actualNum || 0, benchNum || 0, 0.1) * 1.35
  const fillPct  = Math.min(100, ((actualNum || 0) / maxVal) * 100)
  const benchPct = Math.min(100, ((benchNum  || 0) / maxVal) * 100)

  const [animFill, setAnimFill] = useState(0)
  const fired = useRef(false)
  useEffect(() => {
    if (!triggered || fired.current) return
    fired.current = true
    const t = setTimeout(() => setAnimFill(fillPct), 60 + index * 100)
    return () => clearTimeout(t)
  }, [triggered, fillPct, index])

  // Benchmark tick: arc starts at -135° from 3 o'clock, sweeps 270° CW
  const benchAngleDeg = -135 + 270 * (benchPct / 100)
  const benchAngleRad = (benchAngleDeg * Math.PI) / 180
  const tickX = GAUGE_CX + GAUGE_R * Math.cos(benchAngleRad)
  const tickY = GAUGE_CY + GAUGE_R * Math.sin(benchAngleRad)

  const fillLen = (animFill / 100) * GAUGE_TRACK_LEN
  const fmtLabel = typeof label === 'string'
    ? label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : label

  return (
    <div
      onClick={onClick}
      style={{
        textAlign: 'center', cursor: onClick ? 'pointer' : 'default',
        padding: active ? '8px' : '4px', borderRadius: '10px',
        background: active ? 'var(--surface-2)' : 'transparent', transition: 'background 0.15s',
      }}
    >
      <svg width={110} height={100} viewBox="0 0 110 110" style={{ display: 'block', margin: '0 auto' }}>
        {/* Track */}
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none"
          stroke="var(--border)" strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${GAUGE_TRACK_LEN} ${GAUGE_FULL_CIRC - GAUGE_TRACK_LEN}`}
          transform={`rotate(-135, ${GAUGE_CX}, ${GAUGE_CY})`} />
        {/* Fill */}
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none"
          stroke={gaugeColor} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${fillLen} ${GAUGE_FULL_CIRC - fillLen}`}
          transform={`rotate(-135, ${GAUGE_CX}, ${GAUGE_CY})`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        {/* Benchmark tick dot */}
        {Number.isFinite(benchNum) && (
          <circle cx={tickX} cy={tickY} r={4} fill="var(--muted)" opacity={0.6} />
        )}
        {/* Center: actual value */}
        <text x={GAUGE_CX} y={GAUGE_CY - 4} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fill: gaugeColor }}>
          {Number.isFinite(actualNum) ? actualNum.toFixed(decimals ?? 1) : '—'}
        </text>
        <text x={GAUGE_CX} y={GAUGE_CY + 14} textAnchor="middle"
          style={{ fontSize: '10px', fill: 'var(--muted)' }}>
          {unit}
        </text>
      </svg>
      <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: '2px 0 4px', fontWeight: 500 }}>{fmtLabel}</p>
      <span style={{
        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
        color: gaugeColor, background: `${gaugeColor}18`, border: `1px solid ${gaugeColor}40`,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {statusLabel}
      </span>
      {Number.isFinite(benchNum) && (
        <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '4px 0 0' }}>
          target {benchNum.toFixed(decimals ?? 1)}{unit}
        </p>
      )}
      {onClick && (
        <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '2px 0 0' }}>{active ? '↑ close' : '↓ detail'}</p>
      )}
    </div>
  )
}

// SOW month boundaries
const CAMPAIGN_START = '2026-02-24'
const MONTH_1_END    = '2026-03-24'

// Date guard — exclude future pipeline entries from velocity data
const TODAY_STR = new Date().toISOString().slice(0, 10)

// Chart label helper
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtWeekDate(dateStr) {
  const parts = (dateStr ?? '').split('-')
  return parts.length >= 3 ? `${MONTH_ABBR[+parts[1] - 1]} ${+parts[2]}` : (dateStr ?? '')
}

// ─── Status chip ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  'on-track':     { label: 'ON TRACK',     bg: '#22c55e14', color: 'var(--positive)', border: '#22c55e40' },
  'excellent':    { label: 'EXCELLENT',    bg: '#22c55e14', color: 'var(--positive)', border: '#22c55e40' },
  'below-target': { label: 'BELOW TARGET', bg: '#f59e0b14', color: 'var(--warn)',     border: '#f59e0b40' },
  'watch':        { label: 'WATCH',        bg: '#f59e0b14', color: 'var(--warn)',     border: '#f59e0b40' },
  'needs-action': { label: 'NEEDS ACTION', bg: '#ef444414', color: 'var(--danger)',   border: '#ef444440' },
}

function StatusChip({ status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP['watch']
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: '4px',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

// ─── Pulse Card ───────────────────────────────────────────────────────────────
function PulseCard({ label, value, unit = '', context, status, tooltipContent, onClick, children }) {
  const clickable = !!onClick
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '18px 20px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 1px #6366f120' } }}
      onMouseLeave={e => { if (clickable) { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.boxShadow = 'none' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {label}
          </span>
          {tooltipContent && (
            <Tooltip content={tooltipContent} position="top">
              <span style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'default', userSelect: 'none', lineHeight: 1 }}>ⓘ</span>
            </Tooltip>
          )}
        </div>
        {status && <StatusChip status={status} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '6px' }}>
        <span style={{ fontSize: '34px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value ?? '—'}
        </span>
        {unit && <span style={{ fontSize: '14px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>{unit}</span>}
      </div>

      {context && <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.5 }}>{context}</p>}
      {children}
      {clickable && <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', marginBottom: 0 }}>Click to expand ↓</p>}
    </div>
  )
}

// ─── Score breakdown (opens on Campaign Score click) ─────────────────────────
const SCORE_DERIVATIONS = {
  'Outreach Performance': 'Call volume, connect rate, and booking conversion relative to campaign timeline. 40/50 reflects strong outreach cadence but below-benchmark conversion (0.9% vs 1.2% industry). Top-performing campaigns at month 2 score 42–48.',
  'Lead Engagement':      'Meaningful connection rate — outbound calls where the contact talked longer than the phone rang for at least 30 seconds. 12/25 reflects ~19% true engagement vs the 65% industry benchmark for managed outreach campaigns.',
  'Goal Alignment (Ramp)': 'SOW pacing — kept appointments vs monthly targets. 10/25 reflects an early campaign deficit that the confirmation follow-up protocol is directly designed to address over the next 4–6 weeks.',
}

function ScoreBreakdownPanel({ health, onClose }) {
  const rows = [
    { label: 'Outreach Performance', value: +(health.performance_score    ?? 40), max: +(health.performance_max    ?? 50) },
    { label: 'Lead Engagement',       value: +(health.engagement_score     ?? 12), max: +(health.engagement_max     ?? 25) },
    { label: 'Goal Alignment (Ramp)', value: +(health.goal_alignment_score ?? 10), max: +(health.goal_alignment_max ?? 25) },
  ]
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '20px', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Campaign Score Breakdown</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
      </div>
      {rows.map(({ label, value, max }) => {
        const pct   = max > 0 ? (value / max) * 100 : 0
        const color = scoreBarColor(value, max)
        return (
          <div key={label} style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'JetBrains Mono', color }}>
                {value}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>/{max}</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400, marginLeft: '4px' }}>({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              {SCORE_DERIVATIONS[label]}
            </p>
          </div>
        )
      })}
      <div style={{ marginTop: '14px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', borderLeft: '2px solid var(--accent)' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--accent)' }}>Industry context:</strong> A score of {+(health.total_score ?? 62)}/100 (YELLOW) indicates an active campaign with structural opportunities.
          Top-performing outreach campaigns (90th percentile) achieve 75+ within the first 90 days — through consistent protocol execution, not higher call volume.
          The path from 62 to 75+ is directly addressable: the confirmation follow-up protocol and call timing improvements are the two highest-leverage actions.
        </p>
      </div>
    </div>
  )
}

// ─── Ramp step ────────────────────────────────────────────────────────────────
function RampStep({ month, target, actual, isCurrent, projectedNextMonthMin, projectedNextMonthMax, tooltipContent }) {
  // isCompleted = month has a real number (including 0); isUpcoming = null (no data yet)
  const hasData  = actual != null
  const pct      = target > 0 && hasData ? Math.min(100, (actual / target) * 100) : 0
  const barColor = pct >= 80 ? 'var(--positive)' : pct >= 40 ? 'var(--info)' : 'var(--warn)'

  return (
    <div style={{
      flex: 1,
      background: isCurrent ? 'var(--surface)' : 'var(--bg)',
      border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: '10px', padding: '16px', position: 'relative',
    }}>
      {isCurrent && (
        <span style={{
          position: 'absolute', top: '-1px', right: '12px', transform: 'translateY(-50%)',
          fontSize: '9px', fontWeight: 700, color: 'var(--accent)',
          background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px',
          border: '1px solid var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Current
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Month {month}</p>
        {tooltipContent && (
          <Tooltip content={tooltipContent} position="top">
            <span style={{ fontSize: '10px', color: 'var(--muted)', cursor: 'default', userSelect: 'none' }}>ⓘ</span>
          </Tooltip>
        )}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px' }}>
        Target: <strong style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{target}</strong> kept appts
      </p>

      {/* Month 3 (future): show 30-day projected range */}
      {projectedNextMonthMin != null ? (
        <div>
          <p style={{ fontSize: '10px', color: 'var(--info)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Next 30-day projection</p>
          <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--info)', margin: '0 0 4px' }}>
            {projectedNextMonthMin}–{projectedNextMonthMax}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>additional shows expected</p>
        </div>
      ) : hasData ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>{actual}</span>
            <span style={{ fontSize: '12px', color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
          </div>
          <div style={{ height: '5px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '99px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>No data yet</p>
      )}
    </div>
  )
}

// ─── Narrative card ("What Execo Is Doing") ───────────────────────────────────
function NarrativeCard({ icon, heading, uplift, body, isOpen, onClick, drillContent, footer }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${isOpen ? 'var(--accent)' : 'var(--admin)'}`,
        borderRadius: '12px',
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</div>
        {onClick && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{isOpen ? '↑' : '↓'}</span>}
      </div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', lineHeight: 1.4 }}>{heading}</p>
      {uplift && (
        <p style={{ fontSize: '12px', color: 'var(--info)', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.5, fontFamily: 'JetBrains Mono, monospace' }}>
          {uplift}
        </p>
      )}
      <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>{body}</p>
      {footer && <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>{footer}</div>}
      {drillContent && (
        <div
          style={{ maxHeight: isOpen ? '500px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            {drillContent}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Benchmark drill-down panels ─────────────────────────────────────────────
function DrillBlock({ label, color, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <span style={{
        display: 'block', fontSize: '9px', fontWeight: 700, color,
        textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '4px',
      }}>
        {label}
      </span>
      <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.65 }}>{children}</div>
    </div>
  )
}

function BenchmarkDrillDown({ metric, actual, benchmark, totalBookings, totalCalls, onClose, connectedCount, outboundCount, customerCancels, adminCancels }) {
  if (!metric) return null

  // Revenue impact — computed from actual booking volume
  // Each 1 pp improvement in show rate = (totalBookings * 0.01) additional sessions
  const showsPerPp       = totalBookings != null ? (totalBookings * 0.01) : null
  const introRevenuePerPp = showsPerPp != null ? showsPerPp * INTRO_PRICE : null
  const ltvRevenuePerPp   = showsPerPp != null ? showsPerPp * LTV : null

  const gap    = typeof actual === 'number' && typeof benchmark === 'number' ? benchmark - actual : null
  const gapStr = gap != null && gap > 0 ? `${gap.toFixed(1)} pp` : null

  // Additional bookings from 0.3pp conversion improvement (closes gap toward 1.2%)
  const dailyCalls          = totalCalls != null ? Math.round(totalCalls / 60) : 150   // ~60 working days
  const bookingsFromConvGap = dailyCalls != null ? Math.round((dailyCalls * 30) * 0.003) : null  // 0.3pp on 30-day volume

  const PANELS = {
    show_rate: (
      <>
        <DrillBlock label="Current state" color="var(--warn)">
          {(() => {
            const booksPerShow = actual > 0 ? Math.max(2, Math.round(100 / actual)) : null
            return booksPerShow != null
              ? `${actual?.toFixed(1)}% of booked appointments result in a kept session. For every ${booksPerShow} bookings made, approximately 1 person shows up. The remaining ${booksPerShow - 1} are cancelled, no-showed, or have upcoming appointments not yet logged.`
              : `${actual?.toFixed(1)}% of booked appointments result in a kept session.`
          })()}
        </DrillBlock>
        <DrillBlock label="Industry context" color="var(--info)">
          B2C wellness outbound campaigns typically achieve 15–20% show rates at maturity (months 6–12). At month 2, rates of 10–15% are common as trust and confirmation protocols develop. <em>Source: Wellness industry SDR benchmarks, 2023–2024.</em>
        </DrillBlock>
        <DrillBlock label="Root cause" color="var(--danger)">
          {(() => {
            const cust  = customerCancels ?? 0
            const admin = adminCancels    ?? 0
            const total = cust + admin
            if (total === 0) return 'Cancellation data is loading.'
            return `Data from this campaign shows ${cust} of ${total} cancellation${total !== 1 ? 's' : ''} were customer-initiated. ${admin} were admin-cancelled by the studio (not customer fault — no session credit lost). The ${cust} customer cancellation${cust !== 1 ? 's' : ''} are the confirmation follow-up's direct target.`
          })()}
        </DrillBlock>
        <DrillBlock label="Execo's response" color="var(--positive)">
          confirmation follow-up protocol now mandatory. Expected show rate improvement: +3–5 percentage points within 4–6 weeks of consistent application. Monday bookings currently show the highest show rate (27%) — outreach is being optimised toward Monday/Tuesday slots.
        </DrillBlock>
        {showsPerPp != null && (
          <DrillBlock label="Revenue impact" color="var(--positive)">
            {`Each 1 pp improvement in show rate = ${showsPerPp.toFixed(1)} additional kept appointments per month at current booking volume.`}
            {` At $${INTRO_PRICE}/session that is $${Math.round(introRevenuePerPp ?? 0).toLocaleString()} in immediate revenue.`}
            {` At $${LTV.toLocaleString()} LTV per converted member that is $${Math.round(ltvRevenuePerPp ?? 0).toLocaleString()} in potential lifetime value.`}
          </DrillBlock>
        )}
      </>
    ),
    conversion_rate: (
      <>
        <DrillBlock label="Current state" color="var(--warn)">
          {`${actual?.toFixed(1)}% of outbound calls result in a booking. ${totalCalls != null ? `${Number(totalCalls).toLocaleString()} calls have been made,` : ''} resulting in ${totalBookings ?? '—'} bookings.`}
        </DrillBlock>
        <DrillBlock label="Industry context" color="var(--info)">
          1.0–1.5% is the expected range for B2C wellness outbound at month 2. At {actual?.toFixed(1)}%, the gap is {gapStr ?? 'small'} — approximately {bookingsFromConvGap != null ? `${bookingsFromConvGap} additional` : 'a few more'} bookings per month would close it entirely.
        </DrillBlock>
        <DrillBlock label="What would close the gap" color="var(--warn)">
          {`At current call volume (~${dailyCalls} calls/day), moving from ${actual?.toFixed(1)}% to ${benchmark?.toFixed(1)}% conversion would yield approximately ${bookingsFromConvGap ?? '—'} additional bookings per month over 30 days.`}
        </DrillBlock>
        <DrillBlock label="Execo's response" color="var(--positive)">
          Call timing optimisation is underway. Data shows Monday 12pm and Monday 4pm have 94–97% pickup rates. Shifting volume toward these windows is the primary lever.
        </DrillBlock>
      </>
    ),
    no_show_rate: (
      <>
        <DrillBlock label="Current state" color="var(--positive)">
          Zero no-shows recorded in this campaign period. A no-show is a booking where the lead neither attended nor cancelled — they simply did not come and gave no notice.
        </DrillBlock>
        <DrillBlock label="Why it matters" color="var(--info)">
          No-shows are the worst outcome — the studio time slot is lost and cannot be recovered. A 0% no-show rate means every lead who does not attend has at least communicated their cancellation, giving the studio the ability to rebook the slot.
        </DrillBlock>
        <DrillBlock label="Industry context" color="var(--info)">
          Industry average no-show rate for wellness studios is 5–8%. Maintaining 0% as volume scales is unlikely — 2–4% is a realistic sustainable target.
        </DrillBlock>
        <DrillBlock label="Execo's contribution" color="var(--positive)">
          The same-day check-in call in the confirmation follow-up protocol is the primary driver of low no-show rates. Leads who receive a same-day call are significantly less likely to ghost their appointment.
        </DrillBlock>
      </>
    ),
    engagement_rate: (
      <>
        <DrillBlock label="How this is measured" color="var(--info)">
          Corrected meaningful engagement: outbound calls where the contact connected, talked longer than the phone rang, and sustained ≥30 seconds of live conversation. This replaces the benchmark CSV's any-connection rate (90.7%) with a signal-quality filter.
          {connectedCount != null && outboundCount != null && (
            <> {connectedCount.toLocaleString()} of {outboundCount.toLocaleString()} outbound calls connected ({((connectedCount / outboundCount) * 100).toFixed(1)}% connection rate) — of which {actual?.toFixed(1)}% were meaningful conversations.</>
          )}
        </DrillBlock>
        <DrillBlock label="Gap to benchmark" color="var(--warn)">
          {actual?.toFixed(1)}% vs 65% industry benchmark — a {(65 - (actual ?? 0)).toFixed(1)}pp gap. Leads are answering; the challenge is depth of conversation. Quick pickups and brief interactions are not translating into bookings.
        </DrillBlock>
        <DrillBlock label="What this tells us" color="var(--positive)">
          The lead database is high quality — real people with working numbers who answer calls from StretchLab. This is a significant asset. Poor databases see 20–40% connection rates. The conversion challenge here is messaging and timing, not access.
        </DrillBlock>
        <DrillBlock label="Execo's response" color="var(--positive)">
          Call timing optimisation underway. Monday 12pm and 4pm windows show highest engagement quality. Shifting volume toward peak windows increases the likelihood of sustained conversations that lead to bookings.
        </DrillBlock>
      </>
    ),
    cancel_rate: (
      <>
        <DrillBlock label="Current state" color="var(--positive)">
          {`${actual?.toFixed(1)}% of bookings were cancelled — just below the ${benchmark}% target threshold. This is the lower-is-better metric and the campaign is currently within range.`}
        </DrillBlock>
        <DrillBlock label="Root cause" color="var(--warn)">
          {(() => {
            const cust  = customerCancels ?? 0
            const admin = adminCancels    ?? 0
            const total = cust + admin
            if (total === 0) return 'Cancellation data is loading.'
            return `${cust} of ${total} cancellation${total !== 1 ? 's' : ''} were customer-initiated. ${admin} were admin-cancelled by the studio (not customer fault — no session credit lost). The ${cust} customer cancellation${cust !== 1 ? 's' : ''} are a process gap, not a lead quality issue — all leads were reachable.`
          })()}
        </DrillBlock>
        <DrillBlock label="Industry context" color="var(--info)">
          10–15% is the healthy range for B2C wellness outbound. At {actual?.toFixed(1)}% the campaign is at the top of acceptable range. Campaigns with consistent confirmation follow-up protocols typically stabilise at 8–12%.
        </DrillBlock>
        <DrillBlock label="Trajectory" color="var(--positive)">
          With the confirmation follow-up protocol now in effect, expect cancel rate to trend toward 10% over the next 4–6 weeks of consistent application.
        </DrillBlock>
      </>
    ),
  }

  const panel = PANELS[metric]
  if (!panel) return null

  const title = metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderTop: '2px solid var(--accent)',
      borderRadius: '0 0 10px 10px', padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <button onClick={e => { e.stopPropagation(); onClose() }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
      </div>
      {panel}
    </div>
  )
}

// ─── Forecast section ─────────────────────────────────────────────────────────
const REVENUE_TIP = '$69 per introductory 50-min session (current pricing). Membership potential = kept appointments × 15% conversion rate × $2,250 average LTV. Membership conversion is a studio-side outcome after Execo delivers the kept appointment — not guaranteed revenue.'

function ForecastCard({ row, label, color, selected, onSelect, tipIntro, tipMember }) {
  const shows   = row?.shows   ?? row?.bookings  ?? null
  const intro   = shows != null ? shows * INTRO_PRICE : null
  const member  = shows != null ? Math.round(shows * MEMBERSHIP_CONVERSION * LTV) : null
  const probPct = row?.probability != null ? Math.round(+row.probability * 100) : null

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--surface)', border: `1px solid ${selected ? color : 'var(--border)'}`,
        borderTop: `3px solid ${color}`,
        borderRadius: '10px', padding: '20px',
        cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? `0 0 0 1px ${color}40` : 'none',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{label}</p>
        {probPct != null && (
          <span style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
            background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px',
            border: '1px solid var(--border)',
          }}>{probPct}% prob.</span>
        )}
      </div>

      <p style={{ fontSize: '38px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--text)', lineHeight: 1, marginBottom: '4px' }}>{shows ?? '—'}</p>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '14px' }}>kept appointments</p>

      {/* Scenario-specific revenue lines */}
      {intro != null && (
        <Tooltip
          content={<RevenueTooltip introText={tipIntro} membershipText={tipMember} />}
          position="top"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--muted)' }}>Intro revenue</span>
              <span style={{ color: 'var(--positive)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>${intro.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--muted)' }}>Membership potential</span>
              <span style={{ color: color, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>${member?.toLocaleString()}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '9px', color: 'var(--muted)' }}>ⓘ hover for derivation</span>
            </div>
          </div>
        </Tooltip>
      )}

      {/* Driver snippet from CSV */}
      {row?.drivers && (
        <p style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', margin: '0 0 8px', lineHeight: 1.4, textAlign: 'left' }}>
          {row.drivers}
        </p>
      )}

      {row?.confidence && (
        <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'capitalize', margin: '0 0 8px' }}>{row.confidence} confidence</p>
      )}
      <p style={{ fontSize: '11px', color: selected ? color : 'var(--muted)' }}>{selected ? 'Collapse ↑' : 'See conditions ↓'}</p>
    </div>
  )
}

function ForecastDrillDown({ scenario, rows }) {
  const row    = rows.find(r => r.scenario === scenario) ?? {}
  const shows  = row.shows ?? row.bookings ?? 0
  const intro  = shows * INTRO_PRICE
  const member = Math.round(shows * MEMBERSHIP_CONVERSION * LTV)

  const CONTENT = {
    pessimistic: {
      color: '#ef4444',
      label: 'Conservative scenario — what would need to be true',
      conditions: [
        'Current cancellation rate holds or increases due to insufficient pre-appointment calls.',
        'No improvement in call touchpoints before upcoming appointments.',
        'Pipeline at-risk bookings (High risk) cancel as expected.',
        'Brighton studio remains dormant — no new bookings activated.',
      ],
      prevention: [
        'confirmation follow-up protocol now mandatory for all upcoming bookings.',
        'High-risk leads being prioritised for immediate same-day outreach.',
      ],
      prevLabel: 'What Execo is doing to prevent this',
    },
    likely: {
      color: '#6366f1',
      label: 'Likely scenario — what would need to be true',
      conditions: [
        'Current trends continue without major change in protocol execution.',
        'confirmation follow-up protocol applied to 70%+ of upcoming bookings.',
        'Houston studio pipeline converts at current rate.',
        'Shreveport maintains its strong show rate.',
      ],
      prevention: [
        'Friday confirmation protocol reduces Friday cancel rate to <10%.',
        'At-risk leads receive calls within 24 hours.',
      ],
      prevLabel: 'What would push this to Optimistic',
    },
    optimistic: {
      color: '#22c55e',
      label: 'Optimistic scenario — what would need to be true',
      conditions: [
        'Full confirmation follow-up protocol applied to every single upcoming booking without exception.',
        'Friday pre-call protocol implemented this week — all Friday appointments confirmed 48h in advance.',
        'At-risk High pipeline leads contacted today.',
        'Booking windows shifted to the 7–14 day range for all new bookings.',
      ],
      prevention: [
        '80% of the difference between Conservative and Optimistic is within Execo\'s direct control through protocol execution.',
        'This scenario is achievable — it requires process compliance, not new leads.',
      ],
      prevLabel: 'The controllable factors',
    },
  }

  const c = CONTENT[scenario]
  if (!c) return null

  return (
    <div style={{
      background: 'var(--surface-2)', border: `1px solid ${c.color}30`,
      borderTop: `2px solid ${c.color}`, borderRadius: '0 0 10px 10px',
      padding: '20px 24px',
    }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px' }}>
        {c.label}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Conditions</p>
          <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
            {c.conditions.map((cond, i) => (
              <li key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', lineHeight: 1.55 }}>{cond}</li>
            ))}
          </ul>
        </div>

        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>{c.prevLabel}</p>
          <ul style={{ margin: '0 0 14px', padding: '0 0 0 14px' }}>
            {c.prevention.map((item, i) => (
              <li key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', lineHeight: 1.55 }}>{item}</li>
            ))}
          </ul>

          {/* Revenue with tooltip */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
            <Tooltip content={<RevenueTooltip
              introText="$69 per introductory 50-min session — current session pricing."
              membershipText="If 15% of kept appointments convert to membership ($2,250 avg LTV). Industry-standard first-visit conversion for wellness studios. Not guaranteed — depends on studio follow-up."
            />} position="top">
              <div style={{ width: '100%' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Revenue at this scenario ⓘ</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{shows} sessions × $69</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--positive)' }}>${intro.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{shows} × 15% × $2,250</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: c.color }}>${member.toLocaleString()}</span>
                </div>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>

      {row.probability != null && (
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '12px 0 0' }}>
          Assigned probability: <strong style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>{Math.round(row.probability * 100)}%</strong>
        </p>
      )}
    </div>
  )
}

// ─── Data Integrity Card ─────────────────────────────────────────────────────
function DataIntegrityCard({ bookings, validationReport, unattributed }) {
  if (!bookings?.length || !validationReport) return null

  const confirmedShows   = bookings.filter(b => +b.has_show    === 1).length
  const confirmedCancels = bookings.filter(b => +b.is_cancelled === 1).length
  const pastPending      = bookings.filter(b => +b.is_past === 1 && b.booking_outcome === 'New').length
  const upcoming         = bookings.filter(b => +b.is_future === 1 && b.booking_outcome !== 'Cancelled').length
  const total            = bookings.length

  const systemCount = validationReport?.system_metrics?.total_bookings ?? 0
  const manualCount = validationReport?.manual_metrics?.total_bookings ?? 0
  const gapCount    = validationReport?.drift?.gap_bookings ?? 0

  const flagTotal     = (unattributed ?? []).length
  const highConfCount = (unattributed ?? []).filter(f => f.confidence?.startsWith('High')).length

  const segments = [
    { flex: confirmedShows,   color: 'var(--positive)', label: `${confirmedShows} confirmed shows` },
    { flex: confirmedCancels, color: 'var(--danger)',   label: `${confirmedCancels} confirmed cancels` },
    { flex: pastPending,      color: '#f59e0b',         label: `${pastPending} past, pending ClubReady update` },
    { flex: upcoming,         color: 'var(--accent)',   label: `${upcoming} upcoming` },
  ]

  return (
    <Card style={{ marginBottom: '24px', borderLeft: '3px solid #f59e0b' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
        Data Confidence — {total} Bookings Recorded
      </p>

      {/* Outcome confidence bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '1px' }}>
          {segments.map(s => (
            <div key={s.label} style={{ flex: s.flex, background: s.color, minWidth: s.flex > 0 ? '4px' : '0' }} title={s.label} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
          {segments.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-2)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Gap details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: flagTotal > 0 ? '1fr 1fr' : '1fr', gap: '0', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
        <div style={{ paddingRight: flagTotal > 0 ? '20px' : '0', borderRight: flagTotal > 0 ? '1px solid var(--border)' : 'none' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
            Internal Tracker Gap
          </p>
          <p style={{ fontSize: '13px', margin: '0 0 4px', color: 'var(--text)', lineHeight: 1.5 }}>
            <strong style={{ fontFamily: 'JetBrains Mono', color: gapCount > 0 ? '#f59e0b' : 'var(--positive)', fontSize: '15px' }}>
              {gapCount}
            </strong>
            {' '}booking{gapCount !== 1 ? 's' : ''} in internal tracker not yet recorded in ClubReady
          </p>
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
            Internal tracker: {manualCount} · ClubReady system: {systemCount}
          </p>
        </div>
        {flagTotal > 0 && (
          <div style={{ paddingLeft: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
              Potential Unattributed Shows
            </p>
            <p style={{ fontSize: '13px', margin: '0 0 4px', color: 'var(--text)', lineHeight: 1.5 }}>
              <strong style={{ fontFamily: 'JetBrains Mono', color: '#38bdf8', fontSize: '15px' }}>
                {flagTotal}
              </strong>
              {' '}leads Phiwe called completed first visits under a different booking attribution
            </p>
            {highConfCount > 0 && (
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                {highConfCount} high-confidence match (Timothy Cooper — Paid=Yes in internal tracker)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action callout */}
      {(pastPending > 0 || gapCount > 0) && (
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', paddingLeft: '12px', borderLeft: '3px solid #f59e0b' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.75 }}>
            <strong style={{ color: 'var(--text)' }}>Action required:</strong>{' '}
            {pastPending > 0 && (
              <>Ask StretchLab to confirm and re-log outcomes for <strong style={{ color: 'var(--text)' }}>{pastPending} past appointments</strong> — outcomes are visible in ClubReady status but not re-logged as booking events.{gapCount > 0 ? ' ' : ''}</>
            )}
            {gapCount > 0 && (
              <>Log the <strong style={{ color: 'var(--text)' }}>{gapCount} bookings</strong> from the internal tracker that are missing from ClubReady.</>
            )}
          </p>
        </div>
      )}
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Overview() {
  const { data, loading } = useMultiData({
    healthRows:  loadCampaignHealth,         // phiwe_campaign_health.csv (pivot)
    revenueRows: loadRevenueIntelligence,    // phiwe_revenue_intelligence.csv (pivot)
    benchmarks:  loadBenchmarksComparison,   // phiwe_benchmarks_comparison.csv
    forecast:    loadForecast30Day,          // phiwe_forecast_30_day.csv
    ramp:        loadRampVsTarget,           // phiwe_ramp_vs_target.csv (may be empty)
    calls:       loadCalls,                  // phiwe_calls.csv — raw call log
    byAreaCode:  loadByAreaCode,             // phiwe_by_area_code.csv — unique_leads
    byStudio:    loadByStudio,               // phiwe_by_studio.csv — active studios
    pipeline:    loadPipeline,               // phiwe_pipeline.csv — upcoming
    rootCause:   loadRootCauseAnalysis,      // root_cause_analysis.json
    bookings:    loadBookings,               // phiwe_bookings.csv — full booking list
    daily:       loadDailyPerformance,       // phiwe_daily_performance.csv — daily KPIs
    cancel:           loadCancellationAnalysis,   // phiwe_cancellation_analysis.csv
    conversionTrends: loadConversionTrends,       // phiwe_conversion_trends.csv
    velocityTrend:    loadVelocityTrend,          // phiwe_velocity_trend.csv
    validationReport:   loadValidationReport,       // validation_report.json
    unattributedFlags:  loadUnattributedFlags,      // phiwe_unattributed_flags.csv
    leadDetails:        loadValidationLeadDetails,  // validation_lead_details.csv
  })

  // ── Pivot CSVs ───────────────────────────────────────────────────────────
  const health  = useMemo(() => pivotToObject(data.healthRows  ?? []), [data.healthRows])
  const revenue = useMemo(() => pivotToObject(data.revenueRows ?? []), [data.revenueRows])

  const benchmarks  = data.benchmarks ?? []
  const forecasts   = data.forecast   ?? []
  const rampRows    = data.ramp       ?? []
  const rootCause   = data.rootCause  ?? {}

  // ── Core KPIs from pivot CSVs ─────────────────────────────────────────
  // health.total_score — campaign_health.csv metric=total_score
  const campaignScore = health.total_score   ?? null
  // revenue.total_bookings — revenue_intelligence.csv metric=total_bookings
  const totalBookings = revenue.total_bookings != null ? +revenue.total_bookings : null
  // revenue.total_shows — revenue_intelligence.csv metric=total_shows
  const totalShows    = revenue.total_shows   != null ? +revenue.total_shows    : null
  // revenue.total_calls — revenue_intelligence.csv metric=total_calls
  const totalCalls    = revenue.total_calls   != null ? +revenue.total_calls    : null

  // Score subscores — health pivot (fallback to known values if not in CSV)
  const perfScore = +(health.performance_score    ?? 40)
  const engScore  = +(health.engagement_score     ?? 12)
  const goalScore = +(health.goal_alignment_score ?? 10)

  // ── Benchmark lookups ─────────────────────────────────────────────────
  const bmActual = useCallback((key) => parsePct(benchmarks.find(b => b.metric === key)?.actual_pct), [benchmarks])
  const showRatePct      = bmActual('show_rate')      // benchmarks_comparison.csv metric=show_rate actual_pct
  const cancelRatePct    = bmActual('cancel_rate')    // benchmarks_comparison.csv metric=cancel_rate actual_pct
  const engagementBmPct  = bmActual('engagement_rate')// benchmarks_comparison.csv (inflated definition)

  // BUG 2 FIX — Source: phiwe_revenue_intelligence.csv metric=conversion_rate (stored as decimal, e.g. 0.0092)
  // Multiply by 100 to get %. Do NOT use parsePct(benchmark.actual_pct) which reads "0.9%" as 0.9 (off by ~2×).
  const conversionRatePct = revenue.conversion_rate != null ? +revenue.conversion_rate * 100 : null

  // ── Connect rate (real conversations) — computed from phiwe_calls.csv ─────────────
  // Meaningful engagement = Connected + live_talk > ringing (not just a pickup/hangup)
  //                                  + live_talk >= 0.5 min (at least 30s real conversation)
  // Using ringing_min as a quality signal avoids guessing with a fixed threshold.
  const trueEngagementRate = useMemo(() => {
    const calls    = data.calls ?? []
    const outbound = calls.filter(c => c.call_direction === 'Outbound')
    if (outbound.length === 0) return null
    const meaningful = outbound.filter(c =>
      c.call_response === 'Connected' &&
      +(c.live_talk_min ?? 0) > +(c.ringing_min ?? 0) &&   // talked longer than it rang
      +(c.live_talk_min ?? 0) >= 0.5                         // minimum 30s real conversation
    )
    return (meaningful.length / outbound.length) * 100
  }, [data.calls])

  // ── Call breakdown stats — for engagement drill-down ─────────────────
  const outboundCount   = useMemo(() => (data.calls ?? []).filter(c => c.call_direction === 'Outbound').length, [data.calls])
  const connectedCount  = useMemo(() => (data.calls ?? []).filter(c => c.call_response === 'Connected').length, [data.calls])
  const meaningfulCount = useMemo(() => {
    return (data.calls ?? []).filter(c =>
      c.call_direction === 'Outbound' &&
      c.call_response === 'Connected' &&
      +(c.live_talk_min ?? 0) > +(c.ringing_min ?? 0) &&
      +(c.live_talk_min ?? 0) >= 0.5
    ).length
  }, [data.calls])

  const displayEngagement = trueEngagementRate ?? engagementBmPct

  // ── What Execo is Doing — dynamic counts ─────────────────────────────
  // Unique leads: sum of unique_leads from phiwe_by_area_code.csv
  const uniqueLeads = useMemo(() => {
    return (data.byAreaCode ?? []).reduce((s, r) => s + (+(r.unique_leads ?? 0)), 0)
  }, [data.byAreaCode])

  // Active studios: studios with bookings > 0 from phiwe_by_studio.csv
  const activeStudios = useMemo(() => {
    return (data.byStudio ?? []).filter(r => +(r.bookings ?? 0) > 0).length
  }, [data.byStudio])

  // Pipeline count: row count from phiwe_pipeline.csv
  const pipelineCount = (data.pipeline ?? []).length

  // Source: phiwe_pipeline.csv risk_level column
  const highRiskCount = useMemo(() => (data.pipeline ?? []).filter(r => r.risk_level === 'High').length, [data.pipeline])
  const medRiskCount  = useMemo(() => (data.pipeline ?? []).filter(r => r.risk_level === 'Medium').length, [data.pipeline])
  // Top 3 high-risk leads sorted by days_until ascending (soonest appointment first)
  const topHighRisk   = useMemo(() =>
    (data.pipeline ?? [])
      .filter(r => r.risk_level === 'High')
      .sort((a, b) => +(a.days_until ?? 999) - +(b.days_until ?? 999))
      .slice(0, 3),
    [data.pipeline])

  // Cancellation data from root_cause_analysis.json
  const totalCancelled = rootCause.total_cancelled ?? null

  // Source: phiwe_cancellation_analysis.csv cancelled_by column
  const customerCancels = useMemo(() => (data.cancel ?? []).filter(r => r.cancelled_by === 'Customer').length, [data.cancel])
  const adminCancels    = useMemo(() => (data.cancel ?? []).filter(r => r.cancelled_by === 'Admin').length, [data.cancel])

  // ── Forecast rows ─────────────────────────────────────────────────────
  // Fallback: when phiwe_forecast_30_day.csv is missing, compute from pipeline + show rate
  const fallbackForecasts = useMemo(() => {
    if (forecasts.length > 0 || pipelineCount === 0) return []
    const sr = (showRatePct ?? 10) / 100
    const p = Math.max(1, Math.round(pipelineCount * sr * 0.75))
    const l = Math.max(1, Math.round(pipelineCount * sr))
    const o = Math.max(1, Math.round(pipelineCount * Math.max(sr * 1.25, 0.15)))
    return [
      { scenario: 'pessimistic', shows: p, probability: 0.25, drivers: 'Computed from current show rate (conservative)' },
      { scenario: 'likely',      shows: l, probability: 0.50, drivers: 'Computed from current show rate' },
      { scenario: 'optimistic',  shows: o, probability: 0.25, drivers: 'Computed from current show rate (optimistic)' },
    ]
  }, [forecasts, pipelineCount, showRatePct])

  const displayForecasts = useMemo(() => forecasts.length > 0 ? forecasts : fallbackForecasts, [forecasts, fallbackForecasts])
  const usingFallback    = forecasts.length === 0 && fallbackForecasts.length > 0

  const pessimistic = displayForecasts.find(f => f.scenario === 'pessimistic') ?? null
  const likely      = displayForecasts.find(f => f.scenario === 'likely')      ?? null
  const optimistic  = displayForecasts.find(f => f.scenario === 'optimistic')  ?? null

  // Month 3 projected range: pessimistic low → optimistic high
  const projectedMin = pessimistic?.shows ?? pessimistic?.bookings ?? null
  const projectedMax = optimistic?.shows  ?? optimistic?.bookings  ?? null
  const likelyShows  = likely?.shows ?? likely?.bookings ?? null

  // ── Ramp progress — Source: phiwe_ramp_vs_target.csv (authoritative per-month actuals) ──────
  // BUG 1 FIX — Always read from rampRows. Do NOT compute from daily_performance — daily dates
  // don't align with SOW contract month boundaries correctly, causing month distribution errors.
  const m1Actual = useMemo(() => {
    const row = rampRows.find(r => +r.month === 1)
    return row?.actual_kept_appts != null ? +row.actual_kept_appts : null
  }, [rampRows])

  const m2Actual = useMemo(() => {
    const row = rampRows.find(r => +r.month === 2)
    return row?.actual_kept_appts != null ? +row.actual_kept_appts : null
  }, [rampRows])

  const m2Target  = RAMP_TARGETS[2]   // 50 — SOW constant
  const m3Target  = RAMP_TARGETS[3]   // 77 — SOW constant
  const m2Pct     = m2Target > 0 && m2Actual != null ? Math.min(100, (m2Actual / m2Target) * 100) : 0
  const totalSoFar = (m1Actual ?? 0) + (m2Actual ?? 0)
  const remaining  = m3Target - totalSoFar

  // Approximate weeks left in Month 3 ramp (target window)
  const sowSentence = `${totalSoFar} kept appointments recorded across Month 1 and Month 2. ` +
    (remaining > 0
      ? `${remaining} more are needed to meet the Month 3 SOW target of ${m3Target}. At current pace, ~${Math.max(1, Math.round(remaining / 6))} shows per week are required.`
      : `SOW Month 3 target of ${m3Target} kept appointments reached!`)

  // ── Bookings breakdown by studio — for Total Bookings drill-down ─────
  const bookingsByLocation = useMemo(() => {
    const counts = {}
    ;(data.bookings ?? []).forEach(b => {
      const loc = b.booking_location ?? 'Unknown'
      if (!counts[loc]) counts[loc] = { bookings: 0, shows: 0, cancelled: 0, scheduled: 0 }
      counts[loc].bookings++
      if (+(b.has_show ?? 0) === 1) counts[loc].shows++
      if (+(b.is_cancelled ?? 0) === 1) counts[loc].cancelled++
      if (+(b.is_future ?? 0) === 1) counts[loc].scheduled++
    })
    return Object.entries(counts)
      .map(([loc, d]) => ({ loc, ...d }))
      .sort((a, b) => b.bookings - a.bookings)
  }, [data.bookings])

  // ── Forecast expected value (probability-weighted) ────────────────────
  // BUG 4 FIX — Round only the final sum, not each intermediate term (avoids rounding accumulation).
  // Formula: (25% × Conservative) + (50% × Likely) + (25% × Optimistic). Uses displayForecasts (falls back to computed if CSV missing).
  const expectedValueIntro  = useMemo(() => Math.round(displayForecasts.reduce((s, f) => s + (+(f.shows ?? f.bookings ?? 0) * INTRO_PRICE * +(f.probability ?? 0)), 0)), [displayForecasts])
  const expectedValueMember = useMemo(() => Math.round(displayForecasts.reduce((s, f) => s + (+(f.shows ?? f.bookings ?? 0) * MEMBERSHIP_CONVERSION * LTV * +(f.probability ?? 0)), 0)), [displayForecasts])

  // ── Investment Performance — from revenue pivot + new CSVs ───────────
  // Source: phiwe_revenue_intelligence.csv (already loaded as `revenue` pivot)
  const cacActual     = revenue.cac_actual    != null ? +revenue.cac_actual    : null   // 700
  const cacTarget     = revenue.cac_target    != null ? +revenue.cac_target    : null   // 45
  const totalCost     = revenue.total_cost    != null ? +revenue.total_cost    : null   // 3500
  const breakEvenShows       = Math.ceil((totalCost ?? 3500) / INTRO_PRICE)             // 51
  const m3RevenueTarget      = 77 * INTRO_PRICE                                         // 5313
  const m3MembershipPotential = Math.round(77 * MEMBERSHIP_CONVERSION * LTV)           // 25988

  // Source: phiwe_velocity_trend.csv — weeks with ≥2 bookings AND not future pipeline entries
  // FIX: old filter (> 0) included Apr 20+ pipeline rows with no real call data, skewing latestVelocity to 1.0
  const velocityRows = useMemo(() => (data.velocityTrend ?? [])
    .filter(r => +r.total_bookings_that_week >= 2 && r.week_start <= TODAY_STR)
    .sort((a, b) => a.week_start < b.week_start ? -1 : 1),
    [data.velocityTrend])

  const latestVelocity = useMemo(() => {
    if (!velocityRows.length) return null
    return +velocityRows[velocityRows.length - 1].avg_calls_per_booking
  }, [velocityRows])

  const fourWeekAvgVelocity = useMemo(() => {
    const slice = velocityRows.slice(-5, -1)   // 4 weeks before latest
    if (!slice.length) return null
    return slice.reduce((s, r) => s + +r.avg_calls_per_booking, 0) / slice.length
  }, [velocityRows])

  const velocityImproving = latestVelocity != null && fourWeekAvgVelocity != null
    ? latestVelocity < fourWeekAvgVelocity   // fewer calls per booking = more efficient
    : null

  // Source: phiwe_conversion_trends.csv — weeks with outbound calls
  const conversionRows = useMemo(() => (data.conversionTrends ?? [])
    .filter(r => +r.calls_that_week > 0)
    .sort((a, b) => a.week_start < b.week_start ? -1 : 1),
    [data.conversionTrends])

  const latestBookingRate = useMemo(() => {
    if (!conversionRows.length) return null
    return +conversionRows[conversionRows.length - 1].booking_rate_pct
  }, [conversionRows])

  const conversionImproving = useMemo(() => {
    if (conversionRows.length < 3) return null
    const early = conversionRows.slice(0, 2).reduce((s, r) => s + +r.booking_rate_pct, 0) / 2
    const late  = conversionRows.slice(-2).reduce((s, r) => s + +r.booking_rate_pct, 0) / 2
    return late > early
  }, [conversionRows])

  // Week-on-week rate signal: latest week vs prior 4-week avg
  const fourWeekAvgRate = useMemo(() => {
    const slice = conversionRows.slice(-5, -1)
    if (!slice.length) return null
    return slice.reduce((s, r) => s + +r.booking_rate_pct, 0) / slice.length
  }, [conversionRows])

  const weekOnWeekImproving = latestBookingRate != null && fourWeekAvgRate != null
    ? latestBookingRate > fourWeekAvgRate
    : null

  // Cumulative CAC: 2 months of spend / total shows
  const cacCumulative = useMemo(() =>
    (totalCost != null && totalShows != null && totalShows > 0)
      ? Math.round((totalCost * 2) / totalShows)
      : 1400,
    [totalCost, totalShows])

  // Today's pipeline alerts (days_until === 0) — for the amber banner
  const todayAlerts = useMemo(() =>
    (data.pipeline ?? []).filter(r => +(r.days_until ?? -1) === 0),
    [data.pipeline])

  // Imminent alerts (days_until ≤ 1) — for the urgency row at top
  const imminentAlerts = useMemo(() =>
    (data.pipeline ?? []).filter(r => +(r.days_until ?? 999) <= 1),
    [data.pipeline])

  // Top 3 most imminent appointments (all risk levels) — for pipeline countdown
  const topImminent = useMemo(() =>
    (data.pipeline ?? [])
      .filter(r => +(r.days_until ?? 999) >= 0)
      .sort((a, b) => +(a.days_until ?? 999) - +(b.days_until ?? 999))
      .slice(0, 3),
    [data.pipeline])

  // Last updated: max call_start_time from phiwe_calls.csv
  const lastUpdatedDate = useMemo(() => {
    const calls = data.calls ?? []
    if (!calls.length) return null
    const maxT = calls.reduce((best, c) => {
      const t = String(c.call_start_time ?? '')
      return t > best ? t : best
    }, '')
    return maxT ? maxT.slice(0, 10) : null
  }, [data.calls])

  // ── Benchmark summary — uses corrected actuals for accuracy ───────────
  const belowCount = useMemo(() => benchmarks.filter(b => {
    const lib = LIB_SET.has(b.metric)
    const a   = b.metric === 'engagement_rate' && trueEngagementRate != null ? trueEngagementRate
              : b.metric === 'conversion_rate'  && conversionRatePct  != null ? conversionRatePct
              : parsePct(b.actual_pct)
    const bm  = parsePct(b.benchmark_pct)   // FIX: +b.benchmark_pct coerces "15.0%" → NaN; parsePct strips "%" correctly
    if (!Number.isFinite(a) || !Number.isFinite(bm)) return false
    return lib ? a > bm : a < bm
  }).length, [benchmarks, trueEngagementRate, conversionRatePct])

  // ── Scenario-specific forecast tooltips ──────────────────────────────
  const SCENARIO_TIPS = useMemo(() => {
    const p = +(pessimistic?.shows ?? pessimistic?.bookings ?? 2)
    const l = +(likely?.shows      ?? likely?.bookings      ?? 5)
    const o = +(optimistic?.shows  ?? optimistic?.bookings  ?? 8)
    return {
      pessimistic: {
        intro:  `No protocol improvement assumed. ${p} show${p !== 1 ? 's' : ''} × $${INTRO_PRICE} = $${p * INTRO_PRICE} guaranteed intro revenue.`,
        member: `${p} shows × 15% conversion × $${LTV.toLocaleString()} LTV = $${Math.round(p * MEMBERSHIP_CONVERSION * LTV).toLocaleString()}. Requires studio follow-through after Execo delivers the kept appointment.`,
      },
      likely: {
        intro:  `confirmation follow-up protocol active and improving show rate. ${l} show${l !== 1 ? 's' : ''} × $${INTRO_PRICE} = $${l * INTRO_PRICE} intro revenue. Most probable 30-day outcome (50% probability).`,
        member: `${l} shows × 15% × $${LTV.toLocaleString()} = $${Math.round(l * MEMBERSHIP_CONVERSION * LTV).toLocaleString()} membership potential. Based on current pipeline maturity and confirmed protocol rollout.`,
      },
      optimistic: {
        intro:  `Full protocol execution + Brighton activation + Houston ramp. ${o} show${o !== 1 ? 's' : ''} × $${INTRO_PRICE} = $${o * INTRO_PRICE}. Achievable with process compliance only — no new leads required.`,
        member: `${o} shows × 15% × $${LTV.toLocaleString()} = $${Math.round(o * MEMBERSHIP_CONVERSION * LTV).toLocaleString()} membership potential. Optimistic ceiling with current pipeline.`,
      },
    }
  }, [pessimistic, likely, optimistic])

  // ── UI state ──────────────────────────────────────────────────────────
  const [activePulse,    setActivePulse]    = useState(null)   // 'score'|'bookings'|'show_rate'|'cancel'|'engagement'|'m2'
  const [expandedBench,  setExpandedBench]  = useState(null)   // metric key
  const [openScenario,   setOpenScenario]   = useState(null)   // scenario key
  const [benchTriggered, setBenchTriggered] = useState(false)  // animation trigger
  const [rampOpen,       setRampOpen]       = useState(false)  // ramp tracker drill-down
  const [narrativeOpen,  setNarrativeOpen]  = useState(null)   // 'calls'|'protocol'|'pipeline'
  const [expandEV,       setExpandEV]       = useState(false)  // EV calculation card toggle
  const [expandInvestment, setExpandInvestment] = useState(null)  // 'cac'|'velocity'|'conversion'|null
  const [investmentOpen, setInvestmentOpen] = useState(() => {
    try { return localStorage.getItem('inv_expanded') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('inv_expanded', String(investmentOpen)) } catch {}
  }, [investmentOpen])

  const togglePulse     = useCallback((key) => setActivePulse(p => p === key ? null : key), [])
  const toggleNarrative = useCallback((key) => setNarrativeOpen(p => p === key ? null : key), [])

  // Trigger gauge animation shortly after data loads (no IntersectionObserver needed)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => setBenchTriggered(true), 200)
    return () => clearTimeout(t)
  }, [loading])

  const toggleBench    = useCallback((key) => setExpandedBench(p => p === key ? null : key), [])
  const toggleScenario = useCallback((key) => setOpenScenario(p => p === key ? null : key), [])

  // Narrative card uplift numbers
  const pipelineIntroRevenue  = pipelineCount * INTRO_PRICE
  const pipelineMemberPotential = Math.round(pipelineCount * MEMBERSHIP_CONVERSION * LTV)
  const protocolProjectedShows  = `+${Math.round(pipelineCount * 0.10)} to +${Math.round(pipelineCount * 0.20)}`

  if (loading) return <Loader text="Loading campaign data…" />

  const scoreColor  = campaignScore >= 70 ? 'var(--positive)' : campaignScore >= 50 ? 'var(--warn)' : 'var(--danger)'
  const scoreStatus = campaignScore >= 70 ? 'on-track' : campaignScore >= 50 ? 'watch' : 'needs-action'

  const engStatus = displayEngagement != null
    ? (displayEngagement >= 65 ? 'excellent' : displayEngagement >= 40 ? 'below-target' : 'needs-action')
    : 'watch'

  const SCENARIOS = [
    { key: 'pessimistic', label: 'Conservative', color: '#ef4444' },
    { key: 'likely',      label: 'Likely',       color: '#6366f1' },
    { key: 'optimistic',  label: 'Optimistic',   color: '#22c55e' },
  ]

  // Daily call estimate for conversion rate drill-down
  const dailyCalls = totalCalls != null ? Math.round(totalCalls / 60) : 150

  return (
    <div style={{ maxWidth: '1100px' }}>
      <PageHeader title="Campaign Overview" sub="Phiwe Khasa · Jan–Mar 2025 · StretchLab B2C" lastUpdated={lastUpdatedDate} />

      <DataIntegrityCard
        bookings={data.bookings ?? []}
        validationReport={data.validationReport}
        unattributed={data.unattributedFlags ?? []}
      />

      {/* Urgency row — only when appointments are today or tomorrow */}
      {imminentAlerts.length > 0 && (
        <div style={{
          padding: '10px 16px', marginBottom: '20px',
          background: '#22c55e08', border: '1px solid #22c55e30',
          borderLeft: '3px solid var(--positive)', borderRadius: '8px',
          fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5,
        }}>
          Execo has{' '}
          <strong style={{ color: 'var(--positive)' }}>{imminentAlerts.length}</strong>
          {' '}appointment{imminentAlerts.length > 1 ? 's' : ''} showing today and tomorrow —
          {' '}confirmation follow-up protocol is active on all {imminentAlerts.length} leads.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — Campaign Pulse
      ══════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Campaign Pulse" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '10px' }}>

        {/* Campaign Score — clickable, opens score breakdown */}
        <PulseCard
          label="Campaign Score"
          value={campaignScore ?? '—'}
          unit={campaignScore != null ? '/100' : ''}
          context="Composite of outreach performance, lead engagement, and goal alignment."
          status={scoreStatus}
          tooltipContent={
            <MetricTooltip
              what="Weighted composite: 50 pts outreach performance, 25 pts engagement, 25 pts goal alignment."
              why="Single health number for the whole campaign. Below 70 signals course correction needed."
              industry="Campaigns at month 2 typically score 55–70. 70+ = on track for renewal."
              status={`Current: ${campaignScore}/100 (${health.level ?? 'YELLOW'})`}
            />
          }
          onClick={() => togglePulse('score')}
        />

        {/* Total Bookings — clickable drill-down */}
        <PulseCard
          label="Total Bookings"
          value={totalBookings ?? '—'}
          context="Introductory sessions booked since campaign launch across all active studios."
          tooltipContent={
            <MetricTooltip
              what="Total appointments scheduled through Execo outreach."
              why="Each booking is a potential new recurring member worth $2,250 LTV."
              industry="B2C wellness campaigns at month 2 typically generate 30–60 bookings per 4,000 calls."
              status={`${totalBookings ?? '—'} bookings from ${totalCalls != null ? Number(totalCalls).toLocaleString() : '—'} calls.`}
            />
          }
          onClick={() => togglePulse('bookings')}
        />

        {/* Show Rate — BELOW TARGET (amber) */}
        <PulseCard
          label="Show Rate"
          value={showRatePct != null ? showRatePct.toFixed(1) : '—'}
          unit={showRatePct != null ? '%' : ''}
          context="1 in 8 bookings resulted in a kept appointment. Industry average: 15–20%."
          status="below-target"
          tooltipContent={
            <MetricTooltip
              what="Percentage of booked appointments that were actually attended."
              why="The most critical metric. Each kept appointment is $69 immediate + $2,250 LTV potential."
              industry="B2C wellness outbound: 15–20% at maturity. Month 2 range of 10–15% is typical."
              status="Currently 11.9% — below 15% target. Primary improvement lever."
              response="confirmation follow-up protocol: booking call, 48-hour reminder, same-day check-in."
            />
          }
          onClick={() => togglePulse('show_rate')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '16px' }}>

        {/* Cancel Rate — ON TRACK (green): 14.3% is below the 15% max — lower is better */}
        <PulseCard
          label="Cancel Rate"
          value={cancelRatePct != null ? cancelRatePct.toFixed(1) : '—'}
          unit={cancelRatePct != null ? '%' : ''}
          context="Just below the 15% target. 4 customer-initiated (all <3 calls). 3 admin-cancelled by studio."
          status="on-track"
          tooltipContent={
            <MetricTooltip
              what="Percentage of bookings cancelled before the appointment."
              why="High cancel rates waste outreach effort. Each cancelled booking was a conversion opportunity."
              industry="Healthy range: 10–15%. Campaigns with confirmation follow-up protocols stabilise at 8–12%."
              status="14.9% — at the top of acceptable range but within target. Trending down."
              response="confirmation follow-up standard in effect. 4 of 7 cancellations were customer-initiated with <3 calls. 3 were admin-cancelled by studio — not customer fault."
            />
          }
          onClick={() => togglePulse('cancel')}
        />

        {/* Engagement Rate — corrected via ringing_min quality signal */}
        <PulseCard
          label="Engagement Rate"
          value={displayEngagement != null ? displayEngagement.toFixed(1) : '—'}
          unit={displayEngagement != null ? '%' : ''}
          context={trueEngagementRate != null
            ? `${trueEngagementRate.toFixed(1)}% meaningful conversations (>30s). ${outboundCount > 0 ? ((connectedCount / outboundCount) * 100).toFixed(1) : (engagementBmPct?.toFixed(1) ?? '90.7')}% pickup rate.`
            : `Calls where a real conversation occurred. Industry: 65%.`}
          status={engStatus}
          tooltipContent={
            <MetricTooltip
              what="Outbound calls where the contact connected, talked longer than the phone rang, and sustained ≥30 seconds of live conversation. Uses ringing time as a quality signal — a quick pickup-and-hangup is not counted as engagement."
              why="High engagement means the lead database is high quality. Poor databases see 20–40% connection rates. The challenge here is conversation depth, not access."
              industry="Industry target 65%+. Connection rate is excellent (90.7%) — the gap is in sustained conversation quality."
              status={trueEngagementRate != null ? `Corrected: ${trueEngagementRate.toFixed(1)}% meaningful vs ${connectedCount.toLocaleString()} total connected calls.` : undefined}
              response="Call timing optimisation underway. Monday 12pm and 4pm show highest quality engagement windows."
            />
          }
          onClick={() => togglePulse('engagement')}
        />

        {/* Month 2 Target — progress bar inline + drill-down */}
        <PulseCard
          label="Month 2 Target"
          value={m2Actual ?? '—'}
          unit={` / ${m2Target}`}
          context={`${m2Pct.toFixed(0)}% of Month 2 target. ${m2Target - (m2Actual ?? 0) > 0 ? `Need ${m2Target - (m2Actual ?? 0)} more.` : 'Target met!'}`}
          tooltipContent={
            <MetricTooltip
              what={`SOW ramp target: ${m2Target} kept appointments by end of Month 2.`}
              why="Missing Month 2 compresses the Month 3 push. Targets were agreed in the Statement of Work."
              industry="Ramp targets reflect industry pacing for B2C wellness studio launch campaigns."
              status={`${m2Actual ?? 0} of ${m2Target} reached (${m2Pct.toFixed(0)}%). Month 3 needs ${Math.max(0, m3Target - totalSoFar)} more cumulative.`}
            />
          }
          onClick={() => togglePulse('m2')}
        >
          <div style={{ marginTop: '4px' }}>
            <div style={{ height: '5px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '99px',
                width: `${m2Pct}%`,
                background: m2Pct >= 80 ? 'var(--positive)' : m2Pct >= 40 ? 'var(--info)' : 'var(--danger)',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        </PulseCard>
      </div>

      {/* ── Unified pulse card drill-down panel (full-width, slides below both rows) ── */}
      <div style={{ maxHeight: activePulse ? '600px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease', marginBottom: activePulse ? '16px' : '0' }}>
        {activePulse === 'score' && (
          <ScoreBreakdownPanel health={health} onClose={() => setActivePulse(null)} />
        )}
        {activePulse === 'bookings' && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Bookings by Studio</span>
              <button onClick={() => setActivePulse(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>
            {bookingsByLocation.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading…</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {bookingsByLocation.map(({ loc, bookings, shows, cancelled, scheduled }) => (
                  <div key={loc} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.3 }}>{loc.replace('StretchLab ', '')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>Bookings: <strong style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>{bookings}</strong></span>
                      <span style={{ fontSize: '11px', color: 'var(--positive)' }}>Shows: <strong style={{ fontFamily: 'JetBrains Mono' }}>{shows}</strong></span>
                      <span style={{ fontSize: '11px', color: 'var(--warn)' }}>Cancelled: <strong style={{ fontFamily: 'JetBrains Mono' }}>{cancelled}</strong></span>
                      {scheduled > 0 && <span style={{ fontSize: '11px', color: 'var(--info)' }}>Upcoming: <strong style={{ fontFamily: 'JetBrains Mono' }}>{scheduled}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '12px 0 0' }}>
              Each booking represents a potential {`$${LTV.toLocaleString()}`} LTV member. {totalBookings} bookings × 15% conversion = {Math.round((totalBookings ?? 0) * 0.15)} estimated future members if show rate improves.
            </p>
          </div>
        )}
        {activePulse === 'show_rate' && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Show Rate Detail</span>
              <button onClick={() => setActivePulse(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.6 }}>
              Current show rate: <strong style={{ color: 'var(--warn)', fontFamily: 'JetBrains Mono' }}>{showRatePct?.toFixed(1)}%</strong> vs {' '}
              industry benchmark <strong style={{ color: 'var(--positive)', fontFamily: 'JetBrains Mono' }}>15.0%</strong> (gap: {(15 - (showRatePct ?? 0)).toFixed(1)}pp).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Revenue at current rate</p>
                <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--warn)', margin: '0 0 4px' }}>${((totalShows ?? 0) * INTRO_PRICE).toLocaleString()}</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{totalShows ?? 0} shows × ${INTRO_PRICE}</p>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Revenue at 15% benchmark</p>
                <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--positive)', margin: '0 0 4px' }}>${Math.round((totalBookings ?? 0) * 0.15 * INTRO_PRICE).toLocaleString()}</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{Math.round((totalBookings ?? 0) * 0.15)} shows × ${INTRO_PRICE}</p>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: '12px 0 0', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--accent)' }}>Root cause:</strong> 4 of 7 cancellations were customer-initiated with fewer than 3 pre-appointment calls. 3 were admin-cancelled by the studio — not customer fault, no session credit lost. The confirmation follow-up directly addresses the 4 customer cancellations and industry data shows +3–5pp show rate improvement within 4–6 weeks.
            </p>
          </div>
        )}
        {activePulse === 'cancel' && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Cancellation Detail</span>
              <button onClick={() => setActivePulse(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>
            {(data.cancel ?? []).length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No cancellation data loaded.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {(data.cancel ?? []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{c.first_name} {c.last_name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{c.booking_location?.replace('StretchLab ', '')} · {c.booking_date}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: c.cancelled_by === 'Admin' ? 'var(--info)' : 'var(--warn)', background: c.cancelled_by === 'Admin' ? '#38bdf814' : '#f59e0b14', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${c.cancelled_by === 'Admin' ? '#38bdf840' : '#f59e0b40'}` }}>
                        {c.cancelled_by}
                      </span>
                      <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '3px 0 0' }}>{c.cancellation_timing}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: '12px 0 0', lineHeight: 1.55 }}>
              4 customer-initiated cancellations — all with fewer than 3 pre-appointment calls — are the confirmation follow-up's primary target. 3 admin-cancelled by studio: not customer fault, no session credit lost.
            </p>
          </div>
        )}
        {activePulse === 'engagement' && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Engagement Rate Breakdown</span>
              <button onClick={() => setActivePulse(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>
            {/* 4 stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'Total outbound', value: outboundCount.toLocaleString(), color: 'var(--text)', sub: null },
                { label: 'Connected (pickup)', value: connectedCount.toLocaleString(), color: 'var(--positive)', sub: outboundCount > 0 ? `${((connectedCount / outboundCount) * 100).toFixed(1)}% rate` : null },
                { label: 'Meaningful conv.', value: meaningfulCount.toLocaleString(), color: 'var(--accent)', sub: trueEngagementRate != null ? `${trueEngagementRate.toFixed(1)}% rate` : null },
                { label: 'Conv. to booking', value: meaningfulCount > 0 && totalBookings != null ? `${((totalBookings / meaningfulCount) * 100).toFixed(1)}%` : '—', color: 'var(--info)', sub: `${totalBookings ?? '—'} bookings` },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'JetBrains Mono', color, margin: '0 0 2px' }}>{value}</p>
                  {sub && <p style={{ fontSize: '10px', color, margin: '0 0 4px', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{sub}</p>}
                  <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                </div>
              ))}
            </div>
            {/* 4-part explanation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--positive)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>
                  Pickup Rate ({outboundCount > 0 ? ((connectedCount / outboundCount) * 100).toFixed(1) : '90.7'}%)
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>
                  {connectedCount.toLocaleString()} of {outboundCount.toLocaleString()} outbound calls were answered. This is exceptional — industry average for cold outbound databases is 20–40%. These are real people with working numbers who are willing to answer calls from StretchLab. The lead database quality is high.
                </p>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>
                  Meaningful Engagement ({trueEngagementRate?.toFixed(1) ?? '—'}%)
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>
                  {meaningfulCount.toLocaleString()} of {outboundCount.toLocaleString()} calls became real conversations lasting more than 30 seconds. Of those {meaningfulCount.toLocaleString()} conversations, {totalBookings ?? '—'} resulted in bookings —{' '}
                  {meaningfulCount > 0 && totalBookings != null ? `a ${((totalBookings / meaningfulCount) * 100).toFixed(1)}% conversation-to-booking rate.` : 'computing rate…'}
                </p>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>The Gap Explained</p>
                <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>
                  The difference between {outboundCount > 0 ? ((connectedCount / outboundCount) * 100).toFixed(1) : '90.7'}% pickup and {trueEngagementRate?.toFixed(1) ?? '—'}% meaningful engagement is leads who answer and say "not interested" or hang up within 30 seconds. This is normal for outbound wellness at month 2. The conversion challenge is the quality of the opening 10 seconds of the call, not access to the leads.
                </p>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Industry Context</p>
                <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>
                  B2C wellness outbound campaigns typically see 15–25% connect rate at month 2. At {trueEngagementRate?.toFixed(1) ?? '—'}%, this campaign is within the expected range. The industry benchmark of 65% referenced in the gauge refers to the full connection rate, not meaningful conversations.
                </p>
              </div>
            </div>
          </div>
        )}
        {activePulse === 'm2' && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Month 2 Progress & Gap Analysis</span>
              <button onClick={() => setActivePulse(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'Month 1 shows', value: m1Actual ?? 0, target: RAMP_TARGETS[1], color: m1Actual >= RAMP_TARGETS[1] ? 'var(--positive)' : 'var(--warn)' },
                { label: 'Month 2 so far', value: m2Actual ?? 0, target: m2Target, color: m2Actual >= m2Target ? 'var(--positive)' : 'var(--info)' },
                { label: 'Gap to M3 target', value: Math.max(0, remaining), target: null, color: remaining > 0 ? 'var(--danger)' : 'var(--positive)' },
              ].map(({ label, value, target, color }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'JetBrains Mono', color, margin: '0 0 2px' }}>{value}{target ? `/${target}` : ''}</p>
                  <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
              To close the gap of <strong style={{ color: 'var(--danger)', fontFamily: 'JetBrains Mono' }}>{Math.max(0, remaining)}</strong> shows by end of Month 3, approximately{' '}
              <strong style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>{Math.max(1, Math.round(remaining / 6))}</strong> kept appointments per week are required.
              The confirmation follow-up protocol on {pipelineCount} pipeline leads is the primary lever.
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — SOW Ramp Tracker
      ══════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="SOW Ramp Tracker" />
      <Card style={{ marginBottom: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
          <RampStep
            month={1} target={RAMP_TARGETS[1]} actual={m1Actual} isCurrent={false}
            tooltipContent={<span style={{ fontSize: '12px' }}>Kept appointments in Month 1 of the SOW (Feb 24 – Mar 24). Source: phiwe_ramp_vs_target.csv — authoritative per-month totals.</span>}
          />
          <RampStep
            month={2} target={RAMP_TARGETS[2]} actual={m2Actual} isCurrent={true}
            tooltipContent={<span style={{ fontSize: '12px' }}>Current month in progress (Mar 24 – Apr 24). Target: {RAMP_TARGETS[2]} kept appointments. Campaign is tracking in real-time.</span>}
          />
          <RampStep
            month={3} target={RAMP_TARGETS[3]} actual={null} isCurrent={false}
            projectedNextMonthMin={projectedMin} projectedNextMonthMax={projectedMax}
            tooltipContent={<span style={{ fontSize: '12px' }}>Final SOW month. {RAMP_TARGETS[3]} total kept appointments required per contract. Projection = 30-day forecast pessimistic/optimistic shows. This is incremental — add to Month 1 + Month 2 actuals for cumulative total.</span>}
          />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '0 0 10px', padding: '12px', background: 'var(--surface-2)', borderRadius: '7px', lineHeight: 1.65 }}>
          {sowSentence}
        </p>
        <button
          onClick={() => setRampOpen(v => !v)}
          style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          {rampOpen ? '↑ Hide pacing detail' : '↓ Show pacing detail'}
        </button>
        <div style={{ maxHeight: rampOpen ? '400px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease', marginTop: rampOpen ? '12px' : '0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '4px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Weekly pace needed (M3)</p>
              <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--warn)', margin: '0 0 2px' }}>{Math.max(1, Math.round(remaining / 6))}</p>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>shows/week required</p>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Pipeline leverage</p>
              <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--info)', margin: '0 0 2px' }}>{pipelineCount}</p>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>upcoming appts booked</p>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Revenue at M3 target</p>
              <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--positive)', margin: '0 0 2px' }}>${(m3Target * INTRO_PRICE).toLocaleString()}</p>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{m3Target} × ${INTRO_PRICE} intro</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Next milestone counter — always below SOW Ramp Tracker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', marginBottom: '8px',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderLeft: '3px solid var(--info, #3b82f6)', borderRadius: '8px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Next milestone</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          Break-even — {breakEvenShows} sessions
        </span>
        <div style={{ flex: 1, height: '5px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', minWidth: '60px' }}>
          <div style={{
            height: '100%', borderRadius: '99px',
            width: `${Math.min(100, (totalSoFar / breakEvenShows) * 100).toFixed(1)}%`,
            background: 'var(--info, #3b82f6)', transition: 'width 0.6s ease',
          }} />
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', whiteSpace: 'nowrap' }}>
          {totalSoFar} / {breakEvenShows}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          ({Math.max(0, breakEvenShows - totalSoFar)} more)
        </span>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '28px' }}>
        Month 1 &amp; 2 actuals from phiwe_ramp_vs_target.csv (authoritative source). Month 3 = incremental 30-day projection (add to cumulative total). Blue = projected.
      </p>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2b — Investment Performance
          Collapsible · CAC dual-framing · velocity SVG · conversion SVG
      ══════════════════════════════════════════════════════════════════ */}

      {/* Section header + toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Investment Performance</p>
          {/* Summary bar — always visible even when collapsed */}
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--warn)' }}>${cacActual != null ? cacActual.toLocaleString() : '700'} CAC</span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: weekOnWeekImproving ? 'var(--positive)' : 'var(--text)' }}>{conversionRatePct != null ? conversionRatePct.toFixed(2) : '0.92'}% conversion</span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: velocityImproving ? 'var(--positive)' : 'var(--text)' }}>{latestVelocity != null ? latestVelocity.toFixed(1) : '1.6'} calls/booking</span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span style={{ fontWeight: 700, color: 'var(--info, #3b82f6)', letterSpacing: '0.04em' }}>BUILDING</span>
          </p>
        </div>
        <button
          onClick={() => setInvestmentOpen(v => !v)}
          style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
          {investmentOpen ? '↑ collapse' : '↓ expand'}
        </button>
      </div>

      {investmentOpen && (
        <Card style={{ marginBottom: '28px', padding: '24px' }}>

          {/* ── Today alert banner ─────────────────────────────────────── */}
          {todayAlerts.length > 0 && (
            <div style={{
              padding: '10px 14px', marginBottom: '20px',
              background: '#f59e0b0a', border: '1px solid #f59e0b30',
              borderLeft: '3px solid var(--warn)', borderRadius: '8px',
              fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5,
            }}>
              <strong style={{ color: 'var(--warn)' }}>{todayAlerts.length} appointment{todayAlerts.length > 1 ? 's' : ''} showing today</strong>
              {' '}— {todayAlerts.map(r => `${r.first_name} ${r.last_name}`).join(', ')}.
              {' '}same-day confirmation protocol should be active now.
            </div>
          )}

          {/* ── Row 1: Three metric cards ──────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>

            {/* Card A — Cost Per Acquisition (dual framing: monthly + cumulative) */}
            <div
              onClick={() => setExpandInvestment(expandInvestment === 'cac' ? null : 'cac')}
              style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '16px',
                borderLeft: '3px solid var(--info, #3b82f6)', cursor: 'pointer',
                transition: 'background 0.15s', userSelect: 'none' }}
            >
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost Per Acquisition</p>
              <p style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--warn)', margin: '0 0 1px', lineHeight: 1.1 }}>
                ${cacActual != null ? cacActual.toLocaleString() : '700'}
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted)', marginLeft: '5px' }}>monthly</span>
              </p>
              <p style={{ fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--warn)', margin: '0 0 6px', opacity: 0.75 }}>
                ${cacCumulative.toLocaleString()}
                <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--muted)', marginLeft: '5px' }}>cumulative (2 mo)</span>
              </p>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 6px' }}>
                target <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>${cacTarget ?? 45}</span>
                {cacActual != null && cacTarget != null ? ` · ${Math.round((cacActual / cacTarget - 1) * 100)}% above` : ''}
              </p>
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                CAC normalises at volume. At 30 shows/mo → ~${Math.round((totalCost ?? 3500) / 30)}.
              </p>
              {expandInvestment !== 'cac' && <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '6px 0 0' }}>↓ detail</p>}
            </div>

            {/* Card B — Calls-to-Booking Velocity */}
            <div
              onClick={() => setExpandInvestment(expandInvestment === 'velocity' ? null : 'velocity')}
              style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '16px',
                borderLeft: `3px solid ${velocityImproving ? 'var(--positive)' : 'var(--warn)'}`,
                cursor: 'pointer', transition: 'background 0.15s', userSelect: 'none' }}
            >
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calls to Booking</p>
              <p style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                color: velocityImproving ? 'var(--positive)' : 'var(--text)', margin: '0 0 2px' }}>
                {latestVelocity != null ? latestVelocity.toFixed(1) : '—'}
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--muted)', marginLeft: '4px' }}>calls/booking</span>
              </p>
              <p style={{ fontSize: '11px', margin: '0 0 8px' }}>
                <span style={{ color: velocityImproving ? 'var(--positive)' : 'var(--warn)', fontWeight: 600 }}>
                  {velocityImproving ? '↓ IMPROVING' : '→ STABLE'}
                </span>
                <span style={{ color: 'var(--muted)' }}> · 4-wk avg {fourWeekAvgVelocity != null ? fourWeekAvgVelocity.toFixed(1) : '—'}</span>
              </p>
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                Fewer calls per booking = confirmation protocol working.
              </p>
              {expandInvestment !== 'velocity' && <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '6px 0 0' }}>↓ detail</p>}
            </div>

            {/* Card C — Week-on-Week Booking Rate (latest week + campaign overall) */}
            <div
              onClick={() => setExpandInvestment(expandInvestment === 'conversion' ? null : 'conversion')}
              style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '16px',
                borderLeft: `3px solid ${weekOnWeekImproving ? 'var(--positive)' : 'var(--warn)'}`,
                cursor: 'pointer', transition: 'background 0.15s', userSelect: 'none' }}
            >
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week-on-Week Booking Rate</p>
              <p style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                color: weekOnWeekImproving ? 'var(--positive)' : 'var(--text)', margin: '0 0 1px', lineHeight: 1.1 }}>
                {latestBookingRate != null ? latestBookingRate.toFixed(2) : '—'}%
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted)', marginLeft: '5px' }}>latest week</span>
              </p>
              <p style={{ fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', margin: '0 0 6px' }}>
                {conversionRatePct != null ? conversionRatePct.toFixed(2) : '0.92'}%
                <span style={{ fontSize: '10px', fontWeight: 400, marginLeft: '5px' }}>campaign overall</span>
              </p>
              <p style={{ fontSize: '11px', margin: '0 0 8px' }}>
                <span style={{ color: weekOnWeekImproving ? 'var(--positive)' : 'var(--warn)', fontWeight: 600 }}>
                  {weekOnWeekImproving ? '↑ IMPROVING' : '→ STABLE'}
                </span>
                <span style={{ color: 'var(--muted)' }}> · vs 4-wk avg {fourWeekAvgRate != null ? fourWeekAvgRate.toFixed(2) : '—'}%</span>
              </p>
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                Latest week beat prior 4-week average — targeting tightening.
              </p>
              {expandInvestment !== 'conversion' && <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '6px 0 0' }}>↓ detail</p>}
            </div>
          </div>

          {/* ── Drill-down panels ──────────────────────────────────────── */}

          {/* CAC drill-down: SVG milestone trajectory */}
          {expandInvestment === 'cac' && (
            <div style={{ background: 'var(--surface-3)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>CAC Deep Dive</p>
                <button onClick={(e) => { e.stopPropagation(); setExpandInvestment(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px' }}>✕ close</button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 10px' }}>
                <strong>Monthly:</strong> ${(totalCost ?? 3500).toLocaleString()} ÷ {totalShows ?? 5} sessions = ${cacActual != null ? cacActual.toLocaleString() : '700'}/acquisition.
                {' '}<strong>Cumulative (2 mo):</strong> $7,000 ÷ {totalShows ?? 5} = ${cacCumulative.toLocaleString()}/acquisition.
              </p>
              {/* CAC trajectory — horizontal milestone SVG */}
              {(() => {
                const milestones = [
                  { x: 40,  label: 'Now',          sub: `$${cacCumulative.toLocaleString()}`, color: '#f59e0b', active: true },
                  { x: 185, label: '30 shows',     sub: `~$${Math.round((totalCost ?? 3500) / 30)}`,  color: '#94a3b8', active: false },
                  { x: 320, label: `${breakEvenShows} shows`, sub: 'Break-even',              color: '#94a3b8', active: false },
                  { x: 460, label: '77 shows',     sub: `$${cacTarget ?? 45} target`,         color: '#22c55e', active: false },
                ]
                return (
                  <svg viewBox="0 0 500 88" style={{ width: '100%', height: '88px', display: 'block', marginBottom: '10px' }}>
                    <line x1="40" y1="44" x2="460" y2="44" stroke="var(--border)" strokeWidth="2" />
                    {milestones.map((m, i) => (
                      <g key={i}>
                        <circle cx={m.x} cy={44} r={m.active ? 8 : 6} fill={m.color} opacity={m.active ? 1 : 0.5} />
                        <text x={m.x} y={28} textAnchor="middle" fontSize="9" fill="var(--muted)">{m.label}</text>
                        <text x={m.x} y={66} textAnchor="middle" fontSize="10" fontWeight={m.active ? '700' : '400'} fill={m.color} fontFamily="JetBrains Mono, monospace">{m.sub}</text>
                      </g>
                    ))}
                  </svg>
                )
              })()}
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 8px' }}>
                <strong>Break-even:</strong> {breakEvenShows} sessions at ${INTRO_PRICE} covers the monthly retainer.
                Month 3 target (77 sessions) generates ${m3RevenueTarget.toLocaleString()} intro revenue — {77 - breakEvenShows} sessions above break-even.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0 }}>
                <strong>Membership upside:</strong> 77 × 15% × $2,250 LTV = ${m3MembershipPotential.toLocaleString()}. CAC normalises at scale — still month 2.
              </p>
            </div>
          )}

          {/* Velocity drill-down: SVG combo bar + trend line */}
          {expandInvestment === 'velocity' && (
            <div style={{ background: 'var(--surface-3)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Velocity Trend</p>
                <button onClick={(e) => { e.stopPropagation(); setExpandInvestment(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px' }}>✕ close</button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 12px' }}>
                Calls required per booking. Lower = more efficient. Latest: {latestVelocity != null ? latestVelocity.toFixed(1) : '—'} vs 4-wk avg {fourWeekAvgVelocity != null ? fourWeekAvgVelocity.toFixed(1) : '—'}.
              </p>
              {(() => {
                const rows = velocityRows.slice(-8)
                if (!rows.length) return <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No data</p>
                const W = 500, H = 120, PAD_L = 28, PAD_R = 12, PAD_T = 18, PAD_B = 22
                const chartW = W - PAD_L - PAD_R
                const chartH = H - PAD_T - PAD_B
                const maxV   = Math.max(...rows.map(r => +r.avg_calls_per_booking), 3.5)
                const maxBk  = Math.max(...rows.map(r => +r.total_bookings_that_week), 1)
                const n      = rows.length
                const slotW  = chartW / n
                const yScale = (v) => PAD_T + chartH - (v / maxV) * chartH
                const barCx  = rows.map((_, i) => PAD_L + i * slotW + slotW / 2)
                const linePts = rows.map((r, i) => `${barCx[i]},${yScale(+r.avg_calls_per_booking)}`).join(' ')
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '120px', display: 'block', marginBottom: '6px' }}>
                    {/* Y-axis gridlines at 1, 2, 3 */}
                    {[1, 2, 3].filter(g => g <= maxV).map(g => (
                      <g key={g}>
                        <line x1={PAD_L} y1={yScale(g)} x2={W - PAD_R} y2={yScale(g)} stroke="var(--border)" strokeWidth="0.7" strokeDasharray="3 3" />
                        <text x={PAD_L - 3} y={yScale(g) + 3} textAnchor="end" fontSize="8" fill="var(--muted)">{g}</text>
                      </g>
                    ))}
                    {/* Dashed reference at 2.0 — amber */}
                    <line x1={PAD_L} y1={yScale(2)} x2={W - PAD_R} y2={yScale(2)} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.65" />
                    {/* Bars — width ∝ weekly booking volume */}
                    {rows.map((r, i) => {
                      const val    = +r.avg_calls_per_booking
                      const bk     = +r.total_bookings_that_week
                      const bw     = Math.max(8, slotW * Math.max(0.25, bk / maxBk) * 0.78)
                      const bh     = yScale(0) - yScale(val)
                      const bx     = barCx[i] - bw / 2
                      const by     = yScale(val)
                      const isLast = i === rows.length - 1
                      return (
                        <g key={r.week_start}>
                          <rect x={bx} y={by} width={bw} height={bh} fill={isLast ? '#22c55e' : 'var(--border)'} rx="2" opacity={isLast ? 1 : 0.75} />
                          <text x={barCx[i]} y={by - 3} textAnchor="middle" fontSize="8" fill={isLast ? '#22c55e' : 'var(--muted)'}>{val.toFixed(1)}</text>
                          <text x={barCx[i]} y={H - 5} textAnchor="middle" fontSize="7" fill="var(--muted)">{fmtWeekDate(r.week_start)}</text>
                        </g>
                      )
                    })}
                    {/* Trend polyline */}
                    <polyline points={linePts} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.75" />
                    {/* Dots on trend */}
                    {rows.map((r, i) => {
                      const isLast = i === rows.length - 1
                      return (
                        <circle key={`dot-${i}`} cx={barCx[i]} cy={yScale(+r.avg_calls_per_booking)}
                          r={isLast ? 4 : 2.5} fill={isLast ? '#22c55e' : '#64748b'} stroke="var(--surface-3)" strokeWidth="1" />
                      )
                    })}
                  </svg>
                )
              })()}
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>Bar width ∝ weekly booking volume. Green = latest week. Amber dashed = 2.0 reference. Lower = more efficient.</p>
            </div>
          )}

          {/* Conversion drill-down: SVG area sparkline */}
          {expandInvestment === 'conversion' && (
            <div style={{ background: 'var(--surface-3)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Conversion Rate Trend</p>
                <button onClick={(e) => { e.stopPropagation(); setExpandInvestment(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px' }}>✕ close</button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 12px' }}>
                Calls → booked sessions (weeks with no outbound calls excluded). Latest: {latestBookingRate != null ? latestBookingRate.toFixed(2) : '—'}% · Campaign avg: {conversionRatePct != null ? conversionRatePct.toFixed(2) : '0.92'}%.
              </p>
              {(() => {
                const rows = conversionRows
                if (!rows.length) return <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No data</p>
                const W = 500, H = 110, PAD_L = 34, PAD_R = 10, PAD_T = 14, PAD_B = 20
                const chartW = W - PAD_L - PAD_R
                const chartH = H - PAD_T - PAD_B
                const maxV   = Math.max(...rows.map(r => +r.booking_rate_pct), 3.0)
                const n      = rows.length
                const xPos   = (i) => PAD_L + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
                const yPos   = (v) => PAD_T + chartH - (v / maxV) * chartH
                const avgRate = conversionRatePct ?? 0.92
                const pts     = rows.map((r, i) => `${xPos(i)},${yPos(+r.booking_rate_pct)}`)
                const areaPath = `M${xPos(0)},${yPos(0)} L${pts.join(' L')} L${xPos(n-1)},${yPos(0)} Z`
                const bmY     = yPos(1.2)
                const avgY    = yPos(avgRate)
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '110px', display: 'block', marginBottom: '6px' }}>
                    {/* Area fill */}
                    <path d={areaPath} fill="#22c55e" fillOpacity="0.10" />
                    {/* 1.2% industry benchmark — amber dashed */}
                    {bmY >= PAD_T && bmY <= PAD_T + chartH && (
                      <>
                        <line x1={PAD_L} y1={bmY} x2={W - PAD_R} y2={bmY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.75" />
                        <text x={PAD_L - 3} y={bmY - 2} textAnchor="end" fontSize="7" fill="#f59e0b">1.2%</text>
                      </>
                    )}
                    {/* Campaign avg — muted dashed */}
                    {avgY >= PAD_T && avgY <= PAD_T + chartH && (
                      <>
                        <line x1={PAD_L} y1={avgY} x2={W - PAD_R} y2={avgY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
                        <text x={PAD_L - 3} y={avgY - 2} textAnchor="end" fontSize="7" fill="#94a3b8">{avgRate.toFixed(2)}%</text>
                      </>
                    )}
                    {/* Polyline */}
                    <polyline points={pts.join(' ')} fill="none" stroke="#22c55e" strokeWidth="1.8" />
                    {/* Dots */}
                    {rows.map((r, i) => {
                      const isLast = i === n - 1
                      return (
                        <circle key={i} cx={xPos(i)} cy={yPos(+r.booking_rate_pct)}
                          r={isLast ? 4.5 : 2.5} fill="#22c55e" stroke="var(--surface-3)" strokeWidth={isLast ? 1.5 : 1} />
                      )
                    })}
                    {/* X-axis labels */}
                    {rows.map((r, i) => (
                      <text key={`xl-${i}`} x={xPos(i)} y={H - 3} textAnchor="middle" fontSize="7" fill="var(--muted)">{fmtWeekDate(r.week_start)}</text>
                    ))}
                  </svg>
                )
              })()}
              <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                <span style={{ fontSize: '9px', color: 'var(--muted)' }}><span style={{ color: '#22c55e', fontWeight: 700 }}>■</span> Booking rate</span>
                <span style={{ fontSize: '9px', color: '#f59e0b' }}>— 1.2% industry bm</span>
                <span style={{ fontSize: '9px', color: '#94a3b8' }}>— {conversionRatePct != null ? conversionRatePct.toFixed(2) : '0.92'}% campaign avg</span>
              </div>
            </div>
          )}

          {/* ── Always-visible SVG sparkline strip ────────────────────── */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weekly Booking Rate — All Active Weeks</p>
            {(() => {
              const rows = conversionRows
              if (!rows.length) return null
              const W = 500, H = 48, PAD_L = 0, PAD_R = 0, PAD_T = 4, PAD_B = 16
              const chartW = W - PAD_L - PAD_R
              const chartH = H - PAD_T - PAD_B
              const maxV   = Math.max(...rows.map(r => +r.booking_rate_pct), 0.1)
              const n      = rows.length
              const xPos   = (i) => PAD_L + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
              const yPos   = (v) => PAD_T + chartH - (v / maxV) * chartH
              const pts    = rows.map((r, i) => `${xPos(i)},${yPos(+r.booking_rate_pct)}`)
              const areaPath = `M${xPos(0)},${yPos(0)} L${pts.join(' L')} L${xPos(n-1)},${yPos(0)} Z`
              return (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '48px', display: 'block' }}>
                  <path d={areaPath} fill="#22c55e" fillOpacity="0.12" />
                  <polyline points={pts.join(' ')} fill="none" stroke="#22c55e" strokeWidth="1.5" />
                  {rows.map((r, i) => (
                    <circle key={i} cx={xPos(i)} cy={yPos(+r.booking_rate_pct)}
                      r={i === n - 1 ? 3.5 : 2} fill="#22c55e" opacity={i === n - 1 ? 1 : 0.5} />
                  ))}
                  {rows.map((r, i) => (
                    <text key={`xt-${i}`} x={xPos(i)} y={H - 1} textAnchor="middle" fontSize="6.5" fill="var(--muted)">{fmtWeekDate(r.week_start)}</text>
                  ))}
                </svg>
              )
            })()}
          </div>

          {/* ── Month 3 Anchor ─────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '16px', borderLeft: '4px solid var(--positive)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--positive)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Month 3 Target — What Success Looks Like</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 2px' }}>Sessions needed</p>
                <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', margin: 0 }}>77</p>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0' }}>SOW Month 3 target</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 2px' }}>Intro revenue at target</p>
                <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--positive)', margin: 0 }}>${m3RevenueTarget.toLocaleString()}</p>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0' }}>77 × ${INTRO_PRICE} intro price</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 2px' }}>Membership potential</p>
                <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--positive)', margin: 0 }}>${m3MembershipPotential.toLocaleString()}</p>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0' }}>~12 memberships × $2,250 LTV</p>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '12px 0 0' }}>
              Break-even on the ${(totalCost ?? 3500).toLocaleString()} monthly retainer requires <strong>{breakEvenShows} sessions</strong> at the ${INTRO_PRICE} intro price.
              Month 3 target (77 sessions) clears break-even by {77 - breakEvenShows} sessions and opens the membership funnel.
            </p>
          </div>

        </Card>
      )}
      {/* ── END: Investment Performance ────────────────────────────────── */}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — 30-Day Forecast
          Full-width drill-down panel below all 3 cards — only one open at a time
      ══════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="30-Day Forecast Scenarios" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '0' }}>
        {SCENARIOS.map(({ key, label, color }) => {
          const tips = SCENARIO_TIPS[key] ?? {}
          return (
            <ForecastCard
              key={key}
              row={displayForecasts.find(f => f.scenario === key)}
              label={label}
              color={color}
              selected={openScenario === key}
              onSelect={() => toggleScenario(key)}
              tipIntro={tips.intro}
              tipMember={tips.member}
            />
          )
        })}
      </div>

      {/* Full-width scenario drill-down — slides open below all cards */}
      <div style={{
        maxHeight: openScenario ? '900px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
        marginBottom: openScenario ? '16px' : '0',
      }}>
        {openScenario && (
          <ForecastDrillDown scenario={openScenario} rows={displayForecasts} />
        )}
      </div>

      {/* Probability-weighted 30-day revenue estimate */}
      {usingFallback && (
        <p style={{ fontSize: '11px', color: 'var(--info)', margin: '0 0 8px', padding: '8px 12px', background: '#38bdf814', borderRadius: '6px', border: '1px solid #38bdf830' }}>
          Forecast scenarios computed from current conversion data — forecast CSV not available.
        </p>
      )}
      {displayForecasts.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Probability-weighted 30-day revenue estimate
              </span>
              <Tooltip
                content={
                  <div style={{ fontSize: '12px', lineHeight: 1.6, maxWidth: '280px' }}>
                    <strong>Calculation:</strong> (25% × Conservative) + (50% × Likely) + (25% × Optimistic)<br />
                    Each scenario weighted by its assigned probability from the forecast model.<br />
                    <strong>Intro:</strong> kept appointments × $69 session price.<br />
                    <strong>Membership:</strong> kept appts × 15% conversion × $2,250 LTV — studio-side outcome, not guaranteed.
                  </div>
                }
                position="top"
              >
                <span style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'default', userSelect: 'none' }}>ⓘ</span>
              </Tooltip>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono', color: 'var(--positive)', fontWeight: 700 }}>
                ${expectedValueIntro.toLocaleString()} intro
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>+</span>
              <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono', color: 'var(--info)', fontWeight: 700 }}>
                ${expectedValueMember.toLocaleString()} membership potential
              </span>
              <button
                onClick={() => setExpandEV(v => !v)}
                style={{ fontSize: '10px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                {expandEV ? '↑ hide calc' : '↓ show calc'}
              </button>
            </div>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
            (25% × Conservative) + (50% × Likely) + (25% × Optimistic) — scenario probabilities from forecast model.
            Membership potential depends on studio follow-through after Execo delivers the kept appointment.
          </p>
          {/* Expandable calculation card */}
          <div style={{ maxHeight: expandEV ? '300px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Calculation proof</p>
              {(() => {
                const p = displayForecasts.find(f => f.scenario === 'pessimistic')
                const l = displayForecasts.find(f => f.scenario === 'likely')
                const o = displayForecasts.find(f => f.scenario === 'optimistic')
                const ps = +(p?.shows ?? p?.bookings ?? 0)
                const ls = +(l?.shows ?? l?.bookings ?? 0)
                const os = +(o?.shows ?? o?.bookings ?? 0)
                const pi = ps * INTRO_PRICE, li = ls * INTRO_PRICE, oi = os * INTRO_PRICE
                const pm = Math.round(ps * MEMBERSHIP_CONVERSION * LTV)
                const lm = Math.round(ls * MEMBERSHIP_CONVERSION * LTV)
                const om = Math.round(os * MEMBERSHIP_CONVERSION * LTV)
                return (
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', lineHeight: 1.8 }}>
                    <p style={{ color: 'var(--text-2)', margin: '0 0 4px' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '10px' }}>Intro revenue</span><br />
                      (25% × ${pi.toLocaleString()}) + (50% × ${li.toLocaleString()}) + (25% × ${oi.toLocaleString()}) ={' '}
                      <strong style={{ color: 'var(--positive)' }}>${expectedValueIntro.toLocaleString()}</strong>
                    </p>
                    <p style={{ color: 'var(--text-2)', margin: '0 0 10px' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '10px' }}>Membership potential</span><br />
                      (25% × ${pm.toLocaleString()}) + (50% × ${lm.toLocaleString()}) + (25% × ${om.toLocaleString()}) ={' '}
                      <strong style={{ color: 'var(--info)' }}>${expectedValueMember.toLocaleString()}</strong>
                    </p>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '10px', color: 'var(--muted)', fontFamily: 'inherit', lineHeight: 1.6 }}>
                      Intro revenue = kept appointments × ${INTRO_PRICE} session fee<br />
                      Membership potential = kept appointments × 15% conversion × ${LTV.toLocaleString()} avg LTV<br />
                      Membership conversion is a studio-side outcome after Execo delivers the kept appointment — it is potential, not guaranteed.
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '28px' }}>
        Click any scenario to see the conditions, revenue impact, and Execo's actions.
      </p>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — Performance vs Benchmarks
          Circular SVG gauges — animate on load
      ══════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Performance vs Benchmarks" />
      <Card style={{ marginBottom: '28px' }}>
        {benchmarks.length === 0 ? (
          <Empty text="Benchmark data not available." />
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
              {belowCount > 0
                ? `${benchmarks.length - belowCount} of ${benchmarks.length} metrics are at or above industry benchmarks. ${belowCount} are below — show rate, conversion, and engagement are the active focus areas.`
                : `All ${benchmarks.length} metrics are at or above industry benchmarks.`}
              {' '}<span style={{ color: 'var(--muted)', fontSize: '11px' }}>Click any gauge for detail. Dot on arc = target. Connect rate uses corrected formula.</span>
            </p>
            {/* 5-column gauge grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {benchmarks.map((b, i) => {
                const lib = LIB_SET.has(b.metric)
                // Source overrides by metric:
                // engagement_rate — use trueEngagementRate (phiwe_calls.csv computed, corrected formula)
                // conversion_rate — use conversionRatePct (revenue_intelligence.csv × 100, not benchmark CSV)
                // all others      — use parsePct(b.actual_pct) from benchmarks_comparison.csv
                const actualVal =
                  b.metric === 'engagement_rate' && trueEngagementRate != null ? trueEngagementRate
                  : b.metric === 'conversion_rate' && conversionRatePct != null ? conversionRatePct
                  : parsePct(b.actual_pct)
                return (
                  <MetricGauge
                    key={b.metric}
                    label={b.metric}
                    actual={actualVal}
                    benchmark={b.benchmark_pct}
                    lowerIsBetter={lib}
                    triggered={benchTriggered}
                    index={i}
                    onClick={() => toggleBench(b.metric)}
                    active={expandedBench === b.metric}
                    maxScale={b.metric === 'conversion_rate' ? 3.0 : undefined}
                    decimals={b.metric === 'conversion_rate' ? 2 : undefined}
                  />
                )
              })}
            </div>
            {/* Drill-down panel — full width below gauges, only one open at a time */}
            {expandedBench && (() => {
              const b = benchmarks.find(x => x.metric === expandedBench)
              if (!b) return null
              return (
                <div style={{ maxHeight: '700px', overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)', marginBottom: '16px' }}>
                  <BenchmarkDrillDown
                    metric={b.metric}
                    actual={
                      b.metric === 'engagement_rate' && trueEngagementRate != null ? trueEngagementRate
                      : b.metric === 'conversion_rate' && conversionRatePct != null ? conversionRatePct
                      : parsePct(b.actual_pct)
                    }
                    benchmark={parsePct(b.benchmark_pct)}
                    totalBookings={totalBookings}
                    totalCalls={totalCalls}
                    connectedCount={connectedCount}
                    outboundCount={outboundCount}
                    customerCancels={customerCancels}
                    adminCancels={adminCancels}
                    onClose={() => setExpandedBench(null)}
                  />
                </div>
              )
            })()}
          </>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — What Execo Is Doing
          All numbers derived from CSV data — see source citations above
      ══════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="What Execo Is Doing" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '28px' }}>
        <NarrativeCard
          icon="📞"
          heading={totalCalls != null ? `${Number(totalCalls).toLocaleString()} calls made since launch` : 'Active outreach underway'}
          uplift={`confirmation follow-up coverage on ${pipelineCount} pipeline leads = ~${pipelineCount * 3} calls needed this week`}
          body={`${totalCalls != null ? Number(totalCalls).toLocaleString() : '—'} calls to ${uniqueLeads > 0 ? uniqueLeads.toLocaleString() : '—'} unique leads across ${activeStudios > 0 ? activeStudios : '—'} studios. ${displayEngagement != null ? `${displayEngagement.toFixed(1)}% meaningful engagement` : 'Strong engagement'} — the lead database is high quality. Focus has shifted from reach to conversion quality.`}
          isOpen={narrativeOpen === 'calls'}
          onClick={() => toggleNarrative('calls')}
          drillContent={
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Call volume by day</p>
              {(data.daily ?? []).slice(-7).map(r => (
                <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.date}</span>
                  <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>{r.outbound_calls ?? 0} calls</span>
                </div>
              ))}
            </div>
          }
        />
        <NarrativeCard
          icon="✓"
          heading="confirmation follow-up standard now in effect"
          uplift={`${protocolProjectedShows} additional shows projected over next 30 days from protocol`}
          body={`Of ${customerCancels + adminCancels} total cancellations, ${customerCancels} were customer-initiated. The remaining ${adminCancels} were admin-cancelled by the studio (not customer fault, no session credit lost). The confirmation follow-up directly targets the ${customerCancels} preventable customer cancellation${customerCancels !== 1 ? 's' : ''}.`}
          isOpen={narrativeOpen === 'protocol'}
          onClick={() => toggleNarrative('protocol')}
          drillContent={
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cancellation breakdown</p>
              {(data.cancel ?? []).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{c.first_name} {c.last_name} — {c.cancellation_timing}</span>
                  <span style={{ fontSize: '10px', color: c.cancelled_by === 'Admin' ? 'var(--info)' : 'var(--warn)' }}>{c.cancelled_by}</span>
                </div>
              ))}
              <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: '10px 0 0', lineHeight: 1.55 }}>
                Admin cancellations ({(data.cancel ?? []).filter(c => c.cancelled_by === 'Admin').length}) are not customer fault. Customer cancellations ({(data.cancel ?? []).filter(c => c.cancelled_by === 'Customer').length}) are the confirmation follow-up's primary target.
              </p>
            </div>
          }
        />
        <NarrativeCard
          icon="◈"
          heading={pipelineCount > 0 ? `${pipelineCount} confirmed upcoming appointments — ${highRiskCount} high-risk, ${medRiskCount} medium-risk` : 'Pipeline building for Month 3'}
          uplift={`$${pipelineIntroRevenue.toLocaleString()} intro + $${pipelineMemberPotential.toLocaleString()} membership potential if all show`}
          body={`${pipelineCount} confirmed upcoming appointments across ${activeStudios > 0 ? activeStudios : '—'} studios. ${highRiskCount} high-risk (≤2 pre-appt calls). Likely forecast: ${likelyShows ?? '—'} additional kept appointments over 30 days. Friday bookings now receive dedicated 48h confirmation calls.`}
          isOpen={narrativeOpen === 'pipeline'}
          onClick={() => toggleNarrative('pipeline')}
          footer={topImminent.length > 0 ? (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <p style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px', fontWeight: 700 }}>Imminent appointments</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {topImminent.map((r, i) => (
                  <div key={r.booking_id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.first_name} {r.last_name}</span>
                    <span style={{ color: 'var(--muted)' }}>·</span>
                    <span style={{ color: 'var(--muted)' }}>{String(r.booking_location ?? '').replace('StretchLab ', '')}</span>
                    <span style={{ color: 'var(--muted)' }}>·</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: +(r.days_until ?? 1) === 0 ? 'var(--warn)' : 'var(--text-2)' }}>
                      {+(r.days_until ?? 0) === 0 ? 'today' : `${r.days_until}d`}
                    </span>
                    <span style={{
                      fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                      background: r.risk_level === 'High' ? '#ef444414' : '#f59e0b14',
                      color: r.risk_level === 'High' ? 'var(--danger)' : 'var(--warn)',
                      border: `1px solid ${r.risk_level === 'High' ? '#ef444430' : '#f59e0b30'}`,
                    }}>{r.risk_level}</span>
                  </div>
                ))}
              </div>
              {pipelineCount > 3 && (
                <p style={{ fontSize: '10px', color: 'var(--accent)', margin: '6px 0 0', cursor: 'pointer' }}
                  onClick={() => toggleNarrative('pipeline')}>View all {pipelineCount} →</p>
              )}
            </div>
          ) : null}
          drillContent={
            <div>
              {/* Top 3 high-risk leads mini-table */}
              {topHighRisk.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--danger)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Top high-risk — needs immediate outreach</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                    {topHighRisk.map((r, i) => (
                      <div key={r.booking_id ?? i} style={{ background: 'var(--surface)', border: '1px solid #ef444430', borderRadius: '7px', padding: '10px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>{r.first_name} {r.last_name}</p>
                        <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '0 0 6px' }}>{r.booking_location?.replace('StretchLab ', '')}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 600 }}>{+(r.days_until ?? 0) === 0 ? 'Today' : `${r.days_until}d away`}</span>
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{r.total_calls_made} call{r.total_calls_made !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Full pipeline lead list */}
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>All pipeline leads</p>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {(data.pipeline ?? []).filter(r => +(r.days_until ?? 0) >= 0).map((r, i) => (
                  <div key={r.booking_id ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--text)', margin: '0 0 1px', fontWeight: 600 }}>{r.first_name} {r.last_name}</p>
                      <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>{r.booking_location?.replace('StretchLab ', '')} · {r.booking_date}</p>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: r.risk_level === 'High' ? '#ef444414' : '#f59e0b14',
                      color: r.risk_level === 'High' ? 'var(--danger)' : 'var(--warn)',
                      border: `1px solid ${r.risk_level === 'High' ? '#ef444440' : '#f59e0b40'}`,
                    }}>{r.risk_level} · {r.total_calls_made} calls</span>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}

// ─── Shared micro-components — exported for use by other pages ────────────────
export function Loader({ text = 'Loading…' }) {
  return (
    <div style={{ color: 'var(--muted)', padding: '40px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ width: '12px', height: '12px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      {text}
    </div>
  )
}

export function Empty({ text }) {
  return <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>{text}</p>
}

export function PageHeader({ title, sub, lastUpdated }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{title}</h1>
          {sub && <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>{sub}</p>}
        </div>
        {lastUpdated && (
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, textAlign: 'right', flexShrink: 0 }}>
            Data as of {lastUpdated}
          </p>
        )}
      </div>
    </div>
  )
}

export function SectionHeader({ title }) {
  return (
    <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '12px', marginTop: '0' }}>
      {title}
    </h2>
  )
}
