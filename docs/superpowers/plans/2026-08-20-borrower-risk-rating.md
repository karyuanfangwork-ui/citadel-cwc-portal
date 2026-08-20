# Borrower-Level Risk Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every borrower an automatically derived, immutable, auditable risk rating that no operator has to trigger by hand, and close the two borrower identity-validation holes in the same change.

**Architecture:** A new `BORROWER`-scoped `CreditScorecard` reuses the existing versioning, rating-band and admin machinery. Seven pure factor functions derive scores from borrower data only; a pure compute function weights them, applies missing-data policy, a data-coverage floor and hard compliance caps; an impure orchestrator persists an immutable `BorrowerRiskRun` and denormalises the grade onto `BorrowerProfile`. Seven existing write paths dispatch a non-blocking recalculation. Nothing reads the rating as a gate.

**Tech Stack:** Node 20 + Express + TypeScript, Prisma + PostgreSQL, Jest (`ts-jest`, `forceExit: true`), React 19 + Vite, Zod.

**Spec:** `docs/superpowers/specs/2026-08-20-borrower-risk-rating-design.md`

## Global Constraints

- **Polarity is higher = better**, 0–100, matching the application scorecard. Never invert.
- **Borrower factor weights must sum to exactly 100**: `financial_standing` 20, `repayment_capacity` 20, `bureau_conduct` 20, `identity_kyc` 15, `industry_risk` 10, `relationship_tenure` 10, `compliance_screening` 5.
- **Caps only ever worsen a rating**, never improve it.
- **A borrower-risk failure must never block a borrower write.** Every failure path is fail-soft.
- **No existing gate may read the borrower rating.** Do not touch `approvalMatrix.service`, `approvalAction.service`, `submissionReadiness.service`, or the board-band logic.
- **Every existing `CreditScorecard` row defaults to `scope = APPLICATION`.** Application scoring behaviour must be byte-identical after deploy.
- **A factor function returning `null` means "no source data".** A factor never invents a number; missing-data policy owns that decision.
- **Data-coverage floor:** if factors with real data cover `< 50%` of total weight, the effective rating is `NR` with reason code `INSUFFICIENT_DATA`.
- **Thresholds** come from `getNumberPolicy` under the `borrower_risk.*` key prefix, never hardcoded at call sites.
- Run backend tests from `backend/`. Single file: `npx jest <path> --silent`.

## Open Policy Items (do not block the build)

These need credit-policy sign-off before the borrower scorecard is activated in production. Build to the values in this plan; flag them at Task 17.

1. The seven weights above. `bureau_conduct` at 20 assumes bureau data is reliably present; if it usually is not, that weight mostly flows through missing-data policy.
2. `amlRiskTier = HIGH` capping at `BB`. `PROHIBITED` and sanctioned capping at `D` is not in question.

## File Structure

**New — backend**

| Path | Responsibility |
| --- | --- |
| `src/credit/services/borrowerRisk/types.ts` | `BorrowerRiskInputs`, `BorrowerRiskThresholds`, `FactorResult`, `BorrowerRiskResult` |
| `src/credit/services/borrowerRisk/thresholds.ts` | `getBorrowerRiskThresholds()` via policy parameters |
| `src/credit/services/borrowerRisk/loadInputs.ts` | `loadBorrowerRiskInputs()` — the only Prisma read in this subsystem |
| `src/credit/services/borrowerRisk/factors/financialStanding.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/repaymentCapacity.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/bureauConduct.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/complianceScreening.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/identityKyc.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/industryRisk.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/relationshipTenure.ts` | one factor |
| `src/credit/services/borrowerRisk/factors/index.ts` | factor-key → function registry |
| `src/credit/services/borrowerRisk/caps.ts` | `applyBorrowerRatingCaps()` |
| `src/credit/services/borrowerRisk/compute.ts` | `computeBorrowerRisk()` — pure |
| `src/credit/services/borrowerRisk/assess.ts` | `runBorrowerRiskAssessment()` — transaction |
| `src/credit/services/borrowerRisk/recalc.ts` | `recalcBorrowerRisk()` dispatcher |
| `src/credit/services/borrowerIdentityInvariants.ts` | `assertBorrowerIdentityInvariants()` (G-02, G-03) |

**Modified — backend**

| Path | Change |
| --- | --- |
| `prisma/schema.prisma` | `ScorecardScope` enum; `CreditScorecard.scope` |
| `src/credit/services/scorecard.service.ts` | split factor groups; scope-aware weight validation |
| `src/credit/services/scoring.service.ts:376–430` | scorecard selection filters `scope = APPLICATION` |
| `src/credit/services/borrowerRisk.service.ts` | `createBorrowerRiskRun` becomes pure persistence |
| `src/credit/routes/borrowerRisk.routes.ts` | add manual recalc route |
| `src/credit/controllers/borrowerRisk.controller.ts` | add recalc handler |
| `src/credit/services/borrowerProfile.service.ts` | call invariants on create + update; dispatch recalc |
| `src/credit/services/borrowerCreditData.service.ts` | dispatch recalc |
| `src/credit/services/financial.service.ts` | dispatch recalc on statement approval |
| `src/credit/services/bureauCheck.service.ts` | dispatch recalc |
| `src/credit/services/amlRescreen.service.ts` | dispatch recalc |
| `src/credit/services/director.service.ts`, `shareholder.service.ts`, `ubo.service.ts` | dispatch recalc |
| `src/credit/services/fatcaCrs.service.ts` | dispatch recalc |

**Modified — frontend**

| Path | Change |
| --- | --- |
| `frontend/src/services/credit.service.ts` | `getBorrowerRiskLatest`, `getBorrowerRiskHistory`, `recalcBorrowerRisk` |
| `frontend/src/components/credit/borrower360/BorrowerKpiBand.tsx` | grade, as-of, coverage, staleness |
| `frontend/src/components/credit/borrower360/BorrowerRiskFactorPanel.tsx` | **new** — factor breakdown |
| `frontend/src/components/credit/borrower360/BorrowerRiskHistoryTab.tsx` | **new** — run history |
| `frontend/src/components/credit/borrower360/borrowerReadiness.ts` | name missing rating inputs |

---

### Task 1: Regression baseline and `ScorecardScope` migration

Prove application scoring is green *before* touching it, then add the scope column defaulting so nothing changes.

**Files:**
- Modify: `backend/prisma/schema.prisma` (`CreditScorecard`, new `ScorecardScope` enum)
- Test: `backend/src/credit/services/__tests__/scorecardScope.migration.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `enum ScorecardScope { APPLICATION, BORROWER }`; `CreditScorecard.scope: ScorecardScope` defaulting to `APPLICATION`

- [ ] **Step 1: Record the regression baseline**

Run from `backend/`:

```bash
npx jest src/credit/services/__tests__/scoring --silent 2>&1 | tail -20
```

Expected: all PASS. Copy the exact suite/test counts into the commit message in Step 7. If anything already fails, **stop and report** — do not proceed on a red baseline.

- [ ] **Step 2: Add the enum and column to the schema**

In `backend/prisma/schema.prisma`, immediately above `model CreditScorecard`:

```prisma
// Distinguishes scorecards that score an application from those that score a
// borrower standing alone. Existing rows default to APPLICATION so application
// scoring behaviour is unchanged.
enum ScorecardScope {
  APPLICATION
  BORROWER
}
```

Then inside `model CreditScorecard`, directly after the `productType` line:

```prisma
  scope       ScorecardScope     @default(APPLICATION)
```

And add to the same model's index block, after `@@index([productType])`:

```prisma
  @@index([scope])
```

- [ ] **Step 3: Write the failing migration test**

Create `backend/src/credit/services/__tests__/scorecardScope.migration.test.ts`:

```ts
import { ScorecardScope } from '@prisma/client';

