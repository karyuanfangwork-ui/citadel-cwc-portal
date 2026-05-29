# Bureau Placeholder Cleanup — Implementation Plan

**Created:** 2026-05-29
**Parent docs:** `26-comprehensive-audit-2026-05-29.md`, `27-implementation-plan-2026-05-29.md`
**Scope:** Remove the misleading "we'll pull CCRIS soon" framing from the codebase and align the bureau-check surface with Citadel's non-bank SME lender reality.
**Pre-requisite:** Wave 0.5 of the master plan does **not** need to be signed off for this work — this is housekeeping that improves compliance posture and unblocks Wave 4 cleanly.
**Estimated total effort:** S (≤ 1.5 dev-days) end-to-end.
**Risk:** Low — touches dev-time defaults, comments, an unused adapter, and a UI dropdown; no behavioural change in any production-active code path.

---

## CONTEXT — What's in the codebase today

Audit of all CCRIS / CTOS references found **8 locations in 3 categories**:

### Category A — Placeholder bureau adapter *(dead code today)*
| File | Lines | Status |
|---|---|---|
| `backend/src/credit/adapters/bureau.placeholder.ts` | 1–27 | `PlaceholderBureauProvider` returning `MOCK-BUREAU-*` stubs |
| `backend/src/credit/adapters/interfaces.ts` | 75–84 | `IBureauProvider` interface — comment refs `CTOS/CCRIS/RAM` |
| `backend/src/credit/adapters/registry.ts` | 4, 21, 40–44, 65 | Wires `PlaceholderBureauProvider` as default |

**Critical observation:** `getBureauProvider()` is **never called** anywhere in the backend (grep confirms only the definition + registry, no consumers). The placeholder is harmless dead code today — but it is a footgun for the future: any developer wiring a bureau-call feature would silently get mocks in production unless explicitly gated.

### Category B — UI + service-layer provider enum *(live, analyst-facing)*
| File | Lines | Status |
|---|---|---|
| `backend/prisma/schema.prisma` | 3978–3987 | `enum BureauProvider { CCRIS, CTOS, EXPERIAN, PEP_WATCHLIST, IF_ACTIVA, PUBLIC_DOMAIN }` |
| `frontend/src/services/credit.service.ts` | 1677 | TS mirror of enum |
| `frontend/pages/credit/tabs/CreditChecksTab.tsx` | 14–22, 25, 40 | Provider dropdown; default `'CCRIS'` |

Powers the manual **Add Bureau Check** form. Analyst picks `CCRIS`, types subject, run date, hits, findings. **Compliance smell:** an audit could ask "show me your CCRIS access agreement for these dated entries." Citadel has none — and as a non-bank lender cannot have one.

### Category C — `AccountClassification.NON_CCRIS_RR` / `CCRIS_RR` *(legitimate domain terminology)*
| File | Lines | Status |
|---|---|---|
| `backend/prisma/schema.prisma` | 2393–2398 | enum values |
| `backend/src/credit/services/creditApplication.service.ts` | 19 | type literal |
| `backend/src/credit/validators/creditApplication.validator.ts` | 21 | validator literal |
| `frontend/src/constants/creditEnums.ts` | 18–19 | UI labels |

These are BNM portfolio classification labels for restructured & rescheduled accounts (CCRIS-reportable vs not). **Not bureau-pull code. Keep as-is.**

---

## OBJECTIVES

1. Remove the implied-but-untrue claim that Citadel pulls CCRIS.
2. Make the bureau-check surface match what Citadel can legitimately do today (borrower-uploaded eCCRIS, SSM, bank-statement analysis, public-domain).
3. Preserve historical `CCRIS` enum values so existing rows + migrations stay intact.
4. Add a guard so a future developer cannot accidentally ship the no-op bureau provider to production undetected.
5. Disambiguate `AccountClassification` from bureau-pull terminology so future readers don't conflate them.

## NON-OBJECTIVES

