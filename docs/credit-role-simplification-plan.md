# Credit Assessment Module — Role Simplification Implementation Plan

**Date:** June 2026  
**Status:** DRAFT — awaiting review  
**Impact:** Backend, Frontend, Database, Seed Data

---

## 1. Current State (Problems)

### 1.1 Too Many Roles (7 credit roles + ADMIN)

| Role | Purpose | Problem |
|------|---------|---------|
| CREDIT_RM | Create & manage applications | ✅ Keep |
| CREDIT_ANALYST | Scoring, spreading, analysis | ✅ Keep |
| CREDIT_MANAGER | Approve within authority | Overlaps heavily with CREDIT_SENIOR |
| CREDIT_SENIOR | Higher-value approvals, risk | 93% permission overlap with CREDIT_MANAGER — only `credit:risk` differs |
| CREDIT_COMMITTEE | Vote on committee decisions | 1 unique permission (`credit:committee`) that's NOT enforced on any backend route |
| CREDIT_ADMIN | Full config & management | ✅ Keep |
| CREDIT_OPS | Disbursement ops | Has only 1 unique action (disburse) — doesn't justify a full role |
| ADMIN | System-wide admin | Also has all credit perms — overlaps CREDIT_ADMIN entirely within credit scope |

### 1.2 Too Many Permissions (17 — 9 Unused on Routes)

| Permission | Enforced on Routes? | Problem |
|-----------|---------------------|---------|
| credit:read | ✅ YES | Keep |
| credit:write | ✅ YES | Keep |
| credit:create | ✅ YES | Keep (maker-checker SoD) |
| credit:approve | ✅ YES | Keep |
| credit:admin | ✅ YES | Keep |
| credit:disburse | ✅ YES | Keep (SoD from create) |
| credit:compliance | ✅ YES | Keep |
| credit:export | ✅ YES | Keep |
| credit:delete | ❌ NOT ENFORCED | `credit:admin` already gates all delete routes |
| credit:committee | ❌ NOT ENFORCED | Only used in frontend nav gating — `credit:approve` should cover it |
| credit:score | ❌ NOT ENFORCED | Routes use `credit:write` |
| credit:spread | ❌ NOT ENFORCED | Routes use `credit:write` |
| credit:analyze | ❌ NOT ENFORCED | Only used in frontend nav — `credit:read` should cover it |
| credit:risk | ❌ NOT ENFORCED | Not enforced anywhere |
| credit:override | ❌ NOT ENFORCED | Override IS an approval action — should be `credit:approve` |
| credit:monitor | ❌ NOT ENFORCED | Viewing = `credit:read`, actions = `credit:write` |
| credit:document | ❌ NOT ENFORCED | Upload/download routes use `credit:write`/`credit:read` |

### 1.3 Authority Level Confusion

The approval matrix uses `authorityLevel` strings that DON'T match role names:

| Authority Level | Role | Hierarchy |
|-----------------|------|-----------|
| CREDIT_RM | CREDIT_RM | 1 |
| CREDIT_MANAGER | CREDIT_MANAGER | 2 |
| SENIOR_CREDIT_OFFICER | (no matching role — uses CREDIT_SENIOR) | 3 |
| CREDIT_COMMITTEE | CREDIT_COMMITTEE | 4 |
| BOARD_RISK_COMMITTEE | (no matching role at all) | 5 |

The `AUTHORITY_HIERARCHY` in `approvalAction.service.ts` uses `SENIOR_CREDIT_OFFICER` not `CREDIT_SENIOR`, and there's a `BOARD_RISK_COMMITTEE` level that has no corresponding role. This is confusing.

---

## 2. Target State

### 2.1 Simplified Roles: 4 Credit Roles + ADMIN

