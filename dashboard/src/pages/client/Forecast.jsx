import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useMultiData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadForecast30Day, loadRampVsTarget } from '../../utils/dataLoader.js'
import { RAMP_TARGETS } from '../../utils/config.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'
import { Loader, PageHeader } from './Overview.jsx'

const SCENARIOS = [
  { key: 'pessimistic', label: 'Conservative', color: '#ef4444' },
  { key: 'likely',      label: 'Likely',       color: '#6366f1' },
  { key: 'optimistic',  label: 'Optimistic',   color: '#22c55e' },
]

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

export default function Forecast() {
  const { data, loading } = useMultiData({ forecast: loadForecast30Day, ramp: loadRampVsTarget })

  const forecasts = data.forecast ?? []
  const ramp      = data.ramp     ?? []

  // Ramp chart: cumulative actuals vs cumulative targets
  const rampChart = useMemo(() => {
    const rows = []
    let runningActual = 0
    ;[1, 2, 3].forEach(m => {
      rows.push({ month: m, type: 'Target', value: RAMP_TARGETS[m] })
      const row = ramp.find(r => +r.month === m)
      if (row != null) {
        runningActual += +row.actual_kept_appts || 0
        rows.push({ month: m, type: 'Actual', value: runningActual })
      }
    })
    return rows
  }, [ramp])

  const currentActual = ramp.reduce((s, r) => s + (+r.actual_kept_appts || 0), 0)
  const m3Target      = RAMP_TARGETS[3]
  const progressPct   = Math.min(100, (currentActual / m3Target) * 100)

  const likely = forecasts.find(f => f.scenario === 'likely') ?? {}

  const promptText = useMemo(() => {
    if (loading) return ''
    return `Forecast — pessimistic: ${forecasts.find(f=>f.scenario==='pessimistic')?.shows ?? '?'} shows, likely: ${likely.shows ?? '?'} shows, optimistic: ${forecasts.find(f=>f.scenario==='optimistic')?.shows ?? '?'} shows. Revenue (likely avg): ${likely.revenue_average}. Month 2 actual: ${currentActual}. Write client forecast insight.`
  }, [loading, forecasts, likely, currentActual])

  const { insight, loading: iL, error: iE, refresh } = useInsight('client', promptText)

  if (loading) return <Loader text="Loading forecast data…" />

  return (
    <div style={{ maxWidth: '1000px' }}>
      <PageHeader title="Forecast" sub="30-day scenarios and ramp progress toward Month 3 target" />

      {/* Scenario cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '28px' }}>
        {SCENARIOS.map(({ key, label, color }) => {
          const row = forecasts.find(f => f.scenario === key) ?? {}
          const appts   = row.shows ?? row.bookings ?? null
          const revenue = row.revenue_average ?? row.revenue_conservative ?? null
          return (
            <Card key={key} accent={color} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                {label}
              </p>
              <p style={{ fontSize: '40px', fontWeight: 700, fontFamily: 'JetBrains Mono', letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1, marginBottom: '4px' }}>
                {appts ?? '—'}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>kept appointments</p>
              {revenue != null && (
                <p style={{ fontSize: '14px', color, fontWeight: 600 }}>
                  ${Number(revenue).toLocaleString()}
                </p>
              )}
              {row.confidence && (
                <p style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', textTransform: 'capitalize' }}>
                  {row.confidence} confidence
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* Ramp chart */}
      <Card title="Ramp — Actual vs SOW Targets" style={{ marginBottom: '16px' }}>
        <PlotRef
          buildFn={() => rampChart.length ? Plot.plot({
            height: 240, marginLeft: 50,
            style: { background: 'transparent', color: 'var(--muted)' },
            x: { label: 'Month', tickFormat: d => `Month ${d}`, domain: [1,2,3] },
            y: { label: 'Kept Appts', grid: true },
            color: { domain: ['Target','Actual'], range: ['#27272a','#6366f1'] },
            marks: [
              Plot.line(rampChart, { x: 'month', y: 'value', stroke: 'type', strokeWidth: 2, strokeDasharray: d => d.type === 'Target' ? '5,4' : null }),
              Plot.dot(rampChart,  { x: 'month', y: 'value', fill: 'type', r: 5 }),
              Plot.text(rampChart.filter(d => d.type === 'Target'), {
                x: 'month', y: d => d.value + 5, text: d => `${d.value}`, fill: '#71717a', fontSize: 10,
              }),
            ],
          }) : null}
          deps={[rampChart]}
        />
      </Card>

      {/* Progress bar */}
      <Card title={`Progress to Month 3 Target (${m3Target} kept appointments)`} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{currentActual}</span>
          <span style={{ color: 'var(--muted)' }}>target: {m3Target}</span>
        </div>
        <div style={{ background: 'var(--border)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '99px', transition: 'width 0.6s ease',
            width: `${progressPct}%`,
            background: progressPct >= 80 ? '#22c55e' : progressPct >= 50 ? '#6366f1' : '#ef4444',
          }} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
          {progressPct.toFixed(0)}% of Month 3 target reached
        </p>
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
