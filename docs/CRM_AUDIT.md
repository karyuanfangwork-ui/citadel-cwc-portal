# CRM MODULE — FULL ENTERPRISE AUDIT

**System:** CWC 2.0 Citadel Portal — embedded CRM module
**Date:** 2026-06-11 · Branch: dev2.0 · Baseline: `docs/PRE_AUDIT_DISCOVERY.md`
**Benchmarks:** Salesforce Sales Cloud, Microsoft Dynamics 365 Sales, HubSpot CRM, Zoho CRM, Freshsales

---

## REMEDIATION STATUS

**Status:** Sprint 1-5 backend CRM security remediation implemented on `dev2.0`.

**Closed for backend CRM authorization and data-egress paths:** C1-C6, H1, H3, H5, H6, H8, and H9. The remediation covers scoped direct reads/writes/deletes, scoped `globalSearch`, server-side CRM pagination caps, relationship target validation, activity/note/KYC/beneficiary/contact-role/tag/field-change ownership checks, export/report scoping, export-job ownership, spreadsheet formula escaping, export audit logging, duplicate merge/dismiss scoping with audit records, duplicate merge field whitelisting, signed expiring OAuth state bound to the session user, and CRM AI route rate limiting.

**Partially closed:** H4. A per-user CRM AI rate limit is in place; AI cost budgets and OpenAI-outage fallback behavior remain open.

**Policy decisions taken:** owner reassignment is allowed for admins or within a manager's visible team. No `crm:assign` permission was introduced because it does not exist in the current permission model. The current Prisma schema requires `ownerId` on CRM accounts, leads, opportunities, and trust products, so a null-owner visibility policy is not active in this build.

**Verification on 2026-06-14:** targeted CRM remediation tests passed against the separate `help_center_crm_remediation` database: `validate.middleware.test.ts`, `pagination.test.ts`, `crm-access.service.test.ts`, `crm-authz.integration.test.ts`, `oauth-state.service.test.ts`, `crm-oauth.integration.test.ts`, and `crm-ai-rate-limit.integration.test.ts` command exited 0 with 54 tests passing. TypeScript build exited 0. Backend lint exited 0 with warnings only.

**Full-suite caveat:** the full backend Jest suite was run after seeding the separate remediation database and still failed outside the CRM remediation surface: credit P1 fixture tests hit FK violations for hardcoded user IDs, and Redis-mocked service tests fail because the mock client lacks `.on()`. Current full-suite result: 59 passed / 7 failed suites, 585 passed / 13 failed tests. Do not treat the full backend suite as green until those unrelated fixtures/mocks are repaired.

**Residual roadmap:** product parity, UX, custom reports, dashboard drill-downs, campaigns, products, quotes, Customer 360, AI budgets, AI outage fallback, and OAuth state nonce replay prevention remain roadmap items.

---

## PRODUCTION READINESS SCORE: **55 / 100 — NOT PRODUCTION READY**

Blocked by critical authorization defects (IDOR), export/report scope bypass, mass-assignment risk caused by discarded validation output, unbounded pagination, and zero CRM controller/integration test coverage. Functionally, the module is surprisingly deep (top ~20% of in-house CRMs) — the gap is hardening, not features.

| Dimension | Score /10 | Verdict |
|---|---|---|
| 1. Functional Completeness | 7.5 | Strong core (leads→opps→pipeline, territories, quotas, AI); missing campaigns/products/quotes |
| 2. UI/UX | 6.5 | Modern, consistent skeleton/empty states; missing saved views, column config, a11y |
| 3. User Journey | 7 | Lead→convert→close is 8–10 interactions with good wizards; weak quick-create/nav aids |
| 4. Reporting & Analytics | 6 | 9 solid pre-built reports + CSV; no custom report builder, no scheduling, no drill-down |
| 5. Dashboard Effectiveness | 6.5 | Customizable widgets, AI briefing, team & quota dashboards; visibility bugs, no drill-down |
| 6. Security | **3** | Systematic IDOR on get/update/delete; export/report scope bypass; mass assignment; weak OAuth state binding |
| 7. Data Quality | 6.5 | Zod schemas exist but parsed output is discarded; fuzzy dedup, field history, anomaly detection; dedup is advisory-only |
| 8. Automation | 7 | Workflow builder (trigger/condition/action, loop guard), assignment rules, aging jobs; narrow action set |
| 9. Integration Readiness | 5.5 | Google/Outlook email+calendar sync built; no campaigns/telephony/WhatsApp API/webhooks out |
| 10. Production Readiness | 4 | 13 unit test files, **zero** controller/integration tests; unbounded pagination; no feature flags; no AI cost controls |

