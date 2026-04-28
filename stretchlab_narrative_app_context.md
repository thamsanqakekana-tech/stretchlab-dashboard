# StretchLab Cold Leads — Narrative-First Data App
## Context Document for Claude Code (VSCode)

---

## Purpose

This document gives Claude Code the strategic framework, design principles, and data contract for building a narrative-first analytics app for the StretchLab B2C cold re-engagement campaign.

The SDR (Phiwe) is working dormant and old leads across multiple studio locations. The data pipeline runs on a refresh cycle — outputs land in `outputs/YYYY-MM-DD/`. **Do not hardcode numbers from any specific run.** All metrics must be read from the latest output folder at runtime and interpreted dynamically.

The goal of the app is to **push a story, not a spreadsheet.** Every view must answer: *so what?* and *what do we do next?* Numbers exist to support the narrative — they are never the narrative itself.

---

## The Core Framework (Evan's Principle)

Always build in this sequence. Never skip to step 3.

**1. Data layer** — Read the latest outputs. Sanity-check what's there. Surface any red flags before building anything.

**2. Story layer** — Ask: what is the data telling us right now? What narrative serves this client at this stage of the campaign? The answer to this question should be a sentence, not a dashboard.

**3. Dashboard layer** — Build the visuals and layout to tell that story. Structure, ordering, framing, and what gets shown vs hidden all flow from step 2.

> "The way I look at all this stuff with BI is: look at the data, form the story, then build the dashboard to tell that story. Sometimes that three-part series gets missed and we just put everything on the page." — Evan

The most common failure mode is jumping straight from data to dashboard. The story layer is not optional.

---

## Critical Design Rules

### The app must:
- Open every major section with a written narrative paragraph — one to three sentences that state the finding and its implication before any chart or number appears
- Annotate every key metric with a "so what?" — not just a value, but what it means for the campaign
- Frame all benchmarks explicitly as **cold re-engagement outreach standards**, not fitness industry averages or inbound lead benchmarks. Phiwe is working dormant/old leads. The benchmark file carries this framing — respect it.
- End every section with a clear, specific action or recommendation
- Read data from the latest dated folder in `outputs/` at runtime — never from a hardcoded path

### The app must never:
- Reference internal tooling by name — no AirCall, Reply.io, LoyalSnap, ClubReady, or any pipeline system name in any client-visible surface
- Merge or separate call data by tool or platform in a way the client would see
- Calculate show rate as `shows / total_bookings` without filtering to resolved bookings only — the denominator must exclude future/scheduled appointments with no outcome yet, or the rate will always look artificially low
- Show raw numbers without context or interpretation
- Surface the drift between system data and the manual tracker as an error in client-facing views — this is a known acceptable gap
- Reference a specific number of call touchpoints (e.g. "3-touch minimum", "3 call touchpoints") in any client-facing surface — this creates a contractual reference point that can be used against Execo if a cancelled booking falls short of that number. The correct framing is a **confirmation follow-up protocol** — describe the practice, never the count
- Frame any hold rate or cancellation action as something the studio needs to do — the studio hired Execo to run this campaign. All follow-up and confirmation activity is Execo-owned. Insights and recommendations in the client view must reflect what Phiwe is doing, not what the studio should do differently

---

## Campaign Context

| Field | Detail |
|---|---|
| Client | StretchLab (multi-studio fitness franchise) |
| Campaign type | B2C cold re-engagement — dormant and old leads |
| SDR | Phiwe Khasa |
| Studios | Shreveport, Bellaire, Bunker Hill, Brighton |
| Brighton | Pipeline is currently inactive — flag in narrative, do not hide |
| Benchmarks | Cold re-engagement outreach standards — **not** general fitness industry averages |

---

## Data Files and What They Are For

All files live in `outputs/YYYY-MM-DD/`. Always resolve the latest folder at runtime.

