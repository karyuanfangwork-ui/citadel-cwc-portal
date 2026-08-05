-- P04 Task 17: Durable SLA timers and escalation records

CREATE TYPE "SlaClockKind" AS ENUM ('RESPONSE', 'RESOLUTION', 'OLA');
CREATE TYPE "SlaClockStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BREACHED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SlaTimerJobKind" AS ENUM ('SLA_RESPONSE_DUE', 'SLA_RESOLUTION_DUE', 'SLA_ESCALATION_DUE');
CREATE TYPE "SlaTimerJobStatus" AS ENUM ('SCHEDULED', 'CLAIMED', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

CREATE TABLE "sla_policy_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "request_type_id" UUID,
    "version" INTEGER NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "calendar" JSONB NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "response_target_minutes" INTEGER,
    "resolution_target_minutes" INTEGER,
    "ola_target_minutes" INTEGER,
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "effective_to" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT "sla_policy_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sla_policy_versions_tenant_request_type_version_key" ON "sla_policy_versions"("tenant_id", "request_type_id", "version");
CREATE INDEX "sla_policy_versions_tenant_request_type_effective_idx" ON "sla_policy_versions"("tenant_id", "request_type_id", "effective_from");

CREATE TABLE "sla_clocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "policy_version_id" UUID,
    "kind" "SlaClockKind" NOT NULL,
    "status" "SlaClockStatus" NOT NULL DEFAULT 'ACTIVE',
    "due_at" TIMESTAMP(6) NOT NULL,
    "paused_at" TIMESTAMP(6),
    "pause_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT "sla_clocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sla_clocks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sla_clocks_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "sla_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sla_clocks_tenant_idempotency_key_key" ON "sla_clocks"("tenant_id", "idempotency_key");
CREATE INDEX "sla_clocks_tenant_status_due_idx" ON "sla_clocks"("tenant_id", "status", "due_at");
CREATE INDEX "sla_clocks_request_kind_idx" ON "sla_clocks"("request_id", "kind");

CREATE TABLE "sla_pause_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "clock_id" UUID NOT NULL,
    "paused_at" TIMESTAMP(6) NOT NULL,
    "resumed_at" TIMESTAMP(6),
    "duration_ms" BIGINT NOT NULL DEFAULT 0,
    "reason" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT "sla_pause_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sla_pause_ledger_clock_id_fkey" FOREIGN KEY ("clock_id") REFERENCES "sla_clocks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sla_pause_ledger_tenant_clock_paused_idx" ON "sla_pause_ledger"("tenant_id", "clock_id", "paused_at");

CREATE TABLE "sla_timer_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "clock_id" UUID NOT NULL,
    "kind" "SlaTimerJobKind" NOT NULL,
    "status" "SlaTimerJobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "run_at" TIMESTAMP(6) NOT NULL,
    "idempotency_key" VARCHAR(180) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(6),
    "claimed_at" TIMESTAMP(6),
    "claimed_by" VARCHAR(100),
    "last_error" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT "sla_timer_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sla_timer_jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sla_timer_jobs_clock_id_fkey" FOREIGN KEY ("clock_id") REFERENCES "sla_clocks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sla_timer_jobs_tenant_idempotency_key_key" ON "sla_timer_jobs"("tenant_id", "idempotency_key");
CREATE INDEX "sla_timer_jobs_status_run_at_idx" ON "sla_timer_jobs"("status", "run_at");
CREATE INDEX "sla_timer_jobs_tenant_request_idx" ON "sla_timer_jobs"("tenant_id", "request_id");

CREATE TABLE "sla_escalation_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "clock_id" UUID,
    "escalation_level" INTEGER NOT NULL,
    "rule_id" UUID,
    "idempotency_key" VARCHAR(180) NOT NULL,
    "notify_roles" TEXT[],
    "notification_intent" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT "sla_escalation_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sla_escalation_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sla_escalation_events_clock_id_fkey" FOREIGN KEY ("clock_id") REFERENCES "sla_clocks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sla_escalation_events_tenant_idempotency_key_key" ON "sla_escalation_events"("tenant_id", "idempotency_key");
CREATE INDEX "sla_escalation_events_tenant_request_level_idx" ON "sla_escalation_events"("tenant_id", "request_id", "escalation_level");
