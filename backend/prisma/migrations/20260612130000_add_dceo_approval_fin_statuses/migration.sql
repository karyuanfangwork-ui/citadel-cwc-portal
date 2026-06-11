-- Add DCEO approval statuses for Finance Purchase Requisition workflow
-- DCEO approval step sits between CFO and Payment Processing for amounts <= RM15,000

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_DCEO_APPROVAL_FIN';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DCEO_APPROVED_FIN';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DCEO_REJECTED_FIN';

-- Add workflow transitions for the new DCEO approval step
INSERT INTO "workflow_transitions" ("from_status", "to_status", "transition_label", "requires_comment", "is_active")
VALUES
  ('PENDING_DCEO_APPROVAL_FIN', 'DCEO_APPROVED_FIN', 'APPROVE', false, true),
  ('PENDING_DCEO_APPROVAL_FIN', 'DCEO_REJECTED_FIN', 'REJECT', true, true),
  ('DCEO_APPROVED_FIN', 'PAYMENT_PROCESSING_FIN', 'ADVANCE', false, true),
  ('DCEO_REJECTED_FIN', 'REJECTED', 'REJECT', true, true)
ON CONFLICT DO NOTHING;

-- Update CFO_APPROVED_FIN transitions to include DCEO path (amount <= threshold)
-- Note: The runtime controller handles the amount-based routing, but we add the transition
-- for validity checks and workflow visualization
INSERT INTO "workflow_transitions" ("from_status", "to_status", "transition_label", "requires_comment", "is_active")
VALUES
  ('CFO_APPROVED_FIN', 'PENDING_DCEO_APPROVAL_FIN', 'ROUTE', false, true)
ON CONFLICT DO NOTHING;