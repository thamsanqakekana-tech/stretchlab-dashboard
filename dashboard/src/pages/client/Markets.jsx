import React, { useEffect, useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useData } from '../../hooks/useData.js'
import { loadByAreaCode } from '../../utils/dataLoader.js'
import { useInsight } from '../../hooks/useInsight.js'
import Card from '../../components/Card.jsx'
import Tooltip from '../../components/Tooltip.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'
import { Loader, Empty } from './Overview.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUSTON_CODES = new Set([281, 346, 713, 832])
const SOW_TARGET    = 77

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showRateColor(rate) {
  if (rate >= 15) return '#22c55e'
  if (rate >= 8)  return '#f59e0b'
  return '#ef4444'
}

function marketStatusText(m) {
  const bookings = +m.bookings || 0
  const shows    = +m.shows    || 0
  const showRate = +m.show_rate_pct || 0
  const eng      = +m.engagement_rate_pct || 0
  const calls    = +m.total_calls || 0

  if (bookings === 0) {
    if (eng >= 60) return `High engagement (${eng.toFixed(0)}%) but no bookings yet. Leads are answering and talking — the booking ask or timing is the variable to test, not database quality.`
    return `Active outreach — ${calls.toLocaleString()} calls made. No bookings yet. ${eng.toFixed(0)}% engagement — leads are being reached.`
  }
  if (shows === 0) {
    return `${bookings} appointment${bookings !== 1 ? 's' : ''} booked, none attended yet. This is a confirmation problem, not a calling problem. The confirmation follow-up protocol before each appointment is the primary lever — each pre-call reduces cancellation probability by 15–20%.`
  }
  if (showRate >= 15) {
    return `Converting at ${showRate.toFixed(1)}% — above the 8–15% cold outreach benchmark. ${shows} session${shows !== 1 ? 's' : ''} attended from ${bookings} booked. Priority: add booking volume here — the conversion rate is proven.`
  }
  if (showRate >= 8) {
    return `Converting at ${showRate.toFixed(1)}% — within the cold outreach benchmark of 8–15%. ${shows} attended from ${bookings} booked. Maintain confirmation protocol.`
  }
  return `Show rate (${showRate.toFixed(1)}%) is below the 8% cold benchmark. ${shows} attended from ${bookings} booked. Check cancellation attribution — if admin-initiated cancellations are present, the issue is scheduling, not lead quality.`
}

