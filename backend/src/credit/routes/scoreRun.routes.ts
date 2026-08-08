import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /score-runs/:id/override — RETIRED (LOS-008)
 *
 * This path accepted `overrideApprovedById` from the request body, so its SOD
 * check only compared a client-supplied UUID against the caller: nothing proved
 * that person held credit:approve or had actually approved anything. All rating
 * overrides now go through POST /api/v1/credit/score-overrides, which derives
 * the score run and original rating server-side and records a real second-approver action.
 */
router.post('/:id/override', requirePermission('credit:admin'), (_req, res) => {
  res.status(410).json({
    status: 'error',
    statusCode: 410,
    message:
      'This endpoint has been retired. Use POST /api/v1/credit/score-overrides to request a rating override.',
    code: 'SCORE_OVERRIDE_ENDPOINT_RETIRED',
  });
});

export default router;