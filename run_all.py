#!/usr/bin/env python3
"""
run_all.py — Full StretchLab B2C pipeline in one command.

Steps:
  1. Core pipeline  (run_pipeline.py)       — transform + extract all CSVs/JSON
  2. Enhance        (enhance_pipeline.py)   — benchmarks, health, forecast, cohorts
  3. AI insights    (generate_insights.py)  — Groq narrative (non-fatal if unavailable)
  4. Copy to dashboard/public/data/         — makes files available to npm build
  5. Sync Supabase  (upload_to_supabase.py) — keeps DB current (non-fatal if unreachable)

Usage:
  python run_all.py <workbook_path> [manual_tracker_path] [output_dir]

Example:
  python run_all.py "data/stretchlab/raw/Stretchlab_B2C_DB_Phiwe_2026-05-07.xlsx" \\
                    "data/stretchlab/validation/Stretch_Lab_Manual_Tracker.xlsx" \\
                    "outputs"

After this script completes:
  cd dashboard && npm run build && git add -p && git push
"""
import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

DASHBOARD_DATA = Path(__file__).parent / "dashboard" / "public" / "data"


def run(cmd, check=True, label=""):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"  {' '.join(str(c) for c in cmd)}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, check=check)
    if result.returncode != 0 and not check:
        print(f"  ⚠️  Non-zero exit ({result.returncode}) — continuing")
    return result


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    workbook = sys.argv[1]
    tracker  = sys.argv[2] if len(sys.argv) > 2 else None
    output   = sys.argv[3] if len(sys.argv) > 3 else "outputs"
    date_str = str(date.today())
    dated_dir = Path(output) / date_str

    print(f"\n🚀  StretchLab full pipeline — {date_str}")

    # Step 1 — Core pipeline
    args = [sys.executable, "run_pipeline.py", workbook]
    if tracker:
        args.append(tracker)
    args.append(output)
    run(args, check=True, label="[1/5] Core pipeline")

    # Step 2 — Enhance pipeline
    run([sys.executable, "enhance_pipeline.py", date_str], check=True, label="[2/5] Enhance pipeline")

    # Step 3 — AI insights (non-fatal: Groq may be unavailable)
    run([sys.executable, "generate_insights.py", date_str], check=False, label="[3/5] Generate insights")

    # Step 4 — Copy all outputs to dashboard/public/data/
    print(f"\n{'='*60}")
    print(f"  [4/5] Copy to {DASHBOARD_DATA}")
    print(f"{'='*60}")
    DASHBOARD_DATA.mkdir(parents=True, exist_ok=True)
    copied = 0
    for f in dated_dir.iterdir():
        if f.is_file():
            shutil.copy2(f, DASHBOARD_DATA / f.name)
            copied += 1
    with open(DASHBOARD_DATA / "latest.json", "w") as fp:
        json.dump({"folder": date_str}, fp)
    print(f"  ✅  {copied} files → {DASHBOARD_DATA}")
    print(f"  ✅  latest.json → {date_str}")

    # Step 5 — Sync to Supabase (non-fatal: network may be unavailable)
    run([sys.executable, "upload_to_supabase.py"], check=False, label="[5/5] Sync Supabase")

    print(f"\n{'='*60}")
    print(f"  ✅  ALL DONE — {date_str}")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"  cd dashboard && npm run build")
    print(f"  git add dashboard/public/data/ dashboard/dist/  # or just public/data/")
    print(f"  git commit -m 'Pipeline run {date_str}'")
    print(f"  git push")
    print()


if __name__ == "__main__":
    main()
