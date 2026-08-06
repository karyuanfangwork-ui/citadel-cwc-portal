# Fixed Service Desk Agent Auto-Assignment Implementation Plan

> **For Hermes:** Execute this plan task-by-task using the development-workflow and CWC frontend implementation guidance. Preserve unrelated working-tree changes.

**Goal:** Allow an administrator to select one specific active Finance/IT/HR agent in Service Desk settings so newly created requests for that desk are automatically assigned to that person, while preserving the existing team-based Round Robin, Least Loaded, Random, and manual-assignment behaviors.

**Architecture:** Add an optional fixed assignee to `ServiceDesk`. The fixed user takes precedence over team strategy in the existing post-create `autoAssignRequest()` path. The admin Service Desk modal will load eligible agents for the selected team and persist the selected user ID. Existing requests remain unchanged; changing the Service Desk rule affects new requests only. Existing request-level manual assignment remains available.

**Tech Stack:** Prisma/PostgreSQL, Express/TypeScript, React 19/TypeScript/Vite, Jest backend tests, frontend Vitest tests.

---

## 1. Current findings and constraints

- The Service Desk model currently stores only `autoAssignTeam`, `assignmentStrategy`, and `lastAssignedIndex`.
- `frontend/src/components/admin/ServiceDeskModal.tsx` exposes a team selector and strategy selector, but no individual-agent selector.
- `backend/src/services/autoAssignment.service.ts` selects all active `AGENT`/`ADMIN` users with an exact `agentTeam` match and then applies the strategy.
- `backend/src/controllers/request.controller.ts:1287-1317` invokes `autoAssignRequest()` after request creation and records the assignment activity/notification.
- Existing request-level manual assignment is already available through `AssignAgentModal.tsx` and `PUT /requests/:id/assign`.
- `GET /service-desks/:id/agents` already returns eligible agents, but currently returns only the team-based list and uses case-sensitive `agentTeam` matching.
- Live data contains `shah@test.local` with `agentTeam = "Finance"`, while the Finance desk uses `autoAssignTeam = "FINANCE"`. The implementation must normalize/validate team values so this does not silently exclude the user.
- Workflow transition `autoAssignUserId` exists separately. It must not be repurposed as the Service Desk creation rule because Finance requests are auto-assigned during creation, before the ordinary workflow transition path.
- Do not modify or overwrite the user’s existing unrelated changes in the current working tree.

## 2. Proposed behavior

### Configuration

Service Desk settings will contain:

- Auto-assign team: `NONE`, `IT`, `HR`, or `FINANCE`
- Assignment mode:
  - `FIXED_AGENT`
  - `ROUND_ROBIN`
  - `LEAST_LOADED`
  - `RANDOM`
- Specific agent: an active `AGENT`/`ADMIN` belonging to the selected team; required only for `FIXED_AGENT`

The UI may preserve the existing strategy field and add `FIXED_AGENT` as a fourth option. This is the smallest compatibility-preserving design.

### Runtime precedence

```text
if autoAssignTeam is NONE:
    do not auto-assign
else if assignmentStrategy is FIXED_AGENT and autoAssignUserId exists:
    validate target is active and eligible for the configured team
    assign to target
else:
    use existing team strategy
```

If a configured fixed user becomes inactive, loses the required role, or no longer belongs to the configured team, fail safely by leaving the request unassigned and logging a clear reason. Do not silently choose a different user because that would violate the administrator’s explicit fixed assignment. The admin UI should surface the invalid configuration.

### Team normalization

Normalize team values at comparison/validation boundaries with `trim().toUpperCase()`. Do not rewrite all existing user data as part of this feature. A separate controlled data cleanup can normalize current rows such as `Finance` to `FINANCE`.

### Existing requests

Changing the Service Desk fixed-agent setting must not reassign existing tickets. Existing tickets continue to support manual assignment through the request detail assignment UI.

---

## 3. Implementation tasks

### Task 1: Add the fixed-assignee field to Prisma

**Objective:** Persist the optional Service Desk fixed assignee with a safe nullable foreign key.

**Files:**
- Modify: `backend/prisma/schema.prisma` (`ServiceDesk` model around lines 419-445; `User` relations around lines 121-145)
- Create: Prisma migration under `backend/prisma/migrations/<timestamp>_add_service_desk_fixed_assignee/migration.sql`

