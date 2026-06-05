# Purchase Requisition Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Purchase Requisition approval workflow: Finance Agent acknowledges → enters finalized amount → CEO approval → CFO approval → conditional Group CEO approval (>MYR 15,000) → payment processing → ticket closure.

**Architecture:** New statuses are added to the `RequestStatus` Prisma enum. The existing stub finance-workflow controller is replaced with 7 targeted endpoints. The frontend wires new modals into ActionSidebar following the identical pattern used by IT and HR workflows.

**Tech Stack:** Prisma + PostgreSQL, Express/TypeScript backend, React 19 + TypeScript frontend, Vite, Tailwind CSS.

---

## File Map

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Add 12 new `RequestStatus` values |
| `backend/prisma/seed.ts` | Add GROUP_DCEO user after CFO user block |
| `backend/src/controllers/finance-workflow.controller.ts` | Replace entirely with 7 new endpoints |
| `backend/src/routes/finance-workflow.routes.ts` | Replace routes to match new endpoints |
| `frontend/src/services/finance-workflow.service.ts` | Replace with 7 new service methods |
| `frontend/src/utils/workflowActions.ts` | Add 11 new action types + getWorkflowActions entries |
| `frontend/src/components/request-detail/FinAcknowledgeModal.tsx` | Create |
| `frontend/src/components/request-detail/RouteToCeoFinModal.tsx` | Create — finalized amount input |
| `frontend/src/components/request-detail/FinDecisionModal.tsx` | Create — shared approve/reject modal |
| `frontend/src/components/request-detail/MarkPaymentCompleteFinModal.tsx` | Create |
| `frontend/src/components/request-detail/CloseTicketFinModal.tsx` | Create |
| `frontend/src/components/request-detail/ActionSidebar.tsx` | Add lazy imports, ModalType values, handleActionClick cases, modal renders |
| `frontend/src/components/request/RequestHeader.tsx` | Replace FINANCE stepper block for PURCHASE_REQUISITION |
| `frontend/src/components/request-detail/CustomFieldsPanel.tsx` | Add `finalizedAmount` to FINANCE_FIELD_LABELS |

---

## Task 1: Add new RequestStatus enum values

**Files:**
- Modify: `backend/prisma/schema.prisma` (Finance Workflow section, after line 346)

- [ ] **Step 1: Add 12 new statuses to schema.prisma**

Find the `// Finance Workflow` comment block (currently ends at `REIMBURSEMENT_CLOSED`). Replace that entire block with:

```prisma
  // Finance Workflow
  PENDING_MANAGER_APPROVAL_FIN
  MANAGER_APPROVED_FIN
  MANAGER_REJECTED_FIN
  PENDING_FINANCE_HEAD_APPROVAL
  FINANCE_HEAD_APPROVED
  FINANCE_HEAD_REJECTED
  PAYMENT_PROCESSING
  PAYMENT_COMPLETED
  REIMBURSEMENT_CLOSED
  // Finance Purchase Requisition
  ACKNOWLEDGED_FIN
  PENDING_CEO_APPROVAL_FIN
  CEO_APPROVED_FIN
  CEO_REJECTED_FIN
  PENDING_CFO_APPROVAL_FIN
  CFO_APPROVED_FIN
  CFO_REJECTED_FIN
  PENDING_GROUP_DCEO_APPROVAL_FIN
  GROUP_DCEO_APPROVED_FIN
  GROUP_DCEO_REJECTED_FIN
  PAYMENT_PROCESSING_FIN
  PAYMENT_COMPLETED_FIN
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd backend
npx prisma migrate dev --name add_purchase_requisition_statuses
```

Expected: Migration created and applied successfully. Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client includes new statuses**

```bash
grep -c "ACKNOWLEDGED_FIN\|PENDING_CEO_APPROVAL_FIN\|PENDING_GROUP_DCEO_APPROVAL_FIN" node_modules/.prisma/client/index.d.ts
```

Expected: `3`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add Purchase Requisition workflow statuses to RequestStatus enum"
```

---

## Task 2: Add GROUP_DCEO seed user

**Files:**
- Modify: `backend/prisma/seed.ts` (after the CFO user block, around line 219)

- [ ] **Step 1: Add GROUP_DCEO user after the CFO block**

After line `console.log('✅ CFO user created ...')`, insert:

```typescript
    const groupDceoRole = await prisma.role.findUniqueOrThrow({ where: { name: 'GROUP_DCEO' } });
    const groupDceoUser = await prisma.user.upsert({
        where: { email: 'groupceo@company.com' },
        update: {},
        create: {
            email: 'groupceo@company.com',
            passwordHash: await bcrypt.hash('groupceo123', 10),
            firstName: 'Group',
            lastName: 'CEO',
            department: 'Executive',
            jobTitle: 'Group Chief Executive Officer',
            isActive: true,
        },
    });
    await assignRoles(groupDceoUser.id, [groupDceoRole.id]);
    console.log('✅ Group CEO user created (email: groupceo@company.com, password: groupceo123)');
