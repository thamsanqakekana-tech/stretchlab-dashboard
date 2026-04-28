import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadFlexologistPerformance } from '../../utils/dataLoader.js'
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

export default function FlexologistPerformance() {
  const { data, loading } = useData(loadFlexologistPerformance)

  const rows = useMemo(
    () => (data ? [...data].sort((a, b) => b.show_rate_pct - a.show_rate_pct) : []),
    [data]
  )

  const promptText = useMemo(() => {
    if (!rows.length) return ''
    return `Flexologist performance data (admin-only, not shared with client):
${rows.map((r) => `${r.booking_with}: ${r.total_sessions} sessions, ${r.shows} shows, ${r.show_rate_pct?.toFixed(1)}% show rate, ${r.cancel_rate_pct?.toFixed(1)}% cancel rate`).join('\n')}
Write admin insight: which staff drive best show rates and why it matters for booking allocation strategy.`
  }, [rows])

  const { insight, loading: iL, error: iE, refresh } = useInsight('admin', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading flexologist data…</div>

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin)', margin: 0 }}>
          Flexologist Performance
        </h1>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '6px',
            background: '#7F77DD22',
            border: '1px solid var(--admin)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--admin)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Internal Only
        </span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Individual staff conversion performance — not shared with client
      </p>

      {rows.length === 0 ? (
        <Card>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            No flexologist data found in{' '}
            <code style={{ color: 'var(--admin)', fontFamily: 'JetBrains Mono' }}>public/data/phiwe_flexologist_performance.csv</code>.
            Run the pipeline to generate this file.
          </p>
        </Card>
      ) : (
        <>
          {/* Chart */}
          <Card title="Show Rate by Flexologist" style={{ marginBottom: '24px' }}>
            <PlotRef
              buildFn={() =>
                Plot.plot({
                  marginLeft: 160,
                  height: Math.max(200, rows.length * 44),
                  style: { background: 'transparent', color: 'var(--muted)' },
                  x: { label: 'Show Rate (%)', grid: true, tickFormat: (d) => `${d}%` },
                  y: { label: null },
                  marks: [
                    Plot.barX(rows, {
                      x: 'show_rate_pct',
                      y: 'booking_with',
                      fill: (d, i) => i === 0 ? 'var(--admin)' : '#6b8f74',
                      rx: 3,
                      title: (d) => `${d.booking_with}: ${d.show_rate_pct?.toFixed(1)}% show rate`,
                    }),
                    Plot.ruleX([0]),
                  ],
                })
              }
              deps={[rows]}
            />
          </Card>

          {/* Table */}
          <Card title="Detailed Breakdown" style={{ marginBottom: '24px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Flexologist', 'Sessions', 'Shows', 'Cancels', 'No-Shows', 'Show Rate', 'Cancel Rate'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i === 0 ? '#7F77DD0f' : i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td style={{ padding: '10px 10px', color: i === 0 ? 'var(--admin)' : 'var(--text)', fontWeight: i === 0 ? 700 : 400 }}>
                      {r.booking_with}
                      {i === 0 && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--admin)' }}>TOP</span>}
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', color: 'var(--text)', fontWeight: 600 }}>{r.total_sessions}</td>
                    <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>{r.shows}</td>
                    <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', color: 'var(--danger)' }}>{r.cancellations}</td>
                    <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', color: 'var(--warn)' }}>{r.no_shows}</td>
                    <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', color: 'var(--admin)', fontWeight: 700 }}>
                      {r.show_rate_pct?.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', color: r.cancel_rate_pct > 15 ? 'var(--warn)' : 'var(--muted)' }}>
                      {r.cancel_rate_pct?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card style={{ marginBottom: '24px', borderLeft: '3px solid var(--admin)' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              This data is internal only and is not included in any client-facing report. Use it to
              optimise booking allocation — route high-commitment leads to flexologists with the
              highest show rates.
            </p>
          </Card>

          <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
        </>
      )}
    </div>
  )
}