| New Role | Merged From | Description |
|----------|-------------|-------------|
| **CREDIT_RM** | CREDIT_RM (unchanged) | Relationship Manager — creates applications, manages borrowers, monitors |
| **CREDIT_ANALYST** | CREDIT_ANALYST (unchanged) | Analyst — scoring, spreading, analysis |
| **CREDIT_MANAGER** | CREDIT_MANAGER + CREDIT_SENIOR + CREDIT_COMMITTEE | Unified approval authority — all checker levels. Approval matrix `authorityLevel` determines their tier, not their role |
| **CREDIT_ADMIN** | CREDIT_ADMIN (unchanged) | Admin — full config, overrides, compliance |
| _ADMIN_ | _Unchanged_ | System admin (keep all credit perms for super-access) |

**CREDIT_OPS dissolution:** Move `credit:disburse` permission to CREDIT_RM (they already handle the full lifecycle). If regulatory SoD requires a separate disbursement role, keep CREDIT_OPS — but document the SoD rationale clearly.

### 2.2 Simplified Permissions: 8 from 17

| Permission | What It Gates | Replaces |
|------------|---------------|----------|
| `credit:read` | View all credit data | + `credit:analyze` + `credit:monitor` (read-only parts) |
| `credit:write` | Create/edit credit data | + `credit:score` + `credit:spread` + `credit:document` |
| `credit:create` | Create new applications (maker-only) | (unchanged) |
| `credit:approve` | Approve/reject/committee/veto/override | + `credit:committee` + `credit:override` + `credit:risk` |
| `credit:admin` | Config, force actions, delete | + `credit:delete` |
| `credit:disburse` | Disburse approved facilities | (unchanged) |
| `credit:compliance` | AML/compliance functions | (unchanged) |
| `credit:export` | Export with reason capture | (unchanged) |

**Dropped permissions (9):** `credit:delete`, `credit:committee`, `credit:score`, `credit:spread`, `credit:analyze`, `credit:risk`, `credit:override`, `credit:monitor`, `credit:document`

### 2.3 New Role → Permission Matrix

```
Permission      RM  ANALYST  MANAGER  ADMIN  SYS_ADMIN
────────────────────────────────────────────────────────
credit:read      ✓     ✓        ✓       ✓        ✓
credit:write    ✓     ✓        ✓                ✓
credit:create    ✓                        ✓       ✓
credit:approve                  ✓       ✓        ✓
credit:admin                            ✓       ✓
credit:disburse  ✓                                ✓
credit:compliance                              ✓       ✓
credit:export    ✓     ✓        ✓       ✓        ✓
```

### 2.4 Simplified Authority Levels

Replace the 5-level hierarchy with a clear 4-level system aligned to roles:

| Authority Level | Role That Holds It | Approval Matrix Tiers |
|-----------------|-------------------|----------------------|
| `RM` | CREDIT_RM (level 1) | Tier 1: RM can approve up to RM 500K |
| `MANAGER` | CREDIT_MANAGER (level 2) | Tier 2: Manager required for RM 500K–5M |
| `COMMITTEE` | CREDIT_MANAGER (level 3) | Tier 3: Committee (multiple managers) for > RM 5M |
| `BOARD` | CREDIT_ADMIN / ADMIN (level 4) | Tier 4: Board-level overrides |

This means:
- Remove `SENIOR_CREDIT_OFFICER` authority level — merge into `MANAGER`
- Rename `CREDIT_COMMITTEE` authority level to `COMMITTEE`
- Keep `BOARD_RISK_COMMITTEE` → rename to `BOARD`
- The approval matrix `authorityLevel` is now a tier identifier, NOT a role name

---

## 3. Implementation Steps

### Phase 1: Backend — Permission Cleanup (Low Risk)

**Files to modify:**

#### 3.1 Update `backend/prisma/seed.ts`

