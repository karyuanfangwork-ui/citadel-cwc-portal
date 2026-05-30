# Non-Bank Lending Platform Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver 3 waves of improvements to the credit S1–S7 flow: (1) fix the 40% qualitative scoring blind spot, (2) bifurcate the journey for retail vs corporate borrowers, (3) uplift bureau checks from a shell into a real data capture gate.

**Architecture:** Wave 1 adds a `QualitativeAssessment` model and wires its scores into `scoring.service.ts`. Wave 2 adds a `RetailIncome` model, conditionally renders a DSR form instead of the financial spreader for `INDIVIDUAL` borrowers, and makes document gates borrower-type-aware. Wave 3 extends `CreditBureauCheck` with structured CCRIS/CTOS fields, adds a `BureauChecklist` model, and applies bureau-derived rating caps in the scoring engine.

**Tech Stack:** TypeScript, Prisma (PostgreSQL), Express, React 19, Vite. Tests via Jest (backend). Frontend state via React hooks + Axios service layer.

---

## File Map

**New files:**
- `backend/src/credit/services/qualitativeAssessment.service.ts`
- `backend/src/credit/controllers/qualitativeAssessment.controller.ts`
- `backend/src/credit/services/retailIncome.service.ts`
- `backend/src/credit/controllers/retailIncome.controller.ts`
- `backend/src/credit/services/bureauCheck.service.ts` (replaces shell placeholder)
- `backend/src/credit/controllers/bureauCheck.controller.ts`
- `backend/tests/credit/qualitativeAssessment.service.test.ts`
- `backend/tests/credit/retailIncome.service.test.ts`
- `backend/tests/credit/bureauCheck.service.test.ts`
- `backend/tests/credit/scoring.service.wave1.test.ts`
- `backend/tests/credit/scoring.service.wave3.test.ts`
- `frontend/pages/credit/tabs/QualitativeAssessmentTab.tsx`
- `frontend/pages/credit/tabs/RetailIncomeTab.tsx`

**Modified files:**
- `backend/prisma/schema.prisma` — 3 new models, 2 enums extended, 1 enum added
- `backend/src/credit/services/scoring.service.ts` — qualitative inputs + bureau caps
- `backend/src/credit/services/submissionReadiness.service.ts` — per-type doc gates + bureau freshness
- `backend/src/credit/routes/creditDocument.routes.ts` — new route registrations
- `frontend/pages/credit/tabs/RiskScoreTab.tsx` — qualitative sub-tab wired in
- `frontend/pages/credit/tabs/FinancialsTab.tsx` — retail income form branch
- `frontend/pages/credit/tabs/CreditChecksTab.tsx` — structured bureau form + checklist
- `frontend/pages/credit/tabs/DocumentsTab.tsx` — filter upload categories by borrower type
- `frontend/pages/credit/creditUtils.ts` — updated `getPhaseCompletion`, `getPhaseCompletion` input shape
- `frontend/src/services/credit.service.ts` — new API calls

---

## Wave 1 — Qualitative Scoring

### Task 1: Prisma — Add QualitativeAssessment model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model to schema.prisma**

Add after the `CreditScoreRun` model block (around line 3880):

```prisma
// ============================================================================
// Qualitative Assessment — Wave 1 (non-bank lending)
// ============================================================================
model QualitativeAssessment {
  id                 String   @id @default(uuid()) @db.Uuid
  applicationId      String   @unique @map("application_id") @db.Uuid
  managementScore    Int      @default(3) @map("management_score")
  relationshipScore  Int      @default(3) @map("relationship_score")
  industryScore      Int      @default(3) @map("industry_score")
  collateralScore    Int      @default(3) @map("collateral_score")
  assessedById       String   @map("assessed_by_id") @db.Uuid
  assessedAt         DateTime @default(now()) @map("assessed_at") @db.Timestamp(6)
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application  CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  assessedBy   User              @relation(fields: [assessedById], references: [id])

  @@map("qualitative_assessments")
}
```

Also add the reverse relation on `CreditApplication` (find the `CreditApplication` model and add inside its relations block):
```prisma
  qualitativeAssessment QualitativeAssessment?
```

And on `User` model (find User and add):
```prisma
  qualitativeAssessments QualitativeAssessment[]
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_qualitative_assessment
```

Expected: migration file created, Prisma client regenerated with no errors.

- [ ] **Step 3: Verify generated type**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(credit/w1): add QualitativeAssessment prisma model"
```

---

### Task 2: Backend service — qualitativeAssessment.service.ts

**Files:**
- Create: `backend/src/credit/services/qualitativeAssessment.service.ts`
- Create: `backend/tests/credit/qualitativeAssessment.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/credit/qualitativeAssessment.service.test.ts`:

```typescript
import { upsertQualitativeAssessment, getQualitativeAssessment, SLIDER_TO_SCORE } from '../../src/credit/services/qualitativeAssessment.service';
import prisma from '../../src/utils/prisma';

jest.mock('../../src/utils/prisma', () => ({
  qualitativeAssessment: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('SLIDER_TO_SCORE', () => {
  it('maps slider 1 to 10', () => expect(SLIDER_TO_SCORE[1]).toBe(10));
  it('maps slider 3 to 50', () => expect(SLIDER_TO_SCORE[3]).toBe(50));
  it('maps slider 5 to 90', () => expect(SLIDER_TO_SCORE[5]).toBe(90));
});

describe('upsertQualitativeAssessment', () => {
  it('calls prisma upsert with correct data', async () => {
    (mockPrisma.qualitativeAssessment.upsert as jest.Mock).mockResolvedValue({
      id: 'qa-1', applicationId: 'app-1', managementScore: 4,
      relationshipScore: 3, industryScore: 2, collateralScore: 5, assessedById: 'user-1',
    });

    const result = await upsertQualitativeAssessment('app-1', 'user-1', {
      managementScore: 4, relationshipScore: 3, industryScore: 2, collateralScore: 5,
    });

    expect(mockPrisma.qualitativeAssessment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: 'app-1' },
        create: expect.objectContaining({ managementScore: 4, assessedById: 'user-1' }),
        update: expect.objectContaining({ managementScore: 4, assessedById: 'user-1' }),
      })
    );
    expect(result.managementScore).toBe(4);
  });
});

