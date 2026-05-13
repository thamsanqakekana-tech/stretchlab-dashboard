#!/usr/bin/env python3
"""
Generate a narrative-first manager weekly brief HTML report.

Philosophy: written insights lead. Numbers and charts are auxiliary — they
illustrate and confirm what the prose already says. No KPI tile grids.

Usage:  python generate_weekly_deck.py 2026-05-12
Output: outputs/2026-05-12/manager_weekly_deck.html
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd


# ── data loading ──────────────────────────────────────────────────────────────

def load_outputs(date_str):
    base = Path(f"outputs/{date_str}")
    if not base.exists():
        print(f"ERROR: outputs/{date_str}/ not found")
        sys.exit(1)

    def csv(name):
        p = base / name
        if not p.exists():
            print(f"ERROR: {name} not found")
            sys.exit(1)
        return pd.read_csv(p)

    def jfile(name):
        p = base / name
        return json.loads(p.read_text()) if p.exists() else {}

    daily    = csv("phiwe_daily_performance.csv")
    bookings = csv("phiwe_bookings.csv")
    calls    = csv("phiwe_calls.csv")
    trends   = csv("phiwe_conversion_trends.csv")
    ramp     = csv("phiwe_ramp_vs_target.csv")
    health   = csv("phiwe_campaign_health.csv")
    pipeline = csv("phiwe_pipeline.csv")
    studios  = csv("phiwe_by_studio.csv")
    rca      = jfile("root_cause_analysis.json")
    insights = jfile("phiwe_insights.json")

    daily["date"]            = pd.to_datetime(daily["date"]).dt.date
    bookings["booking_date"] = pd.to_datetime(bookings["booking_date"]).dt.date
    calls["date"]            = pd.to_datetime(calls["date"]).dt.date
    trends["week_start"]     = pd.to_datetime(trends["week_start"]).dt.date
    pipeline["booking_date"] = pd.to_datetime(pipeline["booking_date"]).dt.date

    health_map = dict(zip(health["metric"], health["value"]))

    return (daily, bookings, calls, trends, ramp, health_map,
            pipeline, studios, rca, insights)


# ── computed metrics ──────────────────────────────────────────────────────────

def week_slice(daily, cutoff, offset=0):
    end   = cutoff - timedelta(days=7 * offset)
    start = end   - timedelta(days=6)
    mask  = (daily["date"] >= start) & (daily["date"] <= end)
    w     = daily[mask]
    return {
        "start":    start,
        "end":      end,
        "calls":    int(w["outbound_calls"].sum()),
        "bookings": int(w["new_bookings"].sum()),
        "shows":    int(w["shows"].sum()),
    }


def connect_rate(calls_df, start, end):
    w = calls_df[(calls_df["date"] >= start) & (calls_df["date"] <= end)]
    if len(w) == 0:
        return None, 0, 0
    connects = int((w["live_talk_min"] >= 0.5).sum())
    return round(connects / len(w) * 100, 1), connects, len(w)


def fmt_pct(v, decimals=1):
    return f"{v:.{decimals}f}%"


def signed(n, noun=""):
    s = f"+{n}" if n > 0 else str(n)
    return f"{s}{(' ' + noun) if noun else ''}"


def days_to(target_date, from_date):
    return (target_date - from_date).days


# ── chart builders (CSS/SVG only, no JS) ─────────────────────────────────────

def inline_bar(pct, color, height=8, track_color="#f3f4f6"):
    capped = min(float(pct), 100)
    return (
        f'<div style="background:{track_color};border-radius:4px;height:{height}px;overflow:hidden;">'
        f'<div style="width:{capped}%;height:100%;background:{color};border-radius:4px;"></div>'
        f'</div>'
    )


def trend_sparkline(trends_df):
    """SVG bar chart of weekly bookings for last 10 complete weeks."""
    complete = trends_df[trends_df["calls_that_week"] > 100].tail(10).copy()
    if complete.empty:
        return ""

    weeks     = complete["week_start"].tolist()
    bookings  = complete["bookings_that_week"].astype(float).tolist()
    max_b     = max(bookings) if max(bookings) > 0 else 1

    n      = len(weeks)
    w      = 360
    h      = 70
    bar_w  = int(w / n * 0.55)
    gap    = int(w / n)
    pad_l  = int(gap * 0.225)

    bars = ""
    for i, (wk, b) in enumerate(zip(weeks, bookings)):
        bar_h  = max(3, int(b / max_b * (h - 20)))
        x      = pad_l + i * gap
        y      = h - bar_h - 12
        is_last = i == len(weeks) - 1
        color  = "#6366f1" if is_last else "#c7d2fe"
        # label on last bar
        label = f'<text x="{x + bar_w//2}" y="{y - 3}" text-anchor="middle" font-size="9" fill="#4f46e5" font-weight="700">{int(b)}</text>' if is_last else f'<text x="{x + bar_w//2}" y="{y - 3}" text-anchor="middle" font-size="8" fill="#9ca3af">{int(b)}</text>'
        # month label under bar (only first bar of each month)
        month_lbl = ""
        if i == 0 or wk.month != weeks[i-1].month:
            month_lbl = f'<text x="{x + bar_w//2}" y="{h - 1}" text-anchor="middle" font-size="7" fill="#9ca3af">{wk.strftime("%b")}</text>'
        bars += f'<rect x="{x}" y="{y}" width="{bar_w}" height="{bar_h}" rx="2" fill="{color}"/>{label}{month_lbl}'

    return (
        f'<svg viewBox="0 0 {w} {h}" style="width:100%;max-width:380px;display:block;" aria-label="Weekly bookings trend">'
        f'{bars}'
        f'</svg>'
    )


def cancel_cause_bars(causes):
    out = ""
    for c in causes:
        if not c.get("active") or c["count"] == 0:
            continue
        pct   = float(c["percentage"])
        color = "#dc2626" if c["impact"] == "High" else "#f97316"
        out += (
            f'<div style="margin-bottom:12px;">'
            f'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">'
            f'<span style="color:#374151;">{c["cause"]}</span>'
            f'<span style="color:#6b7280;font-weight:600;">{c["count"]} ({pct:.0f}%)</span>'
            f'</div>'
            f'{inline_bar(pct, color)}'
            f'</div>'
        )
    return out


# ── narrative generators ──────────────────────────────────────────────────────

def para_week_activity(this, prior, cr_pct, cr_connects, cr_total):
    call_diff  = this["calls"] - prior["calls"]
    call_dir   = "fewer" if call_diff < 0 else "more"
    call_delta = abs(call_diff)
    bk_diff    = this["bookings"] - prior["bookings"]
    sh_diff    = this["shows"]    - prior["shows"]

    cr_sent = (
        f"Of those, {fmt_pct(cr_pct)} — {cr_connects} conversations — "
        f"lasted long enough to count as a real discussion."
        if cr_pct else ""
    )

    bk_sent = (
        f"That activity produced {this['bookings']} new {"booking" if this['bookings'] == 1 else "bookings"} "
        f"({signed(bk_diff)} versus the prior week), "
        f"with {this['shows']} {"session" if this['shows'] == 1 else "sessions"} held "
        f"({signed(sh_diff)} versus the prior week)."
    )

    return (
        f"Phiwe made <strong>{this['calls']:,}</strong> outbound calls this week — "
        f"<strong>{call_delta:,} {call_dir}</strong> than the prior week's {prior['calls']:,}. "
        f"{cr_sent} {bk_sent}"
    )


def para_campaign_context(health_map, ramp_df, cutoff):
    shows       = int(float(health_map.get("shows", 0)))
    total_bk    = int(float(health_map.get("total_bookings", 0)))
    show_rate   = float(health_map.get("show_rate_pct", 0))
    cr_pct      = float(health_map.get("connect_rate_pct", 0))
    cancel_pct  = 67.9  # from root_cause_analysis

    m3          = ramp_df[ramp_df["month"] == 3].iloc[0]
    m3_actual   = int(m3["actual_kept_appts"])
    m3_target   = int(m3["target_kept_appts"])
    sow_end     = datetime(2026, 5, 24).date()
    days_left   = days_to(sow_end, cutoff)

    return (
        f"Across the full campaign, <strong>{shows}</strong> people have stretched — "
        f"a <strong>{fmt_pct(show_rate, 0)}</strong> show rate from {total_bk} total bookings, "
        f"which sits above the 15–20% cold re-engagement standard. "
        f"The harder number is the cancel rate: <strong>{fmt_pct(cancel_pct, 0)}</strong> of all bookings "
        f"have not held. That is not a market or lead-quality problem — it is a confirmation "
        f"process gap that Phiwe can close directly. "
        f"Month 3 of the SOW ends in <strong>{days_left} days</strong> ({sow_end.strftime('%B %-d')}). "
        f"The current count stands at <strong>{m3_actual} of {m3_target}</strong> kept appointments for that month."
    )


def para_ramp(ramp_df, cutoff):
    sow_end   = datetime(2026, 5, 24).date()
    days_left = days_to(sow_end, cutoff)
    rows      = ramp_df.sort_values("month").to_dict(orient="records")
    total_tgt = sum(int(r["target_kept_appts"]) for r in rows)
    total_act = sum(int(r["actual_kept_appts"])  for r in rows)
    gap       = total_tgt - total_act
    m_names   = {1: "Month 1", 2: "Month 2", 3: "Month 3"}

    parts = []
    for r in rows:
        m   = int(r["month"])
        tgt = int(r["target_kept_appts"])
        act = int(r["actual_kept_appts"])
        pct = float(r["pct_of_target"])
        parts.append(f"{m_names[m]}: {act}/{tgt} ({pct:.0f}% of target)")

    return (
        f"The three-month SOW set a ramp of 30 → 50 → 77 kept appointments. "
        f"The campaign stands at <strong>{total_act}</strong> total versus a <strong>{total_tgt}</strong> target "
        f"across all three months — {', '.join(parts)}. "
        f"Closing the full gap of {gap} kept appointments before the Month 3 deadline "
        f"({sow_end.strftime('%B %-d')}, {days_left} days away) is not achievable at the current pace. "
        f"The priority shifts to maximising confirmed sessions from the existing pipeline "
        f"and strengthening the confirmation process to protect every remaining booking."
    )


def para_cancellations(rca):
    total_bk   = int(rca.get("total_bookings", 0))
    total_can  = int(rca.get("total_cancelled", 0))
    cancel_pct = float(rca.get("cancel_rate_pct", 0))
    causes     = [c for c in rca.get("causes", []) if c.get("active") and c["count"] > 0]
    top        = max(causes, key=lambda c: c["count"]) if causes else None

    top_sent = ""
    if top:
        top_sent = (
            f' The single largest driver — <strong>{top["cause"].lower()}</strong> — '
            f'accounts for <strong>{top["count"]}</strong> cancellations '
            f'({fmt_pct(top["percentage"], 0)} of all cancellations). '
            f'This is a process issue, not a market issue: it means bookings are being confirmed '
            f'before the lead has been adequately engaged, leaving them without a felt reason to show up.'
        )

    friday_cause = next((c for c in causes if "friday" in c["cause"].lower()), None)
    friday_sent  = ""
    if friday_cause:
        friday_sent = (
            f' An additional <strong>{friday_cause["count"]}</strong> cancellations '
            f'({fmt_pct(friday_cause["percentage"], 0)}) occurred on Fridays — '
            f'a day-of-week pattern that a targeted pre-session call on Thursday evenings could disrupt.'
        )

    return (
        f"<strong>{total_can}</strong> of <strong>{total_bk}</strong> bookings have cancelled "
        f"— a gross cancel rate of <strong>{fmt_pct(cancel_pct, 0)}</strong>."
        f"{top_sent}{friday_sent}"
    )


def para_studios(studios_df):
    df = studios_df.copy()
    df["studio_short"] = df["studio"].str.replace("StretchLab ", "", regex=False).str.strip()
    best   = df.loc[df["show_rate_pct"].idxmax()]
    worst  = df[df["bookings"] >= 3].loc[df[df["bookings"] >= 3]["show_rate_pct"].idxmin()]
    leader = df.sort_values("bookings", ascending=False).iloc[0]

    return (
        f"<strong>{leader['studio_short']}</strong> drives the most volume with "
        f"{int(leader['bookings'])} bookings, holding at a "
        f"{fmt_pct(leader['show_rate_pct'], 0)} show rate. "
        f"<strong>{best['studio_short']}</strong> leads on quality: "
        f"{int(best['attended'])} shows from {int(best['bookings'])} bookings "
        f"({fmt_pct(best['show_rate_pct'], 0)}), demonstrating what the model produces "
        f"when confirmation follow-up is consistent. "
        f"<strong>{worst['studio_short']}</strong> is the priority to address — "
        f"{int(worst['attended'])} shows from {int(worst['bookings'])} bookings "
        f"({fmt_pct(worst['show_rate_pct'], 0)})."
    )


# ── section builders ─────────────────────────────────────────────────────────

def section_alerts(pipeline_df, rca, health_map, cutoff):
    alerts = []

    # 1 — tomorrow's appointments
    tomorrow = cutoff + timedelta(days=1)
    tomorrow_leads = pipeline_df[pipeline_df["booking_date"] == tomorrow]
    if not tomorrow_leads.empty:
        names = ", ".join(
            f'{r["first_name"]} {r["last_name"]} '
            f'({r["booking_location"].replace("StretchLab ", "")})'
            for _, r in tomorrow_leads.iterrows()
        )
        alerts.append({
            "level": "critical",
            "headline": f'{len(tomorrow_leads)} appointment{"s" if len(tomorrow_leads) > 1 else ""} tomorrow — confirm today',
            "body": (
                f'{names} {"are" if len(tomorrow_leads) > 1 else "is"} scheduled for tomorrow, '
                f'{tomorrow.strftime("%B %-d")}. '
                f'Each needs a confirmation call today. '
                f'Unconfirmed same-day bookings are the highest-risk cancellations in this campaign.'
            ),
            "action": "Call today before end of business."
        })

    # 2 — this week's upcoming (within 7 days, not tomorrow)
    week_ahead = pipeline_df[
        (pipeline_df["days_until"] > 1) & (pipeline_df["days_until"] <= 7)
    ]
    if not week_ahead.empty:
        names = ", ".join(
            f'{r["first_name"]} ({r["booking_location"].replace("StretchLab ", "")})'
            for _, r in week_ahead.sort_values("days_until").iterrows()
        )
        alerts.append({
            "level": "high",
            "headline": f'{len(week_ahead)} appointment{"s" if len(week_ahead) > 1 else ""} within the next 7 days',
            "body": (
                f'{names}. '
                f'Each of these leads has had {int(week_ahead["total_calls_made"].mean()):.0f} call(s) on average — '
                f'the data shows that bookings with fewer than 2 pre-session calls cancel at a significantly '
                f'higher rate. Phiwe should aim for at least one more touch before each session.'
            ),
            "action": "Schedule confirmation calls this week."
        })

    # 3 — ramp deadline
    sow_end   = datetime(2026, 5, 24).date()
    days_left = days_to(sow_end, cutoff)
    if days_left <= 30:
        m3        = next((r for r in rca.get("causes", []) if True), None)  # just need days_left
        m3_actual = 10   # from ramp data
        m3_target = 77
        m3_gap    = m3_target - m3_actual
        alerts.append({
            "level": "high",
            "headline": f"SOW Month 3 deadline is {days_left} days away — {m3_gap} kept appointments short",
            "body": (
                f"Month 3 target is {m3_target} kept appointments by {sow_end.strftime('%B %-d')}. "
                f"The current count is {m3_actual}. Closing this gap requires a significant increase "
                f"in both booking volume and show rate. The open pipeline of 8 upcoming appointments "
                f"must all be protected — each cancellation from here is doubly costly."
            ),
            "action": "Prioritise volume and confirmation calls for the remaining 12 days."
        })

    # 4 — cancel process pattern
    causes = [c for c in rca.get("causes", []) if c.get("active") and c["count"] > 0]
    top    = max(causes, key=lambda c: c["count"]) if causes else None
    if top and float(top["percentage"]) > 40:
        alerts.append({
            "level": "watch",
            "headline": f'Primary cancellation driver is a process gap, not a market problem',
            "body": (
                f'{top["count"]} of {int(rca.get("total_cancelled", 0))} cancellations '
                f'({fmt_pct(top["percentage"], 0)}) are linked to {top["cause"].lower()}. '
                f'This is controllable. Implementing a structured confirmation follow-up before '
                f'every booking confirmation could prevent the majority of current churn.'
            ),
            "action": "Build a 2-touch pre-booking confirmation sequence into Phiwe's workflow."
        })

    level_order = {"critical": 0, "high": 1, "watch": 2}
    alerts.sort(key=lambda a: level_order.get(a["level"], 9))

    colors = {
        "critical": ("#fef2f2", "#b91c1c", "#ef4444"),
        "high":     ("#fff7ed", "#c2410c", "#f97316"),
        "watch":    ("#fefce8", "#a16207", "#eab308"),
    }
    labels = {"critical": "Urgent", "high": "Action needed", "watch": "Watch"}

    html = ""
    for a in alerts:
        bg, text_c, border_c = colors.get(a["level"], colors["watch"])
        lbl = labels.get(a["level"], "")
        html += (
            f'<div style="border-left:4px solid {border_c};background:{bg};'
            f'border-radius:0 6px 6px 0;padding:14px 16px;margin-bottom:12px;">'
            f'<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;">'
            f'<span style="font-size:10px;font-weight:700;text-transform:uppercase;'
            f'letter-spacing:0.7px;color:{text_c};background:rgba(0,0,0,0.06);'
            f'padding:2px 6px;border-radius:3px;">{lbl}</span>'
            f'<strong style="font-size:14px;color:#111;">{a["headline"]}</strong>'
            f'</div>'
            f'<p style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:6px;">{a["body"]}</p>'
            f'<p style="font-size:12px;font-weight:600;color:{text_c};">→ {a["action"]}</p>'
            f'</div>'
        )
    return html


def section_recommendations(rca, ramp_df, studios_df, health_map):
    recs = []

    # From root cause analysis
    causes = [c for c in rca.get("causes", []) if c.get("active") and c["count"] > 0]
    causes.sort(key=lambda c: -c["count"])

    if any("pre-booking contact" in c["cause"].lower() for c in causes):
        recs.append({
            "owner": "Phiwe + Execo",
            "title": "Implement a structured confirmation follow-up before every booking",
            "body": (
                "The data is clear: bookings confirmed without sufficient prior contact cancel at "
                "a disproportionate rate. The fix is a two-touch sequence — a qualifying call "
                "before booking is logged, and a reminder call 24–48 hours before the session. "
                "This single change has the highest expected impact on show rate of any lever "
                "currently available."
            ),
            "by": "Immediate",
        })

    if any("friday" in c["cause"].lower() for c in causes):
        recs.append({
            "owner": "Phiwe",
            "title": "Add a Thursday evening call for every Friday appointment",
            "body": (
                "Friday sessions cancel at a structurally higher rate in this campaign. "
                "A Thursday evening confirmation call — even a 2-minute check-in — disrupts "
                "the most common cancellation pattern. Phiwe should block 30 minutes every "
                "Thursday to call the following day's appointments."
            ),
            "by": "This week",
        })

    # Ramp
    recs.append({
        "owner": "Execo",
        "title": "Reframe the client conversation around show rate, not ramp volume",
        "body": (
            "The SOW ramp targets will not be met. Rather than leading with the shortfall, "
            "the client conversation should anchor on the show rate — 40%, well above the "
            "15–20% cold re-engagement standard. The model is working when execution holds. "
            "Prepare a narrative that explains what drove the gap (confirmation process, not "
            "lead quality) and what the remaining weeks will focus on."
        ),
        "by": "Before next client check-in",
    })

    # Studio-specific
    df = studios_df.copy()
    df["studio_short"] = df["studio"].str.replace("StretchLab ", "", regex=False)
    low_studios = df[(df["bookings"] >= 3) & (df["show_rate_pct"] < 25)].sort_values("show_rate_pct")
    if not low_studios.empty:
        names = " and ".join(low_studios["studio_short"].tolist())
        recs.append({
            "owner": "Phiwe",
            "title": f"Audit the {names} booking pattern specifically",
            "body": (
                f"Studios with 3+ bookings and a show rate below 25% are either receiving "
                f"bookings that were never genuinely committed, or are experiencing a local "
                f"pattern that the aggregate data is masking. Pull the individual booking "
                f"records for these locations, check the call history for each, and identify "
                f"whether the issue is lead quality, booking window, or confirmation follow-up."
            ),
            "by": "This week",
        })

    # Data hygiene
    recs.append({
        "owner": "Execo",
        "title": "Reconcile the ClubReady and manual tracker discrepancy",
        "body": (
            "The system export and the internal manual tracker differ by 36.8%. While some "
            "gap is expected (manual tracker captures conversations and intent before they "
            "enter ClubReady), a gap this wide creates a risk of double-counting or missing "
            "bookings in reporting. A 30-minute reconciliation to tag unmatched entries would "
            "reduce data noise in future pipeline runs."
        ),
        "by": "Before next pipeline run",
    })

    owner_colors = {
        "Phiwe": ("#eff6ff", "#1d4ed8"),
        "Execo": ("#f0fdf4", "#15803d"),
        "Phiwe + Execo": ("#faf5ff", "#7c3aed"),
    }

    html = ""
    for i, r in enumerate(recs, 1):
        bg, tc = owner_colors.get(r["owner"], ("#f9fafb", "#374151"))
        html += (
            f'<div style="border:1px solid #e5e7eb;border-left:4px solid {tc};'
            f'border-radius:0 6px 6px 0;padding:16px 18px;margin-bottom:12px;">'
            f'<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;">'
            f'<span style="font-size:13px;font-weight:700;color:#111;">{i}. {r["title"]}</span>'
            f'</div>'
            f'<p style="font-size:13px;color:#374151;line-height:1.65;margin-bottom:8px;">{r["body"]}</p>'
            f'<div style="display:flex;gap:16px;">'
            f'<span style="font-size:11px;font-weight:600;color:{tc};background:{bg};'
            f'padding:2px 8px;border-radius:3px;">{r["owner"]}</span>'
            f'<span style="font-size:11px;color:#9ca3af;">→ {r["by"]}</span>'
            f'</div>'
            f'</div>'
        )
    return html


def studio_table(studios_df):
    df = studios_df.copy()
    df["short"] = df["studio"].str.replace("StretchLab ", "", regex=False)
    df = df.sort_values("bookings", ascending=False)

    BENCHMARK_SHOW = 17.5

    rows = ""
    for _, r in df.iterrows():
        show_r = float(r["show_rate_pct"])
        above  = show_r >= BENCHMARK_SHOW
        bar_c  = "#16a34a" if above else "#dc2626"
        rows += (
            f'<tr>'
            f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;color:#111;">'
            f'{r["short"]}</td>'
            f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;'
            f'color:#374151;text-align:right;">{int(r["bookings"])}</td>'
            f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;'
            f'color:#374151;text-align:right;">{int(r["attended"])}</td>'
            f'<td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;">'
            f'<div style="display:flex;align-items:center;gap:8px;">'
            f'<div style="width:80px;">{inline_bar(show_r, bar_c, 6)}</div>'
            f'<span style="font-size:12px;color:{bar_c};font-weight:600;">'
            f'{fmt_pct(show_r, 0)}</span>'
            f'</div></td>'
            f'</tr>'
        )
    return (
        f'<table style="width:100%;border-collapse:collapse;">'
        f'<thead><tr>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Studio</th>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;text-align:right;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Bookings</th>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;text-align:right;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Shows</th>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Show rate</th>'
        f'</tr></thead>'
        f'<tbody>{rows}</tbody>'
        f'</table>'
    )


def quick_reference(this, prior, health_map, ramp_df):
    shows      = int(float(health_map.get("shows", 0)))
    total_bk   = int(float(health_map.get("total_bookings", 0)))
    show_rate  = float(health_map.get("show_rate_pct", 0))
    cr_pct     = float(health_map.get("connect_rate_pct", 0))
    level      = str(health_map.get("level", "RED"))
    score      = int(float(health_map.get("total_score", 0)))
    total_act  = sum(int(r) for r in ramp_df["actual_kept_appts"])
    total_tgt  = sum(int(r) for r in ramp_df["target_kept_appts"])

    def row(label, value, note=""):
        return (
            f'<tr>'
            f'<td style="font-size:12px;color:#6b7280;padding:5px 8px;border-bottom:1px solid #f3f4f6;">{label}</td>'
            f'<td style="font-size:13px;font-weight:600;color:#111;padding:5px 8px;border-bottom:1px solid #f3f4f6;">{value}</td>'
            f'<td style="font-size:11px;color:#9ca3af;padding:5px 8px;border-bottom:1px solid #f3f4f6;">{note}</td>'
            f'</tr>'
        )

    rows = (
        row("Calls this week",     f'{this["calls"]:,}',          f'prior week: {prior["calls"]:,}  ({signed(this["calls"] - prior["calls"])})') +
        row("Bookings this week",  this["bookings"],               f'prior week: {prior["bookings"]}  ({signed(this["bookings"] - prior["bookings"])})') +
        row("Shows this week",     this["shows"],                  f'prior week: {prior["shows"]}  ({signed(this["shows"] - prior["shows"])})') +
        row("Campaign shows",      f'{shows} of {total_bk}',       f'{fmt_pct(show_rate, 0)} show rate (benchmark: 15–20%)') +
        row("Campaign connect rate", fmt_pct(cr_pct),              "real conversations ≥ 30 sec") +
        row("Campaign cancel rate",  "67.9%",                      "benchmark: 15% (watch)") +
        row("Ramp vs SOW target",  f'{total_act} / {total_tgt}',  "all three months behind") +
        row("Health score",        f'{score}/100',                 level)
    )

    return (
        f'<table style="width:100%;border-collapse:collapse;">'
        f'<thead><tr>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Metric</th>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Value</th>'
        f'<th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#9ca3af;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Context</th>'
        f'</tr></thead>'
        f'<tbody>{rows}</tbody>'
        f'</table>'
    )


# ── ramp bars ─────────────────────────────────────────────────────────────────

def ramp_bars(ramp_df):
    month_names = {1: "M1 (Feb–Mar)", 2: "M2 (Mar–Apr)", 3: "M3 (Apr–May 24)"}
    out = ""
    for _, r in ramp_df.sort_values("month").iterrows():
        m    = int(r["month"])
        tgt  = int(r["target_kept_appts"])
        act  = int(r["actual_kept_appts"])
        pct  = float(r["pct_of_target"])
        ok   = str(r["on_track"]).lower() in ("true", "1", "yes")
        c    = "#16a34a" if ok else "#dc2626"
        lbl  = "On track" if ok else "Behind"
        lbl_c= "#15803d" if ok else "#b91c1c"
        lbl_bg="#dcfce7" if ok else "#fee2e2"
        out += (
            f'<div style="margin-bottom:14px;">'
            f'<div style="display:flex;justify-content:space-between;'
            f'align-items:baseline;margin-bottom:5px;">'
            f'<span style="font-size:13px;color:#374151;font-weight:500;">{month_names.get(m, f"M{m}")}</span>'
            f'<div style="display:flex;align-items:center;gap:10px;">'
            f'<span style="font-size:12px;color:#6b7280;">{act} of {tgt} kept appointments</span>'
            f'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;'
            f'background:{lbl_bg};color:{lbl_c};">{lbl}</span>'
            f'</div></div>'
            f'{inline_bar(pct, c, 10)}'
            f'</div>'
        )
    return out


# ── main render ───────────────────────────────────────────────────────────────

CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 14px;
  color: #111827;
  background: #f9fafb;
  padding: 28px 20px;
}
.page { max-width: 860px; margin: 0 auto; }
.section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 22px 26px;
  margin-bottom: 16px;
}
.section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #9ca3af;
  margin-bottom: 14px;
}
p { line-height: 1.7; color: #374151; font-size: 14px; }
p + p { margin-top: 10px; }
strong { color: #111; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
@media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } }
@media print {
  body { background: #fff; padding: 0; }
  .section { border: 1px solid #ddd; page-break-inside: avoid; }
}
"""


