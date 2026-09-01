-- CA-P6-003 — record which policy set produced an evaluation, so an old
-- evaluation can be replayed against the configuration that produced it.
-- Nullable and un-backfilled: legacy rows have no version.
ALTER TABLE "policy_results" ADD COLUMN "policy_set_version" VARCHAR(50);

CREATE INDEX "policy_results_policy_set_version_idx"
  ON "policy_results"("policy_set_version");
