import { Response, NextFunction } from 'express';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';
import { AuditChainService } from '../services/auditChain.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SOD (Segregation of Duties) constraints for credit module.
 *
 * Rules enforced:
 * 1. The assigned RM on an application cannot approve or take approval-level
 *    actions on that same application (assignedRmId === actorId → blocked).
 *    This rule applies to ALL users including ADMIN/CREDIT_ADMIN.
 * 2. Maker-checker: a user who performed the last state transition (maker)
 *    cannot also approve the same transition (checker). Enforced by checking
 *    if the actorId matches the last audit event's actorId for approval-type events.
 *    This rule applies to ALL users including ADMIN/CREDIT_ADMIN.
 * 3. Admin role (ADMIN/CREDIT_ADMIN) bypasses authority-level SOD checks
 *    (e.g., role-based approval authority requirements). When bypassed, an
 *    explicit SOD_BYPASSED audit event is logged via AuditChainService.
 *
 * This prevents the same person from both originating and approving a credit application,
 * which is a fundamental principle of sound credit risk governance.
 */

// Roles that are considered "originator" roles
const ORIGINATOR_ROLES = ['CREDIT_RM'];

// Roles that are considered "approver" roles
const APPROVER_ROLES = ['CREDIT_MANAGER'];

// Roles that bypass authority-level SOD checks (but NOT Rule 1 or Rule 2)
const ADMIN_BYPASS_ROLES = ['ADMIN', 'CREDIT_ADMIN'];

/**
 * Middleware that enforces SOD on credit approval actions.
 * Checks two constraints:
 *   a) RM cannot approve their own application (assignedRmId === actorId)
 *   b) Maker-checker: the user who initiated a state transition cannot also
 *      approve it (prevents single-person end-to-end control)
 *
 * Admin users (ADMIN/CREDIT_ADMIN) bypass authority-level checks but
 * are still subject to Rule 1 (RM-self) and Rule 2 (maker-checker).
 * When an admin bypass occurs, a SOD_BYPASSED audit event is logged.
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

      if (!UUID_RE.test(applicationId)) {
        return next(new AppError('Invalid application id — must be a UUID', 400));
      }

      const isAdmin = userRoles.some(r => ADMIN_BYPASS_ROLES.includes(r));

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
      // This rule applies to ALL users including admins.
      if (application.assignedRmId === userId) {
        throw new AppError(
          'Segregation of Duties violation: You cannot approve an application where you are the assigned Relationship Manager. Please escalate to another approver.',
          403,
        );
      }

      // ── Rule 2: Maker-checker on state transitions ───────────────────────
      // The person who triggered the current state (maker) should not also be
      // the one approving it (checker). We look at the most recent actual
      // state transition (oldState !== newState) for this application.
      // Field-only updates (oldState === newState) are excluded so that
      // editing a field does not block the same user from later approving.
      // This rule applies to ALL users including admins.
      try {
        const lastTransition = await prisma.creditAuditEvent.findFirst({
          where: {
            applicationId,
            eventType: { in: ['STATE_TRANSITION', 'SUBMISSION'] },
            oldState: { not: null },
            newState: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { actorId: true, oldState: true, newState: true },
        });

        if (lastTransition && lastTransition.actorId === userId && lastTransition.oldState !== lastTransition.newState) {
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

      // ── Admin bypass: authority-level short-circuit ────────────────────────
      // If the user has an admin bypass role and passed Rule 1 & 2, they are
      // allowed through. Log an explicit SOD_BYPASSED audit event for
      // traceability.
      if (isAdmin) {
        try {
          await AuditChainService.appendEvent(
            applicationId,
            'SOD_BYPASSED',
            userId,
            `SOD bypassed by ${userRoles.join(', ')}`,
            undefined,
            undefined,
            { rule: 'authority-bypass', roles: userRoles },
          );
        } catch (auditErr) {
          logger.error('SOD middleware: failed to log SOD_BYPASSED audit event', { applicationId, userId, err: auditErr });
          // Non-blocking: audit logging failure should not prevent the action
        }
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
 * Middleware that enforces SOD on committee approval actions.
 * Same rules as enforceCreditSOD(), but resolves the applicationId from
 * the agenda item (req.params.itemId) since committee routes reference
 * agenda items rather than applications directly.
 *
 * Admin users (ADMIN/CREDIT_ADMIN) bypass authority-level checks but
 * are still subject to Rule 1 (RM-self) and Rule 2 (maker-checker).
 * When an admin bypass occurs, a SOD_BYPASSED audit event is logged.
 *
 * Usage: router.post('/agenda/:itemId/vote', enforceCommitteeSOD(), committeeController)
 */
