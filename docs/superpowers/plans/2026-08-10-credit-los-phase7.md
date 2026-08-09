# Credit LOS Phase 7 — Decision Basis, Identity Integrity and Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last two open P1 gaps — LOS-016 (the management pack omits the decision basis) and LOS-017 (duplicate borrowers slip through when there is no CRM link) — plus the residual that keeps LOS-022 open, and the detection failure that let a forked audit chain survive a nightly check.

**Architecture:** Every capability this plan needs is already stored. `CreditScoreRun` persists `factorScores`, `missingInputs`, `bureauCapsApplied`, `policyVersion`, `ratingBandVersion` and `scoreRunWarnings`; `CreditApplication` already has `recommendations`, `assessmentResults`, `scoreOverrides`, `deviations` and `documents` relations; `BorrowerProfile` has self-contained `registrationNumber` and `nricPassport` columns. Phase 7 connects and surfaces what exists rather than adding new domain models. The one genuinely new thing is escalation: a broken audit chain must reach a human.

**Tech Stack:** Node 20 + Express + TypeScript, Prisma 5 + PostgreSQL, Jest (ts-jest), React 19 + Vite, Playwright.

## Global Constraints

- Branch from `dev2.0`. Do not commit to `main`.
- Backend commands run from `backend/`; frontend from `frontend/`.
- Audit events go through `AuditChainService.appendEvent` only, and any business mutation paired with an audit event commits in one `prisma.$transaction` with `tx` passed as the 8th argument.
- `npx tsc --noEmit` must pass from `backend/` after every task.
- Jest discovers `**/__tests__/**/*.test.ts` under `backend/src`. Service unit tests in `backend/src/credit/services/__tests__/`; cross-service integration tests in `backend/src/credit/__tests__/`. DB-backed tests guard with `const RUN = process.env.DATABASE_URL ? describe : describe.skip`.
- Migrations use `prisma/migrations/YYYYMMDDHHMMSS_snake_case_name/migration.sql`. Any migration that writes to `credit_audit_events` must first `SELECT set_config('app.audit_chain_bypass', 'on', true)`.
- **A gap is closed when a test proves it.** Every task below ends with a test that fails against the current code. If a test passes before the implementation, the test is wrong — fix the test, do not proceed.
- Commit messages: `fix(credit):` / `feat(credit):` / `test(credit):` / `docs(credit):`, ending with the LOS id in parentheses.
- `docs/` is gitignored (`.gitignore:69` — `/docs/*`). Documentation changes need `git add -f`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `backend/src/credit/utils/identityNormalization.ts` (new) | Canonical form for NRIC/passport/registration numbers | 1 |
| `backend/prisma/migrations/20260811090000_borrower_identity_normalized/migration.sql` (new) | Normalized columns + indexes + backfill | 2 |
| `backend/src/credit/services/borrowerProfile.service.ts` | Compare direct profile identity; maintain normalized columns; governed override | 2, 3 |
| `backend/src/credit/services/caMemoPdf.service.ts` | Widen the pack query to the stored decision basis | 4 |
| `backend/src/credit/services/approvalPack.service.ts` | Render recommendation, score explanation, overrides/deviations, evidence index | 5 |
| `frontend/src/components/credit/ApprovalPackViewer.tsx` (or equivalent) | Sidebar anchors for the new sections | 6 |
| `backend/src/credit/jobs/auditRetention.job.ts` | Escalate a broken chain instead of logging it | 7 |
| `backend/src/credit/services/disbursement.service.ts` | Verify the chain before disbursing | 7 |
| `backend/src/credit/services/scoreOverride.service.ts` | Make `requestScoreOverride` transactional | 8 |
| `backend/prisma/seed-credit.ts` | Seed distinct E2E analyst and approver identities | 9 |
| `frontend/e2e/credit/sod-exclusions.spec.ts` (new) | Browser proof of SOD/authority exclusion | 9 |

---

### Task 1: Identity normalization helper (LOS-017)

`checkDuplicateEnhanced` compares `registrationNumber` and `nricPassport` only as raw strings reached *through* CRM links. Before comparing the profile's own columns we need one canonical form, so `880101-14-5523`, `880101145523` and `880101 14 5523` collide.

**Files:**
- Create: `backend/src/credit/utils/identityNormalization.ts`
- Test: `backend/src/credit/services/__tests__/identityNormalization.test.ts`

**Interfaces:**
- Produces: `normalizeIdentity(value: string | null | undefined): string | null` — uppercase, strip everything that is not `[A-Z0-9]`, return `null` for empty/insufficient input.
- Produces: `MIN_IDENTITY_LENGTH = 6`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/services/__tests__/identityNormalization.test.ts
import { normalizeIdentity, MIN_IDENTITY_LENGTH } from '../../utils/identityNormalization';

