# HR New Hiring: complete requester-selected executive routing

Status: IMPLEMENTATION IN PROGRESS — local HR Recruitment v4 is active and the missing HR reference-check banner has been restored locally. Authenticated HR acceptance remains pending. Production rollout remains a separate, explicitly approved gate.

Historical execution checkpoint (2026-11-11 23:29 +08): local v2 (`4b48ff0c-6068-465a-8205-b1cc737a451c`) was initially created as DRAFT from active v1 through the workflow version/graph services. It had 23 nodes and 47 edges, no blocking findings, and 21 existing warnings. The user later published it; the superseding current state and remaining correction are recorded below.

Owner disposition (2026-11-11): preserve HR-00003, HR-00007, and HR-00008 exactly as found and defer any ticket repair to a separate review. Do not backfill choices/approvals, change statuses/assignment/history, or remap these tickets during local graph updates. Verify they remain unchanged after publication.

## Latest runtime state and remaining correction (2026-11-12)

Historical v3 diagnosis (resolved in v4): v3 had both direct Group Deputy CEO route edges and the corrected `GROUP_DCEO_APPROVED -> JOB_POSTED` permission, but its two `PENDING_GROUP_DCEO_APPROVAL` decision edges allowed CEO only. This hid/denied decision actions for the selected Group Deputy CEO. V4 changed those decision allow-lists to GROUP_DCEO and is now ACTIVE.

Historical implementation checkpoint (2026-11-12 21:03 +08): created local DRAFT v4 `e44872b1-9324-412c-a792-8169e7af1d21` from active v3 using the workflow version/graph services. Changed only the two DCEO decision edges to `allowedRoles=[]`, `allowedExecutiveRoles=['GROUP_DCEO']`; CEO decision edges remain CEO-only. V4 had 23 nodes/47 edges, zero blockers, and 21 inherited warnings. The user subsequently published it.

Latest implementation checkpoint (2026-11-12): v4 is ACTIVE. HR-00011 advanced through the DCEO decision and job-posting stages to `INTERVIEW_FEEDBACK_PENDING`; it is assigned to HR and has a `PROCEED` interview feedback row, but no HR screening row yet. The workflow edge `INTERVIEW_FEEDBACK_PENDING -> HR_SCREENING` is active and allows AGENT/ADMIN. The UI's ActionBanner is data-driven, but the local DB had no `agent/INTERVIEW_FEEDBACK_PENDING` BannerConfig. The canonical local admin backup `backend/scripts/admin_config_backup.json` contained the intended active banner, while `restore_admin_config.ts` did not restore bannerConfigs and `SEED_BANNER_CONFIGS` is intentionally empty. Added banner restoration to the generic restore path and a fail-closed `--only=banners` mode restricted to local `help_center`; added the `admin-config:restore-banners` command. Ran it twice and read back exactly one active row: `agent / INTERVIEW_FEEDBACK_PENDING`, “Next Step: Start Reference Check”. HR-00011 itself remains unchanged. The remaining acceptance is for `hr@test.local` to refresh, click “Take Action”, and verify the request enters `HR_SCREENING` with an `IN_PROGRESS` screening record.

### Step-by-step fix

1. Keep active v4 unchanged. Confirm local `help_center`, v4 ACTIVE, and HR-00011 `INTERVIEW_FEEDBACK_PENDING` with PROCEED feedback/no screening row. Do not modify production or request/approval rows.
2. The local banner has been restored from the canonical admin backup and is active. Do not add a duplicate; verify its role/status/title in Admin Settings → Banner Configuration if needed.
3. As `hr@test.local`, hard-refresh HR-00011 so the banner cache reloads. The `agent/INTERVIEW_FEEDBACK_PENDING` banner should show “Next Step: Start Reference Check” with “Take Action”.
4. Click “Take Action” once. Verify status `HR_SCREENING`, one HRScreening record with `overallStatus=IN_PROGRESS` and reference status `PENDING`, plus workflow history source `screening.start`. Do not retry if the state already changed.
5. Continue through “Update Reference Check”; verify passing checks transition to `LOA_PENDING_APPROVAL`. Keep the Group DCEO and job-posting acceptance evidence, and confirm HR-00003/07/08/09 remain unchanged.
6. For future restored local environments, use `npm run admin-config:restore-banners` to restore only the canonical banner, or the full admin restore to restore all banner configurations. The banner-only command fails closed unless the target is local `help_center`.

### Acceptance checks

The v4 graph grants GROUP_DCEO on both DCEO decision edges, CEO only on CEO decisions, and HR AGENT/ADMIN on the post-approval job-posting edge. The remaining browser acceptance is to confirm the restored banner is fetched by the HR session and its action starts screening for HR-00011; an HR agent must not be able to act as the executive approver.

