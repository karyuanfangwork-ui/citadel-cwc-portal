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
// CA Memo Phase 2
import requestItemRoutes from './requestItem.routes';
import exposureSummaryRoutes from './exposureSummary.routes';
// CA Memo Phase 3
import externalRatingRoutes from './externalRating.routes';
import eclRoutes from './ecl.routes';
import projectionRoutes from './projection.routes';
import sensitivityScenarioRoutes from './sensitivityScenario.routes';

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

// Sprint 5 — Reports
import reportsRoutes from './reports.routes';

// Sprint 5 — Monitoring
import monitoringRoutes from './monitoring.routes';
import monitoringItemRoutes from './monitoringItem.routes';

// Sprint 5 — Security Hardening
import securityRoutes from './security.routes';

// CA Memo Phase 5
import { generateCaMemo } from '../controllers/caMemoPdf.controller';
import { getApprovalPack } from '../controllers/approvalPack.controller';
import bureauCheckRoutes from './bureauCheck.routes';
import qualitativeAssessmentRoutes from './qualitativeAssessment.routes';
import industryAssessmentRoutes from './industryAssessment.routes';
import riskAssessmentRoutes from './riskAssessment.routes';
import rmdIssueRoutes from './rmdIssue.routes';
import esgRoutes from './esg.routes';
import sicrRoutes from './sicr.routes';
import signoffRoutes from './signoff.routes';

// CA Memo Phase 4
import profitabilityRoutes from './profitability.routes';
import walletShareRoutes from './walletShare.routes';
import keyCounterpartyRoutes from './keyCounterparty.routes';
import accountUtilisationRoutes from './accountUtilisation.routes';

// §1.6 — Score Override Approval
import scoreOverrideRoutes from './scoreOverride.routes';

// §2.6 — Delegation
import delegationRoutes from './delegation.routes';

// §2.2 — Credit SLA
import creditSlaRoutes from './creditSla.routes';

// §2.5 — DLP (exports + tokens)
import dlpRoutes from './dlp.routes';

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
router.use('/applications', requestItemRoutes);
router.use('/applications', exposureSummaryRoutes);
router.use('/applications', externalRatingRoutes);
router.use('/applications', eclRoutes);
router.use('/applications', projectionRoutes);
router.use('/applications', sensitivityScenarioRoutes);

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

// Sprint 5 — Reports
router.use('/reports', reportsRoutes);

// Sprint 5 — Monitoring (app-scoped + item-scoped + watchlist)
router.use('/applications', monitoringRoutes);
router.use(monitoringItemRoutes);

// Sprint 5 — Security Hardening
router.use('/security', securityRoutes);

// CA Memo Phase 5
router.get('/applications/:appId/ca-memo', authenticate, requirePermission('credit:read'), generateCaMemo);
router.get('/applications/:appId/approval-pack', authenticate, requirePermission('credit:read'), getApprovalPack);
router.use('/applications', bureauCheckRoutes);
router.use('/applications', qualitativeAssessmentRoutes);
router.use('/applications', industryAssessmentRoutes);
router.use('/applications', riskAssessmentRoutes);
router.use('/applications', rmdIssueRoutes);
router.use('/applications', esgRoutes);
router.use('/applications', sicrRoutes);
router.use('/applications', signoffRoutes);

// CA Memo Phase 4
router.use('/applications', profitabilityRoutes);
router.use('/applications', walletShareRoutes);
router.use(keyCounterpartyRoutes);
router.use('/applications', accountUtilisationRoutes);

// §1.6 — Score Override Approval
router.use('/score-overrides', scoreOverrideRoutes);

// §2.6 — Delegation
router.use('/delegation', delegationRoutes);

// §2.2 — Credit SLA
router.use('/sla', creditSlaRoutes);

// §2.5 — DLP (export tokens + protected export endpoints)
router.use('/', dlpRoutes);

export default router;