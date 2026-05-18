# 15 — Modular, Safe, Low-Risk Enhancement Strategy

> **Premise**: CWC Portal is in production. We will **not** ship a monolithic Credit Assessment Module. We ship **small, independently-toggled, independently-removable capabilities** that each earn their place before the next one lands. Every capability is born behind a feature flag, lives in shadow mode, graduates by evidence, and can be uninstalled cleanly.

This document supersedes the deployment posture in §07 wherever they conflict. §07's 12 phases remain valid as a *macro* plan; this document is the *micro* discipline applied inside every phase.

---

## 1. Design tenets (non-negotiable)

| # | Tenet | What it means in code/ops |
|---|---|---|
| T1 | **Bounded by module** | Each capability lives under `backend/src/modules/credit/<capability>/` with its own routes, services, prisma models, jobs. No reach-in from other modules. |
| T2 | **Adapter at every seam** | Existing modules (CRM, Auth, Audit, Notify, Files) are consumed through a thin adapter interface owned by the credit module. If CRM changes, only the adapter changes. |
| T3 | **Feature flag everywhere** | Every new endpoint, UI block, job, and Prisma write path is gated on `featureFlag("credit.<capability>")`. Default OFF in all environments. |
| T4 | **Additive schema only** | New tables, new nullable columns. **Never** rename/drop/repurpose an existing column in the same release. Two-step expand→contract migrations. |
| T5 | **Read-only first, then shadow, then write, then act** | Capabilities graduate through stages (§4). No capability ships straight to "act". |
| T6 | **Backward-compatible API** | New endpoints under `/api/v1/credit/...`. Never mutate existing endpoint contracts. Versioned where needed. |
| T7 | **No hard dependency on data we don't own** | If a feature needs CRM data, it copies/snapshots into its own table rather than joining live. |
| T8 | **Reversible by uninstall** | Every capability has a documented teardown: disable flag → drain queues → archive data → drop schema (last). |
| T9 | **Humans decide, machines assist** | Automation begins as suggestion; promotion to action requires a governance gate. |
| T10 | **Evidence before expansion** | Each graduation step needs measured KPIs, not opinions. |

---

## 2. Reference architecture for an enhancement

```
┌──────────────────────────── Frontend (React) ────────────────────────────┐
│  <FeatureFlag name="credit.spreading">                                   │
│     <CreditSpreadingPanel/>          ← lazy-loaded chunk                  │
│  </FeatureFlag>                                                           │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ HTTPS /api/v1/credit/spreading/*
┌──────────────────────────────────▼───────────────────────────────────────┐
│ Express monolith                                                          │
│  modules/credit/spreading/                                                │
│   ├─ routes.ts          (mounted only if flag.enabled)                    │
│   ├─ controller.ts                                                        │
│   ├─ service.ts                                                           │
│   ├─ adapters/                                                            │
│   │   ├─ crmAdapter.ts        ← only place that touches CrmAccount       │
│   │   ├─ auditAdapter.ts      ← wraps existing auditLog()                │
│   │   ├─ filesAdapter.ts      ← wraps existing S3 upload                 │
│   │   └─ notifyAdapter.ts                                                 │
│   ├─ events/                                                              │
│   │   ├─ publish.ts           ← emit "credit.spreading.committed.v1"     │
│   │   └─ handlers.ts                                                      │
│   ├─ jobs/                    ← own queue namespace                       │
│   ├─ prisma/                  ← only NEW tables                           │
│   └─ flags.ts                 ← capability-level flag set                 │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                          Event bus (BullMQ/Redis)
                                   │
                          Other capabilities subscribe
```

Key points:
- **No cross-module DB joins.** Capability reads CRM via the adapter (which calls the existing CRM service or REST), then projects what it needs.
- **Events are versioned** (`...v1`) and additive; consumers tolerate missing fields.
- **Flags are layered**: global kill-switch → per-tenant/branch → per-user/role → per-percentage cohort.

---

## 3. Feature-flag taxonomy

