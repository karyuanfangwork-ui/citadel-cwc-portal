# 18 — Feature Flags

> Sprint 6 — Credit Assessment Module  
> Last updated: 2026-05-18

---

## 1. Feature Flag Registry

| # | Key | Description | Default Value | Category |
|---|---|---|---|---|
| 1 | `credit:module` | Master toggle for the entire credit module | `true` (enabled) | Core |
| 2 | `credit:borrowers` | Borrower management (CRUD, search, KYC) | `false` (disabled) | Sub-capability |
| 3 | `credit:applications` | Credit application lifecycle | `false` (disabled) | Sub-capability |
| 4 | `credit:spreading` | Financial statement spreading | `false` (disabled) | Sub-capability |
| 5 | `credit:scoring` | Credit scoring / scorecard engine | `false` (disabled) | Sub-capability |
| 6 | `credit:committee` | Credit committee workflow & voting | `false` (disabled) | Sub-capability |
| 7 | `credit:collateral` | Collateral management | `false` (disabled) | Sub-capability |
| 8 | `credit:conditions` | Condition precedent management | `false` (disabled) | Sub-capability |
| 9 | `credit:monitoring` | Post-disbursement monitoring | `false` (disabled) | Sub-capability |
| 10 | `credit:dashboards` | Credit dashboards & analytics | `false` (disabled) | Sub-capability |
| 11 | `credit:ai` | AI-assisted credit features (auto-spreading, risk signals) | `false` (disabled) | Sub-capability |

---

## 2. Current State

### What is enforced

- **`credit:module`** is the only flag enforced as route middleware.
- The master toggle middleware (`requireFeatureFlag('credit:module')`) is applied at the top-level credit router.
- When `credit:module` is disabled, **all** credit module routes return `403 Forbidden` with message:
  ```json
  { "message": "Feature 'credit:module' is not enabled" }
  ```

### What is NOT enforced (the gap)

Sub-capability flags (`credit:borrowers` through `credit:ai`) exist as rows in the `feature_flags` database table but are **not** applied as middleware gates on their respective sub-routers.

This means:
- `/api/v1/credit/borrowers/**` routes are accessible even if `credit:borrowers` is `false` in the DB.
- `/api/v1/credit/applications/**` routes are accessible even if `credit:applications` is `false` in the DB.
- And so on for all sub-capabilities.

All 10 sub-capability flags are currently stored as `enabled: false` in the seed data, but they have **zero effect** on route access because no middleware checks them.

---

## 3. Recommended Enhancement

### Add sub-router feature flag gates

Apply `requireFeatureFlag()` middleware to each sub-router in the credit module route configuration:

```typescript
// credit.routes.ts (conceptual)
const creditRouter = Router();

// Master toggle — already enforced
creditRouter.use(requireFeatureFlag('credit:module'));

// Sub-capability gates — RECOMMENDED
creditRouter.use('/borrowers',    requireFeatureFlag('credit:borrowers'),    borrowersRouter);
creditRouter.use('/applications', requireFeatureFlag('credit:applications'), applicationsRouter);
creditRouter.use('/spreading',    requireFeatureFlag('credit:spreading'),    spreadingRouter);
creditRouter.use('/scoring',      requireFeatureFlag('credit:scoring'),      scoringRouter);
creditRouter.use('/committee',    requireFeatureFlag('credit:committee'),    committeeRouter);
creditRouter.use('/collateral',   requireFeatureFlag('credit:collateral'),  collateralRouter);
creditRouter.use('/conditions',   requireFeatureFlag('credit:conditions'),  conditionsRouter);
creditRouter.use('/monitoring',   requireFeatureFlag('credit:monitoring'),   monitoringRouter);
creditRouter.use('/dashboards',   requireFeatureFlag('credit:dashboards'),   dashboardsRouter);
creditRouter.use('/ai',           requireFeatureFlag('credit:ai'),          aiRouter);
```

### Evaluation order

