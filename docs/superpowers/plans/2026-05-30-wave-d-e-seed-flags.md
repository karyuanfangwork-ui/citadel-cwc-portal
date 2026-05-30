# Wave D + E — Seed Update & Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip bank-only data from the default credit demo seed (gate it behind `--bank-grade`), add 3 lean S1–S7 demo applications, and register the two new feature flags `credit:advanced_memo` and `credit:committee_formal`.

**Architecture:** `creditDemoSeed.ts` already has all bank-only seeding in `seedCaMemoData()` and `seedCommitteeMeetings()`. We add a `bankGrade: boolean` param to both, wrap each bank-only block in `if (bankGrade)`, and pass `process.argv.includes('--bank-grade')` from the main export. The 3 lean demo apps are added at the end of `seedCreditApplications()` so they benefit from the same borrower profiles. Wave E is a 2-line addition to `seedFlags()` in `seed-credit.ts`.

**Tech Stack:** TypeScript, Prisma, Node.js CLI (`npx prisma db seed`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/creditDemoSeed.ts` | Modify | Gate bank-only seed behind `bankGrade` flag; add 3 lean S1–S7 apps |
| `backend/prisma/seed-credit.ts` | Modify | Add `credit:advanced_memo` + `credit:committee_formal` feature flags |

---

## Task 1: Gate bank-only seeding behind `--bank-grade` flag

**Files:**
- Modify: `backend/prisma/creditDemoSeed.ts`

The bank-only sections to gate are:
- `seedCommitteeMeetings()` — entire function
- Inside `seedCaMemoData()`: External Ratings, ECL Snapshots + Forecasts, Cashflow Projections, Sensitivity Scenarios, Account Profitability, Wallet Share, Account Utilisation Snapshots

These sections stay: Bureau Checks, Industry Assessments, Risk Assessments, Key Counterparties, Request Items, Exposure Summaries, Sign-offs — these are relevant to non-bank lenders.

- [ ] **Step 1: Add `bankGrade` param to `seedCommitteeMeetings` and wrap its body**

Find `async function seedCommitteeMeetings(apps: any[], adminId: string, hrId: string, itId: string)` (line ~808) and change it to:

```ts
async function seedCommitteeMeetings(apps: any[], adminId: string, hrId: string, itId: string, bankGrade = false) {
  if (!bankGrade) {
    console.log('  ⏭ Committee meetings skipped (bank-grade mode off)');
    return;
  }
  // ... rest of function body unchanged ...
```

- [ ] **Step 2: Add `bankGrade` param to `seedCaMemoData` signature**

Find `async function seedCaMemoData(apps: any[], profiles: any[], adminId: string, hrId: string, itId: string)` (line ~1042) and change to:

```ts
async function seedCaMemoData(apps: any[], profiles: any[], adminId: string, hrId: string, itId: string, bankGrade = false) {
```

- [ ] **Step 3: Wrap External Ratings block**

Find `// ── Phase 3: External Ratings` and wrap the entire block (from `const ratingDefs` through `console.log(\`  ✅ ${ratingCount} external ratings\`)`) in:

```ts
  // ── Phase 3: External Ratings ── (bank-grade only: MARC/RAM ratings not applicable to SME non-bank lender)
  if (bankGrade) {
    const ratingDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 4: Wrap ECL Snapshots + Forecasts block**

Find `// ── Phase 3: ECL Snapshots + Forecasts` and wrap the entire block (from `const eclDefs` through `console.log(\`  ✅ ${eclCount} ECL snapshots...\`)`) in:

```ts
  // ── Phase 3: ECL Snapshots + Forecasts ── (bank-grade only: MFRS 9 not applicable)
  if (bankGrade) {
    const eclDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 5: Wrap Cashflow Projections block**

Find `// ── Phase 3: Cashflow Projections` and wrap the entire block (from `const cfDefs` through `console.log(\`  ✅ ${cfCount} cashflow projections...\`)`) in:

```ts
  // ── Phase 3: Cashflow Projections ── (bank-grade only: project finance >RM5M only)
  if (bankGrade) {
    const cfDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 6: Wrap Sensitivity Scenarios block**

Find `// ── Phase 3: Sensitivity Scenarios` and wrap the entire block (from `const seDefs` through `console.log(\`  ✅ ${ssCount} sensitivity scenarios\`)`) in:

```ts
  // ── Phase 3: Sensitivity Scenarios ── (bank-grade only: replaced by DSR stress in Wave B)
  if (bankGrade) {
    const seDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 7: Wrap Account Profitability block**

Find `// ── Phase 4: Account Profitability` and wrap the entire block (from `const profitDefs` through `console.log(\`  ✅ ${profCount} account profitability records\`)`) in:

```ts
  // ── Phase 4: Account Profitability ── (bank-grade only: requires transfer pricing)
  if (bankGrade) {
    const profitDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 8: Wrap Wallet Share block**

Find `// ── Phase 4: Wallet Share` and wrap the entire block (from `const walletDefs` through `console.log(\`  ✅ ${wsCount} wallet share entries\`)`) in:

```ts
  // ── Phase 4: Wallet Share ── (bank-grade only: multi-product banking relationship tracking)
  if (bankGrade) {
    const walletDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 9: Wrap Account Utilisation Snapshots block**

Find `// ── Phase 4: Account Utilisation Snapshots` and wrap the entire block (from `const utilDefs` through `console.log(\`  ✅ ${utilCount} account utilisation snapshots\`)`) in:

```ts
  // ── Phase 4: Account Utilisation Snapshots ── (bank-grade only: banks monitor held accounts)
  if (bankGrade) {
    const utilDefs = [
      // ... existing content unchanged ...
    ];
    // ... existing loop + console.log unchanged ...
  }
```

- [ ] **Step 10: Pass `bankGrade` through from the main export**

Find `export async function seedCreditDemo(adminId: string, analystId: string)` (line ~1605) and update:

```ts
export async function seedCreditDemo(adminId: string, analystId: string) {
  const bankGrade = process.argv.includes('--bank-grade');
  if (bankGrade) console.log('  🏦 Bank-grade mode ON — seeding ECL, Sensitivity, CommitteeMeeting, Profitability, WalletShare, Utilisation');

  // ... existing calls unchanged until seedCommitteeMeetings and seedCaMemoData ...

  await seedCommitteeMeetings(apps, adminId, hrUser?.id || analystId, itUser?.id || analystId, bankGrade);

  // Phase 2-5 CA Memo data
  await seedCaMemoData(apps, profiles, adminId, hrUser?.id || analystId, itUser?.id || analystId, bankGrade);
```

- [ ] **Step 11: TypeScript check**

```bash
cd backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add backend/prisma/creditDemoSeed.ts
git commit -m "feat(credit): gate bank-only seed behind --bank-grade flag (Wave D)"
```

---

## Task 2: Add 3 lean S1–S7 demo applications

**Files:**
- Modify: `backend/prisma/creditDemoSeed.ts`

Add Apps A, B, C at the end of `seedCreditApplications()`, after the existing applications array is built. Each application uses an existing borrower profile — profiles[3] (High Net Worth Individual) for App A, profiles[0] (SME Manufacturing) for Apps B and C.

- [ ] **Step 1: Locate where `seedCreditApplications` returns its array**

Find the `return apps;` at the end of `seedCreditApplications` (it returns the array of created apps). The lean apps should be created just before this return.

- [ ] **Step 2: Add 3 lean apps at the end of `seedCreditApplications`**

At the end of `seedCreditApplications`, just before `return apps;`, add:

```ts
  // ── Lean S1–S7 Demo Applications (Wave D — no bank-grade data) ──────────

  // App A: Individual borrower, RM80K personal loan, straight-through scoring, APPROVED
  const leanAppAExists = await findExisting(prisma.creditApplication, { applicationNo: 'CA-LEAN-001' });
  if (!leanAppAExists && profiles.length > 3) {
    const bp = profiles[3]; // High Net Worth Individual
    const leanA = await prisma.creditApplication.create({
      data: {
        applicationNo: 'CA-LEAN-001',
        borrowerProfileId: bp.id,
        productType: 'TERM_LOAN' as any,
        requestedAmount: 80000,
        requestedTenor: 36,
        currency: 'MYR' as any,
        purpose: 'Personal term loan for home renovation and furniture purchase',
        state: 'APPROVED' as any,
        riskRating: 'BB',
        rmId: adminId,
        analystId,
        submittedAt: new Date('2026-05-01'),
        decisionedAt: new Date('2026-05-03'),
        firstWayOut: 'SALARY',
      },
    });
    await prisma.creditFacility.create({
      data: { applicationId: leanA.id, facilityType: 'TERM_LOAN' as any, currency: 'MYR' as any, amount: 80000, tenorMonths: 36, ratePct: 6.5, purpose: 'Home renovation', approvedAmount: 80000, approvedTenor: 36, approvedRate: 6.5 },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanA.id, provider: 'CCRIS_BORROWER_UPLOAD' as any, subjectName: 'High Net Worth Individual', runDate: new Date('2026-05-01'), runById: adminId, hasHits: false, findings: 'CCRIS clean — no adverse credit history. No existing credit facilities.' },
    });
    await prisma.creditDecision.create({
      data: { applicationId: leanA.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_RM', decisionById: adminId, decisionAt: new Date('2026-05-03'), comments: 'Straight-through approval — score 78/100, BB rating, clean bureau, adequate income coverage.' },
    });
    apps.push(leanA);
    console.log('  ✅ Lean App A: CA-LEAN-001 (RM80K personal loan, APPROVED)');
  }

  // App B: SME RM1.2M term loan, 2-approver chain, APPROVED with conditions
  const leanAppBExists = await findExisting(prisma.creditApplication, { applicationNo: 'CA-LEAN-002' });
  if (!leanAppBExists && profiles.length > 0) {
    const bp = profiles[0]; // SME Manufacturing Sdn Bhd
    const leanB = await prisma.creditApplication.create({
      data: {
        applicationNo: 'CA-LEAN-002',
        borrowerProfileId: bp.id,
        productType: 'TERM_LOAN' as any,
        requestedAmount: 1200000,
        requestedTenor: 60,
        currency: 'MYR' as any,
        purpose: 'Working capital facility to support production line upgrade and raw material purchase',
        state: 'APPROVED' as any,
        riskRating: 'BBB',
        rmId: adminId,
        analystId,
        submittedAt: new Date('2026-05-05'),
        decisionedAt: new Date('2026-05-12'),
        firstWayOut: 'OPERATING_CASHFLOW',
      },
    });
    await prisma.creditFacility.create({
      data: { applicationId: leanB.id, facilityType: 'TERM_LOAN' as any, currency: 'MYR' as any, amount: 1200000, tenorMonths: 60, ratePct: 5.5, purpose: 'Production line upgrade', approvedAmount: 1200000, approvedTenor: 60, approvedRate: 5.5 },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanB.id, provider: 'CCRIS_BORROWER_UPLOAD' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-05'), runById: adminId, hasHits: true, findings: 'CCRIS shows 2 existing facilities, total outstanding RM4.8M. All facilities current. No adverse findings.' },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanB.id, provider: 'CTOS' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-05'), runById: adminId, hasHits: false, findings: 'CTOS clean. No litigation, no bankruptcy proceedings.' },
    });
    // Stage 1 approval
    await prisma.creditDecision.create({
      data: { applicationId: leanB.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_RM', decisionById: adminId, decisionAt: new Date('2026-05-08'), comments: 'Stage 1 approved. DSCR 1.72x, BBB rating.' },
    });
    // Stage 2 approval (final) with condition
    await prisma.creditDecision.create({
      data: { applicationId: leanB.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_MANAGER', decisionById: analystId, decisionAt: new Date('2026-05-12'), comments: 'Stage 2 approved. Conditions: quarterly financial statements required within 30 days of quarter end.' },
    });
    await prisma.condition.create({
      data: { applicationId: leanB.id, conditionType: 'PRECEDENT' as any, description: 'Submit latest 3 months bank statements prior to first drawdown.', dueDate: new Date('2026-06-01'), isSatisfied: false, createdById: adminId },
    });
    apps.push(leanB);
    console.log('  ✅ Lean App B: CA-LEAN-002 (RM1.2M term loan, APPROVED, 2-stage chain)');
  }

  // App C: SME RM6M project finance, 3-approver chain, COMMITTEE_REVIEW pending
  const leanAppCExists = await findExisting(prisma.creditApplication, { applicationNo: 'CA-LEAN-003' });
  if (!leanAppCExists && profiles.length > 0) {
    const bp = profiles[0]; // SME Manufacturing Sdn Bhd
    const leanC = await prisma.creditApplication.create({
      data: {
        applicationNo: 'CA-LEAN-003',
        borrowerProfileId: bp.id,
        productType: 'PROJECT_FINANCE' as any,
        requestedAmount: 6000000,
        requestedTenor: 84,
        currency: 'MYR' as any,
        purpose: 'Greenfield factory Phase 3 — 30,000 sqft facility for precision aerospace components',
        state: 'COMMITTEE_REVIEW' as any,
        riskRating: 'BB',
        rmId: adminId,
        analystId,
        submittedAt: new Date('2026-05-10'),
        firstWayOut: 'PROJECT_REVENUE',
      },
    });
    await prisma.creditFacility.create({
      data: { applicationId: leanC.id, facilityType: 'PROJECT_FINANCE' as any, currency: 'MYR' as any, amount: 6000000, tenorMonths: 84, ratePct: 6.0, purpose: 'Greenfield factory Phase 3' },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanC.id, provider: 'CCRIS_BORROWER_UPLOAD' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-10'), runById: adminId, hasHits: true, findings: 'CCRIS shows 3 existing facilities, total outstanding RM9.8M. All current. No adverse conduct.' },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanC.id, provider: 'CTOS' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-10'), runById: adminId, hasHits: false, findings: 'CTOS clean.' },
    });
    // Stage 1 approval only — stages 2 and 3 pending
    await prisma.creditDecision.create({
      data: { applicationId: leanC.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_RM', decisionById: adminId, decisionAt: new Date('2026-05-14'), comments: 'Stage 1 approved. Strong project fundamentals. Escalating to CREDIT_MANAGER for stage 2.' },
    });
    apps.push(leanC);
    console.log('  ✅ Lean App C: CA-LEAN-003 (RM6M project finance, COMMITTEE_REVIEW, 3-stage chain 1/3 done)');
  }
```

- [ ] **Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors. If `prisma.condition` doesn't exist, replace with `prisma.creditCondition` or check the Prisma model name:

```bash
grep -n "model Condition\|model CreditCondition" backend/prisma/schema.prisma | head -5
```

If the model name differs, update the `prisma.condition.create` call in Step 2 to match.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/creditDemoSeed.ts
git commit -m "feat(credit): add 3 lean S1–S7 demo apps to credit seed (Wave D)"
```

---

## Task 3: Add `credit:advanced_memo` and `credit:committee_formal` feature flags

**Files:**
- Modify: `backend/prisma/seed-credit.ts`

The `seedFlags()` function (line ~42) has a `creditFlags` array. Add two entries to it.

- [ ] **Step 1: Add the two new flags to `creditFlags`**

Open `backend/prisma/seed-credit.ts`. In the `creditFlags` array inside `seedFlags()`, add these two entries after the existing `credit:bureau_checks` entry:

```ts
    // Wave E — CA Memo Redesign: section visibility flags
    { key: 'credit:advanced_memo',    description: 'Enables bank-grade CA Memo sections (ECL, ESG, SICR, Sensitivity, CommitteeMeeting, Profitability, WalletShare, AccountUtilisation)',  enabled: false, category: 'credit' },
    { key: 'credit:committee_formal', description: 'Enables full CommitteeMeeting formal vote flow inside the approval tab',  enabled: false, category: 'credit' },
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed-credit.ts
git commit -m "feat(credit): add credit:advanced_memo and credit:committee_formal feature flags (Wave E)"
```

---

## Task 4: Verify seed runs cleanly

- [ ] **Step 1: Run the seed**

```bash
cd backend && npm run prisma:seed 2>&1 | tail -30
```

Expected output includes:
```
✅ credit:advanced_memo (enabled: false)
✅ credit:committee_formal (enabled: false)
✅ Lean App A: CA-LEAN-001 (RM80K personal loan, APPROVED)
✅ Lean App B: CA-LEAN-002 (RM1.2M term loan, APPROVED, 2-stage chain)
✅ Lean App C: CA-LEAN-003 (RM6M project finance, COMMITTEE_REVIEW, 3-stage chain 1/3 done)
⏭ Committee meetings skipped (bank-grade mode off)
🏦 Credit Module demo data seeded ✅
```

If `condition` model name was wrong and seed fails, check Prisma schema and fix model name in Task 2 Step 2.

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
cd backend && npm test 2>&1 | grep -E "Tests:|Test Suites:" | tail -3
```

Expected: same pass/fail count as before (145 pass, 2 pre-existing failures in sod-disburse.test.ts).

- [ ] **Step 3: Verify feature flags in DB**

```bash
cd backend && npx prisma studio
```

Open the `FeatureFlag` table and confirm `credit:advanced_memo` and `credit:committee_formal` exist with `enabled: false`.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Remove ECL seeding from standard flow → Task 1 Step 4
- [x] Remove SICR seeding — SICR is part of ECL snapshot (MfrsStage field); no separate model to gate. Handled.
- [x] Remove ESG seeding — checking plan… ESG (`esgAssessment`) is in `seedCaMemoData` too. Let me check.

**Gap found — ESG:** The plan spec says "Remove ESG seeding". Searching the seed: the Phase 5 section likely has ESG/SICR data. Let me add a task for it.

Actually looking at the file content I read — I didn't see explicit `esgAssessment` or `sicrAssessment` in the seed data I read (lines 1042–1578). The CA Memo data I read includes: RequestItems, ExposureSummary, ExternalRatings, ECL, Cashflow, Sensitivity, Profitability, WalletShare, Counterparties, AccountUtilisation, Bureau, Industry, Risk, then later Sign-offs. Let me check if ESG/SICR appear.

From the imports at line 1: the file imports `EsgGuidingPrinciple, EsgCategory, SicrTriggerType` — so ESG and SICR ARE seeded somewhere that I haven't read yet (after line 1480). I need to add gates for those too.

**Fix:** Add Task 1 steps for ESG and SICR blocks (they appear after the risk assessments, around lines 1480–1570).

- [x] Remove CashflowProjection → Task 1 Step 5
- [x] Remove SensitivityScenario → Task 1 Step 6
- [x] Remove AccountProfitability + ProfitabilityLine → Task 1 Step 7
- [x] Remove WalletShare → Task 1 Step 8
- [x] Remove AccountUtilisationSnapshot → Task 1 Step 9
- [x] Remove ExternalRating → Task 1 Step 3
- [x] Remove CommitteeMeeting → Task 1 Step 1
- [x] Keep behind `--bank-grade` flag → Task 1 Step 10
- [x] App A: RM80K individual, APPROVED → Task 2
- [x] App B: RM1.2M SME, 2-approver, APPROVED with conditions → Task 2
- [x] App C: RM6M project finance, 3-approver chain, COMMITTEE_REVIEW → Task 2
- [x] `credit:advanced_memo` flag (default false) → Task 3
- [x] `credit:committee_formal` flag (default false) → Task 3
- [ ] **GAP: ESG Assessment + SICR Assessment seeding not gated** → adding below

---

## Task 1b: Gate ESG and SICR seeding (gap fix)

**Files:**
- Modify: `backend/prisma/creditDemoSeed.ts`

The seed file imports `EsgGuidingPrinciple, EsgCategory, SicrTriggerType`, meaning ESG and SICR data is seeded inside `seedCaMemoData()` in sections not yet read. These must also be gated.

- [ ] **Step 1: Find and wrap ESG Assessment block**

Search for `esgAssessment` in `creditDemoSeed.ts`:

```bash
grep -n "esgAssessment\|EsgAssessment\|EsgCategory\|EsgGuidingPrinciple" backend/prisma/creditDemoSeed.ts | head -10
```

Wrap the entire ESG seeding block in:

```ts
  // ── Phase 5: ESG Assessment ── (bank-grade only: BNM VBI ESG framework not applicable)
  if (bankGrade) {
    // ... existing ESG seeding block unchanged ...
  }
```

- [ ] **Step 2: Find and wrap SICR Assessment block**

```bash
grep -n "sicrAssessment\|SicrAssessment\|SicrTriggerType" backend/prisma/creditDemoSeed.ts | head -10
```

Wrap the entire SICR seeding block in:

```ts
  // ── Phase 5: SICR Assessment ── (bank-grade only: MFRS 9 SICR not applicable)
  if (bankGrade) {
    // ... existing SICR seeding block unchanged ...
  }
```

- [ ] **Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit (amend Task 1 commit or new commit)**

```bash
git add backend/prisma/creditDemoSeed.ts
git commit -m "feat(credit): gate ESG and SICR seed behind --bank-grade flag"
```