| Flag level | Example | Purpose |
|---|---|---|
| `credit.<cap>.enabled` | `credit.spreading.enabled` | Master on/off for a capability |
| `credit.<cap>.read` | `credit.spreading.read` | Expose read APIs/UI only |
| `credit.<cap>.write` | `credit.spreading.write` | Allow data capture/edit |
| `credit.<cap>.shadow` | `credit.scoring.shadow` | Compute in background, do not surface |
| `credit.<cap>.parallel` | `credit.scoring.parallel` | Surface alongside legacy, do not decide |
| `credit.<cap>.act` | `credit.scoring.act` | Capability participates in decision/route |
| `credit.<cap>.cohort` | `credit.scoring.cohort` | Limit to user/branch/% list |
| `credit.<cap>.kill` | `credit.spreading.kill` | Hard disable; supersedes all sub-flags |

Storage: existing `SystemSetting` table or a small new `FeatureFlag` table with audit history and per-flag owner. Cache 60s in app; SSE invalidation broadcast.

---

## 4. Capability lifecycle (every feature follows)

```
  PROPOSE  →  DESIGN  →  BUILD (flag OFF)  →  INTERNAL DOGFOOD
       ↓                                       (one squad, sandbox data)
  READ-ONLY (no UI)  →  READ + UI for power users  →  WRITE (capture only,
       no decision impact)  →  SHADOW (compute alongside legacy, log diffs)
       →  PARALLEL (surface to humans, advisory)  →  COHORT PILOT (1 branch)
       →  COHORT EXPAND (region)  →  GA  →  STEADY STATE
                                                        ↓
                                              DEPRECATE → TEARDOWN
```

A capability cannot skip stages. Each promotion requires a **graduation memo** (one page) with KPIs, defects, risk delta, and sign-off.

---

## 5. The capability backlog (modular, decoupled, individually shippable)

Each is described with: **Value · Complexity · Op risk · Rollback · Teardown · Deploy · Dependencies · Prod safety · Category**.

Category legend:
- **P1**: Safe for Phase 1
- **PO**: Safe for Pilot Only
- **RMG**: Requires Mature Governance
- **HR**: High-Risk
- **FE**: Future Enhancement Only

---

### Track A — Foundation (must land first, but still modular)

#### A1. Feature-flag service & SDK
- **Value**: Enables every other capability to be safe.
- **Complexity**: Low.
- **Op risk**: Very low (read-mostly; cached).
- **Rollback**: Default-deny on read failure → equivalent to OFF.
- **Teardown**: Remove SDK calls; drop table.
- **Deploy**: Standalone; no UI surface initially.
- **Dependencies**: None.
- **Prod safety**: Flag changes are themselves audited; require role `platform:flags:write`.
- **Category**: **P1**

#### A2. Capability event bus (BullMQ + Redis) & outbox table
- **Value**: Decouples capabilities; enables shadow/parallel modes.
- **Complexity**: Medium (operational).
- **Op risk**: Medium (new infra) — mitigated by adopting first for *non-credit* low-stakes job (e.g., move SLA cron to bus).
- **Rollback**: Disable consumers; jobs drain via dead-letter; cron path still works in parallel during transition.
- **Teardown**: Stop publishing; remove consumers; decommission Redis if no other use.
- **Deploy**: Two-step: stand up infra → migrate first non-critical job → adopt for credit features.
- **Dependencies**: Redis.
- **Prod safety**: Idempotency keys mandatory; DLQ alerting; depth SLO.
- **Category**: **P1**

#### A3. Auto-audit Prisma middleware (read-only first, then write capture)
- **Value**: Coverage gap closure for the eventual credit module without touching every service.
- **Complexity**: Low.
- **Op risk**: Low — runs *additively* alongside manual `auditLog()` calls; de-duplicates by correlationId.
- **Rollback**: Unregister middleware; manual auditing continues.
- **Teardown**: Remove middleware file.
- **Deploy**: Behind flag `platform.autoAudit.shadow` → compare with manual logs → promote.
- **Dependencies**: A1.
- **Prod safety**: Sample first 10% of models; expand by allowlist.
- **Category**: **P1**

#### A4. Credit-module skeleton (`/api/v1/credit`, empty)
- **Value**: Establishes the bounded context with no behaviour.
- **Complexity**: Trivial.
- **Op risk**: None (no routes mounted unless flagged).
- **Rollback / Teardown**: Delete folder.
- **Category**: **P1**

#### A5. Adapter layer (CRM, Auth, Audit, Files, Notify)
- **Value**: Insulates credit code from existing module churn.
- **Complexity**: Low.
- **Op risk**: None (wrappers).
- **Rollback**: Bypass adapter (not recommended) or remove.
- **Category**: **P1**

