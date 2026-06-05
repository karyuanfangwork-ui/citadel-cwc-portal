# CRM Module — Production Readiness Audit

**Date:** 2026-06-04
**Auditor:** Senior CRM Consultant / Solution Architect / QA / Security review (Claude)
**Scope:** Full CRM module — data model, API, services, automation, reporting, frontend inventory
**Method:** Static code inspection of `backend/` (Prisma schema, routes, controllers, services, jobs) and `frontend/` page inventory. The app was **not** run; UX and performance scores are inferred from code, not observed.

---

## 1. Executive Summary

This is **not** an early-stage CRM. It is a genuinely mature, feature-dense module:

- ~30 `Crm*` Prisma models
- **123 REST endpoints** (`backend/src/routes/crm.routes.ts`)
- Configurable pipelines with per-stage win probability
- AI lead/deal scoring, duplicate detection, territories, quotas, custom fields
- Draggable dashboard layouts, an automation/workflow engine
- Email integration (Google + Outlook OAuth sync), anomaly detection
- Import/export with field mapping, audit logging, SSE real-time updates, soft deletes
- Trust-industry/Malaysian compliance (PDPA consent, KYC, beneficiaries, NRIC, risk profiling)

The blocking concern for **enterprise** deployment is not missing features — it is the **access-control model**, which is binary (own-records-only vs. see-everything) with **no manager/team/territory-scoped visibility**. Everything else is polish and depth.

**Verdict:** Production-ready for a single-team or SMB deployment; **not** ready for a multi-tier sales org without RBAC work.

**Overall production readiness: 72/100.**

---

## 2. Strengths (verified in code)

| Area | Evidence |
|---|---|
| Data model breadth | `CrmAccount`, `CrmContact`, `CrmLead`, `CrmPipeline`/`CrmPipelineStage`, `CrmOpportunity`, `CrmOpportunityStageHistory`, polymorphic `CrmActivity`, `CrmNote` (schema lines 1529–1853) |
| Lifecycle coverage | Lead → `/leads/:id/convert` (`convertedToOppId` tracked) → opportunity → won/lost (`wonAt`/`lostAt`/`lostReason`) |
| AI scoring | `aiScore`/`aiScoreReason` on leads; `aiWinProbability` on opportunities (`crm-ai.service.ts:scoreLead`) |
| Duplicate detection | Levenshtein similarity + email/phone normalization; `/duplicates/:id/merge` and `/dismiss` (`crm-duplicate.service.ts`) |
| Automation (runs on cron) | Activity reminders, lead aging, overdue follow-ups, stale deals — each fires notifications with same-day de-dup (`crm-checker.ts`, `crm-automation.service.ts`) |
| Reporting | 7 reports: lead-conversion, sales-performance, **weighted** pipeline-forecast, activity-summary, lead-aging, win-loss, kyc-compliance (`crm-reports.service.ts`) |
| Audit trail | `auditLog.create` on mutations with **bank-account masking** (`****`); `CrmOpportunityStageHistory` records every stage move + actor |
| Ops & personalization | Territories + members, quotas + attainment, custom fields, draggable dashboard widgets, mobile components (`CrmMobile*`, `crm-mobile.css`), SSE broadcast on every mutation |
| Compliance (trust industry) | PDPA consent + date, marketing opt-in, KYC records, beneficiaries, NRIC/passport, risk profile |

---

## 3. Critical Issues (P1 — block enterprise rollout)

### C1 — RBAC has no middle tier
Access is binary:
```ts
const isAdmin = req.user!.roles.includes('ADMIN') || req.user!.permissions.includes('crm:admin');
if (!isAdmin) { where.ownerId = req.user!.id; }
```
(`crm.controller.ts` lines 59–61, 145–147, 247–249)

- Admins see **all** records globally.
- Everyone else sees **only their own**.
- There is **no way for a sales manager to see their team's pipeline** without granting `crm:admin`, which exposes the entire company's data.
- Territories exist as data but are **not used for visibility scoping**.

