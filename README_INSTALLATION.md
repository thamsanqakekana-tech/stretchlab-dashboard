# V5.0 ENHANCED PIPELINE - INSTALLATION GUIDE

## 📦 FILES CREATED

✅ **benchmarks.py** (226 lines) - Industry standards
✅ **analytics.py** (393 lines) - Revenue, forecasting, health scoring  
⏳ **enhance_pipeline.py** (Creating next) - Wrapper to add new outputs

## 🚀 INSTALLATION STEPS

### Step 1: Copy Files to Your Project

```bash
cd /home/thamsanqakekana/Documents/stretchlab_pipeline/

# Download the 3 files from Claude and copy them here
# benchmarks.py
# analytics.py  
# enhance_pipeline.py
```

### Step 2: Run Enhanced Pipeline

You have 2 options:

**OPTION A: Keep existing pipeline, run enhancement separately**
```bash
# Run your existing pipeline first (generates the 14 base CSVs)
python transform_clean.py

# Then run enhancement (adds 6 new CSVs)
python enhance_pipeline.py
```

**OPTION B: Single command (I'll create a wrapper script)**
```bash
# Runs everything in one go
./run_enhanced.sh 2026-04-08
```

### Step 3: Verify Output

Check that these 6 NEW files were created:
```bash
ls -lh phiwe_benchmarks_comparison.csv
ls -lh phiwe_revenue_intelligence.csv
ls -lh phiwe_forecast_30_day.csv
ls -lh phiwe_campaign_health.csv
ls -lh phiwe_cohort_analysis.csv
ls -lh phiwe_call_timing_optimized.csv
```

### Step 4: Upload to Loveable

Upload ALL CSV files (existing 14 + new 6 = 20 total files) to Loveable.

---

## 📊 WHAT GETS CALCULATED

### phiwe_benchmarks_comparison.csv
```csv
metric,actual_value,actual_pct,benchmark_level,benchmark_pct,rank,gap_pct,status,icon
conversion_rate,0.0090,0.9%,average,1.2%,Below Average,-0.3%,poor,❌
show_rate,0.1190,11.9%,average,17.5%,Below Average,-5.6%,poor,❌
no_show_rate,0.0000,0.0%,excellent,2.0%,Top 10%,+2.0%,excellent,✅✅✅
engagement_rate,0.9100,91.0%,excellent,85.0%,Top 10%,+6.0%,excellent,✅✅✅
cancel_rate,0.1429,14.3%,average,12.5%,Average,+1.9%,average,⚠️
```

### phiwe_revenue_intelligence.csv
```csv
metric,value
total_bookings,42
total_shows,5
total_calls,4661
total_cost,3500
cost_per_booking,83.33
cost_per_show,700.00
ltv_conservative,1614
ltv_average,3228
ltv_optimistic,6456
revenue_conservative,8070
revenue_average,16140
revenue_optimistic,32280
roi_conservative,2.31
roi_average,4.61
roi_optimistic,9.22
cac_actual,700.00
cac_target,45
cac_gap,655.00
shows_needed_for_target,77.8
conversion_rate,0.0090
show_rate,0.1190
```

### phiwe_forecast_30_day.csv
```csv
scenario,probability,bookings,shows,revenue_conservative,revenue_average,confidence,drivers
pessimistic,0.25,38,4,6456,12912,medium,High-risk pipeline cancels...
likely,0.50,45,9,14526,29052,high,Current trends continue...
optimistic,0.25,62,15,24210,48420,medium,All improvements executed...
```

### phiwe_campaign_health.csv
```csv
metric,value
total_score,67
max_score,100
level,YELLOW
churn_risk,MEDIUM
churn_risk_pct,0.35
performance_score,45
performance_max,50
engagement_score,12
engagement_max,25
goal_alignment_score,10
goal_alignment_max,25
roi_pct,461
bookings,42
show_rate_pct,11.9
```

### phiwe_cohort_analysis.csv
```csv
cohort,total_bookings,shows,cancellations,no_shows,show_rate,cancel_rate,no_show_rate,insight
Fast (0-3 days),12,3,4,0,0.25,0.33,0.00,Impulsive bookers - higher cancel risk
Quick (3-7 days),8,2,1,0,0.25,0.13,0.00,Quick decision - moderate risk
Optimal (7-14 days),15,10,1,0,0.67,0.07,0.00,Trust built - lower cancel risk
Slow (14-30 days),5,0,0,0,0.00,0.00,0.00,Too far out - commitment fades
Very Slow (30+ days),2,0,0,0,0.00,0.00,0.00,Too far out - commitment fades
```

### phiwe_call_timing_optimized.csv
```csv
day_of_week,hour,engagement_rate,total_calls,category
Tuesday,10,0.23,150,Golden Hours
Wednesday,9,0.21,145,Golden Hours
Monday,14,0.14,120,Average
Friday,16,0.06,95,Avoid
```

---

## 🎯 NEXT: LOVEABLE PROMPT

Once you have all the CSV files, use the enhanced Loveable prompt (provided separately) to build the dashboard with:

1. ✅ Industry benchmarks on every card
2. ✅ Revenue intelligence card
3. ✅ 30-day forecast card  
4. ✅ Campaign health card
5. ✅ Cohort analysis card
6. ✅ All fixes (date filter, tooltips, chart contrast, etc.)

