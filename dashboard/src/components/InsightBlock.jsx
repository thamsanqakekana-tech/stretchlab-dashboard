import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const ROLE_META = {
  client:  { color: '#6366f1', label: 'AI Insight' },
  manager: { color: '#f59e0b', label: 'Ops Analysis' },
  admin:   { color: '#a855f7', label: 'Data Analysis' },
}

export default function InsightBlock({ insight, loading, error, onRefresh, style = {} }) {
  const { viewRole: role } = useAuth()
  const { color, label } = ROLE_META[role] ?? ROLE_META.client

  return (
    <div className="fade-in" style={{
      background: 'var(--surface)',
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '12px',
      padding: '18px 20px',
      marginBottom: '24px',
      ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color,
          }}>
            {label}
          </span>
        </div>
        {onRefresh && !loading && (
          <button onClick={onRefresh} style={{
            background: 'none', border: `1px solid ${color}40`,
            borderRadius: '6px', color: 'var(--muted)', fontSize: '11px',
            cursor: 'pointer', padding: '3px 10px',
          }}>
            Refresh
          </button>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '13px' }}>
          <span style={{
            width: '11px', height: '11px', border: `2px solid ${color}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite', display: 'inline-block',
          }} />
          Generating insight…
        </div>
      )}

      {error && !loading && (
        <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>
          Could not generate insight: {error}
        </p>
      )}

      {!loading && !error && insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insight.split(/\n\n+/).map((para, i) => (
            <p key={i} style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.75, margin: 0 }}>
              {para.trim().split(/\*\*/).map((seg, j) =>
                j % 2 === 1
                  ? <strong key={j} style={{ fontWeight: 700, color: 'var(--text)' }}>{seg}</strong>
                  : seg
              )}
            </p>
          ))}
        </div>
      )}

      {!loading && !error && !insight && (
        <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
          Insight not available — run the pipeline to generate updated insights.
        </p>
      )}
    </div>
  )
}
