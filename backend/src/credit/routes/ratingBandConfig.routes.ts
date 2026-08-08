/**
 * Rating Band Config + Risk Factor Matrix Routes — Phase 5 admin
 *
 * LOS-003: mutation routes govern credit methodology and are restricted to
 * credit:admin. Reads remain available to any authenticated credit user.
 */
import { Router } from 'express';
import {
  listRatingBands,
  getActiveBands,
  createRatingBand,
  updateRatingBand,
  seedBands,
  listRiskFactorMatrices,
  upsertRiskFactorMatrix,
} from '../controllers/ratingBandConfig.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Rating band config CRUD
router.get('/', listRatingBands);
router.get('/active', getActiveBands);
router.post('/', requirePermission('credit:admin'), createRatingBand);
router.patch('/:id', requirePermission('credit:admin'), validateUUID('id'), updateRatingBand);
router.post('/seed', requirePermission('credit:admin'), seedBands);

// Risk factor matrix config
router.get('/risk-factors', listRiskFactorMatrices);
router.post('/risk-factors', requirePermission('credit:admin'), upsertRiskFactorMatrix);

export default router;