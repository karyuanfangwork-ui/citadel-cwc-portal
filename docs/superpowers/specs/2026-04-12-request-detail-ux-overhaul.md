# Request Detail Page — UX Overhaul Spec

**Date:** 2026-04-12  
**Scope:** `frontend/pages/RequestDetail.tsx` and related components  
**Audience:** Agent / Admin users who handle tickets daily  
**Approach:** Option A — Action-First Sidebar  

---

## Background

A UX audit of the Request Detail page identified 8 issues grouped by severity. All 8 are addressed by this redesign. The primary audience is agents and admins who need to understand and act on tickets efficiently — not end users browsing their own submissions.

---

## Audit Summary

| # | Issue | Severity |
|---|---|---|
| 1 | Workflow actions use `prompt()` dialogs — no validation, breaks UX, caused UUID crash | Critical |
| 2 | No clear "next action" CTA — action buttons scattered below the fold | Critical |
| 3 | Sidebar wastes prime real estate on read-only metadata | High |
| 4 | Status badge and stepper duplicate each other inconsistently | High |
| 5 | IT/Finance workflow sections render even when no action is pending | High |
| 6 | Assignment not surfaced prominently for unassigned tickets | Medium |
| 7 | Activity tab contrast too low; no unread count indicators | Medium |
| 8 | Comment box lacks internal note distinction | Medium |

---

## Design Decisions

### 1. Action-First Sidebar (two zones)

The right sidebar is restructured into two vertical zones:

**Zone 1 — Next Action Panel (top, sticky)**
- Renders only when there is a pending action for the current user's role
- Contains a titled action card describing what needs to happen and why
- Contains the primary action button(s) (e.g. Approve / Reject, or Assign, or Start Procurement)
- Has an amber pulsing dot indicator in the label when action is required
- When no action is pending, this zone is hidden entirely (not an empty box)

**Zone 2 — Ticket Metadata (below action panel)**
- Assign block: agent avatar + name (or "⚠ Unassigned" warning) + "Assign ›" button
- SLA indicator: coloured dot (green/amber/red) + time remaining
- Reference number, priority badge, service desk, requester, created date
- Status badge is **removed** — the stepper is the single source of truth for progress

### 2. Stepper as Single Status Truth

- The stepper at the top of the page remains the canonical status indicator
- The "Status" field is removed from the sidebar metadata block
- Stepper steps show date stamps on completed steps
- For IT/Finance workflows, the stepper reflects the workflow-specific steps (Submitted → Pending Approval → Procurement → Fulfilled → Resolved)

### 3. Replace All `prompt()` Dialogs with Modal Forms

Six workflow actions currently use `window.prompt()`. Each is replaced with a dedicated modal component:

#### `WorkflowApproveModal`
- Props: `requestId`, `onSuccess`
- Fields: optional approval comments (textarea)
- Submit button: "✓ Approve Request" (green)
- On submit: calls `itWorkflowService.managerDecision(id, 'APPROVED', comments)`

#### `WorkflowRejectModal`
- Props: `requestId`, `onSuccess`
- Fields: rejection reason (required radio: Budget / Duplicate / Not within policy / Other), optional notes textarea
- Submit button: "Reject Request" (red)
- Validation: rejection reason required before submit enabled
- On submit: calls `itWorkflowService.managerDecision(id, 'REJECTED', reason + notes)`

#### `SubmitForApprovalModal`
- Props: `requestId`, `onSuccess`
- Fields: manager search input (text filter), manager user picker (list of users with Manager/Admin role fetched from `/api/v1/users?role=MANAGER`), optional notes textarea
- Submit button: "Submit for Approval" (blue)
- Validation: manager selection required
- On submit: calls `itWorkflowService.submitForApproval(requestId, selectedManagerId, notes)`
- **Eliminates the UUID copy-paste bug entirely**

#### `ProcurementModal`
- Props: `requestId`, `onSuccess`
- Fields: vendor name (optional text), PO/order number (optional text), estimated delivery date (optional date picker)
- Submit button: "🛒 Start Procurement" (amber)
- On submit: calls `itWorkflowService.markProcurement(requestId, { vendor, orderNumber })`