**Changes:**
- Add `autoAssignUserId String? @map("auto_assign_user_id") @db.Uuid` to `ServiceDesk`.
- Add a named relation from `ServiceDesk` to `User`, with `onDelete: SetNull`.
- Add the inverse `User[]` relation with the same relation name.
- Add an index on `autoAssignUserId` if the generated migration does not already provide one through the relation.
- Keep the field nullable so all existing Service Desks continue to use their current team strategy.

**Verification:**
- Run `npm run prisma:generate` from `backend/`.
- Run the backend build/typecheck.
- Inspect the generated migration and confirm it is additive, nullable, and does not rewrite existing ticket assignments.
- Regenerate tenant model metadata if required by the repository’s schema-change workflow: `npx ts-node scripts/generate-tenant-models.ts`.

### Task 2: Extend backend Service Desk contracts and validation

**Objective:** Accept, validate, and return the fixed-agent configuration through the existing Service Desk API.

**Files:**
- Modify: `backend/src/validators/serviceDesk.validator.ts`
- Modify: `backend/src/controllers/serviceDesk.controller.ts`
- Modify: `backend/src/services/serviceDesk.service.ts`
- Modify: `backend/src/routes/serviceDesk.routes.ts` only if a dedicated validation route is added

**Changes:**
- Add `autoAssignUserId: z.string().uuid().nullable().optional()` to create/update schemas.
- Permit `FIXED_AGENT` in the assignment strategy enum.
- On create/update, validate the selected user server-side, not only in the browser:
  - user exists;
  - user is active;
  - user has `AGENT` or `ADMIN` role;
  - user `agentTeam`, normalized to uppercase, matches the configured `autoAssignTeam`, unless the team is `NONE`.
- Reject `FIXED_AGENT` without an assignee with HTTP 400/422 and a user-readable message.
- Reject a fixed assignee when the team is `NONE`.
- Clear `autoAssignUserId` automatically when `autoAssignTeam` becomes `NONE`, or reject the update consistently; choose one behavior and cover it with tests. Prefer clearing it to avoid an orphaned hidden configuration.
- Return a safe assignee projection (`id`, `firstName`, `lastName`, `email`, `agentTeam`, `isActive`) in Service Desk responses where the admin UI needs it. Never return password or credential fields.

### Task 3: Make the eligible-agent endpoint authoritative for the UI

**Objective:** Ensure the admin dropdown receives exactly the valid candidates for the selected team.

**Files:**
- Modify: `backend/src/controllers/serviceDesk.controller.ts:275-343`
- Modify: `backend/src/services/serviceDesk.service.ts` if query logic is moved into the service
- Test: `backend/src/__tests__/serviceDesk.*.test.ts` or the repository’s existing service-desk test location

**Changes:**
- Keep `GET /api/v1/service-desks/:id/agents` as the source for the dropdown.
- Normalize the configured team and candidate `agentTeam` values for comparison. Because Prisma string equality is case-sensitive, either:
  - use a case-insensitive query and normalize the returned values, or
  - retrieve the bounded team roster and filter normalized values in application code.
- Return only active users with `AGENT`/`ADMIN` role membership.
- Include `isEligibleForFixedAssignment` or reject invalid saved configuration explicitly; do not make the frontend infer eligibility from display names.
- Return the current fixed assignee and strategy in the response so the UI can initialize correctly.
- Add coverage for `Finance`, `FINANCE`, inactive users, normal staff without `AGENT`/`ADMIN`, and an empty team.

### Task 4: Update the Service Desk admin UI

**Objective:** Let administrators select a specific agent after selecting a team.

**Files:**
- Modify: `frontend/src/components/admin/ServiceDeskModal.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`
- Modify: `frontend/src/services/serviceDesk.service.ts`
- Modify: `frontend/src/components/admin/ServiceDesksTab.tsx` if the summary badge needs to show the fixed assignee
- Test: `frontend/src/components/admin/__tests__/ServiceDeskModal.test.tsx` (create if absent)

