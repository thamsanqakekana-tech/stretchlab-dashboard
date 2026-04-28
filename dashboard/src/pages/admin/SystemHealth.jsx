import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import {
  loadCampaignHealth,
  loadRevenueIntelligence,
  loadDailyPerformance,
  loadBenchmarksComparison,
  pivotToObject,
  parsePct,
} from '../../utils/dataLoader.js'
import { CLIENT_HIDDEN_METRICS } from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import BenchmarkBar from '../../components/BenchmarkBar.jsx'
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

function MetaRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontFamily: mono ? 'JetBrains Mono, monospace' : undefined, fontWeight: 500, fontSize: mono ? '12px' : '13px' }}>
        {value}
      </span>
    </div>
  )
}

export default function SystemHealth() {
  const { data, loading } = useMultiData({
    healthRows:  loadCampaignHealth,
    revenueRows: loadRevenueIntelligence,
    daily:       loadDailyPerformance,
    benchmarks:  loadBenchmarksComparison,
  })

  const health  = useMemo(() => pivotToObject(data.healthRows  ?? []), [data.healthRows])
  const revenue = useMemo(() => pivotToObject(data.revenueRows ?? []), [data.revenueRows])
  const daily      = data.daily      ?? []
  const benchmarks = data.benchmarks ?? []

  // Last 14 days
  const recent14 = useMemo(() => {
    if (!daily.length) return []
    return [...daily]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 14)
      .reverse()
  }, [daily])

  const promptText = useMemo(() => {
    if (loading) return ''
    return `System health data:
Files loaded, row counts: calls ${revenue.total_calls ?? 'N/A'}, bookings ${revenue.total_bookings ?? 'N/A'}.
Campaign score: ${health.total_score}/100. Level: ${health.level}. Churn risk: ${health.churn_risk}.
Full benchmarks: ${benchmarks.map((b) => `${b.metric} ${parsePct(b.actual_pct)}% vs ${b.benchmark_pct}%`).join('; ')}.
Hidden from client: ${CLIENT_HIDDEN_METRICS.join(', ')}.
Write admin insight: what the full data reveals that the client view does not show. Include data quality notes.`
  }, [loading, health, revenue, benchmarks])

  const { insight, loading: iL, error: iE, refresh } = useInsight('admin', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading system data…</div>

  return (
    <div style={{ maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin)', marginBottom: '4px' }}>
        System Health
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Pipeline metadata, data freshness, and full benchmark scorecard
      </p>

      {/* Pipeline metadata */}
      <Card title="Pipeline Metadata" style={{ marginBottom: '24px' }}>
        <MetaRow label="Total Calls"     value={revenue.total_calls    != null ? Number(revenue.total_calls).toLocaleString()    : '—'} mono />
        <MetaRow label="Total Bookings"  value={revenue.total_bookings != null ? Number(revenue.total_bookings).toLocaleString() : '—'} mono />
        <MetaRow label="Shows"           value={revenue.total_shows    != null ? Number(revenue.total_shows).toLocaleString()    : '—'} mono />
        <MetaRow label="Campaign Score"  value={health.total_score     != null ? `${health.total_score}/100`                    : '—'} mono />
        <MetaRow label="Health Level"    value={health.level           ?? '—'} />
        <MetaRow label="Churn Risk"      value={(health.churn_risk     ?? '—').toUpperCase()} />
        {health.churn_risk_pct != null && (
          <MetaRow label="Churn Probability" value={`${Math.round(health.churn_risk_pct * 100)}%`} mono />
        )}
      </Card>

      {/* Daily call volume */}
      {recent14.length > 0 && (
        <Card title="Daily Call Volume — Last 14 Days" style={{ marginBottom: '24px' }}>
          <PlotRef
            buildFn={() =>
              Plot.plot({
                height: 220,
                marginLeft: 50,
                style: { background: 'transparent', color: 'var(--muted)' },
                x: { label: 'Date', type: 'band' },
                y: { label: 'Calls', grid: true },
                marks: [
                  Plot.line(recent14, {
                    x: 'date',
                    y: 'outbound_calls',
                    stroke: 'var(--admin)',
                    strokeWidth: 2,
                  }),
                  Plot.dot(recent14, { x: 'date', y: 'outbound_calls', fill: 'var(--admin)', r: 4 }),
                  Plot.ruleY([0]),
                ],
              })
            }
            deps={[recent14]}
          />
        </Card>
      )}

      {/* Full benchmark scorecard */}
      <Card title="Full Benchmark Scorecard" style={{ marginBottom: '24px' }}>
        {benchmarks.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No benchmark data.</p>
        ) : (
          benchmarks.map((b) => (
            <BenchmarkBar
              key={b.metric}
              label={b.metric}
              actual={parsePct(b.actual_pct)}
              benchmark={b.benchmark_pct}
              status={b.status}
            />
          ))
        )}
      </Card>

      {/* Hidden metrics disclosure */}
      <Card title="Metrics Hidden from Client View" style={{ marginBottom: '24px', borderLeft: '3px solid var(--admin)' }}>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
          The following metrics are captured by the pipeline but excluded from client-facing pages
          per config.py CLIENT_HIDDEN_METRICS:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {CLIENT_HIDDEN_METRICS.map((m) => (
            <span
              key={m}
              style={{
                padding: '4px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--admin)',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
