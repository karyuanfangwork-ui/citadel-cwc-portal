import { Response, NextFunction } from 'express';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';

/**
 * SOD (Segregation of Duties) constraints for credit module.
 *
 * Rules enforced:
 * 1. The assigned RM on an application cannot approve or take approval-level
 *    actions on that same application (assignedRmId === actorId → blocked).
 * 2. Maker-checker: a user who performed the last state transition (maker)
 *    cannot also approve the same transition (checker). Enforced by checking
 *    if the actorId matches the last audit event's actorId for approval-type events.
 * 3. Admin role (ADMIN) always bypasses SOD checks.
 *
 * This prevents the same person from both originating and approving a credit application,
 * which is a fundamental principle of sound credit risk governance.
 */

// Roles that are considered "originator" roles
const ORIGINATOR_ROLES = ['CREDIT_RM'];

// Roles that are considered "approver" roles
const APPROVER_ROLES = ['CREDIT_MANAGER', 'CREDIT_SENIOR', 'CREDIT_COMMITTEE'];

// Roles that bypass all SOD checks
const ADMIN_BYPASS_ROLES = ['ADMIN', 'CREDIT_ADMIN'];

/**
 * Middleware that enforces SOD on credit approval actions.
 * Checks two constraints:
 *   a) RM cannot approve their own application (assignedRmId === actorId)
 *   b) Maker-checker: the user who initiated a state transition cannot also
 *      approve it (prevents single-person end-to-end control)
 *
 * Admin users bypass all SOD checks.
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

      // Admin bypass — admins can override SOD
      const isAdmin = userRoles.some(r => ADMIN_BYPASS_ROLES.includes(r));
      if (isAdmin) {
        return next();
      }

      // Fetch the application with audit trail for maker-checker
      let application;
      try {
        application = await prisma.creditApplication.findUnique({
          where: { id: applicationId },
          select: {
            assignedRmId: true,
            assignedAnalystId: true,
          },
        });
      } catch (dbErr) {
        logger.error('SOD middleware: application query failed — blocking action', { applicationId, userId, err: dbErr });
        return next(new AppError('SoD check unavailable — please try again', 503));
      }

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      // ── Rule 1: Assigned RM cannot approve their own application ──────────
      if (application.assignedRmId === userId) {
        throw new AppError(
          'Segregation of Duties violation: You cannot approve an application where you are the assigned Relationship Manager. Please escalate to another approver.',
          403,
        );
      }

      // ── Rule 2: Maker-checker on state transitions ───────────────────────
      // The person who triggered the current state (maker) should not also be
      // the one approving it (checker). We look at the most recent state
      // transition audit event for this application.
      try {
        const lastTransition = await prisma.creditAuditEvent.findFirst({
          where: {
            applicationId,
            eventType: { in: ['STATE_TRANSITION', 'SUBMISSION'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { actorId: true },
        });

        if (lastTransition && lastTransition.actorId === userId) {
          throw new AppError(
            'Segregation of Duties violation: You cannot approve a state transition that you originated (maker-checker constraint). Another approver must verify this action.',
            403,
          );
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        logger.error('SOD middleware: audit event query failed — blocking maker-checker check', { applicationId, userId, err });
        return next(new AppError('SoD check unavailable — please try again', 503));
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
 *
 * Admin users are never considered to have SOD conflicts.
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

  // Admin bypass
  const isAdmin = roleNames.some(r => ADMIN_BYPASS_ROLES.includes(r));
  if (isAdmin) return false;

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
    logger.error('SOD checkSodConflict: application query failed — blocking conflict check', { applicationId, userId, err: dbErr });
    throw new AppError('SoD check unavailable — please try again', 503);
  }

  return application?.assignedRmId === userId;
}