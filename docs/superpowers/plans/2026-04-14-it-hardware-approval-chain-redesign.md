# IT Hardware Approval Chain Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the IT hardware Manager/VP approval chain with a CEO → CTO → CFO executive approval chain for "Request new hardware" and "Request Software Installation" request types, followed by Finance payment processing and IT delivery completion.

**Architecture:** Extend `it-workflow.controller.ts` with 7 new endpoints. Add 14 new `RequestStatus` enum values to Prisma schema. Add CTO and CFO seed roles/users. Wire up 6 new frontend modal components into `RequestDetail.tsx`.

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL (backend), React 19 + TypeScript + Vite (frontend), Tailwind CSS

---

## File Map

**Backend — create/modify:**
- Modify: `backend/prisma/schema.prisma` — add 14 new `RequestStatus` enum values
- Modify: `backend/prisma/seed.ts` — add CTO and CFO roles and seed users
- Modify: `backend/src/utils/workflowTransitions.ts` — add new transitions
- Modify: `backend/src/controllers/it-workflow.controller.ts` — add 7 new handler functions
- Modify: `backend/src/routes/it-workflow.routes.ts` — register 7 new routes
- Modify: `backend/src/controllers/user.controller.ts` — add `role` query filter to `getAllUsers`

**Frontend — create/modify:**
- Modify: `frontend/types.ts` — add 14 new `RequestStatus` values
- Modify: `frontend/constants.tsx` — add display metadata for 14 new statuses
- Modify: `frontend/src/utils/workflowTransitions.ts` — add new transitions
- Modify: `frontend/src/utils/workflowActions.ts` — add 7 new action types and rules
- Modify: `frontend/src/utils/roleDetection.ts` — add isCEO, isCTO, isCFO checks
- Modify: `frontend/src/services/it-workflow.service.ts` — add 7 new service methods
- Create: `frontend/src/components/request-detail/AcknowledgeModal.tsx`
- Create: `frontend/src/components/request-detail/CeoDecisionModal.tsx`
- Create: `frontend/src/components/request-detail/CtoDecisionModal.tsx`
- Create: `frontend/src/components/request-detail/PendingInvoiceModal.tsx`
- Create: `frontend/src/components/request-detail/CfoDecisionModal.tsx`
- Create: `frontend/src/components/request-detail/PaymentDoneModal.tsx`
- Modify: `frontend/pages/RequestDetail.tsx` — wire up modals, update stepper

---

## Task 1: Add New RequestStatus Enum Values to Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Open the schema and locate the `RequestStatus` enum**

Open `backend/prisma/schema.prisma`. Find the `enum RequestStatus` block (around line 211). It ends after `REIMBURSEMENT_CLOSED`.

- [ ] **Step 2: Add 14 new status values at the end of the IT Workflow section**

In `backend/prisma/schema.prisma`, after the line `SOFTWARE_PROVISIONED`, add:

```prisma
  ACKNOWLEDGED_IT
  PENDING_CEO_APPROVAL_IT
  CEO_APPROVED_IT
  CEO_REJECTED_IT
  PENDING_CTO_APPROVAL_IT
  CTO_APPROVED_IT
  CTO_REJECTED_IT
  PENDING_INVOICE_IT
  PENDING_CFO_APPROVAL_IT
  CFO_APPROVED_IT
  CFO_REJECTED_IT
  PAYMENT_PROCESSING_IT
  PAYMENT_DONE_IT
  PENDING_DELIVERY_IT
```

The IT Workflow section of the enum should now look like:

```prisma
  // IT Workflow
  PENDING_MANAGER_APPROVAL_IT
  MANAGER_APPROVED_IT
  MANAGER_REJECTED_IT
  PENDING_VP_APPROVAL_IT
  VP_APPROVED_IT
  VP_REJECTED_IT
  PROCUREMENT_IN_PROGRESS
  HARDWARE_ORDERED
  HARDWARE_RECEIVED
  SOFTWARE_PROVISIONED
  ACKNOWLEDGED_IT
  PENDING_CEO_APPROVAL_IT
  CEO_APPROVED_IT
  CEO_REJECTED_IT
  PENDING_CTO_APPROVAL_IT
  CTO_APPROVED_IT
  CTO_REJECTED_IT
  PENDING_INVOICE_IT
  PENDING_CFO_APPROVAL_IT
  CFO_APPROVED_IT
  CFO_REJECTED_IT
  PAYMENT_PROCESSING_IT
  PAYMENT_DONE_IT
  PENDING_DELIVERY_IT
```

- [ ] **Step 3: Run the Prisma migration**

```bash
cd backend
npx prisma migrate dev --name add_it_hardware_approval_chain_statuses
```

Expected: migration created and applied successfully, Prisma client regenerated.

- [ ] **Step 4: Verify the Prisma client was regenerated**

```bash
grep "ACKNOWLEDGED_IT\|PENDING_CEO_APPROVAL_IT\|PENDING_DELIVERY_IT" node_modules/@prisma/client/index.d.ts
```

Expected: all three strings found in the output.

- [ ] **Step 5: Commit**

```bash
cd backend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add 14 new IT hardware approval chain status enum values"
```

---

## Task 2: Add CTO and CFO Roles and Seed Users

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Open seed.ts and find the CEO role/user block**

Open `backend/prisma/seed.ts`. Find the `ceoRole` upsert (around line 73) and the CEO user block (around line 138). Use these as the template.

- [ ] **Step 2: Add CTO role upsert after the CEO role upsert**

After the `ceoRole` upsert block (closing `});`), add:

```typescript
    const ctoRole = await prisma.role.upsert({
        where: { name: 'CTO' },
        update: {},
        create: {
            name: 'CTO',
            description: 'Chief Technology Officer with IT approval authority',
        },
    });

    const cfoRole = await prisma.role.upsert({
        where: { name: 'CFO' },
        update: {},
        create: {
            name: 'CFO',
            description: 'Chief Financial Officer with finance approval authority',
        },
    });
```

- [ ] **Step 3: Add CTO and CFO seed users after the CEO user block**

After the `console.log('✅ CEO user created...')` line, add:

```typescript
    // Create CTO User
    const ctoHashedPassword = await bcrypt.hash('cto123', 10);
    const ctoUser = await prisma.user.upsert({
        where: { email: 'cto@company.com' },
        update: {},
        create: {
            email: 'cto@company.com',
            firstName: 'Alex',
            lastName: 'Tech',
            passwordHash: ctoHashedPassword,
            isActive: true,
        },
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: ctoUser.id, roleId: ctoRole.id } },
        update: {},
        create: { userId: ctoUser.id, roleId: ctoRole.id },
    });

    console.log('✅ CTO user created (email: cto@company.com, password: cto123)');

    // Create CFO User
    const cfoHashedPassword = await bcrypt.hash('cfo123', 10);
    const cfoUser = await prisma.user.upsert({
        where: { email: 'cfo@company.com' },
        update: {},
        create: {
            email: 'cfo@company.com',
            firstName: 'Jordan',
            lastName: 'Finance',
            passwordHash: cfoHashedPassword,
            isActive: true,
        },
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: cfoUser.id, roleId: cfoRole.id } },
        update: {},
        create: { userId: cfoUser.id, roleId: cfoRole.id },
    });

    console.log('✅ CFO user created (email: cfo@company.com, password: cfo123)');
```

- [ ] **Step 4: Run the seed**

```bash
cd backend
npm run prisma:seed
```

Expected output includes:
```
✅ CTO user created (email: cto@company.com, password: cto123)
✅ CFO user created (email: cfo@company.com, password: cfo123)
🎉 Database seeding completed!
```

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add CTO and CFO roles and seed users"
```

---

## Task 3: Add role Filter to Users Endpoint

**Files:**
- Modify: `backend/src/controllers/user.controller.ts`

The `AcknowledgeModal` and `PendingInvoiceModal` need to fetch users filtered by role (CEO, CFO). The current `getAllUsers` controller does not support a `role` query param.

- [ ] **Step 1: Open user.controller.ts and find the getAllUsers method**

Open `backend/src/controllers/user.controller.ts`. Find `getAllUsers` (around line 130). The destructured query params are `page, limit, search, department, isActive`.

- [ ] **Step 2: Add `role` to the destructured query params**

Change:
```typescript
        const {
            page = '1',
            limit = '10',
            search,
            department,
            isActive,
        } = req.query;
```

To:
```typescript
        const {
            page = '1',
            limit = '10',
            search,
            department,
            isActive,
            role,
        } = req.query;
```

- [ ] **Step 3: Add role filter to the where clause**

After the `if (isActive !== undefined)` block, add:

```typescript
        if (role) {
            where.roles = {
                some: {
                    role: { name: role as string },
                },
            };
        }
```

- [ ] **Step 4: Verify by running the backend and testing**

```bash
cd backend
npm run dev
```

In a separate terminal:
```bash
curl -s "http://localhost:3000/api/v1/users?role=CEO" -H "Authorization: Bearer <admin_token>" | grep -i "ceo\|email"
```

Expected: response includes the CEO user.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/user.controller.ts
git commit -m "feat: add role query filter to getAllUsers endpoint"
```

---

## Task 4: Update Backend workflowTransitions.ts

**Files:**
- Modify: `backend/src/utils/workflowTransitions.ts`

- [ ] **Step 1: Open the file and add new transitions**

Open `backend/src/utils/workflowTransitions.ts`. After the `SOFTWARE_PROVISIONED: ['RESOLVED'],` line, add:

```typescript
  // IT Hardware Executive Approval Chain
  ACKNOWLEDGED_IT: ['PENDING_CEO_APPROVAL_IT'],
  PENDING_CEO_APPROVAL_IT: ['CEO_APPROVED_IT', 'CEO_REJECTED_IT'],
  CEO_APPROVED_IT: ['PENDING_CTO_APPROVAL_IT'],
  CEO_REJECTED_IT: ['REJECTED'],
  PENDING_CTO_APPROVAL_IT: ['CTO_APPROVED_IT', 'CTO_REJECTED_IT'],
  CTO_APPROVED_IT: ['PENDING_INVOICE_IT'],
  CTO_REJECTED_IT: ['REJECTED'],
  PENDING_INVOICE_IT: ['PENDING_CFO_APPROVAL_IT'],
  PENDING_CFO_APPROVAL_IT: ['CFO_APPROVED_IT', 'CFO_REJECTED_IT'],
  CFO_APPROVED_IT: ['PAYMENT_PROCESSING_IT'],
  CFO_REJECTED_IT: ['REJECTED'],
  PAYMENT_PROCESSING_IT: ['PAYMENT_DONE_IT'],
  PAYMENT_DONE_IT: ['PENDING_DELIVERY_IT'],
  PENDING_DELIVERY_IT: ['RESOLVED'],
```

Also update the `SUBMITTED` entry to include `ACKNOWLEDGED_IT`:

Change:
```typescript
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL_IT', 'PENDING_MANAGER_APPROVAL_FIN'],
```

To:
```typescript
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL_IT', 'PENDING_MANAGER_APPROVAL_FIN', 'ACKNOWLEDGED_IT'],
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/workflowTransitions.ts
git commit -m "feat: add IT hardware approval chain transitions to backend workflowTransitions"
```

---

## Task 5: Add New Backend Endpoints — Controller

**Files:**
- Modify: `backend/src/controllers/it-workflow.controller.ts`

- [ ] **Step 1: Add the `acknowledgeRequest` handler at the end of the file**

Open `backend/src/controllers/it-workflow.controller.ts`. At the end of the file, add:

```typescript
export const acknowledgeRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ceoId, notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!ceoId || !uuidRegex.test(ceoId)) {
      return res.status(400).json({ error: 'Invalid ceoId: must be a valid UUID' });
    }

    const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.serviceDesk.code !== 'IT') return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    if (request.status !== 'SUBMITTED') return res.status(400).json({ error: 'Request must be in SUBMITTED status' });

    const ceoUser = await prisma.user.findUnique({
      where: { id: ceoId },
      include: { roles: { include: { role: true } } },
    });
    if (!ceoUser) return res.status(404).json({ error: 'CEO user not found' });
    const hasCeoRole = ceoUser.roles.some((r: any) => r.role?.name === 'CEO');
    if (!hasCeoRole) return res.status(400).json({ error: 'Selected user does not have CEO role' });

    await prisma.request.update({ where: { id }, data: { status: 'PENDING_CEO_APPROVAL_IT' } });

    await prisma.requestApproval.create({
      data: {
        requestId: id,
        approverType: 'CEO',
        approverId: ceoId,
        status: 'PENDING',
        comments: notes || null,
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Request acknowledged. Routed to CEO for approval${notes ? ': ' + notes : ''}`,
        authorName: currentUser.firstName || 'Agent',
        authorRole: 'AGENT',
        isSystemGenerated: false,
      },
    });

    await notify({ userId: ceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CEO' }, relatedRequestId: id });

    return res.json({ success: true, message: 'Request acknowledged and routed to CEO' });
  } catch (error) {
    console.error('acknowledgeRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Add the `ceoDecision` handler**

```typescript
export const ceoDecision = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CEO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CEO approval' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'PENDING_CTO_APPROVAL_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CEO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null },
      });

      await prisma.requestApproval.create({
        data: { requestId: id, approverType: 'CTO', status: 'PENDING', comments: null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'APPROVAL',
          message: `CEO approved the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'CEO',
          authorRole: 'CEO',
          isSystemGenerated: false,
        },
      });

      const ctoUsers = await prisma.user.findMany({ where: { roles: { some: { role: { name: 'CTO' } } } } });
      for (const cto of ctoUsers) {
        await notify({ userId: cto.id, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CTO' }, relatedRequestId: id });
      }
    } else {
      await prisma.request.update({ where: { id }, data: { status: 'REJECTED', resolvedAt: new Date() } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CEO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'REJECTION',
          message: `CEO rejected the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'CEO',
          authorRole: 'CEO',
          isSystemGenerated: false,
        },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'REQUEST_REJECTED', variables: { requestId: id, rejectedBy: 'CEO', comments: comments || '' }, relatedRequestId: id });
      }
    }

    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by CEO` });
  } catch (error) {
    console.error('ceoDecision error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 3: Add the `ctoDecision` handler**

```typescript
export const ctoDecision = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CTO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CTO approval' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'PENDING_INVOICE_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CTO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'APPROVAL',
          message: `CTO approved the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'CTO',
          authorRole: 'CTO',
          isSystemGenerated: false,
        },
      });

      const agentUsers = await prisma.user.findMany({ where: { roles: { some: { role: { name: { in: ['ADMIN', 'AGENT'] } } } } }, take: 5 });
      for (const agent of agentUsers) {
        await notify({ userId: agent.id, eventType: 'ACTION_REQUIRED', variables: { requestId: id, action: 'pending_invoice' }, relatedRequestId: id });
      }
    } else {
      await prisma.request.update({ where: { id }, data: { status: 'REJECTED', resolvedAt: new Date() } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CTO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'REJECTION',
          message: `CTO rejected the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'CTO',
          authorRole: 'CTO',
          isSystemGenerated: false,
        },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'REQUEST_REJECTED', variables: { requestId: id, rejectedBy: 'CTO', comments: comments || '' }, relatedRequestId: id });
      }
    }

    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by CTO` });
  } catch (error) {
    console.error('ctoDecision error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 4: Add the `routeToCfoApproval` handler**

```typescript
export const routeToCfoApproval = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cfoId, notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!cfoId || !uuidRegex.test(cfoId)) {
      return res.status(400).json({ error: 'Invalid cfoId: must be a valid UUID' });
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_INVOICE_IT') return res.status(400).json({ error: 'Request must be in PENDING_INVOICE_IT status' });

    const cfoUser = await prisma.user.findUnique({
      where: { id: cfoId },
      include: { roles: { include: { role: true } } },
    });
    if (!cfoUser) return res.status(404).json({ error: 'CFO user not found' });
    const hasCfoRole = (cfoUser as any).roles.some((r: any) => r.role?.name === 'CFO');
    if (!hasCfoRole) return res.status(400).json({ error: 'Selected user does not have CFO role' });

    await prisma.request.update({ where: { id }, data: { status: 'PENDING_CFO_APPROVAL_IT' } });

    await prisma.requestApproval.create({
      data: {
        requestId: id,
        approverType: 'CFO',
        approverId: cfoId,
        status: 'PENDING',
        comments: notes || null,
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Invoice pending. Routed to CFO for approval${notes ? ': ' + notes : ''}`,
        authorName: currentUser.firstName || 'Agent',
        authorRole: 'AGENT',
        isSystemGenerated: false,
      },
    });

    await notify({ userId: cfoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });

    return res.json({ success: true, message: 'Request routed to CFO for approval' });
  } catch (error) {
    console.error('routeToCfoApproval error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 5: Add the `cfoDecision` handler**

```typescript
export const cfoDecision = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CFO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CFO approval' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'PAYMENT_PROCESSING_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'APPROVAL',
          message: `CFO approved the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'CFO',
          authorRole: 'CFO',
          isSystemGenerated: false,
        },
      });

      const agentUsers = await prisma.user.findMany({ where: { roles: { some: { role: { name: { in: ['ADMIN', 'AGENT'] } } } } }, take: 5 });
      for (const agent of agentUsers) {
        await notify({ userId: agent.id, eventType: 'ACTION_REQUIRED', variables: { requestId: id, action: 'payment_processing' }, relatedRequestId: id });
      }
    } else {
      await prisma.request.update({ where: { id }, data: { status: 'REJECTED', resolvedAt: new Date() } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'REJECTION',
          message: `CFO rejected the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'CFO',
          authorRole: 'CFO',
          isSystemGenerated: false,
        },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'REQUEST_REJECTED', variables: { requestId: id, rejectedBy: 'CFO', comments: comments || '' }, relatedRequestId: id });
      }
    }

    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by CFO` });
  } catch (error) {
    console.error('cfoDecision error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 6: Add the `markPaymentDone` handler**

```typescript
export const markPaymentDone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentReference, amount, paymentDate, notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!paymentReference) return res.status(400).json({ error: 'paymentReference is required' });
    if (amount === undefined || amount === null) return res.status(400).json({ error: 'amount is required' });
    if (!paymentDate) return res.status(400).json({ error: 'paymentDate is required' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PAYMENT_PROCESSING_IT') return res.status(400).json({ error: 'Request must be in PAYMENT_PROCESSING_IT status' });

    const existingCustomFields = (request.customFields as Record<string, unknown>) || {};

    await prisma.request.update({
      where: { id },
      data: {
        status: 'PENDING_DELIVERY_IT',
        customFields: {
          ...existingCustomFields,
          payment: { paymentReference, amount, paymentDate, completedAt: new Date().toISOString() },
        },
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Payment completed. Reference: ${paymentReference}, Amount: ${amount}${notes ? '. ' + notes : ''}`,
        authorName: currentUser.firstName || 'Finance Agent',
        authorRole: 'AGENT',
        isSystemGenerated: false,
        metadata: { paymentReference, amount, paymentDate, notes },
      },
    });

    const agentUsers = await prisma.user.findMany({ where: { roles: { some: { role: { name: { in: ['ADMIN', 'AGENT'] } } } } }, take: 5 });
    for (const agent of agentUsers) {
      await notify({ userId: agent.id, eventType: 'ACTION_REQUIRED', variables: { requestId: id, action: 'pending_delivery' }, relatedRequestId: id });
    }

    return res.json({ success: true, message: 'Payment marked as done, request routed to pending delivery' });
  } catch (error) {
    console.error('markPaymentDone error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 7: Add the `completeDelivery` handler**

```typescript
export const completeDelivery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_DELIVERY_IT') return res.status(400).json({ error: 'Request must be in PENDING_DELIVERY_IT status' });

    await prisma.request.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: notes ? `Hardware delivered and request resolved: ${notes}` : 'Hardware delivered. Request resolved.',
        authorName: currentUser.firstName || 'IT Agent',
        authorRole: 'AGENT',
        isSystemGenerated: false,
      },
    });

    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'REQUEST_RESOLVED', variables: { requestId: id }, relatedRequestId: id });
    }

    return res.json({ success: true, message: 'Delivery completed and request resolved' });
  } catch (error) {
    console.error('completeDelivery error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd backend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/controllers/it-workflow.controller.ts
git commit -m "feat: add acknowledge, ceoDecision, ctoDecision, routeToCfoApproval, cfoDecision, markPaymentDone, completeDelivery handlers"
```

---

## Task 6: Register New Routes

**Files:**
- Modify: `backend/src/routes/it-workflow.routes.ts`

- [ ] **Step 1: Add imports for the new handlers**

Open `backend/src/routes/it-workflow.routes.ts`. Update the import from `it-workflow.controller`:

```typescript
import {
  submitForApproval,
  managerDecision,
  markProcurement,
  markFulfilled,
  markHardwareOrdered,
  markHardwareReceived,
  markSoftwareProvisioned,
  vpDecision,
  resubmitRequest,
  getSuggestedManager,
  acknowledgeRequest,
  ceoDecision,
  ctoDecision,
  routeToCfoApproval,
  cfoDecision,
  markPaymentDone,
  completeDelivery,
} from '../controllers/it-workflow.controller';
```

- [ ] **Step 2: Register the 7 new routes**

After the existing `router.get('/requests/:id/suggested-manager', getSuggestedManager);` line, add:

```typescript
// IT Hardware Executive Approval Chain
router.post('/requests/:id/acknowledge', authorize('ADMIN', 'AGENT'), acknowledgeRequest);
router.post('/requests/:id/ceo-decision', authorize('CEO'), ceoDecision);
router.post('/requests/:id/cto-decision', authorize('CTO'), ctoDecision);
router.post('/requests/:id/route-to-cfo', authorize('ADMIN', 'AGENT'), routeToCfoApproval);
router.post('/requests/:id/cfo-decision', authorize('CFO'), cfoDecision);
router.post('/requests/:id/payment-done', authorize('ADMIN', 'AGENT'), markPaymentDone);
router.post('/requests/:id/complete-delivery', authorize('ADMIN', 'AGENT'), completeDelivery);
```

- [ ] **Step 3: Build and verify**

```bash
cd backend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/it-workflow.routes.ts
git commit -m "feat: register 7 new IT hardware approval chain routes"
```

---

## Task 7: Frontend — Types, Constants, Transitions

**Files:**
- Modify: `frontend/types.ts`
- Modify: `frontend/constants.tsx`
- Modify: `frontend/src/utils/workflowTransitions.ts`

- [ ] **Step 1: Add 14 new values to the RequestStatus enum in frontend/types.ts**

Open `frontend/types.ts`. Find the `RequestStatus` enum. After `SOFTWARE_PROVISIONED`, add:

```typescript
  ACKNOWLEDGED_IT = 'ACKNOWLEDGED_IT',
  PENDING_CEO_APPROVAL_IT = 'PENDING_CEO_APPROVAL_IT',
  CEO_APPROVED_IT = 'CEO_APPROVED_IT',
  CEO_REJECTED_IT = 'CEO_REJECTED_IT',
  PENDING_CTO_APPROVAL_IT = 'PENDING_CTO_APPROVAL_IT',
  CTO_APPROVED_IT = 'CTO_APPROVED_IT',
  CTO_REJECTED_IT = 'CTO_REJECTED_IT',
  PENDING_INVOICE_IT = 'PENDING_INVOICE_IT',
  PENDING_CFO_APPROVAL_IT = 'PENDING_CFO_APPROVAL_IT',
  CFO_APPROVED_IT = 'CFO_APPROVED_IT',
  CFO_REJECTED_IT = 'CFO_REJECTED_IT',
  PAYMENT_PROCESSING_IT = 'PAYMENT_PROCESSING_IT',
  PAYMENT_DONE_IT = 'PAYMENT_DONE_IT',
  PENDING_DELIVERY_IT = 'PENDING_DELIVERY_IT',
```

- [ ] **Step 2: Add display metadata to frontend/constants.tsx**

Open `frontend/constants.tsx`. Find the `REQUEST_STATUS_CONFIG` object. After the entry for `SOFTWARE_PROVISIONED`, add:

```typescript
  [RequestStatus.ACKNOWLEDGED_IT]: { label: 'Acknowledged', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'check_circle' },
  [RequestStatus.PENDING_CEO_APPROVAL_IT]: { label: 'Pending CEO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CEO_APPROVED_IT]: { label: 'CEO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CEO_REJECTED_IT]: { label: 'CEO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_CTO_APPROVAL_IT]: { label: 'Pending CTO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CTO_APPROVED_IT]: { label: 'CTO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CTO_REJECTED_IT]: { label: 'CTO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_INVOICE_IT]: { label: 'Pending Invoice', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'receipt' },
  [RequestStatus.PENDING_CFO_APPROVAL_IT]: { label: 'Pending CFO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CFO_APPROVED_IT]: { label: 'CFO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CFO_REJECTED_IT]: { label: 'CFO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PAYMENT_PROCESSING_IT]: { label: 'Payment Processing', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'payments' },
  [RequestStatus.PAYMENT_DONE_IT]: { label: 'Payment Done', color: 'text-green-700', bg: 'bg-green-100', icon: 'paid' },
  [RequestStatus.PENDING_DELIVERY_IT]: { label: 'Pending Delivery', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'local_shipping' },
```

- [ ] **Step 3: Add transitions to frontend/src/utils/workflowTransitions.ts**

Open `frontend/src/utils/workflowTransitions.ts`. After `SOFTWARE_PROVISIONED: ['RESOLVED'],`, add:

```typescript
  ACKNOWLEDGED_IT: ['PENDING_CEO_APPROVAL_IT'],
  PENDING_CEO_APPROVAL_IT: ['CEO_APPROVED_IT', 'CEO_REJECTED_IT'],
  CEO_APPROVED_IT: ['PENDING_CTO_APPROVAL_IT'],
  CEO_REJECTED_IT: ['REJECTED'],
  PENDING_CTO_APPROVAL_IT: ['CTO_APPROVED_IT', 'CTO_REJECTED_IT'],
  CTO_APPROVED_IT: ['PENDING_INVOICE_IT'],
  CTO_REJECTED_IT: ['REJECTED'],
  PENDING_INVOICE_IT: ['PENDING_CFO_APPROVAL_IT'],
  PENDING_CFO_APPROVAL_IT: ['CFO_APPROVED_IT', 'CFO_REJECTED_IT'],
  CFO_APPROVED_IT: ['PAYMENT_PROCESSING_IT'],
  CFO_REJECTED_IT: ['REJECTED'],
  PAYMENT_PROCESSING_IT: ['PAYMENT_DONE_IT'],
  PAYMENT_DONE_IT: ['PENDING_DELIVERY_IT'],
  PENDING_DELIVERY_IT: ['RESOLVED'],
```

Also update `SUBMITTED` to include `ACKNOWLEDGED_IT`:

Change:
```typescript
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED'],
```

To:
```typescript
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'ACKNOWLEDGED_IT'],
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add ../frontend/types.ts ../frontend/constants.tsx ../frontend/src/utils/workflowTransitions.ts
git commit -m "feat: add 14 new IT approval chain statuses to frontend types, constants, transitions"
```

---

## Task 8: Frontend — workflowActions.ts and roleDetection.ts

**Files:**
- Modify: `frontend/src/utils/workflowActions.ts`
- Modify: `frontend/src/utils/roleDetection.ts`

- [ ] **Step 1: Add new WorkflowActionType values**

Open `frontend/src/utils/workflowActions.ts`. Update the `WorkflowActionType` union type:

```typescript
export type WorkflowActionType =
  | 'SUBMIT_FOR_APPROVAL'
  | 'APPROVE'
  | 'REJECT'
  | 'START_PROCUREMENT'
  | 'MARK_HARDWARE_ORDERED'
  | 'MARK_HARDWARE_RECEIVED'
  | 'MARK_SOFTWARE_PROVISIONED'
  | 'MARK_FULFILLED'
  | 'ASSIGN'
  | 'VP_DECISION'
  | 'RESUBMIT_REQUEST'
  | 'ACKNOWLEDGE_IT'
  | 'CEO_DECISION'
  | 'CTO_DECISION'
  | 'PENDING_INVOICE'
  | 'CFO_DECISION'
  | 'PAYMENT_DONE'
  | 'COMPLETE_DELIVERY';
```

- [ ] **Step 2: Update PROCUREMENT_REQUEST_TYPES**

In `workflowActions.ts`, the constant is already:
```typescript
const PROCUREMENT_REQUEST_TYPES = [
  'Request new hardware',
  'Request Software Installation',
];
```

Verify it includes both. No change needed if already correct.

- [ ] **Step 3: Add new action rules in getWorkflowActions()**

In the `getWorkflowActions` function, after the existing `if (isRequester && status === 'MANAGER_REJECTED_IT')` block, add:

```typescript
  // IT Hardware Executive Approval Chain
  if (canAct && status === 'SUBMITTED' && isProcurement) {
    // Replace the old SUBMIT_FOR_APPROVAL action — remove it first
    const idx = actions.findIndex(a => a.type === 'SUBMIT_FOR_APPROVAL');
    if (idx !== -1) actions.splice(idx, 1);
    actions.push({
      type: 'ACKNOWLEDGE_IT',
      label: 'Acknowledge & Route to CEO',
      description: 'Acknowledge this request and route it to the CEO for approval.',
      variant: 'primary',
    });
  }

  if (userRoles.includes('CEO') && status === 'PENDING_CEO_APPROVAL_IT') {
    actions.push({
      type: 'CEO_DECISION',
      label: 'CEO Approval Decision',
      description: 'Review and approve or reject this request as CEO.',
      variant: 'primary',
    });
  }

  if (userRoles.includes('CTO') && status === 'PENDING_CTO_APPROVAL_IT') {
    actions.push({
      type: 'CTO_DECISION',
      label: 'CTO Approval Decision',
      description: 'Review and approve or reject this request as CTO.',
      variant: 'primary',
    });
  }

  if (canAct && status === 'PENDING_INVOICE_IT') {
    actions.push({
      type: 'PENDING_INVOICE',
      label: 'Route to CFO for Approval',
      description: 'Select CFO and route this request for CFO approval.',
      variant: 'warning',
    });
  }

  if (userRoles.includes('CFO') && status === 'PENDING_CFO_APPROVAL_IT') {
    actions.push({
      type: 'CFO_DECISION',
      label: 'CFO Approval Decision',
      description: 'Review and approve or reject this request as CFO.',
      variant: 'primary',
    });
  }

  if (canAct && status === 'PAYMENT_PROCESSING_IT') {
    actions.push({
      type: 'PAYMENT_DONE',
      label: 'Mark Payment Done',
      description: 'Enter payment details and mark payment as completed.',
      variant: 'success',
    });
  }

  if (canAct && status === 'PENDING_DELIVERY_IT') {
    actions.push({
      type: 'COMPLETE_DELIVERY',
      label: 'Complete Delivery',
      description: 'Confirm hardware has been delivered to the requester.',
      variant: 'success',
    });
  }
```

- [ ] **Step 4: Update roleDetection.ts**

Open `frontend/src/utils/roleDetection.ts`. Update the `detectRequestRole` function to recognise CTO and CFO:

Change:
```typescript
  if (userRoles.includes('CEO') && (requestStatus === 'PENDING_CEO_APPROVAL' || requestStatus === 'PENDING_MANAGER_APPROVAL_IT')) {
    return 'ceo';
  }
```

To:
```typescript
  if (userRoles.includes('CEO') && (requestStatus === 'PENDING_CEO_APPROVAL' || requestStatus === 'PENDING_MANAGER_APPROVAL_IT' || requestStatus === 'PENDING_CEO_APPROVAL_IT')) {
    return 'ceo';
  }

  if (userRoles.includes('CTO') && requestStatus === 'PENDING_CTO_APPROVAL_IT') {
    return 'cto' as any;
  }

  if (userRoles.includes('CFO') && requestStatus === 'PENDING_CFO_APPROVAL_IT') {
    return 'cfo' as any;
  }
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/workflowActions.ts src/utils/roleDetection.ts
git commit -m "feat: add new IT approval chain actions and role detection helpers"
```

---

## Task 9: Frontend — it-workflow.service.ts

**Files:**
- Modify: `frontend/src/services/it-workflow.service.ts`

- [ ] **Step 1: Add 7 new service methods**

Open `frontend/src/services/it-workflow.service.ts`. Before the closing `};`, add:

```typescript
  async acknowledgeRequest(requestId: string, ceoId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/acknowledge`, { ceoId, notes });
    return response.data;
  },
  async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/ceo-decision`, { decision, comments });
    return response.data;
  },
  async ctoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/cto-decision`, { decision, comments });
    return response.data;
  },
  async routeToCfoApproval(requestId: string, cfoId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/route-to-cfo`, { cfoId, notes });
    return response.data;
  },
  async cfoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/cfo-decision`, { decision, comments });
    return response.data;
  },
  async markPaymentDone(requestId: string, data: { paymentReference: string; amount: number; paymentDate: string; notes?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/payment-done`, data);
    return response.data;
  },
  async completeDelivery(requestId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/complete-delivery`, { notes });
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/it-workflow.service.ts
git commit -m "feat: add 7 new IT approval chain service methods and getUsersByRole"
```

---

## Task 10: Create AcknowledgeModal and CeoDecisionModal

**Files:**
- Create: `frontend/src/components/request-detail/AcknowledgeModal.tsx`
- Create: `frontend/src/components/request-detail/CeoDecisionModal.tsx`

- [ ] **Step 1: Create AcknowledgeModal.tsx**

Create `frontend/src/components/request-detail/AcknowledgeModal.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AcknowledgeModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const AcknowledgeModal: React.FC<AcknowledgeModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [ceoUsers, setCeoUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    itWorkflowService.getUsersByRole('CEO')
      .then(users => { setCeoUsers(users); setFiltered(users); })
      .catch(() => setError('Failed to load CEO users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(ceoUsers.filter(u =>
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    ));
  }, [search, ceoUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.acknowledgeRequest(requestId, selectedId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">check_circle</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Acknowledge & Route to CEO</h2>
            <p className="text-xs text-gray-500">IT Workflow · Select CEO for approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Search CEO
              </label>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Select CEO <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading CEO users…</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No CEO users found</p>
                  ) : (
                    filtered.map(u => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                          selectedId === u.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="ceo"
                          value={u.id}
                          checked={selectedId === u.id}
                          onChange={() => setSelectedId(u.id)}
                          className="accent-[#0052cc] w-4 h-4 flex-shrink-0"
                        />
                        <div className="size-8 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any context for the CEO…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
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
              disabled={!selectedId || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Routing…' : 'Acknowledge & Route to CEO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AcknowledgeModal;
```

- [ ] **Step 2: Create CeoDecisionModal.tsx**

Create `frontend/src/components/request-detail/CeoDecisionModal.tsx`:

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface CeoDecisionModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CeoDecisionModal: React.FC<CeoDecisionModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.ceoDecision(requestId, decision, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${decision.toLowerCase()} request`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-amber-50">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">verified_user</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">CEO Approval Decision</h2>
            <p className="text-xs text-gray-500">IT Workflow · CEO Approval Required</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Add any comments for the requester or agent…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => handleDecision('REJECTED')}
            disabled={submitting}
            className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
          <button
            onClick={() => handleDecision('APPROVED')}
            disabled={submitting}
            className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CeoDecisionModal;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/request-detail/AcknowledgeModal.tsx src/components/request-detail/CeoDecisionModal.tsx
git commit -m "feat: add AcknowledgeModal and CeoDecisionModal components"
```

---

## Task 11: Create CtoDecisionModal, PendingInvoiceModal, CfoDecisionModal

**Files:**
- Create: `frontend/src/components/request-detail/CtoDecisionModal.tsx`
- Create: `frontend/src/components/request-detail/PendingInvoiceModal.tsx`
- Create: `frontend/src/components/request-detail/CfoDecisionModal.tsx`

- [ ] **Step 1: Create CtoDecisionModal.tsx**

Create `frontend/src/components/request-detail/CtoDecisionModal.tsx`:

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface CtoDecisionModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CtoDecisionModal: React.FC<CtoDecisionModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.ctoDecision(requestId, decision, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${decision.toLowerCase()} request`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-amber-50">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">engineering</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">CTO Approval Decision</h2>
            <p className="text-xs text-gray-500">IT Workflow · CTO Approval Required</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Add any comments…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => handleDecision('REJECTED')} disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
          <button onClick={() => handleDecision('APPROVED')} disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CtoDecisionModal;
```

- [ ] **Step 2: Create PendingInvoiceModal.tsx**

Create `frontend/src/components/request-detail/PendingInvoiceModal.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PendingInvoiceModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PendingInvoiceModal: React.FC<PendingInvoiceModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [cfoUsers, setCfoUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    itWorkflowService.getUsersByRole('CFO')
      .then(users => { setCfoUsers(users); setFiltered(users); })
      .catch(() => setError('Failed to load CFO users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(cfoUsers.filter(u =>
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    ));
  }, [search, cfoUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.routeToCfoApproval(requestId, selectedId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to route to CFO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-purple-700">receipt</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Route to CFO for Approval</h2>
            <p className="text-xs text-gray-500">IT Workflow · Select CFO for invoice approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Search CFO</label>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Select CFO <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading CFO users…</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No CFO users found</p>
                  ) : (
                    filtered.map(u => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                          selectedId === u.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input type="radio" name="cfo" value={u.id} checked={selectedId === u.id} onChange={() => setSelectedId(u.id)} className="accent-purple-600 w-4 h-4 flex-shrink-0" />
                        <div className="size-8 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any context for the CFO…" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!selectedId || submitting} className="px-4 py-3 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {submitting ? 'Routing…' : 'Route to CFO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PendingInvoiceModal;
```

- [ ] **Step 3: Create CfoDecisionModal.tsx**

Create `frontend/src/components/request-detail/CfoDecisionModal.tsx`:

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface CfoDecisionModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CfoDecisionModal: React.FC<CfoDecisionModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.cfoDecision(requestId, decision, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${decision.toLowerCase()} request`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-amber-50">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">account_balance</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">CFO Approval Decision</h2>
            <p className="text-xs text-gray-500">IT Workflow · CFO Approval Required</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Add any comments…" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => handleDecision('REJECTED')} disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
          <button onClick={() => handleDecision('APPROVED')} disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CfoDecisionModal;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/request-detail/CtoDecisionModal.tsx src/components/request-detail/PendingInvoiceModal.tsx src/components/request-detail/CfoDecisionModal.tsx
git commit -m "feat: add CtoDecisionModal, PendingInvoiceModal, CfoDecisionModal components"
```

---

## Task 12: Create PaymentDoneModal

**Files:**
- Create: `frontend/src/components/request-detail/PaymentDoneModal.tsx`

- [ ] **Step 1: Create PaymentDoneModal.tsx**

Create `frontend/src/components/request-detail/PaymentDoneModal.tsx`:

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface PaymentDoneModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PaymentDoneModal: React.FC<PaymentDoneModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [paymentReference, setPaymentReference] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentReference || !amount || !paymentDate) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markPaymentDone(requestId, {
        paymentReference,
        amount: parseFloat(amount),
        paymentDate,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark payment done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-700">payments</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Mark Payment Done</h2>
            <p className="text-xs text-gray-500">IT Workflow · Enter payment details</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Payment Reference <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder="e.g. INV-2026-001"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Amount (USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional payment notes…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={!paymentReference || !amount || !paymentDate || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Mark Payment Done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentDoneModal;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/request-detail/PaymentDoneModal.tsx
git commit -m "feat: add PaymentDoneModal component"
```

---

## Task 13: Wire Up Modals and Update Stepper in RequestDetail.tsx

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

- [ ] **Step 1: Add imports for the 6 new modals**

Open `frontend/pages/RequestDetail.tsx`. Find the existing modal imports (e.g. `import SubmitForApprovalModal`). Add after them:

```typescript
import AcknowledgeModal from '../src/components/request-detail/AcknowledgeModal';
import CeoDecisionModal from '../src/components/request-detail/CeoDecisionModal';
import CtoDecisionModal from '../src/components/request-detail/CtoDecisionModal';
import PendingInvoiceModal from '../src/components/request-detail/PendingInvoiceModal';
import CfoDecisionModal from '../src/components/request-detail/CfoDecisionModal';
import PaymentDoneModal from '../src/components/request-detail/PaymentDoneModal';
```

- [ ] **Step 2: Add modal state variables**

Find the existing modal state variables (e.g. `const [showCEODecisionModal, setShowCEODecisionModal] = useState(false);`). Add after them:

```typescript
const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
const [showCeoDecisionModal_IT, setShowCeoDecisionModal_IT] = useState(false);
const [showCtoDecisionModal, setShowCtoDecisionModal] = useState(false);
const [showPendingInvoiceModal, setShowPendingInvoiceModal] = useState(false);
const [showCfoDecisionModal, setShowCfoDecisionModal] = useState(false);
const [showPaymentDoneModal, setShowPaymentDoneModal] = useState(false);
```

- [ ] **Step 3: Add handler functions**

Find the existing handler functions (e.g. `handleRouteToCEO`, `handleCEODecision`). Add after them:

```typescript
const handleAcknowledgeSuccess = () => {
  setShowAcknowledgeModal(false);
  fetchRequest();
};

const handleCeoDecisionITSuccess = () => {
  setShowCeoDecisionModal_IT(false);
  fetchRequest();
};

const handleCtoDecisionSuccess = () => {
  setShowCtoDecisionModal(false);
  fetchRequest();
};

const handlePendingInvoiceSuccess = () => {
  setShowPendingInvoiceModal(false);
  fetchRequest();
};

const handleCfoDecisionSuccess = () => {
  setShowCfoDecisionModal(false);
  fetchRequest();
};

const handlePaymentDoneSuccess = () => {
  setShowPaymentDoneModal(false);
  fetchRequest();
};
```

- [ ] **Step 4: Wire action buttons in the "Next Action Required" sidebar**

Find the section in `RequestDetail.tsx` where workflow action buttons are rendered (around line 1193+, near comments like `{/* Route to CEO */}`). Add these blocks in the appropriate location alongside existing action buttons:

```tsx
{/* Acknowledge & Route to CEO — new IT hardware chain */}
{request.status === 'SUBMITTED' && isProcurementRequest(request.requestType?.name || '') && (user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT')) && (
  <button
    onClick={() => setShowAcknowledgeModal(true)}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-xl hover:bg-blue-700"
  >
    Acknowledge & Route to CEO
  </button>
)}

{/* CEO Approval Decision — IT hardware chain */}
{request.status === 'PENDING_CEO_APPROVAL_IT' && user?.roles?.includes('CEO') && (
  <button
    onClick={() => setShowCeoDecisionModal_IT(true)}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600"
  >
    CEO Approval Decision
  </button>
)}

{/* CTO Approval Decision */}
{request.status === 'PENDING_CTO_APPROVAL_IT' && user?.roles?.includes('CTO') && (
  <button
    onClick={() => setShowCtoDecisionModal(true)}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600"
  >
    CTO Approval Decision
  </button>
)}

{/* Route to CFO */}
{request.status === 'PENDING_INVOICE_IT' && (user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT')) && (
  <button
    onClick={() => setShowPendingInvoiceModal(true)}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700"
  >
    Route to CFO for Approval
  </button>
)}

{/* CFO Approval Decision */}
{request.status === 'PENDING_CFO_APPROVAL_IT' && user?.roles?.includes('CFO') && (
  <button
    onClick={() => setShowCfoDecisionModal(true)}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600"
  >
    CFO Approval Decision
  </button>
)}

{/* Mark Payment Done */}
{request.status === 'PAYMENT_PROCESSING_IT' && (user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT')) && (
  <button
    onClick={() => setShowPaymentDoneModal(true)}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700"
  >
    Mark Payment Done
  </button>
)}

{/* Complete Delivery */}
{request.status === 'PENDING_DELIVERY_IT' && (user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT')) && (
  <button
    onClick={async () => {
      try {
        await itWorkflowService.completeDelivery(request.id);
        fetchRequest();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to complete delivery');
      }
    }}
    className="w-full px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700"
  >
    Complete Delivery
  </button>
)}
```

- [ ] **Step 5: Add the import for itWorkflowService if not already imported**

Check if `itWorkflowService` is already imported at the top of `RequestDetail.tsx`. If not, add:

```typescript
import itWorkflowService from '../src/services/it-workflow.service';
```

- [ ] **Step 6: Add isProcurementRequest helper or import**

At the top of the file or near other local helpers, add:

```typescript
const PROCUREMENT_REQUEST_TYPES_DETAIL = ['request new hardware', 'request software installation'];
function isProcurementRequest(requestTypeName: string): boolean {
  return PROCUREMENT_REQUEST_TYPES_DETAIL.some(t => requestTypeName.toLowerCase().includes(t));
}
```

- [ ] **Step 7: Update the progress stepper for procurement request types**

Find the `getStatusSteps` function (around line 560). Add a new branch for IT hardware chain statuses before the default `steps` array. After the existing hiring stepper block, add:

```typescript
    const IT_HARDWARE_CHAIN_STATUSES = [
      'ACKNOWLEDGED_IT', 'PENDING_CEO_APPROVAL_IT', 'CEO_APPROVED_IT',
      'PENDING_CTO_APPROVAL_IT', 'CTO_APPROVED_IT', 'PENDING_INVOICE_IT',
      'PENDING_CFO_APPROVAL_IT', 'CFO_APPROVED_IT', 'PAYMENT_PROCESSING_IT',
      'PAYMENT_DONE_IT', 'PENDING_DELIVERY_IT',
    ];

    if (IT_HARDWARE_CHAIN_STATUSES.includes(status) || status === 'SUBMITTED') {
      // Only show IT hardware stepper if this is a procurement request type
      // (checking via request.requestType.name in the calling context is handled by the outer condition)
      const itSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'verified_user' },
        { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'engineering' },
        { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'account_balance' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'payments' },
        { label: 'Delivery', status: 'PENDING_DELIVERY_IT', icon: 'local_shipping' },
        { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
      ];
      const itStatusOrder = [
        'SUBMITTED', 'ACKNOWLEDGED_IT', 'PENDING_CEO_APPROVAL_IT', 'CEO_APPROVED_IT',
        'PENDING_CTO_APPROVAL_IT', 'CTO_APPROVED_IT', 'PENDING_INVOICE_IT',
        'PENDING_CFO_APPROVAL_IT', 'CFO_APPROVED_IT', 'PAYMENT_PROCESSING_IT',
        'PAYMENT_DONE_IT', 'PENDING_DELIVERY_IT', 'RESOLVED',
      ];
      const currentIdx = itStatusOrder.indexOf(status);
      return itSteps.map(step => ({
        ...step,
        active: itStatusOrder.indexOf(step.status) <= currentIdx,
        current: step.status === status,
        completed: itStatusOrder.indexOf(step.status) < currentIdx,
      }));
    }
```

Note: This stepper branch is triggered when `request.requestType?.name` matches procurement types AND the status is in the IT hardware chain. The existing `getStatusSteps` function receives only `status` — wrap the call site in `RequestDetail.tsx` (around line 672, `const steps = getStatusSteps(request.status)`) to pass the request type as a second arg:

```typescript
// Update getStatusSteps signature
function getStatusSteps(status: string, requestTypeName = '') {
```

And update the call:
```typescript
const steps = getStatusSteps(request.status, request.requestType?.name || '');
```

Then gate the IT hardware stepper branch on `isProcurementRequest(requestTypeName)`:

```typescript
    if (isProcurementRequest(requestTypeName) && (IT_HARDWARE_CHAIN_STATUSES.includes(status) || status === 'SUBMITTED')) {
      // ... itSteps block
    }
```

- [ ] **Step 8: Render the 6 new modals at the bottom of RequestDetail JSX**

Find where existing modals are rendered (around line 1780+, e.g. `{showCEODecisionModal && ...}`). Add after them:

```tsx
{showAcknowledgeModal && (
  <AcknowledgeModal
    requestId={request.id}
    onSuccess={handleAcknowledgeSuccess}
    onClose={() => setShowAcknowledgeModal(false)}
  />
)}

{showCeoDecisionModal_IT && (
  <CeoDecisionModal
    requestId={request.id}
    onSuccess={handleCeoDecisionITSuccess}
    onClose={() => setShowCeoDecisionModal_IT(false)}
  />
)}

{showCtoDecisionModal && (
  <CtoDecisionModal
    requestId={request.id}
    onSuccess={handleCtoDecisionSuccess}
    onClose={() => setShowCtoDecisionModal(false)}
  />
)}

{showPendingInvoiceModal && (
  <PendingInvoiceModal
    requestId={request.id}
    onSuccess={handlePendingInvoiceSuccess}
    onClose={() => setShowPendingInvoiceModal(false)}
  />
)}

{showCfoDecisionModal && (
  <CfoDecisionModal
    requestId={request.id}
    onSuccess={handleCfoDecisionSuccess}
    onClose={() => setShowCfoDecisionModal(false)}
  />
)}

{showPaymentDoneModal && (
  <PaymentDoneModal
    requestId={request.id}
    onSuccess={handlePaymentDoneSuccess}
    onClose={() => setShowPaymentDoneModal(false)}
  />
)}
```

- [ ] **Step 9: Build and verify**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add ../frontend/pages/RequestDetail.tsx
git commit -m "feat: wire up IT hardware approval chain modals and update stepper in RequestDetail"
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Log in as admin and create a "Request new hardware" ticket**

Navigate to `http://localhost:5173`. Log in as `admin@helpdesk.com` / `admin123`. Submit a new "Request new hardware" request.

Expected: ticket created with status `SUBMITTED`.

- [ ] **Step 3: Acknowledge the ticket as agent/admin — select CEO**

Open the ticket. In the "Next Action Required" sidebar, click "Acknowledge & Route to CEO". Select the CEO user (`ceo@company.com`). Submit.

Expected: status changes to `PENDING_CEO_APPROVAL_IT`. Progress stepper shows CEO Approval step active.

- [ ] **Step 4: Approve as CEO**

Log out. Log in as `ceo@company.com` / `ceo123`. Open the same ticket. Click "CEO Approval Decision". Approve.

Expected: status changes to `PENDING_CTO_APPROVAL_IT`.

- [ ] **Step 5: Approve as CTO**

Log out. Log in as `cto@company.com` / `cto123`. Open the ticket. Click "CTO Approval Decision". Approve.

Expected: status changes to `PENDING_INVOICE_IT`.

- [ ] **Step 6: Route to CFO as agent**

Log out. Log in as `admin@helpdesk.com`. Open the ticket. Click "Route to CFO for Approval". Select CFO (`cfo@company.com`). Submit.

Expected: status changes to `PENDING_CFO_APPROVAL_IT`.

- [ ] **Step 7: Approve as CFO**

Log out. Log in as `cfo@company.com` / `cfo123`. Open the ticket. Click "CFO Approval Decision". Approve.

Expected: status changes to `PAYMENT_PROCESSING_IT`.

- [ ] **Step 8: Mark payment done as agent**

Log out. Log in as `admin@helpdesk.com`. Open the ticket. Click "Mark Payment Done". Fill in reference, amount, date. Submit.

Expected: status changes to `PENDING_DELIVERY_IT`.

- [ ] **Step 9: Complete delivery**

Click "Complete Delivery".

Expected: status changes to `RESOLVED`.

- [ ] **Step 10: Test rejection path**

Create a new "Request new hardware" ticket. Acknowledge it, route to CEO. Log in as CEO and reject it.

Expected: status changes to `REJECTED`.

- [ ] **Step 11: Verify other IT request types are unaffected**

Create a "Get IT help" request. Confirm it shows the generic SUBMITTED → IN_REVIEW → IN_PROGRESS → RESOLVED stepper, not the IT hardware chain.

- [ ] **Step 12: Commit final verification**

```bash
git add -A
git commit -m "test: verify IT hardware approval chain end-to-end smoke test complete"
```
