# Plan 3: IT & Finance Workflow Parity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build approval workflows for IT (hardware/software requests need manager approval) and Finance (expense reimbursements need manager + finance head approval) so they have real workflow logic comparable to HR.

**Architecture:** Add IT and Finance controller/route pairs that handle approval chains. Reuse the existing `RequestApproval` model for tracking. Add corresponding frontend action buttons in `RequestDetail.tsx`.

**Tech Stack:** Express, Prisma, React, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/controllers/it-workflow.controller.ts` | IT request approval: submit → manager review → procurement → fulfilled |
| Create | `backend/src/routes/it-workflow.routes.ts` | IT workflow API routes |
| Create | `backend/src/controllers/finance-workflow.controller.ts` | Finance approval: submit → manager → finance head → payment |
| Create | `backend/src/routes/finance-workflow.routes.ts` | Finance workflow API routes |
| Modify | `backend/src/routes/index.ts` | Mount new route modules |
| Modify | `backend/prisma/seed.ts` | Add HR/Finance categories + request types with SLA |
| Create | `frontend/src/services/it-workflow.service.ts` | Frontend API client for IT workflow |
| Create | `frontend/src/services/finance-workflow.service.ts` | Frontend API client for Finance workflow |
| Modify | `frontend/types.ts` | Add new status enums for IT/Finance |
| Modify | `frontend/constants.tsx` | Add STATUS_CONFIG entries for new statuses |
| Modify | `frontend/pages/RequestDetail.tsx` | Add IT/Finance workflow action buttons |

---

### Task 1: Add IT/Finance Statuses to Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Read the current RequestStatus enum**

Run: Look at the `RequestStatus` enum in `backend/prisma/schema.prisma`

- [ ] **Step 2: Add new statuses to the RequestStatus enum**

Add these values to the existing `RequestStatus` enum:

```prisma
  // IT Workflow
  PENDING_MANAGER_APPROVAL_IT
  MANAGER_APPROVED_IT
  MANAGER_REJECTED_IT
  PROCUREMENT_IN_PROGRESS
  HARDWARE_ORDERED
  HARDWARE_RECEIVED
  SOFTWARE_PROVISIONED

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
```

- [ ] **Step 3: Run migration**

Run: `cd backend && npx prisma migrate dev --name add_it_finance_statuses`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add IT and Finance workflow statuses to schema"
```

---

### Task 2: IT Workflow Controller

**Files:**
- Create: `backend/src/controllers/it-workflow.controller.ts`

