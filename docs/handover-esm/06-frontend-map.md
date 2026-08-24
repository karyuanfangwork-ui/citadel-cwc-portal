# CWC 2.0 ESM — Frontend Map

**Root:** `frontend/` · **Stack:** React 19 + TypeScript + Vite + React Router. All ESM pages eagerly imported, wrapped in `ProtectedRoute`.

---

## 1. Routing (`frontend/App.tsx`, lines 249–337)

ESM core routes (CRM and credit excluded):

| Path | Component | Guard |
|---|---|---|
| `/` | `Dashboard` | ProtectedRoute |
| `/hr` | `HRServices` | ProtectedRoute |
| `/it` | `ITSupport` | ProtectedRoute |
| `/finance` | `GroupFinance` | ProtectedRoute |
| `/esm` | `ExecutiveServices` | ProtectedRoute |
| `/my-requests` | `MyRequests` | ProtectedRoute |
| `/request/:id` | `RequestDetail` (+ ErrorBoundary) | ProtectedRoute |
| `/it/hardware` | `Navigate → /it` | — |
| `/agent` | `AgentDashboard` | ProtectedRoute |
| `/reports` | `Reports` | `report:read` |
| `/insights` | `Insights` | `report:read` |
| `/search` | `SearchResults` | ProtectedRoute |
| `/kb`, `/kb/:slug` | `KnowledgeBase`, `ArticleDetail` | `isFeatureEnabled('kb')` + `kb:manage`, else redirect `/` |
| `/approvals` | `ApprovalCenter` | ProtectedRoute |
| `/inbox` | `UnifiedInbox` | ProtectedRoute |
| `/announcements`, `/:id` | `Announcements`, `AnnouncementDetail` | ProtectedRoute |
| `/admin/announcements` | `AnnouncementsManage` | `announcement:write` |
| `/assets` | `AssetManagement` | `asset:read` |
| `/admin/settings` | `AdminSettings` | `admin:access` |
| `/admin/workflows` | `WorkflowList` | `admin:access` |
| `/admin/workflows/:workflowTypeId/versions/:versionId` | `WorkflowDesigner` | `admin:access` |
| `/admin/audit` | `AuditTrail` | `admin:access` |
| `/:deskType/:deskId/create/:categoryId` | `CreateRequest` | ProtectedRoute |
| `*` | `NotFound` | — |

**Guards** (`src/components/ProtectedRoute.tsx`): checks `isAuthenticated` (→ `/login`), optional `requirePermission` (OR), `requireAllPermissions` (AND), `requireDepartment`, legacy `requireAdmin`.

---

## 2. Pages (`frontend/pages/`)

- **`Dashboard.tsx`** — Personalized home: greeting, per-desk category tiles (IT/HR/Finance), recent announcements, my recent requests. Uses `serviceDeskService`, `requestService`, `announcementService`.
- **`HRServices.tsx` / `ITSupport.tsx` / `GroupFinance.tsx` / `ExecutiveServices.tsx`** — Service-desk landing pages; fetch the desk by code (`HR`/`IT`/`FINANCE`/`ESM`) via `serviceDeskService.getAllServiceDesks()`, render categories as cards → `/hr|it|finance|esm/:deskId/create/:categoryId`.
- **`MyRequests.tsx`** — User's request list with status/desk filters, pagination → `/request/:id`.
- **`CreateRequest.tsx`** — 3-step wizard (see §3).
- **`RequestDetail.tsx`** — 2-pane request cockpit (see §3), uses `useRequestDetail` hook.
- **`AgentDashboard.tsx`** — Support queue for `ADMIN`/`AGENT`: assigned/open/unassigned queues, SLA stats, filters.
- **`ApprovalCenter.tsx`** — Tabbed approval hub (`all`/`itsm`/`credit`); ESM half uses `approvalService`, credit half uses `creditService`.
- **`ApprovalQueue.tsx`** — Pending-approval queue: search, desk/priority filters, bulk approve/reject, pagination.
- **`UnifiedInbox.tsx`** — Consolidated notification inbox (`notificationService`).
- **`Reports.tsx`** — Operational reports (`reportsService`: summary/status/desk/priority/agent-workload/SLA-status).
- **`Insights.tsx`** — Trend/analytics (`insights.service`).
- **`KnowledgeBase.tsx` / `ArticleDetail.tsx`** — Article list + single article (mark helpful/unhelpful).
- **`SearchResults.tsx`** — Global search (`search.service`).
- **`Announcements.tsx` / `AnnouncementDetail.tsx` / `AnnouncementsManage.tsx`** — Browse/view/admin CRUD announcements (`RichTextEditor`).
- **`AssetManagement.tsx`** — Large (1590-line) asset admin: list/filter/search, assign/return, user assignments, CSV/XLSX import (parse → validate → commit) + CSV export.
- **`WorkflowList.tsx`** — Versioned workflow list (search + create-draft dialog).
- **`WorkflowDesigner.tsx`** — Visual graph editor (see §6).
- **`AdminSettings.tsx`** — Tabbed admin console (see §4).
- **`AuditTrail.tsx`** — Audit log browsing.

