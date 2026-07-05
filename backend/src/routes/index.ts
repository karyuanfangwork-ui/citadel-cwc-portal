import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import requestRoutes from './request.routes';
import serviceDeskRoutes from './serviceDesk.routes';
import notificationRoutes from './notification.routes';
import notificationSseRoutes from './notificationSse.routes';
import kbRoutes from './kb.routes';
import searchRoutes from './search.routes';
import approvalRoutes from './approval.routes';
import policyExplainerRoutes from './policyExplainer.routes';
import interviewRoutes from './interview.routes';
import screeningRoutes from './screening.routes';
import loaRoutes from './loa.routes';
import onboardingRoutes from './onboarding.routes';
import offboardingRoutes from './offboarding.routes';
import onboardingTemplateRoutes from './onboardingTemplate.routes';
import offboardingTemplateRoutes from './offboardingTemplate.routes';
import itWorkflowRoutes from './it-workflow.routes';
import financeWorkflowRoutes from './finance-workflow.routes';
import chargebackWorkflowRoutes from './chargeback-workflow.routes';
import reportsRoutes from './reports.routes';
import bannerConfigRoutes from './bannerConfig.routes';
import requestStatusDefinitionRoutes from './requestStatusDefinition.routes';
import workflowTransitionRoutes from './workflowTransition.routes';
import notificationTemplateRoutes from './notificationTemplate.routes';
import fileRoutes from './file.routes';
import workflowRoutes from './workflow.routes';
import entityRoutes from './entity.routes';
import escalationRuleRouter from './escalationRule.routes';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import auditLogRoutes from './auditLog.routes';
import assetRoutes from './asset.routes';
import systemSettingRoutes from './systemSetting.routes';
import crmRoutes from './crm.routes';
import announcementRoutes from './announcement.routes';
import creditRoutes from '../credit/routes/credit.routes';
import tenantRoutes from './tenant.routes';
import schedulerRoutes from './scheduler.routes';
import queueRoutes from './queue.routes';
import insightsRoutes from './insights.routes';
import pdfJobRoutes from './pdfJob.routes';
import catalogEntitlementRoutes from './catalogEntitlement.routes';
import approvalPolicyRoutes from './approvalPolicy.routes';
import approvalDelegationRoutes from './approvalDelegation.routes';

const router = Router();

// Mount auth routes BEFORE the global rate limiter — auth has its own stricter limiter
// (authLimiter) so applying apiLimiter too would double-count login attempts.
router.use('/auth', authRoutes);

// Apply general rate limiting to all other routes
router.use(apiLimiter);

// Mount routes
router.use('/users', userRoutes);
router.use('/requests', requestRoutes);
router.use('/service-desks', serviceDeskRoutes);
router.use('/notifications', notificationSseRoutes); // SSE first — uses sseAuth for ?token= query param
router.use('/notifications', notificationRoutes);
router.use('/kb', kbRoutes);
router.use('/search', searchRoutes);
router.use('/approvals', approvalRoutes);
router.use('/approvals', policyExplainerRoutes);
router.use('/interviews', interviewRoutes);
router.use('/screening', screeningRoutes);
router.use('/loa', loaRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/offboarding', offboardingRoutes);
router.use('/admin/onboarding-templates', onboardingTemplateRoutes);
router.use('/admin/offboarding-templates', offboardingTemplateRoutes);
router.use('/it-workflow', itWorkflowRoutes);
router.use('/finance-workflow', financeWorkflowRoutes);
router.use('/chargeback-workflow', chargebackWorkflowRoutes);
router.use('/admin/workflows', workflowRoutes);
router.use('/reports', reportsRoutes);
router.use('/admin/banner-configs', bannerConfigRoutes);
router.use('/admin/status-definitions', requestStatusDefinitionRoutes);
router.use('/admin/workflow-transitions', workflowTransitionRoutes);
router.use('/admin/notification-templates', notificationTemplateRoutes);
router.use('/admin/system-settings', systemSettingRoutes);
router.use('/files', fileRoutes);
router.use('/admin/entities', entityRoutes);
router.use('/admin/audit-logs', auditLogRoutes);
router.use('/sla', escalationRuleRouter);
router.use('/assets', assetRoutes);
router.use('/crm', crmRoutes);
router.use('/announcements', announcementRoutes);
router.use('/credit', creditRoutes);
router.use('/admin/tenants', tenantRoutes);
router.use('/admin/scheduler', schedulerRoutes);
router.use('/admin/queues', queueRoutes);
router.use('/insights', insightsRoutes);
router.use('/pdf-jobs', pdfJobRoutes);
router.use('/admin/catalog-entitlements', catalogEntitlementRoutes);
router.use('/admin/approval-policies', approvalPolicyRoutes);
router.use('/approval-delegations', approvalDelegationRoutes);

export default router;

