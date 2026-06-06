# Credit Assessment Module — Phase 2 Implementation Plan
## Important Improvements (Weeks 6–14)

**Date:** 2026-06-06  
**Source:** Enterprise Audit Rev 4  
**Prerequisite:** Phase 1 complete and deployed.  
**Objective:** Close all HIGH-severity functional gaps. Improve governance, financial analysis UX, and workflow completeness. No external API dependencies.  
**Total Estimated Effort:** ~12 weeks (items parallelisable across frontend and full-stack tracks)

---

## Summary of Items

| # | Item | Effort | Track |
|---|------|--------|-------|
| 2.1 | Loan Pricing Engine | 2 weeks | Full stack |
| 2.2 | Multi-year financial comparison view | 1.5 weeks | Frontend |
| 2.3 | Letter of Offer (LOO) generation | 2 weeks | Full stack |
| 2.4 | Committee formal meeting screen | 2 weeks | Frontend |
| 2.5 | Conditional approval inline conditions | 1 week | Frontend |
| 2.6 | Exposure consolidation dashboard widget | 1.5 weeks | Full stack |
| 2.7 | Rejection workflow | 1 week | Full stack |
| 2.8 | AML rescreen event log | 1 week | Full stack |

**Recommended parallel tracks:**
- Track A (Full stack): 2.1 → 2.3 → 2.6 → 2.7 → 2.8
- Track B (Frontend): 2.2 → 2.4 → 2.5

---

## Item 2.1 — Loan Pricing Engine

**Effort:** 2 weeks  
**Track:** Full stack  
**Audit Reference:** MF-1

### Context
`ApplicationFacility.ratePct` is a single manually entered rate. No audit trail for how the rate was derived. A pricing worksheet captures: base rate + credit spread + risk premium + fees → effective yield. This is critical for governance — approvers need to see and challenge pricing rationale.

### Schema Changes

```prisma
model PricingWorksheet {
  id                  String   @id @default(uuid()) @db.Uuid
  facilityId          String   @unique @map("facility_id") @db.Uuid
  baseRateType        String   @map("base_rate_type") @db.VarChar(50)  // e.g. BLR, OPR, FIXED
  baseRatePct         Decimal  @map("base_rate_pct") @db.Decimal(6, 4)
  creditSpreadPct     Decimal  @map("credit_spread_pct") @db.Decimal(6, 4)
  riskPremiumPct      Decimal  @map("risk_premium_pct") @db.Decimal(6, 4)
  administrationFeePct Decimal? @map("administration_fee_pct") @db.Decimal(6, 4)
  processingFeeFlat   Decimal? @map("processing_fee_flat") @db.Decimal(15, 2)
  effectiveRatePct    Decimal  @map("effective_rate_pct") @db.Decimal(6, 4)  // computed
  effectiveYieldPct   Decimal? @map("effective_yield_pct") @db.Decimal(6, 4) // computed with fees
  pricingJustification String? @map("pricing_justification") @db.Text
  preparedById        String   @map("prepared_by_id") @db.Uuid
  preparedAt          DateTime @default(now()) @map("prepared_at") @db.Timestamp(6)
  updatedAt           DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  facility    ApplicationFacility @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  preparedBy  User                @relation(fields: [preparedById], references: [id])

  @@map("pricing_worksheets")
}
```

Run migration: `npx prisma migrate dev --name add_pricing_worksheet`

### Backend Changes

**File:** `backend/src/credit/services/pricing.service.ts` *(new)*

```typescript
// Key methods:
upsert(facilityId, preparedById, dto)  // create or update worksheet; auto-compute effectiveRatePct
getByFacility(facilityId)
computeEffectiveRate(dto): { effectiveRatePct, effectiveYieldPct }
// effectiveRatePct = baseRatePct + creditSpreadPct + riskPremiumPct
// effectiveYieldPct = accounts for fees amortised over tenor
```

Sync `effectiveRatePct` back to `ApplicationFacility.ratePct` on save — so scorecard and approval pack always use the latest computed rate.

**File:** `backend/src/credit/routes/pricing.routes.ts` *(new)*
```
GET   /api/v1/credit/applications/:id/facilities/:facilityId/pricing
PUT   /api/v1/credit/applications/:id/facilities/:facilityId/pricing
```

### Frontend Changes

**File:** `frontend/pages/credit/tabs/FacilitiesTab.tsx`

