# GROUP_CEO → GROUP_DCEO Rename Implementation Plan

**Date:** 2026-06-05
**Status:** APPROVED — Ready for Implementation

---

## Decisions

| Question | Decision |
|---|---|
| User email | `groupceo@test.local` (placeholder — Fang to update later) |
| Display name (UI) | "Group Deputy CEO" (full label, no "DCEO" in UI) |
| Display name (code) | `GROUP_DCEO` (enum), `groupDceo` (camelCase), `group-dceo` (kebab/API) |
| Threshold | MYR 15,000 (unchanged) |
| Import title match | `"group deputy chief executive officer"` |
| Old API paths | 404 clean break — frontend+backend deploy together, no redirect |
| Downtime | OK with a few minutes during DB migration |

---

## Naming Convention Reference

| Old | New | Context |
|---|---|---|
| `GROUP_CEO` | `GROUP_DCEO` | Enum value, role constant |
| `PENDING_GROUP_CEO_APPROVAL` | `PENDING_GROUP_DCEO_APPROVAL` | RequestStatus enum |
| `GROUP_CEO_APPROVED` | `GROUP_DCEO_APPROVED` | RequestStatus enum |
| `GROUP_CEO_REJECTED` | `GROUP_DCEO_REJECTED` | RequestStatus enum |
| `groupCeo` | `groupDceo` | camelCase (variables, params, function names) |
| `GroupCeo` | `GroupDceo` | PascalCase (component names, interfaces, types) |
| `group-ceo` | `group-dceo` | kebab-case (API route paths) |
| `groupceo` | `groupceo` | Email prefix — KEEP AS-IS (placeholder) |
| `GROUP_CEO_APPROVAL_THRESHOLD` | `GROUP_DCEO_APPROVAL_THRESHOLD` | Environment variable |
| `groupCeoApprovalThreshold` | `groupDceoApprovalThreshold` | Config key (camelCase) |
| `FINANCE_GROUP_CEO_DECISION` | `FINANCE_GROUP_DCEO_DECISION` | Notification event type |
| `RouteToGroupCeoHRModal` | `RouteToGroupDceoHRModal` | React component |
| `GroupCeoDecisionHRModal` | `GroupDceoDecisionHRModal` | React component |
| `create-group-ceo-user.ts` | `create-group-dceo-user.ts` | Script filename |
| "Group CEO" (UI label) | "Group Deputy CEO" (UI label) | All user-facing text |
| "Pending Group CEO" | "Pending Group Deputy CEO" | Status label |
| "Chairman & Group Chief Executive Officer" | "Group Deputy Chief Executive Officer" | Job title for import matching |

---

## Phase 1: Database Migration (Foundation)

**Goal:** Migrate Prisma enums and existing data safely.

### 1.1 Create migration SQL

**File:** `backend/prisma/migrations/<timestamp>_rename_group_ceo_to_group_dceo/migration.sql`

