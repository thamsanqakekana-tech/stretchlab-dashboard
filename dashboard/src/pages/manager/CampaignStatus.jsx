import React, { useMemo } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import {
  loadCampaignHealth,
  loadRevenueIntelligence,
  loadBenchmarksComparison,
  loadValidationReport,
  loadCalls,
  loadBookings,
  loadRampVsTarget,
  loadCancellationAnalysis,
  pivotToObject,
  parsePct,
} from '../../utils/dataLoader.js'
import {
  BENCHMARKS,
  RAMP_TARGETS,
  COLD_OUTREACH_BENCHMARKS,
  CAMPAIGN_MONTHS,
  SESSION_INTRO_PRICE,
  MEMBERSHIP_MONTHLY_PRICE,
} from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import BenchmarkBar from '../../components/BenchmarkBar.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

const SOW_TARGET = RAMP_TARGETS[3]

const CHURN_COLORS = { HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--accent)' }

const sectionLabel = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', margin: '0 0 14px',
}

function bm(benchmarks, metricKey) {
  return parsePct(benchmarks.find(b => b.metric === metricKey)?.actual_pct)
}

// ─── SOW Progress Bar (inline, matches PartnershipActions pattern) ─────────────
function SowProgressBar({ confirmedShows, upcoming, showRate, deadline }) {
  const projectedFromUpcoming = Math.round(upcoming * (showRate / 100))
  const remaining             = Math.max(0, SOW_TARGET - confirmedShows - projectedFromUpcoming)
  const pctConfirmed  = (confirmedShows / SOW_TARGET) * 100
  const pctProjected  = (projectedFromUpcoming / SOW_TARGET) * 100

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600, margin: 0 }}>
          {confirmedShows} confirmed · {upcoming} upcoming · {remaining} still needed
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>Deadline: {deadline}</p>
      </div>
      <div style={{ height: '10px', borderRadius: '6px', background: 'var(--border)', overflow: 'hidden', display: 'flex', marginBottom: '12px' }}>
        <div style={{ width: `${pctConfirmed}%`, background: '#22c55e', transition: 'width 0.4s ease' }} />
        <div style={{ width: `${pctProjected}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text)' }}>{confirmedShows}</strong> confirmed shows</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text)' }}>{projectedFromUpcoming}</strong> projected from {upcoming} upcoming (at {(showRate).toFixed(0)}% show rate)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--border)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text)' }}>{remaining}</strong> still needed to hit {SOW_TARGET}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Health Score ────────────────────────────────────────────────────
function CampaignHealthScore({ convRate, bookingConvRate, showRate, adminRate }) {
  const normalize = (val, min, max) => Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100))
  const convScore    = normalize(convRate, 0, 18)
  const bookingScore = normalize(bookingConvRate, 0, COLD_OUTREACH_BENCHMARKS.booking_rate.max)
  const showScore    = normalize(showRate, 0, 15)
  const adminScore   = Math.max(0, 100 - normalize(adminRate * 100, 0, 30))
  const score        = Math.round(convScore * 0.20 + bookingScore * 0.30 + showScore * 0.30 + adminScore * 0.20)
  const color        = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label        = score >= 70 ? 'Strong' : score >= 50 ? 'Developing' : 'At Risk'

  return (
    <Card style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'center', minWidth: '80px' }}>
          <p style={{ fontSize: '48px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, margin: 0, lineHeight: 1 }}>
            {score}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>/ 100</p>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Campaign Health Score</p>
            <span style={{ fontSize: '11px', fontWeight: 700, color, background: `${color}18`, padding: '2px 8px', borderRadius: '4px' }}>
              {label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Connect rate <span style={{ color: 'var(--text)', fontWeight: 600 }}>{convRate.toFixed(1)}%</span> · 20%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Booking conv <span style={{ color: 'var(--text)', fontWeight: 600 }}>{bookingConvRate.toFixed(1)}%</span> · 30%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Show rate <span style={{ color: 'var(--text)', fontWeight: 600 }}>{showRate.toFixed(1)}%</span> · 30%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Admin disruption <span style={{ color: 'var(--text)', fontWeight: 600 }}>{(adminRate * 100).toFixed(1)}%</span> · 20% inverse
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: color, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Month-over-Month Comparison ──────────────────────────────────────────────
function MonthComparison({ ramp = [], upcoming = 0 }) {
  if (!ramp.length) return null

  const fmt = s => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <Card style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
        Month-over-Month — kept sessions vs target
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
        {CAMPAIGN_MONTHS.map((cm, i) => {
          const row    = ramp.find(r => +r.month === cm.num)
          const actual = row ? +row.actual_kept_appts : 0
          const pct    = cm.target > 0 ? Math.min((actual / cm.target) * 100, 100) : 0
          const isM3   = cm.num === 3
          const isLast = i === CAMPAIGN_MONTHS.length - 1
          const color  = pct >= 60 ? '#22c55e' : pct >= 30 ? '#f59e0b' : 'var(--muted)'
          const dateRange = `${fmt(cm.start)} – ${fmt(cm.end)}`

          return (
            <div key={cm.num} style={{
              borderRight: !isLast ? '1px solid var(--border)' : 'none',
              paddingRight: !isLast ? '20px' : '0',
              paddingLeft: i > 0 ? '20px' : '0',
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                {cm.label}
                {isM3 && <span style={{ marginLeft: '6px', color: 'var(--accent)', fontSize: '9px' }}>Active</span>}
              </p>
              <p style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color, margin: '0 0 2px', lineHeight: 1 }}>
                {actual}
                <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 400 }}> / {cm.target}</span>
              </p>
              <div style={{ height: '4px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden', margin: '8px 0' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                {dateRange} · {pct.toFixed(0)}% of target
                {isM3 && upcoming > 0 && ` · ${upcoming} upcoming`}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function CampaignStatus() {
  const { data, loading } = useMultiData({
    healthRows:    loadCampaignHealth,
    revenueRows:   loadRevenueIntelligence,
    benchmarks:    loadBenchmarksComparison,
    validation:    loadValidationReport,
    calls:         loadCalls,
    bookings:      loadBookings,
    ramp:          loadRampVsTarget,
    cancellations: loadCancellationAnalysis,
  })

  const health        = useMemo(() => pivotToObject(data.healthRows  ?? []), [data.healthRows])
  const revenue       = useMemo(() => pivotToObject(data.revenueRows ?? []), [data.revenueRows])
  const introPrice      = +(revenue.intro_price      ?? SESSION_INTRO_PRICE)
  const membershipPrice = +(revenue.membership_price ?? MEMBERSHIP_MONTHLY_PRICE)
  const benchmarks    = data.benchmarks    ?? []
  const validation    = data.validation   ?? {}
  const calls         = data.calls        ?? []
  const bookings      = data.bookings     ?? []
  const ramp          = data.ramp         ?? []
  const cancellations = data.cancellations ?? []

  // ── Legacy values (from benchmarks CSV — kept for BenchmarkBar compatibility) ──
  const campaignScore     = health.total_score ?? null
  const churnRisk         = (health.churn_risk ?? '').toUpperCase()
  const showRatePct       = bm(benchmarks, 'show_rate')
  const cancelRatePct     = bm(benchmarks, 'cancel_rate')
  const engagementRatePct = bm(benchmarks, 'engagement_rate')

  // ── Live values from raw data (for new sections) ──────────────────────────────
  const meaningfulConvs  = useMemo(() => calls.filter(c => parseFloat(c.live_talk_min || 0) >= 0.5).length, [calls])
  const totalCalls       = calls.length
  const convRate         = totalCalls > 0 ? (meaningfulConvs / totalCalls) * 100 : 0
  const bookingConvRate  = totalCalls > 0 ? (bookings.length / totalCalls) * 100 : 0
  const confirmedShows   = useMemo(() => bookings.filter(b => { const v = b.has_show; return v === true || v === 1 || String(v ?? '').trim() === '1' }).length, [bookings])
  const cancelledCustomer = useMemo(() => bookings.filter(b => { const s = String(b.current_status || ''); return s.includes('Cancelled Within Policy') || s.includes('Cancelled Outside Policy') }).length, [bookings])
  const cancelledAdminCs  = useMemo(() => bookings.filter(b => String(b.current_status || '').includes('Cancelled By Admin')).length, [bookings])
  const confirmedCancels  = cancelledCustomer + cancelledAdminCs
  const noShowCount       = bookings.filter(b => String(b.current_status ?? '').includes('No Show')).length
  const resolved          = confirmedShows + noShowCount + confirmedCancels
  const showRate          = resolved > 0 ? (confirmedShows / resolved) * 100 : 0
  const cancelRate        = bookings.length > 0 ? (confirmedCancels / bookings.length) * 100 : 0
  const upcoming          = useMemo(() => bookings.filter(b => {
    const s = String(b.current_status || '')
    return (parseInt(b.is_future) === 1 || b.is_future === true) && !s.includes('Cancelled')
  }).length, [bookings])

  const adminCancelled    = useMemo(() => cancellations.filter(c => c.cancelled_by === 'Admin').length, [cancellations])
  const customerCancelled = useMemo(() => cancellations.filter(c => c.cancelled_by === 'Customer').length, [cancellations])
  const adminRate         = bookings.length > 0 ? adminCancelled / bookings.length : 0

  const showGap    = validation?.show_gaps?.gap_count ?? 0
  const bookingGap = Math.abs(validation?.drift?.gap_bookings ?? 0)

  const activeMilestone = useMemo(() => {
    const today = new Date()
    const m = CAMPAIGN_MONTHS.find(m =>
      today >= new Date(m.start + 'T00:00:00') && today <= new Date(m.end + 'T23:59:59')
    )
    return m?.label ?? null
  }, [])

  const cancelRangeLabel = cancelRate <= COLD_OUTREACH_BENCHMARKS.cancel_rate.max
    ? 'within cold range'
    : 'above cold range — monitor'
  const showRangeLabel = showRatePct >= COLD_OUTREACH_BENCHMARKS.show_rate.max
    ? 'above cold range'
    : showRatePct >= COLD_OUTREACH_BENCHMARKS.show_rate.min
    ? 'within cold range'
    : 'below cold range'

  const bookingRangeLabel = bookingConvRate >= COLD_OUTREACH_BENCHMARKS.booking_rate.max
    ? 'above cold range'
    : bookingConvRate >= COLD_OUTREACH_BENCHMARKS.booking_rate.min
    ? 'within cold range'
    : 'below cold range'

  const driftPct = validation?.drift?.booking_drift_pct ?? 0
  const hasDrift = Math.abs(driftPct) > 5

  // ── AI insight prompt (updated with cold benchmarks and Month 3) ──────────────
  const promptText = useMemo(() => {
    if (loading) return ''
    return `Campaign manager status — internal Execo view.
Conversation rate: ${convRate.toFixed(1)}% (cold outreach benchmark 10–18% — ABOVE ceiling).
Booking conversion: ${bookingConvRate.toFixed(1)}% (bookings÷total calls; cold outreach benchmark ${COLD_OUTREACH_BENCHMARKS.booking_rate.min}–${COLD_OUTREACH_BENCHMARKS.booking_rate.max}% — ${bookingRangeLabel.toUpperCase()}).
Show rate: ${showRatePct.toFixed(1)}% (pipeline-authoritative; cold outreach benchmark ${COLD_OUTREACH_BENCHMARKS.show_rate.min}–${COLD_OUTREACH_BENCHMARKS.show_rate.max}% — ${showRangeLabel.toUpperCase()}).
Cancel rate: ${cancelRate.toFixed(1)}% (cold outreach benchmark 20–35% — ${cancelRangeLabel.toUpperCase()}).
Total calls: ${totalCalls.toLocaleString()}. Meaningful conversations: ${meaningfulConvs.toLocaleString()}.
Bookings: ${bookings.length}. Confirmed shows: ${confirmedShows}. Upcoming: ${upcoming}.
${adminCancelled} admin-initiated cancellations (cancelled_by=Admin in ClubReady) and ${customerCancelled} customer-initiated cancellations. Admin disruptions are the primary show-rate suppressor.
Without admin cancellations, hypothetical show rate = ~${bookings.length > 0 ? (((confirmedShows + adminCancelled) / bookings.length) * 100).toFixed(0) : 0}%.
Churn risk: ${churnRisk}.
Booking drift vs internal tracker: ${driftPct}%.
Month 3 SOW target: ${RAMP_TARGETS[3]} kept appointments by ${new Date(CAMPAIGN_MONTHS[CAMPAIGN_MONTHS.length-1].end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
Write the manager-facing campaign status insight. Be direct. Acknowledge what EXECO controls (conversation, booking, show rate — all above/within cold benchmark). Identify what StretchLab must fix (admin disruptions, ClubReady logging). State Month 3 path.`
  }, [loading, convRate, bookingConvRate, showRatePct, cancelRate, totalCalls, meaningfulConvs, bookings.length, confirmedShows, upcoming, churnRisk, driftPct, adminCancelled, customerCancelled, showRangeLabel, bookingRangeLabel, cancelRangeLabel])

  const { insight, loading: iL, error: iE, refresh } = useInsight('manager', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading campaign status…</div>

  const scoreColor = campaignScore >= 70 ? 'var(--positive)' : campaignScore >= 50 ? 'var(--warn)' : 'var(--danger)'

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Campaign Status
        </h1>
        {campaignScore != null && (
          <span style={{
            padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
            background: campaignScore >= 70 ? '#22c55e22' : campaignScore >= 50 ? '#f59e0b22' : '#ef444422',
            color: campaignScore >= 70 ? 'var(--positive)' : campaignScore >= 50 ? 'var(--warn)' : 'var(--danger)',
          }}>
            {health.level ?? (campaignScore >= 70 ? 'GREEN' : campaignScore >= 50 ? 'YELLOW' : 'RED')}
          </span>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
        Internal view — Execo manager access only · Toggle to "client" in the top bar to preview what StretchLab sees
      </p>

      {/* Churn risk banner */}
      {churnRisk && (
        <div style={{
          background: `${CHURN_COLORS[churnRisk] ?? 'var(--warn)'}18`,
          border: `1px solid ${CHURN_COLORS[churnRisk] ?? 'var(--warn)'}`,
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
            Churn Risk: <span style={{ color: CHURN_COLORS[churnRisk] ?? 'var(--warn)' }}>{churnRisk}</span>
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Based on show rate, cancel rate, engagement trends</span>
        </div>
      )}

      {/* Data drift warning */}
      {hasDrift && (
        <div style={{
          background: '#f59e0b18', border: '1px solid var(--warn)',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--warn)', fontWeight: 600 }}>
            Data Drift: {driftPct > 0 ? '+' : ''}{driftPct}% vs internal tracker
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '12px' }}>
            {validation?.drift?.gap_direction === 'manual_has_more'
              ? 'Internal tracker shows more bookings than system — 4 missing from ClubReady'
              : 'System shows more bookings than internal tracker'}
          </span>
        </div>
      )}

      {/* ── Cold outreach benchmark strip ──────────────────────────────────── */}
      <Card title="Cold Outreach Benchmarks · Dormant Leads 6–12 Months Inactive" style={{ marginBottom: '24px' }}>
        <BenchmarkBar
          label="Connect Rate"
          actual={convRate}
          benchmark={COLD_OUTREACH_BENCHMARKS.connect_rate.max}
          tooltip="Calls with 30s+ real two-way conversation. Cold outreach benchmark: 10–18%. Above ceiling = exceptional."
        />
        <BenchmarkBar
          label="Booking Conversion"
          actual={bookingConvRate}
          benchmark={COLD_OUTREACH_BENCHMARKS.booking_rate.max}
          tooltip={`Total bookings ÷ total calls dialled. Cold outreach benchmark: ${COLD_OUTREACH_BENCHMARKS.booking_rate.min}–${COLD_OUTREACH_BENCHMARKS.booking_rate.max}%.`}
        />
        <BenchmarkBar
          label="Show Rate"
          actual={showRatePct}
          benchmark={COLD_OUTREACH_BENCHMARKS.show_rate.max}
          tooltip={`Attended ÷ resolved appointments (pipeline-authoritative). Cold outreach benchmark: ${COLD_OUTREACH_BENCHMARKS.show_rate.min}–${COLD_OUTREACH_BENCHMARKS.show_rate.max}%.`}
        />
        <BenchmarkBar
          label="Cancel Rate"
          actual={cancelRate}
          benchmark={COLD_OUTREACH_BENCHMARKS.cancel_rate.min}
          lowerIsBetter
          tooltip="Cold outreach cancel rate: 20–35% expected for dormant leads. Lower is better. Admin-initiated disruptions are the primary driver here."
        />
      </Card>

      {/* ── Fresh-lead benchmark comparison (manager context only) ────────── */}
      <Card style={{ marginBottom: '24px', borderLeft: '3px solid #f59e0b' }}>
        <p style={{ ...sectionLabel, color: '#f59e0b' }}>
          Context: Why Cold Outreach Benchmarks — Not Fresh-Lead Standards
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>

          <div style={{ borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
              Cold Outreach Standard (this campaign)
            </p>
            <ul style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.9, margin: 0, padding: '0 0 0 14px' }}>
              <li>Conversation rate: {COLD_OUTREACH_BENCHMARKS.connect_rate.min}–{COLD_OUTREACH_BENCHMARKS.connect_rate.max}%</li>
              <li>Booking conversion: {COLD_OUTREACH_BENCHMARKS.booking_rate.min}–{COLD_OUTREACH_BENCHMARKS.booking_rate.max}%</li>
              <li>Show rate: {COLD_OUTREACH_BENCHMARKS.show_rate.min}–{COLD_OUTREACH_BENCHMARKS.show_rate.max}%</li>
              <li>Cancel rate: {COLD_OUTREACH_BENCHMARKS.cancel_rate.min}–{COLD_OUTREACH_BENCHMARKS.cancel_rate.max}%</li>
            </ul>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.6 }}>
              Calibrated for dormant leads 6–12 months inactive. If Brian ever compares to industry norms, these are the correct benchmarks to cite.
            </p>
          </div>

          <div style={{ borderRight: '1px solid var(--border)', padding: '0 20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
              Fresh-Lead Standard (for context — not this campaign)
            </p>
            <ul style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.9, margin: 0, padding: '0 0 0 14px' }}>
              <li>Conversation rate: 50–70%</li>
              <li>Booking conversion: 1.5–3%</li>
              <li>Show rate: 25–40%</li>
              <li>Cancel rate: 10–15%</li>
            </ul>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.6 }}>
              Fresh studio inquiries (0–14 days). Higher show rate because the lead is still excited. Irrelevant for a cold revival campaign.
            </p>
          </div>

          <div style={{ paddingLeft: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
              Phiwe's Actuals
            </p>
            <ul style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.9, margin: 0, padding: '0 0 0 14px' }}>
              <li>Conversation rate: <strong style={{ color: '#22c55e' }}>{convRate.toFixed(1)}%</strong> — above cold ceiling</li>
              <li>Booking conversion: <strong style={{ color: '#22c55e' }}>{bookingConvRate.toFixed(1)}%</strong> — {bookingRangeLabel}</li>
              <li>Show rate: <strong style={{ color: 'var(--accent)' }}>{showRatePct.toFixed(1)}%</strong> — {showRangeLabel}</li>
              <li>Cancel rate: <strong style={{ color: cancelRate > COLD_OUTREACH_BENCHMARKS.cancel_rate.max ? 'var(--warn)' : 'var(--accent)' }}>{cancelRate.toFixed(1)}%</strong> — {cancelRangeLabel}</li>
            </ul>
            <p style={{ fontSize: '11px', color: cancelRate > COLD_OUTREACH_BENCHMARKS.cancel_rate.max ? 'var(--warn)' : '#22c55e', fontWeight: 600, marginTop: '8px' }}>
              {cancelRate > COLD_OUTREACH_BENCHMARKS.cancel_rate.max
                ? `Connect rate, booking conversion, and show rate above cold outreach standard. Cancel rate elevated — admin disruptions are the primary driver.`
                : 'All 4 EXECO-controlled metrics at or above cold outreach standard.'}
            </p>
          </div>

        </div>
      </Card>

      {/* ── Revenue / ROI ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '24px', borderLeft: '3px solid #22c55e' }}>
        <p style={{ ...sectionLabel, color: '#22c55e' }}>
          Revenue Intelligence · Contractual KPI · Manager View Only
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '14px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px' }}>Confirmed Shows</p>
            <p style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', margin: '0 0 3px' }}>
              {confirmedShows}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Intro sessions attended</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px' }}>Intro Revenue (confirmed)</p>
            <p style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', margin: '0 0 3px' }}>
              ${(confirmedShows * introPrice).toLocaleString()}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{confirmedShows} × ${introPrice} intro session</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px' }}>Membership Potential</p>
            <p style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', margin: '0 0 3px' }}>
              ${(confirmedShows * membershipPrice).toLocaleString()}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>If all {confirmedShows} convert @ ${membershipPrice}/mo</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px' }}>Pipeline Revenue (upcoming)</p>
            <p style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#38bdf8', margin: '0 0 3px' }}>
              ${(upcoming * introPrice).toLocaleString()}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>If all {upcoming} upcoming appointments show</p>
          </div>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '10px', margin: 0 }}>
          Revenue figures are directional. Intro session = ${introPrice}. Monthly membership = ${membershipPrice} average. Not for client-facing reporting.
        </p>
      </Card>

      {/* ── SOW Ramp Progress ─────────────────────────────────────────────── */}
      <Card title={`SOW Ramp Progress · Target ${RAMP_TARGETS[3]} Kept Appointments by ${new Date(CAMPAIGN_MONTHS[CAMPAIGN_MONTHS.length-1].end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`} style={{ marginBottom: '24px' }}>
        <SowProgressBar
          confirmedShows={confirmedShows}
          upcoming={upcoming}
          showRate={showRatePct}
          deadline={new Date(CAMPAIGN_MONTHS[2].end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
          {CAMPAIGN_MONTHS.map(cm => {
            const today = new Date()
            const endDate = new Date(cm.end + 'T23:59:59')
            const startDate = new Date(cm.start + 'T00:00:00')
            const fmt = s => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const m = {
              label: cm.label,
              target: cm.target,
              range: `${fmt(cm.start)} – ${fmt(cm.end)}`,
              done: endDate < today,
              active: cm.label === activeMilestone,
            }
            return (
              <div key={m.label} style={{
                textAlign: 'center', padding: '10px 12px',
                background: 'var(--bg)', borderRadius: '8px',
                border: m.active ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}>
                <p style={{ fontSize: '10px', color: m.active ? 'var(--accent)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px', fontWeight: m.active ? 700 : 400 }}>{m.label}</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: m.done ? '#22c55e' : 'var(--text)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 2px' }}>{m.target}</p>
                <p style={{ fontSize: '10px', color: 'var(--muted)' }}>{m.range}</p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Campaign Health Score ─────────────────────────────────────────── */}
      <CampaignHealthScore
        convRate={convRate}
        bookingConvRate={bookingConvRate}
        showRate={showRatePct}
        adminRate={adminRate}
      />

      {/* ── Month-over-Month ──────────────────────────────────────────────── */}
      <MonthComparison ramp={ramp} upcoming={upcoming} />

      {/* ── System vs Manual Validation ───────────────────────────────────── */}
      {validation?.system_metrics && (
        <Card title="System vs Manual Validation" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>System (ClubReady)</p>
              {Object.entries(validation.system_metrics).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Manual (Tamryn's tracker)</p>
              {Object.entries(validation.manual_metrics ?? {}).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>
            Status:{' '}
            <span style={{ color: validation.status === 'expected' ? 'var(--accent)' : 'var(--warn)', fontWeight: 600, textTransform: 'uppercase' }}>
              {validation.status}
            </span>
            {' '}· Gap: {validation?.drift?.gap_bookings ?? 0} bookings in internal tracker not in ClubReady
          </p>
        </Card>
      )}

      {/* ── Meeting Prep — Tamryn's Brian call prep ───────────────────────── */}
      <Card style={{ marginBottom: '24px', borderLeft: '3px solid var(--accent)' }}>
        <p style={{ ...sectionLabel, color: 'var(--accent)' }}>
          Meeting Prep · Key Points for Brian
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>

          <div style={{ borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
              Lead With This
            </p>
            <ul style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.9, margin: 0, padding: '0 0 0 14px' }}>
              <li>{totalCalls.toLocaleString()} calls made — campaign fully operational</li>
              <li>{convRate.toFixed(1)}% conversation rate — above cold outreach ceiling</li>
              <li>{bookingConvRate.toFixed(1)}% booking conversion — {bookingRangeLabel} of cold outreach standard</li>
              <li>{bookings.length} appointments booked from dormant leads</li>
              <li>{upcoming} upcoming appointments still in pipeline</li>
            </ul>
          </div>

          <div style={{ borderRight: '1px solid var(--border)', padding: '0 20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
              Address Proactively
            </p>
            <ul style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.9, margin: 0, padding: '0 0 0 14px' }}>
              <li>{adminCancelled} admin-initiated cancellations reducing show rate ({customerCancelled} customer-initiated)</li>
              <li>Without admin cancels: show rate ~{bookings.length > 0 ? (((confirmedShows + adminCancelled) / bookings.length) * 100).toFixed(0) : '—'}% (vs {showRatePct.toFixed(1)}% current)</li>
              <li>{showGap > 0 ? `${showGap} show${showGap !== 1 ? 's' : ''} differ between internal tracker and system` : 'Internal tracker and system show counts aligned'}</li>
              <li>{bookingGap > 0 ? `${bookingGap} booking gap between tracker and ClubReady` : 'Booking counts aligned between tracker and ClubReady'}</li>
            </ul>
          </div>

          <div style={{ paddingLeft: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
              Month 3 Ask
            </p>
            <ul style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.9, margin: 0, padding: '0 0 0 14px' }}>
              <li>Update ClubReady within 24h of each appointment</li>
              <li>Review flexologist scheduling at Bunker Hill + Shreveport</li>
              <li>Pre-notification to EXECO when admin needs to cancel</li>
              <li>SOW target: {RAMP_TARGETS[3]} kept appointments by {new Date(CAMPAIGN_MONTHS[CAMPAIGN_MONTHS.length-1].end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</li>
            </ul>
          </div>

        </div>
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