---

## 1. CRITICAL ISSUES (fix before any production exposure)

| # | Issue | Evidence | Impact |
|---|---|---|---|
| C1 | **IDOR — read:** `getAccount/getLead/getContact/getOpportunity/getTrustProduct` fetch by ID with no ownership/scope check, while list endpoints enforce `applyOwnerScope()`. A SALES_REP can read any record by ID. | `backend/src/controllers/crm.controller.ts` (getAccount ~L95–129, getLead ~L350, getContact ~L213, getOpportunity ~L535) | Cross-team data disclosure incl. PII (NRIC, bank account, KYC) |
| C2 | **IDOR — write:** update/delete endpoints (accounts, leads, contacts, opportunities) have no ownership check. Any `crm:write` holder can modify or soft-delete any record. | same controller (updateAccount ~L150, deleteAccount ~L170, updateLead ~L449, deleteOpportunity ~L631) | Unauthorized modification/deletion of pipeline data |
| C3 | **Mass assignment / validation bypass:** `validate()` calls `schema.parseAsync(...)` but does not assign parsed output back to `req.body/query/params`, so controllers still consume raw payloads. Multiple handlers then spread `req.body`/`rest` directly into Prisma (`updateAccount`, `updateLead`, `updateOpportunity`, activities, notes, KYC, beneficiaries). | `backend/src/middleware/validate.middleware.ts` ~L9–14; `crm.controller.ts` ~L163, ~L455, ~L592 | Privilege/ownership hijack, financial-field tampering, unexpected field writes despite Zod schemas |
| C4 | **Export/report scope bypass:** CRM export generation reads all non-deleted leads/contacts/accounts/opportunities without `applyOwnerScope()` and ignores stored filters. Several reports accept arbitrary `ownerId`/`userId` or have no owner scope. | `crm-import-export.service.ts` ~L441–541; `crm.controller.ts` reports ~L1150–1234 | Full-table CRM data exfiltration by any `crm:read` user via exports/reports |
| C5 | **Unbounded pagination** on core list endpoints — `?limit=999999` accepted (`take: limitNum` with no max on ~5 endpoints) | crm.controller.ts ~L54–84 | Trivial DoS / full-table exfiltration combined with C1 |
| C6 | **Create/relationship scope bypass:** create and relationship endpoints validate existence but not visibility of linked `accountId/contactId/opportunityId`; `createLead` accepts arbitrary `ownerId` from any writer. | `crm.controller.ts` createContact ~L249, createLead ~L385, createOpportunity ~L561, activity/note create paths | Cross-team data contamination, unauthorized ownership assignment, hidden records linked into visible workflows |

## 2. HIGH PRIORITY ISSUES

| # | Issue | Evidence |
|---|---|---|
| H1 | `mergeDuplicates` / `dismissDuplicate` write no audit log despite being destructive (loser record orphaned); merge field-selection is unvalidated (any field, incl. privileged, can be merged) | crm.controller.ts ~L1835–1840; crm-duplicate.service.ts ~L180 |
| H2 | **Zero controller/integration tests** — 13 unit test files cover services only; no tests for permissions, IDOR, CRUD, lead conversion E2E | `backend/src/__tests__/` |
| H3 | CSV/XLSX import lacks **formula-injection protection** (`=cmd|...` survives into exports opened in Excel) | crm-import-export.service.ts |
| H4 | **No AI cost/rate controls:** no per-user rate limit on 13 AI endpoints, no budget tracking, no fallback when OpenAI is down (503 only); features always-on | crm-ai.routes.ts, crm-ai.service.ts |
| H5 | Soft-deleted records returned on some direct fetches. `getAccount` correctly filters `deletedAt: null`, but `getContact`, `getLead`, and `getOpportunity` use `findUnique` without a soft-delete predicate. | crm.controller.ts ~L213, ~L350, ~L535 |
| H6 | Audit-trail and field-change endpoints check `crm:read` but not entity ownership — leaks audit logs and field history cross-team. | crm.controller.ts ~L1309–1348, ~L1921–1934 |
| H7 | Dashboard widget visibility not applied to AI briefing / won-lost / my-performance sections (customization silently ignored) | CrmDashboard.tsx |
| H8 | OAuth callback routes are behind `router.use(authenticate)`, so the earlier "unauthenticated callback" label is inaccurate; however, OAuth state is unsigned base64 `{ userId }` with no expiry or nonce binding, and the callback trusts it. External provider redirects may also fail unless the user's JWT/session is present. | crm.routes.ts ~L27, ~L179–181; crm.controller.ts ~L1647–1670 |
| H9 | Activities, notes, contact-account roles, tags, KYC, and beneficiaries lack consistent parent-entity scope checks. Many endpoints operate by raw id or supplied entity ids under only `crm:read/write/delete`. | crm.controller.ts activities/notes ~L685–849, KYC/beneficiaries ~L1045–1145, contact-account roles/tags ~L1851–1916 |

