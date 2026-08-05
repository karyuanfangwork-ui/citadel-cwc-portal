import { Router } from 'express';
import { crmAiController } from '../controllers/crm-ai.controller';
import { requirePermission } from '../middleware/auth.middleware';
import { crmAiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(crmAiLimiter);

// Phase 1 — Agent Productivity
router.post('/activities/:id/analyze', requirePermission('crm:read'), crmAiController.analyzeNote);
router.post('/leads/:id/draft-message', requirePermission('crm:read'), crmAiController.draftMessage);
router.post('/contacts/:id/draft-message', requirePermission('crm:read'), crmAiController.draftMessage);
router.get('/leads/:id/summary', requirePermission('crm:read'), crmAiController.leadSummary);

// Phase 2 — Sales Intelligence
router.get('/leads/:id/score', requirePermission('crm:read'), crmAiController.leadScore);
router.get('/opportunities/:id/win-probability', requirePermission('crm:read'), crmAiController.winProbability);
router.get('/dashboard/briefing', requirePermission('crm:read'), crmAiController.dailyBriefing);
router.post('/next-best-action', requirePermission('crm:read'), crmAiController.nextBestAction);

// Phase 3 — Compliance Assist
router.get('/contacts/:id/kyc-gaps', requirePermission('crm:read'), crmAiController.kycGaps);
router.get('/contacts/:id/risk-profile', requirePermission('crm:read'), crmAiController.riskProfile);
router.get('/trust-products/:id/document-checklist', requirePermission('crm:read'), crmAiController.documentChecklist);

// Phase 3 — Manager Intelligence
router.get('/team/briefing', requirePermission('crm:admin'), crmAiController.managerBriefing);
router.get('/opportunities/:id/win-loss-debrief', requirePermission('crm:read'), crmAiController.winLossDebrief);

export default router;
