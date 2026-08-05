import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { Prisma } from '@prisma/client';

/**
 * §2.4 — Row-level access: RM scoping middleware
 *
 * For users without credit:admin (or equivalent senior role), this middleware
 * injects a `req.rmScopeFilter` Prisma where clause that limits list queries
 * to applications where the user is the assigned RM or assigned analyst.
 *
 * Admin/senior roles bypass the scope filter entirely.
 *
 * Usage:
 *   router.get('/', applyRmScope(), creditApplicationController.list)
 *
 * Then in the controller/service, use:
 *   const rmScope = (req as any).rmScopeFilter as Prisma.CreditApplicationWhereInput | undefined;
 *   // Merge into your where clause: where = { ...where, ...rmScope }
 */

// Roles that bypass RM scoping — they can see all applications
const RM_SCOPE_BYPASS_ROLES = ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER'];

export interface RmScopedRequest extends AuthRequest {
  rmScopeFilter?: Prisma.CreditApplicationWhereInput;
}

/**
 * Middleware that computes an RM scope filter for the authenticated user
 * and attaches it to `req.rmScopeFilter`.
 *
 * - If the user has an admin/senior role, `rmScopeFilter` is undefined (no filtering).
 * - If the user has CREDIT_RM role, filter to their assigned applications.
 * - If the user has no credit roles, default to filtering to their own applications (most restrictive).
 */
export function applyRmScope() {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRoles: string[] = Array.isArray(req.user?.roles) ? (req.user!.roles as string[]) : [];
      const permissions: string[] = Array.isArray(req.user?.permissions) ? (req.user!.permissions as string[]) : [];

      if (!userId) {
        return next(new AppError('Authentication required', 401));
      }

      // Admin/senior roles bypass scoping — they see everything
      if (userRoles.some(r => RM_SCOPE_BYPASS_ROLES.includes(r))) {
        (req as any).rmScopeFilter = undefined;
        return next();
      }

      // credit:admin permission also bypasses scoping
      if (permissions.includes('credit:admin')) {
        (req as any).rmScopeFilter = undefined;
        return next();
      }

      // For RM and other roles: scope to applications where they are assigned.
      // When viewing a specific borrower profile (borrowerProfileId filter),
      // also allow seeing that borrower's applications — this ensures the
      // Borrower Profile → Applications tab shows data consistently with
      // the borrower list (which has no RM scoping).
      const borrowerProfileId = req.query.borrowerProfileId as string | undefined;
      const baseScope: Prisma.CreditApplicationWhereInput = {
        OR: [
          { assignedRmId: userId },
          { assignedAnalystId: userId },
        ],
      };
      if (borrowerProfileId) {
        (req as any).rmScopeFilter = {
          OR: [
            ...baseScope.OR!,
            { borrowerProfileId },
          ],
        };
      } else {
        (req as any).rmScopeFilter = baseScope;
      }

      return next();
    } catch (err) {
      return next(new AppError('RM scope check failed', 500));
    }
  };
}