The latest-runtime section above supersedes the original v1 baseline and original Gate 1–4 execution status below. Those sections remain as design history; follow the current HR screening acceptance sequence above for remaining work.

## Goal

Make a `NEW_HIRING` request with a persisted requester choice routable by its assigned HR agent to exactly the selected CEO or Group Deputy CEO, and allow that one executive's approval to return to HR for job posting. Keep the active graph, compiled runtime transition rows, frontend action visibility, backend authorization, and approval/outbox effects in agreement.

## Original diagnosis before v2 publication (local restored `help_center`, 2026-11-11)

- Request `HR-00010` is `SUBMITTED`, request type `NEW_HIRING`, assigned to `hr@test.local` on the HR team, and has saved choice Alain Boey / `GROUP_DCEO`. It has no approval rows yet. This is the intended un-routed state, not a failed/partial transition.
- `hr@test.local` is active, has `AGENT` and `NORMAL_STAFF` RBAC roles, `agentTeam=HR`, and is in the request tenant. HR role/assignment is not the blocker.
- Active workflow is `HR_RECRUITMENT` version 1 (`4d98228b-8b55-4aad-af2b-ca126d8485bf`). Compiled workflow-scoped transitions from `SUBMITTED` include `PENDING_CEO_APPROVAL`, `IN_REVIEW`, and `CANCELLED`, but not `PENDING_GROUP_DCEO_APPROVAL`.
- The Group DCEO route is hidden intentionally: the UI filters against actor-authorized transitions from the published graph and must not show a route the server will reject. The saved DCEO choice therefore has no runnable edge.
- Code/seed changes and the local candidate graph draft already describe direct CEO/DCEO routing. They do not change the active `WorkflowVersion` or compiled rows by themselves.
- Candidate graph was validated in memory first, then persisted as a versioned DRAFT and checked through `getVersionDetail`; validation found no blocking findings and 21 warnings described above. It is not authorization to publish.
- In-flight local records needing individual compatibility review: `HR-00007` and `HR-00008` are pending CEO with already-approved CEO rows and no pending row; `HR-00003` is Group-DCEO-approved with an approved row and no workflow history. `HR-00009` is submitted without a choice. Do not infer or write choices, approval rows, or status repairs for these records as part of this work.
- The additive schema migration was applied to local `help_center` after explicit approval and a verified backup. It added nullable choice columns without backfilling requests. Production was not touched.
- Fresh in-flight inventory reconfirmed five requests: HR-00003 `GROUP_DCEO_APPROVED` with an approved DCEO row and no workflow history; HR-00007 and HR-00008 `PENDING_CEO_APPROVAL` with already-approved CEO rows, each with a route history row and SLA paused; HR-00009 `SUBMITTED` with no choice/approval/history; HR-00010 `SUBMITTED`, selected `GROUP_DCEO`, HR-assigned, no approval/history. No data was repaired.

## Required business behavior

1. Requester selects one active same-tenant CEO or Group Deputy CEO before HR routes; no department inference.
2. Request remains HR-assigned and has no approval until HR routes.
3. HR may route once to the saved executive only. No independent target picker and no override.
4. Only that selected executive can approve/reject; exactly one approval instance exists.
5. Either approval path returns the request to HR and can reach `JOB_POSTED`; no sequential CEO-then-DCEO step.
6. Rejections retain required comments and existing return/rework semantics.
7. The HR restriction must not remove or weaken shared global Finance/ESM transitions.
8. User-facing actions follow actor-filtered active graph results. A successful empty graph result is not a fetch failure; no legacy action may bypass a missing graph edge.

## Workstreams and ordered gates

### Gate 0 — Reconfirm the target and protect records (read-only)

- Verify the app's effective local backend datasource and `current_database()`; verify current request state, HR active version, scoped and global compiled edges, approver status/tenant/RBAC, approval rows, workflow history, assignment and SLA fields immediately before authoring.
- Repeat the complete HR in-flight inventory and compare against the recorded IDs and states above. Any state drift pauses graph publication until reviewed.
- Confirm the local schema migration is applied and `help_center` has the choice columns. Retain the existing backup. Do not run seed-all, `db push`, direct status updates, or migration resets.
- Preserve unrelated changes in the working tree, including queue-teardown work. No commit/push/deploy is in scope.

Exit evidence: timestamped read-only inventory; datasource is the intended local database; no unexplained drift; backup path and checksum recorded separately.

### Gate 1 — Author the versioned HR graph (local draft only)

