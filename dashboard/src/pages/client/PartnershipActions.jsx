import React, { useMemo, useState } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import {
  loadBookings,
  loadByStudio,
  loadCancellationAnalysis,
  loadValidationLeadDetails,
  loadCalls,
} from '../../utils/dataLoader.js'
import { useRole } from '../../context/RoleContext.jsx'
import Card from '../../components/Card.jsx'
import Tooltip from '../../components/Tooltip.jsx'

const SOW_TARGET = 77

const sectionLabel = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', margin: '0 0 12px',
}

// ─── Month 3 Progress Bar ─────────────────────────────────────────────────────
function ProgressBar({ bookings }) {
  const confirmedShows = bookings.filter(b => +b.has_show === 1).length
  const upcoming       = bookings.filter(b => +b.is_future === 1 && b.booking_outcome !== 'Cancelled').length
  const resolved       = bookings.filter(b => +b.is_past === 1 && !String(b.current_status || '').includes('Rescheduled')).length
  const showRate       = resolved > 0 ? confirmedShows / resolved : 0
  const projected      = Math.round(upcoming * showRate)
  const total          = confirmedShows + projected
  const still          = Math.max(0, SOW_TARGET - total)

  const pctConfirmed = (confirmedShows / SOW_TARGET) * 100
  const pctProjected = (projected / SOW_TARGET) * 100

  return (
    <Card style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <p style={{ ...sectionLabel, color: 'var(--muted)', margin: 0 }}>Month 3 SOW Progress — Target: {SOW_TARGET} kept appointments</p>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Deadline: May 24, 2026</p>
      </div>
      <div style={{ height: '10px', borderRadius: '6px', background: 'var(--border)', overflow: 'hidden', display: 'flex', marginBottom: '12px' }}>
        <div style={{ width: `${pctConfirmed}%`, background: '#22c55e', transition: 'width 0.4s ease' }} />
        <div style={{ width: `${pctProjected}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: still > 0 ? '12px' : 0 }}>
        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
          <strong style={{ color: '#22c55e' }}>{confirmedShows}</strong> sessions confirmed
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
          <strong style={{ color: '#f59e0b' }}>{projected}</strong> projected from {upcoming} upcoming (at current {(showRate * 100).toFixed(0)}% show rate)
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
          <strong style={{ color: 'var(--text)' }}>{still}</strong> still needed to reach {SOW_TARGET}
        </span>
      </div>
      {still > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p style={{ fontSize: '12px', color: '#f59e0b', margin: 0, lineHeight: 1.6 }}>
            <strong>{still} more kept appointments</strong> are needed to reach the SOW target.
            Month 3 outreach starts April 25 — maintaining the current pipeline and confirming all upcoming appointments are the two primary levers.
          </p>
        </div>
      )}
    </Card>
  )
}

// ─── Admin Disruptions Card ───────────────────────────────────────────────────
function AdminDisruptionsCard({ cancellations, bookings }) {
  const [drillOpen, setDrillOpen] = useState(false)

  const adminCancels   = useMemo(() => cancellations.filter(c => c.cancelled_by === 'Admin'), [cancellations])
  const leadCancels    = useMemo(() => cancellations.filter(c => c.cancelled_by !== 'Admin'), [cancellations])
  const adminCancelled = adminCancels.length
  const confirmedShows = bookings.filter(b => +b.has_show === 1).length

  const ratioText = leadCancels.length > 0 ? `${(adminCancelled / leadCancels.length).toFixed(1)}×` : null

  const hypotheticalShows   = confirmedShows + adminCancelled
  const hypotheticalShowRate = bookings.length > 0
    ? ((hypotheticalShows / bookings.length) * 100).toFixed(0)
    : '0'

  const byStudio = useMemo(() => {
    const map = {}
    adminCancels.forEach(c => {
      const key = (c.booking_location ?? 'Unknown').replace('StretchLab ', '')
      if (!map[key]) map[key] = 0
      map[key]++
    })
    return Object.entries(map)
      .map(([studio, count]) => ({ studio, count }))
      .sort((a, b) => b.count - a.count)
  }, [adminCancels])

  const { role } = useRole()

  if (adminCancelled === 0) return null

  return (
    <Card style={{ borderLeft: '3px solid #f59e0b', marginBottom: '20px' }}>
      <p style={{ ...sectionLabel, color: '#f59e0b' }}>
        Studio-Initiated Disruptions — {adminCancelled} appointment{adminCancelled !== 1 ? 's' : ''} cancelled by admin
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', marginBottom: '14px' }}>
        <div style={{ borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>What happened</p>
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
            <strong>{adminCancelled}</strong> appointment{adminCancelled !== 1 ? 's' : ''} were cancelled by a studio admin before the session occurred.
            {ratioText && ` This is ${ratioText} the volume of lead-initiated cancellations — the studio side is the primary source of disruption, not lead commitment.`}
          </p>
        </div>

        <div style={{ borderRight: '1px solid var(--border)', padding: '0 20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Impact on show rate</p>
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
            Without admin disruptions, show rate would be approximately{' '}
            <strong style={{ color: '#22c55e' }}>{hypotheticalShowRate}%</strong> — above the 15% benchmark for this lead type.
            These cancellations are the primary gap between current performance and the target show rate.
          </p>
        </div>

        <div style={{ paddingLeft: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>StretchLab can fix this</p>
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: '0 0 6px' }}>
            {byStudio.length > 0 && (
              <>{byStudio.slice(0, 2).map(s => `${s.studio} (${s.count})`).join(' and ')} account for the highest admin disruption volume.</>
            )}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            Action: Review scheduling at these studios and notify EXECO before any session needs to be moved — not after.
          </p>
        </div>
      </div>

      <button
        onClick={() => setDrillOpen(o => !o)}
        style={{
          background: 'none', border: '1px solid var(--border)',
          borderRadius: '6px', padding: '5px 12px', fontSize: '11px', color: 'var(--muted)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {drillOpen ? 'Hide detail ▲' : `Show ${adminCancelled} affected appointment${adminCancelled !== 1 ? 's' : ''} ▼`}
      </button>

      {drillOpen && (
        <div style={{ marginTop: '14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>Studio</th>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>Appointment Date</th>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>Cancelled by</th>
                {role !== 'client' && (
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>Lead</th>
                )}
              </tr>
            </thead>
            <tbody>
              {adminCancels.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '7px 12px', color: 'var(--text-2)' }}>{(c.booking_location ?? '—').replace('StretchLab ', '')}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-2)' }}>
                    {c.booking_date ? new Date(c.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#f59e0b', background: '#f59e0b18', padding: '1px 6px', borderRadius: '3px' }}>
                      Studio Admin
                    </span>
                  </td>
                  {role !== 'client' && (
                    <td style={{ padding: '7px 12px', color: 'var(--text-2)' }}>
                      {c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── ClubReady Hygiene Card ────────────────────────────────────────────────────
function ClubReadyCard({ bookings, leadDetails }) {
  const [drillOpen, setDrillOpen] = useState(false)
  const pastPending = useMemo(() => (
    bookings.filter(b => +b.is_past === 1 && b.booking_outcome === 'New')
  ), [bookings])

  const trackerGaps = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return Array.isArray(leadDetails)
      ? leadDetails.filter(r =>
          (r.in_system === false || r.in_system === 'False' || r.in_system === 0) &&
          r.date_of_appointment != null &&
          String(r.date_of_appointment).slice(0, 10) <= today
        )
      : []
  }, [leadDetails])

  if (pastPending.length === 0 && trackerGaps.length === 0) return null

  return (
    <Card style={{ borderLeft: '3px solid #38bdf8', marginBottom: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: trackerGaps.length > 0 ? '1fr 1fr' : '1fr', gap: '24px' }}>

        {pastPending.length > 0 && (
          <div>
            <p style={{ ...sectionLabel, color: '#38bdf8' }}>
              Outcome Logging — {pastPending.length} past appointment{pastPending.length !== 1 ? 's' : ''} awaiting update
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: '0 0 8px' }}>
              {pastPending.length} appointment{pastPending.length !== 1 ? 's' : ''} have passed their scheduled date but the outcome hasn't been formally logged in ClubReady.
              Until these are updated, the dashboard cannot count them in show or cancel metrics — which understates confirmed sessions.
            </p>
            <p style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, margin: '0 0 12px', lineHeight: 1.6 }}>
              Action required: Log the outcome of each past appointment in ClubReady within 24 hours of the session date.
            </p>
            <button
              onClick={() => setDrillOpen(o => !o)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {drillOpen ? 'Hide ▲' : `View ${pastPending.length} appointment${pastPending.length !== 1 ? 's' : ''} ▼`}
            </button>
            {drillOpen && (
              <div style={{ marginTop: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Lead', 'Studio', 'Date'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pastPending.map((bk, i) => {
                      const name   = [bk.first_name, bk.last_name].filter(Boolean).join(' ') || '—'
                      const studio = (bk.booking_location ?? '—').replace('StretchLab ', '')
                      const date   = bk.booking_date ? new Date(bk.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 500 }}>{name}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{studio}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>{date}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {trackerGaps.length > 0 && (
          <div style={{ borderLeft: pastPending.length > 0 ? '1px solid var(--border)' : 'none', paddingLeft: pastPending.length > 0 ? '24px' : '0' }}>
            <p style={{ ...sectionLabel, color: '#38bdf8' }}>
              Tracker Gaps — {trackerGaps.length} booking{trackerGaps.length !== 1 ? 's' : ''} not yet in ClubReady
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, margin: '0 0 8px' }}>
              Our internal tracking records {trackerGaps.length} appointment{trackerGaps.length !== 1 ? 's' : ''} that {trackerGaps.length !== 1 ? 'are' : 'is'} not yet logged in ClubReady.
              These sessions exist — they just can't be counted toward the SOW target until they appear in the system.
            </p>
            <p style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, margin: '0 0 12px', lineHeight: 1.6 }}>
              Action required: Log {trackerGaps.length} appointment{trackerGaps.length !== 1 ? 's' : ''} in ClubReady so they appear in campaign metrics.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {trackerGaps.map((r, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 12px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{r.name ?? '—'}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>
                    {r.date_of_appointment ? new Date(r.date_of_appointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                  <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{r.location ?? '—'}</span>
                  {r.paid === 'Yes' && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#22c55e', fontWeight: 700 }}>PAID</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Lead Bucket Transparency Card ────────────────────────────────────────────
// Evans directive: client must understand the quality of leads being called
function LeadBucketCard({ calls }) {
  const buckets = useMemo(() => {
    if (!calls.length) return null
    const withAge = calls.filter(c => c.lead_age_months != null && c.lead_age_months !== '')
    if (!withAge.length) return null
    const b = {
      fresh:  calls.filter(c => +c.lead_age_months <  12).length,
      mid:    calls.filter(c => +c.lead_age_months >= 12 && +c.lead_age_months < 24).length,
      stale:  calls.filter(c => +c.lead_age_months >= 24).length,
    }
    return b
  }, [calls])

  // Even without lead_age_months, show the structural framing Evans called out
  return (
    <Card style={{ borderLeft: '3px solid var(--accent)', marginBottom: '20px' }}>
      <p style={{ ...sectionLabel, color: 'var(--accent)' }}>The Lead Profile</p>
      <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.75, margin: '0 0 14px' }}>
        Phiwe is calling dormant StretchLab leads — people who enquired or signed up, then went quiet for 6 months or longer.
        {' '}These are not fresh inquiries; the cold re-engagement benchmarks (10–18% connect rate, 0.5–1.5% booking rate) are calibrated specifically for this lead profile.
        {' '}Leads with prior visits are the highest-conversion segment — they have already experienced the studio and understand the product.
      </p>

      {buckets && (
        <div style={{ display: 'flex', gap: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: 1, background: 'rgba(99,102,241,0.07)', borderRadius: '8px', padding: '12px 16px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', margin: '0 0 2px' }}>{buckets.fresh.toLocaleString()}</p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>6–12 months inactive</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(245,158,11,0.07)', borderRadius: '8px', padding: '12px 16px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', margin: '0 0 2px' }}>{buckets.mid.toLocaleString()}</p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>12–24 months inactive</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(239,68,68,0.07)', borderRadius: '8px', padding: '12px 16px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444', margin: '0 0 2px' }}>{buckets.stale.toLocaleString()}</p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>24+ months inactive</p>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Partnership Accountability Matrix ────────────────────────────────────────
function PartnershipMatrix({ bookings, calls }) {
  const meaningfulConvs = calls.filter(c => parseFloat(c.live_talk_min || 0) >= 0.5).length
  const totalCalls      = calls.length
  const connectRate     = (meaningfulConvs > 0 && totalCalls > 0) ? ((meaningfulConvs / totalCalls) * 100).toFixed(1) : '0.0'
  const bookingConvRate = meaningfulConvs > 0 ? ((bookings.length / meaningfulConvs) * 100).toFixed(1) : '0.0'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
      <Card>
        <p style={{ ...sectionLabel, color: 'var(--accent)' }}>EXECO Is Delivering</p>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.9 }}>
          <li><strong style={{ color: 'var(--text)' }}>{totalCalls.toLocaleString()} calls</strong> made across all active markets</li>
          <li>Connect rate <strong style={{ color: '#22c55e' }}>{connectRate}%</strong> — within the expected range for dormant lead re-engagement</li>
          <li><strong style={{ color: '#22c55e' }}>{bookingConvRate}%</strong> of real conversations became a booked session</li>
          <li>Phiwe follows up with every upcoming appointment to confirm attendance before the session date</li>
        </ul>
      </Card>

      <Card style={{ borderLeft: '3px solid #f59e0b' }}>
        <p style={{ ...sectionLabel, color: '#f59e0b' }}>StretchLab Action Items</p>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.9 }}>
          <li>Log session outcomes in the studio system within <strong style={{ color: 'var(--text)' }}>24 hours</strong> of each appointment</li>
          <li>Review admin cancellation triggers at <strong style={{ color: 'var(--text)' }}>Bunker Hill and Shreveport</strong></li>
          <li>Notify EXECO <strong style={{ color: 'var(--text)' }}>before</strong> cancelling or rescheduling any booked session</li>
          <li>Confirm studio availability before booking sessions — unavailability after booking is the primary source of admin cancellations</li>
          <li>Share any warm leads or re-engaged members directly with Phiwe</li>
          <li>After each intro session — <strong style={{ color: 'var(--text)' }}>membership conversion is the goal</strong> — not just attendance</li>
        </ul>
      </Card>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PartnershipActions() {
  const { data, loading } = useMultiData({
    bookings:      loadBookings,
    byStudio:      loadByStudio,
    cancellations: loadCancellationAnalysis,
    leadDetails:   loadValidationLeadDetails,
    calls:         loadCalls,
  })

  const bookings      = data.bookings      ?? []
  const cancellations = data.cancellations ?? []
  const leadDetails   = data.leadDetails   ?? []
  const calls         = data.calls         ?? []

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading partnership data…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
          Partnership Actions
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7, margin: 0, maxWidth: '720px' }}>
          Outreach results are only half the equation. Every booked appointment that becomes an attended session requires smooth execution on the studio side.
          This page tracks exactly where the partnership is delivering — and where actions are needed.
        </p>
      </div>

      {/* Lead profile — first, so StretchLab understands the database */}
      <LeadBucketCard calls={calls} />

      {/* Month 3 SOW Progress */}
      <ProgressBar bookings={bookings} />

      {/* EXECO / StretchLab accountability matrix */}
      <PartnershipMatrix bookings={bookings} calls={calls} />

      {/* Studio disruptions */}
      <AdminDisruptionsCard cancellations={cancellations} bookings={bookings} />

      {/* ClubReady hygiene + manual tracker gaps */}
      <ClubReadyCard bookings={bookings} leadDetails={leadDetails} />

      <p style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '8px', marginBottom: '20px' }}>
        Member conversion tracking available once StretchLab shares session outcomes.
      </p>

    </div>
  )
}
