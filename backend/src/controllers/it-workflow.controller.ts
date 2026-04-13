import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notify } from '../services/notification.service';

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

    await prisma.request.update({
      where: { id },
      data: { status: newStatus },
    });

    await prisma.requestApproval.updateMany({
      where: { requestId: id, approverType: 'MANAGER', status: 'PENDING' },
      data: {
        status: decision as 'APPROVED' | 'REJECTED',
        comments: comments || null,
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
        message: `Manager ${decision.toLowerCase()} the request${comments ? ': ' + comments : ''}`,
        authorName: (req as any).user?.firstName || 'Manager',
        authorRole: 'MANAGER',
        isSystemGenerated: false,
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your IT request ${id} has been ${decision.toLowerCase()} by the manager.`);
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
        message: notes ? `Request fulfilled: ${notes}` : 'Request has been fulfilled and resolved',
        authorName: 'System',
        isSystemGenerated: true,
      },
    });

    if (request.requesterId) {
      await notify(request.requesterId, `Your IT request ${id} has been fulfilled and resolved.`);
    }

    return res.json({ success: true, message: 'Request marked as fulfilled and resolved' });
  } catch (error) {
    console.error('markFulfilled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