| File | Purpose |
|---|---|
| `phiwe_campaign_health.csv` | Top-line health metrics — use as opening dashboard summary |
| `phiwe_ramp_vs_target.csv` | Month-by-month target vs actual kept appointments — drives on-track narrative |
| `phiwe_benchmarks_comparison.csv` | KPIs vs cold re-engagement benchmarks with rank and gap |
| `phiwe_bookings.csv` | All attributed bookings with outcome, studio, attribution method |
| `phiwe_lead_funnel.csv` | Full funnel: calls + bookings + outcomes joined, includes days-to-booking |
| `phiwe_pipeline.csv` | Open/future bookings with risk level and days until appointment |
| `phiwe_daily_performance.csv` | Day-by-day: calls, talk time, booking rate, show rate, cancel rate |
| `phiwe_conversion_trends.csv` | Weekly bookings, shows, calls, booking rate, show rate |
| `phiwe_booking_outcomes.csv` | Outcome type summary (show, cancel, no-show, scheduled) |
| `phiwe_cancellation_analysis.csv` | Cancellations with timing, who cancelled, booking window, day of week |
| `phiwe_booking_window_analysis.csv` | Cancel and show rate by booking window bucket |
| `phiwe_cohort_analysis.csv` | Outcome rates by lead conversion speed cohort, includes insight text |
| `phiwe_day_of_week_performance.csv` | Bookings, shows, cancellations by day of week |
| `phiwe_call_timing_optimized.csv` | Call engagement rate by day + hour with category labels (optimal/good/avoid) |
| `phiwe_velocity_trend.csv` | Weekly: avg calls per booking, median days first-call-to-booking |
| `phiwe_by_studio.csv` | Bookings, shows, cancellations, show rate by studio location |
| `phiwe_forecast_30_day.csv` | 3 scenarios (pessimistic/likely/optimistic) with revenue and plain-language drivers |
| `phiwe_unattributed_flags.csv` | Leads flagged as potential misattributions — **internal only, never client-facing** |
| `phiwe_revenue_intelligence.csv` | Revenue and ROI metrics |
| `phiwe_by_area_code.csv` | Call and booking performance by geography |
| `phiwe_flexologist_performance.csv` | Show/cancel rates by staff member the session was booked with |
| `phiwe_calls.csv` | Raw call log — timing, outcome, duration, area code |
| `phiwe_insights.json` | Pre-computed narrative strings from the pipeline — read this first |
| `root_cause_analysis.json` | Cancellation root causes with counts, impact ratings, and action items |
| `validation_report.json` | Data integrity check — system vs manual tracker drift |

---

## Narrative Sections — Structure and Logic

Build the app around these chapters in this order. Each section follows: narrative paragraph → supporting visual → action recommendation.

### 1. Campaign Health
*Is the campaign on track? What is the headline story right now?*
- Source: `phiwe_campaign_health.csv`, `phiwe_ramp_vs_target.csv`, `phiwe_benchmarks_comparison.csv`
- Read the `on_track` boolean from ramp vs target to determine the opening sentence tone
- All benchmark comparisons must carry the cold re-engagement label explicitly

### 2. What Is Working
*Where is Phiwe converting? Best days, best call timing, best booking windows.*
- Source: `phiwe_day_of_week_performance.csv`, `phiwe_call_timing_optimized.csv`, `phiwe_booking_window_analysis.csv`
- Pull the top-performing day(s) and hour(s) dynamically from the data — do not hardcode
- Action format: "To maximise hold rates, book sessions [X days] out and prioritise [day] slots"

### 3. The Cancellation Problem
*Do we have a cancellation problem? Who is cancelling, when, and what is driving it?*
- Source: `phiwe_cancellation_analysis.csv`, `phiwe_cohort_analysis.csv`, `root_cause_analysis.json`
- Follow Evan's diagnostic chain: Is the rate high vs benchmark? Who is cancelling? Is it last-minute or in advance? Does booking window predict it? Is there a day-of-week pattern?
- Read root causes from `root_cause_analysis.json` — only surface causes where `count > 0`
- Do not assert a cause as a finding if its count is zero, even if it is labelled high-impact
- Action: use the `action` field from the top cause by count as the internal logic, but reframe any action that specifies a call count or touchpoint number before rendering it client-facing. The pattern to follow: describe what Phiwe does (the confirmation follow-up protocol) rather than prescribing a number or directing the studio to act

