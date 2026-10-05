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
  createDraftBandSet,
  submitBandSetForApproval,
  approveBandSet,
  activateBandSet,
  listRatingBandSets,
  validateActiveBandSet,
} from '../controllers/ratingBandConfig.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createRatingBandSchema,
  updateRatingBandSchema,
  upsertRiskFactorMatrixSchema,
  createDraftBandSetRouteSchema,
  activateBandSetRouteSchema,
} from '../validators/ratingBandConfig.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Rating band config CRUD
router.get('/', listRatingBands);
router.get('/active', getActiveBands);

// ── LOS-010 — Governed lifecycle: DRAFT → SUBMITTED → APPROVED → ACTIVE ──
// ratingBandService implemented these from the start but no route reached them,
// so the only way to change bands was the ungoverned legacy CRUD below.
router.get('/band-sets', requirePermission('credit:admin'), listRatingBandSets);
router.post('/band-sets', requirePermission('credit:admin'), validate(createDraftBandSetRouteSchema), createDraftBandSet);
router.post('/band-sets/:id/submit', requirePermission('credit:admin'), validateUUID('id'), submitBandSetForApproval);
router.post('/band-sets/:id/approve', requirePermission('credit:admin'), validateUUID('id'), approveBandSet);
router.post(
  '/band-sets/:id/activate',
  requirePermission('credit:admin'),
  validateUUID('id'),
  validate(activateBandSetRouteSchema),
  activateBandSet,
);
router.get('/band-sets/validate', requirePermission('credit:read'), validateActiveBandSet);

// Legacy CRUD (DRAFT-only mutation via LOS-010 guard in controller)
router.post('/', requirePermission('credit:admin'), validate(createRatingBandSchema), createRatingBand);
router.patch('/:id', requirePermission('credit:admin'), validateUUID('id'), validate(updateRatingBandSchema), updateRatingBand);
router.post('/seed', requirePermission('credit:admin'), seedBands);

// Risk factor matrix config
router.get('/risk-factors', listRiskFactorMatrices);
router.post('/risk-factors', requirePermission('credit:admin'), validate(upsertRiskFactorMatrixSchema), upsertRiskFactorMatrix);

export default router;