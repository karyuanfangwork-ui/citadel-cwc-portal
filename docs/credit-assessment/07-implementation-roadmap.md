# 07 — Safe Implementation Roadmap (12 Phases)

Total elapsed ≈ **12–15 months** to General Availability; AI features layer on Phases 11–12. Every phase ends in a **go/no-go gate** signed by Sponsor + Risk + Compliance + IT.

| # | Phase | Duration | Outcome |
|---|---|---|---|
| 1 | Discovery & Requirements | 6 w | Charter, DPIA, BNM gap report, BRD |
| 2 | Gap Analysis & Risk Assessment | 4 w | Risk register, control library, vendor shortlist |
| 3 | Solution Architecture Design | 6 w | Architecture, data model, integration spec |
| 4 | Prototype / MVP | 6 w | Click-through prototype + thin-slice backend |
| 5 | Core Module Development | 16 w | Origination → sanction (deterministic) |
| 6 | System Integration | 6 w | KYC/AML/OCR/CBS/bureau connectors |
| 7 | UAT & Risk Testing | 6 w | UAT sign-off, pen-test pass, perf pass |
| 8 | Pilot Rollout | 8 w | 1 branch / 1 product / capped exposure |
| 9 | Production Deployment | 4 w | Full rollout in waves |
| 10 | Hypercare & Stabilisation | 12 w | Defect SLAs, war room, KPI tracking |
| 11 | AI Enhancement | 12 w | Roll out AI features per §05 phasing |
| 12 | Optimisation & Continuous Improvement | rolling | Quarterly releases, model recalibration |

---

## Phase 1 — Discovery & Requirements (6 weeks)
- **Objectives**: Lock scope, identify regulatory obligations, capture business processes, draft BRD.
- **Deliverables**: Project charter; stakeholder map; AS-IS & TO-BE process maps; BRD; DPIA v1; vendor RFI long-list; risk register v1; governance forum cadence.
- **Risks**: Scope creep; conflicting stakeholder priorities.
- **Dependencies**: Sponsor availability; access to BNM advisor / legal counsel.
- **Resources**: PM, lead BA, credit SME, risk officer, compliance officer, architect.
- **Go/No-Go**: BRD approved; DPIA risks acceptable; sponsor sign-off.
- **Exit criteria**: Signed-off scope, schedule, budget, governance.
- **Rollback**: N/A (planning).

## Phase 2 — Gap Analysis & Risk Assessment (4 w)
- **Objectives**: Quantify gaps; choose vendors; finalise control library.
- **Deliverables**: Gap report; control matrix; vendor RFP results; recommended vendor pack; updated risk register; pen-test scope.
- **Risks**: Vendor lead times; misaligned cost expectations.
- **Resources**: Architect, security lead, compliance, procurement.
- **Go/No-Go**: Vendors selected; control library ratified by Risk Committee.

## Phase 3 — Solution Architecture (6 w)
- **Objectives**: Lock target architecture, data model, integration design.
- **Deliverables**: Architecture decisions log (ADR set); detailed component design; Prisma schema delta; API contracts; security architecture; observability spec; environment topology.
- **Risks**: Integration assumptions wrong; vendor APIs immature.
- **Resources**: Architect, lead backend, lead frontend, security, DBA, DevOps.
- **Go/No-Go**: Architecture review board approval; CISO sign-off; cost confirmed.

## Phase 4 — Prototype / MVP (6 w)
- **Objectives**: Validate critical journeys with real users; de-risk integration.
- **Deliverables**: Click-through UX prototype; vertical slice: corporate borrower profile → simple application → manual decision; integration spike with KYC vendor; AV in pipeline.
- **Risks**: UX rework if user feedback is significant.
- **Resources**: Designer, 2 BE, 2 FE, BA.
- **Go/No-Go**: User feedback acceptable; integration feasibility confirmed.
- **Rollback**: Discard prototype branch — no production impact.

## Phase 5 — Core Module Development (16 w)
- **Objectives**: Build origination through sanction (deterministic, no AI).
- **Scope (in)**: F1–F5, F8–F18, F20–F21 (see §03).
- **Scope (out)**: AI features, advanced portfolio analytics, regulatory reports.
- **Deliverables**: Working modules; unit + integration tests ≥ 80% coverage on credit-core; CI pipeline; staging environment.
- **Risks**: Scope creep; integration delays; performance.
- **Dependencies**: Vendor accounts (KYC, AML, OCR, bureau); CBS sandbox.
- **Resources**: Squad of 8–10 + QA, plus DevOps and security on call.
- **Go/No-Go**: Feature complete; tests green; code review and security scan clean.

## Phase 6 — System Integration (6 w)
- **Objectives**: Wire all external systems end-to-end in staging.
- **Deliverables**: KYC, AML, OCR, bureau, CBS, e-sign, email, SSO/MFA integrations; contract tests; resilience tests (timeouts, retries, idempotency).
- **Risks**: Vendor SLA gaps; data-format surprises.
- **Resources**: Integration engineer(s), DevOps, vendor support.
- **Go/No-Go**: All happy + sad paths green; fallback procedures documented.

