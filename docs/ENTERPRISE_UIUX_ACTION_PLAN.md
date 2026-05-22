# CWC 2.0 — Enterprise UI/UX Action Plan

**Created:** 2026-05-22
**Source:** ENTERPRISE_UIUX_AUDIT_2026-05-22.md
**Baseline Composite Score:** 5.4 / 10
**Target Score (W1–W3 complete):** 7.0 / 10
**Target Score (W1–W5 complete):** 8.2 / 10

---

## Audit Quick Wins Status (§7)

| Q# | Item | Status | Notes |
|----|------|--------|-------|
| Q1 | Ref# URLs `/request/:ref` | PARTIAL | Nav links use referenceNumber; no server redirect from ref# to UUID |
| Q2 | SLA progress bar | DONE | SlaProgressBar in RequestHeader |
| Q3 | Fix `href="#"` | PARTIAL | Footer clean; MyRequests sidebar still has 2x `href="#"` |
| Q4 | StateBadge adoption | NOT STARTED | StateBadge exists in `ui/`; not used in Assets/CRM/ApprovalQueue |
| Q5 | aria-live for toast | DONE | role="status" + aria-live="polite" in NotificationToast |
| Q6 | Reports skeleton | DONE | Uses Skeleton component |
| Q7 | Date-range on Reports | DONE | Full date-range UI with presets |
| Q8 | KB feature flag | DONE | Gated behind `isFeatureEnabled('kb')` |
| Q9 | Hide OPENAI_API_KEY | DONE | No key leak in frontend |
| Q10 | Environment banner | DONE | EnvironmentBanner rendered in App.tsx |
| Q11 | aria-describedby forms | NOT STARTED | No aria-describedby on CreateRequest, ChangePassword, RequestFormFields |
| Q12 | Bulk-approve preview | DONE | Bulk select/approve/reject exists |
| Q13 | Recently used services | DONE | RecentServices component in CreateRequest |
| Q14 | Save Draft chip | DONE | useDraftSave + DraftSaveChip |
| Q15 | Out-of-office field | PARTIAL | Toggle exists; no date/message fields |

**Remaining Quick Win effort:** ~5 dev-days (Q1 partial finish, Q3 cleanup, Q4 refactor, Q11 a11y, Q15 OOO completion)

---

## Sprint Plan

Assumptions:
- 1 sprint = 2 weeks
- 1 developer (you) working full-time on frontend
- Sprints are sequential; no parallel tracks
- "S" = 0.5–1 day, "M" = 2–3 days, "L" = 1 sprint chunk, "XL" = 2+ sprints

---

### SPRINT 1 (Week 1–2): Close Out Quick Wins + Critical Fixes

