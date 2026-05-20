"""
clubready_extract.py  (v2.0 — multi-studio)
Downloads Booking Events Log and First Visits from all ClubReady studios
and merges them into a single pipeline-ready workbook.

Also copies ringcentral_call_log and loyalsnap sheets from the most recent
manual workbook so the output is fully pipeline-compatible.

Output: data/stretchlab/raw/Stretchlab_B2C_DB_ClubReady_YYYY-MM-DD.xlsx
  booking_events_log  — Detail tab, all studios combined
  first_visits        — Report Data tab, all studios combined
  ringcentral_call_log — from latest manual workbook (carried forward)
  loyalsnap            — from latest manual workbook (carried forward)

Previous Stretchlab_B2C_DB_ClubReady_*.xlsx exports are deleted on each run.

Date range: always 2/24/2026 → yesterday (date.today() - 1 day).

Usage:
  python3 clubready_extract.py                     # end = yesterday
  python3 clubready_extract.py --date 2026-05-20   # explicit as-of date
  python3 clubready_extract.py --start 2/24/2026 --end 5/19/2026
"""

import os, re, random, argparse, tempfile
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode

import pandas as pd
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────
CLUBREADY_USER = os.environ["CLUBREADY_USER"]
CLUBREADY_PASS = os.environ["CLUBREADY_PASS"]

LOGIN_URL      = "https://stretchlab.clubready.com/Security/Login"
APP_BASE       = "https://app.clubready.com"
CAMPAIGN_START = "2/24/2026"
RAW_DIR        = Path(__file__).parent / "data/stretchlab/raw"

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/148.0.0.0 Safari/537.36"
)

# ─── Report definitions ───────────────────────────────────────────────────────
# tab: the Excel sheet name to read from the downloaded XLS file
# header=1 in all ClubReady exports: row 0 is a title row, row 1 is column headers
REPORTS = [
    {
        "key":          "booking_events_log",
        "tab":          "Detail",
        "reportId":     114,
        "reportFolder": "/RV.CreditsBookings/",
        "reportName":   "Booking Events Log",
        "extra_params": [
            {"name": "EventType",             "value": "null"},
            {"name": "ClassSessionServiceId", "value": "null"},
            {"name": "LocationType",          "value": "null"},
            {"name": "ExportAs",              "value": "Excel"},
            {"name": "ReportUserId",          "value": "1"},
        ],
    },
    {
        "key":          "first_visits",
        "tab":          "Report Data",
        "reportId":     228,
        "reportFolder": "/RV.CreditsBookings/",
        "reportName":   "First Visits",
        "extra_params": [
            {"name": "NonMembersOnly",   "value": "0"},
            {"name": "IncludeNotLogged", "value": "true"},
            {"name": "ExportAs",         "value": "Excel"},
            {"name": "ReportUserId",     "value": "1"},
        ],
    },
]


# ─── Auth ─────────────────────────────────────────────────────────────────────
def _new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": _UA, "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8"})
    return s


def _login() -> tuple[requests.Session, list[dict]]:
    """
    Login and return (session, studios).
    Studios: [{"name": str, "golocation_url": str}]
    Tokens are session-specific — always fetched fresh, never hardcoded.
    """
    session = _new_session()
    r = session.post(
        LOGIN_URL,
        data={"uid": CLUBREADY_USER, "pw": CLUBREADY_PASS,
              "Submit": "Login", "inst": "1", "chainId": "640"},
        allow_redirects=True, timeout=30,
    )
    r.raise_for_status()
    if "selectlogin" not in r.url.lower():
        raise RuntimeError(f"Unexpected post-login URL: {r.url!r}")
    studios = _parse_studios(r.text)
    if not studios:
        raise RuntimeError("No studios found on selectlogin page")
    return session, studios


def _parse_studios(html: str) -> list[dict]:
    """Parse all studio {name, golocation_url} pairs from the selectlogin HTML."""
    soup = BeautifulSoup(html, "html.parser")

    select_el = soup.find("select", {"name": "stores"}) or soup.find("select")
    if not select_el:
        return []

    # Scan inline JS for pre-built GoLocation URLs (token → full URL)
    js_map: dict[str, str] = {}
    for script in soup.find_all("script"):
        for m in re.finditer(
            r'(https?://[\w.-]+clubready\.com/Security/GoLocation/([A-F0-9]{30,}))',
            script.string or "", re.IGNORECASE,
        ):
            js_map[m.group(2).upper()] = m.group(1)

    studios = []
    for opt in select_el.find_all("option"):
        val  = opt.get("value", "").strip()
        name = opt.get_text(strip=True)
        if not val or not name:
            continue

        # Priority 1: option value is already a full URL
        if val.lower().startswith("http"):
            studios.append({"name": name, "golocation_url": val})

        # Priority 2: token matched in page JS
        elif val.upper() in js_map:
            studios.append({"name": name, "golocation_url": js_map[val.upper()]})

        # Priority 3: data attribute on the <option>
        elif opt.get("data-url") or opt.get("data-base"):
            base = opt.get("data-url") or opt.get("data-base")
            studios.append({"name": name, "golocation_url": f"{base.rstrip('/')}/Security/GoLocation/{val}"})

        # Fallback: construct subdomain from studio name (e.g. "Bunker Hill" → StretchLabBunkerHill)
        else:
            slug = re.sub(r"[^A-Za-z0-9]", "", name)
            studios.append({
                "name":          name,
                "golocation_url": f"https://StretchLab{slug}.clubready.com/Security/GoLocation/{val}",
            })

    return studios


