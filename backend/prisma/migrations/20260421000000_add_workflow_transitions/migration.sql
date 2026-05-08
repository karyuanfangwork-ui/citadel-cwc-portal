-- CreateWorkflowTransition
CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_status" VARCHAR(100) NOT NULL,
    "to_status" VARCHAR(100) NOT NULL,
    "transition_label" VARCHAR(50),
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "auto_assign_role" VARCHAR(50),
    "auto_assign_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_from_status_to_status_key" ON "workflow_transitions"("from_status", "to_status");

-- CreateIndex
CREATE INDEX "workflow_transitions_from_status_idx" ON "workflow_transitions"("from_status");

-- CreateIndex
CREATE INDEX "workflow_transitions_to_status_idx" ON "workflow_transitions"("to_status");

-- CreateIndex
CREATE INDEX "workflow_transitions_is_active_idx" ON "workflow_transitions"("is_active");

-- CreateIndex
CREATE INDEX "workflow_transitions_auto_assign_user_id_idx" ON "workflow_transitions"("auto_assign_user_id");