---

## 3. Request lifecycle UI

**CreateRequest wizard** (`src/components/create-request/`):
- `useCreateRequestWizard.ts` — core state hook. Steps `type → details → review`. Loads categories + request types via `serviceDeskService`; entity options via `entityService.listActiveEntities()`; CEO/Group DCEO via `apiClient.get('/users/executives?role=CEO,GROUP_DCEO')`. Parses the request type's **form schema** (`parseFormConfig(type.formConfig)`), auto-generates summaries per request-type code, computes auto-confidentiality, blocks role-gated types.
- `StepRequestType.tsx`, `StepDetails.tsx` (dynamic form from schema), `StepReview.tsx`, `WizardStepper.tsx`, `RecentServices.tsx`, `useDraftSave.tsx` (localStorage draft autosave).
- Submit calls `requestService.createRequest({...})` after `validateFormValues`; navigates to `/request/{referenceNumber}`.

**FormBuilder** (`src/components/FormBuilder.tsx`) — Admin builder for request-type custom-field schemas: drag-to-reorder (dnd-kit), field types `text|textarea|select|date|number|currency|file|entity|ceo-select`, per-field `required`, **conditional visibility** (`showWhen` rules). Feeds `onSave(fields)` → persists `formConfig`.

**RequestDetail** (`pages/RequestDetail.tsx` + `src/components/request/`, `src/components/request-detail/`):
- `useRequestDetail.ts` hook (750 lines) — all state/handlers: fetch, `updateStatusDirectly`, `handleStatusChange`, resolution/rejection, interviews, HR screening, LOA approve/issue/accept, onboarding/offboarding phase advance + completion, candidate/resume, route-to-CEO/manager/GroupDCEO.
- **Left pane:** `RequestFormFields`, `HiringWorkflowPanel`, `OnboardingDashboard`/`OffboardingDashboard`, `ActivityFeed`, `RequestHeader`.
- **Right pane:** **`WorkflowCockpit`** — `WorkflowStepper`, `SLAIndicator`, `ApprovalChain`, `ApproverPicker`, actions/transitions, attachments, assign agent, PDF export.
- **Transition modals** (`src/components/request-detail/`): `GenericTransitionModal`, `DecisionPanel`, `WorkflowActionModal`, `AssignAgentModal`, `AssignToDropdown`, `ParticipantsSection`, `CustomFieldsPanel`, `BatchUploadModal`, plus desk-specific (`FinDecisionModal`, `CfoDecisionModal`, `CeoDecisionModal`, `RouteToCeoFinModal`, `HardwareOrderedModal`, `HardwareReceivedModal`, `SoftwareProvisionedModal`, `MarkJobPostedModal`, `ProcurementModal`, `PendingInvoiceModal`, `PaymentDoneModal`, `CloseTicketFinModal`, `CompleteDeliveryModal`, `UploadSignedLOAModal`, `UploadLOAModal`, `UpdateScreeningModal`, `UploadResumeModal`).
- `src/components/request/modals/` — `ResolutionModal`, `RejectionModal`, `CompleteOnboardingModal`, `ScheduleInterviewModal`, `EditInterviewModal`, `InterviewFeedbackModal`, `LOAApprovalModal`, `CEODecisionModal`, `ManagerDecisionModal`.
- Attachments via `requestService`; PDF export via `exportPdf` + `pollPdfJob`. SLA shown by `SLAIndicator` (uses `slaDueAt`, `slaPausedAt`, `slaPauseDurationMs`).

