-- setup_partnership.sql
-- Run once in the Supabase SQL editor before using the Partnership Actions page.
-- https://supabase.com/dashboard/project/txpevcdoyjemswzrmzqa/sql

-- ─── Checklist completion state ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partnership_actions (
  item_key   TEXT PRIMARY KEY,
  checked    BOOLEAN DEFAULT FALSE,
  checked_by TEXT,
  checked_at TIMESTAMPTZ
);

ALTER TABLE partnership_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partnership_actions' AND policyname = 'anon select'
  ) THEN
    CREATE POLICY "anon select" ON partnership_actions FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partnership_actions' AND policyname = 'anon insert'
  ) THEN
    CREATE POLICY "anon insert" ON partnership_actions FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partnership_actions' AND policyname = 'anon update'
  ) THEN
    CREATE POLICY "anon update" ON partnership_actions FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── Notes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partnership_notes (
  id         BIGSERIAL PRIMARY KEY,
  content    TEXT NOT NULL,
  author     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE partnership_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partnership_notes' AND policyname = 'anon select'
  ) THEN
    CREATE POLICY "anon select" ON partnership_notes FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partnership_notes' AND policyname = 'anon insert'
  ) THEN
    CREATE POLICY "anon insert" ON partnership_notes FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
