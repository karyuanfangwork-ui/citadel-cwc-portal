-- P2-11: Atomic reference number counter table
-- Prevents duplicate reference numbers under concurrent request creation.
CREATE TABLE IF NOT EXISTS "request_counters" (
    "id"      SERIAL PRIMARY KEY,
    "prefix"  VARCHAR(10) NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "request_counters_prefix_key" UNIQUE ("prefix")
);

-- Insert existing prefixes from current service desks to bootstrap counters
-- This avoids the need for each prefix to cold-start from a FIND_FIRST query
-- Note: DB columns use snake_case (reference_number, not referenceNumber)
-- Use ON CONFLICT DO NOTHING to make this idempotent
INSERT INTO "request_counters" ("prefix", "lastSeq")
SELECT "code", COALESCE((
    SELECT MAX(
        CASE
            WHEN r."reference_number" ~ '^[A-Z]+-[0-9]+$'
            THEN CAST(SPLIT_PART(r."reference_number", '-', 2) AS INTEGER)
            ELSE 0
        END
    )
    FROM "requests" r
    WHERE r."reference_number" LIKE sd."code" || '-%'
), 0)
FROM "service_desks" sd
ON CONFLICT ("prefix") DO NOTHING;