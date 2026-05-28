# CWC CRM Phase 4 — Enterprise Enhancements Implementation Plan

**Date:** 28 May 2026
**Status:** DRAFT — Pending Review
**Scope:** 8 items from Enterprise CRM Audit (#18-30, phase 4 tier)
**Prerequisite:** Phase 3 items (#18, #19, #28, #26, A-D) must ship before Phase 4 begins
**Estimated Duration:** 26-34 weeks (6.5-8.5 months)

---

## 0. Prerequisites (Phase 3 — Must Ship First)

These Phase 3 items are blockers for Phase 4 work. If any are incomplete, the corresponding Phase 4 sprint cannot proceed.

| # | Item | Blocks Phase 4 Item | Status |
|---|------|---------------------|--------|
| 18 | Mobile-optimized CrmNav (hamburger) | #30 Mobile-first redesign | 🔴 Open |
| 19 | Document Checklist UI | #21 Workflow triggers on checklist events | 🔴 Open |
| 28 | Audit trail for CRM entity changes | #21 Workflow audit integration | 🔴 Open |
| A | Activity edit/delete | #22 Email sync writes activities | 🔴 Open |
| B | Detail page activity list pagination | #24 Dashboard activity widgets | 🔴 Open |
| C | Fix `CrmOpportunities` form `as any` | #25 Custom field form rendering | 🔴 Open |
| D | Reports date picker component | #24 Dashboard date-range widgets | 🔴 Open |
| 26 | AI Next Best Action | #27 AI Anomaly Detection (shared AI pipeline) | 🔴 Open |
| 20 | Configurable list view (columns, sort, page size) | #25 Custom fields in list views | 🔴 Open |

**Gate:** Phase 4 Sprint 1 cannot start until all Phase 3 items are merged to `dev2.0`.

---

## 1. Item #23 — Import/Export Tool (CSV, Excel)

### 1.1 Problem Statement

Users have no way to bulk-create or bulk-export CRM data. New clients onboarding must manually enter every lead, contact, and account. Managers cannot export filtered datasets for offline analysis (reports CSV export is the only current option, limited to report tables).

### 1.2 Scope

**In Scope:**
- CSV import for: Leads, Contacts, Accounts, Opportunities
- Excel (.xlsx) import for same entities
- CSV/Excel export for same entities (with active filters applied)
- Column mapping UI (match uploaded columns to schema fields)
- Validation report (required fields missing, duplicate detection, type errors)
- Dry-run / preview before committing
- Import history log (who imported what, when, row count, errors)

**Out of Scope:**
- PDF export (separate concern)
- Custom object import (not until #25 ships)
- Scheduled/recurring exports (future)
- Cross-module import (e.g., importing Service Desk tickets into CRM)

### 1.3 Data Model

```prisma
model CrmImportJob {
  id                String            @id @default(cuid())
  fileName          String            // original uploaded filename
  fileType          String            // CSV | XLSX
  entity            String            // LEAD | CONTACT | ACCOUNT | OPPORTUNITY
  status            String            // PENDING | VALIDATING | PREVIEW | IMPORTING | COMPLETED | FAILED
  totalRows         Int               @default(0)
  importedRows      Int               @default(0)
  failedRows        Int               @default(0)
  errorReport       JsonB?            // { row: number, field: string, error: string }[]
  columnMapping     JsonB             // { "First Name": "firstName", "Company": "companyName", ... }
  createdBy         String
  createdAt         DateTime          @default(now())
  completedAt       DateTime?

  // Relations
  user              User              @relation(fields: [createdBy], references: [id])
}

model CrmExportJob {
  id                String            @id @default(cuid())
  entity            String            // LEAD | CONTACT | ACCOUNT | OPPORTUNITY
  filters           JsonB?            // applied filters at export time
  rowCount          Int               @default(0)
  fileUrl           String?           // path to generated file
  status            String            // PENDING | GENERATING | COMPLETED | FAILED
  createdBy         String
  createdAt         DateTime          @default(now())

  user              User              @relation(fields: [createdBy], references: [id])
}
```

### 1.4 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/crm/import/upload` | Upload file, create CrmImportJob, return job ID |
| POST | `/api/v1/crm/import/:id/validate` | Validate file against schema, return preview + errors |
| POST | `/api/v1/crm/import/:id/mapping` | Submit column mapping |
| POST | `/api/v1/crm/import/:id/execute` | Execute import after preview confirmation |
| GET  | `/api/v1/crm/import/:id/status` | Poll import status + progress |
| GET  | `/api/v1/crm/import/history` | List past import jobs |
| POST | `/api/v1/crm/export` | Request export with entity + filters |
| GET  | `/api/v1/crm/export/:id/download` | Download generated file |

### 1.5 Frontend Components

- `CrmImportDialog.tsx` — Upload, column mapping, preview table, validation errors
- `CrmImportHistory.tsx` — Import job list with status badges
- `CrmExportDialog.tsx` — Entity selector, filter summary, format picker (CSV/XLSX)
- Shared upload utility in `src/components/ui/`

### 1.6 Validation Rules

- Required fields enforced (Lead: title, source, contactName; Contact: firstName, lastName; etc.)
- Duplicate detection: check email/phone against existing records, flag in preview
- Type coercion: numeric fields (value, probability), date fields (expectedCloseDate)
- Max row limit: 10,000 rows per import
- Max file size: 50MB

### 1.7 Dependencies

- `xlsx` (SheetJS) — parse .xlsx files
- `csv-parse` / `csv-stringify` — CSV handling
- Phase 3 item #19 (Document Checklist) uses similar file upload patterns — share component

### 1.8 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| Backend model | Prisma schema + migration | 0.5 |
| Backend API | Upload, validate, mapping, execute, status, history, export | 3 |
| Frontend — Import | Upload dialog, column mapper, preview, errors | 3 |
| Frontend — Export | Export dialog, download flow | 1.5 |
| Testing | Unit + integration tests | 1 |
| **Total** | | **9 days (~2 weeks)** |

---

## 2. Item #29 — Territory/Quotas Model + UI

### 2.1 Problem Statement

CRM has no concept of territories or sales quotas. Leads are assigned to individual `ownerId` with no territory logic. Managers cannot set quota targets or track attainment. This is a fundamental enterprise gap.

### 2.2 Scope

**In Scope:**
- Territory model: name, regions (states/countries), assigned users
- Quota model: period (monthly/quarterly), target amount, assigned user/territory
- Lead routing to territory (auto-assign based on account location)
- Quota attainment tracking: closed-won value vs. quota target
- Manager quota dashboard: quota vs. actual, attainment %, trend

**Out of Scope:**
- Advanced round-robin assignment (separate concern for #21 workflow engine)
- Territory-based visibility rules (row-level security — future)
- Quota commission calculations

### 2.3 Data Model

```prisma
model CrmTerritory {
  id                String            @id @default(cuid())
  name              String            @unique
  description       String?
  regions           JsonB             // { states: ["Selangor", "KL"], countries: ["MY"] }
  isActive          Boolean           @default(true)
  createdBy         String
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  // Relations
  members           CrmTerritoryMember[]
  quotas            CrmQuota[]
  leads             CrmLead[]
  user              User              @relation(fields: [createdBy], references: [id])
}

model CrmTerritoryMember {
  id                String            @id @default(cuid())
  territoryId       String
  userId            String
  role              String            // MANAGER | MEMBER
  assignedAt        DateTime          @default(now())

  territory         CrmTerritory      @relation(fields: [territoryId], references: [id])
  user              User              @relation(fields: [userId], references: [id])
}

model CrmQuota {
  id                String            @id @default(cuid())
  territoryId       String?           // nullable = individual quota
  userId            String?           // nullable = territory-level quota
  period            String            // "2026-Q1", "2026-06"
  periodType        String            // MONTHLY | QUARTERLY | ANNUALLY
  targetAmount      Decimal           @db.Decimal(15, 2)
  currency          String            @default("MYR")
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  // Computed attainment via aggregate query on CrmOpportunity
  // (closed-won value where ownerId matches userId AND closedAt within period)

  territory         CrmTerritory?     @relation(fields: [territoryId], references: [id])
  user              User?             @relation(fields: [userId], references: [id])
}
```

### 2.4 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| CRUD | `/api/v1/crm/territories` | Territory management |
| CRUD | `/api/v1/crm/territories/:id/members` | Member assignment |
| GET  | `/api/v1/crm/territories/lookup` | Match location to territory |
| CRUD | `/api/v1/crm/quotas` | Quota CRUD |
| GET  | `/api/v1/crm/quotas/attainment` | Quota vs. actual for current period |
| GET  | `/api/v1/crm/quotas/dashboard` | Manager quota overview |

### 2.5 Frontend Components

- `CrmTerritories.tsx` — Territory list page (admin: `crm:admin`)
- `CrmTerritoryDetail.tsx` — Territory detail: regions map, members, quota
- `CrmQuotaDashboard.tsx` — Quota attainment cards, trend charts, per-rep breakdown
- Territory picker in Create/Edit Lead modal (auto-suggest based on location)
- Quota tab on Team Dashboard (new tab with Recharts attainment bars)

### 2.6 Lead Routing Logic

```
On Lead creation:
  1. Check lead.contactPhone country code OR account.address state/country
  2. Match against CrmTerritory.regions (JSONB contains query)
  3. If territory found AND has members → assign to first MEMBER (or round-robin)
  4. If no territory match → assign to current user (fallback)
```

### 2.7 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| Backend model | Prisma schema + migration + seed | 1 |
| Backend API | Territory + Quota CRUD, lookup, attainment calc | 3 |
| Backend logic | Lead routing on creation | 1 |
| Frontend — Territory | List + detail pages (CRUD) | 3 |
| Frontend — Quota | Dashboard, attainment charts | 3 |
| Frontend — Integration | Lead modal territory picker, Team Dashboard quota tab | 2 |
| Testing | Unit + integration | 1 |
| **Total** | | **14 days (~3 weeks)** |

---

## 3. Item #24 — Configurable Dashboard Widgets

### 3.1 Problem Statement

The CRM Dashboard is hardcoded. Users cannot rearrange, add, or remove widgets. Managers want different layouts than reps. "My Performance" duplicates hero KPIs wasting vertical space.

### 3.2 Scope

**In Scope:**
- Widget registry: each widget has an ID, title, size (small/medium/large), and data source
- User preferences: widget order and visibility stored per user
- Default layouts: one for Admin/Manager role, one for Rep role
- Drag-and-drop widget reordering (react-grid-layout or similar)
- Widget toggle: show/hide any widget
- New widgets: Pipeline Funnel, Quota Attainment (after #29), Activity Feed compact, Stale Leads

**Out of Scope:**
- Custom widget creation by end users (requires #25 custom fields)
- Cross-module dashboard (service desk widgets on CRM dashboard)
- Dashboard sharing between users

### 3.3 Data Model

```prisma
model CrmDashboardLayout {
  id                String            @id @default(cuid())
  userId            String            @unique
  layout            JsonB             // [{ widgetId: "kpi_hero", order: 0, size: "full" }, ...]
  updatedAt         DateTime          @updatedAt

  user              User              @relation(fields: [userId], references: [id])
}
```

### 3.4 Widget Registry

| Widget ID | Title | Size | Data Source | Default Role |
|-----------|-------|------|-------------|-------------|
| `kpi_hero` | KPI Hero Banner | full | Lead + Opp aggregates | All |
| `today_priorities` | Today's Priorities | medium | AI Daily Briefing | All |
| `my_performance` | My Performance | small | Lead + Opp aggregates | Rep |
| `pipeline_funnel` | Pipeline Funnel | medium | Opportunities by stage | All |
| `recent_activity` | Recent Activity | medium | Activities (paginated) | All |
| `won_lost` | Won/Lost This Month | small | Opp aggregates | All |
| `stale_leads` | Stale Leads Alert | small | Leads with overdue follow-up | Rep |
| `team_leaderboard` | Team Leaderboard | medium | Opp aggregates by owner | Manager |
| `quota_attainment` | Quota Attainment | medium | Quota + closed-won (requires #29) | Manager |
| `ai_briefing` | AI Daily Briefing | full | AI endpoint | All |

### 3.5 Frontend Architecture

- `CrmDashboard.tsx` refactored to use `react-grid-layout` — each widget is a `<div>` with `data-grid` positioning
- `CrmDashboardLayoutProvider.tsx` — context that loads/saves layout from API
- `CrmWidgetPicker.tsx` — toggle drawer to show/hide widgets
- Each widget rendered via `<WidgetRenderer widgetId={...} />` component map
- Dashboard enters "edit mode" on click — drag to reorder, X to hide, + to add

### 3.6 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| Backend model | CrmDashboardLayout schema + CRUD API | 1.5 |
| Frontend — Layout engine | react-grid-layout integration, layout provider | 2 |
| Frontend — Widget picker | Show/hide toggle drawer, widget registry | 1.5 |
| Frontend — Refactor dashboard | Break existing dashboard into widget components | 3 |
| Frontend — New widgets | Pipeline Funnel chart, Stale Leads, Team Leaderboard | 2 |
| Testing | E2E dashboard customization flow | 1 |
| **Total** | | **11 days (~2.5 weeks)** |

---

## 4. Item #21 — Workflow Automation Engine

### 4.1 Problem Statement

Pipeline stage transitions are entirely manual. There are no trigger rules (e.g., "when a lead becomes QUALIFIED, auto-create a follow-up task" or "when a deal is won, notify the finance team"). Every action requires human intervention, creating bottlenecks and missed follow-ups.

### 4.2 Scope

**In Scope:**
- Workflow definition model: trigger event + conditions + actions
- Trigger events: lead status change, opportunity stage change, activity creation, entity creation
- Conditions: field value checks (status = X, value > Y, owner = Z)
- Actions: create task, send notification (SSE + email), update field, reassign owner, trigger webhook
- Workflow builder UI: visual step-by-step configuration
- Workflow execution log: audit trail of all triggered workflows
- Pre-built templates: "New Lead → Create Follow-up Task", "Deal Won → Notify Finance", "Lead Stale 7 Days → Reassign"

**Out of Scope:**
- Complex branching logic (if/else, parallel paths) — V2
- Time-delay actions (wait 3 days then X) — requires a scheduler, V2
- External webhook actions (Zapier-style) — V2
- Approval workflows (separate from CRM, already in service desk module)

### 4.3 Data Model

```prisma
model CrmWorkflow {
  id                String            @id @default(cuid())
  name              String
  description       String?
  isActive          Boolean           @default(true)
  trigger           JsonB             // { event: "lead.status.changed", conditions: [{ field: "status", op: "eq", value: "QUALIFIED" }] }
  actions           JsonB             // [{ type: "CREATE_TASK", config: { subject: "Follow up lead", assignTo: "owner" } }, ...]
  executionOrder    Int               @default(0)  // priority when multiple workflows match
  createdBy         String
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  executions        CrmWorkflowExecution[]
  user              User              @relation(fields: [createdBy], references: [id])
}

model CrmWorkflowExecution {
  id                String            @id @default(cuid())
  workflowId        String
  triggerEntity     String            // LEAD | OPPORTUNITY | CONTACT | ACCOUNT | ACTIVITY
  triggerEntityId   String
  triggerEvent      String            // "lead.status.changed", "opportunity.stage.changed", etc.
  status            String            // PENDING | RUNNING | COMPLETED | FAILED
  actionResults     JsonB?            // [{ action: "CREATE_TASK", result: { taskId: "..." } }, ...]
  error             String?
  startedAt         DateTime          @default(now())
  completedAt       DateTime?

  workflow          CrmWorkflow       @relation(fields: [workflowId], references: [id])
}
```

### 4.4 Engine Architecture

```
Trigger fired (e.g., lead.status changed from NEW → QUALIFIED)
  │
  ▼
Workflow Engine evaluates active workflows matching trigger event
  │
  ▼
For each matching workflow (sorted by executionOrder):
  │
  ├─ Evaluate conditions against the entity
  │   └─ If conditions pass → execute actions sequentially
  │       ├─ CREATE_TASK → CrmActivity (type: TASK)
  │       ├─ SEND_NOTIFICATION → SSE + email
  │       ├─ UPDATE_FIELD → update entity field
  │       ├─ REASSIGN_OWNER → update ownerId
  │       └─ Log result to CrmWorkflowExecution
  │
  └─ If conditions fail → skip
```

### 4.5 Backend Implementation

**New files:**
- `backend/src/services/crm-workflow.service.ts` — Core engine: match triggers, evaluate conditions, execute actions
- `backend/src/services/crm-workflow-executor.ts` — Action executor (task creation, notification, field update, reassignment)
- `backend/src/routes/crm-workflow.routes.ts` — Workflow CRUD + manual trigger endpoint
- `backend/src/controllers/crm-workflow.controller.ts`

**Integration points** (hook into existing services):
- `crm.service.ts` — after `updateLead()`, `updateOpportunity()` → emit event to workflow engine
- `activity events` — after `createActivity()` → emit event
- Use EventEmitter or simple pub/sub within the service layer (no external message queue needed for V1)

### 4.6 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/v1/crm/workflows` | List workflows |
| POST | `/api/v1/crm/workflows` | Create workflow |
| PUT  | `/api/v1/crm/workflows/:id` | Update workflow |
| DELETE | `/api/v1/crm/workflows/:id` | Delete workflow (soft) |
| PATCH | `/api/v1/crm/workflows/:id/toggle` | Activate/deactivate |
| GET  | `/api/v1/crm/workflows/templates` | List pre-built templates |
| GET  | `/api/v1/crm/workflows/:id/executions` | Execution history for a workflow |
| GET  | `/api/v1/crm/workflows/executions` | All recent executions (admin) |

### 4.7 Frontend Components

- `CrmWorkflows.tsx` — Workflow list page with active/inactive toggle
- `CrmWorkflowBuilder.tsx` — Step-by-step workflow builder:
  - Step 1: Choose trigger (dropdown: entity + event)
  - Step 2: Set conditions (field + operator + value rows)
  - Step 3: Add actions (action type cards with config forms)
  - Step 4: Review & activate
- `CrmWorkflowDetail.tsx` — View workflow config + execution history
- `CrmWorkflowExecutionLog.tsx` — Table of recent executions with status badges
- New sub-tab in CrmNav: "Workflows" (visible to `crm:admin`)

### 4.8 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| **Part 1: Core Engine** | | |
| Backend model | Prisma schema + migration | 1 |
| Backend engine | Trigger matching, condition evaluation, action execution | 5 |
| Backend integration | Hook into existing CRM service methods (lead, opp, activity updates) | 2 |
| Backend API | Workflow CRUD + execution history | 2 |
| Testing — engine | Unit tests for trigger matching, condition eval, action execution | 2 |
| **Part 1 subtotal** | | **12 days (~2.5 weeks)** |
| **Part 2: Builder UI** | | |
| Frontend — List | Workflow list page with status toggles | 2 |
| Frontend — Builder | Step-by-step workflow builder (4 steps) | 5 |
| Frontend — Detail | Workflow detail + execution log | 2 |
| Frontend — Nav | Workflows tab in CrmNav | 0.5 |
| Testing — E2E | Full workflow creation → trigger → execution verification | 2 |
| **Part 2 subtotal** | | **11.5 days (~2.5 weeks)** |
| **Total** | | **23.5 days (~5 weeks)** |

### 4.9 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Infinite loop (workflow triggers itself) | Execution depth limit of 3; track `triggerEntityId` in execution context to prevent re-trigger on same entity |
| Performance impact on CRM operations | Execute workflows asynchronously (background job); don't block the API response |
| Conflicting workflows (same trigger, opposite actions) | `executionOrder` determines priority; execution log shows which ran and why |
| Data corruption from UPDATE_FIELD action | Only allow whitelisted fields; validate values against Prisma enum types |

---

## 5. Item #22 — Email/Calendar Integration (Gmail, Outlook)

### 5.1 Problem Statement

Sales reps currently log activities manually. There is no email sync — every call, email, and meeting must be typed in. This is the biggest competitive gap vs HubSpot and Pipedrive, which automatically capture all email communication.

### 5.2 Scope

**In Scope:**
- OAuth 2.0 integration with Gmail API and Microsoft Graph API
- Email sync: inbound and outbound emails linked to CRM contacts/leads/accounts
- Calendar sync: Google Calendar + Outlook Calendar events linked to CRM activities
- Activity auto-creation: synced emails become EMAIL activities; synced events become MEETING activities
- Email tracking: send from CRM (compose → send via Gmail/Outlook → log as activity)
- Contact matching: auto-link synced emails to CRM contacts by email address
- Settings page: connect/disconnect accounts, sync preferences

**Out of Scope:**
- Email templates / mail merge (separate concern)
- Bulk email campaigns
- Email body AI summarization (#6 in AI audit — P3)
- Shared mailbox / delegate access
- Calendar availability / booking link (SavvyCal/Calendly-style)

### 5.3 Data Model

```prisma
model CrmEmailIntegration {
  id                String            @id @default(cuid())
  userId            String            @unique
  provider          String            // GOOGLE | OUTLOOK
  accessToken       String            // encrypted
  refreshToken      String            // encrypted
  tokenExpiresAt    DateTime
  emailAddress      String
  syncEnabled       Boolean           @default(true)
  lastSyncedAt      DateTime?
  syncFrequency     String            @default("15min")  // 15min | 30min | 1hr | manual
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  user              User              @relation(fields: [userId], references: [id])
}

model CrmSyncedEmail {
  id                String            @id @default(cuid())
  integrationId     String
  providerMessageId String            @unique  // Gmail message ID or Outlook message ID
  threadId          String?           // for grouping conversations
  from              JsonB             // { name, email }
  to                JsonB             // [{ name, email }]
  cc                JsonB?            // [{ name, email }]
  subject           String
  bodyPreview       String?           // first 200 chars
  bodyHtml          String?           // full HTML (lazy load)
  sentAt            DateTime
  isFromUs          Boolean           // true if sent by the CRM user (outbound)
  activityId        String?           // linked CrmActivity

  // Auto-matched contact/lead/account
  matchedContactId  String?
  matchedLeadId     String?
  matchedAccountId  String?

  integration       CrmEmailIntegration @relation(fields: [integrationId], references: [id])
  activity          CrmActivity?      @relation(fields: [activityId], references: [id])
  contact           CrmContact?       @relation(fields: [matchedContactId], references: [id])
  lead              CrmLead?          @relation(fields: [matchedLeadId], references: [id])
  account           CrmAccount?       @relation(fields: [matchedAccountId], references: [id])
}

model CrmSyncedEvent {
  id                String            @id @default(cuid())
  integrationId     String
  providerEventId   String            @unique  // Google Calendar event ID or Outlook event ID
  title             String
  description       String?
  location          String?
  startTime         DateTime
  endTime           DateTime
  attendees         JsonB?            // [{ name, email, responseStatus }]
  activityId        String?           // linked CrmActivity (type: MEETING)

  integration       CrmEmailIntegration @relation(fields: [integrationId], references: [id])
  activity          CrmActivity?      @relation(fields: [activityId], references: [id])
}
```

### 5.4 OAuth Flow

**Google (Gmail + Calendar):**
- Scopes: `gmail.readonly`, `gmail.send`, `calendar.readonly`
- OAuth consent screen → `googleapis.com` redirect → callback `/api/v1/crm/integrations/google/callback`
- Token stored encrypted in `CrmEmailIntegration`
- Background sync via `node-cron` or Bull queue every 15 min

**Microsoft (Outlook + Calendar):**
- Scopes: `Mail.Read`, `Mail.Send`, `Calendars.Read`
- OAuth v2 → `login.microsoftonline.com` redirect → callback `/api/v1/crm/integrations/outlook/callback`
- Token stored encrypted; refresh via MS Graph API
- Background sync every 15 min

### 5.5 Backend Services

**New files:**
- `backend/src/services/crm-email-sync.service.ts` — Gmail/Outlook email sync engine
- `backend/src/services/crm-calendar-sync.service.ts` — Calendar sync engine
- `backend/src/services/crm-contact-matcher.service.ts` — Match emails to CRM contacts/leads by address
- `backend/src/routes/crm-integration.routes.ts` — OAuth + settings endpoints
- `backend/src/jobs/crm-sync.job.ts` — Scheduled sync job (Bull queue or node-cron)

### 5.6 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/v1/crm/integrations` | List user's connected integrations |
| GET  | `/api/v1/crm/integrations/google/auth` | Initiate Google OAuth |
| GET  | `/api/v1/crm/integrations/google/callback` | Google OAuth callback |
| GET  | `/api/v1/crm/integrations/outlook/auth` | Initiate Microsoft OAuth |
| GET  | `/api/v1/crm/integrations/outlook/callback` | Microsoft OAuth callback |
| DELETE | `/api/v1/crm/integrations/:id` | Disconnect integration |
| PATCH | `/api/v1/crm/integrations/:id` | Update sync preferences |
| POST | `/api/v1/crm/integrations/:id/sync` | Trigger manual sync |
| GET  | `/api/v1/crm/emails` | List synced emails (with entity filter) |
| GET  | `/api/v1/crm/emails/:id` | Get full email body |
| POST | `/api/v1/crm/emails/send` | Send email from CRM |
| GET  | `/api/v1/crm/events` | List synced calendar events |

### 5.7 Frontend Components

- `CrmIntegrationsSettings.tsx` — Settings page: connect/disconnect accounts, sync preferences
- `CrmEmailThread.tsx` — Email thread view on ContactDetail/LeadDetail (new tab: "Emails")
- `CrmEmailCompose.tsx` — Compose email modal (sends via connected provider)
- `CrmCalendarSync.tsx` — Synced events display in Activity tab
- New CrmNav integration icon in header (shows connection status)
- "Emails" tab added to LeadDetail, ContactDetail, AccountDetail

### 5.8 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| **Part 1: OAuth + Gmail** | | |
| Backend model | Prisma schema + migration | 1 |
| Backend — Google OAuth | Client setup, callback, token management | 2 |
| Backend — Gmail sync | Email fetching, parsing, contact matching, activity creation | 4 |
| Backend — Calendar sync | Google Calendar events → CrmActivity (MEETING) | 2 |
| Backend — Email send | Compose and send via Gmail API | 2 |
| Frontend — Settings | Connect/disconnect page, sync preferences | 2 |
| Frontend — Email tab | Thread view on detail pages | 3 |
| Frontend — Compose | Email compose modal | 2 |
| Testing — Gmail | OAuth flow + sync flow | 1.5 |
| **Part 1 subtotal** | | **19.5 days (~4 weeks)** |
| **Part 2: Outlook** | | |
| Backend — Microsoft OAuth | Client setup, callback, token management | 1.5 |
| Backend — Outlook sync | Email + calendar sync via MS Graph | 3 |
| Backend — Outlook send | Compose and send via MS Graph | 1.5 |
| Frontend — Unified | Provider-agnostic UI (Gmail + Outlook share views) | 1 |
| Testing — Outlook | OAuth flow + sync flow | 1.5 |
| **Part 2 subtotal** | | **8.5 days (~2 weeks)** |
| **Total** | | **28 days (~6 weeks)** |

### 5.9 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OAuth token expiry / refresh failures | Background job refreshes tokens 5 min before expiry; alert user on failure |
| Email volume (large inboxes) | Initial sync limited to last 30 days; incremental sync uses `lastSyncedAt` watermark |
| Rate limits (Gmail: 250 qps, Outlook: 10,000 per 10 min) | Throttle sync requests; batch API calls; exponential backoff |
| Privacy / PII (reading employee emails) | Only sync emails where sender OR recipient matches a CRM contact; exclude internal-only emails |
| Data storage cost (email body storage) | Store only bodyPreview by default; full body lazy-loaded on demand; retention policy delete after 90 days |

---

## 6. Item #25 — Custom Fields/Objects

### 6.1 Problem Statement

The CRM data model is rigid. Admins cannot add fields without code changes and migrations. Trust/estate teams need custom fields (trust deed number, beneficiaries per region) that vary by client. This is a fundamental extensibility gap.

### 6.2 Scope

**In Scope:**
- Custom field definitions: text, number, date, dropdown, multi-select, checkbox, URL
- Custom field groups: organize fields under tabs/sections on entity detail pages
- Custom field rendering on Create/Edit modals and detail pages
- Custom field filtering on list pages
- Custom field validation rules (required, min/max, regex)
- Admin UI for managing field definitions
- Prisma-level storage: JSONB column on each entity for custom field values

**Out of Scope:**
- Custom objects (creating entirely new entities) — too complex for V1, defer to V2
- Custom field formulas (calculated fields) — V2
- Custom field permissions (field-level security) — V2
- API for external apps to query custom fields — V2

### 6.3 Data Model

```prisma
model CrmCustomFieldDefinition {
  id                String            @id @default(cuid())
  entity            String            // LEAD | CONTACT | ACCOUNT | OPPORTUNITY | ACTIVITY
  fieldKey          String            // slug: "trust_deed_number"
  label             String            // display: "Trust Deed Number"
  fieldType         String            // TEXT | NUMBER | DATE | DROPDOWN | MULTI_SELECT | CHECKBOX | URL
  group             String?           // tab/section: "Trust Details", null = default group
  options          JsonB?            // for DROPDOWN/MULTI_SELECT: [{ label, value }]
  validation        JsonB?            // { required: true, min: 0, max: 100, pattern: "..." }
  defaultValue      String?
  displayOrder      Int               @default(0)
  isSearchable      Boolean           @default(false)  // show in list page filters
  isRequired        Boolean           @default(false)
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@unique([entity, fieldKey])
}
```

Each CRM entity table gets a `customFields` JSONB column:
- `CrmLead.customFields JsonB?`
- `CrmContact.customFields JsonB?`
- `CrmAccount.customFields JsonB?`
- `CrmOpportunity.customFields JsonB?`
- `CrmActivity.customFields JsonB?`

Storage format:
```json
{
  "trust_deed_number": "TD-2026-001",
  "beneficiary_region": "Selangor",
  "priority_level": 3
}
```

### 6.4 Backend Implementation

- Dynamic field validation: on Create/Edit, fetch field definitions for entity, validate `customFields` JSONB against rules
- Dynamic filtering: `GET /api/v1/crm/leads?customField.priority_level=3` → Prisma `where: { customFields: { path: ['priority_level'], equals: 3 } }`
- Admin CRUD: standard CRUD on `CrmCustomFieldDefinition`

### 6.5 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| CRUD | `/api/v1/crm/custom-fields` | Custom field definitions (admin only) |
| GET  | `/api/v1/crm/custom-fields/:entity` | Get fields for specific entity |
| *(Entity endpoints)* | | Custom fields included in entity CRUD response; validated on Create/Update |

### 6.6 Frontend Components

- `CrmCustomFieldAdmin.tsx` — Admin page: entity selector, field list, add/edit/delete fields
- `CrmCustomFieldRenderer.tsx` — Dynamic form renderer: reads field definitions, renders appropriate inputs
- `CrmCustomFieldDisplay.tsx` — Detail page renderer: shows custom fields in groups
- `CrmCustomFieldFilter.tsx` — Filter component for list pages (when `isSearchable = true`)
- Integration: Create/Edit modals auto-include custom fields; list pages auto-include searchable custom fields

### 6.7 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| **Part 1: Model + Admin** | | |
| Backend model | Prisma schema + migration (add customFields JSONB columns) | 1.5 |
| Backend API | Custom field definition CRUD + validation engine | 3 |
| Frontend — Admin | Field definition management page | 3 |
| **Part 1 subtotal** | | **7.5 days (~1.5 weeks)** |
| **Part 2: Rendering + Integration** | | |
| Frontend — Renderer | Dynamic form renderer (7 field types) | 4 |
| Frontend — Display | Detail page custom field groups | 2 |
| Frontend — Filters | List page filter integration | 2 |
| Backend — Dynamic validation | Validate customFields on entity Create/Update | 2 |
| Backend — Dynamic filtering | Support customField query params on list endpoints | 2 |
| Testing | Unit + E2E across all 5 entities | 2 |
| **Part 2 subtotal** | | **14 days (~3 weeks)** |
| **Total** | | **21.5 days (~4.5 weeks)** |

### 6.8 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| JSONB query performance | Add GIN index on `customFields` column for each entity; limit searchable fields to 5 per entity |
| Migration size (adding JSONB to 5 tables) | Prisma supports adding nullable JSONB columns without table lock; deploy during low-traffic window |
| Custom field proliferation | Admin-only creation; enforce max 50 fields per entity; deactivation (not deletion) to prevent data loss |

---

## 7. Item #27 — AI Pipeline Anomaly Detection

### 7.1 Problem Statement

Deals that stall in stages too long or show declining win probability are not flagged proactively. Managers must manually scan the pipeline to find at-risk deals. AI Anomaly Detection automatically identifies these patterns.

### 7.2 Scope

**In Scope:**
- Anomaly detection service (backend): analyzes pipeline data for statistical outliers
- Anomaly types: deal stuck in stage, probability drop, velocity anomaly, stale lead
- Anomaly display: cards on Dashboard + Pipeline page showing detected anomalies
- Anomaly detail: click to see explanation and recommended action
- Configuration: admin can set thresholds (e.g., "flag deals over 14 days in same stage")

**Out of Scope:**
- Predictive forecasting (separate concern)
- Anomaly notifications (use existing SSE notification system + #21 workflow triggers)
- Self-learning thresholds (V2 — thresholds are admin-configured for now)

### 7.3 Detection Logic

```
Deal stuck in stage:
  - For each open opportunity, compute days_in_current_stage
  - If days > threshold (default: 14), flag as anomaly
  - Severity: days / threshold ratio (1.5x = moderate, 2x = critical)

Probability drop:
  - Compare current aiWinProbability to previous value
  - If drop > threshold (default: 15%), flag as anomaly
  - Check CrmOpportunityStageHistory for recent stage regression

Velocity anomaly:
  - Compare deal velocity (days from creation to current stage) against average for that pipeline/stage
  - If deal is > 2 standard deviations slower than the mean, flag

Stale lead:
  - Lead with no activity in > threshold days (default: 7)
  - Already partially covered by existing "Overdue" badge, but anomaly detection adds pattern analysis
```

### 7.4 Backend Service

**New file:** `backend/src/services/crm-anomaly.service.ts`

```typescript
interface Anomaly {
  id: string;
  type: 'DEAL_STUCK' | 'PROBABILITY_DROP' | 'VELOCITY_ANOMALY' | 'STALE_LEAD';
  entityId: string;
  entityType: 'OPPORTUNITY' | 'LEAD';
  severity: 'LOW' | 'MODERATE' | 'CRITICAL';
  detectedAt: Date;
  message: string;       // human-readable explanation
  recommendation: string; // suggested action
  metadata: JsonB;       // supporting data (days_stuck, probability_delta, etc.)
}
```

**API:**
- `GET /api/v1/crm/anomalies` — List current anomalies for current user's pipeline
- `GET /api/v1/crm/anomalies/config` — Get thresholds (admin)
- `PUT /api/v1/crm/anomalies/config` — Update thresholds (admin)
- `POST /api/v1/crm/anomalies/refresh` — Trigger immediate re-scan

### 7.5 Frontend Components

- `CrmAnomalyCards.tsx` — Dashboard anomaly alert cards (severity color-coded)
- `CrmAnomalyDetail.tsx` — Modal or side panel with explanation + recommendation
- Anomaly badges on Kanban cards (pipeline page)
- Anomaly indicators on LeadDetail/OppDetail (warning icon + tooltip)
- Admin threshold settings in `CrmIntegrationsSettings.tsx` → new "AI" tab

### 7.6 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| Backend model | Anomaly config schema (thresholds) | 0.5 |
| Backend service | Anomaly detection engine (4 detection types) | 3 |
| Backend API | Anomaly list, config, refresh endpoints | 1.5 |
| Frontend — Dashboard | Anomaly alert cards | 1.5 |
| Frontend — Pipeline | Anomaly badges on Kanban cards | 1 |
| Frontend — Detail | Anomaly indicators on Lead/Opp detail | 1 |
| Frontend — Admin | Threshold configuration UI | 1 |
| Testing | Unit tests for detection logic | 1.5 |
| **Total** | | **11 days (~2.5 weeks)** |

---

## 8. Item #30 — Mobile-First Redesign

### 8.1 Problem Statement

CRM mobile experience scores 4/10. CrmNav overflows on mobile, tables are unusable on phones, Kanban drag doesn't support touch, and there are no mobile-specific navigation patterns (bottom nav, FAB, swipe gestures).

### 8.2 Scope

**In Scope:**
- Bottom navigation bar (Dashboard / Pipeline / + / Activities / Profile) for mobile
- Collapsible CrmNav hamburger menu on mobile
- Card-based list views on mobile (replace tables ≤768px)
- Swipe gestures for Kanban (replace drag-and-drop on touch devices)
- Floating Action Button (FAB) for quick-add on mobile
- Infinite scroll / "Load More" for all list views (replace pagination)
- Touch-optimized form modals (larger touch targets, bottom-sheet style)
- Orientation-aware layouts (portrait vs landscape)

**Out of Scope:**
- Native mobile app (React Native / Flutter) — separate project
- PWA offline support — future
- Push notifications — use existing SSE + future mobile app
- Tablet-specific layouts (already acceptable per audit)

### 8.3 Component Architecture

**Bottom Navigation (new component):**
```
<CrmMobileNav>  — renders at md: breakpoint and below
  - 5 items: Dashboard, Pipeline, Add (+), Activities, Profile
  - Active state matches current route
  - "+" button opens quick-add bottom sheet
```

**Quick-Add FAB + Bottom Sheet:**
```
<CrmQuickAdd>  — renders on all CRM pages on mobile
  - "+" FAB in bottom-right
  - Bottom sheet slides up with: New Lead, New Contact, New Account, New Opportunity, Log Activity
  - Each option opens a mobile-optimized create form
```

**Mobile List Views:**
```
<CrmMobileList>  — replaces table views on mobile
  - Card-based layout (1 column on phone, 2 on landscape)
  - Swipe actions (left: archive, right: quick-edit)
  - Pull-to-refresh
  - Infinite scroll with "Load More" threshold
```

**Mobile Kanban:**
```
<CrmMobilePipeline>  — replaces desktop Kanban on mobile
  - Vertical column stack (swipe between stages)
  - Tap card to expand detail
  - Stage selector (tabs) instead of horizontal scroll
  - Swipe left/right to change stage
```

**Mobile Forms:**
```
<CrmMobileForm>  — bottom-sheet style forms
  - Slide-up from bottom
  - Full-width inputs
  - Larger touch targets (min 44px)
  - Sticky header (title + save/cancel)
  - Scrolling body
```

### 8.4 Breakpoint Strategy

| Breakpoint | Layout | Nav | Lists | Kanban |
|------------|--------|-----|-------|--------|
| < 640px (xs) | Single column, bottom nav, FAB, bottom sheets | Bottom bar only | Card list | Vertical stage stack |
| 640-768px (sm) | Single column, bottom nav | Bottom bar + hamburger | Card list | Vertical + stage tabs |
| 768-1024px (md) | Two columns, collapsible sidebar | CrmNav hamburger | Compact table | Horizontal Kanban (2 cols) |
| > 1024px (lg) | Current desktop layout | Full sidebar + CrmNav tabs | Full table | Full Kanban |

### 8.5 Effort & Sprint Plan

| Phase | Task | Days |
|-------|------|------|
| **Part 1: Navigation + Layout** | | |
| Frontend — Bottom nav | `<CrmMobileNav>` component + routing | 2 |
| Frontend — FAB + Quick-add | `<CrmQuickAdd>` FAB + bottom sheet | 2 |
| Frontend — Mobile forms | Bottom-sheet forms for Create modals | 3 |
| Frontend — Responsive breakpoints | Layout switching (sidebar → bottom nav) | 1.5 |
| Testing — Mobile nav | Cross-device testing | 0.5 |
| **Part 1 subtotal** | | **9 days (~2 weeks)** |
| **Part 2: List Views + Kanban** | | |
| Frontend — Mobile lists | Card-based list views for all 4 entities | 4 |
| Frontend — Infinite scroll | "Load More" component + API pagination support | 2 |
| Frontend — Mobile Kanban | Vertical stage stack + swipe gestures | 4 |
| Frontend — Touch gestures | Touch event handling, swipe thresholds | 1.5 |
| Testing — Cross-device | iOS Safari, Chrome Android, responsive testing | 1 |
| **Part 2 subtotal** | | **12.5 days (~2.5 weeks)** |
| **Part 3: Polish + Edge Cases** | | |
| Frontend — Detail pages | Mobile-optimized Lead/Opp/Account/Contact detail | 3 |
| Frontend — Reports mobile | Swipeable tabs, card-based data display | 2 |
| Frontend — AI features mobile | Bottom-sheet AI panels | 1.5 |
| Accessibility | Touch target audit, contrast checks | 1 |
| **Part 3 subtotal** | | **7.5 days (~1.5 weeks)** |
| **Total** | | **29 days (~6 weeks)** |

### 8.6 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Touch gesture conflicts (Kanban swipe vs. scroll) | Require explicit horizontal drag threshold (20px) before interpreting as swipe; use momentum-based scrolling for vertical |
| Performance on low-end devices | Lazy-load list items; reduce re-renders with `React.memo`; use `IntersectionObserver` for infinite scroll |
| Form UX on small screens | Bottom-sheet pattern (proven by mobile web apps); avoid full-page forms; use progressive disclosure |
| Cross-browser touch behavior | Use `touch-action` CSS; test on Safari (webkit) and Chrome separately |

---

## Sprint Timeline Overview

### Recommended Execution Order

```
Phase 4 Sprint 1 (Weeks 1-2):    #23 Import/Export Tool
Phase 4 Sprint 2 (Weeks 3-5):    #29 Territory/Quotas Model + UI
Phase 4 Sprint 3 (Weeks 6-8):    #24 Configurable Dashboard Widgets
Phase 4 Sprint 4 (Weeks 9-13):   #21 Workflow Automation Engine (Part 1: Core Engine)
Phase 4 Sprint 5 (Weeks 14-16):  #21 Workflow Automation Engine (Part 2: Builder UI)
Phase 4 Sprint 6 (Weeks 17-20):  #22 Email/Calendar Integration (Part 1: Gmail)
Phase 4 Sprint 7 (Weeks 21-22):  #22 Email/Calendar Integration (Part 2: Outlook)
Phase 4 Sprint 8 (Weeks 23-24):  #27 AI Pipeline Anomaly Detection
Phase 4 Sprint 9 (Weeks 25-27):  #25 Custom Fields/Objects (Part 1: Model + Admin)
Phase 4 Sprint 10 (Weeks 28-30): #25 Custom Fields/Objects (Part 2: Rendering + Integration)
Phase 4 Sprint 11 (Weeks 31-32): #30 Mobile-First Redesign (Part 1: Nav + Layout)
Phase 4 Sprint 12 (Weeks 33-35): #30 Mobile-First Redesign (Part 2: Lists + Kanban)
Phase 4 Sprint 13 (Weeks 36-37): #30 Mobile-First Redesign (Part 3: Polish)
```

**Total estimated duration: ~37 weeks (~9 months)**

### Dependency Graph

```
#23 Import/Export ────────────── (no dependencies, start first)
#29 Territory/Quotas ─────────── (no dependencies, can start after Sprint 1)
#24 Dashboard Widgets ────────── (depends on #29 for Quota Attainment widget)
#21 Workflow Engine ──────────── (depends on Phase 3 #28 audit trail, #19 document checklist)
#22 Email/Calendar ────────────── (depends on Phase 3 #A activity edit/delete)
#27 AI Anomaly Detection ─────── (depends on Phase 3 #26 AI Next Best Action for shared AI pipeline)
#25 Custom Fields ────────────── (depends on Phase 3 #C fix CrmOpportunities form, #20 configurable list views)
#30 Mobile Redesign ──────────── (depends on Phase 3 #18 mobile CrmNav)
```

### Parallelization Opportunities

These items can run in parallel if team size allows:

| Track A | Track B |
|---------|---------|
| #23 Import/Export (2w) | #29 Territory/Quotas model design (1w overlap) |
| #24 Dashboard Widgets (2.5w) | #27 AI Anomaly Detection (2.5w, after Phase 3 #26) |
| #25 Custom Fields Part 1 (1.5w) | #21 Workflow Engine Part 1 (2.5w) |
| #25 Custom Fields Part 2 (3w) | #22 Email Integration Part 1 (4w) |

With parallel tracks, total duration could reduce to **~28-30 weeks (~7 months)**.

---

## Appendix A — New Prisma Models Summary

| Model | Purpose | Item |
|-------|---------|------|
| CrmImportJob | Import job tracking | #23 |
| CrmExportJob | Export job tracking | #23 |
| CrmTerritory | Territory definition | #29 |
| CrmTerritoryMember | Territory-user assignment | #29 |
| CrmQuota | Sales quota targets | #29 |
| CrmDashboardLayout | User widget layout preferences | #24 |
| CrmWorkflow | Workflow definition (trigger + conditions + actions) | #21 |
| CrmWorkflowExecution | Workflow execution audit log | #21 |
| CrmEmailIntegration | OAuth tokens + sync settings | #22 |
| CrmSyncedEmail | Synced email messages | #22 |
| CrmSyncedEvent | Synced calendar events | #22 |
| CrmCustomFieldDefinition | Custom field config per entity | #25 |

**Plus JSONB columns added to existing models:**
- `CrmLead.customFields`
- `CrmContact.customFields`
- `CrmAccount.customFields`
- `CrmOpportunity.customFields`
- `CrmActivity.customFields`

---

## Appendix B — New API Endpoints Summary

| Module | Endpoints | Item |
|--------|-----------|------|
| Import/Export | 8 endpoints | #23 |
| Territories | 6 endpoints | #29 |
| Quotas | 5 endpoints | #29 |
| Dashboard Layout | 2 endpoints | #24 |
| Workflows | 8 endpoints | #21 |
| Integrations (OAuth) | 4 endpoints | #22 |
| Synced Emails | 3 endpoints | #22 |
| Synced Events | 1 endpoint | #22 |
| Custom Fields | 2 endpoints (CRUD on definition) | #25 |
| Anomalies | 4 endpoints | #27 |
| **Total** | **43 new endpoints** | |

---

## Appendix C — New Frontend Files Summary

| Component | Purpose | Item |
|-----------|---------|------|
| `CrmImportDialog.tsx` | Import flow: upload → map → preview → execute | #23 |
| `CrmImportHistory.tsx` | Import job list | #23 |
| `CrmExportDialog.tsx` | Export entity + filters | #23 |
| `CrmTerritories.tsx` | Territory list page | #29 |
| `CrmTerritoryDetail.tsx` | Territory detail: regions, members, quota | #29 |
| `CrmQuotaDashboard.tsx` | Quota attainment charts | #29 |
| `CrmDashboardLayoutProvider.tsx` | Widget layout context | #24 |
| `CrmWidgetPicker.tsx` | Show/hide widgets drawer | #24 |
| `CrmWidgetRenderer.tsx` | Dynamic widget component map | #24 |
| `CrmWorkflows.tsx` | Workflow list page | #21 |
| `CrmWorkflowBuilder.tsx` | Step-by-step workflow builder | #21 |
| `CrmWorkflowDetail.tsx` | Workflow detail + execution log | #21 |
| `CrmIntegrationsSettings.tsx` | OAuth connect/disconnect + sync preferences | #22 |
| `CrmEmailThread.tsx` | Email thread view tab | #22 |
| `CrmEmailCompose.tsx` | Compose email modal | #22 |
| `CrmCalendarSync.tsx` | Synced events in Activity tab | #22 |
| `CrmCustomFieldAdmin.tsx` | Field definition management | #25 |
| `CrmCustomFieldRenderer.tsx` | Dynamic form renderer | #25 |
| `CrmCustomFieldDisplay.tsx` | Detail page field groups | #25 |
| `CrmCustomFieldFilter.tsx` | List page filter component | #25 |
| `CrmAnomalyCards.tsx` | Dashboard anomaly alerts | #27 |
| `CrmAnomalyDetail.tsx` | Anomaly explanation modal | #27 |
| `CrmMobileNav.tsx` | Bottom navigation bar | #30 |
| `CrmQuickAdd.tsx` | FAB + bottom sheet | #30 |
| `CrmMobileList.tsx` | Card-based mobile list views | #30 |
| `CrmMobilePipeline.tsx` | Mobile-optimized Kanban | #30 |
| `CrmMobileForm.tsx` | Bottom-sheet form pattern | #30 |
| **28 new components** | | |

---

*End of Phase 4 Implementation Plan.*