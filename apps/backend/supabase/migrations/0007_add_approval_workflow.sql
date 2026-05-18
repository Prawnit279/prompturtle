-- Migration: 0007_add_approval_workflow
-- Adds ApprovalRequest and ApprovalDecision tables plus the required enums.

-- ---- Enums ----

DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM (
    'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalTrigger" AS ENUM (
    'HIGH_SHIPMENT_COST', 'LOW_HTS_CONFIDENCE', 'CARRIER_CHANGE_ON_PO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend AuditAction enum with new values (idempotent via DO block)
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVAL_REQUESTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVAL_DECIDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Tables ----

CREATE TABLE IF NOT EXISTS approval_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger     "ApprovalTrigger" NOT NULL,
  status      "ApprovalStatus"  NOT NULL DEFAULT 'PENDING',
  context     JSONB NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  decided_by  TEXT NOT NULL,
  decision    "ApprovalStatus" NOT NULL,
  note        TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Indexes ----

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status
  ON approval_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_created
  ON approval_requests(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_request
  ON approval_decisions(request_id);

-- ---- updated_at trigger ----

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