- [ ] **Step 1: Create `backend/src/controllers/it-workflow.controller.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { notify } from '../services/notification.service';
import logger from '../utils/logger';

export class ITWorkflowController {
  /**
   * POST /it-workflow/requests/:id/submit-for-approval
   * Agent routes IT request to manager for approval
   */
  async submitForApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { managerId, notes } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({
        where: { id },
        include: { serviceDesk: true },
      });

      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      if (request.serviceDesk.code !== 'IT') {
        return res.status(400).json({ status: 'error', message: 'Not an IT request' });
      }

      // Update status
      await prisma.request.update({
        where: { id },
        data: { status: 'PENDING_MANAGER_APPROVAL_IT' },
      });

      // Create approval record
      await prisma.requestApproval.create({
        data: {
          requestId: id,
          approverId: managerId,
          type: 'HIRING_MANAGER', // Reusing existing enum — represents "manager" approval
          status: 'PENDING',
          comments: notes || null,
        },
      });

      // Activity log
      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: 'STATUS_CHANGE',
          content: `Request submitted for manager approval`,
          metadata: { newStatus: 'PENDING_MANAGER_APPROVAL_IT', managerId },
        },
      });

      // Notify manager
      await notify({
        userId: managerId,
        eventType: 'REQUEST_ASSIGNED',
        variables: { referenceNumber: request.referenceNumber, summary: request.summary },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: 'Request submitted for manager approval' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /it-workflow/requests/:id/manager-decision
   * Manager approves or rejects IT request
   */
  async managerDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body; // decision: 'APPROVED' | 'REJECTED'
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED_IT' : 'MANAGER_REJECTED_IT';

      await prisma.request.update({
        where: { id },
        data: { status: newStatus },
      });

      // Update approval record
      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverId: userId, status: 'PENDING' },
        data: { status: decision, comments, decidedAt: new Date() },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
          content: `Manager ${decision.toLowerCase()} the request${comments ? ': ' + comments : ''}`,
          metadata: { newStatus, decision },
        },
      });

      // Notify requester
      await notify({
        userId: request.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: { referenceNumber: request.referenceNumber, newStatus },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: `Request ${decision.toLowerCase()}` });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /it-workflow/requests/:id/mark-procurement
   * IT agent marks request as in procurement
   */
  async markProcurement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { orderNumber, vendor, estimatedDelivery } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      await prisma.request.update({
        where: { id },
        data: {
          status: 'PROCUREMENT_IN_PROGRESS',
          customFields: {
            ...(request.customFields as object ?? {}),
            orderNumber,
            vendor,
            estimatedDelivery,
          },
        },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: 'STATUS_CHANGE',
          content: `Procurement initiated${vendor ? ' with ' + vendor : ''}${orderNumber ? ', order #' + orderNumber : ''}`,
          metadata: { newStatus: 'PROCUREMENT_IN_PROGRESS', orderNumber, vendor },
        },
      });

      await notify({
        userId: request.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: { referenceNumber: request.referenceNumber, newStatus: 'Procurement In Progress' },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: 'Procurement initiated' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /it-workflow/requests/:id/mark-fulfilled
   * IT agent marks request as fulfilled/resolved
   */
  async markFulfilled(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      await prisma.request.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: 'STATUS_CHANGE',
          content: `Request fulfilled and resolved${notes ? ': ' + notes : ''}`,
          metadata: { newStatus: 'RESOLVED' },
        },
      });

      await notify({
        userId: request.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: { referenceNumber: request.referenceNumber, newStatus: 'Resolved' },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: 'Request fulfilled' });
    } catch (error) {
      next(error);
    }
  }
}

export default new ITWorkflowController();
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/it-workflow.controller.ts
git commit -m "feat: add IT workflow controller with approval chain"
```

---

### Task 3: IT Workflow Routes

**Files:**
- Create: `backend/src/routes/it-workflow.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create `backend/src/routes/it-workflow.routes.ts`**

```typescript
import { Router } from 'express';
import itWorkflowController from '../controllers/it-workflow.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/submit-for-approval', authorize('ADMIN', 'AGENT'), itWorkflowController.submitForApproval);
router.post('/requests/:id/manager-decision', itWorkflowController.managerDecision);
router.post('/requests/:id/mark-procurement', authorize('ADMIN', 'AGENT'), itWorkflowController.markProcurement);
router.post('/requests/:id/mark-fulfilled', authorize('ADMIN', 'AGENT'), itWorkflowController.markFulfilled);

export default router;
```

- [ ] **Step 2: Mount in `backend/src/routes/index.ts`**

Add import and mount:

```typescript
import itWorkflowRoutes from './it-workflow.routes';
```

Add this line alongside the other route mounts:

```typescript
router.use('/it-workflow', itWorkflowRoutes);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/it-workflow.routes.ts backend/src/routes/index.ts
git commit -m "feat: add IT workflow routes"
```

---

### Task 4: Finance Workflow Controller

**Files:**
- Create: `backend/src/controllers/finance-workflow.controller.ts`

- [ ] **Step 1: Create `backend/src/controllers/finance-workflow.controller.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { notify } from '../services/notification.service';
import logger from '../utils/logger';

export class FinanceWorkflowController {
  /**
   * POST /finance-workflow/requests/:id/submit-for-manager
   * Route expense/finance request to line manager
   */
  async submitForManager(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { managerId, notes } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({
        where: { id },
        include: { serviceDesk: true },
      });

      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      if (request.serviceDesk.code !== 'FINANCE') {
        return res.status(400).json({ status: 'error', message: 'Not a Finance request' });
      }

      await prisma.request.update({
        where: { id },
        data: { status: 'PENDING_MANAGER_APPROVAL_FIN' },
      });

      await prisma.requestApproval.create({
        data: {
          requestId: id,
          approverId: managerId,
          type: 'HIRING_MANAGER',
          status: 'PENDING',
          comments: notes || null,
        },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: 'STATUS_CHANGE',
          content: 'Submitted for manager approval',
          metadata: { newStatus: 'PENDING_MANAGER_APPROVAL_FIN', managerId },
        },
      });

