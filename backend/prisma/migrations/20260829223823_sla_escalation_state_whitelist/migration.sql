-- GAP-P0-01 — SLA auto-escalation may only target non-decisional states.
-- Snapshot first, then clean unsafe legacy values, then constrain new writes.

CREATE TABLE IF NOT EXISTS credit_sla_policies_pre_p0_01 AS
SELECT * FROM credit_sla_policies;

DO $$
DECLARE
  offending RECORD;
BEGIN
  FOR offending IN
    SELECT id, name, escalate_to_state
    FROM credit_sla_policies
    WHERE escalate_to_state IS NOT NULL
      AND escalate_to_state NOT IN ('COMPLIANCE_HOLD', 'REFERRED_BACK')
  LOOP
    RAISE NOTICE 'GAP-P0-01: clearing unsafe escalate_to_state "%" on policy % (%)',
      offending.escalate_to_state, offending.name, offending.id;
  END LOOP;
END $$;

UPDATE credit_sla_policies
SET escalate_to_state = NULL,
    escalate_after_hours = NULL
WHERE escalate_to_state IS NOT NULL
  AND escalate_to_state NOT IN ('COMPLIANCE_HOLD', 'REFERRED_BACK');

ALTER TABLE credit_sla_policies
  ADD CONSTRAINT credit_sla_policies_safe_escalation_state
  CHECK (
    escalate_to_state IS NULL
    OR escalate_to_state IN ('COMPLIANCE_HOLD', 'REFERRED_BACK')
  );
