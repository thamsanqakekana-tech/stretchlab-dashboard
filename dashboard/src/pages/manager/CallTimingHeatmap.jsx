import React, { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { useData } from '../../hooks/useData.js'
import { useInsight } from '../../hooks/useInsight.js'
import { loadCallTiming } from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8am–6pm

function Heatmap({ data }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !data?.length) return

    const width = ref.current.clientWidth || 700
    const cellW = Math.floor((width - 80) / HOURS.length)
    const cellH = 48
    const marginLeft = 90
    const marginTop = 40
    const height = DAYS.length * cellH + marginTop + 20

    d3.select(ref.current).selectAll('*').remove()

    const svg = d3
      .select(ref.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'transparent')

    // Colour scale — engagement rate
    const maxRate = d3.max(data, (d) => d.engagement_rate_pct) || 100
    const colorScale = d3
      .scaleSequential(d3.interpolateGreens)
      .domain([0, maxRate])

    // Opacity scale — call volume
    const maxCalls = d3.max(data, (d) => d.total_calls) || 1
    const opacityScale = d3.scaleLinear().domain([0, maxCalls]).range([0.25, 1])

    // Index data
    const idx = {}
    data.forEach((d) => {
      idx[`${d.day_of_week}_${d.hour}`] = d
    })

    // Day labels
    DAYS.forEach((day, di) => {
      svg
        .append('text')
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
      svg
        .append('text')
        .attr('x', marginLeft + hi * cellW + cellW / 2)
        .attr('y', marginTop - 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('fill', '#6b8f74')
        .attr('font-family', 'DM Sans, sans-serif')
        .text(`${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`)
    })

    // Cells
    DAYS.forEach((day, di) => {
      HOURS.forEach((hour, hi) => {
        const cell = idx[`${day}_${hour}`]
        const rate = cell?.engagement_rate_pct ?? 0
        const vol = cell?.total_calls ?? 0

        const g = svg
          .append('g')
          .attr('transform', `translate(${marginLeft + hi * cellW}, ${marginTop + di * cellH})`)

        g.append('rect')
          .attr('width', cellW - 2)
          .attr('height', cellH - 2)
          .attr('rx', 4)
          .attr('fill', rate > 0 ? colorScale(rate) : '#1e2e22')
          .attr('opacity', vol > 0 ? opacityScale(vol) : 0.15)

        if (vol > 0) {
          g.append('text')
            .attr('x', (cellW - 2) / 2)
            .attr('y', (cellH - 2) / 2 - 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', 10)
            .attr('font-weight', 600)
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('fill', rate > maxRate * 0.6 ? '#0a0f0d' : '#e8f0ea')
            .text(`${Math.round(rate)}%`)

          g.append('text')
            .attr('x', (cellW - 2) / 2)
            .attr('y', (cellH - 2) / 2 + 10)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', 9)
            .attr('font-family', 'DM Sans, sans-serif')
            .attr('fill', rate > maxRate * 0.6 ? '#0a0f0d88' : '#6b8f74')
            .text(`${vol}c`)
        }

        // Tooltip on hover
        g.append('title').text(
          `${day} ${hour}:00\nEngagement: ${rate.toFixed(1)}%\nCalls: ${vol}`
        )
      })
    })

    // Best / worst annotations
    const best = [...data].sort((a, b) => b.engagement_rate_pct - a.engagement_rate_pct)[0]
    const worst = [...data].filter((d) => d.total_calls > 0).sort((a, b) => a.engagement_rate_pct - b.engagement_rate_pct)[0]

    if (best) {
      const di = DAYS.indexOf(best.day_of_week)
      const hi = HOURS.indexOf(best.hour)
      if (di >= 0 && hi >= 0) {
        svg.append('rect')
          .attr('x', marginLeft + hi * cellW - 1)
          .attr('y', marginTop + di * cellH - 1)
          .attr('width', cellW)
          .attr('height', cellH)
          .attr('rx', 4)
          .attr('fill', 'none')
          .attr('stroke', '#22c55e')
          .attr('stroke-width', 2)
      }
    }

    if (worst && worst !== best) {
      const di = DAYS.indexOf(worst.day_of_week)
      const hi = HOURS.indexOf(worst.hour)
      if (di >= 0 && hi >= 0) {
        svg.append('rect')
          .attr('x', marginLeft + hi * cellW - 1)
          .attr('y', marginTop + di * cellH - 1)
          .attr('width', cellW)
          .attr('height', cellH)
          .attr('rx', 4)
          .attr('fill', 'none')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 2)
      }
    }
  }, [data])

  return <div ref={ref} style={{ width: '100%' }} />
}

export default function CallTimingHeatmap() {
  const { data, loading } = useData(loadCallTiming)

  const best = useMemo(() => {
    if (!data?.length) return null
    return [...data].sort((a, b) => b.engagement_rate_pct - a.engagement_rate_pct)[0]
  }, [data])

  const worst = useMemo(() => {
    if (!data?.length) return null
    return [...data].filter((d) => d.total_calls > 0).sort((a, b) => a.engagement_rate_pct - b.engagement_rate_pct)[0]
  }, [data])

  const promptText = useMemo(() => {
    if (!data?.length) return ''
    return `Call timing heatmap data:
Best window: ${best?.day_of_week} ${best?.hour}:00 — ${best?.engagement_rate_pct?.toFixed(1)}% engagement, ${best?.total_calls} calls.
Worst window: ${worst?.day_of_week} ${worst?.hour}:00 — ${worst?.engagement_rate_pct?.toFixed(1)}% engagement, ${worst?.total_calls} calls.
Industry benchmark: 65–75% answer rate.
Write manager-facing call timing insight with specific hours and actionable shift recommendations.`
  }, [data, best, worst])

  const { insight, loading: iL, error: iE, refresh } = useInsight('manager', promptText)

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading call timing data…</div>

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        Call Timing Heatmap
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
        Answer rate by day and hour — green outline = best window, red = worst
      </p>

      {/* Annotation row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {best && (
          <Card style={{ borderLeft: '3px solid var(--accent)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Best Window
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono', marginBottom: '2px' }}>
              {best.day_of_week} {best.hour}:00–{best.hour + 1}:00
            </p>
            <p style={{ fontSize: '13px', color: 'var(--accent)' }}>
              {best.engagement_rate_pct?.toFixed(1)}% engagement · {best.total_calls} calls
            </p>
          </Card>
        )}
        {worst && (
          <Card style={{ borderLeft: '3px solid var(--danger)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Worst Window
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono', marginBottom: '2px' }}>
              {worst.day_of_week} {worst.hour}:00–{worst.hour + 1}:00
            </p>
            <p style={{ fontSize: '13px', color: 'var(--danger)' }}>
              {worst.engagement_rate_pct?.toFixed(1)}% engagement · {worst.total_calls} calls
            </p>
          </Card>
        )}
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>
          Cell colour = answer rate (light → dark green). Cell opacity = call volume. Numbers: rate% / call count.
        </p>
        {data?.length ? (
          <Heatmap data={data} />
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No call timing data available.</p>
        )}
      </Card>

      <InsightBlock insight={insight} loading={iL} error={iE} onRefresh={refresh} />
    </div>
  )
}