      await notify({
        userId: managerId,
        eventType: 'REQUEST_ASSIGNED',
        variables: { referenceNumber: request.referenceNumber, summary: request.summary },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: 'Submitted for manager approval' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finance-workflow/requests/:id/manager-decision
   */
  async managerDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED_FIN' : 'MANAGER_REJECTED_FIN';

      await prisma.request.update({ where: { id }, data: { status: newStatus } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverId: userId, status: 'PENDING' },
        data: { status: decision, comments, decidedAt: new Date() },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
          content: `Manager ${decision.toLowerCase()} the request${comments ? ': ' + comments : ''}`,
          metadata: { newStatus, decision },
        },
      });

      await notify({
        userId: request.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: { referenceNumber: request.referenceNumber, newStatus },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: `Request ${decision.toLowerCase()}` });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finance-workflow/requests/:id/submit-for-finance-head
   * After manager approval, route to finance head
   */
  async submitForFinanceHead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { financeHeadId, notes } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      await prisma.request.update({
        where: { id },
        data: { status: 'PENDING_FINANCE_HEAD_APPROVAL' },
      });

      await prisma.requestApproval.create({
        data: {
          requestId: id,
          approverId: financeHeadId,
          type: 'CEO', // Reusing existing enum — represents "senior" approval
          status: 'PENDING',
          comments: notes || null,
        },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: 'STATUS_CHANGE',
          content: 'Submitted for Finance Head approval',
          metadata: { newStatus: 'PENDING_FINANCE_HEAD_APPROVAL', financeHeadId },
        },
      });

      await notify({
        userId: financeHeadId,
        eventType: 'REQUEST_ASSIGNED',
        variables: { referenceNumber: request.referenceNumber, summary: request.summary },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: 'Submitted for Finance Head approval' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finance-workflow/requests/:id/finance-head-decision
   */
  async financeHeadDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body;
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      const newStatus = decision === 'APPROVED' ? 'FINANCE_HEAD_APPROVED' : 'FINANCE_HEAD_REJECTED';

      await prisma.request.update({ where: { id }, data: { status: newStatus } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverId: userId, status: 'PENDING' },
        data: { status: decision, comments, decidedAt: new Date() },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
          content: `Finance Head ${decision.toLowerCase()} the request${comments ? ': ' + comments : ''}`,
          metadata: { newStatus, decision },
        },
      });

      await notify({
        userId: request.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: { referenceNumber: request.referenceNumber, newStatus },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: `Request ${decision.toLowerCase()}` });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finance-workflow/requests/:id/mark-payment
   * Finance agent marks payment as processing or completed
   */
  async markPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { paymentStatus, paymentReference, notes } = req.body;
      // paymentStatus: 'PROCESSING' | 'COMPLETED'
      const userId = (req as any).user.id;

      const request = await prisma.request.findUnique({ where: { id } });
      if (!request) {
        return res.status(404).json({ status: 'error', message: 'Request not found' });
      }

      const newStatus = paymentStatus === 'COMPLETED' ? 'PAYMENT_COMPLETED' : 'PAYMENT_PROCESSING';

      await prisma.request.update({
        where: { id },
        data: {
          status: newStatus,
          resolvedAt: paymentStatus === 'COMPLETED' ? new Date() : undefined,
          customFields: {
            ...(request.customFields as object ?? {}),
            paymentReference,
          },
        },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          userId,
          type: 'STATUS_CHANGE',
          content: `Payment ${paymentStatus.toLowerCase()}${paymentReference ? ' - Ref: ' + paymentReference : ''}${notes ? '. ' + notes : ''}`,
          metadata: { newStatus, paymentReference },
        },
      });

      await notify({
        userId: request.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: { referenceNumber: request.referenceNumber, newStatus: newStatus.replace(/_/g, ' ') },
        relatedRequestId: id,
      });

      res.json({ status: 'success', message: `Payment marked as ${paymentStatus.toLowerCase()}` });
    } catch (error) {
      next(error);
    }
  }
}