#### A6. AI guardrail layer (prompt registry, interaction log, redaction)
- **Value**: Pre-condition for *any* AI use in credit; also retrofits CRM-AI for governance.
- **Complexity**: Medium.
- **Op risk**: Low when shadow-logging existing CRM-AI calls.
- **Rollback**: Disable interceptor; CRM-AI continues unaffected.
- **Teardown**: Drop tables; remove interceptor.
- **Category**: **P1**

---

### Track B — Borrower & document foundations (independently useful)

#### B1. Borrower Profile (read-only view over CRM)
- **Value**: Single screen aggregating CRM Account + KYC + (later) credit fields. Zero new data.
- **Complexity**: Low.
- **Op risk**: Very low (read-only).
- **Rollback**: Flag off.
- **Teardown**: Remove page + route.
- **Deploy**: Read-only behind `credit.borrower.read` for `credit:rm`.
- **Dependencies**: A1, A5.
- **Prod safety**: No writes; no schema; permission-gated.
- **Category**: **P1**

#### B2. Credit document store (parallel to existing uploads)
- **Value**: Versioned, hashed, classified documents — without disturbing `RequestAttachment`.
- **Complexity**: Medium.
- **Op risk**: Low (new tables + new S3 prefix).
- **Rollback**: Flag off; existing uploads unaffected.
- **Teardown**: Archive S3 prefix; drop tables.
- **Deploy**: New `CreditDocument*` tables; new endpoints; new UI panel embedded in B1.
- **Dependencies**: A5.
- **Prod safety**: AV integration starts as ASYNC quarantine (existing uploads unchanged).
- **Category**: **P1**