describe('ScorecardScope', () => {
  it('exposes APPLICATION and BORROWER', () => {
    expect(ScorecardScope.APPLICATION).toBe('APPLICATION');
    expect(ScorecardScope.BORROWER).toBe('BORROWER');
  });

  it('has exactly two members so no third scope is added silently', () => {
    expect(Object.keys(ScorecardScope).sort()).toEqual(['APPLICATION', 'BORROWER']);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npx jest src/credit/services/__tests__/scorecardScope.migration.test.ts --silent
```

Expected: FAIL — `ScorecardScope` is not exported from `@prisma/client` yet.

- [ ] **Step 5: Generate the migration and client**

```bash
npx prisma migrate dev --name add_scorecard_scope
npx prisma generate
```

- [ ] **Step 6: Run both the new test and the regression baseline**

```bash
npx jest src/credit/services/__tests__/scorecardScope.migration.test.ts --silent
npx jest src/credit/services/__tests__/scoring --silent 2>&1 | tail -20
```

Expected: new test PASS; scoring suite counts **identical** to Step 1. A changed count here means the default is not applying — stop and investigate.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/credit/services/__tests__/scorecardScope.migration.test.ts
git commit -m "feat(credit): add ScorecardScope to CreditScorecard

Defaults every existing row to APPLICATION so application scoring is
unchanged. Baseline scoring suite verified green before and after."
```

---

### Task 2: Scope-aware factor groups and weight validation

**Files:**
- Modify: `backend/src/credit/services/scorecard.service.ts:9–33` (factor groups), `:57–73` (`validateFactorWeights`)
- Test: `backend/src/credit/services/__tests__/borrowerFactorWeights.test.ts`

**Interfaces:**
- Consumes: `ScorecardScope` (Task 1)
- Produces:
  - `APPLICATION_FACTOR_GROUPS: readonly string[]` — the existing nine, re-exported as `FACTOR_GROUPS` for backward compatibility
  - `BORROWER_FACTOR_GROUPS: readonly string[]` — the seven
  - `BorrowerFactorWeights` — record of the seven keys to numbers
  - `validateFactorWeights(weights: Record<string, number>, scope?: ScorecardScope): void`

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/__tests__/borrowerFactorWeights.test.ts`:

```ts
import { ScorecardScope } from '@prisma/client';
import {
  BORROWER_FACTOR_GROUPS,
  APPLICATION_FACTOR_GROUPS,
  validateFactorWeights,
} from '../scorecard.service';

const VALID_BORROWER_WEIGHTS = {
  financial_standing: 20,
  repayment_capacity: 20,
  bureau_conduct: 20,
  identity_kyc: 15,
  industry_risk: 10,
  relationship_tenure: 10,
  compliance_screening: 5,
};

describe('borrower factor weights', () => {
  it('defines exactly seven borrower factors', () => {
    expect([...BORROWER_FACTOR_GROUPS].sort()).toEqual(
      Object.keys(VALID_BORROWER_WEIGHTS).sort(),
    );
  });

  it('keeps the nine application factors untouched', () => {
    expect(APPLICATION_FACTOR_GROUPS).toHaveLength(9);
    expect(APPLICATION_FACTOR_GROUPS).toContain('market_conditions');
    expect(APPLICATION_FACTOR_GROUPS).not.toContain('financial_standing');
  });

  it('accepts valid borrower weights under BORROWER scope', () => {
    expect(() =>
      validateFactorWeights(VALID_BORROWER_WEIGHTS, ScorecardScope.BORROWER),
    ).not.toThrow();
  });

  it('rejects borrower weights that do not sum to 100', () => {
    expect(() =>
      validateFactorWeights(
        { ...VALID_BORROWER_WEIGHTS, compliance_screening: 10 },
        ScorecardScope.BORROWER,
      ),
    ).toThrow(/sum to 100/);
  });

  it('rejects a missing borrower factor', () => {
    const { bureau_conduct, ...incomplete } = VALID_BORROWER_WEIGHTS;
    expect(() =>
      validateFactorWeights(incomplete as never, ScorecardScope.BORROWER),
    ).toThrow(/Missing factor weight: bureau_conduct/);
  });

  it('rejects application weights submitted under BORROWER scope', () => {
    expect(() =>
      validateFactorWeights(
        { financial_performance: 100 } as never,
        ScorecardScope.BORROWER,
      ),
    ).toThrow(/Missing factor weight/);
  });

  it('defaults to APPLICATION scope when scope is omitted', () => {
    expect(() =>
      validateFactorWeights(VALID_BORROWER_WEIGHTS as never),
    ).toThrow(/Missing factor weight: financial_performance/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/__tests__/borrowerFactorWeights.test.ts --silent
```

Expected: FAIL — `BORROWER_FACTOR_GROUPS` is not exported.

- [ ] **Step 3: Implement scope-aware groups and validation**

In `backend/src/credit/services/scorecard.service.ts`, replace the `FACTOR_GROUPS` block at lines 9–21 with:

```ts
export const APPLICATION_FACTOR_GROUPS = [
  'financial_performance',
  'leverage',
  'liquidity',
  'cashflow',
  'management',
  'industry',
  'collateral',
  'relationship',
  'market_conditions',
] as const;

/**
 * Borrower-scope factors. Only properties knowable about a borrower standing
 * alone — no collateral (application-level) and no market_conditions (no data
 * source). Weights must sum to 100.
 */
export const BORROWER_FACTOR_GROUPS = [
  'financial_standing',
  'repayment_capacity',
  'bureau_conduct',
  'identity_kyc',
  'industry_risk',
  'relationship_tenure',
  'compliance_screening',
] as const;

/** Backward-compatible alias — existing imports keep working unchanged. */
export const FACTOR_GROUPS = APPLICATION_FACTOR_GROUPS;

export type FactorGroup = (typeof APPLICATION_FACTOR_GROUPS)[number];
export type BorrowerFactorGroup = (typeof BORROWER_FACTOR_GROUPS)[number];

export type BorrowerFactorWeights = Record<BorrowerFactorGroup, number>;

export function factorGroupsForScope(scope?: ScorecardScope): readonly string[] {
  return scope === ScorecardScope.BORROWER
    ? BORROWER_FACTOR_GROUPS
    : APPLICATION_FACTOR_GROUPS;
}
```

Add `import { ScorecardScope } from '@prisma/client';` to the file's imports.

Then replace `validateFactorWeights` (lines 57–73) with a scope-aware, exported version:

```ts
export function validateFactorWeights(
  weights: Record<string, number>,
  scope: ScorecardScope = ScorecardScope.APPLICATION,
): void {
  const groups = factorGroupsForScope(scope);

  for (const key of groups) {
    if (weights[key] === undefined || weights[key] === null) {
      throw new Error(`Missing factor weight: ${key}`);
    }
    if (typeof weights[key] !== 'number' || weights[key] < 0 || weights[key] > 100) {
      throw new Error(`Factor weight '${key}' must be a number between 0 and 100`);
    }
  }

  const total = groups.reduce((sum, key) => sum + weights[key], 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Factor weights must sum to 100, got ${total}`);
  }
}
```

Every existing internal call site of `validateFactorWeights(weights)` keeps working — the scope parameter defaults. Where `ScorecardService` creates a version for a scorecard, pass the parent scorecard's scope through: find each `validateFactorWeights(` call in the class and add `, scorecard.scope` where a `scorecard` record is already in hand.

- [ ] **Step 4: Run the new test and the full scorecard suite**

```bash
npx jest src/credit/services/__tests__/borrowerFactorWeights.test.ts --silent
npx jest src/credit/services/__tests__/scorecard --silent
```

Expected: both PASS. The existing scorecard tests exercise the nine-factor path and must be unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services/scorecard.service.ts src/credit/services/__tests__/borrowerFactorWeights.test.ts
git commit -m "feat(credit): scope-aware scorecard factor groups and weight validation

Splits FACTOR_GROUPS into APPLICATION_ and BORROWER_ sets. FACTOR_GROUPS
remains an alias so existing imports are untouched. validateFactorWeights
takes an optional scope defaulting to APPLICATION."
```

---

### Task 3: Scorecard selection filters to APPLICATION scope

**The highest-risk edit in this plan.** `scoring.service.ts` selection logic includes a carefully written multi-active 409 path. Change only the `where` clauses.

**Files:**
- Modify: `backend/src/credit/services/scoring.service.ts:376–430`
- Test: `backend/src/credit/services/__tests__/scorecardSelectionScope.test.ts`

**Interfaces:**
- Consumes: `ScorecardScope` (Task 1)
- Produces: no new exports. `executeScore` now ignores `BORROWER`-scoped scorecards entirely.

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/__tests__/scorecardSelectionScope.test.ts`:

```ts
import { ScorecardScope } from '@prisma/client';

const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: { findUnique: jest.fn() },
    creditScorecardVersion: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
    financialStatement: { findFirst: jest.fn() },
  },
}));

describe('scorecard selection scope filter', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it('restricts every active-version query to APPLICATION-scoped scorecards', async () => {
    const prisma = (await import('../../../utils/prisma')).default as never as {
      creditApplication: { findUnique: jest.Mock };
    };
    prisma.creditApplication.findUnique.mockResolvedValue({
      borrowerProfileId: 'b1',
      productType: 'TERM_LOAN',
      lane: 'SME',
      borrowerProfile: { borrowerType: 'CORPORATE' },
    });

    const { scoringService } = await import('../scoring.service');
    await expect(scoringService.executeScore('app-1')).rejects.toThrow(
      /No active scorecard version/,
    );

    expect(mockFindMany).toHaveBeenCalled();
    for (const call of mockFindMany.mock.calls) {
      const where = call[0].where;
      expect(where.scorecard).toBeDefined();
      expect(where.scorecard.scope).toBe(ScorecardScope.APPLICATION);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/__tests__/scorecardSelectionScope.test.ts --silent
```

Expected: FAIL — `where.scorecard` is `undefined` on the fallback query, which currently has no `scorecard` filter at all.

- [ ] **Step 3: Add the scope filter to all three selection queries**

In `backend/src/credit/services/scoring.service.ts`:

The explicit-`scorecardId` branch (`findFirst`, around line 379) gains a nested filter:

```ts
      scorecardVersion = await prisma.creditScorecardVersion.findFirst({
        where: {
          scorecardId,
          isActive: true,
          effectiveFrom: { lte: now },
          scorecard: { scope: ScorecardScope.APPLICATION },
        },
        orderBy: { version: 'desc' },
      });
```

The product-specific branch (around line 399) — extend the existing `scorecard` filter rather than adding a second one:

```ts
          where: {
            isActive: true,
            effectiveFrom: { lte: now },
            scorecard: {
              productType: productType as any,
              scope: ScorecardScope.APPLICATION,
            },
          },
```

The generic fallback (around line 412) gains the filter it currently lacks:

```ts
          where: {
            isActive: true,
            effectiveFrom: { lte: now },
            scorecard: { scope: ScorecardScope.APPLICATION },
          },
```

Add `ScorecardScope` to the existing `@prisma/client` import at the top of the file.

Leave the `distinctScorecards.size > 1` check and both 409 messages exactly as they are.

- [ ] **Step 4: Run the new test plus the full regression baseline**

```bash
npx jest src/credit/services/__tests__/scorecardSelectionScope.test.ts --silent
npx jest src/credit/services/__tests__/scoring --silent 2>&1 | tail -20
```

Expected: new test PASS; scoring suite counts identical to Task 1 Step 1. **If the multi-active 409 test fails, revert and reassess** — that path is load-bearing.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services/scoring.service.ts src/credit/services/__tests__/scorecardSelectionScope.test.ts
git commit -m "fix(credit): restrict application scoring to APPLICATION-scoped scorecards

Prevents a BORROWER-scoped scorecard from being selected by executeScore or
from tripping the multi-active 409. The disambiguation logic is unchanged."
```

---

### Task 4: Borrower risk types and thresholds

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/types.ts`, `backend/src/credit/services/borrowerRisk/thresholds.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/thresholds.test.ts`

**Interfaces:**
- Consumes: `getNumberPolicy` from `../policyParameter.service`
- Produces:

```ts
export interface BorrowerRiskInputs {
  borrowerProfileId: string;
  borrowerType: 'INDIVIDUAL' | 'CORPORATE' | 'JOINT' | 'SOLE_PROPRIETOR';
  createdAt: Date;
  ratios: Record<string, number>;
  annualIncome: number | null;
  netWorth: number | null;
  annualTurnover: number | null;
  yearsTrading: number | null;
  dsrPercent: number | null;
  netDsrPercent: number | null;
  dsrBasis: string | null;
  bureauScore: number | null;
  bureauReportCount: number;
  bureauArrearsCount: number;
  kycVerifiedAt: Date | null;
  hasIdentityDocument: boolean;
  hasFatcaCrsDeclaration: boolean;
  directorCount: number;
  shareholderCount: number;
  uboCount: number;
  industry: string | null;
  sicCode: string | null;
  industryRiskScore: number | null;
  amlRiskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'PROHIBITED' | null;
  isSanctionedEntity: boolean;
  adverseRescreenCount: number;
  priorFacilityCount: number;
}

export interface BorrowerRiskThresholds {
  dsr: { good: number; bad: number };
  bureauScore: { good: number; bad: number };
  tenureYears: { good: number; bad: number };
  netWorth: { good: number; bad: number };
  turnover: { good: number; bad: number };
  coverageFloorPercent: number;
}

export interface FactorResult {
  score: number | null;
  reasonCode?: string;
}

export interface BorrowerFactorScoreDetail {
  weight: number;
  score: number;
  weightedScore: number;
  hadData: boolean;
}

export interface BorrowerRiskResult {
  factorScores: Record<string, BorrowerFactorScoreDetail>;
  totalScore: number;
  baseRiskRating: RiskRating;
  effectiveRiskRating: RiskRating;
  capsApplied: string[];
  missingInputs: MissingInputRecord[];
  reasonCodes: string[];
  coveragePercent: number;
}
```

- [ ] **Step 1: Create the types file**

Create `backend/src/credit/services/borrowerRisk/types.ts` with exactly the interfaces listed in the Interfaces block above, prefixed by:

```ts
import { RiskRating } from '@prisma/client';
import { MissingInputRecord } from '../missingDataPolicy.service';
```

- [ ] **Step 2: Write the failing threshold test**

Create `backend/src/credit/services/borrowerRisk/__tests__/thresholds.test.ts`:

```ts
const mockGetNumberPolicy = jest.fn();

jest.mock('../../policyParameter.service', () => ({
  getNumberPolicy: (key: string, def: number) => mockGetNumberPolicy(key, def),
}));

import { getBorrowerRiskThresholds } from '../thresholds';

describe('getBorrowerRiskThresholds', () => {
  beforeEach(() => {
    mockGetNumberPolicy.mockReset();
    mockGetNumberPolicy.mockImplementation((_key: string, def: number) => Promise.resolve(def));
  });

  it('returns the documented defaults when no policy rows exist', async () => {
    const t = await getBorrowerRiskThresholds();
    expect(t.dsr).toEqual({ good: 30, bad: 70 });
    expect(t.bureauScore).toEqual({ good: 750, bad: 500 });
    expect(t.tenureYears).toEqual({ good: 5, bad: 0 });
    expect(t.coverageFloorPercent).toBe(50);
  });

  it('reads every threshold under the borrower_risk key prefix', async () => {
    await getBorrowerRiskThresholds();
    const keys = mockGetNumberPolicy.mock.calls.map((c) => c[0]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toMatch(/^borrower_risk\./);
    }
  });

  it('honours a configured override', async () => {
    mockGetNumberPolicy.mockImplementation((key: string, def: number) =>
      Promise.resolve(key === 'borrower_risk.coverage_floor_percent' ? 65 : def),
    );
    const t = await getBorrowerRiskThresholds();
    expect(t.coverageFloorPercent).toBe(65);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/thresholds.test.ts --silent
```

Expected: FAIL — cannot resolve `../thresholds`.

- [ ] **Step 4: Implement thresholds**

Create `backend/src/credit/services/borrowerRisk/thresholds.ts`:

```ts
import { getNumberPolicy } from '../policyParameter.service';
import { BorrowerRiskThresholds } from './types';

/**
 * Defaults for borrower-risk scoring. Every value is overridable through a
 * CreditPolicyParameter row under the `borrower_risk.` prefix, mirroring
 * getScoringThresholds() in scoring.service.ts. Never read these constants
 * directly at a call site — always go through getBorrowerRiskThresholds().
 */
const DEFAULTS: BorrowerRiskThresholds = {
  dsr: { good: 30, bad: 70 },
  bureauScore: { good: 750, bad: 500 },
  tenureYears: { good: 5, bad: 0 },
  netWorth: { good: 1_000_000, bad: 0 },
  turnover: { good: 5_000_000, bad: 0 },
  coverageFloorPercent: 50,
};

export async function getBorrowerRiskThresholds(): Promise<BorrowerRiskThresholds> {
  const [
    dsrGood, dsrBad,
    bureauGood, bureauBad,
    tenureGood, tenureBad,
    netWorthGood, netWorthBad,
    turnoverGood, turnoverBad,
    coverageFloorPercent,
  ] = await Promise.all([
    getNumberPolicy('borrower_risk.dsr.good', DEFAULTS.dsr.good),
    getNumberPolicy('borrower_risk.dsr.bad', DEFAULTS.dsr.bad),
    getNumberPolicy('borrower_risk.bureau_score.good', DEFAULTS.bureauScore.good),
    getNumberPolicy('borrower_risk.bureau_score.bad', DEFAULTS.bureauScore.bad),
    getNumberPolicy('borrower_risk.tenure_years.good', DEFAULTS.tenureYears.good),
    getNumberPolicy('borrower_risk.tenure_years.bad', DEFAULTS.tenureYears.bad),
    getNumberPolicy('borrower_risk.net_worth.good', DEFAULTS.netWorth.good),
    getNumberPolicy('borrower_risk.net_worth.bad', DEFAULTS.netWorth.bad),
    getNumberPolicy('borrower_risk.turnover.good', DEFAULTS.turnover.good),
    getNumberPolicy('borrower_risk.turnover.bad', DEFAULTS.turnover.bad),
    getNumberPolicy('borrower_risk.coverage_floor_percent', DEFAULTS.coverageFloorPercent),
  ]);

  return {
    dsr: { good: dsrGood, bad: dsrBad },
    bureauScore: { good: bureauGood, bad: bureauBad },
    tenureYears: { good: tenureGood, bad: tenureBad },
    netWorth: { good: netWorthGood, bad: netWorthBad },
    turnover: { good: turnoverGood, bad: turnoverBad },
    coverageFloorPercent,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/thresholds.test.ts --silent
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/credit/services/borrowerRisk/
git commit -m "feat(credit): borrower risk types and policy-backed thresholds

Every threshold resolves through CreditPolicyParameter under the
borrower_risk. prefix, so tuning needs no deploy."
```

---

### Task 5: `loadBorrowerRiskInputs` — the single Prisma read

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/loadInputs.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/loadInputs.test.ts`

**Interfaces:**
- Consumes: `BorrowerRiskInputs` (Task 4)
- Produces: `loadBorrowerRiskInputs(borrowerProfileId: string): Promise<BorrowerRiskInputs | null>` — returns `null` when the borrower does not exist or is soft-deleted

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/loadInputs.test.ts`:

```ts
const mockFindFirst = jest.fn();

jest.mock('../../../../utils/prisma', () => ({
  __esModule: true,
  default: { borrowerProfile: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

import { loadBorrowerRiskInputs } from '../loadInputs';

const ROW = {
  id: 'b1',
  borrowerType: 'CORPORATE',
  createdAt: new Date('2020-01-01'),
  annualIncome: null,
  netWorth: { toString: () => '2000000' },
  annualTurnover: { toString: () => '8000000' },
  yearsTrading: 7,
  industry: 'Manufacturing',
  sicCode: '2599',
  amlRiskTier: 'LOW',
  isSanctionedEntity: false,
  kycVerifiedAt: new Date('2024-05-01'),
  nricPassport: null,
  registrationNumber: '202001012345',
  creditProfile: { dsrPercent: { toString: () => '42.5' }, netDsrPercent: null, dsrBasis: 'GROSS', creditScore: 720 },
  financialStatements: [{ ratios: [{ ratioKey: 'dscr', value: { toString: () => '1.8' } }] }],
  bureauReports: [{ id: 'r1', facilities: [{ arrearsMonths: 0 }, { arrearsMonths: 3 }] }],
  fatcaCrsDeclarations: [{ id: 'f1' }],
  directors: [{ id: 'd1' }, { id: 'd2' }],
  shareholders: [{ id: 's1' }],
  beneficialOwners: [],
  amlRescreenEvents: [{ outcome: 'ADVERSE' }, { outcome: 'CLEAR' }],
  applications: [{ id: 'a1' }, { id: 'a2' }],
};

describe('loadBorrowerRiskInputs', () => {
  beforeEach(() => mockFindFirst.mockReset());

  it('returns null for a missing borrower', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await loadBorrowerRiskInputs('nope')).toBeNull();
  });

  it('excludes soft-deleted borrowers in the query', async () => {
    mockFindFirst.mockResolvedValue(null);
    await loadBorrowerRiskInputs('b1');
    expect(mockFindFirst.mock.calls[0][0].where).toEqual({ id: 'b1', deletedAt: null });
  });

  it('flattens the row into a scalar snapshot', async () => {
    mockFindFirst.mockResolvedValue(ROW);
    const inputs = await loadBorrowerRiskInputs('b1');
    expect(inputs).toMatchObject({
      borrowerProfileId: 'b1',
      borrowerType: 'CORPORATE',
      netWorth: 2000000,
      annualTurnover: 8000000,
      yearsTrading: 7,
      dsrPercent: 42.5,
      bureauScore: 720,
      bureauReportCount: 1,
      bureauArrearsCount: 1,
      hasIdentityDocument: true,
      hasFatcaCrsDeclaration: true,
      directorCount: 2,
      shareholderCount: 1,
      uboCount: 0,
      adverseRescreenCount: 1,
      priorFacilityCount: 2,
      isSanctionedEntity: false,
    });
    expect(inputs!.ratios).toEqual({ dscr: 1.8 });
  });

  it('issues exactly one query', async () => {
    mockFindFirst.mockResolvedValue(ROW);
    await loadBorrowerRiskInputs('b1');
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/loadInputs.test.ts --silent
```

Expected: FAIL — cannot resolve `../loadInputs`.

- [ ] **Step 3: Implement the loader**

Create `backend/src/credit/services/borrowerRisk/loadInputs.ts`:

```ts
import prisma from '../../../utils/prisma';
import { BorrowerRiskInputs } from './types';

/** Prisma Decimal | number | null → number | null */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

/**
 * The only Prisma read in the borrower-risk subsystem. Everything downstream
 * is pure and operates on the returned snapshot, so factor logic is testable
 * without a database.
 */
export async function loadBorrowerRiskInputs(
  borrowerProfileId: string,
): Promise<BorrowerRiskInputs | null> {
  const row = await prisma.borrowerProfile.findFirst({
    where: { id: borrowerProfileId, deletedAt: null },
    include: {
      creditProfile: true,
      financialStatements: {
        where: { status: 'APPROVED', deletedAt: null },
        orderBy: { fiscalYearEnd: 'desc' },
        take: 1,
        include: { ratios: true },
      },
      bureauReports: { include: { facilities: true } },
      fatcaCrsDeclarations: { select: { id: true } },
      directors: { select: { id: true } },
      shareholders: { select: { id: true } },
      beneficialOwners: { select: { id: true } },
      amlRescreenEvents: { select: { outcome: true } },
      applications: {
        where: { state: { in: ['APPROVED', 'DISBURSED', 'ACTIVE', 'CLOSED'] } },
        select: { id: true },
      },
    },
  });

  if (!row) return null;

  const ratios: Record<string, number> = {};
  for (const r of row.financialStatements[0]?.ratios ?? []) {
    const v = num(r.value);
    if (v !== null) ratios[r.ratioKey] = v;
  }

  const bureauArrearsCount = (row.bureauReports ?? []).reduce(
    (sum, rep) =>
      sum + ((rep as { facilities?: { arrearsMonths: number | null }[] }).facilities ?? [])
        .filter((f) => (f.arrearsMonths ?? 0) > 0).length,
    0,
  );

  return {
    borrowerProfileId: row.id,
    borrowerType: row.borrowerType,
    createdAt: row.createdAt,
    ratios,
    annualIncome: num(row.annualIncome),
    netWorth: num(row.netWorth),
    annualTurnover: num(row.annualTurnover),
    yearsTrading: row.yearsTrading ?? null,
    dsrPercent: num(row.creditProfile?.dsrPercent),
    netDsrPercent: num(row.creditProfile?.netDsrPercent),
    dsrBasis: row.creditProfile?.dsrBasis ?? null,
    bureauScore: row.creditProfile?.creditScore ?? null,
    bureauReportCount: row.bureauReports?.length ?? 0,
    bureauArrearsCount,
    kycVerifiedAt: row.kycVerifiedAt ?? null,
    hasIdentityDocument: Boolean(row.nricPassport || row.registrationNumber),
    hasFatcaCrsDeclaration: (row.fatcaCrsDeclarations?.length ?? 0) > 0,
    directorCount: row.directors?.length ?? 0,
    shareholderCount: row.shareholders?.length ?? 0,
    uboCount: row.beneficialOwners?.length ?? 0,
    industry: row.industry ?? null,
    sicCode: row.sicCode ?? null,
    industryRiskScore: null,
    amlRiskTier: row.amlRiskTier ?? null,
    isSanctionedEntity: row.isSanctionedEntity,
    adverseRescreenCount: (row.amlRescreenEvents ?? []).filter(
      (e) => e.outcome === 'ADVERSE',
    ).length,
    priorFacilityCount: row.applications?.length ?? 0,
  };
}
```

> `industryRiskScore` is left `null` here deliberately — the `IndustryAssessment` lookup is application-scoped, so the `industry_risk` factor derives from `industry` / `sicCode` presence in Task 8. The field exists so a future industry-risk table can populate it without changing the interface.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/loadInputs.test.ts --silent
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services/borrowerRisk/loadInputs.ts src/credit/services/borrowerRisk/__tests__/loadInputs.test.ts
git commit -m "feat(credit): loadBorrowerRiskInputs single-query snapshot loader"
```

---

### Task 6: Financial family factors — `financial_standing`, `repayment_capacity`

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/scale.ts`
- Create: `backend/src/credit/services/borrowerRisk/factors/financialStanding.ts`
- Create: `backend/src/credit/services/borrowerRisk/factors/repaymentCapacity.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/factors.financial.test.ts`

**Interfaces:**
- Consumes: `BorrowerRiskInputs`, `BorrowerRiskThresholds`, `FactorResult` (Task 4)
- Produces:
  - `scoreHigherIsBetter(value: number, good: number, bad: number): number`
  - `scoreLowerIsBetter(value: number, good: number, bad: number): number`
  - `scoreFinancialStanding(inputs, thresholds): FactorResult`
  - `scoreRepaymentCapacity(inputs, thresholds): FactorResult`

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/factors.financial.test.ts`:

```ts
import { scoreFinancialStanding } from '../factors/financialStanding';
import { scoreRepaymentCapacity } from '../factors/repaymentCapacity';
import { BorrowerRiskInputs, BorrowerRiskThresholds } from '../types';

const T: BorrowerRiskThresholds = {
  dsr: { good: 30, bad: 70 },
  bureauScore: { good: 750, bad: 500 },
  tenureYears: { good: 5, bad: 0 },
  netWorth: { good: 1_000_000, bad: 0 },
  turnover: { good: 5_000_000, bad: 0 },
  coverageFloorPercent: 50,
};

function inputs(over: Partial<BorrowerRiskInputs> = {}): BorrowerRiskInputs {
  return {
    borrowerProfileId: 'b1', borrowerType: 'CORPORATE', createdAt: new Date('2020-01-01'),
    ratios: {}, annualIncome: null, netWorth: null, annualTurnover: null, yearsTrading: null,
    dsrPercent: null, netDsrPercent: null, dsrBasis: null, bureauScore: null,
    bureauReportCount: 0, bureauArrearsCount: 0, kycVerifiedAt: null,
    hasIdentityDocument: false, hasFatcaCrsDeclaration: false, directorCount: 0,
    shareholderCount: 0, uboCount: 0, industry: null, sicCode: null, industryRiskScore: null,
    amlRiskTier: null, isSanctionedEntity: false, adverseRescreenCount: 0,
    priorFacilityCount: 0, ...over,
  };
}

describe('scoreFinancialStanding', () => {
  it('returns null when no financial data exists at all', () => {
    expect(scoreFinancialStanding(inputs(), T).score).toBeNull();
  });

  it('scores corporate leverage and liquidity ratios', () => {
    const r = scoreFinancialStanding(
      inputs({ ratios: { debt_to_equity: 1.0, current_ratio: 2.0 } }), T);
    expect(r.score).toBe(100);
  });

  it('penalises poor ratios', () => {
    const r = scoreFinancialStanding(
      inputs({ ratios: { debt_to_equity: 3.0, current_ratio: 1.0 } }), T);
    expect(r.score).toBe(0);
  });

  it('falls back to net worth for an individual with no ratios', () => {
    const r = scoreFinancialStanding(
      inputs({ borrowerType: 'INDIVIDUAL', netWorth: 1_000_000 }), T);
    expect(r.score).toBe(100);
  });

  it('uses turnover for a corporate with no ratios', () => {
    const r = scoreFinancialStanding(inputs({ annualTurnover: 5_000_000 }), T);
    expect(r.score).toBe(100);
  });
});

describe('scoreRepaymentCapacity', () => {
  it('returns null with no DSR and no DSCR', () => {
    expect(scoreRepaymentCapacity(inputs(), T).score).toBeNull();
  });

  it('scores a low DSR highly (lower is better)', () => {
    expect(scoreRepaymentCapacity(inputs({ dsrPercent: 30 }), T).score).toBe(100);
  });

  it('scores a high DSR at zero', () => {
    expect(scoreRepaymentCapacity(inputs({ dsrPercent: 70 }), T).score).toBe(0);
  });

  it('prefers net DSR when the basis is NET', () => {
    const r = scoreRepaymentCapacity(
      inputs({ dsrPercent: 70, netDsrPercent: 30, dsrBasis: 'NET' }), T);
    expect(r.score).toBe(100);
  });

  it('ignores net DSR when the basis is GROSS', () => {
    const r = scoreRepaymentCapacity(
      inputs({ dsrPercent: 70, netDsrPercent: 30, dsrBasis: 'GROSS' }), T);
    expect(r.score).toBe(0);
  });

  it('uses DSCR when no DSR is present', () => {
    const r = scoreRepaymentCapacity(inputs({ ratios: { dscr: 2.0 } }), T);
    expect(r.score).toBe(100);
    expect(r.reasonCode).toBe('DSCR_BASIS');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/factors.financial.test.ts --silent
```

Expected: FAIL — cannot resolve `../factors/financialStanding`.

- [ ] **Step 3: Implement the shared scale helpers**

Create `backend/src/credit/services/borrowerRisk/scale.ts`:

```ts
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Linear ramp where a higher input value is better. */
export function scoreHigherIsBetter(value: number, good: number, bad: number): number {
  if (value >= good) return 100;
  if (value <= bad) return 0;
  return clamp(((value - bad) / (good - bad)) * 100);
}

/** Linear ramp where a lower input value is better. */
export function scoreLowerIsBetter(value: number, good: number, bad: number): number {
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(((bad - value) / (bad - good)) * 100);
}

/** Mean of the supplied scores, or null when none were computable. */
export function meanOrNull(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
```

- [ ] **Step 4: Implement `financial_standing`**

Create `backend/src/credit/services/borrowerRisk/factors/financialStanding.ts`:

```ts
import { BorrowerRiskInputs, BorrowerRiskThresholds, FactorResult } from '../types';
import { scoreHigherIsBetter, scoreLowerIsBetter, meanOrNull } from '../scale';

const RETAIL_TYPES = ['INDIVIDUAL', 'JOINT'];

/**
 * Balance-sheet strength. Prefers audited ratios; falls back to declared net
 * worth (retail) or turnover (corporate) when no approved statement exists.
 * Returns null only when the borrower has no financial data of any kind.
 */
export function scoreFinancialStanding(
  inputs: BorrowerRiskInputs,
  thresholds: BorrowerRiskThresholds,
): FactorResult {
  const scores: number[] = [];
  const { debt_to_equity: dte, debt_to_assets: dta, current_ratio: cr, quick_ratio: qr } =
    inputs.ratios;

  if (dte !== undefined) scores.push(scoreLowerIsBetter(dte, 1.0, 3.0));
  if (dta !== undefined) scores.push(scoreLowerIsBetter(dta, 0.4, 0.8));
  if (cr !== undefined) scores.push(scoreHigherIsBetter(cr, 2.0, 1.0));
  if (qr !== undefined) scores.push(scoreHigherIsBetter(qr, 1.5, 0.5));

  const ratioScore = meanOrNull(scores);
  if (ratioScore !== null) return { score: ratioScore };

  const isRetail = RETAIL_TYPES.includes(inputs.borrowerType);

  if (isRetail && inputs.netWorth !== null) {
    return {
      score: scoreHigherIsBetter(inputs.netWorth, thresholds.netWorth.good, thresholds.netWorth.bad),
      reasonCode: 'NET_WORTH_BASIS',
    };
  }

  if (!isRetail && inputs.annualTurnover !== null) {
    return {
      score: scoreHigherIsBetter(inputs.annualTurnover, thresholds.turnover.good, thresholds.turnover.bad),
      reasonCode: 'TURNOVER_BASIS',
    };
  }

  if (inputs.netWorth !== null) {
    return {
      score: scoreHigherIsBetter(inputs.netWorth, thresholds.netWorth.good, thresholds.netWorth.bad),
      reasonCode: 'NET_WORTH_BASIS',
    };
  }

  return { score: null };
}
```

- [ ] **Step 5: Implement `repayment_capacity`**

Create `backend/src/credit/services/borrowerRisk/factors/repaymentCapacity.ts`:

```ts
import { BorrowerRiskInputs, BorrowerRiskThresholds, FactorResult } from '../types';
import { scoreHigherIsBetter, scoreLowerIsBetter } from '../scale';

/**
 * Ability to service debt. DSR is lower-is-better; DSCR is higher-is-better.
 * Honours dsrBasis so the figure matches what readiness checks and the CA memo
 * present, exactly as resolveRetailDsr() does for application scoring.
 */
export function scoreRepaymentCapacity(
  inputs: BorrowerRiskInputs,
  thresholds: BorrowerRiskThresholds,
): FactorResult {
  const useNet =
    inputs.dsrBasis === 'NET' && inputs.netDsrPercent !== null && inputs.netDsrPercent > 0;
  const dsr = useNet ? inputs.netDsrPercent : inputs.dsrPercent;

  if (dsr !== null) {
    return {
      score: scoreLowerIsBetter(dsr, thresholds.dsr.good, thresholds.dsr.bad),
      reasonCode: useNet ? 'NET_DSR_BASIS' : 'GROSS_DSR_BASIS',
    };
  }

  const dscr = inputs.ratios.dscr;
  if (dscr !== undefined) {
    return { score: scoreHigherIsBetter(dscr, 2.0, 1.0), reasonCode: 'DSCR_BASIS' };
  }

  return { score: null };
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/factors.financial.test.ts --silent
```

Expected: PASS, 11 tests.

- [ ] **Step 7: Commit**

```bash
git add src/credit/services/borrowerRisk/scale.ts src/credit/services/borrowerRisk/factors src/credit/services/borrowerRisk/__tests__/factors.financial.test.ts
git commit -m "feat(credit): borrower financial_standing and repayment_capacity factors"
```

---

### Task 7: External-risk factors — `bureau_conduct`, `compliance_screening`

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/factors/bureauConduct.ts`, `.../complianceScreening.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/factors.external.test.ts`

**Interfaces:**
- Consumes: `BorrowerRiskInputs`, `BorrowerRiskThresholds`, `FactorResult`; `scoreHigherIsBetter` from `../scale`
- Produces: `scoreBureauConduct(inputs, thresholds): FactorResult`, `scoreComplianceScreening(inputs): FactorResult`

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/factors.external.test.ts`. Reuse the `inputs()` / `T` helpers verbatim from `factors.financial.test.ts` (copy them in — the plan deliberately repeats rather than sharing, so each test file stands alone), then:

```ts
import { scoreBureauConduct } from '../factors/bureauConduct';
import { scoreComplianceScreening } from '../factors/complianceScreening';

describe('scoreBureauConduct', () => {
  it('returns null when no bureau report exists', () => {
    expect(scoreBureauConduct(inputs(), T).score).toBeNull();
  });

  it('scores a strong bureau score at 100', () => {
    expect(scoreBureauConduct(inputs({ bureauReportCount: 1, bureauScore: 750 }), T).score).toBe(100);
  });

  it('scores a weak bureau score at 0', () => {
    expect(scoreBureauConduct(inputs({ bureauReportCount: 1, bureauScore: 500 }), T).score).toBe(0);
  });

  it('deducts 20 points per arrears facility', () => {
    const r = scoreBureauConduct(
      inputs({ bureauReportCount: 1, bureauScore: 750, bureauArrearsCount: 2 }), T);
    expect(r.score).toBe(60);
    expect(r.reasonCode).toBe('ARREARS_PRESENT');
  });

  it('never deducts below zero', () => {
    const r = scoreBureauConduct(
      inputs({ bureauReportCount: 1, bureauScore: 500, bureauArrearsCount: 9 }), T);
    expect(r.score).toBe(0);
  });

  it('scores a report with no numeric score as neutral-but-present', () => {
    const r = scoreBureauConduct(inputs({ bureauReportCount: 1, bureauScore: null }), T);
    expect(r.score).toBe(50);
    expect(r.reasonCode).toBe('REPORT_WITHOUT_SCORE');
  });
});

describe('scoreComplianceScreening', () => {
  it('returns null when no AML tier has been assigned', () => {
    expect(scoreComplianceScreening(inputs()).score).toBeNull();
  });

  it('scores LOW at 100', () => {
    expect(scoreComplianceScreening(inputs({ amlRiskTier: 'LOW' })).score).toBe(100);
  });

  it('scores MEDIUM at 60 and HIGH at 20', () => {
    expect(scoreComplianceScreening(inputs({ amlRiskTier: 'MEDIUM' })).score).toBe(60);
    expect(scoreComplianceScreening(inputs({ amlRiskTier: 'HIGH' })).score).toBe(20);
  });

  it('scores PROHIBITED at 0', () => {
    const r = scoreComplianceScreening(inputs({ amlRiskTier: 'PROHIBITED' }));
    expect(r.score).toBe(0);
    expect(r.reasonCode).toBe('AML_PROHIBITED');
  });

  it('scores a sanctioned entity at 0 regardless of tier', () => {
    const r = scoreComplianceScreening(inputs({ amlRiskTier: 'LOW', isSanctionedEntity: true }));
    expect(r.score).toBe(0);
    expect(r.reasonCode).toBe('SANCTIONED_ENTITY');
  });

  it('deducts for adverse rescreen outcomes', () => {
    const r = scoreComplianceScreening(inputs({ amlRiskTier: 'LOW', adverseRescreenCount: 2 }));
    expect(r.score).toBe(50);
    expect(r.reasonCode).toBe('ADVERSE_RESCREEN');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/factors.external.test.ts --silent
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `bureau_conduct`**

Create `backend/src/credit/services/borrowerRisk/factors/bureauConduct.ts`:

```ts
import { BorrowerRiskInputs, BorrowerRiskThresholds, FactorResult } from '../types';
import { scoreHigherIsBetter } from '../scale';

const ARREARS_PENALTY_PER_FACILITY = 20;
const PRESENT_WITHOUT_SCORE = 50;

/**
 * Repayment behaviour from bureau data. Null when no report exists at all —
 * absence of a bureau report is missing data, not good conduct.
 */
export function scoreBureauConduct(
  inputs: BorrowerRiskInputs,
  thresholds: BorrowerRiskThresholds,
): FactorResult {
  if (inputs.bureauReportCount === 0) return { score: null };

  const base =
    inputs.bureauScore !== null
      ? scoreHigherIsBetter(inputs.bureauScore, thresholds.bureauScore.good, thresholds.bureauScore.bad)
      : PRESENT_WITHOUT_SCORE;

  if (inputs.bureauArrearsCount > 0) {
    const penalised = Math.max(
      0,
      base - inputs.bureauArrearsCount * ARREARS_PENALTY_PER_FACILITY,
    );
    return { score: penalised, reasonCode: 'ARREARS_PRESENT' };
  }

  return {
    score: base,
    reasonCode: inputs.bureauScore === null ? 'REPORT_WITHOUT_SCORE' : undefined,
  };
}
```

- [ ] **Step 4: Implement `compliance_screening`**

Create `backend/src/credit/services/borrowerRisk/factors/complianceScreening.ts`:

```ts
import { BorrowerRiskInputs, FactorResult } from '../types';

const TIER_SCORES: Record<string, number> = {
  LOW: 100,
  MEDIUM: 60,
  HIGH: 20,
  PROHIBITED: 0,
};

const ADVERSE_PENALTY = 25;

/**
 * AML and sanctions standing.
 *
 * This factor carries only 5% weight, so it must NOT be the only place
 * sanctions are reflected — see applyBorrowerRatingCaps(), which turns these
 * same conditions into a hard rating cap. The score here is for transparency
 * in the factor breakdown; the cap is the control.
 */
export function scoreComplianceScreening(inputs: BorrowerRiskInputs): FactorResult {
  if (inputs.isSanctionedEntity) {
    return { score: 0, reasonCode: 'SANCTIONED_ENTITY' };
  }

  if (inputs.amlRiskTier === null) return { score: null };

  if (inputs.amlRiskTier === 'PROHIBITED') {
    return { score: 0, reasonCode: 'AML_PROHIBITED' };
  }

  const base = TIER_SCORES[inputs.amlRiskTier] ?? 0;

  if (inputs.adverseRescreenCount > 0) {
    return {
      score: Math.max(0, base - inputs.adverseRescreenCount * ADVERSE_PENALTY),
      reasonCode: 'ADVERSE_RESCREEN',
    };
  }

  return { score: base };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/factors.external.test.ts --silent
```

Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add src/credit/services/borrowerRisk/factors src/credit/services/borrowerRisk/__tests__/factors.external.test.ts
git commit -m "feat(credit): borrower bureau_conduct and compliance_screening factors"
```

---

### Task 8: Profile factors and the registry

**Files:**
- Create: `.../factors/identityKyc.ts`, `.../factors/industryRisk.ts`, `.../factors/relationshipTenure.ts`, `.../factors/index.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/factors.profile.test.ts`, `.../__tests__/factors.registry.test.ts`

**Interfaces:**
- Produces:
  - `scoreIdentityKyc(inputs): FactorResult`
  - `scoreIndustryRisk(inputs): FactorResult`
  - `scoreRelationshipTenure(inputs, thresholds, now?): FactorResult`
  - `BORROWER_FACTOR_REGISTRY: Record<string, (i: BorrowerRiskInputs, t: BorrowerRiskThresholds) => FactorResult>`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/credit/services/borrowerRisk/__tests__/factors.profile.test.ts` — copy the `inputs()` / `T` helpers from `factors.financial.test.ts`, then:

```ts
import { scoreIdentityKyc } from '../factors/identityKyc';
import { scoreIndustryRisk } from '../factors/industryRisk';
import { scoreRelationshipTenure } from '../factors/relationshipTenure';

describe('scoreIdentityKyc', () => {
  it('returns null for a profile with no identity signals at all', () => {
    expect(scoreIdentityKyc(inputs()).score).toBeNull();
  });

  it('awards 40 for an identity document alone', () => {
    expect(scoreIdentityKyc(inputs({ hasIdentityDocument: true })).score).toBe(40);
  });

  it('awards 40 more for verified KYC', () => {
    const r = scoreIdentityKyc(inputs({ hasIdentityDocument: true, kycVerifiedAt: new Date() }));
    expect(r.score).toBe(80);
  });

  it('awards 10 for a FATCA/CRS declaration', () => {
    const r = scoreIdentityKyc(inputs({
      hasIdentityDocument: true, kycVerifiedAt: new Date(), hasFatcaCrsDeclaration: true,
    }));
    expect(r.score).toBe(90);
  });

  it('awards the final 10 for a beneficial-ownership register', () => {
    const r = scoreIdentityKyc(inputs({
      hasIdentityDocument: true, kycVerifiedAt: new Date(),
      hasFatcaCrsDeclaration: true, directorCount: 2, uboCount: 1,
    }));
    expect(r.score).toBe(100);
  });

  it('flags an unverified profile', () => {
    const r = scoreIdentityKyc(inputs({ hasIdentityDocument: true }));
    expect(r.reasonCode).toBe('KYC_NOT_VERIFIED');
  });
});

describe('scoreIndustryRisk', () => {
  it('returns null when neither industry nor SIC code is set', () => {
    expect(scoreIndustryRisk(inputs()).score).toBeNull();
  });

  it('prefers an explicit industryRiskScore when present', () => {
    expect(scoreIndustryRisk(inputs({ industry: 'X', industryRiskScore: 73 })).score).toBe(73);
  });

  it('scores a classified borrower at 70 and flags the basis', () => {
    const r = scoreIndustryRisk(inputs({ industry: 'Manufacturing', sicCode: '2599' }));
    expect(r.score).toBe(70);
    expect(r.reasonCode).toBe('CLASSIFICATION_ONLY');
  });

  it('scores industry without a SIC code lower', () => {
    expect(scoreIndustryRisk(inputs({ industry: 'Manufacturing' })).score).toBe(55);
  });
});

describe('scoreRelationshipTenure', () => {
  const NOW = new Date('2026-08-20');

  it('returns null with no tenure signal', () => {
    expect(scoreRelationshipTenure(inputs({ createdAt: NOW }), T, NOW).score).toBeNull();
  });

  it('scores yearsTrading at or above good as 100 before facility bonus', () => {
    const r = scoreRelationshipTenure(inputs({ yearsTrading: 5, createdAt: NOW }), T, NOW);
    expect(r.score).toBe(100);
  });

  it('uses record age when yearsTrading is absent', () => {
    const r = scoreRelationshipTenure(
      inputs({ createdAt: new Date('2021-08-20'), priorFacilityCount: 0 }), T, NOW);
    expect(r.score).toBe(100);
  });

  it('adds a 10-point bonus per prior facility, capped at 100', () => {
    const r = scoreRelationshipTenure(
      inputs({ yearsTrading: 0, createdAt: NOW, priorFacilityCount: 3 }), T, NOW);
    expect(r.score).toBe(30);
    expect(r.reasonCode).toBe('PRIOR_FACILITIES');
  });
});
```

Create `backend/src/credit/services/borrowerRisk/__tests__/factors.registry.test.ts`:

```ts
import { BORROWER_FACTOR_REGISTRY } from '../factors';
import { BORROWER_FACTOR_GROUPS } from '../../scorecard.service';

describe('BORROWER_FACTOR_REGISTRY', () => {
  it('has exactly one function per declared borrower factor', () => {
    expect(Object.keys(BORROWER_FACTOR_REGISTRY).sort()).toEqual([...BORROWER_FACTOR_GROUPS].sort());
  });

  it('exposes only callables', () => {
    for (const fn of Object.values(BORROWER_FACTOR_REGISTRY)) {
      expect(typeof fn).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Run both tests to verify they fail**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/factors.profile.test.ts src/credit/services/borrowerRisk/__tests__/factors.registry.test.ts --silent
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `identity_kyc`**

Create `backend/src/credit/services/borrowerRisk/factors/identityKyc.ts`:

```ts
import { BorrowerRiskInputs, FactorResult } from '../types';

const POINTS_IDENTITY_DOC = 40;
const POINTS_KYC_VERIFIED = 40;
const POINTS_FATCA_CRS = 10;
const POINTS_OWNERSHIP_REGISTER = 10;

/**
 * Completeness and verification of the borrower's identity record. Additive
 * rather than a ramp, because each component is a discrete compliance artefact
 * that either exists or does not.
 */
export function scoreIdentityKyc(inputs: BorrowerRiskInputs): FactorResult {
  const hasAnySignal =
    inputs.hasIdentityDocument ||
    inputs.kycVerifiedAt !== null ||
    inputs.hasFatcaCrsDeclaration ||
    inputs.directorCount > 0 ||
    inputs.shareholderCount > 0 ||
    inputs.uboCount > 0;

  if (!hasAnySignal) return { score: null };

  let score = 0;
  if (inputs.hasIdentityDocument) score += POINTS_IDENTITY_DOC;
  if (inputs.kycVerifiedAt !== null) score += POINTS_KYC_VERIFIED;
  if (inputs.hasFatcaCrsDeclaration) score += POINTS_FATCA_CRS;
  if (inputs.uboCount > 0 || inputs.shareholderCount > 0) score += POINTS_OWNERSHIP_REGISTER;

  return {
    score: Math.min(100, score),
    reasonCode: inputs.kycVerifiedAt === null ? 'KYC_NOT_VERIFIED' : undefined,
  };
}
```

- [ ] **Step 4: Implement `industry_risk`**

Create `backend/src/credit/services/borrowerRisk/factors/industryRisk.ts`:

```ts
import { BorrowerRiskInputs, FactorResult } from '../types';

const SCORE_FULLY_CLASSIFIED = 70;
const SCORE_INDUSTRY_ONLY = 55;

/**
 * Industry standing.
 *
 * There is no borrower-scoped industry risk table yet — IndustryAssessment is
 * application-scoped. Until one exists this factor rewards classification
 * completeness rather than pretending to know sector risk, and returns a
 * reason code saying so. When a table arrives, populate
 * BorrowerRiskInputs.industryRiskScore and this branch takes precedence
 * without any other change.
 */
export function scoreIndustryRisk(inputs: BorrowerRiskInputs): FactorResult {
  if (inputs.industryRiskScore !== null) {
    return { score: inputs.industryRiskScore };
  }

  if (inputs.industry === null && inputs.sicCode === null) {
    return { score: null };
  }

  const score = inputs.sicCode !== null ? SCORE_FULLY_CLASSIFIED : SCORE_INDUSTRY_ONLY;
  return { score, reasonCode: 'CLASSIFICATION_ONLY' };
}
```

- [ ] **Step 5: Implement `relationship_tenure`**

Create `backend/src/credit/services/borrowerRisk/factors/relationshipTenure.ts`:

```ts
import { BorrowerRiskInputs, BorrowerRiskThresholds, FactorResult } from '../types';
import { scoreHigherIsBetter } from '../scale';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const POINTS_PER_PRIOR_FACILITY = 10;

/**
 * Length and depth of the relationship. `now` is injected so the test is not
 * time-dependent.
 */
export function scoreRelationshipTenure(
  inputs: BorrowerRiskInputs,
  thresholds: BorrowerRiskThresholds,
  now: Date = new Date(),
): FactorResult {
  const recordAgeYears = (now.getTime() - inputs.createdAt.getTime()) / MS_PER_YEAR;
  const tenureYears = inputs.yearsTrading ?? (recordAgeYears >= 1 ? recordAgeYears : null);

  if (tenureYears === null && inputs.priorFacilityCount === 0) {
    return { score: null };
  }

  const base =
    tenureYears !== null
      ? scoreHigherIsBetter(tenureYears, thresholds.tenureYears.good, thresholds.tenureYears.bad)
      : 0;

  if (inputs.priorFacilityCount > 0) {
    return {
      score: Math.min(100, base + inputs.priorFacilityCount * POINTS_PER_PRIOR_FACILITY),
      reasonCode: 'PRIOR_FACILITIES',
    };
  }

  return { score: base };
}
```

- [ ] **Step 6: Implement the registry**

Create `backend/src/credit/services/borrowerRisk/factors/index.ts`:

```ts
import { BorrowerRiskInputs, BorrowerRiskThresholds, FactorResult } from '../types';
import { scoreFinancialStanding } from './financialStanding';
import { scoreRepaymentCapacity } from './repaymentCapacity';
import { scoreBureauConduct } from './bureauConduct';
import { scoreComplianceScreening } from './complianceScreening';
import { scoreIdentityKyc } from './identityKyc';
import { scoreIndustryRisk } from './industryRisk';
import { scoreRelationshipTenure } from './relationshipTenure';

export type BorrowerFactorFn = (
  inputs: BorrowerRiskInputs,
  thresholds: BorrowerRiskThresholds,
) => FactorResult;

/**
 * Factor key → derivation function. Adding a factor is one new file plus one
 * line here plus its weight in BORROWER_FACTOR_GROUPS. The registry test
 * asserts these two lists never drift apart.
 */
export const BORROWER_FACTOR_REGISTRY: Record<string, BorrowerFactorFn> = {
  financial_standing: scoreFinancialStanding,
  repayment_capacity: scoreRepaymentCapacity,
  bureau_conduct: scoreBureauConduct,
  identity_kyc: (i) => scoreIdentityKyc(i),
  industry_risk: (i) => scoreIndustryRisk(i),
  relationship_tenure: scoreRelationshipTenure,
  compliance_screening: (i) => scoreComplianceScreening(i),
};
```

- [ ] **Step 7: Run both tests to verify they pass**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/factors.profile.test.ts src/credit/services/borrowerRisk/__tests__/factors.registry.test.ts --silent
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/credit/services/borrowerRisk/factors src/credit/services/borrowerRisk/__tests__
git commit -m "feat(credit): borrower identity_kyc, industry_risk, relationship_tenure factors

Adds the factor registry, with a test asserting it never drifts from
BORROWER_FACTOR_GROUPS."
```

---

### Task 9: Compliance caps — the control that makes sanctions non-dilutable

**The single most important task in this plan.** `compliance_screening` carries only 5% weight; without a cap, a sanctioned borrower with strong financials would rate investment grade.

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/caps.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/caps.test.ts`

**Interfaces:**
- Consumes: `ratingOrdinal`, `RATING_ORDINALS` from `../ratingScale`; `BorrowerRiskInputs` (Task 4)
- Produces:

```ts
export interface BorrowerCapResult {
  effectiveRating: RiskRating;
  capsApplied: string[];
}
export function applyBorrowerRatingCaps(
  baseRating: RiskRating,
  inputs: BorrowerRiskInputs,
): BorrowerCapResult;
```

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/caps.test.ts`. Copy the `inputs()` helper from `factors.financial.test.ts`, then:

```ts
import { applyBorrowerRatingCaps } from '../caps';

describe('applyBorrowerRatingCaps', () => {
  it('leaves a clean borrower untouched', () => {
    const r = applyBorrowerRatingCaps('AA', inputs({ amlRiskTier: 'LOW' }));
    expect(r.effectiveRating).toBe('AA');
    expect(r.capsApplied).toEqual([]);
  });

  it('caps a sanctioned entity at D', () => {
    const r = applyBorrowerRatingCaps('AAA', inputs({ isSanctionedEntity: true }));
    expect(r.effectiveRating).toBe('D');
    expect(r.capsApplied).toContain('SANCTIONED_ENTITY');
  });

  it('caps AML PROHIBITED at D', () => {
    const r = applyBorrowerRatingCaps('A', inputs({ amlRiskTier: 'PROHIBITED' }));
    expect(r.effectiveRating).toBe('D');
    expect(r.capsApplied).toContain('AML_PROHIBITED');
  });

  it('caps AML HIGH at BB', () => {
    const r = applyBorrowerRatingCaps('AAA', inputs({ amlRiskTier: 'HIGH' }));
    expect(r.effectiveRating).toBe('BB');
    expect(r.capsApplied).toContain('AML_HIGH');
  });

  it('never improves a rating that is already worse than the cap', () => {
    const r = applyBorrowerRatingCaps('C', inputs({ amlRiskTier: 'HIGH' }));
    expect(r.effectiveRating).toBe('C');
    expect(r.capsApplied).toEqual([]);
  });

  it('applies the strictest cap when several qualify', () => {
    const r = applyBorrowerRatingCaps(
      'AAA', inputs({ amlRiskTier: 'HIGH', isSanctionedEntity: true }));
    expect(r.effectiveRating).toBe('D');
  });

  it('leaves NR alone — an unrated borrower cannot be capped downward', () => {
    const r = applyBorrowerRatingCaps('NR', inputs({ amlRiskTier: 'HIGH' }));
    expect(r.effectiveRating).toBe('NR');
    expect(r.capsApplied).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/caps.test.ts --silent
```

Expected: FAIL — cannot resolve `../caps`.

- [ ] **Step 3: Implement the caps**

Create `backend/src/credit/services/borrowerRisk/caps.ts`:

```ts
import { RiskRating } from '@prisma/client';
import { ratingOrdinal } from '../ratingScale';
import { BorrowerRiskInputs } from './types';

export interface BorrowerCapResult {
  effectiveRating: RiskRating;
  capsApplied: string[];
}

interface CapRule {
  reason: string;
  maxRating: RiskRating;
  applies: (i: BorrowerRiskInputs) => boolean;
}

/**
 * Hard caps on the borrower rating.
 *
 * compliance_screening carries 5% weight, which is far too little to stop a
 * sanctioned borrower with strong financials from rating investment grade.
 * These caps are the actual control; the factor score only explains it in the
 * breakdown. Caps ONLY ever worsen a rating, mirroring applyBureauCaps().
 *
 * OPEN POLICY ITEM: the AML HIGH → BB cap needs credit-policy sign-off.
 * SANCTIONED_ENTITY and AML_PROHIBITED → D are settled.
 */
const CAP_RULES: CapRule[] = [
  { reason: 'SANCTIONED_ENTITY', maxRating: 'D', applies: (i) => i.isSanctionedEntity },
  { reason: 'AML_PROHIBITED', maxRating: 'D', applies: (i) => i.amlRiskTier === 'PROHIBITED' },
  { reason: 'AML_HIGH', maxRating: 'BB', applies: (i) => i.amlRiskTier === 'HIGH' },
];

export function applyBorrowerRatingCaps(
  baseRating: RiskRating,
  inputs: BorrowerRiskInputs,
): BorrowerCapResult {
  // NR means "not rated". Capping it downward would assert a grade the data
  // does not support, so an unrated borrower passes through untouched.
  if (baseRating === 'NR') {
    return { effectiveRating: 'NR', capsApplied: [] };
  }

  let effective = baseRating;
  const capsApplied: string[] = [];

  for (const rule of CAP_RULES) {
    if (!rule.applies(inputs)) continue;
    // Higher ordinal = worse. A cap only bites when it is worse than current.
    if (ratingOrdinal(rule.maxRating) > ratingOrdinal(effective)) {
      effective = rule.maxRating;
      capsApplied.push(rule.reason);
    }
  }

  return { effectiveRating: effective, capsApplied };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/caps.test.ts --silent
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services/borrowerRisk/caps.ts src/credit/services/borrowerRisk/__tests__/caps.test.ts
git commit -m "feat(credit): hard compliance caps on the borrower rating

Sanctions and AML PROHIBITED cap at D; AML HIGH caps at BB. Caps only ever
worsen, so a 5%-weight factor cannot be diluted by strong financials."
```

---

### Task 10: `computeBorrowerRisk` — the pure core

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/compute.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/compute.test.ts`

**Interfaces:**
- Consumes: `BORROWER_FACTOR_REGISTRY` (Task 8), `applyBorrowerRatingCaps` (Task 9), `resolveMissingFactorScore` + `MissingDataPolicyConfig` from `../missingDataPolicy.service`, `BorrowerRiskResult` (Task 4)
- Produces:

```ts
export function computeBorrowerRisk(args: {
  inputs: BorrowerRiskInputs;
  weights: Record<string, number>;
  thresholds: BorrowerRiskThresholds;
  policies: Record<string, MissingDataPolicyConfig>;
  mapScoreToRating: (score: number) => RiskRating;
}): BorrowerRiskResult;
```

> `mapScoreToRating` is injected as a synchronous function rather than calling the async `mapScoreToRatingFromBands` directly. That is what keeps this function pure and testable without a database; the orchestrator in Task 11 resolves the bands first and passes a closure.

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/compute.test.ts`. Copy `inputs()` and `T` from `factors.financial.test.ts`, then:

```ts
import { computeBorrowerRisk } from '../compute';
import { MissingDataPolicyConfig } from '../../missingDataPolicy.service';

const WEIGHTS = {
  financial_standing: 20,
  repayment_capacity: 20,
  bureau_conduct: 20,
  identity_kyc: 15,
  industry_risk: 10,
  relationship_tenure: 10,
  compliance_screening: 5,
};

const POLICIES: Record<string, MissingDataPolicyConfig> = Object.fromEntries(
  Object.keys(WEIGHTS).map((f) => [
    f, { factor: f, policy: 'PENALTY' as const, penaltyScore: 25, neutralScore: 50 },
  ]),
);

// Simple linear stand-in for RatingBandConfig, so band data is not under test here.
const mapScoreToRating = (s: number) =>
  (s >= 85 ? 'AAA' : s >= 70 ? 'A' : s >= 55 ? 'BB' : s >= 40 ? 'CCC' : 'D') as never;

const run = (over = {}) =>
  computeBorrowerRisk({
    inputs: inputs(over), weights: WEIGHTS, thresholds: T,
    policies: POLICIES, mapScoreToRating,
  });

// A borrower with data on every factor, so coverage is 100%.
const FULLY_COVERED = {
  ratios: { debt_to_equity: 1.0, current_ratio: 2.0, dscr: 2.0 },
  dsrPercent: 30,
  bureauReportCount: 1, bureauScore: 750,
  hasIdentityDocument: true, kycVerifiedAt: new Date('2024-01-01'),
  hasFatcaCrsDeclaration: true, uboCount: 1,
  industry: 'Manufacturing', sicCode: '2599',
  yearsTrading: 10, priorFacilityCount: 1,
  amlRiskTier: 'LOW' as const,
};

describe('computeBorrowerRisk', () => {
  it('scores a fully covered strong borrower at the top of the scale', () => {
    const r = run(FULLY_COVERED);
    expect(r.coveragePercent).toBe(100);
    expect(r.totalScore).toBeGreaterThan(90);
    expect(r.effectiveRiskRating).toBe('AAA');
    expect(r.missingInputs).toEqual([]);
  });

  it('sums weighted contributions to the total', () => {
    const r = run(FULLY_COVERED);
    const summed = Object.values(r.factorScores)
      .reduce((s, f) => s + f.weightedScore, 0);
    expect(r.totalScore).toBeCloseTo(Math.round(summed * 100) / 100, 2);
  });

  it('returns NR / INSUFFICIENT_DATA for an empty borrower', () => {
    const r = run();
    expect(r.coveragePercent).toBe(0);
    expect(r.effectiveRiskRating).toBe('NR');
    expect(r.reasonCodes).toContain('INSUFFICIENT_DATA');
    expect(r.missingInputs).toHaveLength(7);
  });

  it('retains the derived score even when the rating is NR', () => {
    const r = run();
    expect(r.totalScore).toBeGreaterThan(0);
    expect(r.baseRiskRating).not.toBe('NR');
  });

  it('marks hadData false for factors that fell back to policy', () => {
    const r = run({ bureauReportCount: 1, bureauScore: 750 });
    expect(r.factorScores.bureau_conduct.hadData).toBe(true);
    expect(r.factorScores.industry_risk.hadData).toBe(false);
  });

  it('rates just below the coverage floor as NR', () => {
    // bureau 20 + identity 15 + industry 10 = 45% < 50%
    const r = run({
      bureauReportCount: 1, bureauScore: 750,
      hasIdentityDocument: true, industry: 'X', sicCode: '1',
    });
    expect(r.coveragePercent).toBe(45);
    expect(r.effectiveRiskRating).toBe('NR');
  });

  it('rates at exactly the coverage floor as a real grade', () => {
    // financial 20 + bureau 20 + industry 10 = 50%
    const r = run({
      ratios: { debt_to_equity: 1.0 },
      bureauReportCount: 1, bureauScore: 750,
      industry: 'X', sicCode: '1',
    });
    expect(r.coveragePercent).toBe(50);
    expect(r.effectiveRiskRating).not.toBe('NR');
  });

  it('DILUTION TEST: a sanctioned borrower with excellent financials still rates D', () => {
    const r = run({ ...FULLY_COVERED, isSanctionedEntity: true });
    expect(r.baseRiskRating).toBe('AAA');
    expect(r.effectiveRiskRating).toBe('D');
    expect(r.capsApplied).toContain('SANCTIONED_ENTITY');
  });

  it('applies caps after banding, not before', () => {
    const r = run({ ...FULLY_COVERED, amlRiskTier: 'HIGH' as const });
    expect(r.baseRiskRating).toBe('AAA');
    expect(r.effectiveRiskRating).toBe('BB');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/compute.test.ts --silent
```

Expected: FAIL — cannot resolve `../compute`.

- [ ] **Step 3: Implement the compute core**

Create `backend/src/credit/services/borrowerRisk/compute.ts`:

```ts
import { RiskRating } from '@prisma/client';
import {
  MissingDataPolicyConfig,
  MissingInputRecord,
  resolveMissingFactorScore,
} from '../missingDataPolicy.service';
import { BORROWER_FACTOR_REGISTRY } from './factors';
import { applyBorrowerRatingCaps } from './caps';
import {
  BorrowerFactorScoreDetail,
  BorrowerRiskInputs,
  BorrowerRiskResult,
  BorrowerRiskThresholds,
} from './types';

export interface ComputeBorrowerRiskArgs {
  inputs: BorrowerRiskInputs;
  weights: Record<string, number>;
  thresholds: BorrowerRiskThresholds;
  policies: Record<string, MissingDataPolicyConfig>;
  /** Injected synchronously so this function stays pure. See Task 11. */
  mapScoreToRating: (score: number) => RiskRating;
}

/**
 * Pure borrower-risk computation.
 *
 * Order matters: derive → missing-data policy → weight → band → cap. Caps are
 * applied to the banded grade, never to the raw score, so capsApplied reads as
 * a grade-level statement in the audit record.
 */
export function computeBorrowerRisk(args: ComputeBorrowerRiskArgs): BorrowerRiskResult {
  const { inputs, weights, thresholds, policies, mapScoreToRating } = args;

  const factorScores: Record<string, BorrowerFactorScoreDetail> = {};
  const missingInputs: MissingInputRecord[] = [];
  const reasonCodes: string[] = [];

  let totalScore = 0;
  let coveredWeight = 0;
  let totalWeight = 0;

  for (const [factor, derive] of Object.entries(BORROWER_FACTOR_REGISTRY)) {
    const weight = weights[factor] ?? 0;
    totalWeight += weight;

    const result = derive(inputs, thresholds);
    let score: number;
    let hadData: boolean;

    if (result.score === null) {
      const resolved = resolveMissingFactorScore(factor, 'borrower_data', policies);
      score = resolved.score;
      missingInputs.push(resolved.record);
      hadData = false;
    } else {
      score = result.score;
      coveredWeight += weight;
      hadData = true;
      if (result.reasonCode) reasonCodes.push(result.reasonCode);
    }

    const weightedScore = (score * weight) / 100;
    totalScore += weightedScore;
    factorScores[factor] = {
      weight,
      score: Math.round(score * 100) / 100,
      weightedScore: Math.round(weightedScore * 100) / 100,
      hadData,
    };
  }

  totalScore = Math.round(totalScore * 100) / 100;

  const coveragePercent =
    totalWeight === 0 ? 0 : Math.round((coveredWeight / totalWeight) * 10000) / 100;

  const baseRiskRating = mapScoreToRating(totalScore);

  // Data-coverage floor. Below it the derived score is retained for reference
  // but the effective rating is NR — a thin borrower is unrated, not bad.
  if (coveragePercent < thresholds.coverageFloorPercent) {
    reasonCodes.push('INSUFFICIENT_DATA');
    return {
      factorScores,
      totalScore,
      baseRiskRating,
      effectiveRiskRating: 'NR' as RiskRating,
      capsApplied: [],
      missingInputs,
      reasonCodes,
      coveragePercent,
    };
  }

  const { effectiveRating, capsApplied } = applyBorrowerRatingCaps(baseRiskRating, inputs);

  return {
    factorScores,
    totalScore,
    baseRiskRating,
    effectiveRiskRating: effectiveRating,
    capsApplied,
    missingInputs,
    reasonCodes: [...reasonCodes, ...capsApplied],
    coveragePercent,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/compute.test.ts --silent
```

Expected: PASS, 10 tests — including the dilution test.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services/borrowerRisk/compute.ts src/credit/services/borrowerRisk/__tests__/compute.test.ts
git commit -m "feat(credit): computeBorrowerRisk pure scoring core

Derive, apply missing-data policy, weight, band, then cap. Includes the
dilution test: a sanctioned borrower with excellent financials rates D."
```

---

### Task 11: Persistence refactor and the assessment orchestrator

Repairs the existing stub's `totalScore` / `factorScores` disagreement by making persistence dumb, then adds the transaction.

**Files:**
- Modify: `backend/src/credit/services/borrowerRisk.service.ts` (replace `createBorrowerRiskRun`)
- Create: `backend/src/credit/services/borrowerRisk/assess.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/assess.test.ts`

**Interfaces:**
- Consumes: `loadBorrowerRiskInputs` (Task 5), `getBorrowerRiskThresholds` (Task 4), `computeBorrowerRisk` (Task 10), `getMissingDataPolicies`, `mapScoreToRatingFromBands`, `ratingBandService.getActiveBandSetVersion`
- Produces:
  - `persistBorrowerRiskRun(tx, borrowerProfileId, result, opts): Promise<{ id: string }>` — no computation, writes what it is given
  - `runBorrowerRiskAssessment(borrowerProfileId, opts?): Promise<BorrowerRiskAssessmentOutcome>` where

```ts
export type BorrowerRiskAssessmentOutcome =
  | { status: 'COMPLETED'; runId: string; result: BorrowerRiskResult }
  | { status: 'SKIPPED'; reason: 'BORROWER_NOT_FOUND' | 'NO_ACTIVE_BORROWER_SCORECARD' | 'NO_ACTIVE_RATING_BANDS' };
```

- [ ] **Step 1: Replace `createBorrowerRiskRun` with dumb persistence**

In `backend/src/credit/services/borrowerRisk.service.ts`, delete the entire `createBorrowerRiskRun` function and replace it with:

```ts
/**
 * Persist an already-computed borrower risk result. Deliberately performs NO
 * computation.
 *
 * The previous createBorrowerRiskRun() called computeWeightedRisk() internally
 * while accepting baseRiskRating from its caller, and stored totalScore as a
 * raw unweighted sum of input scores. That made totalScore and factorScores
 * disagree by construction. Persistence is now dumb, so they cannot diverge.
 */
export async function persistBorrowerRiskRun(
  tx: { borrowerRiskRun: { create: (a: unknown) => Promise<{ id: string }> } },
  borrowerProfileId: string,
  result: BorrowerRiskResult,
  opts: {
    scorecardVersionId?: string | null;
    scorecardVersion?: number | null;
    ratingBandVersion?: number | null;
    calculationSource?: string;
    calculatedById?: string | null;
  } = {},
): Promise<{ id: string }> {
  return tx.borrowerRiskRun.create({
    data: {
      borrowerProfileId,
      scorecardVersionId: opts.scorecardVersionId ?? null,
      scorecardVersion: opts.scorecardVersion ?? null,
      factorScores: result.factorScores as never,
      totalScore: new Prisma.Decimal(result.totalScore),
      baseRiskRating: result.baseRiskRating,
      effectiveRiskRating: result.effectiveRiskRating,
      bureauCapsApplied: result.capsApplied.length > 0 ? (result.capsApplied as never) : undefined,
      reasonCodes: result.reasonCodes.length > 0 ? (result.reasonCodes as never) : undefined,
      missingInputs: result.missingInputs.length > 0 ? (result.missingInputs as never) : undefined,
      ratingBandVersion: opts.ratingBandVersion ?? null,
      calculationSource: opts.calculationSource ?? 'SYSTEM',
      calculatedById: opts.calculatedById ?? null,
    },
  });
}
```

Add to the file's imports: `import { Prisma } from '@prisma/client';` and `import { BorrowerRiskResult } from './borrowerRisk/types';`. Leave `getBorrowerRiskHistory` and `getLatestBorrowerRiskRun` untouched — the two GET endpoints depend on them.

- [ ] **Step 2: Write the failing orchestrator test**

Create `backend/src/credit/services/borrowerRisk/__tests__/assess.test.ts`:

```ts
const mockTx = {
  borrowerRiskRun: { create: jest.fn() },
  borrowerProfile: { update: jest.fn() },
  borrowerActivity: { create: jest.fn() },
};
const mockTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(mockTx));
const mockScorecardFindFirst = jest.fn();

jest.mock('../../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
    creditScorecardVersion: { findFirst: (...a: unknown[]) => mockScorecardFindFirst(...a) },
  },
}));

const mockLoadInputs = jest.fn();
jest.mock('../loadInputs', () => ({ loadBorrowerRiskInputs: (...a: unknown[]) => mockLoadInputs(...a) }));

jest.mock('../../missingDataPolicy.service', () => ({
  getMissingDataPolicies: jest.fn().mockResolvedValue({}),
  resolveMissingFactorScore: (factor: string) => ({
    score: 25,
    record: { factor, subField: 'borrower_data', policy: 'PENALTY', appliedScore: 25 },
  }),
}));

jest.mock('../../ratingBand.service', () => ({
  mapScoreToRatingFromBands: jest.fn().mockResolvedValue('A'),
  ratingBandService: { getActiveBandSetVersion: jest.fn().mockResolvedValue(3) },
}));

import { runBorrowerRiskAssessment } from '../assess';

const SCORECARD = {
  id: 'ver-1', version: 2,
  factorWeights: {
    financial_standing: 20, repayment_capacity: 20, bureau_conduct: 20,
    identity_kyc: 15, industry_risk: 10, relationship_tenure: 10,
    compliance_screening: 5,
  },
};

const INPUTS = {
  borrowerProfileId: 'b1', borrowerType: 'CORPORATE', createdAt: new Date('2015-01-01'),
  ratios: { debt_to_equity: 1.0, current_ratio: 2.0 }, annualIncome: null, netWorth: null,
  annualTurnover: 8_000_000, yearsTrading: 10, dsrPercent: 30, netDsrPercent: null,
  dsrBasis: 'GROSS', bureauScore: 750, bureauReportCount: 1, bureauArrearsCount: 0,
  kycVerifiedAt: new Date('2024-01-01'), hasIdentityDocument: true,
  hasFatcaCrsDeclaration: true, directorCount: 2, shareholderCount: 1, uboCount: 1,
  industry: 'Manufacturing', sicCode: '2599', industryRiskScore: null,
  amlRiskTier: 'LOW', isSanctionedEntity: false, adverseRescreenCount: 0,
  priorFacilityCount: 2,
};

describe('runBorrowerRiskAssessment', () => {
  beforeEach(() => {
    Object.values(mockTx).forEach((m) => Object.values(m).forEach((f) => (f as jest.Mock).mockReset()));
    mockTransaction.mockClear();
    mockLoadInputs.mockReset();
    mockScorecardFindFirst.mockReset();
    mockTx.borrowerRiskRun.create.mockResolvedValue({ id: 'run-1' });
    mockScorecardFindFirst.mockResolvedValue(SCORECARD);
    mockLoadInputs.mockResolvedValue(INPUTS);
  });

  it('skips when the borrower does not exist', async () => {
    mockLoadInputs.mockResolvedValue(null);
    const out = await runBorrowerRiskAssessment('nope');
    expect(out).toEqual({ status: 'SKIPPED', reason: 'BORROWER_NOT_FOUND' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('skips fail-soft when no BORROWER-scoped scorecard is active', async () => {
    mockScorecardFindFirst.mockResolvedValue(null);
    const out = await runBorrowerRiskAssessment('b1');
    expect(out).toEqual({ status: 'SKIPPED', reason: 'NO_ACTIVE_BORROWER_SCORECARD' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('queries only BORROWER-scoped scorecards', async () => {
    await runBorrowerRiskAssessment('b1');
    expect(mockScorecardFindFirst.mock.calls[0][0].where.scorecard.scope).toBe('BORROWER');
  });

  it('writes the run, the denormalised rating and the activity in one transaction', async () => {
    const out = await runBorrowerRiskAssessment('b1', { calculatedById: 'u1' });
    expect(out.status).toBe('COMPLETED');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTx.borrowerRiskRun.create).toHaveBeenCalledTimes(1);
    expect(mockTx.borrowerProfile.update).toHaveBeenCalledTimes(1);
    expect(mockTx.borrowerActivity.create).toHaveBeenCalledTimes(1);

    const update = mockTx.borrowerProfile.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'b1' });
    expect(update.data.creditRiskRating).toBe('A');
    expect(update.data.riskRatingCalculatedAt).toBeInstanceOf(Date);
    expect(update.data.riskRatingVersion).toBe(2);
  });

  it('records provenance on the run', async () => {
    await runBorrowerRiskAssessment('b1');
    const data = mockTx.borrowerRiskRun.create.mock.calls[0][0].data;
    expect(data.scorecardVersionId).toBe('ver-1');
    expect(data.scorecardVersion).toBe(2);
    expect(data.ratingBandVersion).toBe(3);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/assess.test.ts --silent
```

Expected: FAIL — cannot resolve `../assess`.

- [ ] **Step 4: Implement the orchestrator**

Create `backend/src/credit/services/borrowerRisk/assess.ts`:

```ts
import { RiskRating, ScorecardScope } from '@prisma/client';
import prisma from '../../../utils/prisma';
import { getMissingDataPolicies } from '../missingDataPolicy.service';
import { mapScoreToRatingFromBands, ratingBandService } from '../ratingBand.service';
import { persistBorrowerRiskRun } from '../borrowerRisk.service';
import { loadBorrowerRiskInputs } from './loadInputs';
import { getBorrowerRiskThresholds } from './thresholds';
import { computeBorrowerRisk } from './compute';
import { BorrowerRiskResult } from './types';

export type BorrowerRiskAssessmentOutcome =
  | { status: 'COMPLETED'; runId: string; result: BorrowerRiskResult }
  | {
      status: 'SKIPPED';
      reason: 'BORROWER_NOT_FOUND' | 'NO_ACTIVE_BORROWER_SCORECARD' | 'NO_ACTIVE_RATING_BANDS';
    };

/**
 * Derive and persist a borrower risk rating.
 *
 * Every "cannot proceed" condition is a SKIPPED outcome rather than a thrown
 * error: the rating is informational, so its absence must never fail a
 * borrower write. Only genuine faults propagate, and the dispatcher in
 * recalc.ts catches those too.
 */
export async function runBorrowerRiskAssessment(
  borrowerProfileId: string,
  opts: { calculatedById?: string | null; calculationSource?: string } = {},
): Promise<BorrowerRiskAssessmentOutcome> {
  const inputs = await loadBorrowerRiskInputs(borrowerProfileId);
  if (!inputs) return { status: 'SKIPPED', reason: 'BORROWER_NOT_FOUND' };

  const now = new Date();
  const scorecardVersion = await prisma.creditScorecardVersion.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      scorecard: { scope: ScorecardScope.BORROWER },
    },
    orderBy: { version: 'desc' },
  });
  if (!scorecardVersion) {
    return { status: 'SKIPPED', reason: 'NO_ACTIVE_BORROWER_SCORECARD' };
  }

  const [thresholds, policies, ratingBandVersion] = await Promise.all([
    getBorrowerRiskThresholds(),
    getMissingDataPolicies(),
    ratingBandService.getActiveBandSetVersion(),
  ]);

  // Resolve the band mapping once, then hand computeBorrowerRisk a synchronous
  // closure so the core stays pure.
  const bandCache = new Map<number, RiskRating | null>();
  const preResolve = async (score: number) => {
    if (!bandCache.has(score)) bandCache.set(score, await mapScoreToRatingFromBands(score));
    return bandCache.get(score) ?? null;
  };

  // Two-pass: compute the total with a placeholder mapper, resolve the real
  // grade for that total, then recompute so factorScores and the grade agree.
  const provisional = computeBorrowerRisk({
    inputs, weights: scorecardVersion.factorWeights as Record<string, number>,
    thresholds, policies, mapScoreToRating: () => 'NR' as RiskRating,
  });
  const resolved = await preResolve(provisional.totalScore);
  if (!resolved) return { status: 'SKIPPED', reason: 'NO_ACTIVE_RATING_BANDS' };

  const result = computeBorrowerRisk({
    inputs, weights: scorecardVersion.factorWeights as Record<string, number>,
    thresholds, policies, mapScoreToRating: () => resolved,
  });

  const runId = await prisma.$transaction(async (tx) => {
    const run = await persistBorrowerRiskRun(tx as never, borrowerProfileId, result, {
      scorecardVersionId: scorecardVersion.id,
      scorecardVersion: scorecardVersion.version,
      ratingBandVersion,
      calculationSource: opts.calculationSource ?? 'SYSTEM',
      calculatedById: opts.calculatedById ?? null,
    });

    await (tx as never as typeof prisma).borrowerProfile.update({
      where: { id: borrowerProfileId },
      data: {
        creditRiskRating: result.effectiveRiskRating,
        riskRatingCalculatedAt: new Date(),
        riskRatingVersion: scorecardVersion.version,
      },
    });

    await (tx as never as typeof prisma).borrowerActivity.create({
      data: {
        borrowerId: borrowerProfileId,
        type: 'RISK_RATING_CALCULATED',
        title: `Risk rating ${result.effectiveRiskRating}`,
        detail:
          `Score ${result.totalScore}, data coverage ${result.coveragePercent}%` +
          (result.capsApplied.length ? `, capped: ${result.capsApplied.join(', ')}` : ''),
        actorId: opts.calculatedById ?? null,
      },
    });

    return run.id;
  });

  return { status: 'COMPLETED', runId, result };
}
```

- [ ] **Step 5: Run the assess test and the existing borrower-risk separation test**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/assess.test.ts --silent
npx jest src/credit/services/__tests__/borrowerRiskSeparation.test.ts --silent
```

Expected: assess PASS. The separation test asserts the exported function names of `borrowerRisk.service` — it will FAIL because `createBorrowerRiskRun` no longer exists. Update its expected export list to `['persistBorrowerRiskRun', 'getBorrowerRiskHistory', 'getLatestBorrowerRiskRun']`, preserving every other assertion in that file.

- [ ] **Step 6: Commit**

```bash
git add src/credit/services/borrowerRisk.service.ts src/credit/services/borrowerRisk/assess.ts src/credit/services/borrowerRisk/__tests__/assess.test.ts src/credit/services/__tests__/borrowerRiskSeparation.test.ts
git commit -m "feat(credit): borrower risk assessment orchestrator

Persistence is now dumb, fixing the totalScore/factorScores disagreement in
the old stub. Run insert, rating denormalisation and activity entry commit or
roll back together. Every cannot-proceed condition is a SKIPPED outcome, never
a throw, so a borrower write is never blocked."
```

---

### Task 12: The recalculation dispatcher

**Files:**
- Create: `backend/src/credit/services/borrowerRisk/recalc.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/recalc.test.ts`

**Interfaces:**
- Consumes: `runBorrowerRiskAssessment` (Task 11)
- Produces:

```ts
export interface BorrowerRecalcResult {
  recalculated: boolean;
  runId?: string;
  reason?: string;
  error?: string;
}
export function recalcBorrowerRisk(
  borrowerProfileId: string,
  reason: string,
  opts?: { sourceUpdatedAt?: Date; calculatedById?: string | null },
): Promise<BorrowerRecalcResult>;
```

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/recalc.test.ts`:

```ts
const mockRunFindFirst = jest.fn();
const mockActivityCreate = jest.fn();

jest.mock('../../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerRiskRun: { findFirst: (...a: unknown[]) => mockRunFindFirst(...a) },
    borrowerActivity: { create: (...a: unknown[]) => mockActivityCreate(...a) },
  },
}));

const mockAssess = jest.fn();
jest.mock('../assess', () => ({ runBorrowerRiskAssessment: (...a: unknown[]) => mockAssess(...a) }));

import { recalcBorrowerRisk } from '../recalc';

describe('recalcBorrowerRisk', () => {
  beforeEach(() => {
    mockRunFindFirst.mockReset();
    mockActivityCreate.mockReset();
    mockAssess.mockReset();
    mockRunFindFirst.mockResolvedValue(null);
    mockAssess.mockResolvedValue({ status: 'COMPLETED', runId: 'run-9', result: {} });
  });

  it('recalculates when there is no prior run', async () => {
    const r = await recalcBorrowerRisk('b1', 'profile_update');
    expect(r).toEqual({ recalculated: true, runId: 'run-9' });
  });

  it('skips when the latest run already post-dates the change', async () => {
    mockRunFindFirst.mockResolvedValue({ id: 'old', runAt: new Date('2026-08-20T10:00:00Z') });
    const r = await recalcBorrowerRisk('b1', 'profile_update', {
      sourceUpdatedAt: new Date('2026-08-20T09:00:00Z'),
    });
    expect(r.recalculated).toBe(false);
    expect(mockAssess).not.toHaveBeenCalled();
  });

  it('recalculates when the change is newer than the latest run', async () => {
    mockRunFindFirst.mockResolvedValue({ id: 'old', runAt: new Date('2026-08-20T09:00:00Z') });
    const r = await recalcBorrowerRisk('b1', 'profile_update', {
      sourceUpdatedAt: new Date('2026-08-20T10:00:00Z'),
    });
    expect(r.recalculated).toBe(true);
  });

  it('always recalculates when no sourceUpdatedAt is supplied', async () => {
    mockRunFindFirst.mockResolvedValue({ id: 'old', runAt: new Date('2030-01-01') });
    const r = await recalcBorrowerRisk('b1', 'manual');
    expect(r.recalculated).toBe(true);
  });

  it('reports a SKIPPED assessment without treating it as an error', async () => {
    mockAssess.mockResolvedValue({ status: 'SKIPPED', reason: 'NO_ACTIVE_BORROWER_SCORECARD' });
    const r = await recalcBorrowerRisk('b1', 'profile_update');
    expect(r).toEqual({ recalculated: false, reason: 'NO_ACTIVE_BORROWER_SCORECARD' });
    expect(mockActivityCreate).not.toHaveBeenCalled();
  });

  it('never throws, and records a failure activity — unlike G-08', async () => {
    mockAssess.mockRejectedValue(new Error('derivation exploded'));
    const r = await recalcBorrowerRisk('b1', 'profile_update');
    expect(r.recalculated).toBe(false);
    expect(r.error).toContain('derivation exploded');
    expect(mockActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockActivityCreate.mock.calls[0][0].data.type).toBe('RISK_RECALC_FAILED');
  });

  it('survives a failure to record the failure', async () => {
    mockAssess.mockRejectedValue(new Error('boom'));
    mockActivityCreate.mockRejectedValue(new Error('activity write failed'));
    await expect(recalcBorrowerRisk('b1', 'profile_update')).resolves.toMatchObject({
      recalculated: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/recalc.test.ts --silent
```

Expected: FAIL — cannot resolve `../recalc`.

- [ ] **Step 3: Implement the dispatcher**

Create `backend/src/credit/services/borrowerRisk/recalc.ts`:

```ts
import prisma from '../../../utils/prisma';
import { logger } from '../../../utils/logger';
import { runBorrowerRiskAssessment } from './assess';

export interface BorrowerRecalcResult {
  recalculated: boolean;
  runId?: string;
  reason?: string;
  error?: string;
}

/**
 * Dispatch a borrower risk recalculation after a material data change.
 *
 * Non-blocking by design: a derivation failure must never fail the operator's
 * save. Unlike the application-side recalc (audit gap G-08) a failure is not
 * swallowed into a log line — it writes a RISK_RECALC_FAILED activity so the
 * staleness badge on Borrower 360 can surface it.
 */
export async function recalcBorrowerRisk(
  borrowerProfileId: string,
  reason: string,
  opts: { sourceUpdatedAt?: Date; calculatedById?: string | null } = {},
): Promise<BorrowerRecalcResult> {
  try {
    if (opts.sourceUpdatedAt) {
      const latest = await prisma.borrowerRiskRun.findFirst({
        where: { borrowerProfileId },
        orderBy: { runAt: 'desc' },
        select: { id: true, runAt: true },
      });
      if (latest && latest.runAt >= opts.sourceUpdatedAt) {
        return {
          recalculated: false,
          reason: `Latest borrower risk run is newer than the triggering change (${reason})`,
        };
      }
    }

    const outcome = await runBorrowerRiskAssessment(borrowerProfileId, {
      calculatedById: opts.calculatedById ?? null,
      calculationSource: 'SYSTEM',
    });

    if (outcome.status === 'SKIPPED') {
      logger.info(`[BorrowerRisk] Skipped for ${borrowerProfileId} (${reason}): ${outcome.reason}`);
      return { recalculated: false, reason: outcome.reason };
    }

    logger.info(
      `[BorrowerRisk] Recalculated ${borrowerProfileId} (${reason}): run ${outcome.runId}, ` +
        `rating ${outcome.result.effectiveRiskRating}, coverage ${outcome.result.coveragePercent}%`,
    );
    return { recalculated: true, runId: outcome.runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[BorrowerRisk] Failed for ${borrowerProfileId} (${reason}): ${message}`);

    // Make the failure visible rather than log-only. Best effort — if even
    // this write fails we still must not throw into the caller's save.
    try {
      await prisma.borrowerActivity.create({
        data: {
          borrowerId: borrowerProfileId,
          type: 'RISK_RECALC_FAILED',
          title: 'Risk rating could not be recalculated',
          detail: `${reason}: ${message}`.slice(0, 500),
          actorId: opts.calculatedById ?? null,
        },
      });
    } catch (activityErr) {
      logger.error(
        `[BorrowerRisk] Could not record recalc failure for ${borrowerProfileId}`,
        activityErr,
      );
    }

    return { recalculated: false, error: message };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/recalc.test.ts --silent
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services/borrowerRisk/recalc.ts src/credit/services/borrowerRisk/__tests__/recalc.test.ts
git commit -m "feat(credit): borrower risk recalc dispatcher

Idempotent against sourceUpdatedAt, never throws into the caller, and records
RISK_RECALC_FAILED so a failed recalc is visible rather than log-only."
```

---

### Task 13: Wire the seven triggers

**Files:**
- Modify: `backend/src/credit/services/borrowerProfile.service.ts`, `borrowerCreditData.service.ts`, `financial.service.ts`, `bureauCheck.service.ts`, `amlRescreen.service.ts`, `director.service.ts`, `shareholder.service.ts`, `ubo.service.ts`, `fatcaCrs.service.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/recalc.hooks.test.ts`

**Interfaces:**
- Consumes: `recalcBorrowerRisk` (Task 12)
- Produces: nothing new. Follow the existing `recalcScore` call convention in those files — a fire-and-forget call, not awaited, placed after the write commits.

- [ ] **Step 1: Write the failing hook test**

Create `backend/src/credit/services/borrowerRisk/__tests__/recalc.hooks.test.ts`. This test asserts each module *dispatches*, mirroring the existing `services/__tests__/recalc.hooks.test.ts` pattern:

```ts
const mockRecalc = jest.fn().mockResolvedValue({ recalculated: true });
jest.mock('../recalc', () => ({ recalcBorrowerRisk: (...a: unknown[]) => mockRecalc(...a) }));

import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICES_DIR = join(__dirname, '..', '..');

const TRIGGERS: { file: string; reason: string }[] = [
  { file: 'borrowerProfile.service.ts', reason: 'borrower_profile_write' },
  { file: 'borrowerCreditData.service.ts', reason: 'borrower_income_save' },
  { file: 'financial.service.ts', reason: 'financial_statement_approval' },
  { file: 'bureauCheck.service.ts', reason: 'bureau_report_update' },
  { file: 'amlRescreen.service.ts', reason: 'aml_rescreen_outcome' },
  { file: 'director.service.ts', reason: 'director_change' },
  { file: 'shareholder.service.ts', reason: 'shareholder_change' },
  { file: 'ubo.service.ts', reason: 'ubo_change' },
  { file: 'fatcaCrs.service.ts', reason: 'fatca_crs_declaration' },
];

describe('borrower risk recalc triggers', () => {
  it.each(TRIGGERS)('$file imports recalcBorrowerRisk', ({ file }) => {
    const src = readFileSync(join(SERVICES_DIR, file), 'utf8');
    expect(src).toMatch(/recalcBorrowerRisk/);
  });

  it.each(TRIGGERS)('$file dispatches with reason "$reason"', ({ file, reason }) => {
    const src = readFileSync(join(SERVICES_DIR, file), 'utf8');
    expect(src).toContain(`'${reason}'`);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/recalc.hooks.test.ts --silent
```

Expected: FAIL — none of the nine files reference `recalcBorrowerRisk`.

- [ ] **Step 3: Add the dispatch to each service**

In each of the nine files, add the import:

```ts
import { recalcBorrowerRisk } from './borrowerRisk/recalc';
```

Then, immediately after the write that changes borrower data commits, add a non-awaited dispatch. Use the borrower id available in that scope. The pattern, shown for `borrowerProfile.service.ts` inside `updateBorrowerProfile` after the update returns:

```ts
    // Borrower risk is informational — never await, never let it fail the save.
    void recalcBorrowerRisk(updated.id, 'borrower_profile_write', {
      sourceUpdatedAt: updated.updatedAt,
      calculatedById: options?.userId ?? null,
    });
```

Add the same call in `createBorrowerProfile` after the profile is created, so a new borrower immediately gets its `NR / INSUFFICIENT_DATA` run:

```ts
    void recalcBorrowerRisk(created.id, 'borrower_profile_write', {
      calculatedById: options?.userId ?? null,
    });
```

For the remaining eight files use these reasons and resolve the borrower id from the record already in hand — in `financial.service.ts` and `bureauCheck.service.ts` the statement/report row carries `borrowerProfileId`; in `borrowerCreditData.service.ts` it is `borrowerId`; the director, shareholder, UBO and FATCA/CRS services all carry `borrowerProfileId` on the row they just wrote:

| File | Reason string |
| --- | --- |
| `borrowerCreditData.service.ts` | `'borrower_income_save'` |
| `financial.service.ts` | `'financial_statement_approval'` |
| `bureauCheck.service.ts` | `'bureau_report_update'` |
| `amlRescreen.service.ts` | `'aml_rescreen_outcome'` |
| `director.service.ts` | `'director_change'` |
| `shareholder.service.ts` | `'shareholder_change'` |
| `ubo.service.ts` | `'ubo_change'` |
| `fatcaCrs.service.ts` | `'fatca_crs_declaration'` |

In `financial.service.ts` place the call next to the existing `recalcScore(app.id, 'financial_statement_approval', ...)` at line 688, so both the application and the borrower rating refresh from the same event.

- [ ] **Step 4: Run the hook test and the whole credit service suite**

```bash
npx jest src/credit/services/borrowerRisk --silent
npx jest src/credit/services/__tests__ --silent 2>&1 | tail -20
```

Expected: borrowerRisk PASS. The broader service suite must show no new failures — a non-awaited `void` call should not alter any existing assertion. If a test now fails on an unexpected Prisma call, mock `./borrowerRisk/recalc` in that test file rather than removing the dispatch.

- [ ] **Step 5: Commit**

```bash
git add src/credit/services
git commit -m "feat(credit): dispatch borrower risk recalc from seven data-change paths

Non-awaited so a rating failure can never block a borrower write. A newly
created borrower gets an immediate NR/INSUFFICIENT_DATA run."
```

---

### Task 14: Manual recalculation endpoint

Deliberately an operational tool, not the primary path — it must not recreate the "find the button" problem.

**Files:**
- Modify: `backend/src/credit/controllers/borrowerRisk.controller.ts`, `backend/src/credit/routes/borrowerRisk.routes.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/recalcEndpoint.test.ts`

**Interfaces:**
- Consumes: `runBorrowerRiskAssessment` (Task 11)
- Produces: `POST /api/v1/credit/borrower-profiles/:borrowerProfileId/risk-recalc`, permission `credit:score`, handler `recalcBorrowerRiskHandler`

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/recalcEndpoint.test.ts`:

```ts
const mockAssess = jest.fn();
jest.mock('../assess', () => ({ runBorrowerRiskAssessment: (...a: unknown[]) => mockAssess(...a) }));

import { recalcBorrowerRiskHandler } from '../../../controllers/borrowerRisk.controller';

function res() {
  const r: Record<string, jest.Mock> = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r as never as { status: jest.Mock; json: jest.Mock };
}

describe('recalcBorrowerRiskHandler', () => {
  beforeEach(() => mockAssess.mockReset());

  it('returns 200 with the run id on success', async () => {
    mockAssess.mockResolvedValue({
      status: 'COMPLETED', runId: 'run-1',
      result: { effectiveRiskRating: 'A', totalScore: 78.5, coveragePercent: 85 },
    });
    const r = res();
    await recalcBorrowerRiskHandler(
      { params: { borrowerProfileId: 'b1' }, user: { id: 'u1' } } as never, r as never, jest.fn(),
    );
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0].data).toMatchObject({ runId: 'run-1', riskRating: 'A' });
  });

  it('passes the acting user through as calculatedById with source MANUAL', async () => {
    mockAssess.mockResolvedValue({ status: 'COMPLETED', runId: 'r', result: {} });
    await recalcBorrowerRiskHandler(
      { params: { borrowerProfileId: 'b1' }, user: { id: 'u9' } } as never, res() as never, jest.fn(),
    );
    expect(mockAssess).toHaveBeenCalledWith('b1', {
      calculatedById: 'u9', calculationSource: 'MANUAL',
    });
  });

  it('returns 404 when the borrower does not exist', async () => {
    mockAssess.mockResolvedValue({ status: 'SKIPPED', reason: 'BORROWER_NOT_FOUND' });
    const r = res();
    await recalcBorrowerRiskHandler(
      { params: { borrowerProfileId: 'b1' }, user: { id: 'u1' } } as never, r as never, jest.fn(),
    );
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 with an actionable message when no borrower scorecard is active', async () => {
    mockAssess.mockResolvedValue({ status: 'SKIPPED', reason: 'NO_ACTIVE_BORROWER_SCORECARD' });
    const r = res();
    await recalcBorrowerRiskHandler(
      { params: { borrowerProfileId: 'b1' }, user: { id: 'u1' } } as never, r as never, jest.fn(),
    );
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0].message).toMatch(/borrower-scoped scorecard/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/recalcEndpoint.test.ts --silent
```

Expected: FAIL — `recalcBorrowerRiskHandler` is not exported.

- [ ] **Step 3: Add the controller handler**

Append to `backend/src/credit/controllers/borrowerRisk.controller.ts`:

```ts
import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { runBorrowerRiskAssessment } from '../services/borrowerRisk/assess';

/**
 * POST /borrower-profiles/:borrowerProfileId/risk-recalc
 *
 * Operational tool, not the normal path. Borrower ratings recalculate on their
 * own whenever borrower data changes; this exists for when derivation logic
 * changed or a dispatched recalc failed.
 */
export async function recalcBorrowerRiskHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { borrowerProfileId } = req.params;
    const outcome = await runBorrowerRiskAssessment(borrowerProfileId, {
      calculatedById: req.user?.id ?? null,
      calculationSource: 'MANUAL',
    });

    if (outcome.status === 'SKIPPED') {
      if (outcome.reason === 'BORROWER_NOT_FOUND') {
        res.status(404).json({ status: 'error', message: 'Borrower profile not found' });
        return;
      }
      if (outcome.reason === 'NO_ACTIVE_BORROWER_SCORECARD') {
        res.status(409).json({
          status: 'error',
          code: outcome.reason,
          message:
            'No active borrower-scoped scorecard. Activate one in Scorecard Management before ' +
            'calculating borrower ratings.',
        });
        return;
      }
      res.status(409).json({
        status: 'error',
        code: outcome.reason,
        message: 'No active rating band configuration. Seed the canonical bands first.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        runId: outcome.runId,
        riskRating: outcome.result.effectiveRiskRating,
        totalScore: outcome.result.totalScore,
        coveragePercent: outcome.result.coveragePercent,
      },
    });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 4: Register the route**

In `backend/src/credit/routes/borrowerRisk.routes.ts`, add `recalcBorrowerRiskHandler` to the existing import from the controller, then add below the two GET routes:

```ts
// Operational recalculation. Ratings normally refresh automatically on data
// change; this is for logic changes and failed dispatches.
router.post(
  '/borrower-profiles/:borrowerProfileId/risk-recalc',
  authenticate,
  requirePermission('credit:score'),
  recalcBorrowerRiskHandler,
);
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/recalcEndpoint.test.ts --silent
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/credit/controllers/borrowerRisk.controller.ts src/credit/routes/borrowerRisk.routes.ts src/credit/services/borrowerRisk/__tests__/recalcEndpoint.test.ts
git commit -m "feat(credit): manual borrower risk recalculation endpoint

Guarded by credit:score. Returns actionable 409s naming the missing
configuration rather than a generic failure."
```

---

### Task 15: Borrower identity invariants (G-02, G-03)

Closes the unvalidated PATCH path and the empty JOINT profile hole.

**Files:**
- Create: `backend/src/credit/services/borrowerIdentityInvariants.ts`
- Modify: `backend/src/credit/services/borrowerProfile.service.ts:734` (create), `:889` (update)
- Test: `backend/src/credit/services/__tests__/borrowerIdentityInvariants.test.ts`

**Interfaces:**
- Produces:

```ts
export interface BorrowerIdentityFields {
  borrowerType: string;
  nricPassport?: string | null;
  dateOfBirth?: Date | string | null;
  nationality?: string | null;
  registrationNumber?: string | null;
  dateOfIncorporation?: Date | string | null;
  businessNature?: string | null;
}
export function assertBorrowerIdentityInvariants(merged: BorrowerIdentityFields): void;
```

Throws `AppError(message, 400)` naming the specific missing field.

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/__tests__/borrowerIdentityInvariants.test.ts`:

```ts
import { assertBorrowerIdentityInvariants } from '../borrowerIdentityInvariants';

const INDIVIDUAL = {
  borrowerType: 'INDIVIDUAL',
  nricPassport: '900101011234',
  dateOfBirth: '1990-01-01',
  nationality: 'Malaysian',
};

const CORPORATE = {
  borrowerType: 'CORPORATE',
  registrationNumber: '202001012345',
  dateOfIncorporation: '2020-01-01',
  businessNature: 'Precision engineering',
};

describe('assertBorrowerIdentityInvariants', () => {
  it('accepts a complete individual', () => {
    expect(() => assertBorrowerIdentityInvariants(INDIVIDUAL)).not.toThrow();
  });

  it('accepts a complete corporate', () => {
    expect(() => assertBorrowerIdentityInvariants(CORPORATE)).not.toThrow();
  });

  it('accepts a complete sole proprietor on the corporate rules', () => {
    expect(() =>
      assertBorrowerIdentityInvariants({ ...CORPORATE, borrowerType: 'SOLE_PROPRIETOR' }),
    ).not.toThrow();
  });

  it.each(['nricPassport', 'dateOfBirth', 'nationality'])(
    'rejects an individual missing %s',
    (field) => {
      expect(() =>
        assertBorrowerIdentityInvariants({ ...INDIVIDUAL, [field]: null }),
      ).toThrow(new RegExp(field, 'i'));
    },
  );

  it.each(['registrationNumber', 'dateOfIncorporation', 'businessNature'])(
    'rejects a corporate missing %s',
    (field) => {
      expect(() =>
        assertBorrowerIdentityInvariants({ ...CORPORATE, [field]: null }),
      ).toThrow(new RegExp(field, 'i'));
    },
  );

  it('rejects a whitespace-only string as missing', () => {
    expect(() =>
      assertBorrowerIdentityInvariants({ ...INDIVIDUAL, nricPassport: '   ' }),
    ).toThrow(/nricPassport/i);
  });

  it('G-03: rejects a JOINT borrower with no identity at all', () => {
    expect(() => assertBorrowerIdentityInvariants({ borrowerType: 'JOINT' })).toThrow(
      /nricPassport/i,
    );
  });

  it('G-03: accepts a JOINT borrower with primary-party identity', () => {
    expect(() =>
      assertBorrowerIdentityInvariants({ ...INDIVIDUAL, borrowerType: 'JOINT' }),
    ).not.toThrow();
  });

  it('throws a 400, not a 500', () => {
    try {
      assertBorrowerIdentityInvariants({ borrowerType: 'INDIVIDUAL' });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(400);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/__tests__/borrowerIdentityInvariants.test.ts --silent
```

Expected: FAIL — cannot resolve `../borrowerIdentityInvariants`.

- [ ] **Step 3: Implement the invariants**

Create `backend/src/credit/services/borrowerIdentityInvariants.ts`:

```ts
import { AppError } from '../../middleware/error.middleware';

export interface BorrowerIdentityFields {
  borrowerType: string;
  nricPassport?: string | null;
  dateOfBirth?: Date | string | null;
  nationality?: string | null;
  registrationNumber?: string | null;
  dateOfIncorporation?: Date | string | null;
  businessNature?: string | null;
}

/** Individuals and JOINT borrowers are identified by natural-person fields. */
const NATURAL_PERSON_TYPES = ['INDIVIDUAL', 'JOINT'];
/** Sole proprietors and companies are identified by registration fields. */
const REGISTERED_ENTITY_TYPES = ['CORPORATE', 'SOLE_PROPRIETOR'];

const REQUIRED: Record<string, { field: keyof BorrowerIdentityFields; label: string }[]> = {
  NATURAL_PERSON: [
    { field: 'nricPassport', label: 'NRIC / Passport' },
    { field: 'dateOfBirth', label: 'Date of Birth' },
    { field: 'nationality', label: 'Nationality' },
  ],
  REGISTERED_ENTITY: [
    { field: 'registrationNumber', label: 'Registration Number' },
    { field: 'dateOfIncorporation', label: 'Date of Incorporation' },
    { field: 'businessNature', label: 'Business Nature' },
  ],
};

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Single source of truth for "what makes a borrower valid".
 *
 * Called on BOTH create and update, against the POST-MERGE record. Copying the
 * Zod superRefine onto the update schema cannot work: a PATCH is partial, so
 * validating the patch alone cannot know whether the merged borrower still has
 * an NRIC. Zod keeps field shape and types; this owns the entity invariant.
 *
 * JOINT is treated as a natural person: it requires primary-party identity.
 * A proper borrower-level co-borrower model is out of scope — this closes the
 * "nothing but a defaulted type" hole without inventing one.
 */
export function assertBorrowerIdentityInvariants(merged: BorrowerIdentityFields): void {
  const group = NATURAL_PERSON_TYPES.includes(merged.borrowerType)
    ? 'NATURAL_PERSON'
    : REGISTERED_ENTITY_TYPES.includes(merged.borrowerType)
      ? 'REGISTERED_ENTITY'
      : null;

  if (!group) return;

  for (const { field, label } of REQUIRED[group]) {
    if (!isPresent(merged[field])) {
      throw new AppError(
        `${label} is required for ${merged.borrowerType} borrowers (field: ${field})`,
        400,
      );
    }
  }
}
```

- [ ] **Step 4: Call it from create and update**

In `backend/src/credit/services/borrowerProfile.service.ts`, add the import:

```ts
import { assertBorrowerIdentityInvariants } from './borrowerIdentityInvariants';
```

In `createBorrowerProfile` (line 734), directly after the existing name check:

```ts
    assertBorrowerIdentityInvariants({
      borrowerType: data.borrowerType ?? 'CORPORATE',
      nricPassport: data.nricPassport,
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality,
      registrationNumber: data.registrationNumber,
      dateOfIncorporation: data.dateOfIncorporation,
      businessNature: data.businessNature,
    });
```

In `updateBorrowerProfile` (line 889), after `existing` is fetched and the not-found guard, merge then assert:

```ts
    // G-02 — validate the MERGED entity, not the partial patch. A PATCH that
    // nulls a mandatory identity field must fail even though the patch itself
    // is shape-valid.
    const merged = {
      borrowerType: data.borrowerType ?? existing.borrowerType,
      nricPassport: data.nricPassport !== undefined ? data.nricPassport : existing.nricPassport,
      dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : existing.dateOfBirth,
      nationality: data.nationality !== undefined ? data.nationality : existing.nationality,
      registrationNumber:
        data.registrationNumber !== undefined ? data.registrationNumber : existing.registrationNumber,
      dateOfIncorporation:
        data.dateOfIncorporation !== undefined ? data.dateOfIncorporation : existing.dateOfIncorporation,
      businessNature:
        data.businessNature !== undefined ? data.businessNature : existing.businessNature,
    };
    assertBorrowerIdentityInvariants(merged);
```

> Use `!== undefined` rather than `??` throughout. `??` would treat an explicit `null` in the patch as "not supplied" and fall back to the existing value — which is exactly the bug being fixed.

- [ ] **Step 5: Run the invariant test and the borrower profile suite**

```bash
npx jest src/credit/services/__tests__/borrowerIdentityInvariants.test.ts --silent
npx jest src/credit/services/__tests__/borrowerProfile --silent
```

Expected: invariant test PASS (14 cases). Existing borrower-profile tests may fail if fixtures create borrowers without mandatory fields — that is the fix working. Update those fixtures to supply valid identity data; do **not** weaken the invariant.

- [ ] **Step 6: Commit**

```bash
git add src/credit/services/borrowerIdentityInvariants.ts src/credit/services/borrowerProfile.service.ts src/credit/services/__tests__
git commit -m "fix(credit): enforce borrower identity invariants on update (G-02, G-03)

One invariant function, called on create and update against the merged record.
Closes the PATCH path that could null NRIC/DOB/registration number post-KYC,
and gives BorrowerType.JOINT the mandatory fields it never had."
```

---

### Task 16: Frontend — service methods and readiness actions

The rating itself needs no new user action. What matters is that the readiness strip names the missing inputs.

**Files:**
- Modify: `frontend/src/services/credit.service.ts`
- Modify: `frontend/src/components/credit/borrower360/borrowerReadiness.ts`
- Test: `frontend/src/components/credit/borrower360/__tests__/borrowerRiskReadiness.test.ts`

**Interfaces:**
- Produces:

```ts
export interface BorrowerRiskRun {
  id: string;
  borrowerProfileId: string;
  totalScore: number;
  baseRiskRating: string;
  effectiveRiskRating: string;
  factorScores: Record<string, { weight: number; score: number; weightedScore: number; hadData: boolean }>;
  bureauCapsApplied: string[] | null;
  reasonCodes: string[] | null;
  missingInputs: { factor: string; subField: string; policy: string; appliedScore: number }[] | null;
  calculationSource: string;
  runAt: string;
}
```

plus `creditService.getBorrowerRiskLatest`, `getBorrowerRiskHistory`, `recalcBorrowerRisk`, and `borrowerRiskActions(run)`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/credit/borrower360/__tests__/borrowerRiskReadiness.test.ts`:

```ts
import { borrowerRiskActions } from '../borrowerReadiness';
import type { BorrowerRiskRun } from '../../../../services/credit.service';

function run(over: Partial<BorrowerRiskRun> = {}): BorrowerRiskRun {
  return {
    id: 'r1', borrowerProfileId: 'b1', totalScore: 62, baseRiskRating: 'BBB',
    effectiveRiskRating: 'BBB', factorScores: {}, bureauCapsApplied: null,
    reasonCodes: null, missingInputs: null, calculationSource: 'SYSTEM',
    runAt: '2026-08-20T00:00:00Z', ...over,
  };
}

const missing = (factor: string) => ({
  factor, subField: 'borrower_data', policy: 'PENALTY', appliedScore: 25,
});

describe('borrowerRiskActions', () => {
  it('returns no actions when nothing is missing', () => {
    expect(borrowerRiskActions(run())).toEqual([]);
  });

  it('returns an empty list when there is no run at all', () => {
    expect(borrowerRiskActions(null)).toEqual([]);
  });

  it('names an approved financial statement for missing financial_standing', () => {
    const actions = borrowerRiskActions(run({ missingInputs: [missing('financial_standing')] }));
    expect(actions).toHaveLength(1);
    expect(actions[0].title).toMatch(/financial statement/i);
    expect(actions[0].target).toBe('profile');
  });

  it('routes a missing bureau_conduct action to the bureau screen', () => {
    const actions = borrowerRiskActions(run({ missingInputs: [missing('bureau_conduct')] }));
    expect(actions[0].target).toBe('bureau');
  });

  it('routes a missing repayment_capacity action to the income screen', () => {
    const actions = borrowerRiskActions(run({ missingInputs: [missing('repayment_capacity')] }));
    expect(actions[0].target).toBe('income');
  });

  it('escalates every action to BLOCKER when the rating is NR', () => {
    const actions = borrowerRiskActions(
      run({
        effectiveRiskRating: 'NR',
        reasonCodes: ['INSUFFICIENT_DATA'],
        missingInputs: [missing('financial_standing'), missing('bureau_conduct')],
      }),
    );
    expect(actions).toHaveLength(2);
    expect(actions.every((a) => a.severity === 'BLOCKER')).toBe(true);
  });

  it('uses WARNING severity when the rating is a real grade', () => {
    const actions = borrowerRiskActions(run({ missingInputs: [missing('industry_risk')] }));
    expect(actions[0].severity).toBe('WARNING');
  });

  it('produces a stable id per factor so React keys are safe', () => {
    const actions = borrowerRiskActions(
      run({ missingInputs: [missing('identity_kyc'), missing('industry_risk')] }),
    );
    expect(new Set(actions.map((a) => a.id)).size).toBe(2);
    expect(actions[0].id).toContain('identity_kyc');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

From `frontend/`:

```bash
npx jest src/components/credit/borrower360/__tests__/borrowerRiskReadiness.test.ts --silent
```

Expected: FAIL — `borrowerRiskActions` is not exported.

- [ ] **Step 3: Add the service methods**

In `frontend/src/services/credit.service.ts`, add the `BorrowerRiskRun` interface from the Interfaces block above near the other credit types, then add these three methods next to `executeScore`:

```ts
  // Borrower-level risk (informational — no gate reads it)
  async getBorrowerRiskLatest(borrowerProfileId: string): Promise<BorrowerRiskRun | null> {
    const res = await apiClient.get(`/credit/borrower-profiles/${borrowerProfileId}/risk-latest`);
    return (res.data?.data ?? null) as BorrowerRiskRun | null;
  },

  async getBorrowerRiskHistory(borrowerProfileId: string): Promise<BorrowerRiskRun[]> {
    const res = await apiClient.get(`/credit/borrower-profiles/${borrowerProfileId}/risk-history`);
    return (res.data?.data ?? []) as BorrowerRiskRun[];
  },

  /** Operational only — ratings normally refresh on their own. */
  async recalcBorrowerRisk(borrowerProfileId: string) {
    const res = await apiClient.post(`/credit/borrower-profiles/${borrowerProfileId}/risk-recalc`);
    return res.data?.data as { runId: string; riskRating: string; totalScore: number; coveragePercent: number };
  },
```

- [ ] **Step 4: Add `borrowerRiskActions`**

Append to `frontend/src/components/credit/borrower360/borrowerReadiness.ts`:

```ts
import type { BorrowerRiskRun } from '../../../services/credit.service';

/**
 * Maps a borrower risk run's missing inputs onto named next actions.
 *
 * This is what closes the operator-training gap: the rating is derived
 * automatically, so a user never calculates it. What they need to know is which
 * data would firm it up, and where to enter it.
 */
const RISK_FACTOR_ACTIONS: Record<
  string,
  { title: string; description: string; actionLabel: string; target: BorrowerNextAction['target'] }
> = {
  financial_standing: {
    title: 'Add an approved financial statement',
    description: 'Balance-sheet strength cannot be assessed without approved financials.',
    actionLabel: 'Open financials',
    target: 'profile',
  },
  repayment_capacity: {
    title: 'Capture income and commitments',
    description: 'Debt-service ratio needs income and existing commitments.',
    actionLabel: 'Open income',
    target: 'income',
  },
  bureau_conduct: {
    title: 'Upload a credit bureau report',
    description: 'Repayment behaviour cannot be assessed without a bureau report.',
    actionLabel: 'Upload bureau report',
    target: 'bureau',
  },
  identity_kyc: {
    title: 'Complete identity and KYC',
    description: 'Verify identity documents and record beneficial ownership.',
    actionLabel: 'Open profile',
    target: 'profile',
  },
  industry_risk: {
    title: 'Classify the industry',
    description: 'Set the industry and SIC code so sector standing can be assessed.',
    actionLabel: 'Open profile',
    target: 'profile',
  },
  relationship_tenure: {
    title: 'Record years trading',
    description: 'Relationship depth uses years trading and prior facilities.',
    actionLabel: 'Open profile',
    target: 'profile',
  },
  compliance_screening: {
    title: 'Complete AML screening',
    description: 'An AML risk tier has not been assigned to this borrower.',
    actionLabel: 'Open profile',
    target: 'profile',
  },
};

export function borrowerRiskActions(run: BorrowerRiskRun | null): BorrowerNextAction[] {
  if (!run || !run.missingInputs?.length) return [];

  const unrated = run.effectiveRiskRating === 'NR';

  return run.missingInputs
    .map((m) => {
      const spec = RISK_FACTOR_ACTIONS[m.factor];
      if (!spec) return null;
      return action(
        `risk-${m.factor}`,
        unrated ? 'BLOCKER' : 'WARNING',
        spec.title,
        spec.description,
        spec.actionLabel,
        spec.target,
      );
    })
    .filter((a): a is BorrowerNextAction => a !== null);
}
```

If the existing `action()` helper is not exported or has a different parameter order, match its actual signature — it is defined near the top of this same file.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/components/credit/borrower360/__tests__/borrowerRiskReadiness.test.ts --silent
```

Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/credit.service.ts src/components/credit/borrower360
git commit -m "feat(credit): surface borrower risk rating and its missing inputs

Adds the three service methods, consuming the previously orphaned risk-latest
and risk-history endpoints. Readiness actions name the data that would firm up
the rating, so no operator has to know how to calculate one."
```

---

### Task 17: Borrower risk UI — KPI tile, factor breakdown, history

Three read-only surfaces. None of them offers a "calculate" action; the rating is already derived.

**Files:**
- Create: `frontend/src/components/credit/borrower360/BorrowerRiskFactorPanel.tsx`
- Create: `frontend/src/components/credit/borrower360/BorrowerRiskHistoryTab.tsx`
- Modify: `frontend/src/components/credit/borrower360/BorrowerKpiBand.tsx`
- Test: `frontend/src/components/credit/borrower360/__tests__/BorrowerRiskFactorPanel.test.tsx`

**Interfaces:**
- Consumes: `BorrowerRiskRun`, `creditService.getBorrowerRiskLatest`, `getBorrowerRiskHistory` (Task 16)
- Produces:
  - `coveragePercentOf(run: BorrowerRiskRun): number`
  - `<BorrowerRiskFactorPanel run={run} />`
  - `<BorrowerRiskHistoryTab borrowerProfileId={id} />`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/credit/borrower360/__tests__/BorrowerRiskFactorPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { BorrowerRiskFactorPanel, coveragePercentOf } from '../BorrowerRiskFactorPanel';
import type { BorrowerRiskRun } from '../../../../services/credit.service';

const factor = (weight: number, score: number, hadData: boolean) => ({
  weight, score, weightedScore: (score * weight) / 100, hadData,
});

function run(over: Partial<BorrowerRiskRun> = {}): BorrowerRiskRun {
  return {
    id: 'r1', borrowerProfileId: 'b1', totalScore: 78.5,
    baseRiskRating: 'A', effectiveRiskRating: 'A',
    factorScores: {
      financial_standing: factor(20, 90, true),
      repayment_capacity: factor(20, 80, true),
      bureau_conduct: factor(20, 75, true),
      identity_kyc: factor(15, 100, true),
      industry_risk: factor(10, 25, false),
      relationship_tenure: factor(10, 60, true),
      compliance_screening: factor(5, 100, true),
    },
    bureauCapsApplied: null, reasonCodes: null, missingInputs: null,
    calculationSource: 'SYSTEM', runAt: '2026-08-20T09:00:00Z', ...over,
  };
}

describe('coveragePercentOf', () => {
  it('weights coverage by factor weight, not factor count', () => {
    expect(coveragePercentOf(run())).toBe(90);
  });

  it('returns 0 when no factor had data', () => {
    const empty = run({
      factorScores: { financial_standing: factor(100, 25, false) },
    });
    expect(coveragePercentOf(empty)).toBe(0);
  });

  it('returns 0 rather than NaN for an empty factor set', () => {
    expect(coveragePercentOf(run({ factorScores: {} }))).toBe(0);
  });
});

describe('BorrowerRiskFactorPanel', () => {
  it('renders one row per factor with a readable label', () => {
    render(<BorrowerRiskFactorPanel run={run()} />);
    expect(screen.getByText('Financial standing')).toBeInTheDocument();
    expect(screen.getByText('Compliance screening')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8); // 7 factors + header
  });

  it('labels a factor with no data explicitly rather than showing a silent score', () => {
    render(<BorrowerRiskFactorPanel run={run()} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('shows the total score and the grade', () => {
    render(<BorrowerRiskFactorPanel run={run()} />);
    expect(screen.getByText('78.5')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('explains a cap when one was applied', () => {
    render(<BorrowerRiskFactorPanel run={run({
      baseRiskRating: 'AAA', effectiveRiskRating: 'D',
      bureauCapsApplied: ['SANCTIONED_ENTITY'],
    })} />);
    expect(screen.getByText(/capped from AAA to D/i)).toBeInTheDocument();
    expect(screen.getByText(/sanctioned entity/i)).toBeInTheDocument();
  });

  it('says the borrower is not rated when the grade is NR', () => {
    render(<BorrowerRiskFactorPanel run={run({
      effectiveRiskRating: 'NR', reasonCodes: ['INSUFFICIENT_DATA'],
    })} />);
    expect(screen.getByText(/not rated/i)).toBeInTheDocument();
    expect(screen.queryByText('NR')).not.toBeInTheDocument();
  });

  it('renders an empty state when there is no run', () => {
    render(<BorrowerRiskFactorPanel run={null} />);
    expect(screen.getByText(/no risk rating has been calculated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

From `frontend/`:

```bash
npx jest src/components/credit/borrower360/__tests__/BorrowerRiskFactorPanel.test.tsx --silent
```

Expected: FAIL — cannot resolve `../BorrowerRiskFactorPanel`.

- [ ] **Step 3: Implement the factor panel**

Create `frontend/src/components/credit/borrower360/BorrowerRiskFactorPanel.tsx`:

```tsx
import type { BorrowerRiskRun } from '../../../services/credit.service';
import { RiskBadge } from '../RiskBadge';

const FACTOR_LABELS: Record<string, string> = {
  financial_standing: 'Financial standing',
  repayment_capacity: 'Repayment capacity',
  bureau_conduct: 'Bureau conduct',
  identity_kyc: 'Identity & KYC',
  industry_risk: 'Industry risk',
  relationship_tenure: 'Relationship tenure',
  compliance_screening: 'Compliance screening',
};

const CAP_LABELS: Record<string, string> = {
  SANCTIONED_ENTITY: 'Sanctioned entity',
  AML_PROHIBITED: 'AML tier prohibited',
  AML_HIGH: 'AML tier high',
};

/** Share of total factor weight backed by real data, not a count of factors. */
export function coveragePercentOf(run: BorrowerRiskRun): number {
  const entries = Object.values(run.factorScores ?? {});
  const total = entries.reduce((s, f) => s + f.weight, 0);
  if (total === 0) return 0;
  const covered = entries.filter((f) => f.hadData).reduce((s, f) => s + f.weight, 0);
  return Math.round((covered / total) * 100);
}

export function BorrowerRiskFactorPanel({ run }: { run: BorrowerRiskRun | null }) {
  if (!run) {
    return (
      <p className="credit-empty-state">
        No risk rating has been calculated yet. It is derived automatically once
        borrower data is captured.
      </p>
    );
  }

  const isUnrated = run.effectiveRiskRating === 'NR';
  const caps = run.bureauCapsApplied ?? [];

  return (
    <section aria-label="Risk rating breakdown">
      <header className="credit-panel-header">
        {isUnrated ? (
          <strong>Not rated — insufficient data</strong>
        ) : (
          <RiskBadge rating={run.effectiveRiskRating} />
        )}
        <span>{run.totalScore}</span>
        <span>{coveragePercentOf(run)}% data coverage</span>
      </header>

      {caps.length > 0 && (
        <p className="credit-panel-note">
          Rating capped from {run.baseRiskRating} to {run.effectiveRiskRating}:{' '}
          {caps.map((c) => CAP_LABELS[c] ?? c).join(', ')}
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th scope="col">Factor</th>
            <th scope="col">Score</th>
            <th scope="col">Weight</th>
            <th scope="col">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(run.factorScores ?? {}).map(([key, f]) => (
            <tr key={key}>
              <th scope="row">{FACTOR_LABELS[key] ?? key}</th>
              <td>{f.hadData ? f.score : 'No data'}</td>
              <td>{f.weight}%</td>
              <td>{f.weightedScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

If `RiskBadge` is a default export or takes a differently named prop, match its actual signature — it lives at `frontend/src/components/credit/RiskBadge.tsx`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/components/credit/borrower360/__tests__/BorrowerRiskFactorPanel.test.tsx --silent
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Implement the history tab**

Create `frontend/src/components/credit/borrower360/BorrowerRiskHistoryTab.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { creditService, type BorrowerRiskRun } from '../../../services/credit.service';
import { BorrowerRiskFactorPanel, coveragePercentOf } from './BorrowerRiskFactorPanel';

export function BorrowerRiskHistoryTab({ borrowerProfileId }: { borrowerProfileId: string }) {
  const [runs, setRuns] = useState<BorrowerRiskRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    creditService
      .getBorrowerRiskHistory(borrowerProfileId)
      .then((r) => {
        if (cancelled) return;
        setRuns(r);
        setSelectedId(r[0]?.id ?? null);
      })
      .catch(() => !cancelled && setError('Could not load risk history.'));
    return () => {
      cancelled = true;
    };
  }, [borrowerProfileId]);

  if (error) return <p role="alert">{error}</p>;
  if (!runs) return <p>Loading risk history…</p>;
  if (runs.length === 0) {
    return <p>No risk rating has been calculated for this borrower yet.</p>;
  }

  const selected = runs.find((r) => r.id === selectedId) ?? runs[0];

  return (
    <div>
      <table>
        <caption>Rating history — every calculation is retained and never edited</caption>
        <thead>
          <tr>
            <th scope="col">Calculated</th>
            <th scope="col">Grade</th>
            <th scope="col">Score</th>
            <th scope="col">Coverage</th>
            <th scope="col">Source</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} aria-selected={r.id === selected.id}>
              <td>{new Date(r.runAt).toLocaleString()}</td>
              <td>{r.effectiveRiskRating === 'NR' ? 'Not rated' : r.effectiveRiskRating}</td>
              <td>{r.totalScore}</td>
              <td>{coveragePercentOf(r)}%</td>
              <td>{r.calculationSource}</td>
              <td>
                <button type="button" onClick={() => setSelectedId(r.id)}>
                  View breakdown
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <BorrowerRiskFactorPanel run={selected} />
    </div>
  );
}
```

- [ ] **Step 6: Wire the KPI tile**

In `frontend/src/components/credit/borrower360/BorrowerKpiBand.tsx`, add a risk tile. Fetch the latest run in the component that already loads borrower data and pass it down; the tile body is:

```tsx
{riskRun === null ? (
  <span className="kpi-empty">Not calculated</span>
) : riskRun.effectiveRiskRating === 'NR' ? (
  <span className="kpi-warning">Not rated — insufficient data</span>
) : (
  <>
    <RiskBadge rating={riskRun.effectiveRiskRating} />
    <small>
      as of {new Date(riskRun.runAt).toLocaleDateString()} ·{' '}
      {coveragePercentOf(riskRun)}% coverage
    </small>
  </>
)}
```

Mark the tile stale using the existing warning styling in that file when
`borrower.riskRatingCalculatedAt` is earlier than `borrower.updatedAt`:

```tsx
const isStale =
  !!borrower.riskRatingCalculatedAt &&
  new Date(borrower.riskRatingCalculatedAt) < new Date(borrower.updatedAt);
```

Do not render a coverage percentage for an `NR` borrower as if it were a score.

- [ ] **Step 7: Run the borrower360 suite**

```bash
npx jest src/components/credit/borrower360 --silent
```

Expected: all PASS, including the pre-existing `BorrowerWorkspaceHeader` and `BorrowerNextActions` tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/credit/borrower360
git commit -m "feat(credit): borrower risk KPI tile, factor breakdown and history

Read-only surfaces with no calculate action. Factors with no data are labelled
'No data' rather than showing a policy score silently, and an NR borrower reads
'Not rated - insufficient data' rather than a bare grade."
```

---

### Task 18: Seed a BORROWER scorecard and flag the policy items

Nothing above produces a rating until an active borrower-scoped scorecard exists.

**Files:**
- Modify: `backend/prisma/seed-credit.ts`
- Test: `backend/src/credit/services/borrowerRisk/__tests__/seedBorrowerScorecard.test.ts`

**Interfaces:**
- Consumes: `BORROWER_FACTOR_GROUPS` (Task 2), `ScorecardScope` (Task 1)
- Produces: `seedBorrowerScorecard(): Promise<void>`, exported from the seed module

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/borrowerRisk/__tests__/seedBorrowerScorecard.test.ts`:

```ts
import { BORROWER_FACTOR_GROUPS, validateFactorWeights } from '../../scorecard.service';
import { ScorecardScope } from '@prisma/client';
import { BORROWER_SEED_WEIGHTS } from '../../../../../prisma/seed-credit';

describe('BORROWER_SEED_WEIGHTS', () => {
  it('covers every declared borrower factor', () => {
    expect(Object.keys(BORROWER_SEED_WEIGHTS).sort()).toEqual([...BORROWER_FACTOR_GROUPS].sort());
  });

  it('passes borrower-scope weight validation', () => {
    expect(() =>
      validateFactorWeights(BORROWER_SEED_WEIGHTS, ScorecardScope.BORROWER),
    ).not.toThrow();
  });

  it('matches the weights approved in the design spec', () => {
    expect(BORROWER_SEED_WEIGHTS).toEqual({
      financial_standing: 20,
      repayment_capacity: 20,
      bureau_conduct: 20,
      identity_kyc: 15,
      industry_risk: 10,
      relationship_tenure: 10,
      compliance_screening: 5,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/seedBorrowerScorecard.test.ts --silent
```

Expected: FAIL — `BORROWER_SEED_WEIGHTS` is not exported from the seed.

- [ ] **Step 3: Add the seed**

In `backend/prisma/seed-credit.ts`, add:

```ts
import { ScorecardScope } from '@prisma/client';

/**
 * Borrower-scope factor weights.
 *
 * OPEN POLICY ITEM — needs credit-policy sign-off before production activation:
 * bureau_conduct at 20 assumes bureau data is reliably available. Where it is
 * not, that weight mostly flows through missing-data policy and the rating is
 * softer than the number suggests.
 */
export const BORROWER_SEED_WEIGHTS = {
  financial_standing: 20,
  repayment_capacity: 20,
  bureau_conduct: 20,
  identity_kyc: 15,
  industry_risk: 10,
  relationship_tenure: 10,
  compliance_screening: 5,
};

export async function seedBorrowerScorecard(): Promise<void> {
  const existing = await prisma.creditScorecard.findFirst({
    where: { scope: ScorecardScope.BORROWER },
  });
  if (existing) {
    console.log('  ↳ Borrower scorecard already present, skipping');
    return;
  }

  const scorecard = await prisma.creditScorecard.create({
    data: {
      name: 'Borrower Standing Scorecard v1',
      description:
        'Borrower-level risk rating. Seven auto-derived factors, informational only — ' +
        'no approval gate reads this rating.',
      scope: ScorecardScope.BORROWER,
      isActive: true,
    },
  });

  await prisma.creditScorecardVersion.create({
    data: {
      scorecardId: scorecard.id,
      version: 1,
      factorWeights: BORROWER_SEED_WEIGHTS,
      isActive: true,
      effectiveFrom: new Date('2026-01-01'),
    },
  });

  console.log('  ↳ Seeded borrower scorecard with 7 factors');
}
```

Then call `await seedBorrowerScorecard();` from the seed's main routine, along with the existing scorecard seeding.

- [ ] **Step 4: Run the test and the seed**

```bash
npx jest src/credit/services/borrowerRisk/__tests__/seedBorrowerScorecard.test.ts --silent
npm run prisma:seed
```

Expected: test PASS; seed logs the borrower scorecard line and does not disturb the application scorecard.

- [ ] **Step 5: Verify the whole flow end to end against a real database**

```bash
npx jest src/credit --silent 2>&1 | tail -20
```

Expected: the full credit suite passes with no new failures against the Task 1 baseline.

Then manually, with the dev server running:

1. Create a borrower through the wizard → confirm a `BorrowerRiskRun` exists with `effectiveRiskRating = 'NR'` and reason `INSUFFICIENT_DATA`
2. Approve a financial statement for that borrower → confirm a second run appears with a real grade, **with no user action beyond the approval**
3. Set `isSanctionedEntity = true` → confirm the next run caps at `D` with `SANCTIONED_ENTITY` in `bureauCapsApplied`
4. PATCH the borrower nulling `registrationNumber` → confirm a 400 naming the field
5. Confirm no application's approval path, readiness result or board-band outcome changed

- [ ] **Step 6: Commit**

```bash
git add prisma/seed-credit.ts src/credit/services/borrowerRisk/__tests__/seedBorrowerScorecard.test.ts
git commit -m "feat(credit): seed the borrower-scoped scorecard

Idempotent. Weights are the design-spec values; the two open policy items
(bureau_conduct weight, AML HIGH cap) are flagged in code comments and need
credit-policy sign-off before production activation."
```

- [ ] **Step 7: Raise the policy items**

Before enabling this in production, get written sign-off on:

1. **The seven weights**, especially `bureau_conduct` at 20.
2. **`amlRiskTier = HIGH` capping at `BB`.** `PROHIBITED` and sanctioned capping at `D` are settled.

Both are data, not code — changing them is a `CreditScorecardVersion` and a constant in `caps.ts` respectively. Record the decision in the spec's Decisions Taken table.

---

## Verification Summary

| Success criterion (from spec) | Proven by |
| --- | --- |
| New borrower gets a run showing `NR / INSUFFICIENT_DATA` | Task 13 Step 3 (create dispatch), Task 10 Step 1 (NR test), Task 18 Step 5 item 1 |
| Financial statement approval produces a real grade with no user action | Task 13 Step 3, Task 18 Step 5 item 2 |
| Borrower 360 shows grade, as-of, breakdown, missing inputs | Task 16 Step 4 (missing inputs), Task 17 Steps 3, 5 and 6 |
| A sanctioned borrower with strong financials rates `D` | Task 9 Step 1, **Task 10 Step 1 dilution test**, Task 18 Step 5 item 3 |
| `risk-history` returns runs; no run is mutated | Task 11 (append-only `persistBorrowerRiskRun`), Task 16 Step 3, Task 17 Step 5 |
| A PATCH nulling a mandatory identity field is rejected with the field named | Task 15 Steps 1 and 5, Task 18 Step 5 item 4 |
| Every pre-existing application-scoring test passes unchanged | Task 1 Step 1 baseline, Task 3 Step 4, Task 18 Step 5 |
| No approval, readiness or board-band behaviour changes | Task 18 Step 5 item 5; no task touches those files |
