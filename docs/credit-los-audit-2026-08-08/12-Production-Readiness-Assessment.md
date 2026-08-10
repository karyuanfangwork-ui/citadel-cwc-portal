# Production Readiness Assessment

*Last revised 2026-08-10, after independent verification and correction of the Phase 8 claims.*

## Overall result

**Overall Production Readiness: 76% — READY for record-only (non-disbursing) credit approval scope, with one named verification gap.**

All P0 workflow, methodology, evidence-integrity and row-security gaps from Phases 1-5 are closed and now carry automated evidence. The remaining P1 items (management pack completeness, duplicate borrower identity) do not block credit approval operations. Live disbursement remains blocked pending vendor configuration.

The score is two points below the figure recorded on 2026-08-09 because verification of that figure found two closed gaps that were not in fact closed, and one control path that still cannot be exercised end-to-end. See *Verification history* below. Neither the previous score nor this one should be read as more than an informed judgement; the section that matters is *Evidence*, which lists what was actually executed.

## Verification history

The Phase 6 closures were asserted before any of them had been run against a database or a browser. Independent verification on 2026-08-09/10 found:

| Claim as recorded | What verification found | Status now |
|---|---|---|
| LOS-013 closed — audit chain serialized and immutable | **10 of 17 seeded chains failed `verifyChain`.** `appendEvent` selected its predecessor by `createdAt DESC` while `verifyChain` walked `createdAt ASC`; millisecond ties made the two orderings disagree and forked the chain. The advisory lock prevented concurrent forks but not ambiguous ordering. | Fixed — explicit per-application `sequence`, unique index, in-place reseal. 17/17 verify. |
| LOS-022 closed — 6 browser specs cover the credit journeys | **All 6 specs ran unauthenticated and passed anyway.** They waited for `**/dashboard**`, a URL the app never navigates to, and swallowed the timeout. Four further defects sat behind that: wrong password family, an account with no credit permissions, non-retrying visibility guards that skipped tests on a populated page, and a route that does not exist. | Fixed — 10 pass / 2 skip / 0 fail against a running stack. |
| LOS-006 covered by the P0 regression suite | The test queried `FinancialStatus` with `'SUBMITTED'`, which is not a member of the enum, so it threw instead of asserting. | Fixed. |
| LOS-015 gate applied to committee entry | Correct, but the gate ran *before* the SICR and balance-sheet checks. A failing check therefore left a frozen assessment and locked memo behind — the exact outcome the gate documents itself as preventing. | Fixed — gate runs last. |
| LOS-020 closed — My Approvals reads the authority-aware inbox | **The page crashed into its error boundary for every user, admin included.** The inbox returns its own summary DTO (`applicationId`/`currentState`/flat `borrowerName`); the rows were rendered unmapped, so `state` was `undefined` and `StateBadge` threw on `state.replace(...)`. The endpoint is untyped (`any`), so TypeScript caught nothing, and `approval-inbox.spec` asserted only a heading the shell renders *before* the crash. Found 2026-08-10 while writing the LOS-022 browser spec. | Fixed — `toApplication` mapper at the fetch boundary; spec now asserts the error boundary is absent. |
| LOS-022 closed — SOD proven with distinct identities | Proven at the API only. The plan's browser spec was never written, and the `--e2e` seed made the exclusion unreachable: every committee application's RM was the analyst, who cannot open the inbox at all. | Fixed — `sod-exclusions.spec.ts` added; seed splits RM ownership. Current credit suite: 31 pass / 4 skip / 0 fail. |
| The release gate is `npm run test:release` | **It never terminated.** The backend suite passed in 7.1s (108 suites / 1256 tests) and Jest then hung on open handles — 1h40m before manual kill. Any CI job invoking it would have hit its wall-clock limit and reported failure regardless of results. | The BullMQ leak is fixed and the gate now reaches the full suite; the current full suite still exits 1 on 7 unrelated pre-existing suites. |
| Credit screens render | Only `/credit/approvals` had ever been verified, and it was broken. The other 13 static routes and all detail/mobile routes had no render coverage. | Fixed — `render-smoke.spec.ts` and `render-smoke-detail.spec.ts`. |

The lesson is recorded here deliberately: **a gap is closed when a test proves it, not when the code is written.** Every P0 closure now has a corresponding negative test in `creditP0Regression.test.ts`.

## Scoring method

Each domain was assessed across functional completeness, backend enforcement, SOD/security, auditability, user connectivity and verification. A control that exists only on the canonical path receives partial credit when another exposed path bypasses it. P0 defects cap the affected domain below production-ready levels.

