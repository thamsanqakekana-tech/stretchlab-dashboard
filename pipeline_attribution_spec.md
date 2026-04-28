# Pipeline Attribution Fix — Accurate Spec for Claude Code
# Based on direct audit of transform.py (V4.0) + Stretchlab_B2C_DB_Phiwe_20260416.xlsx

## What the pipeline already does correctly (DO NOT CHANGE)

1. **Tier 1 attribution** — filters `Booking Made By == 'Phiwe Khasa'` → correct
2. **Tier 2 attribution** — filters `Booking Made By == 'Tamryn Montgomery'` → correct, already included
3. **Deduplication** — keeps latest event per `Booking ID` by `Booking Last Modified Date` → correct
4. **User ID matching** — matches `phiwe_bookings['user_id']` → `first_visits['User ID']` where `Status == 'Complete'` → correct
5. **Name matching fallback** — for rows where User ID match fails → correct
6. **Outcome flags** — `has_show`, `is_cancelled`, `is_no_show`, `is_scheduled` derived from `booking_outcome` → correct
7. **Manual tracker** — used only for `_build_validation()`, NOT as a data source for shows or bookings → correct

The pipeline comment on line 3 says "Direct + Tamryn only (NO phone matching)" — this is intentional and correct.

---

## The one real gap: call log → first_visits phone match (FLAG ONLY)

**What it is:** The call log (`ringcentral_call_log`) contains phone numbers Phiwe dialed. Some people she called may have since completed a first visit — but their booking in ClubReady was logged by a studio flexologist, not by Phiwe, so they don't appear in Tier 1 or Tier 2.

**Audit result:** 6 leads found where:
- Phiwe called their number (in `ringcentral_call_log['To Number']`)
- They have a completed `first_visits` record
- They are NOT in Phiwe's attributed bookings (Tier 1 or Tier 2)

| User ID | Name | Location | First Visit Date | Phone |
|---|---|---|---|---|
| 116997713 | Lisa Liles | Bellaire | 2026-03-25 | (713) 417-5301 |
| 120048240 | Timothy Cooper | Shreveport | 2026-03-21 | (318) 465-3609 |
| 118381181 | Anna Beth Crowson | Shreveport | 2026-04-16 | (318) 518-5329 |
| 111503279 | Quincy Bogany | Bunker Hill | 2026-03-30 | 8322729477 |
| 119144082 | Joseph Minotti | Bunker Hill | 2026-04-08 | 2816879991 |
| 111943835 | Stephanie Ostrowski | Brighton | 2026-03-17 | 7274159353 |

**Note:** Timothy Cooper is also in the manual tracker (Appointments Book, `Paid=Yes`) — highest confidence.

---

## The fix: add one new output file — `phiwe_unattributed_flags.csv`

This is a new output only. It does NOT change any existing pipeline logic, does NOT affect `phiwe_bookings.csv`, and does NOT affect `has_show` or any other metric.

### Implementation in `transform.py`

**Step 1:** Add a phone normalization helper (add near top of file after imports):
```python
def normalize_phone(p):
    """Strip all non-digits, return last 10 digits"""
    import re
    if pd.isna(p):
        return None
    digits = re.sub(r'\D', '', str(p))
    return digits[-10:] if len(digits) >= 10 else None
```

**Step 2:** Add a new method `_build_unattributed_flags(self, calls, bookings, first_visits)` to the `DataTransformer` class:

```python
def _build_unattributed_flags(self, calls, bookings, first_visits):
    """
    Find first_visits completions where:
    - Phiwe called that phone number
    - The lead is NOT already in Phiwe's attributed bookings (Tier 1 + Tier 2)
    
    OUTPUT ONLY — does not affect any booking or show counts.
    For Tamryn to present to Brian at Wednesday meeting.
    """
    import re
    
    def norm_phone(p):
        if pd.isna(p): return None
        d = re.sub(r'\D', '', str(p))
        return d[-10:] if len(d) >= 10 else None
    
    # Phones Phiwe called
    calls['_to_norm'] = calls['to_number'].apply(norm_phone)
    called_numbers = set(calls['_to_norm'].dropna())
    
    # User IDs already attributed to Phiwe
    phiwe_user_ids = set(bookings['user_id'].dropna().astype(int))
    
    # First visits not already attributed
    fv_complete = first_visits[first_visits['Status'] == 'Complete'].copy()
    fv_not_phiwe = fv_complete[~fv_complete['User ID'].isin(phiwe_user_ids)].copy()
    
    # Normalize first_visits phone
    fv_not_phiwe['_cell_norm'] = fv_not_phiwe['Cellphone'].apply(norm_phone)
    
    # Find matches
    flags = fv_not_phiwe[fv_not_phiwe['_cell_norm'].isin(called_numbers)].copy()
    
    if len(flags) == 0:
        return pd.DataFrame()
    
    # Build output
    result = pd.DataFrame({
        'user_id': flags['User ID'],
        'first_name': flags['First Name'],
        'last_name': flags['Last Name'],
        'location': flags['Location Name'],
        'first_visit_date': flags['Booking\nDate'],
        'cellphone': flags['Cellphone'],
        'flag_reason': 'Phiwe called this number; lead completed first visit under different booking attribution',
        'confidence': 'Medium'
    })
    
    # Elevate Timothy Cooper — also in manual tracker
    timothy_mask = (result['first_name'] == 'Timothy') & (result['last_name'] == 'Cooper')
    result.loc[timothy_mask, 'confidence'] = 'High - also in manual tracker (Paid=Yes)'
    
    return result.reset_index(drop=True)
```

**Step 3:** Call it in the main `transform()` method, after bookings transformation:

Find this block in `transform()` (around line 341):
```python
outputs = {}
# ... builds various outputs ...
```

Add after the bookings outputs are built:
```python
# Unattributed flags — for Tamryn/Brian review only
flags_df = self._build_unattributed_flags(
    outputs.get('calls', pd.DataFrame()),
    outputs.get('bookings', pd.DataFrame()),
    self.raw_data.get('first_visits', pd.DataFrame())
)
if len(flags_df) > 0:
    outputs['unattributed_flags'] = flags_df
    logger.info(f"\n  UNATTRIBUTED FLAGS: {len(flags_df)} leads flagged for Brian review")
```

**Step 4:** Add to the saved files list in `run_pipeline.py`:

In `csv_outputs` list, add `'unattributed_flags'` so it saves as `phiwe_unattributed_flags.csv`.

---

## Expected output after implementation

| File | Change |
|---|---|
| `phiwe_bookings.csv` | No change — 47 rows, `has_show` = 6 |
| `phiwe_unattributed_flags.csv` | **New** — 6 rows for Tamryn/Brian review |
| All other CSVs | No change |

---

## What NOT to do

- Do NOT change the Tier 1 or Tier 2 attribution filter — they are already correct
- Do NOT add phone matching to the main booking attribution logic
- Do NOT modify `has_show`, `is_cancelled`, or any other outcome flags
- Do NOT use the manual tracker as a data source for any metric
- Do NOT change the existing `_build_validation()` method

