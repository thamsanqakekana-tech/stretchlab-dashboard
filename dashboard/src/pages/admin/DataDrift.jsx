import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadValidationReport } from '../../utils/dataLoader.js'
import { VALIDATION_THRESHOLDS } from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

function DriftBadge({ pct }) {
  const abs = Math.abs(pct)
  const color = abs < 5 ? 'var(--accent)' : abs < 10 ? 'var(--warn)' : 'var(--danger)'
  const label = abs < 5 ? 'Minimal' : abs < 10 ? 'Moderate' : 'High'
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: '99px',
        border: `1px solid ${color}`,
        fontSize: '10px',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label} ({pct > 0 ? '+' : ''}{pct}%)
    </span>
  )
}

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

export default function DataDrift() {
  const { data: validation, loading } = useData(loadValidationReport)

  const sysMetrics = validation?.system_metrics ?? {}
  const manualMetrics = validation?.manual_metrics ?? {}
  const drift = validation?.drift ?? {}

  const comparisonRows = useMemo(() => {
    const keys = Object.keys(sysMetrics)
    return keys.map((k) => ({
      metric: k.replace(/_/g, ' '),
      system: sysMetrics[k],
      manual: manualMetrics[k] ?? '—',
      gap: typeof sysMetrics[k] === 'number' && typeof manualMetrics[k] === 'number'
        ? sysMetrics[k] - manualMetrics[k]
        : null,
    }))
  }, [sysMetrics, manualMetrics])

  // Chart data
  const chartData = comparisonRows
    .filter((r) => typeof r.system === 'number' && typeof r.manual === 'number')
    .flatMap((r) => [
      { metric: r.metric, source: 'System', value: r.system },
      { metric: r.metric, source: 'Manual', value: r.manual },
    ])

  const promptText = useMemo(() => {
    if (!validation) return ''
    return `Data drift analysis:
System bookings: ${sysMetrics.total_bookings}, Manual bookings: ${manualMetrics.total_bookings}.
Drift: ${drift.booking_drift_pct}% (${drift.gap_direction}).
Gap: ${drift.gap_bookings} bookings.
Status: ${validation.status}.
Thresholds: acceptable drift <${VALIDATION_THRESHOLDS.manual_tracker_drift_pct}%.
Write admin-facing data quality insight. Surface attribution uncertainty and what this means for client trust.`
  }, [validation, sysMetrics, manualMetrics, drift])

  const { insight, loading: iL, error: iE, refresh } = useInsight('admin', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading validation data…</div>
  if (!validation) return <div style={{ color: 'var(--muted)', padding: '40px' }}>No validation report found. Run pipeline with internal tracker to generate.</div>

  const driftPct = drift.booking_drift_pct ?? 0
  const absD = Math.abs(driftPct)

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin)', margin: 0 }}>
          Data Drift
        </h1>
        <DriftBadge pct={driftPct} />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        System vs internal tracker comparison — admin view
      </p>

      {/* Status banner */}
      <div
        style={{
          background: absD < VALIDATION_THRESHOLDS.manual_tracker_drift_pct ? '#22c55e18' : '#f59e0b18',
          border: `1px solid ${absD < VALIDATION_THRESHOLDS.manual_tracker_drift_pct ? 'var(--accent)' : 'var(--warn)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '13px',
        }}
      >
        <strong style={{ color: absD < VALIDATION_THRESHOLDS.manual_tracker_drift_pct ? 'var(--accent)' : 'var(--warn)' }}>
          Status: {validation.status?.toUpperCase() ?? 'UNKNOWN'}
        </strong>
        {validation.status === 'expected' && (
          <span style={{ color: 'var(--muted)', marginLeft: '12px' }}>
            Internal tracker counts appointments in both months. System counts unique booking IDs attributed to Phiwe.
            Gap is expected and accounts for rescheduled appointments counted in both months.
          </span>
        )}
      </div>

      {/* Side-by-side table */}
      <Card title="System vs Manual Comparison" style={{ marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {['Metric', 'System', 'Manual', 'Gap'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text)', textTransform: 'capitalize' }}>{row.metric}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{row.system}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>{row.manual}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', color: row.gap == null ? 'var(--muted)' : row.gap === 0 ? 'var(--accent)' : 'var(--warn)', fontWeight: row.gap != null ? 600 : 400 }}>
                  {row.gap == null ? '—' : row.gap > 0 ? `+${row.gap}` : row.gap}
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg)' }}>
              <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 700 }}>Booking Drift</td>
              <td colSpan={2} style={{ padding: '10px 12px', color: 'var(--muted)' }}>—</td>
              <td style={{ padding: '10px 12px' }}>
                <DriftBadge pct={driftPct} />
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card title="System vs Manual — Visual Comparison" style={{ marginBottom: '24px' }}>
          <PlotRef
            buildFn={() =>
              Plot.plot({
                marginLeft: 140,
                height: 220,
                style: { background: 'transparent', color: 'var(--muted)' },
                x: { label: 'Count', grid: true },
                y: { label: null },
                color: { domain: ['System', 'Manual'], range: ['#22c55e', '#6b8f74'] },
                marks: [
                  Plot.barX(chartData, { x: 'value', y: 'metric', fill: 'source', fy: 'source', rx: 3 }),
                  Plot.ruleX([0]),
                ],
              })
            }
            deps={[chartData]}
          />
        </Card>
      )}

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