```

- [ ] **Step 2: Run seed**

```bash
cd backend
npm run prisma:seed
```

Expected output includes: `✅ Group CEO user created (email: groupceo@company.com, password: groupceo123)`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(db): seed GROUP_DCEO user for Purchase Requisition workflow"
```

---

## Task 3: Replace backend finance-workflow controller

**Files:**
- Modify: `backend/src/controllers/finance-workflow.controller.ts` (full replacement)

- [ ] **Step 1: Replace the entire controller file**

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notify } from '../services/notification.service';

const prisma = new PrismaClient();

const THRESHOLD_MYR = 15000;

async function getFinanceRequest(id: string, res: Response) {
    const request = await prisma.request.findUnique({
        where: { id },
        include: { serviceDesk: true },
    });
    if (!request) {
        res.status(404).json({ status: 'error', message: 'Request not found' });
        return null;
    }
    return request;
}

async function logActivity(requestId: string, activityType: string, message: string, authorId?: string) {
    await prisma.requestActivity.create({
        data: {
            requestId,
            authorId: authorId || null,
            authorName: 'System',
            activityType,
            message,
            isSystemGenerated: true,
        },
    });
}

/** POST /finance-workflow/requests/:id/acknowledge */
export const acknowledge = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const request = await getFinanceRequest(id, res);
        if (!request) return;

        const updated = await prisma.request.update({
            where: { id },
            data: { status: 'ACKNOWLEDGED_FIN' },
        });

        await logActivity(id, 'SYSTEM', `Finance agent acknowledged request${notes ? ': ' + notes : ''}`);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ACKNOWLEDGED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('acknowledge error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to acknowledge request' });
    }
};

/** POST /finance-workflow/requests/:id/set-finalized-amount-and-route-ceo */
export const setFinalizedAmountAndRouteCeo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { finalizedAmount, notes } = req.body;

        if (finalizedAmount === undefined || isNaN(Number(finalizedAmount)) || Number(finalizedAmount) <= 0) {
            return res.status(400).json({ status: 'error', message: 'finalizedAmount must be a positive number' });
        }

        const request = await getFinanceRequest(id, res);
        if (!request) return;

        const existingFields = (request.customFields as Record<string, unknown>) || {};
        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: 'PENDING_CEO_APPROVAL_FIN',
                customFields: { ...existingFields, finalizedAmount: Number(finalizedAmount) },
            },
        });

        await logActivity(id, 'SYSTEM', `Finalized amount set to MYR ${finalizedAmount}. Routed to CEO for approval${notes ? ': ' + notes : ''}`);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CEO', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('setFinalizedAmountAndRouteCeo error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to route to CEO' });
    }
};

/** POST /finance-workflow/requests/:id/ceo-decision */
export const ceoDecision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
        }

        const request = await getFinanceRequest(id, res);
        if (!request) return;

        // On approval, auto-route to CFO
        const newStatus = decision === 'APPROVED' ? 'PENDING_CFO_APPROVAL_FIN' : 'CEO_REJECTED_FIN';

        const updated = await prisma.request.update({ where: { id }, data: { status: newStatus } });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'CEO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'APPROVED' ? 'approved — auto-routed to CFO' : 'rejected';
        await logActivity(id, decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION', `CEO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_CEO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('ceoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process CEO decision' });
    }
};

/** POST /finance-workflow/requests/:id/cfo-decision */
export const cfoDecision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
        }

        const request = await getFinanceRequest(id, res);
        if (!request) return;

        let newStatus: string;
        if (decision === 'REJECTED') {
            newStatus = 'CFO_REJECTED_FIN';
        } else {
            const fields = (request.customFields as Record<string, unknown>) || {};
            const amount = Number(fields.finalizedAmount ?? 0);
            newStatus = amount > THRESHOLD_MYR ? 'PENDING_GROUP_DCEO_APPROVAL_FIN' : 'PAYMENT_PROCESSING_FIN';
        }

        const updated = await prisma.request.update({ where: { id }, data: { status: newStatus } });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'CFO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'REJECTED' ? 'rejected' : `approved — routed to ${newStatus === 'PENDING_GROUP_DCEO_APPROVAL_FIN' ? 'Group CEO (amount > MYR 15,000)' : 'payment processing'}`;
        await logActivity(id, decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION', `CFO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('cfoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process CFO decision' });
    }
};

