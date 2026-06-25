/**
 * Rating Band Config + Risk Factor Matrix Routes — Phase 5 admin
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
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Rating band config CRUD
router.get('/', listRatingBands);
router.get('/active', getActiveBands);
router.post('/', createRatingBand);
router.patch('/:id', updateRatingBand);
router.post('/seed', seedBands);

// Risk factor matrix config
router.get('/risk-factors', listRiskFactorMatrices);
router.post('/risk-factors', upsertRiskFactorMatrix);

export default router;