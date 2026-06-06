# Credit Assessment Module — Phase 1 Implementation Plan
## Critical Fixes (Weeks 1–6)

**Date:** 2026-06-06  
**Source:** Enterprise Audit Rev 4  
**Objective:** Close all remaining critical and high-severity gaps. No external API dependencies. All items are internal builds only.  
**Total Estimated Effort:** ~5–7 weeks (items can be parallelised across backend and full-stack tracks)

---

## Summary of Items

| # | Item | Effort | Track | Priority |
|---|------|--------|-------|----------|
| 1.1 | Bureau checklist enforcement | 1 week | Backend | P0 |
| 1.2 | Disbursement control layer | 2–3 weeks | Backend | P0 |
| 1.3 | E-sign document gate | 3 days | Backend | P0 |
| 1.4 | Auto-compute financial ratios | 1–2 weeks | Full stack | P1 |

**Parallelisation:** 1.1 and 1.3 can run concurrently. 1.2 runs independently. 1.4 can begin once 1.1/1.3 are done.

---

## Item 1.1 — Bureau Checklist Enforcement

**Effort:** 1 week  
**Track:** Backend  
**Audit Reference:** CG-1 (downgraded CRITICAL → MEDIUM; workaround accepted)

### Context
The schema already has everything needed: `CreditBureauCheck` with `attachedDocId`, structured CCRIS/CTOS fields, and `BureauChecklist`. The gap is enforcement — currently the checklist can be ticked without evidence uploaded.

### Schema Change

Add `verifiedById` and `verifiedAt` to `BureauChecklist` for maker-checker:

```prisma
// backend/prisma/schema.prisma — BureauChecklist model
model BureauChecklist {
  // ... existing fields ...
  verifiedById   String?   @map("verified_by_id") @db.Uuid
  verifiedAt     DateTime? @map("verified_at") @db.Timestamp(6)

  verifiedBy  User?  @relation("BureauChecklistVerifiedBy", fields: [verifiedById], references: [id])
}
```

Run migration: `npx prisma migrate dev --name add_bureau_checklist_verified_by`

### Backend Changes

**File:** `backend/src/credit/services/bureauCheck.service.ts`

Add validation: before setting `ccrisUploaded = true` or `ctosUploaded = true`, check that the linked `CreditBureauCheck` row has `attachedDocId` set and the linked `CreditDocument` has `verificationStatus = VERIFIED`.

```typescript
// bureauCheck.service.ts
async tickChecklist(applicationId: string, field: keyof BureauChecklistFields, tickedById: string) {
  if (field === 'ccrisUploaded' || field === 'ctosUploaded') {
    const provider = field === 'ccrisUploaded' ? 'CCRIS_BORROWER_UPLOAD' : 'CTOS';
    const bureauCheck = await prisma.creditBureauCheck.findFirst({
      where: { applicationId, provider },
      include: { attachedDoc: true },
    });
    if (!bureauCheck?.attachedDocId) {
      throw new BadRequestError('Bureau report PDF must be uploaded before ticking this item.');
    }
    if (bureauCheck.attachedDoc?.verificationStatus !== 'VERIFIED') {
      throw new BadRequestError('Bureau report PDF must be verified by a second officer before ticking.');
    }
  }
  // proceed to update checklist
}
```

Add `verifyChecklist` endpoint for supervisor to mark `verifiedById` + `verifiedAt`:

```typescript
async verifyChecklist(applicationId: string, verifiedById: string) {
  // Confirm all uploaded docs are VERIFIED, all required checks are ticked
  // Then set verifiedById + verifiedAt
}
```

**File:** `backend/src/credit/services/submissionReadiness.service.ts`

Add gate on `CREDIT_ASSESSMENT → COMMITTEE_REVIEW` transition:

```typescript
// In checkReadiness() or canTransition()
const checklist = await prisma.bureauChecklist.findUnique({ where: { applicationId } });
if (!checklist?.ccrisUploaded || !checklist?.ctosUploaded || !checklist?.amlScreeningDone) {
  return { ready: false, reason: 'Bureau checklist incomplete. CCRIS, CTOS and AML screening must be completed before committee submission.' };
}
if (!checklist?.verifiedById) {
  return { ready: false, reason: 'Bureau checklist must be verified by a second officer before committee submission.' };
}
```

