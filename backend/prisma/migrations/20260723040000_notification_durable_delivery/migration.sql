-- Task 18: Durable notification outbox, delivery attempts, and inbox replay

ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'RETRYING';

CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'RETRYING', 'FAILED', 'CANCELLED');
CREATE TYPE "NotificationClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'HR_CONFIDENTIAL', 'FINANCE_CONFIDENTIAL', 'RESTRICTED');

CREATE TABLE "notification_domain_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_key" VARCHAR(200) NOT NULL,
  "tenant_id" UUID NOT NULL,
  "department_id" UUID,
  "event_type" VARCHAR(100) NOT NULL,
  "classification" "NotificationClassification" NOT NULL DEFAULT 'INTERNAL',
  "resource_type" VARCHAR(100) NOT NULL,
  "resource_id" UUID,
  "payload_version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_domain_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "department_id" UUID,
  "recipient_id" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(6),
  "provider_message_id" VARCHAR(255),
  "error_message" TEXT,
  "delivered_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications" ADD COLUMN "delivery_id" UUID;

CREATE UNIQUE INDEX "notification_domain_events_tenant_id_event_key_key" ON "notification_domain_events"("tenant_id", "event_key");
CREATE INDEX "notification_domain_events_tenant_id_occurred_at_idx" ON "notification_domain_events"("tenant_id", "occurred_at" DESC);
CREATE INDEX "notification_domain_events_tenant_id_event_type_occurred_at_idx" ON "notification_domain_events"("tenant_id", "event_type", "occurred_at" DESC);
CREATE INDEX "notification_domain_events_department_id_occurred_at_idx" ON "notification_domain_events"("department_id", "occurred_at" DESC);

CREATE UNIQUE INDEX "notification_deliveries_event_id_recipient_id_channel_key" ON "notification_deliveries"("event_id", "recipient_id", "channel");
CREATE INDEX "notification_deliveries_tenant_id_status_next_attempt_at_idx" ON "notification_deliveries"("tenant_id", "status", "next_attempt_at");
CREATE INDEX "notification_deliveries_recipient_id_created_at_idx" ON "notification_deliveries"("recipient_id", "created_at" DESC);
CREATE INDEX "notification_deliveries_department_id_created_at_idx" ON "notification_deliveries"("department_id", "created_at" DESC);

CREATE UNIQUE INDEX "notifications_delivery_id_key" ON "notifications"("delivery_id");
CREATE INDEX "notifications_user_id_id_idx" ON "notifications"("user_id", "id");

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_domain_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