Add a "Pricing" expandable sub-panel per facility row:
- Fields: Base Rate Type (BLR / OPR / FIXED dropdown), Base Rate %, Credit Spread %, Risk Premium %, Admin Fee %, Processing Fee (flat).
- Auto-computed display: Effective Rate % (= sum of rate components), Effective Yield % (with fees).
- Justification text field.
- Shows preparedBy + preparedAt timestamp.

### Acceptance Criteria
- [ ] Pricing worksheet saved per facility with full component breakdown.
- [ ] `effectiveRatePct` auto-computed (no manual entry of total rate).
- [ ] `ApplicationFacility.ratePct` synced from worksheet on save.
- [ ] Pricing worksheet rendered in approval pack PDF.
- [ ] `CreditAuditEvent` logged on pricing worksheet save.

---

## Item 2.2 — Multi-Year Financial Comparison View

**Effort:** 1.5 weeks  
**Track:** Frontend  
**Audit Reference:** HP-4, Financial Analysis score gap

### Context
`FinancialStatement` supports multiple years. Currently each statement is viewed individually. Analysts need a side-by-side Y1/Y2/Y3 spread view to assess trends and YoY movement.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/FinancialsTab.tsx`

Add a **"Spread View"** toggle (default: off, switches from card list to spread table).

**Spread table layout:**

| Line Item | FY2022 | FY2023 | FY2024 | YoY 23→24 |
|---|---|---|---|---|
| Revenue | 1,200,000 | 1,450,000 | 1,680,000 | ▲ +15.9% |
| Gross Profit | 480,000 | 580,000 | 705,000 | ▲ +21.6% |
| EBITDA | 240,000 | 310,000 | 390,000 | ▲ +25.8% |
| Net Profit | 120,000 | 160,000 | 195,000 | ▲ +21.9% |
| Total Assets | 3,200,000 | 3,600,000 | 3,950,000 | ▲ +9.7% |
| Total Debt | 1,800,000 | 1,950,000 | 2,050,000 | ▲ +5.1% |

**Ratio comparison section below the spread table:**

| Ratio | FY2022 | FY2023 | FY2024 | Threshold | Status |
|---|---|---|---|---|---|
| DSCR | 1.18x | 1.32x | 1.47x | ≥ 1.25x | ✅ |
| Gearing | 72% | 68% | 63% | ≤ 60% | ⚠️ |

**YoY change colour coding:**
- Green: improvement vs. threshold direction.
- Red: deterioration.
- Grey: neutral / within acceptable band.

**API:** Fetch all statements for the borrower; group by `statementType` (BS/PL/CF); align by `fiscalYearEnd`; merge line items by `lineKey`.

### Acceptance Criteria
- [ ] Spread view toggle available in FinancialsTab.
- [ ] Up to 5 years displayed side-by-side.
- [ ] YoY % change calculated and colour-coded per row.
- [ ] Computed ratios shown in comparison table with threshold badges.
- [ ] Spread view printable (included in CA Memo PDF section).

---

## Item 2.3 — Letter of Offer (LOO) Generation

**Effort:** 2 weeks  
**Track:** Full stack  
**Audit Reference:** MF-3 — required by Phase 1 item 1.3 (e-sign gate)

### Context
The OFFER state exists but no LOO is generated. This item produces a system-generated PDF that the borrower signs and returns (completing the Phase 1 e-sign gate). Also establishes offer expiry tracking.

### Schema Changes

Add fields to `CreditApplication`:
```prisma
// In CreditApplication model
looGeneratedAt   DateTime? @map("loo_generated_at") @db.Timestamp(6)
looExpiryDate    DateTime? @map("loo_expiry_date") @db.Date        // default: generated + 14 days
looGeneratedById String?   @map("loo_generated_by_id") @db.Uuid
looVersion       Int       @default(1) @map("loo_version")         // increments on re-generation
```

Run migration: `npx prisma migrate dev --name add_loo_fields`

### Backend Changes

**File:** `backend/src/credit/services/loo.service.ts` *(new)*

```typescript
// Key methods:
generate(applicationId, generatedById): Promise<{ pdfBuffer, documentId }>
// 1. Fetch application + facilities + conditions + parties + approvedDecision
// 2. Render HTML template with merge fields
// 3. Convert to PDF via htmlToPdf.service.ts (already exists)
// 4. Save as CreditDocument (classification: LEGAL, fileName: `LOO-{appNo}-v{version}.pdf`)
// 5. Update application: looGeneratedAt, looExpiryDate (+14 days), looVersion++
// 6. Log CreditAuditEvent