When both `credit:module` and a sub-capability flag are checked:
1. `credit:module` is evaluated first (top-level middleware).
2. Sub-capability flag is evaluated second (sub-router middleware).
3. If `credit:module` is OFF → all sub-routes return 403 immediately (sub-flag is never checked).
4. If `credit:module` is ON but `credit:borrowers` is OFF → `/borrowers` routes return 403, but other sub-routes work normally.

### Migration note

When enabling this enhancement:
- All sub-capability flags in seed data should be flipped to `enabled: true` (to maintain current behavior where everything works).
- Then selectively disable individual flags as needed for phased rollout.
- Failing to flip defaults to `true` would break all sub-routes on deploy.

---

## 4. API for Managing Feature Flags

### Get all feature flags

```
GET /api/v1/credit/feature-flags
```

- **Permission required:** `credit:read`
- **Response:**
  ```json
  {
    "data": [
      {
        "key": "credit:module",
        "description": "Master toggle for the entire credit module",
        "enabled": true,
        "rolloutPct": null,
        "category": "Core",
        "updatedAt": "2026-05-18T00:00:00Z"
      },
      ...
    ]
  }
  ```

### Update a feature flag

```
PATCH /api/v1/credit/feature-flags/:key
```

- **Permission required:** `credit:admin`
- **Request body:**
  ```json
  {
    "enabled": false
  }
  ```
- **Response:**
  ```json
  {
    "data": {
      "key": "credit:borrowers",
      "enabled": false,
      "updatedAt": "2026-05-18T12:00:00Z"
    }
  }
  ```
- **Validation:** `key` must be one of the 11 known flag keys. Unknown keys return `404`.
- **Audit:** All flag changes are logged to the audit trail with before/after values.

---

## 5. rolloutPct Field

The `feature_flags` table includes a `rolloutPct` column (nullable integer, 0–100).

**Current status:** The field exists in the schema and seed data but is **not used** by any middleware or service logic.

**Purpose:** Reserved for future gradual/percentage-based rollout:
- `rolloutPct = 0` → feature is off for everyone (same as `enabled: false`).
- `rolloutPct = 100` → feature is on for everyone (same as `enabled: true`).
- `rolloutPct = 50` → feature is on for ~50% of users/requests (determined by hashing user ID or request context).
- Implementation would use a deterministic hash (e.g., `hash(userId) % 100 < rolloutPct`) to ensure consistent experience per user.

**No current timeline for rolloutPct implementation.** It should remain in the schema for forward compatibility.

---

## 6. Verification Checklist

### Feature flag enforcement — manual tests

- [ ] `credit:module` disabled → all `/api/v1/credit/**` routes return 403
- [ ] `credit:module` enabled → credit module routes respond normally
- [ ] After enhancement: `credit:borrowers` disabled → `/api/v1/credit/borrowers/**` returns 403, other sub-routes still work
- [ ] After enhancement: `credit:applications` disabled → `/api/v1/credit/applications/**` returns 403
- [ ] After enhancement: disabling `credit:module` takes priority over any sub-flag being enabled

### Feature flag API — manual tests

- [ ] `GET /api/v1/credit/feature-flags` returns all 11 flags
- [ ] `PATCH /api/v1/credit/feature-flags/credit:module` with `{ "enabled": false }` disables the module
- [ ] `PATCH /api/v1/credit/feature-flags/nonexistent` returns 404
- [ ] Non-admin user calling PATCH → returns 403
- [ ] Flag changes are recorded in audit log

---

## 7. Notes & Open Questions

1. **Granularity** — Should any sub-capability flags be further broken down? (e.g., `credit:committee` → `credit:committee:schedule`, `credit:committee:vote`)
2. **Rollback plan** — When a flag is toggled at runtime, is there an immediate effect or does it require a server restart? Verify live-toggle behavior.
3. **Default values for new flags** — If a new flag is added in a migration, what should its default be? Recommendation: `enabled: true` with a migration note, so nothing breaks on upgrade.
4. **Frontend awareness** — Does the frontend consume feature flags to hide/show UI elements? If not, disabling a flag would cause confusing 403s without UX feedback.