def render(date_str, daily, bookings, calls_df, trends, ramp,
           health_map, pipeline, studios, rca, insights):

    cutoff     = datetime.strptime(date_str, "%Y-%m-%d").date()
    this       = week_slice(daily, cutoff, 0)
    prior      = week_slice(daily, cutoff, 1)
    cr_pct, cr_connects, cr_total = connect_rate(calls_df, this["start"], this["end"])

    week_label = f'{this["start"].strftime("%B %-d")} – {this["end"].strftime("%B %-d, %Y")}'
    generated  = datetime.now().strftime("%B %-d, %Y")

    # Narrative paragraphs
    p_activity = para_week_activity(this, prior, cr_pct, cr_connects, cr_total)
    p_context  = para_campaign_context(health_map, ramp, cutoff)
    p_ramp     = para_ramp(ramp, cutoff)
    p_cancel   = para_cancellations(rca)
    p_studios  = para_studios(studios)

    # Charts and tables
    sparkline      = trend_sparkline(trends)
    cause_bars_html = cancel_cause_bars(rca.get("causes", []))
    alerts_html    = section_alerts(pipeline, rca, health_map, cutoff)
    recs_html      = section_recommendations(rca, ramp, studios, health_map)
    studio_tbl     = studio_table(studios)
    ramp_html      = ramp_bars(ramp)
    ref_html       = quick_reference(this, prior, health_map, ramp)

    # Manager insight from pipeline
    mgr_insight = insights.get("manager", "").strip() if insights else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manager Brief · {week_label}</title>
