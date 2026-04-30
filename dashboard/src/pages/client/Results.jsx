import { useState, useMemo } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import {
  loadBookings,
  loadInsights,
  loadCancellationAnalysis,
  loadPipeline,
} from '../../utils/dataLoader.js'
import { useAuth } from '../../context/AuthContext.jsx'
import Card from '../../components/Card.jsx'
import InsightBlock from '../../components/InsightBlock.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────
const SEGMENT_ORDER = ['working', 'small-sample', 'needs-attention', 'studio-ops', 'activating', 'inactive']
const SEGMENT_LABEL = {
  working:           'Proving the model',
  'small-sample':    'Building pipeline',
  'needs-attention': 'Needs attention',
  'studio-ops':      'Studio ops',
  activating:        'Activating',
  inactive:          'Needs attention',
}
const SEGMENT_ACCENT = {
  inactive:          '#94a3b8',
  activating:        '#6366f1',
  'small-sample':    '#38bdf8',
  'studio-ops':      '#f59e0b',
  working:           '#22c55e',
  'needs-attention': '#ef4444',
}
const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

// ─── Studio stats builder ─────────────────────────────────────────────────────
function buildStudioStats(leads, cancellations = []) {
  const hasShow   = b => +b.has_show === 1
  const getStatus = b => String(b.current_status || b['Current Status'] || '').trim()

  const grouped = {}
  leads.forEach(b => {
    const loc = String(b.booking_location || b['Booking Location'] || '').trim()
    if (!loc) return
    if (!grouped[loc]) grouped[loc] = []
    grouped[loc].push(b)
  })

  return Object.entries(grouped).map(([studio, bks]) => {
    const attended     = bks.filter(b => hasShow(b)).length
    const upcoming     = bks.filter(b => !hasShow(b) && getStatus(b).includes('Open Booking')).length
    const noShows      = bks.filter(b => !hasShow(b) && getStatus(b).includes('No Show')).length
    const adminCancels = bks.filter(b => !hasShow(b) && getStatus(b).includes('Cancelled By Admin')).length
    const custCancels  = bks.filter(b => !hasShow(b) && (
      getStatus(b).includes('Cancelled Within Policy') ||
      getStatus(b).includes('Cancelled Outside Policy')
    )).length
    const totalCancels = adminCancels + custCancels
    const rescheduled  = bks.filter(b => !hasShow(b) && getStatus(b).includes('Rescheduled')).length
    const total        = bks.length
    const resolved     = attended + totalCancels + noShows
    const showRate     = resolved > 0 ? attended / resolved : 0
    const adminCancelPct = resolved >= 2 ? adminCancels / resolved : 0

    const cancelByDay = {}
    DAYS_OF_WEEK.forEach(d => { cancelByDay[d] = 0 })
    bks.filter(b =>
      getStatus(b).includes('Cancelled Within Policy') ||
      getStatus(b).includes('Cancelled Outside Policy') ||
      getStatus(b).includes('Cancelled By Admin')
    ).forEach(b => {
      const d = String(b.booking_day_of_week ?? '').trim()
      if (cancelByDay[d] !== undefined) cancelByDay[d]++
    })

    const cancelIds = new Set(bks.filter(b =>
      getStatus(b).includes('Cancelled Within Policy') ||
      getStatus(b).includes('Cancelled Outside Policy') ||
      getStatus(b).includes('Cancelled By Admin')
    ).map(b => String(b.booking_id)))
    const matched = cancellations.filter(c => cancelIds.has(String(c.booking_id)))
    const cancelByTiming = { lastMinute: 0, shortNotice: 0, advance: 0 }
    matched.forEach(c => {
      const t = String(c.cancellation_timing ?? '')
      if (t.includes('<24')) cancelByTiming.lastMinute++
      else if (t.includes('1-7')) cancelByTiming.shortNotice++
      else cancelByTiming.advance++
    })

    const segment =
      total === 0                                              ? 'inactive'
      : attended >= 1 && showRate >= 0.25                     ? 'working'
      : attended === 0 && upcoming >= 1                       ? 'activating'
      : attended >= 1 || (upcoming === 0 && totalCancels > 0) ? 'needs-attention'
      :                                                          'activating'

    if (import.meta.env.DEV) {
      console.log(`[Studio] ${studio}: total=${total} attended=${attended} upcoming=${upcoming} cancelled=${totalCancels} showRate=${(showRate * 100).toFixed(1)}% segment=${segment}`)
    }

    const smallSample = resolved > 0 && resolved <= 4

    return {
      studio, total, shows: attended, noShows, custCancels, adminCancels, totalCancels,
      rescheduled, upcoming, resolved, showRate, adminCancelPct,
      segment, smallSample, bookings: bks, cancelByDay, cancelByTiming,
      fastBookings: 0, fastBookingCancels: 0,
    }
  }).sort((a, b) => b.total - a.total)
}

