import { AuthRequest } from '../middleware/auth.middleware';

import prisma from '../utils/prisma';
import { PlatformAuditChainService } from '../services/platformAuditChain.service';

export async function auditLog(
  req: AuthRequest,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  newValues: Record<string, unknown>,
  oldValues?: Record<string, unknown>,
): Promise<void> {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw new Error('AUDIT_TENANT_REQUIRED: scoped audit writes require req.user.tenantId');
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: req.user?.id ?? null,
        userEmail: req.user?.email ?? null,
        action,
        resourceType,
        resourceId: resourceId ?? null,
        oldValues: (oldValues ?? undefined) as any,
        newValues: newValues as any,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      },
    });

    await PlatformAuditChainService.appendEvent({
      tenantId,
      departmentId: req.user?.departmentIds?.[0] ?? null,
      actorId: req.user?.id ?? null,
      actorEmail: req.user?.email ?? null,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      oldValues: oldValues ?? null,
      newValues,
      metadata: {
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      },
    }, tx);
  });
}
