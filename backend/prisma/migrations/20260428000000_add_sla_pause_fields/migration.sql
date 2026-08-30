-- The workflow tables pre-date this migration in deployed databases but were
-- missing from the repository's migration baseline. Define them here so a
-- fresh shadow database can replay the complete history.
CREATE TABLE IF NOT EXISTS "workflow_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "workflow_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_types_code_key" ON "workflow_types"("code");

CREATE TABLE IF NOT EXISTS "workflow_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_type_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "status" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) NOT NULL DEFAULT 'radio_button_checked',
    "display_order" INTEGER NOT NULL,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "sla_pause" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workflow_steps_workflow_type_id_fkey" FOREIGN KEY ("workflow_type_id") REFERENCES "workflow_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_steps_workflow_type_id_status_key" ON "workflow_steps"("workflow_type_id", "status");
CREATE INDEX IF NOT EXISTS "workflow_steps_workflow_type_id_idx" ON "workflow_steps"("workflow_type_id");

-- AlterTable: Add SLA pause tracking fields to requests
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP(6);
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "sla_pause_duration_ms" BIGINT NOT NULL DEFAULT 0;

-- Set default sla_pause = true for all PENDING_*_APPROVAL statuses
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