/**
 * Insights Routes
 *
 * All endpoints require authentication.
 * ITSM endpoints require 'report:read' permission.
 * CRM endpoints require 'crm:read' permission.
 * Credit endpoints require 'credit:read' permission.
 */

import { Router } from 'express';
import insightsController from '../controllers/insights.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// All insights routes require authentication
router.use(authenticate);

// Overview & ITSM — require report:read
router.get('/overview', requirePermission('report:read'), insightsController.getOverview);
router.get('/itsm/summary', requirePermission('report:read'), insightsController.getItsmSummary);
router.get('/itsm/trends', requirePermission('report:read'), insightsController.getItsmTrends);
router.get(
  '/itsm/by-service-desk',
  requirePermission('report:read'),
  insightsController.getItsmByServiceDesk,
);
router.get(
  '/itsm/by-priority',
  requirePermission('report:read'),
  insightsController.getItsmByPriority,
);
router.get(
  '/itsm/agent-workload',
  requirePermission('report:read'),
  insightsController.getItsmAgentWorkload,
);
router.get(
  '/itsm/sla-compliance',
  requirePermission('report:read'),
  insightsController.getItsmSlaCompliance,
);

// CRM — require crm:read
router.get('/crm/overview', requirePermission('crm:read'), insightsController.getCrmOverview);

// Credit — require credit:read
router.get(
  '/credit/overview',
  requirePermission('credit:read'),
  insightsController.getCreditOverview,
);

export default router;