#### B3. AV scanning (start as opt-in async)
- **Value**: Closes `isScanned` gap; reusable by other modules later.
- **Complexity**: Medium.
- **Op risk**: Low initially (async, non-blocking).
- **Rollback**: Disable consumer; files marked unscanned.
- **Teardown**: Remove consumer + AV infra.
- **Deploy**: Subscribe to `credit.doc.uploaded.v1`; later subscribe to other upload events.
- **Dependencies**: A2, B2.
- **Prod safety**: First in **report-only** mode (log infections but don't block).
- **Category**: **P1**

#### B4. Document checklist library
- **Value**: Configurable required-document list; surfaces missing items.
- **Complexity**: Low.
- **Op risk**: Very low (advisory).
- **Category**: **P1**

---

### Track C — Application intake (lightweight first)

#### C1. Minimal Credit Application (capture only, no workflow)
- **Value**: Replaces spreadsheet/email intake with structured record.
- **Complexity**: Medium.
- **Op risk**: Low (additive; doesn't decide anything).
- **Rollback**: Flag off; data retained for restoration.
- **Teardown**: Export JSON; drop tables.
- **Deploy**: Wizard form behind `credit.application.write` for `credit:rm`; submission = email notification only.
- **Dependencies**: B1, B2.
- **Prod safety**: Read-only after submit; no state transitions to legacy systems.
- **Category**: **P1**

#### C2. Lightweight workflow (state machine reusing existing engine)
- **Value**: Standard lifecycle of an application.
- **Complexity**: Medium.
- **Op risk**: Low (events advisory; no integrations).
- **Rollback**: Freeze state; export.
- **Category**: **PO** (pilot first)

---

### Track D — Spreading & ratios (data-only; deterministic)

#### D1. Manual financial spreading (analyst-entered)
- **Value**: Standardised data foundation for everything downstream.
- **Complexity**: Medium.
- **Op risk**: Low (data capture).
- **Rollback**: Flag off; data retained.
- **Teardown**: Export; drop tables.
- **Deploy**: New panel in application detail; gated by `credit:analyst`.
- **Category**: **P1**

#### D2. Deterministic ratio engine
- **Value**: Objective inputs; reusable in reporting.
- **Complexity**: Low.
- **Op risk**: Very low (pure functions over D1).
- **Category**: **P1**

#### D3. OCR-assisted spreading
- **Value**: 60–80% time saving.
- **Complexity**: High (vendor dependency).
- **Op risk**: Medium (vendor SLA, accuracy).
- **Rollback**: Disable OCR; manual entry stays.
- **Teardown**: Remove adapter; cancel vendor; data already in D1 tables.
- **Deploy**: Shadow mode first (compare OCR vs. analyst); promote to draft pre-fill at ≥ 95% accuracy on golden set.
- **Category**: **RMG**

---

### Track E — Scoring & rating (shadow first, always)

#### E1. Scorecard definition tooling (no scoring yet)
- **Value**: Risk team builds and versions scorecards.
- **Complexity**: Medium.
- **Op risk**: None (config tool).
- **Category**: **P1**

#### E2. Scorecard runner — shadow mode
- **Value**: Compute scores; log to `ScoreRun`; never display.
- **Op risk**: Very low.
- **Rollback**: Disable scheduler.
- **Category**: **PO** (after risk team has validated outputs offline)

#### E3. Scorecard runner — parallel (advisory in UI)
- **Value**: Analysts see score as advisory; cannot bind decisions.
- **Op risk**: Low (advisory).
- **Category**: **RMG**

#### E4. Scorecard runner — sanctioning input
- **Value**: Score participates in approval routing.
- **Op risk**: High (model risk).
- **Prereq**: 2 quarters of backtesting; model risk committee sign-off; override capture mature.
- **Category**: **HR** until prereqs met → then **RMG**.

---

### Track F — Collateral, guarantees, exposure (data first)

#### F1. Collateral & guarantee registry (data capture)
- **Value**: Pledged-asset visibility; reusable.
- **Op risk**: Low.
- **Category**: **P1**

#### F2. Exposure aggregation (read-only computed view)
- **Value**: Concentration insight.
- **Op risk**: Low (read-only).
- **Category**: **PO**

#### F3. Limit enforcement at sanction (hard block)
- **Value**: Prevents over-lending.
- **Op risk**: Medium (could block legitimate work if data wrong).
- **Prereq**: F2 stable; data reconciled against CBS for ≥ 60 days.
- **Category**: **RMG**

---

### Track G — Approvals & committee (people-driven, system-supported)

#### G1. Approval-matrix configurator (data only)
- **Value**: Policy as data, versioned.
- **Op risk**: None.
- **Category**: **P1**

#### G2. Approval-matrix advisory routing (suggest, not enforce)
- **Op risk**: Low (advisory only).
- **Category**: **PO**

#### G3. Approval-matrix enforcing routing
- **Op risk**: Medium.
- **Prereq**: 60-day shadow with < 2% divergence vs. human routing.
- **Category**: **RMG**

#### G4. Committee paper generator (read-only PDF)
- **Op risk**: Very low.
- **Category**: **PO**

#### G5. Committee live voting & minutes
- **Op risk**: Medium (governance).
- **Category**: **RMG**

---

### Track H — Monitoring & EWS (additive)

#### H1. Watchlist board (manual entry only)
- **Op risk**: Very low.
- **Category**: **PO**

#### H2. Rule-based EWS (deterministic signals: covenants, DPD)
- **Op risk**: Low (signals are advisory; humans triage).
- **Category**: **RMG**

#### H3. AI-augmented EWS (anomaly detection over signals)
- **Op risk**: High (false positives → alert fatigue).
- **Category**: **HR** until accuracy SLO proven.

---

### Track I — AML / Compliance integrations (highest care)

#### I1. AML/PEP vendor integration — shadow mode
- **Value**: Establish baseline; compare to current manual flag.
- **Op risk**: Low (shadow).
- **Category**: **PO**

#### I2. AML/PEP active screening with human adjudication
- **Op risk**: HIGH (regulatory).
- **Prereq**: Compliance SOPs published; adjudicators trained; QA sample 100% for first 60 days.
- **Category**: **RMG**

#### I3. Continuous AML re-screening
- **Op risk**: Medium.
- **Category**: **RMG**

#### I4. AI screening adjudication assist
- **Op risk**: HIGH (false-clear risk).
- **Category**: **HR** → revisit after I2 stable for 2 quarters.

---

### Track J — AI advisory (gated, bounded)

#### J1. AI risk-narrative draft (advisory; analyst edits)
- **Value**: Time savings; consistent narrative.
- **Op risk**: Low (advisory).
- **Category**: **RMG**

#### J2. AI red-flag highlighter
- **Op risk**: Low (advisory).
- **Category**: **RMG**

#### J3. AI limit-recommendation
- **Op risk**: Medium (anchoring bias).
- **Category**: **HR** → revisit later.

#### J4. AI committee-decision assistant
- **Op risk**: Very high.
- **Category**: **FE**

---

### Track K — External integrations (one at a time)

#### K1. Credit bureau (CTOS / CCRIS) — read-only enrichment
- **Op risk**: Medium (data sensitivity + cost per pull).
- **Category**: **RMG**

#### K2. E-signature
- **Op risk**: Medium (legal weight).
- **Category**: **RMG**

#### K3. Core Banking System handoff
- **Op risk**: HIGH (financial transactions).
- **Category**: **HR** until contract-tested over 90 days.

#### K4. Identity verification / eKYC
- **Op risk**: Medium.
- **Category**: **RMG**

---

### Track L — Reporting (low risk, big value)

#### L1. Operational dashboards (own data only)
- **Op risk**: Very low.
- **Category**: **P1**

#### L2. Portfolio analytics (cross-capability aggregation)
- **Op risk**: Low.
- **Category**: **PO**

#### L3. Regulatory report generators
- **Op risk**: HIGH (regulatory exposure).
- **Category**: **RMG**

---

## 6. Category summary

| Category | Tracks/capabilities | Rule |
|---|---|---|
| **P1 — Safe for Phase 1** | A1–A6, B1–B4, C1, D1–D2, E1, F1, G1, L1 | Ship behind flags; default OFF in prod; opt-in by single squad/branch. |
| **PO — Safe for Pilot Only** | C2, E2, F2, G2, G4, H1, I1, L2 | Enable for ≤ 1 branch with explicit pilot scope and metrics. |
| **RMG — Requires Mature Governance** | D3, E3, F3, G3, G5, H2, I2, I3, J1, J2, K1, K2, K4, L3 | Needs steering + risk + compliance sign-off; backtest evidence required. |
| **HR — High-Risk** | E4, H3, I4, J3, K3 | Defer until prereqs documented and met; quarterly re-evaluation. |
| **FE — Future Enhancement Only** | J4 | Not on the roadmap; revisit annually. |

---

## 7. Safe deployment sequence (first 6 quarters)

| Quarter | Tracks landing | Mode |
|---|---|---|
| Q1 | A1, A2 (low-stakes adopter), A3 shadow, A4, A5 | All flags OFF in prod; ON in test |
| Q2 | A2 (credit adopter), A6 shadow, B1 read-only, B2, B3 report-only, B4, L1 | B1 enabled for 1 squad in prod |
| Q3 | C1, D1, D2, E1, F1, G1 | C1 cohort = 1 branch, ≤ RM 500K applications |
| Q4 | C2 pilot, E2 shadow, F2 read-only, G2 advisory, G4, H1, L2, I1 shadow | Pilot branch unchanged scope |
| Q5 | D3 shadow→parallel, E3 parallel, G3 shadow, I2 with full adjudication, K2 | Expand pilot to second branch |
| Q6 | F3, G3 enforcing (post-evidence), H2, J1, J2, K1, K4, L3 | Phased GA waves begin |

E4, H3, I4, J3, K3 — held until prereqs documented in §5.

---

## 8. Rollback playbook (per capability)

```
TRIGGER  (KPI breach, defect, incident, regulator query)
   1. Set credit.<cap>.kill = true        (≤ 30s effect)
   2. Drain in-flight jobs to DLQ          (≤ 5 min)
   3. Disable UI surface (flag-gated)
   4. Re-route operational work to legacy / manual path (always kept warm)
   5. Capture state: snapshot tables, export queues, archive S3 prefix
   6. Post-incident review within 5 business days
   7. Decide: fix-forward · roll back code · escalate teardown
```

Rollback **must** be rehearsed quarterly per capability that is past PO stage.

---

## 9. Teardown strategy (clean uninstall)

```
DEPRECATE → drain → archive → drop
  1. Announce deprecation with date (≥ 30 days notice).
  2. Disable write flag; capability becomes read-only.
  3. Migrate dependent data to archive store (parquet/CSV in WORM bucket).
  4. Unsubscribe consumers from events; stop publishers.
  5. Remove UI lazy chunks (no broken links — guard with flag).
  6. Remove routes (404 by flag-off; physically remove after 1 release).
  7. Drop Prisma models (expand-contract migration: deprecate → drop next release).
  8. Update adapters; verify no orphan references via static analysis.
  9. Document teardown in ADR; preserve audit logs for retention period.
```

Teardown **must not** affect other capabilities. Pre-flight check: dependency graph shows no inbound subscribers/callers.

---

## 10. Pilot strategy

| Aspect | Rule |
|---|---|
| Scope | 1 branch, 1 product line, exposure ≤ RM 500K initially, single facility type |
| Duration | 8 weeks minimum |
| Parallel run | Legacy/manual path remains authoritative until pilot exit |
| Users | ≤ 10 trained users with named champions |
| Metrics | Adoption rate, error rate, decision turnaround, override rate, defect rate, support tickets, AML hit-clearance accuracy |
| Cadence | Daily war-room, weekly retro, mid-pilot checkpoint |
| Exit | Documented graduation memo + sponsor + risk + compliance sign-off |
| Rollback | One-button (`credit.<cap>.kill`); legacy path resumes within 1 business day |

---

## 11. Production-readiness gates (per capability, not per programme)

Every capability passes its own mini-PRR before each promotion:

- Flags wired (kill switch tested in prod).
- Telemetry emitted (metrics, logs, traces, audit).
- Runbook published (incident, rollback, teardown).
- Owner team named (single accountable squad).
- Dependencies inventoried (libraries, vendors, events).
- Performance budget met (latency, throughput, cost).
- Security review done (threat model, data flow, secrets).
- Privacy review done (PDPA fields, retention).
- Compliance review done where applicable.
- Backout rehearsed within 30 days.

A capability promotes only with **all** items green and a graduation memo.

---

## 12. Governance checkpoints

| Forum | Capability decisions | Cadence |
|---|---|---|
| Tech Design Authority | Approve capability design, adapter contracts, event schemas | Weekly |
| Change Advisory Board | Approve promotion to next stage | Weekly |
| Risk & Compliance WG | Sign off RMG/HR promotions | Bi-weekly |
| Model Risk Committee | Sign off scorecard/AI promotions | Quarterly |
| Steering Committee | Programme-level prioritisation, kill decisions | Monthly |

Each promotion is itself an audited event.

---

## 13. Success metrics

### Programme health
- **Defect escape rate** per capability < 1 P1 / quarter.
- **Mean time to rollback** < 15 minutes for any P1.
- **Capability uninstall test** passes quarterly (drill).

### Capability adoption
- Active users / eligible users ≥ 70% within 60 days of GA.
- Workflow latency reduction vs. legacy ≥ 30% (median).
- User satisfaction (CSAT) ≥ 4.0/5.0.

### Risk & quality
- Override rate < 15% on advisory AI features (high = remove or rework).
- Backtest agreement: scorecard vs. analyst rating within 1 notch in ≥ 80% of cases before E3 → E4.
- Zero unreviewed AML hits older than SLA at any time.

### Operational
- Queue depth p95 below threshold; DLQ inflow < 0.1%.
- Cost per capability tracked; AI cost per application tracked.
- 100% capabilities have a designated owner, runbook, and rollback drill within 90 days.

---

## 14. Anti-patterns we explicitly forbid

1. **Implicit dependency on existing schema.** All cross-module access via adapter.
2. **Multi-capability migrations.** Each Prisma migration touches one capability.
3. **Synchronous chains across capabilities.** Use events with idempotent consumers.
4. **AI in decision path without parallel/shadow history.**
5. **Hardcoded policy.** Policy goes in data (matrix, scorecard, checklist).
6. **Flag default ON in production.** Never. Default OFF, opt-in.
7. **Removing a column in the same release we stop writing it.** Always expand→contract.
8. **One PR spanning multiple capabilities.** Split.
9. **Full automation as the v1 goal.** v1 is always human-in-the-loop.
10. **Skipping graduation steps because "we tested in UAT".** UAT is necessary, not sufficient.

---

## 15. Summary

We turn the Credit Assessment Module into ~40 small capabilities. Each is born behind a flag, lives in shadow, graduates by evidence, and can be uninstalled cleanly. We ship the foundations (flags, events, adapters, audit middleware, AI guardrails, document store) first — these are useful even if no credit feature ever follows. Every step is reversible. Production is never disrupted because production never sees an enabled capability until that capability has earned it.

**Build carefully. Validate carefully. Expand carefully. Remove safely if needed.**
