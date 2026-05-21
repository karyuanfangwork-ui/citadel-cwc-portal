# CA Memo — Phase 5 Implementation Plan
## Governance: Bureau Checks, Industry Outlook, Risk, ESG, SICR, Sign-off & PDF Export

**Date:** 2026-05-20
**Depends on:** Phase 4 complete
**Scope:** Form **Sections 14, 15, 16, 17, 18, 19** + PDF CA-Memo renderer
**Complexity:** M · **Estimated touch:** ~18 files

---

## What this phase delivers

- **Section 14 — Credit Checks:** `CreditBureauCheck` model with CCRIS/CTOS/Experian/PEP/Watchlist audit trail
- **Section 15 — Industry Outlook:** `IndustryAssessment` with sector/subsector narratives
- **Section 16 — Risk Assessment & Mitigators:** `RiskAssessment` + `RmdIssue` models
- **Section 17 — ESG:** `EsgAssessment` with BNM CCPT GP1–GP5 / C1–C6 enums
- **Section 18 — SICR:** `SicrAssessment` with MFRS9 trigger-type enum
- **Section 19 — Sign-off:** `ApplicationSignoff` model (Prepared/Reviewed/Concurred); field-level edit locks post-sign-off
- **PDF CA-Memo:** `GET /applications/:id/ca-memo.pdf` — puppeteer rendering of structured memo

---

## 1. Schema changes

### 1a. New enums

```prisma
enum BureauProvider {
  CCRIS
  CTOS
  EXPERIAN
  PEP_WATCHLIST
  IF_ACTIVA
  PUBLIC_DOMAIN
}

enum RiskCategory {
  PROJECT
  PERFORMANCE
  PACKAGING
  PAYMENT
  OTHER
}

enum EsgGuidingPrinciple {
  GP1   // Climate Mitigation
  GP2   // Climate Adaptation
  GP3   // No Significant Harm
  GP4   // Remedial Efforts
  GP5   // Prohibited Activities
}

enum EsgCategory {
  C1    // Climate Supporting
  C2    // Transitioning (Tier 1)
  C3    // Transitioning (Tier 2)
  C4    // Watchlist (Tier 1)
  C5    // Watchlist (Tier 2)
  C6    // Prohibited
}

enum SicrTriggerType {
  OBLIGATORY_WATCHLIST
  OBLIGATORY_IMPAIRED
  OBJECTIVE_JUDGMENTAL
  SUBJECTIVE_JUDGMENTAL
}

enum SignoffRole {
  PREPARED_BY
  REVIEWED_BY
  CONCURRED_BY
}

enum DocumentClass {
  // ... extend existing with:
  CCRIS_REPORT
  CTOS_REPORT
  ESG_CHECKLIST
  SITE_VISIT_REPORT
  PEP_WATCHLIST_REPORT
  VALUATION_REPORT
}
```

### 1b. New `CreditBureauCheck` model

```prisma
model CreditBureauCheck {
  id              String         @id @default(uuid()) @db.Uuid
  applicationId   String         @map("application_id") @db.Uuid
  provider        BureauProvider
  subjectName     String?        @map("subject_name") @db.VarChar(255)
  runDate         DateTime?      @map("run_date") @db.Date
  runById         String?        @map("run_by_id") @db.Uuid
  hasHits         Boolean?       @map("has_hits")
  findings        String?        @db.Text
  attachedDocId   String?        @map("attached_doc_id") @db.Uuid  // ref to CreditDocument

  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  runBy           User?             @relation("BureauCheckRunBy", fields: [runById], references: [id])

  @@index([applicationId])
  @@map("credit_bureau_checks")
}
```

### 1c. New `IndustryAssessment` model

```prisma
model IndustryAssessment {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @unique @map("application_id") @db.Uuid
  sectorName      String?  @map("sector_name") @db.VarChar(255)
  subsectorName   String?  @map("subsector_name") @db.VarChar(255)
  sectorOutlook   String?  @map("sector_outlook") @db.Text
  subsectorOutlook String?  @map("subsector_outlook") @db.Text

  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@map("industry_assessments")
}
```

### 1d. New `RiskAssessment` model