// ─── Ownership banner ─────────────────────────────────────────────────────────
function OwnershipBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', marginBottom: '16px',
      background: 'var(--surface)', borderRadius: '8px',
      border: '1px solid var(--border)',
      flexWrap: 'wrap', gap: '8px',
    }}>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text)' }}>
          <strong style={{ color: 'var(--positive)' }}>Execo</strong>
          {' '}— outreach, booking, and pre-session confirmation
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text)' }}>
          <strong style={{ color: '#378ADD' }}>StretchLab</strong>
          {' '}— the session experience and membership conversion
        </span>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
        Show rate is where both sides meet
      </span>
    </div>
  )
}

// ─── Assessment line ──────────────────────────────────────────────────────────
function assessmentLine(s) {
  if (s.segment === 'inactive')         return 'Studio activation needed — outreach and studio coordination required'
  if (s.segment === 'activating')       return `${s.upcoming} upcoming · no resolved sessions yet`
  if (s.segment === 'small-sample')     return `${s.shows} attended · ${s.upcoming > 0 ? `${s.upcoming} upcoming` : 'resolving outcomes'}`
  if (s.segment === 'studio-ops')       return `${s.adminCancels} studio-initiated cancels · show rate pending resolution`
  if (s.segment === 'working')          return `${s.shows} attended · ${(s.showRate * 100).toFixed(0)}% show rate`
  return `${s.shows} attended · ${s.upcoming > 0 ? `${s.upcoming} upcoming` : 'monitor conversion'}`
}

// ─── Show rate colour ─────────────────────────────────────────────────────────
function srColor(showRate, resolved) {
  if (resolved === 0) return 'var(--muted)'
  if (showRate >= 0.25) return '#22c55e'
  if (showRate >= 0.15) return '#f59e0b'
  return '#ef4444'
}

// ─── Studio narrative (manager view only) ────────────────────────────────────
function studioNarrative(s) {
  const name = s.studio.replace(/^StretchLab\s+/i, '')
  const rate = s.showRate != null ? Math.round(s.showRate * 100) : 0

  let opening = ''
  if (s.segment === 'activating')
    opening = `${s.total} session${s.total !== 1 ? 's are' : ' is'} booked at ${name} — outcomes will start coming in as those appointments are held.`
  else if (s.shows > 0 && s.total >= 3)
    opening = `${name} has held ${s.shows} of ${s.total} bookings — a ${rate}% show rate on resolved sessions.`
  else if (s.shows > 0)
    opening = `${name} has held ${s.shows} session${s.shows !== 1 ? 's' : ''} from ${s.total} booking${s.total !== 1 ? 's' : ''}.`
  else if (s.resolved >= 2)
    opening = `${s.resolved} sessions at ${name} have passed their date — none were held.`
  else
    opening = `${name} has ${s.total} booked session${s.total !== 1 ? 's' : ''} with outcomes still to come.`

  let pattern = ''
  if (s.segment === 'studio-ops')
    pattern = `${s.adminCancels} of the ${s.totalCancels} cancellation${s.totalCancels !== 1 ? 's' : ''} at ${name} happened after the session was confirmed — the studio was unavailable when the lead arrived.`
  else if (s.adminCancels > 0 && s.adminCancels >= s.custCancels)
    pattern = `The cancellations are split between leads and the studio — there is room to improve on both sides.`
  else if (s.shows > 0 && s.custCancels > 0)
    pattern = `${s.custCancels} lead${s.custCancels !== 1 ? 's' : ''} cancelled after booking.`
  else if (s.shows > 0 && s.adminCancels === 0)
    pattern = `Every session that held here did so cleanly — dormant leads who came back and showed up.`
  else if (s.upcoming > 0)
    pattern = `${s.upcoming} upcoming session${s.upcoming !== 1 ? 's are' : ' is'} confirmed — these are the next opportunities.`
  else
    pattern = `No upcoming sessions at ${name} right now.`

  return `${opening} ${pattern}`
}

