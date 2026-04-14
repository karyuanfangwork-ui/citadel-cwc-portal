import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { notify } from '../services/notification.service';
import { config } from '../config';

const prisma = new PrismaClient();

export async function submitForApproval(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { managerId, notes } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (managerId && !uuidRegex.test(managerId)) {
      return res.status(400).json({ error: 'Invalid managerId: must be a valid UUID' });
    }

    const request = await prisma.request.findUnique({
      where: { id },
      include: { serviceDesk: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.serviceDesk.code !== 'IT') {
      return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'PENDING_MANAGER_APPROVAL_IT' },
    });

    await prisma.requestApproval.create({
      data: {
        requestId: id,
        approverType: 'MANAGER',
        approverId: managerId,
        status: 'PENDING',
        comments: notes || null,
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: 'Request submitted for manager approval',
        authorName: 'System',
        isSystemGenerated: true,
      },
    });

    if (managerId) {
      await notify(managerId, `Request ${id} has been submitted for your approval.`);
    }

    return res.json({ success: true, message: 'Request submitted for manager approval' });
  } catch (error) {
    console.error('submitForApproval error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function managerDecision(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });
    }

    const request = await (prisma.request.findUnique({
      where: { id },
      include: { itHardwareRequest: true },
    }) as any);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PENDING_MANAGER_APPROVAL_IT') {
      return res.status(400).json({ error: 'Request is not pending manager approval' });
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

    if (decision === 'APPROVED') {
      const price = request.itHardwareRequest?.estimatedPrice
        ? Number(request.itHardwareRequest.estimatedPrice)
        : 0;
      const threshold = config.hardwareVpApprovalThreshold;

      if (price >= threshold) {
        // Route to VP approval
        await prisma.request.update({ where: { id }, data: { status: 'PENDING_VP_APPROVAL_IT' } });

        await prisma.requestApproval.updateMany({
          where: { requestId: id, approverType: 'MANAGER', status: 'PENDING' },
          data: { status: 'APPROVED', comments: comments || null },
        });

        await prisma.requestActivity.create({
          data: {
            requestId: id,
            activityType: 'APPROVAL',
            message: `Manager approved the request. Escalated to VP for high-value hardware (Estimated: $${price})`,
            authorName: currentUser?.firstName || 'Manager',
            authorRole: 'MANAGER',
            isSystemGenerated: false,
          },
        });

        // Notify VP users
        const vpUsers = await prisma.user.findMany({
          where: { roles: { some: { role: { name: 'ADMIN' } } } },
        });
        for (const vp of vpUsers) {
          await notify({ userId: vp.id, eventType: 'VP_APPROVAL_REQUIRED', variables: { requestId: String(id), price: String(price) }, relatedRequestId: String(id) });
        }
      } else {
        // Standard manager approval path
        await prisma.request.update({ where: { id }, data: { status: 'MANAGER_APPROVED_IT' } });

        await prisma.requestApproval.updateMany({
          where: { requestId: id, approverType: 'MANAGER', status: 'PENDING' },
          data: { status: 'APPROVED', comments: comments || null },
        });

        await prisma.requestActivity.create({
          data: {
            requestId: id,
            activityType: 'APPROVAL',
            message: `Manager approved the request${comments ? ': ' + comments : ''}`,
            authorName: currentUser?.firstName || 'Manager',
            authorRole: 'MANAGER',
            isSystemGenerated: false,
          },
        });

        if (request.requesterId) {
          await notify({ userId: request.requesterId, eventType: 'MANAGER_APPROVED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
        }
      }
    } else {
      // REJECTED
      await prisma.request.update({ where: { id }, data: { status: 'MANAGER_REJECTED_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'MANAGER', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'REJECTION',
          message: `Manager rejected the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser?.firstName || 'Manager',
          authorRole: 'MANAGER',
          isSystemGenerated: false,
        },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'MANAGER_REJECTED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
      }
    }

    return res.json({ success: true, message: `Request ${decision.toLowerCase()} by manager` });
  } catch (error) {
    console.error('managerDecision error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markProcurement(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { orderNumber, vendor, estimatedDelivery } = req.body;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const existingCustomFields = (request.customFields as Record<string, unknown>) || {};

    await prisma.request.update({
      where: { id },
      data: {
        status: 'PROCUREMENT_IN_PROGRESS',
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

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Procurement initiated. Order: ${orderNumber || 'N/A'}, Vendor: ${vendor || 'N/A'}`,
        authorName: 'System',
        isSystemGenerated: true,
        metadata: { orderNumber, vendor, estimatedDelivery },
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Procurement has been initiated for your IT request ${id}.`);
    }

    return res.json({ success: true, message: 'Request marked as procurement in progress' });
  } catch (error) {
    console.error('markProcurement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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

export async function markHardwareOrdered(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { orderNumber, vendor, trackingNumber } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { serviceDesk: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.serviceDesk.code !== 'IT') {
      return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    }

    if (request.status !== 'PROCUREMENT_IN_PROGRESS') {
      return res.status(400).json({ error: 'Request must be in PROCUREMENT_IN_PROGRESS status' });
    }

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) {
      return res.status(400).json({ error: 'No hardware request record found for this request' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'HARDWARE_ORDERED' },
    });

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
      data: {
        orderNumber: orderNumber || null,
        trackingNumber: trackingNumber || null,
        preferredVendor: vendor || null,
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
        metadata: { orderNumber, vendor, trackingNumber },
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

export async function markHardwareReceived(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { receivedDate, notes, assetTag } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { assignedTo: true, serviceDesk: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.serviceDesk.code !== 'IT') {
      return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    }

    if (request.status !== 'HARDWARE_ORDERED') {
      return res.status(400).json({ error: 'Request must be in HARDWARE_ORDERED status' });
    }

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) {
      return res.status(400).json({ error: 'No hardware request record found for this request' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'HARDWARE_RECEIVED' },
    });

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
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

export async function markSoftwareProvisioned(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { provisioningNotes, softwareInstalled } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: { serviceDesk: true },
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.serviceDesk.code !== 'IT') {
      return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    }

    if (request.status !== 'HARDWARE_RECEIVED') {
      return res.status(400).json({ error: 'Request must be in HARDWARE_RECEIVED status' });
    }

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) {
      return res.status(400).json({ error: 'No hardware request record found for this request' });
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'SOFTWARE_PROVISIONED' },
    });

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
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

export const vpDecision = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { decision, comments } = req.body; // 'APPROVED' | 'REJECTED'
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const request = await prisma.request.findUnique({
      where: { id },
      include: { requester: true, serviceDesk: true },
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_VP_APPROVAL_IT') {
      return res.status(400).json({ error: 'Request is not pending VP approval' });
    }

    // Auth check: must be ADMIN
    const isAdmin = currentUser?.roles?.some((r: any) => r.role?.name === 'ADMIN');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: VP approval requires admin role' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'MANAGER_APPROVED_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, status: 'PENDING' },
        data: { status: 'APPROVED', approverId: currentUser.id, comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'APPROVAL',
          message: `VP approved the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'VP',
          authorRole: 'VP',
          isSystemGenerated: false,
          metadata: { comments },
        },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'VP_APPROVED', variables: { requestId: id }, relatedRequestId: id });
      }
    } else if (decision === 'REJECTED') {
      await prisma.request.update({ where: { id }, data: { status: 'VP_REJECTED_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, status: 'PENDING' },
        data: { status: 'REJECTED', approverId: currentUser.id, comments: comments || null },
      });

      await prisma.requestActivity.create({
        data: {
          requestId: id,
          activityType: 'REJECTION',
          message: `VP rejected the request${comments ? ': ' + comments : ''}`,
          authorName: currentUser.firstName || 'VP',
          authorRole: 'VP',
          isSystemGenerated: false,
          metadata: { comments },
        },
      });

      if (request.requesterId) {
        await notify({ userId: request.requesterId, eventType: 'VP_REJECTED', variables: { requestId: id, comments: comments || '' }, relatedRequestId: id });
      }
    } else {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVED or REJECTED' });
    }

    const updated = await prisma.request.findUnique({ where: { id } });
    return res.json(updated);
  } catch (error) {
    console.error('vpDecision error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const resubmitRequest = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      hardwareName,
      hardwareModel,
      estimatedPrice,
      preferredVendor,
      productUrl,
      businessJustification,
      resubmitNotes,
    } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const request = await (prisma.request.findUnique({
      where: { id },
      include: {
        itHardwareRequest: true,
        approvals: {
          where: { status: 'REJECTED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }) as any);

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'MANAGER_REJECTED_IT') {
      return res.status(400).json({ error: 'Request is not in rejected state' });
    }

    // Only the original requester can resubmit
    if (request.requesterId !== currentUser.id) {
      return res.status(403).json({ error: 'Only the original requester can resubmit' });
    }

    const hardwareReq = await prisma.iTHardwareRequest.findFirst({ where: { requestId: id } });
    if (!hardwareReq) return res.status(400).json({ error: 'No hardware request record found' });

    // Update ITHardwareRequest with new values
    const updateData: any = {};
    if (hardwareName !== undefined) updateData.hardwareName = hardwareName;
    if (hardwareModel !== undefined) updateData.hardwareModel = hardwareModel;
    if (estimatedPrice !== undefined) {
      updateData.estimatedPrice = estimatedPrice
        ? new Prisma.Decimal(String(estimatedPrice))
        : null;
    }
    if (preferredVendor !== undefined) updateData.preferredVendor = preferredVendor || null;
    if (productUrl !== undefined) updateData.productUrl = productUrl || null;
    if (businessJustification !== undefined) updateData.businessJustification = businessJustification;

    await prisma.iTHardwareRequest.update({ where: { id: hardwareReq.id }, data: updateData });

    // Update customFields to stay in sync and reset status
    const currentFields = (request.customFields as any) || {};
    const updatedFields = {
      ...currentFields,
      ...updateData,
      estimatedPrice: estimatedPrice || currentFields.estimatedPrice,
    };
    await prisma.request.update({
      where: { id },
      data: { status: 'PENDING_MANAGER_APPROVAL_IT', customFields: updatedFields },
    });

    // Reset the approval or create a new pending one
    if (request.approvals.length > 0) {
      await prisma.requestApproval.update({
        where: { id: request.approvals[0].id },
        data: { status: 'PENDING', comments: null },
      });
    } else {
      // No existing approval record — create a fresh PENDING one
      await prisma.requestApproval.create({
        data: {
          requestId: id,
          approverId: null,
          approverType: 'MANAGER',
          status: 'PENDING',
        },
      });
    }

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Request resubmitted for manager approval${resubmitNotes ? ': ' + resubmitNotes : ''}`,
        authorName: currentUser.firstName || 'User',
        isSystemGenerated: false,
        metadata: { resubmitNotes },
      },
    });

    const updated = await prisma.request.findUnique({ where: { id } });
    return res.json(updated);
  } catch (error) {
    console.error('resubmitRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSuggestedManager = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request = await prisma.request.findUnique({
      where: { id: id as string },
      include: { requester: true }
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (!request.requester?.managerId) {
      return res.json({ suggestedManager: null });
    }

    const manager = await prisma.user.findUnique({
      where: { id: request.requester.managerId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    return res.json({ suggestedManager: manager });
  } catch (error) {
    console.error('getSuggestedManager error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const acknowledgeRequest = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { ceoId, notes } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!ceoId || !uuidRegex.test(ceoId)) {
      return res.status(400).json({ error: 'Invalid ceoId: must be a valid UUID' });
    }

    const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!request.serviceDesk || request.serviceDesk.code !== 'IT') return res.status(400).json({ error: 'Request does not belong to IT service desk' });
    if (request.status !== 'SUBMITTED') return res.status(400).json({ error: 'Request must be in SUBMITTED status' });

    const ceoUser = await prisma.user.findUnique({
      where: { id: ceoId },
      include: { roles: { include: { role: true } } },
    });
    if (!ceoUser) return res.status(404).json({ error: 'CEO user not found' });
    const hasCeoRole = (ceoUser as any).roles.some((r: any) => r.role?.name === 'CEO');
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
        isSystemGenerated: true,
      },
    });

    await notify({ userId: ceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CEO' }, relatedRequestId: id });

    return res.json({ success: true, message: 'Request acknowledged and routed to CEO' });
  } catch (error) {
    console.error('acknowledgeRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const ceoDecision = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { decision, comments } = req.body;
    const currentUser = (req as any).user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING_CEO_APPROVAL_IT') return res.status(400).json({ error: 'Request is not pending CEO approval' });
    const hasCeoRole = (currentUser as any)?.roles?.includes('CEO');
    if (!hasCeoRole) return res.status(403).json({ error: 'Only the CEO can make this decision' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'CEO_APPROVED_IT' } });
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
      await prisma.request.update({ where: { id }, data: { status: 'CEO_REJECTED_IT' } });
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
    const hasCtoRole = (currentUser as any)?.roles?.includes('CTO');
    if (!hasCtoRole) return res.status(403).json({ error: 'Only the CTO can make this decision' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'CTO_APPROVED_IT' } });
      await prisma.request.update({ where: { id }, data: { status: 'PENDING_INVOICE_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CTO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null, approverId: currentUser.id },
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
      await prisma.request.update({ where: { id }, data: { status: 'CTO_REJECTED_IT' } });
      await prisma.request.update({ where: { id }, data: { status: 'REJECTED', resolvedAt: new Date() } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CTO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null, approverId: currentUser.id },
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

export const routeToCfoApproval = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
        isSystemGenerated: true,
      },
    });

    await notify({ userId: cfoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });

    return res.json({ success: true, message: 'Request routed to CFO for approval' });
  } catch (error) {
    console.error('routeToCfoApproval error:', error);
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
    const hasCfoRole = (currentUser as any)?.roles?.includes('CFO');
    if (!hasCfoRole) return res.status(403).json({ error: 'Only the CFO can make this decision' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'CFO_APPROVED_IT' } });
      await prisma.request.update({ where: { id }, data: { status: 'PAYMENT_PROCESSING_IT' } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
        data: { status: 'APPROVED', comments: comments || null, approverId: currentUser.id },
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
      await prisma.request.update({ where: { id }, data: { status: 'CFO_REJECTED_IT' } });
      await prisma.request.update({ where: { id }, data: { status: 'REJECTED', resolvedAt: new Date() } });

      await prisma.requestApproval.updateMany({
        where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
        data: { status: 'REJECTED', comments: comments || null, approverId: currentUser.id },
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

export const markPaymentDone = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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

    await prisma.request.update({ where: { id }, data: { status: 'PAYMENT_DONE_IT' } });
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
        isSystemGenerated: true,
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

export const completeDelivery = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
        isSystemGenerated: true,
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