**Changes:**
- Extend `DeskFormData` with `autoAssignUserId: string | null` and an optional assignee object for display.
- When `autoAssignTeam` changes:
  - fetch `/service-desks/:id/agents` for an existing desk, or use the selected desk ID and refresh the roster after team changes;
  - clear the selected user if they are no longer eligible for the newly selected team;
  - show loading, empty, and error states.
- Add a “Specific Agent”/“Assign to Agent” dropdown below the team selector.
- Add `FIXED_AGENT` to the strategy dropdown with helper text such as “Always assigns new tickets to the selected agent.”
- Disable the agent selector unless a team is selected and the strategy is `FIXED_AGENT`.
- Make the form invalid when `FIXED_AGENT` is selected without a user.
- Send `autoAssignUserId` in both create and update payloads.
- Preserve the existing “None (Manual assignment only)” behavior and all existing team strategies.
- Display the selected agent’s name and email, not only a UUID.
- Add accessible labels and stable test IDs for the team, strategy, and agent controls.

### Task 5: Implement fixed-agent runtime assignment

**Objective:** Make newly created requests use the configured person instead of the team strategy when fixed assignment is selected.

**Files:**
- Modify: `backend/src/services/autoAssignment.service.ts`
- Test: `backend/src/services/__tests__/autoAssignment.service.test.ts` (create or extend the existing assignment test)
- Possibly modify: `backend/src/controllers/request.controller.ts` only if the result shape needs a new reason/status; avoid duplicate assignment logic there

**Changes:**
- Include `autoAssignUserId` and the configured strategy in the Service Desk read.
- Add a fixed-agent branch before the eligible-agent strategy switch.
- Resolve the configured user safely and verify active state, role membership, and normalized team match.
- Return the same `AutoAssignResult` shape with `strategy: 'FIXED_AGENT'` and the target’s display name.
- Preserve the existing activity creation and notification flow in `request.controller.ts`; the activity should say that the request was assigned to the configured fixed agent and identify the strategy.
- If the fixed target is invalid, return a non-success reason such as `INVALID_FIXED_AGENT` and leave `assignedToId` null. Do not fall back silently to another agent.
- Keep the existing team strategy behavior unchanged when no fixed agent is configured.
- Consider making the assignment and Service Desk index update transactional only for the existing rotating strategies. Fixed assignment should not change `lastAssignedIndex`.

### Task 6: Harden request-level manual assignment

**Objective:** Ensure the existing manual assignment dropdown remains safe and consistent with the new fixed-assignment rules.

**Files:**
- Modify: `backend/src/controllers/request.controller.ts:1993-2062`
- Modify: `frontend/src/components/request-detail/AssignAgentModal.tsx` if the list should be team-filtered
- Modify: `frontend/src/components/request-detail/AssignToDropdown.tsx` only if it is still a live consumer
- Test: backend request-controller assignment tests and frontend assignment-modal tests

**Changes:**
- Preserve manual assignment for authorized users.
- Validate `assignedToId` exists and is active before writing it.
- Decide and document whether manual assignment may target any staff member or only `AGENT`/`ADMIN`; for the Finance queue requirement, the recommended default is active `AGENT`/`ADMIN` on the request’s service-desk team.
- Update `assignedTeam` consistently when the selected agent belongs to a team, or explicitly preserve the existing team if cross-team assignment is a supported business rule.
- Keep assignment activity, audit logging, and notification behavior.
- Add a regression test confirming an authorized user can manually assign to Shah and that the stored assignee is correct.

### Task 7: Normalize the live Finance test account data

**Objective:** Ensure the selected Finance agent is eligible in the local environment.

**Files:**
- No committed seed/password changes unless the project’s canonical seed requires it.
- Potentially modify the canonical seed/import mapping if the wrong casing is generated there.

**Changes:**
- Change the local `shah@test.local` `agentTeam` value from `Finance` to `FINANCE` through the approved local admin/data workflow or a reviewed idempotent Prisma script.
- Check the canonical seed/import source so a future reset does not reintroduce the casing mismatch.
- Do not reassign existing production/live tickets automatically as part of this feature migration.

**Verification:**
- Confirm `GET /service-desks/:id/agents` includes Shah.
- Confirm the Finance Service Desk fixed-assignee dropdown displays Shah.
- Confirm the existing `FINANCE-00015` ticket remains unchanged unless separately and explicitly reassigned.

