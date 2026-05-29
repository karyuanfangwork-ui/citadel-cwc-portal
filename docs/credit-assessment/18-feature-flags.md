# Credit Module — Feature Flags

**Last updated:** 2026-05-29  
**Maintainer:** Engineering + Compliance

---

## Feature Flag Registry

| Flag Key | Description | Default | Compliance Note |
|----------|-------------|---------|-----------------|
| `credit:module` | Master toggle for the Credit Assessment Module | `true` | — |
| `credit:borrowers` | Borrower profile management | `true` | — |
| `credit:applications` | Credit application intake and workflow | `true` | — |
| `credit:spreading` | Financial statement spreading (manual) | `true` | — |
| `credit:scoring` | Credit scoring and risk grading | `true` | — |
| `credit:committee` | Committee workflow | `true` | — |
| `credit:collateral` | Collateral and guarantee management | `true` | — |
| `credit:conditions` | Conditions precedent/subsequent tracking | `true` | — |
| `credit:monitoring` | Post-disbursement monitoring and EWS | `true` | — |
| `credit:dashboards` | Credit operational dashboards | `true` | — |
| `credit:ai` | AI advisory features (v2 — deferred) | `true` | — |
| `credit:bureau_checks` | Bureau & AML adapter calls | **`false`** | ⚠️ **Must remain OFF until a real bureau adapter is live and compliance has signed off.** See §4.10. |

---

## Compliance Constraints

### `credit:bureau_checks`

**This flag MUST NOT be enabled in production until all of the following conditions are met:**

1. At least one real bureau adapter (CTOS per §4.3, or equivalent) has been implemented and tested in sandbox.
2. Per-pull consent capture is live (§4.2) — every bureau call requires a valid `CreditBureauConsent` row.
3. Compliance has signed off on the CRAA 2010 posture (see `28-bureau-procurement-decision.md`).
4. The adapter registry guard (`src/credit/adapters/registry.ts`) has been updated to resolve a real provider.
5. First 10 live calls have been jointly reviewed by Risk + Compliance.

The adapter registry enforces this at runtime: if `credit:bureau_checks=true` in production without a real `BUREAU_PROVIDER` env var, the request is rejected with a configuration error. This is a deliberate safety net — **do not override without compliance approval**.

---

## Changing Feature Flags

Feature flags are stored in the `FeatureFlag` table and seeded via:

```bash
# Seed/update all credit flags:
npx tsx prisma/seed-credit.ts --flags

# Seed individual sections:
npx tsx prisma/seed-credit.ts --workflow
npx tsx prisma/seed-credit.ts --notifications
npx tsx prisma/seed-credit.ts --approvals

# Full demo data:
npx tsx prisma/seed-credit.ts --demo

# Wipe and re-seed:
npx tsx prisma/seed-credit.ts --clear
```

For runtime flag checks, use `isFeatureEnabled('credit:bureau_checks')` from `src/credit/middleware/featureFlag.middleware.ts`.