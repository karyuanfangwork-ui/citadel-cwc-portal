import { Request, RequestStatus } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  transitionRequest,
  TransitionOptions,
} from '../services/requestTransition.service';
import prisma from './prisma';

type CurrentRequest = Pick<Request, 'id' | 'status' | 'tenantId'>;

interface HttpTransitionInput {
  req: ExpressRequest;
  request: CurrentRequest;
  toStatus: RequestStatus | string;
  source: string;
  comment?: string;
  requestPatch?: Record<string, unknown>;
  skipValidation?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Controller adapter for the versioned workflow-command boundary.
 *
 * Keeps actor, tenant, audit, idempotency, and supplemental request mutation
 * metadata consistent at every HTTP caller. The returned request is read only
 * after the command commits; no status write occurs outside the boundary.
 */
export async function transitionHttpRequest({
  req,
  request,
  toStatus,
  source,
  comment,
  requestPatch,
  skipValidation = false,
  metadata,
}: HttpTransitionInput): Promise<Request> {
  if (!request.tenantId) {
    throw new AppError('Request has no tenant scope', 409);
  }

  const user = (req as any).user;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const options: TransitionOptions = {
    userId: user?.id,
    userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'System',
    userRole: roles[0] || 'SYSTEM',
    userEmail: user?.email,
    tenantId: request.tenantId,
    source,
    comment,
    requestPatch,
    skipValidation,
    metadata,
    idempotencyKey: req.get('Idempotency-Key') || undefined,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || undefined,
  };

  await transitionRequest(request.id, String(toStatus), options);
  return prisma.request.findFirstOrThrow({
    where: { id: request.id, tenantId: request.tenantId },
  });
}
