-- setup_migration_unified_leads.sql
-- Run once in the Supabase SQL editor to add phiwe_unified_leads
-- and fix the phiwe_by_studio schema.
-- https://supabase.com/dashboard/project/txpevcdoyjemswzrmzqa/sql

-- ─── Fix phiwe_by_studio (drop old schema, recreate) ─────────────────────────
DROP TABLE IF EXISTS "phiwe_by_studio";

CREATE TABLE "phiwe_by_studio" (
  id            BIGSERIAL PRIMARY KEY,
  "studio"      TEXT,
  "bookings"    INTEGER,
  "attended"    INTEGER,
  "upcoming"    INTEGER,
  "cancelled"   INTEGER,
  "no_show"     INTEGER,
  "rescheduled" INTEGER,
  "show_rate_pct" NUMERIC
);
ALTER TABLE "phiwe_by_studio" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read"   ON "phiwe_by_studio" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_by_studio" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_by_studio" FOR DELETE TO anon USING (true);


-- ─── Create phiwe_unified_leads ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "phiwe_unified_leads" (
  id                BIGSERIAL PRIMARY KEY,
  "unified_outcome" TEXT,
  "booking_location" TEXT,
  "first_name"      TEXT,
  "last_name"       TEXT,
  "booking_date"    TEXT,
  "source"          TEXT,
  "held"            TEXT,
  "paid"            TEXT,
  "current_status"  TEXT,
  "booking_made_by" TEXT
);
ALTER TABLE "phiwe_unified_leads" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read"   ON "phiwe_unified_leads" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON "phiwe_unified_leads" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON "phiwe_unified_leads" FOR DELETE TO anon USING (true);