/** POST /finance-workflow/requests/:id/group-dceo-decision */
export const groupDceoDecision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
        }

        const request = await getFinanceRequest(id, res);
        if (!request) return;

        const newStatus = decision === 'APPROVED' ? 'PAYMENT_PROCESSING_FIN' : 'GROUP_DCEO_REJECTED_FIN';
        const updated = await prisma.request.update({ where: { id }, data: { status: newStatus } });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'GROUP_DCEO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'APPROVED' ? 'approved — routed to payment processing' : 'rejected';
        await logActivity(id, decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION', `Group CEO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_GROUP_DCEO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('groupDceoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process Group CEO decision' });
    }
};

/** POST /finance-workflow/requests/:id/mark-payment-complete */
export const markPaymentComplete = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { paymentReference, notes } = req.body;

        const request = await getFinanceRequest(id, res);
        if (!request) return;

        const existingFields = (request.customFields as Record<string, unknown>) || {};
        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: 'PAYMENT_COMPLETED_FIN',
                customFields: { ...existingFields, paymentReference: paymentReference || null },
            },
        });

        await logActivity(id, 'SYSTEM', `Payment marked complete${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}${notes ? ': ' + notes : ''}`);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_PAYMENT_COMPLETE', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('markPaymentComplete error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to mark payment complete' });
    }
};

/** POST /finance-workflow/requests/:id/close */
export const closeTicket = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const request = await getFinanceRequest(id, res);
        if (!request) return;

        const updated = await prisma.request.update({
            where: { id },
            data: { status: 'COMPLETED', resolvedAt: new Date() },
        });

        await logActivity(id, 'SYSTEM', 'Ticket closed by Finance Agent');
        await notify({ userId: request.requesterId, eventType: 'FINANCE_TICKET_CLOSED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('closeTicket error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to close ticket' });
    }
};
```

- [ ] **Step 2: Verify backend compiles**

```bash
cd backend
npm run build 2>&1 | grep -E "error TS|Error"
```

Expected: No output (clean build).

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/finance-workflow.controller.ts
git commit -m "feat(api): replace finance-workflow controller with Purchase Requisition endpoints"
```

---

## Task 4: Update backend finance-workflow routes

**Files:**
- Modify: `backend/src/routes/finance-workflow.routes.ts` (full replacement)

- [ ] **Step 1: Replace the routes file**

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
    acknowledge,
    setFinalizedAmountAndRouteCeo,
    ceoDecision,
    cfoDecision,
    groupDceoDecision,
    markPaymentComplete,
    closeTicket,
} from '../controllers/finance-workflow.controller';

const router = Router();
router.use(authenticate);

router.post('/requests/:id/acknowledge', authorize('ADMIN', 'AGENT'), acknowledge);
router.post('/requests/:id/set-finalized-amount-and-route-ceo', authorize('ADMIN', 'AGENT'), setFinalizedAmountAndRouteCeo);
router.post('/requests/:id/ceo-decision', authorize('CEO'), ceoDecision);
router.post('/requests/:id/cfo-decision', authorize('CFO'), cfoDecision);
router.post('/requests/:id/group-dceo-decision', authorize('GROUP_DCEO'), groupDceoDecision);
router.post('/requests/:id/mark-payment-complete', authorize('ADMIN', 'AGENT'), markPaymentComplete);
router.post('/requests/:id/close', authorize('ADMIN', 'AGENT'), closeTicket);

export default router;
```

- [ ] **Step 2: Verify build is clean**

```bash
cd backend
npm run build 2>&1 | grep -E "error TS|Error"
```

Expected: No output.

- [ ] **Step 3: Smoke-test acknowledge endpoint**

Start the dev server (`npm run dev`) and in a separate terminal:

```bash
# Login and get cookie
curl -s -c /tmp/fin_cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@helpdesk.com","password":"admin123"}' | jq '.status'
```

Expected: `"success"`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/finance-workflow.routes.ts
git commit -m "feat(api): update finance-workflow routes for Purchase Requisition"
```

---

## Task 5: Replace frontend finance-workflow service

**Files:**
- Modify: `frontend/src/services/finance-workflow.service.ts` (full replacement)

- [ ] **Step 1: Replace the service file**

```typescript
import api from './api';

const financeWorkflowService = {
    async acknowledge(requestId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/acknowledge`, { notes });
        return response.data;
    },

    async setFinalizedAmountAndRouteCeo(requestId: string, finalizedAmount: number, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/set-finalized-amount-and-route-ceo`, { finalizedAmount, notes });
        return response.data;
    },

    async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/ceo-decision`, { decision, comments });
        return response.data;
    },

    async cfoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/cfo-decision`, { decision, comments });
        return response.data;
    },

    async groupDceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/group-dceo-decision`, { decision, comments });
        return response.data;
    },

    async markPaymentComplete(requestId: string, paymentReference?: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/mark-payment-complete`, { paymentReference, notes });
        return response.data;
    },

    async closeTicket(requestId: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/close`, {});
        return response.data;
    },

    async getUsersByRole(role: string): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> {
        const response = await api.get('/users', { params: { role, limit: 100 } });
        return response.data.data.users.map((u: any) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
        }));
    },
};