export default new FinanceWorkflowController();
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/finance-workflow.controller.ts
git commit -m "feat: add Finance workflow controller with dual-approval chain"
```

---

### Task 5: Finance Workflow Routes

**Files:**
- Create: `backend/src/routes/finance-workflow.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create `backend/src/routes/finance-workflow.routes.ts`**

```typescript
import { Router } from 'express';
import financeWorkflowController from '../controllers/finance-workflow.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/submit-for-manager', authorize('ADMIN', 'AGENT'), financeWorkflowController.submitForManager);
router.post('/requests/:id/manager-decision', financeWorkflowController.managerDecision);
router.post('/requests/:id/submit-for-finance-head', authorize('ADMIN', 'AGENT'), financeWorkflowController.submitForFinanceHead);
router.post('/requests/:id/finance-head-decision', financeWorkflowController.financeHeadDecision);
router.post('/requests/:id/mark-payment', authorize('ADMIN', 'AGENT'), financeWorkflowController.markPayment);

export default router;
```

- [ ] **Step 2: Mount in `backend/src/routes/index.ts`**

Add import:

```typescript
import financeWorkflowRoutes from './finance-workflow.routes';
```

Add mount:

```typescript
router.use('/finance-workflow', financeWorkflowRoutes);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/finance-workflow.routes.ts backend/src/routes/index.ts
git commit -m "feat: add Finance workflow routes"
```

---

### Task 6: Seed HR & Finance Categories

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add HR categories to seed.ts**

After the IT categories section, add:

```typescript
    // HR Service Categories
    const hrDesk = await prisma.serviceDesk.findFirst({ where: { code: 'HR' } });
    if (hrDesk) {
      const hrCategories = [
        { name: 'Leave Management', description: 'Apply for leave, check balance', icon: 'event_available', color: '#10b981', displayOrder: 1 },
        { name: 'Payroll & Compensation', description: 'Salary queries, tax forms, payslips', icon: 'payments', color: '#6366f1', displayOrder: 2 },
        { name: 'Benefits & Claims', description: 'Medical claims, insurance, benefits enrollment', icon: 'health_and_safety', color: '#f59e0b', displayOrder: 3 },
        { name: 'New Hire Request', description: 'Request to hire for a position', icon: 'person_add', color: '#0052cc', displayOrder: 4 },
      ];

      for (const cat of hrCategories) {
        const existing = await prisma.serviceCategory.findFirst({ where: { name: cat.name, serviceDeskId: hrDesk.id } });
        if (!existing) {
          const category = await prisma.serviceCategory.create({
            data: { ...cat, serviceDeskId: hrDesk.id, isActive: true },
          });
          await prisma.requestType.create({
            data: {
              name: cat.name,
              description: cat.description,
              serviceCategoryId: category.id,
              slaHours: 48,
              isActive: true,
            },
          });
        }
      }
    }
```

- [ ] **Step 2: Add Finance categories to seed.ts**

```typescript
    // Finance Service Categories
    const finDesk = await prisma.serviceDesk.findFirst({ where: { code: 'FINANCE' } });
    if (finDesk) {
      const finCategories = [
        { name: 'Expense Reimbursement', description: 'Submit expense claims for reimbursement', icon: 'receipt_long', color: '#10b981', displayOrder: 1 },
        { name: 'Invoice Processing', description: 'Submit or query vendor invoices', icon: 'description', color: '#6366f1', displayOrder: 2 },
        { name: 'Budget Approval', description: 'Request budget allocation or transfer', icon: 'account_balance', color: '#f59e0b', displayOrder: 3 },
      ];

      for (const cat of finCategories) {
        const existing = await prisma.serviceCategory.findFirst({ where: { name: cat.name, serviceDeskId: finDesk.id } });
        if (!existing) {
          const category = await prisma.serviceCategory.create({
            data: { ...cat, serviceDeskId: finDesk.id, isActive: true },
          });
          await prisma.requestType.create({
            data: {
              name: cat.name,
              description: cat.description,
              serviceCategoryId: category.id,
              slaHours: 72,
              isActive: true,
            },
          });
        }
      }
    }
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: seed HR and Finance service categories with request types"
```

