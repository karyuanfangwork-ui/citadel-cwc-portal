import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  executeBorrowerScore,
  getLatestBorrowerRiskRun,
  getBorrowerRiskHistory,
} from '../services/borrowerScoring.service';

class BorrowerScoringController {
  calculate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await executeBorrowerScore(String(req.params.id), req.user?.id);
    res.json({ status: 'success', data: result });
  });

  latest = asyncHandler(async (req: AuthRequest, res: Response) => {
    const run = await getLatestBorrowerRiskRun(String(req.params.id));
    res.json({ status: 'success', data: run });
  });

  history = asyncHandler(async (req: AuthRequest, res: Response) => {
    const runs = await getBorrowerRiskHistory(String(req.params.id));
    res.json({ status: 'success', data: runs });
  });
}

export const borrowerScoringController = new BorrowerScoringController();