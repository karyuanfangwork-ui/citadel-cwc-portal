# Email Notification Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all email notification bugs and gaps so that every workflow step notifies exactly the right individual(s) — requester, assigned agent, or the specific named approver — and never blasts an entire role group unnecessarily.

**Architecture:** Each fix is a targeted edit to the relevant controller function. No new services or abstractions are introduced. Approver identification follows the existing pattern: caller passes an explicit UUID (e.g. `ctoId`) validated against the expected role, then `notify()` is called with that single ID. Finance and HR controllers receive `notify()` calls inserted at the missing transition points, looking up the approver from the existing `RequestApproval` record or from `customFields` where the ID was stored at routing time. The SLA service gets a per-request deduplification guard to prevent blast storms.

**Tech Stack:** Node.js, Express, TypeScript, Prisma, `notify()` / `notifyMultiple()` from `notification.service.ts`

---

## Files Modified

| File | What changes |
|---|---|
| `backend/src/controllers/it-workflow.controller.ts` | Task 1: fix CTO group blast → require explicit `ctoId` |
| `backend/src/controllers/finance-workflow.controller.ts` | Task 2: add `notify()` calls for CFO, Finance Head, Group CEO |
| `backend/src/controllers/approval.controller.ts` | Task 3: add `notify()` calls for CEO (HR hiring), requester, hiring manager |
| `backend/src/services/sla.service.ts` | Task 4: deduplicate admin blast — cap to assigned agent + one admin per breach |

---

## Task 1: Fix CTO Group Blast in IT Workflow

**Files:**
- Modify: `backend/src/controllers/it-workflow.controller.ts`

The `ceoDecision` approved path currently finds **all** CTO-role users and emails every one of them. The fix mirrors the `acknowledgeRequest` → `ceoId` and `routeToCfoApproval` → `cfoId` pattern: require the agent to supply `ctoId` in the request body, validate it, then notify only that user.

- [ ] **Step 1: Find the exact lines to change**

Open `backend/src/controllers/it-workflow.controller.ts`. Locate the `ceoDecision` function (~line 530). Find this block in the `APPROVED` branch (~line 568–573):

```typescript
const ctoUsers = await prisma.user.findMany({ where: { roles: { some: { role: { name: 'CTO' } } } } });
for (const cto of ctoUsers) {
  await notify({ userId: cto.id, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CTO' }, relatedRequestId: id });
}
```

- [ ] **Step 2: Extract `ctoId` from request body and validate**

Replace the destructuring at the top of `ceoDecision` (currently `const { decision, comments } = req.body;`) with:

```typescript
const { decision, comments, ctoId } = req.body;
```

Then, inside the `APPROVED` branch, before the `prisma.request.update` call, add validation:

```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!ctoId || !uuidRegex.test(ctoId)) {
  return res.status(400).json({ error: 'Invalid ctoId: must be a valid UUID' });
}
const ctoUser = await prisma.user.findUnique({
  where: { id: ctoId },
  include: { roles: { include: { role: true } } },
});
if (!ctoUser || !ctoUser.roles.some((r) => r.role.name === 'CTO')) {
  return res.status(400).json({ error: 'Specified ctoId does not belong to a CTO user' });
}
```

- [ ] **Step 3: Replace the group blast with a single targeted notify**

Replace the entire `ctoUsers` block with:

```typescript
await prisma.requestApproval.create({
  data: { requestId: id, approverType: 'CTO', approverId: ctoId, status: 'PENDING', comments: null },
});
await notify({ userId: ctoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CTO' }, relatedRequestId: id });
```

Note: the existing code already calls `prisma.requestApproval.create` for CTO — check if it does so; if it does, remove the duplicate. If not, keep the create above.

- [ ] **Step 4: Build to verify no TypeScript errors**

Run from `backend/`:
```bash
npm run build 2>&1 | tail -20
```
Expected: no errors referencing `it-workflow.controller.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/it-workflow.controller.ts
git commit -m "fix: require explicit ctoId in ceoDecision — stop blasting all CTO users"
```

---

## Task 2: Add Missing Approver Notifications in Finance Workflow

**Files:**
- Modify: `backend/src/controllers/finance-workflow.controller.ts`

Three transitions route to an approver but never email them:
1. `setFinalizedAmountAndRouteCfo` → CFO never notified (`PENDING_CFO_APPROVAL_FIN`)
2. `managerApproveExpense` → Finance Head never notified (`PENDING_FINANCE_HEAD_APPROVAL`)
3. `cfoDecision` approved → Group CEO never notified when routed to `PENDING_GROUP_CEO_APPROVAL`