def _switch_studio(session: requests.Session, studio: dict) -> bool:
    """Navigate session to a specific studio via GoLocation. Returns True on success."""
    try:
        r = session.get(studio["golocation_url"], allow_redirects=True, timeout=30)
        r.raise_for_status()
        if "app.clubready.com" in r.url:
            return True
        print(f"      GoLocation landed on unexpected URL: {r.url}")
        return False
    except Exception as e:
        print(f"      GoLocation error: {e}")
        return False


# ─── Report download ──────────────────────────────────────────────────────────
def _download_report_bytes(session: requests.Session, report: dict,
                            start_date: str, end_date: str) -> bytes | None:
    """Run a ClubReady report and return raw XLS bytes, or None on failure."""
    report_id = report["reportId"]

    # Step 1: Prime session state
    session.get(
        f"{APP_BASE}/Reporting/ReportViewer/ReportParams"
        f"?rm={random.randint(10000,99999)}&reportId={report_id}",
        headers={"Referer": f"{APP_BASE}/Reporting/ReportViewer",
                 "X-Requested-With": "XMLHttpRequest"},
        timeout=30,
    )

    # Step 2: POST RunReport
    form_params = [
        {"name": "fromdate", "value": start_date},
        {"name": "todate",   "value": end_date},
    ] + report["extra_params"]

    post_fields = {
        "reportId":     str(report_id),
        "reportFolder": report["reportFolder"],
        "reportName":   report["reportName"],
        "reportTabId":  "0",
        "reportDraft":  "false",
    }
    for i, p in enumerate(form_params):
        post_fields[f"reportParams[{i}][name]"]  = p["name"]
        post_fields[f"reportParams[{i}][value]"] = p["value"]

    r = session.post(
        f"{APP_BASE}/Reporting/ReportViewer/RunReport?rm={random.randint(100000,999999)}",
        data=urlencode(post_fields),
        headers={
            "Content-Type":     "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer":          f"{APP_BASE}/Reporting/ReportViewer",
            "Accept":           "text/html, */*; q=0.01",
        },
        timeout=60,
    )
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    iframe = soup.find("iframe")
    if not iframe or not iframe.get("src"):
        return None

    # Step 3: GET iframe URL → XLS file
    r2 = session.get(iframe["src"], timeout=120)
    r2.raise_for_status()

    ct = r2.headers.get("content-type", "")
    if not ("excel" in ct or "spreadsheet" in ct or "octet" in ct):
        return None

    return r2.content


def _read_tab(xls_bytes: bytes, tab: str) -> pd.DataFrame | None:
    """
    Read a named tab from XLS bytes.
    ClubReady exports: row 0 = title row (skipped), row 1 = column headers.
    """
    tmp = Path(tempfile.mktemp(suffix=".xls"))
    try:
        tmp.write_bytes(xls_bytes)
        df = pd.read_excel(tmp, sheet_name=tab, header=1, engine="xlrd")
        df.columns = df.columns.str.replace("\n", " ", regex=False)
        df = df.dropna(how="all")
        return df
    except Exception as e:
        print(f"      Tab '{tab}' read error: {e}")
        return None
    finally:
        tmp.unlink(missing_ok=True)


# ─── Legacy sheet carry-forward ───────────────────────────────────────────────
def _carry_forward_sheets(writer: pd.ExcelWriter) -> None:
    """
    Copy ringcentral_call_log + loyalsnap from the most recent manual workbook
    so the combined output is fully pipeline-compatible (all 4 sheets present).
    """
    candidates = sorted(RAW_DIR.glob("Stretchlab_B2C_DB_Phiwe_*.xlsx"), reverse=True)
    if not candidates:
        print("  ⚠  No manual workbook found — ringcentral_call_log and loyalsnap omitted")
        return

    src = candidates[0]
    print(f"  Carrying forward from {src.name}:")
    for sheet in ("ringcentral_call_log", "loyalsnap"):
        try:
            df = pd.read_excel(src, sheet_name=sheet)
            df.to_excel(writer, sheet_name=sheet, index=False)
            print(f"    ✓ {sheet} ({len(df):,} rows)")
        except Exception as e:
            print(f"    ✗ {sheet}: {e}")