---

## 4. Components (`src/components/`)

- **Layout** (`layout/`): `LeftRail.tsx` (grouped sidebar), `TopBar.tsx`, `MobileDrawer.tsx`. `navConfig.ts` — `buildNavLinks(user)` returns groups `primary | service-desks | tools | admin`, permission/role/feature-flag gated (Approvals if `request:approve`/`credit:approve`; Agent for ADMIN/AGENT; KB if `kb` flag + `kb:manage`).
- **Guards/context:** `ProtectedRoute.tsx`, `ErrorBoundary` (`withErrorBoundary.tsx`).
- **Request dashboards:** `OnboardingDashboard.tsx`, `OffboardingDashboard.tsx` (phase/task trackers).
- **Approvals:** `EntityApprovalsPanel.tsx` (entity-scoped approvals; standalone — not imported by a live page).
- **FormBuilder:** `FormBuilder.tsx` + `admin/FormBuilderModal.tsx`.
- **Notifications:** `NotificationDropdown.tsx` (driven by `NotificationContext`).
- **Admin settings:** `admin/adminConstants.ts` — `ADMIN_TABS` grouped `Configuration | Workflows | Appearance`: Service Desks, User Accounts, Permissions, Entities, Email Notifications, Onboarding Tasks, Offboarding Tasks, Runtime Transitions, Request Statuses, SLA Escalation, ESM Settings, Scheduler, Banner & Branding.
- **Workflow designer:** `workflow/` — `WorkflowCanvas`, `StatusNode`, `StatusPalette`, `NodeInspector`, `EdgeInspector`, `ValidationPanel`, `PublishDialog`, `VersionHistoryPanel`, `CreateDraftDialog`, `WorkflowListCard`.
- **UI kit** (`ui/`): `Button`, `Card`, `Modal`, `Drawer`, `Tabs`, `Tooltip`, `Skeleton`, `EmptyState`, `StateBadge`, `RichTextEditor`, `Combobox`, `AutosaveTextField`, `EnvironmentBanner`, `OutOfOfficeModal`, `PolicyExplainer`.

---

## 5. Services & types (`src/services/`)