- Wiring any real bureau vendor — that is Wave 4.3 (CTOS) and Wave 4.5 (AML) in the master plan, blocked on Wave 0.5.
- Building the eCCRIS borrower-upload workflow — that is Wave 4.1.
- Changing `AccountClassification` values or behaviour.
- Backfilling / migrating existing `CreditBureauCheck` rows.

---

## WORK PACKETS — execute top-to-bottom

> Each packet is independently mergeable. Suggested: bundle 1–5 into a single PR titled **"chore(credit): align bureau-check surface with non-bank-lender reality"**.

### Packet 1 — Prisma enum changes + migration
**Track:** DATA · **Effort:** S · **Deps:** none

**Files**
- `backend/prisma/schema.prisma`

**Changes**

(a) `BureauProvider` enum — add three new values, keep `CCRIS` for historical rows, add a clarifying comment:

```prisma
// Bureau-check provider tag for CreditBureauCheck rows.
// Citadel CWC is a non-bank SME lender and does NOT pull CCRIS directly
// (CCRIS access is restricted to BNM-licensed entities). The CCRIS value
// is RETAINED for historical rows only; new manual entries must use
// CCRIS_BORROWER_UPLOAD (borrower self-pulls via eccris.bnm.gov.my and
// uploads the PDF as a CreditDocument). See:
//   docs/credit-assessment/27-implementation-plan-2026-05-29.md §4.1
enum BureauProvider {
  CCRIS                       // historical only — do not select for new checks
  CCRIS_BORROWER_UPLOAD       // borrower self-pull from eCCRIS (free, legal)
  CTOS
  EXPERIAN
  CBM                         // Credit Bureau Malaysia (optional)
  SSM_EINFO                   // company verification
  BANK_STATEMENT_ANALYSIS     // internal cash-flow assessment
  PEP_WATCHLIST
  IF_ACTIVA
  PUBLIC_DOMAIN
}
```

(b) `AccountClassification` enum — add a comment block (no value change):

```prisma
// BNM-aligned portfolio classification.
// NON_CCRIS_RR / CCRIS_RR refer to the regulatory CCRIS-reportability of
// Restructured & Rescheduled accounts. These are internal portfolio labels
// and do NOT imply Citadel performs direct CCRIS pulls (it does not).
enum AccountClassification {
  PERFORMING
  EARLY_CARE
  WATCHLIST
  NON_CCRIS_RR
  CCRIS_RR
  IMPAIRED
}
```

**Migration**
- Use `npx prisma db push` (not `prisma migrate dev` — no shadow database is configured for this project; see note below).
- Migration is **additive only** — adds enum values + comments. Existing rows unaffected.
- For production deployments, write a manual SQL migration file if needed (adding enum values to a PostgreSQL enum requires `ALTER TYPE ... ADD VALUE`).

> **Note:** `prisma migrate dev` requires a `shadowDatabaseUrl` in the datasource block, which is not configured in this project. Memory note: never use `prisma migrate dev` — always use `prisma db push` for local dev and manual SQL migrations for production.

**Acceptance criteria**
- [ ] `npx prisma db push` succeeds.
- [ ] `npx prisma generate` produces an updated client with the new values.
- [ ] Existing `CreditBureauCheck` rows continue to load (smoke test in seed data).
- [ ] No downstream `switch`/`if` statement on `BureauProvider` becomes non-exhaustive (TS compile clean).

---

### Packet 2 — TypeScript type mirror + centralized labels
**Track:** DATA · **Effort:** XS · **Deps:** Packet 1

**Files**
- `frontend/src/services/credit.service.ts` (line 1677)
- `frontend/src/constants/creditEnums.ts`

**Changes**

(a) `credit.service.ts` — expand the `BureauProvider` type union:

```ts
export type BureauProvider =
  | 'CCRIS'                       // historical only
  | 'CCRIS_BORROWER_UPLOAD'
  | 'CTOS'
  | 'EXPERIAN'
  | 'CBM'
  | 'SSM_EINFO'
  | 'BANK_STATEMENT_ANALYSIS'
  | 'PEP_WATCHLIST'
  | 'IF_ACTIVA'
  | 'PUBLIC_DOMAIN';
```

