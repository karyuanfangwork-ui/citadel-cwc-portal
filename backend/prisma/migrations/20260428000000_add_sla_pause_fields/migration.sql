-- AlterTable: Add SLA pause tracking fields to requests
ALTER TABLE "requests" ADD COLUMN "sla_paused_at" TIMESTAMP(6);
ALTER TABLE "requests" ADD COLUMN "sla_pause_duration_ms" BIGINT NOT NULL DEFAULT 0;

-- AlterTable: Add slaPause flag to workflow_steps
ALTER TABLE "workflow_steps" ADD COLUMN "sla_pause" BOOLEAN NOT NULL DEFAULT false;

-- Set default slaPause = true for all PENDING_*_APPROVAL statuses
UPDATE "workflow_steps" SET "sla_pause" = true WHERE "status" IN (
  'PENDING_CEO_APPROVAL',
  'PENDING_CEO_APPROVAL_IT',
  'PENDING_MANAGER_APPROVAL_IT',
  'PENDING_MANAGER_APPROVAL_FIN',
  'PENDING_MANAGER_REVIEW',
  'PENDING_VP_APPROVAL_IT',
  'PENDING_CTO_APPROVAL_IT',
  'PENDING_CFO_APPROVAL_IT',
  'PENDING_CFO_APPROVAL_FIN',
  'PENDING_FINANCE_HEAD_APPROVAL',
  'PENDING_FROM_ENTITY_APPROVAL',
  'PENDING_TO_ENTITY_APPROVAL',
  'LOA_PENDING_APPROVAL',
  'PENDING_INVOICE_IT'
);