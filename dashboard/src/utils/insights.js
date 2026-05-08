/**
 * Read pre-generated AI insights from the static pipeline output.
 * Insights are written to phiwe_insights.json by generate_insights.py
 * during each pipeline run — no API key required at dashboard runtime.
 *
 * The client insight is intentionally NOT read from the JSON file —
 * it is computed in the component from live CSV data via buildClientInsight().
 * This avoids compliance issues (touchpoint counts, studio-directed actions)
 * that can slip through LLM generation.
 */
import { COLD_OUTREACH_BENCHMARKS, CAMPAIGN_MONTHS } from './config.js'

const SOW_END_LABEL = new Date(CAMPAIGN_MONTHS[CAMPAIGN_MONTHS.length - 1].end + 'T00:00:00')
  .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

export async function generateInsight(role, promptText) {
  if (role === 'client') return '' // client insight is built dynamically — see buildClientInsight()

  // Manager role: build from live page-specific promptText — always fresh, page-specific, no API needed
  if (role === 'manager' && promptText && promptText.trim()) {
    return summariseManagerPrompt(promptText)
  }

  // Admin/other roles: read from pre-generated pipeline JSON
  try {
    const response = await fetch('/data/phiwe_insights.json')
    if (!response.ok) return ''
    const data = await response.json()
    return data[role] ?? ''
  } catch {
    return ''
  }
}

function summariseManagerPrompt(prompt) {
  const dataSection = prompt
    .replace(/\n?Write [^\n]*/gi, '')
    .replace(/\n?Be direct[^\n]*/gi, '')
    .trim()
  if (!dataSection) return ''

  const lines = dataSection.split('\n').map(l => l.trim()).filter(l => l && !l.endsWith('view.') && !l.endsWith('view'))

  const rateLines   = lines.filter(l => /\d+\.?\d*%/.test(l) && /(benchmark|rate|conversion)/i.test(l))
  const countLines  = lines.filter(l => /(Total calls|Bookings:|Confirmed shows|Upcoming|admin.+cancel|customer.+cancel)/i.test(l))
  const targetLines = lines.filter(l => /(SOW|Month 3|churn|drift|hypothetical|risk)/i.test(l))

  return [
    rateLines.slice(0, 4).join('\n'),
    countLines.slice(0, 3).join('\n'),
    targetLines.slice(0, 3).join('\n'),
  ].filter(Boolean).join('\n\n')
}

/**
 * Build the client-facing insight paragraph from live computed metrics.
 * Rules enforced here (not delegated to LLM):
 *   - No touchpoint counts
 *   - No studio-directed actions
 *   - Benchmark comparison uses live threshold from config
 *   - All follow-up activity framed as Phiwe's confirmation protocol
 *
 * @param {object} params
 * @param {number} params.confirmedShows
 * @param {number} params.showRate
 * @param {number} params.upcoming
 * @param {number} params.cancelRateCustomer - lead-initiated cancel rate (resolved denominator, already multiplied by 100)
 */
export function buildClientInsight({ confirmedShows, showRate, upcoming, cancelRateCustomer }) {
  const benchmarkMax = COLD_OUTREACH_BENCHMARKS.show_rate.max
  const vsLabel = showRate >= benchmarkMax * 1.15 ? 'outperforms'
                : showRate >= benchmarkMax         ? 'meets'
                : 'is tracking toward'

  return (
    `Phiwe has generated ${confirmedShows} confirmed sessions from a lead list that went cold — ` +
    `people who signed up for StretchLab and then disappeared. ` +
    `Getting ${confirmedShows} of them back into the studio is proof the re-engagement approach is working. ` +
    `The **${showRate.toFixed(1)}%** show rate on appointments with a confirmed outcome ${vsLabel} the cold re-engagement standard — ` +
    `the leads who say yes are actually showing up. ` +
    `The bigger challenge is the **${cancelRateCustomer.toFixed(1)}%** of appointments that did not hold — ` +
    `and closing that gap through Phiwe's confirmation follow-up is the clearest lever before ${SOW_END_LABEL}. ` +
    `${upcoming} appointments are in the pipeline right now. ` +
    `Each one is a dormant contact one good session away from becoming an active member again.`
  )
}