Start from a fresh copy of the actual active version, not from an old seed snapshot or hand-built graph. Preserve all unrelated nodes, edges, labels, permissions, SLA flags, assignees, coordinates, and hiring/interview/LOA paths.

Required HR-scoped changes:

- Add `SUBMITTED -> PENDING_GROUP_DCEO_APPROVAL` with `ESCALATE`, HR-agent/admin permissions consistent with the CEO route, no comment requirement, and no graph auto-assignment (controller owns the selected-person assignment).
- Add `IN_REVIEW -> PENDING_GROUP_DCEO_APPROVAL` with the same constraints.
- Keep `SUBMITTED -> PENDING_CEO_APPROVAL` (`SUBMIT`) and `IN_REVIEW -> PENDING_CEO_APPROVAL` (`ADVANCE`).
- Remove only the HR-scoped `CEO_APPROVED -> PENDING_GROUP_DCEO_APPROVAL` sequential branch.
- Add `CEO_APPROVED -> JOB_POSTED` (`ADVANCE`) so the CEO-selected path can progress.
- Preserve `GROUP_DCEO_APPROVED -> JOB_POSTED` and all downstream HR recruitment edges.

Use the workflow designer/version service to create and save a DRAFT in local `help_center`; do not insert raw graph rows. Confirm designer/editor schemas and transition labels are accepted before saving. Labels must be unique for each source node and supported by validation; the approved candidate uses CEO `SUBMIT`/`ADVANCE` and DCEO `ESCALATE`. Validate structure and live occupancy before any local activation. Existing legacy `CANCEL` label warnings should be reported separately and not silently rewritten in this feature.

Exit evidence: draft `4b48ff0c-6068-465a-8205-b1cc737a451c` (v2), cloned from active v1 `4d98228b-8b55-4aad-af2b-ca126d8485bf`; 23 nodes/47 edges; one sequential edge removed; two direct DCEO route edges and one CEO-to-job-posted edge added. `getVersionDetail` validation returned no blocking findings and 21 pre-existing warnings (5 comment warnings, 16 legacy label warnings). No published version yet.

### Gate 2 — Reconcile live occupancy before local activation

- Inspect the designer's live-data validation for every request status in this HR workflow. Compare status occupancy with draft nodes/edges and the approval/history/assignee evidence.
- Do not treat the three inconsistent historical records as healthy just because their status nodes remain in the graph. Decide individually whether they can remain on the new version or need separately approved, audited compatibility handling. Do not automatically create choices/approvals, reinterpret historical approvals, or move status.
- For `HR-00009`, keep the requester's choice action available while still `SUBMITTED`; it can be routed after the requester explicitly chooses. Do not change the restored business record just to test.
- For `HR-00010`, verify saved Group DCEO choice remains unchanged and there is still no pending approval before routing.
- If the designer's publish validator blocks on occupied/removed transition nodes or exposes any unclassified stranded request, stop. Produce a record-by-record compatibility proposal; activation is not a workaround for unresolved history.
- Specific compatibility issue remains: HR-00007/08 have pending request status but approved (not pending) CEO approval rows; HR-00003 has approved DCEO status/row but no workflow history. The draft retains every one of these statuses and downstream status edges, so none is stranded by node removal, but their approval/history mismatch needs a separate owner disposition before local activation. HR-00009 is not to be silently selected or routed.

Exit evidence still pending: request-by-request state/approval/history/assignment/SLA table is recorded above; the workflow graph does not remove those statuses, but an explicit compatibility disposition is still needed for the three mismatched historic records before activation. No unapproved data repair has occurred.

### Gate 3 — Activate local workflow and prove the runtime projection

Only after Gates 0–2 are explicitly reviewed, activate the validated DRAFT in local `help_center` using the supported workflow-version lifecycle service/UI, not ad hoc SQL. This is a local runtime change, separate from production.

Read back and verify:

- Exactly one ACTIVE `HR_RECRUITMENT` version; previous v1 is archived and available for supported rollback.
- Compiled HR-scoped transitions exactly match the draft (including DCEO direct routes and CEO/DCEO job-posting edges), with route permissions and comment flags intact.
- Global CEO-to-DCEO rows remain only where needed by ESM/Finance; verify the HR command invariant blocks their use on `NEW_HIRING`.
- HR decision/rejection actor roles and HR-team guards remain enforced; no empty/incorrect allow-list broadens access.
- Active workflow steps preserve SLA pause flags for CEO/DCEO gates and do not change unrelated downstream steps.

