# CLAUDE.md — StretchLab Campaign Intelligence
## Master Reference for Claude Code

This file is the single source of truth for building, extending, and maintaining the StretchLab Campaign Intelligence dashboard. Read it entirely before touching any file. When in doubt, come back here.

---

## Who This Is For

**Client:** StretchLab (multi-studio fitness franchise, US)
**Agency:** Execo
**Campaign type:** B2C cold re-engagement — dormant and old leads
**SDR:** Phiwe Khasa
**Campaign period:** Feb–May 2026 (3-month SOW)
**Active studios:** Shreveport, Bellaire, Bunker Hill, Cherry Street, Pearland, Clarkston, Brighton, Heights, River Oaks (inactive), South Tulsa (inactive)

---

## The Non-Negotiable Rule

**Every number rendered anywhere in this dashboard must be read from the latest pipeline output at runtime. No digit may be typed into JSX, a template string, or any rendered text. If you find yourself writing a number, stop — find the source file and read it instead.**

This includes benchmark values, targets, counts, percentages, and projected figures.

---

## The Framework: How to Build Every Page

Evan's three-layer sequence. Never skip a layer. Never jump to layer 3.

**Layer 1 — Data.** Read the latest output folder. Build data objects. Run sanity checks. Log row counts to console. Verify numbers add up before building anything. If data is missing or inconsistent, surface a loading state — never render bad numbers silently.

**Layer 2 — Story.** Ask: what is the data telling us right now? Write a sentence that answers this before writing any JSX. The story layer is not optional and it is not a heading — it is a paragraph that a non-technical person reads and immediately understands the situation.

**Layer 3 — Dashboard.** Build the visuals that tell that story. Structure, ordering, what gets shown, what gets hidden — all flow from layer 2.

> "The way I look at all this stuff with BI is: look at the data, form the story, then build the dashboard to tell that story. Sometimes that three-part series gets missed and we just put everything on the page." — Evan

---

## Design Principles: What Every Page Must Do

- Open every major section with a narrative paragraph (1–3 sentences) before any chart or number
- Every metric must have a "so what?" annotation — not just the value, what it means
- Every section must end with a forward-looking action owned by Phiwe or Execo
- Numbers exist to support the narrative. They are never the narrative itself
- If the data does not support a finding, do not assert the finding — even if a benchmark or label suggests it should exist

---

## Terminology: Use Exact Metric Names

These are the only acceptable names. Search the codebase for synonyms and replace them.

| Correct | Never use |
|---|---|
| Connect rate | Reach rate, engagement rate, answer rate, response rate |
| Booking conversion rate | Conversion rate, commitment rate, booking rate |
| Show rate | Hold rate, attendance rate, keep rate |
| Cancel rate | Cancellation rate, drop rate, no-hold rate |
| Confirmation follow-up | 3-touch protocol, call minimum, touchpoint requirement |

---

## Access Levels: What Each View Shows

Defined in `config.py` as `ACCESS_LEVELS`. Always check access level before rendering.

| View | Who sees it | What is hidden |
|---|---|---|
| **Client** | StretchLab team | Cancel rate card, unattributed flags, internal tool names, call counts, raw attribution data, studio cancel rates |
| **Manager** | Execo delivery team | Unattributed flags |
| **Admin** | Execo admin only | Nothing |

**Client view scorecard cards:** Connect Rate · Booking Conversion Rate · Show Rate
**Manager/Admin view scorecard cards:** Connect Rate · Booking Conversion Rate · Show Rate · Cancel Rate

The Cancel Rate card is hidden from client view because the headline number creates churn risk without the conversational context to defuse it.

---

## Data Loading Contract

### Folder resolver

The pipeline writes `outputs/latest.json` after every run:
```json
{ "folder": "YYYY-MM-DD" }
```

Always resolve the folder at runtime:
```javascript
async function getLatestOutputDir() {
  const res = await fetch('/outputs/latest.json');
  const { folder } = await res.json();
  return `/outputs/${folder}`;
}
```

