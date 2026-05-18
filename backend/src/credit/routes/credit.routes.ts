import { Router, Request, Response } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { requireFeatureFlag } from '../middleware/featureFlag.middleware';
import { getQueueHealth } from '../queues';
import prisma from '../../utils/prisma';
import borrowerProfileRoutes from './borrowerProfile.routes';
import directorRoutes from './director.routes';
import shareholderRoutes from './shareholder.routes';
import uboRoutes from './ubo.routes';
import relatedPartyGroupRoutes from './relatedPartyGroup.routes';
import creditDocumentRoutes from './creditDocument.routes';
import approvalRoutes from './approval.routes';
import applicationRoutes from './creditApplication.routes';
import applicationFacilityRoutes from './applicationFacility.routes';
import applicationPartyRoutes from './applicationParty.routes';
import financialRoutes from './financial.routes';
import financialsRoutes from './financials.routes';
import scorecardRoutes from './scorecard.routes';
import scorecardVersionRoutes from './scorecardVersion.routes';
import scoringRoutes from './scoring.routes';
import scoreRunRoutes from './scoreRun.routes';

const router = Router();

// ============================================================================
// FEATURE FLAGS — admin management (MUST be before the feature flag gate)
// These routes need to work even when credit:module is OFF so admins can
// re-enable the module. Only auth + credit:admin permission required.
// ============================================================================
router.use(authenticate);

// List all feature flags
router.get('/feature-flags', requirePermission('credit:admin'), async (_req: Request, res: Response) => {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { category: 'asc' },
  });
  res.json({ status: 'success', data: flags });
});

// Toggle a feature flag
router.patch('/feature-flags/:key', requirePermission('credit:admin'), async (req: Request, res: Response) => {
  const key = req.params.key as string;
  const { enabled, rolloutPct, description } = req.body;

  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) {
    return res.status(404).json({ status: 'error', message: `Feature flag '${key}' not found` });
  }

  const updated = await prisma.featureFlag.update({
    where: { key },
    data: {
      ...(enabled !== undefined && { enabled }),
      ...(rolloutPct !== undefined && { rolloutPct }),
      ...(description !== undefined && { description }),
    },
  });

  // Invalidate the in-memory cache so changes take effect immediately
  const { invalidateFlagCache } = await import('../middleware/featureFlag.middleware');
  await invalidateFlagCache();

  res.json({ status: 'success', data: updated });
});

// ============================================================================
// FEATURE FLAG GATE — all routes below require credit:module to be enabled
// ============================================================================
router.use(requireFeatureFlag('credit:module'));

// ============================================================================
// HEALTH CHECK — verifies credit module is alive and queues are connected
// ============================================================================
router.get('/health', requirePermission('credit:read'), async (_req: Request, res: Response) => {
  try {
    const queueHealth = await getQueueHealth();
    res.json({
      status: 'ok',
      module: 'credit',
      queues: queueHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      module: 'credit',
      error: 'Queue health check failed — Redis may be unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// PLACEHOLDER ROUTES — Sprint 1+ will replace with real controllers
// ============================================================================

// Borrowers — Sprint 1
router.use('/borrowers', borrowerProfileRoutes);

// Directors, Shareholders, UBOs — nested under /borrowers
router.use('/borrowers', directorRoutes);
router.use('/borrowers', shareholderRoutes);
router.use('/borrowers', uboRoutes);

// Related Party Groups — top-level
router.use('/related-party-groups', relatedPartyGroupRoutes);

// Credit Documents & Requirements
router.use(creditDocumentRoutes);

// Applications — Sprint 2
router.use('/applications', applicationRoutes);
router.use('/applications', applicationFacilityRoutes);
router.use('/applications', applicationPartyRoutes);

// Approval Matrix & Actions — Sprint 2
router.use(approvalRoutes);

// Financials — Sprint 3
router.use('/borrowers', financialRoutes);
router.use('/financials', financialsRoutes);

// Scorecards — Sprint 3
router.use('/scorecards', scorecardRoutes);
router.use('/scorecard-versions', scorecardVersionRoutes);
router.use('/applications', scoringRoutes);
router.use('/score-runs', scoreRunRoutes);

// Committee — Sprint 4
// router.use('/committee', committeeRoutes);

// Dashboards — Sprint 5
// router.use('/dashboard', dashboardRoutes);

export default router;