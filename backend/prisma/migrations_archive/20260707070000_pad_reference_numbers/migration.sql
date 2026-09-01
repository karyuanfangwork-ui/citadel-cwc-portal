-- P2-11 follow-up: Pad all existing reference numbers to consistent 5-digit format
-- Old format: IT-1, HR-4, FINANCE-3
-- New format: IT-00001, HR-00004, FINANCE-00003
--
-- The referenceNumber.service.ts uses SEQ_PAD_LENGTH = 5, so all newly
-- generated numbers are already padded. This migration brings existing
-- records in line.

-- Pad reference numbers that don't match the 5-digit pattern
UPDATE requests
SET reference_number = CONCAT(
  SUBSTRING(reference_number FROM '^[A-Z]+'),
  '-',
  LPAD(SUBSTRING(reference_number FROM '[0-9]+$'), 5, '0')
)
WHERE reference_number !~ '^[A-Z]+-[0-9]{5}$';

-- Seed counters for HR and FINANCE prefixes so the atomic generator
-- can find them on first use (instead of bootstrapping from scratch)
INSERT INTO request_counters (id, prefix, "lastSeq", tenant_id)
VALUES
  (2, 'HR',      4, '00000000-0000-0000-0000-000000000001'),
  (3, 'FINANCE', 3, '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;