### Task 8: Add end-to-end and regression coverage

**Objective:** Verify the complete admin configuration → request creation → assignment behavior.

**Backend tests:**
- Create Service Desk with `FIXED_AGENT` and valid user.
- Reject inactive target.
- Reject target without `AGENT`/`ADMIN` role.
- Reject target from another team.
- Accept case-insensitive team data (`Finance` vs `FINANCE`) after normalization.
- Create a Finance request and assert `assignedToId` equals the fixed user.
- Assert the fixed path does not update `lastAssignedIndex`.
- Assert no fixed user falls back to the existing configured strategy.
- Assert invalid fixed configuration leaves the request unassigned and returns the explicit reason.
- Preserve Round Robin, Least Loaded, Random, and `NONE` tests.
- Test manual assignment authorization and invalid target handling.

**Frontend tests:**
- Agent dropdown appears only when a team is selected.
- Agent list is loaded from the Service Desk agent endpoint.
- Selecting `FIXED_AGENT` requires a selected agent.
- Changing team clears an incompatible selected agent.
- Existing strategies continue to render and submit their current payloads.
- Saved fixed-agent configuration is loaded and displayed.

**Runtime smoke test:**
1. Open `/admin/settings?tab=service-desks`.
2. Edit Group Finance.
3. Select `FINANCE`.
4. Select `FIXED_AGENT`.
5. Select `Shah` / `shah@test.local`.
6. Save and reload the settings page; confirm the selection persists.
7. Create a new Finance Purchase Requisition as a requester.
8. Confirm the new request’s assignee is Shah, the assignment activity identifies fixed assignment, and Shah receives the assignment notification.
9. Confirm an existing ticket is not changed by the configuration update.

### Task 9: Run package and repository verification

**Commands:**

```bash
cd backend
npm run prisma:generate
npm run build
npm test -- --runInBand

cd ../frontend
npm run build
npm test -- --run

cd ..
git diff --check
git status --short
```

Also run focused tests during implementation before the full suites. Report unrelated existing failures separately from failures introduced by this feature. Verify the live backend process is serving the updated workspace before browser smoke testing.

---

## 4. Acceptance criteria

- An administrator can select `FIXED_AGENT` in the Service Desk editor.
- The agent dropdown contains only active eligible Finance/IT/HR agents for the selected team.
- `shah@test.local` appears after its team value is normalized to `FINANCE`.
- Saving and reloading the Service Desk preserves the selected agent.
- A newly created Finance request is assigned to the selected user, regardless of the round-robin index.
- Fixed assignment does not change `lastAssignedIndex`.
- Existing Round Robin, Least Loaded, Random, and manual-only modes continue to work.
- Invalid fixed-agent configurations fail safely and visibly; they do not silently assign to a different user.
- Existing requests are not retroactively reassigned.
- Manual request assignment remains available and records activity, audit, and notification evidence.
- Backend and frontend builds pass, focused tests pass, and the full relevant suites are reported.

## 5. Risks and decisions

### Risk: fixed user becomes inactive

Recommended behavior: leave new requests unassigned and raise an actionable configuration warning. Do not silently switch to Round Robin because that hides an administrative error.

### Risk: team casing inconsistency

Normalize at comparison/validation boundaries and correct the canonical source of `shah@test.local`. Avoid a broad destructive data rewrite.

### Risk: cross-team manual assignment

The current manual modal loads all staff, while the requested workflow is Finance-team-specific. The implementation should make the policy explicit. Recommended: fixed auto-assignment is team-constrained; manual assignment should be restricted to active agents/admins on the request’s service desk unless product policy explicitly permits cross-team assignment.

### Risk: schema migration and existing uncommitted work

The current branch already contains unrelated modified and untracked files. Before implementation, re-check `git status`, do not reset or stash blindly, and keep the migration/API/UI changes isolated for review.

### Out of scope

- Retroactively reassigning all existing Finance tickets.
- Replacing workflow transition `autoAssignUserId`.
- Building a multi-agent priority/fallback list.
- Adding workload balancing to fixed assignment.
- Changing notification templates beyond ensuring the existing assignment notification is delivered.
