# Visual Workflow Designer Backend Foundation — Remediation and Completion Plan

> Status: planning only. No application code is modified by this document.
>
> Source of truth: `docs/superpowers/specs/2026-08-05-visual-workflow-designer-design.md` and `docs/superpowers/plans/2026-08-05-visual-workflow-designer-backend-foundation.md`.
>
> Goal: make the workflow-versioning foundation safe, transactionally correct, tenant-safe, API-correct, and rollout-ready without changing the existing runtime enforcement files.

## 1. Baseline evidence

The initial audit verified:

- Schema migration is present and the local database reports up to date.
- Planned targeted suites pass: 7 suites, 73 tests.
- Backend TypeScript build passes.
- Targeted ESLint has zero errors.
- Protected runtime files are unmodified:
  - `backend/src/services/transitionPolicy.service.ts`
  - `backend/src/services/requestTransition.service.ts`
  - `backend/src/services/transitionGuards.ts`
  - `backend/src/utils/workflowTransitions.ts`
- `npm run workflow:backfill:shadow` reports zero transition discrepancies but also reports validation failures for all 11 workflows and exits successfully.
- Current local database evidence:
  - 11 ACTIVE workflow versions
  - 90 workflow nodes
  - 0 workflow edges
  - 90 workflow steps
  - 102 `WorkflowTransition` rows, all with `workflowTypeId = NULL`

This means the implementation exists, but the current authoring graphs are not valid rollout artifacts. Do not publish or delete existing transition rows until the preflight/bootstrap phase succeeds.

## 2. Non-negotiable architecture constraints

1. Do not modify the existing runtime enforcement files listed above.
2. Preserve global fallback transition rows where `workflowTypeId IS NULL`.
3. Preserve tenant-specific workflow transition overrides unless an explicit migration decision says they are intentionally replaced.
4. Publish and rollback must be one transaction covering:
   - final validation
   - archiving the previous ACTIVE version
   - activating the target version
   - replacing compiled transitions and steps
   - cache invalidation or an explicit no-cache hook
5. A graph with blocking validation findings must never become ACTIVE.
6. All graph writes must be scoped to the target version and must reject cross-version IDs/endpoints.
7. Existing runtime behavior must remain unchanged until a valid scoped graph is explicitly published.
8. Every production-facing fix gets a regression test before the implementation change.

## 3. Priority and dependency map

| Priority | Workstream | Depends on | Release impact |
|---|---|---|---|
| P0 | Transactional publish/rollback | Compiler/lifecycle refactor | Prevents runtime graph/version split |
| P0 | Tenant-safe compile replacement | Schema/runtime inventory | Prevents policy deletion |
| P0 | Cross-version graph isolation | Graph CRUD tests | Prevents unauthorized graph corruption |
| P0 | Backfill/bootstrap safety | Runtime transition inventory | Prevents invalid ACTIVE versions |
| P1 | Route ordering and API error contract | Controller tests | Makes API usable and diagnosable |
| P1 | Batch CRUD atomicity and payload validation | Graph isolation | Prevents partial drafts and malformed writes |
| P1 | Step fidelity and round-trip correctness | Graph type changes | Prevents silent stepper changes |
| P1 | Validator completeness | Graph model | Prevents publish-time stranding |
| P2 | Concurrency hardening | Transaction design | Makes draft/publish behavior deterministic |
| P2 | Operational smoke and rollout controls | All P0/P1 work | Enables controlled release |

Dependency order:

```text
runtime inventory/bootstrap decision
        ↓
model/graph contract hardening
        ↓
compiler transaction + tenant-safe replacement
        ↓
atomic publish/rollback
        ↓
graph CRUD isolation + batch transactions
        ↓
validator completeness + API error/route fixes
        ↓
backfill shadow/write gates
        ↓
API smoke + release certification
```

## 4. P0 remediation tasks

### Task P0-1: Establish a safe runtime/bootstrap inventory

Objective: determine how the existing global transition map becomes a valid graph for each WorkflowType without changing runtime behavior.

Files to inspect and document:

- `backend/prisma/seed-workflows.ts`
- `backend/src/utils/workflowTransitions.ts`
- `backend/prisma/seed-admin-config.ts`
- `backend/prisma/seed-esm-transitions.ts`
- `backend/src/services/transitionPolicy.service.ts`
- `backend/prisma/backfill-workflow-versions.ts`

Steps:

1. Query and export, read-only:
   - all WorkflowTypes
   - WorkflowSteps per type
   - global transitions (`tenantId IS NULL AND workflowTypeId IS NULL`)
   - tenant/workflow-scoped transitions
   - current WorkflowVersion/Node/Edge counts and statuses
   - request occupancy by workflow and status
