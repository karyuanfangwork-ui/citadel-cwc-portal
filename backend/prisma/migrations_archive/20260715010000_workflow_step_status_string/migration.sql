-- P0.1: Allow WorkflowStep.status to accept credit application states
-- (COMPLIANCE_HOLD, REFERRED_BACK, CONDITION_FULFILMENT) which are not in
-- the RequestStatus enum. Change from enum type to varchar to accommodate
-- both ticket-system and credit-application workflow step statuses.

-- Step 1: Add a varchar column alongside the enum column
ALTER TABLE "workflow_steps" ADD COLUMN "status_text" VARCHAR(100);

-- Step 2: Copy existing enum values into the text column
UPDATE "workflow_steps" SET "status_text" = "status"::text;

-- Step 3: Drop the enum column default and constraint, then alter the type
ALTER TABLE "workflow_steps" ALTER COLUMN "status" TYPE VARCHAR(100) USING "status"::text;

-- Step 4: Drop the temporary text column (we've already converted status)
ALTER TABLE "workflow_steps" DROP COLUMN "status_text";

-- Step 5: Set not null and default
ALTER TABLE "workflow_steps" ALTER COLUMN "status" SET NOT NULL;