**Add new role permission map for CREDIT_MANAGER (expanded):**
```typescript
const rolePermissionMap: Record<string, string[]> = {
  // ... existing roles ...
  CREDIT_RM: ['credit:read', 'credit:write', 'credit:create', 'credit:export', 'credit:disburse'],
  CREDIT_ANALYST: ['credit:read', 'credit:write', 'credit:export'],
  CREDIT_MANAGER: [
    'credit:read', 'credit:write', 'credit:approve',
    'credit:export',
    // credit:committee, credit:score, credit:spread, credit:analyze,
    // credit:risk, credit:override, credit:monitor, credit:document
    // → all absorbed into the 8 core permissions above
  ],
  CREDIT_ADMIN: [
    'credit:read', 'credit:write', 'credit:create', 'credit:approve',
    'credit:admin', 'credit:disburse', 'credit:compliance', 'credit:export',
  ],
  // ADMIN gets all 8
};

// Remove from permissions array:
// credit:delete, credit:committee, credit:score, credit:spread,
// credit:analyze, credit:risk, credit:override, credit:monitor, credit:document
```

**Add cleanup block (like the existing `credit:create` cleanup):**
```typescript
// §3.1 — Cleanup: Remove deprecated permissions from all roles
const deprecatedPerms = [
  'credit:delete', 'credit:committee', 'credit:score', 'credit:spread',
  'credit:analyze', 'credit:risk', 'credit:override', 'credit:monitor', 'credit:document',
];
for (const permName of deprecatedPerms) {
  const permId = permMap.get(permName);
  if (permId) {
    const deleted = await prisma.rolePermission.deleteMany({
      where: { permissionId: permId },
    });
    if (deleted.count > 0) console.log(`  🧹 Removed ${permName} from ${deleted.count} role assignments`);
  }
}

// §3.2 — Cleanup: Migrate CREDIT_SENIOR and CREDIT_COMMITTEE users to CREDIT_MANAGER
const mergedRoles = ['CREDIT_SENIOR', 'CREDIT_COMMITTEE'];
const managerRole = await prisma.role.findUnique({ where: { name: 'CREDIT_MANAGER' } });
for (const oldRoleName of mergedRoles) {
  const oldRole = await prisma.role.findUnique({ where: { name: oldRoleName } });
  if (!oldRole) continue;
  // Migrate user_role assignments
  const userRoles = await prisma.userRole.findMany({ where: { roleId: oldRole.id } });
  for (const ur of userRoles) {
    // Check if user already has CREDIT_MANAGER to avoid duplicate
    const existing = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: ur.userId, roleId: managerRole!.id } },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: ur.userId, roleId: managerRole!.id },
      });
    }
  }
  // Remove old role's permission assignments
  await prisma.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
  console.log(`  🔄 Migrated ${userRoles.length} users from ${oldRoleName} to CREDIT_MANAGER`);
}
// Optionally: keep the old role records (soft deprecation) or delete them
// await prisma.role.deleteMany({ where: { name: { in: mergedRoles } } });
```

**For CREDIT_OPS migration:**
```typescript
// §3.3 — Cleanup: Migrate CREDIT_OPS users to CREDIT_RM (or keep CREDIT_OPS with just credit:disburse)
const opsRole = await prisma.role.findUnique({ where: { name: 'CREDIT_OPS' } });
if (opsRole) {
  const rmRole = await prisma.role.findUnique({ where: { name: 'CREDIT_RM' } });
  const userRoles = await prisma.userRole.findMany({ where: { roleId: opsRole.id } });
  for (const ur of userRoles) {
    const existing = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: ur.userId, roleId: rmRole!.id } },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: ur.userId, roleId: rmRole!.id },
      });
    }
  }
  await prisma.rolePermission.deleteMany({ where: { roleId: opsRole.id } });
  console.log(`  🔄 Migrated ${userRoles.length} CREDIT_OPS users to CREDIT_RM`);
}
```

#### 3.2 Update `backend/src/credit/middleware/sod.middleware.ts`

```typescript
// BEFORE:
const APPROVER_ROLES = ['CREDIT_MANAGER', 'CREDIT_SENIOR', 'CREDIT_COMMITTEE'];

// AFTER:
const APPROVER_ROLES = ['CREDIT_MANAGER'];
```

#### 3.3 Update `backend/src/credit/middleware/rmScope.middleware.ts`

