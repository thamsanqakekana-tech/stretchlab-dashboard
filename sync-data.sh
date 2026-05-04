#!/bin/bash
echo "Syncing pipeline outputs to dashboard..."
mkdir -p dashboard/public/data

# Resolve source: prefer latest.json pointer (written by run.sh after every full run),
# fall back to most-recent dated subfolder, then outputs/ root.
LATEST_JSON="outputs/latest.json"

if [ -f "$LATEST_JSON" ]; then
  FOLDER=$(python3 -c "import json; print(json.load(open('$LATEST_JSON'))['folder'])" 2>/dev/null)
  if [ -n "$FOLDER" ] && [ -d "outputs/$FOLDER" ]; then
    SRC="outputs/$FOLDER"
    echo "Source: $SRC  (from latest.json)"
  fi
fi

if [ -z "$SRC" ]; then
  LATEST_DIR=$(find outputs -mindepth 1 -maxdepth 1 -type d | sort | tail -1)
  if [ -n "$LATEST_DIR" ]; then
    SRC="$LATEST_DIR"
    echo "Source: $SRC  (latest dated folder)"
  else
    SRC="outputs"
    echo "Source: outputs/ (no dated subfolders found)"
  fi
fi

cp "$SRC"/*.csv dashboard/public/data/ 2>/dev/null && echo "CSVs synced" || echo "No CSVs in $SRC"
cp "$SRC"/*.json dashboard/public/data/ 2>/dev/null && echo "JSONs synced" || echo "No JSONs in $SRC"
echo "Done. Refresh dashboard to see updated data."
