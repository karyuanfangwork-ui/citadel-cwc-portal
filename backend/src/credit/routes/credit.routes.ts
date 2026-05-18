import { Router, Request, Response } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { requireFeatureFlag } from '../middleware/featureFlag.middleware';
import prisma from '../../utils/prisma';

// Sprint 1 — Borrower + Documents
import borrowerProfileRoutes from './borrowerProfile.routes';
import directorRoutes from './director.routes';
import shareholderRoutes from './shareholder.routes';
import uboRoutes from './ubo.routes';
import relatedPartyGroupRoutes from './relatedPartyGroup.routes';
import creditDocumentRoutes from './creditDocument.routes';

// Sprint 2 — Applications + Approvals
import approvalRoutes from './approval.routes';
import applicationRoutes from './creditApplication.routes';
import applicationFacilityRoutes from './applicationFacility.routes';
import applicationPartyRoutes from './applicationParty.routes';

// Sprint 3 — Financials + Scoring
import financialRoutes from './financial.routes';
import financialsRoutes from './financials.routes';
import scorecardRoutes from './scorecard.routes';
import scorecardVersionRoutes from './scorecardVersion.routes';
import scoringRoutes from './scoring.routes';
import scoreRunRoutes from './scoreRun.routes';

// Sprint 4 — Committee + Collateral + Conditions
import committeeRoutes from './committee.routes';
import collateralRoutes from './collateral.routes';
import collateralItemRoutes from './collateralItem.routes';
import guaranteeRoutes from './guarantee.routes';
import conditionRoutes from './condition.routes';
import conditionItemRoutes from './conditionItem.routes';

// Sprint 5 — Dashboard
import dashboardRoutes from './dashboard.routes';

// Sprint 5 — Monitoring
import monitoringRoutes from './monitoring.routes';
import monitoringItemRoutes from './monitoringItem.routes';

// Sprint 5 — Security Hardening
import securityRoutes from './security.routes';

const router = Router();

// Feature flag admin routes (outside feature flag gate)
router.get('/feature-flags', requirePermission('credit:admin'), async (_req: Request, res: Response) => {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  res.json({ status: 'success', data: { flags } });
});

router.patch('/feature-flags/:key', requirePermission('credit:admin'), async (req: Request, res: Response) => {
  const { key } = req.params;
  const enabled: boolean | undefined = req.body.enabled;
  const rolloutPct: number | undefined = req.body.rolloutPct;
  const category: string | undefined = req.body.category;
  const description: string | undefined = req.body.description;
  const flag = await prisma.featureFlag.upsert({
    where: { key: String(key) },
    update: { enabled, rolloutPct, category, description },
    create: { key: String(key), enabled: enabled ?? false, rolloutPct: rolloutPct ?? 0, category: category ?? 'credit', description: description ?? '' },
  });
  res.json({ status: 'success', data: { flag } });
});

// All routes below require authentication + feature flag
router.use(authenticate);
router.use(requireFeatureFlag('credit:module'));

// Health check
router.get('/health', requirePermission('credit:read'), async (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: {
      module: 'credit',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// Sprint 1 — Borrower Profile routes
router.use('/borrowers', borrowerProfileRoutes);

// Directors, Shareholders, UBOs — nested under /borrowers
router.use('/borrowers', directorRoutes);
router.use('/borrowers', shareholderRoutes);
router.use('/borrowers', uboRoutes);

router.use('/related-party-groups', relatedPartyGroupRoutes);

// Credit Documents
router.use(creditDocumentRoutes);

// Sprint 2 — Application routes
router.use('/applications', applicationRoutes);
router.use('/applications', applicationFacilityRoutes);
router.use('/applications', applicationPartyRoutes);

// Approval
router.use(approvalRoutes);

// Sprint 3 — Financial routes
router.use('/borrowers', financialRoutes);
router.use('/financials', financialsRoutes);
router.use('/scorecards', scorecardRoutes);
router.use('/scorecard-versions', scorecardVersionRoutes);
router.use('/applications', scoringRoutes);
router.use('/score-runs', scoreRunRoutes);

// Sprint 4 — Committee
router.use('/committee', committeeRoutes);

// Sprint 4 — Collateral (app-scoped under /applications, item-scoped at /collateral)
router.use('/applications', collateralRoutes);
router.use('/collateral', collateralItemRoutes);

// Sprint 4 — Guarantees (app-scoped under /applications)
router.use('/applications', guaranteeRoutes);

// Sprint 4 — Conditions (app-scoped under /applications, item-scoped at /conditions)
router.use('/applications', conditionRoutes);
router.use('/conditions', conditionItemRoutes);

// Sprint 5 — Dashboard
router.use('/dashboard', dashboardRoutes);

// Sprint 5 — Monitoring (app-scoped + item-scoped + watchlist)
router.use('/applications', monitoringRoutes);
router.use(monitoringItemRoutes);

// Sprint 5 — Security Hardening
router.use('/security', securityRoutes);

export default router;