import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { scorecardService } from '../services/scorecard.service';
import { scoringService } from '../services/scoring.service';

class ScorecardController {
  // ===========================================================================
  // Scorecard CRUD
  // ===========================================================================

  /**
   * GET /scorecards
   * List all scorecards
   */
  listScorecards = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const result = await scorecardService.listScorecards({ page, limit, isActive });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /scorecards/:id
   * Get a single scorecard
   */
  getScorecard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const scorecard = await scorecardService.getScorecard(id);

    if (!scorecard) {
      throw new AppError('Scorecard not found', 404);
    }

    res.json({ status: 'success', data: { scorecard } });
  });

  /**
   * POST /scorecards
   * Create a new scorecard
   */
  createScorecard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const scorecard = await scorecardService.createScorecard(req.body);
    res.status(201).json({ status: 'success', data: { scorecard } });
  });

  /**
   * PATCH /scorecards/:id
   * Update a scorecard
   */
  updateScorecard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const scorecard = await scorecardService.updateScorecard(id, req.body);

    if (!scorecard) {
      throw new AppError('Scorecard not found', 404);
    }

    res.json({ status: 'success', data: { scorecard } });
  });

  /**
   * DELETE /scorecards/:id
   * Soft-delete a scorecard (sets isActive = false)
   */
  deleteScorecard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const scorecard = await scorecardService.deleteScorecard(id);

    if (!scorecard) {
      throw new AppError('Scorecard not found', 404);
    }

    res.json({ status: 'success', message: 'Scorecard deactivated successfully' });
  });

  // ===========================================================================
  // Version Management
  // ===========================================================================

  /**
   * GET /scorecards/:id/versions
   * List all versions for a scorecard
   */
  listVersions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const scorecardId = String(req.params.id);
    const versions = await scorecardService.listVersions(scorecardId);
    res.json({ status: 'success', data: { versions } });
  });

  /**
   * POST /scorecards/:id/versions
   * Create a new version of a scorecard
   */
  createVersion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const scorecardId = String(req.params.id);

    try {
      const version = await scorecardService.createVersion(scorecardId, req.body);
      res.status(201).json({ status: 'success', data: { version } });
    } catch (err: any) {
      if (err.message.includes('Factor weights must sum to 100') ||
          err.message.includes('Missing factor weight') ||
          err.message.includes('must be a number between 0 and 100')) {
        throw new AppError(err.message, 400);
      }
      if (err.message === 'Scorecard not found') {
        throw new AppError(err.message, 404);
      }
      throw err;
    }
  });

  /**
   * POST /scorecard-versions/:id/activate
   * Activate a specific version
   */
  activateVersion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const versionId = String(req.params.id);

    try {
      const version = await scorecardService.activateVersion(versionId);
      res.json({ status: 'success', data: { version } });
    } catch (err: any) {
      if (err.message === 'Scorecard version not found') {
        throw new AppError(err.message, 404);
      }
      throw err;
    }
  });

  // ===========================================================================
  // Scoring
  // ===========================================================================

  /**
   * POST /applications/:id/score
   * Execute credit scoring for an application
   */
  executeScore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.id);
    const scorecardId = req.body.scorecardId as string | undefined;

    try {
      const result = await scoringService.executeScore(
        applicationId,
        scorecardId,
        { actorId: req.user?.id ?? null, source: 'MANUAL' },
      );
      res.status(201).json({ status: 'success', data: result });
    } catch (err: any) {
      if (err.message.includes('not found') || err.message.includes('No active')) {
        throw new AppError(err.message, 400);
      }
      throw err;
    }
  });

  /**
   * GET /applications/:id/scores
   * List all score runs for an application
   */
  getApplicationScores = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.id);
    const scoreRuns = await scoringService.getApplicationScores(applicationId);
    res.json({ status: 'success', data: { scoreRuns } });
  });

  /**
   * POST /score-runs/:id/override
   * Override a score run's risk rating
   * Requires credit:admin permission (enforced at route level)
   */
  overrideScore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const scoreRunId = String(req.params.id);
    const { newRiskRating, overrideReason, overrideApprovedById } = req.body;
    const requestedById = req.user?.id;

    if (!newRiskRating || !overrideReason || !overrideApprovedById) {
      throw new AppError('newRiskRating, overrideReason, and overrideApprovedById are required', 400);
    }
    if (!requestedById) {
      throw new AppError('Unauthenticated', 401);
    }

    try {
      const scoreRun = await scoringService.overrideScore(scoreRunId, {
        newRiskRating,
        overrideReason,
        overrideApprovedById,
        requestedById,
      });
      res.json({ status: 'success', data: { scoreRun } });
    } catch (err: any) {
      if (err.message === 'Score run not found') {
        throw new AppError(err.message, 404);
      }
      throw err;
    }
  });
}

export const scorecardController = new ScorecardController();