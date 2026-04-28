import React from 'react'

export default function DeltaBanner({ delta }) {
  if (!delta) return null

  const {
    newBookings, newShows, newCancellations,
    pipelineAdded, pipelineRemoved, timeSinceLastVisit,
  } = delta

  const hasChanges =
    newBookings      !== 0 ||
    newShows         !== 0 ||
    newCancellations !== 0 ||
    pipelineAdded    !== 0 ||
    pipelineRemoved  !== 0

  const isWarning = newCancellations >= 2

  const changes = []
  if (newCancellations > 0) changes.push(`${newCancellations} new cancellation${newCancellations !== 1 ? 's' : ''}`)
  if (newBookings      > 0) changes.push(`${newBookings} new booking${newBookings !== 1 ? 's' : ''}`)
  if (newShows         > 0) changes.push(`${newShows} show${newShows !== 1 ? 's' : ''} confirmed`)

  const borderColor = isWarning   ? '#f59e0b'        : hasChanges ? 'var(--accent)' : 'var(--border)'
  const bgColor     = isWarning   ? 'rgba(245,158,11,0.07)' : hasChanges ? 'rgba(99,102,241,0.06)' : 'var(--surface)'
  const icon        = isWarning   ? '⚠' : hasChanges ? '↑' : '·'
  const iconColor   = isWarning   ? '#f59e0b'        : hasChanges ? 'var(--accent)' : 'var(--muted)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '16px',
      fontSize: '12px',
    }}>
      <span style={{ fontWeight: 700, color: iconColor, fontSize: '14px', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
        {hasChanges ? (
          <>
            <strong style={{ color: 'var(--text)' }}>Since {timeSinceLastVisit}: </strong>
            {changes.join(' · ')}
            {pipelineRemoved > 0 && ` · ${pipelineRemoved} appointment${pipelineRemoved !== 1 ? 's' : ''} moved out of pipeline`}
            {pipelineAdded   > 0 && ` · ${pipelineAdded} appointment${pipelineAdded !== 1 ? 's' : ''} added to pipeline`}
          </>
        ) : (
          <>No changes since {timeSinceLastVisit}</>
        )}
      </span>
    </div>
  )
}
