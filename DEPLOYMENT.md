# Deployment Checklist

## Pre-Deployment (Before You Start)

### ✅ System Requirements
- [ ] Python 3.8 or higher installed
- [ ] Git installed (optional, for version control)
- [ ] VSCode installed (optional, but recommended)
- [ ] Terminal/command line access

### ✅ Data Files Ready
- [ ] Daily export file downloaded from system
- [ ] Manual tracker available (optional, for validation)

---

## Installation (First Time Setup)

### Step 1: Extract Pipeline
```bash
# Extract the archive
tar -xzf stretchlab_pipeline.tar.gz
cd stretchlab_pipeline
```

### Step 2: Run Setup
```bash
# Automated setup
bash setup.sh

# OR manual setup:
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
mkdir -p data/stretchlab/raw data/stretchlab/validation
```

### Step 3: Place Data Files
```bash
# Copy your files
cp /path/to/Stretchlab_B2C_DB_Phiwe_*.xlsx data/stretchlab/raw/
cp /path/to/Stretch_Lab_Manual_Tracker*.xlsx data/stretchlab/validation/
```

### Step 4: Test Run
```bash
# Activate virtual environment if not already
source venv/bin/activate  # Mac/Linux

# Run pipeline
python run_pipeline.py
```

**Expected output:**
```
================================================================================
STRETCHLAB B2C PIPELINE STARTED
================================================================================

[STEP 1/4] EXTRACTING DATA FROM SOURCE FILE
--------------------------------------------------------------------------------
Reading source file: data/stretchlab/raw/Stretchlab_B2C_DB_Phiwe_1.xlsx
  ✓ Loaded ringcentral_call_log: 23,806 rows
  ✓ Loaded booking_events_log: 13,517 rows
  ✓ Loaded first_visits: 350 rows
  ✓ Loaded loyalsnap: 2,234 rows
✓ Extracted 4 tables

[STEP 2/4] TRANSFORMING DATA
--------------------------------------------------------------------------------
Transforming calls data...
  Filtered to Phiwe: 3,499 of 23,806 calls
  ✓ Processed 3,499 outbound calls
Transforming bookings data...
  Deduplicated: 13,517 → 5,234 unique bookings
  Filtered to Phiwe: 30 bookings
  Booking outcomes:
    - Cancelled: 22
    - Completed: 2
    - No-Show: 2
    - Scheduled: 4
  ✓ Processed 30 bookings
...
✓ Generated 3 mart tables

[STEP 3/4] LOADING TO GOOGLE SHEETS
--------------------------------------------------------------------------------
✓ All tables loaded to Google Sheets successfully

[STEP 4/4] VALIDATING DATA QUALITY
--------------------------------------------------------------------------------
Running validation checks...
  Validating against manual tracker...
  ✓ All validation checks passed

================================================================================
PIPELINE COMPLETED SUCCESSFULLY
================================================================================
```

---

## Daily Operations Checklist

### Every Morning (2 minutes):

- [ ] **Download today's export** from system
- [ ] **Save as:** `Stretchlab_B2C_DB_Phiwe_2026-MM-DD.xlsx`
- [ ] **Place in:** `data/stretchlab/raw/`
- [ ] **Run:** `python run_pipeline.py`
- [ ] **Verify:** Check logs show "PIPELINE COMPLETED SUCCESSFULLY"
- [ ] **Confirm:** Looker Studio dashboard updated

---

## Google Sheets Setup (Optional)

### If You Want Automatic Google Sheets Updates:

#### Step 1: Create Google Cloud Project
1. Go to: https://console.cloud.google.com
2. Click "New Project"
3. Name it: "StretchLab Data Pipeline"
4. Click "Create"

#### Step 2: Enable Google Sheets API
1. In project, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click "Enable"

#### Step 3: Create Service Account
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Name: "stretchlab-pipeline"
4. Click "Create and Continue"
5. Skip optional steps, click "Done"

#### Step 4: Download Credentials
1. Find your service account in the list
2. Click on it
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Choose "JSON"
6. Save file as: `google-credentials.json`

