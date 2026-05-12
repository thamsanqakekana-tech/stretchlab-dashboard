-- setup_supabase.sql
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard/project/txpevcdoyjemswzrmzqa/sql)
-- before running upload_to_supabase.py


-- phiwe_benchmarks_comparison (5 rows)

DROP TABLE IF EXISTS "phiwe_benchmarks_comparison" CASCADE;
CREATE TABLE "phiwe_benchmarks_comparison" (
  id BIGSERIAL PRIMARY KEY,
  "metric" TEXT,
  "actual_value" NUMERIC,
  "actual_pct" TEXT,
  "benchmark_level" TEXT,
  "benchmark_pct" TEXT,
  "rank" TEXT,
  "gap_pct" TEXT,
  "status" TEXT,
  "icon" TEXT
);
ALTER TABLE "phiwe_benchmarks_comparison" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_benchmarks_comparison" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_benchmarks_comparison" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_benchmarks_comparison" FOR DELETE TO anon USING (true);



-- phiwe_booking_outcomes (12 rows)

DROP TABLE IF EXISTS "phiwe_booking_outcomes" CASCADE;
CREATE TABLE "phiwe_booking_outcomes" (
  id BIGSERIAL PRIMARY KEY,
  "booking_event" TEXT,
  "current_status" TEXT,
  "count" INTEGER,
  "percentage" NUMERIC
);
ALTER TABLE "phiwe_booking_outcomes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_booking_outcomes" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_booking_outcomes" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_booking_outcomes" FOR DELETE TO anon USING (true);



-- phiwe_booking_window_analysis (4 rows)

