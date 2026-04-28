#!/usr/bin/env python3
"""
Generate narrative-first AI insights for the StretchLab dashboard using Groq.
Follows Evan's principle: Data layer → Story layer → Dashboard layer.
The core narrative: cold outreach is proving the model. The gap is in cancellations.

Usage:  python generate_insights.py 2026-04-20
Requires: GROQ_API_KEY in .env at project root
"""
import csv
import json
import os
import sys
import urllib.request
import urllib.error
from collections import defaultdict
from pathlib import Path

import pandas as pd

SYSTEM_PROMPTS = {
    'client': (
        "You are a strategic campaign analyst writing a 3-sentence briefing for a StretchLab franchise owner.\n\n"
        "Writing style:\n"
        "- Active voice, short sentences\n"
        "- Name specific leads when relevant (e.g. 'David at Pearland' not 'an appointment')\n"
        "- Show pattern → action in one breath\n"
        "- No hedging, no academic language\n"
        "- Present tense for current state\n"
        "- Concrete over abstract ('May 3rd' not 'upcoming week')\n\n"
        "Structure:\n"
        "1. Lead with the outcome: exact attended count, exact show rate, above/below benchmark\n"
        "2. State the clearest pattern in one sentence — connect it to what drives shows vs cancellations\n"
        "3. Name the immediate action: list the most urgent upcoming leads by name and date from URGENT LEADS\n\n"
        "Never say:\n"
        "- 'is most determined by', 'attributed to', 'represents potential', 'indicates that'\n"
        "- 'health score', 'confirmation calls', 'cold outreach standard', 'current quarter'\n"
        "- Any passive construction\n"
        "- Any number not in the data provided\n\n"
        "Example transformation:\n"
        "BAD: 'Month 3 success is most determined by pre-booking contact'\n"
        "GOOD: 'When Phiwe gets a real conversation before booking, sessions hold — when she does not, they cancel'\n\n"
        "BAD: '10 upcoming appointments represent potential shows'\n"
        "GOOD: '10 appointments need confirmation this week — start with David at Pearland (May 3rd)'\n"
    ),

    'manager': (
        "You are writing for the Execo operations manager reviewing this campaign weekly. "
        "All performance comparisons are against cold re-engagement outreach standards.\n\n"
        "Write exactly 3 paragraphs:\n"
        "1. One-sentence ramp verdict: where the campaign sits vs SOW target, days remaining, and what pace is needed. "
        "Lead with ramp progress (actual kept appts / 77 target), not cancel rate — the show rate is above benchmark.\n"
        "2. What is working and what needs attention: the show rate on resolved bookings, the connect rate, "
        "admin-initiated disruptions and their impact, and what the pipeline risk means for Month 3. "
        "Name the highest-risk upcoming leads if available.\n"
        "3. Numbered action plan, max 3 items. Format: [Owner] — [specific action] — [expected outcome]. "
        "Focus on outreach volume, pipeline confirmation, and studio coordination.\n\n"
        "Use the CANCEL RATE (total bookings) figure from the data — not the resolved-bookings rate. "
        "Be direct and specific. No filler phrases. Max 140 words."
    ),

    'admin': (
        "You are writing for the Execo account lead. The client sees a polished story. "
        "Your job is the layer underneath it — what the client view smooths over. "
        "\n\n"
        "The narrative to drive: the data foundation is sound but has known gaps. The show rate "
        "denominator was corrected (resolved bookings only, excluding future/scheduled appointments). "
        "The health score has both dynamic and placeholder components. The booking drift between "
        "system and manual tracker needs monitoring. Surface what matters for account risk. "
        "\n\n"
        "Structure — 3 paragraphs: "
        "(1) What the resolved-bookings correction reveals: the corrected vs uncorrected show rate, "
        "and why the distinction matters for how the client reads performance. "
        "(2) Data quality flags: tracker drift percentage, any active vs placeholder root causes, "
        "and whether the pipeline risk level is materially affecting the forecast. "
        "(3) Client relationship read: what the ramp shortfall means for renewal risk, what metric "
        "needs to move in the next 30 days to shift the story, and what to proactively communicate. "
        "\n\n"
        "Be precise. No marketing language. Max 150 words."
    ),

    'studio_performance': (
        "You are writing a 3-sentence briefing for a StretchLab franchise owner reviewing how their studios are performing against Phiwe's re-engagement outreach.\n"
        "Context: Phiwe is working leads who went quiet 6 to 12 months ago. Every booking was made by Phiwe from a real conversation with one of those dormant contacts.\n\n"
        "Write exactly 3 sentences. No more.\n\n"
        "Sentence 1: Which studios are holding sessions and at what rate — be specific, name the studios and the rates.\n"
        "Sentence 2: Where is the clearest gap and what does the data say about which side of the partnership it sits on — framed from the studio perspective, not as an internal ops note.\n"
        "Sentence 3: What the upcoming pipeline looks like across studios and what it means for StretchLab in the next 3 weeks.\n\n"
        "Hard rules:\n"
        "- Never mention: \"flexologist\", \"ClubReady\", \"confirmation follow-up\", \"pre-booking contact\", \"booking window\", \"cold outreach\"\n"
        "- Never say: \"studio-canceled\", \"studio-cancelled\", \"priority follow-up\", \"requiring priority\", \"risk\", \"pipeline risk\"\n"
        "- Never say: \"it's on us\", \"we need to figure out\", \"we need to look into\" or any phrase that puts accountability ambiguously on 'us'\n"
        "- Attribute accountability clearly: 'admin-scheduled cancellations' for studio side, 'Phiwe's outreach' for SDR side\n"
        "- Never use passive voice\n"
        "- Do not use management jargon: \"actionable\", \"leverage\", \"optimize\", \"streamline\"\n"
        "- Name studios by their city name only: Shreveport, Pearland, Bunker Hill — not \"StretchLab Shreveport\"\n"
        "- Write like a strategic business partner who reviewed the studio data this morning and has a clear view on what's working and what needs attention\n"
    ),
}