Never hardcode a date path. If `latest.json` does not exist, add a step to `run_pipeline.py` to create it:
```python
import json
from datetime import date
with open("outputs/latest.json", "w") as f:
    json.dump({"folder": str(date.today())}, f)
```

### Required files per page

Load all files with `Promise.all`. Log each row count to console during development. If any file returns 0 rows, log a warning and show a loading/error state rather than rendering empty charts.

---

## Booking Bucket Methodology

**Use `has_show=1` from `phiwe_bookings.csv` for the attended bucket — this is the pipeline-authoritative flag and correctly captures sessions where `current_status` was updated after attendance.** Use `current_status` string matching for all other buckets (cancelled, rescheduled, upcoming).

```javascript
function buildBookingBuckets(bookings) {
  const getStatus = b => String(b.current_status || b['Current Status'] || '')
  const buckets = {
    attended:          bookings.filter(b => +b.has_show === 1),
    noShow:            bookings.filter(b => getStatus(b).includes('No Show')),
    cancelledCustomer: bookings.filter(b =>
      getStatus(b).includes('Cancelled Within Policy') ||
      getStatus(b).includes('Cancelled Outside Policy')
    ),
    cancelledAdmin:    bookings.filter(b => getStatus(b).includes('Cancelled By Admin')),
    rescheduled:       bookings.filter(b => getStatus(b).includes('Rescheduled')),
    upcoming:          bookings.filter(b => getStatus(b).includes('Open Booking')),
  }

  // Log unclassified rows (expected: rows with booking_outcome='New' + administrative cancel status)
  const classified = Object.values(buckets).flat().length
  if (bookings.length > 0 && classified < bookings.length)
    console.warn(`[Buckets] ${bookings.length - classified} bookings unclassified`)

  return buckets
}
```

> **Why `has_show=1` for attended:** Two leads (Tamara Bryant, Lawanda Wilson) attended their sessions but had `current_status` administratively changed to 'Cancelled' afterward. `has_show=1` is set from the `first_visits` sheet match and correctly returns 7. `current_status.includes('Completed')` returns 5 — a known undercount. Confirmed: use `has_show=1`.

### Rate calculations

```javascript
// Resolved = attended + noShow + cancelledCustomer + cancelledAdmin
// Excludes: rescheduled (outcome pending) and upcoming (future)
const resolved = buckets.attended.length + buckets.noShow.length +
                 buckets.cancelledCustomer.length + buckets.cancelledAdmin.length;

const showRate           = resolved > 0 ? buckets.attended.length / resolved : 0;
const cancelRate         = bookings.length > 0 ? (buckets.cancelledCustomer.length + buckets.cancelledAdmin.length) / bookings.length : 0;
const cancelRateCustomer = bookings.length > 0 ? buckets.cancelledCustomer.length / bookings.length : 0;
const cancelRateAdmin    = bookings.length > 0 ? buckets.cancelledAdmin.length / bookings.length : 0;
```

> **Cancel rate denominator is `bookings.length` (total), NOT `resolved`.** Using `resolved` as denominator gives a misleading inflated rate (e.g. 65% instead of 31%) because it excludes the 26 pending appointments. The pipeline's `root_cause_analysis.json` uses total bookings — match that.

---

## Metric Definitions

| Metric | Definition | Source |
|---|---|---|
| Connect rate | Calls with `live_talk_min >= 0.5` / total calls | `phiwe_calls.csv` |
| Answer rate | Calls picked up (`is_connected = 1`) / total calls — **not the same as connect rate** | `phiwe_calls.csv` |
| Booking conversion rate | Total bookings / total calls | `phiwe_bookings.csv` + `phiwe_calls.csv` |
| Show rate | `attended` bucket / `resolved` | Computed from booking buckets |
| Cancel rate | (`cancelledCustomer` + `cancelledAdmin`) / `total bookings` | Computed from booking buckets — total denominator |

**Connect rate and answer rate are different metrics.** `phiwe_call_timing_optimized.csv` `engagement_rate` field = answer rate (phone picked up). The campaign connect rate = real conversations (30+ seconds). Never label answer rate data as connect rate.

