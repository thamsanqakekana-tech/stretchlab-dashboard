import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'

const TOOLTIP_W = 280
const GAP       = 10

/**
 * Portal-based hover tooltip with two-pass positioning.
 *
 * Pass 1: render invisible at estimated position to measure actual height.
 * Pass 2 (useLayoutEffect): recompute position using real height, then reveal.
 * This eliminates the clipped/scrollable tooltip problem caused by guessing height upfront.
 */
export default function Tooltip({ children, content, position = 'top' }) {
  const triggerRef  = useRef(null)
  const tooltipRef  = useRef(null)
  const measuredRef = useRef(false)         // prevents infinite layout loop
  const hideTimer   = useRef(null)

  const [visible, setVisible] = useState(false)
  const [coords,  setCoords]  = useState({ left: 0, top: 0, side: 'top', arrowLeft: 0 })
  const [ready,   setReady]   = useState(false)   // false = invisible; true = fade in

  const computeCoords = useCallback((tooltipH) => {
    if (!triggerRef.current) return null
    const rect = triggerRef.current.getBoundingClientRect()
    const vw   = window.innerWidth
    const vh   = window.innerHeight
    const h    = tooltipH || 160

    const spaceAbove = rect.top    - GAP
    const spaceBelow = vh - rect.bottom - GAP

    let side = position
    if (side === 'top'    && spaceAbove < h) side = spaceBelow >= h ? 'bottom' : (spaceBelow > spaceAbove ? 'bottom' : 'top')
    if (side === 'bottom' && spaceBelow < h) side = spaceAbove >= h ? 'top'    : (spaceAbove > spaceBelow ? 'top'    : 'bottom')

    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8))

    let top
    if (side === 'top')    top = rect.top - GAP - h
    if (side === 'bottom') top = rect.bottom + GAP
    if (side === 'right') {
      left = Math.min(rect.right + GAP, vw - TOOLTIP_W - 8)
      top  = rect.top + rect.height / 2 - h / 2
    }
    top = Math.max(8, Math.min(top, vh - h - 8))

    const arrowLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - left, TOOLTIP_W - 12))
    return { left, top, side, arrowLeft }
  }, [position])

  // Pass 2: once tooltip is in the DOM, measure actual height and reposition.
  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current || measuredRef.current) return
    measuredRef.current = true
    const h = tooltipRef.current.offsetHeight
    const c = computeCoords(h)
    if (c) {
      setCoords(c)
      setReady(true)
    }
  })

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      setReady(false)
    }, 120)
  }, [])

  const show = useCallback(() => {
    cancelHide()
    measuredRef.current = false
    setReady(false)
    // Pass 1: render at estimated position (invisible) so useLayoutEffect can measure
    const c = computeCoords(160)
    if (c) setCoords(c)
    setVisible(true)
  }, [computeCoords, cancelHide])

  useEffect(() => {
    if (!visible) return
    const close = () => hide()
    window.addEventListener('scroll', close, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', close, { capture: true })
  }, [visible, hide])

  if (!content) return <>{children}</>

  const tooltipEl = visible ? ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      onMouseEnter={cancelHide}
      onMouseLeave={hide}
      style={{
        position:      'fixed',
        top:           coords.top,
        left:          coords.left,
        width:         TOOLTIP_W,
        background:    'var(--surface)',
        border:        '1px solid var(--border)',
        borderRadius:  '9px',
        padding:       '12px 14px',
        fontSize:      '12px',
        lineHeight:     1.6,
        color:         'var(--text-2)',
        zIndex:         9999,
        pointerEvents: 'auto',
        boxShadow:     '0 12px 32px rgba(0,0,0,0.55)',
        opacity:        ready ? 1 : 0,
        transition:     ready ? 'opacity 0.15s ease' : 'none',
        whiteSpace:    'normal',
      }}
    >
      {content}
      <span style={{
        position:  'absolute',
        width:     '8px',
        height:    '8px',
        background:'var(--surface)',
        left:       coords.arrowLeft,
        transform: 'translateX(-50%) rotate(45deg)',
        ...(coords.side === 'top' ? {
          bottom:       '-5px',
          borderRight:  '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        } : coords.side === 'bottom' ? {
          top:       '-5px',
          borderLeft:'1px solid var(--border)',
          borderTop: '1px solid var(--border)',
        } : {
          left:         '-5px',
          top:          '50%',
          transform:    'translateY(-50%) rotate(45deg)',
          borderLeft:   '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }),
      }} />
    </div>,
    document.body
  ) : null

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
