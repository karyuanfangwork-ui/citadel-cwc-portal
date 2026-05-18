import { Response, NextFunction } from 'express';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

/**
 * SOD (Segregation of Duties) constraint for credit module.
 * 
 * Rule: A user with CREDIT_RM role CANNOT approve or take approval-level
 * actions on the same application they originated/are assigned as RM.
 * 
 * This prevents the same person from both originating and approving a credit application,
 * which is a fundamental principle of sound credit risk governance.
 */

// Roles that are considered "originator" roles
const ORIGINATOR_ROLES = ['CREDIT_RM'];

// Roles that are considered "approver" roles  
const APPROVER_ROLES = ['CREDIT_MANAGER', 'CREDIT_SENIOR'];

/**
 * Middleware that enforces SOD on credit approval actions.
 * Checks if the current user is the assigned RM on the application
 * and blocks them from taking approval-level actions.
 * 
 * Usage: router.post('/:id/approvals', enforceCreditSOD(), approvalController)
 */
export function enforceCreditSOD() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.roles || [];
      const applicationId = req.params.id as string;

      if (!userId || !applicationId) {
        return next();
      }

      // Check if user has both originator and approver roles
      const hasOriginatorRole = userRoles.some(r => ORIGINATOR_ROLES.includes(r));
      const hasApproverRole = userRoles.some(r => APPROVER_ROLES.includes(r));

      // If user doesn't have conflicting roles at all, allow through
      if (!hasOriginatorRole || !hasApproverRole) {
        return next();
      }

      // User has conflicting roles — check if they're the RM on THIS application
      let application;
      try {
        application = await prisma.creditApplication.findUnique({
          where: { id: applicationId },
          select: { assignedRmId: true },
        });
      } catch (dbErr) {
        // If DB query fails, skip SOD check rather than blocking
        console.warn('SOD middleware: query failed, skipping SOD check.', dbErr);
        return next();
      }

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      // If this user is the assigned RM on this application, block approval actions
      if (application.assignedRmId === userId) {
        throw new AppError(
          'Segregation of Duties violation: You cannot approve an application where you are the assigned Relationship Manager. Please escalate to another approver.',
          403
        );
      }

      next();
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
      } else {
        next(new AppError('SOD check failed', 500));
      }
    }
  };
}

/**
 * Check if a user holds conflicting SOD roles for a given application.
 * Returns true if there's a potential SOD conflict (for UI warning display).
 */
export async function checkSodConflict(userId: string, applicationId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) return false;

  const roleNames = user.roles.map(ur => ur.role.name);
  const hasOriginatorRole = roleNames.some(r => ORIGINATOR_ROLES.includes(r));
  const hasApproverRole = roleNames.some(r => APPROVER_ROLES.includes(r));

  if (!hasOriginatorRole || !hasApproverRole) return false;

  // Check if user is the RM on this specific application
  let application;
  try {
    application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { assignedRmId: true },
    });
  } catch (dbErr) {
    console.warn('SOD check: query failed, skipping SOD conflict check.', dbErr);
    return false;
  }

  return application?.assignedRmId === userId;
}