**File:** `backend/src/credit/routes/bureauCheck.routes.ts`

Add route: `POST /applications/:applicationId/bureau-checklist/verify`

### Frontend Changes

**File:** `frontend/pages/credit/tabs/CreditChecksTab.tsx`

- Show checklist items as disabled until `attachedDocId` is set on the corresponding `CreditBureauCheck` row.
- Show a "Verify Checklist" button visible only to users with `credit:approve` permission (supervisor/manager).
- Display `verifiedBy` name + `verifiedAt` timestamp once verified.
- Show a warning banner if checklist is incomplete when application is in `CREDIT_ASSESSMENT` state.

### Feature Flag

Update seed: `credit:bureau_checks` → `enabled: true`

```typescript
// backend/prisma/seed-credit-flags.ts
{ key: 'credit:bureau_checks', enabled: true, description: 'Enable bureau check tab and checklist enforcement' }
```

### Acceptance Criteria
- [ ] Cannot tick `ccrisUploaded` without a verified `CreditDocument` of provider `CCRIS_BORROWER_UPLOAD` attached.
- [ ] Cannot tick `ctosUploaded` without a verified `CreditDocument` of provider `CTOS` attached.
- [ ] Supervisor can mark checklist as verified; `verifiedById ≠ tickedById` enforced.
- [ ] `CREDIT_ASSESSMENT → COMMITTEE_REVIEW` transition blocked if checklist incomplete or unverified.
- [ ] `CreditAuditEvent` logged on checklist verification.

---

## Item 1.2 — Disbursement Control Layer

**Effort:** 2–3 weeks  
**Track:** Backend  
**Audit Reference:** CG-2 (CRITICAL — only remaining critical gap)

### Context
`credit:disburse` RBAC permission exists. The state machine reaches `ACCEPTED` but there is no disbursement model, controller, or condition-precedent clearance gate. This is the only remaining CRITICAL gap.

### Schema Changes

```prisma
// backend/prisma/schema.prisma

enum DisbursementStatus {
  PENDING
  APPROVED
  DISBURSED
  CANCELLED
}

model DisbursementOrder {
  id                  String             @id @default(uuid()) @db.Uuid
  applicationId       String             @unique @map("application_id") @db.Uuid
  orderNo             String             @unique @map("order_no") @db.VarChar(30)  // e.g. DO-2026-00001
  requestedById       String             @map("requested_by_id") @db.Uuid
  requestedAt         DateTime           @default(now()) @map("requested_at") @db.Timestamp(6)
  approvedById        String?            @map("approved_by_id") @db.Uuid
  approvedAt          DateTime?          @map("approved_at") @db.Timestamp(6)
  disbursedById       String?            @map("disbursed_by_id") @db.Uuid
  disbursedAt         DateTime?          @map("disbursed_at") @db.Timestamp(6)
  status              DisbursementStatus @default(PENDING)
  totalAmount         Decimal            @map("total_amount") @db.Decimal(15, 2)
  currency            String             @default("MYR") @db.VarChar(3)
  disbursementMethod  String?            @map("disbursement_method") @db.VarChar(100)  // e.g. telegraphic transfer, cheque
  beneficiaryBank     String?            @map("beneficiary_bank") @db.VarChar(255)
  beneficiaryAccount  String?            @map("beneficiary_account") @db.VarChar(50)
  referenceNote       String?            @map("reference_note") @db.Text
  cancelledById       String?            @map("cancelled_by_id") @db.Uuid
  cancelledAt         DateTime?          @map("cancelled_at") @db.Timestamp(6)
  cancellationReason  String?            @map("cancellation_reason") @db.Text
  createdAt           DateTime           @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt           DateTime           @updatedAt @map("updated_at") @db.Timestamp(6)

  application   CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  requestedBy   User              @relation("DisbursementRequestedBy", fields: [requestedById], references: [id])
  approvedBy    User?             @relation("DisbursementApprovedBy", fields: [approvedById], references: [id])
  disbursedBy   User?             @relation("DisbursementDisbursedBy", fields: [disbursedById], references: [id])
  cancelledBy   User?             @relation("DisbursementCancelledBy", fields: [cancelledById], references: [id])

  @@map("disbursement_orders")
}
```