(b) `creditEnums.ts` — add centralized options + label helper (follows existing pattern in this file):

```ts
import type { ..., BureauProvider } from '../services/credit.service';

export const BUREAU_PROVIDER_OPTIONS: { value: BureauProvider; label: string }[] = [
  { value: 'CCRIS_BORROWER_UPLOAD', label: 'CCRIS (borrower self-pull via eCCRIS)' },
  { value: 'CTOS',                  label: 'CTOS' },
  { value: 'EXPERIAN',              label: 'Experian RAMCI' },
  { value: 'CBM',                   label: 'Credit Bureau Malaysia (CBM)' },
  { value: 'SSM_EINFO',             label: 'SSM e-Info' },
  { value: 'BANK_STATEMENT_ANALYSIS', label: 'Bank Statement Analysis' },
  { value: 'PEP_WATCHLIST',         label: 'PEP / Sanctions / Watchlist' },
  { value: 'IF_ACTIVA',             label: 'IF Activa' },
  { value: 'PUBLIC_DOMAIN',         label: 'Public Domain (news, registries)' },
];

export const bureauProviderLabel = (v: BureauProvider | null | undefined): string => {
  if (v === 'CCRIS') return 'CCRIS (legacy — do not select)';
  return BUREAU_PROVIDER_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');
};
```

> **Design note:** `PROVIDER_LABELS` was originally planned as an inline `Record<BureauProvider, string>` in `CreditChecksTab.tsx`. During implementation, this was moved to a centralized `bureauProviderLabel()` helper in `creditEnums.ts` to follow the existing pattern (`applicationTypeLabel`, `accountClassificationLabel`, `accountStrategyLabel`) and to handle the legacy `CCRIS` value with a special case rather than polluting the selectable dropdown options. The old `PROVIDER_LABELS` map was removed from `CreditChecksTab.tsx` entirely — Packet 3 imports `bureauProviderLabel` from `creditEnums.ts` instead.

**Acceptance criteria**
- [ ] Type matches Prisma enum exactly.
- [ ] `npm run build` in `frontend/` clean.
- [ ] No TS error in `CreditChecksTab.tsx` after Packet 3.

---

### Packet 3 — UI surface in `CreditChecksTab.tsx`
**Track:** UX / CTRL · **Effort:** S · **Deps:** Packet 1 + 2

**Files**
- `frontend/pages/credit/tabs/CreditChecksTab.tsx`
- `frontend/src/constants/creditEnums.ts` (updated in Packet 2)

**Changes**

(a) **Drop `CCRIS` from `PROVIDERS`** (selectable list) — keep in the type so historical rows still render. Remove the inline `PROVIDER_LABELS` map and import `BUREAU_PROVIDER_OPTIONS` + `bureauProviderLabel` from `creditEnums.ts` instead:

```ts
import { BUREAU_PROVIDER_OPTIONS, bureauProviderLabel } from '../../../src/constants/creditEnums';

/* Selectable providers for new manual entries — CCRIS excluded (historical only) */
const PROVIDERS: BureauProvider[] = [
  'CCRIS_BORROWER_UPLOAD',
  'CTOS',
  'EXPERIAN',
  'CBM',
  'SSM_EINFO',
  'BANK_STATEMENT_ANALYSIS',
  'PEP_WATCHLIST',
  'IF_ACTIVA',
  'PUBLIC_DOMAIN',
];
```

> **Implementation deviation:** The original plan specified an inline `PROVIDER_LABELS: Record<BureauProvider, string>` in this file. During implementation, labels were centralized into `creditEnums.ts` following the existing pattern (see Packet 2 design note). The `PROVIDER_LABELS` constant was removed entirely — `bureauProviderLabel()` handles all lookups including the legacy `CCRIS` case.

(b) **Change default** from `'CCRIS'` to `'CCRIS_BORROWER_UPLOAD'` in both the `useState` initial value and the reset in `setForm()` after submit.

