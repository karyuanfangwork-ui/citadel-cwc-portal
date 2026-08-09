-- LOS-013 — Give the audit chain a deterministic total order.
--
-- appendEvent picked its predecessor with ORDER BY created_at DESC and
-- verifyChain walked ORDER BY created_at ASC. created_at is millisecond
-- precision, so two appends inside one fast transaction collide and the two
-- orderings disagree — which forks the chain. 10 of 17 seeded applications
-- failed verification for exactly this reason.
--
-- Ordering is now defined by an explicit per-application sequence number.

-- The immutability trigger from 20260810090000 denies UPDATE; this backfill is
-- a legitimate maintenance write, so take the documented bypass for the
-- duration of this (transactional) migration only.
SELECT set_config('app.audit_chain_bypass', 'on', true);

ALTER TABLE credit_audit_events ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0;

-- Backfill: (created_at, id) is the most faithful deterministic reconstruction
-- available for existing rows. Hashes are resealed in this same order by
-- `npm run audit:reseal`, so the chain verifies afterwards.
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY created_at ASC, id ASC) AS rn
  FROM credit_audit_events
)
UPDATE credit_audit_events e
SET sequence = ordered.rn
FROM ordered
WHERE e.id = ordered.id;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_audit_events_application_id_sequence_key"
  ON credit_audit_events (application_id, sequence);
