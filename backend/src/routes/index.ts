import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import requestRoutes from './request.routes';
import serviceDeskRoutes from './serviceDesk.routes';
import notificationRoutes from './notification.routes';
import kbRoutes from './kb.routes';
import searchRoutes from './search.routes';
import approvalRoutes from './approval.routes';
import interviewRoutes from './interview.routes';
import screeningRoutes from './screening.routes';
import loaRoutes from './loa.routes';
import onboardingRoutes from './onboarding.routes';
import onboardingTemplateRoutes from './onboardingTemplate.routes';
import itWorkflowRoutes from './it-workflow.routes';
import financeWorkflowRoutes from './finance-workflow.routes';
import reportsRoutes from './reports.routes';
import bannerConfigRoutes from './bannerConfig.routes';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/requests', requestRoutes);
router.use('/service-desks', serviceDeskRoutes);
router.use('/notifications', notificationRoutes);
router.use('/kb', kbRoutes);
router.use('/search', searchRoutes);
router.use('/approvals', approvalRoutes);
router.use('/interviews', interviewRoutes);
router.use('/screening', screeningRoutes);
router.use('/loa', loaRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/admin/onboarding-templates', onboardingTemplateRoutes);
router.use('/it-workflow', itWorkflowRoutes);
router.use('/finance-workflow', financeWorkflowRoutes);
router.use('/reports', reportsRoutes);
router.use('/admin/banner-configs', bannerConfigRoutes);

export default router;

