"""
Analytics Module - V5.0 Enhanced
Revenue Intelligence, Forecasting, Campaign Health, Cohort Analysis
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

from benchmarks import INDUSTRY_BENCHMARKS, assess_vs_benchmark


def calculate_revenue_intelligence(bookings, calls, monthly_cost=3500, intro_price=69):
    """
    Calculate revenue metrics using REAL StretchLab pricing
    
    Args:
        bookings: DataFrame with booking data
        calls: DataFrame with call data
        monthly_cost: Monthly cost of SDR service (default: $3,500)
        intro_price: Intro session price Phiwe books (default: $69)
    
    Returns:
        Dictionary with revenue metrics
    """
    # CRITICAL: Phiwe only books $69 intro sessions (not memberships)
    # This is the actual revenue per show, not LTV projections
    pricing = INDUSTRY_BENCHMARKS['pricing']
    economics = INDUSTRY_BENCHMARKS['economics']
    
    # Calculate actual metrics
    total_bookings = len(bookings)
    total_shows = bookings['has_show'].sum()
    total_calls = len(calls)
    
    # Revenue calculations using ACTUAL $69 intro sessions
    revenue_actual = total_shows * intro_price
    
    # Potential LTV if they convert to members (for context only)
    potential_ltv_conservative = total_shows * pricing['ltv_conservative']
    potential_ltv_average = total_shows * pricing['ltv_average']
    potential_ltv_optimistic = total_shows * pricing['ltv_optimistic']
    
    # Efficiency metrics
    cost_per_booking = monthly_cost / total_bookings if total_bookings > 0 else 0
    cost_per_show = monthly_cost / total_shows if total_shows > 0 else 0
    
    # ROI calculations (ACTUAL revenue from $69 intro sessions)
    roi_actual = (revenue_actual / monthly_cost) if monthly_cost > 0 else 0
    
    # Potential ROI if they convert to memberships (aspirational)
    roi_potential_conservative = (potential_ltv_conservative / monthly_cost) if monthly_cost > 0 else 0
    roi_potential_average = (potential_ltv_average / monthly_cost) if monthly_cost > 0 else 0
    roi_potential_optimistic = (potential_ltv_optimistic / monthly_cost) if monthly_cost > 0 else 0
    
    # CAC analysis
    cac_actual = cost_per_show
    cac_target = economics['target_cac']
    cac_gap = cac_actual - cac_target
    shows_needed_for_target = monthly_cost / cac_target if cac_target > 0 else 0
    
    # Conversion and show rates — resolved = past appointments with final outcomes
    # Excludes rescheduled rows (is_past=1 but outcome still pending)
    if 'is_resolved' in bookings.columns:
        resolved_bookings = bookings[bookings['is_resolved'] == 1]
    elif 'is_past' in bookings.columns:
        resolved_bookings = bookings[
            (bookings['is_past'] == 1) &
            (~bookings['current_status'].str.contains('Rescheduled', na=False))
        ]
    else:
        resolved_bookings = bookings
    resolved_count = len(resolved_bookings)
    conversion_rate = (total_bookings / total_calls) if total_calls > 0 else 0
    show_rate = (total_shows / resolved_count) if resolved_count > 0 else 0

    return {
        'total_bookings': total_bookings,
        'resolved_count': resolved_count,
        'total_shows': total_shows,
        'total_calls': total_calls,
        'total_cost': monthly_cost,
        'cost_per_booking': round(cost_per_booking, 2),
        'cost_per_show': round(cost_per_show, 2),
        
        # ACTUAL revenue (what Phiwe books: $69 intro sessions)
        'intro_price': intro_price,
        'revenue_actual': round(revenue_actual, 2),
        'roi_actual': round(roi_actual, 2),
        
        # POTENTIAL LTV (if intros convert to members - for context)
        'ltv_conservative': pricing['ltv_conservative'],
        'ltv_average': pricing['ltv_average'],
        'ltv_optimistic': pricing['ltv_optimistic'],
        'potential_revenue_conservative': round(potential_ltv_conservative, 2),
        'potential_revenue_average': round(potential_ltv_average, 2),
        'potential_revenue_optimistic': round(potential_ltv_optimistic, 2),
        'roi_potential_conservative': round(roi_potential_conservative, 2),
        'roi_potential_average': round(roi_potential_average, 2),
        'roi_potential_optimistic': round(roi_potential_optimistic, 2),
        
        # CAC analysis
        'cac_actual': round(cac_actual, 2),
        'cac_target': cac_target,
        'cac_gap': round(cac_gap, 2),
        'shows_needed_for_target': round(shows_needed_for_target, 1),
        
        # Rates
        'conversion_rate': round(conversion_rate, 4),
        'show_rate': round(show_rate, 4)
    }


def forecast_30_days(daily_performance):
    """
    Generate 30-day forecast with 3 scenarios
    Uses exponential smoothing on recent trends
    
    Args:
        daily_performance: DataFrame with daily metrics
    
    Returns:
        DataFrame with forecast scenarios
    """
    if len(daily_performance) < 7:
        # Not enough data for forecasting
        return pd.DataFrame({
            'scenario': ['insufficient_data'],
            'probability': [1.0],
            'bookings': [0],
            'shows': [0],
            'revenue_conservative': [0],
            'revenue_average': [0],
            'confidence': ['low']
        })
    
    # Get recent trends
    last_7_days = daily_performance.sort_values('date').tail(7)
    last_14_days = daily_performance.sort_values('date').tail(14)
    
    # Calculate daily averages
    avg_daily_bookings_7d = last_7_days['new_bookings'].mean()
    avg_daily_bookings_14d = last_14_days['new_bookings'].mean()
    
    avg_daily_shows_7d = last_7_days['shows'].mean()
    avg_daily_shows_14d = last_14_days['shows'].mean()
    
    # Show rate trends
    # Trend detection (positive or negative)
    trend_multiplier = avg_daily_bookings_7d / avg_daily_bookings_14d if avg_daily_bookings_14d > 0 else 1.0
    
    # LIKELY scenario (50% probability)
    # Assumes current trends continue with slight improvement
    likely_daily_bookings = avg_daily_bookings_7d * 1.05  # +5% improvement
    likely_daily_shows = avg_daily_shows_7d * 1.10  # +10% show rate improvement
    
    likely_bookings = round(likely_daily_bookings * 30)
    likely_shows = round(likely_daily_shows * 30)
    
    # PESSIMISTIC scenario (25% probability)
    # Assumes deterioration or setbacks
    pessimistic_bookings = round(likely_bookings * 0.85)  # -15%
    pessimistic_shows = round(likely_shows * 0.50)  # -50% (high cancellations)
    
    # OPTIMISTIC scenario (25% probability)
    # Assumes all improvements executed successfully
    optimistic_bookings = round(likely_bookings * 1.38)  # +38%
    optimistic_shows = round(likely_shows * 1.67)  # +67% (better show rate)
    
    # Revenue calculations (using real StretchLab LTV)
    ltv_conservative = INDUSTRY_BENCHMARKS['pricing']['ltv_conservative']
    ltv_average = INDUSTRY_BENCHMARKS['pricing']['ltv_average']
    
    scenarios = []
    
    scenarios.append({
        'scenario': 'pessimistic',
        'probability': 0.25,
        'bookings': pessimistic_bookings,
        'shows': pessimistic_shows,
        'revenue_conservative': pessimistic_shows * ltv_conservative,
        'revenue_average': pessimistic_shows * ltv_average,
        'confidence': 'medium',
        'drivers': 'High-risk pipeline cancels, Brighton stays dormant, no improvements'
    })
    
    scenarios.append({
        'scenario': 'likely',
        'probability': 0.50,
        'bookings': likely_bookings,
        'shows': likely_shows,
        'revenue_conservative': likely_shows * ltv_conservative,
        'revenue_average': likely_shows * ltv_average,
        'confidence': 'high',
        'drivers': 'Current trends continue, confirmation calls improve, Houston stable'
    })
    
    scenarios.append({
        'scenario': 'optimistic',
        'probability': 0.25,
        'bookings': optimistic_bookings,
        'shows': optimistic_shows,
        'revenue_conservative': optimistic_shows * ltv_conservative,
        'revenue_average': optimistic_shows * ltv_average,
        'confidence': 'medium',
        'drivers': 'All improvements executed, Brighton activated, Houston test succeeds'
    })
    
    return pd.DataFrame(scenarios)


def score_campaign_health(bookings, calls, monthly_cost=3500, ramp_df=None):
    """
    Calculate overall campaign health score (0-100)
    
    Components:
    - Performance (50 points): ROI, volume, show rate
    - Engagement (25 points): Placeholder for login/usage tracking
    - Goal Alignment (25 points): Placeholder for goal tracking
    
    Args:
        bookings: DataFrame with booking data
        calls: DataFrame with call data
        monthly_cost: Monthly SDR cost
    
    Returns:
        Dictionary with health score and breakdown
    """
    score = 0
    breakdown = {}
    
    # PERFORMANCE SCORE (max 50 points)
    performance_score = 0
    
    # 1. ROI (max 25 points)
    revenue = calculate_revenue_intelligence(bookings, calls, monthly_cost, intro_price=69)
    roi = revenue.get('roi_actual', 0)
    if roi >= 2.0:  # 200%+ ROI
        performance_score += 25
    elif roi >= 1.5:
        performance_score += 20
    elif roi >= 1.0:
        performance_score += 15
    else:
        performance_score += 10
    
    # 2. Booking volume (max 15 points)
    if revenue['total_bookings'] >= 40:
        performance_score += 15
    elif revenue['total_bookings'] >= 30:
        performance_score += 10
    else:
        performance_score += 5
    
    # 3. Show rate (max 10 points)
    show_rate = revenue['show_rate']
    show_benchmark = assess_vs_benchmark(show_rate, 'show_rate', higher_is_better=True)
    if show_benchmark['status'] == 'excellent':
        performance_score += 10
    elif show_benchmark['status'] == 'good':
        performance_score += 7
    elif show_benchmark['status'] == 'average':
        performance_score += 5
    else:
        performance_score += 0
    
    breakdown['performance'] = {
        'score': performance_score,
        'max': 50,
        'components': {
            'roi': f"{roi:.0%}",
            'bookings': revenue['total_bookings'],
            'show_rate': f"{show_rate:.1%}"
        }
    }
    score += performance_score
    
    # ENGAGEMENT SCORE (max 25 points) — driven by average ramp attainment %
    if ramp_df is not None and len(ramp_df) > 0 and 'pct_of_target' in ramp_df.columns:
        avg_ramp_pct = ramp_df['pct_of_target'].mean() / 100  # convert % to decimal
        engagement_score = min(25, round(avg_ramp_pct * 25))
        engagement_note = f"Avg ramp attainment: {avg_ramp_pct:.0%}"
    else:
        engagement_score = 0
        engagement_note = 'Ramp data unavailable — score withheld'
    breakdown['engagement'] = {
        'score': engagement_score,
        'max': 25,
        'note': engagement_note
    }
    score += engagement_score

    # GOAL ALIGNMENT SCORE (max 25 points) — months on track / total months
    if ramp_df is not None and len(ramp_df) > 0 and 'on_track' in ramp_df.columns:
        months_on_track = int(ramp_df['on_track'].sum())
        total_months = len(ramp_df)
        goal_score = round((months_on_track / total_months) * 25) if total_months > 0 else 0
        goal_note = f"{months_on_track}/{total_months} months on track"
    else:
        goal_score = 0
        goal_note = 'Ramp data unavailable — score withheld'
    breakdown['goal_alignment'] = {
        'score': goal_score,
        'max': 25,
        'note': goal_note
    }
    score += goal_score
    
    # Overall assessment
    if score >= 80:
        level = 'GREEN'
        churn_risk = 'LOW'
    elif score >= 60:
        level = 'YELLOW'
        churn_risk = 'MEDIUM'
    else:
        level = 'RED'
        churn_risk = 'HIGH'
    
    return {
        'total_score': score,
        'max_score': 100,
        'level': level,
        'churn_risk': churn_risk,
        'churn_risk_pct': 0.35 if level == 'YELLOW' else (0.50 if level == 'RED' else 0.15),
        'breakdown': breakdown,
        'recommendations': [
            'Schedule quarterly business review' if goal_score < 15 else None,
            'Define Q2 success metrics' if goal_score < 20 else None,
            'Increase show rate initiatives' if performance_score < 40 else None,
            'Improve client engagement' if engagement_score < 15 else None
        ]
    }


def analyze_cohorts(bookings):
    """
    Analyze fast vs slow converters
    
    Args:
        bookings: DataFrame with booking data including days_to_booking
    
    Returns:
        DataFrame with cohort analysis
    """
    if 'days_to_booking' not in bookings.columns:
        return pd.DataFrame()
    
    # Clean data
    valid_bookings = bookings[bookings['days_to_booking'].notna()].copy()
    
    if len(valid_bookings) == 0:
        return pd.DataFrame()
    
    # Define cohorts
    valid_bookings['cohort'] = pd.cut(
        valid_bookings['days_to_booking'],
        bins=[-1, 3, 7, 14, 30, 999],
        labels=['Fast (0-3 days)', 'Quick (3-7 days)', 'Optimal (7-14 days)', 'Slow (14-30 days)', 'Very Slow (30+ days)']
    )
    
    # Aggregate by cohort
    cohort_analysis = valid_bookings.groupby('cohort', observed=True).agg({
        'booking_id': 'count',
        'has_show': 'sum',
        'is_cancelled': 'sum',
        'is_no_show': 'sum'
    }).reset_index()
    
    cohort_analysis.columns = ['cohort', 'total_bookings', 'shows', 'cancellations', 'no_shows']
    
    # Calculate rates
    cohort_analysis['show_rate'] = (cohort_analysis['shows'] / cohort_analysis['total_bookings']).fillna(0)
    cohort_analysis['cancel_rate'] = (cohort_analysis['cancellations'] / cohort_analysis['total_bookings']).fillna(0)
    cohort_analysis['no_show_rate'] = (cohort_analysis['no_shows'] / cohort_analysis['total_bookings']).fillna(0)
    
    # Add insights
    cohort_analysis['insight'] = cohort_analysis.apply(lambda row: 
        'Impulsive bookers - higher cancel risk' if 'Fast' in str(row['cohort']) else
        'Trust built - lower cancel risk' if 'Optimal' in str(row['cohort']) else
        'Too far out - commitment fades' if 'Slow' in str(row['cohort']) or 'Very Slow' in str(row['cohort']) else
        'Quick decision - moderate risk',
        axis=1
    )
    
    return cohort_analysis


def analyze_call_timing(call_timing_data):
    """
    Find optimal call times
    
    Args:
        call_timing_data: DataFrame with hour/day performance
    
    Returns:
        DataFrame with recommendations
    """
    if len(call_timing_data) == 0:
        return pd.DataFrame()
    
    # Check which engagement column exists
    if 'engagement_rate' in call_timing_data.columns:
        engagement_col = 'engagement_rate'
    elif 'engagement_rate_pct' in call_timing_data.columns:
        engagement_col = 'engagement_rate_pct'
        # Convert percentage to decimal if needed
        if call_timing_data[engagement_col].max() > 1:
            call_timing_data = call_timing_data.copy()
            call_timing_data['engagement_rate'] = call_timing_data[engagement_col] / 100
            engagement_col = 'engagement_rate'
    else:
        # No engagement rate column found
        return pd.DataFrame()
    
    # Sort by engagement rate
    sorted_timing = call_timing_data.sort_values(engagement_col, ascending=False)
    
    # Categorize (using decimal values)
    engagement_values = sorted_timing[engagement_col].values
    max_val = engagement_values.max()
    
    # 5-tier categories match frontend heatmap thresholds exactly:
    # ≥24.5% → Golden Hours  |  20–24.5% → High  |  15–20% → Medium
    # 10–15% → Low           |  <10% → Very Low
    sorted_timing = sorted_timing.copy()
    if max_val > 1:
        # Values are already percentages (0–100 range)
        bins   = [-1, 10, 15, 20, 24.5, 200]
    else:
        bins   = [-0.001, 0.10, 0.15, 0.20, 0.245, 2.0]
    labels = ['Very Low', 'Low', 'Medium', 'High', 'Golden Hours']

    sorted_timing['category'] = pd.cut(
        sorted_timing[engagement_col],
        bins=bins,
        labels=labels,
    )

    return sorted_timing[['day_of_week', 'hour', engagement_col, 'total_calls', 'category']]


def validate_cancellation_counts(bookings):
    """
    Cross-reference cancellation counts to explain the is_cancelled=34 vs did-not-proceed=28 split.

    The discrepancy is intentional and correct:
    - 6 bookings have has_show=1 AND is_cancelled=1 — these leads attended, but a studio admin
      later changed their status to Cancelled in ClubReady. They are correctly counted as
      attended (not as cancellations) for the accountability sentence.
    - 28 bookings are pure cancellations (did not attend).
    - root_cause_analysis uses all 34 for pipeline operations (correct for that use case).

    Returns:
        dict with reconciled counts and explanation.
    """
    total           = len(bookings)
    flagged_cancel  = int(bookings['is_cancelled'].sum())
    has_show_col    = bookings['has_show'] if 'has_show' in bookings.columns else pd.Series(0, index=bookings.index)
    cust_cancel     = int(bookings['is_cancelled_customer'].sum()) if 'is_cancelled_customer' in bookings.columns else 0
    admin_cancel    = int(bookings['is_cancelled_admin'].sum())    if 'is_cancelled_admin'    in bookings.columns else 0

    # Bookings that attended despite having a Cancelled status (admin-updated post-session)
    attended_but_cancelled = int(((bookings['is_cancelled'] == 1) & (has_show_col == 1)).sum())

    # Pure cancellations: did not attend and are cancelled
    pure_cancellations = flagged_cancel - attended_but_cancelled

    result = {
        'total_bookings':           total,
        'is_cancelled_flag_total':  flagged_cancel,    # 34 — used by root_cause_analysis
        'attended_with_cancel_status': attended_but_cancelled,  # 6 — attended, status admin-changed
        'pure_cancellations':       pure_cancellations,  # 28 — correct for accountability sentence
        'customer_initiated':       cust_cancel,
        'admin_initiated':          admin_cancel,
        'explanation': (
            f"Of {flagged_cancel} bookings flagged is_cancelled=1, {attended_but_cancelled} also have "
            f"has_show=1 — these leads attended but an admin changed their status afterward. "
            f"The dashboard 'did not proceed' count is {pure_cancellations} (attended excluded). "
            f"root_cause_analysis uses {flagged_cancel} (all flags) for pipeline operations."
        ),
    }

    print("\n=== CANCELLATION COUNT VALIDATION ===")
    print(f"  Total bookings:                  {total}")
    print(f"  is_cancelled=1 (raw flag):       {flagged_cancel}")
    print(f"    attended + cancelled status:   {attended_but_cancelled}  ← attended; excluded from 'did not proceed'")
    print(f"    pure cancellations:            {pure_cancellations}  ← correct for accountability sentence")
    print(f"  customer-initiated:              {cust_cancel}")
    print(f"  admin-initiated:                 {admin_cancel}")
    if flagged_cancel != cust_cancel + admin_cancel:
        print(f"  ⚠  split {cust_cancel}+{admin_cancel}={cust_cancel+admin_cancel} ≠ {flagged_cancel}")
    else:
        print("  ✓  customer + admin sums to total cancelled")
    return result


if __name__ == '__main__':
    print("Analytics module loaded successfully!")
    print("\nAvailable functions:")
    print("- calculate_revenue_intelligence()")
    print("- forecast_30_days()")
    print("- score_campaign_health()")
    print("- analyze_cohorts()")
    print("- analyze_call_timing()")
    print("- validate_cancellation_counts()")
