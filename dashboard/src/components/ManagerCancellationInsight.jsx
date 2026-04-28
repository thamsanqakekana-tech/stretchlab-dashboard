import React from 'react'

const ManagerCancellationInsight = ({ rootCauses }) => {
  if (!rootCauses || !rootCauses.causes) return null

  const activeCauses = rootCauses.causes.filter(c => c.active && c.count > 0)
  if (activeCauses.length === 0) return null

  const totalCancels = rootCauses.total_cancelled
  const causeSum     = activeCauses.reduce((sum, c) => sum + c.count, 0)
  const adminCancels = totalCancels - causeSum
  const customerPct  = totalCancels > 0 ? ((causeSum / totalCancels) * 100).toFixed(0) : 0

  return (
    <div style={{
      background: 'var(--surface)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: '12px',
      padding: '20px 24px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '18px' }}>🎯</span>
        <p style={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text)', margin: 0,
        }}>
          Manager Insight: Cancellation Root Causes
        </p>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
        {causeSum} leads cancelled their own appointments ({customerPct}% of all cancellations). Here's why:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {activeCauses.map((cause, idx) => (
          <div key={idx} style={{
            background: idx === 0 ? 'rgba(99,102,241,0.05)' : 'var(--bg)',
            border: `1px solid ${idx === 0 ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
            borderRadius: '8px',
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                fontSize: '16px', fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--accent)', minWidth: '48px',
              }}>
                {cause.percentage.toFixed(1)}%
              </span>
              <span style={{ fontSize: '14px', color: 'var(--muted)' }}>→</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                {cause.cause}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--muted)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                [{cause.count}]
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, paddingLeft: '56px' }}>
              ACTION: {cause.action}
            </p>
          </div>
        ))}
      </div>

      {adminCancels > 0 && (
        <p style={{
          fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic',
          margin: '12px 0 0', padding: '10px',
          background: 'var(--bg)', borderRadius: '6px', lineHeight: 1.5,
        }}>
          {adminCancels} {adminCancels === 1 ? 'appointment was' : 'appointments were'} admin-cancelled (studio-initiated).{' '}
          {adminCancels === 1 ? "This doesn't" : "These don't"} reflect on Phiwe's work.
        </p>
      )}
    </div>
  )
}

export default ManagerCancellationInsight
