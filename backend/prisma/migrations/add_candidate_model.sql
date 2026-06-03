-- Migration: Add Candidate model + backfill candidate_id
-- Step 1: Create candidates table
CREATE TABLE candidates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  full_name  VARCHAR(200) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, full_name)
);
CREATE INDEX idx_candidates_request_id ON candidates(request_id);

-- Step 2: Add candidate_id to candidate_resumes (nullable first)
ALTER TABLE candidate_resumes ADD COLUMN candidate_id UUID;

-- Step 3: Backfill - create Candidate rows from existing candidateName values
INSERT INTO candidates (id, request_id, full_name, created_at)
SELECT DISTINCT ON (request_id, candidate_name)
  gen_random_uuid(), request_id, COALESCE(candidate_name, 'Unnamed Candidate'), NOW()
FROM candidate_resumes;

-- Step 4: Backfill candidate_id on candidate_resumes
UPDATE candidate_resumes cr
SET candidate_id = c.id
FROM candidates c
WHERE cr.request_id = c.request_id
  AND COALESCE(cr.candidate_name, 'Unnamed Candidate') = c.full_name;

-- Step 5: Make candidate_id NOT NULL + add FK + unique constraint
ALTER TABLE candidate_resumes ALTER COLUMN candidate_id SET NOT NULL;
ALTER TABLE candidate_resumes
  ADD CONSTRAINT fk_resume_candidate
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE candidate_resumes
  ADD CONSTRAINT unique_doc_type_per_candidate
  UNIQUE (candidate_id, document_type);

-- Step 6: No interview_schedules or interview_feedbacks rows exist to migrate,
-- so we just drop old FK constraints if they exist and add new ones pointing to candidates
ALTER TABLE interview_schedules DROP CONSTRAINT IF EXISTS interview_schedules_candidate_id_fkey;
-- Add FK to candidates (only if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_schedule_candidate' AND table_name = 'interview_schedules'
  ) THEN
    ALTER TABLE interview_schedules
      ADD CONSTRAINT fk_schedule_candidate
      FOREIGN KEY (candidate_id) REFERENCES candidates(id);
  END IF;
END $$;

ALTER TABLE interview_feedbacks DROP CONSTRAINT IF EXISTS interview_feedbacks_candidate_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_feedback_candidate' AND table_name = 'interview_feedbacks'
  ) THEN
    ALTER TABLE interview_feedbacks
      ADD CONSTRAINT fk_feedback_candidate
      FOREIGN KEY (candidate_id) REFERENCES candidates(id);
  END IF;
END $$;