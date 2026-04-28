# StretchLab B2C Pipeline - Complete Package

## 📦 What's Included

This package contains the complete, production-ready pipeline for StretchLab B2C data analysis.

### Files:
1. **extract.py** - Extracts data from Excel workbook
2. **transform.py** - Transforms and analyzes data (NO phone matching)
3. **run_pipeline.py** - Main runner script
4. **README.md** - This file
5. **requirements.txt** - Python dependencies

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install pandas openpyxl numpy
```

### 2. Run Pipeline
```bash
python run_pipeline.py <workbook_path> <manual_tracker_path> <output_dir>
```

### Example:
```bash
python run_pipeline.py \
  data/Stretchlab_B2C_DB_Phiwe_20260408.xlsx \
  data/Stretch_Lab_Manual_Tracker.xlsx \
  outputs
```

## 📊 Outputs

The pipeline generates **15 files**:

### Core (8):
1. phiwe_calls.csv
2. phiwe_bookings.csv (41 bookings - Direct + Tamryn only)
3. phiwe_daily_performance.csv
4. phiwe_by_studio.csv (all 9 studios)
5. phiwe_by_area_code.csv (geographic performance)
6. phiwe_pipeline.csv (future bookings)
7. phiwe_call_timing.csv
8. phiwe_lead_funnel.csv

### Evan's Answers (5):
9. phiwe_cancellation_analysis.csv
10. phiwe_booking_outcomes.csv
11. phiwe_booking_window_analysis.csv
12. phiwe_day_of_week_performance.csv
13. root_cause_analysis.json

### Validation (2):
14. validation_report.json
15. phiwe_validation_lead_details.csv

## ✅ Validation Check

After running, check validation_report.json:
- System should have ~41 bookings
- Manual should have ~46 bookings
- Manual should have MORE (gap of ~5)
- Status should be "expected"

## 🎯 Key Features

### Attribution Logic:
- ✅ Direct: Phiwe logged it
- ✅ Tamryn Override: Tamryn logged it
- ❌ NO phone matching (prevents inflation)

### Deduplication:
- Keeps LATEST event per Booking ID
- Handles multiple events (New → Cancelled → No-Show)

### All 9 Studios Included:
Even if studio has 0 bookings, it appears in phiwe_by_studio.csv

### Geographic Analysis:
- Area code extraction
- Mapping to regions (Louisiana, Texas-Houston, Texas-Other, Michigan)

## 🔄 Daily Usage

### Recommended Workflow:

1. **Download latest data** from ClubReady/RingCentral
2. **Save as:** Stretchlab_B2C_DB_Phiwe_YYYYMMDD.xlsx
3. **Run pipeline:**
   ```bash
   python run_pipeline.py \
     data/Stretchlab_B2C_DB_Phiwe_20260409.xlsx \
     data/Stretch_Lab_Manual_Tracker.xlsx \
     outputs/2026-04-09
   ```
4. **Check validation** - Manual should have ≥ System bookings
5. **Upload outputs** to dashboard

## 📁 Recommended Folder Structure

```
stretchlab_pipeline/
├── extract.py
├── transform.py
├── run_pipeline.py
├── requirements.txt
├── README.md
├── data/
│   ├── Stretchlab_B2C_DB_Phiwe_20260408.xlsx
│   ├── Stretchlab_B2C_DB_Phiwe_20260409.xlsx
│   └── Stretch_Lab_Manual_Tracker.xlsx
└── outputs/
    ├── 2026-04-08/
    │   ├── phiwe_calls.csv
    │   ├── phiwe_bookings.csv
    │   └── ... (13 more files)
    └── 2026-04-09/
        └── ... (15 files)
```

## ⚠️ Important Notes

### Manual Tracker:
- Used for VALIDATION only (not merged into system data)
- Manual should ALWAYS have ≥ System bookings
- Gap = bookings Phiwe influenced but not attributed

### Attribution:
- NO phone matching (this was causing inflation)
- Only Direct (Phiwe logged) + Tamryn Override

### Studios:
- All 9 studios always included
- Brighton and South Tulsa may have 0 bookings (normal)

## 🐛 Troubleshooting

### Issue: "FileNotFoundError"
**Solution:** Check file paths are correct, use absolute paths if needed

### Issue: "Module not found"
**Solution:** Install dependencies: `pip install pandas openpyxl numpy`

### Issue: "System has MORE bookings than Manual"
**Solution:** This is wrong! Manual should have more. Check data files.

### Issue: "Validation shows large drift"
**Solution:** Expected drift is -10% to -20% (manual has more)

## 📞 Support

For issues or questions:
- Check validation_report.json first
- Review PIPELINE_SUCCESS_SUMMARY.md
- Verify input file format matches expected structure

## 🎯 Next Steps

After running pipeline:
1. Verify validation report (manual ≥ system)
2. Check all 15 files generated
3. Upload to dashboard
4. Review gap bookings in phiwe_validation_lead_details.csv

---

**Version:** 4.0 FINAL  
**Last Updated:** April 9, 2026  
**Status:** Production Ready ✅
