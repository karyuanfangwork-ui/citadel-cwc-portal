import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';
import { exposureSummaryController } from '../controllers/exposureSummary.controller';

// ── Validators ─────────────────────────────────────────────────────────

const upsertExposureSummarySchema = z.object({
  body: z.object({
    thisAppSecured: z.union([z.string(), z.number()]).nullable().optional(),
    thisAppUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    otherAppSecured: z.union([z.string(), z.number()]).nullable().optional(),
    otherAppUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    customerTotalSecured: z.union([z.string(), z.number()]).nullable().optional(),
    customerTotalUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    relatedCounterpartySecured: z.union([z.string(), z.number()]).nullable().optional(),
    relatedCounterpartyUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    groupTotalSecured: z.union([z.string(), z.number()]).nullable().optional(),
    groupTotalUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
  }),
});

// ── Routes ────────────────────────────────────────────────────────────

const router = Router();

router.use(authenticate);

// GET /applications/:applicationId/exposure-summary
router.get('/:applicationId/exposure-summary', requirePermission('credit:read'), exposureSummaryController.get);

// PUT /applications/:applicationId/exposure-summary
router.put('/:applicationId/exposure-summary', requirePermission('credit:write'), validate(upsertExposureSummarySchema), exposureSummaryController.upsert);

export default router;
