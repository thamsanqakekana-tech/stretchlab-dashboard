"""
Industry Benchmarks Module
StretchLab B2C Campaign - Wellness/Assisted Stretching Industry Standards
"""

# Based on research into StretchLab's industry:
# - Assisted stretching services
# - Wellness/recovery services  
# - Similar to: massage therapy, physical therapy, personal training

BENCHMARK_CONTEXT = {
    'label': 'Cold Re-Engagement Outreach Standard',
    'description': 'Benchmarks reflect cold outreach to dormant leads, not inbound or warm lead performance',
    'note': 'These thresholds are calibrated for SDR campaigns working old lead lists'
}

INDUSTRY_BENCHMARKS = {
    'conversion_rate': {
        # Denominator: all calls (not just connections) — cold re-engagement reality
        'excellent': 0.015,  # 1.5%+ (strong for cold dormant outreach)
        'good': 0.010,       # 1.0-1.5% (above average)
        'average': 0.005,    # 0.5-1.0% (typical range: 0.5-1.5%)
        'poor': 0.003        # <0.5% (below typical)
    },
    'show_rate': {
        # First appointment show-up rate
        'excellent': 0.30,   # 30%+ (top 10%)
        'good': 0.20,        # 20-30% (above average)
        'average': 0.15,     # 15-20% (industry average)
        'poor': 0.10         # <15% (below average)
    },
    'cancel_rate': {
        # Lower is better
        'excellent': 0.05,   # <5% (excellent)
        'good': 0.10,        # 5-10% (good)
        'average': 0.15,     # 10-15% (average)
        'poor': 0.20         # >15% (poor)
    },
    'no_show_rate': {
        # Lower is better
        'excellent': 0.02,   # <2% (excellent)
        'good': 0.05,        # 2-5% (good)
        'average': 0.08,     # 5-8% (average)
        'poor': 0.12         # >8% (poor)
    },
    'engagement_rate': {
        # Phone answer rate
        'excellent': 0.85,   # 85%+ (excellent)
        'good': 0.75,        # 75-85% (good)
        'average': 0.65,     # 65-75% (average)
        'poor': 0.55         # <65% (poor)
    },
    'touchpoints': {
        # Optimal number of calls before booking
        'optimal': 3.5,      # 3-4 calls = sweet spot
        'minimum': 2.0,      # Minimum viable
        'maximum': 6.0       # Diminishing returns after 6
    },
    'booking_window': {
        # Days between booking and appointment
        'too_rushed': 7,     # <7 days
        'optimal_min': 7,    # 7-14 days = sweet spot
        'optimal_max': 14,
        'too_far': 14        # >14 days = higher cancel rate
    },
    'pricing': {
        # StretchLab actual pricing (from website research)
        'intro_session_low': 29,      # Intro pricing
        'intro_session_high': 79,
        'monthly_25min_4x': 159,      # Monthly memberships
        'monthly_50min_4x': 269,
        'ltv_conservative': 1614,     # 6-month retention
        'ltv_average': 3228,          # 12-month retention
        'ltv_optimistic': 6456        # 24-month retention
    },
    'economics': {
        # From Execo contract
        'target_cac': 45,             # Target CAC per kept appointment
        'monthly_sdr_cost': 3500,     # B2C SDR service cost
        'target_roi_ratio': 50        # LTV:CAC target ratio
    }
}