Rollback: if the local graph is wrong, use the workflow version rollback service to restore the prior archived version, then verify active version and compiled rows. Do not manually delete compiled rows or change request state.

### Gate 4 — Authenticated acceptance on disposable fixtures, then existing HR-00010

Use a disposable HR request in an isolated test database for mutations first. Add/retain integration assertions for both choices and non-target actors, then exercise the local browser/API with controlled test identities only after Gate 3.

CEO and DCEO paths separately:

1. Requester-created hiring request stores the selected user and role, remains `SUBMITTED`/HR-assigned, and has no approval/history until routing.
2. HR agent sees only the persisted selected executive route; routing creates exactly one PENDING approval, assigns that person, increments request version once, writes one history row, pauses SLA as configured, and queues durable notification intent.
3. Wrong executive/tenant, non-HR routing actor, no choice, inactive/wrong-role target, requester self-selection, route replay and stale choice version fail with 4xx and no partial state.
4. Selected executive alone can approve or reject; duplicate/replayed decision and opposite executive fail; approval row is updated rather than duplicated; status/history/assignment/SLA and outbox agree.
5. Approved CEO and approved DCEO branches each return assignment to HR and can mark job posted; rejection requires a reason and leaves no second pending executive approval.
6. Read back exact request, approval(s), workflow history, assignment, SLA pause fields, and outbox event after each mutation. Verify notification handler targets the saved executive and delivery remains outbox-driven.
7. Frontend refresh must display the active graph action and saved executive. Cover successful-empty vs request-failure graph loading, so a graph API error uses only the documented fallback while a successful graph lacking an edge hides the action.

After the disposable journey passes, reproduce on `HR-00010` only if its latest state still matches the baseline. Do not route it automatically; an authorized HR agent performs the user-requested test interaction. Re-read state afterward and ensure no duplicate approval/history or unintended status change.

### Gate 5 — Production release (not authorized by this plan)

Production requires a separate change approval and release plan: backup plus restore proof, read-only inventory of all HR in-flight requests, approved per-record compatibility dispositions, exact commit/image review, active graph re-read, dry-run validation, schema/migration status, compiled-row audit, publication/rollback procedure, and post-release authenticated browser/API evidence. No production migration, workflow publication, ticket repair, or deployment is implied here.

## Likely implementation/config files

Already changed and to review before touching: `backend/prisma/seed-esm-transitions.ts`, `backend/src/services/availableTransitions.service.ts`, `backend/src/services/hrExecutiveTransitionPolicy.ts`, `backend/src/services/transitionGuards.ts`, `backend/src/services/workflowCommand.service.ts`, `backend/src/services/requestTransition.service.ts`, `backend/src/controllers/approval.controller.ts`, `backend/src/controllers/hrJobPosting.controller.ts`, `frontend/src/components/request-detail/DecisionPanel.tsx`, `frontend/src/utils/workflowActions.ts`, `frontend/src/utils/workflowModalConfig.ts`, and HR tests.

Workflow graph persistence should use the existing workflow-designer/version routes and services; inspect their validators, controllers and authoring UI at execution time rather than writing directly to `WorkflowVersion`, `WorkflowNode`, `WorkflowEdge`, `WorkflowTransition`, or `WorkflowStep` tables. The active graph is database-owned runtime configuration, not activated by changing the seed file.

## Verification commands and gates

- Backend: `npm run build`, `npm run lint`, focused HR/controller/transition suites, then full `npm test -- --runInBand --forceExit` against the exact disposable DB with a verified `current_database()` assertion. Capture full logs under Hermes scratch and report counts/failures.
- Frontend: focused DecisionPanel/routing/draft tests, `npm test -- --run`, `npx tsc --noEmit`, and `npm run build`. Keep the three known unrelated type errors separate unless their baseline changes.
- Prisma/runtime: `npx prisma validate`, `npx prisma migrate status`; query active/archived version rows, draft graph, compiled scoped/global transitions, workflow steps, and exact ticket state before/after.
- Final `git diff --check`; preserve other working-tree changes and do not commit unless separately requested.

## Definition of done

- Requester choice is saved and HR assignment/creation behavior stays intact.
- The active local graph exposes the route matching the saved CEO or DCEO choice and both approved branches reach job posting.
- No HR sequential CEO-to-DCEO step; no global fallback bypass; ESM/Finance remain unaffected.
- Authenticated UI and API journeys pass for CEO and DCEO, including deny/replay/rollback, SLA, history, assignment, and durable outbox checks.
- Existing inconsistent in-flight HR requests have documented, separately approved dispositions before activation; no silent backfill/repair.
- Local version rollback is verified. Production remains unchanged until its separate release gate is approved.