```typescript
// BEFORE:
const RM_SCOPE_BYPASS_ROLES = ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER', 'CREDIT_SENIOR', 'CREDIT_COMMITTEE'];

// AFTER:
const RM_SCOPE_BYPASS_ROLES = ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER'];
```

#### 3.4 Update `backend/src/credit/middleware/fieldEncryption.middleware.ts`

```typescript
// BEFORE:
['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER', 'CREDIT_SENIOR'].includes(r)

// AFTER:
['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER'].includes(r)
```

#### 3.5 Update `backend/src/credit/middleware/assertBorrowerAccess.middleware.ts`

```typescript
// BEFORE:
const ADMIN_ROLES = ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER', 'CREDIT_SENIOR', 'CREDIT_COMMITTEE'];

// AFTER:
const ADMIN_ROLES = ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER'];
```

#### 3.6 Update `backend/src/credit/services/approvalAction.service.ts`

**Replace AUTHORITY_HIERARCHY:**
```typescript
// BEFORE:
const AUTHORITY_HIERARCHY: Record<string, number> = {
  CREDIT_RM: 1,
  CREDIT_MANAGER: 2,
  SENIOR_CREDIT_OFFICER: 3,
  CREDIT_COMMITTEE: 4,
  BOARD_RISK_COMMITTEE: 5,
};

// AFTER:
export enum ApprovalAuthorityLevel {
  RM = 'RM',
  MANAGER = 'MANAGER',
  COMMITTEE = 'COMMITTEE',
  BOARD = 'BOARD',
}

const AUTHORITY_HIERARCHY: Record<string, number> = {
  [ApprovalAuthorityLevel.RM]: 1,
  [ApprovalAuthorityLevel.MANAGER]: 2,
  [ApprovalAuthorityLevel.COMMITTEE]: 3,
  [ApprovalAuthorityLevel.BOARD]: 4,
};

// BEFORE:
function getRoleNamesForAuthorityLevel(level: number): string[] {
  const mapping: Record<number, string[]> = {
    1: ['CREDIT_RM'],
    2: ['CREDIT_MANAGER'],
    3: ['SENIOR_CREDIT_OFFICER'],
    4: ['CREDIT_COMMITTEE'],
    5: ['BOARD_RISK_COMMITTEE'],
  };
  return mapping[level] ?? ['CREDIT_ADMIN'];
}

// AFTER:
function getRoleNamesForAuthorityLevel(level: number): string[] {
  // Committee-level approval: find all CREDIT_MANAGER users
  // Board-level approval: find CREDIT_ADMIN and ADMIN users
  const mapping: Record<number, string[]> = {
    1: ['CREDIT_RM'],         // Tier 1: RM self-approval
    2: ['CREDIT_MANAGER'],    // Tier 2: Single manager approval
    3: ['CREDIT_MANAGER'],    // Tier 3: Committee (multiple managers)
    4: ['CREDIT_ADMIN'],      // Tier 4: Board/admin override
  };
  return mapping[level] ?? ['CREDIT_ADMIN'];
}
```

**Important:** The `authorityLevel` field in `CreditDecision` and `CreditApprovalMatrix` is stored as a string in the DB. This requires data migration (see Phase 3).

#### 3.7 Update `backend/src/credit/types/credit.types.ts`

```typescript
// BEFORE:
export enum ApprovalAuthorityLevel {
  // ... potentially other values
  SENIOR_CREDIT_OFFICER = 'SENIOR_CREDIT_OFFICER',
  CREDIT_COMMITTEE = 'CREDIT_COMMITTEE',
  BOARD_RISK_COMMITTEE = 'BOARD_RISK_COMMITTEE',
}

// AFTER:
export enum ApprovalAuthorityLevel {
  RM = 'RM',
  MANAGER = 'MANAGER',
  COMMITTEE = 'COMMITTEE',
  BOARD = 'BOARD',
}
```

#### 3.8 Update `backend/src/services/policyExplainer.service.ts`