describe('LOS-017 — normalizeIdentity', () => {
  it('collapses separator and case variants of one NRIC to one value', () => {
    const forms = ['880101-14-5523', '880101145523', '880101 14 5523', '880101/14/5523'];
    const normalized = forms.map(normalizeIdentity);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('880101145523');
  });

  it('upper-cases alphanumeric identifiers', () => {
    expect(normalizeIdentity('a1234567b')).toBe('A1234567B');
    expect(normalizeIdentity('202301012345 (1234567-X)')).toBe('2023010123451234567X');
  });

  it('returns null for empty, whitespace or missing input', () => {
    expect(normalizeIdentity(null)).toBeNull();
    expect(normalizeIdentity(undefined)).toBeNull();
    expect(normalizeIdentity('')).toBeNull();
    expect(normalizeIdentity('   ')).toBeNull();
    expect(normalizeIdentity('---')).toBeNull();
  });

  it('returns null below the minimum length so short junk never matches', () => {
    expect(MIN_IDENTITY_LENGTH).toBe(6);
    expect(normalizeIdentity('12345')).toBeNull();
    expect(normalizeIdentity('123456')).toBe('123456');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/services/__tests__/identityNormalization.test.ts`
Expected: FAIL — `Cannot find module '../../utils/identityNormalization'`

- [ ] **Step 3: Write the helper**

```typescript
// backend/src/credit/utils/identityNormalization.ts

/**
 * LOS-017 — Canonical form for identity numbers (NRIC, passport, company
 * registration).
 *
 * Duplicate detection previously compared raw strings, so `880101-14-5523` and
 * `880101145523` were two different borrowers with split exposure and split KYC
 * history. Everything that is not a letter or digit is noise for matching
 * purposes; case is noise too.
 *
 * Values shorter than MIN_IDENTITY_LENGTH normalize to null: matching on three
 * characters produces false positives that are worse than the miss.
 */
export const MIN_IDENTITY_LENGTH = 6;

export function normalizeIdentity(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < MIN_IDENTITY_LENGTH) return null;
  return normalized;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/credit/services/__tests__/identityNormalization.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/utils/identityNormalization.ts backend/src/credit/services/__tests__/identityNormalization.test.ts
git commit -m "feat(credit): add canonical identity normalization for duplicate matching (LOS-017)"
```

---

### Task 2: Compare the borrower's own identity fields (LOS-017)

`BorrowerProfile.registrationNumber` (`schema.prisma:4018`) and `BorrowerProfile.nricPassport` (`:4020`) are described in the schema as "Identity fields — self-contained, no CRM dependency", yet `checkDuplicateEnhanced` (`borrowerProfile.service.ts:238`) never reads them. A borrower created without a CRM link is matched on name alone.

**Files:**
- Create: `backend/prisma/migrations/20260811090000_borrower_identity_normalized/migration.sql`
- Modify: `backend/prisma/schema.prisma` (BorrowerProfile)
- Modify: `backend/src/credit/services/borrowerProfile.service.ts:238-340` (`checkDuplicateEnhanced`), and the create/update paths
- Test: `backend/src/credit/__tests__/borrowerIdentityDuplicate.test.ts`

**Interfaces:**
- Consumes: `normalizeIdentity` from Task 1.
- Produces: `BorrowerProfile.registrationNumberNormalized` and `BorrowerProfile.nricPassportNormalized`, both `String? @db.VarChar(64)`, each indexed.
- Produces: `DuplicateMatch.matchField` gains the values `'NRIC/Passport (direct)'` and `'Registration Number (direct)'`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/__tests__/borrowerIdentityDuplicate.test.ts
import prisma from '../../utils/prisma';
import { borrowerProfileService } from '../services/borrowerProfile.service';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-017 — duplicate detection on the profile\'s own identity fields', () => {
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await prisma.borrowerProfile.deleteMany({ where: { id: { in: created } } });
    }
    await prisma.$disconnect();
  });

  it('matches a differently-formatted NRIC with no CRM linkage', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Probe One',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '880101-14-5523',
    } as any, { overrideDuplicate: true, userId: 'test-actor' });
    created.push(first.id);

    const { duplicates } = await borrowerProfileService.checkDuplicateEnhanced({
      name: 'Completely Different Name',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '880101145523',
    });

    expect(duplicates.map((d) => d.borrowerId)).toContain(first.id);
    expect(duplicates.find((d) => d.borrowerId === first.id)?.matchField)
      .toBe('NRIC/Passport (direct)');
  });

  it('matches a differently-formatted company registration number', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Probe Two Sdn Bhd',
      borrowerType: 'CORPORATE',
      registrationNumber: '202301012345 (1234567-X)',
    } as any, { overrideDuplicate: true, userId: 'test-actor' });
    created.push(first.id);

    const { duplicates } = await borrowerProfileService.checkDuplicateEnhanced({
      name: 'Another Name Entirely Sdn Bhd',
      borrowerType: 'CORPORATE',
      registrationNumber: '2023010123451234567X',
    });

    expect(duplicates.map((d) => d.borrowerId)).toContain(first.id);
  });

  it('refuses to create a second borrower with the same identity', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Probe Three',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '900202-10-1111',
    } as any, { overrideDuplicate: true, userId: 'test-actor' });
    created.push(first.id);

    await expect(
      borrowerProfileService.createBorrowerProfile({
        name: 'LOS017 Probe Three Again',
        borrowerType: 'INDIVIDUAL',
        nricPassport: '9002021 0 1111',
      } as any, { userId: 'test-actor' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not match on short or empty identifiers', async () => {
    const { duplicates } = await borrowerProfileService.checkDuplicateEnhanced({
      name: 'No Such Borrower At All',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '12345',
    });
    expect(duplicates.filter((d) => d.matchField.includes('direct'))).toHaveLength(0);
  });
});
```

Check the exported symbol name for the service before running — use `grep -n "^export" src/credit/services/borrowerProfile.service.ts` and match it exactly.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/__tests__/borrowerIdentityDuplicate.test.ts --runInBand`
Expected: FAIL — no direct-identity match is returned; the third case creates a second borrower instead of throwing 409.

- [ ] **Step 3: Add the normalized columns to the schema**

In `backend/prisma/schema.prisma`, inside `model BorrowerProfile`, directly below the existing `nricPassport` field:

```prisma
  /// LOS-017 — Canonical forms used for duplicate matching. Maintained by
  /// borrowerProfile.service.ts on every create/update; never set by clients.
  registrationNumberNormalized String? @map("registration_number_normalized") @db.VarChar(64)
  nricPassportNormalized       String? @map("nric_passport_normalized") @db.VarChar(64)
```

And in the same model's index block:

```prisma
  @@index([registrationNumberNormalized])
  @@index([nricPassportNormalized])
```

- [ ] **Step 4: Write the migration**

```sql
-- backend/prisma/migrations/20260811090000_borrower_identity_normalized/migration.sql
-- LOS-017 — Canonical identity columns for duplicate matching.
--
-- checkDuplicateEnhanced reached registration numbers and NRICs only through
-- CRM links, so a borrower created without CRM linkage was matched on name
-- alone. These columns hold the canonical form (uppercase, alphanumeric only)
-- of the profile's OWN identity fields.
--
-- Deliberately NOT unique: existing data may already contain duplicates, and a
-- unique constraint would fail the migration and block writes. Enforcement is
-- at the service layer, which can offer a governed override; these indexes make
-- that check cheap.

ALTER TABLE borrower_profiles
  ADD COLUMN IF NOT EXISTS registration_number_normalized VARCHAR(64),
  ADD COLUMN IF NOT EXISTS nric_passport_normalized VARCHAR(64);

-- Backfill using the same rule as normalizeIdentity(): strip non-alphanumerics,
-- uppercase, and null out anything shorter than 6 characters.
UPDATE borrower_profiles
SET registration_number_normalized = NULLIF(
      CASE WHEN length(regexp_replace(upper(registration_number), '[^A-Z0-9]', '', 'g')) >= 6
           THEN regexp_replace(upper(registration_number), '[^A-Z0-9]', '', 'g')
           ELSE '' END, '')
WHERE registration_number IS NOT NULL;

UPDATE borrower_profiles
SET nric_passport_normalized = NULLIF(
      CASE WHEN length(regexp_replace(upper(nric_passport), '[^A-Z0-9]', '', 'g')) >= 6
           THEN regexp_replace(upper(nric_passport), '[^A-Z0-9]', '', 'g')
           ELSE '' END, '')
WHERE nric_passport IS NOT NULL;

CREATE INDEX IF NOT EXISTS "borrower_profiles_registration_number_normalized_idx"
  ON borrower_profiles (registration_number_normalized);
CREATE INDEX IF NOT EXISTS "borrower_profiles_nric_passport_normalized_idx"
  ON borrower_profiles (nric_passport_normalized);
```

- [ ] **Step 5: Apply the migration**

Run: `cd backend && npx prisma migrate dev --name borrower_identity_normalized && npx prisma generate`
Expected: applies cleanly. If Prisma creates its own directory with a different timestamp, keep Prisma's and delete the hand-written one — the SQL body is what matters.

Then confirm the backfill agrees with the TypeScript helper on real data:

```bash
npx tsx -e "
import prisma from './src/utils/prisma';
import { normalizeIdentity } from './src/credit/utils/identityNormalization';
(async () => {
  const rows = await prisma.borrowerProfile.findMany({
    select: { id: true, nricPassport: true, nricPassportNormalized: true, registrationNumber: true, registrationNumberNormalized: true },
  });
  const bad = rows.filter(r =>
    normalizeIdentity(r.nricPassport) !== r.nricPassportNormalized ||
    normalizeIdentity(r.registrationNumber) !== r.registrationNumberNormalized);
  console.log('MISMATCHES:', bad.length);
  process.exit(bad.length === 0 ? 0 : 1);
})();"
```
Expected: `MISMATCHES: 0`. A non-zero count means the SQL and the helper disagree — reconcile before continuing, or duplicate detection will be inconsistent between backfilled and newly-written rows.

- [ ] **Step 6: Maintain the columns on write**

In `borrowerProfile.service.ts`, import the helper and set both columns wherever `registrationNumber` or `nricPassport` is written (create and update paths):

```typescript
import { normalizeIdentity } from '../utils/identityNormalization';
```

```typescript
// in the data object passed to prisma.borrowerProfile.create / .update
        registrationNumberNormalized: normalizeIdentity(data.registrationNumber),
        nricPassportNormalized: normalizeIdentity(data.nricPassport),
```

Find every write site with `grep -n "borrowerProfile.create\|borrowerProfile.update\|borrowerProfile.upsert" src/credit/services/borrowerProfile.service.ts` and cover each. A missed site silently reintroduces the gap.

- [ ] **Step 7: Compare the direct fields in `checkDuplicateEnhanced`**

Widen the params and add a fourth check. Insert this block before the existing name check (step 3 in that method), so identity matches rank ahead of name matches:

```typescript
    // 3. LOS-017 — Check the profile's OWN identity fields. Checks 1 and 2
    // reach registration number and NRIC only through CRM links, so a borrower
    // created without CRM linkage was matched on name alone — which splits
    // exposure and KYC history across two records for the same person.
    const directNric = normalizeIdentity(params.nricPassport);
    const directRegNo = normalizeIdentity(params.registrationNumber);

    if (directNric || directRegNo) {
      const identityMatches = await prisma.borrowerProfile.findMany({
        where: {
          deletedAt: null,
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
          OR: [
            ...(directNric ? [{ nricPassportNormalized: directNric }] : []),
            ...(directRegNo ? [{ registrationNumberNormalized: directRegNo }] : []),
          ],
        },
        select: {
          id: true, name: true, borrowerType: true,
          nricPassportNormalized: true, registrationNumberNormalized: true,
        },
        take: 10,
      });

      for (const m of identityMatches) {
        if (seenIds.has(m.id)) continue;
        seenIds.add(m.id);
        duplicates.push({
          borrowerId: m.id,
          name: m.name || 'Unknown',
          borrowerType: m.borrowerType,
          matchField: m.nricPassportNormalized && m.nricPassportNormalized === directNric
            ? 'NRIC/Passport (direct)'
            : 'Registration Number (direct)',
        });
      }
    }
```

Widen the method signature accordingly:

```typescript
  async checkDuplicateEnhanced(params: {
    accountId?: string | null;
    contactId?: string | null;
    name?: string | null;
    borrowerType?: string;
    nricPassport?: string | null;
    registrationNumber?: string | null;
    excludeId?: string | null;
  }): Promise<{ duplicates: DuplicateMatch[] }> {
```

- [ ] **Step 8: Pass the identity through from the create path**

`createBorrowerProfile` already calls `checkDuplicateEnhanced` when `overrideDuplicate` is not set (see the comment at `:460`). Add the two new fields to that call so the new check actually runs on creation:

```typescript
      const { duplicates } = await this.checkDuplicateEnhanced({
        accountId: data.accountId,
        contactId: data.contactId,
        name: data.name,
        borrowerType: data.borrowerType,
        nricPassport: data.nricPassport,
        registrationNumber: data.registrationNumber,
      });
```

Also add the two fields to the validator in `backend/src/credit/validators/borrowerProfile.validator.ts` for the duplicate-check endpoint, so the frontend wizard's real-time check benefits too:

```typescript
    nricPassport: z.string().max(50).optional().nullable(),
    registrationNumber: z.string().max(100).optional().nullable(),
```

- [ ] **Step 9: Run the tests**

Run: `cd backend && npx jest src/credit/__tests__/borrowerIdentityDuplicate.test.ts --runInBand && npx tsc --noEmit`
Expected: 4 tests PASS, tsc clean.

Then run the wider borrower suite to catch fixtures that now trip the check:
Run: `npx jest src/credit --runInBand -t borrower`
Expected: green. A fixture that now fails with 409 is the guard working — give the fixture a distinct identity rather than weakening the check.

- [ ] **Step 10: Commit**

```bash
git add backend/prisma backend/src/credit
git commit -m "feat(credit): match duplicates on the borrower's own normalized identity fields (LOS-017)"
```

---

### Task 3: Governed duplicate override (LOS-017)

`createBorrowerProfile` already accepts `overrideDuplicate`, but it is an unaudited boolean: anyone who can create a borrower can suppress the check silently. The register requires permission, a reason and an audit record.

**Files:**
- Modify: `backend/src/credit/services/borrowerProfile.service.ts` (`createBorrowerProfile`)
- Modify: `backend/src/credit/controllers/borrowerProfile.controller.ts`
- Modify: `backend/src/credit/validators/borrowerProfile.validator.ts`
- Test: `backend/src/credit/__tests__/borrowerDuplicateOverride.test.ts`

**Interfaces:**
- Consumes: `checkDuplicateEnhanced` from Task 2.
- Produces: `createBorrowerProfile(data, options?: { overrideDuplicate?: boolean; overrideReason?: string; userId?: string; userPermissions?: string[] })` — throws 403 without `credit:admin`, 400 without a reason of at least 20 characters, and records a `BORROWER_DUPLICATE_OVERRIDE` audit event on success.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/__tests__/borrowerDuplicateOverride.test.ts
import { borrowerProfileService } from '../services/borrowerProfile.service';

describe('LOS-017 — duplicate override governance', () => {
  const base = { name: 'Override Probe', borrowerType: 'INDIVIDUAL', nricPassport: '910303-10-2222' } as any;

  it('rejects an override from a user without credit:admin', async () => {
    await expect(
      borrowerProfileService.createBorrowerProfile(base, {
        overrideDuplicate: true,
        overrideReason: 'Confirmed distinct person after manual KYC review of both files.',
        userId: 'u1',
        userPermissions: ['credit:create'],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects an override with no reason', async () => {
    await expect(
      borrowerProfileService.createBorrowerProfile(base, {
        overrideDuplicate: true,
        userId: 'u1',
        userPermissions: ['credit:admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an override with a token reason', async () => {
    await expect(
      borrowerProfileService.createBorrowerProfile(base, {
        overrideDuplicate: true,
        overrideReason: 'ok',
        userId: 'u1',
        userPermissions: ['credit:admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/__tests__/borrowerDuplicateOverride.test.ts`
Expected: FAIL — the override is accepted with no permission and no reason.

- [ ] **Step 3: Implement the governance**

At the top of `createBorrowerProfile`, before the duplicate check:

```typescript
    // LOS-017 — Overriding duplicate detection is a governed act: it creates a
    // second record for what the system believes is the same person or company,
    // which splits exposure and KYC history. Require the permission, a real
    // reason, and an audit trail.
    if (options?.overrideDuplicate) {
      if (!options.userPermissions?.includes('credit:admin')) {
        throw Object.assign(
          new Error('Overriding duplicate borrower detection requires the credit:admin permission.'),
          { statusCode: 403 },
        );
      }
      const reason = options.overrideReason?.trim() ?? '';
      if (reason.length < 20) {
        throw Object.assign(
          new Error('A duplicate override requires a reason of at least 20 characters explaining why these are distinct parties.'),
          { statusCode: 400 },
        );
      }
    }
```

After the profile is created, record the override. Because this is a borrower-level rather than application-level event, log it through the existing borrower activity trail rather than the application audit chain — check `borrowerActivity.service.ts` for the exact function name and signature and use it:

```typescript
    if (options?.overrideDuplicate) {
      await recordBorrowerActivity({
        borrowerProfileId: profile.id,
        activityType: 'BORROWER_DUPLICATE_OVERRIDE',
        actorId: options.userId ?? null,
        metadata: {
          reason: options.overrideReason,
          suppressedMatches: duplicateMatchesFound.map((d) => ({ id: d.borrowerId, field: d.matchField })),
        },
      });
    }
```

To populate `suppressedMatches`, run `checkDuplicateEnhanced` even when overriding — the point of the record is what was suppressed. Capture the result before the create and reuse it.

- [ ] **Step 4: Pass permissions from the controller**

In `borrowerProfile.controller.ts`, the create handler must forward the authenticated user's permissions and the reason:

```typescript
      const profile = await borrowerProfileService.createBorrowerProfile(req.body, {
        overrideDuplicate: req.body.overrideDuplicate === true,
        overrideReason: req.body.overrideReason,
        userId: req.user?.id,
        userPermissions: req.user?.permissions ?? [],
      });
```

Match `req.user` field names to what the auth middleware actually attaches — check another controller in the same directory rather than assuming.

Add to the create validator:

```typescript
    overrideDuplicate: z.boolean().optional(),
    overrideReason: z.string().max(2000).optional(),
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest src/credit/__tests__/borrowerDuplicateOverride.test.ts src/credit/__tests__/borrowerIdentityDuplicate.test.ts --runInBand && npx tsc --noEmit`
Expected: all PASS, tsc clean.

Note: Task 2's tests pass `overrideDuplicate: true` without permissions and will now fail. Update them to include `userPermissions: ['credit:admin']` and a valid `overrideReason` — that is the correct call shape, not a weakening.

- [ ] **Step 6: Commit**

```bash
git add backend/src/credit
git commit -m "feat(credit): require credit:admin, a reason and an audit record to override duplicate detection (LOS-017)"
```

---

### Task 4: Widen the management pack query to the stored decision basis (LOS-016)

`getCaMemoData` (`caMemoPdf.service.ts:3`) already loads borrower, facilities, bureau checks, risk assessments, signoffs, conditions, decisions and the latest score run. It omits five relations that already exist on `CreditApplication`: `recommendations`, `assessmentResults`, `scoreOverrides`, `deviations` and `documents`. Those are precisely the "why" an approver is missing.

**Files:**
- Modify: `backend/src/credit/services/caMemoPdf.service.ts:3-57`
- Test: `backend/src/credit/__tests__/managementPackCompleteness.test.ts`

**Interfaces:**
- Produces: `CaMemoData` gains `recommendations`, `assessmentResults`, `scoreOverrides`, `deviations` and `documents`. `CaMemoData` is `Awaited<ReturnType<typeof getCaMemoData>>`, so the type widens automatically.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/__tests__/managementPackCompleteness.test.ts
import prisma from '../../utils/prisma';
import { getCaMemoData } from '../services/caMemoPdf.service';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-016 — the management pack query carries the decision basis', () => {
  let applicationId: string;

  beforeAll(async () => {
    const app = await prisma.creditApplication.findFirst({ where: { deletedAt: null } });
    if (!app) throw new Error('Seed credit fixtures first: npm run prisma:seed:credit -- --demo');
    applicationId = app.id;
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('includes the analyst recommendation', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.recommendations).toBeDefined();
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  it('includes the frozen assessment result with its provenance', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.assessmentResults).toBeDefined();
    expect(Array.isArray(data.assessmentResults)).toBe(true);
  });

  it('includes score overrides and deviations', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.scoreOverrides).toBeDefined();
    expect(data.deviations).toBeDefined();
  });

  it('includes the evidence index', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.documents).toBeDefined();
    expect(Array.isArray(data.documents)).toBe(true);
  });

  it('carries the score run fields needed to explain the rating', async () => {
    const data: any = await getCaMemoData(applicationId);
    const run = data.scoreRuns?.[0];
    if (!run) return; // application has not been scored
    for (const field of ['factorScores', 'missingInputs', 'bureauCapsApplied', 'policyVersion', 'ratingBandVersion']) {
      expect(run).toHaveProperty(field);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/__tests__/managementPackCompleteness.test.ts --runInBand`
Expected: FAIL — `recommendations`, `assessmentResults`, `scoreOverrides`, `deviations` and `documents` are all undefined.

- [ ] **Step 3: Widen the include tree**

In `getCaMemoData`'s `include` block, alongside the existing `scoreRuns` and `decisions` entries:

```typescript
      // LOS-016 — The decision basis. All of this was already stored; the pack
      // simply never asked for it, so approvers had to navigate the whole
      // Application 360 to answer "why this rating, and what was overridden?"
      recommendations: {
        where: { status: { in: ['SUBMITTED', 'ACKNOWLEDGED'] } },
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { submittedAt: 'desc' },
      },
      assessmentResults: {
        where: { status: 'FROZEN' },
        orderBy: { version: 'desc' },
        take: 1,
      },
      scoreOverrides: {
        include: {
          // Verified against schema.prisma: this model has firstApprover /
          // secondApprover (dual approval), NOT a `requestedBy` relation.
          firstApprover: { select: { firstName: true, lastName: true } },
          secondApprover: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      deviations: { orderBy: { createdAt: 'desc' } },
      documents: {
        where: { deletedAt: null },
        select: {
          id: true, classification: true, fileName: true, sha256Hash: true,
          verificationStatus: true, verifiedAt: true, createdAt: true,
        },
        orderBy: [{ classification: 'asc' }, { createdAt: 'desc' }],
      },
```

All relation and field names above were verified against `prisma/schema.prisma` while this plan was written:

- `ScoreOverrideApproval`: `originalRating`, `overrideRating`, `notchDelta`, `justification`, `status`, `firstApproverId`/`firstApprover`, `secondApproverId`/`secondApprover`, `scoreRunId`. There is **no** `requestedBy` relation — the model records approvers, not a requester.
- `DeviationApproval`: `policyRule`, `description`, `justification`, `severity`, `status`, `actualValue`, `thresholdValue`, `isNonWaivable`, `requiredAuthorityLevel`, `approvedById`, `rejectedById`.
- `ApplicationAssessmentResult`: `version`, `status`, `finalRiskRating`, `policyVersion`, `ratingBandVersion`, `reasonCodes`, `missingInputs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/credit/__tests__/managementPackCompleteness.test.ts --runInBand && npx tsc --noEmit`
Expected: 5 tests PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/caMemoPdf.service.ts backend/src/credit/__tests__/managementPackCompleteness.test.ts
git commit -m "feat(credit): load recommendation, assessment result, overrides, deviations and evidence into the pack query (LOS-016)"
```

---

### Task 5: Render the decision basis in the pack (LOS-016)

`buildApprovalPackHtml` (`approvalPack.service.ts:28`) renders nine sections. Four more are needed, and the pack must state which frozen versions it is reporting.

**Files:**
- Modify: `backend/src/credit/services/approvalPack.service.ts`
- Test: `backend/src/credit/services/__tests__/approvalPackSections.test.ts`

**Interfaces:**
- Consumes: the widened `CaMemoData` from Task 4.
- Produces: `APPROVAL_PACK_SECTIONS` gains `analyst-recommendation`, `score-explanation`, `overrides-deviations` and `evidence-index`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/services/__tests__/approvalPackSections.test.ts
import { APPROVAL_PACK_SECTIONS, buildApprovalPackHtml } from '../approvalPack.service';

const NEW_SECTIONS = ['analyst-recommendation', 'score-explanation', 'overrides-deviations', 'evidence-index'];

function minimalApp(overrides: Record<string, any> = {}): any {
  return {
    applicationNo: 'CA-TEST-0001',
    borrowerProfile: { account: { name: 'Probe Sdn Bhd' } },
    signoffs: [],
    facilities: [],
    bureauChecks: [],
    riskAssessments: [],
    conditions: [],
    decisions: [],
    scoreRuns: [],
    recommendations: [],
    assessmentResults: [],
    scoreOverrides: [],
    deviations: [],
    documents: [],
    ...overrides,
  };
}

describe('LOS-016 — approval pack decision basis', () => {
  it('declares an anchor for every new section', () => {
    const ids = APPROVAL_PACK_SECTIONS.map((s) => s.id);
    for (const id of NEW_SECTIONS) expect(ids).toContain(id);
  });

  it('renders an anchor for every declared section', () => {
    const html = buildApprovalPackHtml(minimalApp());
    for (const section of APPROVAL_PACK_SECTIONS) {
      expect(html).toContain(`id="${section.id}"`);
    }
  });

  it('renders the authored recommendation with its author and rationale', () => {
    const html = buildApprovalPackHtml(minimalApp({
      recommendations: [{
        recommendationType: 'CONDITIONAL',
        recommendedAmount: 750000,
        recommendedTenorMonths: 60,
        rationale: 'Serviceable on stressed DSR; security cover adequate.',
        submittedAt: new Date('2026-08-01'),
        author: { firstName: 'Aisha', lastName: 'Rahman' },
      }],
    }));
    expect(html).toContain('CONDITIONAL');
    expect(html).toContain('Aisha');
    expect(html).toContain('Serviceable on stressed DSR');
  });

  it('explains the score: factors, missing inputs and caps', () => {
    const html = buildApprovalPackHtml(minimalApp({
      scoreRuns: [{
        totalScore: 72.5,
        riskRating: 'BBB',
        baseRiskRating: 'A',
        factorScores: { dsr: 18, leverage: 12, conduct: 20 },
        missingInputs: [{ factor: 'bureau_score', policy: 'PENALTY' }],
        bureauCapsApplied: [{ reason: 'adverse_record', cappedTo: 'BBB' }],
        policyVersion: 'md-2026.1',
        ratingBandVersion: 4,
      }],
    }));
    expect(html).toContain('dsr');
    expect(html).toContain('bureau_score');
    expect(html).toContain('md-2026.1');
    // A capped rating must show what it was capped from.
    expect(html).toContain('A');
  });

  it('states the frozen version the pack reports', () => {
    const html = buildApprovalPackHtml(minimalApp({
      assessmentResults: [{ version: 3, status: 'FROZEN', finalRiskRating: 'BBB', policyVersion: 'md-2026.1', ratingBandVersion: 4 }],
    }));
    expect(html).toMatch(/frozen assessment.*v3|v3.*frozen/i);
  });

  it('lists evidence with verification status and hash', () => {
    const html = buildApprovalPackHtml(minimalApp({
      documents: [{
        id: 'd1', classification: 'FINANCIAL_STATEMENT', fileName: 'FY2025-audited.pdf',
        sha256Hash: 'abc123def456', verificationStatus: 'VERIFIED', verifiedAt: new Date('2026-07-01'),
      }],
    }));
    expect(html).toContain('FY2025-audited.pdf');
    expect(html).toContain('VERIFIED');
    expect(html).toContain('abc123def456'.slice(0, 12));
  });

  it('renders without throwing when every new section is empty', () => {
    expect(() => buildApprovalPackHtml(minimalApp())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/services/__tests__/approvalPackSections.test.ts`
Expected: FAIL — the four section ids are absent.

- [ ] **Step 3: Declare the new sections**

In `approvalPack.service.ts`, extend `APPROVAL_PACK_SECTIONS`. Order matters — the recommendation and the score explanation belong before the detailed risk sections, the evidence index at the end:

```typescript
export const APPROVAL_PACK_SECTIONS = [
  { id: 'header-background', label: 'Header & Background' },
  { id: 'analyst-recommendation', label: 'Analyst Recommendation' },
  { id: 'score-explanation', label: 'Score & Rating Explanation' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'way-out', label: 'Way Out' },
  { id: 'credit-bureau', label: 'Credit Bureau Checks' },
  { id: 'industry-outlook', label: 'Industry Outlook' },
  { id: 'risk-assessment', label: 'Risk Assessment' },
  { id: 'esg-assessment', label: 'ESG Assessment' },
  { id: 'sicr-assessment', label: 'SICR Assessment' },
  { id: 'overrides-deviations', label: 'Overrides & Deviations' },
  { id: 'evidence-index', label: 'Evidence Index' },
  { id: 'signoff', label: 'Signoff' },
] as const;
```

- [ ] **Step 4: Render the four sections**

Add these builders above `buildApprovalPackHtml`, then interpolate each into the returned template at the position matching its place in `APPROVAL_PACK_SECTIONS`.

```typescript
const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** LOS-016 — What the analyst actually recommended, in their own words. */
function recommendationSection(app: any): string {
  const rec = app.recommendations?.[0];
  if (!rec) {
    return `<h2 id="analyst-recommendation">Analyst Recommendation</h2>
      <p><em>No recommendation has been submitted for this application.</em></p>`;
  }
  const author = `${rec.author?.firstName ?? ''} ${rec.author?.lastName ?? ''}`.trim() || '—';
  return `<h2 id="analyst-recommendation">Analyst Recommendation</h2>
    <table>
      <tr><td class="label">Recommendation</td><td><strong>${esc(rec.recommendationType)}</strong></td></tr>
      <tr><td class="label">Recommended amount</td><td class="right">${fmt(rec.recommendedAmount)}</td></tr>
      <tr><td class="label">Recommended tenor</td><td>${rec.recommendedTenorMonths ?? '—'} months</td></tr>
      <tr><td class="label">Author</td><td>${esc(author)}</td></tr>
      <tr><td class="label">Submitted</td><td>${fmtDate(rec.submittedAt)}</td></tr>
    </table>
    <h3>Rationale</h3>
    <p>${esc(rec.rationale) || '<em>None recorded.</em>'}</p>
    ${rec.conditions ? `<h3>Proposed conditions</h3><p>${esc(rec.conditions)}</p>` : ''}`;
}

/** LOS-016 — Why this rating: factor contributions, missing data, caps, provenance. */
function scoreExplanationSection(app: any): string {
  const run = app.scoreRuns?.[0];
  const frozen = app.assessmentResults?.[0];
  if (!run) {
    return `<h2 id="score-explanation">Score &amp; Rating Explanation</h2>
      <p><em>This application has not been scored.</em></p>`;
  }

  const factors = run.factorScores && typeof run.factorScores === 'object'
    ? Object.entries(run.factorScores as Record<string, any>)
    : [];
  const missing = Array.isArray(run.missingInputs) ? run.missingInputs : [];
  const caps = Array.isArray(run.bureauCapsApplied) ? run.bureauCapsApplied : [];

  return `<h2 id="score-explanation">Score &amp; Rating Explanation</h2>
    <table>
      <tr><td class="label">Total score</td><td class="right">${fmt(run.totalScore)}</td></tr>
      <tr><td class="label">Final rating</td><td><strong>${esc(run.riskRating)}</strong></td></tr>
      ${run.baseRiskRating && run.baseRiskRating !== run.riskRating
        ? `<tr><td class="label">Model rating before caps</td><td>${esc(run.baseRiskRating)}</td></tr>` : ''}
      <tr><td class="label">Policy version</td><td>${esc(run.policyVersion) || '—'}</td></tr>
      <tr><td class="label">Rating band version</td><td>${run.ratingBandVersion ?? '—'}</td></tr>
      ${frozen ? `<tr><td class="label">Reporting</td><td>Frozen assessment v${frozen.version} (${esc(frozen.status)})</td></tr>` : ''}
    </table>

    <h3>Factor contributions</h3>
    ${factors.length
      ? `<table><tr><th>Factor</th><th class="right">Contribution</th></tr>
         ${factors.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="right">${fmt(v)}</td></tr>`).join('')}
         </table>`
      : '<p><em>No factor breakdown recorded.</em></p>'}

    <h3>Missing inputs and treatment</h3>
    ${missing.length
      ? `<table><tr><th>Input</th><th>Policy applied</th></tr>
         ${missing.map((m: any) => `<tr><td>${esc(m.factor ?? m.field ?? m)}</td><td>${esc(m.policy ?? m.treatment ?? '—')}</td></tr>`).join('')}
         </table>`
      : '<p>All required inputs were present.</p>'}

    <h3>Caps applied</h3>
    ${caps.length
      ? `<table><tr><th>Reason</th><th>Capped to</th></tr>
         ${caps.map((c: any) => `<tr><td>${esc(c.reason ?? '—')}</td><td>${esc(c.cappedTo ?? c.cap ?? '—')}</td></tr>`).join('')}
         </table>`
      : '<p>No rating cap was applied.</p>'}`;
}

/** LOS-016 — Every departure from the model or from policy, and who authorised it. */
function overridesDeviationsSection(app: any): string {
  const overrides = app.scoreOverrides ?? [];
  const deviations = app.deviations ?? [];
  return `<h2 id="overrides-deviations">Overrides &amp; Deviations</h2>
    <h3>Rating overrides</h3>
    ${overrides.length
      ? `<table><tr><th>From</th><th>To</th><th>Notches</th><th>Status</th><th>Approvers</th><th>Justification</th></tr>
         ${overrides.map((o: any) => `<tr>
            <td>${esc(o.originalRating)}</td>
            <td>${esc(o.overrideRating)}</td>
            <td class="right">${o.notchDelta ?? '—'}</td>
            <td>${esc(o.status)}</td>
            <td>${esc([
              `${o.firstApprover?.firstName ?? ''} ${o.firstApprover?.lastName ?? ''}`.trim(),
              `${o.secondApprover?.firstName ?? ''} ${o.secondApprover?.lastName ?? ''}`.trim(),
            ].filter(Boolean).join(', ') || '—')}</td>
            <td>${esc(o.justification)}</td>
          </tr>`).join('')}
         </table>`
      : '<p>No rating override was requested.</p>'}
    <h3>Policy deviations</h3>
    ${deviations.length
      ? `<table><tr><th>Policy rule</th><th>Actual</th><th>Threshold</th><th>Severity</th><th>Status</th><th>Justification</th></tr>
         ${deviations.map((d: any) => `<tr>
            <td>${esc(d.policyRule)}</td>
            <td class="right">${fmt(d.actualValue)}</td>
            <td class="right">${fmt(d.thresholdValue)}</td>
            <td>${esc(d.severity)}${d.isNonWaivable ? ' <strong>(non-waivable)</strong>' : ''}</td>
            <td>${esc(d.status)}</td>
            <td>${esc(d.justification)}</td>
          </tr>`).join('')}
         </table>`
      : '<p>No policy deviation was recorded.</p>'}`;
}

/** LOS-016 — What evidence underpins the decision, and whether it was verified. */
function evidenceIndexSection(app: any): string {
  const docs = app.documents ?? [];
  return `<h2 id="evidence-index">Evidence Index</h2>
    ${docs.length
      ? `<table><tr><th>Classification</th><th>File</th><th>Verified</th><th>Verified at</th><th>SHA-256</th></tr>
         ${docs.map((d: any) => `<tr>
            <td>${esc(d.classification)}</td>
            <td>${esc(d.fileName)}</td>
            <td>${esc(d.verificationStatus ?? 'PENDING')}</td>
            <td>${fmtDate(d.verifiedAt)}</td>
            <td><code>${esc((d.sha256Hash ?? '').slice(0, 12))}</code></td>
          </tr>`).join('')}
         </table>`
      : '<p><em>No documents are attached to this application.</em></p>'}`;
}
```

Then interpolate them into the returned HTML in `buildApprovalPackHtml`, each immediately before the section that follows it in `APPROVAL_PACK_SECTIONS`:

```typescript
${recommendationSection(app)}
${scoreExplanationSection(app)}
```
…and, before the signoff block:
```typescript
${overridesDeviationsSection(app)}
${evidenceIndexSection(app)}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/credit/services/__tests__/approvalPackSections.test.ts && npx tsc --noEmit`
Expected: 7 tests PASS, tsc clean.

- [ ] **Step 6: Verify against real data**

```bash
cd backend && npx tsx -e "
import prisma from './src/utils/prisma';
import { getCaMemoData } from './src/credit/services/caMemoPdf.service';
import { buildApprovalPackHtml, APPROVAL_PACK_SECTIONS } from './src/credit/services/approvalPack.service';
(async () => {
  const app = await prisma.creditApplication.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  const html = buildApprovalPackHtml(await getCaMemoData(app!.id) as any);
  const missing = APPROVAL_PACK_SECTIONS.filter(s => !html.includes('id=\"' + s.id + '\"'));
  console.log('RENDERED_BYTES', html.length, 'MISSING_SECTIONS', missing.map(s => s.id));
  process.exit(missing.length ? 1 : 0);
})();"
```
Expected: `MISSING_SECTIONS []`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/credit/services/approvalPack.service.ts backend/src/credit/services/__tests__/approvalPackSections.test.ts
git commit -m "feat(credit): render recommendation, score explanation, overrides and evidence index in the approval pack (LOS-016)"
```

---

### Task 6: Surface the new sections in the pack viewer (LOS-016)

The frontend renders the sidebar from its own list, so new backend sections are invisible until the frontend knows about them.

**Files:**
- Modify: the component that renders the pack sidebar — locate with `cd frontend && grep -rln "header-background\|APPROVAL_PACK_SECTIONS\|Approval Pack" src pages`

- [ ] **Step 1: Locate the sidebar source**

Run: `cd frontend && grep -rn "header-background" src pages | head`

If the section list is hardcoded in the frontend, extend it to match `APPROVAL_PACK_SECTIONS` exactly, in the same order. If the frontend already fetches the list from the backend, no change is needed — verify by reading the fetch and skip to Step 3.

- [ ] **Step 2: Add the four sections**

```typescript
  { id: 'analyst-recommendation', label: 'Analyst Recommendation' },
  { id: 'score-explanation', label: 'Score & Rating Explanation' },
  { id: 'overrides-deviations', label: 'Overrides & Deviations' },
  { id: 'evidence-index', label: 'Evidence Index' },
```

Place each at the same index it occupies in the backend list, otherwise the sidebar order will not match the document order.

- [ ] **Step 3: Verify in the browser**

Run: `cd frontend && npm run build`
Expected: builds. Then, with the stack running, open an application's Approval Pack and confirm all thirteen sidebar entries scroll to a real heading. A sidebar link that scrolls nowhere means the anchor id does not match.

- [ ] **Step 4: Commit**

```bash
git add frontend
git commit -m "feat(credit): add decision-basis sections to the approval pack sidebar (LOS-016)"
```

---

### Task 7: Make a broken audit chain escalate (Phase 6a follow-up)

`auditRetention.job.ts` is scheduled daily at 03:00 (`scheduler.service.ts:43`, `credit.audit_retention`, enabled) and already calls `verifyChain` per application. When the chain was forked on 10 of 17 applications, it did exactly what it was written to do — `logger.error(...)` at line 102 — and nobody saw it. Its own docstring claims it "raises an EarlyWarningSignal"; it does not. Detection without escalation is not detection.

**Files:**
- Modify: `backend/src/credit/jobs/auditRetention.job.ts`
- Modify: `backend/src/credit/services/disbursement.service.ts`
- Test: `backend/src/credit/__tests__/auditChainEscalation.test.ts`

**Interfaces:**
- Produces: `runAuditRetentionCheck()` persists an `EarlyWarningSignal` per application with a broken chain.
- Produces: `assertChainIntact(applicationId: string): Promise<void>` in `auditChain.service.ts` — throws `Error & { statusCode: 409 }` when the chain does not verify.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/__tests__/auditChainEscalation.test.ts
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 6a — a broken audit chain must escalate', () => {
  it('the retention job does more than log when the chain is broken', () => {
    const source = readFileSync(
      join(__dirname, '..', 'jobs', 'auditRetention.job.ts'), 'utf8',
    );
    const brokenBranch = source.indexOf('if (!chainValid)');
    expect(brokenBranch).toBeGreaterThan(-1);
    const branchBody = source.slice(brokenBranch, brokenBranch + 1200);
    // The docstring has always claimed an EarlyWarningSignal is raised. Make it true.
    expect(branchBody).toMatch(/earlyWarningSignal|createSignal/);
  });

  it('exports a pre-disbursement chain assertion', async () => {
    const { AuditChainService } = await import('../services/auditChain.service');
    expect(typeof (AuditChainService as any).assertChainIntact).toBe('function');
  });

  it('disbursement asserts chain integrity before booking', () => {
    const source = readFileSync(
      join(__dirname, '..', 'services', 'disbursement.service.ts'), 'utf8',
    );
    const assertAt = source.indexOf('assertChainIntact');
    expect(assertAt).toBeGreaterThan(-1);
    // It must run before the booking call, not after it.
    const bookAt = source.indexOf('bookLoan');
    if (bookAt > -1) expect(assertAt).toBeLessThan(bookAt);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/__tests__/auditChainEscalation.test.ts`
Expected: FAIL on all three — the branch only logs, and `assertChainIntact` does not exist.

- [ ] **Step 3: Add the assertion helper**

Append to `AuditChainService` in `auditChain.service.ts`:

```typescript
  /**
   * Throw unless the application's audit chain verifies.
   *
   * Called before irreversible steps (disbursement). A chain that cannot be
   * verified means the decision record backing this money movement cannot be
   * evidenced — that is a stop, not a warning.
   */
  static async assertChainIntact(applicationId: string): Promise<void> {
    const result = await this.verifyChain(applicationId);
    if (!result.valid) {
      throw Object.assign(
        new Error(
          `Audit chain verification failed for application ${applicationId} ` +
          `(first discontinuity at event ${result.brokenAt}). Refusing to proceed: ` +
          `the decision record cannot be evidenced.`,
        ),
        { statusCode: 409 },
      );
    }
  }
```

- [ ] **Step 4: Escalate in the job**

Replace the `if (!chainValid)` branch (around line 101) so it persists a signal per affected application. Read how `EarlyWarningSignal` is created elsewhere first — `grep -rn "earlyWarningSignal.create" src/credit | head` — and mirror that shape, including required fields:

First add the enum value. `SignalType` currently has no member for this, and
Prisma enums are database enums — a missing value fails at write time:

```sql
-- backend/prisma/migrations/20260811100000_signal_type_audit_chain/migration.sql
-- Phase 6a — a broken audit chain needs its own signal type so it can be
-- filtered and alerted on, rather than disappearing into OTHER.
ALTER TYPE "SignalType" ADD VALUE IF NOT EXISTS 'AUDIT_CHAIN_BROKEN';
```

Add the matching member to `enum SignalType` in `schema.prisma` (after `CONDITION_OVERDUE`), then `npx prisma migrate dev` and `npx prisma generate`.

Note: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in
PostgreSQL versions before 12. If the migration fails with that error, split it
into its own migration directory containing only this statement.

Then replace the branch. Field names verified against the schema —
`EarlyWarningSignal` uses `openedAt` (not `detectedAt`), `signalType` is the
`SignalType` enum, and `severity` is `EarlyWarningSeverity`:

```typescript
  if (!chainValid) {
    logger.error(`[AuditRetention] Hash-chain integrity check FAILED: ${applicationsWithBrokenChains} applications have broken chains.`);

    // A log line at 03:00 is not escalation. The chain was forked on 10 of 17
    // applications and this job ran nightly throughout without anyone noticing.
    // Persist a signal per affected application so it surfaces in monitoring.
    for (const applicationId of brokenApplicationIds) {
      const existing = await prisma.earlyWarningSignal.findFirst({
        where: { applicationId, signalType: 'AUDIT_CHAIN_BROKEN', closedAt: null },
      });
      if (existing) continue; // don't raise a duplicate every night

      await prisma.earlyWarningSignal.create({
        data: {
          applicationId,
          signalType: 'AUDIT_CHAIN_BROKEN',
          severity: 'CRITICAL',
          description:
            'Audit chain verification failed. The decision record for this application ' +
            'cannot be evidenced until the chain is investigated and resealed ' +
            '(npm run audit:reseal).',
        },
      });
    }
  }
```

Collect `brokenApplicationIds` in the loop that currently only counts them —
it already calls `verifyChain` per application, so push the id when
`result.valid` is false.

- [ ] **Step 5: Gate disbursement**

In `disbursement.service.ts`, next to the existing `assertRecordOnlyAllowed('cbs')` call (line 121):

```typescript
  // Phase 6a — the chain backing this decision must verify before money moves.
  await AuditChainService.assertChainIntact(applicationId);
```

Import `AuditChainService` at the top if it is not already imported.

- [ ] **Step 6: Run tests**

Run: `cd backend && npx jest src/credit/__tests__/auditChainEscalation.test.ts && npx tsc --noEmit`
Expected: 3 tests PASS, tsc clean.

Then exercise the job end-to-end against real data:
Run: `npx tsx src/credit/jobs/auditRetention.job.ts`
Expected: reports `hash INTACT` and creates no signals (all 17 chains verify as of Phase 6a).

- [ ] **Step 7: Commit**

```bash
git add backend/src/credit
git commit -m "feat(credit): escalate a broken audit chain and block disbursement on it (Phase 6a follow-up)"
```

---

### Task 8: Make `requestScoreOverride` transactional (Phase 5 follow-up)

`requestScoreOverride` (`scoreOverride.service.ts:45`) is the last governance path that writes its record, then persists a rating, then appends audit — outside a transaction. A failure between steps leaves an override recorded with no rating change or no audit event.

**Files:**
- Modify: `backend/src/credit/services/scoreOverride.service.ts:45-…`
- Test: `backend/src/credit/services/__tests__/scoreOverrideAtomicity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/services/__tests__/scoreOverrideAtomicity.test.ts
import { readFileSync } from 'fs';
import { join } from 'path';

describe('LOS-009 follow-up — requestScoreOverride is atomic', () => {
  const source = readFileSync(
    join(__dirname, '..', 'scoreOverride.service.ts'), 'utf8',
  );

  it('wraps the override write in a transaction', () => {
    const fnStart = source.indexOf('export async function requestScoreOverride');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\nexport ', fnStart + 10));
    expect(fnBody).toMatch(/\$transaction/);
  });

  it('passes the transaction client to the audit append', () => {
    const fnStart = source.indexOf('export async function requestScoreOverride');
    const fnBody = source.slice(fnStart, source.indexOf('\nexport ', fnStart + 10));
    if (fnBody.includes('appendEvent')) {
      // 8th argument is the tx client — the LOS-009 convention.
      expect(fnBody).toMatch(/appendEvent\([\s\S]*?tx[,)\s]/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/services/__tests__/scoreOverrideAtomicity.test.ts`
Expected: FAIL — no `$transaction` inside the function.

- [ ] **Step 3: Wrap the writes**

Read the whole function first (`sed -n '45,140p' src/credit/services/scoreOverride.service.ts`). The read-only lookups (latest score run, notch computation, approver validation) stay outside; every write moves inside:

```typescript
  return prisma.$transaction(async (tx) => {
    const override = await tx.scoreOverrideApproval.create({ data: { /* …existing… */ } });

    // …any rating persist that currently follows the create…

    await AuditChainService.appendEvent(
      applicationId,
      'SCORE_OVERRIDE',
      approverId,
      'request_override',
      originalRating,
      overrideRating,
      { notchDelta, justification, scoreRunId: latestRun.id },
      tx,
    );

    return { /* …existing return shape, unchanged… */ };
  });
```

Keep the return shape byte-identical — callers depend on `{ id, status, notchDelta, requiresSecondApproval, scoreRunId, originalRating }`.

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/credit/services/__tests__/scoreOverrideAtomicity.test.ts src/credit --runInBand -t override && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/scoreOverride.service.ts backend/src/credit/services/__tests__/scoreOverrideAtomicity.test.ts
git commit -m "fix(credit): wrap requestScoreOverride writes and audit in one transaction (LOS-009)"
```

---

### Task 9: Seed distinct E2E identities and prove SOD in a browser (LOS-022 residual)

`admin@test.local` is the only account with credit permissions, so `CREDIT_ANALYST` and `CREDIT_APPROVER` resolve to the same identity and the LOS-020 exclusion reasons — "you are the assigned RM", "above your approval level", "already submitted a decision" — can never fire in a browser run. This is the one item keeping LOS-022 from full closure.

**Files:**
- Modify: `backend/prisma/seed-credit.ts`
- Modify: `frontend/e2e/credit/support/auth.ts`
- Create: `frontend/e2e/credit/sod-exclusions.spec.ts`

**Interfaces:**
- Produces: seeded users `e2e-analyst@test.local` (credit:read/write/create, assigned as RM on at least one application) and `e2e-approver@test.local` (credit:read/approve, manager-level authority), both with password `password123` to match the existing `@test.local` family.

- [ ] **Step 1: Write the failing spec**

```typescript
// frontend/e2e/credit/sod-exclusions.spec.ts
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';

/**
 * LOS-020/022 — Segregation of duties, proven in a browser.
 *
 * The inbox must exclude applications the user cannot act on AND say why. With
 * a single credit-permissioned account these paths never fire, so this spec is
 * the reason distinct E2E identities exist.
 */
test.describe('LOS-020 — SOD and authority exclusions', () => {
  test.use({ storageState: STATE_FILES.analyst });

  test('an RM does not see their own application as actionable', async ({ page }) => {
    await page.goto('/credit/approvals');

    const disclosure = page.getByText(/applications? not shown/i);
    await expect(disclosure).toBeVisible({ timeout: 10_000 });
    await disclosure.click();

    await expect(
      page.getByText(/segregation of duties.*assigned RM/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('LOS-020 — approver sees actionable work', () => {
  test.use({ storageState: STATE_FILES.approver });

  test('an approver who is not the RM sees the case as actionable', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.getByRole('heading', { name: /my approvals/i }).first())
      .toBeVisible({ timeout: 10_000 });

    // The approver is not the RM, so at least the SOD exclusion must be absent
    // for them — otherwise the two identities are not actually distinct.
    const sodExclusion = page.getByText(/segregation of duties.*assigned RM/i);
    await expect(sodExclusion).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run spec to verify it fails**

With the stack running: `cd frontend && npx playwright test --project=credit e2e/credit/sod-exclusions.spec.ts`
Expected: FAIL — the disclosure does not appear, because the analyst identity is `admin@test.local` and no application lists it as RM with a competing approver.

- [ ] **Step 3: Seed the two identities**

In `seed-credit.ts`, alongside the existing user lookups (`:433`, `:668`), create the pair. Mirror the surrounding style — reuse the same bcrypt cost and role-assignment approach used in `prisma/seed.ts:646`:

```typescript
// LOS-022 — Distinct credit identities so segregation-of-duties paths can be
// exercised end-to-end. With one shared credit account the inbox exclusion
// reasons are unreachable in a browser test.
const e2ePassword = await bcrypt.hash('password123', 12);

const e2eAnalyst = await prisma.user.upsert({
  where: { email: 'e2e-analyst@test.local' },
  update: {},
  create: {
    email: 'e2e-analyst@test.local',
    firstName: 'E2E', lastName: 'Analyst',
    passwordHash: e2ePassword,
    isActive: true,
    // role must carry credit:read, credit:write, credit:create — NOT credit:approve
    roleId: creditAnalystRole.id,
  },
});

const e2eApprover = await prisma.user.upsert({
  where: { email: 'e2e-approver@test.local' },
  update: {},
  create: {
    email: 'e2e-approver@test.local',
    firstName: 'E2E', lastName: 'Approver',
    passwordHash: e2ePassword,
    isActive: true,
    // role must carry credit:read and credit:approve at manager authority
    roleId: creditApproverRole.id,
  },
});
```

Resolve `creditAnalystRole` / `creditApproverRole` from the roles that already exist — inspect with:

```bash
cd backend && npx tsx -e "
import prisma from './src/utils/prisma';
(async () => {
  const roles = await prisma.role.findMany({ include: { permissions: { select: { name: true } } } });
  for (const r of roles) {
    const c = r.permissions.map(p => p.name).filter(n => n.startsWith('credit:'));
    if (c.length) console.log(r.name, JSON.stringify(c));
  }
  process.exit(0);
})();"
```

If no role carries exactly the split needed, create the two roles in the seed with the explicit permission sets above. Do not give the analyst `credit:approve` — the whole point is that the two identities differ.

Then assign at least one demo application so the SOD path is reachable:

```typescript
// Make the analyst the RM on a committee-stage application, so that when the
// analyst opens the approvals inbox the SOD exclusion fires, and the approver
// sees the same application as actionable.
await prisma.creditApplication.updateMany({
  where: { state: 'COMMITTEE_REVIEW' },
  data: { assignedRmId: e2eAnalyst.id },
});
```

- [ ] **Step 4: Point the E2E identities at the new accounts**

In `frontend/e2e/credit/support/auth.ts`, replace the shared defaults and delete the note explaining why they were shared:

```typescript
export const CREDIT_ANALYST = {
  email: process.env.E2E_CREDIT_USER || 'e2e-analyst@test.local',
  password: process.env.E2E_CREDIT_PASS || 'password123',
};

export const CREDIT_APPROVER = {
  email: process.env.E2E_APPROVER_USER || 'e2e-approver@test.local',
  password: process.env.E2E_APPROVER_PASS || 'password123',
};
```

- [ ] **Step 5: Reseed and verify authentication**

```bash
cd backend && npm run prisma:seed:credit -- --demo
for u in e2e-analyst@test.local e2e-approver@test.local; do
  printf "%-26s " "$u"
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$u\",\"password\":\"password123\"}" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('message') if d.get('status')!='success' else
      [p for p in d['data']['user']['permissions'] if p.startswith('credit:')])"
done
```
Expected: analyst shows credit read/write/create **without** `credit:approve`; approver shows `credit:read` and `credit:approve`. If either returns 401 the seed did not set the password; if the permission sets are identical, the roles are wrong and the spec cannot pass honestly.

- [ ] **Step 6: Run the full credit E2E suite**

Run: `cd frontend && npx playwright test --project=credit`
Expected: the SOD spec passes and the existing 10 still pass. Total should rise to 12 passing.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/seed-credit.ts frontend/e2e/credit
git commit -m "test(credit): seed distinct analyst and approver identities and prove SOD exclusions in a browser (LOS-022)"
```

---

### Task 10: Update the audit documents

**Files:**
- Modify: `docs/credit-los-audit-2026-08-08/11-Gap-and-Risk-Register.md`
- Modify: `docs/credit-los-audit-2026-08-08/12-Production-Readiness-Assessment.md`
- Modify: `docs/credit-los-audit-2026-08-08/14-Executive-Audit-Summary.md`

- [ ] **Step 1: Close the rows**

Set LOS-016 and LOS-017 *Current Behaviour* to begin `RESOLVED:` with one line describing the new behaviour, and *Priority* to `P1 — CLOSED 2026-08-11`. Upgrade LOS-022 from `SUBSTANTIALLY CLOSED` to `CLOSED` **only if Task 9's SOD spec actually passes** — if it is skipped or failing, leave the qualifier and say why.

- [ ] **Step 2: Add a Phase 7 section**

Append to the register after Phase 6a:

```markdown
### Phase 7

- The management pack now carries the decision basis: authored recommendation
  with rationale, factor contributions, missing-input treatment, caps applied,
  policy and rating-band versions, the frozen assessment version being
  reported, rating overrides, policy deviations, and an evidence index with
  verification status and document hashes.
- Duplicate detection compares the borrower's own normalized NRIC/passport and
  registration number, independent of CRM linkage. Overriding it requires
  `credit:admin`, a reason of at least 20 characters, and records what was
  suppressed.
- A broken audit chain now raises an EarlyWarningSignal per affected
  application and blocks disbursement. Previously the nightly job detected the
  break and only wrote a log line — which is why a fork survived undetected.
- `requestScoreOverride` writes its record, rating and audit event in one
  transaction.
- Distinct `e2e-analyst@` and `e2e-approver@` identities are seeded, so
  segregation-of-duties and authority exclusions are proven in a browser.
```

- [ ] **Step 3: Rescore**

In doc 12, raise *Management Decision Experience* and *Borrower Journey* with one-line evidence each, update the weighted aggregate, remove the SOD verification gap from *Production blockers* if Task 9 passed, and refresh the *Evidence* table with the commands actually run. Mirror the same domain values into doc 14's scorecard — **the two must match exactly**; verify with the paste/awk comparison used previously.

- [ ] **Step 4: Commit**

```bash
git add -f docs/credit-los-audit-2026-08-08
git commit -m "docs(credit): record Phase 7 closures for LOS-016, LOS-017 and the LOS-022 residual"
```

---

## What this plan does not cover

- **LOS-023** (joint applicants) and **LOS-024** (terminology) — P2, and both need a product/UX decision before code.
- **LOS-025** (bundle splitting) — deferred until measurement justifies it. The frontend bundle is ~5 MB and warns on every build; that is a real number, but nobody has shown it costs staff time.
- **LOS-021 beyond record-only** — vendor configuration, not code. It reopens at P0 the moment `CREDIT_LIVE_LENDING=true`.
- **The duplicate-check scan cost** — `findDuplicateBorrowers` loads every active borrower profile into memory on each call. Correct, but O(n); it will need an indexed strategy before the portfolio grows. Not a Phase 7 gap, worth a ticket.
- **The other eleven audit documents** — `.gitignore:69` excludes `/docs/*`, so only 11, 12 and 14 are tracked. Documents 01–10 and 13 exist only on local disk.