#### `FulfilmentModal`
- Props: `requestId`, `onSuccess`
- Fields: fulfilment notes (optional textarea), notify requester checkbox (default: checked)
- Submit button: "📦 Mark Fulfilled" (green)
- On submit: calls `itWorkflowService.markFulfilled(requestId, notes)`

#### `AssignAgentModal`  
- Props: `requestId`, `currentAssigneeId`, `onSuccess`
- Fields: "Assign to myself" quick option (pre-highlighted), agent search input, agent list with open ticket count
- Agents fetched from `/api/v1/users?role=AGENT`
- Submit button: "Assign" (blue)
- On submit: calls `requestService.assignRequest(requestId, agentId)`

### 4. Workflow Sections Collapse When Idle

The IT Workflow and Finance Workflow `<section>` blocks currently render a header even when no action is pending. New behaviour:

- Section renders **only** when `getWorkflowActions(status, userRole)` returns at least one action
- Helper function `getWorkflowActions` maps `(status, role)` → action buttons to render
- When no actions available, section is hidden entirely — no empty header

### 5. Activity Feed Improvements

**Tab bar:**
- Active tab uses a stronger visual: `border-bottom: 2px solid #0052cc` + `background: #eff4ff`
- Comments tab shows unread count badge (red) when there are new comments since last visit
- Internal tab shows unread count badge (amber) when there are new internal notes
- "System" filter renamed to "Activity Log" for clarity

**Internal Note toggle:**
- Replaced with a visually distinct amber pill toggle labelled "Internal note"
- When toggled ON: toggle pill turns amber, textarea border turns amber, a "🔒 Internal — not visible to requester" label appears above the textarea
- When toggled OFF: normal blue border, no label

---

## Component Changes

| File | Change |
|---|---|
| `frontend/pages/RequestDetail.tsx` | Major restructure: sidebar zones, remove status badge, collapse workflow sections, wire up modal triggers |
| `frontend/src/components/request-detail/ActionSidebar.tsx` | **New component** — renders Next Action Panel + metadata zones |
| `frontend/src/components/request-detail/WorkflowApproveModal.tsx` | **New component** |
| `frontend/src/components/request-detail/WorkflowRejectModal.tsx` | **New component** |
| `frontend/src/components/request-detail/SubmitForApprovalModal.tsx` | **New component** — replaces UUID prompt |
| `frontend/src/components/request-detail/ProcurementModal.tsx` | **New component** |
| `frontend/src/components/request-detail/FulfilmentModal.tsx` | **New component** |
| `frontend/src/components/request-detail/AssignAgentModal.tsx` | **New component** — replaces/extends AssignToDropdown |
| `frontend/src/components/request-detail/ActivityFeed.tsx` | **New component** — extracts activity section from RequestDetail |
| `frontend/src/utils/workflowActions.ts` | **New utility** — `getWorkflowActions(status, role)` |
| `backend/src/controllers/it-workflow.controller.ts` | UUID validation guard already added (done) |

---

## API Requirements

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /api/v1/users?role=MANAGER` | Fetch manager list for SubmitForApprovalModal | Needs verification / may need query param support |
| `GET /api/v1/users?role=AGENT` | Fetch agent list for AssignAgentModal with open ticket count | Needs verification |
| `POST /api/v1/it-workflow/requests/:id/fulfill` | Accept optional `notifyRequester: boolean` flag | Backend needs this param wired up |

User list endpoints should return `{ id, firstName, lastName, email, role, openTicketCount }`.  
The `openTicketCount` field may require a join — verify against `user.controller.ts` and add if missing.

---

## Behaviour by Role

| Role | Next Action Panel shows |
|---|---|
| Admin | All workflow actions for current status |
| Agent | Assignment, comment, status updates only |
| End User | Nothing — sidebar shows metadata only |

---

## Out of Scope

- Finance workflow modals (same pattern as IT — follow-up spec)
- HR hiring workflow modals (already has proper modal forms)
- Mobile / responsive layout changes
- Notification preferences
