# 17 — RBAC Verification Matrix

> Sprint 6 — Credit Assessment Module  
> Last updated: 2026-05-18

---

## 1. Permission-to-Route Mapping

| Permission | Route Scope | Approx. Count | What It Gates |
|---|---|---|---|
| `credit:read` | All `GET /api/v1/credit/**` endpoints | ~73 routes | Read access to borrowers, applications, scoring, committee, collateral, conditions, monitoring, dashboards, matrix, feature flags (read), documents (metadata), audit log |
| `credit:write` | All `POST/PATCH` create & update endpoints | ~35 routes | Create/update borrowers, applications, spreading, documents upload, scoring triggers, committee scheduling, collateral registration, condition creation, notes, comments |
| `credit:admin` | `DELETE` endpoints + admin-level operations | ~24 routes | Delete borrowers/applications/docs, scorecard create/update, matrix management, committee meeting management, feature flag admin, condition waive, score run override |
| `credit:approve` | Approval & voting actions | 3 routes | Application approval actions, financial review sign-off, committee voting |
| `credit:export` | PII data export | 1 route | Export borrower/application PII data (CSV/Excel download) |

---

## 2. Role × Permission Matrix (Recommended)

| Role | `credit:read` | `credit:write` | `credit:admin` | `credit:approve` | `credit:export` |
|---|:---:|:---:|:---:|:---:|:---:|
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CREDIT_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CREDIT_MANAGER** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **CREDIT_SENIOR** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **CREDIT_RM** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CREDIT_ANALYST** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CREDIT_COMMITTEE** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **END_USER** | ✅ | ❌ | ❌ | ❌ | ❌ |

### Rationale

- **ADMIN / CREDIT_ADMIN** — Full access. These are superuser roles that can do everything including admin and export.
- **CREDIT_MANAGER** — Can read, write, and approve. Cannot perform destructive admin ops or export PII.
- **CREDIT_SENIOR** — Same as CREDIT_MANAGER (senior underwriters can approve but not administer).
- **CREDIT_RM** — Relationship Managers create and manage applications/borrowers but cannot approve.
- **CREDIT_ANALYST** — Analysts can read and write (spread financials, prepare scoring) but cannot approve.
- **CREDIT_COMMITTEE** — Committee members vote/approve but do not write application data.
- **END_USER** — Read-only view of their own credit data (dashboards, status lookups).

---

## 3. Verification Checklist

For each role, verify the following with actual API calls:

### 3.1 ADMIN / CREDIT_ADMIN
- [ ] Can read all GET endpoints → 200
- [ ] Can create/update via POST/PATCH → 200
- [ ] Can delete via DELETE → 200
- [ ] Can manage scorecards, matrix, feature flags → 200
- [ ] Can approve applications → 200
- [ ] Can export PII data → 200

### 3.2 CREDIT_MANAGER / CREDIT_SENIOR
- [ ] Can read all GET endpoints → 200
- [ ] Can create/update via POST/PATCH → 200
- [ ] Cannot access DELETE endpoints → 403
- [ ] Cannot manage scorecards/matrix/feature flags → 403
- [ ] Can approve applications → 200
- [ ] Cannot export PII data → 403

### 3.3 CREDIT_RM / CREDIT_ANALYST
- [ ] Can read all GET endpoints → 200
- [ ] Can create/update via POST/PATCH → 200
- [ ] Cannot access DELETE endpoints → 403
- [ ] Cannot approve applications → 403
- [ ] Cannot export PII data → 403

### 3.4 CREDIT_COMMITTEE
- [ ] Can read all GET endpoints → 200
- [ ] Cannot create/update via POST/PATCH → 403
- [ ] Can approve/vote → 200
- [ ] Cannot delete → 403
- [ ] Cannot export PII data → 403

### 3.5 END_USER
- [ ] Can read permitted GET endpoints → 200
- [ ] Cannot create/update → 403
- [ ] Cannot approve → 403
- [ ] Cannot delete → 403
- [ ] Cannot export → 403

---

## 4. Segregation of Duties (SOD) Constraints

### 4.1 RM Cannot Approve Own Application

**Rule:** A CREDIT_RM who created or is assigned to an application cannot approve that same application.

**Implementation notes:**
- On approval endpoints (`POST /api/v1/credit/applications/:id/approve`), check if the authenticated user is the assigned RM or creator.
- If yes → return `403 Forbidden` with message: `"Cannot approve own application — SOD constraint"`.
- ADMIN role is exempt from this constraint (admin bypass).

**Test case:**
```
1. Login as CREDIT_RM user
2. Create application (becomes creator)
3. Attempt POST /api/v1/credit/applications/:id/approve
4. Expect: 403 { message: "Cannot approve own application — SOD constraint" }
5. Login as different CREDIT_MANAGER
6. Attempt same approval
7. Expect: 200 (different user, no SOD conflict)
```

### 4.2 Maker-Checker Rule

**Rule:** The user who submits an application for approval (maker) must be different from the user who approves it (checker).

**Implementation notes:**
- Compare `submittedBy` field with authenticated user on approval endpoints.
- If same → return `403 Forbidden` with message: `"Maker-checker violation: submitter cannot also approve"`.
- ADMIN role is exempt.

**Test case:**
```
1. Login as CREDIT_RM
2. Submit application (sets submittedBy = current user)
3. Attempt to approve same application
4. Expect: 403 { message: "Maker-checker violation: submitter cannot also approve" }
```

### 4.3 Admin Bypass

**Rule:** ADMIN and CREDIT_ADMIN roles bypass SOD constraints. They can approve any application regardless of creator/checker.

**Implementation notes:**
- SOD checks should short-circuit when the authenticated user has `credit:admin` permission.
- This is intentional — auditors and admins need to be able to override stuck workflows.

**Test case:**
```
1. Login as ADMIN
2. Create application (becomes creator)
3. Submit application (sets submittedBy = admin)
4. Approve same application
5. Expect: 200 (admin bypasses SOD)
6. Verify audit log captures override
```

### 4.4 SOD Violation Audit Trail

All SOD constraint checks and bypasses must be logged to the audit trail with:
- `action`: SOD_CHECK_PASSED | SOD_CHECK_FAILED | SOD_BYPASS
- `userId`: authenticated user
- `resourceId`: application ID
- `constraintType`: RM_SELF_APPROVE | MAKER_CHECKER
- `timestamp`

---

## 5. Permission Guard Implementation Reference

The credit module uses middleware-based permission guards:

```
@RequirePermissions('credit:read')     // Applied to GET routes
@RequirePermissions('credit:write')    // Applied to POST/PATCH routes
@RequirePermissions('credit:admin')    // Applied to DELETE + admin routes
@RequirePermissions('credit:approve')  // Applied to approval/voting routes
@RequirePermissions('credit:export')   // Applied to export routes
```

Guards are applied at the route level. SOD checks are applied inside the controller/service layer (beyond the permission guard).

---

## 6. Notes & Open Questions

1. **CREDIT_MANAGER vs CREDIT_SENIOR** — Currently both have identical permissions. Should CREDIT_SENIOR have any additional or reduced capabilities?
2. **END_USER scope** — END_USER `credit:read` should be scoped to the user's own data only. Does the current implementation filter by `userId` for END_USER role? Needs verification.
3. **Bulk operations** — Do bulk approve/export endpoints exist? If so, they inherit the same permission requirements.
4. **Future: fine-grained permissions** — Consider breaking `credit:admin` into sub-permissions (e.g., `credit:admin:scorecard`, `credit:admin:matrix`, `credit:admin:flags`) if needed.