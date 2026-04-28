import React, { useMemo } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import {
  loadRootCauseAnalysis,
  loadCampaignHealth,
  loadPipeline,
  loadCalls,
  loadBookings,
  pivotToObject,
} from '../../utils/dataLoader.js'
import { COLD_OUTREACH_BENCHMARKS } from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

export default function ActionPlan() {
  const { data, loading } = useMultiData({
    rootCause: loadRootCauseAnalysis,
    health: loadCampaignHealth,
    pipeline: loadPipeline,
    calls: loadCalls,
    bookings: loadBookings,
  })

  const rc       = data.rootCause ?? {}
  const health   = useMemo(() => pivotToObject(data.health ?? []), [data.health])
  const pipeline = data.pipeline ?? []
  const calls    = data.calls    ?? []
  const bookings = data.bookings ?? []

  const meaningfulConvs = useMemo(() => calls.filter(c => parseFloat(c.live_talk_min || 0) >= 0.5).length, [calls])
  const totalCalls = calls.length
  const convRate = totalCalls > 0 ? (meaningfulConvs / totalCalls) * 100 : 0
  const bookingConvRate = meaningfulConvs > 0 ? (bookings.length / meaningfulConvs) * 100 : 0
  const confirmedShows = bookings.filter(b => +b.has_show === 1).length
  const upcoming = bookings.filter(b => +b.is_future === 1 && b.booking_outcome !== 'Cancelled').length

  const pipelineCounts = useMemo(() => {
    return pipeline.reduce(
      (acc, r) => {
        acc[r.risk_level] = (acc[r.risk_level] ?? 0) + 1
        return acc
      },
      { High: 0, Medium: 0, Low: 0 }
    )
  }, [pipeline])

  const promptText = useMemo(() => {
    if (loading) return ''
    const highRisk = pipeline.filter((r) => r.risk_level === 'High')
    return `INTERNAL EXECO MANAGER ACTION PLAN — not for client sharing.

Campaign health: ${health.total_score ?? '62'}/100. Churn risk: ${(health.churn_risk ?? 'MEDIUM').toUpperCase()}.

COLD OUTREACH BENCHMARKS (dormant leads 6–12 months — the correct standard for this campaign):
- Conversation rate: 10–18% → Phiwe at ${convRate.toFixed(1)}% (ABOVE ceiling)
- Booking conversion: 2–5% → Phiwe at ${bookingConvRate.toFixed(1)}% (ABOVE ceiling)
- Show rate: 8–15% → ${bookings.length > 0 ? ((confirmedShows / bookings.length) * 100).toFixed(1) : '0'}% (within range)
- Cancel rate: 20–35% → ${bookings.length > 0 ? ((bookings.filter(b => +b.is_cancelled === 1).length / bookings.length) * 100).toFixed(1) : '0'}% (within range)

6 admin-initiated cancellations (cancelled_by=Admin in ClubReady) suppressing show rate — not call quality.

Pipeline risk: ${pipelineCounts.High} HIGH, ${pipelineCounts.Medium} MEDIUM, ${pipelineCounts.Low} LOW.
High risk leads: ${highRisk.map((r) => `${r.first_name} ${r.last_name} (${r.days_until}d, ${r.total_calls_made} calls)`).join('; ')}.

Month 3 SOW target: 77 kept appointments by May 24 (currently ${confirmedShows} confirmed + ${upcoming} upcoming).
SOW commitments: 3-call minimum before booking, <14-day booking windows, Friday pre-call protocol.

Generate internal action plan for Execo managers. Structure EXACTLY as:
TODAY — SDR-specific actions (name high-risk leads to call before 2pm)
THIS WEEK — 3 protocol changes with named owners
CLIENT REVIEW PREP — what to tell Brian at next check-in (honest data re admin disruptions, cold benchmark framing, positive tone)
PROCESS CHANGE — 1 permanent protocol update to implement immediately (focus on admin disruption prevention)

Be direct. Use specific names, times, numbers. Reference the 6 admin cancellations and what Tamryn should ask Brian to fix (flexologist scheduling and pre-notification protocol).`
  }, [loading, health, rc, pipeline, pipelineCounts, convRate, bookingConvRate, confirmedShows, upcoming])

  const { insight, loading: iL, error: iE, refresh } = useInsight('manager', promptText, false)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading campaign data…</div>

  const sections = useMemo(() => {
    if (!insight) return null
    return insight.split(/(?=TODAY|THIS WEEK|CLIENT REVIEW PREP|PROCESS CHANGE)/i).filter(Boolean)
  }, [insight])

  const SECTION_COLORS = {
    TODAY: 'var(--danger)',
    'THIS WEEK': 'var(--warn)',
    'CLIENT REVIEW': 'var(--accent)',
    'PROCESS CHANGE': 'var(--admin)',
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        Action Plan
      </h1>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          borderRadius: '6px',
          background: '#7F77DD22',
          border: '1px solid var(--admin)',
          marginBottom: '28px',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--admin)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Internal Only — Execo Managers
        </span>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>High Risk</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--danger)', fontFamily: 'JetBrains Mono' }}>{pipelineCounts.High}</p>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Call today</p>
        </Card>
        <Card>
          <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Cancel Rate</p>
          {(() => {
            const cancelRatePct = bookings.length > 0 ? (bookings.filter(b => +b.is_cancelled === 1).length / bookings.length) * 100 : 0
            return (
              <>
                <p style={{ fontSize: '28px', fontWeight: 700, color: cancelRatePct > COLD_OUTREACH_BENCHMARKS.cancel_rate.max ? 'var(--warn)' : 'var(--accent)', fontFamily: 'JetBrains Mono' }}>
                  {cancelRatePct.toFixed(1)}%
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Cold standard: 20–35%</p>
              </>
            )
          })()}
        </Card>
        <Card>
          <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Month 3 Target</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>77</p>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Kept appointments by May 24</p>
        </Card>
        <Card>
          <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Campaign Score</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: +(health.total_score ?? 0) >= 70 ? 'var(--accent)' : 'var(--warn)', fontFamily: 'JetBrains Mono' }}>
            {health.total_score ?? '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>/100</p>
        </Card>
      </div>

      <Card style={{ marginBottom: '20px', borderLeft: '3px solid var(--warn)' }}>
        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
          AI-generated internal action plan based on live campaign data. Includes SDR call targets,
          protocol updates, and client review preparation. Refresh each morning before the daily standup.
        </p>
      </Card>

      {!insight && !iL && !iE && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
            Generate today&apos;s action plan from current pipeline data.
          </p>
          <button
            onClick={refresh}
            style={{
              background: 'var(--warn)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Generate Action Plan
          </button>
        </div>
      )}

      {iL && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--muted)', fontSize: '14px' }}>
          <span style={{ width: '16px', height: '16px', border: '2px solid var(--warn)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Building action plan…
        </div>
      )}

      {iE && (
        <Card style={{ borderLeft: '3px solid var(--danger)' }}>
          <p style={{ color: 'var(--danger)', fontSize: '13px' }}>Error: {iE}</p>
          <button onClick={refresh} style={{ marginTop: '10px', padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '12px' }}>
            Retry
          </button>
        </Card>
      )}

      {insight && sections && (
        <div className="fade-in">
          {sections.map((section, i) => {
            const firstLine = section.split('\n')[0].toUpperCase()
            const sectionColor = Object.entries(SECTION_COLORS).find(([k]) => firstLine.includes(k))?.[1] ?? 'var(--text)'
            return (
              <Card key={i} style={{ marginBottom: '14px', borderLeft: `3px solid ${sectionColor}` }}>
                <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {section}
                </p>
              </Card>
            )
          })}
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <button onClick={refresh} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: '6px 14px' }}>
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
