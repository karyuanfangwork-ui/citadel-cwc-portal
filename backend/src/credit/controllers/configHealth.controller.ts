import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { checkCreditConfigurationHealth } from '../services/configHealth.service';

export const getCreditConfigurationReadiness = asyncHandler(async (_req, res: Response) => {
  const readiness = await checkCreditConfigurationHealth();
  res.json({ status: 'success', data: readiness });
});
