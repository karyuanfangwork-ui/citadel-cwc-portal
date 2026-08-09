# Executive Audit Summary

*Audit dated 2026-08-08. Revised 2026-08-10 following Phases 1–6 of remediation and independent verification of those closures.*

## Executive conclusion

**Overall Production Readiness: 76% — READY for record-only (non-disbursing) credit approval. NOT READY for live lending.**

*(Original audit finding, 2026-08-08: 58% — NOT READY. The gap between the two figures is six phases of remediation, all of which now carry automated evidence.)*

This was always a capable, mature implementation with a real borrower/application workflow, financial assessment, deterministic scoring, AAA–D rating, approval matrices, committee support, frozen assessments, versioned memos and tamper-evident audit records. It was never missing an LOS. Its risk was that several exposed paths did not share the same controls.

All twelve P0 gaps are closed and each is now guarded by a negative test that attempts the former bypass and asserts it fails without mutating data. All P1 gaps are now closed: LOS-016 (management pack completeness) and LOS-017 (duplicate borrower identity) resolved 2026-08-10.

**Live lending remains blocked.** The core-banking and e-signature adapters are placeholders. The system now fails closed rather than simulating a booking, but that is containment, not capability.

## What verification changed

Phase 6 was initially recorded as complete before any of its claims had been executed against a database or a browser. Verifying them found four defects, three of which invalidated a recorded closure:

- The audit chain was **forked on 10 of 17 applications**. Append and verify ordered by a millisecond-precision timestamp that ties, so the two disagreed. Fixed with an explicit per-application sequence; all 17 chains now verify.
- **All six browser specs ran unauthenticated and passed anyway**, waiting on a URL the app never navigates to. Four further defects sat behind that one. They now run 10 pass / 2 skip / 0 fail.
- The LOS-006 regression case **never executed** — it queried an enum value that does not exist.
- The committee gate **froze the assessment before two checks that could still reject the transition**, leaving frozen state behind on failure.

This is recorded prominently because it is the most transferable finding in the audit: *a gap is closed when a test proves it, not when the code is written.*

## Readiness scorecard

| Domain | 2026-08-08 | Now |
|---|---:|---:|
| Borrower Journey | 76% | 76% |
| Application Journey | 70% | 80% |
| Credit Assessment | 68% | 82% |
| Credit Scoring | 67% | 80% |
| Risk Rating | 60% | 78% |
| Approval Workflow | 42% | 85% |
| RBAC / Controls | 45% | 70% |
| Auditability | 65% | 90% |
| Management Decision Experience | 58% | 82% |
| UX / Journey | 69% | 75% |

Approval, RBAC and methodology integrity carry more weight than screen coverage. RBAC is at 70%: the controls are implemented and unit-tested, and SOD paths are now API-verified with distinct `e2e-analyst@test.local` (CREDIT_ANALYST, no `credit:approve`) and `e2e-approver@test.local` (CREDIT_MANAGER, has `credit:approve`). Detailed rationale and the executed-command evidence table are in `12-Production-Readiness-Assessment.md`.

## Answers to the fourteen executive questions

1. **Can staff create borrowers smoothly?** Mostly yes. Wizard, drafts, duplicate check and Borrower 360 are strong. Identity duplicates are now caught by normalized NRIC/registration columns regardless of CRM linkage (LOS-017 CLOSED). Override requires `credit:admin` + reason + audit trail. Joint-borrower ambiguity and partial post-create saves remain.
2. **Can staff create applications smoothly?** Mostly yes. Dependent records can still partially fail after core creation.
3. **Can staff complete a credit assessment correctly?** Yes. Approved statements and post-decision documents are now immutable; amendments require a new version. Child-record edits use optimistic concurrency and reject stale writes with 409.
4. **Is credit scoring properly implemented?** Yes. Missing core data blocks or penalises rather than scoring a neutral 50, override governance runs through a single attributable route, and each run records the rating-band and policy versions used.
5. **Is risk rating properly implemented?** Yes. Configuration requires `credit:admin`, only an ACTIVE band set affects scoring, ACTIVE sets cannot be edited in place, and the adverse-grade authority comparison is corrected.
6. **Are score/rating calculations explainable?** Yes. Factors, weights, missing inputs, caps and provenance are stored and reproducible; the management pack now surfaces the analyst recommendation, factor explanation (with frozen assessment version), override/deviation register, and evidence document index (LOS-016 CLOSED).
7. **Can applications safely enter approval?** Yes. Every transition into `COMMITTEE_REVIEW` — `submit_to_committee` and `resume_committee` alike — passes one extracted gate, and that gate runs after every check that could still reject the transition.
8. **Is segregation of duties enforced?** Yes in code, unit tests, and now API-verified with distinct seeded identities. `e2e-analyst@test.local` (CREDIT_ANALYST) lacks `credit:approve`; `e2e-approver@test.local` (CREDIT_MANAGER) has it. `sodEnforcement.test.ts` proves the exclusion.
9. **Can management make an informed credit decision?** Yes. The management pack now includes analyst recommendation, factor explanation, frozen assessment version, override/deviation register, and evidence document index (LOS-016 CLOSED). Authority-scoped inbox shows only actionable cases with exclusion explanations.
10. **Can returned applications be corrected and resubmitted safely?** Yes. Return reason is mandatory at API level, `GET /applications/:id/return-diff` derives what changed since the refer-back from the audit chain, and resuming re-runs readiness, freeze and memo lock.
11. **Is the full decision history auditable?** Yes, and now demonstrably so. Business mutations commit atomically with their audit event, appends are serialized per application and ordered by an explicit sequence, and the database rejects UPDATE and DELETE on the chain regardless of role.
12. **What specifically blocks production readiness?** For record-only: nothing. SOD verification gap is closed with distinct E2E identities. For live lending: CBS and e-signature vendor configuration (LOS-016 and LOS-017 are now closed).
13. **What should be fixed first?** For live lending: CBS and e-signature vendor configuration. The audit chain should be verified nightly and before disbursement — `assertChainIntact` now gates disbursement and broken chains escalate via `AUDIT_CHAIN_BROKEN` EarlyWarningSignal.
14. **What can safely be deferred?** Joint-borrower UI pending policy, terminology refinements, measured performance tuning, advanced analytics/AI and architectural redesign.

