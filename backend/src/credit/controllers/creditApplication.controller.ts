import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { creditApplicationService } from '../services/creditApplication.service';
import { requireUser } from '../utils/requireUser';
import { validateSubmissionReadiness } from '../services/submissionReadiness.service';
import { overrideConnectedPartyFlag } from '../services/connectedParty.service';
import { RmScopedRequest } from '../middleware/rmScope.middleware';
import prisma from '../../utils/prisma';

class CreditApplicationController {
  /**
   * GET /applications — List credit applications with pagination & filters
   * §2.4 — Now uses rmScopeFilter from middleware for row-level access control.
   * The applyRmScope() middleware injects req.rmScopeFilter for non-admin users,
   * which is AND-combined with query filters in the service layer.
   * Admin/senior roles have no rmScopeFilter (see all applications).
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const state = req.query.state as string | undefined;
    const productType = req.query.productType as string | undefined;
    const borrowerProfileId = req.query.borrowerProfileId as string | undefined;
    const assignedRmId = req.query.assignedRmId as string | undefined;
    const assignedAnalystId = req.query.assignedAnalystId as string | undefined;
    const search = req.query.search as string | undefined;
    const branchId = req.query.branchId as string | undefined;

    // §2.4 — Row-level access: use rmScopeFilter from middleware
    const rmScopeFilter = (req as RmScopedRequest).rmScopeFilter;

    const result = await creditApplicationService.listApplications({
      page,
      limit,
      state,
      productType,
      borrowerProfileId,
      assignedRmId,
      assignedAnalystId,
      search,
      branchId,
      rmScopeFilter,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /applications/:id — Get a single credit application
   * §2.4 — Audit-logs PII access for non-admin users.
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const application = await creditApplicationService.getApplication(id);

    if (!application) {
      throw new AppError('Credit application not found', 404);
    }

    // §2.4 — Audit log: non-admin direct-ID PII access
    // If the user had an rmScopeFilter (i.e. they are NOT a bypass role),
    // log this single-record access for compliance.
    const rmScopeFilter = (req as RmScopedRequest).rmScopeFilter;
    if (rmScopeFilter && req.user?.id) {
      // Fire-and-forget audit log (don't block the response)
      // Serialize rmScopeFilter to plain JSON for Prisma's Json type
      const scopeMeta = JSON.parse(JSON.stringify(rmScopeFilter));
      prisma.creditAuditEvent.create({
        data: {
          applicationId: id,
          eventType: 'PII_ACCESS',
          actorId: req.user.id,
          action: 'READ',
          newState: application.state,
          metadata: {
            accessType: 'direct_id',
            endpoint: `/api/v1/credit/applications/${id}`,
            rmScopeFilter: scopeMeta,
          },
        },
      }).catch(() => {
        // Silently swallow audit log failures — don't block the read
      });
    }

    res.json({ status: 'success', data: { application } });
  });

  /**
   * POST /applications — Create a new credit application
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actorId = requireUser(req).id;
    const application = await creditApplicationService.createApplication(req.body, actorId);
    res.status(201).json({ status: 'success', data: { application } });
  });

  /**
   * PATCH /applications/:id — Update a credit application (DRAFT only)
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const actorId = requireUser(req).id;
    const expectedVersion = req.body.version !== undefined ? Number(req.body.version) : undefined;

    try {
      const application = await creditApplicationService.updateApplication(id, req.body, actorId, expectedVersion);

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      res.json({ status: 'success', data: { application } });
    } catch (err: any) {
      if (err.message.includes('DRAFT state') || err.message.includes('terminal application') || err.message.includes('Cannot reassign')) {
        throw new AppError(err.message, 400);
      }
      // §2.3 — Propagate version conflict errors (AppError with statusCode 409)
      if (err.statusCode === 409) {
        throw err;
      }
      throw err;
    }
  });

  /**
   * DELETE /applications/:id — Soft-delete a credit application (DRAFT only)
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const actorId = requireUser(req).id;

    try {
      const application = await creditApplicationService.deleteApplication(id, actorId);

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      res.json({ status: 'success', message: 'Credit application deleted successfully' });
    } catch (err: any) {
      if (err.message.includes('DRAFT state')) {
        throw new AppError(err.message, 400);
      }
      throw err;
    }
  });

  // ---------------------------------------------------------------------------
  // State Machine — Transition
  // ---------------------------------------------------------------------------

  /**
   * POST /applications/:id/transition — Transition application state
   */
  transition = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { action, reason } = req.body;
    const actorId = requireUser(req).id;

