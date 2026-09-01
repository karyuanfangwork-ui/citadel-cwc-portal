-- AlterTable: Add covenantId and conditionId to EarlyWarningSignal
ALTER TABLE "early_warning_signals" ADD COLUMN "covenant_id" UUID;
ALTER TABLE "early_warning_signals" ADD COLUMN "condition_id" UUID;

-- Create indexes for the new FK columns
CREATE INDEX "early_warning_signals_covenant_id_idx" ON "early_warning_signals"("covenant_id");
CREATE INDEX "early_warning_signals_condition_id_idx" ON "early_warning_signals"("condition_id");

-- Add foreign key constraints
ALTER TABLE "early_warning_signals"
  ADD CONSTRAINT "early_warning_signals_covenant_id_fkey"
  FOREIGN KEY ("covenant_id") REFERENCES "covenant_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "early_warning_signals"
  ADD CONSTRAINT "early_warning_signals_condition_id_fkey"
  FOREIGN KEY ("condition_id") REFERENCES "conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enum: Add CONDITION_OVERDUE to SignalType
ALTER TYPE "SignalType" ADD VALUE IF NOT EXISTS 'CONDITION_OVERDUE';