describe('getQualitativeAssessment', () => {
  it('returns null when no assessment exists', async () => {
    (mockPrisma.qualitativeAssessment.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await getQualitativeAssessment('app-1');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/credit/qualitativeAssessment.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create the service**

Create `backend/src/credit/services/qualitativeAssessment.service.ts`:

```typescript
import prisma from '../../utils/prisma';

export const SLIDER_TO_SCORE: Record<number, number> = {
  1: 10,
  2: 32,
  3: 50,
  4: 68,
  5: 90,
};

export interface QualitativeScores {
  managementScore: number;    // 1–5
  relationshipScore: number;  // 1–5
  industryScore: number;      // 1–5
  collateralScore: number;    // 1–5
}

export function toFactorScores(qa: QualitativeScores) {
  return {
    management: SLIDER_TO_SCORE[qa.managementScore] ?? 50,
    relationship: SLIDER_TO_SCORE[qa.relationshipScore] ?? 50,
    industry: SLIDER_TO_SCORE[qa.industryScore] ?? 50,
    collateral: SLIDER_TO_SCORE[qa.collateralScore] ?? 50,
  };
}

export async function upsertQualitativeAssessment(
  applicationId: string,
  assessedById: string,
  scores: QualitativeScores,
) {
  return prisma.qualitativeAssessment.upsert({
    where: { applicationId },
    create: { applicationId, assessedById, assessedAt: new Date(), ...scores },
    update: { assessedById, assessedAt: new Date(), ...scores },
  });
}

export async function getQualitativeAssessment(applicationId: string) {
  return prisma.qualitativeAssessment.findUnique({ where: { applicationId } });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/credit/qualitativeAssessment.service.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/qualitativeAssessment.service.ts backend/tests/credit/qualitativeAssessment.service.test.ts
git commit -m "feat(credit/w1): qualitative assessment service + tests"
```

---

### Task 3: Backend controller + route

**Files:**
- Create: `backend/src/credit/controllers/qualitativeAssessment.controller.ts`
- Modify: `backend/src/credit/routes/creditDocument.routes.ts` (or whichever credit routes file mounts per-application endpoints — check the file that mounts `/applications/:id/...` routes)

- [ ] **Step 1: Find the correct routes file**

```bash
grep -rn "applications/:id\|applications/:applicationId" backend/src/credit/routes/ | head -10
```

Note the file that handles per-application sub-resources — use that file in step 3.

- [ ] **Step 2: Create the controller**

Create `backend/src/credit/controllers/qualitativeAssessment.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { upsertQualitativeAssessment, getQualitativeAssessment } from '../services/qualitativeAssessment.service';

export async function getQualitativeAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId } = req.params;
    const assessment = await getQualitativeAssessment(applicationId);
    res.json({ data: assessment });
  } catch (err) {
    next(err);
  }
}

export async function upsertQualitativeAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId } = req.params;
    const userId = (req as any).user?.id;
    const { managementScore, relationshipScore, industryScore, collateralScore } = req.body;

    // Validate slider range
    for (const [key, val] of Object.entries({ managementScore, relationshipScore, industryScore, collateralScore })) {
      if (typeof val !== 'number' || val < 1 || val > 5 || !Number.isInteger(val)) {
        return res.status(400).json({ error: `${key} must be an integer between 1 and 5` });
      }
    }

    const assessment = await upsertQualitativeAssessment(applicationId, userId, {
      managementScore, relationshipScore, industryScore, collateralScore,
    });
    res.json({ data: assessment });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 3: Register routes**

In the routes file found in step 1, add:

```typescript
import {
  getQualitativeAssessmentHandler,
  upsertQualitativeAssessmentHandler,
} from '../controllers/qualitativeAssessment.controller';

// Add inside the router definition, after existing application sub-resource routes:
router.get('/:applicationId/qualitative-assessment', getQualitativeAssessmentHandler);
router.put('/:applicationId/qualitative-assessment', upsertQualitativeAssessmentHandler);
```

- [ ] **Step 4: Manual smoke test**

```bash
cd backend && npm run dev
# In another terminal:
curl -s -X PUT http://localhost:3000/api/v1/credit/applications/<any-app-id>/qualitative-assessment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"managementScore":4,"relationshipScore":3,"industryScore":2,"collateralScore":5}' | jq .
```

Expected: `{ "data": { "managementScore": 4, ... } }`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/controllers/qualitativeAssessment.controller.ts backend/src/credit/routes/
git commit -m "feat(credit/w1): qualitative assessment controller + routes"
```

---

### Task 4: Wire qualitative scores into scoring.service.ts

**Files:**
- Modify: `backend/src/credit/services/scoring.service.ts`
- Create: `backend/tests/credit/scoring.service.wave1.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/credit/scoring.service.wave1.test.ts`:

```typescript
import { toFactorScores } from '../../src/credit/services/qualitativeAssessment.service';

describe('toFactorScores — qualitative override values', () => {
  it('converts slider 5 to 90 for management', () => {
    const scores = toFactorScores({ managementScore: 5, relationshipScore: 1, industryScore: 3, collateralScore: 4 });
    expect(scores.management).toBe(90);
    expect(scores.relationship).toBe(10);
    expect(scores.industry).toBe(50);
    expect(scores.collateral).toBe(68);
  });

  it('defaults to 50 for invalid slider value', () => {
    const scores = toFactorScores({ managementScore: 99 as any, relationshipScore: 3, industryScore: 3, collateralScore: 3 });
    expect(scores.management).toBe(50);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest tests/credit/scoring.service.wave1.test.ts --no-coverage
```

Expected: FAIL — `toFactorScores not exported`.

- [ ] **Step 3: Update scoring.service.ts — accept qualitative overrides**

In `backend/src/credit/services/scoring.service.ts`, change the `executeScore` method signature and the four placeholder factors:

```typescript
// At top, add import:
import { getQualitativeAssessment, toFactorScores } from './qualitativeAssessment.service';
```

Change the method signature (currently `async executeScore(applicationId: string, scorecardId?: string)`):

```typescript
async executeScore(
  applicationId: string,
  scorecardId?: string,
): Promise<ScoreResult> {
```

After the existing Step 5 block where `factorScores` is built, replace the four placeholder lines:

```typescript
// OLD (4 lines to replace):
      management: {
        weight: factorWeights.management,
        score: PLACEHOLDER_SCORE,
        weightedScore: 0,
      },
      industry: {
        weight: factorWeights.industry,
        score: PLACEHOLDER_SCORE,
        weightedScore: 0,
      },
      collateral: {
        weight: factorWeights.collateral,
        score: PLACEHOLDER_SCORE,
        weightedScore: 0,
      },
      relationship: {
        weight: factorWeights.relationship,
        score: PLACEHOLDER_SCORE,
        weightedScore: 0,
      },
      market_conditions: {
        weight: factorWeights.market_conditions,
        score: PLACEHOLDER_SCORE,
        weightedScore: 0,
      },
```

```typescript
// NEW — add before the factorScores block:
    const qa = await getQualitativeAssessment(applicationId);
    const qualScores = qa ? toFactorScores({
      managementScore: qa.managementScore,
      relationshipScore: qa.relationshipScore,
      industryScore: qa.industryScore,
      collateralScore: qa.collateralScore,
    }) : { management: 50, relationship: 50, industry: 50, collateral: 50 };

// NEW — replace the 5 placeholder factor blocks:
      management: {
        weight: factorWeights.management,
        score: qualScores.management,
        weightedScore: 0,
      },
      industry: {
        weight: factorWeights.industry,
        score: qualScores.industry,
        weightedScore: 0,
      },
      collateral: {
        weight: factorWeights.collateral,
        score: qualScores.collateral,
        weightedScore: 0,
      },
      relationship: {
        weight: factorWeights.relationship,
        score: qualScores.relationship,
        weightedScore: 0,
      },
      market_conditions: {
        weight: factorWeights.market_conditions,
        score: PLACEHOLDER_SCORE,   // market_conditions remains placeholder — no slider for it
        weightedScore: 0,
      },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/credit/scoring.service.wave1.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/credit/services/scoring.service.ts backend/tests/credit/scoring.service.wave1.test.ts
git commit -m "feat(credit/w1): wire qualitative slider scores into scoring engine"
```

---

### Task 5: Frontend — Qualitative Assessment sub-tab in RiskScoreTab

**Files:**
- Create: `frontend/pages/credit/tabs/QualitativeAssessmentTab.tsx`
- Modify: `frontend/pages/credit/tabs/RiskScoreTab.tsx`
- Modify: `frontend/src/services/credit.service.ts`

- [ ] **Step 1: Add API methods to credit.service.ts**

In `frontend/src/services/credit.service.ts`, add:

```typescript
export async function getQualitativeAssessment(applicationId: string) {
  const res = await api.get(`/credit/applications/${applicationId}/qualitative-assessment`);
  return res.data.data as {
    managementScore: number;
    relationshipScore: number;
    industryScore: number;
    collateralScore: number;
  } | null;
}

export async function upsertQualitativeAssessment(
  applicationId: string,
  scores: { managementScore: number; relationshipScore: number; industryScore: number; collateralScore: number },
) {
  const res = await api.put(`/credit/applications/${applicationId}/qualitative-assessment`, scores);
  return res.data.data;
}
```

- [ ] **Step 2: Create QualitativeAssessmentTab**

Create `frontend/pages/credit/tabs/QualitativeAssessmentTab.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { getQualitativeAssessment, upsertQualitativeAssessment } from '@/src/services/credit.service';

interface Props {
  applicationId: string;
  readOnly?: boolean;
}

const FACTORS = [
  {
    key: 'managementScore' as const,
    label: 'Management Quality',
    anchors: ['No track record', 'Below average', 'Adequate experience', 'Above average', 'Experienced team, succession plan'],
  },
  {
    key: 'relationshipScore' as const,
    label: 'Relationship & History',
    anchors: ['New customer', 'Short history, issues', '1–2 years, minor issues', 'Good history', '5+ years, zero delinquency'],
  },
  {
    key: 'industryScore' as const,
    label: 'Industry Outlook',
    anchors: ['Declining, adverse regulation', 'Weak growth', 'Stable, moderate growth', 'Growing', 'High-growth, favourable regulation'],
  },
  {
    key: 'collateralScore' as const,
    label: 'Collateral Quality',
    anchors: ['No collateral', 'Weak/illiquid asset', 'Tangible, moderate liquidity', 'Good quality asset', 'Liquid, insured, professionally valued'],
  },
] as const;

const SLIDER_LABELS: Record<number, string> = { 1: 'Weak', 2: 'Below Average', 3: 'Neutral', 4: 'Good', 5: 'Strong' };
const SLIDER_COLORS: Record<number, string> = { 1: 'text-red-500', 2: 'text-orange-500', 3: 'text-yellow-500', 4: 'text-blue-500', 5: 'text-green-600' };

type Scores = { managementScore: number; relationshipScore: number; industryScore: number; collateralScore: number };

export default function QualitativeAssessmentTab({ applicationId, readOnly }: Props) {
  const [scores, setScores] = useState<Scores>({ managementScore: 3, relationshipScore: 3, industryScore: 3, collateralScore: 3 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQualitativeAssessment(applicationId).then(qa => {
      if (qa) setScores(qa);
      setLoading(false);
    });
  }, [applicationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertQualitativeAssessment(applicationId, scores);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Qualitative Assessment</h3>
          <p className="text-xs text-gray-500 mt-0.5">Rate each factor 1–5. Unrated factors default to Neutral (3).</p>
        </div>
        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {FACTORS.map(factor => {
          const val = scores[factor.key];
          return (
            <div key={factor.key} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{factor.label}</span>
                <span className={`text-sm font-semibold ${SLIDER_COLORS[val]}`}>{val} — {SLIDER_LABELS[val]}</span>
              </div>
              <input
                type="range" min={1} max={5} step={1} value={val}
                disabled={readOnly}
                onChange={e => setScores(prev => ({ ...prev, [factor.key]: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between mt-1">
                {factor.anchors.map((anchor, i) => (
                  <span key={i} className={`text-[10px] text-center w-1/5 leading-tight ${val === i + 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                    {anchor}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Note: Scores feed directly into the next scorecard run. Re-run the scorecard after updating these ratings.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Wire sub-tab into RiskScoreTab**

In `frontend/pages/credit/tabs/RiskScoreTab.tsx`, import and add a tab toggle:

Find the top of the component and add:
```tsx
import QualitativeAssessmentTab from './QualitativeAssessmentTab';
```

Inside the component JSX, add a sub-navigation and render `QualitativeAssessmentTab` when the "qualitative" sub-tab is active. The exact insertion point depends on the current RiskScoreTab structure. Locate the main return block and add before the closing `</div>`:

```tsx
{/* Qualitative Assessment sub-tab */}
<div className="mt-6 border-t pt-4">
  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Qualitative Factors</h3>
  <QualitativeAssessmentTab applicationId={applicationId} readOnly={readOnly} />
</div>
```

(If `applicationId` and `readOnly` are named differently in RiskScoreTab, match the existing prop names.)

- [ ] **Step 4: Start dev server and verify visually**

```bash
cd frontend && npm run dev
```

Navigate to a credit application → S4 Risk Score tab. Verify:
- Four sliders appear with labels
- Moving a slider updates the label (Weak/Neutral/Strong)
- Save button works without console errors

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/credit/tabs/QualitativeAssessmentTab.tsx frontend/pages/credit/tabs/RiskScoreTab.tsx frontend/src/services/credit.service.ts
git commit -m "feat(credit/w1): qualitative assessment sliders in S4 Risk Score tab"
```

---

## Wave 2 — Retail / Corporate Bifurcation

### Task 6: Prisma — Add RetailIncome model and extend enums

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add EmploymentType enum and SOLE_PROPRIETOR to BorrowerType**

Locate the `BorrowerType` enum (line ~2366) and add `SOLE_PROPRIETOR`:

```prisma
enum BorrowerType {
  INDIVIDUAL
  CORPORATE
  JOINT
  SOLE_PROPRIETOR
}
```

After existing enums (before or after `EmploymentType` if it already exists), add:

```prisma
enum EmploymentType {
  SALARIED
  SELF_EMPLOYED
  COMMISSION_BASED
  PENSIONER
}
```

Locate the `DocumentClass` enum (line ~2493) and add missing values:

```prisma
enum DocumentClass {
  NRIC_PASSPORT
  MEMORANDUM_ARTICLES
  AUDITED_FINANCIALS
  MANAGEMENT_ACCOUNTS
  BANK_STATEMENT
  TAX_RETURN
  BUSINESS_PLAN
  CREDIT_BUREAU_REPORT
  VALUATION_REPORT
  INSURANCE_CERT
  BOARD_RESOLUTION
  AUTHORIZED_SIGNATORY
  GUARANTEE_LETTER
  PLEDGE_AGREEMENT
  SECURITY_DOCUMENT
  PAYSLIP              // NEW
  SSM_CERT             // NEW
  MOA_AOA              // NEW
  JV_AGREEMENT         // NEW
  OTHER
}
```

- [ ] **Step 2: Add RetailIncome model**

Add after the `QualitativeAssessment` model:

```prisma
// ============================================================================
// Retail Income — Wave 2 (individual borrower DSR assessment)
// ============================================================================
model RetailIncome {
  id                      String         @id @default(uuid()) @db.Uuid
  applicationId           String         @unique @map("application_id") @db.Uuid
  employmentType          EmploymentType @map("employment_type")
  employerName            String?        @map("employer_name") @db.VarChar(255)
  monthlyGrossIncome      Decimal        @map("monthly_gross_income") @db.Decimal(15, 2)
  epfMonthlyAmount        Decimal?       @map("epf_monthly_amount") @db.Decimal(15, 2)
  hirePurchaseCommitment  Decimal        @default(0) @map("hire_purchase_commitment") @db.Decimal(15, 2)
  creditCardCommitment    Decimal        @default(0) @map("credit_card_commitment") @db.Decimal(15, 2)
  existingLoanCommitment  Decimal        @default(0) @map("existing_loan_commitment") @db.Decimal(15, 2)
  otherCommitments        Decimal        @default(0) @map("other_commitments") @db.Decimal(15, 2)
  proposedInstalment      Decimal?       @map("proposed_instalment") @db.Decimal(15, 2)
  dsrPercent              Decimal?       @map("dsr_percent") @db.Decimal(5, 2)
  createdAt               DateTime       @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt               DateTime       @updatedAt @map("updated_at") @db.Timestamp(6)

  application CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@map("retail_incomes")
}
```

Add reverse relation on `CreditApplication`:
```prisma
  retailIncome RetailIncome?
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_retail_income_borrower_type_enums
```

Expected: clean migration, Prisma client regenerated.

- [ ] **Step 4: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(credit/w2): add RetailIncome model, EmploymentType enum, extend BorrowerType + DocumentClass"
```

---

### Task 7: Backend service — retailIncome.service.ts

**Files:**
- Create: `backend/src/credit/services/retailIncome.service.ts`
- Create: `backend/tests/credit/retailIncome.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/credit/retailIncome.service.test.ts`:

```typescript
import { computeDsr, upsertRetailIncome, getRetailIncome } from '../../src/credit/services/retailIncome.service';
import prisma from '../../src/utils/prisma';

jest.mock('../../src/utils/prisma', () => ({
  retailIncome: { upsert: jest.fn(), findUnique: jest.fn() },
}));

describe('computeDsr', () => {
  it('returns DSR as percentage of gross income', () => {
    const dsr = computeDsr({
      monthlyGrossIncome: 5000,
      hirePurchaseCommitment: 500,
      creditCardCommitment: 200,
      existingLoanCommitment: 0,
      otherCommitments: 0,
      proposedInstalment: 800,
    });
    // (500+200+0+0+800) / 5000 * 100 = 30
    expect(dsr).toBeCloseTo(30, 1);
  });

  it('returns 0 when income is 0 (avoids division by zero)', () => {
    const dsr = computeDsr({
      monthlyGrossIncome: 0,
      hirePurchaseCommitment: 0, creditCardCommitment: 0,
      existingLoanCommitment: 0, otherCommitments: 0, proposedInstalment: 0,
    });
    expect(dsr).toBe(0);
  });
});

describe('getDsrStatus', () => {
  it('returns pass for DSR ≤ 60', () => {
    const { getDsrStatus } = require('../../src/credit/services/retailIncome.service');
    expect(getDsrStatus(50)).toBe('pass');
    expect(getDsrStatus(60)).toBe('pass');
  });
  it('returns warning for DSR 61–70', () => {
    const { getDsrStatus } = require('../../src/credit/services/retailIncome.service');
    expect(getDsrStatus(65)).toBe('warning');
  });
  it('returns fail for DSR > 70', () => {
    const { getDsrStatus } = require('../../src/credit/services/retailIncome.service');
    expect(getDsrStatus(75)).toBe('fail');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest tests/credit/retailIncome.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create the service**

Create `backend/src/credit/services/retailIncome.service.ts`:

```typescript
import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface RetailIncomeInput {
  employmentType: 'SALARIED' | 'SELF_EMPLOYED' | 'COMMISSION_BASED' | 'PENSIONER';
  employerName?: string;
  monthlyGrossIncome: number;
  epfMonthlyAmount?: number;
  hirePurchaseCommitment?: number;
  creditCardCommitment?: number;
  existingLoanCommitment?: number;
  otherCommitments?: number;
  proposedInstalment?: number;
}

export interface DsrInput {
  monthlyGrossIncome: number;
  hirePurchaseCommitment: number;
  creditCardCommitment: number;
  existingLoanCommitment: number;
  otherCommitments: number;
  proposedInstalment: number;
}

export function computeDsr(input: DsrInput): number {
  if (input.monthlyGrossIncome <= 0) return 0;
  const totalObligations =
    (input.hirePurchaseCommitment || 0) +
    (input.creditCardCommitment || 0) +
    (input.existingLoanCommitment || 0) +
    (input.otherCommitments || 0) +
    (input.proposedInstalment || 0);
  return (totalObligations / input.monthlyGrossIncome) * 100;
}

export function getDsrStatus(dsrPercent: number): 'pass' | 'warning' | 'fail' {
  if (dsrPercent <= 60) return 'pass';
  if (dsrPercent <= 70) return 'warning';
  return 'fail';
}

export async function upsertRetailIncome(applicationId: string, input: RetailIncomeInput) {
  const dsr = computeDsr({
    monthlyGrossIncome: input.monthlyGrossIncome,
    hirePurchaseCommitment: input.hirePurchaseCommitment ?? 0,
    creditCardCommitment: input.creditCardCommitment ?? 0,
    existingLoanCommitment: input.existingLoanCommitment ?? 0,
    otherCommitments: input.otherCommitments ?? 0,
    proposedInstalment: input.proposedInstalment ?? 0,
  });

  const data = {
    employmentType: input.employmentType,
    employerName: input.employerName ?? null,
    monthlyGrossIncome: new Prisma.Decimal(input.monthlyGrossIncome),
    epfMonthlyAmount: input.epfMonthlyAmount != null ? new Prisma.Decimal(input.epfMonthlyAmount) : null,
    hirePurchaseCommitment: new Prisma.Decimal(input.hirePurchaseCommitment ?? 0),
    creditCardCommitment: new Prisma.Decimal(input.creditCardCommitment ?? 0),
    existingLoanCommitment: new Prisma.Decimal(input.existingLoanCommitment ?? 0),
    otherCommitments: new Prisma.Decimal(input.otherCommitments ?? 0),
    proposedInstalment: input.proposedInstalment != null ? new Prisma.Decimal(input.proposedInstalment) : null,
    dsrPercent: new Prisma.Decimal(Math.round(dsr * 100) / 100),
  };

  return prisma.retailIncome.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
}

export async function getRetailIncome(applicationId: string) {
  return prisma.retailIncome.findUnique({ where: { applicationId } });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/credit/retailIncome.service.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/retailIncome.service.ts backend/tests/credit/retailIncome.service.test.ts
git commit -m "feat(credit/w2): retail income service with DSR computation + tests"
```

---

### Task 8: Backend controller + route for RetailIncome

**Files:**
- Create: `backend/src/credit/controllers/retailIncome.controller.ts`
- Modify: same credit routes file as Task 3

- [ ] **Step 1: Create controller**

Create `backend/src/credit/controllers/retailIncome.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { upsertRetailIncome, getRetailIncome, getDsrStatus } from '../services/retailIncome.service';

export async function getRetailIncomeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const income = await getRetailIncome(req.params.applicationId);
    res.json({ data: income });
  } catch (err) { next(err); }
}

export async function upsertRetailIncomeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId } = req.params;
    const { employmentType, monthlyGrossIncome } = req.body;
    if (!employmentType || !monthlyGrossIncome) {
      return res.status(400).json({ error: 'employmentType and monthlyGrossIncome are required' });
    }
    const income = await upsertRetailIncome(applicationId, req.body);
    const dsrStatus = getDsrStatus(Number(income.dsrPercent));
    res.json({ data: { ...income, dsrStatus } });
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Register routes in the credit routes file**

```typescript
import { getRetailIncomeHandler, upsertRetailIncomeHandler } from '../controllers/retailIncome.controller';

router.get('/:applicationId/retail-income', getRetailIncomeHandler);
router.put('/:applicationId/retail-income', upsertRetailIncomeHandler);
```

- [ ] **Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/credit/controllers/retailIncome.controller.ts backend/src/credit/routes/
git commit -m "feat(credit/w2): retail income controller + routes"
```

---

### Task 9: Update submissionReadiness — per-type document gates

**Files:**
- Modify: `backend/src/credit/services/submissionReadiness.service.ts`
- Modify: `backend/tests/credit/submissionReadiness.service.test.ts` (create if it doesn't exist)

- [ ] **Step 1: Replace the hard-coded mandatory document check**

In `backend/src/credit/services/submissionReadiness.service.ts`, replace the Check 3 block (lines ~66–76):

```typescript
// OLD — replace this entire block:
  const mandatoryClasses = ['NRIC_PASSPORT', 'AUDITED_FINANCIALS'];
  for (const docClass of mandatoryClasses) {
    const hasDoc = application.documents.some((d) => d.classification === docClass);
    if (!hasDoc) {
      errors.push({
        field: 'documents',
        message: `Required document missing: ${docClass.replace('_', ' ')}`,
        severity: 'error',
      });
    }
  }
```

```typescript
// NEW:
  const mandatoryClasses = getRequiredDocuments(application.borrowerProfile.borrowerType as string);
  for (const docClass of mandatoryClasses) {
    const hasDoc = application.documents.some((d) => d.classification === docClass);
    if (!hasDoc) {
      errors.push({
        field: 'documents',
        message: `Required document missing: ${docClass.replace(/_/g, ' ')}`,
        severity: 'error',
      });
    }
  }
```

Also update the `prisma.creditApplication.findUnique` include to pull `borrowerProfile.borrowerType`:

```typescript
    include: {
      borrowerProfile: { select: { accountId: true, contactId: true, borrowerType: true } },
      // ...rest unchanged
    },
```

Add the `getRequiredDocuments` helper function at the top of the file (after imports):

```typescript
function getRequiredDocuments(borrowerType: string): string[] {
  switch (borrowerType) {
    case 'INDIVIDUAL':
      return ['NRIC_PASSPORT', 'PAYSLIP', 'BANK_STATEMENT'];
    case 'SOLE_PROPRIETOR':
      return ['NRIC_PASSPORT', 'SSM_CERT', 'BANK_STATEMENT'];
    case 'JOINT':
      return ['JV_AGREEMENT', 'AUDITED_FINANCIALS'];
    case 'CORPORATE':
    default:
      return ['SSM_CERT', 'AUDITED_FINANCIALS', 'MOA_AOA'];
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/services/submissionReadiness.service.ts
git commit -m "feat(credit/w2): per-borrower-type mandatory document gates in submission readiness"
```

---

### Task 10: Frontend — RetailIncomeTab and conditional S3 rendering

**Files:**
- Create: `frontend/pages/credit/tabs/RetailIncomeTab.tsx`
- Modify: `frontend/pages/credit/tabs/FinancialsTab.tsx`
- Modify: `frontend/src/services/credit.service.ts`

- [ ] **Step 1: Add API methods to credit.service.ts**

```typescript
export async function getRetailIncome(applicationId: string) {
  const res = await api.get(`/credit/applications/${applicationId}/retail-income`);
  return res.data.data as {
    employmentType: string;
    employerName?: string;
    monthlyGrossIncome: string;
    hirePurchaseCommitment: string;
    creditCardCommitment: string;
    existingLoanCommitment: string;
    otherCommitments: string;
    proposedInstalment?: string;
    dsrPercent?: string;
  } | null;
}

export async function upsertRetailIncome(applicationId: string, data: Record<string, unknown>) {
  const res = await api.put(`/credit/applications/${applicationId}/retail-income`, data);
  return res.data.data;
}
```

- [ ] **Step 2: Create RetailIncomeTab**

Create `frontend/pages/credit/tabs/RetailIncomeTab.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { getRetailIncome, upsertRetailIncome } from '@/src/services/credit.service';

interface Props {
  applicationId: string;
  readOnly?: boolean;
  onSaved?: () => void;
}

const EMPLOYMENT_TYPES = [
  { value: 'SALARIED', label: 'Salaried (Employed)' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'COMMISSION_BASED', label: 'Commission-Based' },
  { value: 'PENSIONER', label: 'Pensioner' },
];

function DsrBadge({ dsr }: { dsr: number }) {
  const status = dsr <= 60 ? 'pass' : dsr <= 70 ? 'warning' : 'fail';
  const styles = { pass: 'bg-green-100 text-green-700', warning: 'bg-yellow-100 text-yellow-700', fail: 'bg-red-100 text-red-700' };
  const labels = { pass: `DSR ${dsr.toFixed(1)}% — Pass`, warning: `DSR ${dsr.toFixed(1)}% — Warning (>60%)`, fail: `DSR ${dsr.toFixed(1)}% — Exceeds 70% limit` };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
}

export default function RetailIncomeTab({ applicationId, readOnly, onSaved }: Props) {
  const [form, setForm] = useState({
    employmentType: 'SALARIED',
    employerName: '',
    monthlyGrossIncome: '',
    epfMonthlyAmount: '',
    hirePurchaseCommitment: '',
    creditCardCommitment: '',
    existingLoanCommitment: '',
    otherCommitments: '',
    proposedInstalment: '',
  });
  const [dsr, setDsr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRetailIncome(applicationId).then(data => {
      if (data) {
        setForm({
          employmentType: data.employmentType,
          employerName: data.employerName ?? '',
          monthlyGrossIncome: data.monthlyGrossIncome,
          epfMonthlyAmount: '',
          hirePurchaseCommitment: data.hirePurchaseCommitment,
          creditCardCommitment: data.creditCardCommitment,
          existingLoanCommitment: data.existingLoanCommitment,
          otherCommitments: data.otherCommitments,
          proposedInstalment: data.proposedInstalment ?? '',
        });
        if (data.dsrPercent) setDsr(Number(data.dsrPercent));
      }
      setLoading(false);
    });
  }, [applicationId]);

  // Compute DSR live
  useEffect(() => {
    const gross = Number(form.monthlyGrossIncome) || 0;
    if (gross <= 0) { setDsr(null); return; }
    const total =
      (Number(form.hirePurchaseCommitment) || 0) +
      (Number(form.creditCardCommitment) || 0) +
      (Number(form.existingLoanCommitment) || 0) +
      (Number(form.otherCommitments) || 0) +
      (Number(form.proposedInstalment) || 0);
    setDsr(Math.round((total / gross * 100) * 10) / 10);
  }, [form.monthlyGrossIncome, form.hirePurchaseCommitment, form.creditCardCommitment, form.existingLoanCommitment, form.otherCommitments, form.proposedInstalment]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertRetailIncome(applicationId, {
        ...form,
        monthlyGrossIncome: Number(form.monthlyGrossIncome),
        epfMonthlyAmount: form.epfMonthlyAmount ? Number(form.epfMonthlyAmount) : undefined,
        hirePurchaseCommitment: Number(form.hirePurchaseCommitment) || 0,
        creditCardCommitment: Number(form.creditCardCommitment) || 0,
        existingLoanCommitment: Number(form.existingLoanCommitment) || 0,
        otherCommitments: Number(form.otherCommitments) || 0,
        proposedInstalment: form.proposedInstalment ? Number(form.proposedInstalment) : undefined,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'number', prefix?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-2 text-sm text-gray-400">{prefix}</span>}
        <input
          type={type}
          value={form[key]}
          disabled={readOnly}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          className={`w-full border rounded-md px-3 py-2 text-sm ${prefix ? 'pl-8' : ''} disabled:bg-gray-50`}
          min={0}
        />
      </div>
    </div>
  );

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6 p-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Retail Income Assessment</h3>
        {dsr !== null && <DsrBadge dsr={dsr} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Employment Type</label>
          <select
            value={form.employmentType}
            disabled={readOnly}
            onChange={e => setForm(prev => ({ ...prev, employmentType: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
          >
            {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {field('Employer Name', 'employerName', 'text')}
        {field('Monthly Gross Income (MYR)', 'monthlyGrossIncome', 'number', 'RM')}
        {field('EPF Monthly Contribution (MYR)', 'epfMonthlyAmount', 'number', 'RM')}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Commitments</h4>
        <div className="grid grid-cols-2 gap-4">
          {field('Hire Purchase / Car Loans', 'hirePurchaseCommitment', 'number', 'RM')}
          {field('Credit Card (min. payment)', 'creditCardCommitment', 'number', 'RM')}
          {field('Existing Personal Loans', 'existingLoanCommitment', 'number', 'RM')}
          {field('Other Obligations', 'otherCommitments', 'number', 'RM')}
          {field('Proposed Monthly Instalment', 'proposedInstalment', 'number', 'RM')}
        </div>
      </div>

      {dsr !== null && dsr > 60 && (
        <div className={`rounded-md p-3 text-sm ${dsr > 70 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {dsr > 70
            ? 'DSR exceeds 70% — submission is blocked. Reduce commitments or increase income, or obtain credit manager override.'
            : 'DSR is between 60–70% — submission requires a documented exception reason.'}
        </div>
      )}

      {!readOnly && (
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Income Assessment'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update FinancialsTab to branch on borrower type**

In `frontend/pages/credit/tabs/FinancialsTab.tsx`, find the props/component signature and add borrower type awareness. The exact approach depends on what props FinancialsTab already receives — check what data the parent passes.

Add an import at the top:
```tsx
import RetailIncomeTab from './RetailIncomeTab';
```

In the component body, wrap the existing JSX:

```tsx
// Add this check at the top of the render (assuming `borrowerType` is available as a prop or from a context/hook)
if (borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') {
  return <RetailIncomeTab applicationId={applicationId} readOnly={readOnly} onSaved={onRefresh} />;
}
// existing FinancialsTab JSX below...
```

If `borrowerType` is not already passed to FinancialsTab, check how `CreditApplicationDetail.tsx` passes props to tab components and add `borrowerType` to FinancialsTab's props interface.

- [ ] **Step 4: Update getPhaseCompletion to handle retail S3**

In `frontend/pages/credit/creditUtils.ts`, add `retailIncome` to the `getPhaseCompletion` input shape and update the `s3` check:

```typescript
// In the function signature, add:
  retailIncome?: { monthlyGrossIncome?: unknown } | null;
  borrowerType?: string | null;
```

Update the `s3` line:
```typescript
    s3: (
      (app.borrowerType === 'INDIVIDUAL' || app.borrowerType === 'SOLE_PROPRIETOR')
        ? (app.retailIncome != null && app.retailIncome.monthlyGrossIncome != null)
        : (app.financialStatements && app.financialStatements.length > 0)
    ) ? 'complete' : 'incomplete',
```

Also make sure the `CreditApplicationDetail.tsx` query includes `retailIncome` in its application fetch so that `getPhaseCompletion` has the data.

- [ ] **Step 5: Visual smoke test**

Start frontend dev server. Open a credit application for an INDIVIDUAL borrower. Verify:
- S3 tab shows "Retail Income Assessment" form instead of the financial spreader
- DSR updates live as you type in commitment fields
- DSR badge changes color at 60% and 70%

For a CORPORATE borrower, verify S3 still shows the financial statement spreader.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/credit/tabs/RetailIncomeTab.tsx frontend/pages/credit/tabs/FinancialsTab.tsx frontend/pages/credit/creditUtils.ts frontend/src/services/credit.service.ts
git commit -m "feat(credit/w2): retail income form in S3, DSR computation, phase completion update"
```

---

### Task 11: DocumentsTab — filter by borrower type

**Files:**
- Modify: `frontend/pages/credit/tabs/DocumentsTab.tsx`

- [ ] **Step 1: Find how document categories are rendered**

```bash
grep -n "classification\|DocumentClass\|NRIC\|AUDITED\|upload" frontend/pages/credit/tabs/DocumentsTab.tsx | head -20
```

Note how the category list is built — it may be a static array or come from an API.

- [ ] **Step 2: Add per-type document category filtering**

In `DocumentsTab.tsx`, add a helper and filter the upload category options. Assuming the component receives `borrowerType` as a prop (add to props interface if not):

```tsx
const DOCUMENT_CATEGORIES_BY_BORROWER_TYPE: Record<string, string[]> = {
  INDIVIDUAL: ['NRIC_PASSPORT', 'PAYSLIP', 'BANK_STATEMENT', 'TAX_RETURN', 'OTHER'],
  SOLE_PROPRIETOR: ['NRIC_PASSPORT', 'SSM_CERT', 'BANK_STATEMENT', 'TAX_RETURN', 'OTHER'],
  JOINT: ['JV_AGREEMENT', 'AUDITED_FINANCIALS', 'MANAGEMENT_ACCOUNTS', 'BANK_STATEMENT', 'OTHER'],
  CORPORATE: ['SSM_CERT', 'AUDITED_FINANCIALS', 'MOA_AOA', 'MANAGEMENT_ACCOUNTS', 'BANK_STATEMENT', 'BOARD_RESOLUTION', 'OTHER'],
};

function getDocumentCategories(borrowerType?: string): string[] {
  return DOCUMENT_CATEGORIES_BY_BORROWER_TYPE[borrowerType ?? 'CORPORATE'] ?? DOCUMENT_CATEGORIES_BY_BORROWER_TYPE['CORPORATE'];
}
```

Use `getDocumentCategories(borrowerType)` wherever the upload form renders the classification dropdown/options.

- [ ] **Step 3: Visual test**

Open a credit application for INDIVIDUAL borrower → Documents tab. Verify the upload category dropdown shows `NRIC Passport`, `Payslip`, `Bank Statement` — not `Audited Financials` or `MOA/AOA`.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/credit/tabs/DocumentsTab.tsx
git commit -m "feat(credit/w2): filter document upload categories by borrower type"
```

---

## Wave 3 — Bureau & Compliance Uplift

### Task 12: Prisma — Extend CreditBureauCheck + add BureauChecklist

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Extend CreditBureauCheck with structured fields**

Locate the `CreditBureauCheck` model (line ~4224) and add structured fields before `createdAt`:

```prisma
model CreditBureauCheck {
  id            String         @id @default(uuid()) @db.Uuid
  applicationId String         @map("application_id") @db.Uuid
  provider      BureauProvider
  subjectName   String?        @map("subject_name") @db.VarChar(255)
  runDate       DateTime?      @map("run_date") @db.Date
  runById       String?        @map("run_by_id") @db.Uuid
  hasHits       Boolean?       @map("has_hits")
  findings      String?        @db.Text
  attachedDocId String?        @map("attached_doc_id") @db.Uuid

  // CCRIS structured fields (Wave 3)
  ccrisOutstandingFacilities   Int?     @map("ccris_outstanding_facilities")
  ccrisTotalOutstandingBalance Decimal? @map("ccris_total_outstanding_balance") @db.Decimal(15, 2)
  ccrisSaaFlag                 Boolean  @default(false) @map("ccris_saa_flag")
  ccrisSaaCount                Int?     @map("ccris_saa_count")
  ccrisMissedPayments12Months  Int?     @map("ccris_missed_payments_12_months")
  ccrisBankruptcyFlag          Boolean  @default(false) @map("ccris_bankruptcy_flag")
  ccrisLegalActionFlag         Boolean  @default(false) @map("ccris_legal_action_flag")
  ccrisReportDate              DateTime? @map("ccris_report_date") @db.Date

  // CTOS structured fields (Wave 3)
  ctosScore          Int?     @map("ctos_score")
  ctosAdverseFlag    Boolean  @default(false) @map("ctos_adverse_flag")
  ctosAdverseDetails String?  @map("ctos_adverse_details") @db.Text
  ctosBankruptcyFlag Boolean  @default(false) @map("ctos_bankruptcy_flag")
  ctosDirectorshipsCount Int? @map("ctos_directorships_count")
  ctosReportDate     DateTime? @map("ctos_report_date") @db.Date

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  runBy       User?             @relation("BureauCheckRunBy", fields: [runById], references: [id])

  @@index([applicationId])
  @@map("credit_bureau_checks")
}
```

- [ ] **Step 2: Add BureauChecklist model**

Add after `CreditBureauCheck`:

```prisma
// ============================================================================
// Bureau Checklist — Wave 3 (S5 completion gate)
// ============================================================================
model BureauChecklist {
  id            String   @id @default(uuid()) @db.Uuid
  applicationId String   @unique @map("application_id") @db.Uuid
  ccrisUploaded Boolean  @default(false) @map("ccris_uploaded")
  ctosUploaded  Boolean  @default(false) @map("ctos_uploaded")
  noAdverseRecord Boolean @default(false) @map("no_adverse_record")
  adverseExceptionReason String? @map("adverse_exception_reason") @db.Text
  amlScreeningDone Boolean @default(false) @map("aml_screening_done")
  tickedById    String?  @map("ticked_by_id") @db.Uuid
  tickedAt      DateTime? @map("ticked_at") @db.Timestamp(6)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  tickedBy    User?             @relation(fields: [tickedById], references: [id])

  @@map("bureau_checklists")
}
```

Add reverse relations on `CreditApplication`:
```prisma
  bureauChecklist BureauChecklist?
```

On `User`:
```prisma
  bureauChecklists BureauChecklist[]
```

- [ ] **Step 3: Extend CreditScoreRun with bureau cap fields**

In the `CreditScoreRun` model, add before `createdAt`:

```prisma
  baseRiskRating   RiskRating? @map("base_risk_rating")   // score before bureau caps
  bureauCapsApplied Json?      @map("bureau_caps_applied") // which caps were triggered
```

- [ ] **Step 4: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_bureau_structured_fields_and_checklist
```

Expected: clean migration.

- [ ] **Step 5: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(credit/w3): extend CreditBureauCheck, add BureauChecklist, add score cap fields to CreditScoreRun"
```

---

### Task 13: bureauCheck.service.ts + bureau rating caps in scoring

**Files:**
- Create: `backend/src/credit/services/bureauCheck.service.ts`
- Create: `backend/tests/credit/bureauCheck.service.test.ts`
- Create: `backend/tests/credit/scoring.service.wave3.test.ts`
- Modify: `backend/src/credit/services/scoring.service.ts`

- [ ] **Step 1: Write failing tests for bureau caps**

Create `backend/tests/credit/bureauCheck.service.test.ts`:

```typescript
import { applyBureauCaps, BureauCapInput, RATING_ORDER } from '../../src/credit/services/bureauCheck.service';

describe('RATING_ORDER', () => {
  it('has AAA at position 0 (highest)', () => expect(RATING_ORDER.indexOf('AAA')).toBe(0));
  it('has D at last position (lowest)', () => expect(RATING_ORDER.indexOf('D')).toBe(RATING_ORDER.length - 1));
});

describe('applyBureauCaps', () => {
  it('returns base rating unchanged when no adverse findings', () => {
    const result = applyBureauCaps('A', []);
    expect(result.effectiveRating).toBe('A');
    expect(result.capsApplied).toHaveLength(0);
  });

  it('caps to BBB when CCRIS SAA flag is set', () => {
    const input: BureauCapInput[] = [{ reason: 'ccris_saa', maxRating: 'BBB' }];
    const result = applyBureauCaps('AA', input);
    expect(result.effectiveRating).toBe('BBB');
    expect(result.capsApplied).toContain('ccris_saa');
  });

  it('caps to lowest when multiple caps apply', () => {
    const input: BureauCapInput[] = [
      { reason: 'ccris_saa', maxRating: 'BBB' },
      { reason: 'ctos_adverse', maxRating: 'BB' },
    ];
    const result = applyBureauCaps('AAA', input);
    expect(result.effectiveRating).toBe('BB');
  });

  it('does not upgrade — cap only restricts downward', () => {
    const input: BureauCapInput[] = [{ reason: 'ccris_missed_3', maxRating: 'BB' }];
    const result = applyBureauCaps('CCC', input);
    expect(result.effectiveRating).toBe('CCC'); // already below cap
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest tests/credit/bureauCheck.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create bureauCheck.service.ts**

Create `backend/src/credit/services/bureauCheck.service.ts`:

```typescript
import prisma from '../../utils/prisma';
import { RiskRating } from '@prisma/client';

export const RATING_ORDER: RiskRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'];

export interface BureauCapInput {
  reason: string;
  maxRating: RiskRating;
}

export interface BureauCapResult {
  effectiveRating: RiskRating;
  capsApplied: string[];
}

export function applyBureauCaps(baseRating: RiskRating, caps: BureauCapInput[]): BureauCapResult {
  let effectiveIdx = RATING_ORDER.indexOf(baseRating);
  const capsApplied: string[] = [];

  for (const cap of caps) {
    const capIdx = RATING_ORDER.indexOf(cap.maxRating);
    if (capIdx > effectiveIdx) {  // cap is stricter (lower rating = higher index)
      effectiveIdx = capIdx;
      capsApplied.push(cap.reason);
    }
  }

  return { effectiveRating: RATING_ORDER[effectiveIdx], capsApplied };
}

export async function getBureauCapsForApplication(applicationId: string): Promise<BureauCapInput[]> {
  const checks = await prisma.creditBureauCheck.findMany({
    where: { applicationId },
  });

  const caps: BureauCapInput[] = [];

  for (const check of checks) {
    // CCRIS caps
    if (check.ccrisSaaFlag) caps.push({ reason: 'ccris_saa', maxRating: 'BBB' });
    if ((check.ccrisMissedPayments12Months ?? 0) >= 3) caps.push({ reason: 'ccris_missed_3', maxRating: 'BB' });
    if (check.ccrisLegalActionFlag) caps.push({ reason: 'ccris_legal_action', maxRating: 'B' });
    if (check.ccrisBankruptcyFlag) caps.push({ reason: 'ccris_bankruptcy', maxRating: 'C' });

    // CTOS caps
    if (check.ctosAdverseFlag) caps.push({ reason: 'ctos_adverse', maxRating: 'BB' });
    if (check.ctosBankruptcyFlag) caps.push({ reason: 'ctos_bankruptcy', maxRating: 'C' });
    const ctosScore = check.ctosScore;
    if (ctosScore !== null && ctosScore !== undefined) {
      if (ctosScore < 300) caps.push({ reason: 'ctos_score_lt_300', maxRating: 'B' });
      else if (ctosScore < 500) caps.push({ reason: 'ctos_score_lt_500', maxRating: 'BB' });
    }
  }

  return caps;
}

export async function isBureauCheckFresh(applicationId: string): Promise<{ fresh: boolean; staleProviders: string[] }> {
  const checks = await prisma.creditBureauCheck.findMany({ where: { applicationId } });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const staleProviders: string[] = [];
  for (const check of checks) {
    const reportDate = check.ccrisReportDate ?? check.ctosReportDate ?? check.runDate;
    if (!reportDate || reportDate < cutoff) {
      staleProviders.push(check.provider);
    }
  }

  return { fresh: staleProviders.length === 0, staleProviders };
}

export async function upsertBureauChecklist(
  applicationId: string,
  userId: string,
  data: {
    ccrisUploaded?: boolean;
    ctosUploaded?: boolean;
    noAdverseRecord?: boolean;
    adverseExceptionReason?: string;
    amlScreeningDone?: boolean;
  },
) {
  return prisma.bureauChecklist.upsert({
    where: { applicationId },
    create: { applicationId, tickedById: userId, tickedAt: new Date(), ...data },
    update: { tickedById: userId, tickedAt: new Date(), ...data },
  });
}

export async function getBureauChecklist(applicationId: string) {
  return prisma.bureauChecklist.findUnique({ where: { applicationId } });
}

export async function isBureauChecklistComplete(applicationId: string): Promise<boolean> {
  const checklist = await getBureauChecklist(applicationId);
  if (!checklist) return false;
  return (
    checklist.ccrisUploaded &&
    checklist.ctosUploaded &&
    checklist.amlScreeningDone &&
    (checklist.noAdverseRecord || Boolean(checklist.adverseExceptionReason))
  );
}
```

- [ ] **Step 4: Run bureau test to verify it passes**

```bash
cd backend && npx jest tests/credit/bureauCheck.service.test.ts --no-coverage
```

Expected: PASS (5 tests).

- [ ] **Step 5: Wire bureau caps into scoring.service.ts**

In `scoring.service.ts`, add import at top:

```typescript
import { getBureauCapsForApplication, applyBureauCaps } from './bureauCheck.service';
```

In `executeScore`, after Step 8 (map totalScore to riskRating) and before Step 9 (create CreditScoreRun), add:

```typescript
    // Step 8b: Apply bureau rating caps
    const bureauCaps = await getBureauCapsForApplication(applicationId);
    const baseRiskRating = riskRating;
    const { effectiveRating, capsApplied } = applyBureauCaps(riskRating, bureauCaps);
    const effectiveRiskRating = effectiveRating;
```

In Step 9, update the `prisma.creditScoreRun.create` data to include cap fields:

```typescript
      data: {
        applicationId,
        scorecardVersionId: scorecardVersion.id,
        factorScores: factorScores as any,
        totalScore: new Prisma.Decimal(totalScore),
        riskRating: effectiveRiskRating,      // effective (post-cap) rating
        baseRiskRating: baseRiskRating,        // base (pre-cap) rating
        bureauCapsApplied: capsApplied.length > 0 ? capsApplied : null,
        isOverride: false,
        runAt: new Date(),
      },
```

Update Step 10 return to include `baseRiskRating`:

```typescript
    return {
      scoreRun,
      factorScores,
      totalScore,
      riskRating: effectiveRiskRating,
      baseRiskRating,
      bureauCapsApplied: capsApplied,
    };
```

Also update `ScoreResult` interface at top of file:

```typescript
export interface ScoreResult {
  scoreRun: any;
  factorScores: FactorScores;
  totalScore: number;
  riskRating: RiskRating;
  baseRiskRating: RiskRating;
  bureauCapsApplied: string[];
}
```

- [ ] **Step 6: Write wave 3 scoring test**

Create `backend/tests/credit/scoring.service.wave3.test.ts`:

```typescript
import { applyBureauCaps, RATING_ORDER } from '../../src/credit/services/bureauCheck.service';

describe('applyBureauCaps — integration with scoring', () => {
  it('CTOS score 250 caps at B', () => {
    const { effectiveRating } = applyBureauCaps('AA', [{ reason: 'ctos_score_lt_300', maxRating: 'B' }]);
    expect(effectiveRating).toBe('B');
  });

  it('bankruptcy flag caps at C regardless of base', () => {
    const { effectiveRating } = applyBureauCaps('AAA', [
      { reason: 'ccris_bankruptcy', maxRating: 'C' },
      { reason: 'ctos_bankruptcy', maxRating: 'C' },
    ]);
    expect(effectiveRating).toBe('C');
  });
});
```

```bash
cd backend && npx jest tests/credit/scoring.service.wave3.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 7: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/credit/services/bureauCheck.service.ts backend/src/credit/services/scoring.service.ts backend/tests/credit/bureauCheck.service.test.ts backend/tests/credit/scoring.service.wave3.test.ts
git commit -m "feat(credit/w3): bureau rating caps wired into scoring engine + tests"
```

---

### Task 14: Bureau checklist controller + route + submission gate update

**Files:**
- Create: `backend/src/credit/controllers/bureauCheck.controller.ts`
- Modify: `backend/src/credit/routes/` (same routes file as before)
- Modify: `backend/src/credit/services/submissionReadiness.service.ts`

- [ ] **Step 1: Create controller**

Create `backend/src/credit/controllers/bureauCheck.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { upsertBureauChecklist, getBureauChecklist } from '../services/bureauCheck.service';
import prisma from '../../utils/prisma';

export async function getBureauChecklistHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const checklist = await getBureauChecklist(req.params.applicationId);
    res.json({ data: checklist });
  } catch (err) { next(err); }
}

export async function upsertBureauChecklistHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const checklist = await upsertBureauChecklist(req.params.applicationId, userId, req.body);
    res.json({ data: checklist });
  } catch (err) { next(err); }
}

export async function updateBureauCheckStructuredHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId, checkId } = req.params;
    const updated = await prisma.creditBureauCheck.update({
      where: { id: checkId },
      data: req.body,
    });
    res.json({ data: updated });
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Register routes**

```typescript
import {
  getBureauChecklistHandler,
  upsertBureauChecklistHandler,
  updateBureauCheckStructuredHandler,
} from '../controllers/bureauCheck.controller';

router.get('/:applicationId/bureau-checklist', getBureauChecklistHandler);
router.put('/:applicationId/bureau-checklist', upsertBureauChecklistHandler);
router.patch('/:applicationId/bureau-checks/:checkId', updateBureauCheckStructuredHandler);
```

- [ ] **Step 3: Add bureau freshness gate to submissionReadiness**

In `submissionReadiness.service.ts`, add import at top:

```typescript
import { isBureauCheckFresh, isBureauChecklistComplete } from './bureauCheck.service';
```

Add before the final `return` statement (after Check 7):

```typescript
  // ---- Check 8: Bureau report freshness ----
  const freshnessCheck = await isBureauCheckFresh(applicationId);
  if (!freshnessCheck.fresh) {
    errors.push({
      field: 'bureauChecks',
      message: `Bureau reports from these providers are older than 90 days and must be refreshed: ${freshnessCheck.staleProviders.join(', ')}`,
      severity: 'error',
    });
  }

  // ---- Check 9: Bureau checklist completion ----
  const bureauComplete = await isBureauChecklistComplete(applicationId);
  if (!bureauComplete) {
    errors.push({
      field: 'bureauChecklist',
      message: 'Bureau checklist is incomplete — all items must be ticked before submission',
      severity: 'error',
    });
  }
```

- [ ] **Step 4: Update S5 phase completion in creditUtils.ts**

Add `bureauChecklist` to `getPhaseCompletion`'s input type and update the `s5` check:

```typescript
// Add to input shape:
  bureauChecklist?: {
    ccrisUploaded?: boolean;
    ctosUploaded?: boolean;
    noAdverseRecord?: boolean;
    adverseExceptionReason?: string | null;
    amlScreeningDone?: boolean;
  } | null;
```

Update `s5`:
```typescript
    s5: (() => {
      const cl = app.bureauChecklist;
      if (!cl) return false;
      return (
        Boolean(cl.ccrisUploaded) &&
        Boolean(cl.ctosUploaded) &&
        Boolean(cl.amlScreeningDone) &&
        (Boolean(cl.noAdverseRecord) || Boolean(cl.adverseExceptionReason))
      );
    })() ? 'complete' : 'incomplete',
```

Make sure `CreditApplicationDetail.tsx` includes `bureauChecklist` in the application fetch.

- [ ] **Step 5: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/credit/controllers/bureauCheck.controller.ts backend/src/credit/routes/ backend/src/credit/services/submissionReadiness.service.ts frontend/pages/credit/creditUtils.ts
git commit -m "feat(credit/w3): bureau checklist controller, freshness gate in submission readiness, S5 phase completion update"
```

---

### Task 15: Frontend — CreditChecksTab structured bureau form + checklist

**Files:**
- Modify: `frontend/pages/credit/tabs/CreditChecksTab.tsx`
- Modify: `frontend/src/services/credit.service.ts`

- [ ] **Step 1: Add API methods**

In `frontend/src/services/credit.service.ts` add:

```typescript
export async function getBureauChecklist(applicationId: string) {
  const res = await api.get(`/credit/applications/${applicationId}/bureau-checklist`);
  return res.data.data;
}

export async function upsertBureauChecklist(applicationId: string, data: Record<string, unknown>) {
  const res = await api.put(`/credit/applications/${applicationId}/bureau-checklist`, data);
  return res.data.data;
}

export async function updateBureauCheckStructured(applicationId: string, checkId: string, data: Record<string, unknown>) {
  const res = await api.patch(`/credit/applications/${applicationId}/bureau-checks/${checkId}`, data);
  return res.data.data;
}
```

- [ ] **Step 2: Update CreditChecksTab with structured form + checklist**

In `frontend/pages/credit/tabs/CreditChecksTab.tsx`:

1. Import new API methods:
```tsx
import { getBureauChecklist, upsertBureauChecklist, updateBureauCheckStructured } from '@/src/services/credit.service';
```

2. Add state for `checklist` alongside existing state:
```tsx
const [checklist, setChecklist] = useState({
  ccrisUploaded: false, ctosUploaded: false, noAdverseRecord: false,
  adverseExceptionReason: '', amlScreeningDone: false,
});
```

3. Load checklist on mount alongside existing data:
```tsx
getBureauChecklist(applicationId).then(data => {
  if (data) setChecklist({
    ccrisUploaded: data.ccrisUploaded ?? false,
    ctosUploaded: data.ctosUploaded ?? false,
    noAdverseRecord: data.noAdverseRecord ?? false,
    adverseExceptionReason: data.adverseExceptionReason ?? '',
    amlScreeningDone: data.amlScreeningDone ?? false,
  });
});
```

4. For each bureau check row in the existing list, add an "Edit Findings" expandable section that shows CCRIS or CTOS fields (depending on `check.provider`). For CCRIS:

```tsx
{expandedCheckId === check.id && (
  <div className="mt-3 p-3 bg-gray-50 rounded space-y-3">
    <h4 className="text-xs font-semibold text-gray-600 uppercase">CCRIS Structured Data</h4>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={ccrisData.ccrisSaaFlag} onChange={...} />
        SAA Account Present
      </label>
      <div>
        <span className="text-xs text-gray-500">Missed Payments (12mo)</span>
        <input type="number" min={0} max={12} value={ccrisData.ccrisMissedPayments12Months ?? ''} onChange={...} className="ml-2 w-16 border rounded px-1 py-0.5 text-sm" />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={ccrisData.ccrisBankruptcyFlag} onChange={...} />
        Bankruptcy / Legal Action
      </label>
      <div>
        <span className="text-xs text-gray-500">Report Date</span>
        <input type="date" value={ccrisData.ccrisReportDate ?? ''} onChange={...} className="ml-2 border rounded px-1 py-0.5 text-sm" />
      </div>
    </div>
    <button onClick={() => saveCheckStructured(check.id)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Save</button>
  </div>
)}
```

For CTOS (inside same toggle, branched on `check.provider === 'CTOS'`):

```tsx
<div className="grid grid-cols-2 gap-3 text-sm">
  <div>
    <span className="text-xs text-gray-500">CTOS Score (0–1000)</span>
    <input type="number" min={0} max={1000} value={ctosData.ctosScore ?? ''} onChange={...} className="ml-2 w-20 border rounded px-1 py-0.5 text-sm" />
  </div>
  <label className="flex items-center gap-2">
    <input type="checkbox" checked={ctosData.ctosAdverseFlag} onChange={...} />
    Adverse Record
  </label>
  <label className="flex items-center gap-2">
    <input type="checkbox" checked={ctosData.ctosBankruptcyFlag} onChange={...} />
    Bankruptcy
  </label>
  <div>
    <span className="text-xs text-gray-500">Report Date</span>
    <input type="date" value={ctosData.ctosReportDate ?? ''} onChange={...} className="ml-2 border rounded px-1 py-0.5 text-sm" />
  </div>
</div>
```

5. Add checklist panel below the bureau checks list:

```tsx
<div className="mt-6 border-t pt-4">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">S5 Completion Checklist</h3>
  <div className="space-y-2">
    {[
      { key: 'ccrisUploaded', label: 'CCRIS report uploaded (dated within 90 days)' },
      { key: 'ctosUploaded', label: 'CTOS report uploaded (dated within 90 days)' },
      { key: 'amlScreeningDone', label: 'AML / sanctions name-screening completed' },
      { key: 'noAdverseRecord', label: 'No unresolved adverse records (or exception documented below)' },
    ].map(item => (
      <label key={item.key} className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={checklist[item.key as keyof typeof checklist] as boolean}
          disabled={readOnly}
          onChange={e => {
            const updated = { ...checklist, [item.key]: e.target.checked };
            setChecklist(updated);
            upsertBureauChecklist(applicationId, updated);
          }}
          className="mt-0.5"
        />
        {item.label}
      </label>
    ))}
    {!checklist.noAdverseRecord && (
      <div className="mt-2">
        <label className="block text-xs text-gray-500 mb-1">Exception reason (required if adverse record present)</label>
        <textarea
          value={checklist.adverseExceptionReason}
          disabled={readOnly}
          onChange={e => setChecklist(prev => ({ ...prev, adverseExceptionReason: e.target.value }))}
          onBlur={() => upsertBureauChecklist(applicationId, checklist)}
          rows={2}
          className="w-full border rounded px-3 py-1.5 text-sm"
        />
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 3: Visual smoke test**

Start frontend dev server. Navigate to a credit application → S5 tab (Credit Checks). Verify:
- Existing bureau checks render as before
- Each check row has an expand toggle that shows the structured CCRIS/CTOS form
- Checklist section at the bottom has 4 checkboxes
- S5 phase indicator only shows "complete" after all checklist items are ticked

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/credit/tabs/CreditChecksTab.tsx frontend/src/services/credit.service.ts
git commit -m "feat(credit/w3): structured CCRIS/CTOS form + S5 completion checklist in CreditChecksTab"
```

---

### Task 16: Retail scoring weight set (Wave 2 gap — spec §2D)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/credit/services/scoring.service.ts`

- [ ] **Step 1: Add retailFactorWeights field to CreditScorecardVersion**

Locate the `CreditScorecardVersion` model (line ~3811) and add after `factorWeights`:

```prisma
  retailFactorWeights Json? @map("retail_factor_weights")
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_retail_factor_weights
```

- [ ] **Step 3: Update scoring.service.ts to select weight set by borrowerType**

In `executeScore`, after fetching `application.borrowerProfileId`, also fetch `borrowerType`:

```typescript
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: {
        borrowerProfileId: true,
        borrowerProfile: { select: { borrowerType: true } },
      },
    });
```

In Step 5 where `factorWeights` is read from the scorecard version, replace:

```typescript
// OLD:
    const factorWeights: FactorWeights = scorecardVersion.factorWeights as any;
```

```typescript
// NEW:
    const isRetail = application.borrowerProfile.borrowerType === 'INDIVIDUAL' ||
                     application.borrowerProfile.borrowerType === 'SOLE_PROPRIETOR';
    const factorWeights: FactorWeights = isRetail && scorecardVersion.retailFactorWeights
      ? (scorecardVersion.retailFactorWeights as any)
      : (scorecardVersion.factorWeights as any);
```

This means retail applications use `retailFactorWeights` when configured (admin can set via scorecard admin UI), and fall back to default weights when not. No migration of existing data needed — existing scorecards have no `retailFactorWeights` so they fall back gracefully.

- [ ] **Step 4: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/ backend/src/credit/services/scoring.service.ts
git commit -m "feat(credit/w2): retail factor weight set on CreditScorecardVersion, weight selection by borrowerType"
```

---

### Task 18: Full test run + cleanup

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && npm test -- --no-coverage
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 2: Typecheck frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run backend linter**

```bash
cd backend && npm run lint
```

Expected: 0 errors (fix any reported issues).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(credit): non-bank lending improvements — Wave 1 scoring, Wave 2 retail bifurcation, Wave 3 bureau uplift"
```