Add relation to `CreditApplication`:
```prisma
disbursementOrder  DisbursementOrder?
```

Run migration: `npx prisma migrate dev --name add_disbursement_order`

### Disbursement Readiness Gate

**File:** `backend/src/credit/services/submissionReadiness.service.ts`

Before a disbursement order can be created (and before ACCEPTED → CLOSED transition), validate:

```typescript
async checkDisbursementReadiness(applicationId: string): Promise<ReadinessResult> {
  const checks = [];

  // 1. All conditions precedent must be FULFILLED or WAIVED
  const openPrecedents = await prisma.condition.count({
    where: { applicationId, conditionType: 'PRECEDENT', status: 'PENDING' },
  });
  if (openPrecedents > 0) {
    checks.push({ pass: false, reason: `${openPrecedents} condition(s) precedent still pending.` });
  }

  // 2. Application must be in ACCEPTED state
  const app = await prisma.creditApplication.findUnique({ where: { id: applicationId } });
  if (app?.state !== 'ACCEPTED') {
    checks.push({ pass: false, reason: 'Application must be in ACCEPTED state before disbursement.' });
  }

  // 3. At least one approved CreditDecision must exist
  const decision = await prisma.creditDecision.findFirst({
    where: { applicationId, decisionType: 'APPROVE' },
  });
  if (!decision) {
    checks.push({ pass: false, reason: 'No approval decision on record.' });
  }

  // 4. Letter of Offer (LEGAL class document) must be verified
  const legalDoc = await prisma.creditDocument.findFirst({
    where: { applicationId, classification: 'LEGAL', verificationStatus: 'VERIFIED', deletedAt: null },
  });
  if (!legalDoc) {
    checks.push({ pass: false, reason: 'Signed Letter of Offer must be uploaded and verified.' });
  }

  return { ready: checks.every(c => c.pass), checks };
}
```

### Service

**File:** `backend/src/credit/services/disbursement.service.ts` *(new)*

```typescript
// Key methods:
create(applicationId, requestedById, dto)   // creates DisbursementOrder in PENDING, runs readiness gate
approve(orderId, approvedById)               // PENDING → APPROVED (requires credit:approve)
disburse(orderId, disbursedById)             // APPROVED → DISBURSED (requires credit:disburse), transitions app to CLOSED
cancel(orderId, cancelledById, reason)       // any non-DISBURSED → CANCELLED
getOrder(applicationId)                      // fetch order with relations
```

On `disburse()`:
1. Validate status is APPROVED.
2. Set `disbursedAt`, `disbursedById`, status = DISBURSED.
3. Transition `CreditApplication.state` → `CLOSED`.
4. Log `CreditAuditEvent` (eventType: `DISBURSEMENT_COMPLETED`).
5. Send notification to RM + ops team.

### Controller & Routes

**File:** `backend/src/credit/controllers/disbursement.controller.ts` *(new)*  
**File:** `backend/src/credit/routes/disbursement.routes.ts` *(new)*

```
POST   /api/v1/credit/applications/:id/disbursement          — create order (credit:write)
GET    /api/v1/credit/applications/:id/disbursement          — get order status
POST   /api/v1/credit/applications/:id/disbursement/approve  — approve order (credit:approve)
POST   /api/v1/credit/applications/:id/disbursement/disburse — confirm disburse (credit:disburse)
POST   /api/v1/credit/applications/:id/disbursement/cancel   — cancel order (credit:approve)
GET    /api/v1/credit/applications/:id/disbursement/readiness — readiness checklist
```

