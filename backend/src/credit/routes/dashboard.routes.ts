import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  pipelineDashboardSchema,
  approvalInboxSchema,
  exposureDashboardSchema,
  committeeCalendarSchema,
  myWorkDashboardSchema,
} from '../validators/dashboard.validator';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * GET /credit/dashboard/my-work
 * My Work dashboard — pending approvals, assigned cases, SLA breaches for the current user
 * Requires: credit:read
 */
router.get(
  '/my-work',
  requirePermission('credit:read'),
  validate(myWorkDashboardSchema),
  dashboardController.getMyWork,
);

/**
 * GET /credit/dashboard/pipeline
 * Pipeline dashboard — application counts by state, avg days, SLA breaches
 * Requires: credit:read
 */
router.get(
  '/pipeline',
  requirePermission('credit:read'),
  validate(pipelineDashboardSchema),
  dashboardController.getPipelineDashboard,
);

/**
 * GET /credit/dashboard/approval-inbox
 * Approval inbox for the current user — grouped by urgency
 * Requires: credit:read
 */
router.get(
  '/approval-inbox',
  requirePermission('credit:read'),
  validate(approvalInboxSchema),
  dashboardController.getApprovalInbox,
);

/**
 * GET /credit/dashboard/exposure
 * Exposure dashboard — top borrowers, sector breakdown, rating distribution
 * Requires: credit:read
 */
router.get(
  '/exposure',
  requirePermission('credit:read'),
  validate(exposureDashboardSchema),
  dashboardController.getExposureDashboard,
);

/**
 * GET /credit/dashboard/committee-calendar
 * Committee calendar — upcoming meetings with agenda counts
 * Requires: credit:read
 */
router.get(
  '/committee-calendar',
  requirePermission('credit:read'),
  validate(committeeCalendarSchema),
  dashboardController.getCommitteeCalendar,
);

/**
 * GET /credit/dashboard/exposure-summary
 * §2.6 — Exposure summary with approaching/breached limits, product type breakdown
 * Requires: credit:read
 */
router.get(
  '/exposure-summary',
  requirePermission('credit:read'),
  dashboardController.getExposureSummary,
);

export default router;