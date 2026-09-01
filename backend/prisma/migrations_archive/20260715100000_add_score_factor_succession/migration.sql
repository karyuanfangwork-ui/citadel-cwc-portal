-- P2.1: Change ScoreFactorDefinition from factorKey @unique to @@unique([factorKey, effectiveFrom])
-- to support effective-dated successor definitions.
-- Also add predecessorId self-relation for factor succession tracking.

-- Step 1: Drop the existing unique constraint on factor_key
ALTER TABLE "score_factor_definitions" DROP CONSTRAINT IF EXISTS "score_factor_definitions_factor_key_key";

-- Step 2: Add predecessor_id column (nullable, self-referencing)
ALTER TABLE "score_factor_definitions" ADD COLUMN "predecessor_id" UUID;

-- Step 3: Add unique constraint on (factor_key, effective_from)
ALTER TABLE "score_factor_definitions" ADD CONSTRAINT "score_factor_definitions_factor_key_effective_from_key" UNIQUE ("factor_key", "effective_from");

-- Step 4: Add foreign key for predecessor self-relation
ALTER TABLE "score_factor_definitions" ADD CONSTRAINT "score_factor_definitions_predecessor_id_fkey" 
  FOREIGN KEY ("predecessor_id") REFERENCES "score_factor_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: The existing @@index([factorKey]) and @@index([isActive, effectiveFrom, effectiveTo])
-- already exist from the previous migration. No changes needed for those.