checkExpiry(applicationId): Promise<{ expired: boolean, expiryDate }>
// Used by state machine to prevent ACCEPTED transition on expired LOO
```

**LOO HTML Template** — `backend/src/credit/templates/loo.html.ts`:

Sections:
1. Letterhead (lender name, address, date)
2. Borrower name + address
3. Subject: Letter of Offer — `{applicationNo}`
4. Facility table (facility type, approved amount, tenor, effective rate, repayment schedule)
5. Conditions precedent summary
6. Conditions subsequent summary
7. Validity period (`looExpiryDate`)
8. Acceptance block (signature line, NRIC, date, witness)
9. Bank acceptance countersignature block

**File:** `backend/src/credit/routes/loo.routes.ts` *(new)*
```
POST /api/v1/credit/applications/:id/loo/generate    — generate LOO PDF (credit:approve)
GET  /api/v1/credit/applications/:id/loo/status      — expiry, version, generated date
POST /api/v1/credit/applications/:id/loo/regenerate  — regenerate (increments version)
```

Add expiry check to `canAcceptOffer()` in `submissionReadiness.service.ts`:
```typescript
if (app.looExpiryDate && app.looExpiryDate < new Date()) {
  return { ready: false, reason: 'Letter of Offer has expired. Please regenerate.' };
}
```

### Frontend Changes

**File:** `frontend/pages/credit/tabs/ApprovalsTab.tsx`

Add **LOO section** visible in APPROVED and OFFER states:
- "Generate Letter of Offer" button (credit:approve).
- Shows current LOO version, generated date, expiry date.
- Expiry countdown badge (e.g., "Expires in 8 days" — amber if < 5 days, red if expired).
- "Regenerate LOO" button (increments version, re-generates PDF).
- Download link for generated LOO PDF.
- Instruction callout: *"Send this letter to the borrower for signing. Once signed, upload the executed copy as a Legal document and have it verified to accept the offer."*

### Acceptance Criteria
- [ ] LOO PDF generated with all merge fields populated (facility table, conditions, expiry date).
- [ ] PDF saved as `CreditDocument` (classification: `LEGAL`, verificationStatus: `PENDING`).
- [ ] Offer expiry enforced — OFFER → ACCEPTED blocked if LOO expired.
- [ ] Re-generation increments `looVersion`; old PDF retained with version number in filename.
- [ ] `CreditAuditEvent` logged on generate and regenerate.

---

## Item 2.4 — Committee Formal Meeting Screen

**Effort:** 2 weeks  
**Track:** Frontend  
**Audit Reference:** HP-6 — `credit:committee_formal` feature flag currently OFF

### Context
`CommitteeMeeting`, `CommitteeAgendaItem`, `CommitteeVote`, `CommitteeMember` models are complete. The backend routes and service exist. Only the management UI is missing.

### Feature Flag
Update seed: `credit:committee_formal` → `enabled: true`

### Frontend Changes

**File:** `frontend/pages/credit/CommitteeMeetingList.tsx` *(new page)*

- List of meetings (title, date, type, status, quorum status).
- "Schedule New Meeting" button (credit:approve).
- Filter by status (SCHEDULED / IN_PROGRESS / COMPLETED / CANCELLED).

**File:** `frontend/pages/credit/CommitteeMeetingDetail.tsx` *(new page)*

Sections:

**1. Meeting Header**
- Title, type (REGULAR / ADHOC), scheduled date/time, location.
- Status badge + action buttons: "Start Meeting" / "Complete Meeting" / "Cancel Meeting".
- Quorum indicator: `Present count / quorumMin required` — green if met, red if not.

**2. Members & Attendance**
- Member list (name, role: CHAIR/SECRETARY/MEMBER).
- Attendance toggle per member (PRESENT / ABSENT / EXCUSED).
- Quorum auto-updates as attendance is marked.

**3. Agenda**
- Ordered list of agenda items (each linked to a `CreditApplication`).
- Each item shows: application number, borrower name, facility amount, assigned analyst.
- "Present Item" button → opens the application's approval pack in a side panel.
- Decision section per item: APPROVE / REJECT / DEFER radio + mandatory comment field.
- Vote tally per item (Approve: X, Reject: Y, Abstain: Z) — visible to CHAIR/SECRETARY only until item concluded.

**4. Individual Voting Panel** (per member, per agenda item)
- Vote: APPROVE / REJECT / ABSTAIN.
- Comment field (mandatory on REJECT).
- Submitted votes locked — cannot be changed after submission.

**Routes** (add to React Router):
```
/credit/committee                    → CommitteeMeetingList
/credit/committee/:meetingId         → CommitteeMeetingDetail
```

### Acceptance Criteria
- [ ] Meetings can be created, started, completed, cancelled.
- [ ] Attendance marking updates quorum indicator in real time.
- [ ] Cannot mark meeting as COMPLETED if quorum not met (warning displayed).
- [ ] Each committee member votes independently; votes hidden from other members until item concluded.
- [ ] REJECT vote requires mandatory comment.
- [ ] Meeting outcome (APPROVED / REJECTED / DEFERRED per agenda item) triggers `CreditApplication` state transition.
- [ ] Full audit log via `CommitteeVote` and `CreditAuditEvent`.

---

## Item 2.5 — Conditional Approval Inline Conditions

**Effort:** 1 week  
**Track:** Frontend  
**Audit Reference:** HP-2

### Context
`CreditDecision.decisionType` has `CONDITIONAL` but conditions are created separately in ConditionsTab after approval. Approvers should capture conditions as part of the approval action itself.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/ApprovalsTab.tsx`

