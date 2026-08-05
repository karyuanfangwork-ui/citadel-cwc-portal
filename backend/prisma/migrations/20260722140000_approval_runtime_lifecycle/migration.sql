-- P04 Task 16: Approval runtime lifecycle
-- Adds: approval definition versioning (DRAFT/PUBLISHED/RETIRED),
--       approval instance runtime (per-request approval flow),
--       approval instance steps (WAITING/ACTIVE/APPROVED/REJECTED/CANCELLED/TIMED_OUT),
--       parallel groups and timeout actions on policy steps.

-- 1. New enums
CREATE TYPE "ApprovalDefinitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "ApprovalStepStatus" AS ENUM ('WAITING', 'ACTIVE', 'APPROVED', 'REJECTED', 'CANCELLED', 'TIMED_OUT');
CREATE TYPE "ApprovalTimeoutAction" AS ENUM ('REMINDER', 'ESCALATE', 'REJECT');

-- 2. Add parallel_group, timeout_action, and condition columns to approval_policy_steps
ALTER TABLE "approval_policy_steps" ADD COLUMN "parallel_group" VARCHAR(50);
ALTER TABLE "approval_policy_steps" ADD COLUMN "timeout_action" "ApprovalTimeoutAction" NOT NULL DEFAULT 'REMINDER';
ALTER TABLE "approval_policy_steps" ADD COLUMN "condition" JSONB;

-- 3. Create approval_policy_versions table
CREATE TABLE "approval_policy_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ApprovalDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "published_at" TIMESTAMP(6),
    "published_by" UUID,
    "retired_at" TIMESTAMP(6),
    "retired_by" UUID,
    "effective_from" TIMESTAMP(6),
    "effective_to" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "approval_policy_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "approval_policy_versions_policy_id_version_number_key" ON "approval_policy_versions"("policy_id", "version_number");
CREATE INDEX "approval_policy_versions_policy_id_idx" ON "approval_policy_versions"("policy_id");
CREATE INDEX "approval_policy_versions_status_idx" ON "approval_policy_versions"("status");
CREATE INDEX "approval_policy_versions_policy_id_status_idx" ON "approval_policy_versions"("policy_id", "status");

-- 4. Create approval_instances table
CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "tenant_id" UUID,
    "department_id" UUID,
    "policy_version_id" UUID NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_instances_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approval_instances_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "approval_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "approval_instances_request_id_idx" ON "approval_instances"("request_id");
CREATE INDEX "approval_instances_tenant_id_idx" ON "approval_instances"("tenant_id");
CREATE INDEX "approval_instances_policy_version_id_idx" ON "approval_instances"("policy_version_id");
CREATE INDEX "approval_instances_status_idx" ON "approval_instances"("status");

-- 5. Create approval_instance_steps table
CREATE TABLE "approval_instance_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instance_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "parallel_group" VARCHAR(50),
    "approver_type" "PolicyApproverType" NOT NULL,
    "assigned_approver_id" UUID,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'WAITING',
    "decision" VARCHAR(20),
    "decision_comment" TEXT,
    "decided_at" TIMESTAMP(6),
    "decided_by" UUID,
    "delegated_by" UUID,
    "delegated_to" UUID,
    "delegated_at" TIMESTAMP(6),
    "due_at" TIMESTAMP(6),
    "timeout_action" "ApprovalTimeoutAction" NOT NULL DEFAULT 'REMINDER',
    "condition" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "approval_instance_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_instance_steps_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "approval_instance_steps_instance_id_idx" ON "approval_instance_steps"("instance_id");
CREATE INDEX "approval_instance_steps_instance_id_step_order_idx" ON "approval_instance_steps"("instance_id", "step_order");
CREATE INDEX "approval_instance_steps_assigned_approver_id_idx" ON "approval_instance_steps"("assigned_approver_id");
CREATE INDEX "approval_instance_steps_status_due_at_idx" ON "approval_instance_steps"("status", "due_at");