```sql
-- Step 1: Add new enum values (coexist with old temporarily)
ALTER TYPE "ExecutiveRole" ADD VALUE 'GROUP_DCEO';
ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_GROUP_DCEO_APPROVAL';
ALTER TYPE "RequestStatus" ADD VALUE 'GROUP_DCEO_APPROVED';
ALTER TYPE "RequestStatus" ADD VALUE 'GROUP_DCEO_REJECTED';

-- Step 2: Migrate existing data
UPDATE "Role" SET name = 'GROUP_DCEO' WHERE name = 'GROUP_CEO';
UPDATE "Role" SET description = 'Group Deputy Chief Executive Officer with highest approval authority' WHERE name = 'GROUP_DCEO';

UPDATE "User" SET "executiveRole" = 'GROUP_DCEO' WHERE "executiveRole" = 'GROUP_CEO';

UPDATE "Request" SET status = 'PENDING_GROUP_DCEO_APPROVAL' WHERE status = 'PENDING_GROUP_CEO_APPROVAL';
UPDATE "Request" SET status = 'GROUP_DCEO_APPROVED' WHERE status = 'GROUP_CEO_APPROVED';
UPDATE "Request" SET status = 'GROUP_DCEO_REJECTED' WHERE status = 'GROUP_CEO_REJECTED';

UPDATE "RequestApproval" SET "approverType" = 'GROUP_DCEO' WHERE "approverType" = 'GROUP_CEO';
UPDATE "RequestApproval" SET status = 'PENDING_GROUP_DCEO_APPROVAL' WHERE status = 'PENDING_GROUP_CEO_APPROVAL';
UPDATE "RequestApproval" SET status = 'GROUP_DCEO_APPROVED' WHERE status = 'GROUP_CEO_APPROVED';
UPDATE "RequestApproval" SET status = 'GROUP_DCEO_REJECTED' WHERE status = 'GROUP_CEO_REJECTED';

UPDATE "EscalationRule" SET role = 'GROUP_DCEO' WHERE role = 'GROUP_CEO';

UPDATE "NotificationConfig" SET "eventType" = 'FINANCE_GROUP_DCEO_DECISION' WHERE "eventType" = 'FINANCE_GROUP_CEO_DECISION';

UPDATE "WorkflowStep" SET status = 'PENDING_GROUP_DCEO_APPROVAL' WHERE status = 'PENDING_GROUP_CEO_APPROVAL';
UPDATE "WorkflowStep" SET status = 'GROUP_DCEO_APPROVED' WHERE status = 'GROUP_CEO_APPROVED';
UPDATE "WorkflowStep" SET status = 'GROUP_DCEO_REJECTED' WHERE status = 'GROUP_CEO_REJECTED';
UPDATE "WorkflowStep" SET "nextStatuses" = REPLACE("nextStatuses", 'GROUP_CEO', 'GROUP_DCEO') WHERE "nextStatuses" LIKE '%GROUP_CEO%';

-- Step 3: Remove old enum values
-- NOTE: PostgreSQL cannot remove enum values directly.
-- Must recreate the enum type. This is done via Prisma migration.
-- Prisma will handle this when we update schema.prisma and run migrate.
```

### 1.2 Update Prisma schema

**File:** `backend/prisma/schema.prisma`

- `ExecutiveRole` enum: `GROUP_CEO` → `GROUP_DCEO`
- `RequestStatus` enum: 3 status renames
- Run `npx prisma generate` after

### 1.3 Verify

- Run `npx prisma migrate dev` or `prisma db push`
- Confirm enum values are correct in DB
- Confirm no data loss

---

## Phase 2: Backend Code (~12 files)

### 2.1 Config & Utils

| # | File | Changes |
|---|---|---|
| 1 | `src/config/index.ts` | `groupCeoApprovalThreshold` → `groupDceoApprovalThreshold`, env var `GROUP_DCEO_APPROVAL_THRESHOLD` |
| 2 | `src/utils/executive-role.ts` | `'GROUP_CEO'` → `'GROUP_DCEO'`, comment: "GROUP_DCEO > CEO > ..." |
| 3 | `src/utils/workflowTransitions.ts` | 4 status keys + 2 transition values renamed |
| 4 | `src/utils/importStaff.ts` | Return `'GROUP_DCEO'`, match string: `'group deputy chief executive officer'` |

### 2.2 Controllers

| # | File | Changes |
|---|---|---|
| 5 | `src/controllers/approval.controller.ts` | `routeToGroupCeoHr` → `routeToGroupDceoHr`, `groupCeoDecisionHr` → `groupDceoDecisionHr`, all `groupCeo*` vars → `groupDceo*`, status strings, role strings, notification event type |
| 6 | `src/controllers/finance-workflow.controller.ts` | `GROUP_CEO_THRESHOLD` → `GROUP_DCEO_THRESHOLD`, `groupCeoDecision` → `groupDceoDecision`, `groupCeoUser`/`groupCeoId` → `groupDceoUser`/`groupDceoId`, status strings |
| 7 | `src/controllers/chargeback-workflow.controller.ts` | `'GROUP_CEO'` → `'GROUP_DCEO'` in role override checks (4 places) |
| 8 | `src/controllers/escalationRule.controller.ts` | `'GROUP_CEO'` → `'GROUP_DCEO'` in VALID_ROLES |
| 9 | `src/controllers/notificationTemplate.controller.ts` | `'FINANCE_GROUP_CEO_DECISION'` → `'FINANCE_GROUP_DCEO_DECISION'`, label `'Group CEO Decision'` → `'Group Deputy CEO Decision'` |
| 10 | `src/controllers/request.controller.ts` | All status strings, role mappings, visibility filters, approval routing dict, role display label → `'Group Deputy CEO'` |
| 11 | `src/controllers/user.controller.ts` | Valid roles array, error messages |