- **`request.service.ts`** (`requestService`) — `getAllRequests`, `getRequestById`, `getAvailableTransitions`, `createRequest`, `updateRequest`, `deleteRequest`, `getRequestActivities`, `addActivity`, attachment upload/download/delete, `assignRequest`, `updateStatus`, participants, `getRecentServices`, `exportPdf`, `exportXlsx`. Types: `AvailableTransition`, `RequestParticipant`, `CreateRequestData`, `RequestFilters`.
- **`serviceDesk.service.ts`** — read (desks/categories/request-types), admin CRUD, deactivation-impact, agents, **escalation/SLA rules** (`getEscalationRules`, CRUD).
- **`approval.service.ts`** (`approvalService`) — CEO/GroupDCEO/manager decisions, `markJobPosted`, resumes/candidates, `getPendingApprovals`, `bulkAction`, `getPolicyExplanation`.
- **`workflow.service.ts`** (`workflowService`) — legacy linear WorkflowType/Step CRUD.
- **`workflow-version.service.ts`** (`workflowVersionService`) — **versioned graph API**: `listWorkflows`, `listVersions`, `createDraft`, `getVersion`, `updateNodes`/`updateEdges` (batch PATCH), `replaceGraph`, `validateVersion`, `publishVersion(statusRemap)`, `rollbackVersion`, `discardDraft`. Types: `WorkflowGraph`, `GraphNode`, `GraphEdge`, `ValidationResult`/`ValidationFinding`, `RemapPlan`/`RemapEntry`, `PublishResult`.
- **`asset.service.ts`** — `listAssets`, `getAsset`, `createAsset`, `updateAsset`, `deleteAsset`, `assignAsset`, `returnAsset`, `listActiveAssignments`, `getAssetsByUser`, `importAssets` (+ parse/commit), `exportAssetsCsv`.
- **`kb.service.ts`** — `getArticles`, `getArticleBySlug`, `markHelpful`.
- **`notification.service.ts`** — `getNotifications`, `getUnreadCount`, `replayAfter`, `markAsRead`, `markAllAsRead`, `deleteNotification`.
- **`reports.service.ts`** — `getSummary`, `getByStatus`, `getByServiceDesk`, `getByPriority`, `getAgentWorkload`, `getSlaStatus`.
- **`systemSetting.service.ts`** — `getEsmDceoThreshold` / `setEsmDceoThreshold` (Group DCEO travel threshold, default 50000).
- **`admin.service.ts`** — users, roles/permissions, `listWorkflowTransitions` CRUD, notification templates, email toggle, onboarding IT agent.
- **Other:** `announcement.service`, `search.service`, `insights.service`, `auditLog.service`, `interview.service`, `screening.service`, `loa.service`, `finance-workflow.service`, `it-workflow.service`, `esm-workflow.service`, `requestStatusService`.

---

## 6. Workflow Designer UI

**Graph-based editor** (`pages/WorkflowDesigner.tsx` + `src/components/workflow/` + `src/hooks/useWorkflowGraph.ts`).

- Route: `/admin/workflows/:workflowTypeId/versions/:versionId` (guard `admin:access`). Read-only when version ≠ `DRAFT`.
- **Canvas** (`WorkflowCanvas.tsx`): built on `@xyflow/react` (React Flow). Nodes are `StatusNode`; edges are `workflow` type.
- **Authoring:** `StatusPalette` adds nodes from the governed status catalog; `NodeInspector` edits statusCode/label/icon/`isInitial`/`isFinal`/`slaPause`/displayOrder; `EdgeInspector` edits transition label/`requiresComment`/`autoAssignRole`/`autoAssignUserId`/`allowedRoles`/`allowedExecutiveRoles`.
- **State & saving** (`useWorkflowGraph.ts`): React Flow state + dirty flag + **500 ms debounced autosave** via `workflowVersionService.replaceGraph(versionId, graph)`, then re-runs `validateVersion`. Converts between React Flow and domain `WorkflowGraph` via `utils/workflowLayout.ts`.
- **Validation:** `ValidationPanel` surfaces `blocking` and `warnings` from `validateVersion`; blocking (except `STATUS_IN_USE_REMOVED`) disable Publish.
- **Publish** (`PublishDialog.tsx`): if removed statuses still hold live requests, step 1 collects a **status remap** from `RemapPlan`; step 2 confirms warnings + request count, then `publishVersion(versionId, statusRemap)`.
- **Versioning:** `VersionHistoryPanel` lists DRAFT/ACTIVE/ARCHIVED; supports open-version, **rollback** (from ARCHIVED), **discard draft**. `WorkflowList.tsx` lists workflows with badges + `CreateDraftDialog`.

---

## 7. Notes

- **i18n:** ESM pages are hard-coded English (only `pages/Dashboard.tsx` uses `useTranslation` from the global i18n config).
- **Sentry:** only at app level via global `ErrorBoundary`; no ESM page calls Sentry directly.
- **`ApprovalCenter` / `MyApprovals` / `Dashboard` mix in credit/CRM UI**; this doc covers their ESM-relevant parts.
