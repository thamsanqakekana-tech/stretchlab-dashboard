import React, { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { useData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadCalls } from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

const DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8) // 8am–5pm

function formatHour(h) {
  const n = parseInt(h, 10)
  if (isNaN(n)) return String(h)
  return n === 0 ? '12am' : n < 12 ? `${n}am` : n === 12 ? '12pm' : `${n - 12}pm`
}

// Blue colour scale matching CampaignPulse connect rate heatmap
function connectColor(rate) {
  if (rate >= 0.245) return '#0C447C'
  if (rate >= 0.200) return '#378ADD'
  if (rate >= 0.150) return '#85B7EB'
  if (rate >= 0.100) return '#B5D4F4'
  return '#E0EEF9'
}

function Heatmap({ slots }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !slots?.length) return

    const width      = ref.current.clientWidth || 700
    const cellW      = Math.floor((width - 80) / HOURS.length)
    const cellH      = 48
    const marginLeft = 90
    const marginTop  = 40
    const height     = DAYS.length * cellH + marginTop + 20

    d3.select(ref.current).selectAll('*').remove()

    const svg = d3.select(ref.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'transparent')

    const maxCalls     = d3.max(slots, (d) => d.total_calls) || 1
    const opacityScale = d3.scaleLinear().domain([0, maxCalls]).range([0.3, 1])

    const idx = {}
    slots.forEach((d) => { idx[`${d.day_of_week}_${d.hour}`] = d })

    // Day labels
    DAYS.forEach((day, di) => {
      svg.append('text')
        .attr('x', marginLeft - 8)
        .attr('y', marginTop + di * cellH + cellH / 2 + 5)
        .attr('text-anchor', 'end')
        .attr('font-size', 12)
        .attr('fill', '#6b8f74')
        .attr('font-family', 'DM Sans, sans-serif')
        .text(day.slice(0, 3))
    })

    // Hour labels
    HOURS.forEach((hour, hi) => {
      svg.append('text')
        .attr('x', marginLeft + hi * cellW + cellW / 2)
        .attr('y', marginTop - 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('fill', '#6b8f74')
        .attr('font-family', 'DM Sans, sans-serif')
        .text(formatHour(hour))
    })

    // Cells
    DAYS.forEach((day, di) => {
      HOURS.forEach((hour, hi) => {
        const cell    = idx[`${day}_${hour}`]
        const hasData = cell && cell.total_calls >= 5
        const rate    = hasData ? cell.connect_rate : 0
        const vol     = cell?.total_calls ?? 0

        const g = svg.append('g')
          .attr('transform', `translate(${marginLeft + hi * cellW}, ${marginTop + di * cellH})`)

        g.append('rect')
          .attr('width', cellW - 2)
          .attr('height', cellH - 2)
          .attr('rx', 4)
          .attr('fill', hasData ? connectColor(rate) : '#1e2e22')
          .attr('opacity', hasData ? opacityScale(vol) : 0.15)

        if (hasData) {
          const darkText = rate >= 0.20
          g.append('text')
            .attr('x', (cellW - 2) / 2)
            .attr('y', (cellH - 2) / 2 - 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', 10)
            .attr('font-weight', 600)
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('fill', darkText ? '#0a0f0d' : '#e8f0ea')
            .text(`${Math.round(rate * 100)}%`)

          g.append('text')
            .attr('x', (cellW - 2) / 2)
            .attr('y', (cellH - 2) / 2 + 10)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', 9)
            .attr('font-family', 'DM Sans, sans-serif')
            .attr('fill', darkText ? '#0a0f0d88' : '#6b8f74')
            .text(`${vol}c`)
        }

        g.append('title').text(
          hasData
            ? `${day} ${formatHour(hour)}\nConnect rate: ${Math.round(rate * 100)}%\nCalls: ${vol}`
            : `${day} ${formatHour(hour)}\nInsufficient data (<5 calls)`
        )
      })
    })

    // Best / worst outlines — stat-valid slots only
    const statSlots = slots.filter(s => s.total_calls >= 5)
    if (!statSlots.length) return

    const best  = [...statSlots].sort((a, b) => b.connect_rate - a.connect_rate)[0]
    const worst = [...statSlots].sort((a, b) => a.connect_rate - b.connect_rate)[0]

    const drawOutline = (slot, color) => {
      const di = DAYS.indexOf(slot.day_of_week)
      const hi = HOURS.indexOf(slot.hour)
      if (di < 0 || hi < 0) return
      svg.append('rect')
        .attr('x', marginLeft + hi * cellW - 1)
        .attr('y', marginTop + di * cellH - 1)
        .attr('width', cellW)
        .attr('height', cellH)
        .attr('rx', 4)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
    }

    if (best) drawOutline(best, '#22c55e')
    if (worst && (worst.day_of_week !== best?.day_of_week || worst.hour !== best?.hour)) {
      drawOutline(worst, '#ef4444')
    }
  }, [slots])

  return <div ref={ref} style={{ width: '100%' }} />
}