#### Step 5: Create Google Sheet
1. Go to: https://sheets.google.com
2. Create new spreadsheet
3. Name it: "StretchLab B2C Data Mart"
4. Copy the Sheet ID from URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```

#### Step 6: Share Sheet with Service Account
1. In your Google Sheet, click "Share"
2. Paste the service account email (from JSON file, looks like: `name@project.iam.gserviceaccount.com`)
3. Give "Editor" permission
4. Click "Send"

#### Step 7: Configure Pipeline
```bash
# Set environment variables
export STRETCHLAB_SHEETS_ID="your_sheet_id_from_step_5"
export GOOGLE_APPLICATION_CREDENTIALS="/full/path/to/google-credentials.json"

# Make them permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export STRETCHLAB_SHEETS_ID="your_sheet_id"' >> ~/.bashrc
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"' >> ~/.bashrc
```

#### Step 8: Test
```bash
python run_pipeline.py
```

Check your Google Sheet - you should see 3 new tabs:
- phiwe_daily_performance
- phiwe_pipeline
- phiwe_lead_funnel

---

## Looker Studio Connection

### Step 1: Create Data Source
1. Go to: https://lookerstudio.google.com
2. Click "Create" → "Data Source"
3. Select "Google Sheets"
4. Choose your spreadsheet: "StretchLab B2C Data Mart"
5. Select table: `phiwe_daily_performance`
6. Click "Connect"

### Step 2: Configure Fields
**Make these changes:**

| Field | Type | Aggregation |
|-------|------|-------------|
| date | Date | None |
| outbound_calls | Number | Sum |
| new_bookings | Number | Sum |
| shows | Number | Sum |
| first_visits | Number | Sum |
| booking_rate_pct | Percent | Average |
| show_rate_pct | Percent | Average |

### Step 3: Create Dashboard
1. Click "Create Report"
2. Add your first chart
3. Build out 3 pages (see below)

---

## Dashboard Page Templates

### Page 1: Executive Overview

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  Phiwe Khasa - B2C Campaign Performance                │
│  [Date Range Control]                                  │
└────────────────────────────────────────────────────────┘

┌──────┬──────┬──────┬──────┬──────┐
│Calls │Book  │Book% │Shows │Show% │
│3,499 │  30  │0.89% │  2   │6.7%  │
└──────┴──────┴──────┴──────┴──────┘

┌────────────────────────────────────────────────────────┐
│  Conversion Funnel                                     │
│  [Funnel Chart: Calls→Bookings→Shows→First Visits]    │
└────────────────────────────────────────────────────────┘

┌──────────────────────────┬─────────────────────────────┐
│  Daily Calls & Bookings  │  Booking Outcomes           │
│  [Time Series Line]      │  [Pie Chart]                │
└──────────────────────────┴─────────────────────────────┘
```

**Charts to Add:**
1. Scorecard: Outbound Calls (sum)
2. Scorecard: New Bookings (sum)
3. Scorecard: Booking Rate % (average)
4. Scorecard: Shows (sum)
5. Scorecard: Show Rate % (average)
6. Funnel Chart (if available) or Stacked Bar
7. Time Series: Calls + Bookings by Date
8. Pie Chart: Booking Outcomes

### Page 2: Pipeline View

**Data Source:** `phiwe_pipeline`

```
┌────────────────────────────────────────────────────────┐
│  Pipeline: Future Scheduled Appointments               │
└────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Appointments by Week                                │
│  [Column Chart: bookings_count by booking_week]      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Pipeline Details                                    │
│  [Table: All columns]                                │
└──────────────────────────────────────────────────────┘
```

### Page 3: Performance Trends

**Data Source:** `phiwe_daily_performance`

```
┌────────────────────────────────────────────────────────┐
│  Performance Trends                                    │
└────────────────────────────────────────────────────────┘

┌──────────────────────────┬─────────────────────────────┐
│  Conversion Rates        │  Efficiency Metrics         │
│  [Line: Booking/Show %]  │  [Line: Calls per Booking]  │
└──────────────────────────┴─────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  Daily Performance Table                               │
│  [Table: All KPIs, sortable]                          │
└────────────────────────────────────────────────────────┘
```