```prisma
model RiskAssessment {
  id              String       @id @default(uuid()) @db.Uuid
  applicationId   String       @map("application_id") @db.Uuid
  riskCategory    RiskCategory @map("risk_category")
  description     String?      @db.Text
  mitigation      String?      @db.Text
  sortOrder       Int          @default(0) @map("sort_order")

  createdAt       DateTime     @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime     @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, riskCategory])
  @@index([applicationId])
  @@map("risk_assessments")
}
```

### 1e. New `RmdIssue` model

```prisma
model RmdIssue {
  id                   String   @id @default(uuid()) @db.Uuid
  applicationId        String   @map("application_id") @db.Uuid
  sortOrder            Int      @default(1) @map("sort_order")
  issueDescription     String   @map("issue_description") @db.Text
  businessUnitResponse String?  @map("business_unit_response") @db.Text

  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt            DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application          CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@map("rmd_issues")
}
```

### 1f. New `EsgAssessment` model

```prisma
model EsgAssessment {
  id                  String              @id @default(uuid()) @db.Uuid
  applicationId       String              @unique @map("application_id") @db.Uuid
  assignedGp          EsgGuidingPrinciple? @map("assigned_gp")
  assignedCategory    EsgCategory?        @map("assigned_category")
  justification       String?             @db.Text
  mitigatingFactors   String?             @map("mitigating_factors") @db.Text

  createdAt           DateTime            @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt           DateTime            @updatedAt @map("updated_at") @db.Timestamp(6)

  application         CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@map("esg_assessments")
}
```

### 1g. New `SicrAssessment` model

```prisma
model SicrAssessment {
  id                     String          @id @default(uuid()) @db.Uuid
  applicationId          String          @map("application_id") @db.Uuid
  triggerType            SicrTriggerType @map("trigger_type")
  triggeringEvent        String?         @map("triggering_event") @db.Text
  hasHit                 Boolean?        @map("has_hit")
  rationale              String?         @db.Text
  resultingClassification AccountClassification? @map("resulting_classification")

  createdAt              DateTime        @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt              DateTime        @updatedAt @map("updated_at") @db.Timestamp(6)

  application            CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, triggerType])
  @@index([applicationId])
  @@map("sicr_assessments")
}
```

### 1h. New `ApplicationSignoff` model

```prisma
model ApplicationSignoff {
  id                  String      @id @default(uuid()) @db.Uuid
  applicationId       String      @map("application_id") @db.Uuid
  role                SignoffRole
  signedById          String      @map("signed_by_id") @db.Uuid
  designationSnapshot String      @map("designation_snapshot") @db.VarChar(255)
  signedAt            DateTime    @default(now()) @map("signed_at") @db.Timestamp(6)
  // Immutable after creation — no updatedAt
  ipAddress           String?     @map("ip_address") @db.VarChar(45)

  createdAt           DateTime    @default(now()) @map("created_at") @db.Timestamp(6)

  application         CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  signedBy            User              @relation("ApplicationSignoffBy", fields: [signedById], references: [id])

  @@unique([applicationId, role])  // one sign-off per role per application
  @@index([applicationId])
  @@map("application_signoffs")
}
```

> **Immutability rule:** No UPDATE endpoint for `ApplicationSignoff`. Sign-off can only be revoked by the same user before the next role signs. Add `revokedAt` + `revokedById` if revocation is needed.

### 1i. Field-level edit lock — `CreditApplication`

```prisma
// Phase 5 — sign-off state
preparedAt      DateTime?  @map("prepared_at") @db.Timestamp(6)
reviewedAt      DateTime?  @map("reviewed_at") @db.Timestamp(6)
concurredAt     DateTime?  @map("concurred_at") @db.Timestamp(6)
```

These timestamps drive UI read-only behaviour without querying `ApplicationSignoff` on every page load.

### 1j. Migration
`backend/prisma/migrations/20260520000004_phase5_governance_signoff/migration.sql`

---

## 2. Backend changes