Mount in `credit.routes.ts`.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/DisbursementTab.tsx` *(new tab)*

Sections:
1. **Readiness Checklist** — shows each gate item (conditions precedent, LOO verified, decision on record) with ✅/❌ status.
2. **Disbursement Order Form** — fields: disbursement method, beneficiary bank, beneficiary account, reference note, total amount (pre-filled from approved facilities).
3. **Approval Action** — "Approve Disbursement" button (credit:approve role).
4. **Disburse Action** — "Confirm Disbursement" button (credit:disburse role) — only enabled when status = APPROVED.
5. **Status Banner** — shows current order status (PENDING / APPROVED / DISBURSED / CANCELLED) with timestamps and user names.

Add tab to `tabRegistry.ts` — visible in `ACCEPTED` and `CLOSED` states, permission: `credit:disburse`.

### Notification

**File:** `backend/src/credit/services/creditNotification.service.ts`

Add `notifyDisbursementRequested()`, `notifyDisbursementApproved()`, `notifyDisbursementCompleted()` — notify assigned RM, ops team, and borrower (via email).

### Acceptance Criteria
- [ ] Cannot create disbursement order if any condition precedent is PENDING.
- [ ] Cannot create if no verified LEGAL document (signed LOO) attached.
- [ ] Maker-checker: creator cannot be approver.
- [ ] Approver cannot be disburser (three-role segregation: requestor / approver / disburser).
- [ ] Application transitions to CLOSED only after disbursement confirmed.
- [ ] `CreditAuditEvent` logged at each status change.
- [ ] Notifications sent at create, approve, and disburse events.

---

## Item 1.3 — E-Sign Document Gate

**Effort:** 3 days  
**Track:** Backend  
**Audit Reference:** CG-3 (downgraded CRITICAL → LOW; workaround accepted)

### Context
The OFFER → ACCEPTED transition must require a verified signed Letter of Offer (uploaded as `CreditDocument`, classification `LEGAL`) before proceeding. This closes the e-sign gap without an external provider.

### Backend Changes

**File:** `backend/src/credit/services/submissionReadiness.service.ts`

Add gate on `OFFER → ACCEPTED` transition:

```typescript
async canAcceptOffer(applicationId: string): Promise<ReadinessResult> {
  const signedLoo = await prisma.creditDocument.findFirst({
    where: {
      applicationId,
      classification: 'LEGAL',
      verificationStatus: 'VERIFIED',
      deletedAt: null,
    },
  });
  if (!signedLoo) {
    return {
      ready: false,
      reason: 'Signed Letter of Offer must be uploaded and verified before the offer can be accepted.',
    };
  }
  return { ready: true };
}
```

Wire into `stateGuard.util.ts` or the `transition()` method in `creditApplication.service.ts` for the `ACCEPTED` target state.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/ApprovalsTab.tsx` (or wherever the OFFER → ACCEPTED action lives)

- Show a callout: *"To accept this offer, upload the signed Letter of Offer as a Legal document and have it verified by a credit officer."*
- Disable the "Accept Offer" button until the gate passes (fetch `/disbursement/readiness` or a dedicated readiness endpoint).
- Link directly to the Documents tab for upload convenience.

### Acceptance Criteria
- [ ] `OFFER → ACCEPTED` transition blocked via API if no verified `LEGAL` document present.
- [ ] Frontend disables Accept Offer button and shows instructional message.
- [ ] `CreditAuditEvent` logs `OFFER_ACCEPTED` with the `documentId` of the signed LOO.

---

## Item 1.4 — Auto-Compute Financial Ratios

**Effort:** 1–2 weeks  
**Track:** Full stack  
**Audit Reference:** CG-4, HP-1

### Context
`FinancialRatio` model and `computeRatios()` service method exist. The gap is: ratios are not automatically computed when financial line items are saved, and the computed values are not displayed in the FinancialsTab with threshold alerts.

### Ratio Formulas to Implement

| Ratio Key | Category | Formula |
|---|---|---|
| `current_ratio` | LIQUIDITY | Current Assets / Current Liabilities |
| `quick_ratio` | LIQUIDITY | (Current Assets − Inventory) / Current Liabilities |
| `debt_to_equity` | LEVERAGE | Total Debt / Total Equity |
| `gearing_ratio` | LEVERAGE | Total Debt / (Total Debt + Total Equity) |
| `dscr` | COVERAGE | EBITDA / (Interest + Principal Repayments) |
| `ebitda_interest_cover` | COVERAGE | EBITDA / Interest Expense |
| `gross_margin` | PROFITABILITY | Gross Profit / Revenue |
| `net_margin` | PROFITABILITY | Net Profit / Revenue |
| `roe` | PROFITABILITY | Net Profit / Total Equity |
| `roa` | PROFITABILITY | Net Profit / Total Assets |
| `asset_turnover` | ACTIVITY | Revenue / Total Assets |
| `receivables_days` | ACTIVITY | (Trade Receivables / Revenue) × 365 |
| `payables_days` | ACTIVITY | (Trade Payables / COGS) × 365 |
| `inventory_days` | ACTIVITY | (Inventory / COGS) × 365 |

