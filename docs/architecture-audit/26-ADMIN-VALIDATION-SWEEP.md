# Admin Configuration Validation Sweep

Date: 2026-08-29
Scope: `backend/src/credit/routes` endpoints protected by `credit:admin`.

## Method

A missing route-level `validate(...)` call was treated as a heuristic, not as proof
of a defect. Each candidate was traced to its controller/service and checked for
runtime parsing, governance-critical fields (states, enums, thresholds, weights,
limits, and authority levels), and compile-time-only enum casts. Findings below
reflect the code after the Phase 0 SLA, rating-band, and webhook validation fixes.

## Findings

| Route file | Mutating admin routes | Route-level `validate` | Controller-level validation | Governance-critical fields | Unchecked enum cast | Verdict | Action |
|---|---|---|---|---|---|---|---|
| `creditSla.routes.ts` | POST/PATCH `/policies` | Yes | Presence checks retained | `targetState`, `escalateToState`, SLA hours | Previously yes; now guarded by Zod + DB CHECK | VALIDATED | Task 1 validator, execution guard, migration |
| `ratingBandConfig.routes.ts` | POST/PATCH bands; POST risk factors; band-set lifecycle POSTs | Yes | Presence checks plus service lifecycle checks | ratings, risk categories, score ranges, factor, weight | No after route schemas | VALIDATED | Reuse/extend rating-band validator |
| `webhook.routes.ts` | POST `/` subscription | Yes (create) | Presence checks retained | No credit decision state; retry/URL constraints | No | VALIDATED | Add bounded URL/events/retry schema |
| `scorecardVersion.routes.ts` | POST `/:id/activate` | No body | Controller requires authenticated actor; service enforces activation lifecycle | No accepted governance payload | No | LOW_RISK_UNVALIDATED | No action; UUID validation remains follow-up |
| `scoreRun.routes.ts` | POST `/:id/override` | No-op, returns 410 retired | N/A | None; endpoint cannot mutate | No | VALIDATED | No action; retained retirement response |
| `consent.routes.ts` | No admin mutation; admin GET list | No route-level validator | Controller parses record/withdraw/list schemas; purpose is enum-checked | Consent purpose/status | No | VALIDATED_IN_CONTROLLER | No action |
| `creditRecommendation.routes.ts` | POST/PATCH/POST acknowledge | No route-level validator | `creditRecommendation.service.ts` parses create/update schemas; lifecycle checks are server-side | Recommendation type and amounts | No | VALIDATED_IN_CONTROLLER | No action |
| `loo.routes.ts` | POST `/loo/expiry-check` | No body | Controller/service has no accepted configuration payload | None | No | LOW_RISK_UNVALIDATED | No action |
| `fxRate.routes.ts` | POST/DELETE | POST has Zod validator; DELETE has UUID validator | N/A | Currency/rate/date | No | VALIDATED | No action |
| `policyLimit.routes.ts` | POST/PATCH/DELETE | POST/PATCH have Zod validators; IDs validated | Service enforces limit semantics | Limit type/value | No | VALIDATED | No action |
| `branch.routes.ts` | POST/PATCH/deactivate | POST/PATCH have Zod validators | Controller handles lifecycle | Branch fields; no credit-state enum | No | VALIDATED | No action |
| `creditRuleConfig.routes.ts` | POST/PATCH/DELETE | POST/PATCH have Zod validators; IDs validated | Service resolves rules | Rule configuration | No | VALIDATED | No action |

## Runtime enum-cast review

The broader `as ApplicationState` / `as RiskRating` search contains typed
constant arrays, validated conversion helpers, query filters, and test fixtures.
The Phase 0 P0 signature—an operator-supplied free-text value cast directly into
an application state write—was found in `creditSla.service.ts` and is now
protected by the shared `SAFE_ESCALATION_STATES` guard. The disbursement state
write is separately protected by the stale-collateral gate.

## Follow-up items

- Add UUID validation to remaining parameter-only routes where it is not already
  present; this is input hygiene, not an unchecked governance enum.
- Consider a shared webhook event-name enum once the externally supported event
  catalogue is formally approved. The current schema deliberately accepts named
  event strings so adding a new integration event does not require a code deploy.
- Keep controller-level validation tests for recommendation and consent services;
  duplicating those schemas at the route layer would create two sources of truth.

## Verdict

No remaining `NEEDS_VALIDATION` candidate was identified in this sweep. The
previously unvalidated governance-critical rating-band and SLA inputs are now
route-validated; webhook creation is bounded as low-risk integration config.