When building the Connect Rate drill heatmap: compute connect rate per time slot from `phiwe_calls.csv` using `live_talk_min >= 0.5` threshold. Do not use `engagement_rate` from `phiwe_call_timing_optimized.csv` for this.

---

## Benchmark Rules

All benchmark comparisons must:
- Read values from `phiwe_benchmarks_comparison.csv` — never type a threshold value
- Display as "vs. cold re-engagement outreach standard" — never "vs. industry average"
- Show the actual benchmark value from the CSV alongside the actual metric value

```javascript
function getBenchmark(benchmarksData, metricKey) {
  return benchmarksData.find(r => r.metric === metricKey);
}

// Badge text from status field
function getBadgeLabel(status, metricName) {
  if (metricName === 'cancel_rate') {
    return status === 'excellent' ? 'Within range'
         : status === 'good'      ? 'Watch'
         : 'High — monitor';
  }
  return status === 'excellent' ? 'Above standard'
       : status === 'good'      ? 'On track'
       : status === 'average'   ? 'On track'
       : 'Below standard';
}
```

**`benchmarks.py` uses "industry standard" language.** The UI layer overrides this — always render "cold re-engagement outreach standard". Do not rely on the Python module to carry the correct label.

---

## Root Cause Analysis Rules

Read from `root_cause_analysis.json`. Before rendering any cause:

```javascript
// Only surface causes where count > 0
// A cause with count = 0 and impact = "High" is a pipeline placeholder, not a finding
const activeCauses = causes.filter(c => c.active === true || c.count > 0);

// Sanitise all cause text before rendering in client view
function sanitiseCauseText(text) {
  if (!text) return text;
  return text
    .replace(/<\d+\s*calls?/gi, '')
    .replace(/\d+-call\s*(minimum|protocol)?/gi, 'confirmation follow-up')
    .replace(/\d+-touch\s*(minimum|protocol)?/gi, 'confirmation follow-up protocol')
    .replace(/minimum\s+of\s+\d+\s+calls?/gi, 'confirmation follow-up')
    .replace(/require\s+\d+/gi, 'strengthen')
    .trim();
}
```

The `action` field in the JSON contains internal logic language (call counts, protocol specifics). Always sanitise before rendering in any client or manager view. The raw value is for pipeline use only.

---

## Language Rules: What Never Appears in Client-Facing Text

| Never say | Say instead |
|---|---|
| 3-touch minimum / 3-call protocol / X call touchpoints | Confirmation follow-up protocol |
| AirCall / Reply.io / LoyalSnap / ClubReady | (omit entirely) |
| The studio needs to / the studio should | Phiwe runs / Phiwe follows up |
| Industry average / industry standard | Cold re-engagement outreach standard |
| Gap — significant ramp required | (compute pace label from data) |
| Hold rate | Show rate |
| Engagement rate (as a metric name) | Connect rate |
| Answer rate (in client-facing text) | Connect rate |
| Cancellation rate | Cancel rate |

All narrative text must:
- Be grammatically complete sentences a non-technical person would understand
- State the finding AND its implication in the same sentence
- Attribute all action to Phiwe or Execo — never to the studio
- Use template literals with computed variables, never typed values

---

## Studio Card States

Compute from `phiwe_bookings.csv` grouped by `booking_location`:

```javascript
const studioState = total === 0                 ? 'inactive'
                  : total > 0 && resolved === 0  ? 'activating'
                  : 'active';
```

| State | Render |
|---|---|
| `inactive` | "Pipeline inactive" — muted card, no stats |
| `activating` | "Pipeline being activated" — dashed border, upcoming count only |
| `active` | Full stats — show rate, booking count |

**Client view:** Show rate and booking count only. Do not show cancel rate on studio cards.
**Manager/Admin view:** Full breakdown — show rate, cancel rate, breakdown by who cancelled.

**Small sample qualifier:** Any studio with `resolved <= 3` must show `· small sample` after stats. Never present rates confidently from fewer than 3 resolved bookings.

---

## Booking Accountability Sentence

Every page that shows booking counts must include a full accountability sentence so all bookings add to 100%. Render as 12px muted text below the scorecards.

