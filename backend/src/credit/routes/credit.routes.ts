import { Router, Request, Response } from 'express';
import { authenticate, requirePermission, requireServiceApiKey } from '../../middleware/auth.middleware';
import { requireFeatureFlag, invalidateFlagCache } from '../middleware/featureFlag.middleware';
import prisma from '../../utils/prisma';

// Sprint 1 — Borrower + Documents
import borrowerProfileRoutes from './borrowerProfile.routes';
import directorRoutes from './director.routes';
import fatcaCrsRoutes from './fatcaCrs.routes';
import shareholderRoutes from './shareholder.routes';
import uboRoutes from './ubo.routes';
import relatedPartyGroupRoutes from './relatedPartyGroup.routes';
import creditDocumentRoutes from './creditDocument.routes';
import branchRoutes from './branch.routes';

// Sprint 2 — Applications + Approvals
import approvalRoutes from './approval.routes';
import webhookRoutes from './webhook.routes';
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
import retailIncomeRoutes from './retailIncome.routes';
import bureauChecklistRoutes from './bureauChecklist.routes';
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

// §1.2 — Disbursement Control Layer
import disbursementRoutes from './disbursement.routes';

// §2.1 — Loan Pricing Engine
import pricingRoutes from './pricing.routes';

// §2.3 — LOO (Letter of Offer)
import looRoutes from './loo.routes';

// §2.7 — Rejection workflow
import rejectionRoutes from './rejection.routes';
import amlRescreenRoutes from './amlRescreen.routes';

// §6.2 — Credit Policy Limits
import policyLimitRoutes from './policyLimit.routes';

// §F23 — FX Rate Admin
import fxRateRoutes from './fxRate.routes';
import deviationRoutes from './deviation.routes';
import consentRoutes from './consent.routes';
import strRoutes from './str.routes';
import mfaRoutes from './mfa.routes';

// AI & Automation (A4/A5/A6/A13/A15)
import creditAiRoutes from './creditAi.routes';

// P2-4 — Application Comments & Collaboration
import commentRoutes from './comment.routes';

const router = Router();

// Feature flag routes (outside feature flag gate)

// Public endpoint — returns only {key, enabled} for all flags.
// Requires only credit:read so the frontend can determine which tabs/features to show.
router.get('/feature-flags/public', authenticate, requirePermission('credit:read'), async (_req: Request, res: Response) => {
  const flags = await prisma.featureFlag.findMany({
    select: { key: true, enabled: true },
    orderBy: { key: 'asc' },
  });
  res.json({ status: 'success', data: { flags } });
});

// Admin endpoint — returns full flag details
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
  await invalidateFlagCache();
  res.json({ status: 'success', data: { flag } });
});

// ── P0-5: Service-to-service AV-status callback (no JWT auth) ──────────────
// This route must sit ABOVE the router.use(authenticate) gate so that the
// scanner service can call it with just a service API key, no user JWT required.
import { validate } from '../../middleware/validate.middleware';
import { updateAvStatusSchema } from '../validators/creditDocument.validator';
import { creditDocumentController } from '../controllers/creditDocument.controller';

router.patch(
  '/credit-documents/:id/av-status',
  requireServiceApiKey,
  validate(updateAvStatusSchema),
  creditDocumentController.updateAvStatus,
);

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
router.use('/borrowers', fatcaCrsRoutes);
router.use('/borrowers', shareholderRoutes);
router.use('/borrowers', uboRoutes);

router.use('/related-party-groups', relatedPartyGroupRoutes);

// §3.1 — Branches
router.use('/branches', branchRoutes);

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

// Sprint 4 — Webhook subscriptions
router.use('/webhooks', webhookRoutes);

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
router.use('/applications', retailIncomeRoutes);
router.use('/applications', bureauChecklistRoutes);
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

// §1.2 — Disbursement Control Layer
router.use('/applications', disbursementRoutes);

// §2.1 — Loan Pricing Engine (facility-scoped pricing routes)
router.use('/applications', pricingRoutes);

// §2.3 — LOO (Letter of Offer) generation
router.use('/applications', looRoutes);

// §2.7 — Rejection workflow
router.use('/applications', rejectionRoutes);
router.use('/', amlRescreenRoutes);

// §6.2 — Credit Policy Limits
router.use('/policy-limits', policyLimitRoutes);

// §F23 — FX Rate Admin
router.use('/fx-rates', fxRateRoutes);

// AI & Automation (A4/A5/A6/A13/A15)
router.use('/applications', creditAiRoutes);

// P1-6 — Policy Deviation / Exception Register
router.use('/deviations', deviationRoutes);

// P1-2 — PDPA Consent Records
router.use('/consent', consentRoutes);

// P1-7 — STR Register (restricted access — tipping-off risk)
router.use('/str', strRoutes);

// P1-8 — MFA for Approver/Disburser Roles
router.use('/mfa', mfaRoutes);

// P2-2 — Processing Lanes
import { getApplicationLane, reEvaluateLane, getApplicationTabs } from '../controllers/lane.controller';

router.get('/applications/:id/lane', requirePermission('credit:read'), getApplicationLane);
router.post('/applications/:id/lane', requirePermission('credit:write'), reEvaluateLane);
router.get('/applications/:id/tabs', requirePermission('credit:read'), getApplicationTabs);

// P2-3 — SME Financial Assessment
import smeFinancialRoutes from './smeFinancial.routes';
router.use('/sme', smeFinancialRoutes);

// P2-4 — Application Comments & Collaboration
router.use('/', commentRoutes);

export default router;