### 2.3 Routes

| # | File | Changes |
|---|---|---|
| 12 | `src/routes/approval.routes.ts` | Import renames, 2 route paths: `/route-to-group-dceo-hr`, `/group-dceo-decision-hr` |
| 13 | `src/routes/finance-workflow.routes.ts` | Import rename, route path `/group-dceo-decision`, `authorize('GROUP_DCEO')` |
| 14 | `src/routes/user.routes.ts` | `authorize('GROUP_DCEO')` |

---

## Phase 3: Frontend Code (~20 files + 2 renames)

### 3.1 Types & Constants

| # | File | Changes |
|---|---|---|
| 1 | `frontend/types.ts` | 3 enum values renamed |
| 2 | `frontend/constants.tsx` | 4 entries: labels "Pending Group Deputy CEO", "Group Deputy CEO Approved", "Group Deputy CEO Rejected"; status arrays |

### 3.2 Utilities

| # | File | Changes |
|---|---|---|
| 3 | `frontend/src/utils/workflowTransitions.ts` | 4 status keys + transition values |
| 4 | `frontend/src/utils/workflowModalConfig.ts` | `GROUP_DCEO_DECISION_FIN`, `ROUTE_TO_GROUP_DCEO_HR`, `GROUP_DCEO_DECISION_HR`, `approverRole` type, `groupDceoId` field, `getUsersByRole('GROUP_DCEO')` |
| 5 | `frontend/src/utils/workflowActions.ts` | Action type strings, `userRoles.includes('GROUP_DCEO')`, status conditions |
| 6 | `frontend/src/utils/roleDetection.ts` | Status array entries |

### 3.3 Components

| # | File | Changes |
|---|---|---|
| 7 | `frontend/src/components/layout/TopBar.tsx` | Role config `GROUP_DCEO: { label: 'Group Deputy CEO', ... }`, priority array |
| 8 | `frontend/src/components/layout/MobileDrawer.tsx` | Same as TopBar |
| 9 | `frontend/src/components/admin/CreateUserModal.tsx` | `{ value: 'GROUP_DCEO', label: 'Group Deputy CEO' }` |
| 10 | `frontend/src/components/admin/UserEditModal.tsx` | `<option value="GROUP_DCEO">Group Deputy CEO</option>` |
| 11 | `frontend/src/components/admin/WorkflowTransitionTab.tsx` | ROLES array |
| 12 | `frontend/src/components/admin/SLAEscalationTab.tsx` | AVAILABLE_ROLES array |
| 13 | `frontend/src/components/request-detail/ApproverPicker.tsx` | ExecutiveRole type |
| 14 | `frontend/src/components/request-detail/WorkflowStepper.tsx` | Status labels, status arrays |
| 15 | `frontend/src/components/request-detail/DecisionPanel.tsx` | Action configs, action maps |
| 16 | **RENAME** `GroupCeoDecisionHRModal.tsx` → `GroupDceoDecisionHRModal.tsx` | Component name, interface, service calls |
| 17 | **RENAME** `RouteToGroupCeoHRModal.tsx` → `RouteToGroupDceoHRModal.tsx` | Component name, interfaces (`GroupCeo` → `GroupDceo`), state vars (`groupCeos` → `groupDceos`), service calls, form field names |

### 3.4 Services