// ─── Pipeline context line ────────────────────────────────────────────────────
function pipelineContext(r, isManagerView = false) {
  const days  = +r.days_until
  const calls = +r.total_calls_made
  const risk  = String(r.risk_level ?? '').toLowerCase()
  if (!isManagerView) {
    const date = r.booking_date
      ? new Date(r.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—'
    if (days <= 0) return 'Session is today'
    if (days === 1) return 'Session is tomorrow'
    if (days <= 7) return `Session in ${days} days`
    return `Session on ${date}`
  }
  if (days <= 0)       return 'Appointment is today'
  if (days <= 2)       return `Appointment in ${days} day${days !== 1 ? 's' : ''} — confirm now`
  if (risk === 'high') return `High risk — ${calls} call${calls !== 1 ? 's' : ''} made`
  if (calls === 0)     return 'No calls made yet'
  return `${calls} call${calls !== 1 ? 's' : ''} made · ${days} days out`
}

// ─── Mini stacked bar ─────────────────────────────────────────────────────────
function MiniBar({ s }) {
  if (s.total === 0) return <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px' }} />
  const slices = [
    { count: s.shows,        color: '#22c55e' },
    { count: s.upcoming,     color: '#6366f1' },
    { count: s.custCancels,  color: '#ef4444' },
    { count: s.adminCancels, color: '#f59e0b' },
    { count: s.noShows,      color: '#64748b' },
    { count: s.rescheduled,  color: '#38bdf8' },
  ].filter(sl => sl.count > 0)
  return (
    <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '1px' }}>
      {slices.map((sl, i) => (
        <div key={i} style={{ flex: sl.count / s.total, background: sl.color, minWidth: '2px' }} />
      ))}
    </div>
  )
}

// ─── Snapshot strip ───────────────────────────────────────────────────────────
function SnapshotStrip({ stats }) {
  const totals = stats.reduce(
    (acc, s) => ({
      total:    acc.total    + s.total,
      shows:    acc.shows    + s.shows,
      upcoming: acc.upcoming + s.upcoming,
      cancels:  acc.cancels  + s.totalCancels,
    }),
    { total: 0, shows: 0, upcoming: 0, cancels: 0 }
  )
  const studiosWithBookings = stats.filter(s => s.total > 0).length
  const tiles = [
    {
      label: 'Booking locations',
      value: `${studiosWithBookings}/${stats.length}`,
      color: 'var(--accent)',
      tooltip: 'Studios that have at least one booked appointment. Does not reflect current SDR outreach scope.',
    },
    { label: 'Total bookings',    value: totals.total,    color: 'var(--text)',           tooltip: 'All appointments booked by Phiwe across every studio.' },
    { label: 'Sessions attended', value: totals.shows,    color: 'var(--status-above)',   tooltip: 'Appointments confirmed attended via session records.' },
    { label: 'Upcoming',          value: totals.upcoming, color: 'var(--status-within)',  tooltip: 'Booked appointments still to come — outcomes pending.' },
    { label: 'Total cancelled',   value: totals.cancels,  color: 'var(--status-below)',   tooltip: 'Lead-initiated and studio-initiated cancellations combined.' },
  ]
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
      {tiles.map(({ label, value, color, tooltip }) => (
        <Card key={label} style={{ flex: 1, padding: '14px 18px' }} title={tooltip}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{label}</p>
          <p style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color, margin: 0 }}>{value}</p>
        </Card>
      ))}
    </div>
  )
}

