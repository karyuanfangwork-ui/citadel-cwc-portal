# Reporting and Dashboard Audit

## Verdict

**FAIL — Critical isolation risk — P0.** The six ESM aggregates are useful operational beginnings, and CRM/Credit have richer views, but ESM reporting is tenant-wide. `report:read` grants all-desk aggregates and agent workload emails; there is no department constraint, saved/scheduled report governance, robust drill-down contract or audited enterprise export layer.

## Capability matrix

| Capability | Current status | Risk | Priority | Effort | Production ready |
|---|---|---|---|---|---|
| Executive dashboard | Fragmented overview/insights | High | P1 | Large | No |
| Department dashboard | No enforced department semantic layer | Critical | P0 | Medium | No |
| Agent dashboard | Functional queue; backend-team dependent | High | P0 | Medium | No |
| Manager dashboard | Partial approval/workload views | High | P1 | Medium | No |
| SLA dashboard | Counts only | High | P1 | Medium | No |
| Productivity/KPI | Basic workload/CRM/Credit metrics | Medium | P2 | Large | No |
| Report isolation | Tenant only | Critical | P0 | Medium | No |
| Drill-down | UI-specific, no universal scoped contract | High | P1 | Medium | No |
| CSV | Selected domains only | High | P1 | Medium | No |
| Excel | Request/asset/CRM paths; request BOLA | Critical | P0 | Medium | No |
| PDF | Request/credit documents; request/job BOLA | Critical | P0 | Medium | No |
| Scheduled reports | Missing | Medium | P2 | Large | No |
| Data freshness/lineage | Missing | Medium | P2 | Large | No |

## Findings

| ID | Current implementation | Expected enterprise implementation | Business impact | Security impact | Risk | Priority | Effort | Owner |
|---|---|---|---|---|---|---|---|---|
| RD-01 | Six endpoints aggregate every tenant request | Default department scope derived from principal; authorized cross-desk scope explicit/audited | Misleading department KPIs | Cross-desk disclosure | Critical | P0 | Medium | Reporting/IAM |
| RD-02 | Agent workload includes names/emails across tenant | Department-limited workforce analytics and field minimization | Staff privacy concern | Directory leakage | High | P0 | Small | Reporting |
| RD-03 | XLSX trusts supplied IDs | Per-record authorization and export policy before generation | Bulk data exfiltration | BOLA | Critical | P0 | Medium | Backend Security |
| RD-04 | PDF trusts request ID; job result has no owner | Bind job to actor/scope and re-authorize result | Confidential case export | BOLA/presigned URL leak | Critical | P0 | Medium | Backend Security |
| RD-05 | Average resolution loads all rows into memory | SQL aggregate/materialized fact table | Degradation at scale | Resource exhaustion | High | P1 | Medium | Data Engineering |
| RD-06 | Date inputs are unvalidated | Typed filter schema, timezone/calendar semantics | Wrong period reports | DoS/error surface | Medium | P1 | Small | API Team |
| RD-07 | No metric dictionary/lineage/freshness | Governed semantic layer with owner/formula/source/as-of | KPI disputes | Audit weakness | Medium | P2 | Large | Data Governance |
| RD-08 | No saved/scheduled/subscription controls | Versioned report definitions, recipient policy, encrypted delivery | Manual reporting burden | Scheduled leakage risk if added naively | Medium | P2 | Large | Reporting Product |
| RD-09 | No export watermark/classification/retention for ESM | DLP policy, purpose, row count, watermark, expiry, audit event | Uncontrolled copies | Data loss | High | P1 | Large | Security/Compliance |
| RD-10 | Drill-down scope is not cryptographically/policy bound | Signed filter context and policy re-check at every level | Totals/detail mismatch | Filter bypass | High | P1 | Medium | Reporting |
| RD-11 | No CSAT/FCR/MTTA/MTTR/breach-age model | Enterprise service metrics with definitions | Cannot manage service quality | Low | Medium | P2 | Large | ESM Product |
| RD-12 | Frontend report/insights routes use coarse permissions | Server-provided capabilities and department scope | Confusing/overbroad access | UI bypass | High | P0 | Medium | Frontend/IAM |

## Minimum approved reporting architecture

- Authorized fact views/materializations include tenant and department keys.
- A policy service injects mandatory scope into every aggregate and drill-down.
- Cross-department executive reporting is a distinct permission with purpose/audit.
- Export jobs store requester, policy snapshot, filter, row/field count, classification, expiry and immutable audit event.
- Dashboard tiles publish definition, owner, source, refresh time and error state.
- Reconciliation tests compare aggregate to authorized source records.

## Acceptance gate

Run an automated role×department×report×export matrix. IT readers must receive no HR/Finance totals, identities, drill-downs or files. Executive exceptions must be explicit, time-bound where appropriate, field-minimized and audited. Load tests must prove p95 targets at expected multi-year data volume.
