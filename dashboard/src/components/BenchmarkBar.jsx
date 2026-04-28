import React, { useState, useEffect, useRef } from 'react'
import Tooltip from './Tooltip.jsx'

const LOWER_IS_BETTER = new Set(['cancel_rate', 'no_show_rate'])

function getStatus(actual, benchmark, lowerIsBetter) {
  if (!Number.isFinite(actual) || !Number.isFinite(benchmark)) return null
  if (lowerIsBetter) {
    return actual <= benchmark
      ? { label: 'EXCELLENT',  color: 'var(--positive)' }
      : { label: 'REDUCE',     color: 'var(--warn)'     }
  }
  return actual >= benchmark
    ? { label: 'ON TRACK', color: 'var(--positive)' }
    : { label: 'BELOW',    color: 'var(--warn)'     }
}

/**
 * Props:
 *   label          — metric key or display string
 *   actual         — number (already in percentage units, e.g. 11.9)
 *   benchmark      — number (e.g. 15)
 *   unit           — default '%'
 *   lowerIsBetter  — override; derived from label if omitted
 *   tooltip        — string: benchmark source shown on ⓘ hover
 *   triggered      — when true, animate bar from 0 → target (default true)
 *   index          — stagger delay = index * 100 ms (default 0)
 *   onClick        — optional click handler for drill-down toggle
 *   active         — highlight when drill-down is open
 */
export default function BenchmarkBar({
  label,
  actual,
  benchmark,
  unit = '%',
  lowerIsBetter,
  tooltip,
  triggered = true,
  index     = 0,
  onClick,
  active    = false,
}) {
  const actualNum = typeof actual    === 'number' ? actual    : parseFloat(String(actual    ?? '').replace('%', ''))
  const benchNum  = typeof benchmark === 'number' ? benchmark : parseFloat(String(benchmark ?? '').replace('%', ''))

  const metricKey = typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '_') : ''
  const lib       = lowerIsBetter !== undefined ? lowerIsBetter : LOWER_IS_BETTER.has(metricKey)

  const statusInfo = getStatus(actualNum, benchNum, lib)
  const { label: statusLabel = 'BELOW', color: statusColor = 'var(--warn)' } = statusInfo ?? {}
  const isPositive = statusInfo?.label === 'EXCELLENT' || statusInfo?.label === 'ON TRACK'
  const barColor   = isPositive ? 'var(--positive)' : 'var(--warn)'

  const maxVal  = Math.max(actualNum || 0, benchNum || 0, 0.1) * 1.35
  const targetW = Math.min(100, ((actualNum || 0) / maxVal) * 100)
  const benchW  = Math.min(100, ((benchNum  || 0) / maxVal) * 100)

  // Animation: width transitions from 0 → target when triggered
  const [animW, setAnimW] = useState(0)
  const animated = useRef(false)

  useEffect(() => {
    if (!triggered || animated.current) return
    animated.current = true
    const delay = 60 + index * 100   // stagger: 60ms base + 100ms per index
    const t = setTimeout(() => setAnimW(targetW), delay)
    return () => clearTimeout(t)
  }, [triggered, targetW, index])

  const fmtLabel = typeof label === 'string'
    ? label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : label

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: '18px',
        cursor: onClick ? 'pointer' : 'default',
        padding: active ? '8px 10px' : '0',
        margin: active ? '0 -10px 10px' : '0 0 18px',
        background: active ? 'var(--surface-2)' : 'transparent',
        borderRadius: active ? '8px' : '0',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{fmtLabel}</span>
          {tooltip && (
            <Tooltip
              content={<span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{tooltip}</span>}
              position="top"
            >
              <span style={{ fontSize: '11px', color: 'var(--muted)', cursor: 'default', userSelect: 'none' }}>ⓘ</span>
            </Tooltip>
          )}
          {onClick && (
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{active ? '↑' : '↓'}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: barColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {Number.isFinite(actualNum) ? actualNum.toFixed(1) : '—'}{unit}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            / {Number.isFinite(benchNum) ? benchNum.toFixed(1) : '—'}{unit} target
          </span>
          {statusInfo && (
            <span style={{
              fontSize: '10px', fontWeight: 700,
              color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em',
              padding: '2px 6px', borderRadius: '4px',
              background: `${statusColor}18`,
              border: `1px solid ${statusColor}40`,
            }}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', height: '6px', background: 'var(--border)', borderRadius: '99px' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '6px',
          width:  `${animW}%`,
          background: barColor,
          borderRadius: '99px',
          transition: `width 0.8s cubic-bezier(0.4,0,0.2,1)`,
        }} />
        <div style={{
          position: 'absolute', left: `${benchW}%`, top: '-4px',
          width: '2px', height: '14px',
          background: 'var(--muted)', borderRadius: '1px', opacity: 0.45,
        }} />
      </div>
    </div>
  )
}