export default function CallTimingHeatmap() {
  const { data: calls, loading } = useData(loadCalls)

  // Group raw calls by day + hour, compute connect rate (live_talk_min >= 0.5)
  const slots = useMemo(() => {
    if (!calls?.length) return []
    const m = {}
    calls.forEach(r => {
      const hr  = parseInt(r.hour, 10)
      const day = String(r.day_of_week || '')
      if (isNaN(hr) || hr < 8 || hr > 17 || !DAYS.includes(day)) return
      const key = `${day}_${hr}`
      if (!m[key]) m[key] = { day_of_week: day, hour: hr, total_calls: 0, connected: 0 }
      m[key].total_calls += 1
      if (parseFloat(r.live_talk_min || 0) >= 0.5) m[key].connected += 1
    })
    return Object.values(m).map(s => ({
      ...s,
      connect_rate: s.total_calls > 0 ? s.connected / s.total_calls : 0,
    }))
  }, [calls])

  const statSlots = useMemo(() => slots.filter(s => s.total_calls >= 5), [slots])

  const best = useMemo(() =>
    statSlots.length ? [...statSlots].sort((a, b) => b.connect_rate - a.connect_rate)[0] : null
  , [statSlots])

  const worst = useMemo(() =>
    statSlots.length ? [...statSlots].sort((a, b) => a.connect_rate - b.connect_rate)[0] : null
  , [statSlots])

  // Dual sweet spots: above-average on both volume and connect rate
  const sweetSpots = useMemo(() => {
    if (!statSlots.length) return []
    const avgRate = statSlots.reduce((s, d) => s + d.connect_rate, 0) / statSlots.length
    const avgVol  = statSlots.reduce((s, d) => s + d.total_calls,  0) / statSlots.length
    return [...statSlots]
      .filter(s => s.connect_rate >= avgRate && s.total_calls >= avgVol)
      .sort((a, b) => (b.connect_rate * b.total_calls) - (a.connect_rate * a.total_calls))
      .slice(0, 3)
  }, [statSlots])

  const promptText = useMemo(() => {
    if (!statSlots.length) return ''
    const topSlots = [...statSlots]
      .sort((a, b) => b.connect_rate - a.connect_rate)
      .slice(0, 5)
      .map(s => `${s.day_of_week} ${formatHour(s.hour)}: ${Math.round(s.connect_rate * 100)}% connect rate, ${s.total_calls} calls`)
      .join('\n')
    const sweetText = sweetSpots
      .map(s => `${s.day_of_week} ${formatHour(s.hour)}: ${Math.round(s.connect_rate * 100)}% connect, ${s.total_calls} calls`)
      .join('; ')
    return `StretchLab B2C re-engagement campaign — Execo BI pipeline analysis. SDR: Phiwe Khasa.
Connect rate = real conversations (live_talk_min >= 0.5, i.e. 30+ seconds). Cold re-engagement outreach standard: 10–18%.

Top 5 connect rate windows (statistically valid, >=5 calls each):
${topSlots}

Best single window: ${best?.day_of_week} ${formatHour(best?.hour ?? 0)} at ${Math.round((best?.connect_rate ?? 0) * 100)}% connect rate across ${best?.total_calls} calls.
Worst single window: ${worst?.day_of_week} ${formatHour(worst?.hour ?? 0)} at ${Math.round((worst?.connect_rate ?? 0) * 100)}% connect rate across ${worst?.total_calls} calls.
Priority windows (high volume + high connect rate): ${sweetText || 'none identified — insufficient volume per slot'}.

Write a manager-facing insight paragraph (4–5 sentences) for the Execo delivery team. Requirements:
1. Open by naming which specific windows (day + hour) produce real conversations above the 10–18% cold re-engagement standard, with exact percentages.
2. Identify the priority windows where volume and connect rate compound, explaining why these are the highest-leverage blocks.
3. Name one concrete schedule shift — move calls from the worst window to the best window — with the specific hours.
4. Close with a sentence that reinforces that this level of schedule precision is only achievable through Execo's BI pipeline.
Use confident, consultant-grade language. No vague qualifiers. Every claim must reference a specific day, hour, or percentage from the data.`
  }, [statSlots, best, worst, sweetSpots])

  const { insight, loading: iL, error: iE, refresh } = useInsight('manager', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading call data…</div>

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        Call Timing Heatmap
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Connect rate by day and hour — real conversations only (≥30 seconds of talk time). Slots with fewer than 5 calls are excluded as statistically insufficient. Green outline = best window · Red = worst.
      </p>

      {/* Best / Worst annotation cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {best && (
          <Card style={{ borderLeft: '3px solid var(--accent)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Best Window
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono', marginBottom: '2px' }}>
              {best.day_of_week} {formatHour(best.hour)}–{formatHour(best.hour + 1)}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--accent)' }}>
              {Math.round(best.connect_rate * 100)}% connect rate · {best.total_calls} calls
            </p>
          </Card>
        )}
        {worst && (
          <Card style={{ borderLeft: '3px solid var(--danger)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Worst Window
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono', marginBottom: '2px' }}>
              {worst.day_of_week} {formatHour(worst.hour)}–{formatHour(worst.hour + 1)}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--danger)' }}>
              {Math.round(worst.connect_rate * 100)}% connect rate · {worst.total_calls} calls
            </p>
          </Card>
        )}
      </div>

      {/* Priority windows — dual sweet spots */}
      {sweetSpots.length > 0 && (
        <Card style={{ marginBottom: '20px', borderLeft: '3px solid #378ADD' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#378ADD', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Priority Windows — High Volume + High Connect Rate
          </p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {sweetSpots.map(s => (
              <div key={`${s.day_of_week}_${s.hour}`}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>
                  {s.day_of_week} {formatHour(s.hour)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>
                  {Math.round(s.connect_rate * 100)}% connect · {s.total_calls} calls
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', marginBottom: 0, lineHeight: 1.5 }}>
            These windows compound volume and connect rate simultaneously — the highest-leverage blocks in the weekly schedule.
          </p>
        </Card>
      )}

      <Card style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>
          Cell colour = connect rate. Cell opacity = call volume. Numbers: connect rate% / call count. Cold re-engagement outreach standard: 10–18%.
        </p>
        {slots.length ? (
          <Heatmap slots={slots} />
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No call data available.</p>
        )}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[['#0C447C', '≥24.5%'], ['#378ADD', '20–24.5%'], ['#85B7EB', '15–20%'], ['#B5D4F4', '10–15%'], ['#E0EEF9', '<10%']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{l} connect rate</span>
            </div>
          ))}
          <span style={{ fontSize: '10px', color: 'var(--muted)', opacity: 0.6 }}>· Dark cells = &lt;5 calls, excluded</span>
        </div>
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
