import React, { useMemo } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import {
  loadCampaignHealth,
  loadBookingOutcomes,
  loadByStudio,
  loadCohortAnalysis,
  loadCancellationAnalysis,
} from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

function Section({ heading, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ width: '3px', height: '20px', background: 'var(--accent)', borderRadius: '2px' }} />
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          {heading}
        </h2>
      </div>
      {children}
    </div>
  )
}

export default function Recommendations() {
  const { data, loading } = useMultiData({
    health: loadCampaignHealth,
    outcomes: loadBookingOutcomes,
    studios: loadByStudio,
    cohort: loadCohortAnalysis,
    cancellations: loadCancellationAnalysis,
  })

  const health = data.health?.[0] ?? {}
  const studios = useMemo(
    () => (data.studios ?? []).sort((a, b) => b.show_rate_pct - a.show_rate_pct),
    [data.studios]
  )

  const promptText = useMemo(() => {
    if (loading) return ''
    return `Campaign health: ${health.campaign_score}/100. Show rate: ${health.show_rate_pct}%. Cancel rate: ${health.cancel_rate_pct}%.
Top studio by show rate: ${studios[0]?.studio} (${studios[0]?.show_rate_pct?.toFixed(1)}%).
Bottom studio: ${studios[studios.length - 1]?.studio} (${studios[studios.length - 1]?.show_rate_pct?.toFixed(1)}%).
Cohort insight: same-week bookings have elevated cancel rates.
Cancellations: 100% had <3 call touchpoints.

Generate studio-owner strategy recommendations. Structure your response in exactly 3 clearly labeled sections:
THIS MONTH — 2-3 studio-side actions (e.g. Monday/Tuesday booking incentives, confirmation touchpoints, membership follow-up)
LONGER TERM — 1-2 structural suggestions (studio prioritisation, seasonal patterns)
WHAT TO WATCH — 2 leading indicators to track weekly

Write as a strategic partner, warm and specific. Do not give SDR or internal Execo operations advice.`
  }, [loading, health, studios])

  const { insight, loading: iL, error: iE, refresh } = useInsight('client', promptText, false)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading campaign data…</div>

  const hasInsight = !!insight

  // Parse sections from insight text if available
  const sections = useMemo(() => {
    if (!insight) return null
    const parts = insight.split(/(?=THIS MONTH|LONGER TERM|WHAT TO WATCH)/i)
    return parts.filter(Boolean)
  }, [insight])

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        Recommendations
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        AI-generated strategic recommendations for StretchLab studio operations
      </p>

      <Card style={{ marginBottom: '20px', borderLeft: '3px solid var(--accent)' }}>
        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
          These recommendations are generated from your campaign data and are specific to studio-side
          actions. They are updated each time you load this page with fresh data.
        </p>
      </Card>

      {!hasInsight && !iL && !iE && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
            Click below to generate your personalised recommendations.
          </p>
          <button
            onClick={refresh}
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Generate Recommendations
          </button>
        </div>
      )}

      {iL && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--muted)', fontSize: '14px' }}>
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--accent)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Generating your strategic recommendations…
        </div>
      )}

      {iE && (
        <Card style={{ borderLeft: '3px solid var(--danger)' }}>
          <p style={{ color: 'var(--danger)', fontSize: '13px' }}>Error: {iE}</p>
          <button
            onClick={refresh}
            style={{ marginTop: '10px', padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '12px' }}
          >
            Try Again
          </button>
        </Card>
      )}

      {hasInsight && sections && (
        <div className="fade-in">
          {sections.map((section, i) => (
            <Card key={i} style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                {section}
              </p>
            </Card>
          ))}
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <button
              onClick={refresh}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--muted)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '6px 14px',
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