**Theme:** Clean slate — finish all remaining quick wins, fix the highest-risk items

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 1.1 | Fix MyRequests sidebar `href="#"` — change to buttons or proper links | Q3 | XS | `MyRequests.tsx:180,187` |
| 1.2 | Ref# URL redirect: add `/request/:ref` route that resolves referenceNumber → UUID (backend already supports lookup) | Q1 | S | `App.tsx`, new `RequestRedirect.tsx` |
| 1.3 | Adopt `<StateBadge>` in AssetManagement.tsx — replace `STATUS_COLORS` map | Q4 | S | `AssetManagement.tsx:13-23` |
| 1.4 | Adopt `<StateBadge>` in ApprovalQueue.tsx — replace `PRIORITY_BADGES` map | Q4 | S | `ApprovalQueue.tsx:38-43` |
| 1.5 | Adopt `<StateBadge>` in CrmPipeline.tsx — replace inline `stage.color` | Q4 | S | `CrmPipeline.tsx` |
| 1.6 | Add `aria-describedby` linking form errors to inputs in CreateRequest + ChangePassword + RequestFormFields | Q11 | S | 3 files |
| 1.7 | Complete Out-of-Office: add date picker + message field to OOO toggle (expand header popover or move to `/settings`) | Q15 | M | `App.tsx:247-263`, new OOO modal |
| 1.8 | Add `prefers-reduced-motion` handling for `animate-spin` / `animate-pulse` | Top-50 #50 | XS | `tailwind.theme.extend.ts` or global CSS |
| 1.9 | Fix file custom-field storage — backend must store actual file, not just filename string (HIGH RISK #2) | Risk #2 | M | Backend + frontend upload component |

**Sprint 1 deliverables:** All Q1–Q15 complete. Top compliance risk (#2 file uploads) addressed. All inline status colors use StateBadge.

**Verification:** 
- `grep -r "STATUS_COLORS\|PRIORITY_BADGES\|STAGE_COLORS\|LEAD_COLORS" frontend/pages/` returns 0 results
- `grep -r 'href="#"' frontend/pages/` returns 0 results
- Lighthouse a11y score ≥ 85

---

### SPRINT 2 (Week 3–4): Design System Foundation + Header Shell

**Theme:** Establish the `ui/` component library and refactor the navigation shell

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 2.1 | Create `frontend/src/components/ui/` primitives: Button, Card, Tabs, Modal, Drawer, Tooltip, EmptyState, Combobox, DataTable | §5.7, §5.4 | L | New files in `ui/` |
| 2.2 | Migrate `StateBadge`, `RiskBadge`, `AutosaveTextField` from `components/credit/` to `components/ui/` (keep re-exports from credit for backward compat) | §4.4 | M | Move + re-export |
| 2.3 | Replace all 6 inline color maps with token-bound `<StateBadge variant="asset|request|approval|crm|priority|category">` | §5.7 | M | 6+ files |
| 2.4 | Refactor App.tsx header shell — extract to `<AppShell>` component (577 LOC → modular) | §3.3, §5.2 | M | `App.tsx`, new `AppShell.tsx` |
| 2.5 | Add left rail navigation with module icons (5 modules + admin pinned bottom). Expand-on-hover with labels. Mobile: keep hamburger drawer | §5.2 | L | `AppShell.tsx`, `LeftRail.tsx`, `MobileDrawer.tsx` refactor |
| 2.6 | Add role badge + environment indicator to header (env banner already done; add current role chip) | §5.6 | S | `AppShell.tsx` |

**Sprint 2 deliverables:** `ui/` folder with 10+ primitives. Left rail shipped. App.tsx < 200 LOC. All status colors token-bound.

**Verification:**
- `grep -rn "bg-green-100\|text-red-600\|bg-blue-100" frontend/pages/` returns 0 (or only in ui/ definitions)
- Storybook (or Chromatic) can render each primitive
- App renders correctly with left rail on desktop, drawer on mobile

---

### SPRINT 3 (Week 5–6): Unified Inbox + Approval Center + Global Audit Trail

**Theme:** Solve the "where is my work?" problem and compliance gap

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 3.1 | Create `/inbox` route aggregating My Requests + My Approvals + Awaiting My Action + Mentions with tab filters | §4.1 #1 | L | New `Inbox.tsx`, `inbox.service.ts` (backend endpoint) |
| 3.2 | Unified Approval Center: merge `/approvals` + `/credit/approvals` into `/approvals?scope=itsm|credit|all` with tabs | §4.4 #3, §4.6 #1 | L | Refactor `ApprovalQueue.tsx` + `MyApprovals.tsx` |
| 3.3 | Side-drawer preview for approvals — view full request without leaving queue | §4.6 #5 | M | New `ApprovalPreviewDrawer.tsx` |
| 3.4 | Approval delegation: out-of-office delegation UI (leveraging Q15 OOO fields) — backend route + frontend | §4.6 #7 | M | Backend delegation API + frontend settings |
| 3.5 | Escalation badge on approval rows (read from `EscalationRule` data) | §4.6 #8 | S | `ApprovalQueue.tsx` |
| 3.6 | Policy explainer: "Why is this routed to me?" — show threshold rule on each approval | §4.6 #9 | M | New backend endpoint + `ApprovalPolicy.tsx` |
| 3.7 | Global audit trail page under `/admin/audit` with entity-level links | §4.9 #5, Risk #1 | L | New `AuditTrail.tsx` + backend endpoint |

**Sprint 3 deliverables:** Single inbox. Single approval center with delegation. Global audit trail UI. Compliance risk #1 resolved.

**Verification:**
- `/inbox` shows all pending items for each role
- `/approvals?scope=credit` returns same data as old `/credit/approvals`
- `/admin/audit` renders filterable activity log
- Approver can set delegation date range and assignee

---

### SPRINT 4 (Week 7–8): RequestDetail Workflow Cockpit + Insights Hub

**Theme:** The biggest single UX improvement — transform RequestDetail from "wall of modals" to a modern workspace

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 4.1 | Redesign RequestDetail: left pane = conversation timeline, right pane = collapsible Workflow Cockpit with stage indicator + contextual actions | §4.1 #2 | XL | Major rewrite of `RequestDetail.tsx`, new `WorkflowCockpit.tsx`, `ConversationTimeline.tsx` |
| 4.2 | Consolidate 35 modals into `<DecisionPanel>` driven by `workflowModalConfig.ts` schema — single panel renders correct action fields for current state | §4.8 #2 | L | New `DecisionPanel.tsx`, sunset individual modal files |
| 4.3 | Unified Insights Hub at `/insights` — merge ITSM + CRM + Credit + Asset reports with date-range + drill-down + export | §4.5 | L | New `InsightsHub.tsx`, backend aggregation endpoints |
| 4.4 | Add drill-down: every stat card links to filtered list | §4.5 #5 | S | Each stat card gets `onClick` → filtered route |
| 4.5 | Add CSV/XLSX export to Insights Hub | §4.5 #3 | S | New export button + backend endpoint |

**Sprint 4 deliverables:** RequestDetail rebuilt as 2-pane workspace. 35 modals → 1 DecisionPanel. `/insights` replaces 3 separate report pages.

**Verification:**
- RequestDetail renders all current workflow actions from config, not hardcoded modal buttons
- `/insights?id=itsm` returns same data as old `/reports`
- Clicking "Open: 47" in insights navigates to `/my-requests?status=OPEN`

---

### SPRINT 5 (Week 9–10): DataTable Primitive + AgentDashboard + Saved Views

**Theme:** Table UX upgrade and agent workflow efficiency

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 5.1 | Build `<DataTable>` primitive (TanStack Table v8): server-side sort/filter/page, column chooser, density toggle, saved views, row selection, keyboard nav, CSV export | §5.4 | L | New `DataTable.tsx` in `ui/` |
| 5.2 | Replace MyRequests table with DataTable | §5.4 | M | `MyRequests.tsx` |
| 5.3 | Replace AgentDashboard tabs with DataTable + saved views (Smart Inboxes) | §4.1 #9 | M | `AgentDashboard.tsx` |
| 5.4 | Replace ApprovalQueue table with DataTable | §4.6 | M | `ApprovalQueue.tsx` (now ApprovalCenter) |
| 5.5 | Replace AssetManagement table with DataTable | §4.2 | M | `AssetManagement.tsx` |
| 5.6 | Add keyboard nav (j/k row navigation, e to edit, ? shortcut sheet) to DataTable | §4.1 #10 | S | `DataTable.tsx` |

**Sprint 5 deliverables:** Single reusable DataTable used across all list pages. Saved filter views. Keyboard nav.

**Verification:**
- All 5+ list pages use `<DataTable>` — no hand-rolled `<table>` in pages/
- Can save a filter view "Hardware escalated > SLA 2h" and recall it next login
- `j`/`k` navigates rows, `?` opens shortcut overlay

---

### SPRINT 6 (Week 11–12): ITAM Detail Route + Lifecycle + CRM Cross-Links

**Theme:** Asset management matures; CRM gets Account 360

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 6.1 | Split `AssetManagement.tsx` (1558 LOC) into `AssetList.tsx`, `AssetDetail.tsx`, `EmployeeAssetsTab.tsx`, `modals/` | §4.2 #1 | L | Split + routing |
| 6.2 | Add `/assets/:id` route with tabs (Overview, Assignment History, Lifecycle, Warranty/Cost, Documents, Audit) | §4.2 #4 | L | New `AssetDetail.tsx` + tabs |
| 6.3 | Asset lifecycle timeline visualization component | §4.2 #7 | M | New `LifecycleTimeline.tsx` |
| 6.4 | Warranty countdown + depreciation display | §4.2 #9 | M | New `WarrantyCard.tsx` |
| 6.5 | Faceted filter sidebar for assets (Status × Category × Assignee × Location × Vendor) | §4.2 #4 | M | New `AssetFilterSidebar.tsx` |
| 6.6 | CRM Account 360: add "Related" panel surfacing linked Borrower Profile, Credit Applications, Service Requests | §4.3 #1 | M | `CrmAccountDetail.tsx` expansion |
| 6.7 | Add "Source CRM Opportunity" link to Credit Application header | §4.4 #4 | S | `CreditApplicationDetail` header |

**Sprint 6 deliverables:** Asset detail page with lifecycle view. CRM Account 360 with cross-module links.

**Verification:**
- `/assets/A-0034891` renders without a modal
- Asset assignment history shows timeline
- CRM Account page links to Credit apps and service requests

---

### SPRINT 7 (Week 13–14): Mobile Bottom-Sheet + Persona-Aware Dashboard + Notification Center

**Theme:** Mobile experience and personalization

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 7.1 | Mobile bottom-sheet pattern for modals + responsive form fields | §5.5 | L | New `BottomSheet.tsx` in `ui/` |
| 7.2 | Card-list fallback for all DataTable instances at <768px | §5.5, #4 | M | `DataTable.tsx` responsive mode |
| 7.3 | Persona-aware Dashboard: end-user vs agent vs approver vs executive layouts | §5.1 | L | Refactor `Dashboard.tsx` into role-aware sections |
| 7.4 | `/notifications` full page with filters, archive, search | §4.7 #1 | M | New `NotificationCenter.tsx` |
| 7.5 | Notification preference center under `/settings/notifications` (per-event-type × per-channel) | §4.7 #3 | M | New `NotificationPreferences.tsx` |
| 7.6 | Group multiple events per entity into single notification card | §4.7 #4 | M | Refactor `NotificationDropdown.tsx` |
| 7.7 | `/tasks` view aggregating action-required tickets, approvals, mentions, incomplete CA sections | §4.7 #6 | L | New `Tasks.tsx` + backend endpoint |

**Sprint 7 deliverables:** Mobile-friendly experience. Persona dashboard. Full notification center. Task view.

**Verification:**
- Lighthouse mobile score ≥ 70
- Dashboard renders 4 different layouts by role
- `/notifications` shows grouped, filterable history
- `/tasks` shows all pending actions for logged-in user

---

### SPRINT 8 (Week 15–16): Command Palette + AI Surfaces + Notification Push

**Theme:** Power-user productivity and AI integration

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 8.1 | Command palette (Cmd-K): jump to ticket ref, person, account, application | §5.2, #16 | L | New `CommandPalette.tsx`, search index |
| 8.2 | AI triage: auto-suggest category + priority + assignee in CreateRequest | §10 | M | New `AiSuggestPanel.tsx` + backend |
| 8.3 | KB deflection: inline KB suggestion during CreateRequest ("Before submitting — articles related to your query…") | §4.10 #3, §10 | M | New `KbSuggestion.tsx` in CreateRequest |
| 8.4 | AI transparency: show "AI unavailable" badge when AI fails; never echo config | §4.3 #4/#9 | S | `AiInsightCard.tsx` error state |
| 8.5 | PWA manifest + service worker + web push (FCM) | §4.7 #7 | L | New `service-worker.ts`, manifest |
| 8.6 | First-response draft suggestion in RequestDetail | §10 | M | New `AiReplySuggest.tsx` |

**Sprint 8 deliverables:** Cmd-K palette. AI triage + KB deflection. PWA foundation.

**Verification:**
- `Cmd-K` opens search across all entities
- Creating a request shows KB suggestions
- PWA installable on mobile browser
- AI errors show badge, never config values

---

### SPRINT 9 (Week 17–18): Workflow Visualization + HR Pipeline + Operational KPIs

**Theme:** Making workflows visible; HR operations mature

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 9.1 | Shared `<WorkflowStepper>` primitive driven by backend state machine config | §4.8 #1 | M | New `WorkflowStepper.tsx` in `ui/` |
| 9.2 | Fix LOA statuses in stepper (currently missing) | §4.1 #4 | S | `RequestHeader.tsx` or `WorkflowStepper` |
| 9.3 | Promote Onboarding/Offboarding dashboards to top-level `/onboarding` and `/offboarding` routes | §4.8 #3 | M | New pages + routing |
| 9.4 | Hiring pipeline Kanban at `/hr/hiring-pipeline` | §4.8 #4 | L | New `HiringPipeline.tsx` |
| 9.5 | Workflow KPIs surfaced in Insights Hub (time-to-hire, time-to-onboard, chargeback cycle) | §4.8 #5 | M | Backend aggregation + Insight cards |
| 9.6 | User-facing "My checklist" widget on Dashboard for active joiners | §4.8 #6 | S | New `MyChecklist.tsx` in Dashboard |
| 9.7 | Structured rejection with reason categories + free text (Approval Center) | §4.6 #7 | S | `ApprovalCenter.tsx` modal |

**Sprint 9 deliverables:** Unified workflow stepper. HR pipeline. Operational KPIs in insights.

**Verification:**
- LOA statuses render correctly in stepper
- `/onboarding` route works with HR role guard
- Hiring pipeline shows all open roles in Kanban view
- Dashboard shows "My checklist" for new joiners

---

### SPRINT 10 (Week 19–20): Visual Workflow Editor + Impersonation + Multi-Currency Foundation

**Theme:** Admin tooling and regional readiness

| # | Task | Source | LOE | Files |
|---|------|--------|-----|-------|
| 10.1 | Visual workflow editor for admin (drag-and-drop state machine) | §4.9 #3 | XL | New `WorkflowEditor.tsx` (consider React Flow) |
| 10.2 | Impersonation mode with banner + audit logging | §4.9 #4 | M | Backend + `ImpersonationBanner.tsx` |
| 10.3 | Multi-currency foundation: add `currency` field to CRM opportunities + FX rates table | §4.3 #6 | L | Schema migration + CRM forms |
| 10.4 | Permission-to-user matrix view in Admin | §4.9 #4 | M | New `PermissionMatrix.tsx` |
| 10.5 | Form Builder full-screen overlay instead of nested modal | §4.9 #6 | S | `AdminSettings.tsx` form builder |

**Sprint 10 deliverables:** Visual workflow editor. Impersonation. Multi-currency in CRM. Permission matrix.

**Verification:**
- Admin can drag-connect workflow states
- Impersonation shows persistent banner and logs entries
- CRM opportunities can store currency + display converted amounts

---

## Summary Timeline

```
Sprint 1 (W1-2)   : Close Quick Wins + File Upload Fix
Sprint 2 (W3-4)   : Design System + Left Rail Shell
Sprint 3 (W5-6)   : Unified Inbox + Approval Center + Audit Trail
Sprint 4 (W7-8)   : RequestDetail Cockpit + Insights Hub
Sprint 5 (W9-10)  : DataTable + Saved Views + Keyboard Nav
Sprint 6 (W11-12) : Asset Detail + Lifecycle + CRM Account 360
Sprint 7 (W13-14) : Mobile Bottom-Sheets + Persona Dashboard + Notifications
Sprint 8 (W15-16) : Command Palette + AI Triage + PWA
Sprint 9 (W17-18) : Workflow Stepper + HR Pipeline + Op KPIs
Sprint 10 (W19-20): Workflow Editor + Impersonation + Multi-Currency
```

## Score Trajectory

| After Sprint | Estimated Composite Score |
|---|---|
| Sprint 1 | 5.8 (quick wins + risk fixes) |
| Sprint 2 | 6.2 (design system + shell) |
| Sprint 3 | 6.6 (inbox + approvals + audit) |
| Sprint 4 | 7.0 (cockpit + insights) |
| Sprint 5 | 7.3 (DataTable + efficiency) |
| Sprint 6 | 7.5 (ITAM + CRM maturity) |
| Sprint 7 | 7.8 (mobile + personalization) |
| Sprint 8 | 8.0 (Cmd-K + AI) |
| Sprint 9 | 8.1 (workflow visibility) |
| Sprint 10 | 8.2 (admin + regional) |

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| RequestDetail cockpit rewrite could break existing workflows | Feature-flag behind `workflow_cockpit_v2`; keep old layout as fallback |
| DataTable migration across 5+ pages in one sprint | Prioritize by traffic: MyRequests > Approvals > Assets > Agent > CRM |
| Left rail changes entire app layout | Ship behind feature flag; A/B test with 5% of internal users first |
| AI features depend on backend ML/API readiness | Sprint 8 AI triage can stub with local keyword matching; swap to real API when ready |
| Design system adoption resistance | ESLint rule blocking raw color hex outside `ui/` — enforced in CI |

## Dependencies (Backend)

Each sprint has assumed backend support. Key new endpoints needed:

- Sprint 1: File upload storage (not just filename)
- Sprint 3: `/api/v1/inbox` aggregator, `/api/v1/approvals?scope=`, delegation API, audit trail API
- Sprint 4: `/api/v1/insights` aggregation endpoint
- Sprint 5: Saved views CRUD (`/api/v1/saved-views`)
- Sprint 6: `/api/v1/assets/:id` full detail, assignment history, lifecycle
- Sprint 7: `/api/v1/notifications` full page, `/api/v1/tasks` aggregator
- Sprint 8: `/api/v1/search` global, FCM push config
- Sprint 9: `/api/v1/hr/hiring-pipeline`
- Sprint 10: FX rates table, impersonation audit log

---

*This plan should be reviewed with the team before Sprint 1 kickoff. Adjust sprint boundaries based on backend API availability and team capacity.*