import { Request, Response, NextFunction } from 'express';
import {
  getBorrowerRiskHistory,
  getLatestBorrowerRiskRun,
} from '../services/borrowerRisk.service';

/**
 * GET /borrower-profiles/:borrowerProfileId/risk-history
 * Returns the immutable borrower-level risk run history.
 */
export async function listBorrowerRiskHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const borrowerProfileId = req.params.borrowerProfileId as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = await getBorrowerRiskHistory(borrowerProfileId, limit);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /borrower-profiles/:borrowerProfileId/risk-latest
 * Returns the most recent borrower risk run.
 */
export async function getLatestBorrowerRisk(req: Request, res: Response, next: NextFunction) {
  try {
    const borrowerProfileId = req.params.borrowerProfileId as string;
    const run = await getLatestBorrowerRiskRun(borrowerProfileId);
    if (!run) {
      res.status(404).json({ error: 'No borrower risk runs found for this profile' });
      return;
    }
    res.json({ data: run });
  } catch (err) {
    next(err);
  }
}