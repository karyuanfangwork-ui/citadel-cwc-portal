CREATE TABLE "request_status_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "request_status_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "request_status_definitions_code_key" ON "request_status_definitions"("code");
CREATE INDEX "request_status_definitions_is_active_idx" ON "request_status_definitions"("is_active");
CREATE INDEX "request_status_definitions_category_idx" ON "request_status_definitions"("category");