(c) **Update provider dropdown** to use `bureauProviderLabel(p)` instead of `PROVIDER_LABELS[p]`:

```tsx
{PROVIDERS.map(p => <option key={p} value={p}>{bureauProviderLabel(p)}</option>)}
```

(d) **Required-document gate** when `CCRIS_BORROWER_UPLOAD` selected — surface a helper note (do not hard-block in this packet; that is Wave 4.1):

```tsx
{form.provider === 'CCRIS_BORROWER_UPLOAD' && (
  <p className="text-xs text-amber-600 col-span-2">
    Borrower must upload their eCCRIS PDF as a <code>CREDIT_BUREAU_REPORT</code> document
    before this check can be relied upon. See the Documents tab.
  </p>
)}
```

(e) **Render guard for historical `CCRIS` rows** — display them with a "(legacy)" suffix using `bureauProviderLabel()` which returns `'CCRIS (legacy — do not select)'` for the `CCRIS` value:

```tsx
<span className="text-sm font-semibold">
  {bureauProviderLabel(check.provider)}
  {check.provider === 'CCRIS' && <span className="ml-1 text-[10px] text-amber-600 font-normal">(legacy)</span>}
</span>
```

**Acceptance criteria**
- [ ] `CCRIS` is not in the new-entry dropdown.
- [ ] Default selection is `CCRIS (borrower self-pull via eCCRIS)`.
- [ ] Historical `CCRIS` rows render with `(legacy)` label and no error.
- [ ] Selecting `CCRIS_BORROWER_UPLOAD` shows the helper note.
- [ ] Visual QA on Chrome desktop + tablet.

---

### Packet 4 — Rename `PlaceholderBureauProvider` → `NoopBureauProvider` and update comments
**Track:** OPS · **Effort:** XS · **Deps:** none

**Files**
- `backend/src/credit/adapters/bureau.placeholder.ts` → rename file to `bureau.noop.ts`
- `backend/src/credit/adapters/interfaces.ts`
- `backend/src/credit/adapters/registry.ts`

**Changes**

(a) `bureau.noop.ts` — rename class + rewrite header:

> **Implementation fix:** The original plan's `NoopBureauProvider` methods took no parameters, but the `IBureauProvider` interface requires `params: { nricPassport: string }` and `params: { registrationNumber: string }` respectively. The actual implementation uses `_params` (underscore-prefixed to indicate unused) to satisfy the interface contract.

```ts
import { IBureauProvider, BureauReport } from './interfaces';

/**
 * No-op Bureau Provider — returns null scores/reports.
 *
 * Used only in dev/CI/test where no real vendor is configured.
 * In production, a real provider MUST be wired and the registry guard
 * (see registry.ts) will throw at boot if this no-op is active while
 * `credit:bureau_checks=true`.
 *
 * Real providers are tracked in:
 *   docs/credit-assessment/27-implementation-plan-2026-05-29.md
 *     Wave 4.3 — CTOS adapter (primary commercial bureau)
 *     Wave 4.5 — AML / sanctions / PEP adapter
 *
 * Citadel CWC is a non-bank SME lender; direct CCRIS access is not
 * available. The eCCRIS substitute is Wave 4.1 (borrower self-upload).
 */
export class NoopBureauProvider implements IBureauProvider {
  async getIndividualReport(_params: { nricPassport: string }): Promise<BureauReport> {
    return {
      score: null,
      rating: null,
      providerRef: `NOOP-BUREAU-${Date.now()}`,
      reportSummary: null,
      retrievedAt: new Date(),
    };
  }

  async getCorporateReport(_params: { registrationNumber: string }): Promise<BureauReport> {
    return {
      score: null,
      rating: null,
      providerRef: `NOOP-BUREAU-CORP-${Date.now()}`,
      reportSummary: null,
      retrievedAt: new Date(),
    };
  }
}
```

(b) `interfaces.ts` line 75 — update the comment:

```ts
/**
 * Credit bureau provider.
 *
 * Real implementations: CTOS (primary, see Wave 4.3), Experian RAMCI,
 * CBM. CCRIS is NOT in scope — Citadel is a non-bank lender and uses
 * the borrower-uploaded eCCRIS workflow instead (Wave 4.1).
 */
export interface IBureauProvider {
  ...
}
```

(c) `registry.ts` — update import + class name (Packet 5 adds the guard).

**Acceptance criteria**
- [ ] File renamed; old import path no longer resolves anywhere.
- [ ] `npm run build` (backend) clean.
- [ ] Existing tests still green (if any reference the class name, update them).

---

### Packet 5 — Boot-time guard in `registry.ts`
**Track:** SEC · **Effort:** S · **Deps:** Packet 4

**Files**
- `backend/src/credit/adapters/registry.ts`

**Changes**

Add a guard that runs when `getBureauProvider()` is first invoked. Behaviour:

| `NODE_ENV` | `credit:bureau_checks` flag | No real provider configured | Behaviour |
|---|---|---|---|
| `development` / `test` | any | any | Use `NoopBureauProvider`, log at debug level once |
| `production` | `false` (default today) | yes | Use `NoopBureauProvider`, log a loud **warning** at boot |
| `production` | `true` | yes | **Throw** at first call — refuse to serve mocks when flag claims bureau is live |
| `production` | `true` | real provider configured | Use real provider |

> **Implementation adjustments from original pseudocode:**
>
> 1. **`isFeatureEnabled` is async** — it queries `prisma.featureFlag` via a 60-second TTL cache. The actual `getBureauProvider()` must therefore be `async` and return `Promise<IBureauProvider>`. The import path is `../middleware/featureFlag.middleware` (not `../../utils/featureFlags` as originally drafted).
> 2. **`config.env` not `config.nodeEnv`** — the centralized config module exports `config.env` (set from `NODE_ENV`), not `config.nodeEnv`.
> 3. **`loadRealProvider` stub** is a local `function` (not exported) that throws `"Real bureau provider not implemented — see Wave 4.3 (CTOS adapter)"`.

Actual implementation:

```ts
import { config } from '../../config';
import { isFeatureEnabled } from '../middleware/featureFlag.middleware';
import { logger } from '../../utils/logger';
import { NoopBureauProvider } from './bureau.noop';

let bureauProvider: IBureauProvider | null = null;
let bureauGuardChecked = false;

export async function getBureauProvider(): Promise<IBureauProvider> {
  if (bureauProvider) return bureauProvider;

  const realProviderConfigured = !!process.env.BUREAU_PROVIDER; // env-driven, e.g. "ctos"
  const flagOn = await isFeatureEnabled('credit:bureau_checks');
  const isProd = config.env === 'production';

  if (isProd && flagOn && !realProviderConfigured) {
    throw new Error(
      'BureauProvider misconfig: credit:bureau_checks=true in production but ' +
      'no BUREAU_PROVIDER env configured. Refusing to serve no-op bureau data. ' +
      'See docs/credit-assessment/27-implementation-plan §4.3.',
    );
  }

  if (isProd && !realProviderConfigured && !bureauGuardChecked) {
    logger.warn(
      '[credit] BureauProvider: no real vendor configured; using NoopBureauProvider. ' +
      'This is acceptable only while credit:bureau_checks=false.',
    );
    bureauGuardChecked = true;
  }

  bureauProvider = realProviderConfigured
    ? loadRealProvider(process.env.BUREAU_PROVIDER!)
    : new NoopBureauProvider();

  return bureauProvider;
}

/** Stub — real provider wiring is Wave 4.3 */
function loadRealProvider(_key: string): IBureauProvider {
  throw new Error('Real bureau provider not implemented — see Wave 4.3 (CTOS adapter)');
}
```

**Acceptance criteria**
- [ ] Unit test: `NODE_ENV=production` + flag `true` + no provider → throws.
- [ ] Unit test: `NODE_ENV=production` + flag `false` + no provider → returns noop + warns once.
- [ ] Unit test: `NODE_ENV=development` → returns noop silently.
- [ ] Manual: boot the backend locally → no error.