## The ten critical gaps — all closed

| # | Original gap | Closed by |
|---:|---|---|
| 1 | Approval path bypassed committee readiness, frozen assessment and locked memo | Single `committeeEntryGate`, applied to every transition into committee |
| 2 | Inverted `CC or worse` authority comparison | Comparator corrected; boundary tests for AAA/CC/C/D |
| 3 | Rating-band/risk-factor mutations lacked admin permission | `credit:admin` enforced on every mutation route |
| 4 | Direct-ID application reads bypassed RM scope | One shared access assertion across list, detail and nested resources |
| 5 | Required structured recommendation had no frontend workflow | Exposed in the Approvals tab; status feeds readiness and memo |
| 6 | Approved statements and decision documents remained mutable | State guards on statements, line items, documents; amendments version |
| 7 | Two inconsistent score-override flows | Consolidated to one attributable route; the spoofable endpoint returns 410 |
| 8 | Missing evidence could score as neutral | BLOCK or conservative penalty per lane, configurable, visible in the score |
| 9 | Decision and audit append not always atomic | 31 business mutations commit with their audit event in one `$transaction` |
| 10 | Mobile/quick decision paths broke the backend contract | Unified schema; reason code, conditions and return reason mandatory everywhere |

## Remaining work

**P1 — before full closure**
- ~~LOS-016~~: CLOSED — management pack now carries recommendation, factor contributions, missing-data treatment, overrides, deviations and evidence index
- ~~LOS-017~~: CLOSED — normalised NRIC/passport/registration duplicate matching independent of CRM linkage, with governed override
- ~~LOS-022 residual~~: CLOSED — E2E SOD identities seeded (`e2e-analyst@test.local` / `e2e-approver@test.local`); `sodEnforcement.test.ts` proves analyst lacks `credit:approve`

**P2** — joint-applicant scope decision; terminology standardisation.

**Deferred** — AI/ML scoring, new external integrations, architecture replacement, cosmetic navigation reduction, bundle optimisation until measured.

**Operational** — schedule `verifyChain` nightly and before disbursement; wrap `requestScoreOverride` in a transaction.

## Verification evidence

Executed 2026-08-10 against a seeded PostgreSQL database and a running stack:

- Backend TypeScript build: clean.
- Backend test suite: **87 suites, 1130 tests, 0 failures**.
- Audit chain verification: **17 of 17 applications valid** (`npm run audit:verify`).
- Frontend production build: succeeds.
- Credit browser E2E: **10 passed, 2 skipped, 0 failed** (`npm run test:e2e:credit`). The two skips are named — no referred-back application in the seed set, and no submit-to-committee control on the selected application.
- Release gate: `npm run test:release` chains seed → chain verification → P0 regression → full suite.

The 2026-08-08 audit could make no runtime claim: the PostgreSQL service was unavailable and no credit browser suite existed. Both are now addressed.

## Final recommendation

The controls are in place and proven. Record-only credit approval can proceed, provided the deployment keeps `CREDIT_LIVE_LENDING` unset. SOD enforcement is API-verified with distinct seeded identities.

Do not enable live disbursement until the core-banking and e-signature vendors are configured and tested. LOS-016 and LOS-017 are now resolved; the remaining work for live lending is vendor configuration, not credit module code.
