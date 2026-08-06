# Workflow authoring bootstrap runbook

Status: shadow-only implementation. No production write command is provided by this change.

## Purpose

Production currently has legacy `WorkflowStep` rows and global fallback `WorkflowTransition` rows, but the visual designer requires workflow-scoped authoring graphs. The bootstrap planner builds a candidate graph without changing the database.

## Required preconditions

1. Take and verify a full PostgreSQL backup.
2. Verify the application image contains the same commit as the repository.
3. Verify Prisma migrations are up to date.
4. Keep `RETAIN_ADMIN_CONFIG=true` for any seed invocation.
5. Freeze workflow designer publishing while the report is reviewed.

## Shadow command

Run from `backend/` after the backend build has completed:

```bash
npm run build
npm run workflow:bootstrap:shadow
```

The command uses compiled services from `backend/dist/`, so it is executable in the production image without copying repository source files into the container.

The command is read-only. It reports:

- existing and planned authoring nodes/edges
- active version, if one exists
- live request occupancy by workflow/status
- canonical edges
- synthetic sequential edges
- synthetic cancellation edges
- missing or conflicting runtime policy metadata
- structural and live-data validation findings

The command exits nonzero when any blocking finding exists. A nonzero exit is an intentional safety stop, not a deployment failure to bypass.

## Blocking gates

Do not create workflow versions or compile transitions until all of these are true:

- `blockingCount` is zero.
- No occupied status is absent from the approved workflow definition.
- No occupied status loses all exits.
- Every planned edge has reviewed runtime authorization metadata.
- Synthetic sequential and cancellation edges have been explicitly approved.
- Structural validation has no blocking findings.
- The workflow owner has reviewed the per-workflow edge diff.

## What is deliberately not automated

This planner does not write `WorkflowVersion`, `WorkflowNode`, `WorkflowEdge`, `WorkflowTransition`, or `WorkflowStep` rows. It does not infer authorization roles from an empty policy row. It does not publish a draft, remap live requests, or run edge reconstruction.

A future write migration must be separately reviewed and must include:

- an immutable report artifact/hash from the approved shadow run
- an explicit workflow allowlist
- a transaction per workflow or an all-or-nothing transaction with bounded locks
- post-write counts and compiled-transition diffs
- an idempotency check
- a rollback procedure based on archived versions and database backup

## Production command location

- Planner service: `backend/src/services/workflowBootstrap.service.ts`
- Shadow entry point: `backend/prisma/bootstrap-workflow-versions.ts`
- Package script: `backend/package.json` (`workflow:bootstrap:shadow`)
- Tests: `backend/src/services/__tests__/workflowBootstrap.test.ts`
