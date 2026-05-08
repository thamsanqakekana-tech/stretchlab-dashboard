import React, { useState, useMemo, useCallback } from 'react'
import { useMultiData } from '../../hooks/useData.js'
import {
  loadPipeline,
  loadBookings,
  loadCancellationAnalysis,
  loadValidationLeadDetails,
  loadCallTimingOptimized,
  loadRampVsTarget,
  loadCampaignHealth,
  loadRootCauseAnalysis,
  loadValidationReport,
  pivotToObject,
} from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'
import { RAMP_TARGETS, CAMPAIGN_MONTHS } from '../../utils/config.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const SOW_DEADLINE     = new Date(CAMPAIGN_MONTHS[CAMPAIGN_MONTHS.length - 1].end + 'T00:00:00')
const SOW_TARGET       = RAMP_TARGETS[3]
const SHOW_RATE_FLOOR  = 33    // % — trigger confirmation action if below
const INTRO_PRICE      = 69
const MEMBERSHIP_PRICE = 338

function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntilDeadline() {
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((SOW_DEADLINE - today) / 86400000)
}

function weekRange() {
  const d = new Date()
  const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (x) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(mon)} – ${fmt(sun)}, ${d.getFullYear()}`
}

// ─── Action generator — derives 7–10 actions from raw CSV data ────────────────
function generateActions({ pipeline, bookings, cancellations, validationLeads, callTiming, ramp, rootCause, validationReport }) {
  const actions = []
  const today = new Date(); today.setHours(0,0,0,0)

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const upcoming = pipeline.filter(r => +r.days_until >= 0)
  const highRisk = upcoming.filter(r => r.risk_level === 'High')
  const firstAppt = upcoming.length > 0
    ? upcoming.slice().sort((a,b) => +a.days_until - +b.days_until)[0]
    : null

  const todayAP = new Date(); todayAP.setHours(0,0,0,0)
  const isFutureAP = b => { const bd = b.booking_date; return !!bd && new Date(String(bd).substring(0,10)) > todayAP }
  const isShowAP = b => b.has_show === true || b.has_show === 1 || String(b.has_show ?? '').trim() === '1'
  const shows         = bookings.filter(b => isShowAP(b) && !isFutureAP(b))
  const cancelledCust = bookings.filter(b => { const s = String(b.current_status || ''); return s.includes('Cancelled Within Policy') || s.includes('Cancelled Outside Policy') })
  const cancelledAdm  = bookings.filter(b => String(b.current_status || '').includes('Cancelled By Admin'))
  const noShows       = bookings.filter(b => String(b.current_status || '').includes('No Show'))
  const resolved      = shows.length + noShows.length + cancelledCust.length + cancelledAdm.length
  const showRate      = resolved > 0 ? (shows.length / resolved) * 100 : 0
  const confirmedShows = shows.length

  const notInSystem = validationLeads.filter(r => String(r.in_system).toLowerCase() === 'false')

  const adminCancels  = cancellations.filter(r =>
    String(r.cancelled_by || '').toLowerCase().includes('admin')
  )
  const adminByStudio = adminCancels.reduce((acc, r) => {
    const loc = r.booking_location || ''
    acc[loc] = (acc[loc] || 0) + 1
    return acc
  }, {})
  const worstStudio   = Object.entries(adminByStudio).sort((a,b) => b[1] - a[1])[0]

  const fridayCancels = cancellations.filter(r =>
    String(r.booking_day_of_week || '').toLowerCase() === 'friday'
  )
  const fridayCancelPct = cancellations.length > 0
    ? Math.round((fridayCancels.length / cancellations.length) * 100)
    : 0

  const suboptimalSlots  = callTiming.filter(r => r.category === 'Avoid' || r.category === 'Low')
  const totalCallsLogged = callTiming.reduce((s, r) => s + (+r.total_calls || 0), 0)
  const suboptimalCalls  = suboptimalSlots.reduce((s, r) => s + (+r.total_calls || 0), 0)
  const suboptimalPct    = totalCallsLogged > 0 ? (suboptimalCalls / totalCallsLogged) * 100 : 0

  const latestRamp     = ramp.length > 0 ? ramp[ramp.length - 1] : null
  const totalActual    = ramp.reduce((s, r) => s + (+r.actual_kept_appts || 0), 0)
  const sowGap         = SOW_TARGET - confirmedShows
  const inPipeline     = upcoming.length
  const daysLeft       = daysUntilDeadline()

  // ── CRITICAL: Confirm upcoming appointments ──────────────────────────────────
  if (upcoming.length > 0 && showRate < SHOW_RATE_FLOOR) {
    const highRiskNames = highRisk
      .slice().sort((a,b) => +a.days_until - +b.days_until)
      .map(r => `${r.first_name} (${r.days_until}d)`)
      .join(', ')
    const estSavedShows  = Math.round(highRisk.length * 0.4)
    const revenueImpact  = estSavedShows * (INTRO_PRICE + MEMBERSHIP_PRICE * 0.15)
    const deadlineDays   = firstAppt ? Math.max(1, +firstAppt.days_until - 1) : 2
    actions.push({
      id:        'confirm-upcoming',
      priority:  'critical',
      title:     `Confirm all ${upcoming.length} upcoming appointments before sessions drop`,
      owner:     'phiwe',
      why:       `Show rate is ${showRate.toFixed(1)}% — below the 33% confirmation threshold. ${highRisk.length} of ${upcoming.length} upcoming bookings are HIGH risk: ${highRiskNames || 'multiple leads'}. Each unconfirmed appointment without a pre-call is a near-certain no-show or cancellation.`,
      impact: {
        revenue:     Math.round(revenueImpact),
        description: `${highRisk.length} high-risk leads × 40% save rate = ~${estSavedShows} additional show${estSavedShows !== 1 ? 's' : ''} × $${INTRO_PRICE} intro`,
      },
      deadline:  addDays(deadlineDays),
      status:    'not_started',
    })
  }

  // ── CRITICAL: Internal tracker ↔ ClubReady drift — always surface when any drift exists ──
  if (notInSystem.length > 0) {
    const heldUnlogged   = notInSystem.filter(r => String(r.held ?? '').toLowerCase() === 'yes')
    const revenueImpact  = heldUnlogged.length * INTRO_PRICE
    const driftLines     = notInSystem.slice(0, 8).map(r => {
      const loc    = String(r.location ?? '').trim()
      const note   = String(r.notes ?? '').trim()
      const status = String(r.held ?? '').toLowerCase() === 'yes' ? 'held' : 'not held'
      return `${r.name} (${loc}) — ${note || status}`
    })
    const overflowNote   = notInSystem.length > 8 ? `\n…and ${notInSystem.length - 8} more.` : ''
    actions.push({
      id:       'update-crm',
      priority: notInSystem.length >= 5 ? 'critical' : 'important',
      title:    `Sync ${notInSystem.length} internal tracker record${notInSystem.length !== 1 ? 's' : ''} into ClubReady`,
      owner:    'tamryn',
      why:      `The internal tracker (updated live on the floor) has ${notInSystem.length} record${notInSystem.length !== 1 ? 's' : ''} not yet in ClubReady. ${heldUnlogged.length > 0 ? `${heldUnlogged.length} were held sessions — missing from the official show count. ` : ''}ClubReady is the source of truth for reporting; any gap suppresses the measured show rate and mis-signals campaign performance to StretchLab. Tamryn to review each drift on every pipeline run.\n\nDrift detail:\n${driftLines.join('\n')}${overflowNote}`,
      impact:   {
        revenue:     revenueImpact,
        description: heldUnlogged.length > 0
          ? `${heldUnlogged.length} held session${heldUnlogged.length !== 1 ? 's' : ''} unrecorded × $${INTRO_PRICE} = $${revenueImpact} in unaccounted session revenue`
          : `${notInSystem.length} record${notInSystem.length !== 1 ? 's' : ''} need ClubReady status update`,
      },
      deadline: addDays(2),
      status:   'not_started',
    })
  }

  // ── CRITICAL: Attended sessions not in ClubReady ────────────────────────────
  const unloggedAttended = validationReport?.unlogged_attended ?? []
  if (unloggedAttended.length > 0) {
    const names = unloggedAttended.map(r => `${r.name} (${r.location})`).join(', ')
    actions.push({
      id:       'unlogged-attended',
      priority: 'critical',
      title:    `Log ${unloggedAttended.length} attended session${unloggedAttended.length !== 1 ? 's' : ''} into ClubReady — not yet in the system`,
      owner:    'tamryn',
      why:      `The internal tracker records ${unloggedAttended.length} session${unloggedAttended.length !== 1 ? 's' : ''} as attended (held=Yes) with no matching ClubReady booking record. These sessions are confirmed on the studio floor but are invisible to the pipeline — they suppress the measured show rate and undercount revenue. Tamryn to create or update the ClubReady record for each:\n\n${names}`,
      impact:   {
        revenue:     unloggedAttended.length * INTRO_PRICE,
        description: `${unloggedAttended.length} confirmed session${unloggedAttended.length !== 1 ? 's' : ''} × $${INTRO_PRICE} intro = $${unloggedAttended.length * INTRO_PRICE} in unrecorded session revenue`,
      },
      deadline: addDays(1),
      status:   'not_started',
    })
  }

  // ── IMPORTANT: Possible duplicate leads — internal tracker vs ClubReady ────────
  const possibleDups = validationReport?.possible_duplicates ?? []
  if (possibleDups.length > 0) {
    const lines = possibleDups.map(r => `${r.name} (${r.location}) — ${r.note}`).join('\n')
    actions.push({
      id:       'possible-duplicates',
      priority: 'important',
      title:    `Verify ${possibleDups.length} internal tracker lead${possibleDups.length !== 1 ? 's' : ''} — possible duplicate of a ClubReady record`,
      owner:    'tamryn',
      why:      `The pipeline found ${possibleDups.length} internal tracker lead${possibleDups.length !== 1 ? 's' : ''} whose first name matches a ClubReady lead but whose full name did not match (possible spelling variant or different family member). If these are the same people, they are being double-counted. Tamryn to confirm identity and merge or remove the duplicate:\n\n${lines}`,
      impact:   {
        revenue:     0,
        description: 'Data integrity — prevents double-counting in show rate and pipeline totals',
      },
      deadline: addDays(2),
      status:   'not_started',
    })
  }

  // ── IMPORTANT: Duplicate ClubReady attendance records (same name, same date, multiple has_show=1) ──
  {
    const attendedByKey = {}
    bookings.filter(b => isShowAP(b) && !isFutureAP(b)).forEach(b => {
      const name = [b.first_name, b.last_name].filter(Boolean).join(' ').toLowerCase().trim()
      const date = String(b.booking_date || '').substring(0, 10)
      const key  = `${name}||${date}`
      if (!attendedByKey[key]) attendedByKey[key] = []
      attendedByKey[key].push(b)
    })
    const dupEntries = Object.values(attendedByKey).filter(recs => recs.length > 1)
    if (dupEntries.length > 0) {
      const lines = dupEntries.map(recs => {
        const b   = recs[0]
        const loc = String(b.booking_location || '').replace('StretchLab ', '')
        const ids = recs.map(r => r.booking_id).join(', ')
        return `${b.first_name} ${b.last_name} (${loc}) — ${recs.length} records on ${String(b.booking_date||'').substring(0,10)} · booking IDs: ${ids}`
      }).join('\n')
      actions.push({
        id:       'duplicate-attended',
        priority: 'important',
        title:    `Resolve ${dupEntries.length} duplicate ClubReady attendance record${dupEntries.length !== 1 ? 's' : ''} — same lead, same date, multiple has_show=1`,
        owner:    'tamryn',
        why:      `ClubReady shows ${dupEntries.length} lead${dupEntries.length !== 1 ? 's' : ''} with more than one booking record marked as attended on the same date. This is a data entry issue — likely caused by a reschedule that created a second booking before the original was closed, both ending up with attendance confirmed. The pipeline currently counts both, which overstates the attended total. Tamryn to review in ClubReady and remove or merge the duplicate record.\n\n${lines}`,
        impact:   { revenue: 0, description: 'Data integrity — prevents attendance count being overstated in pipeline metrics' },
        deadline: addDays(2),
        status:   'not_started',
      })
    }
  }

  // ── IMPORTANT: ClubReady leads not in internal tracker ──────────────────────
  {
    const valNameSet = new Set(validationLeads.map(r => String(r.name || '').toLowerCase().trim()))
    const crNotInTracker = bookings.filter(b => {
      const name   = [b.first_name, b.last_name].filter(Boolean).join(' ').toLowerCase().trim()
      if (valNameSet.has(name)) return false
      if (isFutureAP(b)) return false
      const status = String(b.current_status || '')
      return isShowAP(b) || status.includes('Cancelled') || status.includes('No Show') || status.includes('Completed')
    })
    if (crNotInTracker.length > 0) {
      const lines = crNotInTracker.slice(0, 12).map(b => {
        const loc    = String(b.booking_location || '').replace('StretchLab ', '')
        const status = String(b.current_status || '').split(' -')[0].trim()
        const hs     = isShowAP(b) ? ' · attended (has_show=1)' : ''
        return `${b.first_name} ${b.last_name} (${loc}) — ${status}${hs}`
      }).join('\n')
      const overflow = crNotInTracker.length > 12 ? `\n…and ${crNotInTracker.length - 12} more.` : ''
      const attendedGap = crNotInTracker.filter(b => isShowAP(b)).length
      actions.push({
        id:       'cr-not-in-tracker',
        priority: crNotInTracker.length >= 5 ? 'important' : 'optimization',
        title:    `Verify ${crNotInTracker.length} ClubReady lead${crNotInTracker.length !== 1 ? 's' : ''} not in the internal tracker`,
        owner:    'tamryn',
        why:      `ClubReady has ${crNotInTracker.length} resolved booking${crNotInTracker.length !== 1 ? 's' : ''} with no matching record in the internal tracker. ClubReady is the source of truth — these leads and their outcomes are correct. The internal tracker needs to be updated to reflect them.${attendedGap > 0 ? ` ${attendedGap} of these are attended sessions (has_show=1) — their tracker records are missing entirely.` : ''} Tamryn to review each name and add or update the tracker entry, noting any name-entry discrepancies (e.g. lead booked under a slightly different name in ClubReady).\n\n${lines}${overflow}`,
        impact:   { revenue: attendedGap * INTRO_PRICE, description: attendedGap > 0 ? `${attendedGap} untracked attended session${attendedGap !== 1 ? 's' : ''} × $${INTRO_PRICE} = $${attendedGap * INTRO_PRICE} unrecorded in tracker` : 'Internal tracker alignment — keeps floor records in sync with ClubReady' },
        deadline: addDays(3),
        status:   'not_started',
      })
    }
  }

  // ── CRITICAL: Studio with ≥3 admin cancellations ────────────────────────────
  if (worstStudio && worstStudio[1] >= 3) {
    const studioName    = worstStudio[0].replace('StretchLab ', '')
    const studioCount   = worstStudio[1]
    const revenueImpact = studioCount * INTRO_PRICE
    actions.push({
      id:        `admin-cancel-${studioName.toLowerCase().replace(/\s+/, '-')}`,
      priority:  'critical',
      title:     `Review ${studioName} scheduling — ${studioCount} studio-initiated cancellations`,
      owner:     'multi',
      why:       `${studioName} has ${studioCount} admin-cancelled bookings — the most of any studio. These are studio-initiated cancellations (flexologist unavailability, overbooking, scheduling conflicts) that Phiwe cannot prevent. Until the studio scheduling workflow is fixed, bookings there will continue to cancel without any call quality issue on Phiwe's side.`,
      impact: {
        revenue:     revenueImpact,
        description: `${studioCount} avoidable cancellations × $${INTRO_PRICE} intro = $${revenueImpact} lost per cycle if unresolved`,
      },
      deadline:  addDays(2),
      status:    'not_started',
    })
  }

  // ── IMPORTANT: Admin cancel prevention workflow ──────────────────────────────
  if (adminCancels.length > 5) {
    const studiosAffected = Object.keys(adminByStudio).length
    const revenueImpact   = Math.round(adminCancels.length * 0.5 * INTRO_PRICE)
    actions.push({
      id:        'admin-cancel-workflow',
      priority:  'important',
      title:     `Build admin cancellation prevention protocol across ${studiosAffected} studios`,
      owner:     'tamryn',
      why:       `${adminCancels.length} admin-initiated cancellations across ${studiosAffected} studios this campaign. Without a structured pre-booking confirmation from studio ops, these will recur in Month 3. Execo books the lead — the studio has to hold its end. A 48-hour pre-confirmation request to studio ops before each booking goes live would cut this by ~50%.`,
      impact: {
        revenue:     revenueImpact,
        description: `Preventing 50% of ${adminCancels.length} admin cancels = ~${Math.round(adminCancels.length * 0.5)} shows × $${INTRO_PRICE} = $${revenueImpact}`,
      },
      deadline:  addDays(10),
      status:    'not_started',
    })
  }

  // ── IMPORTANT: SOW gap sprint ────────────────────────────────────────────────
  if (sowGap > 0 && daysLeft > 0) {
    const dailyTarget    = (sowGap / daysLeft).toFixed(1)
    const revenueImpact  = sowGap * INTRO_PRICE
    actions.push({
      id:        'sow-sprint',
      priority:  'important',
      title:     `${daysLeft}-day sprint: ${sowGap} sessions needed to hit the May 24 SOW target`,
      owner:     'multi',
      why:       `Campaign is at ${confirmedShows} confirmed sessions against a ${SOW_TARGET}-session SOW target. ${inPipeline} upcoming appointments are in the pipeline. The gap requires ${dailyTarget} confirmed sessions per day for the next ${daysLeft} days. Without a sprint plan this week, Month 3 closes out significantly below commitment.`,
      impact: {
        revenue:     revenueImpact,
        description: `Full SOW completion = ${sowGap} more shows × $${INTRO_PRICE} = $${revenueImpact.toLocaleString()} revenue + renewal conversation`,
      },
      deadline:  addDays(12),
      status:    'not_started',
    })
  }

  // ── IMPORTANT: Friday pre-confirmation ──────────────────────────────────────
  if (fridayCancelPct >= 25) {
    const fridayUpcoming = upcoming.filter(r => {
      if (!r.booking_date) return false
      return new Date(r.booking_date).getDay() === 5
    })
    const revenueImpact = Math.round(fridayUpcoming.length * 0.35 * INTRO_PRICE)
    actions.push({
      id:        'friday-preconfirm',
      priority:  'important',
      title:     `Pre-confirm all Friday appointments — ${fridayCancelPct}% of cancellations fall on Fridays`,
      owner:     'phiwe',
      why:       `${fridayCancels.length} of ${cancellations.length} cancellations this campaign were Friday appointments — ${fridayCancelPct}% of all cancellations. Friday is the highest-risk booking day. ${fridayUpcoming.length} upcoming pipeline appointments are on Fridays and need a dedicated same-week confirmation call.`,
      impact: {
        revenue:     revenueImpact,
        description: `${fridayUpcoming.length} Friday pipeline appts × 35% save rate = ~${Math.round(fridayUpcoming.length * 0.35)} shows × $${INTRO_PRICE}`,
      },
      deadline:  addDays(10),
      status:    'not_started',
    })
  }

  // ── IMPORTANT: Suboptimal call timing (only if >40%) ────────────────────────
  if (suboptimalPct > 40) {
    const optimalSlots = callTiming.filter(r => r.category === 'Golden Hours' || r.category === 'High')
    const bestSlot     = optimalSlots.sort((a,b) => +b.engagement_rate - +a.engagement_rate)[0]
    actions.push({
      id:        'call-timing-shift',
      priority:  'important',
      title:     `Shift ${Math.round(suboptimalPct)}% of calls from low-engagement windows to Golden Hours`,
      owner:     'phiwe',
      why:       `${Math.round(suboptimalPct)}% of calls are placed in low- or zero-engagement time slots. ${bestSlot ? `Best window: ${bestSlot.day_of_week} around ${bestSlot.hour}:00 — ${Math.round(+bestSlot.engagement_rate * 100)}% answer rate.` : ''} Every call in a dead window is a wasted dial on a dormant lead who won't pick up.`,
      impact: {
        revenue:     Math.round(suboptimalCalls * 0.15 * INTRO_PRICE),
        description: `${suboptimalCalls} calls moved to optimal windows × 15% incremental connection rate`,
      },
      deadline:  addDays(14),
      status:    'not_started',
    })
  }

  // ── OPTIMIZATION: 2-touch confirmation sequence ──────────────────────────────
  {
    const potentialShows = Math.round(upcoming.length * 0.08)
    actions.push({
      id:        'two-touch-confirm',
      priority:  'optimization',
      title:     `Test 2-touch confirmation sequence for all bookings within 7 days`,
      owner:     'phiwe',
      why:       `Single-call confirmations leave appointments unverified. A 2-touch sequence (call + follow-up text or second call 24 hours before) has been shown to reduce no-shows by 15–20% in similar re-engagement campaigns. With ${upcoming.length} live appointments, this is immediately implementable.`,
      impact: {
        revenue:     potentialShows * (INTRO_PRICE + Math.round(MEMBERSHIP_PRICE * 0.15)),
        description: `~${potentialShows} incremental shows from 2-touch vs 1-touch × $${INTRO_PRICE + Math.round(MEMBERSHIP_PRICE * 0.15)} blended value`,
      },
      deadline:  addDays(18),
      status:    'not_started',
    })
  }

  // ── OPTIMIZATION: Booking window constraint ──────────────────────────────────
  {
    const longWindowBookings = cancellations.filter(r => r.booking_window_category === '>14 days')
    actions.push({
      id:        'booking-window',
      priority:  'optimization',
      title:     `Enforce <14-day booking window for all new appointments`,
      owner:     'phiwe',
      why:       `Root cause analysis shows ${longWindowBookings.length} cancelled appointment${longWindowBookings.length !== 1 ? 's' : ''} had booking windows >14 days. Leads booked far in advance cool off before their session. Keeping windows under 14 days keeps the momentum from the booking call into the actual session.`,
      impact: {
        revenue:     longWindowBookings.length * INTRO_PRICE,
        description: `Prevent ${longWindowBookings.length} long-window cancellations × $${INTRO_PRICE} = $${longWindowBookings.length * INTRO_PRICE}`,
      },
      deadline:  addDays(21),
      status:    'not_started',
    })
  }

  // ── OPTIMIZATION: Weekly pipeline review ────────────────────────────────────
  actions.push({
    id:        'pipeline-review',
    priority:  'optimization',
    title:     `Create weekly pipeline review cadence with Phiwe and Tamryn`,
    owner:     'tamryn',
    why:       `No structured weekly review means pipeline risks compound silently — the current ${highRisk.length} high-risk appointments were identified reactively. A 15-minute Monday pipeline review (who's unconfirmed, who's at risk, which studios need follow-up) would allow proactive intervention before the week's calls run.`,
    impact: {
      revenue:     Math.round(highRisk.length * 0.2 * INTRO_PRICE),
      description: `Early identification → ~${Math.round(highRisk.length * 0.2)} additional confirmed shows per cycle × $${INTRO_PRICE}`,
    },
    deadline:  addDays(17),
    status:    'not_started',
  })

  return actions
}

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  critical:     { label: '🔴 CRITICAL',     sub: 'This Week',      border: 'var(--danger)', bg: 'rgba(239,68,68,0.05)'   },
  important:    { label: '🟡 IMPORTANT',    sub: 'Next 2 Weeks',   border: 'var(--warn)',   bg: 'rgba(245,158,11,0.05)'  },
  optimization: { label: '🟢 OPTIMIZATION', sub: 'Nice to Have',   border: 'var(--positive)', bg: 'rgba(34,197,94,0.05)' },
}

