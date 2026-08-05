import { Router } from 'express';
import { strController } from '../controllers/str.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createStrSchema, updateStrSchema, fileStrSchema, closeStrSchema } from '../validators/str.validator';

const router = Router();

// All STR routes require authentication
router.use(authenticate);

/**
 * POST /str — Create draft STR
 * Permission: credit:str_manage (compliance officers only — tipping-off risk)
 */
router.post(
  '/',
  requirePermission('credit:str_manage'),
  validate(createStrSchema),
  strController.create,
);

/**
 * GET /str — List STRs with filters
 * Permission: credit:str_view (compliance role only)
 */
router.get(
  '/',
  requirePermission('credit:str_view'),
  strController.list,
);

/**
 * GET /str/:id — Get single STR
 * Permission: credit:str_view
 */
router.get(
  '/:id',
  requirePermission('credit:str_view'),
  strController.getOne,
);

/**
 * PATCH /str/:id — Update STR (before filing)
 * Permission: credit:str_manage
 */
router.patch(
  '/:id',
  requirePermission('credit:str_manage'),
  validate(updateStrSchema),
  strController.update,
);

/**
 * PATCH /str/:id/submit — Submit for review (DRAFT → UNDER_REVIEW)
 * Permission: credit:str_manage
 */
router.patch(
  '/:id/submit',
  requirePermission('credit:str_manage'),
  strController.submitForReview,
);

/**
 * PATCH /str/:id/file — File with authority
 * Permission: credit:str_manage
 */
router.patch(
  '/:id/file',
  requirePermission('credit:str_manage'),
  validate(fileStrSchema),
  strController.file,
);

/**
 * PATCH /str/:id/acknowledge — Acknowledge filed STR
 * Permission: credit:str_manage
 */
router.patch(
  '/:id/acknowledge',
  requirePermission('credit:str_manage'),
  strController.acknowledge,
);

/**
 * PATCH /str/:id/close — Close STR
 * Permission: credit:str_manage
 */
router.patch(
  '/:id/close',
  requirePermission('credit:str_manage'),
  validate(closeStrSchema),
  strController.close,
);

/**
 * POST /str/:id/link-aml — Link to AML rescreen event
 * Permission: credit:str_manage
 */
router.post(
  '/:id/link-aml',
  requirePermission('credit:str_manage'),
  strController.linkAml,
);

export default router;