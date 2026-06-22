import { Router } from 'express';
import { borrowerProfileController } from '../controllers/borrowerProfile.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createBorrowerProfileSchema, updateBorrowerProfileSchema } from '../validators/borrowerProfile.validator';
import {
  createBureauReportSchema,
  kycSchema,
  upsertCreditProfileSchema,
  upsertIncomeSchema,
} from '../validators/borrowerCreditData.validator';
import { encryptBorrowerFields, decryptBorrowerFields } from '../middleware/fieldEncryption.middleware';
import { borrowerCreditDataController } from '../controllers/borrowerCreditData.controller';
import { borrowerScoringController } from '../controllers/borrowerScoring.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// §2.9 — Decrypt encrypted fields on all GET responses
router.use(decryptBorrowerFields());

router.get(
  '/stats',
  requirePermission('credit:read'),
  borrowerProfileController.stats,
);

/**
 * GET /borrowers/check-duplicate
 * Check if a borrower exists for a given SSM or NRIC
 * Requires: credit:read
 */
router.get(
  '/check-duplicate',
  requirePermission('credit:read'),
  borrowerProfileController.checkDuplicate,
);

/**
 * GET /borrowers
 * List borrower profiles with pagination & filters
 * Requires: credit:read
 */
router.get(
  '/',
  requirePermission('credit:read'),
  borrowerProfileController.list,
);

/**
 * GET /borrowers/:id/contact-nric/reveal
 * Reveal plaintext contact NRIC — PII-logged
 * Requires: credit:write
 * NOTE: Must be registered before /:id to avoid Express matching "contact-nric" as an id.
 */
router.get(
  '/:id/contact-nric/reveal',
  requirePermission('credit:write'),
  borrowerProfileController.revealContactNric,
);

router.get(
  '/:id/summary',
  requirePermission('credit:read'),
  borrowerCreditDataController.summary,
);

router.get(
  '/:id/activity',
  requirePermission('credit:read'),
  borrowerCreditDataController.activity,
);

router.post(
  '/:id/risk-score',
  requirePermission('credit:write'),
  borrowerScoringController.calculate,
);

router.get(
  '/:id/risk-score/latest',
  requirePermission('credit:read'),
  borrowerScoringController.latest,
);

router.get(
  '/:id/risk-score/history',
  requirePermission('credit:read'),
  borrowerScoringController.history,
);

router.put(
  '/:id/credit-profile',
  requirePermission('credit:write'),
  validate(upsertCreditProfileSchema),
  borrowerCreditDataController.upsertCreditProfile,
);

router.put(
  '/:id/income',
  requirePermission('credit:write'),
  validate(upsertIncomeSchema),
  borrowerCreditDataController.upsertIncome,
);

router.post(
  '/:id/bureau-reports',
  requirePermission('credit:write'),
  validate(createBureauReportSchema),
  borrowerCreditDataController.createBureauReport,
);

router.post(
  '/:id/kyc',
  requirePermission('credit:write'),
  validate(kycSchema),
  borrowerCreditDataController.markKycVerified,
);

/**
 * GET /borrowers/:id
 * Get a single borrower profile
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  borrowerProfileController.getOne,
);

/**
 * POST /borrowers
 * Create a new borrower profile
 * §2.6 — Restricted to RM and ADMIN only (maker role). Creating a borrower
 * profile is the first step in originating credit — same SOD gate as applications.
 * §2.9 — Encrypt sensitive fields before creation
 * Requires: credit:create
 */
router.post(
  '/',
  requirePermission('credit:create'),
  encryptBorrowerFields(),
  validate(createBorrowerProfileSchema),
  borrowerProfileController.create,
);

/**
 * PATCH /borrowers/:id
 * Update a borrower profile
 * §2.9 — Encrypt sensitive fields before update
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  encryptBorrowerFields(),
  validate(updateBorrowerProfileSchema),
  borrowerProfileController.update,
);

/**
 * DELETE /borrowers/:id
 * Soft-delete a borrower profile
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  borrowerProfileController.delete,
);

export default router;