---

### Task 7: Frontend — Add IT/Finance Types & Services

**Files:**
- Modify: `frontend/types.ts`
- Modify: `frontend/constants.tsx`
- Create: `frontend/src/services/it-workflow.service.ts`
- Create: `frontend/src/services/finance-workflow.service.ts`

- [ ] **Step 1: Add new statuses to `frontend/types.ts` RequestStatus enum**

```typescript
  // IT Workflow
  PENDING_MANAGER_APPROVAL_IT = 'PENDING_MANAGER_APPROVAL_IT',
  MANAGER_APPROVED_IT = 'MANAGER_APPROVED_IT',
  MANAGER_REJECTED_IT = 'MANAGER_REJECTED_IT',
  PROCUREMENT_IN_PROGRESS = 'PROCUREMENT_IN_PROGRESS',
  HARDWARE_ORDERED = 'HARDWARE_ORDERED',
  HARDWARE_RECEIVED = 'HARDWARE_RECEIVED',
  SOFTWARE_PROVISIONED = 'SOFTWARE_PROVISIONED',

  // Finance Workflow
  PENDING_MANAGER_APPROVAL_FIN = 'PENDING_MANAGER_APPROVAL_FIN',
  MANAGER_APPROVED_FIN = 'MANAGER_APPROVED_FIN',
  MANAGER_REJECTED_FIN = 'MANAGER_REJECTED_FIN',
  PENDING_FINANCE_HEAD_APPROVAL = 'PENDING_FINANCE_HEAD_APPROVAL',
  FINANCE_HEAD_APPROVED = 'FINANCE_HEAD_APPROVED',
  FINANCE_HEAD_REJECTED = 'FINANCE_HEAD_REJECTED',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  REIMBURSEMENT_CLOSED = 'REIMBURSEMENT_CLOSED',
```

- [ ] **Step 2: Add STATUS_CONFIG entries in `frontend/constants.tsx`**

```typescript
  // IT Workflow
  PENDING_MANAGER_APPROVAL_IT: { label: 'Pending Manager Approval', color: 'text-purple-700', bg: 'bg-purple-100' },
  MANAGER_APPROVED_IT: { label: 'Manager Approved', color: 'text-green-700', bg: 'bg-green-100' },
  MANAGER_REJECTED_IT: { label: 'Manager Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  PROCUREMENT_IN_PROGRESS: { label: 'Procurement In Progress', color: 'text-orange-700', bg: 'bg-orange-100' },
  HARDWARE_ORDERED: { label: 'Hardware Ordered', color: 'text-blue-700', bg: 'bg-blue-100' },
  HARDWARE_RECEIVED: { label: 'Hardware Received', color: 'text-teal-700', bg: 'bg-teal-100' },
  SOFTWARE_PROVISIONED: { label: 'Software Provisioned', color: 'text-teal-700', bg: 'bg-teal-100' },

  // Finance Workflow
  PENDING_MANAGER_APPROVAL_FIN: { label: 'Pending Manager Approval', color: 'text-purple-700', bg: 'bg-purple-100' },
  MANAGER_APPROVED_FIN: { label: 'Manager Approved', color: 'text-green-700', bg: 'bg-green-100' },
  MANAGER_REJECTED_FIN: { label: 'Manager Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  PENDING_FINANCE_HEAD_APPROVAL: { label: 'Pending Finance Head', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  FINANCE_HEAD_APPROVED: { label: 'Finance Head Approved', color: 'text-green-700', bg: 'bg-green-100' },
  FINANCE_HEAD_REJECTED: { label: 'Finance Head Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  PAYMENT_PROCESSING: { label: 'Payment Processing', color: 'text-amber-700', bg: 'bg-amber-100' },
  PAYMENT_COMPLETED: { label: 'Payment Completed', color: 'text-green-700', bg: 'bg-green-100' },
  REIMBURSEMENT_CLOSED: { label: 'Reimbursement Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
```