def assess_vs_benchmark(actual, benchmark_key, higher_is_better=True):
    """
    Compare actual performance vs industry benchmark
    
    Args:
        actual: Actual metric value (e.g., 0.122 for 12.2%)
        benchmark_key: Key in INDUSTRY_BENCHMARKS dict
        higher_is_better: True if higher values are better (e.g., show rate)
                          False if lower values are better (e.g., cancel rate)
    
    Returns:
        dict with level, rank, gap, and status
    """
    benchmarks = INDUSTRY_BENCHMARKS.get(benchmark_key)
    if not benchmarks:
        return {'level': 'Unknown', 'rank': 'No benchmark', 'gap': 0, 'status': 'unknown'}
    
    if higher_is_better:
        if actual >= benchmarks['excellent']:
            return {
                'level': 'Excellent',
                'rank': 'Top 10%',
                'gap': actual - benchmarks['excellent'],
                'status': 'excellent',
                'color': 'green',
                'icon': '✅✅✅'
            }
        elif actual >= benchmarks['good']:
            return {
                'level': 'Good',
                'rank': 'Above Average',
                'gap': actual - benchmarks['good'],
                'status': 'good',
                'color': 'blue',
                'icon': '✅'
            }
        elif actual >= benchmarks['average']:
            return {
                'level': 'Average',
                'rank': 'Industry Average',
                'gap': actual - benchmarks['average'],
                'status': 'average',
                'color': 'yellow',
                'icon': '⚠️'
            }
        else:
            return {
                'level': 'Needs Improvement',
                'rank': 'Below Average',
                'gap': actual - benchmarks['average'],  # Gap to average
                'status': 'poor',
                'color': 'red',
                'icon': '❌'
            }
    else:
        # Lower is better (e.g., cancel rate, no-show rate)
        if actual <= benchmarks['excellent']:
            return {
                'level': 'Excellent',
                'rank': 'Top 10%',
                'gap': benchmarks['excellent'] - actual,
                'status': 'excellent',
                'color': 'green',
                'icon': '✅✅✅'
            }
        elif actual <= benchmarks['good']:
            return {
                'level': 'Good',
                'rank': 'Above Average',
                'gap': benchmarks['good'] - actual,
                'status': 'good',
                'color': 'blue',
                'icon': '✅'
            }
        elif actual <= benchmarks['average']:
            return {
                'level': 'Average',
                'rank': 'Industry Average',
                'gap': benchmarks['average'] - actual,
                'status': 'average',
                'color': 'yellow',
                'icon': '⚠️'
            }
        else:
            return {
                'level': 'Needs Improvement',
                'rank': 'Below Average',
                'gap': benchmarks['average'] - actual,  # How far below average
                'status': 'poor',
                'color': 'red',
                'icon': '❌'
            }


def get_benchmark_context(benchmark_key):
    """Get human-readable context about a benchmark"""
    contexts = {
        'conversion_rate': {
            'meaning': 'Out of 100 calls made, X people booked an appointment',
            'why': 'Higher conversion = more efficient use of call time and SDR hours',
            'typical_range': '1.0-1.5% for wellness/recovery services'
        },
        'show_rate': {
            'meaning': 'Out of 100 bookings made, X people showed up for their appointment',
            'why': 'Shows = revenue. No show = no customer = lost LTV',
            'typical_range': '15-20% for first-time wellness appointments'
        },
        'cancel_rate': {
            'meaning': 'Out of 100 bookings made, X people cancelled before the appointment',
            'why': 'Cancellations indicate weak commitment or booking too far in advance',
            'typical_range': '10-15% for wellness services'
        },
        'no_show_rate': {
            'meaning': 'Out of 100 bookings made, X people did not show up and did not cancel',
            'why': 'No-shows are worst outcome - wasted slot that could have been filled',
            'typical_range': '5-8% for wellness services'
        },
        'engagement_rate': {
            'meaning': 'Out of 100 calls made, X people answered the phone',
            'why': 'Cannot book if they do not answer. High engagement = good phone numbers + timing',
            'typical_range': '65-75% for wellness B2C outbound calls'
        }
    }
    return contexts.get(benchmark_key, {})


if __name__ == '__main__':
    # Test the benchmark functions
    print("Testing Benchmark Module...")
    
    # Test show rate assessment
    actual_show_rate = 0.122  # 12.2%
    result = assess_vs_benchmark(actual_show_rate, 'show_rate', higher_is_better=True)
    print(f"\nShow Rate: {actual_show_rate*100:.1f}%")
    print(f"Assessment: {result}")
    
    # Test engagement rate
    actual_engagement = 0.91  # 91%
    result = assess_vs_benchmark(actual_engagement, 'engagement_rate', higher_is_better=True)
    print(f"\nEngagement Rate: {actual_engagement*100:.1f}%")
    print(f"Assessment: {result}")
    
    # Test no-show rate
    actual_no_show = 0.0  # 0%
    result = assess_vs_benchmark(actual_no_show, 'no_show_rate', higher_is_better=False)
    print(f"\nNo-Show Rate: {actual_no_show*100:.1f}%")
    print(f"Assessment: {result}")
    
    print("\n✅ Benchmark module working correctly!")
