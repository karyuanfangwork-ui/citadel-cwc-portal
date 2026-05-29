import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { creditApplicationService } from '../services/creditApplication.service';
import { requireUser } from '../utils/requireUser';
import { validateSubmissionReadiness } from '../services/submissionReadiness.service';
import { overrideConnectedPartyFlag } from '../services/connectedParty.service';
import prisma from '../../utils/prisma';

class CreditApplicationController {
  /**
   * GET /applications — List credit applications with pagination & filters
   * Applies data-level access control based on user role:
   * - Admin: sees all applications
   * - Agent (RM/analyst): sees only applications assigned to them
   * - End user (borrower): sees only their own applications
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

    // Data-level access control
    const user = req.user;
    const isAdmin = user?.roles?.some(r => ['ADMIN', 'CREDIT_ADMIN'].includes(r));
    const isAgent = user?.roles?.some(r => ['CREDIT_RM', 'CREDIT_ANALYST', 'IT', 'HR', 'FINANCE'].includes(r));

    let effectiveAssignedRmId = assignedRmId;
    let effectiveAssignedAnalystId = assignedAnalystId;
    let effectiveBorrowerProfileId = borrowerProfileId;

    if (!isAdmin) {
      if (isAgent) {
        // Agent: can only see applications they're assigned to
        if (!effectiveAssignedRmId && !effectiveAssignedAnalystId) {
          effectiveAssignedRmId = user?.id;
        }
      } else {
        // End user / borrower: look up their borrower profile(s) via CRM link
        const borrowerProfiles = await prisma.borrowerProfile.findMany({
          where: {
            isActive: true,
            OR: [
              // Individual borrower: contact → account → owner
              { contact: { account: { ownerId: user?.id } } },
              // Corporate borrower: account → owner
              { account: { ownerId: user?.id } },
            ],
          },
          select: { id: true },
        });
        const borrowerProfileIds = borrowerProfiles.map(bp => bp.id);

        if (borrowerProfileIds.length > 0) {
          effectiveBorrowerProfileId = borrowerProfileIds[0]; // use first match
          // If multiple profiles, could use OR filter but current service only supports single borrowerProfileId
          // For now use the first — most users have one profile
        }
      }
    }

    const result = await creditApplicationService.listApplications({
      page,
      limit,
      state,
      productType,
      borrowerProfileId: effectiveBorrowerProfileId,
      assignedRmId: effectiveAssignedRmId,
      assignedAnalystId: effectiveAssignedAnalystId,
      search,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /applications/:id — Get a single credit application
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const application = await creditApplicationService.getApplication(id);

    if (!application) {
      throw new AppError('Credit application not found', 404);
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

    try {
      const application = await creditApplicationService.updateApplication(id, req.body, actorId);

      if (!application) {
        throw new AppError('Credit application not found', 404);
      }

      res.json({ status: 'success', data: { application } });
    } catch (err: any) {
      if (err.message.includes('DRAFT state')) {
        throw new AppError(err.message, 400);
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
      if (err.message.includes('Invalid transition') || err.message.includes('Reason is required')) {
        throw new AppError(err.message, 400);
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
}

export const creditApplicationController = new CreditApplicationController();