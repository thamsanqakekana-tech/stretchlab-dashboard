"""
StretchLab B2C Pipeline - Main Runner (V4.0 FINAL)
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from extract import DataExtractor
from transform import DataTransformer


def run_pipeline(workbook_path, manual_tracker_path=None, output_dir='outputs'):
    """Run complete pipeline"""
    
    print("="*80)
    print("STRETCHLAB B2C PIPELINE V4.1 - WITH DASHBOARD OUTPUTS")
    print("="*80)
    print(f"Started: {datetime.now()}")
    print(f"Workbook: {workbook_path}")
    print(f"Manual Tracker: {manual_tracker_path or 'Not provided'}")
    print(f"Output Directory: {output_dir}")
    print("="*80)
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Step 1: Extract
    print("\n🔄 STEP 1: EXTRACTING DATA...")
    extractor = DataExtractor(workbook_path)
    raw_data = extractor.extract()
    
    # Step 2: Transform
    print("\n🔄 STEP 2: TRANSFORMING DATA...")
    transformer = DataTransformer(raw_data)
    outputs = transformer.transform(manual_tracker_path=manual_tracker_path)
    
    # Step 3: Save outputs
    print("\n🔄 STEP 3: SAVING OUTPUTS...")
    
    saved_files = []
    
    # Save CSV outputs
    csv_outputs = [
        'calls', 'bookings', 'daily_performance', 'by_studio', 'by_area_code',
        'pipeline', 'call_timing', 'lead_funnel', 'unified_leads', 'cancellation_analysis',
        'booking_outcomes', 'booking_window_analysis', 'day_of_week_performance',
        'validation_lead_details', 'cohort_analysis',
        # V4.1 new outputs
        'conversion_trends', 'loyalsnap_engagement', 'flexologist_performance',
        'ramp_vs_target', 'velocity_trend',
        # Attribution flags — output only, does not affect any existing metrics
        'unattributed_flags',
    ]
    
    for name in csv_outputs:
        if name in outputs and len(outputs[name]) > 0:
            filename = f'phiwe_{name}.csv'
            filepath = output_path / filename
            outputs[name].to_csv(filepath, index=False)
            saved_files.append(filename)
            print(f"  ✅ {filename} ({len(outputs[name])} rows)")
    
    # Save JSON outputs
    json_outputs = ['root_cause_analysis', 'validation_report']
    
    for name in json_outputs:
        if name in outputs:
            filename = f'{name}.json'
            filepath = output_path / filename
            with open(filepath, 'w') as f:
                json.dump(outputs[name], f, indent=2, default=str)
            saved_files.append(filename)
            print(f"  ✅ {filename}")
    
    # Step 4: Write latest.json pointer so dashboard can resolve output folder
    from datetime import date
    import shutil
    latest_path = output_path / 'latest.json'
    with open(latest_path, 'w') as f:
        json.dump({'folder': str(date.today())}, f)
    print(f"  ✅ latest.json → {date.today()}")

    # Step 5: Copy all outputs to dated subfolder for historical reference
    dated_path = output_path / str(date.today())
    dated_path.mkdir(exist_ok=True)
    for file in output_path.iterdir():
        if file.is_file() and file.name != 'latest.json':
            shutil.copy2(file, dated_path / file.name)
    print(f"  ✅ Outputs copied to {dated_path}")

    # Summary
    print("\n" + "="*80)
    print("✅ PIPELINE COMPLETE")
    print("="*80)
    print(f"Completed: {datetime.now()}")
    print(f"Total outputs: {len(saved_files)} files")
    print(f"Location: {output_path.absolute()}")
    print("="*80)
    
    return saved_files


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python run_pipeline.py <workbook_path> [manual_tracker_path] [output_dir]")
        print("\nExample:")
        print("  python run_pipeline.py data/Stretchlab_B2C_DB_Phiwe_20260408.xlsx")
        print("  python run_pipeline.py data/Stretchlab_B2C_DB_Phiwe_20260408.xlsx data/Stretch_Lab_Manual_Tracker.xlsx")
        sys.exit(1)
    
    workbook = sys.argv[1]
    manual = sys.argv[2] if len(sys.argv) > 2 else None
    output = sys.argv[3] if len(sys.argv) > 3 else 'outputs'
    
    run_pipeline(workbook, manual, output)