- [ ] **Step 3: Create `frontend/src/services/it-workflow.service.ts`**

```typescript
import api from './api';

const itWorkflowService = {
  async submitForApproval(requestId: string, managerId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/submit-for-approval`, { managerId, notes });
    return response.data;
  },

  async managerDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/manager-decision`, { decision, comments });
    return response.data;
  },

  async markProcurement(requestId: string, data: { orderNumber?: string; vendor?: string; estimatedDelivery?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-procurement`, data);
    return response.data;
  },

  async markFulfilled(requestId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-fulfilled`, { notes });
    return response.data;
  },
};

export default itWorkflowService;
```

- [ ] **Step 4: Create `frontend/src/services/finance-workflow.service.ts`**

```typescript
import api from './api';

const financeWorkflowService = {
  async submitForManager(requestId: string, managerId: string, notes?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/submit-for-manager`, { managerId, notes });
    return response.data;
  },

  async managerDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/manager-decision`, { decision, comments });
    return response.data;
  },

  async submitForFinanceHead(requestId: string, financeHeadId: string, notes?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/submit-for-finance-head`, { financeHeadId, notes });
    return response.data;
  },

  async financeHeadDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/finance-head-decision`, { decision, comments });
    return response.data;
  },

  async markPayment(requestId: string, data: { paymentStatus: 'PROCESSING' | 'COMPLETED'; paymentReference?: string; notes?: string }) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/mark-payment`, data);
    return response.data;
  },
};