```javascript
// Client view
const sentence = `Of ${total} appointments booked: ` +
  `${buckets.attended.length} attended · ` +
  `${buckets.upcoming.length} upcoming · ` +
  `${buckets.cancelledCustomer.length + buckets.cancelledAdmin.length} did not proceed · ` +
  `${buckets.noShow.length} no-show · ` +
  `${buckets.rescheduled.length} rescheduled`;

// Manager/Admin view
const sentence = `Of ${total} appointments booked: ` +
  `${buckets.attended.length} attended · ` +
  `${buckets.upcoming.length} upcoming · ` +
  `${buckets.cancelledCustomer.length} lead-cancelled · ` +
  `${buckets.cancelledAdmin.length} studio-cancelled · ` +
  `${buckets.noShow.length} no-show · ` +
  `${buckets.rescheduled.length} rescheduled`;
```

---

## Cancel Rate: Client vs Manager Framing

The full cancel rate is shown on the **Manager/Admin view** Cancel Rate card with the full drill-down (lead-initiated vs studio-initiated, timing breakdown, root causes).

The **Client view** does not show a Cancel Rate card. When discussing cancel rate in any client-facing narrative:
- Always explain the lead-initiated rate separately from the full rate
- Frame studio-initiated cancellations as a shared pattern, not a performance failure
- Never show only the full rate without the contextual breakdown

---

## Pipeline Fixes: Known Issues in Python Scripts

These issues exist in the pipeline scripts. Fix them when encountered, do not work around them.

**`transform.py` — pipeline includes cancelled future bookings:** `_build_pipeline()` must filter out rows where `current_status` contains 'Cancelled', even when `is_cancelled=0` (occurs when `booking_event='New Booking Made'` sets `booking_outcome='New'`, bypassing the cancelled-status fallback). Fixed: filter `~current_status.str.contains('Cancelled')` in addition to `is_future==1`.

**`analytics.py` — hardcoded health scores:** `engagement_score = 12` and `goal_score = 10` are hardcoded fallback defaults. Drive from real signals or remove from scoring.

**`analytics.py` — forecast fallback:** `forecast_30_days()` falls back to `0.15` show rate when no recent bookings. Return insufficient_data response instead.

**`benchmarks.py` — label mismatch:** Module describes thresholds as "Wellness/Assisted Stretching Industry Standards". Add `BENCHMARK_CONTEXT` constant with correct cold re-engagement label. UI layer overrides the label regardless.

**`validate_attribution.py` — syntax error:** Malformed f-string on line ~160. Fix: `pipeline_count = len(pipeline) if not pipeline.empty else 0`.

**`root_cause_analysis.json` generator:** Add `"active": true/false` field per cause based on `count > 0`. Zero-count causes must not be rendered as findings.

---

## Data Files Reference

All files in `outputs/YYYY-MM-DD/` resolved via `getLatestOutputDir()`.

