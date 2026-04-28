# StretchLab Pipeline Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DAILY WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────┘

[1] MANUAL STEP (You do this)
    │
    ↓
┌──────────────────────────────────┐
│  Upload Daily Export File        │
│  Stretchlab_B2C_DB_Phiwe_*.xlsx │
│  → data/stretchlab/raw/          │
└──────────────────────────────────┘
    │
    ↓
[2] AUTOMATED (Pipeline does this)
    │
    ↓
┌──────────────────────────────────┐
│  Run Pipeline                    │
│  $ python run_pipeline.py        │
└──────────────────────────────────┘
    │
    ├──[EXTRACT]──────────────────────┐
    │                                  │
    │  ┌────────────────────────────┐ │
    │  │ Read Excel File            │ │
    │  │ - ringcentral_call_log     │ │
    │  │ - booking_events_log       │ │
    │  │ - first_visits             │ │
    │  │ - loyalsnap                │ │
    │  └────────────────────────────┘ │
    │                                  │
    ├──[TRANSFORM]─────────────────────┤
    │                                  │
    │  ┌────────────────────────────┐ │
    │  │ Filter to Phiwe Only       │ │
    │  │ - Calls (From Name)        │ │
    │  │ - Bookings (Made By)       │ │
    │  │ - First Visits (User ID)   │ │
    │  └────────────────────────────┘ │
    │           │                      │
    │           ↓                      │
    │  ┌────────────────────────────┐ │
    │  │ Clean & Deduplicate        │ │
    │  │ - Latest record per ID     │ │
    │  │ - Parse dates/times        │ │
    │  │ - Clean phone numbers      │ │
    │  └────────────────────────────┘ │
    │           │                      │
    │           ↓                      │
    │  ┌────────────────────────────┐ │
    │  │ Build Funnel               │ │
    │  │ Calls→Bookings→Shows→Paid  │ │
    │  └────────────────────────────┘ │
    │           │                      │
    │           ↓                      │
    │  ┌────────────────────────────┐ │
    │  │ Aggregate by Date          │ │
    │  │ Calculate KPIs             │ │
    │  └────────────────────────────┘ │
    │           │                      │
    │           ↓                      │
    │  ┌────────────────────────────┐ │
    │  │ Build Pipeline View        │ │
    │  │ Future bookings by week    │ │
    │  └────────────────────────────┘ │
    │                                  │
    ├──[LOAD]──────────────────────────┤
    │                                  │
    │  ┌────────────────────────────┐ │
    │  │ Write to Google Sheets     │ │
    │  │ OR                         │ │
    │  │ Export to CSV (fallback)   │ │
    │  └────────────────────────────┘ │
    │                                  │
    ├──[VALIDATE]──────────────────────┤
    │                                  │
    │  ┌────────────────────────────┐ │
    │  │ Compare vs Manual Tracker  │ │
    │  │ Flag attribution gaps      │ │
    │  │ Report discrepancies       │ │
    │  └────────────────────────────┘ │
    │                                  │
    └──────────────────────────────────┘
    │
    ↓
