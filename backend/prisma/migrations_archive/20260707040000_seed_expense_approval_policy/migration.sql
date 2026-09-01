-- P5-07: Seed approval policy for expense claim workflow
-- Expense Reimbursement: Manager → Finance Head (CFO) two-step approval
-- This replaces the hardcoded approval path in finance-workflow.controller.ts

-- Find the EXPENSE_CLAIM request type
WITH expense_type AS (
    SELECT id FROM request_types WHERE code = 'EXPENSE_CLAIM' LIMIT 1
)
INSERT INTO "approval_policies" (id, name, description, request_type_id, is_active, priority, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'Expense Reimbursement Approval',
    'Two-step approval: Manager review, then Finance Head (CFO) final approval',
    expense_type.id,
    true,
    0,
    now(),
    now()
FROM expense_type
ON CONFLICT DO NOTHING;

-- Insert policy steps: Step 1 = Manager, Step 2 = Finance Head
WITH policy AS (
    SELECT ap.id FROM approval_policies ap
    JOIN request_types rt ON ap.request_type_id = rt.id
    WHERE rt.code = 'EXPENSE_CLAIM' AND ap.name = 'Expense Reimbursement Approval'
    LIMIT 1
)
INSERT INTO "approval_policy_steps" (id, policy_id, step_order, approver_type, role_id, label, auto_approve_if, timeout_hours, created_at, updated_at)
SELECT
    gen_random_uuid(),
    policy.id,
    step_order,
    approver_type::"PolicyApproverType",
    role_id,
    label,
    NULL,
    timeout_hours,
    now(),
    now()
FROM policy, (
    VALUES
        (1, 'ROLE', 'MANAGER', 'Manager Approval', 48),
        (2, 'ROLE', 'CFO', 'Finance Head Approval', 72)
) AS t(step_order, approver_type, role_id, label, timeout_hours)
ON CONFLICT DO NOTHING;