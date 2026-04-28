import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import {
  loadBookings,
  loadLeadFunnel,
  loadConversionTrends,
  loadVelocityTrend,
} from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

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

export default function PipelineReconciliation() {
  const { data, loading } = useMultiData({
    bookings: loadBookings,
    funnel: loadLeadFunnel,
    convTrends: loadConversionTrends,
    velTrend: loadVelocityTrend,
  })

  const bookings = data.bookings ?? []
  const funnel = data.funnel ?? []
  const convTrends = data.convTrends ?? []
  const velTrend = data.velTrend ?? []

  // Attribution donut data
  const attributionCounts = useMemo(() => {
    const counts = bookings.reduce((acc, b) => {
      const key = b.attribution_method ?? 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([method, count]) => ({ method, count }))
  }, [bookings])

  // Funnel: called → booked → showed
  const funnelMetrics = useMemo(() => {
    const total = funnel.length
    const withCalls = funnel.filter((r) => r.has_call_record).length
    const showed = funnel.filter((r) => r.has_show).length
    return [
      { stage: 'Called', count: withCalls },
      { stage: 'Booked', count: total },
      { stage: 'Showed', count: showed },
    ]
  }, [funnel])

  const promptText = useMemo(() => {
    if (loading) return ''
    return `Pipeline reconciliation:
Attribution breakdown: ${attributionCounts.map((a) => `${a.method}: ${a.count}`).join(', ')}.
Funnel: ${funnelMetrics.map((f) => `${f.stage}: ${f.count}`).join(' → ')}.
Conversion trend weeks: ${convTrends.length}.
Velocity trend weeks: ${velTrend.length}.
Write admin-facing reconciliation insight. Surface attribution uncertainty and data quality concerns.`
  }, [loading, attributionCounts, funnelMetrics, convTrends, velTrend])

  const { insight, loading: iL, error: iE, refresh } = useInsight('admin', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading pipeline data…</div>

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin)', marginBottom: '4px' }}>
        Pipeline Reconciliation
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Attribution breakdown, lead funnel, and conversion trend analysis
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Attribution */}
        <Card title="Attribution Breakdown">
          {attributionCounts.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No booking data.</p>
          ) : (
            <>
              <PlotRef
                buildFn={() =>
                  Plot.plot({
                    height: 220,
                    style: { background: 'transparent', color: 'var(--muted)' },
                    marks: [
                      Plot.barX(attributionCounts, {
                        x: 'count',
                        y: 'method',
                        fill: (d) => d.method === 'Direct' ? '#22c55e' : d.method === 'Tamryn Override' ? '#7F77DD' : '#6b8f74',
                        rx: 3,
                      }),
                      Plot.ruleX([0]),
                    ],
                    x: { label: 'Bookings', grid: true },
                    y: { label: null },
                  })
                }
                deps={[attributionCounts]}
              />
              {attributionCounts.map((a) => (
                <div key={a.method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--muted)' }}>{a.method}</span>
                  <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{a.count}</span>
                </div>
              ))}
            </>
          )}
        </Card>

        {/* Funnel */}
        <Card title="Lead Funnel">
          {funnelMetrics.map((f, i) => (
            <div key={f.stage} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text)' }}>{f.stage}</span>
                <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{f.count}</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: '4px', height: '6px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${funnelMetrics[0].count > 0 ? (f.count / funnelMetrics[0].count) * 100 : 0}%`,
                    background: i === 0 ? 'var(--info)' : i === 1 ? 'var(--warn)' : 'var(--accent)',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          ))}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>
            Conversion: {funnelMetrics[0].count > 0
              ? `${((funnelMetrics[2].count / funnelMetrics[0].count) * 100).toFixed(1)}%`
              : '—'} call-to-show
          </p>
        </Card>
      </div>

      {/* Conversion trend */}
      {convTrends.length > 0 && (
        <Card title="Week-over-Week Conversion Rate" style={{ marginBottom: '24px' }}>
          <PlotRef
            buildFn={() =>
              Plot.plot({
                height: 220,
                marginLeft: 50,
                style: { background: 'transparent', color: 'var(--muted)' },
                x: { label: 'Week', type: 'band' },
                y: { label: 'Booking Rate (%)', grid: true },
                marks: [
                  Plot.line(convTrends, {
                    x: 'week_start',
                    y: 'booking_rate_pct',
                    stroke: '#22c55e',
                    strokeWidth: 2,
                  }),
                  Plot.dot(convTrends, { x: 'week_start', y: 'booking_rate_pct', fill: '#22c55e', r: 4 }),
                  Plot.ruleY([0]),
                ],
              })
            }
            deps={[convTrends]}
          />
        </Card>
      )}

      {/* Velocity trend */}
      {velTrend.length > 0 && (
        <Card title="Avg Calls per Booking — Velocity Trend" style={{ marginBottom: '24px' }}>
          <PlotRef
            buildFn={() =>
              Plot.plot({
                height: 200,
                marginLeft: 50,
                style: { background: 'transparent', color: 'var(--muted)' },
                x: { label: 'Week' },
                y: { label: 'Avg Calls / Booking', grid: true },
                marks: [
                  Plot.line(velTrend, {
                    x: 'week_start',
                    y: 'avg_calls_per_booking',
                    stroke: 'var(--admin)',
                    strokeWidth: 2,
                  }),
                  Plot.dot(velTrend, { x: 'week_start', y: 'avg_calls_per_booking', fill: 'var(--admin)', r: 4 }),
                  Plot.ruleY([3], { stroke: 'var(--muted)', strokeDasharray: '4,4' }),
                ],
              })
            }
            deps={[velTrend]}
          />
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
            Dashed line = 3-call minimum SOW requirement
          </p>
        </Card>
      )}

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