    try {
      const application = await creditApplicationService.transitionApplication(
        id,
        action,
        actorId,
        reason,
      );

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      res.json({ status: 'success', data: { application } });
    } catch (err: any) {
      if (err.statusCode === 403) {
        throw new AppError(err.message, 403);
      }
      if (err.message.includes('Invalid transition') || err.message.includes('Reason is required')) {
        throw new AppError(err.message, 400);
      }
      if (err.message.includes('Submission blocked')) {
        throw new AppError(err.message, 400);
      }
      if (err.message.includes('Approval chain incomplete')) {
        throw new AppError(err.message, 403);
      }
      throw err;
    }
  });

  /**
   * GET /applications/:id/transitions — Get valid transitions for current state
   */
  getTransitions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await creditApplicationService.getValidTransitionsForApplication(id);

    if (!result) {
      throw new AppError('Credit application not found', 404);
    }

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /applications/:id/audit — Get audit trail for application
   */
  getAuditTrail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    // Verify application exists
    const application = await creditApplicationService.getApplication(id);
    if (!application) {
      throw new AppError('Credit application not found', 404);
    }

    const result = await creditApplicationService.getAuditTrail(id, page, limit);
    res.json({ status: 'success', data: result });
  });

  /**
   * PATCH /applications/:id/connected-party-flag
   * Override the connected-party flag with audit trail
   */
  overrideConnectedPartyFlag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const user = requireUser(req);
    const { connectedPartyFlag, reason } = req.body;

    if (typeof connectedPartyFlag !== 'boolean') {
      throw new AppError('connectedPartyFlag must be a boolean', 400);
    }

    // Verify application exists
    const application = await creditApplicationService.getApplication(id);
    if (!application) {
      throw new AppError('Credit application not found', 404);
    }

    const result = await overrideConnectedPartyFlag(id, connectedPartyFlag, user.id, reason);
    res.json({ status: 'success', data: { connectedPartyFlag: result } });
  });

  /**
   * GET /applications/:id/readiness — Check submission readiness
   * Requires: credit:read
   */
  checkReadiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await validateSubmissionReadiness(id);
    res.json({ status: 'success', data: result });
  });

  /**
   * POST /applications/:id/clone — Clone an application into a new DRAFT
   * Works for APPROVED, ACTIVE, CLOSED, REJECTED states
   * Requires: credit:create
   */
  clone = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const actorId = requireUser(req).id;
    const { asRenewal } = req.body as { asRenewal?: boolean };

    try {
      const newAppId = await creditApplicationService.cloneApplication(id, actorId, {
        asRenewal: asRenewal ?? false,
      });
      res.status(201).json({ status: 'success', data: { applicationId: newAppId } });
    } catch (err: any) {
      if (err.statusCode === 400 || err.statusCode === 404) {
        throw err;
      }
      if (err.message.includes('Cannot clone')) {
        throw new AppError(err.message, 400);
      }
      if (err.message.includes('not found')) {
        throw new AppError(err.message, 404);
      }
      throw err;
    }
  });

  /**
   * GET /applications/:id/esign-readiness — Check e-sign document gate
   * Returns whether a verified signed Letter of Offer exists.
   * Requires: credit:read
   */
  checkEsignReadiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const signedLoo = await prisma.creditDocument.findFirst({
      where: {
        applicationId: id,
        classification: 'LETTER_OF_OFFER',
        verificationStatus: 'VERIFIED',
        deletedAt: null,
      },
      select: { id: true, fileName: true, verificationStatus: true },
    });
    res.json({
      status: 'success',
      data: {
        ready: !!signedLoo,
        signedLoo: signedLoo ?? null,
      },
    });
  });
}

export const creditApplicationController = new CreditApplicationController();