DROP TABLE IF EXISTS "phiwe_booking_window_analysis" CASCADE;
CREATE TABLE "phiwe_booking_window_analysis" (
  id BIGSERIAL PRIMARY KEY,
  "window_category" TEXT,
  "total_bookings" INTEGER,
  "cancelled" INTEGER,
  "shows" INTEGER,
  "cancel_rate_pct" NUMERIC,
  "show_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_booking_window_analysis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_booking_window_analysis" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_booking_window_analysis" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_booking_window_analysis" FOR DELETE TO anon USING (true);



-- phiwe_bookings (78 rows)

DROP TABLE IF EXISTS "phiwe_bookings" CASCADE;
CREATE TABLE "phiwe_bookings" (
  id BIGSERIAL PRIMARY KEY,
  "booking_id" INTEGER,
  "first_name" TEXT,
  "last_name" TEXT,
  "email" TEXT,
  "phone_clean" BIGINT,
  "booking_location" TEXT,
  "booking_date" TEXT,
  "booking_event" TEXT,
  "current_status" TEXT,
  "booking_outcome" TEXT,
  "has_show" INTEGER,
  "is_no_show" INTEGER,
  "is_scheduled" INTEGER,
  "is_cancelled" INTEGER,
  "is_cancelled_admin" INTEGER,
  "is_cancelled_customer" INTEGER,
  "is_future" INTEGER,
  "is_past" INTEGER,
  "is_resolved" INTEGER,
  "session_mins" INTEGER,
  "attribution_method" TEXT,
  "area_code" INTEGER,
  "city" TEXT,
  "state" TEXT,
  "region" TEXT,
  "booking_day_of_week" TEXT,
  "booking_hour" INTEGER,
  "days_to_booking" INTEGER
);
ALTER TABLE "phiwe_bookings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_bookings" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_bookings" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_bookings" FOR DELETE TO anon USING (true);



-- phiwe_by_area_code (269 rows)

DROP TABLE IF EXISTS "phiwe_by_area_code" CASCADE;
CREATE TABLE "phiwe_by_area_code" (
  id BIGSERIAL PRIMARY KEY,
  "area_code" INTEGER,
  "city" TEXT,
  "state" TEXT,
  "region" TEXT,
  "total_calls" INTEGER,
  "unique_leads" INTEGER,
  "bookings" INTEGER,
  "shows" INTEGER,
  "booking_rate_pct" NUMERIC,
  "show_rate_pct" NUMERIC,
  "engagement_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_by_area_code" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_by_area_code" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_by_area_code" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_by_area_code" FOR DELETE TO anon USING (true);



-- phiwe_by_studio (10 rows)

DROP TABLE IF EXISTS "phiwe_by_studio" CASCADE;
CREATE TABLE "phiwe_by_studio" (
  id BIGSERIAL PRIMARY KEY,
  "studio" TEXT,
  "bookings" INTEGER,
  "attended" INTEGER,
  "upcoming" INTEGER,
  "cancelled" INTEGER,
  "no_show" INTEGER,
  "rescheduled" INTEGER,
  "show_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_by_studio" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_by_studio" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_by_studio" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_by_studio" FOR DELETE TO anon USING (true);



-- phiwe_call_timing (50 rows)

DROP TABLE IF EXISTS "phiwe_call_timing" CASCADE;
CREATE TABLE "phiwe_call_timing" (
  id BIGSERIAL PRIMARY KEY,
  "day_of_week" TEXT,
  "hour" INTEGER,
  "total_calls" INTEGER,
  "engagement_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_call_timing" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_call_timing" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_call_timing" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_call_timing" FOR DELETE TO anon USING (true);



-- phiwe_call_timing_optimized (50 rows)

DROP TABLE IF EXISTS "phiwe_call_timing_optimized" CASCADE;
CREATE TABLE "phiwe_call_timing_optimized" (
  id BIGSERIAL PRIMARY KEY,
  "day_of_week" TEXT,
  "hour" INTEGER,
  "engagement_rate" NUMERIC,
  "total_calls" INTEGER,
  "category" TEXT
);
ALTER TABLE "phiwe_call_timing_optimized" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_call_timing_optimized" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_call_timing_optimized" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_call_timing_optimized" FOR DELETE TO anon USING (true);



-- phiwe_calls (8296 rows)

DROP TABLE IF EXISTS "phiwe_calls" CASCADE;
CREATE TABLE "phiwe_calls" (
  id BIGSERIAL PRIMARY KEY,
  "from_name" TEXT,
  "from_number" TEXT,
  "to_name" TEXT,
  "to_number" TEXT,
  "call_start_time" TEXT,
  "call_length" TEXT,
  "call_direction" TEXT,
  "call_type" TEXT,
  "call_response" TEXT,
  "result" TEXT,
  "ringing_time" TEXT,
  "live_talk_time" TEXT,
  "date" TEXT,
  "hour" INTEGER,
  "day_of_week" TEXT,
  "live_talk_min" NUMERIC,
  "ringing_min" NUMERIC,
  "call_length_min" NUMERIC,
  "is_connected" INTEGER,
  "to_number_clean" BIGINT,
  "area_code" INTEGER,
  "city" TEXT,
  "state" TEXT,
  "region" TEXT,
  "_to_norm" BIGINT
);
ALTER TABLE "phiwe_calls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_calls" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_calls" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_calls" FOR DELETE TO anon USING (true);



-- phiwe_campaign_health (18 rows)

DROP TABLE IF EXISTS "phiwe_campaign_health" CASCADE;
CREATE TABLE "phiwe_campaign_health" (
  id BIGSERIAL PRIMARY KEY,
  "metric" TEXT,
  "value" TEXT
);
ALTER TABLE "phiwe_campaign_health" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_campaign_health" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_campaign_health" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_campaign_health" FOR DELETE TO anon USING (true);



-- phiwe_cancellation_analysis (53 rows)

DROP TABLE IF EXISTS "phiwe_cancellation_analysis" CASCADE;
CREATE TABLE "phiwe_cancellation_analysis" (
  id BIGSERIAL PRIMARY KEY,
  "booking_id" INTEGER,
  "first_name" TEXT,
  "last_name" TEXT,
  "booking_location" TEXT,
  "cancelled_by" TEXT,
  "cancellation_timing" TEXT,
  "days_before_appointment" INTEGER,
  "booking_window_category" TEXT,
  "booking_window_days" INTEGER,
  "booking_day_of_week" TEXT,
  "booking_date" TEXT,
  "current_status" TEXT
);
ALTER TABLE "phiwe_cancellation_analysis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_cancellation_analysis" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_cancellation_analysis" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_cancellation_analysis" FOR DELETE TO anon USING (true);



-- phiwe_cohort_analysis (4 rows)

DROP TABLE IF EXISTS "phiwe_cohort_analysis" CASCADE;
CREATE TABLE "phiwe_cohort_analysis" (
  id BIGSERIAL PRIMARY KEY,
  "cohort" TEXT,
  "total_bookings" INTEGER,
  "shows" INTEGER,
  "cancellations" INTEGER,
  "no_shows" INTEGER,
  "show_rate" NUMERIC,
  "cancel_rate" NUMERIC,
  "no_show_rate" INTEGER,
  "insight" TEXT
);
ALTER TABLE "phiwe_cohort_analysis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_cohort_analysis" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_cohort_analysis" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_cohort_analysis" FOR DELETE TO anon USING (true);



-- phiwe_conversion_trends (15 rows)

DROP TABLE IF EXISTS "phiwe_conversion_trends" CASCADE;
CREATE TABLE "phiwe_conversion_trends" (
  id BIGSERIAL PRIMARY KEY,
  "week_start" TEXT,
  "bookings_that_week" INTEGER,
  "shows_that_week" INTEGER,
  "calls_that_week" INTEGER,
  "booking_rate_pct" NUMERIC,
  "show_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_conversion_trends" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_conversion_trends" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_conversion_trends" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_conversion_trends" FOR DELETE TO anon USING (true);



-- phiwe_daily_performance (54 rows)

DROP TABLE IF EXISTS "phiwe_daily_performance" CASCADE;
CREATE TABLE "phiwe_daily_performance" (
  id BIGSERIAL PRIMARY KEY,
  "date" TEXT,
  "outbound_calls" INTEGER,
  "total_talk_time_min" NUMERIC,
  "avg_call_duration_min" NUMERIC,
  "avg_ringing_min" NUMERIC,
  "engagement_rate_pct" NUMERIC,
  "new_bookings" INTEGER,
  "shows" INTEGER,
  "cancellations" INTEGER,
  "no_shows" INTEGER,
  "booking_rate_pct" NUMERIC,
  "show_rate_pct" NUMERIC,
  "cancel_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_daily_performance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_daily_performance" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_daily_performance" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_daily_performance" FOR DELETE TO anon USING (true);



-- phiwe_day_of_week_performance (7 rows)

DROP TABLE IF EXISTS "phiwe_day_of_week_performance" CASCADE;
CREATE TABLE "phiwe_day_of_week_performance" (
  id BIGSERIAL PRIMARY KEY,
  "day_of_week" TEXT,
  "total_bookings" INTEGER,
  "shows" INTEGER,
  "cancellations" INTEGER,
  "no_shows" INTEGER,
  "show_rate_pct" NUMERIC,
  "cancel_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_day_of_week_performance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_day_of_week_performance" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_day_of_week_performance" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_day_of_week_performance" FOR DELETE TO anon USING (true);



-- phiwe_flexologist_performance (33 rows)

DROP TABLE IF EXISTS "phiwe_flexologist_performance" CASCADE;
CREATE TABLE "phiwe_flexologist_performance" (
  id BIGSERIAL PRIMARY KEY,
  "booking_with" TEXT,
  "total_sessions" INTEGER,
  "shows" INTEGER,
  "cancellations" INTEGER,
  "no_shows" INTEGER,
  "show_rate_pct" NUMERIC,
  "cancel_rate_pct" INTEGER
);
ALTER TABLE "phiwe_flexologist_performance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_flexologist_performance" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_flexologist_performance" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_flexologist_performance" FOR DELETE TO anon USING (true);



-- phiwe_forecast_30_day (3 rows)

DROP TABLE IF EXISTS "phiwe_forecast_30_day" CASCADE;
CREATE TABLE "phiwe_forecast_30_day" (
  id BIGSERIAL PRIMARY KEY,
  "scenario" TEXT,
  "probability" NUMERIC,
  "bookings" INTEGER,
  "shows" INTEGER,
  "revenue_conservative" INTEGER,
  "revenue_average" INTEGER,
  "confidence" TEXT,
  "drivers" TEXT
);
ALTER TABLE "phiwe_forecast_30_day" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_forecast_30_day" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_forecast_30_day" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_forecast_30_day" FOR DELETE TO anon USING (true);



-- phiwe_lead_funnel (78 rows)

DROP TABLE IF EXISTS "phiwe_lead_funnel" CASCADE;
CREATE TABLE "phiwe_lead_funnel" (
  id BIGSERIAL PRIMARY KEY,
  "booking_id" INTEGER,
  "first_name" TEXT,
  "last_name" TEXT,
  "email" TEXT,
  "phone_clean" BIGINT,
  "booking_location" TEXT,
  "booking_date" TEXT,
  "booking_event" TEXT,
  "current_status" TEXT,
  "booking_outcome" TEXT,
  "has_show" INTEGER,
  "is_no_show" INTEGER,
  "is_scheduled" INTEGER,
  "is_cancelled" INTEGER,
  "is_cancelled_admin" INTEGER,
  "is_cancelled_customer" INTEGER,
  "is_future" INTEGER,
  "is_past" INTEGER,
  "is_resolved" INTEGER,
  "session_mins" INTEGER,
  "attribution_method" TEXT,
  "area_code" INTEGER,
  "city" TEXT,
  "state" TEXT,
  "region" TEXT,
  "booking_day_of_week" TEXT,
  "booking_hour" INTEGER,
  "days_to_booking" INTEGER,
  "total_calls" INTEGER,
  "first_call_date" TEXT,
  "last_call_date" TEXT,
  "has_call_record" INTEGER,
  "days_first_call_to_booking" INTEGER
);
ALTER TABLE "phiwe_lead_funnel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_lead_funnel" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_lead_funnel" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_lead_funnel" FOR DELETE TO anon USING (true);



-- phiwe_loyalsnap_engagement (2566 rows)

DROP TABLE IF EXISTS "phiwe_loyalsnap_engagement" CASCADE;
CREATE TABLE "phiwe_loyalsnap_engagement" (
  id BIGSERIAL PRIMARY KEY,
  "message_type" TEXT,
  "sent_count" INTEGER,
  "open_rate" INTEGER,
  "response_rate" INTEGER,
  "opt_out_count" INTEGER,
  "date_sent" TEXT
);
ALTER TABLE "phiwe_loyalsnap_engagement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_loyalsnap_engagement" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_loyalsnap_engagement" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_loyalsnap_engagement" FOR DELETE TO anon USING (true);



-- phiwe_pipeline (8 rows)

DROP TABLE IF EXISTS "phiwe_pipeline" CASCADE;
CREATE TABLE "phiwe_pipeline" (
  id BIGSERIAL PRIMARY KEY,
  "booking_id" INTEGER,
  "first_name" TEXT,
  "last_name" TEXT,
  "phone_clean" BIGINT,
  "email" TEXT,
  "booking_date" TEXT,
  "days_until" INTEGER,
  "booking_location" TEXT,
  "session_mins" INTEGER,
  "total_calls_made" INTEGER,
  "risk_level" TEXT,
  "attribution_method" TEXT
);
ALTER TABLE "phiwe_pipeline" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_pipeline" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_pipeline" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_pipeline" FOR DELETE TO anon USING (true);



-- phiwe_ramp_vs_target (3 rows)

DROP TABLE IF EXISTS "phiwe_ramp_vs_target" CASCADE;
CREATE TABLE "phiwe_ramp_vs_target" (
  id BIGSERIAL PRIMARY KEY,
  "month" INTEGER,
  "target_kept_appts" INTEGER,
  "actual_kept_appts" INTEGER,
  "pct_of_target" NUMERIC,
  "on_track" BOOLEAN
);
ALTER TABLE "phiwe_ramp_vs_target" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_ramp_vs_target" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_ramp_vs_target" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_ramp_vs_target" FOR DELETE TO anon USING (true);



-- phiwe_revenue_intelligence (25 rows)

DROP TABLE IF EXISTS "phiwe_revenue_intelligence" CASCADE;
CREATE TABLE "phiwe_revenue_intelligence" (
  id BIGSERIAL PRIMARY KEY,
  "metric" TEXT,
  "value" NUMERIC
);
ALTER TABLE "phiwe_revenue_intelligence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_revenue_intelligence" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_revenue_intelligence" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_revenue_intelligence" FOR DELETE TO anon USING (true);



-- phiwe_unattributed_flags (80 rows)

DROP TABLE IF EXISTS "phiwe_unattributed_flags" CASCADE;
CREATE TABLE "phiwe_unattributed_flags" (
  id BIGSERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "first_name" TEXT,
  "last_name" TEXT,
  "location" TEXT,
  "first_visit_date" TEXT,
  "cellphone" TEXT,
  "flag_reason" TEXT,
  "confidence" TEXT
);
ALTER TABLE "phiwe_unattributed_flags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_unattributed_flags" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_unattributed_flags" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_unattributed_flags" FOR DELETE TO anon USING (true);



-- phiwe_unified_leads (82 rows)

DROP TABLE IF EXISTS "phiwe_unified_leads" CASCADE;
CREATE TABLE "phiwe_unified_leads" (
  id BIGSERIAL PRIMARY KEY,
  "unified_outcome" TEXT,
  "booking_location" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "booking_date" TEXT,
  "source" TEXT,
  "held" TEXT,
  "paid" TEXT,
  "current_status" TEXT,
  "booking_made_by" TEXT
);
ALTER TABLE "phiwe_unified_leads" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_unified_leads" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_unified_leads" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_unified_leads" FOR DELETE TO anon USING (true);



-- phiwe_validation_lead_details (57 rows)

DROP TABLE IF EXISTS "phiwe_validation_lead_details" CASCADE;
CREATE TABLE "phiwe_validation_lead_details" (
  id BIGSERIAL PRIMARY KEY,
  "name" TEXT,
  "date_of_appointment" TEXT,
  "location" TEXT,
  "paid" TEXT,
  "in_system" BOOLEAN,
  "month" INTEGER,
  "notes" TEXT,
  "lead_age" TEXT,
  "prior_visits" INTEGER,
  "held" TEXT
);
ALTER TABLE "phiwe_validation_lead_details" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_validation_lead_details" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_validation_lead_details" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_validation_lead_details" FOR DELETE TO anon USING (true);



-- phiwe_velocity_trend (14 rows)

DROP TABLE IF EXISTS "phiwe_velocity_trend" CASCADE;
CREATE TABLE "phiwe_velocity_trend" (
  id BIGSERIAL PRIMARY KEY,
  "week_start" TEXT,
  "avg_calls_per_booking" NUMERIC,
  "median_days_first_call_to_booking" NUMERIC,
  "total_bookings_that_week" INTEGER
);
ALTER TABLE "phiwe_velocity_trend" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON "phiwe_velocity_trend" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_velocity_trend" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_velocity_trend" FOR DELETE TO anon USING (true);


