# Request New Hardware Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 11 audit issues in the Request New Hardware workflow across 4 layers: data integrity, security, workflow completeness, and production polish.

**Architecture:** Incremental layered approach — each layer produces a shippable, independently testable PR. Layer 1 standardizes data; Layer 2 patches the auth vulnerability; Layer 3 wires 4 unreachable workflow states; Layer 4 adds SLA, VP threshold, manager auto-suggest, notifications, and resubmit.

**Tech Stack:** Node.js + Express + TypeScript + Prisma + PostgreSQL (backend), React 19 + TypeScript + Vite (frontend), Tailwind CSS + Material Symbols icons.

---

## File Map

### Modified (Backend)
- `backend/prisma/seed.ts:277-282` — update hardware formConfig to 6 canonical fields + slaHours
- `backend/src/controllers/request.controller.ts:176-202` — create ITHardwareRequest on hardware request creation
- `backend/src/controllers/request.controller.ts:248+` — include itHardwareRequest in getRequestById query
- `backend/src/routes/it-workflow.routes.ts` — add authenticate, 5 new routes
- `backend/src/controllers/it-workflow.controller.ts` — auth check on managerDecision + 5 new actions
- `backend/src/utils/workflowTransitions.ts:27` — add MANAGER_REJECTED_IT resubmit transition + VP statuses
- `backend/src/config/index.ts` — add HARDWARE_VP_APPROVAL_THRESHOLD
- `backend/prisma/schema.prisma` — add PENDING_VP_APPROVAL_IT, VP_APPROVED_IT, VP_REJECTED_IT to enum

### Created (Backend)
- `backend/prisma/scripts/backfill-hardware-requests.ts` — one-time backfill script
- `backend/prisma/migrations/<timestamp>_add_vp_approval_statuses/` — Prisma migration

### Modified (Frontend)
- `frontend/src/components/request-detail/CustomFieldsPanel.tsx:24-31` — update IT_FIELD_LABELS
- `frontend/src/components/request-detail/ActionSidebar.tsx` — add 5 new modal cases
- `frontend/src/components/request-detail/FulfilmentModal.tsx` — update label + transition guard
- `frontend/src/utils/workflowActions.ts` — add 5 new action types + 6 new action entries
- `frontend/src/services/it-workflow.service.ts` — add 5 new API call methods
- `frontend/types.ts` — add 3 VP statuses
- `frontend/constants.tsx` — add VP status color configs
- `frontend/App.tsx` — redirect /it/hardware → /it

### Created (Frontend)
- `frontend/src/components/request-detail/HardwareOrderedModal.tsx`
- `frontend/src/components/request-detail/HardwareReceivedModal.tsx`
- `frontend/src/components/request-detail/SoftwareProvisionedModal.tsx`
- `frontend/src/components/request-detail/ResubmitModal.tsx`
- `frontend/src/components/request-detail/VpApprovalModal.tsx`
- `frontend/src/components/request-detail/VpRejectModal.tsx`

### Deleted (Frontend)
- `frontend/pages/HardwareForm.tsx`

---

## Layer 1 — Data Integrity

### Task 1: Standardize seed formConfig field names

**Files:**
- Modify: `backend/prisma/seed.ts:277-282`

- [ ] **Step 1: Update the hardware formConfig block in seed.ts**

Replace lines 278-282 in `backend/prisma/seed.ts`:

```typescript
        if (category.name === 'Request new hardware') {
            formConfig = [
                { id: 'hardwareName', label: 'Hardware Name', type: 'text', required: true },
                { id: 'hardwareModel', label: 'Preferred Model', type: 'text', required: false },
                { id: 'estimatedPrice', label: 'Estimated Price (USD)', type: 'currency', required: false },
                { id: 'preferredVendor', label: 'Preferred Vendor', type: 'text', required: false },
                { id: 'productUrl', label: 'Product URL', type: 'text', required: false },
                { id: 'businessJustification', label: 'Business Justification', type: 'textarea', required: true }
            ];
        }
```

Also update the `requestType.create` call (around line 299) to add `slaHours: 72` and `requiresApproval: true`:

```typescript
        if (!existingType) {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: cat.id,
                    name: `General ${category.name} Request`,
                    description: `Submit a request for ${category.name.toLowerCase()} assistance.`,
                    icon: category.icon,
                    formConfig,
                    isActive: true,
                    ...(category.name === 'Request new hardware' ? { slaHours: 72, requiresApproval: true } : {}),
                }
            });
        } else if (category.name === 'Request new hardware') {
            await prisma.requestType.update({
                where: { id: existingType.id },
                data: { formConfig, slaHours: 72, requiresApproval: true }
            });
        }
```

- [ ] **Step 2: Update IT_FIELD_LABELS in CustomFieldsPanel.tsx**

Replace lines 24-31 in `frontend/src/components/request-detail/CustomFieldsPanel.tsx`:

```typescript
const IT_FIELD_LABELS: Record<string, string> = {
  hardwareName: 'Hardware Name',
  hardwareModel: 'Preferred Model',
  estimatedPrice: 'Estimated Price (USD)',
  preferredVendor: 'Preferred Vendor',
  productUrl: 'Product URL',
  businessJustification: 'Business Justification',
  // legacy keys — keep for backward compat until backfill runs
  hardwareType: 'Hardware Type',
  model: 'Model',
  specifications: 'Specifications',
  reason: 'Reason',
  urgency: 'Urgency',
  currentDevice: 'Current Device',
  hw_name: 'Hardware Name',
  hw_model: 'Preferred Model',
  hw_reason: 'Business Justification',
};
```

- [ ] **Step 3: Commit**

```bash
cd c:/CWC2.0
git add backend/prisma/seed.ts frontend/src/components/request-detail/CustomFieldsPanel.tsx
git commit -m "fix: standardize hardware request field names to canonical schema"
```

---

### Task 2: Populate ITHardwareRequest on request creation

**Files:**
- Modify: `backend/src/controllers/request.controller.ts`

- [ ] **Step 1: Add ITHardwareRequest creation after Request is created**

In `backend/src/controllers/request.controller.ts`, add this block after line 202 (after the `prisma.request.create` call that stores the result in `request`):

```typescript
        // If this is a hardware request, create the structured ITHardwareRequest record
        if (requestTypeId) {
            const reqType = request.requestType;
            if (reqType && reqType.name.toLowerCase().includes('hardware')) {
                const cf = (customFields || {}) as Record<string, any>;
                await prisma.iTHardwareRequest.create({
                    data: {
                        requestId: request.id,
                        hardwareName: cf.hardwareName || cf.hw_name || cf.hardwareType || 'Unknown',
                        hardwareModel: cf.hardwareModel || cf.hw_model || cf.model || null,
                        estimatedPrice: cf.estimatedPrice ? parseFloat(cf.estimatedPrice) : null,
                        preferredVendor: cf.preferredVendor || null,
                        productUrl: cf.productUrl || null,
                        businessJustification: cf.businessJustification || cf.hw_reason || cf.reason || '',
                    },
                });
            }
        }
```