export function enforceCommitteeSOD() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.roles || [];
      const itemId = req.params.itemId as string;

      if (!userId || !itemId) {
        return next();
      }

      const isAdmin = userRoles.some(r => ADMIN_BYPASS_ROLES.includes(r));

      // Resolve applicationId from agenda item
      let agendaItem;
      try {
        agendaItem = await prisma.committeeAgendaItem.findUnique({
          where: { id: itemId },
          select: { applicationId: true },
        });
      } catch (dbErr) {
        logger.error('SOD committee middleware: agenda item query failed — blocking action', { itemId, userId, err: dbErr });
        return next(new AppError('SoD check unavailable — please try again', 503));
      }

      if (!agendaItem) {
        throw new AppError('Agenda item not found', 404);
      }

      const applicationId = agendaItem.applicationId;

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
        logger.error('SOD committee middleware: application query failed — blocking action', { applicationId, userId, err: dbErr });
        return next(new AppError('SoD check unavailable — please try again', 503));
      }

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      // ── Rule 1: Assigned RM cannot approve their own application ──────────
      // This rule applies to ALL users including admins.
      if (application.assignedRmId === userId) {
        throw new AppError(
          'Segregation of Duties violation: You cannot vote on an agenda item for an application where you are the assigned Relationship Manager. Please escalate to another committee member.',
          403,
        );
      }

      // ── Rule 2: Maker-checker on state transitions ───────────────────────
      // Only block if the user originated an actual state change (oldState !== newState).
      // Field-only updates (oldState === newState) do not trigger maker-checker.
      // This rule applies to ALL users including admins.
      try {
        const lastTransition = await prisma.creditAuditEvent.findFirst({
          where: {
            applicationId,
            eventType: { in: ['STATE_TRANSITION', 'SUBMISSION'] },
            oldState: { not: null },
            newState: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { actorId: true, oldState: true, newState: true },
        });

        if (lastTransition && lastTransition.actorId === userId && lastTransition.oldState !== lastTransition.newState) {
          throw new AppError(
            'Segregation of Duties violation: You cannot approve a state transition that you originated (maker-checker constraint). Another committee member must verify this action.',
            403,
          );
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        logger.error('SOD committee middleware: audit event query failed — blocking maker-checker check', { applicationId, userId, err });
        return next(new AppError('SoD check unavailable — please try again', 503));
      }

      // ── Admin bypass: authority-level short-circuit ────────────────────────
      // If the user has an admin bypass role and passed Rule 1 & 2, they are
      // allowed through. Log an explicit SOD_BYPASSED audit event for
      // traceability.
      if (isAdmin) {
        try {
          await AuditChainService.appendEvent(
            applicationId,
            'SOD_BYPASSED',
            userId,
            `SOD bypassed by ${userRoles.join(', ')}`,
            undefined,
            undefined,
            { rule: 'authority-bypass', roles: userRoles },
          );
        } catch (auditErr) {
          logger.error('SOD committee middleware: failed to log SOD_BYPASSED audit event', { applicationId, userId, err: auditErr });
          // Non-blocking: audit logging failure should not prevent the action
        }
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

  // Admin bypass — no conflict reported (authority-level check)
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