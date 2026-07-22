-- P04 Task 15: Versioned transactional workflow command boundary
-- Adds: request.version for optimistic concurrency
--       workflow_history for immutable transition audit
--       workflow_command_results for idempotency
--       outbox_events for reliable event publishing

-- 1. Add version column to requests (default 1, backfill existing rows)
ALTER TABLE "requests" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- 2. Create workflow_history table
CREATE TABLE "workflow_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "from_status" VARCHAR(100) NOT NULL,
    "to_status" VARCHAR(100) NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(200),
    "source" VARCHAR(100) NOT NULL DEFAULT 'unknown',
    "comment" TEXT,
    "metadata" JSONB,
    "request_version" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "workflow_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workflow_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "workflow_history_request_id_idx" ON "workflow_history"("request_id");
CREATE INDEX "workflow_history_request_id_created_at_idx" ON "workflow_history"("request_id", "created_at");
CREATE UNIQUE INDEX "workflow_history_idempotency_key_key" ON "workflow_history"("idempotency_key");

-- 3. Create workflow_command_results table
CREATE TABLE "workflow_command_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" VARCHAR(100) NOT NULL,
    "to_status" VARCHAR(100) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "workflow_command_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workflow_command_results_idempotency_key_key" UNIQUE ("idempotency_key"),
    CONSTRAINT "workflow_command_results_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "workflow_command_results_idempotency_key_idx" ON "workflow_command_results"("idempotency_key");
CREATE INDEX "workflow_command_results_request_id_idx" ON "workflow_command_results"("request_id");

-- 4. Create outbox_events table
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_events_published_created_at_idx" ON "outbox_events"("published", "created_at");
CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");