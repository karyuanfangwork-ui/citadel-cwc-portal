-- P2.3: Credit Recommendation model — governed lifecycle object for analyst recommendations
-- DRAFT → SUBMITTED → ACKNOWLEDGED/SUPERSEDED

CREATE TABLE "credit_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "recommendation_type" VARCHAR(20) NOT NULL,
    "recommended_amount" DECIMAL(15,2),
    "recommended_tenor_months" INTEGER,
    "pricing_terms" JSONB,
    "conditions" TEXT,
    "rationale" TEXT,
    "submitted_at" TIMESTAMP(6),
    "superseded_at" TIMESTAMP(6),
    "superseded_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "credit_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_recommendations_application_id_idx" ON "credit_recommendations"("application_id");
CREATE INDEX "credit_recommendations_application_id_status_idx" ON "credit_recommendations"("application_id", "status");
CREATE INDEX "credit_recommendations_author_id_idx" ON "credit_recommendations"("author_id");

ALTER TABLE "credit_recommendations"
    ADD CONSTRAINT "credit_recommendations_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_recommendations"
    ADD CONSTRAINT "credit_recommendations_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_recommendations"
    ADD CONSTRAINT "credit_recommendations_superseded_by_id_fkey"
    FOREIGN KEY ("superseded_by_id") REFERENCES "credit_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;