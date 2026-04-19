# Request Detail UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Request Detail page so agents/admins always see their next required action prominently, with proper modal forms replacing all `window.prompt()` dialogs.

**Architecture:** A new `ActionSidebar` component owns the right column — top zone shows a context-aware "Next Action" panel with workflow action buttons, bottom zone shows ticket metadata. Six new modal components replace all `prompt()` calls. A `getWorkflowActions` utility drives conditional rendering so workflow sections only appear when actionable.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, existing `itWorkflowService` / `requestService` axios clients, Prisma/PostgreSQL backend.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/utils/workflowActions.ts` | Create | Maps `(status, role)` → list of action descriptors |
| `frontend/src/components/request-detail/ActionSidebar.tsx` | Create | Two-zone sidebar: Next Action panel + metadata |
| `frontend/src/components/request-detail/WorkflowApproveModal.tsx` | Create | Approve IT request modal |
| `frontend/src/components/request-detail/WorkflowRejectModal.tsx` | Create | Reject IT request modal with required reason |
| `frontend/src/components/request-detail/SubmitForApprovalModal.tsx` | Create | Select manager from list (no UUID prompt) |
| `frontend/src/components/request-detail/ProcurementModal.tsx` | Create | Log vendor/PO/delivery date |
| `frontend/src/components/request-detail/FulfilmentModal.tsx` | Create | Log fulfilment notes + notify checkbox |
| `frontend/src/components/request-detail/AssignAgentModal.tsx` | Create | Pick agent from list with open ticket count |
| `frontend/src/components/request-detail/ActivityFeed.tsx` | Create | Extracted activity section with improved tabs |
| `frontend/pages/RequestDetail.tsx` | Modify | Wire in ActionSidebar, ActivityFeed, remove status badge, remove prompt() calls |

---

## Task 1: `getWorkflowActions` utility

**Files:**
- Create: `frontend/src/utils/workflowActions.ts`

This utility is the single source of truth for "what actions are available right now". Both `ActionSidebar` and `RequestDetail` use it to conditionally render sections.

- [ ] **Step 1: Create the utility**

```typescript
// frontend/src/utils/workflowActions.ts

export type WorkflowActionType =
  | 'SUBMIT_FOR_APPROVAL'
  | 'APPROVE'
  | 'REJECT'
  | 'START_PROCUREMENT'
  | 'MARK_FULFILLED'
  | 'ASSIGN';

export interface WorkflowAction {
  type: WorkflowActionType;
  label: string;
  description: string;
  variant: 'primary' | 'success' | 'danger' | 'warning';
}

/**
 * Returns the list of workflow actions available for a given status + role combo.
 * Returns empty array when no actions are available (section should be hidden).
 */
