-- Rollback: 0007_add_approval_workflow
-- Removes ApprovalDecision, ApprovalRequest, and their enums.

DROP TABLE IF EXISTS approval_decisions;
DROP TABLE IF EXISTS approval_requests;

DROP TYPE IF EXISTS "ApprovalTrigger";
DROP TYPE IF EXISTS "ApprovalStatus";

-- Note: AuditAction enum values cannot be removed in PostgreSQL without a full
-- enum replacement. Leave APPROVAL_REQUESTED and APPROVAL_DECIDED in place —
-- they are harmless when the tables are gone.