## 3. MEDIUM PRIORITY ISSUES

- M1 — Duplicate detection is **advisory only**: warning banner on create, but no block/confirm gate; no "view duplicate" link from the warning (CrmLeads.tsx, CrmContacts.tsx).
- M2 — Round-robin assignment counter is held **in memory** — resets on restart, wrong across multiple instances (crm-assignment.service.ts).
- M3 — Lead conversion validates pipeline/stage only via FK errors; no friendly validation; no default pipeline/stage pre-selection in convert modal.
- M4 — Prompt-injection vectors: lead titles/notes interpolated raw into OpenAI prompts (mitigated by JSON output parsing, but no input sanitization).
- M5 — N+1 / over-fetch: list endpoints include full relation records with no `select` trimming; opportunity list includes `pipeline.stages`.
- M6 — `trackFieldChanges()` runs async fire-and-forget; failures are silent → audit gaps.
- M7 — Scheduled jobs (lead aging, reminders, overdue follow-ups) have no visible scheduler registration/health monitoring; unclear they actually run.
- M8 — Custom fields exist as admin CRUD (`CrmCustomFieldAdmin.tsx`) but are **not rendered** in create/edit forms, list columns, or reports — feature is effectively dead-end.
- M9 — Quota dashboard period is a free-text input ("2026-Q1") with no validation or picker.
- M10 — Accessibility: icon-only buttons without aria-labels, color-only status badges, no focus management in modals, no `scope="col"` headers.
- M11 — Export jobs (`CrmExportJob`) generate files with no DLP watermark or export audit, unlike the credit module — inconsistent data-egress posture. This is secondary to C4's larger owner-scope bypass.
- M12 — No optimistic updates on bulk actions/modal saves (full list refetch); detail pages don't reflect concurrent edits.

## 4. LOW PRIORITY ISSUES

- L1 — Hardcoded chart hex colors in CrmReports.tsx vs design tokens elsewhere; mixed Tailwind/inline-style spacing.
- L2 — Fixed 20-item page size; no page-size selector or infinite scroll.
- L3 — Recent-activities feed capped at 10 with no pagination.
- L4 — No keyboard shortcuts, shift-click range select, or list undo.
- L5 — i18n absent (hardcoded English, en-MY currency, en-GB dates) despite `preferredLanguage` EN/BM/ZH on contacts.
- L6 — Skeleton/formatter components re-implemented per page instead of shared.
- L7 — Win/loss `lostReason` is free text — unanalyzable; should be picklist + optional note.

---

## 5. MISSING FEATURES (vs Salesforce / Dynamics / HubSpot / Zoho / Freshsales)

