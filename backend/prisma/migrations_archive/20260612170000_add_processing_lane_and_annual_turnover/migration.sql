-- P2-2: Add ProcessingLane enum, lane column on CreditApplication, annualTurnover on BorrowerProfile

-- Create enum
CREATE TYPE "ProcessingLane" AS ENUM ('PERSONAL_FAST', 'SME', 'CORPORATE');

-- Add lane column to CreditApplication (default CORPORATE for existing rows)
ALTER TABLE "CreditApplication" ADD COLUMN "lane" "ProcessingLane" NOT NULL DEFAULT 'CORPORATE';

-- Add annualTurnover column to BorrowerProfile
ALTER TABLE "BorrowerProfile" ADD COLUMN "annual_turnover" DECIMAL(15,2);

-- Create index on lane for dashboard filtering
CREATE INDEX "CreditApplication_lane_idx" ON "CreditApplication"("lane");