export default financeWorkflowService;
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "finance-workflow"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/finance-workflow.service.ts
git commit -m "feat(frontend): replace finance-workflow service with Purchase Requisition methods"
```

---

## Task 6: Update workflowActions.ts

**Files:**
- Modify: `frontend/src/utils/workflowActions.ts`

- [ ] **Step 1: Add new action types to the WorkflowActionType union**

In `workflowActions.ts`, find the `export type WorkflowActionType =` block and add these values to the union (after `'RESOLVE_IT'`):

```typescript
  | 'ACKNOWLEDGE_FIN'
  | 'ROUTE_TO_CEO_FIN'
  | 'CEO_DECISION_FIN'
  | 'CFO_DECISION_FIN'
  | 'GROUP_DCEO_DECISION_FIN'
  | 'MARK_PAYMENT_COMPLETE_FIN'
  | 'CLOSE_TICKET_FIN'
```

- [ ] **Step 2: Add Finance Purchase Requisition action entries to getWorkflowActions**

In `getWorkflowActions`, add the following block just before the final `return actions;` line. It must be outside the `if (!canAct) return actions;` guard because CEO, CFO, Group CEO are not agents/admins:

```typescript
  // Finance Purchase Requisition — executive approver actions (not gated by canAct)
  const isPurchaseRequisition = requestTypeCode === 'PURCHASE_REQUISITION' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('purchase requisition'));

  if (isPurchaseRequisition) {
    if (userRoles.includes('CEO') && status === 'PENDING_CEO_APPROVAL_FIN') {
      actions.push({
        type: 'CEO_DECISION_FIN',
        label: 'CEO Approval Decision',
        description: 'Review and approve or reject this Purchase Requisition as CEO.',
        variant: 'primary',
      });
    }

    if (userRoles.includes('CFO') && status === 'PENDING_CFO_APPROVAL_FIN') {
      actions.push({
        type: 'CFO_DECISION_FIN',
        label: 'CFO Approval Decision',
        description: 'Review and approve or reject this Purchase Requisition as CFO.',
        variant: 'primary',
      });
    }

    if (userRoles.includes('GROUP_DCEO') && status === 'PENDING_GROUP_DCEO_APPROVAL_FIN') {
      actions.push({
        type: 'GROUP_DCEO_DECISION_FIN',
        label: 'Group CEO Approval Decision',
        description: 'Review and approve or reject this high-value Purchase Requisition as Group CEO.',
        variant: 'primary',
      });
    }

    // Finance Agent / Admin actions
    if (canAct) {
      if (status === 'SUBMITTED') {
        actions.push({
          type: 'ACKNOWLEDGE_FIN',
          label: 'Acknowledge Request',
          description: 'Acknowledge this Purchase Requisition and begin your review.',
          variant: 'primary',
        });
      }
      if (status === 'ACKNOWLEDGED_FIN') {
        actions.push({
          type: 'ROUTE_TO_CEO_FIN',
          label: 'Set Amount & Route to CEO',
          description: 'Enter the finalized amount and route this request to the CEO for approval.',
          variant: 'warning',
        });
      }
      if (status === 'PAYMENT_PROCESSING_FIN') {
        actions.push({
          type: 'MARK_PAYMENT_COMPLETE_FIN',
          label: 'Mark Payment Complete',
          description: 'Enter payment reference and mark the payment as completed.',
          variant: 'success',
        });
      }
      if (status === 'PAYMENT_COMPLETED_FIN') {
        actions.push({
          type: 'CLOSE_TICKET_FIN',
          label: 'Close Ticket',
          description: 'Payment confirmed. Close this ticket to complete the Purchase Requisition.',
          variant: 'success',
        });
      }
    }
  }