2. Build a deterministic mapping table from each workflow code to its intended status edges using the seed/runtime sources. Do not infer edges solely from the fact that a status exists in `WorkflowStep`.
3. Identify whether global rows are genuinely shared fallback policy or an incomplete substitute for missing workflow-scoped rows.
4. Choose and record one safe bootstrap strategy:
   - preferred: derive workflow-specific edges from the canonical workflow seed definitions and create scoped authoring graphs without deleting global rows; or
   - if global rows are intentionally the only policy: keep the version graph read-only/unpublished until Phase 3 resolves how global policy is represented.
5. Do not run write-mode backfill until every workflow has an explicit source edge set and a valid graph.

Acceptance criteria:

- A checked-in inventory/report identifies the source of every initial edge.
- No global fallback row is deleted or rewritten.
- No workflow is marked ready when its graph has zero edges unless it is explicitly designed as a single-node terminal workflow.

### Task P0-2: Harden graph data invariants

Objective: make invalid graph records impossible to persist through the service or database.

Files:

- Modify `backend/prisma/schema.prisma`
- Create migration under `backend/prisma/migrations/`
- Modify `backend/src/services/workflowGraph.types.ts`
- Modify `backend/src/services/workflowValidator.service.ts`
- Modify `backend/src/services/workflowGraph.service.ts`
- Tests:
  - `backend/src/services/__tests__/workflowValidatorStructure.test.ts`
  - `backend/src/services/__tests__/workflowGraphService.test.ts`

Required changes:

1. Validate that a `STATUS` node always has a non-null, non-empty `statusCode`.
2. Add blocking findings for:
   - duplicate node IDs
   - duplicate status codes
   - invalid node type/status-code combinations
   - invalid or duplicate edge identities
3. Decide whether `GraphNode` carries `label` and `displayOrder`. For this foundation, add `label: string` and an authoring order field only if preserving existing `WorkflowStep` artifacts requires it; otherwise document that labels are derived from the status catalog and explicitly migrate them.
4. Add database constraints where PostgreSQL can enforce them:
   - a check constraint for STATUS nodes requiring `status_code IS NOT NULL`
   - composite same-version endpoint enforcement for edges, using version-aware foreign keys or a trigger if Prisma cannot express the invariant directly
5. In `upsertNodes` and `upsertEdges`, first verify IDs belong to `versionId`; never use `where: { id }` alone for an update.
6. In `upsertEdges`, verify both endpoints exist and belong to the target draft version before writing.
7. Reject self-loops, dangling endpoints, cross-version endpoint IDs, and malformed arrays with controlled validation errors.

TDD sequence:

1. Add failing tests for null status codes, duplicate IDs/codes, cross-version node IDs, cross-version edge endpoints, missing endpoints, and self-loops.
2. Run the focused test files and confirm expected failures.
3. Implement service/validator/schema changes.
4. Re-run focused tests and Prisma type generation.

Acceptance criteria:

- A node or edge from version A cannot mutate or be referenced by version B.
- A persisted STATUS node cannot have a null status code.
- Every malformed graph payload produces a 4xx application error, not a 500.

### Task P0-3: Make compiler replacement tenant-safe

Objective: compile one workflow version without deleting tenant-specific policy rows or using a stale graph snapshot.

Files:

- Modify `backend/src/services/workflowCompiler.service.ts`
- Tests: `backend/src/services/__tests__/workflowCompiler.test.ts`, `workflowReverseCompile.test.ts`

Required changes:

1. Define the ownership policy for compiled rows:
   - authoring compilation owns only `(tenantId: null, workflowTypeId: target)` rows; or
   - authoring compilation owns all rows and must faithfully project tenant-specific definitions.
2. Preferred safe default: delete/recreate only rows explicitly owned by the version compiler, preserving non-null tenant overrides. Add a separate reconciliation path if tenant-specific authoring is later supported.
3. Ensure global rows `(tenantId: null, workflowTypeId: null)` remain untouched.
4. Move graph loading into the same transaction as delete/create, using the transaction client, or use an optimistic version/hash check that rejects a stale graph before replacement.
5. Keep delete/create atomic inside one transaction.
6. Preserve all WorkflowStep fields needed by the live stepper: label, display order, icon, initial/final flags, SLA pause.
7. Add a projection fingerprint that includes both transitions and steps.

Tests required:

- global rows survive compile
- tenant-specific rows survive compile
- workflow B rows survive compiling workflow A
- compiler create failure rolls back the replacement
- stale graph/version update is rejected
- step labels, flags, icons, SLA pause, and display order round-trip exactly

Acceptance criteria:

- Compiling workflow A cannot alter global rows, workflow B rows, or tenant overrides outside the declared ownership set.
- A failed compile leaves the previous compiled artifacts unchanged.
- Round-trip projection has zero transition and step differences.

### Task P0-4: Make publish and rollback fully atomic

Objective: implement the design’s single transaction boundary.

Files:

- Modify `backend/src/services/workflowVersion.service.ts`
- Modify `backend/src/services/workflowCompiler.service.ts`
- Add/refactor a transaction-aware compiler helper
- Tests: `backend/src/services/__tests__/workflowVersion.test.ts`, `workflowCompiler.test.ts`

Required design:

1. Add an internal transaction-aware function, for example:

```ts
compileVersionInTransaction(tx, versionId, expectedVersionUpdatedAt)
```

2. Inside one outer transaction:
   - lock/read the target version
   - confirm it is DRAFT for publish or ARCHIVED for rollback
   - load its graph through `tx`
   - rerun structural and live-data validation against the same transaction snapshot
   - archive the current ACTIVE version
   - activate the target version
   - delete/recreate only owned compiled artifacts
   - record publisher/timestamp
   - invalidate cache through a transaction-safe outbox/event hook, or perform invalidation only after commit with a durable publish marker
3. If any step fails, the entire transaction must roll back.
4. Keep compile-only functionality available for backfill/tests, but do not let lifecycle methods activate a version before compilation succeeds.
5. For rollback, re-run live validation in the same transaction as reactivation and compilation.

Tests required:

- compiler failure leaves previous version ACTIVE
- target remains DRAFT/ARCHIVED after failure
- live occupancy change between preflight and publish is caught by final validation
- concurrent publish has one deterministic winner and no mixed artifacts
- rollback uses the same atomic path
- one ACTIVE partial unique index remains effective

Acceptance criteria:

- There is no code path where version status changes commit before compiled rows.
- A failed publish cannot leave an ACTIVE version whose compiled rows represent another version.

### Task P0-5: Make backfill fail closed

Objective: prevent invalid ACTIVE versions and make the shadow gate truthful.

Files:

- Modify `backend/prisma/backfill-workflow-versions.ts`
- Modify `backend/package.json` only if a new explicit preflight/write command is added
- Tests or verification script under `backend/src/services/__tests__/` or `backend/prisma/__tests__/`

Required changes:

1. Shadow mode exits non-zero when either:
   - transition/step discrepancies exist; or
   - any blocking validation finding exists.
2. Do not print `GATE PASSED` unless both discrepancy and validation counts are zero.
3. Write mode skips or aborts invalid workflows; preferred behavior is fail the complete run before any write unless an explicit `--allow-invalid` migration mode is approved.
4. Write mode must use the same transaction-safe bootstrap/compiler path.
5. Make the script idempotent and explicit about existing version 1 rows:
   - verify them against the expected graph
   - do not silently skip an invalid existing ACTIVE version
6. Print a machine-readable summary for each workflow and an overall exit status.

Acceptance criteria:

- The current database state correctly fails the shadow gate rather than reporting success.
- No invalid version can be created by the normal write command.
- A successful write run proves every workflow has a valid graph and expected artifact diff.

## 5. P1 API and validation remediation

### Task P1-1: Fix route ordering and API contract tests

Files:

- Modify `backend/src/routes/index.ts`
- Inspect `backend/src/routes/workflow.routes.ts`
- Modify `backend/src/routes/workflowVersion.routes.ts` if necessary
- Create `backend/src/routes/__tests__/workflowVersion.routes.test.ts` or an equivalent controller integration suite

Required changes:

1. Ensure the version router receives `GET /admin/workflows` before the legacy root route, or merge the new list behavior into the legacy handler.
2. Confirm version-specific paths are not shadowed by legacy `/:id` routes.
3. Test:
   - authenticated read access
   - mutation permission enforcement (`workflow:manage`)
   - root list response shape
   - version detail response shape
   - draft creation, publish, rollback, discard routes
   - published graph edit rejection
4. Use real `AppError` responses and assert exact status codes.

Acceptance criteria:

- `GET /api/v1/admin/workflows` returns `activeVersion`, `draftVersion`, and bound request types from the new contract.
- All mutations require `workflow:manage`.

### Task P1-2: Normalize service errors into API errors

Files:

- Modify `backend/src/services/workflowVersion.service.ts`
- Modify `backend/src/services/workflowGraph.service.ts`
- Modify `backend/src/services/workflowCompiler.service.ts` where externally surfaced
- Use `AppError` from `backend/src/middleware/error.middleware.ts`
- Add controller/API tests

Required mapping:

| Condition | Status |
|---|---:|
| version not found | 404 |
| workflow type not found | 404 |
| edit ACTIVE/ARCHIVED | 409 |
| already-active publish | 409 |
| open draft conflict | 409 |
| invalid graph/blocking validation | 422 |
| malformed payload/self-loop | 400 or 422 |
| stale/concurrent update | 409 |

Do not expose raw Prisma errors or stack traces in production responses.

### Task P1-3: Make batch graph mutations atomic and validated

Files:

- Modify `backend/src/services/workflowGraph.service.ts`
- Modify `backend/src/controllers/workflowVersion.controller.ts`
- Add request schemas, preferably using the project’s existing validation convention
- Tests for service and controller

Required changes:

1. Validate complete payload shape before any write.
2. Execute all upserts and deletes for one PATCH request in a single Prisma transaction.
3. Validate all nodes before writing any node.
4. Validate all edges and endpoints before writing any edge.
5. Define duplicate IDs in the same batch as a 422 error.
6. Return the refreshed graph or a revision token so the client can reconcile after save.
7. Preserve draft-only enforcement inside the transaction to avoid status races.

Acceptance criteria:

- A failing item rolls back the entire batch.
- A successful batch returns the complete saved revision or graph summary.
- No partial writes remain after validation or persistence failure.

### Task P1-4: Complete validator coverage

Files:

- Modify `backend/src/services/workflowGraph.types.ts`
- Modify `backend/src/services/workflowValidator.service.ts`
- Tests:
  - `workflowValidatorStructure.test.ts`
  - `workflowValidatorLiveData.test.ts`

Required changes:

1. Add null status-code and duplicate identity blocking findings.
2. Filter dangling/invalid edges before live-data exit analysis.
3. Ensure an occupied status with only invalid outgoing edges receives `OCCUPIED_STATUS_NO_EXIT`.
4. Implement the catalog-status warning (`UNPLACED_STATUS`) only after adding catalog input to `validateGraph`; do not fake it from graph-only data.
5. Define whether warnings or blocking findings are returned for an empty graph and test it explicitly.
6. Add a regression matrix for:
   - missing initial/final
   - orphan/unreachable/no-final-path
   - dangling edge
   - occupied removed status
   - occupied status with invalid exits
   - final occupied status
   - open edge/rejection comment warning

## 6. P2 concurrency and operational hardening

### Task P2-1: Draft and publish concurrency

Files:

- `backend/src/services/workflowVersion.service.ts`
- `backend/prisma/schema.prisma` and migration only if a draft uniqueness constraint is added
- `workflowVersion.test.ts`

Required changes:

1. Prevent two drafts from being created concurrently for one WorkflowType, using a database-enforced partial unique index for DRAFT or a serialization/advisory-lock strategy.
2. Handle unique conflicts as a controlled 409 response.
3. Use optimistic version/revision checks for graph edits and publish.
4. Add genuinely concurrent tests using `Promise.allSettled` or a barrier, not sequential calls.

### Task P2-2: Publish cache/event boundary

Files:

- Existing cache utility used for workflow actions, if present
- `workflowVersion.service.ts`
- `workflowCompiler.service.ts`
- Relevant tests

Required changes:

1. Identify whether `availableActions` caching exists now or is deferred to Phase 3.
2. If no cache exists, add a no-op/invalidation interface so publish has a stable boundary without inventing a second runtime path.
3. If cache exists, invalidate only after successful commit and make the invalidation retryable/durable.
4. Test that failed publish does not invalidate the active cache.

### Task P2-3: Audit generated Prisma and seed paths

Files:

- `backend/prisma/schema.prisma`
- `backend/src/generated/tenant-models.ts`
- all workflow seed scripts under `backend/prisma/`

Required checks:

- regenerate Prisma client and tenant model metadata
- inspect nullable compound unique usages
- verify no old `findUnique` inputs remain invalid after schema changes
- ensure seeds are idempotent and scope-aware
- ensure tenant-specific policy fields are populated intentionally

## 7. Rollout and data migration procedure

Do not run normal write-mode backfill until this sequence passes.

### Phase A — backup and read-only preflight