**All five benchmarks have these; CWC CRM does not:**
1. **Campaigns & marketing** — no campaign object, member tracking, ROI, email sequences/nurture, landing-page/web-to-lead capture.
2. **Products & price books** — no product catalog, line items on opportunities, discounting.
3. **Quotes/CPQ** — no quote generation from opportunities, no e-sign (credit module has a placeholder e-sign adapter; CRM has none).
4. **Contracts & renewals** — no contract object, renewal pipeline, subscription/ARR tracking.
5. **Cases/service integration** — the service desk exists in the same portal but is not linked to CRM accounts/contacts (no 360° customer view).
6. **Saved views / list customization** — no saved filters, column choice/order/width, compound AND/OR filter builder.
7. **Custom report builder** — only 9 fixed reports; no ad-hoc grouping, matrix reports, scheduled report email delivery.
8. **Field-level security & sharing rules** — RBAC is role+owner-hierarchy only; no per-field read/write profiles, no record sharing/teams on a deal.
9. **Telephony/CTI & WhatsApp API** — WHATSAPP is just an activity-type enum; no actual click-to-call, call logging, or messaging integration.
10. **Web forms / lead capture API** — no public lead-capture endpoint or form builder.
11. **Outbound webhooks / public API tokens** — no way for external systems to subscribe to CRM events.
12. **Native mobile app / offline** — responsive web with some mobile components only.
13. **Forecast management** — categories exist, but no submit/adjust/override forecast hierarchy (manager roll-up adjustments) as in Salesforce/Dynamics.
14. **Approval processes in UI** — `requiresApproval`/`approvalThreshold` exist on stages, but there is no approval queue/UI to action them.
15. **Email templates & tracking** — send-email exists; no template library, open/click tracking, or sequences.

## 6. MISSING REPORTS

- Pipeline movement/velocity report (stage-to-stage duration, conversion % per stage — data exists in `CrmOpportunityStageHistory`)
- Sales cycle length by source/owner/segment
- Funnel report (lead→MQL→opportunity→won full-funnel conversion)
- Campaign ROI (blocked on missing campaigns)
- Activity leaderboard vs outcome correlation (calls per won deal)
- Territory performance report (territories exist; no territory-level report)
- Quota vs forecast variance report
- Data-quality report (records missing email/phone, dedup backlog, stale ownership)
- AI accuracy report (aiWinProbability vs actual outcomes — `AiInteraction` data exists, unused)
- Churn/dormant account report (no activity in N days at account level)
- Scheduled/emailed report subscriptions (none exist)

## 7. MISSING DASHBOARDS

- **Executive/C-level dashboard** — revenue trend, YoY, win rate trend, top deals (CrmDashboard is rep-centric)
- **Forecast dashboard** — commit/best-case roll-up by month with manager adjustments
- **Territory dashboard** — map/region attainment view
- **Data-quality dashboard** — duplicates open, incomplete records, import failures
- **AI insight dashboard** — at-risk deals across the org (anomalies exist but render as a list, not a dashboard)
- **Customer 360 view** — account dashboard merging CRM + service-desk requests + credit exposure (all three live in this portal; never joined)
- Cross-dashboard gaps: no global date-range filter, no drill-down from any chart to filtered lists, no dashboard sharing/subscriptions

## 8. MISSING AUTOMATIONS