### Backend Changes

**File:** `backend/src/credit/services/financial.service.ts`

Wire `computeRatios()` to fire automatically after any `FinancialLineItem` save (upsert pattern):

```typescript
async saveLineItem(statementId: string, dto: LineItemDto) {
  await prisma.financialLineItem.upsert({ ... });
  // Auto-compute after every save
  await this.computeRatios(statementId);
}

async computeRatios(statementId: string) {
  const lines = await prisma.financialLineItem.findMany({ where: { statementId } });
  const lineMap = Object.fromEntries(lines.map(l => [l.lineKey, l.amount]));

  const ratios = [
    { ratioKey: 'current_ratio', category: 'LIQUIDITY', value: div(lineMap['current_assets'], lineMap['current_liabilities']) },
    { ratioKey: 'dscr', category: 'COVERAGE', value: div(lineMap['ebitda'], safeAdd(lineMap['interest_expense'], lineMap['principal_repayment'])) },
    // ... all ratios
  ].filter(r => r.value !== null);

  // Upsert all ratios
  await Promise.all(ratios.map(r =>
    prisma.financialRatio.upsert({
      where: { statementId_ratioKey: { statementId, ratioKey: r.ratioKey } },
      create: { statementId, ...r },
      update: { value: r.value },
    })
  ));
}
```

Define standard `lineKey` constants in a shared file (`creditFinancialKeys.ts`) so frontend and backend use the same keys.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/FinancialsTab.tsx`

Add a **Computed Ratios Panel** below the line item entry grid:

- Grouped by category (Liquidity, Leverage, Coverage, Profitability, Activity).
- Each ratio shows: label, computed value, formula hint (tooltip), and a threshold badge.

**Threshold badges:**

| Ratio | Pass | Warning | Fail |
|---|---|---|---|
| DSCR | ≥ 1.25x | 1.00–1.25x | < 1.00x |
| Gearing | ≤ 60% | 60–80% | > 80% |
| Current Ratio | ≥ 1.5x | 1.0–1.5x | < 1.0x |
| Gross Margin | ≥ 20% | 10–20% | < 10% |

Ratios auto-refresh after each line item save (refetch from API or update from API response).

**Multi-year comparison** (pairs with Phase 2 item 2.2): render ratio rows in columns (Y1 / Y2 / Y3) with YoY % change arrow.

### Acceptance Criteria
- [ ] Ratios recomputed automatically on every line item save — no manual trigger needed.
- [ ] All 14 ratios rendered in grouped panel in FinancialsTab.
- [ ] Threshold badges correct for DSCR, gearing, current ratio, gross margin.
- [ ] Division-by-zero handled gracefully (null displayed as `—`).
- [ ] Scorecard factor inputs that rely on ratio values (DSCR, gearing) automatically pick up the computed ratio values.

---

## Phase 1 Delivery Checklist

| Item | Schema Migration | Backend Service | API Route | Frontend UI | Tests | Done |
|---|---|---|---|---|---|---|
| 1.1 Bureau enforcement | `verifiedById` on BureauChecklist | `tickChecklist()` gate, `verifyChecklist()` | `POST .../verify` | CreditChecksTab enforcement | Unit + integration | ☐ |
| 1.2 Disbursement layer | `DisbursementOrder` model | `disbursement.service.ts` | 6 new routes | `DisbursementTab.tsx` | Unit + integration | ☐ |
| 1.3 E-sign gate | — | `canAcceptOffer()` gate | Wired in transition | ApprovalsTab button disable | Integration | ☐ |
| 1.4 Auto-ratios | Unique index on `statementId+ratioKey` | `computeRatios()` auto-fire | — | Ratio panel + badges | Unit | ☐ |

**Definition of Done for Phase 1:**
- All migrations applied and Prisma client regenerated.
- Seed re-run (`npm run prisma:seed`) passes without errors.
- Smoke test (`creditSmokeTest.ts`) passes.
- No TypeScript errors (`npm run build` clean).
- All acceptance criteria above checked off.