[3] OUTPUTS
    │
    ├── Google Sheets (3 tables)
    │   ├── phiwe_daily_performance
    │   ├── phiwe_pipeline
    │   └── phiwe_lead_funnel
    │
    ├── Logs
    │   └── logs/pipeline_YYYYMMDD_HHMMSS.log
    │
    └── CSV Fallback (if Google Sheets fails)
        └── output/*.csv

    │
    ↓
[4] LOOKER STUDIO (Auto-refreshes)
    │
    └── Dashboard powered by Google Sheets
```

---

## Data Flow Architecture

```
SOURCE SYSTEMS                PIPELINE PROCESSING              OUTPUT TABLES
┌────────────────┐           ┌──────────────────┐            ┌─────────────────────┐
│ ClubReady      │──┐        │                  │            │ phiwe_daily_        │
│ (CRM)          │  │        │  EXTRACT         │            │ performance         │
└────────────────┘  │        │                  │            │                     │
                    ├───────→│  - Read Excel    │            │ ├ date              │
┌────────────────┐  │        │  - Validate      │            │ ├ outbound_calls    │
│ RingCentral    │──┤        │                  │            │ ├ new_bookings      │
│ (Calls)        │  │        └──────────────────┘            │ ├ shows             │
└────────────────┘  │                 │                      │ ├ first_visits      │
                    │                 ↓                      │ ├ booking_rate_pct  │
┌────────────────┐  │        ┌──────────────────┐            │ ├ show_rate_pct     │
│ LoyalSnap      │──┘        │                  │            │ └ ...               │
└────────────────┘           │  TRANSFORM       │            └─────────────────────┘
                             │                  │
                             │  Filter:         │            ┌─────────────────────┐
                             │  - Phiwe only    │            │ phiwe_pipeline      │
                             │                  │            │                     │
                             │  Clean:          │            │ ├ booking_week_start│
                             │  - Dedup         │            │ ├ bookings_count    │
                             │  - Parse dates   │            │ └ ...               │
                             │  - Phone match   │            └─────────────────────┘
                             │                  │
                             │  Build:          │            ┌─────────────────────┐
                             │  - Funnel        │            │ phiwe_lead_funnel   │
                             │  - Daily agg     │            │                     │
                             │  - Pipeline      │            │ ├ user_id           │
                             │                  │            │ ├ has_booking       │
                             └──────────────────┘            │ ├ has_show          │
                                      │                      │ ├ has_first_visit   │
                                      ↓                      │ ├ is_paying_client  │
                             ┌──────────────────┐            │ └ ...               │
                             │                  │            └─────────────────────┘
                             │  LOAD            │
                             │                  │
                             │  → Google Sheets │
                             │  OR              │
                             │  → CSV Files     │
                             │                  │
                             └──────────────────┘
                                      │
                                      ↓
┌────────────────┐           ┌──────────────────┐
│ Manual Tracker │──────────→│  VALIDATE        │
│ (Excel)        │           │                  │
└────────────────┘           │  - Compare       │
                             │  - Flag gaps     │
                             │  - Report        │
                             └──────────────────┘
```

---

## Funnel Logic

```
CUSTOMER JOURNEY TRACKING

┌──────────────┐
│ CALLS        │  Outbound calls made (3,499 total)
│ (Phone-based)│  Phone number tracked
└──────┬───────┘
       │ Phone matching
       ↓
┌──────────────┐
│ BOOKINGS     │  Appointments scheduled (30 total)
│ (User ID)    │  "New Booking Made" event
└──────┬───────┘
       │ User ID link
       ↓
┌──────────────┐
│ SHOWS        │  Appointments attended (2 total)
│ (Outcome)    │  "Current Status" = Completed
└──────┬───────┘
       │ User ID link
       ↓
┌──────────────┐
│ FIRST VISITS │  New paying clients (2 total)
│ (User ID)    │  In first_visits table
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ MEMBERSHIPS  │  Purchased membership
│ (has_member) │  has_membership = TRUE
└──────────────┘

CONVERSION RATES:
- Calls → Bookings:     0.89% (30/3,499)
- Bookings → Shows:     6.7% (2/30)
- Shows → First Visits: 100% (2/2)
- Overall:              0.06% (2/3,499)
```

---

## Critical Business Rules

### 1. Booking Deduplication
**Problem:** booking_events_log has multiple rows per Booking ID  
**Solution:** Keep LATEST record per Booking ID  
**Method:** Sort by `created_date DESC`, then `groupby(Booking ID).first()`

### 2. Outcome Determination
**Source:** `Current Status` field (NOT `Booking Event`)  
**Logic:**
- `contains('completed')` → Completed
- `contains('cancelled')` → Cancelled
- `contains('no-show')` → No-Show
- `contains('open')` OR `contains('scheduled')` → Scheduled

### 3. Attribution
**Calls:** `From Name` IN ('Phiwe Khasa', 'Sasha Phiwe Khasa')  
**Bookings:** `Booking Made By` OR `Event Logged By` matches Phiwe  
**First Visits:** Linked via User ID to Phiwe's bookings

### 4. Phone Matching
**Challenge:** Calls don't have User ID  
**Solution:** Match on cleaned phone number (best effort)  
**Limitation:** Not 100% accurate, some calls won't link

---

## File Structure

```
stretchlab_pipeline/
│
├── run_pipeline.py          # Main orchestrator
├── config.py                # Configuration
├── extract.py               # Data extraction
├── transform.py             # Business logic
├── load.py                  # Google Sheets loading
├── validate.py              # Quality validation
│
├── data/
│   └── stretchlab/
│       ├── raw/             # Daily uploads go here
│       └── validation/      # Manual tracker (optional)
│
├── logs/                    # Execution logs
├── output/                  # CSV fallback
│
├── requirements.txt         # Python dependencies
├── setup.sh                 # Installation script
├── README.md                # Full documentation
├── QUICKSTART.md            # Quick start guide
└── ARCHITECTURE.md          # This file
```

---

## Error Handling

```
EXECUTION FLOW

Start
  │
  ├─ File not found?
  │   └─→ STOP: "No source file found"
  │
  ├─ Missing critical sheets?
  │   └─→ STOP: "Critical sheets missing"
  │
  ├─ Data extraction fails?
  │   └─→ STOP: Log error, exit
  │
  ├─ Transformation succeeds?
  │   ├─→ YES: Continue
  │   └─→ NO: STOP, log error
  │
  ├─ Google Sheets available?
  │   ├─→ YES: Load to Sheets
  │   └─→ NO: Export to CSV (fallback)
  │
  ├─ Validation warnings?
  │   ├─→ YES: Log warnings, continue
  │   └─→ NO: Continue
  │
  ├─ Critical validation errors?
  │   ├─→ YES: STOP
  │   └─→ NO: Success!
  │
  └─ Complete
```

---

## Performance

**Typical Execution Time:**
- Extract: ~2 seconds
- Transform: ~3 seconds
- Load (Google Sheets): ~5 seconds
- Validate: ~1 second
- **Total: ~11 seconds**

**Data Volume:**
- ~24,000 call records
- ~13,500 booking events
- ~350 first visits
- **Processed in under 15 seconds**

---

## Future Enhancements

**Potential improvements:**

1. **Incremental processing** - Only process new data since last run
2. **Email alerts** - Send summary email after each run
3. **Dashboard generation** - Auto-create Looker Studio dashboards
4. **Automated scheduling** - Cron job or cloud function
5. **Real-time sync** - Connect directly to source systems (when APIs available)
6. **Advanced matching** - ML-based phone/name matching for better call attribution
7. **Historical tracking** - Version control for data over time

---

## Support & Maintenance

**Regular checks:**
- Review logs weekly for warnings
- Validate attribution gap monthly
- Update Phiwe name variations if needed
- Monitor pipeline execution time

**Troubleshooting:**
1. Check logs: `tail -f logs/pipeline_*.log`
2. Verify source file structure hasn't changed
3. Confirm Google Sheets access (if using)
4. Review validation warnings
