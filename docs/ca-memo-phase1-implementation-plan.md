# CA Memo — Phase 1 Implementation Plan

**Date:** 2026-05-20
**Owner:** Credit Risk team (schema approval)
**Source form:** `docs/form.html` (Malaysian Corporate Credit Application Memorandum — CA Part I)
**Scope:** Schema foundation + header/narrative tab. Covers form **Sections 1 (Header), 2 (Preamble), 4 (Matters to Highlight), 6 (Transaction Details)**. No facility/financial/security changes yet — those are Phases 2–4.

**Complexity:** M · **Estimated touch:** ~12 files · **No breaking changes to existing DRAFT applications**

---

## Locked decisions (from stakeholder review)

| # | Decision |
|---|---|
| 1 | CA Memo serves **both** RM drafting + committee review/approval |
| 2 | New `ApplicationSignoff` model (Prepared/Reviewed/Concurred) as **form sign-off** — separate from existing `CreditDecision` (which remains the approval-authority record). Typed-name + userId + designationSnapshot + signedAt + immutable audit row. No legal e-sig for v1. |
| 3 | Ship form first, harden PII later (Phase 6 last) |
| 4 | **Individual-borrower variant required** — applicable sections only. Form conditionally renders based on `borrowerType`. |
| 5–8 | All manual RM entry (ECL, CCRIS/CTOS, profitability, PMMD vs Panel Valuer) |
| 9 | PDF CA-Memo export required v1 (puppeteer rendering existing `form.html` layout) |
| 10 | Plain textarea for narratives |
| 11 | ESG = free-judgment dropdown (GP1–GP5, C1–C6) + justification text |
| 12 | ~10 new tabs on `CreditApplicationDetail.tsx` |
| 13 | Phase order: 1 → 2 → 3 → 4 → 5 → 6 |
| 14 | No deadline — quality > speed |
| 15 | Credit Risk team owns final schema approval |

---

## 1. Schema changes

### 1a. New enums (`backend/prisma/schema.prisma`)

```prisma
enum ApplicationType {
  NEW
  ADDITIONAL
  RENEWAL
  VARIATION
}

enum AccountClassification {
  PERFORMING
  EARLY_CARE
  WATCHLIST
  NON_CCRIS_RR        // Non-CCRIS Rescheduled & Restructured
  CCRIS_RR            // CCRIS Rescheduled & Restructured
  IMPAIRED
}

enum AccountStrategy {
  GROW
  MAINTAIN
  EXIT
}
```

### 1b. `CreditApplication` field additions

All nullable (backwards-compat with existing DRAFTs). Grouped by form section:

```prisma
// Section 1 — Header
customerGroupName        String?
cifNo                    String?
applicationType          ApplicationType?
originatingDepartment    String?
teamLeadName             String?
referredBy               String?
accountClassification    AccountClassification?
connectedPartyFlag       Boolean   @default(false)
connectedPartyStaffName  String?
completeDocsDate         DateTime?
lastReviewDate           DateTime?
nextReviewDate           DateTime?
relationshipSince        DateTime?
lastSiteVisitDate        DateTime?

// Section 2, 4, 6 — Narratives
preambleText             String?   @db.Text
mattersToHighlight       String?   @db.Text
transactionDetailsText   String?   @db.Text

// Section 9 hook (filled later in Phase 4, but enum needed for tab gating)
accountStrategy          AccountStrategy?
crossSellingInitiatives  String?   @db.Text
```

> **Note:** `customerName` and `natureOfBusiness` already derivable from `BorrowerProfile → CrmAccount` — no duplication. `applicationNo`, `submittedAt`, `purpose` already exist.

### 1c. Migration

Single migration file: `backend/prisma/migrations/<timestamp>_phase1_ca_memo_header/migration.sql`

- All `ALTER TABLE … ADD COLUMN` (no drops, no renames, no NOT NULL on existing rows)
- Safe to run on existing data — every new column is nullable or has a default

---

## 2. Backend changes

### 2a. Validator — `backend/src/credit/validators/creditApplication.validator.ts`

Extend existing zod/joi schema for create + update DTOs with the new optional fields. Add enum validation for `applicationType`, `accountClassification`, `accountStrategy`.

### 2b. Controller — `backend/src/credit/controllers/creditApplication.controller.ts`

- Extend `create` and `update` handlers to accept new fields (whitelist update — no blind spread)
- Extend `getById` to include new fields in response (already does if using full select)
- Add **field-level edit guard helper** stub: `assertEditableByRole(application, userId, fieldGroup)` — returns true for Phase 1 (lock logic lands in Phase 5 with sign-off)

### 2c. No new routes

All new fields live on existing `CreditApplication` — reuse `PATCH /api/v1/credit/applications/:id`.

---

## 3. Frontend changes

### 3a. Service types — `frontend/src/services/credit.service.ts`

Extend `CreditApplication` TypeScript interface with new optional fields + enum string unions.

### 3b. New tab component — `frontend/pages/credit/tabs/HeaderBackgroundTab.tsx`

New file. Single tab rendering Sections 1, 2, 4, 6. Layout:

```
┌─ Header (Section 1) ──────────────────────────────┐
│  Customer Name (readonly, from borrower)          │
│  Customer Group     [text]                        │
│  CIF No             [text]                        │
│  Application Type   [select: NEW/ADDITIONAL/...]  │
│  Originating Dept   [text]   Team Lead [text]     │
│  Referred By        [text]                        │
│  Account Classification  [select]                 │
│  Connected Party    [checkbox] → Staff Name [text]│
│  Dates: Complete Docs / Last Review / Next Review │
│         / Relationship Since / Last Site Visit    │
└───────────────────────────────────────────────────┘

┌─ Preamble (Section 2) ─────────[textarea]────────┐
┌─ Matters to Highlight (Sec 4) ─[textarea]────────┐
┌─ Transaction Details (Sec 6) ──[textarea]────────┐

[Save Draft]  [Mark Section Complete]
```

- Autosave on blur (debounced 800ms) — pattern already used elsewhere
- Read-only mode when application status ≠ DRAFT (Phase 5 will refine via signoff lock)
- Individual-borrower variant: hide `customerGroupName`; relabel "Connected to staff?"

### 3c. Wire tab into `CreditApplicationDetail.tsx`

Add `'header'` to the `DetailTab` union, add nav button, route to `<HeaderBackgroundTab />`. Make it the **default landing tab** for new applications.

### 3d. Section-completion indicator

Tiny addition to tab nav: green dot if all required-for-submission fields filled. For Phase 1, "required" = `applicationType`, `accountClassification`. Spec for required fields can evolve in later phases.

---

## 4. File touch list

| Path | Action |
|---|---|
| `backend/prisma/schema.prisma` | Extend `CreditApplication`, add 3 enums |
| `backend/prisma/migrations/<ts>_phase1_ca_memo_header/migration.sql` | New |
| `backend/src/credit/validators/creditApplication.validator.ts` | Extend |
| `backend/src/credit/controllers/creditApplication.controller.ts` | Extend create/update |
| `backend/src/credit/services/creditApplication.service.ts` (if exists) | Extend update logic |
| `frontend/src/services/credit.service.ts` | Extend types |
| `frontend/pages/credit/tabs/HeaderBackgroundTab.tsx` | New |
| `frontend/pages/CreditApplicationDetail.tsx` | Add tab |
| `frontend/src/components/credit/AutosaveTextField.tsx` (if not existing) | Verify or create |
| `backend/prisma/creditDemoSeed.ts` | Add sample values for demo borrower |
| `docs/credit-assessment-user-guide.md` | Add CA Memo Header section |

---

## 5. Acceptance criteria

- [ ] Migration runs cleanly on existing DB; all existing applications still load
- [ ] RM can fill all Section 1/2/4/6 fields on a new or existing DRAFT application
- [ ] Autosave persists every field; refresh recovers state
- [ ] Enum dropdowns show all valid options with human-readable labels
- [ ] Connected-Party checkbox conditionally reveals staff-name input
- [ ] Individual borrower hides `customerGroupName` field
- [ ] Tab indicator shows green dot when `applicationType` + `accountClassification` set
- [ ] `GET /api/v1/credit/applications/:id` returns all new fields
- [ ] No regression on existing application list / detail flows
- [ ] Lint + typecheck pass on backend and frontend

---

## 6. Out of scope (deferred to later phases)

- Field-level edit locks based on sign-off (→ Phase 5)
- "Connected Party" cross-reference to staff directory lookup (→ Phase 4 governance)
- PDF rendering of header section (→ Phase 5)
- Submission validation (which fields are mandatory at submit-time) — Phase 1 leaves DRAFT permissive, full validation lands with Phase 5 signoff
- Audit-trail entries for field changes — assumed already covered by existing application audit log; verify in implementation

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Existing DRAFTs may have nulls that surprise downstream code | All new fields nullable; defensive null-checks in any new read paths |
| Date timezone handling for `*Date` fields | Use `DateTime` (Prisma) + ISO strings on wire; UI uses date-only picker (no time) |
| Enum label translations | Keep enum keys English; labels in a single `frontend/src/constants/creditEnums.ts` for future i18n |
| `cifNo` uniqueness | Phase 1 stores as free-text (no unique constraint); CIF integration is a separate concern |

---

## 8. Open questions before implementation starts

1. **Migration timing** — OK to run the migration on dev now, or review the SQL first?
2. **Default landing tab** — Should Header be default for *all* applications (existing + new), or only new ones?
3. **`originatingDepartment` / `teamLeadName`** — Free text, or wire to existing User/Department tables? (Free text is faster; user table is cleaner long-term.)

---

## Appendix — Phase roadmap (for context)

| Phase | Scope | Complexity |
|---|---|---|
| **1. Schema foundation & header** *(this doc)* | Extend `CreditApplication` header + narrative fields (Secs 1, 2, 4, 6); new enums | M |
| 2. Facilities, requests & exposure | Extend `ApplicationFacility` + new `RequestItem` (Sec 3) | M |
| 3. Risk rating, ECL, projections | New `ExternalRating`/`EclSnapshot`/`EclForecast`/`CashflowProjection`/`SensitivityScenario` + financial commentary (Secs 5, 7, 12) | L |
| 4. Security, profitability, counterparties | Extend `Collateral`/`Guarantee`; new profitability/wallet-share/counterparty/utilisation models; extend Director/Shareholder (Secs 8, 9, 10, 11, 13) | L |
| 5. Governance: Bureau, ESG, SICR, Risk, Sign-off | New compliance models + PDF CA-memo renderer (Secs 14–19) | M |
| 6. PII encryption hardening | Field-level encryption for NRIC across Director/Shareholder/UBO/new KeyCounterparty | M |