export function getWorkflowActions(
  status: string,
  userRoles: string[],
  isAssigned: boolean
): WorkflowAction[] {
  const isAdmin = userRoles.includes('ADMIN');
  const isAgent = userRoles.includes('AGENT');
  const canAct = isAdmin || isAgent;

  const actions: WorkflowAction[] = [];

  if (!canAct) return actions;

  // Unassigned — surface assign action for all agent/admin statuses
  if (!isAssigned) {
    actions.push({
      type: 'ASSIGN',
      label: 'Assign Request',
      description: 'Assign this request to an agent before proceeding.',
      variant: 'primary',
    });
  }

  if (isAdmin) {
    if (status === 'SUBMITTED') {
      actions.push({
        type: 'SUBMIT_FOR_APPROVAL',
        label: 'Submit for Manager Approval',
        description: 'Route this IT request to a manager for sign-off.',
        variant: 'primary',
      });
    }
    if (status === 'MANAGER_APPROVED_IT') {
      actions.push({
        type: 'START_PROCUREMENT',
        label: 'Start Procurement',
        description: 'Manager approved. Log vendor details and begin ordering.',
        variant: 'warning',
      });
    }
    if (status === 'PROCUREMENT_IN_PROGRESS' || status === 'MANAGER_APPROVED_IT') {
      actions.push({
        type: 'MARK_FULFILLED',
        label: 'Mark as Fulfilled',
        description: 'Confirm the item has been delivered to the requester.',
        variant: 'success',
      });
    }
  }

  if (status === 'PENDING_MANAGER_APPROVAL_IT') {
    actions.push(
      {
        type: 'APPROVE',
        label: 'Approve',
        description: 'Approve this IT request to proceed to procurement.',
        variant: 'success',
      },
      {
        type: 'REJECT',
        label: 'Reject',
        description: 'Reject this IT request and notify the requester.',
        variant: 'danger',
      }
    );
  }

  return actions;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/workflowActions.ts
git commit -m "feat: add getWorkflowActions utility for conditional workflow rendering"
```

---

## Task 2: `WorkflowApproveModal`

**Files:**
- Create: `frontend/src/components/request-detail/WorkflowApproveModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/WorkflowApproveModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface WorkflowApproveModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const WorkflowApproveModal: React.FC<WorkflowApproveModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.managerDecision(requestId, 'APPROVED', comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-600">check_circle</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Approve Request</h2>
            <p className="text-xs text-gray-500">IT Workflow · Manager Approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Approval Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                placeholder="Add any notes for the requester or procurement team…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Approving…' : '✓ Approve Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkflowApproveModal;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/WorkflowApproveModal.tsx
git commit -m "feat: add WorkflowApproveModal replacing prompt() for IT approval"
```

---

## Task 3: `WorkflowRejectModal`

**Files:**
- Create: `frontend/src/components/request-detail/WorkflowRejectModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/WorkflowRejectModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

const REJECTION_REASONS = [
  'Budget not available',
  'Duplicate request',
  'Not within policy',
  'Other',
];

interface WorkflowRejectModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const WorkflowRejectModal: React.FC<WorkflowRejectModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    const fullComment = notes.trim() ? `${reason}: ${notes.trim()}` : reason;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.managerDecision(requestId, 'REJECTED', fullComment);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-600">cancel</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Reject Request</h2>
            <p className="text-xs text-gray-500">IT Workflow · Manager Approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {REJECTION_REASONS.map(r => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      reason === r ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-red-600"
                    />
                    <span className="text-sm font-semibold text-gray-700">{r}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Additional Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Provide more context for the requester…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-400 resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason || submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Rejecting…' : 'Reject Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkflowRejectModal;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/WorkflowRejectModal.tsx
git commit -m "feat: add WorkflowRejectModal with required reason selection"
```

---

## Task 4: `SubmitForApprovalModal`

**Files:**
- Create: `frontend/src/components/request-detail/SubmitForApprovalModal.tsx`

The existing `/api/v1/users/agents` endpoint returns agents. We need managers/admins — use `/api/v1/users` with search and filter client-side by role since the backend `getAllUsers` doesn't support `role` query param yet. We fetch all users and filter to those with `ADMIN` role in the response.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/SubmitForApprovalModal.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import itWorkflowService from '../../services/it-workflow.service';

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

interface SubmitForApprovalModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const SubmitForApprovalModal: React.FC<SubmitForApprovalModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [filtered, setFiltered] = useState<Manager[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await apiClient.get('/users', { params: { limit: 100 } });
        const all: Manager[] = res.data.data.users.map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          roles: u.roles?.map((r: any) => (typeof r === 'string' ? r : r.name)) ?? [],
        }));
        const adminsAndManagers = all.filter(u =>
          u.roles.some(r => r === 'ADMIN' || r === 'admin')
        );
        setManagers(adminsAndManagers);
        setFiltered(adminsAndManagers);
      } catch {
        setError('Failed to load managers');
      } finally {
        setLoading(false);
      }
    };
    fetchManagers();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      managers.filter(
        m =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    );
  }, [search, managers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.submitForApproval(requestId, selectedId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit for approval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">approval</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Submit for Manager Approval</h2>
            <p className="text-xs text-gray-500">IT Workflow · Select approving manager</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Search Manager
              </label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
              <p className="text-xs text-gray-400 mt-1">Showing Admin users</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Select Manager <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading managers…</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No managers found</p>
                  ) : (
                    filtered.map(m => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedId === m.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="manager"
                          value={m.id}
                          checked={selectedId === m.id}
                          onChange={() => setSelectedId(m.id)}
                          className="accent-[#0052cc]"
                        />
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{m.firstName} {m.lastName}</p>
                            <p className="text-xs text-gray-500">{m.email}</p>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes to Manager <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any context the manager should know…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitForApprovalModal;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/SubmitForApprovalModal.tsx
git commit -m "feat: add SubmitForApprovalModal with manager picker — eliminates UUID prompt bug"
```

---

## Task 5: `ProcurementModal` and `FulfilmentModal`

**Files:**
- Create: `frontend/src/components/request-detail/ProcurementModal.tsx`
- Create: `frontend/src/components/request-detail/FulfilmentModal.tsx`

- [ ] **Step 1: Create ProcurementModal**

```tsx
// frontend/src/components/request-detail/ProcurementModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface ProcurementModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ProcurementModal: React.FC<ProcurementModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [vendor, setVendor] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markProcurement(requestId, {
        vendor: vendor || undefined,
        orderNumber: orderNumber || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start procurement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">shopping_cart</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Start Procurement</h2>
            <p className="text-xs text-gray-500">IT Workflow · Log vendor & order details</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Vendor Name <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                placeholder="e.g. Dell, Logitech, CDW…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Purchase Order / Order Number <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="e.g. PO-2026-04-0042"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Estimated Delivery <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={e => setEstimatedDelivery(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {submitting ? 'Starting…' : 'Start Procurement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProcurementModal;
```

- [ ] **Step 2: Create FulfilmentModal**

```tsx
// frontend/src/components/request-detail/FulfilmentModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface FulfilmentModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const FulfilmentModal: React.FC<FulfilmentModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markFulfilled(requestId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark as fulfilled');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-600">inventory_2</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Mark as Fulfilled</h2>
            <p className="text-xs text-gray-500">IT Workflow · Confirm delivery to requester</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Fulfilment Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Delivered Logitech M720 to desk 3-14. Asset tag logged as IT-0088."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Mark Fulfilled'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FulfilmentModal;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/request-detail/ProcurementModal.tsx frontend/src/components/request-detail/FulfilmentModal.tsx
git commit -m "feat: add ProcurementModal and FulfilmentModal replacing prompt() dialogs"
```

---

## Task 6: `AssignAgentModal`

**Files:**
- Create: `frontend/src/components/request-detail/AssignAgentModal.tsx`

Uses the existing `/api/v1/users/agents` endpoint already used by `AssignToDropdown`.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/AssignAgentModal.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import { requestService } from '../../services/request.service';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AssignAgentModalProps {
  requestId: string;
  currentAssigneeId?: string;
  currentUserId: string;
  currentUserName: string;
  onSuccess: () => void;
  onClose: () => void;
}

const AssignAgentModal: React.FC<AssignAgentModalProps> = ({
  requestId,
  currentAssigneeId,
  currentUserId,
  currentUserName,
  onSuccess,
  onClose,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filtered, setFiltered] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(currentAssigneeId || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await apiClient.get('/users/agents');
        setAgents(res.data.data.agents);
        setFiltered(res.data.data.agents);
      } catch {
        setError('Failed to load agents');
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      agents.filter(
        a =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
      )
    );
  }, [search, agents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await requestService.assignRequest(requestId, selectedId);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign request');
    } finally {
      setSubmitting(false);
    }
  };

  const isSelf = selectedId === currentUserId;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">person_add</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Assign to Agent</h2>
            <p className="text-xs text-gray-500">Select agent or claim for yourself</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Assign to self quick option */}
            <label
              className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                isSelf ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="agent"
                value={currentUserId}
                checked={isSelf}
                onChange={() => setSelectedId(currentUserId)}
                className="accent-[#0052cc]"
              />
              <div className="size-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                Me
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Assign to myself</p>
                <p className="text-xs text-gray-500">{currentUserName}</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Or search for another agent
              </label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type agent name…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
            </div>

            {loading ? (
              <p className="text-xs text-gray-400 py-2">Loading agents…</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filtered
                  .filter(a => a.id !== currentUserId)
                  .map(a => (
                    <label
                      key={a.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedId === a.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="agent"
                        value={a.id}
                        checked={selectedId === a.id}
                        onChange={() => setSelectedId(a.id)}
                        className="accent-[#0052cc]"
                      />
                      <div className="size-7 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {a.firstName[0]}{a.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{a.firstName} {a.lastName}</p>
                        <p className="text-xs text-gray-500">{a.email}</p>
                      </div>
                    </label>
                  ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignAgentModal;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/AssignAgentModal.tsx
git commit -m "feat: add AssignAgentModal with self-assign shortcut"
```

---

## Task 7: `ActionSidebar`

**Files:**
- Create: `frontend/src/components/request-detail/ActionSidebar.tsx`

This is the new right-column component. It consumes `getWorkflowActions` and renders the two-zone layout.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/ActionSidebar.tsx
import React, { useState } from 'react';
import { getWorkflowActions } from '../../utils/workflowActions';
import WorkflowApproveModal from './WorkflowApproveModal';
import WorkflowRejectModal from './WorkflowRejectModal';
import SubmitForApprovalModal from './SubmitForApprovalModal';
import ProcurementModal from './ProcurementModal';
import FulfilmentModal from './FulfilmentModal';
import AssignAgentModal from './AssignAgentModal';
import SLAIndicator from './SLAIndicator';

type ModalType = 'APPROVE' | 'REJECT' | 'SUBMIT_FOR_APPROVAL' | 'PROCUREMENT' | 'FULFILMENT' | 'ASSIGN' | null;

interface ActionSidebarProps {
  requestId: string;
  status: string;
  userRoles: string[];
  userId: string;
  userName: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  referenceNumber: string;
  priority: string;
  serviceDeskName: string;
  requesterName: string;
  createdAt: string;
  slaDueAt?: string | null;
  onActionSuccess: () => void;
}

const PRIORITY_COLOURS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const ActionSidebar: React.FC<ActionSidebarProps> = ({
  requestId,
  status,
  userRoles,
  userId,
  userName,
  assignedTo,
  referenceNumber,
  priority,
  serviceDeskName,
  requesterName,
  createdAt,
  slaDueAt,
  onActionSuccess,
}) => {
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const isAssigned = !!assignedTo;
  const actions = getWorkflowActions(status, userRoles, isAssigned);

  const handleSuccess = () => {
    setOpenModal(null);
    onActionSuccess();
  };

  const handleActionClick = (type: string) => {
    switch (type) {
      case 'APPROVE': setOpenModal('APPROVE'); break;
      case 'REJECT': setOpenModal('REJECT'); break;
      case 'SUBMIT_FOR_APPROVAL': setOpenModal('SUBMIT_FOR_APPROVAL'); break;
      case 'START_PROCUREMENT': setOpenModal('PROCUREMENT'); break;
      case 'MARK_FULFILLED': setOpenModal('FULFILMENT'); break;
      case 'ASSIGN': setOpenModal('ASSIGN'); break;
    }
  };

  const buttonClass = (variant: string) => {
    const base = 'w-full px-4 py-2.5 text-sm font-bold rounded-lg transition-colors';
    if (variant === 'success') return `${base} bg-green-600 text-white hover:bg-green-700`;
    if (variant === 'danger')  return `${base} bg-red-600 text-white hover:bg-red-700`;
    if (variant === 'warning') return `${base} bg-amber-600 text-white hover:bg-amber-700`;
    return `${base} bg-[#0052cc] text-white hover:bg-blue-700`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <aside className="w-80 shrink-0 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm self-start sticky top-6">

      {/* Zone 1 — Next Action Panel */}
      {actions.length > 0 && (
        <div className="p-4 border-b-2 border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-amber-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Next Action Required</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            {actions.map(action => (
              <div key={action.type}>
                <p className="text-xs font-bold text-[#1e40af] mb-0.5">{action.label}</p>
                <p className="text-xs text-blue-600 mb-2 leading-relaxed">{action.description}</p>
                <button
                  onClick={() => handleActionClick(action.type)}
                  className={buttonClass(action.variant)}
                >
                  {action.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone 2 — Assign block */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold ${assignedTo ? 'bg-[#0052cc] text-white' : 'bg-amber-100 text-amber-700'}`}>
              {assignedTo ? `${assignedTo.firstName[0]}${assignedTo.lastName[0]}` : '!'}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Assigned To</p>
              <p className={`text-sm font-bold ${assignedTo ? 'text-gray-900' : 'text-amber-600'}`}>
                {assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : '⚠ Unassigned'}
              </p>
            </div>
          </div>
          {(userRoles.includes('ADMIN') || userRoles.includes('AGENT')) && (
            <button
              onClick={() => setOpenModal('ASSIGN')}
              className="text-xs font-bold text-[#0052cc] px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {assignedTo ? 'Reassign' : 'Assign ›'}
            </button>
          )}
        </div>
      </div>

      {/* SLA */}
      {slaDueAt && (
        <div className="px-4 py-3 border-b border-gray-100">
          <SLAIndicator slaDueAt={slaDueAt} status={status} />
        </div>
      )}

      {/* Metadata */}
      <div className="p-4 space-y-2.5">
        {[
          { label: 'Reference', value: referenceNumber, className: 'text-[#0052cc] font-extrabold' },
          { label: 'Service Desk', value: serviceDeskName },
          { label: 'Requester', value: requesterName },
          { label: 'Created', value: formatDate(createdAt) },
        ].map(({ label, value, className }) => (
          <div key={label} className="flex justify-between items-start gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0">{label}</span>
            <span className={`text-xs font-semibold text-gray-900 text-right ${className || ''}`}>{value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Priority</span>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${PRIORITY_COLOURS[priority] || PRIORITY_COLOURS.MEDIUM}`}>
            {priority}
          </span>
        </div>
      </div>

      {/* Modals */}
      {openModal === 'APPROVE'            && <WorkflowApproveModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'REJECT'             && <WorkflowRejectModal  requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'SUBMIT_FOR_APPROVAL'&& <SubmitForApprovalModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'PROCUREMENT'        && <ProcurementModal     requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'FULFILMENT'         && <FulfilmentModal      requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'ASSIGN'             && (
        <AssignAgentModal
          requestId={requestId}
          currentAssigneeId={assignedTo?.id}
          currentUserId={userId}
          currentUserName={userName}
          onSuccess={handleSuccess}
          onClose={() => setOpenModal(null)}
        />
      )}
    </aside>
  );
};

export default ActionSidebar;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/ActionSidebar.tsx
git commit -m "feat: add ActionSidebar with two-zone layout and modal orchestration"
```

---

## Task 8: `ActivityFeed`

**Files:**
- Create: `frontend/src/components/request-detail/ActivityFeed.tsx`

Extracts the activity section from `RequestDetail.tsx` with improved tab styles and internal note toggle.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/ActivityFeed.tsx
import React, { useState } from 'react';

interface Activity {
  id: string;
  activityType: string;
  message: string;
  authorName: string;
  authorRole: string | null;
  isSystemGenerated: boolean;
  isInternal: boolean;
  createdAt: string;
}

type TabType = 'all' | 'comments' | 'system' | 'internal';

interface ActivityFeedProps {
  activities: Activity[];
  onSubmitComment: (text: string, isInternal: boolean) => Promise<void>;
  canPostInternal: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, onSubmitComment, canPostInternal }) => {
  const [tab, setTab] = useState<TabType>('all');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const commentCount  = activities.filter(a => !a.isSystemGenerated && !a.isInternal).length;
  const internalCount = activities.filter(a => a.isInternal).length;

  const filtered = activities.filter(a => {
    if (tab === 'comments') return !a.isSystemGenerated && !a.isInternal;
    if (tab === 'system')   return a.isSystemGenerated;
    if (tab === 'internal') return a.isInternal;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      setSubmitting(true);
      await onSubmitComment(comment, isInternal);
      setComment('');
      setIsInternal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  const initials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const TAB_COLOURS: Record<string, string> = {
    a: '#6366f1', b: '#0052cc', c: '#6b7280', d: '#d97706',
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'all',      label: 'All' },
    { id: 'comments', label: 'Comments', count: commentCount },
    { id: 'system',   label: 'Activity Log' },
    { id: 'internal', label: 'Internal', count: internalCount },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-3 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'text-[#0052cc] bg-blue-50 border-b-2 border-[#0052cc]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-white ${
                t.id === 'internal' ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity list */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No activity yet</p>
        ) : (
          filtered.map(a => (
            <div key={a.id} className="flex gap-3">
              <div className={`size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${
                a.isSystemGenerated ? 'bg-gray-300 text-gray-600' :
                a.isInternal ? 'bg-amber-500' : 'bg-indigo-500'
              }`}>
                {a.isSystemGenerated ? '⚙' : initials(a.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-400 mb-1">
                  <span className="font-bold text-gray-600">{a.authorName}</span>
                  {a.isInternal && <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">INTERNAL</span>}
                  <span className="ml-1.5">{formatTime(a.createdAt)}</span>
                </div>
                <p className={`text-sm text-gray-700 leading-relaxed ${
                  a.isInternal ? 'bg-amber-50 border-l-2 border-amber-400 pl-3 py-1 rounded-r italic' : ''
                }`}>
                  {a.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply box */}
      <div className="p-4 border-t border-gray-100">
        {isInternal && (
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-700">
            <span>🔒</span>
            <span>Internal — not visible to requester</span>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={isInternal ? 'Leave an internal note for the team…' : 'Reply to requester…'}
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none resize-none transition-colors ${
              isInternal ? 'border-amber-300 focus:border-amber-500 bg-amber-50' : 'border-gray-200 focus:border-[#0052cc]'
            }`}
          />
          <div className="flex items-center justify-between mt-2">
            {canPostInternal ? (
              <button
                type="button"
                onClick={() => setIsInternal(!isInternal)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  isInternal ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <span className={`w-8 h-4 rounded-full relative transition-colors ${isInternal ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isInternal ? 'left-4' : 'left-0.5'}`} />
                </span>
                Internal note
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityFeed;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/ActivityFeed.tsx
git commit -m "feat: add ActivityFeed component with improved tabs and internal note toggle"
```

---

## Task 9: Wire up `RequestDetail.tsx`

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

This is the integration task. We replace the old sidebar, inline workflow action buttons, and inline activity section with the new components.

- [ ] **Step 1: Add new imports at the top of `RequestDetail.tsx`**

Replace the existing import block (lines 1–27). Add these alongside existing imports:

```tsx
import ActionSidebar from '../src/components/request-detail/ActionSidebar';
import ActivityFeed from '../src/components/request-detail/ActivityFeed';
```

- [ ] **Step 2: Remove the old sidebar JSX**

In `RequestDetail.tsx`, find the right sidebar column. It currently contains the "Request Details" card with Reference Number, Status badge, Assigned To, Priority, Service Desk, Requester, Created, Last Updated. Delete that entire block and replace it with:

```tsx
<ActionSidebar
  requestId={request.id}
  status={request.status}
  userRoles={user?.roles || []}
  userId={user?.id || ''}
  userName={user ? `${user.firstName} ${user.lastName}` : ''}
  assignedTo={request.assignedTo || null}
  referenceNumber={request.referenceNumber}
  priority={request.priority}
  serviceDeskName={request.serviceDesk?.name || ''}
  requesterName={request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : ''}
  createdAt={request.createdAt}
  slaDueAt={request.slaDueAt}
  onActionSuccess={fetchRequestData}
/>
```

- [ ] **Step 3: Remove the IT Workflow `<section>` block with prompt() buttons**

Find and delete the entire section (roughly lines 1226–1320 in the current file) that looks like:

```tsx
{/* IT Workflow Actions */}
{request.serviceDesk?.code === 'IT' && (
  <section className="space-y-4">
    ...all the prompt() buttons...
  </section>
)}
```

The `ActionSidebar` now owns these actions via `getWorkflowActions`.

- [ ] **Step 4: Replace the inline activity section with `ActivityFeed`**

Find the section with the tab bar (`All / Comments / Activity Log / Internal`), the activity list, and the comment textarea. Delete it and replace with:

```tsx
<ActivityFeed
  activities={activities}
  onSubmitComment={async (text, isInternal) => {
    const newActivity = await requestService.addActivity(id!, text, isInternal);
    setActivities(prev => [...prev, newActivity]);
  }}
  canPostInternal={!!(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN'))}
/>
```

- [ ] **Step 5: Remove the `isInternalNote`, `comment`, `submitting` useState declarations** that are now owned by `ActivityFeed`:

```tsx
// Delete these three lines:
const [comment, setComment] = useState('');
const [submitting, setSubmitting] = useState(false);
const [isInternalNote, setIsInternalNote] = useState(false);
```

Also delete `activityFilter` state and `handleSubmitComment` function — both now live in `ActivityFeed`.

- [ ] **Step 6: Remove the `assigning` state and `handleAssignToSelf` function** — assignment is now handled by `AssignAgentModal` inside `ActionSidebar`.

```tsx
// Delete:
const [assigning, setAssigning] = useState(false);
// Delete handleAssignToSelf function
```

- [ ] **Step 7: Build and check for TypeScript errors**

```bash
cd frontend && npm run build 2>&1 | head -60
```

Fix any type errors (likely `user.firstName`/`user.lastName` not on auth user type — check `AuthContext` for the user shape and adjust props accordingly).

- [ ] **Step 8: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: integrate ActionSidebar and ActivityFeed into RequestDetail — removes all prompt() dialogs"
```

---

## Task 10: Manual smoke test

- [ ] **Step 1: Start dev servers**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Test as Admin — IT ticket at SUBMITTED status**

1. Log in as `admin@helpdesk.com` / `admin123`
2. Create a new IT Support ticket
3. Navigate to the ticket detail page
4. Verify: sidebar shows "Next Action Required" with amber pulsing dot
5. Verify: "Submit for Manager Approval" button opens the manager picker modal (not a browser prompt)
6. Select a manager and submit — verify status changes and stepper advances

- [ ] **Step 3: Test approval flow**

1. Ticket should now show `PENDING_MANAGER_APPROVAL_IT`
2. Verify: sidebar shows Approve + Reject buttons
3. Click Approve — verify modal opens with optional comments
4. Submit — verify status updates to `MANAGER_APPROVED_IT`
5. Verify: Approve/Reject buttons disappear, Procurement button appears

- [ ] **Step 4: Test reject flow**

1. Create another IT ticket, submit for approval
2. Click Reject — verify modal opens with reason radio buttons
3. Try to submit without selecting a reason — verify button stays disabled
4. Select a reason and submit — verify ticket is rejected

- [ ] **Step 5: Test assignment**

1. On a ticket with Unassigned status: verify sidebar shows "⚠ Unassigned" warning
2. Click "Assign ›" — verify modal opens with "Assign to myself" pre-highlighted
3. Assign and verify the sidebar updates to show agent name

- [ ] **Step 6: Test activity feed**

1. On any ticket, verify tabs show with correct active state (blue underline + blue bg)
2. Toggle Internal note — verify textarea border turns amber and lock label appears
3. Submit an internal note — verify it appears with INTERNAL badge in amber
4. Switch to Comments tab — verify internal note is hidden

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: verify IT workflow UX overhaul smoke tests pass"
```
