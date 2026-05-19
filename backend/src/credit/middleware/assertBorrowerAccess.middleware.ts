import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import prisma from '../../utils/prisma';

/**
 * Roles that can access any borrower profile regardless of RM assignment.
 * CREDIT_RM users can only access borrowers they are assigned to via a CreditApplication.
 */
const ADMIN_ROLES = ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER', 'CREDIT_SENIOR', 'CREDIT_COMMITTEE'];

/**
 * Middleware that verifies the requesting user has access to the borrower profile
 * identified by `:borrowerProfileId` in the route params.
 *
 * Access rules:
 *   - Admin / senior credit roles: always allowed.
 *   - CREDIT_RM: allowed only if they are the assignedRm on at least one
 *     CreditApplication linked to the borrower profile.
 *   - All others: denied.
 *
 * BorrowerProfile has no direct ownership field — ownership is established via
 * CreditApplication.assignedRmId.
 */
export function assertBorrowerAccess() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRoles: string[] = req.user?.roles ?? [];
      const borrowerProfileId = req.params.borrowerProfileId;

      // If either userId or borrowerProfileId is missing, let downstream handle it
      if (!userId || !borrowerProfileId) return next();

      // Admin / senior roles bypass ownership check
      if (userRoles.some(r => ADMIN_ROLES.includes(r))) return next();

      // Verify the borrower exists
      const borrower = await prisma.borrowerProfile.findUnique({
        where: { id: borrowerProfileId },
        select: {
          id: true,
          applications: {
            where: { assignedRmId: userId },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!borrower) {
        throw new AppError('Borrower profile not found', 404);
      }

      // The user is the assigned RM on at least one application for this borrower
      const isAssignedRm = borrower.applications.length > 0;

      if (!isAssignedRm) {
        throw new AppError(
          'Access denied: you do not have permission to access this borrower profile',
          403,
        );
      }

      return next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      return next(new AppError('Authorization check failed', 500));
    }
  };
}
