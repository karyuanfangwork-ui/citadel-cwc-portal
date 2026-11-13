import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { resolveRequestId } from '../utils/resolve';

export const hrExecutiveChoiceSchema = z.object({
  body: z.object({
    executiveApproverId: z.string().uuid(),
    executiveApproverRole: z.enum(['CEO', 'GROUP_DCEO']),
    version: z.number().int().positive(),
  }).strict(),
});

/** Only the requester may set an HR recruitment choice before an executive route. */
export const putHrExecutiveApproverChoice = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const actor = (req as AuthRequest).user;
  if (!actor?.id || !actor.tenantId) throw new AppError('Tenant-scoped authentication is required', 403);
  const parsed = hrExecutiveChoiceSchema.safeParse({ body: req.body });
  if (!parsed.success) throw new AppError('Invalid executive approver choice or version', 400);
  const { executiveApproverId, executiveApproverRole, version } = parsed.data.body;
  const id = await resolveRequestId(String(req.params.id));
  if (!id) throw new AppError('Request not found', 404);

  const updated = await prisma.$transaction(async tx => {
    const request = await tx.request.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      select: {
        id: true, tenantId: true, requesterId: true, status: true, version: true,
        executiveApproverId: true, executiveApproverRole: true,
        requestType: { select: { code: true } },
      },
    });
    if (!request) throw new AppError('Request not found', 404);
    if (request.requesterId !== actor.id) throw new AppError('Only the requester may choose the executive approver', 403);
    if (request.requestType?.code !== 'NEW_HIRING') throw new AppError('Executive choice is only available for new hiring requests', 422);
    if (request.version !== version) throw new AppError('Request changed; refresh and try again', 409);
    if (!['SUBMITTED', 'IN_REVIEW'].includes(request.status)) throw new AppError('The executive approval has already been routed', 409);
    if (executiveApproverId === actor.id) throw new AppError('Requester cannot approve their own request', 422);
    if (request.executiveApproverId || request.executiveApproverRole) {
      throw new AppError('Executive approver choice is already saved', 409);
    }
    if (await tx.requestApproval.count({ where: { requestId: id, approverType: { in: ['CEO', 'GROUP_DCEO'] } } })) {
      throw new AppError('An executive approval already exists', 409);
    }
    const selected = await tx.user.findFirst({
      where: {
        id: executiveApproverId,
        tenantId: actor.tenantId,
        isActive: true,
        roles: { some: { role: { name: executiveApproverRole } } },
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!selected) throw new AppError('Selected executive is inactive, outside your tenant, or lacks that role', 422);

    // The workflow command also CAS-updates version on this row. A concurrent route
    // cannot commit with the old version after this update, or vice versa.
    const result = await tx.request.updateMany({
      where: {
        id, tenantId: actor.tenantId, version, status: request.status,
        executiveApproverId: null, executiveApproverRole: null, deletedAt: null,
      },
      data: { executiveApproverId, executiveApproverRole, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new AppError('Request changed; refresh and try again', 409);
    await tx.requestActivity.create({
      data: {
        requestId: id,
        authorId: actor.id,
        authorName: `${actor.firstName} ${actor.lastName}`.trim(),
        authorRole: 'REQUESTER',
        activityType: 'SYSTEM',
        message: `Requester selected ${selected.firstName} ${selected.lastName} (${executiveApproverRole}) for executive approval`,
        metadata: { executiveApproverId, executiveApproverRole },
      },
    });
    return tx.request.findUnique({
      where: { id },
      select: {
        id: true, referenceNumber: true, status: true, version: true,
        executiveApproverId: true, executiveApproverRole: true,
        executiveApprover: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  });
  res.json({ status: 'success', data: { request: updated } });
});