// ─── Studio signal card ───────────────────────────────────────────────────────
function StudioSignalCard({ s, isManagerView, pipeline = [] }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab]   = useState('breakdown')

  const name     = s.studio.replace(/^StretchLab\s+/i, '')
  const inactive = s.segment === 'inactive'
  const accent   = SEGMENT_ACCENT[s.segment] ?? 'var(--accent)'
  const srCol    = srColor(s.showRate, s.resolved)
  const srLabel  = s.resolved === 0 ? '—' : `${(s.showRate * 100).toFixed(0)}%`
  // Badge label: rename 'inactive' → 'needs attention', hide 'small-sample' badge
  const badgeText = s.segment === 'inactive' ? 'needs attention' : s.segment.replace('-', ' ')

  const studioPipeline = useMemo(() => {
    const sloc = s.studio.toLowerCase().replace(/^stretchlab\s+/i, '').trim()
    return pipeline.filter(r => {
      const rloc = String(r.booking_location ?? '').toLowerCase().replace(/^stretchlab\s+/i, '').trim()
      return rloc === sloc || rloc.includes(sloc) || sloc.includes(rloc)
    })
  }, [pipeline, s.studio])

  const sortedBks = useMemo(
    () => [...s.bookings].sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date)),
    [s.bookings]
  )

  const tabs = [
    { key: 'breakdown',    label: 'Breakdown' },
    { key: 'appointments', label: `Appointments (${s.total})` },
    ...(isManagerView ? [{ key: 'cancel-split', label: 'Cancel split' }] : []),
  ]

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${accent}28`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: '10px',
      marginBottom: '10px',
      overflow: 'hidden',
      opacity: inactive ? 0.6 : 1,
    }}>
      <button
        onClick={() => !inactive && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          width: '100%', background: 'none', border: 'none',
          padding: '14px 18px', cursor: inactive ? 'default' : 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ minWidth: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: srCol, margin: 0, lineHeight: 1 }}>{srLabel}</p>
          <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>show rate</p>
          <p style={{ fontSize: '8px', color: 'var(--muted)', margin: '1px 0 0', opacity: 0.7 }}>resolved only</p>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{name}</p>
            {s.segment !== 'small-sample' && !(s.segment === 'studio-ops' && !isManagerView) && (
              <span style={{
                fontSize: '9px', fontWeight: 700, color: accent,
                background: `${accent}18`, padding: '1px 6px', borderRadius: '3px',
                textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
              }}>{badgeText}</span>
            )}
          </div>
          <p style={{
            fontSize: '11px',
            color: (s.segment === 'studio-ops' || s.segment === 'needs-attention') ? 'var(--text)' : 'var(--muted)',
            fontWeight: (s.segment === 'studio-ops' || s.segment === 'needs-attention') ? 500 : 400,
            margin: '0 0 6px', lineHeight: 1.4,
          }}>{assessmentLine(s)}</p>
          <MiniBar s={s} />
        </div>

        <div style={{ minWidth: '36px', textAlign: 'right' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', margin: 0 }}>{s.total}</p>
          <p style={{ fontSize: '9px', color: 'var(--muted)', margin: '2px 0 0', textTransform: 'uppercase' }}>bookings</p>
        </div>

        {!inactive && (
          <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        )}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px 18px' }}>

          {/* Narrative paragraph — manager/admin only */}
          {isManagerView && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
              {studioNarrative(s)}
            </p>
          )}

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 12px',
                  borderRadius: '6px', cursor: 'pointer', border: 'none',
                  background: tab === t.key ? accent : 'var(--border)',
                  color: tab === t.key ? '#fff' : 'var(--muted)',
                }}
              >{t.label}</button>
            ))}
          </div>

          {tab === 'breakdown' && (() => {
            const breakdownItems = isManagerView
              ? [
                  { label: 'Attended',        value: s.shows,                        color: 'var(--status-above)' },
                  { label: 'Upcoming',         value: s.upcoming,                     color: 'var(--status-within)' },
                  { label: 'Lead-cancelled',   value: s.custCancels,                  color: '#ef4444' },
                  { label: 'Studio-cancelled', value: s.adminCancels,                 color: '#f59e0b' },
                  { label: 'No-show',          value: s.noShows,                      color: '#64748b' },
                  { label: 'Rescheduled',      value: s.rescheduled,                  color: '#38bdf8' },
                ]
              : [
                  { label: 'Attended',         value: s.shows,                        color: 'var(--status-above)' },
                  { label: 'Upcoming',          value: s.upcoming,                    color: 'var(--status-within)' },
                  { label: 'Cancelled',         value: s.custCancels + s.adminCancels, color: 'var(--status-below)' },
                  { label: 'No-show',           value: s.noShows,                     color: '#64748b' },
                  { label: 'Rescheduled',       value: s.rescheduled,                 color: '#38bdf8' },
                ]
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                {breakdownItems.map(item => (
                  <div key={item.label} style={{
                    background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px',
                    border: `1px solid ${item.color}22`,
                  }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: item.value > 0 ? item.color : 'var(--muted)', margin: '0 0 2px' }}>{item.value}</p>
                    <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {tab === 'appointments' && (
            <>
              {/* Fast-booking stat — manager/admin only (Execo operational data) */}
              {isManagerView && s.total > 0 && (() => {
                const fastPct = ((s.fastBookings / s.total) * 100).toFixed(0)
                return (
                  <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>{s.fastBookings}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>of {s.total} bookings within 7 days ({fastPct}%)</span>
                    </div>
                    {s.fastBookingCancels > 0 && (
                      <span style={{ fontSize: '11px', color: '#f59e0b' }}>{s.fastBookingCancels} fast-booked subsequently cancelled</span>
                    )}
                  </div>
                )
              })()}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Lead', 'Date', 'Outcome'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '5px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBks.map((bk, i) => {
                    const status = String(bk.current_status || bk['Current Status'] || '').trim()
                    const uo     = +bk.has_show === 1                                       ? 'attended'
                      : status.includes('Open Booking')                                     ? 'upcoming'
                      : status.includes('No Show')                                          ? 'no_show'
                      : status.includes('Rescheduled')                                      ? 'rescheduled'
                      : status.includes('Cancelled Within Policy') ||
                        status.includes('Cancelled Outside Policy') ||
                        status.includes('Cancelled By Admin')                               ? 'cancelled'
                      : 'unknown'
                    const isCancAdmin = uo === 'cancelled' && status.includes('Cancelled By Admin')

                    const outcomeColor = uo === 'attended'    ? '#22c55e'
                      : uo === 'upcoming'    ? '#6366f1'
                      : uo === 'no_show'     ? '#64748b'
                      : uo === 'rescheduled' ? '#38bdf8'
                      : isCancAdmin          ? '#f59e0b'
                      : uo === 'cancelled'   ? '#ef4444'
                      : 'var(--muted)'
                    const outcomeLabel = uo === 'attended'    ? 'Attended'
                      : uo === 'upcoming'    ? 'Upcoming'
                      : uo === 'no_show'     ? 'No-show'
                      : uo === 'rescheduled' ? 'Rescheduled'
                      : isCancAdmin && isManagerView ? 'Studio-cancelled'
                      : uo === 'cancelled' && isManagerView ? 'Lead-cancelled'
                      : uo === 'cancelled'   ? 'Cancelled'
                      : 'Unknown'

                    const fname       = bk.first_name ?? ''
                    const lname       = bk.last_name  ?? ''
                    const displayName = (fname + ' ' + lname).trim() || `Lead #${i + 1}`

                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text)', fontWeight: 500 }}>{displayName}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--muted)' }}>
                          {bk.booking_date
                            ? new Date(bk.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                            : '—'}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: outcomeColor }}>{outcomeLabel}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}

          {tab === 'cancel-split' && isManagerView && (
            s.totalCancels === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>No cancellations at this studio.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Split bars */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '8px', padding: '12px 16px', border: '1px solid #ef444422' }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444', margin: '0 0 2px' }}>{s.custCancels}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Lead-cancelled</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>
                      {s.total > 0 ? `${((s.custCancels / s.total) * 100).toFixed(0)}% of total bookings` : '—'}
                    </p>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '8px', padding: '12px 16px', border: '1px solid #f59e0b22' }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', margin: '0 0 2px' }}>{s.adminCancels}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Studio-cancelled</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>
                      {s.total > 0 ? `${((s.adminCancels / s.total) * 100).toFixed(0)}% of total bookings` : '—'}
                    </p>
                  </div>
                </div>

                {s.adminCancels > 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                    Studio-cancelled appointments are logged as "Cancelled By Admin" in ClubReady — these reflect flexologist scheduling gaps, not lead quality.
                  </p>
                )}

                {/* Cancel timing pills */}
                {(() => {
                  const { lastMinute, shortNotice, advance } = s.cancelByTiming ?? {}
                  const timingTotal = (lastMinute ?? 0) + (shortNotice ?? 0) + (advance ?? 0)
                  if (timingTotal === 0) return null
                  return (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { label: '<24 hrs',   count: lastMinute,  color: '#ef4444' },
                        { label: '1–7 days',  count: shortNotice, color: '#f59e0b' },
                        { label: '7+ days',   count: advance,     color: '#64748b' },
                      ].filter(p => p.count > 0).map(p => (
                        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg)', border: `1px solid ${p.color}30`, borderRadius: '6px', padding: '5px 10px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: p.color }}>{p.count}</span>
                          <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>{p.label}</span>
                        </div>
                      ))}
                      <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '4px 0 0', width: '100%', lineHeight: 1.5 }}>
                        Timing of cancellations relative to appointment date.
                      </p>
                    </div>
                  )
                })()}

                {/* Cancel by-day bar chart */}
                {(() => {
                  const maxCount = Math.max(...DAYS_OF_WEEK.map(d => s.cancelByDay[d] ?? 0), 1)
                  return (
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Cancellations by day booked</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '60px' }}>
                        {DAYS_OF_WEEK.map(d => {
                          const count = s.cancelByDay[d] ?? 0
                          const barH  = count > 0 ? Math.max((count / maxCount) * 40, 4) : 0
                          return (
                            <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <span style={{ fontSize: '9px', color: count > 0 ? '#ef4444' : 'transparent', fontWeight: 700 }}>{count}</span>
                              <div style={{ width: '100%', height: `${barH}px`, background: count > 0 ? '#ef444460' : 'var(--border)', borderRadius: '2px 2px 0 0', minHeight: '2px' }} />
                              <span style={{ fontSize: '9px', color: 'var(--muted)' }}>{d.slice(0, 3)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          )}

          {/* Pipeline urgency section — outside tabs */}
          {studioPipeline.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                Pipeline — {studioPipeline.length} upcoming
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {studioPipeline.map((r, i) => {
                  const days    = +r.days_until
                  const isToday = days === 0
                  const risk    = String(r.risk_level ?? '').toLowerCase()
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      {isToday && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'results-pulse 1.5s ease-in-out infinite' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{String(r.first_name ?? '')} {String(r.last_name ?? '')}</span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>{pipelineContext(r, isManagerView)}</span>
                      </div>
                      {isManagerView && risk === 'high' && !isToday && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', background: '#f59e0b18', padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase' }}>High risk</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Responsibility model ─────────────────────────────────────────────────────
function ResponsibilityModel({ studioOpsStudios, isManagerView }) {
  return (
    <Card style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
        Who owns what
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
        <div style={{ borderRight: '1px solid var(--border)', paddingRight: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent)18', padding: '3px 10px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>EXECO</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>owns the outreach</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { title: 'Cold outreach calling',   desc: 'Phiwe works every lead — calls, callbacks, objection handling.' },
              { title: 'Booking conversion',       desc: 'Every appointment here was booked by Phiwe from a real conversation.' },
              { title: 'Pre-visit confirmation',   desc: 'Phiwe follows up with each person to confirm before their appointment.' },
            ].map(item => (
              <div key={item.title}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{item.title}</p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ paddingLeft: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#22c55e', background: '#22c55e18', padding: '3px 10px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>StretchLab</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>owns the studio</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { title: 'Studio scheduling',          desc: 'Availability at the booked time is a studio decision. Unavailability = admin cancel.' },
              { title: 'Session recording',         desc: 'Accurate session logging in the studio system drives every number Execo reports to StretchLab.' },
              { title: 'Intro session experience',  desc: 'What the lead walks into determines whether they become a member.' },
              { title: 'Membership conversion',     desc: 'Turning attended sessions into paying members happens inside the studio.' },
            ].map(item => (
              <div key={item.title}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{item.title}</p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Show rate is the crossover metric.</strong>
          {' '}EXECO owns the confirmation protocol. StretchLab owns what happens when the lead arrives.
          {' '}When show rate suffers, the appointment data above identifies which side the gap is on.
        </p>
      </div>
      {isManagerView && studioOpsStudios.length > 0 && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f59e0b0e', border: '1px solid #f59e0b30', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600, margin: '0 0 4px' }}>
            Studio-ops flag — {studioOpsStudios.length} studio{studioOpsStudios.length > 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            {studioOpsStudios.map(s => s.studio.replace(/^StretchLab\s+/i, '')).join(', ')} — studio-initiated cancellations are suppressing show rate. Flexologist scheduling review recommended.
          </p>
        </div>
      )}
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Results() {
  const { viewRole: role } = useAuth()
  const isManagerView = role === 'manager' || role === 'admin'

  const { data, loading } = useMultiData({
    bookings:      loadBookings,
    insights:      loadInsights,
    cancellations: loadCancellationAnalysis,
    pipeline:      loadPipeline,
  })

  const bookings      = data.bookings      ?? []
  const insightsJson  = data.insights      ?? {}
  const cancellations = data.cancellations ?? []
  const pipeline      = data.pipeline      ?? []

  const studioStats = useMemo(() => {
    if (!bookings.length) return []
    const computed = buildStudioStats(bookings, cancellations)
    const existing = new Set(computed.map(s => s.studio))
    const inactive = ['StretchLab South Tulsa']
      .filter(name => !existing.has(name))
      .map(name => ({
        studio: name, total: 0, shows: 0, noShows: 0,
        custCancels: 0, adminCancels: 0, totalCancels: 0,
        rescheduled: 0, upcoming: 0, resolved: 0, showRate: 0,
        adminCancelPct: 0, segment: 'inactive', smallSample: false,
        bookings: [], cancelByDay: {}, cancelByTiming: { lastMinute: 0, shortNotice: 0, advance: 0 },
        fastBookings: 0, fastBookingCancels: 0,
      }))
    return [...computed, ...inactive]
  }, [bookings, cancellations])

  const studioOpsStudios = useMemo(
    () => studioStats.filter(s => s.segment === 'studio-ops'),
    [studioStats]
  )

  const studioInsight = useMemo(() => {
    return insightsJson?.studio_performance ?? insightsJson[role] ?? insightsJson.client ?? ''
  }, [insightsJson, role])

  const groupedStats = useMemo(() => {
    const groups = {}
    SEGMENT_ORDER.forEach(seg => { groups[seg] = [] })
    studioStats.forEach(s => {
      if (groups[s.segment]) groups[s.segment].push(s)
      else groups['needs-attention'].push(s)
    })
    return groups
  }, [studioStats])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading studio data…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      <style>{`
        @keyframes results-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
          Studio Performance
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
          How each studio is converting Phiwe&apos;s booked appointments into attended sessions.
        </p>
      </div>

      {isManagerView && <OwnershipBanner />}
      {isManagerView && <InsightBlock insight={studioInsight} loading={false} error={null} />}

      <SnapshotStrip stats={studioStats} />

      {SEGMENT_ORDER.map(seg => {
        const group = groupedStats[seg]
        if (!group || group.length === 0) return null
        return (
          <div key={seg} style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
              {SEGMENT_LABEL[seg]} · {group.length}
            </h2>
            {group.map(s => (
              <StudioSignalCard
                key={s.studio}
                s={s}
                isManagerView={isManagerView}
                pipeline={pipeline}
              />
            ))}
          </div>
        )
      })}

      {isManagerView && <ResponsibilityModel studioOpsStudios={studioOpsStudios} isManagerView={isManagerView} />}

    </div>
  )
}