---

### Packet 6 — README / docs cross-links
**Track:** OPS · **Effort:** XS · **Deps:** Packets 1–5 merged

**Files**
- `docs/credit-assessment/00-README.md`
- `docs/credit-assessment/19-adapter-swap-procedure.md`

**Changes**

- Add a one-paragraph note to the README under "Bureau / Integration status" pointing to this cleanup doc + Wave 4.1/4.3 in the implementation plan.
- Update `19-adapter-swap-procedure.md` to reference `NoopBureauProvider` (not `PlaceholderBureauProvider`) and to call out the registry guard.

**Acceptance criteria**
- [ ] Future readers of `00-README.md` find a clear pointer to the bureau strategy.
- [ ] `19-adapter-swap-procedure.md` has no stale `Placeholder*` names.

---

## EXECUTION ORDER + EFFORT SUMMARY

| Packet | Description | Effort | Cumulative |
|---|---|---|---|
| 1 | Prisma enum + migration + comments | S | 0.5d |
| 2 | TS type mirror | XS | 0.6d |
| 3 | `CreditChecksTab.tsx` UI update | S | 1.0d |
| 4 | Rename Placeholder → Noop + interface comment | XS | 1.1d |
| 5 | Registry boot-time guard + tests | S | 1.4d |
| 6 | Docs cross-links | XS | 1.5d |

**Suggested PR strategy:** one PR with Packets 1–5 (titled `chore(credit): align bureau-check surface with non-bank-lender reality`), a separate tiny docs-only PR for Packet 6.

---

## RISK & ROLLBACK

| Risk | Likelihood | Mitigation |
|---|---|---|
| Prisma `db push` fails in an env with existing `CreditBureauCheck` rows | Low | Migration is purely additive (enum values + comments); existing rows unaffected. Test on staging copy of prod data. Note: `prisma migrate dev` cannot be used (no shadow DB configured) — use `prisma db push` locally and manual `ALTER TYPE ... ADD VALUE` SQL for production. |
| TS type drift causes frontend build break | Low | Packets 1 + 2 ship together; CI catches. |
| Hidden code path calls `getBureauProvider()` we missed | Low | Grepped — no consumers exist today. Guard in Packet 5 turns any future silent regression into a loud failure. |
| Users miss the dropdown change and continue selecting "CCRIS (legacy)" | Low | Removed from selectable `PROVIDERS` array; only renders for historical rows. |
| Migration is hard to reverse | Low | Removing an unused enum value in a follow-up migration is trivial; we are not changing semantics. |

**Rollback:** `git revert` the PR. The Prisma schema change was applied via `prisma db push` (not `migrate dev`) — reverting the schema in code requires manually removing the new enum values from the database with `ALTER TYPE ... REMOVE VALUE` (PostgreSQL 12+) or a follow-up migration, but causes no data loss since the new values have no rows yet.

---

## DEFINITION OF DONE

- [ ] All 6 packets merged.
- [ ] `npm run build` clean in both `backend/` and `frontend/`.
- [ ] `npx prisma db push` succeeds on staging.
- [ ] Unit tests for registry guard pass (4/4: dev-noop, prod-flag-off-warns, prod-flag-on-throws, prod-flag-off-returns-noop).
- [ ] Add Bureau Check form defaults to `CCRIS (borrower self-pull via eCCRIS)`.
- [ ] Boot-time guard verified by toggling the feature flag in a staging environment.
- [ ] Audit-doc cross-link (`docs/credit-assessment/00-README.md`) points to this plan + the master plan §4.1 / §4.3.
- [ ] Internal Audit informed: "we have removed the implication that we pull CCRIS; manual entries pre-dating this change retain the `CCRIS` label for traceability."

---

*End of plan. Pair with `27-implementation-plan-2026-05-29.md` Wave 4.1 (eCCRIS workflow) — that wave consumes the new `CCRIS_BORROWER_UPLOAD` enum value introduced here.*
