-- Preserve step metadata in the authoring graph so reverse compilation is lossless.
ALTER TABLE "workflow_nodes"
  ADD COLUMN "label" VARCHAR(200),
  ADD COLUMN "display_order" INTEGER;

-- Existing rows were generated from WorkflowStep and can safely use their status
-- as the legacy label/order fallback. New rows may remain NULL until authored.
UPDATE "workflow_nodes" n
SET
  "label" = COALESCE(n."label", n."status_code"),
  "display_order" = COALESCE(
    n."display_order",
    (
      SELECT s."display_order"
      FROM "workflow_versions" v
      JOIN "workflow_steps" s
        ON s."workflow_type_id" = v."workflow_type_id"
       AND s."status" = n."status_code"
      WHERE v."id" = n."workflow_version_id"
      LIMIT 1
    )
  );

-- Prisma needs the composite uniqueness to express version-aware endpoint FKs.
CREATE UNIQUE INDEX "workflow_nodes_id_workflow_version_id_key"
  ON "workflow_nodes"("id", "workflow_version_id");

CREATE UNIQUE INDEX "workflow_edges_id_workflow_version_id_key"
  ON "workflow_edges"("id", "workflow_version_id");

ALTER TABLE "workflow_edges"
  DROP CONSTRAINT "workflow_edges_from_node_id_fkey",
  DROP CONSTRAINT "workflow_edges_to_node_id_fkey";

ALTER TABLE "workflow_edges"
  ADD CONSTRAINT "workflow_edges_from_node_version_fkey"
    FOREIGN KEY ("from_node_id", "workflow_version_id")
    REFERENCES "workflow_nodes"("id", "workflow_version_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "workflow_edges_to_node_version_fkey"
    FOREIGN KEY ("to_node_id", "workflow_version_id")
    REFERENCES "workflow_nodes"("id", "workflow_version_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- A STATUS node is the only node type currently supported and must always have
-- a status code. The NOT VALID form allows controlled pre-existing-data checks;
-- the deployment gate must validate existing rows before VALIDating this check.
ALTER TABLE "workflow_nodes"
  ADD CONSTRAINT "workflow_nodes_status_code_required"
  CHECK ("type" <> 'STATUS' OR NULLIF(BTRIM("status_code"), '') IS NOT NULL) NOT VALID;

CREATE UNIQUE INDEX "workflow_versions_one_draft_per_workflow"
  ON "workflow_versions"("workflow_type_id")
  WHERE "status" = 'DRAFT';

CREATE UNIQUE INDEX "workflow_versions_one_active_per_workflow"
  ON "workflow_versions"("workflow_type_id")
  WHERE "status" = 'ACTIVE';
