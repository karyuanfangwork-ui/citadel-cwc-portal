import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getLatestAssessmentResult } from '../services/assessmentResult.service';

export const getAssessmentResult = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await getLatestAssessmentResult(String(req.params.applicationId));
  if (!result) {
    throw new AppError('Assessment result not found', 404);
  }
  res.json({ status: 'success', data: result });
});