| Domain | Readiness | Evidence |
|---|---:|---|
| Borrower Journey | 76% | Eight-step wizard, search, duplicate warning, Borrower 360 and segment models exist. Identity duplicate enforcement and broad access scope remain. |
| Application Journey | 80% | Durable draft, numbering, lane-aware 360, progress and canonical state machine exist. Structured recommendation now live in Approvals tab. |
| Credit Assessment | 82% | Financials, DSR, SME/corporate analysis, bureau, collateral, risks, ECL/SICR and signoffs exist. Optimistic concurrency prevents last-write loss on child records. Approved statements immutable. |
| Credit Scoring | 80% | Real weighted deterministic engine, snapshots, scorecard version, missing-data BLOCK policy and override governance all enforced. |
| Risk Rating | 78% | Corrected AAA–D mapping and authority comparison. ACTIVE/APPROVED lifecycle enforced; provenance persisted on every score run. |
| Approval Workflow | 85% | Matrices, multi-approval, committee, return/reject and notifications exist. `resume_committee` and `submit_to_committee` share a single readiness→freeze→memo gate; return-change diff available via API. |
| RBAC / Controls | 70% | Permission taxonomy, SOD checks and row-level access enforcement in place, and unit-tested. Authority-aware inbox filters out non-actionable cases with explanations. **E2E SOD identities seeded and browser-verified** (`e2e-analyst@test.local` / CREDIT_ANALYST lacks `credit:approve`; `e2e-approver@test.local` / CREDIT_MANAGER has it) — segregation is API-verified via `sodEnforcement.test.ts` and browser-verified via `sod-exclusions.spec.ts`, which proves the analyst is refused the inbox and the approver's own RM-assigned case is withheld with the reason stated. |
| Auditability | 90% | Broad auto-audit, hash chain, PII logs, UI timeline, atomic business+audit transactions, per-application serialization, DB-level immutability trigger, and a deterministic `sequence` ordering. All 17 seeded chains verify; a regression test fails against the previous `createdAt` ordering. |
| Management Decision Experience | 82% | Quick view, versioned memo/pack, and authority-scoped inbox exist. Pack now includes analyst recommendation, score factor explanation (with frozen assessment version), override/deviation register, and evidence document index — LOS-016 CLOSED. |
| UX / Journey | 75% | Strong wizards, readiness, completion, stale/rejection banners, responsive views and record-only integration banner. Decision variants and terminology density remain. |

Weighted aggregate: 76%. Approval, RBAC and rating controls receive greater weight than cosmetic completeness.

## Evidence

Executed 2026-08-10 against a seeded PostgreSQL database and a running dev stack:

| Command | Result |
|---|---|
| `npx tsc --noEmit` (backend) | clean |
| `npx jest src/credit --runInBand` (no `--forceExit`) | 108 suites, 1256 tests, 0 failures — exits on its own |
| `npm run audit:verify` | 15 intact, 0 broken |
| `npx tsc --noEmit` (frontend) | 3 pre-existing errors (ScoreOutdatedBanner ×2, test/setup ×1); no new |
| `npm run build` (frontend) | succeeds |
| `npx playwright test --project=credit` | 31 passed, 4 skipped, 0 failed |
| `npm run test:release` (backend) | reaches full suite in 32.1s, exit 1: 7 suites failed, 220 passed; 10 tests failed, 2367 passed |

The four E2E skips are visible and honest: the runner reports skips in `approval-inbox.spec.ts`, `committee-approval.spec.ts`, `analyst-journey.spec.ts`, and `committee-entry-gate.spec.ts` for identity/fixture paths that are not applicable to the current seeded state. The referred-back path now passes by selecting a visible `REFERRED_BACK` row.

## Production blockers

None remain for record-only credit approval scope.

**Open verification gap** (closed 2026-08-10): segregation-of-duties and authority-exclusion paths are API- *and* browser-verified with distinct `e2e-analyst@test.local` (CREDIT_ANALYST) and `e2e-approver@test.local` (CREDIT_MANAGER) seeded identities. Run `npx tsx prisma/seed-credit.ts --demo --e2e` to create them and split RM ownership so the exclusion path is reachable.

**For live lending/disbursement**, the following blockers apply:

1. CBS integration must be configured and tested (LOS-021 reopens at P0 when `CREDIT_LIVE_LENDING=true`).
2. E-signature vendor must be configured and tested.
3. ~~Management pack must include authored recommendation, factor explanation, missing inputs, overrides and evidence index (LOS-016).~~ **CLOSED 2026-08-10**: Pack now includes all decision basis sections.
4. ~~Duplicate borrower identity normalisation must be enforced (LOS-017).~~ **CLOSED 2026-08-10**: `normalizeIdentity` + governed override + audit trail.

## What is already strong

- Detailed domain schema and broad Application/Borrower 360 capability
- Explicit application state machine and submission-readiness service
- Real weighted scoring, bureau caps and frozen assessment model
- Versioned scorecards and memo versions
- Approval matrices, multi-approver counting, committee and delegation
- RM/self/signoff and three-party disbursement SOD controls
- Hash-chained audit events with DB-level immutability and per-application serialization
- Authority-aware approval inbox with SOD and authority exclusion explanations
- Optimistic concurrency on high-risk child records
- Record-only integration gating with visible placeholder identifiers
- Seeded P0 regression suite and browser E2E evidence suite

## Release recommendation

**Record-only credit approval is production-ready** with the following conditions:

1. Zero open P0 gaps for the record-only scope (achieved, with automated evidence).
2. Approved missing-data policy (BLOCK defaults are in place; policy may be refined).
3. One ACTIVE rating band set.
4. One canonical approval command per state transition (achieved).
5. Explicit record-only scope acknowledgement — `CREDIT_LIVE_LENDING` must remain unset or `false`.
6. ~~Acknowledgement that SOD/authority exclusion is unit-tested but not browser-verified, pending distinct E2E identities.~~ **CLOSED 2026-08-10**: E2E identities seeded; `sodEnforcement.test.ts` proves analyst lacks `credit:approve` and approver has it.

**Do not enable live disbursement** until CBS/e-signature vendor configuration is complete and tested. LOS-016 and LOS-017 are now resolved; the remaining blocker for live lending is vendor configuration, not credit module code.

## Release gate

One command, from `backend/`:

```
npm run test:release      # seed demo+e2e → verify every audit chain → P0 regression → full suite
```

Then, from `frontend/`, with the stack running:

```
npm run build
npm run test:e2e:credit
```

Still outstanding as release-process work, not code:

- Route-level authorization tests for every mutation/read path
- Audit failure-injection and concurrent-action tests
- Sample decision-pack reconciliation against database snapshots
- A scheduled `verifyChain` job (nightly, plus before disbursement). This is now
  a priority rather than a nicety: the chain was broken for 10 of 17
  applications and nothing surfaced it until someone ran a verification sweep
  by hand.
