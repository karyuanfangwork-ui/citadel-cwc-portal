-- P5-08: Approval delegation, fallback/reminders, and timeout tracking
-- Extends RequestApproval with delegation fields, reminder counters, and due dates
-- Adds ApprovalDelegation log and ApprovalReminder tracking tables

-- Add delegation, reminder, and timeout columns to request_approvals
ALTER TABLE "request_approvals"
    ADD COLUMN "delegated_by" UUID REFERENCES "users"("id"),
    ADD COLUMN "delegated_to" UUID REFERENCES "users"("id"),
    ADD COLUMN "delegated_at" TIMESTAMP(6),
    ADD COLUMN "reminder_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "last_reminder_at" TIMESTAMP(6),
    ADD COLUMN "due_at" TIMESTAMP(6);

-- Create indexes for new columns
CREATE INDEX "request_approvals_delegated_by_idx" ON "request_approvals"("delegated_by");
CREATE INDEX "request_approvals_delegated_to_idx" ON "request_approvals"("delegated_to");
CREATE INDEX "request_approvals_status_due_at_idx" ON "request_approvals"("status", "due_at");

-- ApprovalDelegation table
CREATE TABLE "approval_delegations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "approval_id" UUID NOT NULL REFERENCES "request_approvals"("id") ON DELETE CASCADE,
    "from_user_id" UUID NOT NULL REFERENCES "users"("id"),
    "to_user_id" UUID NOT NULL REFERENCES "users"("id"),
    "reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "approval_delegations_approval_id_idx" ON "approval_delegations"("approval_id");
CREATE INDEX "approval_delegations_from_user_id_idx" ON "approval_delegations"("from_user_id");
CREATE INDEX "approval_delegations_to_user_id_idx" ON "approval_delegations"("to_user_id");

-- ApprovalReminder table
CREATE TABLE "approval_reminders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "approval_id" UUID NOT NULL REFERENCES "request_approvals"("id") ON DELETE CASCADE,
    "recipient_user_id" UUID NOT NULL REFERENCES "users"("id"),
    "type" VARCHAR(20) NOT NULL,  -- 'FIRST', 'SECOND', 'ESCALATION'
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "approval_reminders_approval_id_idx" ON "approval_reminders"("approval_id");
CREATE INDEX "approval_reminders_recipient_user_id_idx" ON "approval_reminders"("recipient_user_id");