export default financeWorkflowService;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/types.ts frontend/constants.tsx frontend/src/services/it-workflow.service.ts frontend/src/services/finance-workflow.service.ts
git commit -m "feat: add IT/Finance workflow types, status config, and API services"
```

---

### Task 8: Frontend — IT/Finance Workflow Actions in RequestDetail

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

- [ ] **Step 1: Add imports at top of `RequestDetail.tsx`**

```typescript
import itWorkflowService from '../src/services/it-workflow.service';
import financeWorkflowService from '../src/services/finance-workflow.service';
```

- [ ] **Step 2: Add IT workflow action buttons section**

In the RequestDetail component, after the existing HR workflow sections and before the activity/comments section, add a new section that renders conditionally when the request belongs to the IT service desk:

```tsx
{/* IT Workflow Actions */}
{request.serviceDesk?.code === 'IT' && (
  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <h3 className="text-lg font-semibold text-[#101418] mb-4">IT Workflow</h3>

    {request.status === 'SUBMITTED' && user?.roles?.includes('ADMIN') && (
      <button
        onClick={async () => {
          const managerId = prompt('Enter manager user ID for approval:');
          if (managerId) {
            await itWorkflowService.submitForApproval(request.id, managerId);
            window.location.reload();
          }
        }}
        className="px-4 py-2 bg-[#0052cc] text-white rounded-lg hover:bg-blue-700 mr-3"
      >
        Submit for Manager Approval
      </button>
    )}

    {request.status === 'PENDING_MANAGER_APPROVAL_IT' && (
      <div className="flex gap-3">
        <button
          onClick={async () => {
            const comments = prompt('Approval comments (optional):');
            await itWorkflowService.managerDecision(request.id, 'APPROVED', comments || undefined);
            window.location.reload();
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={async () => {
            const comments = prompt('Reason for rejection:');
            if (comments) {
              await itWorkflowService.managerDecision(request.id, 'REJECTED', comments);
              window.location.reload();
            }
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    )}

    {request.status === 'MANAGER_APPROVED_IT' && user?.roles?.includes('ADMIN') && (
      <button
        onClick={async () => {
          const vendor = prompt('Vendor name (optional):');
          const orderNumber = prompt('Order number (optional):');
          await itWorkflowService.markProcurement(request.id, { vendor: vendor || undefined, orderNumber: orderNumber || undefined });
          window.location.reload();
        }}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
      >
        Start Procurement
      </button>
    )}

    {(request.status === 'PROCUREMENT_IN_PROGRESS' || request.status === 'MANAGER_APPROVED_IT') && user?.roles?.includes('ADMIN') && (
      <button
        onClick={async () => {
          const notes = prompt('Fulfilment notes (optional):');
          await itWorkflowService.markFulfilled(request.id, notes || undefined);
          window.location.reload();
        }}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ml-3"
      >
        Mark as Fulfilled
      </button>
    )}
  </div>
)}
```

- [ ] **Step 3: Add Finance workflow action buttons section**

```tsx
{/* Finance Workflow Actions */}
{request.serviceDesk?.code === 'FINANCE' && (
  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <h3 className="text-lg font-semibold text-[#101418] mb-4">Finance Workflow</h3>

    {request.status === 'SUBMITTED' && user?.roles?.includes('ADMIN') && (
      <button
        onClick={async () => {
          const managerId = prompt('Enter manager user ID for approval:');
          if (managerId) {
            await financeWorkflowService.submitForManager(request.id, managerId);
            window.location.reload();
          }
        }}
        className="px-4 py-2 bg-[#0052cc] text-white rounded-lg hover:bg-blue-700"
      >
        Submit for Manager Approval
      </button>
    )}

    {request.status === 'PENDING_MANAGER_APPROVAL_FIN' && (
      <div className="flex gap-3">
        <button
          onClick={async () => {
            const comments = prompt('Approval comments (optional):');
            await financeWorkflowService.managerDecision(request.id, 'APPROVED', comments || undefined);
            window.location.reload();
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={async () => {
            const comments = prompt('Reason for rejection:');
            if (comments) {
              await financeWorkflowService.managerDecision(request.id, 'REJECTED', comments);
              window.location.reload();
            }
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    )}

    {request.status === 'MANAGER_APPROVED_FIN' && user?.roles?.includes('ADMIN') && (
      <button
        onClick={async () => {
          const financeHeadId = prompt('Enter Finance Head user ID:');
          if (financeHeadId) {
            await financeWorkflowService.submitForFinanceHead(request.id, financeHeadId);
            window.location.reload();
          }
        }}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Submit for Finance Head Approval
      </button>
    )}

    {request.status === 'PENDING_FINANCE_HEAD_APPROVAL' && (
      <div className="flex gap-3">
        <button
          onClick={async () => {
            const comments = prompt('Approval comments (optional):');
            await financeWorkflowService.financeHeadDecision(request.id, 'APPROVED', comments || undefined);
            window.location.reload();
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={async () => {
            const comments = prompt('Reason for rejection:');
            if (comments) {
              await financeWorkflowService.financeHeadDecision(request.id, 'REJECTED', comments);
              window.location.reload();
            }
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    )}

    {request.status === 'FINANCE_HEAD_APPROVED' && user?.roles?.includes('ADMIN') && (
      <div className="flex gap-3">
        <button
          onClick={async () => {
            const paymentReference = prompt('Payment reference (optional):');
            await financeWorkflowService.markPayment(request.id, { paymentStatus: 'PROCESSING', paymentReference: paymentReference || undefined });
            window.location.reload();
          }}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          Start Payment Processing
        </button>
      </div>
    )}

    {request.status === 'PAYMENT_PROCESSING' && user?.roles?.includes('ADMIN') && (
      <button
        onClick={async () => {
          const paymentReference = prompt('Payment reference:');
          await financeWorkflowService.markPayment(request.id, { paymentStatus: 'COMPLETED', paymentReference: paymentReference || undefined });
          window.location.reload();
        }}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Mark Payment Completed
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npm run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: add IT and Finance workflow action buttons to request detail"
```

---

## Summary

After completing all 8 tasks:
- IT requests follow: Submitted → Manager Approval → Procurement → Fulfilled/Resolved
- Finance requests follow: Submitted → Manager Approval → Finance Head Approval → Payment Processing → Payment Completed
- Both workflows create activity logs, approval records, and trigger notifications
- HR and Finance categories are seeded with proper request types and SLA hours
- Frontend renders conditional workflow action buttons based on service desk and status
