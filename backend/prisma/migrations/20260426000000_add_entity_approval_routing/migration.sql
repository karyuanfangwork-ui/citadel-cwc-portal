-- AlterTable: Add entityId to users
ALTER TABLE "users" ADD COLUMN "entity_id" UUID;

-- AlterTable: Add entityId to request_approvals
ALTER TABLE "request_approvals" ADD COLUMN "entity_id" UUID;

-- CreateTable: entities
CREATE TABLE "entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "approver_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: request_type_entity_routings
CREATE TABLE "request_type_entity_routings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_type_id" UUID NOT NULL,
    "routing_mode" "EntityRoutingMode" NOT NULL,
    "custom_field_key" VARCHAR(100),
    "label" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "request_type_entity_routings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entities_code_key" ON "entities"("code");

-- CreateIndex
CREATE INDEX "entities_approver_id_idx" ON "entities"("approver_id");

-- CreateIndex
CREATE INDEX "users_entity_id_idx" ON "users"("entity_id");

-- CreateIndex
CREATE INDEX "request_approvals_entity_id_idx" ON "request_approvals"("entity_id");

-- CreateIndex
CREATE INDEX "request_type_entity_routings_request_type_id_idx" ON "request_type_entity_routings"("request_type_id");

-- AddForeignKey: users.entity_id -> entities.id
ALTER TABLE "users" ADD CONSTRAINT "users_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: entities.approver_id -> users.id
ALTER TABLE "entities" ADD CONSTRAINT "entities_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: request_approvals.entity_id -> entities.id
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: request_type_entity_routings.request_type_id -> request_types.id
ALTER TABLE "request_type_entity_routings" ADD CONSTRAINT "request_type_entity_routings_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create enum type (idempotent — Prisma already handled via db push)