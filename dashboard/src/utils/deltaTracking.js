const VISIT_KEY   = 'lastDashboardVisit'
const SNAPSHOT_KEY = 'lastDataSnapshot'

function formatTimeSince(isoString) {
  const then = new Date(isoString)
  const now  = new Date()
  const mins = Math.round((now - then) / 60000)
  if (mins < 60)  return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)   return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function pipelineIds(pipeline) {
  return new Set(pipeline.map(r => String(r.booking_id ?? r.id ?? '')).filter(Boolean))
}

export function recordVisit(currentData) {
  const snapshot = {
    bookings:      currentData.bookings,
    shows:         currentData.shows,
    cancellations: currentData.cancellations,
    pipelineIds:   [...pipelineIds(currentData.pipeline)],
    timestamp:     new Date().toISOString(),
  }
  try {
    localStorage.setItem(VISIT_KEY,    snapshot.timestamp)
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch (_) {}
}

export function calculateDelta(currentData) {
  let raw
  try { raw = localStorage.getItem(SNAPSHOT_KEY) } catch (_) {}
  if (!raw) return null

  let last
  try { last = JSON.parse(raw) } catch (_) { return null }
  if (!last?.timestamp) return null

  const lastIds    = new Set(last.pipelineIds ?? [])
  const currentIds = pipelineIds(currentData.pipeline)
  const added      = [...currentIds].filter(id => !lastIds.has(id)).length
  const removed    = [...lastIds].filter(id => !currentIds.has(id)).length

  return {
    newBookings:      currentData.bookings      - (last.bookings      ?? 0),
    newShows:         currentData.shows         - (last.shows         ?? 0),
    newCancellations: currentData.cancellations - (last.cancellations ?? 0),
    pipelineAdded:    added,
    pipelineRemoved:  removed,
    timeSinceLastVisit: formatTimeSince(last.timestamp),
  }
}