| File | Use for | Notes |
|---|---|---|
| `phiwe_benchmarks_comparison.csv` | All benchmark values and status | Read `benchmark_pct`, `status`, `rank`, `gap_pct` from rows |
| `phiwe_booking_outcomes.csv` | Outcome type summary by status | Use alongside booking buckets for cross-validation |
| `phiwe_booking_window_analysis.csv` | Cancel and show rate by booking lead time | Use in Booking Conversion Rate drill |
| `phiwe_bookings.csv` | All booking outcomes, buckets, rates | Use `has_show` flag for attended; `current_status` for all other buckets |
| `phiwe_by_area_code.csv` | Call and booking performance by geography | Manager/Admin view only |
| `phiwe_by_studio.csv` | Studio-level show rate, cancel rate, bookings | Cross-reference with bookings grouped by `Booking Location` |
| `phiwe_call_timing_optimized.csv` | Answer rate by day+hour with category labels | `engagement_rate` = answer rate — **not** connect rate |
| `phiwe_call_timing.csv` | Raw call volume and answer rate by day+hour | Underlying data for `call_timing_optimized` |
| `phiwe_calls.csv` | Raw call log — timing, duration, outcome | `live_talk_min >= 0.5` = real conversation = connect rate |
| `phiwe_campaign_health.csv` | Top-line headline metrics | Use as opening summary source |
| `phiwe_cancellation_analysis.csv` | Who cancelled, when, what timing | `cancelled_by`: 'Admin' or 'Customer' |
| `phiwe_cohort_analysis.csv` | Booking speed vs cancel rate cohorts | Use in Booking Conversion Rate drill |
| `phiwe_conversion_trends.csv` | Weekly bookings, shows, calls, rates | Use for velocity and trend narrative |
| `phiwe_daily_performance.csv` | Day-by-day calls, talk time, booking rate, show rate | Use for performance trend charts |
| `phiwe_day_of_week_performance.csv` | Show and cancel rate by day of week | Use in Show Rate drill |
| `phiwe_flexologist_performance.csv` | Show and cancel rates by staff member booked with | Manager/Admin view only |
| `phiwe_forecast_30_day.csv` | 3 scenarios: pessimistic / likely / optimistic | Use `drivers` field verbatim — do not rewrite |
| `phiwe_insights.json` | Pre-computed narrative strings from pipeline | Read this first before building any narrative |
| `phiwe_lead_funnel.csv` | Full funnel: calls + bookings + outcomes joined | Includes `days_to_booking` |
| `phiwe_loyalsnap_engagement.csv` | Messaging engagement data | Frequently null — check before building any section around it |
| `phiwe_pipeline.csv` | Open future bookings with risk level | Use for pipeline count in subheadline. Excludes cancelled-status rows. |
| `phiwe_ramp_vs_target.csv` | Month targets vs actuals, `on_track` boolean | Drives campaign progress narrative tone |
| `phiwe_revenue_intelligence.csv` | Revenue and ROI metrics | Manager/Admin view only |
| `phiwe_unattributed_flags.csv` | Leads flagged as potential misattributions | **Never render in any client-facing view — Admin only** |
| `phiwe_validation_lead_details.csv` | Lead-level validation details | Internal/Admin use only |
| `phiwe_velocity_trend.csv` | Weekly avg calls per booking, days first-call-to-booking | Use for conversion velocity narrative |
| `root_cause_analysis.json` | Cancellation root causes with counts | Sanitise before rendering. Only `count > 0` are findings |
| `validation_report.json` | System vs manual tracker drift | Gap < 10% is expected — do not surface to client |

---

## Known Data Quirks

**`has_show` flag is authoritative for attended.** Two leads attended but had `current_status` changed to 'Cancelled' after the fact. `has_show=1` (from first_visits sheet match) is the correct attended count. Do not use `current_status.includes('Completed')`.

**`validation_report.json` drift is expected.** Gap under 10% = normal. Do not render as an error. Only escalate if gap exceeds 10%.

**`phiwe_call_timing_optimized.csv` `engagement_rate` = answer rate.** Do not use this field to compute or label connect rate. Compute connect rate from `phiwe_calls.csv` directly using `live_talk_min >= 0.5`.

**`root_cause_analysis.json` may contain zero-count high-impact causes.** These are hypotheses, not findings. Do not render them.

**`phiwe_loyalsnap_engagement.csv` is frequently null.** Check before building any section. Skip if not meaningfully populated.

**Manual tracker drift.** The manual tracker (`Stretch_Lab_Manual_Tracker.xlsx`) has more bookings than the system export. This is expected. Do not surface as an error.

**`phiwe_pipeline.csv` excludes cancelled-status future bookings.** As of 2026-04-22, `transform.py` was fixed to filter `~current_status.str.contains('Cancelled')` from future bookings. Pipeline count = 7 (not 8).

---

## Iteration Protocol

When building a new page or feature:

1. Read this file first
2. Identify which data files the page needs
3. Load them, log row counts, assert that booking buckets sum to total
4. Write the story in plain English before writing JSX
5. Build the layout around that story
6. Check every rendered value traces to a variable from a file
7. Check all text against the terminology table and language rules
8. Check access level — what should be hidden from client view?
9. Run a final search for any digit literals in rendered output

Do not proceed to the next step until the current step is clean.
