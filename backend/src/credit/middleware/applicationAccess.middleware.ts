import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import prisma from '../../utils/prisma';
import { RmScopedRequest } from './rmScope.middleware';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * LOS-004 — Row-level access on direct-ID application routes.
 *
 * `applyRmScope()` computes `req.rmScopeFilter` but only list queries consumed
 * it, so `GET /applications/:id` (and every nested application resource)
 * returned data for any known UUID. This middleware re-asserts the same filter
 * against the single record before the handler runs.
 *
 * Mount it once at the parent path in `credit.routes.ts` so nested routers
 * inherit it:
 *   router.use('/applications/:applicationId', applyRmScope(), requireApplicationAccess());
 *
 * Out-of-scope reads return 404 rather than 403: a 403 would confirm the record
 * exists, which is itself a disclosure.
 */
export function requireApplicationAccess(
  paramNames: string[] = ['applicationId', 'id'],
) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const rmScopeFilter = (req as RmScopedRequest).rmScopeFilter;

    // Admin / bypass roles: applyRmScope() left the filter undefined.
    if (!rmScopeFilter) return next();

    let applicationId: string | undefined;
    for (const name of paramNames) {
      const value = req.params?.[name] as string | undefined;
      if (value && UUID_REGEX.test(value)) {
        applicationId = value;
        break;
      }
    }

    // No application UUID on this path (e.g. /applications/draft) — nothing to guard.
    if (!applicationId) return next();

    try {
      const visible = await prisma.creditApplication.findFirst({
        where: { id: applicationId, deletedAt: null, AND: [rmScopeFilter] },
        select: { id: true },
      });

      if (!visible) {
        return next(new AppError('Credit application not found', 404));
      }

      return next();
    } catch {
      return next(new AppError('Application access check failed', 500));
    }
  };
}