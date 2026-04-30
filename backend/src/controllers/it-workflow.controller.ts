import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notify } from '../services/notification.service';
import { hasRole } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import { pauseSla, resumeSla } from '../services/sla-pause.service';
import path from 'path';
import { uploadSingleFile } from '../middleware/upload.middleware';

const prisma = new PrismaClient();

// Shared S3-backed multer — invoice upload
export const uploadInvoice = { single: (field: string) => uploadSingleFile(field) };

export async function markProcurement(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
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
      await notify({ userId: request.requesterId, eventType: 'PROCUREMENT_INITIATED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
    }

    await auditLog(req as any, 'IT_PROCUREMENT', 'request', String(id), {
      status: 'PROCUREMENT_IN_PROGRESS',
      previousStatus: request.status,
      orderNumber: orderNumber || null,
      vendor: vendor || null,
    }, { status: request.status });
    return res.json({ success: true, message: 'Request marked as procurement in progress' });
  } catch (error) {
    console.error('markProcurement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markFulfilled(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
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
      await notify({ userId: request.requesterId, eventType: 'REQUEST_RESOLVED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
    }

    await auditLog(req as any, 'IT_FULFILLED', 'request', String(id), {
      status: 'RESOLVED',
      previousStatus: 'SOFTWARE_PROVISIONED',
    }, { status: 'SOFTWARE_PROVISIONED' });
    return res.json({ success: true, message: 'Request closed and resolved' });
  } catch (error) {
    console.error('markFulfilled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markHardwareOrdered(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
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
      await notify({ userId: request.requesterId, eventType: 'HARDWARE_ORDERED', variables: { requestId: String(id), orderNumber: orderNumber || '' }, relatedRequestId: String(id) });
    }

    await auditLog(req as any, 'IT_HARDWARE_ORDERED', 'request', String(id), {
      status: 'HARDWARE_ORDERED',
      previousStatus: 'PROCUREMENT_IN_PROGRESS',
      orderNumber: orderNumber || null,
      vendor: vendor || null,
    }, { status: 'PROCUREMENT_IN_PROGRESS' });
    return res.json({ success: true, message: 'Hardware marked as ordered' });
  } catch (error) {
    console.error('markHardwareOrdered error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markHardwareReceived(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { receivedDate, notes, assetTag, serialNumber, registerAsAsset = true } = req.body;

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
              name: hardwareReq.hardwareName,
              category: 'LAPTOP',
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

    await prisma.request.update({
      where: { id },
      data: { status: 'HARDWARE_RECEIVED' },
    });

    await prisma.iTHardwareRequest.update({
      where: { id: hardwareReq.id },
      data: {
        procurementStatus: 'RECEIVED',
        assetTag: assetTag || null,
        serialNumber: serialNumber || null,
        ...(assetId ? { assetId } : {}),
      },
    });

    const noteMsg = [notes, assetTag ? `Asset tag: ${assetTag}` : null, serialNumber ? `Serial: ${serialNumber}` : null, assetId ? 'Registered in asset registry' : null].filter(Boolean).join('. ');

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Hardware received${noteMsg ? ': ' + noteMsg : ''}`,
        authorName: 'System',
        isSystemGenerated: true,
        metadata: { receivedDate, notes, assetTag, serialNumber, assetId },
      },
    });

    if (request.requesterId) {
      await notify({ userId: request.requesterId, eventType: 'HARDWARE_RECEIVED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
    }
    if (request.assignedToId && request.assignedToId !== request.requesterId) {
      await notify({ userId: request.assignedToId, eventType: 'ACTION_REQUIRED', variables: { requestId: String(id), action: 'hardware_provision' }, relatedRequestId: String(id) });
    }

    await auditLog(req as any, 'IT_HARDWARE_RECEIVED', 'request', String(id), {
      status: 'HARDWARE_RECEIVED',
      previousStatus: 'HARDWARE_ORDERED',
      assetTag: assetTag || null, serialNumber: serialNumber || null, assetId,
    }, { status: 'HARDWARE_ORDERED' });

    return res.json({ success: true, message: 'Hardware marked as received', assetId });
  } catch (error) {
    console.error('markHardwareReceived error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markSoftwareProvisioned(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
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
      await notify({ userId: request.requesterId, eventType: 'HARDWARE_DELIVERED', variables: { requestId: String(id) }, relatedRequestId: String(id) });
    }

    await auditLog(req as any, 'IT_SOFTWARE_PROVISIONED', 'request', String(id), {
      status: 'SOFTWARE_PROVISIONED',
      previousStatus: 'HARDWARE_RECEIVED',
      softwareInstalled: softwareInstalled || null,
    }, { status: 'HARDWARE_RECEIVED' });
    return res.json({ success: true, message: 'Software provisioned' });
  } catch (error) {
    console.error('markSoftwareProvisioned error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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
    await pauseSla(id);

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

    await auditLog(req as any, 'IT_ACKNOWLEDGE_ROUTE_CEO', 'request', String(id), {
      status: 'PENDING_CEO_APPROVAL_IT',
      previousStatus: request.status,
      ceoId,
      notes: notes || null,
    }, { status: request.status });
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
    if (!hasRole(req, 'CEO')) return res.status(403).json({ error: 'Only the CEO can make this decision' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'CEO_APPROVED_IT' } });
      await resumeSla(id);
      await prisma.request.update({ where: { id }, data: { status: 'PENDING_CTO_APPROVAL_IT' } });
      await pauseSla(id);

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
      await resumeSla(id);
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

    await auditLog(req as any, 'IT_CEO_DECISION', 'request', String(id), {
      decision,
      approverType: 'CEO',
      previousStatus: 'PENDING_CEO_APPROVAL_IT',
      comments: comments || null,
    }, { status: 'PENDING_CEO_APPROVAL_IT' });
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
    if (!hasRole(req, 'CTO')) return res.status(403).json({ error: 'Only the CTO can make this decision' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'CTO_APPROVED_IT' } });
      await resumeSla(id);
      await prisma.request.update({ where: { id }, data: { status: 'PENDING_INVOICE_IT' } });
      await pauseSla(id);

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
      await resumeSla(id);
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

    await auditLog(req as any, 'IT_CTO_DECISION', 'request', String(id), {
      decision,
      approverType: 'CTO',
      previousStatus: 'PENDING_CTO_APPROVAL_IT',
      comments: comments || null,
    }, { status: 'PENDING_CTO_APPROVAL_IT' });
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
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    if (!file) {
      return res.status(400).json({ error: 'Invoice file is required' });
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

    await prisma.request.update({ where: { id }, data: { status: 'PENDING_CFO_APPROVAL_IT' } });
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

    await prisma.requestAttachment.create({
      data: {
        requestId: id,
        uploadedById: currentUser.id,
        fileName: file.originalname,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        fileType: path.extname(file.originalname).replace('.', ''),
        storagePath: (file as any).key,
        storageUrl: (file as any).key,
      },
    });

    await prisma.requestActivity.create({
      data: {
        requestId: id,
        activityType: 'SYSTEM',
        message: `Invoice uploaded and routed to CFO for approval${notes ? ': ' + notes : ''}`,
        authorName: currentUser.firstName || 'Agent',
        authorRole: 'AGENT',
        isSystemGenerated: true,
      },
    });

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
    return res.json({ success: true, message: 'Invoice uploaded and request routed to CFO for approval' });
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
    if (!hasRole(req, 'CFO')) return res.status(403).json({ error: 'Only the CFO can make this decision' });

    if (decision === 'APPROVED') {
      await prisma.request.update({ where: { id }, data: { status: 'CFO_APPROVED_IT' } });
      await resumeSla(id);
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
      await resumeSla(id);
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

    await auditLog(req as any, 'IT_CFO_DECISION', 'request', String(id), {
      decision,
      approverType: 'CFO',
      previousStatus: 'PENDING_CFO_APPROVAL_IT',
      comments: comments || null,
    }, { status: 'PENDING_CFO_APPROVAL_IT' });
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

    const request = await prisma.request.findUnique({
      where: { id },
      include: { requestType: { include: { workflow: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PAYMENT_PROCESSING_IT') return res.status(400).json({ error: 'Request must be in PAYMENT_PROCESSING_IT status' });

    const workflowCode = request.requestType?.workflow?.code || '';
    const isHardwareProcurement = workflowCode === 'IT_HARDWARE_PROCUREMENT';

    const existingCustomFields = (request.customFields as Record<string, unknown>) || {};

    // Hardware procurement: after payment, go to procurement phase (order → receive → provision → resolve)
    // Software procurement: after payment, go straight to delivery → resolve
    const nextStatus = isHardwareProcurement ? 'PROCUREMENT_IN_PROGRESS' : 'PENDING_DELIVERY_IT';
    const nextAction = isHardwareProcurement ? 'procurement' : 'delivery';

    await prisma.request.update({ where: { id }, data: { status: 'PAYMENT_DONE_IT' } });
    await prisma.request.update({
      where: { id },
      data: {
        status: nextStatus,
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
        message: `Payment completed. Reference: ${paymentReference}, Amount: ${amount}${notes ? '. ' + notes : ''}${isHardwareProcurement ? '. Proceeding to procurement phase.' : ''}`,
        authorName: currentUser.firstName || 'Finance Agent',
        authorRole: 'AGENT',
        isSystemGenerated: true,
        metadata: { paymentReference, amount, paymentDate, notes },
      },
    });

    const agentUsers = await prisma.user.findMany({ where: { roles: { some: { role: { name: { in: ['ADMIN', 'AGENT'] } } } } }, take: 5 });
    for (const agent of agentUsers) {
      await notify({ userId: agent.id, eventType: 'ACTION_REQUIRED', variables: { requestId: id, action: `pending_${nextAction}` }, relatedRequestId: id });
    }

    await auditLog(req as any, 'IT_PAYMENT_DONE', 'request', String(id), {
      status: nextStatus,
      previousStatus: 'PAYMENT_PROCESSING_IT',
      paymentReference: paymentReference || null,
      amount: Number(amount),
      paymentDate,
    }, { status: 'PAYMENT_PROCESSING_IT' });
    return res.json({ success: true, message: `Payment marked as done, request routed to ${isHardwareProcurement ? 'procurement phase' : 'pending delivery'}` });
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

    await auditLog(req as any, 'IT_DELIVERY_COMPLETE', 'request', String(id), {
      status: 'RESOLVED',
      previousStatus: 'PENDING_DELIVERY_IT',
    }, { status: 'PENDING_DELIVERY_IT' });
    return res.json({ success: true, message: 'Delivery completed and request resolved' });
  } catch (error) {
    console.error('completeDelivery error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
