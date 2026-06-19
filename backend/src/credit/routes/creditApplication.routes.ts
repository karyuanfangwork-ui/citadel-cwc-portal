import { Router, Response, NextFunction } from 'express';
import { creditApplicationController } from '../controllers/creditApplication.controller';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { applyRmScope } from '../middleware/rmScope.middleware';
import {
  createCreditApplicationSchema,
  updateCreditApplicationSchema,
  transitionApplicationSchema,
  evidenceMappingSchema,
} from '../validators/creditApplication.validator';

// ---------------------------------------------------------------------------
// Tiered RBAC — action → required permission mapping
// ---------------------------------------------------------------------------
const TRANSITION_PERMISSIONS: Record<string, string> = {
  submit: 'credit:write',
  start_kyc: 'credit:write',
  approve_kyc: 'credit:write',
  reject_kyc: 'credit:approve',
  resubmit: 'credit:write',
  start_underwriting: 'credit:write',
  start_assessment: 'credit:write',
  submit_to_committee: 'credit:write',
  approve: 'credit:approve',
  reject: 'credit:approve',
  make_offer: 'credit:approve',
  accept_offer: 'credit:write',
  decline_offer: 'credit:approve',
  disburse: 'credit:disburse',
  activate: 'credit:admin',
  close: 'credit:admin',
  withdraw: 'credit:write',
};

/**
 * Middleware that checks the user's permission based on the transition action
 * in the request body. Each action maps to a specific permission tier:
 *   - credit:write    → RM/operator actions (submit, start_kyc, etc.)
 *   - credit:approve  → approval/decision actions (approve, reject, etc.)
 *   - credit:disburse → disbursement actions (disburse only — SOD separation from admin)
 *   - credit:admin    → operational/admin actions (activate, close)
 *
 * Unknown actions default to the stricter credit:approve tier.
 */
function requireTransitionPermission(req: AuthRequest, _res: Response, next: NextFunction) {
  const action = (req.body as Record<string, unknown>)?.action as string | undefined;
  const requiredPermission = TRANSITION_PERMISSIONS[action ?? ''] || 'credit:approve';
  return requirePermission(requiredPermission)(req, _res, next);
}

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /applications
 * List credit applications with pagination & filters
 * Requires: credit:read
 */
router.get(
  '/',
  requirePermission('credit:read'),
  applyRmScope(), // §2.4 — Row-level access: injects rmScopeFilter for non-admin users
  creditApplicationController.list,
);

/**
 * GET /applications/summary
 * Summary statistics for the applications list page (total, active, myAssigned, pipeline, exposure, overdueSla)
 * §2.4 — Respects RM scope from middleware
 * Requires: credit:read
 */
router.get(
  '/summary',
  requirePermission('credit:read'),
  applyRmScope(),
  creditApplicationController.getSummary,
);

/**
 * GET /applications/:id
 * Get a single credit application
 * §2.4 — applyRmScope() attaches scope info for audit logging on non-admin reads
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  validateUUID('id'),
  applyRmScope(),
  creditApplicationController.getOne,
);

/**
 * POST /applications
 * Create a new credit application
 * §2.6 — Restricted to RM and ADMIN only (maker role). Other credit roles
 * (analyst, manager, senior, committee, ops) cannot originate applications.
 * Requires: credit:create
 */
router.post(
  '/',
  requirePermission('credit:create'),
  validate(createCreditApplicationSchema),
  creditApplicationController.create,
);

/**
 * PATCH /applications/:id
 * Update a credit application (DRAFT only)
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  validateUUID('id'),
  validate(updateCreditApplicationSchema),
  creditApplicationController.update,
);

/**
 * DELETE /applications/:id
 * Soft-delete a credit application (DRAFT only)
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  creditApplicationController.delete,
);

// ============================================================================
// State Machine — Transition routes
// ============================================================================

/**
 * POST /applications/:id/transition
 * Transition application state (action in body)
 * Permission tier depends on the action:
 *   credit:write    — submit, start_kyc, approve_kyc, resubmit, start_underwriting,
 *                    start_assessment, submit_to_committee, accept_offer, withdraw
 *   credit:approve  — approve, reject, reject_kyc, decline_offer, make_offer
 *   credit:disburse — disburse only (SOD: separated from admin)
 *   credit:admin    — activate, close
 */
router.post(
  '/:id/transition',
  requireTransitionPermission,
  validateUUID('id'),
  validate(transitionApplicationSchema),
  creditApplicationController.transition,
);

/**
 * GET /applications/:id/transitions
 * Get valid transitions for the application's current state
 * Requires: credit:read
 */
router.get(
  '/:id/transitions',
  requirePermission('credit:read'),
  validateUUID('id'),
  creditApplicationController.getTransitions,
);

/**
 * GET /applications/:id/audit
 * Get audit trail for an application
 * Requires: credit:read
 */
router.get(
  '/:id/audit',
  requirePermission('credit:read'),
  validateUUID('id'),
  creditApplicationController.getAuditTrail,
);

/**
 * GET /applications/:id/evidence-mapping
 * Get the latest source mapping snapshot for an application
 * Requires: credit:read
 */
router.get(
  '/:id/evidence-mapping',
  requirePermission('credit:read'),
  validateUUID('id'),
  creditApplicationController.getEvidenceMapping,
);

/**
 * POST /applications/:id/evidence-mapping
 * Persist a new source mapping snapshot
 * Requires: credit:write
 */
router.post(
  '/:id/evidence-mapping',
  requirePermission('credit:write'),
  validateUUID('id'),
  validate(evidenceMappingSchema),
  creditApplicationController.saveEvidenceMapping,
);

/**
 * GET /applications/:id/readiness
 * Check submission readiness (hard-gate validation)
 * Requires: credit:read
 */
router.get(
  '/:id/readiness',
  requirePermission('credit:read'),
  validateUUID('id'),
  creditApplicationController.checkReadiness,
);

/**
 * GET /applications/:id/esign-readiness
 * Check e-sign document gate (verified Letter of Offer)
 * Requires: credit:read
 */
router.get(
  '/:id/esign-readiness',
  requirePermission('credit:read'),
  validateUUID('id'),
  creditApplicationController.checkEsignReadiness,
);

/**
 * PATCH /applications/:id/connected-party-flag
 * Override the connected-party flag (manual override with audit trail)
 * Requires: credit:admin
 */
router.patch(
  '/:id/connected-party-flag',
  requirePermission('credit:admin'),
  validateUUID('id'),
  creditApplicationController.overrideConnectedPartyFlag,
);

/**
 * POST /applications/:id/clone
 * Clone an application into a new DRAFT (also supports renewal)
 * Works for APPROVED, ACTIVE, CLOSED, REJECTED states
 * Requires: credit:create
 */
router.post(
  '/:id/clone',
  requirePermission('credit:create'),
  validateUUID('id'),
  creditApplicationController.clone,
);

export default router;