- [ ] **Step 2: Include itHardwareRequest in getRequestById**

Find the `getRequestById` method in `backend/src/controllers/request.controller.ts` (around line 248). In its Prisma `findUnique` include object, add:

```typescript
            itHardwareRequest: true,
```

alongside the other includes (requester, assignedTo, activities, etc.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/CWC2.0/backend
npm run build
```

Expected: no TypeScript errors. If `iTHardwareRequest` is not recognized, run `npm run prisma:generate` first.

- [ ] **Step 4: Commit**

```bash
cd c:/CWC2.0
git add backend/src/controllers/request.controller.ts
git commit -m "feat: populate ITHardwareRequest table on hardware request creation"
```

---

### Task 3: Write backfill migration script

**Files:**
- Create: `backend/prisma/scripts/backfill-hardware-requests.ts`

- [ ] **Step 1: Create the scripts directory and backfill script**

```bash
mkdir -p c:/CWC2.0/backend/prisma/scripts
```

Create `backend/prisma/scripts/backfill-hardware-requests.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hardwareRequests = await prisma.request.findMany({
    where: {
      requestType: {
        name: { contains: 'hardware', mode: 'insensitive' },
      },
    },
    include: {
      itHardwareRequest: true,
      requestType: true,
    },
  });

  console.log(`Found ${hardwareRequests.length} hardware requests to check`);
  let created = 0;

  for (const req of hardwareRequests) {
    if (req.itHardwareRequest) {
      continue; // already has a record
    }

    const cf = (req.customFields || {}) as Record<string, any>;
    const hardwareName =
      cf.hardwareName || cf.hw_name || cf.hardwareType || 'Unknown';
    const businessJustification =
      cf.businessJustification || cf.hw_reason || cf.reason || '';

    await prisma.iTHardwareRequest.create({
      data: {
        requestId: req.id,
        hardwareName,
        hardwareModel: cf.hardwareModel || cf.hw_model || cf.model || null,
        estimatedPrice: cf.estimatedPrice ? parseFloat(cf.estimatedPrice) : null,
        preferredVendor: cf.preferredVendor || null,
        productUrl: cf.productUrl || null,
        businessJustification,
      },
    });

    created++;
    console.log(`Created ITHardwareRequest for request ${req.referenceNumber}`);
  }

  console.log(`Done. Created ${created} ITHardwareRequest records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Test the script runs without error (dev database)**

```bash
cd c:/CWC2.0/backend
npx ts-node prisma/scripts/backfill-hardware-requests.ts
```

Expected output: `Found N hardware requests to check` then `Done. Created N ITHardwareRequest records.`

- [ ] **Step 3: Commit**

```bash
cd c:/CWC2.0
git add backend/prisma/scripts/backfill-hardware-requests.ts
git commit -m "feat: add backfill script to populate ITHardwareRequest from existing requests"
```

---

### Task 4: Consolidate form entry points

**Files:**
- Modify: `frontend/App.tsx`
- Delete: `frontend/pages/HardwareForm.tsx`

- [ ] **Step 1: Replace the /it/hardware route in App.tsx with a redirect**

Find the `/it/hardware` route entry in `frontend/App.tsx`. Replace it with:

```tsx
import { Navigate } from 'react-router-dom';
// ...
<Route path="/it/hardware" element={<Navigate to="/it" replace />} />
```

(The `Navigate` import may already exist — check before adding.)

- [ ] **Step 2: Delete HardwareForm.tsx**

```bash
rm c:/CWC2.0/frontend/pages/HardwareForm.tsx
```

- [ ] **Step 3: Remove any import of HardwareForm from App.tsx**

Search for `HardwareForm` in `frontend/App.tsx` and remove the import line.

- [ ] **Step 4: Verify frontend builds**

```bash
cd c:/CWC2.0/frontend
npm run build
```

Expected: no errors about missing HardwareForm.

- [ ] **Step 5: Commit**

```bash
cd c:/CWC2.0
git add frontend/App.tsx
git rm frontend/pages/HardwareForm.tsx
git commit -m "fix: remove duplicate HardwareForm route, redirect /it/hardware to /it"
```

---

## Layer 2 — Security Fix

### Task 5: Add authorization to managerDecision endpoint

**Files:**
- Modify: `backend/src/routes/it-workflow.routes.ts:10`
- Modify: `backend/src/controllers/it-workflow.controller.ts:66-115`

- [ ] **Step 1: Note — authenticate is already applied via router.use(authenticate) on line 7**

Open `backend/src/routes/it-workflow.routes.ts`. Line 7 is `router.use(authenticate)` — this already applies to all routes including `managerDecision`. The route-level fix is already in place. No route change needed.

- [ ] **Step 2: Add ownership check at the start of managerDecision()**

In `backend/src/controllers/it-workflow.controller.ts`, replace the start of `managerDecision` (lines 66-78) with:

```typescript
export async function managerDecision(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Authorization: must be the designated approver OR an ADMIN
    const isAdmin = currentUser?.roles?.some((r: any) => r.role?.name === 'ADMIN') ?? false;
    if (!isAdmin) {
      const approval = await prisma.requestApproval.findFirst({
        where: {
          requestId: id,
          approverId: currentUser?.id,
          status: 'PENDING',
        },
      });
      if (!approval) {
        return res.status(403).json({ error: 'Forbidden: you are not the designated approver for this request' });
      }
    }

    const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED_IT' : 'MANAGER_REJECTED_IT';
```

Keep the rest of the function unchanged from line 82 onward.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/CWC2.0/backend
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd c:/CWC2.0
git add backend/src/controllers/it-workflow.controller.ts
git commit -m "fix: add ownership authorization check to managerDecision endpoint"
```

---

## Layer 3 — Workflow Completeness

### Task 6: Add three new backend controller actions

**Files:**
- Modify: `backend/src/controllers/it-workflow.controller.ts`
- Modify: `backend/src/routes/it-workflow.routes.ts`

- [ ] **Step 1: Update markFulfilled() to accept SOFTWARE_PROVISIONED status**

In `backend/src/controllers/it-workflow.controller.ts`, update `markFulfilled` to check that the current status is `SOFTWARE_PROVISIONED` (not `PROCUREMENT_IN_PROGRESS`):

```typescript
export async function markFulfilled(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'SOFTWARE_PROVISIONED') {
      return res.status(400).json({ error: 'Request must be in SOFTWARE_PROVISIONED status to close' });
    }

    await prisma.request.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: notes ? `Request closed and resolved: ${notes}` : 'Request has been closed and resolved',
        authorName: 'System',
        isSystemGenerated: true,
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your IT request ${id} has been fulfilled and resolved.`);
    }

    return res.json({ success: true, message: 'Request closed and resolved' });
  } catch (error) {
    console.error('markFulfilled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: Add markHardwareOrdered() to the controller**

Append to `backend/src/controllers/it-workflow.controller.ts`:

```typescript
export async function markHardwareOrdered(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { orderNumber, vendor, trackingNumber, estimatedDelivery } = req.body;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PROCUREMENT_IN_PROGRESS') {
      return res.status(400).json({ error: 'Request must be in PROCUREMENT_IN_PROGRESS status' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'HARDWARE_ORDERED' },
    });

    // Write procurement details to ITHardwareRequest
    await prisma.iTHardwareRequest.updateMany({
      where: { requestId: id },
      data: {
        orderNumber: orderNumber || null,
        trackingNumber: trackingNumber || null,
        preferredVendor: vendor || undefined,
        procurementStatus: 'ORDERED',
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Hardware ordered. Order: ${orderNumber || 'N/A'}, Vendor: ${vendor || 'N/A'}${trackingNumber ? `, Tracking: ${trackingNumber}` : ''}`,
        authorName: 'System',
        isSystemGenerated: true,
        metadata: { orderNumber, vendor, trackingNumber, estimatedDelivery },
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your hardware for IT request ${id} has been ordered${orderNumber ? `. Order number: ${orderNumber}` : ''}.`);
    }

    return res.json({ success: true, message: 'Hardware marked as ordered' });
  } catch (error) {
    console.error('markHardwareOrdered error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 3: Add markHardwareReceived() to the controller**

Append to `backend/src/controllers/it-workflow.controller.ts`:

```typescript
export async function markHardwareReceived(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { receivedDate, notes, assetTag } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { assignedTo: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'HARDWARE_ORDERED') {
      return res.status(400).json({ error: 'Request must be in HARDWARE_ORDERED status' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'HARDWARE_RECEIVED' },
    });

    await prisma.iTHardwareRequest.updateMany({
      where: { requestId: id },
      data: { procurementStatus: 'RECEIVED' },
    });

    const noteMsg = [notes, assetTag ? `Asset tag: ${assetTag}` : null].filter(Boolean).join('. ');

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Hardware received${noteMsg ? ': ' + noteMsg : ''}`,
        authorName: 'System',
        isSystemGenerated: true,
        metadata: { receivedDate, notes, assetTag },
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your hardware for IT request ${id} has arrived and is being set up.`);
    }
    if (request.assignedToId && request.assignedToId !== request.requesterId) {
      await notify(request.assignedToId, `Hardware received for IT request ${id}. Please provision and close.`);
    }

    return res.json({ success: true, message: 'Hardware marked as received' });
  } catch (error) {
    console.error('markHardwareReceived error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 4: Add markSoftwareProvisioned() to the controller**

Append to `backend/src/controllers/it-workflow.controller.ts`:

```typescript
export async function markSoftwareProvisioned(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { provisioningNotes, softwareInstalled } = req.body;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'HARDWARE_RECEIVED') {
      return res.status(400).json({ error: 'Request must be in HARDWARE_RECEIVED status' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'SOFTWARE_PROVISIONED' },
    });

    await prisma.iTHardwareRequest.updateMany({
      where: { requestId: id },
      data: { procurementStatus: 'PROVISIONED' },
    });

    const msg = [
      'Software provisioned',
      softwareInstalled ? `Software installed: ${softwareInstalled}` : null,
      provisioningNotes,
    ].filter(Boolean).join('. ');

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: msg,
        authorName: 'System',
        isSystemGenerated: true,
        metadata: { provisioningNotes, softwareInstalled },
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your hardware for IT request ${id} is ready for pickup/delivery.`);
    }

    return res.json({ success: true, message: 'Software provisioned' });
  } catch (error) {
    console.error('markSoftwareProvisioned error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 5: Register the three new routes in it-workflow.routes.ts**

Replace the full content of `backend/src/routes/it-workflow.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  submitForApproval,
  managerDecision,
  markProcurement,
  markFulfilled,
  markHardwareOrdered,
  markHardwareReceived,
  markSoftwareProvisioned,
} from '../controllers/it-workflow.controller';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/submit-for-approval', authorize('ADMIN', 'AGENT'), submitForApproval);
router.post('/requests/:id/manager-decision', managerDecision);
router.post('/requests/:id/mark-procurement', authorize('ADMIN', 'AGENT'), markProcurement);
router.post('/requests/:id/mark-hardware-ordered', authorize('ADMIN', 'AGENT'), markHardwareOrdered);
router.post('/requests/:id/mark-hardware-received', authorize('ADMIN', 'AGENT'), markHardwareReceived);
router.post('/requests/:id/mark-software-provisioned', authorize('ADMIN', 'AGENT'), markSoftwareProvisioned);
router.post('/requests/:id/mark-fulfilled', authorize('ADMIN', 'AGENT'), markFulfilled);

export default router;
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd c:/CWC2.0/backend
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd c:/CWC2.0
git add backend/src/controllers/it-workflow.controller.ts backend/src/routes/it-workflow.routes.ts
git commit -m "feat: add markHardwareOrdered, markHardwareReceived, markSoftwareProvisioned endpoints"
```

---

### Task 7: Add three new frontend service methods

**Files:**
- Modify: `frontend/src/services/it-workflow.service.ts`

- [ ] **Step 1: Replace the full content of it-workflow.service.ts**

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
  async markHardwareOrdered(requestId: string, data: { orderNumber?: string; vendor?: string; trackingNumber?: string; estimatedDelivery?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-hardware-ordered`, data);
    return response.data;
  },
  async markHardwareReceived(requestId: string, data: { receivedDate?: string; notes?: string; assetTag?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-hardware-received`, data);
    return response.data;
  },
  async markSoftwareProvisioned(requestId: string, data: { provisioningNotes?: string; softwareInstalled?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-software-provisioned`, data);
    return response.data;
  },
  async markFulfilled(requestId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-fulfilled`, { notes });
    return response.data;
  },
  async resubmitRequest(requestId: string, data: {
    hardwareName: string;
    hardwareModel?: string;
    estimatedPrice?: number;
    preferredVendor?: string;
    productUrl?: string;
    businessJustification: string;
    resubmitNotes?: string;
  }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/resubmit`, data);
    return response.data;
  },
};

export default itWorkflowService;
```

- [ ] **Step 2: Commit**

```bash
cd c:/CWC2.0
git add frontend/src/services/it-workflow.service.ts
git commit -m "feat: add markHardwareOrdered, markHardwareReceived, markSoftwareProvisioned, resubmit service methods"
```

---

### Task 8: Create HardwareOrderedModal component

**Files:**
- Create: `frontend/src/components/request-detail/HardwareOrderedModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface HardwareOrderedModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const HardwareOrderedModal: React.FC<HardwareOrderedModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [vendor, setVendor] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markHardwareOrdered(requestId, {
        vendor: vendor || undefined,
        orderNumber: orderNumber || undefined,
        trackingNumber: trackingNumber || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark hardware as ordered');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-600">local_shipping</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Mark Hardware Ordered</h2>
            <p className="text-xs text-gray-500">IT Workflow · Log order details</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Vendor Name <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input type="text" value={vendor} onChange={e => setVendor(e.target.value)}
                placeholder="e.g. Dell, Logitech, CDW…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Order / PO Number <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
                placeholder="e.g. PO-2026-04-0042"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Tracking Number <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Estimated Delivery <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input type="date" value={estimatedDelivery} onChange={e => setEstimatedDelivery(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Mark as Ordered'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HardwareOrderedModal;
```

- [ ] **Step 2: Commit**

```bash
cd c:/CWC2.0
git add frontend/src/components/request-detail/HardwareOrderedModal.tsx
git commit -m "feat: add HardwareOrderedModal component"
```

---

### Task 9: Create HardwareReceivedModal component

**Files:**
- Create: `frontend/src/components/request-detail/HardwareReceivedModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface HardwareReceivedModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const HardwareReceivedModal: React.FC<HardwareReceivedModalProps> = ({ requestId, onSuccess, onClose }) => {
  const today = new Date().toISOString().split('T')[0];
  const [receivedDate, setReceivedDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markHardwareReceived(requestId, {
        receivedDate: receivedDate || undefined,
        notes: notes || undefined,
        assetTag: assetTag || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark hardware as received');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-teal-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-600">inventory_2</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Mark Hardware Received</h2>
            <p className="text-xs text-gray-500">IT Workflow · Confirm delivery</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Received Date</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Asset Tag <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input type="text" value={assetTag} onChange={e => setAssetTag(e.target.value)}
                placeholder="e.g. IT-0088"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Delivery Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="e.g. Delivered to desk 3-14"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Mark as Received'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HardwareReceivedModal;
```

- [ ] **Step 2: Commit**

```bash
cd c:/CWC2.0
git add frontend/src/components/request-detail/HardwareReceivedModal.tsx
git commit -m "feat: add HardwareReceivedModal component"
```

---

### Task 10: Create SoftwareProvisionedModal component

**Files:**
- Create: `frontend/src/components/request-detail/SoftwareProvisionedModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface SoftwareProvisionedModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const SoftwareProvisionedModal: React.FC<SoftwareProvisionedModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [provisioningNotes, setProvisioningNotes] = useState('');
  const [softwareInstalled, setSoftwareInstalled] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markSoftwareProvisioned(requestId, {
        provisioningNotes: provisioningNotes || undefined,
        softwareInstalled: softwareInstalled || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark software as provisioned');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-violet-600">settings</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Mark Software Provisioned</h2>
            <p className="text-xs text-gray-500">IT Workflow · Confirm setup complete</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Software Installed <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input type="text" value={softwareInstalled} onChange={e => setSoftwareInstalled(e.target.value)}
                placeholder="e.g. Windows 11, Office 365, Antivirus"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Provisioning Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea value={provisioningNotes} onChange={e => setProvisioningNotes(e.target.value)} rows={3}
                placeholder="e.g. Device configured and ready for pickup at IT desk"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Mark as Provisioned'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SoftwareProvisionedModal;
```

- [ ] **Step 2: Commit**

```bash
cd c:/CWC2.0
git add frontend/src/components/request-detail/SoftwareProvisionedModal.tsx
git commit -m "feat: add SoftwareProvisionedModal component"
```

---

### Task 11: Update workflowActions.ts and wire ActionSidebar

**Files:**
- Modify: `frontend/src/utils/workflowActions.ts`
- Modify: `frontend/src/components/request-detail/ActionSidebar.tsx`

- [ ] **Step 1: Replace workflowActions.ts with updated version**

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
  | 'VP_APPROVE'
  | 'VP_REJECT'
  | 'RESUBMIT'
  | 'ASSIGN';

export interface WorkflowAction {
  type: WorkflowActionType;
  label: string;
  description: string;
  variant: 'primary' | 'success' | 'danger' | 'warning';
}

const PROCUREMENT_REQUEST_TYPES = [
  'Request new hardware',
  'Request Software Installation',
];

function isProcurementRequest(requestTypeName: string): boolean {
  return PROCUREMENT_REQUEST_TYPES.some(t =>
    requestTypeName.toLowerCase().includes(t.toLowerCase())
  );
}

export function getWorkflowActions(
  status: string,
  userRoles: string[],
  isAssigned: boolean,
  isDesignatedApprover = false,
  requestTypeName = '',
  isRequester = false
): WorkflowAction[] {
  const isAdmin = userRoles.includes('ADMIN');
  const isAgent = userRoles.includes('AGENT');
  const canAct = isAdmin || isAgent;
  const isProcurement = isProcurementRequest(requestTypeName);

  const actions: WorkflowAction[] = [];

  // Requester can resubmit after rejection
  if (isRequester && status === 'MANAGER_REJECTED_IT') {
    actions.push({
      type: 'RESUBMIT',
      label: 'Revise & Resubmit',
      description: 'Update your request details and resubmit for manager approval.',
      variant: 'primary',
    });
    return actions;
  }

  // Designated approver (manager) can approve/reject
  if (isDesignatedApprover && status === 'PENDING_MANAGER_APPROVAL_IT') {
    actions.push(
      { type: 'APPROVE', label: 'Approve', description: 'Approve this IT request to proceed.', variant: 'success' },
      { type: 'REJECT', label: 'Reject', description: 'Reject this IT request and notify the requester.', variant: 'danger' }
    );
    return actions;
  }

  // Designated VP approver
  if (isDesignatedApprover && status === 'PENDING_VP_APPROVAL_IT') {
    actions.push(
      { type: 'VP_APPROVE', label: 'VP Approve', description: 'Approve this high-value hardware request.', variant: 'success' },
      { type: 'VP_REJECT', label: 'VP Reject', description: 'Reject this high-value hardware request.', variant: 'danger' }
    );
    return actions;
  }

  if (!canAct) return actions;

  if (!isAssigned) {
    actions.push({ type: 'ASSIGN', label: 'Assign Request', description: 'Assign this request to an agent before proceeding.', variant: 'primary' });
  }

  if (isAdmin || isAgent) {
    if (status === 'SUBMITTED' && isProcurement) {
      actions.push({ type: 'SUBMIT_FOR_APPROVAL', label: 'Submit for Manager Approval', description: 'Route this IT request to a manager for sign-off.', variant: 'primary' });
    }
    if (status === 'MANAGER_APPROVED_IT' && isProcurement) {
      actions.push({ type: 'START_PROCUREMENT', label: 'Start Procurement', description: 'Manager approved. Log vendor details and begin ordering.', variant: 'warning' });
    }
    if (status === 'PROCUREMENT_IN_PROGRESS' && isProcurement) {
      actions.push({ type: 'MARK_HARDWARE_ORDERED', label: 'Mark Hardware Ordered', description: 'Log order number, vendor and tracking details.', variant: 'warning' });
    }
    if (status === 'HARDWARE_ORDERED') {
      actions.push({ type: 'MARK_HARDWARE_RECEIVED', label: 'Mark Hardware Received', description: 'Confirm delivery and log asset tag.', variant: 'warning' });
    }
    if (status === 'HARDWARE_RECEIVED') {
      actions.push({ type: 'MARK_SOFTWARE_PROVISIONED', label: 'Mark Software Provisioned', description: 'Confirm device is set up and ready.', variant: 'warning' });
    }
    if (status === 'SOFTWARE_PROVISIONED') {
      actions.push({ type: 'MARK_FULFILLED', label: 'Close & Resolve', description: 'Confirm the requester has received the hardware.', variant: 'success' });
    }
  }

  if (isAdmin && status === 'PENDING_MANAGER_APPROVAL_IT') {
    actions.push(
      { type: 'APPROVE', label: 'Approve', description: 'Approve this IT request to proceed.', variant: 'success' },
      { type: 'REJECT', label: 'Reject', description: 'Reject this IT request and notify the requester.', variant: 'danger' }
    );
  }

  return actions;
}
```

- [ ] **Step 2: Update ActionSidebar.tsx to handle new action types**

Replace the `ModalType` type and the imports + modal rendering section in `frontend/src/components/request-detail/ActionSidebar.tsx`:

At the top, add the new modal imports:
```tsx
import HardwareOrderedModal from './HardwareOrderedModal';
import HardwareReceivedModal from './HardwareReceivedModal';
import SoftwareProvisionedModal from './SoftwareProvisionedModal';
import ResubmitModal from './ResubmitModal';
import VpApprovalModal from './VpApprovalModal';
import VpRejectModal from './VpRejectModal';
```

Change the `ModalType` type (line 11) to:
```tsx
type ModalType = 'APPROVE' | 'REJECT' | 'SUBMIT_FOR_APPROVAL' | 'PROCUREMENT' | 'FULFILMENT' | 'ASSIGN'
  | 'HARDWARE_ORDERED' | 'HARDWARE_RECEIVED' | 'SOFTWARE_PROVISIONED'
  | 'VP_APPROVE' | 'VP_REJECT' | 'RESUBMIT' | null;
```

Update the `handleActionClick` switch to add new cases:
```tsx
  const handleActionClick = (type: WorkflowActionType) => {
    switch (type) {
      case 'APPROVE': setOpenModal('APPROVE'); break;
      case 'REJECT': setOpenModal('REJECT'); break;
      case 'SUBMIT_FOR_APPROVAL': setOpenModal('SUBMIT_FOR_APPROVAL'); break;
      case 'START_PROCUREMENT': setOpenModal('PROCUREMENT'); break;
      case 'MARK_HARDWARE_ORDERED': setOpenModal('HARDWARE_ORDERED'); break;
      case 'MARK_HARDWARE_RECEIVED': setOpenModal('HARDWARE_RECEIVED'); break;
      case 'MARK_SOFTWARE_PROVISIONED': setOpenModal('SOFTWARE_PROVISIONED'); break;
      case 'MARK_FULFILLED': setOpenModal('FULFILMENT'); break;
      case 'VP_APPROVE': setOpenModal('VP_APPROVE'); break;
      case 'VP_REJECT': setOpenModal('VP_REJECT'); break;
      case 'RESUBMIT': setOpenModal('RESUBMIT'); break;
      case 'ASSIGN': setOpenModal('ASSIGN'); break;
      default:
        console.warn('[ActionSidebar] Unhandled action type:', type);
    }
  };
```

Add the new modal renderings at the bottom of the JSX (after the existing modals):
```tsx
      {openModal === 'HARDWARE_ORDERED'     && <HardwareOrderedModal    requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'HARDWARE_RECEIVED'    && <HardwareReceivedModal   requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'SOFTWARE_PROVISIONED' && <SoftwareProvisionedModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'VP_APPROVE'           && <VpApprovalModal         requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'VP_REJECT'            && <VpRejectModal           requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'RESUBMIT'             && <ResubmitModal           requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
```

Also update the `getWorkflowActions` call to pass `isRequester`. Find where `actions` is computed and add the `isRequester` arg — pass `userId === requesterId` if `requesterId` is available in props, otherwise pass `false` for now (it is wired in Layer 4).

- [ ] **Step 3: Verify frontend builds**

```bash
cd c:/CWC2.0/frontend
npm run build
```

Expected: errors only about missing modal files (ResubmitModal, VpApprovalModal, VpRejectModal) — those are created in Layer 4. If there are TypeScript errors about missing props, check the modal interfaces.

- [ ] **Step 4: Commit**

```bash
cd c:/CWC2.0
git add frontend/src/utils/workflowActions.ts frontend/src/components/request-detail/ActionSidebar.tsx
git commit -m "feat: wire hardware workflow actions (ordered, received, provisioned, VP, resubmit) in ActionSidebar"
```

---

## Layer 4 — Polish & Production Readiness

### Task 12: Add VP approval statuses to schema and frontend types

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/utils/workflowTransitions.ts`
- Modify: `backend/src/config/index.ts`
- Modify: `frontend/types.ts`
- Modify: `frontend/constants.tsx`

- [ ] **Step 1: Add VP statuses to RequestStatus enum in schema.prisma**

Find the `enum RequestStatus` block in `backend/prisma/schema.prisma`. Add after `MANAGER_REJECTED_IT`:

```prisma
  PENDING_VP_APPROVAL_IT
  VP_APPROVED_IT
  VP_REJECTED_IT
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd c:/CWC2.0/backend
npx prisma migrate dev --name add_vp_approval_statuses
```

Expected: migration file created, database updated.

- [ ] **Step 3: Add VP transitions to workflowTransitions.ts**

In `backend/src/utils/workflowTransitions.ts`, replace line 25 (the `MANAGER_REJECTED_IT` entry) and add new lines:

```typescript
  PENDING_MANAGER_APPROVAL_IT: ['MANAGER_APPROVED_IT', 'MANAGER_REJECTED_IT', 'PENDING_VP_APPROVAL_IT'],
  MANAGER_APPROVED_IT: ['PROCUREMENT_IN_PROGRESS'],
  MANAGER_REJECTED_IT: ['PENDING_MANAGER_APPROVAL_IT'],  // allows resubmit
  PENDING_VP_APPROVAL_IT: ['MANAGER_APPROVED_IT', 'VP_REJECTED_IT'],
  VP_APPROVED_IT: [],  // not used as visible state
  VP_REJECTED_IT: [],
```

- [ ] **Step 4: Add HARDWARE_VP_APPROVAL_THRESHOLD to config**

In `backend/src/config/index.ts`, add inside the `export const config` object:

```typescript
    hardware: {
        vpApprovalThreshold: parseFloat(process.env.HARDWARE_VP_APPROVAL_THRESHOLD || '2500'),
    },
```

- [ ] **Step 5: Add VP statuses to frontend/types.ts**

Find `enum RequestStatus` in `frontend/types.ts`. Add:

```typescript
  PENDING_VP_APPROVAL_IT = 'PENDING_VP_APPROVAL_IT',
  VP_APPROVED_IT = 'VP_APPROVED_IT',
  VP_REJECTED_IT = 'VP_REJECTED_IT',
```

- [ ] **Step 6: Add VP status configs to frontend/constants.tsx**

Find the status config object in `frontend/constants.tsx` and add:

```typescript
  [RequestStatus.PENDING_VP_APPROVAL_IT]: { label: 'Pending VP Approval', color: 'text-rose-700', bg: 'bg-rose-100' },
  [RequestStatus.VP_APPROVED_IT]: { label: 'VP Approved', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.VP_REJECTED_IT]: { label: 'VP Rejected', color: 'text-red-700', bg: 'bg-red-100' },
```

- [ ] **Step 7: Commit**

```bash
cd c:/CWC2.0
git add backend/prisma/schema.prisma backend/prisma/migrations/ backend/src/utils/workflowTransitions.ts backend/src/config/index.ts frontend/types.ts frontend/constants.tsx
git commit -m "feat: add VP approval statuses to schema, transitions, config, and frontend types"
```

---

### Task 13: Add VP decision controller action + update managerDecision for threshold

**Files:**
- Modify: `backend/src/controllers/it-workflow.controller.ts`
- Modify: `backend/src/routes/it-workflow.routes.ts`

- [ ] **Step 1: Update managerDecision to check VP threshold on approval**

In `backend/src/controllers/it-workflow.controller.ts`, find the line:
```typescript
    const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED_IT' : 'MANAGER_REJECTED_IT';
```

Replace with:

```typescript
    let newStatus: string;
    if (decision === 'REJECTED') {
      newStatus = 'MANAGER_REJECTED_IT';
    } else {
      // Check VP threshold
      const hardwareRecord = await prisma.iTHardwareRequest.findUnique({
        where: { requestId: id },
      });
      const threshold = config.hardware.vpApprovalThreshold;
      const price = hardwareRecord?.estimatedPrice ? parseFloat(hardwareRecord.estimatedPrice.toString()) : 0;
      if (price >= threshold) {
        newStatus = 'PENDING_VP_APPROVAL_IT';
      } else {
        newStatus = 'MANAGER_APPROVED_IT';
      }
    }
```

Also add `import { config } from '../config';` at the top of the controller if not already imported.

When `newStatus === 'PENDING_VP_APPROVAL_IT'`, also notify VP-role users. Add after the requester notification:

```typescript
    if (newStatus === 'PENDING_VP_APPROVAL_IT') {
      const vpUsers = await prisma.user.findMany({
        where: { roles: { some: { role: { name: 'ADMIN' } } } },
        select: { id: true },
      });
      for (const vp of vpUsers) {
        await notify(vp.id, `High-value hardware request ${id} requires VP approval (estimated price meets threshold).`);
      }
    }
```

- [ ] **Step 2: Add vpDecision() controller action**

Append to `backend/src/controllers/it-workflow.controller.ts`:

```typescript
export async function vpDecision(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PENDING_VP_APPROVAL_IT') {
      return res.status(400).json({ error: 'Request is not pending VP approval' });
    }

    const isAdmin = currentUser?.roles?.some((r: any) => r.role?.name === 'ADMIN') ?? false;
    if (!isAdmin) {
      const approval = await prisma.requestApproval.findFirst({
        where: { requestId: id, approverId: currentUser?.id, status: 'PENDING' },
      });
      if (!approval) {
        return res.status(403).json({ error: 'Forbidden: you are not the designated VP approver' });
      }
    }

    // VP approved → proceed to MANAGER_APPROVED_IT; VP rejected → terminal
    const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED_IT' : 'VP_REJECTED_IT';

    await prisma.request.update({ where: { id }, data: { status: newStatus } });

    await prisma.requestApproval.updateMany({
      where: { requestId: id, approverType: 'VP', status: 'PENDING' },
      data: { status: decision as 'APPROVED' | 'REJECTED', comments: comments || null },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
        message: `VP ${decision.toLowerCase()} the request${comments ? ': ' + comments : ''}`,
        authorName: (req as any).user?.firstName || 'VP',
        authorRole: 'VP',
        isSystemGenerated: false,
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your IT request ${id} has been ${decision.toLowerCase()} by VP.`);
    }

    return res.json({ success: true, message: `Request VP ${decision.toLowerCase()}` });
  } catch (error) {
    console.error('vpDecision error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 3: Add resubmitRequest() controller action**

Append to `backend/src/controllers/it-workflow.controller.ts`:

```typescript
export async function resubmitRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { hardwareName, hardwareModel, estimatedPrice, preferredVendor, productUrl, businessJustification, resubmitNotes } = req.body;
    const currentUser = (req as any).user;

    if (!hardwareName || !businessJustification) {
      return res.status(400).json({ error: 'hardwareName and businessJustification are required' });
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'MANAGER_REJECTED_IT') {
      return res.status(400).json({ error: 'Only rejected requests can be resubmitted' });
    }

    if (request.requesterId !== currentUser?.id) {
      return res.status(403).json({ error: 'Only the original requester can resubmit' });
    }

    // Update ITHardwareRequest with revised details
    await prisma.iTHardwareRequest.updateMany({
      where: { requestId: id },
      data: {
        hardwareName,
        hardwareModel: hardwareModel || null,
        estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : null,
        preferredVendor: preferredVendor || null,
        productUrl: productUrl || null,
        businessJustification,
      },
    });

    // Keep customFields in sync
    const existingCf = (request.customFields as Record<string, unknown>) || {};
    await prisma.request.update({
      where: { id },
      data: {
        status: 'PENDING_MANAGER_APPROVAL_IT',
        customFields: {
          ...existingCf,
          hardwareName,
          hardwareModel,
          estimatedPrice,
          preferredVendor,
          productUrl,
          businessJustification,
        },
      },
    });

    // Reset the existing manager approval to PENDING
    await prisma.requestApproval.updateMany({
      where: { requestId: id, approverType: 'MANAGER' },
      data: { status: 'PENDING', comments: null },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: resubmitNotes ? `Request resubmitted with revisions: ${resubmitNotes}` : 'Request resubmitted for manager approval',
        authorName: currentUser?.firstName || 'Requester',
        isSystemGenerated: false,
      },
    });

    // Find the manager who last rejected and notify them
    const managerApproval = await prisma.requestApproval.findFirst({
      where: { requestId: id, approverType: 'MANAGER' },
      orderBy: { createdAt: 'desc' },
    });
    if (managerApproval?.approverId) {
      await notify(managerApproval.approverId, `IT request ${id} has been revised and resubmitted for your approval.`);
    }

    return res.json({ success: true, message: 'Request resubmitted for manager approval' });
  } catch (error) {
    console.error('resubmitRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 4: Register vpDecision and resubmitRequest routes**

In `backend/src/routes/it-workflow.routes.ts`, add the new imports and routes:

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
} from '../controllers/it-workflow.controller';

// ... existing routes ...
router.post('/requests/:id/vp-decision', vpDecision);
router.post('/requests/:id/resubmit', resubmitRequest);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd c:/CWC2.0/backend
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd c:/CWC2.0
git add backend/src/controllers/it-workflow.controller.ts backend/src/routes/it-workflow.routes.ts
git commit -m "feat: add VP decision, resubmit endpoints, and VP threshold check in manager approval"
```

---

### Task 14: Create ResubmitModal, VpApprovalModal, VpRejectModal

**Files:**
- Create: `frontend/src/components/request-detail/ResubmitModal.tsx`
- Create: `frontend/src/components/request-detail/VpApprovalModal.tsx`
- Create: `frontend/src/components/request-detail/VpRejectModal.tsx`

- [ ] **Step 1: Create ResubmitModal.tsx**

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface ResubmitModalProps {
  requestId: string;
  initialValues?: {
    hardwareName?: string;
    hardwareModel?: string;
    estimatedPrice?: number;
    preferredVendor?: string;
    productUrl?: string;
    businessJustification?: string;
  };
  onSuccess: () => void;
  onClose: () => void;
}

const ResubmitModal: React.FC<ResubmitModalProps> = ({ requestId, initialValues = {}, onSuccess, onClose }) => {
  const [hardwareName, setHardwareName] = useState(initialValues.hardwareName || '');
  const [hardwareModel, setHardwareModel] = useState(initialValues.hardwareModel || '');
  const [estimatedPrice, setEstimatedPrice] = useState(initialValues.estimatedPrice?.toString() || '');
  const [preferredVendor, setPreferredVendor] = useState(initialValues.preferredVendor || '');
  const [productUrl, setProductUrl] = useState(initialValues.productUrl || '');
  const [businessJustification, setBusinessJustification] = useState(initialValues.businessJustification || '');
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hardwareName.trim() || !businessJustification.trim()) {
      setError('Hardware Name and Business Justification are required');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.resubmitRequest(requestId, {
        hardwareName,
        hardwareModel: hardwareModel || undefined,
        estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : undefined,
        preferredVendor: preferredVendor || undefined,
        productUrl: productUrl || undefined,
        businessJustification,
        resubmitNotes: resubmitNotes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resubmit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-600">refresh</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Revise & Resubmit</h2>
            <p className="text-xs text-gray-500">Update your request details and resubmit for approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Hardware Name <span className="text-red-500">*</span></label>
              <input type="text" value={hardwareName} onChange={e => setHardwareName(e.target.value)} required
                placeholder="e.g. External Monitor, Laptop, Keyboard"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Preferred Model <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <input type="text" value={hardwareModel} onChange={e => setHardwareModel(e.target.value)}
                placeholder="e.g. LG 27UP850N-W"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Estimated Price (USD) <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <input type="number" min="0" step="0.01" value={estimatedPrice} onChange={e => setEstimatedPrice(e.target.value)}
                placeholder="e.g. 450.00"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Preferred Vendor <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <input type="text" value={preferredVendor} onChange={e => setPreferredVendor(e.target.value)}
                placeholder="e.g. Dell, Logitech"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Product URL <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <input type="url" value={productUrl} onChange={e => setProductUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Business Justification <span className="text-red-500">*</span></label>
              <textarea value={businessJustification} onChange={e => setBusinessJustification(e.target.value)} rows={3} required
                placeholder="Explain why this hardware is needed"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Resubmit Notes <span className="font-normal normal-case text-gray-400">(optional — address rejection reason)</span></label>
              <textarea value={resubmitNotes} onChange={e => setResubmitNotes(e.target.value)} rows={2}
                placeholder="e.g. Reduced price by selecting a different model as suggested"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Resubmit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResubmitModal;
```

- [ ] **Step 2: Create VpApprovalModal.tsx**

```tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

interface VpApprovalModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const VpApprovalModal: React.FC<VpApprovalModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/v1/it-workflow/requests/${requestId}/vp-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision: 'APPROVED', comments }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'VP approval failed');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-600">verified</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">VP Approve Request</h2>
            <p className="text-xs text-gray-500">High-value hardware — VP sign-off required</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Approval Comments <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3}
                placeholder="Any notes for this approval…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Approving…' : 'VP Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VpApprovalModal;
```

- [ ] **Step 3: Create VpRejectModal.tsx**

```tsx
import React, { useState } from 'react';

interface VpRejectModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const VpRejectModal: React.FC<VpRejectModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/v1/it-workflow/requests/${requestId}/vp-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision: 'REJECTED', comments }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'VP rejection failed');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to reject');
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
            <h2 className="font-bold text-base text-gray-900">VP Reject Request</h2>
            <p className="text-xs text-gray-500">High-value hardware — reject and notify requester</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Rejection Reason <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3}
                placeholder="Explain why this request is being rejected…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-400 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {submitting ? 'Rejecting…' : 'VP Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VpRejectModal;
```

- [ ] **Step 4: Verify frontend builds cleanly**

```bash
cd c:/CWC2.0/frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd c:/CWC2.0
git add frontend/src/components/request-detail/ResubmitModal.tsx frontend/src/components/request-detail/VpApprovalModal.tsx frontend/src/components/request-detail/VpRejectModal.tsx
git commit -m "feat: add ResubmitModal, VpApprovalModal, VpRejectModal components"
```

---

### Task 15: Wire isRequester prop through RequestDetail → ActionSidebar

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

- [ ] **Step 1: Pass requesterId and userId to ActionSidebar**

Find where `<ActionSidebar>` is rendered in `frontend/pages/RequestDetail.tsx`. The component needs to know if the current user is the requester. Look for the `request.requester.id` value and the current user's id from `AuthContext`.

Add `requesterId` to the `ActionSidebar` props interface in `ActionSidebar.tsx`:

```tsx
  requesterId?: string;
```

And use it in the `getWorkflowActions` call:

```tsx
  const isRequester = userId === requesterId;
  const actions = getWorkflowActions(status, userRoles, isAssigned, isDesignatedApprover, requestTypeName, isRequester);
```

In `RequestDetail.tsx`, pass the prop:

```tsx
<ActionSidebar
  ...
  requesterId={request.requester?.id}
  ...
/>
```

Also pass `initialValues` to `ResubmitModal` from the `request.itHardwareRequest` data. In `ActionSidebar.tsx`, add an optional `hardwareDetails` prop and pass it to `ResubmitModal`:

```tsx
interface ActionSidebarProps {
  ...
  hardwareDetails?: {
    hardwareName?: string;
    hardwareModel?: string;
    estimatedPrice?: number;
    preferredVendor?: string;
    productUrl?: string;
    businessJustification?: string;
  };
}
```

Then in the modal render:
```tsx
{openModal === 'RESUBMIT' && <ResubmitModal requestId={requestId} initialValues={hardwareDetails} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
```

In `RequestDetail.tsx`, pass `hardwareDetails={request.itHardwareRequest}` to `ActionSidebar`.

- [ ] **Step 2: Verify frontend builds**

```bash
cd c:/CWC2.0/frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd c:/CWC2.0
git add frontend/pages/RequestDetail.tsx frontend/src/components/request-detail/ActionSidebar.tsx
git commit -m "feat: wire isRequester and hardwareDetails props to enable resubmit action for requesters"
```

---

### Task 16: Final verification

- [ ] **Step 1: Run backend dev server and verify no startup errors**

```bash
cd c:/CWC2.0/backend
npm run dev
```

Expected: server starts on port 3000 with no errors.

- [ ] **Step 2: Run frontend dev server**

```bash
cd c:/CWC2.0/frontend
npm run dev
```

Expected: Vite starts on port 5173 with no errors.

- [ ] **Step 3: Smoke test the full happy path in browser**

1. Log in as `user@helpdesk.com` / `user123` → go to IT Support → Request new hardware
2. Verify the form shows 6 fields: Hardware Name, Preferred Model, Estimated Price, Preferred Vendor, Product URL, Business Justification
3. Submit a request with price < $2,500. Verify reference number is `IT-N` format
4. Log in as `admin@helpdesk.com` / `admin123` → find the request → assign to agent
5. Click "Submit for Manager Approval" → select a manager → submit
6. Log in as the manager → find the request → click "Approve" → verify status changes to `MANAGER_APPROVED_IT`
7. Log in as admin → "Start Procurement" → verify status = `PROCUREMENT_IN_PROGRESS`
8. "Mark Hardware Ordered" (enter order number + tracking) → verify status = `HARDWARE_ORDERED`
9. "Mark Hardware Received" → verify status = `HARDWARE_RECEIVED`
10. "Mark Software Provisioned" → verify status = `SOFTWARE_PROVISIONED`
11. "Close & Resolve" → verify status = `RESOLVED`

- [ ] **Step 4: Smoke test rejection + resubmit path**

1. Create a new hardware request
2. Submit for approval → have manager reject it
3. Log in as the requester → verify "Revise & Resubmit" action appears
4. Click Revise & Resubmit → update justification → submit
5. Verify status goes back to `PENDING_MANAGER_APPROVAL_IT`

- [ ] **Step 5: Smoke test VP threshold path**

1. Create a hardware request with Estimated Price = $3,000
2. Submit for approval → have manager approve it
3. Verify status becomes `PENDING_VP_APPROVAL_IT` (not `MANAGER_APPROVED_IT`)
4. Log in as admin → verify VP Approve/Reject actions appear
5. VP Approve → verify status becomes `MANAGER_APPROVED_IT` and procurement flow continues

- [ ] **Step 6: Final commit**

```bash
cd c:/CWC2.0
git add -A
git commit -m "feat: complete Request New Hardware workflow — all 11 audit issues resolved"
```

---

### Task 17: Manager auto-suggest in SubmitForApprovalModal

**Files:**
- Modify: `backend/src/routes/it-workflow.routes.ts`
- Modify: `backend/src/controllers/it-workflow.controller.ts`
- Modify: `frontend/src/components/request-detail/SubmitForApprovalModal.tsx`

> `User.managerId` already exists in the Prisma schema (schema.prisma line 28). No migration needed.

- [ ] **Step 1: Add backend endpoint to fetch suggested manager**

Add a new GET route in `backend/src/routes/it-workflow.routes.ts`:

```typescript
import { getSuggestedManager } from '../controllers/it-workflow.controller';
// ...
router.get('/requests/:id/suggested-manager', getSuggestedManager);
```

- [ ] **Step 2: Add getSuggestedManager() controller action**

Append to `backend/src/controllers/it-workflow.controller.ts`:

```typescript
export async function getSuggestedManager(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            managerId: true,
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const manager = request.requester?.manager ?? null;
    return res.json({ manager });
  } catch (error) {
    console.error('getSuggestedManager error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 3: Update SubmitForApprovalModal to fetch and pre-select suggested manager**

Replace the `useEffect` that fetches managers in `frontend/src/components/request-detail/SubmitForApprovalModal.tsx` with two effects — one to fetch managers, one to fetch the suggested manager:

```tsx
  const [suggestedManagerId, setSuggestedManagerId] = useState<string | null>(null);

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await apiClient.get('/users', { params: { limit: 100 } });
        const all: Manager[] = res.data.data.users.map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          roles: u.roles?.map((r: any) => (typeof r === 'string' ? r : (r.role?.name ?? r.name))) ?? [],
        }));
        const adminsAndManagers = all.filter(u =>
          u.roles.some(r => ['ADMIN', 'admin', 'CEO', 'ceo', 'MANAGER', 'manager'].includes(r))
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
    const fetchSuggested = async () => {
      try {
        const res = await apiClient.get(`/it-workflow/requests/${requestId}/suggested-manager`);
        const manager = res.data.manager;
        if (manager) {
          setSuggestedManagerId(manager.id);
          setSelectedId(manager.id);
        }
      } catch {
        // no-op: fall back to manual selection
      }
    };
    fetchSuggested();
  }, [requestId]);
```

Then update the manager list rendering to show a "Suggested" badge for the pre-selected manager. Find the `filtered.map(m => (...))` block and update the label:

```tsx
                    filtered.map(m => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                          selectedId === m.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="manager"
                          value={m.id}
                          checked={selectedId === m.id}
                          onChange={() => setSelectedId(m.id)}
                          className="accent-[#0052cc] w-4 h-4 flex-shrink-0"
                        />
                        <div className="size-8 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {m.firstName[0]}{m.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.firstName} {m.lastName}</p>
                            {m.id === suggestedManagerId && (
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">Suggested</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                      </label>
                    ))
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd c:/CWC2.0/backend && npm run build
cd c:/CWC2.0/frontend && npm run build
```

Expected: no errors in either.

- [ ] **Step 5: Commit**

```bash
cd c:/CWC2.0
git add backend/src/routes/it-workflow.routes.ts backend/src/controllers/it-workflow.controller.ts frontend/src/components/request-detail/SubmitForApprovalModal.tsx
git commit -m "feat: auto-suggest requester's direct manager in SubmitForApprovalModal"
```