**Fix:** introduce a `crm:read:team` tier that scopes by territory membership / manager hierarchy.

### C2 — Stage transitions are uncontrolled
`/opportunities/:id/move-stage` records history but enforces no rules: no forward-only progression, no required-fields-per-stage gate, no approval on large-value deals or discounts. Forecast integrity depends entirely on rep discipline.

---

## 4. High Priority Issues (P2)

- **H1 — No account hierarchy.** `CrmAccount` has no `parentAccountId` (verified: 0 matches). Parent/child org structures are unsupported.
- **H2 — Forecasting is one number.** `pipeline-forecast` returns a single stage-probability-weighted total. No forecast **categories** (Commit / Best Case / Pipeline), no **forecast-accuracy** tracking, no quota-vs-forecast on the same view.
- **H3 — Lead scoring is AI-only.** No configurable **rule-based** scoring (source weight, engagement, demographic fit).
- **H4 — Contact ↔ Account is 1:1 required** (`CrmContact.accountId` non-null). No multi-account contact roles.
- **H5 — Report export/drill-down unconfirmed.** Reports return aggregates; the only export path is the generic import/export-job engine, not per-report CSV/XLSX or drill-down to record lists.
- **H6 — Lead assignment is manual/owner-default.** An `autoAssign` flag exists in the create path, but no round-robin / territory-rule assignment engine is surfaced.

---

## 5. Medium Priority Issues (P3)

- Segmentation limited to `industry` / `accountType` / `companySize` — no tags or named segments.
- Activity model has no SLA/escalation tier of its own (reminders only).
- No field-level history surfaced (audit logs store whole `oldValues`/`newValues` blobs, not per-field diffs in UI).
- Currency stored per-opportunity (`MYR` default) but no FX normalization for mixed-currency roll-ups in reports.

---

## 6. Missing — Quick Lists

**Features:** team/territory-scoped visibility · account parent-child · multi-account contacts · rule-based lead scoring · stage-gate validation · approval workflows on deal value/discount · auto-assignment rules engine.

**Reports:** forecast-category breakdown · forecast-accuracy over time · sales-cycle-length · per-report CSV/XLSX export · drill-down to record lists.

**Dashboards:** pipeline-health (aging-in-stage) widget · forecast-accuracy widget · activity-completion-rate widget (data exists, surface it).

**Automations:** large-deal/discount approval routing · territory-based auto-assignment · duplicate-block-on-create (detection is post-hoc today).

---

## 7. Production Readiness Scorecard

| Dimension | Score | Note |
|---|---|---|
| Functional completeness | 8.5/10 | Exceptionally broad |
| UX | 7/10 | Mobile + skeletons + inline edit present; needs hands-on verification |
| Reporting | 6.5/10 | 7 reports, but thin forecasting + export |
| Security / RBAC | 4/10 | Binary model is the blocker; audit log is strong |
| Scalability | 7/10 | Indexed, paginated, SSE; not load-tested |
| Operational | 7.5/10 | Cron automation, import/export, integrations live |
| **Overall** | **72/100** | Ready for single-team; RBAC gates enterprise |

> UX and performance scores are from code inspection only — the app was not run or load-tested. Hands-on verification can confirm rather than infer these.

---

## 8. Roadmaps

**30-day (P1):** ship `crm:read:team` scoping (territory + manager hierarchy) across all list endpoints; add stage-gate validation (required fields per stage, forward-progression, large-deal approval hook). These unblock enterprise use.

**60-day (P2):** account parent-child hierarchy; forecast categories + accuracy tracking; rule-based lead scoring config; per-report CSV export; auto-assignment rules engine.

**90-day (P3):** multi-account contact roles; segmentation/tags; field-level history UI; FX normalization in reports; duplicate-block-on-create.

---

## 9. Verification Caveats

- App was **not** executed; no UI walkthrough, no load test.
- UX, mobile, and performance assessments are inferred from component/code presence, not observed behavior.
- Recommend a follow-up hands-on verification pass before sign-off on UX/perf scores.