## Phase 7 — UAT & Risk Testing (6 w)
- **Objectives**: Validate against business cases; security and resilience pass.
- **Deliverables**: UAT scripts executed; defect log triaged; pen-test report; load test report; DR drill report; user training materials.
- **Risks**: Critical defects late; pen-test findings.
- **Go/No-Go**: Zero P1/P2 defects open; pen-test high/critical closed; performance SLOs met; DR rehearsal passed.

## Phase 8 — Pilot Rollout (8 w)
- **Objectives**: Limited live operation under heightened oversight.
- **Scope**: 1 branch / 1 product line / capped exposure (e.g., ≤ RM 5M); parallel run vs. legacy where applicable.
- **Deliverables**: Pilot operating manual; daily war-room cadence; metrics dashboard (origination volume, decision turnaround, defects, AML hits); pilot retrospective.
- **Risks**: User friction; integration anomalies; first-time policy edge cases.
- **Go/No-Go to full prod**: Pilot KPIs met; risk control effectiveness verified; sponsor + risk + audit sign-off.
- **Rollback**: Hard rollback to legacy/manual within 1 business day; data captured in CAM remains, applications re-keyed if material.

## Phase 9 — Production Deployment (4 w)
- **Objectives**: Wave-based rollout to all branches/products in scope.
- **Approach**: Wave 1 (week 1) — second branch; Wave 2 (week 2) — region; Wave 3 (week 3) — national; Wave 4 (week 4) — connected/related-party scope.
- **Deliverables**: Wave runbooks; comms plan; training completion records; cutover plan.
- **Go/No-Go per wave**: KPIs from prior wave acceptable.
- **Rollback per wave**: Feature flags allow disabling new flows; legacy path remains warm during waves 1–2.

## Phase 10 — Hypercare & Stabilisation (12 w)
- **Objectives**: Rapid defect resolution and adoption support.
- **Deliverables**: Defect SLAs (P1 4h, P2 1d, P3 5d); weekly KPI report; user feedback loop; small enhancement releases (S-Bus).
- **Exit criteria**: 4 consecutive weeks of green KPIs; defect inflow stable; sponsor sign-off.

## Phase 11 — AI Enhancement (12 w)
- **Objectives**: Roll out AI features per §05.
- **Approach**: Each AI feature has its own gate — accuracy SLO on golden set; shadow-mode period; controlled enablement; monthly model risk review.
- **Risks**: Drift, hallucination, regulator scrutiny.
- **Rollback**: Feature flag per AI feature; default off if anomalies.

## Phase 12 — Optimisation & Continuous Improvement (ongoing)
- Quarterly releases on cadence; model recalibration; policy refresh; cost optimisation; UX enhancements; portfolio analytics maturity.

---

## Resourcing summary (FTE)

| Role | Phase 1–4 | Phase 5–7 | Phase 8–10 | Phase 11–12 |
|---|---|---|---|---|
| Sponsor | 0.1 | 0.1 | 0.2 | 0.1 |
| PM | 1 | 1 | 1 | 0.5 |
| Lead BA | 1 | 1 | 0.5 | 0.5 |
| Credit SME | 1 | 1 | 1 | 0.5 |
| Risk SME | 0.5 | 0.5 | 0.5 | 0.5 |
| Compliance SME | 0.5 | 0.5 | 1 | 0.5 |
| Architect | 1 | 0.5 | 0.5 | 0.5 |
| Backend engineers | 2 | 4 | 2 | 2 |
| Frontend engineers | 1 | 2 | 1 | 1 |
| Designer | 0.5 | 0.5 | 0.25 | 0.25 |
| QA | 0.5 | 2 | 1 | 1 |
| DevOps / SRE | 0.5 | 1 | 1 | 1 |
| Security | 0.25 | 0.5 | 0.5 | 0.25 |
| DBA / data engineer | 0.25 | 0.5 | 0.25 | 0.5 |
| AI / data scientist | 0 | 0 | 0.25 | 1 |
| Change / training | 0 | 0.25 | 1 | 0.25 |

## Budget bands (indicative — refine after Phase 2)

| Bucket | Range (RM) |
|---|---|
| Internal labour (15 m) | 1.6M – 2.4M |
| External SI / consulting | 400K – 800K |
| Licences (KYC/AML/OCR/eSign/IdP) — Y1 | 250K – 600K |
| Infrastructure (cloud, observability) — Y1 | 200K – 400K |
| Pen-test, DPIA, advisory | 150K – 300K |
| Contingency (15%) | wrap | 

## Go/No-Go gate template

Each gate must answer:
1. Are exit criteria met (evidence attached)?
2. Are open risks within tolerance? (Risk register snapshot.)
3. Are controls operating effectively? (Control test evidence.)
4. Is rollback proven and rehearsed?
5. Are people trained and supported?
6. Sign-off: Sponsor · Risk · Compliance · CIO · CISO · Internal Audit (observer).
