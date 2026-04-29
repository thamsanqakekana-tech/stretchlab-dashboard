import React from 'react'
import { isBelowBenchmark } from '../utils/config.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function KpiCard({ label, value, unit = '', sub, metricKey, color, icon, accentColor }) {
  const { viewRole: role } = useAuth()
  const warn = role !== 'client' && metricKey && isBelowBenchmark(metricKey, parseFloat(value))

  const topColor = accentColor ?? (warn ? 'var(--warn)' : 'var(--accent)')

  return (
    <div style={{
      position: 'relative',
      background: 'var(--surface)',
      border: `1px solid ${warn ? 'var(--warn)' : 'var(--border)'}`,
      borderRadius: '12px',
      padding: '20px 20px 18px',
      overflow: 'hidden',
    }}>
      {/* top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: topColor, borderRadius: '12px 12px 0 0',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <p style={{
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: warn ? 'var(--warn)' : 'var(--muted)',
        }}>
          {label}
        </p>
        {icon && <span style={{ fontSize: '15px', opacity: 0.5 }}>{icon}</span>}
      </div>

      <p style={{
        fontSize: '30px',
        fontWeight: 700,
        color: color ?? (warn ? 'var(--warn)' : 'var(--text)'),
        lineHeight: 1,
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '-0.02em',
      }}>
        {value}
        {unit && (
          <span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '3px', color: 'var(--muted)', letterSpacing: 0 }}>
            {unit}
          </span>
        )}
      </p>

      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '6px' }}>{sub}</p>
      )}
    </div>
  )
}