### 2a. New route files
- `backend/src/credit/routes/bureauCheck.routes.ts` — `GET/POST/PATCH/:id/DELETE` on `/applications/:id/bureau-checks`
- `backend/src/credit/routes/industryAssessment.routes.ts` — `GET/PUT /applications/:id/industry-assessment`
- `backend/src/credit/routes/riskAssessment.routes.ts` — `GET/PUT /applications/:id/risk-assessments` (bulk upsert by category)
- `backend/src/credit/routes/rmdIssue.routes.ts` — `GET/POST/PATCH/:id/DELETE` on `/applications/:id/rmd-issues`
- `backend/src/credit/routes/esg.routes.ts` — `GET/PUT /applications/:id/esg-assessment`
- `backend/src/credit/routes/sicr.routes.ts` — `GET/PUT /applications/:id/sicr-assessments` (bulk upsert by triggerType)
- `backend/src/credit/routes/signoff.routes.ts` — `GET /applications/:id/signoffs`, `POST /applications/:id/signoffs` (create), `DELETE /applications/:id/signoffs/:role` (revoke, same-user only, only if next role hasn't signed)

### 2b. Sign-off business logic
`backend/src/credit/services/signoff.service.ts`:
- On `PREPARED_BY` sign: set `application.preparedAt = now()`
- On `REVIEWED_BY` sign: require `preparedAt` not null; set `reviewedAt`
- On `CONCURRED_BY` sign: require `reviewedAt` not null; set `concurredAt`; transition application state to `CREDIT_ASSESSMENT` (or appropriate next state)
- Revoke: only if caller is same user AND subsequent role has not yet signed

### 2c. Field-level edit guard (Phase 1 stub now implemented)
`assertEditableByRole()` in `creditApplication.service.ts`:
- `state === DRAFT && !preparedAt` → all fields editable
- `preparedAt && !reviewedAt` → only Reviewer can edit (or Preparer can revoke own sign-off)
- `reviewedAt && !concurredAt` → only Concurrer can edit
- `concurredAt` → immutable (all edits rejected)

### 2d. PDF CA-Memo renderer
`backend/src/credit/services/caMemoPdf.service.ts`:
- Route: `GET /applications/:id/ca-memo.pdf`
- Uses `puppeteer` (headless Chromium) to render a dedicated React route `/credit/ca-memo/:id` into PDF
- Alternatively: `@react-pdf/renderer` generating a PDF directly server-side without browser (lighter, recommended)
- PDF structure mirrors the 19-section form layout
- Requires all Phase 1–5 data to be loaded: `include` all related models in a single query
- Add `backend/src/credit/controllers/caMemoPdf.controller.ts`
- Register at `GET /credit/applications/:id/ca-memo.pdf`

**Recommendation:** Use `@react-pdf/renderer` (no puppeteer dependency) to build a `CaMemoPdfDocument.tsx` React component that assembles the memo. More portable, no Chromium binary required in production.

---

## 3. Frontend changes

### 3a. New tabs
- `frontend/pages/credit/tabs/CreditChecksTab.tsx` — Section 14 bureau check log with provider, date, findings, hits badge, linked document
- `frontend/pages/credit/tabs/IndustryOutlookTab.tsx` — Section 15 sector/subsector + outlook textareas
- `frontend/pages/credit/tabs/RiskMitigatorsTab.tsx` — Section 16 risk register table (5 categories) + RMD issues list
- `frontend/pages/credit/tabs/EsgTab.tsx` — Section 17 GP/Category dropdowns + justification textarea
- `frontend/pages/credit/tabs/SicrTab.tsx` — Section 18 four trigger rows (type, triggering event, hit Y/N, rationale, resulting classification)
- `frontend/pages/credit/tabs/SignoffTab.tsx` — Section 19 three sign-off cards (Prepared/Reviewed/Concurred) with sign button, designation input, timestamp display

### 3b. Sign-off UI behaviour
- `SignoffTab.tsx` shows each role as a card: unsigned = button "Sign as Prepared By"; signed = name, designation, date (immutable)
- On sign: modal asks user to confirm designation (pre-filled from user profile), then POST to signoff API
- After `concurredAt` set: all tabs switch to read-only; banner "CA Memo signed off — [date]"

### 3c. PDF export button
- Add "Export PDF" button to application header (always visible, not DRAFT-gated)
- Calls `GET /applications/:id/ca-memo.pdf` → triggers browser download
- Shows loading spinner while puppeteer renders

### 3d. Wire 6 new tabs into `CreditApplicationDetail.tsx`
Add to `DetailTab` union: `'credit-checks'`, `'industry'`, `'risk'`, `'esg'`, `'sicr'`, `'signoff'`.

### 3e. Types (`frontend/src/services/credit.service.ts`)
- Add 7 new interfaces
- Add `BureauProvider`, `RiskCategory`, `EsgGuidingPrinciple`, `EsgCategory`, `SicrTriggerType`, `SignoffRole` unions
- Extend `CreditApplication` with `preparedAt`, `reviewedAt`, `concurredAt`
- Add `bureauCheckApi`, `industryAssessmentApi`, `riskAssessmentApi`, `rmdIssueApi`, `esgApi`, `sicrApi`, `signoffApi`

---

## 4. File touch list

| Path | Action |
|---|---|
| `backend/prisma/schema.prisma` | 7 enums + 8 new models + `DocumentClass` enum extension + 3 fields on `CreditApplication` |
| `backend/prisma/migrations/20260520000004_.../migration.sql` | New |
| `backend/src/credit/routes/bureauCheck.routes.ts` | New |
| `backend/src/credit/routes/industryAssessment.routes.ts` | New |
| `backend/src/credit/routes/riskAssessment.routes.ts` | New |
| `backend/src/credit/routes/rmdIssue.routes.ts` | New |
| `backend/src/credit/routes/esg.routes.ts` | New |
| `backend/src/credit/routes/sicr.routes.ts` | New |
| `backend/src/credit/routes/signoff.routes.ts` | New |
| `backend/src/credit/services/signoff.service.ts` | New |
| `backend/src/credit/services/caMemoPdf.service.ts` | New |
| `backend/src/credit/controllers/caMemoPdf.controller.ts` | New |
| `backend/src/credit/services/creditApplication.service.ts` | Implement `assertEditableByRole()` |
| `backend/src/credit/routes/credit.routes.ts` | Register 8 new routes |
| `frontend/src/services/credit.service.ts` | 7 interfaces + 7 API objects + type unions |
| `frontend/pages/credit/tabs/CreditChecksTab.tsx` | New |
| `frontend/pages/credit/tabs/IndustryOutlookTab.tsx` | New |
| `frontend/pages/credit/tabs/RiskMitigatorsTab.tsx` | New |
| `frontend/pages/credit/tabs/EsgTab.tsx` | New |
| `frontend/pages/credit/tabs/SicrTab.tsx` | New |
| `frontend/pages/credit/tabs/SignoffTab.tsx` | New |
| `frontend/pages/CreditApplicationDetail.tsx` | Add 6 tabs + PDF button + read-only lock banner |

---

## 5. Acceptance criteria

- [ ] RM can log bureau checks (CCRIS/CTOS/Experian/PEP/IF Activa/Public Domain) with date, findings, hits flag, linked document
- [ ] Industry sector and subsector + outlook narratives persist per application
- [ ] Risk register shows 5 categories; RM enters description + mitigation for each
- [ ] Up to 3 RMD issues with business unit responses
- [ ] ESG GP (GP1–GP5) and Category (C1–C6) dropdowns persist with justification
- [ ] SICR assessment: 4 trigger types, each with event, hit Y/N, rationale, resulting classification
- [ ] Sign-off sequence is enforced: Preparer → Reviewer → Concurrer; can't skip
- [ ] After Concurrer signs, all CA memo fields become read-only system-wide
- [ ] PDF export generates a complete 19-section memo; opens in browser download
- [ ] Individual-borrower applications skip Section 17 (ESG) if not applicable (use a gate similar to profitability tab) — confirm with Credit Risk
- [ ] No regression on existing decision / approval matrix flows

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| PDF rendering — `@react-pdf/renderer` has limited CSS support | Build `CaMemoPdfDocument.tsx` with React-PDF primitives (Text, View, Page) rather than HTML/CSS. Test with a minimal 3-section skeleton before full buildout. |
| Sign-off revocation race condition — two users sign simultaneously | `@@unique([applicationId, role])` on `ApplicationSignoff` — second insert fails with conflict error, caught and returned as 409 |
| `assertEditableByRole()` needs to check `preparedAt/reviewedAt/concurredAt` on every update — adds one DB read per PATCH | Cache these three timestamps in the application response already loaded in the controller; pass to `assertEditableByRole()` without extra query |
| ESG classification applicability for individual borrowers | Default: show ESG tab for all borrower types. If Credit Risk decides individual borrowers are exempt, add a `borrowerType` gate (same pattern as Profitability tab) |
| `DocumentClass` enum extension requires `ALTER TYPE … ADD VALUE` | Additive enum extension — safe, no data migration |
