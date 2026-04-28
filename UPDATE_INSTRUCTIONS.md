# PIPELINE V3.0 FINAL UPDATE - INSTALLATION GUIDE

## 📦 FILES TO UPDATE: 3 SCRIPTS

Replace these 3 files in your `~/Documents/stretchlab_pipeline/` directory:

1. **extract.py** - Updated for Custom RingCentral format
2. **transform.py** - Adds Call Timing + Geography + Area Code mapping
3. **run_pipeline.py** - Generates 6 CSVs + validation report JSON

---

## 🚀 INSTALLATION (2 minutes)

### Step 1: Backup your current files
```bash
cd ~/Documents/stretchlab_pipeline
mkdir backup_$(date +%Y%m%d)
cp extract.py transform.py run_pipeline.py backup_$(date +%Y%m%d)/
```

### Step 2: Replace with new files
```bash
# Copy the 3 new files to your directory
cp /path/to/extract.py .
cp /path/to/transform.py .
cp /path/to/run_pipeline.py .
```

### Step 3: Run the pipeline
```bash
python run_pipeline.py data/stretchlab/raw/Stretchlab_B2C_DB_Phiwe_20260401.xlsx
```

---

## ✅ EXPECTED OUTPUT: 7 FILES

**In `outputs/` directory:**

1. phiwe_daily_performance.csv (20 columns)
2. phiwe_lead_funnel.csv (22 columns)
3. phiwe_pipeline.csv (6 columns)
4. phiwe_by_studio.csv (10 columns)
5. **phiwe_call_timing.csv** (7 columns) 🆕
6. **phiwe_by_area_code.csv** (11 columns) 🆕
7. **pipeline_validation_report.json** 🆕

**Also created:**
- `pipeline.log` - Execution log with detailed metrics

---

## 📊 WHAT'S NEW:

### **1. Call Timing Heatmap Data**
```csv
hour,day_of_week,total_calls,connected_calls,answer_rate_pct,bookings,booking_rate_pct
9,Monday,142,97,68.3,3,2.1
12,Monday,156,112,71.8,5,3.2
```

### **2. Geography by Area Code**
```csv
area_code,state,city,region,total_calls,unique_leads,bookings,shows,show_rate_pct
318,Louisiana,Shreveport/Monroe,South,740,312,31,10.0
832,Texas,Houston,South,650,243,19,7.8
```

### **3. Validation Report JSON**
```json
{
  "timestamp": "2026-04-02 15:30:45",
  "metrics": {
    "system_calls": 4027,
    "system_bookings": 31,
    "system_shows": 3
  },
  "data_quality": {
    "peak_calling_time": "Monday 12:00",
    "top_market": "Houston, Texas"
  },
  "overall_status": "PASS"
}
```

---

## ⚠️ NO ADDITIONAL FILES NEEDED

**Area code mapping is built-in!**
- Already included at the top of `transform.py`
- Covers 40+ most common US area codes
- No separate file to copy

**Config stays the same:**
- Your existing `config.py` doesn't need updates
- Main pipeline logic is self-contained

---

## 🧪 VALIDATION CHECKLIST

After running pipeline, verify:

- [ ] 6 CSV files in `outputs/`
- [ ] `pipeline_validation_report.json` in `outputs/`
- [ ] `pipeline.log` created with metrics
- [ ] No errors in console output
- [ ] Log shows: "📊 System Metrics (for manual tracker comparison)"
- [ ] Top area code is 318 or 832
- [ ] Peak calling hour around 12pm

---

## 📝 SAMPLE LOG OUTPUT

```
================================================================================
STEP 4: VALIDATION
================================================================================
Running validation checks...
  ✅ Daily performance has data
  📊 System Metrics (for manual tracker comparison):
     Calls: 4,027
     Bookings: 31
     Shows: 3
     Cancellations: 21
     No-Shows: 1
  ✅ Average daily talk time: 45.2 minutes
  ✅ Engagement rate valid (avg: 72.3%)
  ✅ Attribution rate: 96.8%
  ✅ Call timing: 156 hour/day combinations
  ✅ Geography: 232 area codes

Validation: 10 passed, 0 failed
✅ All validation checks passed

📄 Validation report saved: outputs/pipeline_validation_report.json
   Upload this to dashboard for manual tracker comparison
```

---

## 🎯 NEXT STEP: UPDATE DASHBOARD

Use the **LOVEABLE_PROMPT_V3_COMPLETE.md** file to update your dashboard.

This adds:
- Manual Tracker Validation section
- Call Timing page
- Geography page
- 7 upload fields

---

**Ready to go! Just replace 3 files and run.** 🚀
