"""
upload_to_supabase.py
Upload all phiwe_*.csv files from the dashboard public/data directory to Supabase.

Usage:
  python3 upload_to_supabase.py

If tables don't exist yet, run setup_supabase.sql in the Supabase SQL editor first,
then re-run this script.
"""

import os
import math
import pandas as pd
from pathlib import Path
from supabase import create_client, Client

# ─── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL     = "https://txpevcdoyjemswzrmzqa.supabase.co"
SUPABASE_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cGV2Y2RveWplbXN3enJtenFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODQ0NzMsImV4cCI6MjA5Mjg2MDQ3M30.aX2mqMnBiVhAC7UwE-6BdF3bImaHgXP1d90rMi1Gk5I"
DATA_DIR         = Path(__file__).parent / "dashboard/public/data"
SQL_OUTPUT       = Path(__file__).parent / "setup_supabase.sql"
BATCH_SIZE       = 1000

# ─── Type inference for SQL DDL ───────────────────────────────────────────────
def infer_pg_type(series: pd.Series) -> str:
    """Infer Postgres column type from a pandas Series."""
    non_null = series.dropna()
    if non_null.empty:
        return "TEXT"
    # Try boolean
    unique = set(str(v).strip().lower() for v in non_null)
    if unique <= {"true", "false", "1", "0", "yes", "no"}:
        return "BOOLEAN"
    # Use pandas dtype — float64 columns stay NUMERIC, int64 get INTEGER/BIGINT
    if pd.api.types.is_integer_dtype(non_null):
        max_val = non_null.max()
        min_val = non_null.min()
        if min_val >= -2147483648 and max_val <= 2147483647:
            return "INTEGER"
        return "BIGINT"
    if pd.api.types.is_float_dtype(non_null):
        # Only INTEGER if ALL values are whole numbers and within int32 range
        try:
            float_vals = non_null.astype(float)
            if (float_vals == float_vals.round(0)).all():
                max_val = float_vals.max()
                min_val = float_vals.min()
                if min_val >= -2147483648 and max_val <= 2147483647:
                    return "INTEGER"
                return "BIGINT"
        except (ValueError, TypeError):
            pass
        return "NUMERIC"
    # Try numeric parse for object columns
    try:
        float_vals = non_null.astype(float)
        if (float_vals == float_vals.round(0)).all():
            max_val = float_vals.max()
            min_val = float_vals.min()
            if min_val >= -2147483648 and max_val <= 2147483647:
                return "INTEGER"
            return "BIGINT"
        return "NUMERIC"
    except (ValueError, TypeError):
        pass
    return "TEXT"

def generate_create_table(table_name: str, df: pd.DataFrame) -> str:
    """Generate a CREATE TABLE IF NOT EXISTS statement."""
    col_defs = []
    for col in df.columns:
        pg_type = infer_pg_type(df[col])
        safe_col = f'"{col}"'
        col_defs.append(f"  {safe_col} {pg_type}")
    cols_sql = ",\n".join(col_defs)
    return (
        f'CREATE TABLE IF NOT EXISTS "{table_name}" (\n'
        f'  id BIGSERIAL PRIMARY KEY,\n'
        f'{cols_sql}\n'
        f');\n'
        f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY;\n'
        f'CREATE POLICY "Allow anon read" ON "{table_name}" FOR SELECT TO anon USING (true);\n'
        f'CREATE POLICY "Allow anon insert" ON "{table_name}" FOR INSERT TO anon WITH CHECK (true);\n'
        f'CREATE POLICY "Allow anon delete" ON "{table_name}" FOR DELETE TO anon USING (true);\n'
    )

