# CRM Phase 5 — Implementation Plan

**Platform:** Citadel Workplace Connect (CWC)  
**Module:** CRM  
**Date:** 29 May 2026  
**Author:** AI Enterprise Consultant  
**Baseline:** 31/33 audit items resolved (94%) — CRM enterprise maturity 8.5/10  

---

## Overview

Phase 5 targets the 6 remaining gap categories identified in the post-Phase-4 audit cross-check. All 10 sprints are estimated at ~11 weeks total. Priority is sequenced: close open audit items first, then daily-use sales productivity wins, then reporting depth, then advanced AI and data model completeness.

---

## Phase 5A — Close the Audit

> Finish the 2 remaining open audit items (#19 and #24). Both have clear scope and no risky dependencies.

### Sprint 1 — Real-Time CRM Updates

**Goal:** Eliminate the manual page-refresh requirement for pipeline and activity data.

**Backend:**
- Hook CRM entity writes into the platform's existing SSE infrastructure (`/api/v1/notifications/sse`)
- Emit events on: lead/opportunity create/update/delete, activity logged, stage change, note added
- Event payload: `{ type, entityType, entityId, changedBy, timestamp }`

**Frontend:**
- Live badge counts on CrmNav tabs (e.g. "+1 new lead") using SSE listener
- Auto-refresh active list and detail pages on relevant events without full page reload
- Polling fallback at 30-second intervals for browsers that drop SSE connections

**Effort:** 1 week  
**Risk:** Medium — SSE infrastructure exists; CRM hook-in is new work  
**Resolves:** Audit item #19

---

### Sprint 2 — Duplicate Detection & Merge UI

**Goal:** Give users a workflow to find and resolve duplicate leads/contacts rather than relying on a backend warning only.

**Backend:**
- New `CrmDuplicateMatch` Prisma model: `entityType`, `entityAId`, `entityBId`, `matchFields[]`, `confidenceScore`, `status` (OPEN/MERGED/DISMISSED), `resolvedBy`, `resolvedAt`
- Duplicate scoring service: similarity on email + phone + name (Levenshtein/exact) at creation time and on-demand scan
- Routes: `GET /crm/duplicates`, `POST /crm/duplicates/:id/merge`, `POST /crm/duplicates/:id/dismiss`

**Frontend:**
- `CrmDuplicates` page: list of flagged pairs with confidence score, match reason, and age
- Side-by-side merge modal: field-by-field comparison; user selects master record and picks winning value per field
- Post-merge: soft-delete losing record; re-point all activities/notes/opportunities to master record
- Add link to CrmDuplicates page from CrmNav "More" dropdown

**Effort:** 1.5 weeks  
**Risk:** Low  
**Resolves:** Audit item #24

---

## Phase 5B — Sales Productivity

> The gaps that affect daily rep and manager usage most visibly.

### Sprint 3 — Dashboard Actionability & Missing KPIs

**Goal:** Transform the dashboard from read-only display into an action-driving surface.

**"Today's Priorities" section (real data):**
- Overdue activities (scheduledAt < now, not completed)
- Leads with no contact in >3 days (no logged activity since creation)
- Deals closing this week (expectedCloseDate within 7 days)
- Each item has a direct action button: `Log call`, `Send email`, `View deal`

**New WidgetPicker widgets (3):**
- **Avg Deal Cycle Time** — median days from opportunity created to closed won
- **Follow-up Completion Rate** — completed activities / total scheduled activities this month
- **Pipeline Change This Week** — new deals added vs deals closed/lost as a delta

**Additional KPI:**
- **Lead Response Time** — average hours from lead creation to first logged activity; shown on Dashboard and Team Dashboard

**Effort:** 1 week  
**Risk:** Low

---

### Sprint 4 — Deal Approval Workflow

**Goal:** Allow managers to require approval on high-value deals before they advance past a configurable stage.

**Backend:**
- New `CrmDealApproval` Prisma model: `opportunityId`, `requestedBy`, `approverId`, `status` (PENDING/APPROVED/REJECTED), `notes`, `thresholdValue`, `requestedAt`, `resolvedAt`
- Auto-trigger approval when opportunity value exceeds configured threshold (stored in pipeline settings)
- Routes: `GET /crm/approvals`, `POST /crm/approvals/:id/approve`, `POST /crm/approvals/:id/reject`
- Email notification to approver via platform `email.service.ts`

**Frontend:**
- Approval Queue tab on `CrmTeamDashboard` (visible to `crm:admin`)
- Pending approval banner on opportunity detail page with approve/reject buttons for the approver
- In-app notification to approver when request is created

**Pattern reference:** Reuse the approval flow pattern from HR/Finance modules already in the platform.

**Effort:** 1 week  
**Risk:** Low

---

### Sprint 5 — Pipeline Aging & Deal Health

**Goal:** Make stalled deals visible at a glance without navigating to each opportunity.

**"Days in Stage" indicator:**
- Calculate from `CrmOpportunityStageHistory` — time elapsed since last `movedAt`
- Display on Kanban cards and Opportunity list as a small badge
- Configurable warning threshold per pipeline stage (e.g. warn after 14 days in Proposal)
- Color coding: green (<threshold), amber (1–1.5×), red (>1.5×)

**Opportunity Health Score panel (OppDetail):**
- Composite of 3 signals: AI win probability + days in stage vs threshold + days since last activity
- Single score 1–10 with color indicator and breakdown tooltip
- Replaces the need to check 3 separate panels manually

**Effort:** 0.5 weeks  
**Risk:** Low — all data already exists in `CrmOpportunityStageHistory`

---

## Phase 5C — Reporting Depth

> 6 report types are missing from the current 7-tab Reports page. PDF export is a hard requirement for board-level sharing.

### Sprint 6 — 3 New Report Tabs

All tabs follow the established pattern: Recharts visualization first, collapsible data table, CSV export button, date preset buttons.

**Revenue Trend tab:**
- Monthly and quarterly won deal value as a line chart
- Compare current period vs prior period (overlay)
- Breakdown by pipeline / owner

**Rep Leaderboard tab:**
- Ranked table: deals closed, total won value, activities logged, conversion rate, avg deal cycle time
- Recharts horizontal bar chart sorted by won value
- Filterable by date range and territory

**Deal Velocity tab:**
- Average days spent per stage across all opportunities
- Recharts funnel bar chart — highlights where deals stall most
- Breakdown by pipeline and by owner

**Effort:** 1 week  
**Risk:** Low

---

### Sprint 7 — PDF Export & Scheduled Report Delivery

**PDF export:**
- Export button on all 10 report tabs
- Decision: client-side (`html2canvas` + `jsPDF`) for simplicity vs server-side (Puppeteer) for fidelity
- Recommended: client-side first (no new backend dependency); upgrade to server-side if print quality is insufficient

**Scheduled delivery:**
- New `CrmReportSchedule` Prisma model: `reportType`, `frequency` (DAILY/WEEKLY/MONTHLY), `recipients[]`, `lastSentAt`, `isActive`
- Cron job generates report data, renders PDF, sends via `email.service.ts`
- UI: Schedule configuration panel in `CrmIntegrationsSettings` page

**Effort:** 1–1.5 weeks  
**Risk:** Medium — PDF rendering approach needs a decision; scheduled delivery requires cron reliability

---

## Phase 5D — Lead Routing Engine

### Sprint 8 — Rules-Based Lead Routing

**Goal:** Automatically assign new leads based on configurable rules instead of relying on manual assignment.

**Backend:**
- New `CrmLeadRoutingRule` Prisma model: `conditions` (JsonB: leadSource, industry, estimatedValue min/max), `assignToUserId?`, `roundRobinPoolIds[]`, `priority` (order), `isActive`
- Routing service: evaluate rules in priority order at lead creation; assign matched rule's user/pool; fall through to default assignee if no rule matches
- Round-robin state: `lastAssignedIndex` tracked per rule
- Territory rules take precedence over global routing rules

**Frontend:**
- Routing Rules management UI — new tab in `CrmTeamDashboard` or dedicated page under CRM "More" nav
- Rule builder: condition picker (source / industry / value range) + assignment type (specific user / round-robin pool)
- Drag-to-reorder rule priority

**Effort:** 1 week  
**Risk:** Low

---

## Phase 5E — Advanced AI

### Sprint 9 — AI Next Best Action + Weighted Forecast + Auto-Dedup

**AI Next Best Action (`useNextBestAction`):**
- New hook on `LeadDetail` and `OppDetail`
- Calls AI with: activity history, deal stage, last contact date, AI score/win probability
- Returns ranked list of 2–3 suggested actions with rationale (e.g. "Schedule follow-up call — last contact was 8 days ago and probability dropped 12%")
- Displayed as a highlighted action card above the activity list

**AI Weighted Pipeline Forecast (new Reports tab):**
- Multiplies deal `value × aiWinProbability` per opportunity
- Chart: expected revenue by close month vs raw pipeline value (line chart overlay)
- Flags deals where AI probability diverges significantly from manual probability (>20% gap)
- Surfaces as a "Forecast Accuracy" signal for managers

**AI Auto-Duplicate Detection:**
- Background job runs nightly and at CSV import time
- Scores all existing lead/contact pairs for similarity
- Pairs above 80% confidence threshold are written to `CrmDuplicateMatch` (Sprint 2 model) as OPEN items
- No UI work needed — feeds directly into Sprint 2's Duplicates page

**Effort:** 1 week  
**Risk:** Low — all required data exists; AI service pattern established in `crm-ai.service.ts`

---

## Phase 5F — Data Model Completeness

### Sprint 10 — Account Hierarchy + Webhook Outbound

**Account Hierarchy:**
- Add `parentAccountId String?` self-reference to `CrmAccount` Prisma model (requires migration)
- `AccountDetail` gains a "Subsidiaries" tab listing child accounts
- Breadcrumb shows parent account link when `parentAccountId` is set
- Account list gains a hierarchy tree toggle view

**Webhook Outbound:**
- New `CrmWebhook` Prisma model: `url`, `events[]` (entity change event types), `secret` (HMAC signing), `isActive`, `lastTriggeredAt`
- Webhook delivery log: `CrmWebhookDelivery` model with `status`, `responseCode`, `attemptedAt`
- Retry logic: 3 attempts with exponential backoff on non-2xx response
- Frontend: Webhook management panel in `CrmIntegrationsSettings` (add/edit/delete/test webhooks)

**Effort:** 1 week  
**Risk:** Low for account hierarchy; Medium for webhooks (HMAC signing + retry logic)

---

## Summary Table

| Phase | Sprint | Feature | Priority | Effort | Risk |
|-------|--------|---------|---------|--------|------|
| 5A | S1 | Real-time SSE updates | P1 | 1 week | Medium |
| 5A | S2 | Duplicate merge UI | P1 | 1.5 weeks | Low |
| 5B | S3 | Dashboard actionability + KPIs | P1 | 1 week | Low |
| 5B | S4 | Deal approval workflow | P2 | 1 week | Low |
| 5B | S5 | Pipeline aging + deal health | P2 | 0.5 weeks | Low |
| 5C | S6 | 3 new report tabs | P2 | 1 week | Low |
| 5C | S7 | PDF export + scheduled reports | P2 | 1.5 weeks | Medium |
| 5D | S8 | Lead routing engine | P3 | 1 week | Low |
| 5E | S9 | AI Next Best Action + Forecast | P2 | 1 week | Low |
| 5F | S10 | Account hierarchy + webhooks | P3 | 1 week | Medium |
| | | **Total** | | **~11 weeks** | |

---

## Suggested Sequencing

**Recommended execution order:**

```
5A (S1 → S2) → 5B S3 → 5B S4+S5 (parallel) → 5C S6 → 5E S9 → 5C S7 → 5D S8 → 5F S10
```

- Start with **5A** to close the audit and unblock real-time data for dashboard work
- **5B S3** (dashboard actionability) is the highest daily-use impact item after 5A
- **5B S4 and S5** can run in parallel — they touch separate files
- **5E S9** (AI features) before **5C S7** (PDF) because AI data feeds the forecast report
- **5D S8** and **5F S10** are deferrable to a later phase without blocking other work

---

## What This Achieves

| Metric | Post-Phase 4 | Target Post-Phase 5 |
|--------|-------------|---------------------|
| Audit items resolved | 31/33 (94%) | 33/33 (100%) |
| Overall enterprise maturity | 8.5/10 | 9.5/10 |
| Dashboard effectiveness | 8.0/10 | 9.0/10 |
| Reporting completeness | 7/10 | 9/10 |
| AI readiness | 9.0/10 | 9.5/10 |
| Benchmark vs HubSpot | 5–6/10 most dimensions | 7–8/10 most dimensions |

---

*Generated 29 May 2026 — based on post-Phase-4 audit cross-check and gap analysis.*
