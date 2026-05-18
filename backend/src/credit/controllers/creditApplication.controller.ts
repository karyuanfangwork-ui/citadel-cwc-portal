import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { creditApplicationService } from '../services/creditApplication.service';

class CreditApplicationController {
  /**
   * GET /applications — List credit applications with pagination & filters
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

    const result = await creditApplicationService.listApplications({
      page,
      limit,
      state,
      productType,
      borrowerProfileId,
      assignedRmId,
      assignedAnalystId,
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
    const actorId = req.user?.id;
    const application = await creditApplicationService.createApplication(req.body, actorId);
    res.status(201).json({ status: 'success', data: { application } });
  });

  /**
   * PATCH /applications/:id — Update a credit application (DRAFT only)
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const actorId = req.user?.id;

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
    const actorId = req.user?.id;

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
    const actorId = req.user?.id;

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
}

export const creditApplicationController = new CreditApplicationController();