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

/**
 * GET /credit/dashboard/work-queue
 * Dashboard cockpit — 6 operational buckets with per-bucket SLA compliance %
 * Requires: credit:read
 */
router.get(
  '/work-queue',
  requirePermission('credit:read'),
  dashboardController.getWorkQueue,
);

/**
 * GET /credit/dashboard/alerts
 * Dashboard cockpit — alert tiles: High DSR, Expired Bureau, AML Review
 * Requires: credit:read
 */
router.get(
  '/alerts',
  requirePermission('credit:read'),
  dashboardController.getDashboardAlerts,
);

/**
 * GET /credit/dashboard/activity
 * Dashboard cockpit — cross-application recent activity feed
 * Requires: credit:read
 */
router.get(
  '/activity',
  requirePermission('credit:read'),
  dashboardController.getActivityFeed,
);

/**
 * GET /credit/dashboard/team-performance
 * Dashboard cockpit — SLA compliance, approval turnaround, bottleneck stage
 * Requires: credit:admin
 */
router.get(
  '/team-performance',
  requirePermission('credit:admin'),
  dashboardController.getTeamPerformance,
);

export default router;