### 4. Pipeline and Forecast
*What is in the active pipeline? What are we projecting for the next 30 days?*
- Source: `phiwe_pipeline.csv`, `phiwe_forecast_30_day.csv`
- Surface risk levels on open bookings dynamically
- Present the three forecast scenarios using the `drivers` field from the CSV verbatim

### 5. Studio Breakdown
*Which studios are performing? Are there location-specific issues?*
- Source: `phiwe_by_studio.csv`
- Brighton's inactive pipeline must be called out explicitly — it is a known issue, not a data gap
- Apply the resolved-bookings-only rule for show rate comparisons across studios

### 6. Conversion Velocity
*Is the pace of conversion improving or degrading?*
- Source: `phiwe_velocity_trend.csv`, `phiwe_conversion_trends.csv`
- Surface trend direction by comparing recent weeks to earlier weeks from the data — do not assert direction without checking

---

## Known Data Issues — Handle Explicitly

These are not bugs to hide. They are realities to handle in the right place.

**Show rate denominator.** Total bookings includes future appointments with no outcome yet. Show rate must use resolved bookings only — filter to rows where the booking date has passed (`is_past = 1` in the bookings file). Using total bookings as the denominator will always make show rate look artificially low. This is the most likely source of misleading numbers in the pipeline.

**System vs manual tracker drift.** `validation_report.json` will always show a small gap between system and manual booking counts. A gap under ~10% is expected. Do not surface it in any client-facing view. Log it internally and only escalate as a warning if the gap grows beyond 10%.

**Attribution across studios.** Some first-visit conversions in Shreveport, Bellaire, Bunker Hill, and Brighton may be misattributed due to the multi-agent booking model. `phiwe_unattributed_flags.csv` flags these cases. Do not roll flagged leads into headline booking counts without confirmed attribution. This file is internal only.

**Zero-count root causes.** `root_cause_analysis.json` may contain causes with a count of zero that carry a "High Impact" label. These are pipeline placeholders for hypotheses that were not confirmed by the current data. Do not surface them as findings. Only causes with `count > 0` are findings.

**LoyalSnap engagement data.** `phiwe_loyalsnap_engagement.csv` frequently contains mostly null values. Check the file before building any section around it. If the data is not meaningfully populated in the current run, skip the section.

**Benchmarks module label.** `benchmarks.py` currently describes thresholds as "wellness/assisted stretching industry standards." This label must not appear in any client-facing output. All benchmark references must read as cold re-engagement outreach standards. The UI layer is responsible for this override — do not rely on the benchmarks module to carry the correct label.

---

## How to Read the JSON Outputs

Read these before building any narrative. They are the pre-computed story seeds.

**`phiwe_insights.json`** — Narrative strings generated by the pipeline. Use these as the basis for written summaries. Do not override them with your own interpretation unless a CSV value directly contradicts them.

**`root_cause_analysis.json`** — Read the `causes` array. Check `count > 0` before using any cause. Use the `action` field for the recommendation. Use `impact` as a priority signal only, not as confirmation that a finding exists.

**`validation_report.json`** — Read `drift.booking_drift_pct`. If the absolute value is under 10%, log and proceed. If above 10%, surface a data quality warning in the internal view and note that headline numbers may be understated.

---

## Tech Notes

- Always resolve the latest `outputs/YYYY-MM-DD/` folder at runtime — never hardcode a date path
- Narrative text must be computed from live data values, not written statically
- Benchmark labels in the UI must read: *"vs. cold re-engagement outreach standard"* — never *"vs. industry average"*
- Charts always follow the narrative paragraph — they never precede it
- Prefer prose summaries over bullet lists in narrative sections
- `phiwe_unattributed_flags.csv` must never appear in any client-facing output
