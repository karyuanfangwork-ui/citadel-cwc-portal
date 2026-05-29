import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { requireUser } from '../utils/requireUser';
import {
  requestScoreOverride,
  resolveScoreOverride,
  getScoreOverrides,
} from '../services/scoreOverride.service';

class ScoreOverrideController {
  /**
   * POST /score-overrides
   * Request a score override for an application.
   */
  requestOverride = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const { applicationId, originalRating, overrideRating, justification } = req.body;

    if (!applicationId || !originalRating || !overrideRating) {
      throw new AppError('applicationId, originalRating, and overrideRating are required', 400);
    }

    const result = await requestScoreOverride({
      applicationId,
      originalRating,
      overrideRating,
      justification: justification ?? '',
      approverId: user.id,
    });

    res.status(result.requiresSecondApproval ? 202 : 201).json({
      status: 'success',
      data: result,
    });
  });

  /**
   * GET /score-overrides/application/:applicationId
   * Get all score overrides for an application.
   */
  getByApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { applicationId } = req.params;

    const overrides = await getScoreOverrides(String(applicationId));
    res.json({ status: 'success', data: overrides });
  });

  /**
   * POST /score-overrides/:id/approve
   * Second approver approves a pending score override.
   */
  approveOverride = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const result = await resolveScoreOverride({
      overrideId: String(id),
      secondApproverId: user.id,
      approved: true,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * POST /score-overrides/:id/reject
   * Second approver rejects a pending score override.
   */
  rejectOverride = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const result = await resolveScoreOverride({
      overrideId: String(id),
      secondApproverId: user.id,
      approved: false,
    });

    res.json({ status: 'success', data: result });
  });
}

export const scoreOverrideController = new ScoreOverrideController();