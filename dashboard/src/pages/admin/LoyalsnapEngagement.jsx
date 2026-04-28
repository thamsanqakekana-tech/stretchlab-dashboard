import React, { useEffect, useRef, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { useData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadLoyalsnapEngagement } from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import KpiCard from '../../components/KpiCard.jsx'
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

export default function LoyalsnapEngagement() {
  const { data, loading } = useData(loadLoyalsnapEngagement)

  const rows = data ?? []

  const totals = useMemo(() => {
    if (!rows.length) return {}
    return {
      totalSent: rows.reduce((s, r) => s + (r.sent_count ?? 0), 0),
      avgOpenRate: rows.reduce((s, r) => s + (r.open_rate ?? 0), 0) / rows.length,
      avgResponseRate: rows.reduce((s, r) => s + (r.response_rate ?? 0), 0) / rows.length,
      totalOptOut: rows.reduce((s, r) => s + (r.opt_out_count ?? 0), 0),
    }
  }, [rows])

  const promptText = useMemo(() => {
    if (!rows.length) return ''
    return `Loyalsnap SMS channel data:
Total messages sent: ${totals.totalSent}.
Avg open rate: ${totals.avgOpenRate?.toFixed(1)}%.
Avg response rate: ${totals.avgResponseRate?.toFixed(1)}%.
Total opt-outs: ${totals.totalOptOut}.
Message types: ${[...new Set(rows.map((r) => r.message_type))].join(', ')}.
Write admin-facing SMS channel insight. Is Loyalsnap contributing to bookings or creating noise? What does the opt-out trend mean for client trust?`
  }, [rows, totals])

  const { insight, loading: iL, error: iE, refresh } = useInsight('admin', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading Loyalsnap data…</div>

  return (
    <div style={{ maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin)', marginBottom: '4px' }}>
        Loyalsnap SMS Engagement
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        SMS channel analysis — new data source, previously unused
      </p>

      {rows.length === 0 ? (
        <Card>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            No Loyalsnap engagement data found in{' '}
            <code style={{ color: 'var(--admin)', fontFamily: 'JetBrains Mono' }}>public/data/phiwe_loyalsnap_engagement.csv</code>.
            Run the pipeline to generate this file.
          </p>
        </Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <KpiCard label="Total Sent" value={totals.totalSent?.toLocaleString() ?? '—'} sub="SMS messages" />
            <KpiCard label="Avg Open Rate" value={totals.avgOpenRate?.toFixed(1) ?? '—'} unit="%" sub="Across all campaigns" />
            <KpiCard label="Avg Response Rate" value={totals.avgResponseRate?.toFixed(1) ?? '—'} unit="%" sub="Replies received" />
            <KpiCard
              label="Total Opt-Outs"
              value={totals.totalOptOut ?? '—'}
              sub="Unsubscribes"
              color={totals.totalOptOut > 0 ? 'var(--warn)' : 'var(--accent)'}
            />
          </div>

          {/* Time series */}
          <Card title="Engagement Over Time" style={{ marginBottom: '24px' }}>
            <PlotRef
              buildFn={() =>
                Plot.plot({
                  height: 240,
                  marginLeft: 50,
                  style: { background: 'transparent', color: 'var(--muted)' },
                  x: { label: 'Date' },
                  y: { label: 'Rate (%)', grid: true },
                  color: { domain: ['open_rate', 'response_rate'], range: ['#22c55e', '#7F77DD'] },
                  marks: [
                    Plot.line(
                      rows.flatMap((r) => [
                        { date: r.date_sent, rate: r.open_rate, type: 'open_rate' },
                        { date: r.date_sent, rate: r.response_rate, type: 'response_rate' },
                      ]),
                      { x: 'date', y: 'rate', stroke: 'type', strokeWidth: 2 }
                    ),
                    Plot.dot(
                      rows.flatMap((r) => [
                        { date: r.date_sent, rate: r.open_rate, type: 'open_rate' },
                        { date: r.date_sent, rate: r.response_rate, type: 'response_rate' },
                      ]),
                      { x: 'date', y: 'rate', fill: 'type', r: 4 }
                    ),
                    Plot.ruleY([0]),
                  ],
                })
              }
              deps={[rows]}
            />
          </Card>

          {/* Per-campaign table */}
          <Card title="Per-Campaign Breakdown" style={{ marginBottom: '24px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Date', 'Type', 'Sent', 'Open Rate', 'Response Rate', 'Opt-Outs'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: '11px' }}>{r.date_sent}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{r.message_type}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{r.sent_count}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>{r.open_rate?.toFixed(1)}%</td>
                    <td style={{ padding: '8px 10px', color: 'var(--admin)', fontFamily: 'JetBrains Mono' }}>{r.response_rate?.toFixed(1)}%</td>
                    <td style={{ padding: '8px 10px', color: r.opt_out_count > 0 ? 'var(--warn)' : 'var(--muted)', fontFamily: 'JetBrains Mono', fontWeight: r.opt_out_count > 0 ? 600 : 400 }}>
                      {r.opt_out_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
        </>
      )}
    </div>
  )
}