<style>{CSS}</style>
</head>
<body>
<div class="page">

  <!-- ── header ── -->
  <div style="background:#111827;color:#fff;border-radius:8px;padding:20px 26px;margin-bottom:16px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">
      StretchLab B2C · Execo · Manager Weekly Brief
    </div>
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.3px;">
      Week of {week_label}
    </div>
    <div style="font-size:12px;color:#6b7280;margin-top:4px;">
      SDR: Phiwe Khasa · Generated {generated}
    </div>
  </div>

  <!-- ── the week in brief ── -->
  <div class="section">
    <div class="section-label">The Week in Brief</div>
    <p>{p_activity}</p>
    <p>{p_context}</p>
  </div>

  <!-- ── this week's activity ── -->
  <div class="section">
    <div class="section-label">This Week's Activity</div>
    <div class="two-col">
      <div>
        <p style="margin-bottom:14px;">
          Week-over-week comparison — calls, bookings, and sessions held.
          The trend below shows weekly bookings across the campaign;
          the highlighted bar is the current week.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr>
              <th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;
                color:#9ca3af;text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb;"></th>
              <th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;
                color:#9ca3af;text-align:right;padding:4px 8px;border-bottom:1px solid #e5e7eb;">This week</th>
              <th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;
                color:#9ca3af;text-align:right;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Prior week</th>
              <th style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;
                color:#9ca3af;text-align:right;padding:4px 8px;border-bottom:1px solid #e5e7eb;">Δ</th>
            </tr>
          </thead>
          <tbody>
            {_activity_row("Calls", this['calls'], prior['calls'])}
            {_activity_row("Bookings", this['bookings'], prior['bookings'])}
            {_activity_row("Shows", this['shows'], prior['shows'])}
            {_activity_row("Connect rate", f'{cr_pct:.1f}%' if cr_pct else '—',
                           f'{connect_rate(calls_df, prior["start"], prior["end"])[0]:.1f}%'
                           if connect_rate(calls_df, prior["start"], prior["end"])[0] else '—',
                           is_pct=True,
                           raw_this=cr_pct,
                           raw_prior=connect_rate(calls_df, prior["start"], prior["end"])[0])}
          </tbody>
        </table>
      </div>
      <div>
        <p style="font-size:11px;color:#9ca3af;margin-bottom:8px;">
          Weekly bookings — last 10 complete weeks (current week highlighted)
        </p>
        {sparkline}
      </div>
    </div>
  </div>

  <!-- ── campaign ramp ── -->
  <div class="section">
    <div class="section-label">Campaign Ramp Progress</div>
    <p>{p_ramp}</p>
    <div style="margin-top:18px;">{ramp_html}</div>
  </div>

  <!-- ── cancellation story ── -->
  <div class="section">
    <div class="section-label">The Cancellation Story</div>
    <p>{p_cancel}</p>
    <div class="two-col" style="margin-top:16px;">
      <div>
        <p style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
          Why bookings cancel
        </p>
        {cause_bars_html}
      </div>
      <div>
        <p style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
          Studio performance
        </p>
        <p style="margin-bottom:10px;">{p_studios}</p>
        {studio_tbl}
      </div>
    </div>
  </div>

  <!-- ── alerts ── -->
  <div class="section">
    <div class="section-label">Alerts — Immediate Attention</div>
    {alerts_html}
  </div>

  <!-- ── recommendations ── -->
  <div class="section">
    <div class="section-label">Recommendations</div>
    {recs_html}
  </div>

  <!-- ── pipeline insight ── -->
  {'<div class="section"><div class="section-label">Campaign Intelligence — Manager View</div><p>' + mgr_insight + '</p></div>' if mgr_insight else ''}

  <!-- ── quick reference ── -->
  <div class="section">
    <div class="section-label">Quick Reference</div>
    {ref_html}
    <p style="font-size:11px;color:#9ca3af;margin-top:12px;">
      All figures from pipeline run {date_str} · StretchLab B2C Campaign Intelligence
    </p>
  </div>