---

## Troubleshooting Guide

### Issue: "No source file found"

**Symptoms:**
```
ERROR - FILE NOT FOUND: No source file found in data/stretchlab/raw/
```

**Solutions:**
1. Check file is in correct directory
2. Verify file naming: `Stretchlab_B2C_DB_Phiwe_YYYY-MM-DD.xlsx`
3. Check file permissions (readable)

---

### Issue: "Critical sheets missing"

**Symptoms:**
```
ERROR - Missing critical sheets: ['ringcentral_call_log']
```

**Solutions:**
1. Open Excel file
2. Verify sheet names exactly match:
   - ringcentral_call_log
   - booking_events_log
   - first_visits
   - loyalsnap
3. Check for typos or spaces

---

### Issue: "Column not found"

**Symptoms:**
```
KeyError: 'From Name'
```

**Solutions:**
1. Source file structure changed
2. Check column names in Excel
3. Update `transform.py` if columns renamed

---

### Issue: Google Sheets not updating

**Symptoms:**
- Pipeline completes successfully
- CSV files generated in `output/`
- Google Sheet empty

**Solutions:**
1. Check environment variables set:
   ```bash
   echo $STRETCHLAB_SHEETS_ID
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```
2. Verify service account has edit access
3. Check credentials.json file exists
4. Review logs for specific error

---

### Issue: Attribution gap warning

**Symptoms:**
```
WARNING - Attribution gap detected: 4 bookings (11.8%) in manual tracker not found in system
```

**This is EXPECTED - not an error!**

**Explanation:**
- Multi-agent logging (Agent A calls, Agent B logs)
- System can't attribute these to Phiwe
- Known limitation

**Solution:**
- Implement SOP: agents log their own bookings
- Monitor gap over time (should decrease)

---

## Monitoring & Maintenance

### Weekly Checks

- [ ] Review logs for warnings
- [ ] Verify dashboard shows recent data
- [ ] Check attribution gap trend
- [ ] Confirm all 3 output tables populated

### Monthly Reviews

- [ ] Validate KPIs against business expectations
- [ ] Review booking outcomes (cancel rate, show rate)
- [ ] Check first visit conversion trend
- [ ] Archive old log files

### Quarterly Updates

- [ ] Review Phiwe name variations (update if needed)
- [ ] Assess pipeline performance (execution time)
- [ ] Evaluate need for new KPIs
- [ ] Plan enhancements

---

## Success Criteria

### ✅ Pipeline is Working When:

1. Runs without errors daily
2. Completes in < 30 seconds
3. All 3 output tables populated
4. Looker Studio auto-refreshes
5. Validation shows < 15% attribution gap
6. Logs show no critical errors

### 🎯 Business Metrics to Monitor:

1. **Booking Rate:** Target 1-2%
2. **Show Rate:** Target 60-70% (currently 6.7% - CRITICAL)
3. **Cancel Rate:** Target < 20% (currently 71% - CRITICAL)
4. **First Visit Rate:** Target 50%+ of shows
5. **Calls per Booking:** Target < 100

---

## Support

### Resources

📖 **Documentation:**
- `README.md` - Full technical documentation
- `QUICKSTART.md` - Quick start guide
- `ARCHITECTURE.md` - System architecture
- `DEPLOYMENT.md` - This file

🔍 **Logs:**
- Location: `logs/`
- View: `tail -f logs/pipeline_*.log`

📁 **Output:**
- Google Sheets (if configured)
- CSV files: `output/` (fallback)

---

## Contact & Escalation

### When to Escalate:

1. **Critical:** Pipeline fails for 2+ consecutive days
2. **High:** Attribution gap > 20%
3. **Medium:** Execution time > 2 minutes
4. **Low:** Warning messages in logs

### What to Include:

- Latest log file
- Source Excel file (if possible)
- Screenshot of error
- Steps already tried

---

**Last Updated:** 2026-03-31  
**Version:** 1.0  
**Maintainer:** Thami Kekana
