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
import { COLD_OUTREACH_BENCHMARKS } from './config.js'

export async function generateInsight(role, _userPrompt) {
  if (role === 'client') return '' // client insight is built dynamically — see buildClientInsight()
  try {
    const response = await fetch('/data/phiwe_insights.json')
    if (!response.ok) return ''
    const data = await response.json()
    return data[role] ?? ''
  } catch {
    return ''
  }
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
    `and closing that gap through Phiwe's confirmation follow-up is the clearest lever before May 24. ` +
    `${upcoming} appointments are in the pipeline right now. ` +
    `Each one is a dormant contact one good session away from becoming an active member again.`
  )
}
