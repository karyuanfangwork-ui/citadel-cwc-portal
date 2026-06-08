# Sprint 6 — Credit Policy Limits, Clone/Renew, LOO Expiry

**Parent doc:** `docs/2026-06-09-credit-audit-implementation-plan.md` (S6, Week 11)
**Created:** 9 June 2026
**Status:** COMPLETE ✓

---

## Overview

Sprint 6 implements three credit audit findings:
1. Application Clone/Renew — reuse approved app data for new submissions
2. Credit Policy Limit enforcement — hard blocks and soft warnings
3. LOO Expiry Notifications — automated warnings + countdown badges

---

## 6.1 Application Clone/Renew

**Backend:**
- `cloneApplication()` in `creditApplication.service.ts`
  - Works for APPROVED, ACTIVE, CLOSED (renewal) and REJECTED (re-apply) states
  - Creates new application with `parentApplicationId` self-relation, copies borrower, product type, amount, purpose
  - Sets state = DRAFT, clears decision/committee fields
  - Audit event: APPLICATION_CLONED
- Route: `POST /api/v1/credit/applications/:id/clone`
- Controller: `cloneApplicationHandler` in `creditApplication.controller.ts`

**Frontend:**
- "Clone Application" button in `CreditApplicationDetail.tsx` header
- "Renew" button shown for APPROVED/ACTIVE/CLOSED states
- `cloneApplication()` API method in `credit.service.ts`

---

## 6.2 Credit Policy Limit

**Schema:**
- New `CreditPolicyLimit` model with `PolicyLimitType` enum (SINGLE_BORROWER, SECTOR, PRODUCT)
- Fields: type, label, maxValue, thresholdPct, isActive, currency, sector, productType
- Self-relation to `User` via `createdById`

**Backend:**
- `policyLimit.service.ts` — CRUD + `evaluatePolicy(applicationId)`
  - SINGLE_BORROWER: sums approved amounts across all active facilities for the borrower
  - SECTOR: groups by `CrmAccount.industry`, sums across all borrowers in that sector
  - PRODUCT: groups by `productType`, sums across all active apps
  - Hard block (severity=HARD): proposed exceeds maxValue
  - Soft warning (severity=SOFT): proposed exceeds thresholdPct × maxValue but below maxValue
- Routes: `policyLimit.routes.ts` — CRUD + `/evaluate/:applicationId`
- Mounted at `/api/v1/credit/policy-limits` in `credit.routes.ts`

**Frontend:**
- `policyLimitApi` + types in `credit.service.ts`
- Red banner (blocks) + amber banner (warnings) in `ApprovalsTab.tsx`
- Banners shown above approval chain when policy violations detected

---

## 6.3 LOO Expiry Notifications

**Backend:**
- `checkAndNotifyExpiring()` in `loo.service.ts`
  - Finds all OFFER/ACCEPTED apps with `looExpiryDate > now`
  - Sends IN_APP notifications at 7, 3, 1 days before expiry (WARNING_DAYS pattern)
  - Finds already-expired LOOs, sends "LOO Has Expired" notification
  - Logs audit events: LOO_EXPIRY_WARNING, LOO_EXPIRED
  - Returns `{ notified, expired }` counts
- Route: `POST /api/v1/credit/applications/loo/expiry-check` (credit:admin)
- Controller: `checkLooExpiry` in `loo.controller.ts`
- Job: `looExpiry.job.ts` — start/stop/run functions following monitor.job pattern
- Scheduler: Wired into `scheduler.service.ts` as `credit.loo_expiry` (24h interval)

**Frontend:**
- Enhanced `expiryBadge()` in `LooSection.tsx` with 4-tier color scheme:
  - Red: ≤1 day / expired
  - Amber: ≤3 days
  - Yellow: ≤7 days
  - Green: >7 days

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | MODIFIED | CreditPolicyLimit model, PolicyLimitType enum, User relation |
| `backend/src/credit/services/policyLimit.service.ts` | NEW | CRUD + evaluation service |
| `backend/src/credit/routes/policyLimit.routes.ts` | NEW | CRUD + evaluate routes |
| `backend/src/credit/services/loo.service.ts` | MODIFIED | checkAndNotifyExpiring() |
| `backend/src/credit/controllers/loo.controller.ts` | MODIFIED | checkLooExpiry handler |
| `backend/src/credit/routes/loo.routes.ts` | MODIFIED | expiry-check endpoint |
| `backend/src/credit/jobs/looExpiry.job.ts` | NEW | Scheduler job module |
| `backend/src/services/scheduler.service.ts` | MODIFIED | Wired LOO expiry job |
| `backend/src/credit/routes/credit.routes.ts` | MODIFIED | policyLimit mount + clone |
| `frontend/src/services/credit.service.ts` | MODIFIED | policyLimitApi, clone types |
| `frontend/pages/credit/tabs/ApprovalsTab.tsx` | MODIFIED | Policy limit banners |
| `frontend/pages/credit/tabs/LooSection.tsx` | MODIFIED | Enhanced expiry badge |
| `frontend/pages/CreditApplicationDetail.tsx` | MODIFIED | Clone/Renew buttons |