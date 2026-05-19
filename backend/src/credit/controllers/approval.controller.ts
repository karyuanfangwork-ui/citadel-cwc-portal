import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { approvalMatrixService } from '../services/approvalMatrix.service';
import { approvalActionService } from '../services/approvalAction.service';
import { requireUser } from '../utils/requireUser';

class ApprovalController {
  // ===========================================================================
  // Approval Matrix CRUD
  // ===========================================================================

  /**
   * GET /approval-matrices — List approval matrices
   */
  listMatrices = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const result = await approvalMatrixService.listMatrices({ page, limit, isActive });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /approval-matrices/:id — Get a single approval matrix
   */
  getMatrix = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const matrix = await approvalMatrixService.getMatrix(id);

    if (!matrix) {
      throw new AppError('Approval matrix not found', 404);
    }

    res.json({ status: 'success', data: { matrix } });
  });

  /**
   * POST /approval-matrices — Create a new approval matrix
   */
  createMatrix = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actorId = requireUser(req).id;
    const matrix = await approvalMatrixService.createMatrix(req.body, actorId);
    res.status(201).json({ status: 'success', data: { matrix } });
  });

  /**
   * PATCH /approval-matrices/:id — Update an approval matrix
   */
  updateMatrix = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const actorId = requireUser(req).id;

    const matrix = await approvalMatrixService.updateMatrix(id, req.body, actorId);

    if (!matrix) {
      throw new AppError('Approval matrix not found', 404);
    }

    res.json({ status: 'success', data: { matrix } });
  });

  /**
   * DELETE /approval-matrices/:id — Delete an approval matrix
   */
  deleteMatrix = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);

    const matrix = await approvalMatrixService.deleteMatrix(id);

    if (!matrix) {
      throw new AppError('Approval matrix not found', 404);
    }

    res.json({ status: 'success', message: 'Approval matrix deleted successfully' });
  });

  // ===========================================================================
  // Approval Authority Lookup
  // ===========================================================================

  /**
   * POST /approval-matrices/lookup — Look up approval authority by exposure & risk rating
   */
  lookupAuthority = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { exposure, riskRating } = req.body;

    if (exposure === undefined || !riskRating) {
      throw new AppError('exposure and riskRating are required', 400);
    }

    const result = await approvalMatrixService.lookupApprovalAuthority(Number(exposure), riskRating);

    if (!result) {
      throw new AppError('No matching approval authority found for the given exposure and risk rating', 404);
    }

    res.json({ status: 'success', data: result });
  });

  // ===========================================================================
  // Approval Actions
  // ===========================================================================

  /**
   * POST /applications/:id/approvals — Submit an approval action
   */
  submitApproval = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.id);
    const actor = requireUser(req);
    const actorId = actor.id;
    const actorRoles = actor.roles ?? [];
    const { decision, comment, isCommitteeVote } = req.body;

    try {
      const result = await approvalActionService.submitApprovalAction({
        applicationId,
        decision,
        comment,
        isCommitteeVote,
        actorId,
        actorRoles,
      });

      res.json({ status: 'success', data: result });
    } catch (err: any) {
      if (err.statusCode) {
        throw new AppError(err.message, err.statusCode);
      }
      throw err;
    }
  });

  /**
   * GET /applications/:id/approvals — Get all approval decisions for an application
   */
  getApplicationApprovals = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.id);
    const decisions = await approvalActionService.getApplicationApprovals(applicationId);
    res.json({ status: 'success', data: { decisions } });
  });
}

export const approvalController = new ApprovalController();