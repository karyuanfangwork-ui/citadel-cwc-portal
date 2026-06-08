# Sprints 6-8 — Assessment & Implementation Outlines

**Parent doc:** `docs/2026-06-09-credit-audit-implementation-plan.md`
**Created:** 9 June 2026
**Status:** High-level assessment — detailed plans to be drafted before each sprint

---

## Sprint 6 — Missing Features Part 1 (Week 11-12)

### 6.1 Application Clone/Renew
- **Prerequisite check needed:** Does `rejection.service.ts` actually have `copyToNewApplication()`? Does `CreditApplication` have a `parentApplicationId` field?
- **Backend:** New `cloneApplication()` method + `POST /:id/clone` route. Reuse copy logic. Clone: borrower link, parties, facilities. Skip: decisions, docs, conditions, scores.
- **Frontend:** "Clone" / "Renew" buttons in list actions + detail header. Only visible for APPROVED/ACTIVE/CLOSED states.
- **Risk:** Cloning deeply nested relations (facilities with pricing, parties with guarantor links) — must enumerate exactly which relations to include/exclude.

### 6.2 Credit Policy Limit Enforcement (CRITICAL)
- **New model:** `CreditPolicyLimit` — type (SINGLE_BORROWER/SECTOR/PRODUCT), maxValue, thresholdPct, isActive
- **New service:** `policyLimit.service.ts` — checkExposureLimit, checkSectorConcentration, evaluatePolicy
- **New routes:** CRUD for policy limits (admin only)
- **Frontend:** Amber/red banners on ApprovalsTab for soft/hard blocks
- **Risk:** Aggregating exposure across all active applications per borrower. Must handle currency differences if multicurrency. Performance: needs index on borrowerProfileId + state.

### 6.3 LOO Expiry Enforcement
- **Partial:** LOO expiry gate for OFFER→ACCEPTED already exists from Phase 2.3
- **Missing:** Proactive notification when LOO is within 3 days of expiry
- **Backend:** Add `checkAndNotifyExpiring()` to loo.service.ts — called by scheduled job
- **Frontend:** Expiry countdown badge in ApprovalsTab LOO section (verify existing implementation)
- **Risk:** Scheduled job infrastructure — does CWC have a job scheduler? Check for cron/bull/bullmq patterns.

---

## Sprint 7 — Missing Features Part 2 (Week 13-14)

### 7.1 Collateral Cross-Linking
- **New model/join table:** `CollateralApplicationLink` or `linkedApplicationIds` on Collateral
- **Backend:** `linkToApplication()`, `getLinkedCollateral()` in collateral.service.ts
- **Frontend:** "Link Existing Collateral" button in CollateralTab — search portfolio collateral
- **Risk:** Circular linking prevention. Schema migration with existing collateral data.

### 7.2 Group Exposure Aggregation UI
- **Prerequisite check:** Does `RelatedPartyGroup` model exist in schema? What fields does it have?
- **Backend:** `getGroupExposure()` in borrowerProfile.service.ts — aggregate across group members
- **Frontend:** "Group Exposure" section in BorrowerProfileDetail — entity list + total + individual contributions
- **Risk:** Group membership may be stale. Need to handle borrowers not in any group gracefully.

### 7.3 Guarantor Financial Assessment
- **New model:** `GuarantorFinancial` linked to `CreditApplicationParty` — netWorth, annualIncome, existingObligations, availableForGuarantee
- **Backend:** CRUD in party.service.ts
- **Frontend:** Expandable financial section per guarantor in SecurityTab/PartiesTab
- **Risk:** Guarantor as a party role — verify `CreditApplicationParty` has `role = GUARANTOR` option. Schema migration.

---

## Sprint 8 — Polish & Accessibility (Week 15-16)

### 8.1 Colour+Icon Status Indicators
- **Change:** Replace colour-only badges with icon+label in `creditUtils.ts`
- **Sweep:** Audit ALL badge-rendering components to include icon
- **Risk:** Low — pure visual change. Ensure icons render at small sizes.

### 8.2 FATCA/CRS Mandatory Step
- **Change:** Add validation in BorrowerProfileTab — CORPORATE borrowers can't skip FATCA fields
- **Blocking dialog** when navigating away from S2 with empty FATCA fields
- **Risk:** Ensure this doesn't break existing test data that may have empty FATCA fields.

### 8.3 Mobile Application Summary View
- **New page:** `CreditApplicationMobileSummary.tsx` — card-based minimal view
- **New route:** `/credit/m/applications/:id` with `credit:approve` guard
- **Existing:** Mobile approval inbox already created in S4 — follow same design patterns
- **Risk:** Duplicate logic with desktop detail page — consider shared hooks for data fetching.

### 8.4 "New Application" CTA on Dashboard & Borrower Profile
- **Quick win:** Add primary "New Application" button in CreditDashboard header
- **BorrowerProfileDetail:** Add "New Application for [Borrower]" button
- **Link to:** `/credit/applications?borrowerId=<id>` or wizard with pre-filled borrower
- **Risk:** Verify application creation flow accepts pre-filled borrowerId param.

---

## Critical Prerequisites for S6-S8 (must verify before starting)

1. **Schema migrations** — S6.2, S7.1, S7.3 all add new models. Each requires `prisma db push` + generate. Must sequence carefully (one migration at a time, verify, then next).
2. **Job scheduler** — S6.3 (LOO expiry notifications) needs a scheduled task runner. Check if `node-cron`, `bull`, or `bullmq` is already in `backend/package.json`.
3. **RelatedPartyGroup** — S7.2 depends on this model existing. Must verify it's in the schema and has seed data.
4. **CreditApplicationParty roles** — S7.3 needs a GUARANTOR role option. Verify `PartyRole` enum includes it.
5. **Application clone source** — S6.1 references `copyToNewApplication()` in rejection.service.ts. Must verify this method exists and understand its clone scope.