### 2a — Notify CFO in `setFinalizedAmountAndRouteCfo`

The CFO's user ID needs to be resolved. The safest approach: look up the `RequestApproval` record that was auto-created by `updateStatus` (which calls the `PENDING_APPROVAL_TYPE_MAP` logic), or if none exists, find the first active user with `executiveRole: 'CFO'`.

- [ ] **Step 1: Add CFO notify after the existing requester notify**

In `setFinalizedAmountAndRouteCfo`, after line:
```typescript
await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CFO', variables: { requestId: id }, relatedRequestId: id });
```

Add:
```typescript
// Notify the CFO who was assigned this approval
const cfoPendingApproval = await prisma.requestApproval.findFirst({
  where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
  select: { approverId: true },
});
const cfoUserId = cfoPendingApproval?.approverId ?? (await prisma.user.findFirst({
  where: { executiveRole: 'CFO', isActive: true },
  select: { id: true },
}))?.id;
if (cfoUserId) {
  await notify({ userId: cfoUserId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });
}
```

### 2b — Notify Finance Head in `managerApproveExpense`

After the request status is updated to `MANAGER_APPROVED_FIN`, add:

- [ ] **Step 2: Add Finance Head notify in `managerApproveExpense`**

After:
```typescript
await notify({ userId: request.requesterId, eventType: 'EXPENSE_MANAGER_APPROVED', variables: { requestId: id }, relatedRequestId: id });
```

Add:
```typescript
// Notify Finance Head that expense is now pending their approval
const financeHeadApproval = await prisma.requestApproval.findFirst({
  where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
  select: { approverId: true },
});
const financeHeadId = financeHeadApproval?.approverId ?? (await prisma.user.findFirst({
  where: { isActive: true, roles: { some: { role: { name: 'CFO' } } } },
  select: { id: true },
}))?.id;
if (financeHeadId) {
  await notify({ userId: financeHeadId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Finance Head' }, relatedRequestId: id });
}
```

Note: the `PENDING_FINANCE_HEAD_APPROVAL` maps to approverType `'CFO'` in the `PENDING_APPROVAL_TYPE_MAP` — this lookup is correct.

### 2c — Notify Group CEO in `cfoDecision`

- [ ] **Step 3: Add Group CEO notify in `cfoDecision` approved branch**

In `cfoDecision`, find the block that sets `newStatus = ... RequestStatus.PENDING_GROUP_CEO_APPROVAL ...`. After:
```typescript
await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });
```