```

Place this block **above** the existing `if (!canAct) return actions;` guard — insert it right after the `isHR` const declaration and before the `if (!canAct) return actions;` line.

Wait — re-check: `CEO_DECISION_FIN`, `CFO_DECISION_FIN`, `GROUP_DCEO_DECISION_FIN` must be reachable without `canAct`. The correct placement is: add the entire `if (isPurchaseRequisition)` block **before** `if (!canAct) return actions;`. The `canAct`-gated inner actions are safe because they use a nested `if (canAct)`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "workflowActions"
```

Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/workflowActions.ts
git commit -m "feat(frontend): add Purchase Requisition workflow action types and visibility logic"
```

---

## Task 7: Create Finance modal components

**Files:**
- Create: `frontend/src/components/request-detail/FinAcknowledgeModal.tsx`
- Create: `frontend/src/components/request-detail/RouteToCeoFinModal.tsx`
- Create: `frontend/src/components/request-detail/FinDecisionModal.tsx`
- Create: `frontend/src/components/request-detail/MarkPaymentCompleteFinModal.tsx`
- Create: `frontend/src/components/request-detail/CloseTicketFinModal.tsx`

- [ ] **Step 1: Create FinAcknowledgeModal.tsx**

```tsx
import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const FinAcknowledgeModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.acknowledge(requestId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to acknowledge request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0052cc]">task_alt</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Acknowledge Request</h2>
              <p className="text-xs text-gray-500">Finance Workflow · Purchase Requisition</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">Confirm you have reviewed this Purchase Requisition and are taking ownership of it.</p>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any initial observations or notes…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Acknowledging…' : 'Acknowledge Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default FinAcknowledgeModal;
