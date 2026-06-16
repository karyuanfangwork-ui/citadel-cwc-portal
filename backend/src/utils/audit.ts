import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from './logger';

import prisma from '../utils/prisma';

export async function auditLog(
  req: AuthRequest,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  newValues: Record<string, unknown>,
  oldValues?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
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
  } catch (err) {
    // Audit failures must never break the main operation
    logger.error('Audit log write failed', { action, resourceType, resourceId, err });
  }
}