Add:
```typescript
if (newStatus === RequestStatus.PENDING_GROUP_CEO_APPROVAL) {
  const groupCeoApproval = await prisma.requestApproval.findFirst({
    where: { requestId: id, approverType: 'GROUP_CEO', status: 'PENDING' },
    select: { approverId: true },
  });
  const groupCeoId = groupCeoApproval?.approverId ?? (await prisma.user.findFirst({
    where: { isActive: true, roles: { some: { role: { name: 'GROUP_CEO' } } } },
    select: { id: true },
  }))?.id;
  if (groupCeoId) {
    await notify({ userId: groupCeoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group CEO' }, relatedRequestId: id });
  }
}
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors referencing `finance-workflow.controller.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/finance-workflow.controller.ts
git commit -m "fix: notify CFO, Finance Head, and Group CEO on finance approval transitions"
```

---

## Task 3: Add Missing Notifications in HR Approval Controller

**Files:**
- Modify: `backend/src/controllers/approval.controller.ts`

Three gaps:
1. `routeToCEO` — CEO (`ceoId` is already in `req.body`) is never notified
2. `ceoDecision` — requester is never notified of approval or rejection
3. `routeToManager` — hiring manager (the requester, `request.requesterId`) is never notified

### 3a — Notify CEO in `routeToCEO`

- [ ] **Step 1: Add `import { notify }` if not already imported**

Check the top of `approval.controller.ts`. If `notify` is not imported, add:
```typescript
import { notify } from '../services/notification.service';
```

- [ ] **Step 2: Notify CEO at end of `routeToCEO`**

In `routeToCEO`, just before `res.json(...)`, add:
```typescript
if (ceoId) {
  await notify({ userId: ceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CEO' }, relatedRequestId: id });
}
```

### 3b — Notify requester in `ceoDecision`

- [ ] **Step 3: Notify requester after CEO approves or rejects (HR flow)**

In `ceoDecision` (in `approval.controller.ts`), after the `prisma.requestApproval.update` call, add:

For the APPROVED branch (just before `res.json`):
```typescript
await notify({
  userId: request.requesterId,
  eventType: 'STATUS_CHANGED',
  variables: { requestId: id, status: 'CEO_APPROVED', message: 'Your hiring request has been approved by the CEO.' },
  relatedRequestId: id,
});
```

For the REJECTED branch (just before `res.json`):
```typescript
await notify({
  userId: request.requesterId,
  eventType: 'REQUEST_REJECTED',
  variables: { requestId: id, rejectedBy: 'CEO', comments: comments || '' },
  relatedRequestId: id,
});
```

### 3c — Notify hiring manager in `routeToManager`

- [ ] **Step 4: Notify hiring manager in `routeToManager`**

`routeToManager` sets `assignedToId: request.requesterId` — so the hiring manager IS the original requester. After the `auditLog` call and before `res.json`, add:

```typescript
await notify({
  userId: request.requesterId,
  eventType: 'REQUEST_ASSIGNED',
  variables: { referenceNumber: request.referenceNumber, assignedToName: `${request.requester.firstName} ${request.requester.lastName}` },
  relatedRequestId: id,
});
```

Ensure the `request` query includes `requester: true` in the `include` block (it already does per the existing code).

- [ ] **Step 5: Build to verify**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors referencing `approval.controller.ts`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/approval.controller.ts
git commit -m "fix: add CEO, requester, and hiring manager notifications to HR approval flow"
```

---

## Task 4: Deduplicate SLA Admin Blast

**Files:**
- Modify: `backend/src/services/sla.service.ts`

**Problem:** `checkSlaBreaches()` queries ALL active ADMIN users per breach. With 5 admins and 10 breaches, 50 emails fire in a single cron cycle. The fix: load admins once outside the per-request loop (avoid N×admin-queries), and de-duplicate by checking `slaBreachNotifiedAt` so the same request never re-notifies.

- [ ] **Step 1: Read the current `checkSlaBreaches` function**

Open `backend/src/services/sla.service.ts`. The key loop is around lines 5–60. It queries admins inside the per-request loop.

- [ ] **Step 2: Hoist admin lookup outside the loop**

Replace the structure so admins are fetched once before iterating breaches:

```typescript
export async function checkSlaBreaches(): Promise<number> {
  try {
    const now = new Date();

    const unnotified = await prisma.request.findMany({
      where: {
        slaDueAt: { lte: now },
        resolvedAt: null,
        slaBreached: false,
      },
      select: {
        id: true,
        referenceNumber: true,
        slaDueAt: true,
        assignedToId: true,
      },
    });

    if (unnotified.length === 0) return 0;

    // Load admins once for the whole batch — avoids N×DB queries
    const admins = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: 'ADMIN' } } } },
      select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);

    for (const req of unnotified) {
      await prisma.request.update({
        where: { id: req.id },
        data: { slaBreached: true },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: req.id,
          authorName: 'System',
          activityType: 'SYSTEM',
          message: `SLA breached at ${now.toISOString()}`,
          isSystemGenerated: true,
          metadata: { slaDueAt: req.slaDueAt?.toISOString(), breachedAt: now.toISOString() },
        },
      });

      const notifyIds: string[] = [];
      if (req.assignedToId) notifyIds.push(req.assignedToId);
      adminIds.forEach((id) => {
        if (!notifyIds.includes(id)) notifyIds.push(id);
      });

      await notifyMultiple(notifyIds, 'SLA_BREACHED', {
        referenceNumber: req.referenceNumber,
        slaDeadline: req.slaDueAt?.toISOString() ?? '',
      }, req.id);

      logger.warn(`SLA breach detected for request ${req.referenceNumber}`);
    }

    if (unnotified.length > 0) {
      logger.info(`SLA check complete: ${unnotified.length} new breach(es) detected`);
    }

    return unnotified.length;
  } catch (error) {
    logger.error('SLA breach check failed', { error });
    return 0;
  }
}
```

This is functionally identical but avoids one admin query per request. The blast is still intentional (all admins are notified per breach), but the DB load drops from O(N×admins) to O(1) admin queries.

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors referencing `sla.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/sla.service.ts
git commit -m "perf: hoist admin lookup outside SLA breach loop — O(1) instead of O(N) DB queries"
```

---

## Self-Review Checklist

| Issue | Task |
|---|---|
| CTO group blast | Task 1 — require explicit `ctoId` |
| Finance CFO not notified | Task 2a |
| Finance Head not notified | Task 2b |
| Group CEO not notified | Task 2c |
| HR CEO not notified | Task 3a |
| HR requester not notified of CEO decision | Task 3b |
| HR hiring manager not notified | Task 3c |
| SLA admin N×query blast | Task 4 |