```

- [ ] **Step 2: Create RouteToCeoFinModal.tsx**

```tsx
import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const RouteToCeoFinModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [finalizedAmount, setFinalizedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const isValid = finalizedAmount !== '' && Number(finalizedAmount) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.setFinalizedAmountAndRouteCeo(requestId, Number(finalizedAmount), notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to route to CEO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-700">price_check</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Set Amount & Route to CEO</h2>
              <p className="text-xs text-gray-500">Finance Workflow · Purchase Requisition</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Finalized Amount (MYR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">MYR</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={finalizedAmount}
                    onChange={e => setFinalizedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                    required
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Amounts above MYR 15,000 will require additional Group CEO approval after CFO.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Justification or context for the CEO…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={!isValid || submitting} className="px-4 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {submitting ? 'Routing…' : 'Route to CEO'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RouteToCeoFinModal;
```

- [ ] **Step 3: Create FinDecisionModal.tsx** (shared approve/reject modal used for CEO, CFO, Group CEO)

```tsx
import React, { useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  title: string;
  subtitle: string;
  onDecision: (decision: 'APPROVED' | 'REJECTED', comments?: string) => Promise<void>;
  onClose: () => void;
}

const FinDecisionModal: React.FC<Props> = ({ title, subtitle, onDecision, onClose }) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const isValid = decision !== '' && (decision === 'APPROVED' || comments.trim() !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision || !isValid) return;
    try {
      setSubmitting(true);
      setError(null);
      await onDecision(decision, comments || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0052cc]">gavel</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Decision <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['APPROVED', 'REJECTED'] as const).map(d => (
                    <label
                      key={d}
                      className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        decision === d
                          ? d === 'APPROVED' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value={d}
                        checked={decision === d}
                        onChange={() => setDecision(d)}
                        className="accent-[#0052cc] w-4 h-4 flex-shrink-0"
                      />
                      <span className={`text-sm font-bold ${d === 'APPROVED' ? 'text-green-700' : 'text-red-700'}`}>
                        {d === 'APPROVED' ? 'Approve' : 'Reject'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Comments {decision === 'REJECTED' && <span className="text-red-500">*</span>}
                  {decision !== 'REJECTED' && <span className="font-normal normal-case text-gray-400">(optional)</span>}
                </label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={3}
                  placeholder={decision === 'REJECTED' ? 'Reason for rejection (required)…' : 'Any comments for the Finance team…'}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                  required={decision === 'REJECTED'}
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting}
                className={`px-4 py-3 text-sm font-bold text-white rounded-lg disabled:opacity-50 ${
                  decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {submitting ? 'Submitting…' : decision === 'REJECTED' ? 'Reject' : 'Approve'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default FinDecisionModal;
```

- [ ] **Step 4: Create MarkPaymentCompleteFinModal.tsx**

```tsx
import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const MarkPaymentCompleteFinModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.markPaymentComplete(requestId, paymentReference || undefined, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to mark payment complete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-700">payments</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Mark Payment Complete</h2>
              <p className="text-xs text-gray-500">Finance Workflow · Purchase Requisition</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Payment Reference <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="e.g. TXN-20260424-001"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any payment notes…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? 'Saving…' : 'Mark Payment Complete'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default MarkPaymentCompleteFinModal;
```

- [ ] **Step 5: Create CloseTicketFinModal.tsx**

```tsx
import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CloseTicketFinModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.closeTicket(requestId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to close ticket');
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-700">check_circle</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Close Ticket</h2>
              <p className="text-xs text-gray-500">Finance Workflow · Purchase Requisition</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600">Payment has been confirmed. Closing this ticket will mark the Purchase Requisition as completed.</p>
            <p className="text-sm font-bold text-gray-800">Are you sure you want to close this ticket?</p>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Closing…' : 'Close Ticket'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CloseTicketFinModal;
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep -E "FinAcknowledge|RouteToCeo|FinDecision|MarkPayment|CloseTicket"
```

Expected: No output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/request-detail/FinAcknowledgeModal.tsx \
        frontend/src/components/request-detail/RouteToCeoFinModal.tsx \
        frontend/src/components/request-detail/FinDecisionModal.tsx \
        frontend/src/components/request-detail/MarkPaymentCompleteFinModal.tsx \
        frontend/src/components/request-detail/CloseTicketFinModal.tsx
git commit -m "feat(frontend): add Finance Purchase Requisition modal components"
```

---

## Task 8: Wire modals into ActionSidebar

**Files:**
- Modify: `frontend/src/components/request-detail/ActionSidebar.tsx`

- [ ] **Step 1: Add lazy imports** (after the existing `UploadSignedLOAModal` import on line 33)

```typescript
const FinAcknowledgeModal = lazy(() => import('./FinAcknowledgeModal'));
const RouteToCeoFinModal = lazy(() => import('./RouteToCeoFinModal'));
const FinDecisionModal = lazy(() => import('./FinDecisionModal'));
const MarkPaymentCompleteFinModal = lazy(() => import('./MarkPaymentCompleteFinModal'));
const CloseTicketFinModal = lazy(() => import('./CloseTicketFinModal'));
```

Also add the finance service import at the top of the file (after the existing imports):

```typescript
import financeWorkflowService from '../../services/finance-workflow.service';
```

- [ ] **Step 2: Expand the ModalType union** (line 35)

Replace the existing `type ModalType = ...` line with:

```typescript
type ModalType = 'APPROVE' | 'REJECT' | 'SUBMIT_FOR_APPROVAL' | 'PROCUREMENT' | 'HARDWARE_ORDERED' | 'HARDWARE_RECEIVED' | 'SOFTWARE_PROVISIONED' | 'FULFILMENT' | 'ASSIGN' | 'VP_DECISION' | 'RESUBMIT_REQUEST' | 'ACKNOWLEDGE_IT' | 'CEO_DECISION' | 'CTO_DECISION' | 'ROUTE_TO_CFO' | 'CFO_DECISION' | 'PAYMENT_DONE' | 'MANAGER_DECISION' | 'COMPLETE_DELIVERY' | 'ROUTE_TO_CEO_HR' | 'MARK_JOB_POSTED' | 'UPLOAD_RESUME' | 'SCHEDULE_INTERVIEW' | 'UPDATE_SCREENING' | 'UPLOAD_LOA' | 'UPLOAD_SIGNED_LOA' | 'FIN_ACKNOWLEDGE' | 'FIN_ROUTE_CEO' | 'FIN_CEO_DECISION' | 'FIN_CFO_DECISION' | 'FIN_GROUP_DCEO_DECISION' | 'FIN_PAYMENT_COMPLETE' | 'FIN_CLOSE_TICKET' | null;
```

- [ ] **Step 3: Add handleActionClick cases** (inside the switch, before the `default:` case)

```typescript
      case 'ACKNOWLEDGE_FIN': setOpenModal('FIN_ACKNOWLEDGE'); break;
      case 'ROUTE_TO_CEO_FIN': setOpenModal('FIN_ROUTE_CEO'); break;
      case 'CEO_DECISION_FIN': setOpenModal('FIN_CEO_DECISION'); break;
      case 'CFO_DECISION_FIN': setOpenModal('FIN_CFO_DECISION'); break;
      case 'GROUP_DCEO_DECISION_FIN': setOpenModal('FIN_GROUP_DCEO_DECISION'); break;
      case 'MARK_PAYMENT_COMPLETE_FIN': setOpenModal('FIN_PAYMENT_COMPLETE'); break;
      case 'CLOSE_TICKET_FIN': setOpenModal('FIN_CLOSE_TICKET'); break;
```

- [ ] **Step 4: Add modal renders** (inside the JSX return, after the `UPLOAD_SIGNED_LOA` modal block before the closing `</aside>`)

```tsx
      {openModal === 'FIN_ACKNOWLEDGE' && (
        <Suspense fallback={null}>
          <FinAcknowledgeModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'FIN_ROUTE_CEO' && (
        <Suspense fallback={null}>
          <RouteToCeoFinModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'FIN_CEO_DECISION' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="CEO Approval Decision"
            subtitle="Finance Workflow · Purchase Requisition"
            onDecision={(decision, comments) => financeWorkflowService.ceoDecision(requestId, decision, comments).then(handleSuccess)}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'FIN_CFO_DECISION' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="CFO Approval Decision"
            subtitle="Finance Workflow · Purchase Requisition"
            onDecision={(decision, comments) => financeWorkflowService.cfoDecision(requestId, decision, comments).then(handleSuccess)}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'FIN_GROUP_DCEO_DECISION' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Group CEO Approval Decision"
            subtitle="Finance Workflow · Purchase Requisition (High-Value)"
            onDecision={(decision, comments) => financeWorkflowService.groupDceoDecision(requestId, decision, comments).then(handleSuccess)}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'FIN_PAYMENT_COMPLETE' && (
        <Suspense fallback={null}>
          <MarkPaymentCompleteFinModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'FIN_CLOSE_TICKET' && (
        <Suspense fallback={null}>
          <CloseTicketFinModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "ActionSidebar"
```

Expected: No output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/request-detail/ActionSidebar.tsx
git commit -m "feat(frontend): wire Purchase Requisition Finance modals into ActionSidebar"
```

---

## Task 9: Update RequestHeader stepper for Purchase Requisition

**Files:**
- Modify: `frontend/src/components/request/RequestHeader.tsx`

- [ ] **Step 1: Replace the FINANCE stepper block**

Find the block starting at `if (workflowCode === 'FINANCE') {` (around line 229) and replace it entirely with:

```typescript
    if (workflowCode === 'FINANCE') {
      const requestTypeCode = request.requestType?.code;
      const isPurchaseRequisition = requestTypeCode === 'PURCHASE_REQUISITION';

      if (isPurchaseRequisition) {
        const currentStatus = request.status;
        // Determine if amount > 15000 to show Group CEO step
        const fields = (request.customFields as Record<string, unknown>) || {};
        const amount = Number(fields.finalizedAmount ?? 0);
        const needsGroupDceo = amount > 15000 ||
          ['PENDING_GROUP_DCEO_APPROVAL_FIN', 'GROUP_DCEO_APPROVED_FIN', 'GROUP_DCEO_REJECTED_FIN'].includes(currentStatus);

        const allSteps = [
          { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
          { label: 'Under Review', status: 'ACKNOWLEDGED_FIN', icon: 'radio_button_checked' },
          { label: 'Pending CEO', status: 'PENDING_CEO_APPROVAL_FIN', icon: 'radio_button_checked' },
          { label: 'Pending CFO', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked' },
          ...(needsGroupDceo ? [{ label: 'Pending Group CEO', status: 'PENDING_GROUP_DCEO_APPROVAL_FIN', icon: 'radio_button_checked' }] : []),
          { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked' },
          { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
        ];

        const statusOrder = [
          'SUBMITTED', 'ACKNOWLEDGED_FIN',
          'PENDING_CEO_APPROVAL_FIN', 'CEO_APPROVED_FIN',
          'PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN',
          ...(needsGroupDceo ? ['PENDING_GROUP_DCEO_APPROVAL_FIN', 'GROUP_DCEO_APPROVED_FIN'] : []),
          'PAYMENT_PROCESSING_FIN', 'PAYMENT_COMPLETED_FIN', 'COMPLETED',
        ];

        const currentIndex = statusOrder.indexOf(currentStatus);
        return allSteps.map(step => ({
          ...step,
          active: statusOrder.indexOf(step.status) <= currentIndex,
        }));
      }

      // Other Finance request types — keep original stepper
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'Manager Review', status: 'PENDING_MANAGER_APPROVAL_FIN', icon: 'radio_button_checked' },
        { label: 'Finance Head', status: 'PENDING_FINANCE_HEAD_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED', 'PENDING_MANAGER_APPROVAL_FIN', 'MANAGER_APPROVED_FIN',
        'PENDING_FINANCE_HEAD_APPROVAL', 'FINANCE_HEAD_APPROVED',
        'PAYMENT_PROCESSING', 'PAYMENT_DONE', 'COMPLETED',
      ];
      const currentIndex = statusOrder.indexOf(request.status);
      return allSteps.map(step => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }
```

Also find the legacy fallback block at `if (request.serviceDesk?.code === 'FINANCE') {` (around line 282) and apply the same `isPurchaseRequisition` split there:

```typescript
    if (request.serviceDesk?.code === 'FINANCE') {
      const requestTypeCode = request.requestType?.code;
      if (requestTypeCode === 'PURCHASE_REQUISITION') {
        // Redirect to same logic: Purchase Requisition steps without amount check (legacy fallback)
        const allSteps = [
          { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
          { label: 'Under Review', status: 'ACKNOWLEDGED_FIN', icon: 'radio_button_checked' },
          { label: 'Pending CEO', status: 'PENDING_CEO_APPROVAL_FIN', icon: 'radio_button_checked' },
          { label: 'Pending CFO', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked' },
          { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked' },
          { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
        ];
        const statusOrder = [
          'SUBMITTED', 'ACKNOWLEDGED_FIN', 'PENDING_CEO_APPROVAL_FIN', 'CEO_APPROVED_FIN',
          'PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN', 'PAYMENT_PROCESSING_FIN', 'PAYMENT_COMPLETED_FIN', 'COMPLETED',
        ];
        const currentIndex = statusOrder.indexOf(request.status);
        return allSteps.map(step => ({
          ...step,
          active: statusOrder.indexOf(step.status) <= currentIndex,
        }));
      }

      // Legacy other Finance fallback
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'Manager Review', status: 'PENDING_MANAGER_APPROVAL_FIN', icon: 'radio_button_checked' },
        { label: 'Finance Head', status: 'PENDING_FINANCE_HEAD_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED', 'PENDING_MANAGER_APPROVAL_FIN', 'MANAGER_APPROVED_FIN',
        'PENDING_FINANCE_HEAD_APPROVAL', 'FINANCE_HEAD_APPROVED',
        'PAYMENT_PROCESSING', 'PAYMENT_DONE', 'COMPLETED',
      ];
      const currentIndex = statusOrder.indexOf(request.status);
      return allSteps.map(step => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "RequestHeader"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/request/RequestHeader.tsx
git commit -m "feat(frontend): add Purchase Requisition stepper to RequestHeader"
```

---

## Task 10: Add finalizedAmount label to CustomFieldsPanel

**Files:**
- Modify: `frontend/src/components/request-detail/CustomFieldsPanel.tsx`

- [ ] **Step 1: Add finalizedAmount to FINANCE_FIELD_LABELS**

Find the `const FINANCE_FIELD_LABELS` block (around line 49) and add the new entry:

```typescript
const FINANCE_FIELD_LABELS: Record<string, string> = {
  expenseType: 'Expense Type',
  amount: 'Amount',
  currency: 'Currency',
  receiptDate: 'Receipt Date',
  vendor: 'Vendor',
  costCenter: 'Cost Center',
  projectCode: 'Project Code',
  finalizedAmount: 'Finalized Amount (MYR)',
  paymentReference: 'Payment Reference',
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "CustomFieldsPanel"
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/request-detail/CustomFieldsPanel.tsx
git commit -m "feat(frontend): add finalizedAmount label to Finance custom fields panel"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Test full happy path (amount ≤ MYR 15,000)**

1. Log in as `admin@helpdesk.com` / `admin123`
2. Create a new Finance → Purchase Requisition ticket
3. Open the ticket — verify ActionSidebar shows **Acknowledge Request**
4. Click Acknowledge → confirm SUBMITTED → ACKNOWLEDGED_FIN and stepper updates to "Under Review"
5. ActionSidebar now shows **Set Amount & Route to CEO** — click it, enter `5000`, submit
6. Verify status → PENDING_CEO_APPROVAL_FIN, stepper shows "Pending CEO" active
7. Log out → log in as `ceo@company.com` / `ceo123`
8. Open ticket — verify ActionSidebar shows **CEO Approval Decision**
9. Approve → verify status auto-transitions to PENDING_CFO_APPROVAL_FIN
10. Log out → log in as `cfo@company.com` / `cfo123`
11. Open ticket — verify ActionSidebar shows **CFO Approval Decision**
12. Approve → verify status → PAYMENT_PROCESSING_FIN (amount ≤ 15000, no Group CEO step)
13. Log out → log in as `admin@helpdesk.com` / `admin123`
14. Open ticket — verify **Mark Payment Complete** button appears
15. Submit → verify status → PAYMENT_COMPLETED_FIN
16. Verify **Close Ticket** button appears → click → status → COMPLETED, stepper shows all steps active

- [ ] **Step 3: Test high-value path (amount > MYR 15,000)**

1. Create a new Purchase Requisition ticket
2. Acknowledge → set amount `20000` → route to CEO
3. CEO approves → CFO approves → verify status → PENDING_GROUP_DCEO_APPROVAL_FIN
4. Verify stepper shows "Pending Group CEO" step
5. Log in as `groupceo@company.com` / `groupceo123`
6. Open ticket → verify **Group CEO Approval Decision** appears
7. Approve → verify status → PAYMENT_PROCESSING_FIN

- [ ] **Step 4: Test rejection path**

1. Create a Purchase Requisition → acknowledge → route to CEO (amount: `8000`)
2. Log in as CEO → reject with comments "Budget exceeded"
3. Verify status → CEO_REJECTED_FIN, no further actions available

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete Purchase Requisition workflow — E2E verified"
```