// ─── Regional Breakdown Chart ─────────────────────────────────────────────────
// Bars show booking counts (scaled to max bookings — not calls).
// Color = whether bookings converted to sessions.
// Hover tooltip gives full regional context.
function RegionalChart({ byRegion }) {
  const containerRef                        = useRef(null)
  const svgRef                              = useRef(null)
  const [tooltip, setTooltip]               = useState(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !byRegion.length || containerWidth < 10) return

    const top12 = byRegion
      .filter(r => r.region !== 'Other')
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 12)

    if (!top12.length) return

    const ROW_H  = 46
    const margin = { top: 16, right: 210, bottom: 36, left: 120 }
    const width  = containerWidth
    const innerW = width - margin.left - margin.right
    const innerH = top12.length * ROW_H

    d3.select(svgRef.current).selectAll('*').remove()

    const cs     = getComputedStyle(document.documentElement)
    const txtCol = cs.getPropertyValue('--text').trim()   || '#f1f5f9'
    const mutCol = cs.getPropertyValue('--muted').trim()  || '#6b7280'
    const bdrCol = cs.getPropertyValue('--border').trim() || '#ffffff1a'

    const height = innerH + margin.top + margin.bottom

    d3.select(svgRef.current)
      .attr('width', width).attr('height', height)
      .style('overflow', 'visible')

    const svg = d3.select(svgRef.current)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Scale x-axis to max BOOKINGS (not calls) — makes bars readable
    const maxBookings = d3.max(top12, r => r.bookings) || 1
    const xScale = d3.scaleLinear().domain([0, maxBookings]).range([0, innerW])
    const yScale = d3.scaleBand().domain(top12.map(r => r.region)).range([0, innerH]).padding(0.32)

    const barColor = r => {
      const sr = r.bookings > 0 ? (r.shows / r.bookings) * 100 : 0
      if (sr >= 10) return '#22c55e'
      if (sr > 0)   return '#f59e0b'
      return '#52525b'
    }

    // Row dividers
    top12.forEach((_, i) => {
      svg.append('line')
        .attr('x1', 0).attr('x2', innerW + margin.right - 10)
        .attr('y1', (i + 1) * ROW_H).attr('y2', (i + 1) * ROW_H)
        .attr('stroke', bdrCol).attr('stroke-opacity', 0.3)
    })

    // Single bars (bookings)
    const bars = svg.selectAll('.bar').data(top12).enter().append('rect')
      .attr('class', 'bar').attr('x', 0)
      .attr('y', r => yScale(r.region))
      .attr('width', 0)
      .attr('height', yScale.bandwidth())
      .attr('fill', r => barColor(r)).attr('opacity', 0.85).attr('rx', 3)

    bars.transition()
      .delay((_, i) => i * 55)
      .duration(500)
      .ease(d3.easeBackOut)
      .attr('width', r => Math.max(r.bookings > 0 ? 4 : 0, xScale(r.bookings)))

    // Right-side labels: Line 1 = key metric, Line 2 = calls invested
    top12.forEach(r => {
      const sr      = r.bookings > 0 ? ((r.shows / r.bookings) * 100).toFixed(0) : '0'
      const midY    = (yScale(r.region) ?? 0) + yScale.bandwidth() / 2
      const labelX  = innerW + 12

      // Primary: bookings · show%
      svg.append('text')
        .attr('x', labelX).attr('y', midY - 3)
        .attr('fill', txtCol).attr('font-size', '11px').attr('font-family', 'DM Sans, sans-serif')
        .text(`${r.bookings} booking${r.bookings !== 1 ? 's' : ''} · ${sr}% show`)

      // Secondary: call volume
      svg.append('text')
        .attr('x', labelX).attr('y', midY + 12)
        .attr('fill', mutCol).attr('font-size', '10px').attr('font-family', 'DM Sans, sans-serif')
        .text(`${r.total_calls.toLocaleString()} calls`)
    })

    // Region labels on left
    top12.forEach(r => {
      svg.append('text')
        .attr('x', -10)
        .attr('y', (yScale(r.region) ?? 0) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end').attr('fill', txtCol)
        .attr('font-size', '12px').attr('font-family', 'DM Sans, sans-serif')
        .text(r.region)
    })

    // X-axis (now in bookings, not calls)
    svg.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(5, maxBookings)).tickFormat(d => Math.round(d)))
      .call(g => {
        g.select('.domain').attr('stroke', bdrCol)
        g.selectAll('text').attr('fill', mutCol).attr('font-size', '10px')
        g.selectAll('.tick line').attr('stroke', bdrCol)
      })

    // Axis label
    svg.append('text')
      .attr('x', margin.left + innerW / 2).attr('y', height - 2)
      .attr('text-anchor', 'middle').attr('fill', mutCol).attr('font-size', '10px')
      .text('Bookings')

    // Legend
    const legendY = innerH + 28
    const legendItems = [
      { color: '#22c55e', label: '≥10% show rate' },
      { color: '#f59e0b', label: 'Bookings, no shows yet' },
      { color: '#52525b', label: 'No bookings' },
    ]
    legendItems.forEach((item, i) => {
      const lx = i * 160
      svg.append('rect').attr('x', lx).attr('y', legendY - 8).attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', item.color).attr('opacity', 0.85)
      svg.append('text').attr('x', lx + 14).attr('y', legendY).attr('fill', mutCol).attr('font-size', '10px').text(item.label)
    })

    // Row hover overlays
    svg.selectAll('.row-hit').data(top12).enter().append('rect')
      .attr('class', 'row-hit').attr('x', 0)
      .attr('y', (_r, i) => i * ROW_H)
      .attr('width', innerW).attr('height', ROW_H)
      .attr('fill', 'transparent').style('cursor', 'pointer')
      .on('mousemove', function(event, r) {
        svg.selectAll('.bar').filter(d => d.region === r.region).attr('opacity', 1)
        const rect = container.getBoundingClientRect()
        const mx   = event.clientX - rect.left
        const my   = event.clientY - rect.top
        const sr   = r.bookings > 0 ? ((r.shows / r.bookings) * 100).toFixed(1) : '0.0'
        const left = mx + 14 + 280 > containerWidth ? mx - 294 : mx + 14
        setTooltip({ x: left, y: my - 10, r, sr })
      })
      .on('mouseleave', function(_event, r) {
        svg.selectAll('.bar').filter(d => d.region === r.region).attr('opacity', 0.85)
        setTooltip(null)
      })

    const handleLeave = () => setTooltip(null)
    container.addEventListener('mouseleave', handleLeave)
    return () => {
      container.removeEventListener('mouseleave', handleLeave)
      d3.select(svgRef.current).selectAll('*').remove()
    }
  }, [byRegion, containerWidth])

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative', overflow: 'visible' }}>
      <svg ref={svgRef} style={{ display: 'block', overflow: 'visible' }} />
      {tooltip && (() => {
        const { x, y, r, sr } = tooltip
        const bookingRate = r.total_calls > 0 ? ((r.bookings / r.total_calls) * 100).toFixed(1) : '0.0'
        const aboveBench  = +sr >= 15
        const isLA = r.region === 'Louisiana'
        const isTX = r.region === 'Texas-Houston'
        const isOK = r.region === 'Oklahoma'
        const isMI = r.region === 'Michigan'
        const context = isLA || isTX
          ? 'Proven conversion. Prioritising more bookings here directly increases Month 3 session count.'
          : isOK
          ? 'Bookings made, no sessions attended yet. confirmation follow-up is the priority action this week.'
          : isMI
          ? 'Strong connect rate but bookings not yet converting. Script timing adjustment underway.'
          : r.shows > 0
          ? 'This region is converting — maintain call cadence and confirmation protocol.'
          : r.bookings > 0
          ? 'Pipeline building — focus on confirming existing bookings before adding more.'
          : 'Early stage outreach. Engagement data will guide next steps.'
        return (
          <div style={{
            position: 'absolute', left: x, top: y, zIndex: 9999, pointerEvents: 'none',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '9px',
            padding: '12px 16px', fontSize: '12px', color: 'var(--text)',
            minWidth: '260px', maxWidth: '300px', lineHeight: 1.65, boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
          }}>
            <p style={{ fontWeight: 700, margin: '0 0 8px', fontSize: '13px' }}>{r.region}</p>
            <div style={{ height: '1px', background: 'var(--border)', marginBottom: '8px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--text-2)' }}>
              <span><strong style={{ color: 'var(--text)' }}>{r.bookings}</strong> appointment{r.bookings !== 1 ? 's' : ''} booked ({bookingRate}% of {r.total_calls.toLocaleString()} calls)</span>
              {r.shows > 0
                ? <span><strong style={{ color: aboveBench ? '#22c55e' : '#f59e0b' }}>{r.shows} sessions attended</strong> — {sr}% show rate</span>
                : r.bookings > 0
                ? <span style={{ color: '#f59e0b' }}>0 sessions attended yet — {r.bookings} in the pipeline</span>
                : <span style={{ color: 'var(--muted)' }}>No bookings yet — active outreach phase</span>
              }
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '11px', lineHeight: 1.6 }}>{context}</p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Market Story (3 action buckets with EXECO / StretchLab framing) ──────────
function MarketStory({ rows, totalShows }) {
  const [drill, setDrill] = useState(null)

  const scaleBucket = useMemo(() =>
    rows.filter(r => +r.shows > 0).sort((a, b) => +b.shows - +a.shows)
  , [rows])

  const rescueBucket = useMemo(() =>
    rows.filter(r => (+r.bookings || 0) > 0 && (+r.shows || 0) === 0)
        .sort((a, b) => (+b.bookings || 0) - (+a.bookings || 0))
  , [rows])

  const testBucket = useMemo(() =>
    rows.filter(r => (+r.engagement_rate_pct || 0) >= 60 && (+r.bookings || 0) === 0)
        .sort((a, b) => (+b.engagement_rate_pct || 0) - (+a.engagement_rate_pct || 0))
  , [rows])

  const rescueTotalBookings = useMemo(() =>
    rescueBucket.reduce((s, r) => s + (+r.bookings || 0), 0)
  , [rescueBucket])

  const houstonCalls  = useMemo(() =>
    rows.filter(r => HOUSTON_CODES.has(+r.area_code)).reduce((s, r) => s + (+r.total_calls || 0), 0)
  , [rows])
  const totalCallsAll = useMemo(() => rows.reduce((s, r) => s + (+r.total_calls || 0), 0), [rows])
  const houstonPct    = totalCallsAll > 0 ? ((houstonCalls / totalCallsAll) * 100).toFixed(1) : '—'

  const topScale  = scaleBucket[0]
  const topRescue = rescueBucket[0]
  const topTest   = testBucket[0]

  function cityLabel(r) {
    return r && r.city && r.city !== 'Other' ? r.city : r ? `Area ${r.area_code}` : '—'
  }

  const buckets = [
    {
      key: 'scale',
      label: 'Scale',
      color: '#22c55e',
      count: scaleBucket.length,
      headline: topScale
        ? `${cityLabel(topScale)} — ${totalShows} session${totalShows !== 1 ? 's' : ''} attended`
        : `${scaleBucket.length} converting markets`,
      body: `These markets are converting. Houston metro drives ${houstonPct}% of all call volume. The conversion rate is proven — add bookings here.`,
      sub:  `${totalShows} of ${SOW_TARGET} target sessions confirmed.`,
      execoAction: `Phiwe is directing additional booking volume to top-converting markets to build on the proof of concept established in Months 1 and 2.`,
      clientAction: `Confirm that intro session slots are available at your studios in these markets. Each committed lead needs a smooth handoff — capacity gaps directly limit the session count.`,
      markets: scaleBucket,
      metric: r => `${+r.shows} session${+r.shows !== 1 ? 's' : ''} confirmed · ${(+r.show_rate_pct).toFixed(0)}% show rate`,
    },
    {
      key: 'rescue',
      label: 'Rescue',
      color: '#f59e0b',
      count: rescueBucket.length,
      headline: topRescue
        ? `${cityLabel(topRescue)} — ${+topRescue.bookings} booking${+topRescue.bookings !== 1 ? 's' : ''}, 0 sessions`
        : `${rescueBucket.length} markets with stalled bookings`,
      body: `${rescueTotalBookings} appointment${rescueTotalBookings !== 1 ? 's' : ''} booked but not yet attended. This is a confirmation problem, not a calling problem.`,
      sub:  null,
      execoAction: `Phiwe is running the confirmation follow-up protocol — calls at 72 hours, 24 hours, and the morning of each appointment — to protect every booked session.`,
      clientAction: `Flag any upcoming studio schedule changes to EXECO before the week starts. A significant portion of this campaign's cancellations have been admin-initiated — availability gaps on the studio side are reducing show rates.`,
      markets: rescueBucket,
      metric: r => `${+r.bookings} booked · 0 attended`,
    },
    {
      key: 'test',
      label: 'Test',
      color: '#38bdf8',
      count: testBucket.length,
      headline: topTest
        ? `${cityLabel(topTest)} — leads responding, 0 bookings yet`
        : `${testBucket.length} markets to develop`,
      body: `Leads here are picking up the phone and having real conversations — the database quality is good. The booking ask isn't landing yet.`,
      sub:  null,
      execoAction: `Phiwe is adjusting the booking window and refining the close conversation in high-engagement markets where leads respond but don't yet commit.`,
      clientAction: `Are there local membership offers or intro session promotions Phiwe can reference? A concrete offer often bridges the gap from "interested" to "committed."`,
      markets: testBucket,
      metric: r => `${(+r.total_calls).toLocaleString()} calls · leads responding, no bookings yet`,
    },
  ]

  const activeBucket = buckets.find(b => b.key === drill)

  return (
    <Card style={{ marginBottom: '28px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 18px' }}>
        Market Intelligence
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
        {buckets.map((b, idx) => (
          <div
            key={b.key}
            style={{
              borderRight: idx < 2 ? '1px solid var(--border)' : 'none',
              paddingRight: idx < 2 ? '20px' : '0',
              paddingLeft:  idx > 0 ? '20px' : '0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {b.label}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                padding: '1px 6px', borderRadius: '4px',
                background: `${b.color}18`, color: b.color,
              }}>
                {b.count}
              </span>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.4 }}>
              {b.headline}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, margin: b.sub ? '0 0 6px' : '0 0 12px' }}>
              {b.body}
            </p>
            {b.sub && (
              <p style={{ fontSize: '12px', fontWeight: 700, color: b.color, fontFamily: 'JetBrains Mono, monospace', margin: '0 0 12px' }}>
                {b.sub}
              </p>
            )}
            {b.count > 0 && (
              <button
                onClick={() => setDrill(d => d === b.key ? null : b.key)}
                style={{
                  background: 'none',
                  border: `1px solid ${drill === b.key ? b.color : 'var(--border)'}`,
                  borderRadius: '5px',
                  color: drill === b.key ? b.color : 'var(--muted)',
                  fontSize: '11px', cursor: 'pointer', padding: '4px 10px',
                  fontWeight: drill === b.key ? 600 : 400,
                }}
              >
                {drill === b.key ? 'collapse ▲' : `see details ▼`}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Focused drill-down: top markets + EXECO / StretchLab framing */}
      {activeBucket && (
        <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--border)' }}>

          {/* Top 3 markets — high-signal rows only */}
          <div style={{ marginBottom: '16px' }}>
            {activeBucket.markets.slice(0, 3).map((r, i) => (
              <div
                key={r.area_code}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: i < Math.min(activeBucket.markets.length, 3) - 1
                    ? '1px solid rgba(255,255,255,0.05)'
                    : 'none',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {r.city && r.city !== 'Other' ? r.city : `Area ${r.area_code}`}
                  <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted)', marginLeft: '5px' }}>
                    ({r.area_code})
                  </span>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {activeBucket.metric(r)}
                </span>
              </div>
            ))}
            {activeBucket.markets.length > 3 && (
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                + {activeBucket.markets.length - 3} more market{activeBucket.markets.length - 3 !== 1 ? 's' : ''} in this group
              </p>
            )}
          </div>

          {/* EXECO / StretchLab framing */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px',
            paddingTop: '14px', borderTop: '1px solid var(--border)',
          }}>
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', margin: '0 0 6px' }}>
                EXECO is
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
                {activeBucket.execoAction}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warn)', margin: '0 0 6px' }}>
                StretchLab can
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
                {activeBucket.clientAction}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Market Performance Table ─────────────────────────────────────────────────
function MarketTable({ markets }) {
  const [sortKey,      setSortKey]      = useState('bookings')
  const [sortDir,      setSortDir]      = useState(-1)
  const [showAll,      setShowAll]      = useState(false)
  const [expandedCode, setExpandedCode] = useState(null)

  const sorted = useMemo(() => {
    return [...markets].sort((a, b) => {
      const av = +(a[sortKey] ?? 0)
      const bv = +(b[sortKey] ?? 0)
      return (bv - av) * sortDir
    })
  }, [markets, sortKey, sortDir])

  const top3ShowKeys = useMemo(() =>
    [...markets]
      .filter(m => +m.show_rate_pct > 0)
      .sort((a, b) => +b.show_rate_pct - +a.show_rate_pct)
      .slice(0, 3)
      .map(m => m.area_code)
  , [markets])

  const maxCalls = useMemo(() =>
    Math.max(...markets.map(m => +m.total_calls || 0), 1)
  , [markets])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(-1) }
  }

  function exportCSV() {
    const cols   = ['city', 'state', 'area_code', 'total_calls', 'unique_leads', 'bookings', 'shows', 'booking_rate_pct', 'show_rate_pct']
    const header = 'Market,State,Code,Calls,Leads,Bookings,Shows,Booking %,Show %'
    const csvRows = sorted.map(m => cols.map(c => {
      const v = m[c] ?? ''
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    }).join(','))
    const blob = new Blob([[header, ...csvRows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'market_performance.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function showRateTooltipContent(m) {
    const rate     = +(m.show_rate_pct       || 0)
    const bookings = +(m.bookings            || 0)
    const shows    = +(m.shows               || 0)
    const leads    = +(m.unique_leads        || 0)
    const eng      = +(m.engagement_rate_pct || 0)
    const small    = bookings > 0 && bookings < 5
    if (bookings === 0) return (
      <div style={{ fontSize: '12px', lineHeight: 1.65 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700 }}>No bookings yet</p>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>{leads} lead{leads !== 1 ? 's' : ''} reached ({eng.toFixed(0)}% connect rate)</p>
      </div>
    )
    if (shows === 0) return (
      <div style={{ fontSize: '12px', lineHeight: 1.65 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--danger)' }}>0% show rate</p>
        <p style={{ margin: '0 0 6px', color: 'var(--text-2)' }}>{bookings} booking{bookings !== 1 ? 's' : ''} made, none kept yet.</p>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '11px' }}>confirmation follow-up before each appointment is the primary lever.</p>
      </div>
    )
    return (
      <div style={{ fontSize: '12px', lineHeight: 1.65 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#22c55e' }}>{rate.toFixed(1)}% show rate</p>
        <p style={{ margin: '0 0 6px', color: 'var(--text-2)' }}>{shows} sessions from {bookings} booked at this market.</p>
        {small && <p style={{ margin: '0 0 6px', color: '#f59e0b', fontSize: '11px' }}>Small sample — directional signal only.</p>}
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '11px' }}>Cold outreach benchmark: 8–15% for dormant leads.</p>
      </div>
    )
  }

  const COL_TIPS = {
    total_calls:      'Total outbound call attempts to leads in this area code. One lead may receive multiple calls across the campaign.',
    unique_leads:     'Unique individuals who received at least one call — the actual database size for this market.',
    bookings:         'Confirmed intro session appointments booked by Phiwe from outreach to this market.',
    shows:            'Attended intro sessions — the lead came in. This is the point where StretchLab takes over.',
    booking_rate_pct: 'Appointments booked as a percentage of all calls. Cold outreach benchmark for dormant leads: 1–5%.',
  }

  function TH({ k, children, tip }) {
    const active = sortKey === k
    return (
      <th
        onClick={() => handleSort(k)}
        style={{
          padding: '8px 12px', fontSize: '10px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: active ? 'var(--accent)' : 'var(--muted)',
          cursor: 'pointer', userSelect: 'none',
          borderBottom: '1px solid var(--border)',
          textAlign: k === 'area_code' || k === 'city' ? 'left' : 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {tip ? (
          <Tooltip content={tip} position="bottom">
            <span>
              {children}{active ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}{' '}
              <span style={{ opacity: 0.5, fontSize: '9px' }}>ⓘ</span>
            </span>
          </Tooltip>
        ) : (
          <>{children}{active ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}</>
        )}
      </th>
    )
  }

  const visible = showAll ? sorted : sorted.slice(0, 10)

  return (
    <div>
      <div style={{ padding: '10px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={exportCSV}
          style={{
            padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            background: 'transparent', color: 'var(--accent)',
            border: '1px solid var(--accent)', borderRadius: '6px',
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <TH k="city">Market</TH>
              <TH k="area_code">Code</TH>
              <TH k="total_calls"      tip={COL_TIPS.total_calls}>Calls</TH>
              <TH k="unique_leads"     tip={COL_TIPS.unique_leads}>Leads</TH>
              <TH k="bookings"         tip={COL_TIPS.bookings}>Bookings</TH>
              <TH k="shows"            tip={COL_TIPS.shows}>Shows</TH>
              <TH k="booking_rate_pct" tip={COL_TIPS.booking_rate_pct}>Booking %</TH>
              <TH k="show_rate_pct">Show %</TH>
            </tr>
          </thead>
          <tbody>
            {visible.map((m, i) => {
              const isTop      = top3ShowKeys.includes(m.area_code)
              const isExpanded = expandedCode === m.area_code

              const callsPerLead = +m.unique_leads > 0 ? +m.total_calls / +m.unique_leads : 0
              const runway = callsPerLead < 3
                ? { label: 'Untapped',  color: '#22c55e', note: `${callsPerLead.toFixed(1)} calls/lead — room to increase call frequency on this database.` }
                : callsPerLead < 7
                ? { label: 'Active',    color: '#f59e0b', note: `${callsPerLead.toFixed(1)} calls/lead — normal cold outreach cadence. Maintain current tempo.` }
                : { label: 'Saturated', color: '#ef4444', note: `${callsPerLead.toFixed(1)} calls/lead — this database has been heavily contacted. Fresh leads or a different approach may be needed.` }

              return (
                <React.Fragment key={m.area_code}>
                  <tr
                    onClick={() => setExpandedCode(isExpanded ? null : m.area_code)}
                    style={{
                      borderLeft:  isTop ? '2px solid #22c55e' : '2px solid transparent',
                      background:  isExpanded ? 'rgba(255,255,255,0.03)' : i % 2 === 0 ? 'transparent' : 'var(--surface-2)',
                      cursor:      'pointer',
                      transition:  'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: isTop ? 600 : 400 }}>
                      {m.city && m.city !== 'Other' ? m.city : '—'}
                      {m.state && m.state !== 'Other' && (
                        <span style={{
                          display: 'inline-block', marginLeft: '6px', padding: '1px 5px',
                          fontSize: '9px', fontWeight: 700, borderRadius: '4px', verticalAlign: 'middle',
                          background: m.state === 'Louisiana' ? '#14532d' : m.state === 'Michigan' ? '#1e3a5f' : '#27272a',
                          color:      m.state === 'Louisiana' ? '#86efac' : m.state === 'Michigan' ? '#93c5fd' : '#71717a',
                          letterSpacing: '0.05em',
                        }}>
                          {m.state.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--muted)', opacity: 0.5 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontSize: '11px' }}>{m.area_code}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{Number(m.total_calls).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{m.unique_leads}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: +m.bookings > 0 ? 'var(--accent)' : 'var(--muted)', fontWeight: +m.bookings > 0 ? 700 : 400 }}>
                      {+m.bookings > 0 ? m.bookings : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: +m.shows > 0 ? '#22c55e' : 'var(--muted)' }}>
                      {+m.shows > 0 ? m.shows : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: 'var(--text-2)' }}>
                      {(+(m.booking_rate_pct) || 0).toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontWeight: 600, color: showRateColor(+(m.show_rate_pct) || 0) }}>
                      <Tooltip content={showRateTooltipContent(m)} position="top">
                        <span style={{ cursor: 'help' }}>
                          {(+(m.show_rate_pct) || 0).toFixed(1)}%
                          <span style={{ fontSize: '9px', marginLeft: '3px', opacity: 0.6, fontFamily: 'DM Sans, sans-serif' }}>ⓘ</span>
                        </span>
                      </Tooltip>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr style={{ borderLeft: isTop ? '2px solid #22c55e' : '2px solid transparent' }}>
                      <td colSpan={8} style={{ padding: '16px 20px 20px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '28px' }}>

                          {/* Conversion funnel */}
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
                              Conversion funnel
                            </p>
                            {[
                              { label: 'Calls made',  count: +m.total_calls  || 0, color: 'var(--muted)',  rate: null },
                              { label: 'Unique leads', count: +m.unique_leads || 0, color: 'var(--text-2)', rate: `${m.city !== 'Other' ? m.city : `Area ${m.area_code}`} database` },
                              { label: 'Bookings',     count: +m.bookings     || 0, color: 'var(--accent)', rate: `${(+(m.booking_rate_pct) || 0).toFixed(1)}% of calls` },
                              { label: 'Sessions',     count: +m.shows        || 0, color: '#22c55e',       rate: +m.bookings > 0 ? `${(+(m.show_rate_pct) || 0).toFixed(1)}% of bookings` : '—' },
                            ].map(step => (
                              <div key={step.label} style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{step.label}</span>
                                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: step.color }}>{step.count.toLocaleString()}</span>
                                </div>
                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', borderRadius: '2px', background: step.color,
                                    width: `${Math.max(step.count > 0 ? 2 : 0, Math.min(100, (step.count / maxCalls) * 100))}%`,
                                  }} />
                                </div>
                                {step.rate && <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '2px 0 0' }}>{step.rate}</p>}
                              </div>
                            ))}
                          </div>

                          {/* Market read + runway */}
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                              Market read
                            </p>
                            <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: '0 0 14px' }}>
                              {marketStatusText(m)}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Database runway:</span>
                              <span style={{
                                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.05em', color: runway.color,
                                background: `${runway.color}18`, padding: '2px 8px', borderRadius: '3px',
                              }}>
                                {runway.label}
                              </span>
                              <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                                {callsPerLead.toFixed(1)} calls/lead
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
                              {runway.note}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'center', padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowAll(s => !s)}
          style={{
            padding: '7px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            background: 'transparent', color: 'var(--text-2)',
            border: '1px solid var(--border)', borderRadius: '6px',
          }}
        >
          {showAll ? '↑ Show less' : `↓ Show all ${sorted.length} markets`}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Markets() {
  const { data: markets, loading } = useData(loadByAreaCode)
  const rows = markets ?? []

  const totalMarkets   = useMemo(() => new Set(rows.map(r => r.state).filter(s => s !== 'Other')).size, [rows])
  const totalCalls     = useMemo(() => rows.reduce((s, r) => s + (+r.total_calls || 0), 0), [rows])
  const totalShows     = useMemo(() => rows.reduce((s, r) => s + (+r.shows || 0), 0), [rows])
  const totalBookings  = useMemo(() => rows.reduce((s, r) => s + (+r.bookings || 0), 0), [rows])
  const convertingMkts = useMemo(() => rows.filter(r => +r.shows > 0).length, [rows])
  const stalledMkts    = useMemo(() => rows.filter(r => (+r.bookings || 0) > 0 && (+r.shows || 0) === 0).length, [rows])

  const insightPrompt = useMemo(() => {
    if (loading || !rows.length) return ''
    const daysRemaining  = Math.max(0, Math.ceil((new Date('2026-05-24') - new Date()) / 86400000))
    const sessionsNeeded = Math.max(0, 77 - totalShows)
    const dailyRequired  = daysRemaining > 0 ? (sessionsNeeded / daysRemaining).toFixed(1) : '—'
    return `Market intelligence summary for StretchLab client. ${rows.length} area codes across ${totalMarkets} states. ${totalCalls.toLocaleString()} total outreach calls — cold outreach to dormant leads.
Converting markets (sessions attended): ${convertingMkts}. Stalled markets (bookings but 0 shows): ${stalledMkts}.
Total bookings: ${totalBookings}. Total sessions attended: ${totalShows}.
Pace context: ${daysRemaining} days to May 24 deadline. ${sessionsNeeded} more sessions needed across all markets. Requires ${dailyRequired} sessions/day.
Context: admin-initiated cancellations have suppressed the show rate in some markets — not call quality or lead quality.`
  }, [loading, rows.length, totalMarkets, totalCalls, convertingMkts, stalledMkts, totalBookings, totalShows])

  const { insight: pageInsight, loading: insightLoading, error: insightError, refresh: refreshInsight } = useInsight('client', insightPrompt)

  const byRegion = useMemo(() => {
    const acc = {}
    rows.forEach(r => {
      const reg = r.region || 'Other'
      if (!acc[reg]) acc[reg] = { region: reg, total_calls: 0, leads: 0, bookings: 0, shows: 0 }
      acc[reg].total_calls += +r.total_calls  || 0
      acc[reg].leads       += +r.unique_leads || 0
      acc[reg].bookings    += +r.bookings     || 0
      acc[reg].shows       += +r.shows        || 0
    })
    return Object.values(acc).sort((a, b) => b.total_calls - a.total_calls)
  }, [rows])

  if (loading) return <Loader text="Loading market data…" />
  if (rows.length === 0) return <Empty text="No area code data available." />

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Markets</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
          {rows.length} area codes · {totalMarkets} state{totalMarkets !== 1 ? 's' : ''} · {totalCalls.toLocaleString()} calls — cold outreach to dormant leads
        </p>
      </div>

      {/* Action Buckets */}
      <MarketStory rows={rows} totalShows={totalShows} />

      {/* Regional Breakdown */}
      <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Regional Breakdown</h2>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Bars show booking counts per region — colour shows whether bookings converted to sessions. Hover for detail.
      </p>
      <Card style={{ marginBottom: '28px' }}>
        <RegionalChart byRegion={byRegion} />
      </Card>

      {/* Market Performance Table */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Market Performance</h2>
        <div style={{ display: 'flex', gap: '14px', fontSize: '11px' }}>
          <span style={{ color: '#22c55e' }}>■ ≥15% show rate</span>
          <span style={{ color: '#f59e0b' }}>■ 8–14%</span>
          <span style={{ color: '#ef4444' }}>■ &lt;8%</span>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px' }}>
        {rows.length} area codes · click any row for funnel, market read, and database runway. This shows which areas Phiwe is calling and which are converting — it tells us where to prioritise flexologist availability for booked sessions.
      </p>
      <Card style={{ marginBottom: '28px', padding: 0 }}>
        <MarketTable markets={rows} />
      </Card>

      {/* AI Insight block */}
      <InsightBlock insight={pageInsight} loading={insightLoading} error={insightError} onRefresh={refreshInsight} />

    </div>
  )
}
