import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'

const TOOLTIP_W = 260
const GAP       = 10

/**
 * Portal-based hover tooltip.
 *
 * • Renders into document.body so it's never clipped by overflow:hidden parents.
 * • Uses getBoundingClientRect + window dimensions to detect available space
 *   before positioning, then clamps to viewport.
 * • Closes on scroll.
 * • 150 ms opacity fade-in.
 *
 * Props:
 *   content   — JSX or string
 *   position  — preferred side: 'top' (default) | 'bottom' | 'right'
 *   children  — the trigger element
 */
export default function Tooltip({ children, content, position = 'top' }) {
  const triggerRef                  = useRef(null)
  const [coords, setCoords]         = useState(null)   // null = hidden
  const [opacity, setOpacity]       = useState(0)

  const compute = useCallback(() => {
    if (!triggerRef.current) return null
    const rect = triggerRef.current.getBoundingClientRect()
    const vw   = window.innerWidth
    const vh   = window.innerHeight

    // Pick side based on actual available space (not a hard pixel threshold)
    const spaceAbove = rect.top    - GAP
    const spaceBelow = vh - rect.bottom - GAP
    let side = position
    if (side === 'top'    && spaceAbove < 320 && spaceBelow > spaceAbove) side = 'bottom'
    if (side === 'bottom' && spaceBelow < 320 && spaceAbove > spaceBelow) side = 'top'

    // Horizontal left — centred on trigger, clamped to viewport
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8))

    // Vertical top
    let top
    if (side === 'top')    top = rect.top    - GAP - 300  // 300 = safe over-estimate; CSS bottom anchors it
    if (side === 'bottom') top = rect.bottom + GAP
    if (side === 'right') {
      left = Math.min(rect.right + GAP, vw - TOOLTIP_W - 8)
      top  = rect.top + rect.height / 2 - 80
    }
    top = Math.max(8, top)

    // Arrow left — point at trigger center, clamped inside tooltip
    const arrowLeft = Math.max(12, Math.min(
      rect.left + rect.width / 2 - left,
      TOOLTIP_W - 12
    ))

    return { left, top, side, arrowLeft, triggerTop: rect.top, triggerBottom: rect.bottom, spaceAbove, spaceBelow }
  }, [position])

  const hideTimer = useRef(null)

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      setOpacity(0)
      setTimeout(() => setCoords(null), 160)
    }, 120)
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const show = useCallback(() => {
    cancelHide()
    const c = compute()
    if (!c) return
    setCoords(c)
    requestAnimationFrame(() => setOpacity(1))
  }, [compute, cancelHide])

  const hide = useCallback(() => {
    scheduleHide()
  }, [scheduleHide])

  // Close on scroll
  useEffect(() => {
    if (!coords) return
    const close = () => hide()
    window.addEventListener('scroll', close, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', close, { capture: true })
  }, [coords, hide])

  if (!content) return <>{children}</>

  const tooltipEl = coords
    ? ReactDOM.createPortal(
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position:    'fixed',
            top:         coords.side === 'top'    ? 'auto' : coords.top,
            bottom:      coords.side === 'top'    ? `${window.innerHeight - coords.triggerTop + GAP}px` : 'auto',
            left:        coords.left,
            width:       TOOLTIP_W,
            background:  'var(--surface)',
            border:      '1px solid var(--border)',
            borderRadius:'9px',
            padding:     '12px 14px',
            fontSize:    '12px',
            lineHeight:   1.6,
            color:       'var(--text-2)',
            zIndex:       9999,
            maxHeight:    coords.side === 'top'
              ? Math.min(coords.spaceAbove - 8, 420)
              : Math.min(coords.spaceBelow - 8, 420),
            overflowY:   'auto',
            pointerEvents:'auto',
            boxShadow:   '0 12px 32px rgba(0,0,0,0.55)',
            opacity,
            transition:  'opacity 0.15s ease',
            whiteSpace:  'normal',
          }}
        >
          {content}
          {/* Arrow */}
          <span style={{
            position: 'absolute',
            width: '8px', height: '8px',
            background: 'var(--surface)',
            left: coords.arrowLeft,
            transform: 'translateX(-50%) rotate(45deg)',
            ...(coords.side === 'top' ? {
              bottom: '-5px',
              borderRight:  '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            } : coords.side === 'bottom' ? {
              top: '-5px',
              borderLeft: '1px solid var(--border)',
              borderTop:  '1px solid var(--border)',
            } : {
              left: '-5px', top: '50%',
              transform: 'translateY(-50%) rotate(45deg)',
              borderLeft:   '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }),
          }} />
        </div>,
        document.body
      )
    : null

  return (
    <span
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {tooltipEl}
    </span>
  )
}

// ─── Structured tooltip bodies ────────────────────────────────────────────────

/** Four-section structured tooltip: WHAT / WHY / INDUSTRY / STATUS */
export function MetricTooltip({ what, why, industry, status, response }) {
  const Section = ({ label, color, text }) => text ? (
    <div style={{ marginBottom: '8px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{text}</p>
    </div>
  ) : null

  return (
    <div>
      <Section label="What it measures"  color="var(--accent)"   text={what} />
      <Section label="Why it matters"    color="var(--warn)"     text={why} />
      <Section label="Industry context"  color="var(--info)"     text={industry} />
      <Section label="Status"            color="var(--positive)" text={status} />
      <Section label="Execo's response"  color="var(--positive)" text={response} />
    </div>
  )
}

/** Revenue tooltip explaining derivation */
export function RevenueTooltip({ introText, membershipText }) {
  return (
    <div>
      {introText && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--positive)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Intro session</span>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-2)' }}>{introText}</p>
        </div>
      )}
      {membershipText && (
        <div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Membership potential</span>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-2)' }}>{membershipText}</p>
        </div>
      )}
    </div>
  )
}
