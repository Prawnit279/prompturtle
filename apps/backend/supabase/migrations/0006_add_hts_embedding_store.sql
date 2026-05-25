-- Migration 0006: Add HTS codes table + extend embedding_store
-- PR 4.1a — HTS Classifier Data Load
-- Idempotent: all changes use IF NOT EXISTS / IF EXISTS guards.

-- ---- 1. Extend embedding_store ----
-- Make tenant_id nullable (global records have NULL tenant_id, e.g. HTS codes)
ALTER TABLE embedding_store
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Add namespace column for logical partitioning ('hts-codes', 'bol-templates', etc.)
ALTER TABLE embedding_store
  ADD COLUMN IF NOT EXISTS namespace TEXT NOT NULL DEFAULT 'general';

-- Add entity_id for structured FK references (e.g. hts_codes.id)
ALTER TABLE embedding_store
  ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Make existing content/metadata nullable (new structured records won't have them)
ALTER TABLE embedding_store
  ALTER COLUMN content  DROP NOT NULL,
  ALTER COLUMN metadata DROP NOT NULL;

-- Index on namespace for namespace-scoped similarity searches
CREATE INDEX IF NOT EXISTS embedding_store_namespace_idx
  ON embedding_store (namespace);

-- ---- 2. Create hts_codes table ----
CREATE TABLE IF NOT EXISTS hts_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  description TEXT        NOT NULL,
  chapter     TEXT        NOT NULL,
  section     TEXT,
  duty_rate   TEXT,
  unit        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hts_codes_chapter_idx ON hts_codes (chapter);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hts_codes_updated_at ON hts_codes;
CREATE TRIGGER hts_codes_updated_at
  BEFORE UPDATE ON hts_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- 3. RLS for hts_codes ----
-- hts_codes is global (read-only for all authenticated users, write via service role only)
ALTER TABLE hts_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hts_codes FORCE ROW LEVEL SECURITY;

CREATE POLICY "hts_codes_read_all"
  ON hts_codes FOR SELECT
  USING (true);  -- globally readable

-- No INSERT/UPDATE/DELETE policy for app_user — only service_role can write