1. Capture a database backup/snapshot.
2. Run the inventory from P0-1.
3. Export current WorkflowTransition and WorkflowStep rows, including tenant IDs and scope.
4. Record request occupancy by workflow/status.
5. Confirm the current active runtime behavior is unchanged.

### Phase B — schema and code deployment

1. Deploy schema constraints/migrations.
2. Run `prisma generate` and tenant-model generation.
3. Deploy code with publish disabled or feature-flagged.
4. Run targeted tests/build/lint.

### Phase C — bootstrap graph validation

1. Generate candidate graphs in memory.
2. Run structural and live-data validation.
3. Produce a per-workflow report.
4. Stop if any workflow has blocking findings.
5. Resolve all 11 current invalid graphs before continuing.

### Phase D — shadow compilation

1. Run `npm run workflow:backfill:shadow`.
2. Require exit code 0 only when transition and step diffs are zero and all graphs validate.
3. Verify global rows, tenant-specific rows, workflow B rows, and existing request behavior are unchanged.

### Phase E — controlled write backfill

1. Run the write command in an environment with a backup.
2. Write only valid version 1 graphs.
3. Do not delete or rewrite global fallback rows.
4. Verify every WorkflowType has exactly one valid ACTIVE version.
5. Verify every active version has a non-empty, valid graph where applicable.
6. Re-run runtime transition tests and DB queries.

### Phase F — API smoke test

Against the running dev/staging server:

1. Authenticate with a test/admin account using credentials from the environment, not committed values.
2. `GET /api/v1/admin/workflows` and verify the new response shape.
3. Read an active version graph and verify nodes, edges, validation, and step metadata.
4. Create a draft and verify it clones the active graph.
5. Apply a valid node/edge batch and reload the graph.
6. Attempt to edit the ACTIVE version and verify a 409/422 response.
7. Publish a valid draft and verify:
   - previous version ARCHIVED
   - target ACTIVE
   - compiled transitions/steps match graph
   - global and tenant-preserved rows remain correct
8. Force a compile failure in a test harness and verify no version/artifact state changes.
9. Roll back and verify the same atomic guarantees.

## 8. Verification commands

Run from `backend/`:

```bash
npx prisma validate
npx prisma generate
npm run build
npx eslint src/services/workflow*.ts src/controllers/workflowVersion.controller.ts src/routes/workflowVersion.routes.ts

npx jest \
  src/services/__tests__/workflowValidatorStructure.test.ts \
  src/services/__tests__/workflowValidatorLiveData.test.ts \
  src/services/__tests__/workflowCompiler.test.ts \
  src/services/__tests__/workflowReverseCompile.test.ts \
  src/services/__tests__/workflowVersion.test.ts \
  src/services/__tests__/workflowGraphService.test.ts \
  src/services/__tests__/transitionPolicy.test.ts \
  --runInBand --forceExit

npm run workflow:backfill:shadow
npx prisma migrate status
```

For the full backend suite, use the repository’s bounded command only after the targeted suite is green and report it separately:

```bash
npm test -- --forceExit
```

Do not claim full-suite closure if the run hangs, has failures, or requires unexplained open-handle suppression. Classify failures as introduced, workflow-related, or pre-existing.

## 9. Definition of done

The remediation is complete only when all are true:

- Publish and rollback are fully atomic with compilation and final validation.
- Compiler replacement preserves global rows, tenant overrides, and other workflow rows.
- Cross-version graph IDs/endpoints are rejected at service and database boundaries.
- STATUS nodes cannot persist without status codes.
- Step labels, flags, icons, SLA pause, and display order round-trip without drift.
- Backfill shadow mode fails closed on any discrepancy or blocking validation finding.
- Backfill write mode cannot create invalid ACTIVE versions.
- Current 11-workflow invalid state is resolved and documented with evidence.
- Root API route reaches the new workflow-version list contract.
- Batch graph writes are atomic and schema-validated.
- Business errors return appropriate 4xx responses.
- Genuine concurrent draft/publish tests pass.
- Controller/API tests cover auth, permissions, route ordering, response shapes, and error statuses.
- Targeted workflow tests pass.
- Backend build and lint pass.
- Full-suite result is recorded separately.
- API smoke test passes in a controlled environment.
- Protected runtime files remain unchanged.

## 10. Explicitly out of scope

Do not mix these into this remediation unless separately approved:

- Phase 3 `availableActions` resolver and frontend hardcoded-map removal.
- React workflow designer UI and `@xyflow/react` integration.
- BPMN-lite node types.
- Global fallback transition editing through the canvas.
- Unrelated notification/outbox remediation.
- Broad workflow runtime refactors.
