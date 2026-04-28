# StretchLab Campaign Dashboard

React 18 + Vite + Tailwind CSS + Observable Plot + D3 + Anthropic AI.

## Quick Start

```bash
# 1. Install dependencies
cd dashboard && npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — add your VITE_ANTHROPIC_API_KEY

# 3. Run the pipeline first (from project root)
python run_pipeline.py <workbook.xlsx> [manual_tracker.xlsx]

# 4. Sync pipeline outputs to dashboard
cd .. && bash sync-data.sh

# 5. Start dev server
cd dashboard && npm run dev
# → http://localhost:5173
```

---

## Three Views

### Client View (`@stretchlab.com`)
Visible to studio owners. Full analytical depth — every pattern surfaced — but
framed as "here is what we are learning and here is the plan."

| Route | Page |
|-------|------|
| `/` | Campaign Overview — KPIs, benchmarks, 3-scenario forecast |
| `/studios` | Studio Performance — 9 studios, show/cancel rates |
| `/outcomes` | Booking Outcomes — status breakdown, cohort, window, DoW patterns |
| `/cancellations` | Cancellation Analysis — root causes, action plan |
| `/forecast` | Forecast — 30-day scenarios, SOW ramp curve |
| `/recommendations` | AI Recommendations — studio-owner strategy |

**Hidden metrics** (per `config.py CLIENT_HIDDEN_METRICS`): `first_visits`,
`first_visit_rate`, `percentiles`, `engagement_rate`, `ringing_time`,
`days_call_to_booking`, `days_booking_to_show`, `reschedule_rate`,
`attribution_percentage`.

### Manager View (`@execo.com`)
Full data, zero softening. Benchmark gaps highlighted in amber. Designed for
internal Execo SDR managers.

| Route | Page |
|-------|------|
| `/manager/status` | Campaign Status — benchmark gaps, churn risk, SOW progress |
| `/manager/cancellations` | Cancellation Deep Dive — call-touchpoint table, industry context |
| `/manager/calltiming` | Call Timing Heatmap — D3 heatmap, best/worst windows annotated |
| `/manager/pipeline` | At-Risk Pipeline — risk-sorted table, calls-made column |
| `/manager/actionplan` | Action Plan — AI-generated: TODAY / THIS WEEK / CLIENT REVIEW PREP |

### Admin View (`thamsanqa.kekana@execo.com`)
All manager data plus internal-only pages surfacing what the client view omits.

| Route | Page |
|-------|------|
| `/admin/drift` | Data Drift — system vs manual tracker side-by-side |
| `/admin/reconciliation` | Pipeline Reconciliation — attribution donut, funnel, trend charts |
| `/admin/loyalsnap` | **Loyalsnap SMS** — open/response/opt-out rates (new data source) |
| `/admin/flexologists` | **Flexologist Performance** — per-staff show rates (internal only) |
| `/admin/explorer` | Raw Data Explorer — paginated table, search/filter, CSV export |
| `/admin/health` | System Health — pipeline metadata, daily call volume, full scorecard |

---

## Access Model

Role gating mirrors `config.py` exactly:

```
client   → @stretchlab.com domain   → constructive messaging
manager  → @execo.com domain        → honest messaging (maps to 'internal' in config.py)
admin    → thamsanqa.kekana@execo.com → honest + all features
```

The role switcher pill in the TopBar is visible by default for development.
Set `VITE_SHOW_ROLE_SWITCHER=false` in `.env` for client deployments.

---

## New Pipeline Outputs (V4.1)

Two new pipeline outputs added to `transform.py`:

### `phiwe_loyalsnap_engagement.csv`
SMS channel data from the Loyalsnap sheet (previously unused).
Columns: `message_type`, `sent_count`, `open_rate`, `response_rate`,
`opt_out_count`, `date_sent`.

Requires a `loyalsnap` sheet in the source workbook. If absent, the pipeline
writes an empty CSV and the dashboard shows a "run pipeline to generate" notice.

### `phiwe_flexologist_performance.csv`
Individual staff conversion performance derived from the `Booking With` column.
Columns: `booking_with`, `total_sessions`, `shows`, `cancellations`,
`no_shows`, `show_rate_pct`, `cancel_rate_pct`.

**This file is admin-only and is never exposed to the client view.**

### Other new outputs
| File | Description |
|------|-------------|
| `phiwe_conversion_trends.csv` | Week-over-week booking/show rate trend |
| `phiwe_ramp_vs_target.csv` | SOW Month 1/2/3 actual vs 30/50/77 targets |
| `phiwe_velocity_trend.csv` | Avg calls per booking, median days to booking |

---

## Bug Fix — Root Cause Analysis

`transform.py _build_root_cause()` previously counted ALL cancellations as
having low calls (`low_calls = len(cancelled)`). Fixed in V4.1:

```python
# V4.1 FIXED: join cancelled leads with call counts by phone_clean
# then count only those with total_calls_made < 3
call_counts = calls.groupby('to_number_clean')['from_name'].count().reset_index()
cancelled_with_calls = cancelled.merge(call_counts, on='phone_clean', how='left')
low_calls = int((cancelled_with_calls['_calls_made'] < 3).sum())
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_ANTHROPIC_API_KEY` | Anthropic API key for AI insights | — |
| `VITE_SHOW_ROLE_SWITCHER` | Show role-switch pill in TopBar | `true` |

> The API key is used directly from the browser (dev/internal use only).
> Do not deploy this dashboard publicly with a live API key.

---

## Data Flow

```
Source workbook (.xlsx)
        ↓  python run_pipeline.py
    outputs/*.csv + *.json
        ↓  bash sync-data.sh
dashboard/public/data/
        ↓  Papaparse fetch at runtime
    React dashboard
```
