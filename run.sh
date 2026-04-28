#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# StretchLab B2C — Daily Pipeline Runner
#
# Usage:
#   ./run.sh                          # auto-detects latest workbook, uses its date
#   ./run.sh 2026-04-16               # uses that date (workbook must exist in raw/)
#   ./run.sh 2026-04-16 my_workbook.xlsx  # explicit workbook filename in raw/
#
# Outputs 20 files to: outputs/YYYY-MM-DD/
# ──────────────────────────────────────────────────────────────────────────────

set -e   # exit on any error

cd "$(dirname "$0")"   # always run from project root regardless of where called from

RAW_DIR="data/stretchlab/raw"
TRACKER="data/stretchlab/validation/Stretch_Lab_Manual_Tracker.xlsx"

# ── Activate virtual environment ─────────────────────────────────────────────
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# ── Resolve workbook and date ─────────────────────────────────────────────────
if [ -n "$2" ]; then
    # Explicit filename provided (just the filename, not full path)
    WORKBOOK="$RAW_DIR/$2"
    DATE="${1:-$(basename "$WORKBOOK" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')}"
elif [ -n "$1" ]; then
    # Date arg provided — find matching workbook
    DATE="$1"
    WORKBOOK=$(ls "$RAW_DIR"/*"$DATE"*.xlsx 2>/dev/null | head -1)
    if [ -z "$WORKBOOK" ]; then
        echo "❌ No workbook found in $RAW_DIR/ containing date $DATE"
        echo "   Available workbooks:"
        ls "$RAW_DIR"/*.xlsx 2>/dev/null || echo "   (none)"
        exit 1
    fi
else
    # Auto-detect: pick the most recently dated workbook
    WORKBOOK=$(ls "$RAW_DIR"/*.xlsx 2>/dev/null | sort | tail -1)
    if [ -z "$WORKBOOK" ]; then
        echo "❌ No workbooks found in $RAW_DIR/"
        exit 1
    fi
    DATE=$(basename "$WORKBOOK" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
fi

OUTPUT_DIR="outputs/$DATE"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  STRETCHLAB B2C — DAILY PIPELINE                                     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Workbook : $WORKBOOK"
echo "  Tracker  : $TRACKER"
echo "  Output   : $OUTPUT_DIR"
echo "  Date     : $DATE"
echo ""

# ── Step 1: Base pipeline (14 CSVs + 2 JSONs) ────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1 / 3  —  Base pipeline  (extract → transform → 14 outputs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "$TRACKER" ]; then
    python run_pipeline.py "$WORKBOOK" "$TRACKER" "$OUTPUT_DIR"
else
    echo "⚠  Manual tracker not found at $TRACKER — running without it"
    python run_pipeline.py "$WORKBOOK" "" "$OUTPUT_DIR"
fi

# ── Step 2: Enhancement pipeline (6 more CSVs → 20 total) ───────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2 / 3  —  Enhancement pipeline  (analytics → +6 outputs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

python enhance_pipeline.py "$DATE"

# ── Step 3: AI Insights (Groq → 1 JSON) ─────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3 / 3  —  AI insights  (Groq → phiwe_insights.json)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

python generate_insights.py "$DATE"

# ── Write latest.json pointer ─────────────────────────────────────────────────
python -c "import json; f='outputs/latest.json'; json.dump({'folder':'$DATE'}, open(f,'w')); print(f'  ✓  {f}')"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  ✅  ALL 21 OUTPUTS READY                                            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Location: $(pwd)/$OUTPUT_DIR/"
echo ""
echo "  BASE (14)"
echo "    phiwe_calls.csv                 phiwe_by_area_code.csv"
echo "    phiwe_bookings.csv              phiwe_pipeline.csv"
echo "    phiwe_daily_performance.csv     phiwe_call_timing.csv"
echo "    phiwe_by_studio.csv             phiwe_lead_funnel.csv"
echo "    phiwe_cancellation_analysis.csv phiwe_booking_outcomes.csv"
echo "    phiwe_booking_window_analysis.csv"
echo "    phiwe_day_of_week_performance.csv"
echo "    validation_report.json          root_cause_analysis.json"
echo ""
echo "  ENHANCED (6)"
echo "    phiwe_benchmarks_comparison.csv phiwe_revenue_intelligence.csv"
echo "    phiwe_forecast_30_day.csv       phiwe_campaign_health.csv"
echo "    phiwe_cohort_analysis.csv       phiwe_call_timing_optimized.csv"
echo ""
echo "  AI INSIGHTS (1)"
echo "    phiwe_insights.json"
echo ""