When approver selects `CONDITIONAL` as decision type, reveal an **inline conditions capture section** before the submit button:

- Add Condition button → row with fields: Title, Description, Category (PRE_DISBURSEMENT / POST_DISBURSEMENT), Type (PRECEDENT / SUBSEQUENT), Due Date.
- Multiple conditions can be added before submitting the decision.
- On approval submit: (1) record `CreditDecision`, (2) create each `Condition` record linked to the application, (3) link conditions to the decision via `decisionId` field.

**Schema Change (minor):**

Add optional `decisionId` to `Condition` model to trace which approval decision generated it:
```prisma
// Condition model
decisionId  String?  @map("decision_id") @db.Uuid
decision    CreditDecision? @relation(fields: [decisionId], references: [id])
```

Run migration: `npx prisma migrate dev --name add_condition_decision_id`

**File:** `frontend/pages/credit/tabs/ConditionsTab.tsx`

Group conditions by source: "From Approval Decision" (with decision date + approver) vs. "Added Manually."

### Acceptance Criteria
- [ ] Selecting CONDITIONAL decision type reveals inline condition builder.
- [ ] At least one condition required when CONDITIONAL is selected.
- [ ] Conditions created on approval submit are linked to the `CreditDecision` record.
- [ ] ConditionsTab groups conditions by source (decision-linked vs. manual).

---

## Item 2.6 — Exposure Consolidation Dashboard Widget

**Effort:** 1.5 weeks  
**Track:** Full stack  
**Audit Reference:** HP-3

### Context
`ExposureSummary` model captures secured/unsecured by party type. `BorrowerProfile.exposureLimit` and `totalExposure` exist. No dashboard view consolidates group exposure vs. approved limits.

### Backend Changes

**File:** `backend/src/credit/services/dashboard.service.ts`

Add `getExposureSummary()`:
```typescript
async getExposureSummary(filters: { rmId?, borrowerGroupId?, riskRating? }) {
  // Aggregate approved facility amounts per borrower
  // Compare against BorrowerProfile.exposureLimit
  // Flag borrowers where totalExposure > exposureLimit * 0.9 (approaching limit)
  // Group by RelatedPartyGroup for connected party consolidated view
  return {
    totalPortfolioExposure,
    topBorrowers: [...],       // top 10 by exposure
    approachingLimit: [...],   // borrowers at >90% of limit
    breachedLimit: [...],      // borrowers exceeding limit
    byRiskRating: { AAA: x, AA: y, ... },
    byProductType: { TERM_LOAN: x, REVOLVING: y, ... },
  };
}
```

Add route: `GET /api/v1/credit/dashboard/exposure-summary`

**Exposure Limit Gate** — wire into `submissionReadiness.service.ts`:
```typescript
// On SUBMITTED → KYC_REVIEW transition, warn (not block) if new facility would breach exposureLimit
const projectedExposure = borrower.totalExposure + application.requestedAmount;
if (projectedExposure > borrower.exposureLimit) {
  // Add warning flag to readiness result (not a hard block — requires override)
}
```

### Frontend Changes

**File:** `frontend/pages/credit/CreditDashboard.tsx`

Add **Exposure Summary card**:
- Total portfolio exposure (MYR amount).
- Doughnut chart: by risk rating (AAA–D colour coded).
- "Approaching Limit" alert list (borrower name, current exposure, limit, % utilised).
- "Limit Breached" alert list (red badges).
- Drill-down: click borrower → opens BorrowerProfile detail.

