import React, { useMemo } from 'react'
import { useData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadPipeline } from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

const RISK_COLORS = {
  High: { bg: '#ef444418', border: 'var(--danger)', text: 'var(--danger)' },
  Medium: { bg: '#f59e0b18', border: 'var(--warn)', text: 'var(--warn)' },
  Low: { bg: 'transparent', border: 'var(--border)', text: 'var(--accent)' },
}

function RiskBadge({ level }) {
  const c = RISK_COLORS[level] ?? RISK_COLORS.Low
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: '99px',
        border: `1px solid ${c.border}`,
        fontSize: '10px',
        fontWeight: 700,
        color: c.text,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: c.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {level}
    </span>
  )
}

export default function AtRiskPipeline() {
  const { data, loading } = useData(loadPipeline)

  const sorted = useMemo(() => {
    if (!data?.length) return []
    const order = { High: 0, Medium: 1, Low: 2 }
    return [...data].sort((a, b) => {
      const ro = order[a.risk_level] - order[b.risk_level]
      return ro !== 0 ? ro : (a.days_until ?? 0) - (b.days_until ?? 0)
    })
  }, [data])

  const counts = useMemo(() => {
    if (!sorted.length) return { High: 0, Medium: 0, Low: 0 }
    return sorted.reduce(
      (acc, r) => {
        acc[r.risk_level] = (acc[r.risk_level] ?? 0) + 1
        return acc
      },
      { High: 0, Medium: 0, Low: 0 }
    )
  }, [sorted])

  const promptText = useMemo(() => {
    if (!sorted.length) return ''
    return `Pipeline risk summary:
${counts.High} HIGH risk, ${counts.Medium} MEDIUM risk, ${counts.Low} LOW risk bookings.
High risk details: ${sorted.filter((r) => r.risk_level === 'High').map((r) => `${r.first_name} ${r.last_name} (${r.days_until}d, ${r.total_calls_made} calls, ${r.booking_location?.replace('StretchLab ', '')})`).join('; ')}.
Write manager-facing pipeline insight. State which bookings need calls today.`
  }, [sorted, counts])

  const { insight, loading: iL, error: iE, refresh } = useInsight('manager', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading pipeline data…</div>

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        At-Risk Pipeline
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Future bookings ranked by cancellation risk — High needs action today
      </p>

      {/* Risk level definitions */}
      <div style={{
        display: 'flex', gap: '24px', flexWrap: 'wrap',
        fontSize: '11px', color: 'var(--muted)',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '10px 16px', marginBottom: '20px',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text)', marginRight: '4px' }}>Risk definitions:</span>
        <span><strong style={{ color: 'var(--danger)' }}>High</strong> — ≤ 7 days out with fewer than 2 confirmation calls made</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span><strong style={{ color: 'var(--warn)' }}>Medium</strong> — 8–14 days out or only 1 call on record</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span><strong style={{ color: 'var(--accent)' }}>Low</strong> — 15+ days out, monitor and confirm closer to date</span>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {(['High', 'Medium', 'Low']).map((level) => {
          const c = RISK_COLORS[level]
          return (
            <Card key={level} style={{ borderLeft: `3px solid ${c.border}`, background: c.bg }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                {level} Risk
              </p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: c.text, fontFamily: 'JetBrains Mono' }}>
                {counts[level]}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {level === 'High' ? 'Call today' : level === 'Medium' ? 'Call this week' : 'Monitor'}
              </p>
            </Card>
          )
        })}
      </div>

      {/* Pipeline table */}
      <Card style={{ overflowX: 'auto' }}>
        {sorted.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No future bookings in pipeline.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['Risk', 'Name', 'Booking Date', 'Days Until', 'Studio', 'Calls Made'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const c = RISK_COLORS[row.risk_level] ?? RISK_COLORS.Low
                return (
                  <tr
                    key={i}
                    style={{ background: row.risk_level === 'High' ? c.bg : row.risk_level === 'Medium' ? c.bg : 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <RiskBadge level={row.risk_level} />
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>
                      {row.first_name} {row.last_name}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: '11px' }}>
                      {row.booking_date
                        ? new Date(row.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        color: (row.days_until ?? 99) <= 3 ? 'var(--danger)' : (row.days_until ?? 99) <= 7 ? 'var(--warn)' : 'var(--muted)',
                        fontFamily: 'JetBrains Mono',
                        fontWeight: 600,
                      }}
                    >
                      {row.days_until ?? '—'}d
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>
                      {row.booking_location?.replace('StretchLab ', '')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          color: (row.total_calls_made ?? 0) < 3 ? 'var(--danger)' : 'var(--accent)',
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 700,
                        }}
                      >
                        {row.total_calls_made ?? 0}
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: '10px', marginLeft: '4px' }}>
                        {(row.total_calls_made ?? 0) < 3 ? '— needs more' : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