const OWNER_COLORS = {
  phiwe:      { bg: 'rgba(99,102,241,0.12)', color: 'var(--accent)' },
  tamryn:     { bg: 'rgba(245,158,11,0.12)', color: 'var(--warn)'   },
  brian:      { bg: 'rgba(56,189,248,0.12)', color: 'var(--info)'   },
  thamsanqa:  { bg: 'rgba(168,85,247,0.12)', color: 'var(--admin)'  },
  multi:      { bg: 'rgba(34,197,94,0.12)',  color: 'var(--positive)' },
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ action, completed, onToggle }) {
  const ownerStyle = OWNER_COLORS[action.owner] ?? OWNER_COLORS.multi
  const borderColor = PRIORITY_CONFIG[action.priority]?.border ?? 'var(--border)'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${completed ? 'var(--border)' : borderColor}`,
      borderLeft: `3px solid ${completed ? 'var(--border)' : borderColor}`,
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '10px',
      opacity: completed ? 0.45 : 1,
      transition: 'opacity 0.2s, border-color 0.2s',
    }}>
      {/* Row 1: checkbox + title + owner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
        <button
          onClick={() => onToggle(action.id)}
          style={{
            width: '20px', height: '20px', flexShrink: 0,
            borderRadius: '5px', marginTop: '1px',
            border: `2px solid ${completed ? 'var(--positive)' : borderColor}`,
            background: completed ? 'var(--positive)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', padding: 0,
          }}
          aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {completed && <span style={{ color: '#000', fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>✓</span>}
        </button>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '14px', fontWeight: 600, color: 'var(--text)',
            margin: '0 0 4px',
            textDecoration: completed ? 'line-through' : 'none',
          }}>
            {action.title}
          </p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: '10px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          padding: '3px 8px', borderRadius: '4px',
          background: ownerStyle.bg, color: ownerStyle.color,
        }}>
          {action.owner === 'multi' ? 'MULTI' : action.owner.toUpperCase()}
        </span>
      </div>

      {/* WHY */}
      <p style={{
        fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6,
        margin: '0 0 10px', paddingLeft: '32px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: '6px' }}>WHY</span>
        {action.why}
      </p>

      {/* IMPACT */}
      {action.impact.revenue > 0 && (
        <div style={{
          marginLeft: '32px', marginBottom: '12px',
          background: PRIORITY_CONFIG[action.priority]?.bg ?? 'var(--bg)',
          border: `1px solid ${completed ? 'var(--border)' : borderColor}22`,
          borderRadius: '8px', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{
            fontSize: '16px', fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            color: completed ? 'var(--muted)' : borderColor,
          }}>
            ${action.impact.revenue.toLocaleString()}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-2)', flex: 1 }}>
            {action.impact.description}
          </span>
        </div>
      )}

      {/* Footer: deadline + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '32px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          📅 {action.deadline}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.07em', padding: '2px 8px', borderRadius: '4px',
          background: completed
            ? 'rgba(34,197,94,0.12)'
            : 'rgba(255,255,255,0.05)',
          color: completed ? 'var(--positive)' : 'var(--muted)',
        }}>
          {completed ? 'Completed' : action.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActionPlan() {
  const { data, loading } = useMultiData({
    pipeline:        loadPipeline,
    bookings:        loadBookings,
    cancellations:   loadCancellationAnalysis,
    validationLeads: loadValidationLeadDetails,
    callTiming:      loadCallTimingOptimized,
    ramp:            loadRampVsTarget,
    healthRows:        loadCampaignHealth,
    rootCause:         loadRootCauseAnalysis,
    validationReport:  loadValidationReport,
  })

  // ── Completed state ──────────────────────────────────────────────────────────
  const [completedIds, setCompletedIds] = useState(new Set())
  const toggleComplete = useCallback((id) => {
    setCompletedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [ownerFilter,    setOwnerFilter]    = useState('all')

  // ── Regenerate (visual only — same deterministic output) ─────────────────────
  const [regenerating, setRegenerating] = useState(false)
  const handleRegenerate = useCallback(() => {
    setRegenerating(true)
    setTimeout(() => setRegenerating(false), 900)
  }, [])

  // ── Action generation ────────────────────────────────────────────────────────
  const actions = useMemo(() => {
    if (loading) return []
    return generateActions({
      pipeline:        data.pipeline        ?? [],
      bookings:        data.bookings        ?? [],
      cancellations:   data.cancellations   ?? [],
      validationLeads: data.validationLeads ?? [],
      callTiming:      data.callTiming      ?? [],
      ramp:            data.ramp            ?? [],
      rootCause:         data.rootCause         ?? {},
      validationReport:  data.validationReport  ?? {},
    })
  }, [loading, data])

  // ── Filtered actions ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => actions.filter(a => {
    if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false
    if (ownerFilter    !== 'all' && a.owner    !== ownerFilter)    return false
    return true
  }), [actions, priorityFilter, ownerFilter])

  // ── Summary counts ────────────────────────────────────────────────────────────
  const criticalCount     = actions.filter(a => a.priority === 'critical').length
  const importantCount    = actions.filter(a => a.priority === 'important').length
  const optimizationCount = actions.filter(a => a.priority === 'optimization').length
  const completedCount    = completedIds.size
  const daysLeft          = daysUntilDeadline()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading action plan data…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '960px' }} className="fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
              Automated Action Plan
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
              Auto-generated from live pipeline data · Internal use only
            </p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '99px',
            border: '1px solid rgba(168,85,247,0.3)',
            background: 'rgba(168,85,247,0.07)',
            fontSize: '11px', fontWeight: 600, color: 'var(--admin)',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            Execo Internal
          </span>
        </div>
      </div>

      {/* ── Meta banner ────────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '20px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>Week</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{weekRange()}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>Actions</p>
              <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
                <span style={{ color: 'var(--danger)' }}>{criticalCount} critical</span>
                {' · '}
                <span style={{ color: 'var(--warn)' }}>{importantCount} important</span>
                {' · '}
                <span style={{ color: 'var(--positive)' }}>{optimizationCount} optimization</span>
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>SOW Deadline</p>
              <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: daysLeft <= 14 ? 'var(--danger)' : 'var(--warn)', margin: 0 }}>
                {daysLeft} days · May 24
              </p>
            </div>
            {completedCount > 0 && (
              <div>
                <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>Completed</p>
                <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--positive)', margin: 0 }}>
                  {completedCount} / {actions.length}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{
              padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              border: '1px solid var(--border)', background: regenerating ? 'var(--border)' : 'var(--surface)',
              color: regenerating ? 'var(--muted)' : 'var(--text)', cursor: 'pointer',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {regenerating
              ? <><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Recalculating…</>
              : '↺ Regenerate'}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Card>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Priority</label>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '6px', color: 'var(--text)', fontSize: '12px',
              padding: '5px 10px', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="important">Important</option>
            <option value="optimization">Optimization</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Owner</label>
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '6px', color: 'var(--text)', fontSize: '12px',
              padding: '5px 10px', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">All owners</option>
            <option value="phiwe">Phiwe</option>
            <option value="tamryn">Tamryn</option>
            <option value="multi">Multi</option>
          </select>
        </div>
        {(priorityFilter !== 'all' || ownerFilter !== 'all') && (
          <button
            onClick={() => { setPriorityFilter('all'); setOwnerFilter('all') }}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', padding: '5px 10px',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Priority sections ──────────────────────────────────────────────── */}
      {regenerating ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>
          <span style={{ width: '16px', height: '16px', border: '2px solid var(--warn)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          Recalculating from latest data…
        </div>
      ) : (
        ['critical', 'important', 'optimization'].map(priority => {
          const sectionActions = filtered.filter(a => a.priority === priority)
          if (sectionActions.length === 0) return null
          const cfg = PRIORITY_CONFIG[priority]

          return (
            <div key={priority} style={{ marginBottom: '28px' }}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '12px', paddingBottom: '10px',
                borderBottom: `1px solid ${cfg.border}22`,
              }}>
                <p style={{
                  fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.09em', color: cfg.border, margin: 0,
                }}>
                  {cfg.label}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                  · {cfg.sub}
                </p>
                <span style={{
                  marginLeft: 'auto', fontSize: '11px', fontWeight: 600,
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '1px 8px', borderRadius: '4px',
                  background: `${cfg.border}18`, color: cfg.border,
                }}>
                  {sectionActions.filter(a => completedIds.has(a.id)).length} / {sectionActions.length} done
                </span>
              </div>

              {sectionActions.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  completed={completedIds.has(action.id)}
                  onToggle={toggleComplete}
                />
              ))}
            </div>
          )
        })
      )}

      {filtered.length === 0 && !regenerating && (
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No actions match the current filters.</p>
        </Card>
      )}

      {/* ── LoyalSnap Data Flag ───────────────────────────────────────────── */}
      <Card style={{ marginTop: '8px', borderLeft: '3px solid #f59e0b', padding: '16px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
          LoyalSnap Disposition Data — Available, Not Yet Integrated
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 8px' }}>
          The LoyalSnap History export contains 1,151 structured phone call entries with snake_case disposition tags. These can identify objection patterns and prioritise re-engagement sequences, but <strong>cannot replace the RingCentral connect rate</strong> — LoyalSnap tracks one entry per contact/lead while RingCentral logs every call attempt (7,367 calls vs 1,151 contacts). Different denominators make them incomparable as the same metric.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 8px' }}>
          Disposition breakdown from current workbook: <strong>no_answer</strong> 750 · <strong>voicemail</strong> 167 · <strong>not_reached</strong> 76 · <strong>other</strong> 94 · <strong>reached/connected</strong> 64 (reached 14, visit 13, not_interested 23, health 4, too_expensive 4, out_of_town 4, moved 1, bad_experience 1).
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>
          <strong>Action for Tamryn:</strong> Flag to Brian that LoyalSnap structured disposition data is available and could be added to the pipeline as a separate contact-disposition output — useful for understanding why leads aren't converting, not for calculating connect rate.
        </p>
      </Card>

      {/* ── How this works ────────────────────────────────────────────────── */}
      <Card style={{ marginTop: '8px', borderLeft: '3px solid var(--border)', padding: '16px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
          How This Works
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>
          Every action above is auto-generated by reading the live CSV outputs from the pipeline — no manual curation.
          The engine checks: upcoming appointment risk (from <code style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', background: 'var(--bg)', padding: '1px 5px', borderRadius: '3px' }}>phiwe_pipeline.csv</code>),
          unlogged records (<code style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', background: 'var(--bg)', padding: '1px 5px', borderRadius: '3px' }}>phiwe_validation_lead_details.csv</code>),
          admin cancellation patterns (<code style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', background: 'var(--bg)', padding: '1px 5px', borderRadius: '3px' }}>phiwe_cancellation_analysis.csv</code>),
          and SOW pace (<code style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', background: 'var(--bg)', padding: '1px 5px', borderRadius: '3px' }}>phiwe_ramp_vs_target.csv</code>).
          Revenue figures use $69 intro session and $338 membership conversion values.
          Regenerate each morning before standup to reflect overnight pipeline updates.
        </p>
      </Card>

    </div>
  )
}