### Acceptance Criteria
- [ ] Dashboard exposure card shows total portfolio, by-rating breakdown, approaching-limit list.
- [ ] Borrowers within 90% of limit highlighted in amber; above limit in red.
- [ ] Connected party groups show consolidated exposure (sum of all members).
- [ ] Submission readiness shows exposure warning when new facility would breach limit.

---

## Item 2.7 — Rejection Workflow

**Effort:** 1 week  
**Track:** Full stack  
**Audit Reference:** HP-5

### Context
`REJECTED` state exists but no structured rejection reason, no notification to borrower/RM, and no pathway to resubmit.

### Schema Changes

```prisma
enum RejectionReasonCode {
  INSUFFICIENT_INCOME
  HIGH_EXISTING_OBLIGATIONS
  POOR_CREDIT_HISTORY
  INADEQUATE_COLLATERAL
  WEAK_BUSINESS_PERFORMANCE
  INCOMPLETE_DOCUMENTATION
  AML_COMPLIANCE_ISSUE
  POLICY_BREACH
  CONCENTRATION_LIMIT
  OTHER
}
```

Add to `CreditApplication`:
```prisma
rejectionReasonCode  RejectionReasonCode? @map("rejection_reason_code")
```

Run migration: `npx prisma migrate dev --name add_rejection_reason_code`

### Backend Changes

**File:** `backend/src/credit/services/creditApplication.service.ts`

On `COMMITTEE_REVIEW → REJECTED` or `CREDIT_ASSESSMENT → REJECTED` transition:
- Require `rejectionReasonCode` in the transition payload.
- Require `rejectionReason` text (already exists on model).
- Call `notifyRejection()`.

**File:** `backend/src/credit/services/creditNotification.service.ts`

Add `notifyRejection(applicationId)`:
- Notify assigned RM: *"Application {appNo} for {borrowerName} has been rejected. Reason: {reason}."*
- Notify borrower contact (email): rejection notification with reason summary (no sensitive details).

**File:** `backend/src/credit/services/creditApplication.service.ts`

Add `copyToNewApplication(applicationId, requestedById)`:
- Clones application with state = DRAFT.
- Copies: borrower, product type, requested amount/tenor, parties, facilities (as new DRAFT records).
- Sets `parentApplicationId` reference (add nullable field to link to rejected source).
- Does NOT copy decisions, documents, conditions (fresh start).

### Frontend Changes

**File:** `frontend/pages/credit/tabs/ApprovalsTab.tsx`

On REJECT decision:
- Require rejection reason code (dropdown).
- Require rejection reason text.

**File:** `frontend/pages/CreditApplicationDetail.tsx`

In REJECTED state, show:
- Rejection reason code + full reason text in a prominent banner.
- "Copy to New Application" button → calls `copyToNewApplication()` → navigates to new DRAFT application.

### Acceptance Criteria
- [ ] REJECT transition requires reason code + reason text.
- [ ] RM notified immediately on rejection.
- [ ] Borrower notified via email with reason summary.
- [ ] "Copy to New Application" creates DRAFT clone preserving borrower and facility structure.
- [ ] New application links to source via `parentApplicationId`.

---

## Item 2.8 — AML Rescreen Event Log

**Effort:** 1 week  
**Track:** Full stack  
**Audit Reference:** RC-2

### Context
`amlRescreen.service.ts` exists but no `AmlRescreenEvent` model to record who triggered it, what the result was, and what action was taken.

### Schema Changes

```prisma
enum AmlRescreenOutcome {
  CLEAR
  POTENTIAL_HIT
  CONFIRMED_HIT
  FALSE_POSITIVE
}

enum AmlRescreenAction {
  NO_ACTION
  ESCALATED_TO_COMPLIANCE
  RELATIONSHIP_EXITED
  FILED_STR             // Suspicious Transaction Report
}

model AmlRescreenEvent {
  id              String              @id @default(uuid()) @db.Uuid
  borrowerProfileId String            @map("borrower_profile_id") @db.Uuid
  applicationId   String?             @map("application_id") @db.Uuid
  triggeredById   String              @map("triggered_by_id") @db.Uuid
  triggeredAt     DateTime            @default(now()) @map("triggered_at") @db.Timestamp(6)
  screeningSource String              @map("screening_source") @db.VarChar(100) // e.g. UN, OFAC, internal
  outcome         AmlRescreenOutcome
  hitDetails      String?             @map("hit_details") @db.Text
  actionTaken     AmlRescreenAction
  actionNotes     String?             @map("action_notes") @db.Text
  reviewedById    String?             @map("reviewed_by_id") @db.Uuid
  reviewedAt      DateTime?           @map("reviewed_at") @db.Timestamp(6)
  createdAt       DateTime            @default(now()) @map("created_at") @db.Timestamp(6)

  borrowerProfile BorrowerProfile     @relation(fields: [borrowerProfileId], references: [id])
  application     CreditApplication?  @relation(fields: [applicationId], references: [id])
  triggeredBy     User                @relation("AmlRescreenTriggeredBy", fields: [triggeredById], references: [id])
  reviewedBy      User?               @relation("AmlRescreenReviewedBy", fields: [reviewedById], references: [id])

  @@index([borrowerProfileId])
  @@map("aml_rescreen_events")
}
```

