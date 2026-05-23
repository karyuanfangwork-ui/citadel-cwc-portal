# Sprint 4: RequestDetail Cockpit + Insights Hub

## Overview

Transform RequestDetail from a long scroll page into a 2-pane workspace, consolidate **39 ModalType values** (14 modal flags in `useRequestDetail` + ActionSidebar's single `openModal` covering all workflow types) into a config-driven DecisionPanel, and replace 3 separate report pages with a unified Insights Hub.

> **Codebase baseline (verified):**
> - `RequestDetail.tsx`: 5 rendered sections — `RequestFormFields`, `HiringWorkflowPanel`, `OnboardingDashboard`, `OffboardingDashboard`, `ActivityFeed` (left) + `ApprovalActions`, `EntityApprovalsPanel`, `ActionSidebar` (right sidebar)
> - `useRequestDetail.ts`: 14 modal-specific boolean flags + 3 loading booleans = 17 total state variables
> - `ActionSidebar.tsx`: single `openModal: ModalType | null` state; `ModalType` union has **39 values**
> - `workflowModalConfig.ts`: located at `frontend/src/utils/workflowModalConfig.ts` — currently **2 entries** (PROCUREMENT, HARDWARE_ORDERED)
> - Modal files: **35 in `request-detail/`** + **9 in `request/modals/`** = **44 total**
> - `SlaProgressBar.tsx` already exists at `frontend/src/components/request/SlaProgressBar.tsx` (reusable)
> - Chart library: **recharts v3.8.1** already in `frontend/package.json`
> - Backend Redis: active for SSE, token revocation, RBAC cache — **no dedicated `cache.ts` utility**, caching is per-service
> - Existing permission: `report:read` (active on `/reports` routes)

---

## 4.1 — RequestDetail 2-Pane Workspace

### Current State
- `RequestDetail.tsx`: Single-column layout with sticky right sidebar
- `useRequestDetail.ts` (716 lines): 14 modal boolean flags (`showResolutionModal`, `showRejectionConfirm`, `showCompleteOnboardingConfirm`, `showUploadModal`, `showJobPostModal`, `showCEODecisionModal`, `showManagerDecisionModal`, `showScheduleInterviewModal`, `showEditInterviewModal`, `showInterviewFeedbackModal`, `showHRScreeningModal`, `showUploadLOAModal`, `showLOAApprovalModal`, `showUploadSignedLOAModal`) + 3 loading booleans
- `ActionSidebar.tsx`: Single `openModal: ModalType | null` covering 39 workflow action types
- `ActivityFeed.tsx` (243 lines): 4-tab view (all / comments / system / internal) — optimistic comment rendering
- Page-level modals: 9 HR-specific modals rendered in `RequestDetail.tsx` via `useRequestDetail` flags
- `ParticipantsSection`: currently rendered **inside** `ActionSidebar`, not a top-level panel
- No dedicated `AttachmentsSection` panel — attachments are embedded in `RequestFormFields`

### Target State
- **Left pane (60%)**: Conversation timeline (`ActivityFeed` reformatted as timeline)
- **Right pane (40%)**: Collapsible Workflow Cockpit with:
  - Request metadata card (compact)
  - Workflow stepper showing current position
  - DecisionPanel (contextual actions for current state)
  - Approval chain (who approved/rejected, pending)
  - SLA indicator (reuse existing `SlaProgressBar` component)

### Architecture

```
RequestDetail.tsx (refactored)
├── LeftPane
│   ├── RequestHeader (compact breadcrumb + ref + status)
│   ├── ConversationTimeline (ActivityFeed → timeline format)
│   │   ├── Status change events (with icon + diff)
│   │   ├── Approval decisions (inline, not just in sidebar)
│   │   ├── Comments (threaded if reply)
│   │   └── System events (assignment, SLA pause, etc.)
│   ├── RequestFormFields (existing — preserve as-is)
│   └── HiringWorkflowPanel / OnboardingDashboard / OffboardingDashboard
│       (existing conditional panels — preserve, place after timeline)
└── RightPane (WorkflowCockpit)
    ├── WorkflowStepper (horizontal mini-stepper, current step highlighted)
    ├── DecisionPanel (replaces ActionSidebar + page-level modals)
    │   └── Config-driven: reads WORKFLOW_MODAL_CONFIG + action schema
    ├── ApprovalChain (who's next, who decided, pending)
    ├── SLAIndicator (reuse SlaProgressBar — already used in ActionSidebar)
    ├── ParticipantsSection (extracted from ActionSidebar)
    └── EntityApprovalsPanel (existing — move from left column)
```

> **Note:** `AttachmentsSection` and `CustomFieldsPanel` from the original architecture sketch do not correspond to existing standalone components. Attachments remain inside `RequestFormFields`; no new attachment panel is needed this sprint.

### Implementation Steps

1. **Create `WorkflowCockpit.tsx`** — container for right pane components
   - Props: `request`, `user`, `actions`, `onAction`
   - Collapsible on mobile (slide-up sheet, `fixed bottom-0` overlay)
   - Sticky positioning on desktop (`sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto`)
   - Extract `ParticipantsSection` out of `ActionSidebar` and render it here

2. **Refactor `ActivityFeed.tsx`** into `ConversationTimeline.tsx`
   - Keep existing 4-tab props interface (`activities`, `onSubmitComment`, `canPostInternal`, `currentUser`)
   - Convert comment + activity list into vertical timeline format with connector lines
   - Status changes get colored icons; approval decisions show inline (✓/✗) with avatar
   - Comments grouped chronologically with date separators
   - Preserve optimistic comment rendering (temp-ID pattern)

3. **Simplify `RequestDetail.tsx`**
   - Remove 14 modal boolean flags from `useRequestDetail` (replaced by `DecisionPanel` in step 4.2)
   - Remove page-level modal rendering (move responsibility to `DecisionPanel`)
   - Layout: CSS Grid `grid-cols-1 lg:grid-cols-[3fr_2fr]` — left pane, right cockpit
   - Preserve existing conditional panels (`HiringWorkflowPanel`, `OnboardingDashboard`, `OffboardingDashboard`) in left column below timeline

4. **Responsive behavior**
   - Desktop (≥1024px): side-by-side 2-pane
   - Mobile (<1024px): cockpit collapses to bottom sheet; swipe/tap to expand; left pane is full width

5. **Verify data contract for `ConversationTimeline`**
   - Current API response for `RequestDetail` — confirm it includes `approvals` array for inline approval events in timeline
   - If not included, add `approvals` to the `/api/v1/requests/:id` response (backend change required)

### Key Files
- MODIFY: `frontend/pages/RequestDetail.tsx`
- MODIFY: `frontend/src/components/request/useRequestDetail.ts`
- MODIFY: `frontend/src/components/request-detail/ActivityFeed.tsx` → refactor into `ConversationTimeline.tsx`
- CREATE: `frontend/src/components/request-detail/WorkflowCockpit.tsx`
- CREATE: `frontend/src/components/request-detail/ConversationTimeline.tsx`
- CREATE: `frontend/src/components/request-detail/ApprovalChain.tsx`
- EXTRACT: `ParticipantsSection` out of `ActionSidebar.tsx` into its own file

---

## 4.2 — DecisionPanel (Consolidated Workflow Actions)

### Current State
- **39 ModalType values** in `ActionSidebar.tsx` (single `openModal` state)
- **14 modal boolean flags** in `useRequestDetail.ts` (page-level HR modals)
- **9 modal files** in `frontend/src/components/request/modals/`
- **22+ modal component files** in `frontend/src/components/request-detail/`
- **2 config entries** in `frontend/src/utils/workflowModalConfig.ts` (PROCUREMENT, HARDWARE_ORDERED)
- `WorkflowActionModal.tsx` renders config-driven modal forms; used when `hasWorkflowModalConfig(openModal)` is true

### Target State
- **1 DecisionPanel component** — renders contextual actions + modal forms from config
- **`WORKFLOW_MODAL_CONFIG` expanded** to cover all 39 ModalType values
- **Legacy modal files deprecated** after config entries are verified
- `ActionSidebar` removed; `useRequestDetail` modal flags removed; `DecisionPanel` is the sole action UI

### Architecture

```typescript
// workflowModalConfig.ts — expanded config (file: frontend/src/utils/workflowModalConfig.ts)
export interface WorkflowModalConfig {
  title: string;
  subtitle?: string;
  icon?: string;
  iconBgClass?: string;
  iconTextClass?: string;
  fields: WorkflowModalField[];
  submitLabel: string;
  submitColor: 'primary' | 'danger' | 'warning' | 'success';
  onSubmit: (requestId: string, values: Record<string, unknown>) => Promise<unknown>;
  // NEW fields:
  showWhen?: (request: RequestWithRelations, user: AuthUser) => boolean;
  validation?: (values: Record<string, unknown>) => Record<string, string>;
  requiresPermission?: string;  // e.g. 'approval:write' — UI hides button if user lacks it
  loadingLabel?: string;        // label shown on submit button during async onSubmit
}

// DecisionPanel.tsx
interface DecisionPanelProps {
  request: RequestWithRelations;
  actions: WorkflowAction[];
  user: AuthUser;
  onActionComplete: () => void;
}
```

> **Loading/error pattern for DecisionPanel:** DecisionPanel owns a local `{ loading: boolean; error: string | null }` state. On action click it sets `loading = true`, calls `onSubmit`, clears on resolve or sets `error` on reject. `WorkflowActionModal` becomes a dumb form renderer — it no longer manages its own async state.

### Implementation Steps (Phase Approach)

**Phase A — Config Entries (incremental, no breakage)**

Add entries to `frontend/src/utils/workflowModalConfig.ts` for all 39 ModalType values. Both systems coexist during this phase; `hasWorkflowModalConfig()` check in `ActionSidebar` continues to work.

1. IT workflow modals (13):
   `ACKNOWLEDGE_IT`, `CEO_DECISION`, `CTO_DECISION`, `ROUTE_TO_CFO`, `CFO_DECISION`,
   `MARK_PROCUREMENT` (already done), `MARK_HARDWARE_ORDERED` (already done),
   `HARDWARE_RECEIVED`, `SOFTWARE_PROVISIONED`, `FULFILMENT`, `PAYMENT_DONE`,
   `COMPLETE_DELIVERY`, `ASSIGN`

2. Finance workflow modals (6):
   `FIN_ACKNOWLEDGE`, `ROUTE_TO_CEO_FIN`, `CFO_DECISION_FIN`, `GROUP_CEO_DECISION_FIN`,
   `MARK_PAYMENT_COMPLETE_FIN`, `CLOSE_TICKET_FIN`

3. HR workflow modals (10):
   `ROUTE_TO_CEO_HR`, `ROUTE_TO_GROUP_CEO_HR`, `GROUP_CEO_DECISION_HR`,
   `MARK_JOB_POSTED`, `UPLOAD_RESUME`, `MANAGER_DECISION`, `SCHEDULE_INTERVIEW`,
   `UPDATE_SCREENING`, `UPLOAD_LOA`, `UPLOAD_SIGNED_LOA`
   *(+ `INTERVIEW_FEEDBACK`, `EDIT_INTERVIEW` if present in ModalType)*

4. Chargeback/Expense modals (10):
   `FROM_ENTITY_APPROVE`, `FROM_ENTITY_REJECT`, `TO_ENTITY_APPROVE`, `TO_ENTITY_REJECT`,
   `MANAGER_APPROVE_EXPENSE`, `MANAGER_REJECT_EXPENSE`,
   `FINANCE_HEAD_APPROVE_EXPENSE`, `FINANCE_HEAD_REJECT_EXPENSE`,
   `MARK_EXPENSE_PAYMENT_COMPLETE`
   *(+ any remaining ModalType values not covered above)*

> **Before starting Phase A:** enumerate all values in the `ModalType` union in `ActionSidebar.tsx` and cross-check against this list. The union currently has **39 values** — ensure 100% coverage before Phase B.

**Phase B — DecisionPanel Component**

5. Create `DecisionPanel.tsx`
   - Calls `getWorkflowActions(status, roles, ...)` to get valid actions for current state
   - Maps each action to its `WORKFLOW_MODAL_CONFIG` entry (all 39 now covered)
   - Shows action cards: icon, label, description, submit color
   - On click → opens `WorkflowActionModal` with config entry
   - Fallback for any action without a config entry: generic "Proceed" confirmation dialog (safety net, should never be reached after Phase A)
   - Owns loading + error state; passes `loadingLabel` and `onError` to `WorkflowActionModal`

**Phase C — Integration & Removal**

6. Replace `ActionSidebar` usage in `RequestDetail.tsx` with `DecisionPanel` (inside `WorkflowCockpit`)
7. Remove 14 modal boolean flags and page-level modal rendering from `useRequestDetail.ts` — simplify to `onActionComplete → refetch()`
8. Run `npx tsc --noEmit` and end-to-end test of all 39 modal flows
9. Delete legacy modal files (see cleanup list below)

### Cleanup File List (delete after Phase C verified)
- `frontend/src/components/request-detail/ActionSidebar.tsx`
- All individual modal `.tsx` files in `frontend/src/components/request-detail/` that are now config-driven
- All 9 files in `frontend/src/components/request/modals/` that are now config-driven
- Modal-related flags in `frontend/src/components/request/useRequestDetail.ts`

### Key Files
- MODIFY: `frontend/src/utils/workflowModalConfig.ts` *(note: not in `request-detail/` — it's in `utils/`)*
- MODIFY: `frontend/src/components/request-detail/WorkflowActionModal.tsx` (make dumb renderer, remove own async state)
- CREATE: `frontend/src/components/request-detail/DecisionPanel.tsx`
- CREATE: `frontend/src/components/request-detail/WorkflowStepper.tsx` *(also needed by 4.1)*
- MODIFY: `frontend/pages/RequestDetail.tsx`
- MODIFY: `frontend/src/components/request/useRequestDetail.ts`
- DEPRECATE: `frontend/src/components/request-detail/ActionSidebar.tsx` (after Phase C)

---

## 4.3 — Insights Hub `/insights`

### Current State
- **3 separate report pages** with zero shared infrastructure:
  - `/reports` → `Reports.tsx` — ITSM helpdesk stats; standalone page, no module nav; guarded by `report:read`
  - `/crm/reports` → `CrmReports.tsx` — 7-tab CRM pipeline analytics (705 lines); **imports `CrmNav`** — must be extracted before embedding in Insights
  - `/credit/reports` → `CreditReports.tsx` — 2-tab credit reports; guarded by `credit:read`
- **No service layer** for helpdesk reports — all aggregation logic lives in `reports.controller.ts`
- **recharts v3.8.1** already installed — no new chart library needed
- **No dedicated cache utility** — Redis caching is per-service (token, RBAC, SSE); new `insights.service.ts` must implement its own caching inline or extract a shared helper

### Target State
- **Unified Insights Hub** at `/insights` — 4 tabs (Overview / ITSM / CRM / Credit)
- **Backend `insights.service.ts`** — centralized aggregation with Redis caching
- **Role-aware**: agents see their workload, managers see team metrics, admins see everything
- **Time-series data**: SLA compliance over time, request volume trends, resolution time distribution

### Architecture

```
/insights
├── Overview Tab (cross-module KPIs)
│   ├── Total open requests across modules
│   ├── SLA breach rate (rolling 7/30/90 day)
│   ├── Avg resolution time by module
│   └── Module-specific health cards (IT, HR, Finance, CRM, Credit)
├── ITSM Tab (replaces /reports)
│   ├── Summary cards (Total / Open / Resolved / Unassigned / Avg Resolution)
│   ├── By Service Desk bar chart (recharts BarChart)
│   ├── By Priority chart (recharts PieChart or BarChart)
│   ├── SLA compliance over time (recharts LineChart — new)
│   ├── Agent workload table
│   └── Date range filter (7d / 30d / 90d / Custom)
├── CRM Tab (reuse CrmReports panels — see extraction note below)
│   └── Lead Conversion, Sales Performance, Pipeline Forecast,
│       Activity Summary, Lead Aging, Win/Loss, KYC Compliance
└── Credit Tab (reuse CreditReports panels)
    ├── Pipeline Report
    └── Exposure Report
```

> **CRM extraction note:** `CrmReports.tsx` imports `CrmNav`. Before embedding CRM panels in the Insights Hub, extract the 7 tab content panels from `CrmReports.tsx` into standalone components (e.g. `LeadConversionPanel`, `SalesPerformancePanel`) so they can be placed in any layout. This is an extra step not in the original plan.

### Backend Endpoints (new, under `/api/v1/insights`)

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/insights/overview` | GET | `report:read` | Cross-module KPIs |
| `/insights/itsm/summary` | GET | `report:read` | Enhanced ITSM summary (supersedes `/reports/summary`) |
| `/insights/itsm/trends` | GET | `report:read` | Time-series: volume + SLA by day/week/month; max 90 days; paginated by granularity |
| `/insights/itsm/by-service-desk` | GET | `report:read` | Migrated from reports controller |
| `/insights/itsm/by-priority` | GET | `report:read` | Migrated from reports controller |
| `/insights/itsm/agent-workload` | GET | `report:read` | Migrated from reports controller |
| `/insights/itsm/sla-compliance` | GET | `report:read` | Enhanced SLA data |
| `/insights/crm/overview` | GET | `crm:read` | CRM KPIs (reuse existing CRM service) |
| `/insights/credit/overview` | GET | `credit:read` | Credit KPIs (reuse existing credit service) |

> **Permission:** Reuse existing `report:read` for ITSM/overview endpoints (already seeded and active). CRM tab uses `crm:read`; Credit tab uses `credit:read`. No new `insight:read` permission needs to be created or seeded.

> **Trends endpoint pagination:** `/insights/itsm/trends` must accept `?granularity=day|week|month` and `?from=&to=` query params. Max range: 90 days at daily granularity (cap at 90 data points). Return `{ data: TrendPoint[], granularity, from, to }`.

> **Caching:** No shared cache utility exists. Create `backend/src/utils/cache.ts` with a thin Redis wrapper (`get`, `set`, `del`) so `insights.service.ts` can cache aggregations at 5-min TTL without duplicating Redis client setup. Include a graceful no-op fallback if Redis is unavailable.

### Route Strategy for Existing Report URLs

| Old Route | New Route | Action |
|---|---|---|
| `/reports` | `/insights` | Redirect `/reports` → `/insights?tab=itsm` |
| `/crm/reports` | `/insights?tab=crm` | **Keep `/crm/reports` alive** — `CrmReports.tsx` stays; Insights CRM tab is additive |
| `/credit/reports` | `/insights?tab=credit` | **Keep `/credit/reports` alive** — same reason |

> The ITSM `/reports` route is the only one being deprecated (it has no module-specific nav and is cleanly replaceable). CRM and Credit report pages import module navs and serve module-specific contexts — keep them as-is; the Insights Hub is an additional unified view.

### Implementation Steps

1. **Create `backend/src/utils/cache.ts`** — thin Redis wrapper with graceful fallback

2. **Create `backend/src/services/insights.service.ts`**
   - Refactor aggregation logic out of `reports.controller.ts` into service methods
   - Add time-series aggregation: group requests by day/week/month using Prisma `groupBy`
   - Add Redis caching (5-min TTL) for overview and trend queries

3. **Create `backend/src/controllers/insights.controller.ts`**
   - `getOverview`, `getItsmSummary`, `getItsmTrends`, `getItsmByServiceDesk`,
     `getItsmByPriority`, `getItsmAgentWorkload`, `getItsmSlaCompliance`

4. **Create `backend/src/routes/insights.routes.ts`**
   - Mount all endpoints under `/api/v1/insights`
   - Apply `requirePermission('report:read')` at router level (CRM/Credit endpoints override per-route)
   - Register in `backend/src/routes/index.ts`

5. **Extract CRM tab panels from `CrmReports.tsx`**
   - Pull 7 tab content blocks into `frontend/src/components/insights/crm/` components
   - `CrmReports.tsx` continues to use them (no regression)

6. **Create `frontend/src/services/insights.service.ts`**
   - Axios calls for all `/insights` endpoints

7. **Create `frontend/pages/Insights.tsx`**
   - Tab layout (Overview / ITSM / CRM / Credit) with permission-gated tabs
   - Date range filter (7d / 30d / 90d / Custom) — shared across tabs
   - ITSM tab: recharts LineChart for trends + existing bar/pie charts
   - CRM tab: extracted panel components
   - Credit tab: extracted panel components
   - Empty states for each tab (no data, insufficient permissions)

8. **Update routing**
   - Add `/insights` route to `App.tsx` (permission: `report:read`)
   - Add redirect: `/reports` → `/insights` (use React Router `<Navigate>`)
   - Update `navConfig.ts`: "Reports" → "Insights" pointing to `/insights`
   - Leave `/crm/reports` and `/credit/reports` routes unchanged

### Key Files
- CREATE: `backend/src/utils/cache.ts`
- CREATE: `backend/src/services/insights.service.ts`
- CREATE: `backend/src/controllers/insights.controller.ts`
- CREATE: `backend/src/routes/insights.routes.ts`
- CREATE: `frontend/src/services/insights.service.ts`
- CREATE: `frontend/pages/Insights.tsx`
- CREATE: `frontend/src/components/insights/crm/` (extracted CRM panels)
- MODIFY: `backend/src/routes/index.ts` (mount insights routes)
- MODIFY: `frontend/App.tsx` (add /insights route + /reports redirect)
- MODIFY: `frontend/src/components/layout/navConfig.ts` (Reports → Insights)
- KEEP: `frontend/pages/Reports.tsx` (add redirect to /insights; delete after nav is updated)
- KEEP: `frontend/pages/CrmReports.tsx` and `frontend/pages/credit/CreditReports.tsx`

---

## 4.4 — WorkflowStepper Mini-Component

### Architecture
A compact horizontal/vertical stepper showing workflow progress:
- Reads `requestType.workflow.steps` from the request data
- Highlights current step based on `request.status`

> **Prerequisite:** Verify that `request.status` values map 1:1 (or as an ordered subset) onto `requestType.workflow.steps`. If the mapping is indirect (e.g. multiple statuses map to one step), document the mapping in a `STATUS_TO_STEP` lookup table inside `WorkflowStepper.tsx` before building the UI.

### Implementation Steps

1. **Create `WorkflowStepper.tsx`**
   - Horizontal stepper for desktop, vertical for mobile
   - Step states: `completed` (green check), `current` (pulsing dot), `upcoming` (gray)
   - SLA badge on current step (reuse `SlaProgressBar` for remaining time display)
   - Click step → popover with: approver name/avatar, decision, timestamp, SLA countdown
   - Collapsible if > 5 steps (collapsed by default)
   - Empty state: single "In Progress" node if `workflow.steps` is unavailable

2. **Integrate into `WorkflowCockpit`** — placed above `DecisionPanel`

### Key Files
- CREATE: `frontend/src/components/request-detail/WorkflowStepper.tsx`

---

## 4.5 — ApprovalChain Component

### Architecture
Show the full approval chain for a request:
- Reads `request.approvals` (must be in API response — verify in step 4.1.5)
- Lists each approver: avatar, name, decision, timestamp
- Pending approvals highlighted with "Waiting for..." + SLA countdown
- SLA breach warning on pending approvals past due date

### Implementation Steps

1. **Create `ApprovalChain.tsx`**
   - Vertical timeline of approval nodes
   - Each node: approver avatar + name, decision icon (✓/✗/⏳), timestamp
   - Pending nodes: "Waiting for {role}" with SLA countdown
   - Click node → popover with full details
   - **Empty state:** "No approvals required" placeholder when `request.approvals` is empty or undefined

2. **Integrate into `WorkflowCockpit`** — placed below `DecisionPanel`; only rendered when `request.approvals?.length > 0`

### Key Files
- CREATE: `frontend/src/components/request-detail/ApprovalChain.tsx`

---

## Implementation Order

| Phase | Section Ref | Tasks | Est. LOC | Dependencies |
|-------|-------------|-------|----------|--------------|
| **P1** | 4.4 + 4.5 | WorkflowStepper + ApprovalChain (standalone, no layout change) | ~400 | None |
| **P2** | 4.2 Phase A | DecisionPanel config entries (all 39 ModalType values) | ~600 | None (parallel with P1) |
| **P3** | 4.2 Phase B | DecisionPanel component | ~500 | P1, P2 |
| **P4** | 4.1 | RequestDetail 2-pane refactor + WorkflowCockpit | ~350 | P1, P3 |
| **P5** | 4.2 Phase C | Integration, ActionSidebar removal, cleanup | ~−800 (net deletion) | P3, P4 |
| **P6** | 4.3 backend | cache.ts + insights.service + controller + routes | ~400 | None (parallel) |
| **P7** | 4.3 frontend | CRM panel extraction + Insights.tsx page | ~550 | P6 |
| **P8** | — | Integration testing + TypeScript check + cleanup | ~100 | All |

**Total estimated: ~2,800 LOC new / ~1,200 LOC modified / ~800 LOC deleted**

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ModalType union has 39 values; config entries must reach 100% before Phase C | Missing entry → runtime fallback modal shown | Enumerate ModalType before Phase A; add assertion in DecisionPanel that every dispatched action has a config entry |
| `request.approvals` not in current API response | ApprovalChain and ConversationTimeline inline approvals have no data | Verify in P1; add `approvals` include to requests GET endpoint if missing |
| CrmReports imports CrmNav — embedding in Insights requires panel extraction | CRM tab in Insights breaks layout | Extract 7 CRM panels before building Insights CRM tab (P7 step 5) |
| 2-pane layout breaks mobile | Users can't complete workflows on phone | Bottom-sheet cockpit; test on 375px viewport |
| Insights backend performance on wide date ranges | Slow aggregation queries | Redis caching (5-min TTL); cap trends at 90 days; add DB index on `createdAt` + `status` if missing |
| Redis unavailable in dev/staging | insights.service crashes on cache miss | Implement graceful no-op fallback in `cache.ts` |
| Breaking `/reports` bookmarks | Users lose saved links | React Router `<Navigate from="/reports" to="/insights" />` redirect |

---

## Verification Checklist

### Correctness
- [ ] All 39 ModalType values have WORKFLOW_MODAL_CONFIG entries (enumerate before starting Phase A)
- [ ] DecisionPanel renders correct actions for each request status; fallback dialog never triggered in normal use
- [ ] `request.approvals` array confirmed in GET `/requests/:id` response (or backend updated to include it)
- [ ] WorkflowStepper `STATUS_TO_STEP` mapping documented and tested for all request types

### Layout & Responsive
- [ ] 2-pane layout works on desktop (1440px) and mobile (375px)
- [ ] WorkflowCockpit bottom sheet opens/closes correctly on mobile
- [ ] ConversationTimeline shows all activity types (comments, status changes, inline approvals, system events)

### Components
- [ ] WorkflowStepper highlights correct current step; collapses when > 5 steps
- [ ] ApprovalChain shows pending + completed approvals; renders empty state when no approvals
- [ ] SLAIndicator (SlaProgressBar reuse) shows correct countdown and breach state

### Insights Hub
- [ ] Insights page loads all 4 tabs without errors
- [ ] `/reports` redirects to `/insights`; `/crm/reports` and `/credit/reports` still load correctly
- [ ] ITSM trends endpoint returns time-series data; respects `?granularity` and `?from/to` params
- [ ] Role-based visibility: agents see workload, managers see team, admins see all
- [ ] CRM panels render correctly inside Insights tab (no CrmNav bleed-in)
- [ ] Empty states render for each tab when data is unavailable

### Permissions
- [ ] `report:read` permission gates ITSM + Overview tabs (no new permission needed)
- [ ] `crm:read` gates CRM tab; `credit:read` gates Credit tab
- [ ] DecisionPanel `requiresPermission` field hides action buttons for unauthorized users

### Build
- [ ] `npx tsc --noEmit` passes with zero errors after each phase
- [ ] `npm run build` completes without errors
- [ ] All deleted legacy modal files have zero remaining imports