```typescript
// BEFORE:
const roleLabels: Record<string, string> = {
  CREDIT_RM: 'Credit RM',
  CREDIT_MANAGER: 'Credit Manager',
  SENIOR_CREDIT_OFFICER: 'Senior Credit Officer',
  CREDIT_COMMITTEE: 'Credit Committee',
  BOARD_RISK_COMMITTEE: 'Board Risk Committee',
};

// AFTER:
const roleLabels: Record<string, string> = {
  RM: 'Relationship Manager',
  MANAGER: 'Credit Manager',
  COMMITTEE: 'Credit Committee',
  BOARD: 'Board / Risk Committee',
};
```

#### 3.9 Add backend route protection for removed permissions

Since routes currently use `credit:read` and `credit:write` (not the removed permissions), no route changes are needed for the permission consolidation itself. The removed permissions aren't enforced in `requirePermission()` calls.

However, check the frontend `CreditNav.tsx` which gates the Committee nav item on `credit:committee`:

```tsx
// BEFORE:
{ to: '/credit/committee', label: 'Committee', icon: 'groups', permission: 'credit:committee' },

// AFTER:
{ to: '/credit/committee', label: 'Committee', icon: 'groups', permission: 'credit:approve' },
```

---

### Phase 2: Frontend — Update UI & Permission Checks

#### 3.10 Update `frontend/src/components/CreditNav.tsx`

```tsx
// Change committee nav gating from credit:committee → credit:approve
{ to: '/credit/committee', label: 'Committee', icon: 'groups', permission: 'credit:approve' },
```

#### 3.11 Update `frontend/pages/credit/creditUtils.ts`

```typescript
// BEFORE:
const isRm = currentUser?.roles?.some(r => r === 'credit:rm' || r === 'CREDIT_RM') ?? false;

// AFTER: (unchanged — still checks CREDIT_RM)
const isRm = currentUser?.roles?.some(r => r === 'CREDIT_RM') ?? false;
```

Note: `r === 'credit:rm'` is likely a bug (mixing permission string with role name). Clean up while we're here.

#### 3.12 Update `frontend/pages/CreditApplicationDetail.tsx`

```tsx
// BEFORE:
roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']}
roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']}

// AFTER: (same — CREDIT_MANAGER now absorbs CREDIT_SENIOR/COMMITTEE)
roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']}
roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']}
```

No changes needed — CREDIT_SENIOR/COMMITTEE users will be migrated to CREDIT_MANAGER.

#### 3.13 Search and remove all references to removed roles

```bash
# Search for CREDIT_SENIOR, CREDIT_COMMITTEE, CREDIT_OPS in frontend
grep -rn "CREDIT_SENIOR\|CREDIT_COMMITTEE\|CREDIT_OPS" frontend/ \
  --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

Expected files to update:
- Any role selection dropdowns in admin UI
- Any role-based conditional rendering
- Auth context or permission helper references

#### 3.14 Search and remove all references to removed permissions

```bash
# Search for removed permissions in frontend
grep -rn "credit:committee\|credit:score\|credit:spread\|credit:analyze\|credit:risk\|credit:override\|credit:monitor\|credit:document\|credit:delete" frontend/ \
  --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

---

### Phase 3: Database Migration

#### 3.15 Authority level data migration

The `authorityLevel` column in `CreditDecision` and `CreditApprovalMatrix` contains string values that must be migrated:

```sql
-- Step 1: Add new authority level values (if using enum)
-- If authorityLevel is VARCHAR, no enum change needed — just UPDATE

-- Step 2: Migrate CreditDecision.authorityLevel
UPDATE "CreditDecision"
SET "authorityLevel" = 'RM'
WHERE "authorityLevel" = 'CREDIT_RM';

UPDATE "CreditDecision"
SET "authorityLevel" = 'MANAGER'
WHERE "authorityLevel" IN ('CREDIT_MANAGER', 'SENIOR_CREDIT_OFFICER');

UPDATE "CreditDecision"
SET "authorityLevel" = 'COMMITTEE'
WHERE "authorityLevel" = 'CREDIT_COMMITTEE';

UPDATE "CreditDecision"
SET "authorityLevel" = 'BOARD'
WHERE "authorityLevel" = 'BOARD_RISK_COMMITTEE';

-- Step 3: Migrate CreditApprovalMatrix.authorityLevel
UPDATE "CreditApprovalMatrix"
SET "authorityLevel" = 'RM'
WHERE "authorityLevel" = 'CREDIT_RM';

UPDATE "CreditApprovalMatrix"
SET "authorityLevel" = 'MANAGER'
WHERE "authorityLevel" IN ('CREDIT_MANAGER', 'SENIOR_CREDIT_OFFICER');

UPDATE "CreditApprovalMatrix"
SET "authorityLevel" = 'COMMITTEE'
WHERE "authorityLevel" = 'CREDIT_COMMITTEE';

UPDATE "CreditApprovalMatrix"
SET "authorityLevel" = 'BOARD'
WHERE "authorityLevel" = 'BOARD_RISK_COMMITTEE';

-- Step 4: Migrate users from old roles to CREDIT_MANAGER
-- (This should also be done in the seed, but run here for production data)
INSERT INTO "UserRole" ("userId", "roleId")
SELECT ur."userId", mr.id
FROM "UserRole" ur
JOIN "Role" mr ON mr.name = 'CREDIT_MANAGER'
WHERE ur."roleId" IN (
  SELECT id FROM "Role" WHERE name IN ('CREDIT_SENIOR', 'CREDIT_COMMITTEE', 'CREDIT_OPS')
)
ON CONFLICT DO NOTHING;

-- Step 5: Remove old role assignments
DELETE FROM "UserRole"
WHERE "roleId" IN (
  SELECT id FROM "Role" WHERE name IN ('CREDIT_SENIOR', 'CREDIT_COMMITTEE', 'CREDIT_OPS')
);

-- Step 6: Remove deprecated permissions from RolePermission
DELETE FROM "RolePermission"
WHERE "permissionId" IN (
  SELECT id FROM "Permission" WHERE name IN (
    'credit:delete', 'credit:committee', 'credit:score', 'credit:spread',
    'credit:analyze', 'credit:risk', 'credit:override', 'credit:monitor', 'credit:document'
  )
);
```

#### 3.16 Seed data updates

**`backend/prisma/seed.ts`:**
- Remove CREDIT_SENIOR, CREDIT_COMMITTEE, CREDIT_OPS from role upserts (or mark as deprecated)
- Remove 9 deprecated permissions from permissions array
- Update `rolePermissionMap` with new 8-permission mapping
- Add cleanup blocks for permission removal and role migration
- Update demo user assignments

**`backend/prisma/seed-credit.ts`:**
- Update `authorityLevel` from `'CREDIT_RM'` → `'RM'`, `'CREDIT_MANAGER'` → `'MANAGER'`, `'CREDIT_COMMITTEE'` → `'COMMITTEE'`
- Demo approval matrix tiers: update authorityLevel strings

**`backend/prisma/creditDemoSeed.ts`:**
- Same authorityLevel updates as above
- Demo decision records: update authorityLevel strings

**`backend/prisma/seed-credit-approvals.ts`:**
- Update authorityLevel strings in approval matrix seed data

#### 3.17 Update Prisma schema (if authorityLevel is an enum)

Check `schema.prisma` for the `CreditDecision` and `CreditApprovalMatrix` models. If `authorityLevel` is a `String`, no schema change needed. If it's an enum, add new values and follow the enum rename pattern from `references/role-enum-rename.md`.

---

### Phase 4: Verification & Testing

#### 3.18 Update test files

**`backend/src/credit/__tests__/sod-disburse.test.ts`:**
- Update any test fixtures that use CREDIT_SENIOR/CREDIT_COMMITTEE roles
- Verify SoD tests still pass with CREDIT_MANAGER

#### 3.19 Smoke test checklist

Run through these scenarios after implementation:

| # | Test | Expected |
|---|------|----------|
| 1 | CREDIT_RM user creates application | ✅ Allowed |
| 2 | CREDIT_RM user tries to approve own application | ❌ Blocked by SoD |
| 3 | CREDIT_MANAGER user approves application | ✅ Allowed |
| 4 | CREDIT_MANAGER (former CREDIT_SENIOR user) approves high-value app | ✅ Authority lookup still works |
| 5 | Former CREDIT_COMMITTEE user (now CREDIT_MANAGER) votes in committee | ✅ Has `credit:approve` |
| 6 | CREDIT_ADMIN accesses all config | ✅ Full access |
| 7 | CREDIT_RM disbursement action | ✅ Has `credit:disburse` |
| 8 | Admin permission matrix UI shows 8 credit permissions | ✅ No removed perms |
| 9 | Approval matrix in DB uses new authority levels | ✅ RM/MANAGER/COMMITTEE/BOARD |
| 10 | Committee nav item visible with `credit:approve` | ✅ Not broken |

#### 3.20 Verify removed permissions are not enforced on routes

```bash
grep -rn "requirePermission.*credit:committee\|requirePermission.*credit:score\|requirePermission.*credit:spread\|requirePermission.*credit:analyze\|requirePermission.*credit:risk\|requirePermission.*credit:override\|requirePermission.*credit:monitor\|requirePermission.*credit:document\|requirePermission.*credit:delete" backend/src/
```

Expected: 0 results.

---

## 4. Risk Assessment & Rollback Plan

