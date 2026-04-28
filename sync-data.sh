#!/bin/bash
echo "Syncing pipeline outputs to dashboard..."
mkdir -p dashboard/public/data

# Find the source: prefer the most-recently modified dated subfolder,
# fall back to outputs/ root if no subfolders exist.
LATEST_DIR=$(find outputs -mindepth 1 -maxdepth 1 -type d | sort | tail -1)

if [ -n "$LATEST_DIR" ]; then
  SRC="$LATEST_DIR"
  echo "Source: $SRC"
else
  SRC="outputs"
  echo "Source: outputs/ (no dated subfolders found)"
fi

cp "$SRC"/*.csv dashboard/public/data/ 2>/dev/null && echo "CSVs synced" || echo "No CSVs in $SRC"
cp "$SRC"/*.json dashboard/public/data/ 2>/dev/null && echo "JSONs synced" || echo "No JSONs in $SRC"
echo "Done. Refresh dashboard to see updated data."
