import { Request, Response } from 'express';
import { notify } from '../services/notification.service';
import { hasRole } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import { transitionRequest } from '../services/requestTransition.service';
import path from 'path';
import { reassignToTeam } from '../services/reassign.service';

/** Infer an IT asset category from the hardware name/description. */
function inferCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (/\b(laptop|macbook|notebook|thinkpad)\b/i.test(lower)) return 'LAPTOP';
  if (/\b(desktop|pc|workstation|imac)\b/i.test(lower)) return 'DESKTOP';
  if (/\b(monitor|display|screen)\b/i.test(lower)) return 'MONITOR';
  if (/\b(phone|iphone|mobile)\b/i.test(lower)) return 'PHONE';
  if (/\b(printer|scanner)\b/i.test(lower)) return 'PRINTER';
  if (/\b(router|switch|firewall|access.point|network)\b/i.test(lower)) return 'NETWORK';
  if (/\b(peripheral|keyboard|mouse|headset|webcam|dock)\b/i.test(lower)) return 'PERIPHERAL';
  if (/\b(software|license|subscription|office|adobe)\b/i.test(lower)) return 'SOFTWARE_LICENSE';
  return 'LAPTOP';
}

import prisma from '../utils/prisma';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRequestId(idOrRef: string): Promise<string | null> {
  if (UUID_RE.test(idOrRef)) return idOrRef;
  const row = await prisma.request.findFirst({
    where: { referenceNumber: idOrRef, deletedAt: null },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Helper: extract common transition options from an Express request.
 * Reduces boilerplate in each handler.
 */
function transitionOpts(req: Request, overrides?: { comment?: string; skipNotifications?: boolean; skipAutoAssignment?: boolean; metadata?: Record<string, unknown>; source?: string }) {
  const user = (req as any).user;
  const userRoles: string[] = user?.roles || [];
  return {
    userId: user?.id || 'system',
    userName: user?.firstName || user?.email || 'System',
    userRole: userRoles[0] || undefined,
    metadata: { userRoles, ...overrides?.metadata },
    skipNotifications: overrides?.skipNotifications ?? true,
    skipAutoAssignment: overrides?.skipAutoAssignment ?? true,
    skipSlaPause: true, // Controllers manage SLA pause/resume explicitly where needed
    comment: overrides?.comment,
    source: overrides?.source || 'it-workflow',
  };
}

export async function markProcurement(req: Request, res: Response) {
  try {
    const idOrRef = String(req.params.id);
    const id = await resolveRequestId(idOrRef);
    if (!id) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }
    const { orderNumber, vendor, estimatedDelivery } = req.body;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Transition: SUBMITTED → PROCUREMENT_IN_PROGRESS (guards check assignment + IT desk)
    await transitionRequest(id, 'PROCUREMENT_IN_PROGRESS', transitionOpts(req, {
      comment: `Procurement initiated. Order: ${orderNumber || 'N/A'}, Vendor: ${vendor || 'N/A'}`,
      source: 'it-workflow/procurement',
    }));

    // Update customFields with procurement info
    const existingCustomFields = (request.customFields as Record<string, unknown>) || {};
    await prisma.request.update({
      where: { id },
      data: {
        customFields: {
          ...existingCustomFields,
          procurement: {
            orderNumber,
            vendor,
            estimatedDelivery,
            startedAt: new Date().toISOString(),
          },
        },
      },
    });

    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'PROCUREMENT_INITIATED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
    }

    return res.json({ success: true, message: 'Request marked as procurement in progress' });
  } catch (error: any) {
    console.error('markProcurement error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markFulfilled(req: Request, res: Response) {
  try {
    const idOrRef = String(req.params.id);
    const id = await resolveRequestId(idOrRef);
    if (!id) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }
    const { notes } = req.body;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Transition: SOFTWARE_PROVISIONED → RESOLVED (guards check assignment)
    await transitionRequest(id, 'RESOLVED', transitionOpts(req, {
      comment: notes || 'Request closed and resolved',
      source: 'it-workflow/fulfilled',
    }));

    return res.json({ success: true, message: 'Request closed and resolved' });
  } catch (error: any) {
    console.error('markFulfilled error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markHardwareOrdered(req: Request, res: Response) {
  try {
    const idOrRef = String(req.params.id);
    const id = await resolveRequestId(idOrRef);
    if (!id) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }
    const { orderNumber, vendor, trackingNumber } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { serviceDesk: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Transition: PROCUREMENT_IN_PROGRESS → HARDWARE_ORDERED (guards check assignment + IT desk)
    await transitionRequest(id, 'HARDWARE_ORDERED', transitionOpts(req, {
      comment: `Hardware ordered. Order: ${orderNumber || 'N/A'}, Vendor: ${vendor || 'N/A'}${trackingNumber ? `, Tracking: ${trackingNumber}` : ''}`,
      source: 'it-workflow/hardware-ordered',
    }));

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) {
      return res.status(400).json({ error: 'No hardware request record found for this request' });
    }

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
      data: {
        orderNumber: orderNumber || null,
        trackingNumber: trackingNumber || null,
        preferredVendor: vendor || null,
        procurementStatus: 'ORDERED',
      },
    });

    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'HARDWARE_ORDERED', variables: { requestId: String(id), orderNumber: orderNumber || '' }, relatedRequestId: String(id) });
    }

    return res.json({ success: true, message: 'Hardware marked as ordered' });
  } catch (error: any) {
    console.error('markHardwareOrdered error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markHardwareReceived(req: Request, res: Response) {
  try {
    const idOrRef = String(req.params.id);
    const id = await resolveRequestId(idOrRef);
    if (!id) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }
    const { notes, assetTag, serialNumber, registerAsAsset = false } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { assignedTo: true, serviceDesk: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Transition: HARDWARE_ORDERED → HARDWARE_RECEIVED (guards check assignment + IT desk)
    await transitionRequest(id, 'HARDWARE_RECEIVED', transitionOpts(req, {
      comment: [notes, assetTag ? `Asset tag: ${assetTag}` : null].filter(Boolean).join('. '),
      source: 'it-workflow/hardware-received',
    }));

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) {
      return res.status(400).json({ error: 'No hardware request record found for this request' });
    }

    // Auto-create Asset if requested and no duplicate assetTag
    let assetId: string | null = null;
    if (registerAsAsset && assetTag) {
      const existingAsset = await prisma.asset.findFirst({
        where: { OR: [{ assetTag }, ...(serialNumber ? [{ serialNumber }] : [])] },
      });
      if (!existingAsset) {
        const authReq = req as any;
        const createdById = authReq.user?.id;
        if (createdById) {
          const asset = await prisma.asset.create({
            data: {
              assetTag: assetTag.trim(),
              serialNumber: serialNumber?.trim() || null,
              name: hardwareReq.hardwareName && hardwareReq.hardwareName !== 'Unknown'
                ? hardwareReq.hardwareName
                : request.summary || 'Unspecified Hardware',
              category: (hardwareReq.hardwareName && hardwareReq.hardwareName !== 'Unknown'
                ? inferCategoryFromName(hardwareReq.hardwareName)
                : 'LAPTOP') as any,
              vendor: hardwareReq.preferredVendor || null,
              purchasePrice: hardwareReq.estimatedPrice ? Number(hardwareReq.estimatedPrice) : null,
              status: 'IN_STOCK',
              sourceRequestId: id,
              createdById,
            },
          });
          assetId = asset.id;
        }
      }
    }

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
      data: {
        procurementStatus: 'RECEIVED',
        assetTag: assetTag || null,
        serialNumber: serialNumber || null,
        ...(assetId ? { assetId } : {}),
      },
    });

    if (request.assignedToId && request.assignedToId !== request.requesterId) {
      await notify({ userId: request.assignedToId, eventType: 'ACTION_REQUIRED', variables: { requestId: String(id), action: 'hardware_provision' }, relatedRequestId: String(id) });
    }

    return res.json({ success: true, message: 'Hardware marked as received', assetId });
  } catch (error: any) {
    console.error('markHardwareReceived error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markSoftwareProvisioned(req: Request, res: Response) {
  try {
    const idOrRef = String(req.params.id);
    const id = await resolveRequestId(idOrRef);
    if (!id) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }
    const { provisioningNotes, softwareInstalled } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { serviceDesk: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Transition: HARDWARE_RECEIVED → SOFTWARE_PROVISIONED (guards check assignment + IT desk)
    await transitionRequest(id, 'SOFTWARE_PROVISIONED', transitionOpts(req, {
      comment: ['Software provisioned', softwareInstalled ? `Software installed: ${softwareInstalled}` : null, provisioningNotes].filter(Boolean).join('. '),
      source: 'it-workflow/software-provisioned',
    }));

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) {
      return res.status(400).json({ error: 'No hardware request record found for this request' });
    }

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
      data: { procurementStatus: 'PROVISIONED' },
    });

    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'HARDWARE_DELIVERED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
    }

    return res.json({ success: true, message: 'Software provisioned' });
  } catch (error: any) {
    console.error('markSoftwareProvisioned error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export const acknowledgeRequest = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { notes, ceoId } = req.body as { notes?: string; ceoId?: string };
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!request.serviceDesk || request.serviceDesk.code !== 'IT') return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    if (request.status !== 'SUBMITTED') return res.status(400).json({ error: 'Request must be in SUBMITTED status' });

    // Resolve the CEO: prefer agent's manual pick, fall back to auto-route.
    let ceoUser: { id: string; firstName: string; lastName: string } | null = null;
    let approverSource: 'manual' | 'auto' = 'auto';

    if (ceoId) {
      ceoUser = await prisma.user.findFirst({
        where: { id: ceoId, isActive: true, executiveRole: 'CEO' },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!ceoUser) {
        return res.status(400).json({ error: `No active CEO user found with id "${ceoId}". Pick a valid CEO or omit the field to auto-route.` });
      }
      approverSource = 'manual';
    } else {
      ceoUser = await prisma.user.findFirst({
        where: { executiveRole: 'CEO', isActive: true },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    if (!ceoUser) {
      return res.status(400).json({ error: 'No active CEO user found in the system. Please create a CEO user first.' });
    }

    // Transition: SUBMITTED → PENDING_CEO_APPROVAL_IT with auto-assignment to CEO
    // Guards: service-desk guard checks IT; we skip auto-assignment because we set assignedToId explicitly
    await transitionRequest(id, 'PENDING_CEO_APPROVAL_IT', {
      ...transitionOpts(req, {
        comment: notes || undefined,
        source: 'it-workflow/acknowledge',
      }),
      skipAutoAssignment: true,
    });

    // Explicitly assign to CEO (transitionRequest doesn't know about executive role routing)
    await prisma.request.update({ where: { id }, data: { assignedToId: ceoUser.id } });

    // Pause SLA during approval
    const { pauseSla } = await import('../services/sla-pause.service');
    await pauseSla(id);

    await prisma.requestApproval.create({
      data: {
        requestId: id,
        approverType: 'CEO',
        approverId: ceoUser.id,
        status: 'PENDING',
        comments: notes || null,
      },
    });

    await notify({ userId: ceoUser.id, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CEO' }, relatedRequestId: id });

    await auditLog(req as any, 'IT_ACKNOWLEDGE_ROUTE_CEO', 'request', String(id), {
      status: 'PENDING_CEO_APPROVAL_IT',
      previousStatus: request.status,
      ceoId: ceoUser.id,
      approverSource,
      notes: notes || null,
    }, { status: request.status });
    return res.json({ success: true, message: `Request acknowledged and routed to CEO (${ceoUser.firstName} ${ceoUser.lastName})${approverSource === 'manual' ? ' [manual selection]' : ''}` });
  } catch (error: any) {
    console.error('acknowledgeRequest error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const ceoDecision = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { decision, comments, ctoId } = req.body as { decision: string; comments?: string; ctoId?: string };
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id }, include: { requester: true } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CEO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CEO approval' });

    // Track CTO approver source for audit log (declared in function scope so the
    // audit log after the if/else block can reference it)
    let ctoApproverSource: 'manual' | 'auto' = 'auto';

    if (decision === 'APPROVED') {
      // Resolve the CTO: prefer CEO's manual pick, fall back to auto-route.
      let ctoUser: { id: string; firstName: string; lastName: string } | null = null;

      if (ctoId) {
        ctoUser = await prisma.user.findFirst({
          where: { id: ctoId, isActive: true, executiveRole: 'CTO' },
          select: { id: true, firstName: true, lastName: true },
        });
        if (!ctoUser) {
          return res.status(400).json({ error: `No active CTO user found with id "${ctoId}". Pick a valid CTO or omit the field to auto-route.` });
        }
        ctoApproverSource = 'manual';
      } else {
        ctoUser = await prisma.user.findFirst({
          where: { executiveRole: 'CTO', isActive: true },
          select: { id: true, firstName: true, lastName: true },
        });
      }
      if (!ctoUser) {
        return res.status(400).json({ error: 'No active CTO user found in the system. Please create a CTO user first.' });
      }

      // Step 1: PENDING_CEO_APPROVAL_IT → CEO_APPROVED_IT (guard checks CEO role)
      await transitionRequest(id, 'CEO_APPROVED_IT', {
        ...transitionOpts(req, {
          comment: comments || undefined,
          source: 'it-workflow/ceo-approve',
        }),
        skipAutoAssignment: true,
      });

      // Assign to CTO for next step
      await prisma.request.update({ where: { id }, data: { assignedToId: ctoUser.id } });

      // Step 2: CEO_APPROVED_IT → PENDING_CTO_APPROVAL_IT (with SLA pause)
      await transitionRequest(id, 'PENDING_CTO_APPROVAL_IT', {
        ...transitionOpts(req, {
          source: 'it-workflow/ceo-approve',
        }),
        skipAutoAssignment: true,
      });

      const { pauseSla, resumeSla } = await import('../services/sla-pause.service');
      await resumeSla(id); // resume from CEO approval pause
      await pauseSla(id);  // pause for CTO approval

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CEO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null },
      });

      await prisma.requestApproval.create({
        data: { requestId: id, approverType: 'CTO', approverId: ctoUser.id, status: 'PENDING', comments: null },
      });

      await notify({ userId: ctoUser.id, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CTO' }, relatedRequestId: id });
    } else {
      // CEO Rejection: two-step — PENDING_CEO_APPROVAL_IT → CEO_REJECTED_IT → REJECTED
      await transitionRequest(id, 'CEO_REJECTED_IT', {
        ...transitionOpts(req, {
          comment: comments || 'CEO rejected the request',
          source: 'it-workflow/ceo-reject',
        }),
      });

      await transitionRequest(id, 'REJECTED', {
        ...transitionOpts(req, {
          comment: comments || undefined,
          source: 'it-workflow/ceo-reject',
        }),
      });

      const { resumeSla } = await import('../services/sla-pause.service');
      await resumeSla(id);

      await reassignToTeam(id, request.referenceNumber, 'IT', 'IT-Workflow');

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CEO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null },
      });
    }

    await auditLog(req as any, 'IT_CEO_DECISION', 'request', String(id), {
      decision,
      approverType: 'CEO',
      previousStatus: 'PENDING_CEO_APPROVAL_IT',
      comments: comments || null,
      ...(decision === 'APPROVED' ? { approverSource: ctoApproverSource } : {}),
    }, { status: 'PENDING_CEO_APPROVAL_IT' });
    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by CEO` });
  } catch (error: any) {
    console.error('ceoDecision error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const ctoDecision = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CTO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CTO approval' });

    if (decision === 'APPROVED') {
      // Step 1: PENDING_CTO_APPROVAL_IT → CTO_APPROVED_IT (guard checks CTO role)
      await transitionRequest(id, 'CTO_APPROVED_IT', {
        ...transitionOpts(req, {
          comment: comments || undefined,
          source: 'it-workflow/cto-approve',
        }),
      });

      // Step 2: CTO_APPROVED_IT → PENDING_INVOICE_IT (with SLA resume + pause)
      await transitionRequest(id, 'PENDING_INVOICE_IT', {
        ...transitionOpts(req, {
          source: 'it-workflow/cto-approve',
        }),
      });

      const { pauseSla, resumeSla } = await import('../services/sla-pause.service');
      await resumeSla(id);
      await pauseSla(id);

      await reassignToTeam(id, request.referenceNumber, 'IT');

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CTO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null, approverId: currentUser.id },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { requestId: id, newStatus: 'PENDING_INVOICE_IT', changedBy: 'CTO' }, relatedRequestId: id });
      }
    } else {
      // CTO Rejection: two-step — PENDING_CTO_APPROVAL_IT → CTO_REJECTED_IT → REJECTED
      await transitionRequest(id, 'CTO_REJECTED_IT', {
        ...transitionOpts(req, {
          comment: comments || 'CTO rejected the request',
          source: 'it-workflow/cto-reject',
        }),
      });

      await transitionRequest(id, 'REJECTED', {
        ...transitionOpts(req, {
          source: 'it-workflow/cto-reject',
        }),
      });

      const { resumeSla } = await import('../services/sla-pause.service');
      await resumeSla(id);

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CTO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null, approverId: currentUser.id },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'REQUEST_REJECTED', variables: { requestId: id, rejectedBy: 'CTO', comments: comments || '' }, relatedRequestId: id });
      }
    }

    await auditLog(req as any, 'IT_CTO_DECISION', 'request', String(id), {
      decision,
      approverType: 'CTO',
      previousStatus: 'PENDING_CTO_APPROVAL_IT',
      comments: comments || null,
    }, { status: 'PENDING_CTO_APPROVAL_IT' });
    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by CTO` });
  } catch (error: any) {
    console.error('ctoDecision error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const routeToCfoApproval = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { cfoId, notes } = req.body;
    const currentUser = (req as any).user;
    const files = (req as any).files as Express.Multer.File[] | undefined;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one invoice file is required' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!cfoId || !uuidRegex.test(cfoId)) {
      return res.status(400).json({ error: 'Invalid cfoId: must be a valid UUID' });
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_INVOICE_IT') {
      return res.status(400).json({ error: 'Request must be in PENDING_INVOICE_IT status' });
    }

    const cfoUser = await prisma.user.findUnique({
      where: { id: cfoId },
      include: { roles: { include: { role: true } } },
    });
    if (!cfoUser) return res.status(404).json({ error: 'CFO user not found' });
    const hasCfoRole = (cfoUser as any).roles.some((r: any) => r.role?.name === 'CFO');
    if (!hasCfoRole) {
      return res.status(400).json({ error: 'Selected user does not have CFO role' });
    }

    // Transition: PENDING_INVOICE_IT → PENDING_CFO_APPROVAL_IT
    await transitionRequest(id, 'PENDING_CFO_APPROVAL_IT', {
      ...transitionOpts(req, {
        comment: notes || undefined,
        source: 'it-workflow/route-cfo',
      }),
    });

    const { pauseSla, resumeSla } = await import('../services/sla-pause.service');
    await resumeSla(id);
    await pauseSla(id);

    await prisma.requestApproval.create({
      data: {
        requestId: id,
        approverType: 'CFO',
        approverId: cfoId,
        status: 'PENDING',
        comments: notes || null,
      },
    });

    // Create a system activity and link invoice attachments
    const fileCount = files.length;
    const invoiceLabel = fileCount === 1 ? 'Invoice uploaded' : `${fileCount} invoices uploaded`;
    const activity = await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `${invoiceLabel} and routed to CFO for approval${notes ? ': ' + notes : ''}`,
        authorName: currentUser.firstName || 'Agent',
        authorRole: 'AGENT',
        isSystemGenerated: true,
        authorId: currentUser.id,
      },
    });

    for (const file of files) {
      await prisma.requestAttachment.create({
        data: {
          requestId: id,
          uploadedById: currentUser.id,
          activityId: activity.id,
          fileName: file.originalname,
          fileSize: BigInt(file.size),
          mimeType: file.mimetype,
          fileType: path.extname(file.originalname).replace('.', ''),
          storagePath: (file as any).key,
          storageUrl: (file as any).key,
        },
      });
    }

    await notify({
      userId: cfoId,
      eventType: 'APPROVAL_REQUIRED',
      variables: { requestId: id, role: 'CFO' },
      relatedRequestId: id,
    });

    await auditLog(req as any, 'IT_ROUTE_CFO', 'request', String(id), {
      status: 'PENDING_CFO_APPROVAL_IT',
      previousStatus: request.status,
      cfoId,
    }, { status: request.status });
    return res.json({ success: true, message: `${invoiceLabel} and request routed to CFO for approval` });
  } catch (error: any) {
    console.error('routeToCfoApproval error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const cfoDecision = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CFO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CFO approval' });

    if (decision === 'APPROVED') {
      // Step 1: PENDING_CFO_APPROVAL_IT → CFO_APPROVED_IT (guard checks CFO role)
      await transitionRequest(id, 'CFO_APPROVED_IT', {
        ...transitionOpts(req, {
          comment: comments || undefined,
          source: 'it-workflow/cfo-approve',
        }),
      });

      // Step 2: CFO_APPROVED_IT → PAYMENT_PROCESSING_IT
      await transitionRequest(id, 'PAYMENT_PROCESSING_IT', {
        ...transitionOpts(req, {
          source: 'it-workflow/cfo-approve',
        }),
      });

      const { resumeSla } = await import('../services/sla-pause.service');
      await resumeSla(id);

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null, approverId: currentUser.id },
      });

      if (request.assignedToId) {
        await notify({ userId: request.assignedToId, eventType: 'ACTION_REQUIRED', variables: { requestId: id, action: 'payment_processing' }, relatedRequestId: id });
      }
      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { requestId: id, newStatus: 'PAYMENT_PROCESSING_IT', changedBy: 'CFO' }, relatedRequestId: id });
      }

      await reassignToTeam(id, request.referenceNumber, 'FINANCE');
    } else {
      // CFO Rejection: two-step — PENDING_CFO_APPROVAL_IT → CFO_REJECTED_IT → REJECTED
      await transitionRequest(id, 'CFO_REJECTED_IT', {
        ...transitionOpts(req, {
          comment: comments || 'CFO rejected the request',
          source: 'it-workflow/cfo-reject',
        }),
      });

      await transitionRequest(id, 'REJECTED', {
        ...transitionOpts(req, {
          source: 'it-workflow/cfo-reject',
        }),
      });

      const { resumeSla } = await import('../services/sla-pause.service');
      await resumeSla(id);

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null, approverId: currentUser.id },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'REQUEST_REJECTED', variables: { requestId: id, rejectedBy: 'CFO', comments: comments || '' }, relatedRequestId: id });
      }
    }

    await auditLog(req as any, 'IT_CFO_DECISION', 'request', String(id), {
      decision,
      approverType: 'CFO',
      previousStatus: 'PENDING_CFO_APPROVAL_IT',
      comments: comments || null,
    }, { status: 'PENDING_CFO_APPROVAL_IT' });
    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by CFO` });
  } catch (error: any) {
    console.error('cfoDecision error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const markPaymentDone = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { paymentReference, amount, paymentDate, notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!paymentReference) return res.status(400).json({ error: 'paymentReference is required' });
    if (amount === undefined || amount === null) return res.status(400).json({ error: 'amount is required' });
    if (!paymentDate) return res.status(400).json({ error: 'paymentDate is required' });

    const request = await prisma.request.findUnique({
      where: { id },
      include: { requestType: { include: { workflow: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PAYMENT_PROCESSING_IT') return res.status(400).json({ error: 'Request must be in PAYMENT_PROCESSING_IT status' });

    // Only admin or the assigned finance agent can mark payment done
    const isAdmin = hasRole(req, 'ADMIN');
    const isAssignedToMe = request.assignedToId === currentUser.id;
    if (!isAdmin && !isAssignedToMe) {
      return res.status(403).json({ error: 'Only the assigned finance agent or admin can mark payment as done' });
    }

    const workflowCode = request.requestType?.workflow?.code || '';
    const isHardwareProcurement = workflowCode === 'IT_HARDWARE_PROCUREMENT';

    // Step 1: PAYMENT_PROCESSING_IT → PAYMENT_DONE_IT
    await transitionRequest(id, 'PAYMENT_DONE_IT', {
      ...transitionOpts(req, {
        comment: `Payment completed. Reference: ${paymentReference}, Amount: ${amount}${notes ? '. ' + notes : ''}`,
        source: 'it-workflow/payment-done',
      }),
    });

    // Step 2: PAYMENT_DONE_IT → PROCUREMENT_IN_PROGRESS (hardware) or PENDING_DELIVERY_IT (software)
    const nextStatus = isHardwareProcurement ? 'PROCUREMENT_IN_PROGRESS' : 'PENDING_DELIVERY_IT';
    await transitionRequest(id, nextStatus, {
      ...transitionOpts(req, {
        source: 'it-workflow/payment-done',
      }),
    });

    // Update customFields with payment info
    const existingCustomFields = (request.customFields as Record<string, unknown>) || {};
    await prisma.request.update({
      where: { id },
      data: {
        customFields: {
          ...existingCustomFields,
          payment: { paymentReference, amount, paymentDate, completedAt: new Date().toISOString() },
        },
      },
    });

    if (request.assignedToId) {
      await notify({ userId: request.assignedToId, eventType: 'ACTION_REQUIRED', variables: { requestId: id, action: `pending_${isHardwareProcurement ? 'procurement' : 'delivery'}` }, relatedRequestId: id });
    }
    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { requestId: id, newStatus: nextStatus, changedBy: 'Finance' }, relatedRequestId: id });
    }

    await reassignToTeam(id, request.referenceNumber, 'IT');

    await auditLog(req as any, 'IT_PAYMENT_DONE', 'request', String(id), {
      status: nextStatus,
      previousStatus: 'PAYMENT_PROCESSING_IT',
      paymentReference: paymentReference || null,
      amount: Number(amount),
      paymentDate,
    }, { status: 'PAYMENT_PROCESSING_IT' });
    return res.json({ success: true, message: `Payment marked as done, request routed to ${isHardwareProcurement ? 'procurement phase' : 'pending delivery'}` });
  } catch (error: any) {
    console.error('markPaymentDone error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const completeDelivery = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_DELIVERY_IT') return res.status(400).json({ error: 'Request must be in PENDING_DELIVERY_IT status' });

    // Transition: PENDING_DELIVERY_IT → RESOLVED
    await transitionRequest(id, 'RESOLVED', {
      ...transitionOpts(req, {
        comment: notes || 'Hardware delivered. Request resolved.',
        source: 'it-workflow/delivery-complete',
      }),
    });

    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'REQUEST_RESOLVED', variables: { requestId: id }, relatedRequestId: id });
    }

    await auditLog(req as any, 'IT_DELIVERY_COMPLETE', 'request', String(id), {
      status: 'RESOLVED',
      previousStatus: 'PENDING_DELIVERY_IT',
    }, { status: 'PENDING_DELIVERY_IT' });
    return res.json({ success: true, message: 'Delivery completed and request resolved' });
  } catch (error: any) {
    console.error('completeDelivery error:', error);
    if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};