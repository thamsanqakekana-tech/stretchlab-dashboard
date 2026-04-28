import React from 'react'

const Card = React.forwardRef(function Card({ title, children, className = '', style = {}, accent, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={`fade-in ${className}`}
      {...rest}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: accent, borderRadius: '12px 12px 0 0',
        }} />
      )}
      {title && (
        <p style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '14px',
        }}>
          {title}
        </p>
      )}
      {children}
    </div>
  )
})

export default Card