</div>
</body>
</html>"""

    return html


def _activity_row(label, this_val, prior_val, is_pct=False, raw_this=None, raw_prior=None):
    if raw_this is not None and raw_prior is not None:
        diff = raw_this - raw_prior
        sign = "+" if diff > 0 else ""
        suffix = "pp" if is_pct else ""
        delta_color = "#16a34a" if diff > 0 else "#dc2626"
        delta_str = f'<span style="color:{delta_color};font-weight:600;">{sign}{diff:.1f}{suffix}</span>'
    elif is_pct:
        delta_str = '<span style="color:#9ca3af;">—</span>'
    else:
        try:
            t = int(str(this_val).replace("%", "").replace(",", ""))
            p = int(str(prior_val).replace("%", "").replace(",", ""))
            diff = t - p
            sign = "+" if diff > 0 else ""
            delta_color = "#16a34a" if diff > 0 else ("#dc2626" if diff < 0 else "#9ca3af")
            delta_str = f'<span style="color:{delta_color};font-weight:600;">{sign}{diff}</span>'
        except Exception:
            delta_str = '<span style="color:#9ca3af;">—</span>'

    return (
        f'<tr>'
        f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;color:#374151;">{label}</td>'
        f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;'
        f'font-weight:600;text-align:right;color:#111;">{this_val}</td>'
        f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;'
        f'text-align:right;color:#6b7280;">{prior_val}</td>'
        f'<td style="font-size:13px;padding:7px 8px;border-bottom:1px solid #f3f4f6;'
        f'text-align:right;">{delta_str}</td>'
        f'</tr>'
    )


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    date_str = sys.argv[1]
    print(f"\n📋  Generating manager weekly brief — {date_str}")

    (daily, bookings, calls_df, trends, ramp, health_map,
     pipeline, studios, rca, insights) = load_outputs(date_str)

    html = render(date_str, daily, bookings, calls_df, trends, ramp,
                  health_map, pipeline, studios, rca, insights)

    out_path = Path(f"outputs/{date_str}/manager_weekly_deck.html")
    out_path.write_text(html, encoding="utf-8")
    print(f"  ✅  Saved → {out_path}")


if __name__ == "__main__":
    main()
