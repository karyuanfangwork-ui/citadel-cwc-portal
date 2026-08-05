-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowNodeType" AS ENUM ('STATUS');

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_type_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "published_at" TIMESTAMP(6),
    "published_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_version_id" UUID NOT NULL,
    "type" "WorkflowNodeType" NOT NULL DEFAULT 'STATUS',
    "status_code" VARCHAR(100),
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "sla_pause" BOOLEAN NOT NULL DEFAULT false,
    "icon" VARCHAR(50) NOT NULL DEFAULT 'radio_button_checked',
    "config" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_version_id" UUID NOT NULL,
    "from_node_id" UUID NOT NULL,
    "to_node_id" UUID NOT NULL,
    "transition_label" VARCHAR(50),
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "auto_assign_role" VARCHAR(50),
    "auto_assign_user_id" UUID,
    "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_executive_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_type_id_version_key" ON "workflow_versions"("workflow_type_id", "version");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_type_id_status_idx" ON "workflow_versions"("workflow_type_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_nodes_workflow_version_id_status_code_key" ON "workflow_nodes"("workflow_version_id", "status_code");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflow_version_id_idx" ON "workflow_nodes"("workflow_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edges_workflow_version_id_from_node_id_to_node_id_key" ON "workflow_edges"("workflow_version_id", "from_node_id", "to_node_id");

-- CreateIndex
CREATE INDEX "workflow_edges_workflow_version_id_idx" ON "workflow_edges"("workflow_version_id");

-- Partial unique index: one ACTIVE version per workflow type
CREATE UNIQUE INDEX "workflow_versions_one_active_per_type" ON "workflow_versions"("workflow_type_id") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_type_id_fkey" FOREIGN KEY ("workflow_type_id") REFERENCES "workflow_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;