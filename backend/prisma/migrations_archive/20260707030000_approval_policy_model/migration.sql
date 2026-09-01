-- P5-06: Generic approval policy model
-- ApprovalPolicy: configurable approval workflows per request type
-- ApprovalPolicyStep: ordered steps within a policy, each specifying approver type

-- Enum: PolicyApproverType
CREATE TYPE "PolicyApproverType" AS ENUM ('ROLE', 'DEPARTMENT', 'ENTITY', 'USER', 'TEAM', 'AUTO');

-- Enum: PolicyConditionOperator (reserved for future conditional step logic)
CREATE TYPE "PolicyConditionOperator" AS ENUM ('AND', 'OR');

-- ApprovalPolicy table
CREATE TABLE "approval_policies" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "request_type_id" UUID NOT NULL REFERENCES "request_types"("id") ON DELETE CASCADE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "approval_policies_request_type_id_idx" ON "approval_policies"("request_type_id");
CREATE INDEX "approval_policies_tenant_id_idx" ON "approval_policies"("tenant_id");
CREATE INDEX "approval_policies_is_active_idx" ON "approval_policies"("is_active");

-- ApprovalPolicyStep table
CREATE TABLE "approval_policy_steps" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "policy_id" UUID NOT NULL REFERENCES "approval_policies"("id") ON DELETE CASCADE,
    "step_order" INTEGER NOT NULL,
    "approver_type" "PolicyApproverType" NOT NULL,
    "approver_id" UUID,
    "role_id" VARCHAR,
    "department_id" UUID,
    "entity_id" UUID,
    "team_id" VARCHAR(100),
    "label" VARCHAR(200),
    "auto_approve_if" TEXT,
    "timeout_hours" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "approval_policy_steps_policy_id_idx" ON "approval_policy_steps"("policy_id");
CREATE INDEX "approval_policy_steps_policy_id_step_order_idx" ON "approval_policy_steps"("policy_id", "step_order");

-- Add policy reference columns to RequestApproval
ALTER TABLE "request_approvals"
    ADD COLUMN "policy_id" UUID REFERENCES "approval_policies"("id"),
    ADD COLUMN "step_order" INTEGER;

CREATE INDEX "request_approvals_policy_id_idx" ON "request_approvals"("policy_id");