# ─── Main ─────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date",  default=None,
                        help="As-of date YYYY-MM-DD (default: today)")
    parser.add_argument("--start", default=CAMPAIGN_START,
                        help="Start date M/D/YYYY (default: 2/24/2026)")
    parser.add_argument("--end",   default=None,
                        help="End date M/D/YYYY (default: yesterday)")
    args = parser.parse_args()

    as_of      = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else date.today()
    yesterday  = as_of - timedelta(days=1)
    start_date = args.start
    end_date   = args.end or yesterday.strftime("%-m/%-d/%Y")

    out_path = RAW_DIR / f"Stretchlab_B2C_DB_ClubReady_{as_of}.xlsx"

    print("=" * 60)
    print("CLUBREADY MULTI-STUDIO EXTRACT")
    print("=" * 60)
    print(f"  Date range : {start_date} → {end_date}")
    print(f"  Output     : {out_path.relative_to(Path.cwd())}")
    print()

    # ── Login ──────────────────────────────────────────────────────────────────
    session, studios = _login()
    print(f"  ✓ Logged in — {len(studios)} studios: {', '.join(s['name'] for s in studios)}\n")

    booking_dfs: list[pd.DataFrame] = []
    fv_dfs:      list[pd.DataFrame] = []

    # ── Per-studio download ────────────────────────────────────────────────────
    for studio in studios:
        name = studio["name"]
        print(f"  [{name}]")

        ok = _switch_studio(session, studio)
        if not ok:
            # Session may have been invalidated after first studio — re-login and retry
            print(f"    GoLocation failed — re-logging in for {name}...")
            try:
                session2, studios2 = _login()
                match = next((s for s in studios2 if s["name"] == name), None)
                if match:
                    ok = _switch_studio(session2, match)
                    if ok:
                        session = session2
            except Exception as e:
                print(f"    Re-login failed: {e}")

        if not ok:
            print(f"    ✗ Skipping {name}\n")
            continue

        for report in REPORTS:
            label = report["reportName"]
            print(f"    {label}...", end="", flush=True)

            raw = _download_report_bytes(session, report, start_date, end_date)
            if not raw:
                print(" ✗ (download failed)")
                continue

            df = _read_tab(raw, report["tab"])
            if df is None or df.empty:
                print(f" ✗ (empty or unreadable tab '{report['tab']}')")
                continue

            print(f" ✓ ({len(df):,} rows)")
            if report["key"] == "booking_events_log":
                booking_dfs.append(df)
            else:
                fv_dfs.append(df)

        print()

    # ── Build combined workbook ────────────────────────────────────────────────
    if not booking_dfs and not fv_dfs:
        print("  ✗ No data downloaded — aborting")
        return 1

    RAW_DIR.mkdir(parents=True, exist_ok=True)

    bookings_df = pd.concat(booking_dfs, ignore_index=True) if booking_dfs else pd.DataFrame()
    fv_df       = pd.concat(fv_dfs,      ignore_index=True) if fv_dfs      else pd.DataFrame()

    print("=" * 60)
    print("  Building combined workbook...")

    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        if not bookings_df.empty:
            bookings_df.to_excel(writer, sheet_name="booking_events_log", index=False)
        if not fv_df.empty:
            fv_df.to_excel(writer, sheet_name="first_visits", index=False)
        _carry_forward_sheets(writer)

    print(f"\n  ✓ Written: {out_path.name}")
    print(f"    booking_events_log : {len(bookings_df):,} rows  (across {len(booking_dfs)} studios)")
    print(f"    first_visits       : {len(fv_df):,} rows  (across {len(fv_dfs)} studios)")

    # ── Delete old ClubReady exports ───────────────────────────────────────────
    deleted = 0
    for old in RAW_DIR.glob("Stretchlab_B2C_DB_ClubReady_*.xlsx"):
        if old != out_path:
            old.unlink()
            deleted += 1
    if deleted:
        print(f"  ✓ Deleted {deleted} previous ClubReady export(s)")

    print("=" * 60)
    print(f"\n  Next step:")
    print(f"    python3 run_all.py {out_path.relative_to(Path.cwd())} \\")
    print(f"      data/stretchlab/validation/Stretch_Lab_Manual_Tracker.xlsx")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
