import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getPolicyEvaluations, getPolicyEvaluation } from '../services/policyEngine.service';

export const listPolicyEvaluations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const evaluations = await getPolicyEvaluations(String(req.params.applicationId));
  res.json({ status: 'success', data: evaluations });
});

export const getPolicyEvaluationDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const evaluation = await getPolicyEvaluation(String(req.params.applicationId), String(req.params.evaluationId));
  if (!evaluation) throw new AppError('Policy evaluation not found', 404);
  res.json({ status: 'success', data: evaluation });
});
