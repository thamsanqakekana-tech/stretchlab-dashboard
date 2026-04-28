# StretchLab Pipeline - Quick Start Guide

## Installation (5 minutes)

### Option A: Automated Setup

```bash
cd stretchlab_pipeline
bash setup.sh
```

### Option B: Manual Setup

```bash
# 1. Create virtual environment
python3 -m venv venv

# 2. Activate it
source venv/bin/activate  # Mac/Linux
# OR
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create directories
mkdir -p data/stretchlab/raw
mkdir -p data/stretchlab/validation
```

---

## Daily Usage (30 seconds)

### Every Morning:

**Step 1:** Download today's export from system  
**Step 2:** Save it as:

```
data/stretchlab/raw/Stretchlab_B2C_DB_Phiwe_2026-04-01.xlsx
```

**Step 3:** Run pipeline:

```bash
python run_pipeline.py
```

**Done!** Your Google Sheets are updated.

---

## What You Get

### 3 Tables in Google Sheets:

1. **phiwe_daily_performance** → Daily KPIs for trends
2. **phiwe_pipeline** → Future scheduled appointments
3. **phiwe_lead_funnel** → Full customer journey (User ID level)

### Connect to Looker Studio:

1. Open Looker Studio
2. Create new report
3. Add data source → Google Sheets
4. Select your spreadsheet
5. Choose table: `phiwe_daily_performance`
6. Build your dashboard!

---

## Key Metrics Available

### From `phiwe_daily_performance`:

- **Outbound calls** made each day
- **New bookings** scheduled
- **Show rate** (% who attended)
- **First visits** (new paying clients)
- **Booking rate** (calls → bookings %)
- **Cancellation rate**
- **Calls per booking**

### From `phiwe_pipeline`:

- **Future appointments** by week
- **Pipeline value** visualization

### From `phiwe_lead_funnel`:

- Full customer journey
- Conversion times (call → booking → first visit)
- Customer status tracking

---

## File Naming Rules

### Daily Export File:

✅ **CORRECT:**
```
Stretchlab_B2C_DB_Phiwe_2026-04-01.xlsx
Stretchlab_B2C_DB_Phiwe_2026-04-15.xlsx
```

❌ **WRONG:**
```
Stretchlab_B2C_DB_Phiwe.xlsx          (missing date)
export_april_1.xlsx                    (wrong format)
Stretchlab_B2C_DB_Phiwe_04-01-26.xlsx (wrong date format)
```

**Format:** `Stretchlab_B2C_DB_Phiwe_YYYY-MM-DD.xlsx`

---

## Troubleshooting

### "No source file found"

**Fix:** Check file is in `data/stretchlab/raw/` with correct name

### "Critical sheets missing"

**Fix:** Make sure Excel file has these sheets:
- ringcentral_call_log
- booking_events_log
- first_visits

### Pipeline runs but no Google Sheets update

**Fix:** Pipeline exports to CSV instead (check `output/` folder)

**To enable Google Sheets:**
1. Set environment variables
2. Or use CSV files to upload manually

---

## Advanced: Google Sheets Setup

### If you want automatic Google Sheets updates:

1. **Create Google Cloud Project**
   - Go to: https://console.cloud.google.com
   - Create new project

2. **Enable Google Sheets API**
   - In project, go to "APIs & Services"
   - Enable "Google Sheets API"

3. **Create Service Account**
   - Go to "Credentials"
   - Create Service Account
   - Download JSON key file

4. **Share Google Sheet**
   - Open your Google Sheet
   - Share with service account email (from JSON file)
   - Give "Editor" permission

5. **Set Environment Variables**

```bash
export STRETCHLAB_SHEETS_ID="your_sheet_id_from_url"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

Add these to your `~/.bashrc` or `~/.zshrc` to make them permanent.

---

## Support

### Check Logs:

```bash
tail -f logs/pipeline_*.log
```

### Common Issues:

| Issue | Solution |
|-------|----------|
| Import errors | Run: `pip install -r requirements.txt` |
| File not found | Check file path and name |
| Data missing | Verify Excel file structure |
| Google Sheets fail | Use CSV output instead (automatic fallback) |

---

## Tips

✅ **DO:**
- Run pipeline daily after uploading file
- Check logs if something seems wrong
- Keep manual tracker for validation

❌ **DON'T:**
- Rename or move Excel sheets
- Edit column names in source file
- Skip days (full refresh handles gaps)

---

## That's It!

**Normal workflow:**
1. Upload file → `data/stretchlab/raw/`
2. Run → `python run_pipeline.py`
3. Check → Looker Studio refreshes automatically

**Questions?** Check `README.md` for detailed documentation.
