"""
StretchLab B2C Pipeline - Configuration (V3.0)
Central configuration for pipeline processing
"""

# Column mappings for Custom RingCentral Report format
CALL_COLUMNS = {
    'Date-Time': 'call_start_time',
    'From Name': 'from_name',
    'From Number': 'from_number',
    'To Name': 'to_name',
    'To Number': 'to_number',
    'Length': 'call_length',
    'Direction': 'call_direction',
    'Result': 'result',
    'Call Type': 'call_type',
    'Call Response': 'call_response',
    'Ringing': 'ringing_time',
    'Live Talk': 'live_talk_time'
}

# Booking status mappings
BOOKING_STATUS_MAPPINGS = {
    'completed': ['Completed Booking'],
    'cancelled': ['Cancelled Within Policy Rules', 'Cancelled Outside Policy Rules', 
                  'Cancelled By Admin'],
    'no_show': ['No Show Booking'],
    'scheduled': ['Open Booking - not yet logged'],
    'rescheduled': ['Rescheduled By Admin']
}

# Session types
SESSION_TYPES = [25, 50]  # minutes

# V3.0: Metrics to exclude from client view
CLIENT_HIDDEN_METRICS = [
    'first_visits',           # Client rejected - not enough data
    'first_visit_rate',       # Client rejected
    'percentiles',            # Too complex for client
    'engagement_rate',        # Internal metric
    'ringing_time',           # Internal metric
    'days_call_to_booking',   # Internal only
    'days_booking_to_show',   # Internal only
    'reschedule_rate',        # Internal only
    'attribution_percentage'  # Too technical for client
]

# Dashboard access levels
ACCESS_LEVELS = {
    'client': {
        'domain': '@stretchlab.com',
        'pages': ['Overview', 'Performance', 'Pipeline', 'By Studio'],
        'hidden_metrics': CLIENT_HIDDEN_METRICS,
        'messaging': 'constructive'  # "Opportunity for improvement"
    },
    'internal': {
        'domain': '@execo.com',
        'pages': ['Overview', 'Performance', 'Pipeline', 'Attribution', 'By Studio'],
        'hidden_metrics': [],  # Show everything
        'messaging': 'honest'  # "CRITICAL ALERT" when needed
    },
    'admin': {
        'email': 'thamsanqa.kekana@execo.com',
        'pages': ['Overview', 'Performance', 'Pipeline', 'Attribution', 'By Studio', 'Admin'],
        'hidden_metrics': [],
        'messaging': 'honest',
        'features': ['data_upload', 'validation_log', 'manual_tracker_comparison']
    }
}

# Benchmark values
BENCHMARKS = {
    'show_rate': {
        'industry_min': 60,
        'industry_max': 70,
        'target': 65
    },
    'booking_rate': {
        'industry_min': 1,
        'industry_max': 3,
        'target': 2
    },
    'cancel_rate': {
        'industry_max': 20,  # < 20% is good
        'target': 15
    },
    'engagement_rate': {
        'industry_min': 60,  # % of calls answered
        'target': 70
    }
}

# Validation thresholds
VALIDATION_THRESHOLDS = {
    'attribution_gap_pct': 10,  # Max acceptable % of bookings without calls
    'manual_tracker_drift_pct': 10,  # Max acceptable drift from manual tracker
    'min_calls_per_day': 50,  # Alert if < 50 calls/day
    'max_cancel_rate': 80  # Alert if > 80% cancel rate
}

# Output file names
OUTPUT_FILES = {
    'daily': 'phiwe_daily_performance.csv',
    'funnel': 'phiwe_lead_funnel.csv',
    'pipeline': 'phiwe_pipeline.csv',
    'by_studio': 'phiwe_by_studio.csv'  # V3.0: NEW
}

# V3.0: New metrics enabled
NEW_METRICS_V3 = [
    'live_talk_time',      # Actual conversation time
    'ringing_time',        # Pre-answer duration
    'engagement_rate',     # % calls answered
    'no_show_rate',        # Separate from cancel
    'reschedule_rate',     # Booking quality
    'session_type',        # 25min vs 50min
    'performance_by_studio',  # Location breakdown
    'days_booking_to_show'    # Show lag time
]

# Expected data ranges (for validation)
DATA_RANGES = {
    'call_length_min': (0, 60),  # 0-60 minutes
    'live_talk_min': (0, 60),
    'ringing_min': (0, 10),
    'engagement_rate_pct': (0, 100),
    'show_rate_pct': (0, 100),
    'cancel_rate_pct': (0, 100),
    'session_mins': [25, 50]
}

# Leads confirmed by Tamryn Montgomery (2026-05-07) to be attributed to Phiwe.
# Booked or logged under a different staff member — verified attended.
# Add entries here when Tamryn confirms a lead that the pipeline cannot auto-attribute.
FORCE_ATTRIBUTED_LEADS = [
    {
        'user_id': '120048240',
        'first_name': 'Timothy',
        'last_name': 'Cooper',
        'booking_date': '2026-03-21',
        'reason': 'Phiwe called this number; booking logged under different attribution. Confirmed Tamryn 2026-05-07.',
    },
    {
        'user_id': None,
        'first_name': 'Cathy',
        'last_name': 'Barazi',
        'booking_date': '2026-04-11',
        'reason': 'Booked by internal team member. Confirmed Tamryn 2026-05-07.',
    },
]

# Client feedback implementation flags
CLIENT_FEEDBACK = {
    'first_visits_removed': True,  # Client: "Not enough shows, focus on everything else"
    'percentiles_hidden_from_client': True,  # Client: "Too complex"
    'by_studio_added': True,  # Client requested for Brian
    'week_over_week_comparison': 'pending',  # Dashboard feature
    'date_range_filter': 'pending'  # Dashboard feature (being fixed)
}