| # | File | Changes |
|---|---|---|
| 18 | `frontend/src/services/approval.service.ts` | Function names `routeToGroupDceoHR`, `groupDceoDecisionHR`, param names, endpoint paths |
| 19 | `frontend/src/services/finance-workflow.service.ts` | `groupDceoDecision` method |

### 3.5 Pages

| # | File | Changes |
|---|---|---|
| 20 | `frontend/pages/AgentDashboard.tsx` | Status strings in CLOSED_STATUSES |

---

## Phase 4: Seed Data & Scripts (8 files)

| # | File | Changes |
|---|---|---|
| 1 | `prisma/seed.ts` | Role name `'GROUP_DCEO'`, description "Group Deputy Chief Executive Officer with highest approval authority", user email `groupceo@test.local` (placeholder), displayName can stay, `executiveRole: 'GROUP_DCEO'` |
| 2 | `prisma/seed-workflows.ts` | Step labels, status codes |
| 3 | `prisma/seed-admin-config.ts` | Transition labels, event types, roles, user data |
| 4 | **RENAME** `scripts/create-group-ceo-user.ts` → `scripts/create-group-dceo-user.ts` | All contents |
| 5 | `scripts/fix-finance-workflow-steps.ts` | Step labels |
| 6 | `scripts/update-finance-workflow-steps.ts` | Step labels |
| 7 | `scripts/update_seed_users.ts` | User data |
| 8 | `scripts/admin_config_backup.json` | Regenerate from fresh seed (or bulk replace) |

---

## Phase 5: Infrastructure & Config (2 files)

| # | File | Changes |
|---|---|---|
| 1 | `.env.production.example` | `GROUP_DCEO_APPROVAL_THRESHOLD=15000` |
| 2 | `docker-compose.prod.yml` | `GROUP_DCEO_APPROVAL_THRESHOLD` env var |
| - | Production `.env` | Manual update on server during deploy |

---

## Phase 6: Documentation (4+ files)

| # | File | Changes |
|---|---|---|
| 1 | `CLAUDE.md` | Seed credentials: `groupceo@test.local` / `groupceo123`, role: GROUP_DCEO |
| 2 | `docs/credit-assessment-quick-start-guide.md` | Credentials table |
| 3 | `docs/plans/CWC_PRODUCT_DOCUMENTATION.md` | All GROUP_CEO references |
| 4 | `docs/superpowers/plans/*` | All GROUP_CEO references |
| 5 | `docs/superpowers/specs/*` | Workflow diagrams |

---

## Phase 7: Verification & Testing

| Area | What to Test |
|---|---|
| HR Hiring Flow | Create request → HR review → CEO approval → route to Group Deputy CEO → approve/reject → job posted |
| Finance PR (>MYR 15k) | Create PR > 15000 → CFO approval → auto-routes to Group Deputy CEO → approve/reject → payment processing |
| Finance PR (≤MYR 15k) | Create PR ≤ 15000 → CFO approval → skips Group Deputy CEO → payment processing |
| Chargeback Override | GROUP_DCEO role can approve in lieu of entity approver |
| Dashboard Visibility | GROUP_DCEO user sees only their assigned approval requests |
| Escalation Rules | GROUP_DCEO appears in role dropdown, rules fire correctly |
| User Creation | GROUP_DCEO role appears in Create/Edit User modals |
| Notifications | `FINANCE_GROUP_DCEO_DECISION` event fires, email/push delivered |
| Existing Requests | No requests stuck in old statuses; all historical data migrated |
| Import Staff | Title "group deputy chief executive officer" maps to GROUP_DCEO |

---

## Phase 8: Deploy Sequence

1. **Create feature branch** `feature/rename-group-ceo-to-group-dceo`
2. **Stop** backend + frontend services
3. **Run** database migration (`npx prisma migrate deploy`)
4. **Deploy** new backend code
5. **Deploy** new frontend build
6. **Update** production `.env` with `GROUP_DCEO_APPROVAL_THRESHOLD=15000`
7. **Re-seed** admin config if needed (or run migration SQL for notification templates)
8. **Invalidate** all JWTs — users must re-login to pick up new role names
9. **Verify** the GROUP_DCEO user can log in and approve requests end-to-end