### 4.1 Low-Risk Changes (can be done immediately)
- Removing unused permissions from seed (they aren't enforced on any route)
- Updating middleware role arrays (SOD, RM scope, field encryption, borrower access)
- Updating frontend nav permission gating
- Adding seed cleanup blocks for permission removal

### 4.2 Medium-Risk Changes (require deploy + DB migration)
- Authority level value migration (CREDIT_RM→RM, etc.)
- User role migration (CREDIT_SENIOR/COMMITTEE/OPS → CREDIT_MANAGER/RM)
- Removing old role definitions from seed

### 4.3 Rollback Plan
1. Keep old roles in the DB as deprecated (don't delete rows) — just remove their permissions and migrate users
2. Keep the old authority level values in code as fallback aliases in `AUTHORITY_HIERARCHY`
3. If rollback needed: re-add old permissions to roles, re-assign users to old roles, revert authority level strings

### 4.4 Backward Compatibility

Add fallback aliases in `approvalAction.service.ts` so the authority level migration is gradual:

```typescript
const AUTHORITY_HIERARCHY: Record<string, number> = {
  // New values
  RM: 1,
  MANAGER: 2,
  COMMITTEE: 3,
  BOARD: 4,
  // Legacy aliases (temporary, remove after full migration)
  CREDIT_RM: 1,
  CREDIT_MANAGER: 2,
  SENIOR_CREDIT_OFFICER: 3,
  CREDIT_COMMITTEE: 4,
  BOARD_RISK_COMMITTEE: 5,
};
```

This allows both old and new authority level strings to work during migration.

---

## 5. Implementation Order (Recommended Sequence)

| Step | Description | Risk | Effort | Dependencies |
|------|-------------|------|-------|-------------|
| 1 | Update middleware role arrays (SOD, RM scope, encryption, borrower access) | Low | 30min | None |
| 2 | Update `approvalAction.service.ts` authority hierarchy + aliases | Low | 1hr | None |
| 3 | Update `policyExplainer.service.ts` role labels | Low | 30min | Step 2 |
| 4 | Update frontend CreditNav permission gating | Low | 15min | None |
| 5 | Update `credit.types.ts` ApprovalAuthorityLevel enum | Low | 15min | Step 2 |
| 6 | Update seed.ts: new permission map + cleanup blocks | Medium | 2hr | Steps 1-5 |
| 7 | Update seed-credit.ts, creditDemoSeed.ts, seed-credit-approvals.ts authority levels | Medium | 1hr | Step 6 |
| 8 | Write & run DB migration SQL for authority levels + user roles | Medium | 1hr | Step 7 |
| 9 | Update test files (sod-disburse.test.ts) | Low | 30min | Step 1 |
| 10 | Full smoke test | — | 1hr | Steps 1-9 |
| 11 | Remove authority level legacy aliases (after confirming migration) | Low | 15min | Step 10 verified |
| 12 | Optionally delete deprecated role rows from DB | Low | 15min | Step 11 |

**Total estimated effort: ~8 hours**

---

## 6. Open Questions for Review

1. **Keep CREDIT_OPS as a separate role?** If your bank's SoD policy requires that the person who disburses cannot be the same person who created the application, then CREDIT_OPS should remain as a separate role. But the role would only need `credit:disburse` + `credit:read`. If your regulators don't require this separation, dissolve it into CREDIT_RM.

2. **Committee voting mechanics:** Currently committee voting is tied to `CREDIT_COMMITTEE` role membership. After merging into CREDIT_MANAGER, who gets to vote in committee? Options:
   - **Option A:** Any CREDIT_MANAGER user can vote on any committee item (simplest, recommended)
   - **Option B:** Add a `CommitteeMember` assignment model where specific users are added to committees (more granular, but requires new model + UI)
   - **Option C:** Keep a `CREDIT_COMMITTEE_MEMBER` tag/attribute on `UserRole` or a separate `CommitteeMember` table

3. **Senior vs Manager approval authority:** With CREDIT_SENIOR merged into CREDIT_MANAGER, the approval matrix now determines authority level (Tier 2 vs Tier 3) rather than the user's role. A CREDIT_MANAGER could be the sole approver at Tier 2, or one of multiple approvers at Tier 3 (committee level). Is this acceptable?

4. **ADMIN vs CREDIT_ADMIN redundancy:** Both have all credit permissions. Should we remove credit perms from ADMIN (making them depend on also having CREDIT_ADMIN for credit access), or keep ADMIN as a god-mode bypass? (Current recommendation: keep ADMIN bypass for system-level access, but CREDIT_ADMIN for credit-specific admin tasks.)

---

## 7. Files to Modify (Complete List)

### Backend
1. `backend/prisma/seed.ts` — Role/permission definitions, rolePermissionMap, cleanup blocks
2. `backend/prisma/seed-credit.ts` — Authority level strings
3. `backend/prisma/creditDemoSeed.ts` — Authority level strings, demo data
4. `backend/prisma/seed-credit-approvals.ts` — Authority level strings
5. `backend/prisma/seed-credit-flags.ts` — Feature flags (minor)
6. `backend/src/credit/middleware/sod.middleware.ts` — APPROVER_ROLES array
7. `backend/src/credit/middleware/rmScope.middleware.ts` — RM_SCOPE_BYPASS_ROLES array
8. `backend/src/credit/middleware/fieldEncryption.middleware.ts` — Admin role array
9. `backend/src/credit/middleware/assertBorrowerAccess.middleware.ts` — ADMIN_ROLES array
10. `backend/src/credit/services/approvalAction.service.ts` — AUTHORITY_HIERARCHY, getRoleNamesForAuthorityLevel
11. `backend/src/credit/types/credit.types.ts` — ApprovalAuthorityLevel enum
12. `backend/src/services/policyExplainer.service.ts` — roleLabels mapping
13. `backend/src/credit/__tests__/sod-disburse.test.ts` — Test fixtures

### Frontend
14. `frontend/src/components/CreditNav.tsx` — Committee permission: `credit:committee` → `credit:approve`
15. `frontend/pages/credit/creditUtils.ts` — Role string cleanup
16. `frontend/pages/CreditApplicationDetail.tsx` — Verify role filters (no change needed)
17. `frontend/src/components/admin/PermissionsTab.tsx` — Will auto-adjust (reads from DB)

### Database
18. SQL migration script for authority level values, user role migration, permission cleanup