Run migration: `npx prisma migrate dev --name add_aml_rescreen_event`

### Backend Changes

**File:** `backend/src/credit/services/amlRescreen.service.ts`

Extend `triggerRescreen()` to create an `AmlRescreenEvent` record:
```typescript
async triggerRescreen(borrowerProfileId, applicationId, triggeredById, dto) {
  // Run screening (currently manual — log what the officer reported)
  const event = await prisma.amlRescreenEvent.create({
    data: { borrowerProfileId, applicationId, triggeredById, ...dto }
  });
  // If outcome === CONFIRMED_HIT, notify compliance team
  if (dto.outcome === 'CONFIRMED_HIT') {
    await this.notifyComplianceHit(event);
  }
  return event;
}
```

**File:** `backend/src/credit/routes/amlRescreen.routes.ts` *(extend)*
```
POST /api/v1/credit/borrowers/:borrowerId/aml-rescreen          — trigger + log
GET  /api/v1/credit/borrowers/:borrowerId/aml-rescreen          — history
PATCH /api/v1/credit/aml-rescreen/:eventId/review               — compliance review
```

### Frontend Changes

**File:** `frontend/pages/credit/tabs/CreditChecksTab.tsx`

Add **AML Rescreen History** section:
- List of all `AmlRescreenEvent` records for this application's borrower.
- Each row: date, triggered by, source, outcome badge (CLEAR / POTENTIAL_HIT / CONFIRMED_HIT / FALSE_POSITIVE), action taken, reviewed by.
- "Run AML Rescreen" button → modal with: screening source, outcome, hit details (if applicable), action taken, notes.
- CONFIRMED_HIT rows shown with red badge; require compliance review before further processing.

### Acceptance Criteria
- [ ] Every AML screening action creates an `AmlRescreenEvent` — no unlogged screenings possible.
- [ ] CONFIRMED_HIT triggers compliance team notification.
- [ ] Compliance review (`reviewedById` + `reviewedAt`) required on CONFIRMED_HIT before application can progress.
- [ ] Full history visible in CreditChecksTab.

---

## Phase 2 Delivery Checklist

| Item | Schema Migration | Backend Service | API Route | Frontend UI | Done |
|---|---|---|---|---|---|
| 2.1 Pricing Engine | `PricingWorksheet` | `pricing.service.ts` | GET/PUT pricing | FacilitiesTab sub-panel | ☐ |
| 2.2 Multi-year comparison | — | Existing financial API | — | Spread view toggle in FinancialsTab | ☐ |
| 2.3 LOO Generation | LOO fields on `CreditApplication` | `loo.service.ts` | POST generate, GET status | ApprovalsTab LOO section | ☐ |
| 2.4 Committee screen | — | Existing committee service | — | CommitteeMeetingList + Detail pages | ☐ |
| 2.5 Conditional conditions | `decisionId` on `Condition` | Existing condition service | — | ApprovalsTab inline condition builder | ☐ |
| 2.6 Exposure dashboard | — | `getExposureSummary()` | GET exposure-summary | CreditDashboard exposure card | ☐ |
| 2.7 Rejection workflow | `rejectionReasonCode` enum + field | Notify + copy service | — | ApprovalsTab reason picker + Copy button | ☐ |
| 2.8 AML event log | `AmlRescreenEvent` model | Extended `amlRescreen.service.ts` | POST/GET aml-rescreen | CreditChecksTab history section | ☐ |

**Definition of Done for Phase 2:**
- All migrations applied, Prisma client regenerated.
- `credit:committee_formal` feature flag enabled in seed.
- LOO template renders correctly for all facility types.
- Smoke test passes.
- No TypeScript errors.
