import { Request, Response, NextFunction } from 'express';
import {
  upsertQualitativeAssessment,
  getQualitativeAssessment,
} from '../services/qualitativeAssessment.service';

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const assessment = await getQualitativeAssessment(String(req.params.appId));
    res.json({ data: assessment });
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const { managementScore, relationshipScore, industryScore, collateralScore } = req.body;

    for (const [key, val] of Object.entries({ managementScore, relationshipScore, industryScore, collateralScore })) {
      if (typeof val !== 'number' || val < 1 || val > 5 || !Number.isInteger(val)) {
        return res.status(400).json({ error: `${key} must be an integer between 1 and 5` });
      }
    }

    const assessment = await upsertQualitativeAssessment(String(req.params.appId), userId, {
      managementScore,
      relationshipScore,
      industryScore,
      collateralScore,
    });
    res.json({ data: assessment });
  } catch (err) {
    next(err);
  }
}