- **Email sequences/drip nurture** (HubSpot/Freshsales core feature)
- **Time-based workflow triggers** (e.g., "3 days after stage entry") — only event triggers + 3 fixed cron checks exist
- **Webhook / HTTP action type** in workflow builder (only CREATE_TASK, SEND_NOTIFICATION, UPDATE_FIELD, REASSIGN_OWNER)
- **SLA on leads** — first-response timer with escalation (the portal's SLA engine exists for service desk; not wired to CRM)
- **Auto lead enrichment** (company data from registration number — Malaysian SSM lookup would fit)
- **Stage-gate approval automation** — `requiresApproval` flag has no workflow that creates/routes the approval
- **Renewal/expiry automation** — trust products have `nextReviewDate`/`maturityDate` but no automated review-task generation
- **KYC expiry automation** — `CrmKycRecord.expiresAt` and `nextScreeningDueAt` are stored but nothing schedules rescreening
- **Workflow versioning/dry-run/test mode** — executions are logged but workflows can't be simulated
- **Import-complete notifications** and scheduled recurring imports

## 9. UX IMPROVEMENTS (prioritized)

1. Saved views + column customization on all list pages (single biggest parity gap vs every benchmark).
2. Render custom fields in forms/detail/lists — completes a half-shipped feature.
3. Duplicate-warning UX: link to the suspected match, side-by-side compare, and "merge instead of create" path at create time.
4. Drill-down everywhere: dashboard chart segments → pre-filtered list pages.
5. Unified record timeline (activities + field changes + stage moves + emails in one stream) instead of 4 tabs.
6. Global quick-create ("+") in nav with recent-items menu.
7. Approval queue UI for stage gates ≥ threshold.
8. Fix dashboard widget-visibility bug (H7) and persist layout server-side consistently.
9. Accessibility pass: aria-labels, focus traps, non-color status cues, keyboard table navigation.
10. Quota period picker (dropdown of quarters) instead of free text; mobile-optimized tables for Contacts/Accounts.

---

## 10. 30 / 60 / 90 DAY IMPROVEMENT ROADMAP

### Days 0–30 — SECURE (exit criteria: safe to expose to all internal users)
- Fix C1/C2: centralized `assertCrmRecordAccess(user, record)` helper applied to every get/update/delete; reuse `crm-scope.service` logic. **(C)**
- Fix C3: update `validate()` to assign parsed data back to `req.body/query/params`; replace direct `data: req.body` / `...rest` writes with explicit whitelists; strip `ownerId`/privileged fields unless `crm:admin`. **(C)**
- Fix C4: apply owner/team scope to export generation and reports; enforce stored filters; add export audit, row caps, formula escaping, and DLP watermarking. **(C)**
- Fix C5: global pagination cap (`Math.min(limit, 100)`) via shared parser. **(C)**
- Fix C6: validate relationship targets through scope-aware lookups before creating contacts, leads, opportunities, activities, notes, contact-account roles, KYC, beneficiaries, tags, and assignments. **(C)**
- H1: audit logs on merge/dismiss; whitelist mergeable fields. H5/H6/H9: `deletedAt` filter on direct fetch; ownership checks on audit, field-change, activity, note, KYC, beneficiary, tag, and relationship endpoints. H3: escape `=+-@` cell prefixes on import/export.
- H8: sign OAuth state with userId + nonce + expiry; bind callback to the initiating user/session or use a short-lived server-side OAuth state table.
- H2 (start): integration test suite for authz — every endpoint × role matrix; IDOR regression tests.
- H4: per-user rate limit (e.g., 10/min) on `/crm/ai/*`; graceful "AI unavailable" response.

### Days 31–60 — STABILIZE & COMPLETE (exit: feature-complete v1 for sales team)
- Finish integration tests: lead conversion, merge, import, stage gates (target ≥60% controller coverage).
- Move round-robin counter to Redis (M2); register & monitor scheduled jobs (M7) under BullMQ like the credit module.
- Ship custom fields end-to-end (forms, list columns, report filters) (M8).
- Saved views + column customization (UX#1); duplicate-merge-at-create UX (UX#3); dashboard drill-downs (UX#4); fix widget visibility (H7).
- Approval queue for stage gates (#14/#7); structured `lostReason` picklist (L7).
- New reports: pipeline velocity, funnel, territory performance, data quality (all from existing data).
- CRM↔Service-desk account linking — first step toward Customer 360 (uses existing `CrmAccountRequest` junction).

### Days 61–90 — DIFFERENTIATE (exit: credible benchmark parity for core selling)
- Campaigns v1: campaign object, member tracking, lead-source attribution, basic email blast via Resend.
- Products & opportunity line items; simple quote PDF via the existing Puppeteer engine.
- Email templates + sequences (time-based workflow triggers + webhook action type in workflow builder).
- Lead SLA: wire existing SLA/escalation engine to lead first-response.
- KYC/trust-product expiry automations (rescreen + review tasks).
- Forecast roll-up dashboard with manager adjustments; AI-accuracy report from `AiInteraction` data.
- Customer 360 account page (CRM + requests + credit exposure); executive dashboard.
- Accessibility & i18n pass; DLP watermarking on CRM exports for parity with credit module (M11).

**Re-score target:** 55 → ~75 by day 30 (security/data-egress fixed), ~85 by day 90.

---

## METHOD & EVIDENCE
Three parallel codebase deep-dives (backend functionality/automation; frontend UX/dashboards/reports; security/data-quality/production-readiness) over `backend/src/routes/crm*.ts`, `backend/src/controllers/crm*.ts`, `backend/src/services/crm-*.ts`, `backend/src/validators/crm.validator.ts`, all `Crm*` Prisma models, and all `frontend/pages/Crm*.tsx`, followed by a focused verification pass on CRM authorization, validation, export/report data-egress, OAuth state handling, and test coverage. Findings are code-evidenced with file references; line numbers approximate. Benchmark comparison is capability-level (no vendor docs fetched). Dynamic/runtime verification (actual IDOR exploitation, load testing) was **not** performed — C1–C6 and H1–H9 are code-level findings and should be confirmed with the new integration test suite.