def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip()


def call_groq(api_key, system_prompt, user_prompt):
    payload = json.dumps({
        'model': 'llama-3.3-70b-versatile',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        'max_tokens': 250,
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'User-Agent': 'groq-python/0.9.0',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data['choices'][0]['message']['content']


def build_summary(output_dir):
    # ── Load all data sources ───────────────────────────────────────────────────
    bookings   = pd.read_csv(f'{output_dir}/phiwe_bookings.csv',  low_memory=False)
    calls      = pd.read_csv(f'{output_dir}/phiwe_calls.csv',     low_memory=False)
    studios    = pd.read_csv(f'{output_dir}/phiwe_by_studio.csv')
    health     = pd.read_csv(f'{output_dir}/phiwe_campaign_health.csv')
    ramp       = pd.read_csv(f'{output_dir}/phiwe_ramp_vs_target.csv')
    velocity   = pd.read_csv(f'{output_dir}/phiwe_velocity_trend.csv')
    forecast   = pd.read_csv(f'{output_dir}/phiwe_forecast_30_day.csv')
    benchmarks = pd.read_csv(f'{output_dir}/phiwe_benchmarks_comparison.csv')

    pipeline_path = f'{output_dir}/phiwe_pipeline.csv'
    pipeline = pd.read_csv(pipeline_path) if os.path.exists(pipeline_path) else pd.DataFrame()

    with open(f'{output_dir}/root_cause_analysis.json') as f:
        root_cause = json.load(f)
    with open(f'{output_dir}/validation_report.json') as f:
        validation = json.load(f)

    # ── Funnel metrics ──────────────────────────────────────────────────────────
    total_calls      = len(calls)
    meaningful_convs = int((calls['live_talk_min'] > 0.5).sum())
    connect_rate     = round(meaningful_convs / total_calls * 100, 1) if total_calls else 0

    total_bookings   = len(bookings)
    conv_rate        = round(total_bookings / meaningful_convs * 100, 1) if meaningful_convs else 0

    # Show rate — resolved bookings only (is_past=1, excluding rescheduled)
    if 'is_resolved' in bookings.columns:
        resolved = bookings[bookings['is_resolved'] == 1]
    elif 'is_past' in bookings.columns:
        resolved = bookings[
            (bookings['is_past'] == 1) &
            (~bookings['current_status'].str.contains('Rescheduled', na=False))
        ]
    else:
        resolved = bookings
    resolved_count   = len(resolved)
    shows            = int(bookings['has_show'].sum())
    cancels          = int(resolved['is_cancelled'].sum())          if 'is_cancelled'          in resolved.columns else 0
    cancels_customer = int(resolved['is_cancelled_customer'].sum()) if 'is_cancelled_customer' in resolved.columns else 0
    no_shows         = int(resolved['is_no_show'].sum())            if 'is_no_show'             in resolved.columns else 0

    show_rate_resolved      = round(shows            / resolved_count  * 100, 1) if resolved_count  else 0
    # Cancel rate uses total bookings as denominator per CLAUDE.md — resolved denominator gives inflated misleading rate
    cancel_rate_total       = round(cancels          / total_bookings  * 100, 1) if total_bookings  else 0
    cancel_rate_customer    = round(cancels_customer / total_bookings  * 100, 1) if total_bookings  else 0
    show_rate_naive         = round(shows            / total_bookings  * 100, 1) if total_bookings  else 0

    # Benchmark from CSV — used in summary so LLM comparisons use the correct standard
    bm_row       = benchmarks[benchmarks['metric'] == 'cancel_rate']
    cancel_bm    = float(str(bm_row.iloc[0]['benchmark_pct']).rstrip('%')) if not bm_row.empty else 25.0

    # ── Health ──────────────────────────────────────────────────────────────────
    h            = dict(zip(health['metric'], health['value']))
    health_score = h.get('total_score', 'N/A')
    health_level = h.get('level', 'N/A')
    churn_risk   = h.get('churn_risk', 'N/A')

    # ── Ramp vs target ──────────────────────────────────────────────────────────
    ramp_lines = []
    for _, r in ramp.iterrows():
        status = 'ON TRACK' if str(r.get('on_track', False)).lower() == 'true' else 'BEHIND'
        ramp_lines.append(
            f"M{r['month']}: {r['actual_kept_appts']}/{r['target_kept_appts']} kept appts "
            f"({r['pct_of_target']}% of target) [{status}]"
        )
    ramp_str = ' | '.join(ramp_lines)

    # ── Pipeline risk ────────────────────────────────────────────────────────────
    if not pipeline.empty and 'risk_level' in pipeline.columns:
        high_risk   = int((pipeline['risk_level'] == 'High').sum())
        medium_risk = int((pipeline['risk_level'] == 'Medium').sum())
        pipeline_total = len(pipeline)
    else:
        high_risk = medium_risk = pipeline_total = 0

    # ── Forecast (likely scenario) ───────────────────────────────────────────────
    likely = forecast[forecast['scenario'] == 'likely']
    if not likely.empty:
        likely_bookings = int(likely.iloc[0]['bookings'])
        likely_shows    = int(likely.iloc[0]['shows'])
        likely_drivers  = likely.iloc[0].get('drivers', '')
    else:
        likely_bookings = likely_shows = 0
        likely_drivers = 'N/A'

    # ── Top active root cause ────────────────────────────────────────────────────
    active_causes = [c for c in root_cause.get('causes', []) if c.get('active', c.get('count', 0) > 0)]
    if active_causes:
        top_cause    = max(active_causes, key=lambda c: c['count'])
        top_cause_str = (
            f"{top_cause['cause']} (count: {top_cause['count']}, "
            f"{top_cause['percentage']}% of cancellations) — "
            f"action: {top_cause['action']}"
        )
    else:
        top_cause_str = 'No confirmed root causes in current data'

    # ── Velocity trend ───────────────────────────────────────────────────────────
    if len(velocity) >= 4 and 'avg_calls_per_booking' in velocity.columns:
        recent   = velocity.tail(2)['avg_calls_per_booking'].mean()
        prior    = velocity.iloc[-4:-2]['avg_calls_per_booking'].mean()
        # Lower calls-per-booking = more efficient = improving
        direction = 'IMPROVING (fewer calls per booking)' if recent < prior else 'DECLINING (more calls per booking)'
    else:
        direction = 'insufficient data'

    # ── Studio breakdown — computed from bookings directly (corrected denominator) ─
    studio_stats = []
    for loc, g in bookings.groupby('booking_location'):
        name = str(loc).replace('StretchLab ', '').strip()
        res = int(g['is_resolved'].sum()) if 'is_resolved' in g.columns else int(
            ((g['is_past'] == 1) & (~g['current_status'].str.contains('Rescheduled', na=False))).sum()
        )
        shows_s = int(g['has_show'].sum())
        rate = round(shows_s / res * 100, 0) if res > 0 else 0
        studio_stats.append({'name': name, 'shows': shows_s, 'resolved': res, 'show_rate': rate})

    active_studios = [s for s in studio_stats if s['resolved'] > 0]
    inactive_studios = [s['name'] for s in studio_stats if s['resolved'] == 0 and
                        bookings[bookings['booking_location'].str.contains(s['name'], na=False)].empty is False]
    # For "best/worst" comparison, require at least 2 resolved to avoid single-booking noise
    comparable = [s for s in active_studios if s['resolved'] >= 2]
    inactive_str = ', '.join([s['name'] for s in studio_stats if s['resolved'] == 0]) or 'none'

    if comparable:
        best_s  = max(comparable, key=lambda s: s['show_rate'])
        worst_s = min(comparable, key=lambda s: s['show_rate'])
        studio_lines = ' | '.join(
            f"{s['name']}: {int(s['show_rate'])}% ({s['shows']}/{s['resolved']} resolved)"
            for s in sorted(active_studios, key=lambda s: -s['show_rate'])
        )
        studio_str = (
            f"BEST: {best_s['name']} {int(best_s['show_rate'])}% show rate ({best_s['shows']}/{best_s['resolved']} resolved) | "
            f"LAGGING: {worst_s['name']} {int(worst_s['show_rate'])}% show rate ({worst_s['shows']}/{worst_s['resolved']} resolved)\n"
            f"ALL STUDIOS: {studio_lines}"
        )
    else:
        studio_str = 'N/A'

    # ── Data quality ─────────────────────────────────────────────────────────────
    drift      = validation.get('drift', {})
    val_status = validation.get('status', 'ok')
    drift_pct  = drift.get('booking_drift_pct', 0)
    sys_total  = validation.get('system_metrics', {}).get('total_bookings', 'N/A')
    man_total  = validation.get('manual_metrics', {}).get('total_bookings', 'N/A')

    # ── Date range ────────────────────────────────────────────────────────────────
    dates      = pd.to_datetime(bookings['booking_date'], errors='coerce').dropna()
    date_range = f"{dates.min().date()} to {dates.max().date()}" if len(dates) else 'N/A'

    return (
        f"CAMPAIGN: Cold re-engagement outreach | SDR: Phiwe Khasa | Period: {date_range}\n"
        f"INACTIVE STUDIOS: {inactive_str}\n"
        f"\n"
        f"FUNNEL:\n"
        f"  {total_calls} outbound calls\n"
        f"  → {meaningful_convs} meaningful conversations ({connect_rate}% connect rate)\n"
        f"  → {total_bookings} bookings ({conv_rate}% of meaningful convs)\n"
        f"  → {shows} confirmed shows\n"
        f"\n"
        f"SHOW RATE: {show_rate_resolved}% (resolved bookings only, n={resolved_count}) "
        f"| Uncorrected (total bookings): {show_rate_naive}% "
        f"| Cold re-engagement standard: 15–20%\n"
        f"CANCEL RATE (total bookings): {cancel_rate_total}% "
        f"| Customer-initiated only: {cancel_rate_customer}% "
        f"| Cold re-engagement benchmark: {cancel_bm}%\n"
        f"NO-SHOW RATE: {round(no_shows/resolved_count*100,1) if resolved_count else 0}%\n"
        f"\n"
        f"RAMP VS TARGET: {ramp_str}\n"
        f"\n"
        f"HEALTH: {health_score}/100 ({health_level}) | Churn risk: {churn_risk}\n"
        f"\n"
        f"OPEN PIPELINE: {pipeline_total} bookings | High risk: {high_risk} | Medium risk: {medium_risk}\n"
        f"FORECAST (likely, 30-day): {likely_bookings} bookings → {likely_shows} shows | {likely_drivers}\n"
        f"\n"
        f"TOP CANCELLATION CAUSE: {top_cause_str}\n"
        f"\n"
        f"CONVERSION VELOCITY: {direction}\n"
        f"STUDIO PERFORMANCE: {studio_str}\n"
        f"\n"
        f"DATA QUALITY: system={sys_total} bookings, manual={man_total}, "
        f"drift={drift_pct}% (status: {val_status})\n"
    )


def generate_client_insight_template(output_dir):
    """
    Build the client insight directly from data — no LLM required.
    Follows Evan's pattern: outcome → pattern → action.
    """
    bookings_path = Path(output_dir) / 'phiwe_bookings.csv'
    pipeline_path = Path(output_dir) / 'phiwe_pipeline.csv'
    rca_path      = Path(output_dir) / 'root_cause_analysis.json'
    bm_path       = Path(output_dir) / 'phiwe_benchmarks_comparison.csv'
    if not bookings_path.exists():
        return ''

    with open(bookings_path) as f:
        bookings = list(csv.DictReader(f))

    attended = sum(1 for b in bookings if str(b.get('has_show') or '').strip() == '1')
    resolved = sum(1 for b in bookings if str(b.get('is_resolved') or '').strip() == '1')
    if resolved == 0:
        resolved = sum(
            1 for b in bookings
            if str(b.get('is_past') or '').strip() == '1'
            and 'Rescheduled' not in str(b.get('current_status') or '')
        )
    show_rate    = round(attended / resolved * 100, 1) if resolved else 0
    upcoming_cnt = sum(1 for b in bookings if 'Open Booking' in str(b.get('current_status') or ''))

    # Benchmark
    bm_pct = 15.0
    if bm_path.exists():
        with open(bm_path) as f:
            for row in csv.DictReader(f):
                if row.get('metric') == 'show_rate':
                    try:
                        bm_pct = float(str(row.get('benchmark_pct', '15')).rstrip('%'))
                    except ValueError:
                        pass
                    break
    vs_bm = 'above' if show_rate > bm_pct else 'at' if abs(show_rate - bm_pct) < 1 else 'below'

    # Pattern from root cause
    pattern_text = 'when Phiwe gets a real conversation before booking, sessions hold — when she does not, they cancel'
    if rca_path.exists():
        with open(rca_path) as f:
            rca = json.load(f)
        active = [c for c in rca.get('causes', []) if (c.get('count') or 0) > 0]
        if active:
            top = max(active, key=lambda c: c['count'])
            cause = top.get('cause', '').lower()
            if 'pre-booking' in cause or 'insufficient' in cause:
                pattern_text = 'when Phiwe gets a real conversation before booking, sessions hold — when she does not, they cancel'
            elif 'window' in cause or 'far' in cause:
                pattern_text = 'leads booked far in advance cancel more often — sessions booked close to the date hold better'
            elif 'friday' in cause or 'day' in cause:
                pattern_text = 'Friday bookings cancel at higher rates — these need extra confirmation before the session'

    # Urgent leads (days_until 0–5, sorted by urgency)
    urgent_str = ''
    if pipeline_path.exists():
        with open(pipeline_path) as f:
            pipeline = list(csv.DictReader(f))
        today = __import__('datetime').date.today()
        from datetime import timedelta
        soon = [
            r for r in pipeline
            if 0 <= int(r.get('days_until') or 999) <= 5
        ]
        soon.sort(key=lambda r: (int(r.get('days_until') or 99), {'High': 0, 'Medium': 1, 'Low': 2}.get(r.get('risk_level', 'Low'), 3)))
        lead_strs = []
        for r in soon[:2]:
            fname = r.get('first_name', '')
            loc   = str(r.get('booking_location', '')).replace('StretchLab ', '').strip()
            days  = int(r.get('days_until') or 0)
            raw   = r.get('booking_date', '')
            try:
                from datetime import date as _d
                d = _d.fromisoformat(raw[:10])
                date_lbl = d.strftime('%b %-d')
            except Exception:
                date_lbl = raw
            label = 'today' if days == 0 else date_lbl
            lead_strs.append(f'{fname} at {loc} ({label})')
        if lead_strs:
            urgent_str = ' and '.join(lead_strs)

    # Assemble
    s1 = f'{attended} people showed up — {show_rate}%, {vs_bm} the {bm_pct:.0f}% standard for dormant leads.'
    s2 = f'The pattern is clear: {pattern_text}.'
    if urgent_str:
        s3 = f'Right now, {upcoming_cnt} appointment{"s" if upcoming_cnt != 1 else ""} need confirmation — start with {urgent_str}.'
    else:
        s3 = f'Right now, {upcoming_cnt} appointment{"s" if upcoming_cnt != 1 else ""} need confirmation this week.'

    return f'{s1} {s2} {s3}'


def build_client_metrics(output_dir):
    bookings_path   = Path(output_dir) / 'phiwe_bookings.csv'
    calls_path      = Path(output_dir) / 'phiwe_calls.csv'
    benchmarks_path = Path(output_dir) / 'phiwe_benchmarks_comparison.csv'
    pipeline_path   = Path(output_dir) / 'phiwe_pipeline.csv'
    if not bookings_path.exists() or not calls_path.exists():
        return ''

    with open(bookings_path) as f:
        bookings = list(csv.DictReader(f))
    with open(calls_path) as f:
        calls = list(csv.DictReader(f))

    total_calls    = len(calls)
    connections    = sum(1 for c in calls if float(c.get('live_talk_min') or 0) >= 0.5)
    attended       = sum(1 for b in bookings if str(b.get('has_show') or '').strip() == '1')
    resolved       = sum(
        1 for b in bookings
        if str(b.get('is_resolved') or '').strip() == '1'
        or (str(b.get('is_past') or '').strip() == '1'
            and 'Rescheduled' not in str(b.get('current_status') or ''))
    )
    # Deduplicate: is_resolved preferred
    if any(b.get('is_resolved') for b in bookings):
        resolved = sum(1 for b in bookings if str(b.get('is_resolved') or '').strip() == '1')

    show_rate      = round(attended / resolved * 100, 1) if resolved > 0 else 0
    upcoming       = sum(1 for b in bookings if 'Open Booking' in str(b.get('current_status') or ''))
    cust_cancelled = sum(
        1 for b in bookings
        if ('Cancelled Within Policy' in str(b.get('current_status') or '')
            or 'Cancelled Outside Policy' in str(b.get('current_status') or ''))
    )
    total_bookings = len(bookings)

    # Benchmark for show rate
    bm_show = None
    if benchmarks_path.exists():
        with open(benchmarks_path) as f:
            for row in csv.DictReader(f):
                if row.get('metric') == 'show_rate':
                    bm_show = row.get('benchmark_pct', '')
                    break

    status = 'above' if show_rate >= 32 else 'within' if show_rate >= 20 else 'below'

    # Urgent leads from pipeline (days_until 0-5, sorted by days ascending then High risk first)
    urgent_leads = []
    if pipeline_path.exists():
        with open(pipeline_path) as f:
            pipeline_rows = list(csv.DictReader(f))
        today = __import__('datetime').date.today()
        risk_order = {'High': 0, 'Medium': 1, 'Low': 2}
        upcoming_rows = [
            r for r in pipeline_rows
            if int(r.get('days_until') or 999) >= 0
        ]
        soon = [r for r in upcoming_rows if int(r.get('days_until') or 999) <= 5]
        soon.sort(key=lambda r: (int(r.get('days_until') or 99), risk_order.get(r.get('risk_level', 'Low'), 3)))
        for r in soon[:4]:
            fname = r.get('first_name', '')
            loc   = str(r.get('booking_location', '')).replace('StretchLab ', '').strip()
            days  = int(r.get('days_until') or 0)
            raw_date = r.get('booking_date', '')
            try:
                from datetime import date as _date, timedelta
                d = _date.fromisoformat(raw_date[:10])
                date_label = d.strftime('%b %-d')
            except Exception:
                date_label = raw_date
            day_label = 'today' if days == 0 else (date_label if days > 0 else 'today')
            urgent_leads.append(f'{fname} at {loc} ({day_label})')
    urgent_str = ', '.join(urgent_leads) if urgent_leads else 'check pipeline for upcoming names'

    lines = [
        'METRICS (use these exact numbers — do not substitute or round differently):',
        f'- Resolved appointments (past, outcome known): {resolved}',
        f'- Attended (confirmed show): {attended}',
        f'- Show rate (attended / resolved): {show_rate}%',
        f'- Show rate status vs benchmark: {status} the benchmark for this lead type'
        + (f' ({bm_show})' if bm_show else ''),
        f'- Upcoming appointments still in pipeline: {upcoming}',
        f'- Lead-initiated cancellations: {cust_cancelled}',
        '',
        f'URGENT LEADS (days_until 0-5, use these names and dates in sentence 3):',
        urgent_str,
    ]
    return '\n'.join(lines)


def build_studio_context(output_dir):
    bookings_path = Path(output_dir) / 'phiwe_bookings.csv'
    pipeline_path = Path(output_dir) / 'phiwe_pipeline.csv'
    if not bookings_path.exists():
        return ''

    with open(bookings_path) as f:
        bookings = list(csv.DictReader(f))

    studio_map = defaultdict(lambda: {
        'bookings': 0, 'shows': 0, 'cancelled_admin': 0, 'cancelled_all': 0,
        'is_past': 0, 'rescheduled': 0, 'upcoming': 0,
    })

    for r in bookings:
        loc = (r.get('booking_location') or r.get('Booking Location') or '').strip()
        if not loc:
            continue
        name = loc.replace('StretchLab ', '').strip()
        cs   = str(r.get('Current Status') or r.get('current_status') or '')
        is_att = str(r.get('has_show') or '').strip() == '1'

        studio_map[name]['bookings'] += 1
        if is_att:
            studio_map[name]['shows'] += 1
        elif 'Cancelled' in cs:
            studio_map[name]['cancelled_all'] += 1
            if 'By Admin' in cs:
                studio_map[name]['cancelled_admin'] += 1
        elif 'Rescheduled' in cs:
            studio_map[name]['rescheduled'] += 1
        elif 'Open Booking' in cs:
            studio_map[name]['upcoming'] += 1
        if str(r.get('is_past') or '').strip() in ('1',):
            studio_map[name]['is_past'] += 1

    lines = []
    for name, d in sorted(studio_map.items(), key=lambda x: -x[1]['bookings']):
        if d['bookings'] == 0:
            continue
        resolved = d['is_past'] - d['rescheduled']
        show_rate = f"{d['shows'] / resolved * 100:.0f}%" if resolved > 0 else 'no resolved outcomes yet'
        admin_pct = f"{d['cancelled_admin'] / d['cancelled_all'] * 100:.0f}%" if d['cancelled_all'] > 0 else '0%'
        lines.append(
            f"- {name}: {d['bookings']} bookings, {d['shows']} attended, "
            f"{resolved} resolved, show rate {show_rate}, "
            f"{d['upcoming']} upcoming, "
            f"{d['cancelled_admin']} studio-cancelled ({admin_pct} of all cancels)"
        )

    if pipeline_path.exists():
        with open(pipeline_path) as f:
            pipeline = list(csv.DictReader(f))
        high_risk = sum(1 for r in pipeline if r.get('risk_level') == 'High')
        lines.append(f"\nPipeline: {len(pipeline)} upcoming appointments, {high_risk} requiring priority follow-up")

    return '\n'.join(lines)


def main():
    load_env()

    if len(sys.argv) < 2:
        print('Usage: python generate_insights.py YYYY-MM-DD')
        sys.exit(1)

    date       = sys.argv[1]
    output_dir = f'outputs/{date}'
    api_key    = os.environ.get('GROQ_API_KEY', '')
    out_path   = f'{output_dir}/phiwe_insights.json'

    if not api_key:
        print('⚠  GROQ_API_KEY not set in .env — skipping AI insights')
        with open(out_path, 'w') as f:
            json.dump({'client': '', 'manager': '', 'admin': '', 'studio_performance': ''}, f)
        return

    print('  Building data summary...')
    try:
        summary = build_summary(output_dir)
        print('  ✓  Summary built')
        print('\n--- DATA SUMMARY ---')
        print(summary)
        print('--------------------\n')
    except Exception as e:
        print(f'  ⚠  Could not build summary: {e}')
        with open(out_path, 'w') as f:
            json.dump({'client': '', 'manager': '', 'admin': '', 'studio_performance': ''}, f)
        return

    studio_context = build_studio_context(output_dir)
    studio_user_msg = (
        f"Here is the current per-studio performance data for this campaign:\n\n"
        f"{studio_context}\n\n"
        "Write a 3-sentence client briefing based on this data. "
        "Use only the studio names and numbers above — do not invent studios, rates, or patterns not shown here. "
        "Follow the system prompt rules exactly."
    )

    client_metrics  = build_client_metrics(output_dir)
    client_user_msg = (
        f"{client_metrics}\n\n"
        "Write exactly 3 sentences. Use the METRICS numbers above — do not invent any figure. "
        "Name the urgent leads from the URGENT LEADS list in sentence 3. "
        "Follow the system prompt style rules exactly. Under 120 words total."
    )

    # Client insight: use deterministic template (not Groq) for reliable format + exact numbers
    client_insight = generate_client_insight_template(output_dir)
    if not client_insight:
        # Fallback to Groq if template fails (no data)
        client_insight = call_groq(api_key, SYSTEM_PROMPTS['client'], client_user_msg) if api_key else ''

    insights = {'client': client_insight}
    print(f'  ✓  client (template)')

    for role in ['manager', 'admin', 'studio_performance']:
        print(f'  Generating {role} insight via Groq...')
        if role == 'studio_performance':
            user_msg = studio_user_msg
        else:
            user_msg = summary
        try:
            insights[role] = call_groq(api_key, SYSTEM_PROMPTS[role], user_msg)
            print(f'  ✓  {role}')
        except Exception as e:
            print(f'  ⚠  {role} failed: {e}')
            insights[role] = ''

    with open(out_path, 'w') as f:
        json.dump(insights, f, indent=2)

    dashboard_path = 'dashboard/public/data/phiwe_insights.json'
    try:
        import shutil
        shutil.copy2(out_path, dashboard_path)
        print(f'\n  ✓  Insights saved → {out_path}')
        print(f'  ✓  Dashboard copy   → {dashboard_path}')
    except Exception as e:
        print(f'\n  ✓  Insights saved → {out_path}')
        print(f'  ⚠  Dashboard copy failed: {e} — run sync-data.sh manually')
    print('\n--- PREVIEW ---')
    for role, text in insights.items():
        print(f'\n[{role.upper()}]\n{text}')


if __name__ == '__main__':
    main()