# ─── Data sanitisation ────────────────────────────────────────────────────────
def sanitise_row(row: dict) -> dict:
    """Convert NaN, inf, and other non-JSON-safe values to None.
    Converts float whole-numbers (e.g. 318.0) to int so INTEGER columns accept them.
    """
    clean = {}
    for k, v in row.items():
        if v is None:
            clean[k] = None
        elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            clean[k] = None
        elif str(v).lower() in ("nan", "none", "null", ""):
            clean[k] = None
        elif isinstance(v, float) and v == int(v):
            # e.g. 318.0 → 318 — avoids "invalid input syntax for type integer" errors
            clean[k] = int(v)
        else:
            clean[k] = v
    return clean

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("STRETCHLAB → SUPABASE UPLOAD")
    print("=" * 60)

    # Collect all CSV files
    csv_files = sorted(DATA_DIR.glob("phiwe_*.csv"))
    if not csv_files:
        print(f"ERROR: No phiwe_*.csv files found in {DATA_DIR}")
        return

    print(f"\nFound {len(csv_files)} CSV files in {DATA_DIR.relative_to(Path.cwd())}\n")

    # ── Generate SQL DDL ──────────────────────────────────────────────────────
    sql_blocks = [
        "-- setup_supabase.sql\n"
        "-- Run this in the Supabase SQL editor (https://supabase.com/dashboard/project/txpevcdoyjemswzrmzqa/sql)\n"
        "-- before running upload_to_supabase.py\n\n"
    ]

    dfs = {}
    for csv_path in csv_files:
        table_name = csv_path.stem  # e.g. phiwe_pipeline
        try:
            df = pd.read_csv(csv_path, low_memory=False)
            dfs[table_name] = df
            sql_blocks.append(f"-- {table_name} ({len(df)} rows)\n")
            sql_blocks.append(generate_create_table(table_name, df))
            sql_blocks.append("\n")
        except Exception as e:
            print(f"  WARNING: Could not read {csv_path.name}: {e}")

    sql_content = "\n".join(sql_blocks)
    SQL_OUTPUT.write_text(sql_content)
    print(f"✓ Generated {SQL_OUTPUT.name} ({len(dfs)} tables)\n")

    # ── Connect to Supabase ───────────────────────────────────────────────────
    print("Connecting to Supabase...")
    try:
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"✓ Connected to {SUPABASE_URL}\n")
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return

    # ── Upload each table ─────────────────────────────────────────────────────
    uploaded = []
    failed   = []

    for table_name, df in dfs.items():
        print(f"  Uploading {table_name}...", end="", flush=True)

        # Step 1: Delete existing rows
        try:
            client.table(table_name).delete().neq("id", 0).execute()
        except Exception:
            pass  # Table might be empty or not exist yet

        # Step 2: Convert df to sanitised row dicts
        rows = [sanitise_row(r) for r in df.to_dict(orient="records")]

        # Step 3: Batch insert
        total    = len(rows)
        n_batches = math.ceil(total / BATCH_SIZE)
        success  = True

        for i in range(n_batches):
            batch = rows[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
            try:
                resp = client.table(table_name).insert(batch).execute()
                if hasattr(resp, "error") and resp.error:
                    raise Exception(str(resp.error))
            except Exception as e:
                err_str = str(e)
                print(f" ✗")
                # Provide targeted guidance
                if "does not exist" in err_str or "relation" in err_str:
                    print(f"    → Table not found. Run setup_supabase.sql in the Supabase SQL editor first.")
                elif "policy" in err_str.lower() or "permission" in err_str.lower() or "violates" in err_str.lower():
                    print(f"    → RLS policy error. The SQL file creates the required policies — run it first.")
                elif "JWT" in err_str or "auth" in err_str.lower():
                    print(f"    → Auth error: {err_str}")
                else:
                    print(f"    → {err_str[:120]}")
                failed.append(table_name)
                success = False
                break

        if success:
            print(f" ✓ ({total} rows)")
            uploaded.append(table_name)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"SUMMARY: {len(uploaded)} uploaded, {len(failed)} failed")
    print("=" * 60)

    if uploaded:
        print(f"\n✓ Uploaded ({len(uploaded)}):")
        for t in uploaded:
            print(f"   {t}")

    if failed:
        print(f"\n✗ Failed ({len(failed)}):")
        for t in failed:
            print(f"   {t}")
        print(f"\nNEXT STEP:")
        print(f"  1. Open https://supabase.com/dashboard/project/txpevcdoyjemswzrmzqa/sql")
        print(f"  2. Paste contents of setup_supabase.sql and click Run")
        print(f"  3. Re-run: python3 upload_to_supabase.py")

    print()

if __name__ == "__main__":
    main()
