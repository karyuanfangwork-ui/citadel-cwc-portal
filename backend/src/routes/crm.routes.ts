import { Router } from 'express';
import { crmController } from '../controllers/crm.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import crmAiRoutes from './crm-ai.routes';
import {
  createAccountSchema, updateAccountSchema,
  createContactSchema, updateContactSchema,
  createLeadSchema, updateLeadSchema, convertLeadSchema,
  createOpportunitySchema, updateOpportunitySchema, moveOpportunityStageSchema,
  createPipelineSchema,
  createActivitySchema, updateActivitySchema,
  createNoteSchema, updateNoteSchema,
  createTrustProductSchema, updateTrustProductSchema, updateTrustProductStatusSchema,
  upsertKycSchema,
  createBeneficiarySchema, updateBeneficiarySchema,
  createTerritorySchema, updateTerritorySchema, addTerritoryMemberSchema,
  createQuotaSchema, updateQuotaSchema,
  createWorkflowSchema, updateWorkflowSchema,
  updateSyncPreferencesSchema, sendEmailSchema,
  createCustomFieldSchema, updateCustomFieldSchema,
} from '../validators/crm.validator';

const router = Router();

// All CRM routes require authentication
router.use(authenticate);

// ======== DASHBOARD ========
router.get('/dashboard', requirePermission('crm:read'), crmController.getDashboard);
router.get('/search', requirePermission('crm:read'), crmController.globalSearch);
router.get('/users', requirePermission('crm:read'), crmController.listCrmUsers);

// ======== TEAM PERFORMANCE ========
router.get('/team-performance', requirePermission('crm:admin'), crmController.getTeamPerformance);

// ======== MY STATS (Self-Service Rep Stats) ========
router.get('/my-stats', requirePermission('crm:read'), crmController.getMyStats);

// ======== ACCOUNTS ========
router.get('/accounts', requirePermission('crm:read'), crmController.listAccounts);
router.get('/accounts/:id', requirePermission('crm:read'), crmController.getAccount);
router.post('/accounts', requirePermission('crm:write'), validate(createAccountSchema), crmController.createAccount);
router.patch('/accounts/:id', requirePermission('crm:write'), validate(updateAccountSchema), crmController.updateAccount);
router.delete('/accounts/:id', requirePermission('crm:delete'), crmController.deleteAccount);

// ======== CONTACTS ========
router.get('/contacts', requirePermission('crm:read'), crmController.listContacts);
router.get('/contacts/:id', requirePermission('crm:read'), crmController.getContact);
router.post('/contacts', requirePermission('crm:write'), validate(createContactSchema), crmController.createContact);
router.patch('/contacts/:id', requirePermission('crm:write'), validate(updateContactSchema), crmController.updateContact);
router.delete('/contacts/:id', requirePermission('crm:delete'), crmController.deleteContact);

// ======== LEADS ========
router.get('/leads', requirePermission('crm:read'), crmController.listLeads);
router.get('/leads/:id', requirePermission('crm:read'), crmController.getLead);
router.post('/leads', requirePermission('crm:write'), validate(createLeadSchema), crmController.createLead);
router.patch('/leads/:id', requirePermission('crm:write'), validate(updateLeadSchema), crmController.updateLead);
router.post('/leads/:id/convert', requirePermission('crm:write'), validate(convertLeadSchema), crmController.convertLead);
router.delete('/leads/:id', requirePermission('crm:delete'), crmController.deleteLead);

// ======== OPPORTUNITIES ========
router.get('/opportunities', requirePermission('crm:read'), crmController.listOpportunities);
router.get('/opportunities/:id', requirePermission('crm:read'), crmController.getOpportunity);
router.post('/opportunities', requirePermission('crm:write'), validate(createOpportunitySchema), crmController.createOpportunity);
router.patch('/opportunities/:id', requirePermission('crm:write'), validate(updateOpportunitySchema), crmController.updateOpportunity);
router.post('/opportunities/:id/move-stage', requirePermission('crm:write'), validate(moveOpportunityStageSchema), crmController.moveStage);
router.delete('/opportunities/:id', requirePermission('crm:delete'), crmController.deleteOpportunity);

// ======== PIPELINES ========
router.get('/pipelines', requirePermission('crm:read'), crmController.listPipelines);
router.get('/pipelines/:id', requirePermission('crm:read'), crmController.getPipeline);
router.post('/pipelines', requirePermission('crm:admin'), validate(createPipelineSchema), crmController.createPipeline);
router.patch('/pipelines/:id', requirePermission('crm:admin'), crmController.updatePipeline);

// ======== ACTIVITIES ========
router.get('/activities', requirePermission('crm:read'), crmController.listActivities);
router.post('/activities', requirePermission('crm:write'), validate(createActivitySchema), crmController.createActivity);
router.patch('/activities/:id', requirePermission('crm:write'), validate(updateActivitySchema), crmController.updateActivity);
router.post('/activities/:id/remind', requirePermission('crm:write'), crmController.remindActivity);
router.delete('/activities/:id', requirePermission('crm:delete'), crmController.deleteActivity);

// ======== NOTES ========
router.get('/notes', requirePermission('crm:read'), crmController.listNotes);
router.post('/notes', requirePermission('crm:write'), validate(createNoteSchema), crmController.createNote);
router.patch('/notes/:id', requirePermission('crm:write'), validate(updateNoteSchema), crmController.updateNote);
router.delete('/notes/:id', requirePermission('crm:write'), crmController.deleteNote);

// ======== TRUST PRODUCTS ========
router.get('/trust-products', requirePermission('crm:read'), crmController.listTrustProducts);
router.get('/trust-products/:id', requirePermission('crm:read'), crmController.getTrustProduct);
router.post('/trust-products', requirePermission('crm:write'), validate(createTrustProductSchema), crmController.createTrustProduct);
router.patch('/trust-products/:id', requirePermission('crm:write'), validate(updateTrustProductSchema), crmController.updateTrustProduct);
router.patch('/trust-products/:id/status', requirePermission('crm:admin'), validate(updateTrustProductStatusSchema), crmController.updateTrustProduct); // status change needs admin
router.delete('/trust-products/:id', requirePermission('crm:delete'), crmController.deleteTrustProduct);

// ======== KYC ========
router.get('/contacts/:contactId/kyc', requirePermission('crm:read'), crmController.getKycRecord);
router.put('/contacts/:contactId/kyc', requirePermission('crm:write'), validate(upsertKycSchema), crmController.createOrUpdateKycRecord);
router.post('/contacts/:contactId/kyc/approve', requirePermission('crm:admin'), crmController.approveKyc);

// ======== BENEFICIARIES ========
router.get('/contacts/:contactId/beneficiaries', requirePermission('crm:read'), crmController.listBeneficiaries);
router.post('/contacts/:contactId/beneficiaries', requirePermission('crm:write'), validate(createBeneficiarySchema), crmController.createBeneficiary);
router.patch('/beneficiaries/:id', requirePermission('crm:write'), validate(updateBeneficiarySchema), crmController.updateBeneficiary);
router.delete('/beneficiaries/:id', requirePermission('crm:delete'), crmController.deleteBeneficiary);

// ======== REPORTS ========
router.get('/reports/lead-conversion', requirePermission('crm:read'), crmController.getLeadConversionReport);
router.get('/reports/sales-performance', requirePermission('crm:read'), crmController.getSalesPerformanceReport);
router.get('/reports/pipeline-forecast', requirePermission('crm:read'), crmController.getPipelineForecastReport);
router.get('/reports/activity-summary', requirePermission('crm:read'), crmController.getActivitySummaryReport);
router.get('/reports/lead-aging', requirePermission('crm:read'), crmController.getLeadAgingReport);
router.get('/reports/win-loss', requirePermission('crm:read'), crmController.getWinLossReport);
router.get('/reports/kyc-compliance', requirePermission('crm:read'), crmController.getKycComplianceReport);
router.get('/reports/forecast-categories', requirePermission('crm:read'), crmController.getForecastCategoriesReport);
router.get('/reports/forecast-accuracy', requirePermission('crm:read'), crmController.getForecastAccuracyReport);

// ======== AI FEATURES ========
router.use('/ai', crmAiRoutes);

// ======== AUDIT TRAIL ========
router.get('/audit/:entityType/:entityId', requirePermission('crm:read'), crmController.getEntityAuditTrail);

// ======== IMPORT / EXPORT ========
import multer from 'multer';
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB
router.post('/import/upload', requirePermission('crm:admin'), importUpload.single('file'), crmController.uploadImportFile);
router.get('/import/field-definitions', requirePermission('crm:read'), crmController.getFieldDefinitions);
router.get('/import/template', requirePermission('crm:read'), crmController.downloadImportTemplate);
router.post('/import/:id/mapping', requirePermission('crm:admin'), crmController.validateImportMapping);
router.post('/import/:id/execute', requirePermission('crm:admin'), crmController.executeImport);
router.get('/import/:id/status', requirePermission('crm:admin'), crmController.getImportStatus);
router.get('/import/history', requirePermission('crm:admin'), crmController.getImportHistory);
router.post('/export', requirePermission('crm:read'), crmController.requestExport);
router.get('/export/:id/download', requirePermission('crm:read'), crmController.downloadExport);
router.get('/export/history', requirePermission('crm:read'), crmController.getExportHistory);

// ======== TERRITORIES ========
router.get('/territories', requirePermission('crm:read'), crmController.listTerritories);
router.get('/territories/lookup', requirePermission('crm:read'), crmController.lookupTerritory);
router.get('/territories/:id', requirePermission('crm:read'), crmController.getTerritory);
router.post('/territories', requirePermission('crm:admin'), validate(createTerritorySchema), crmController.createTerritory);
router.put('/territories/:id', requirePermission('crm:admin'), validate(updateTerritorySchema), crmController.updateTerritory);
router.delete('/territories/:id', requirePermission('crm:admin'), crmController.deleteTerritory);
router.post('/territories/:id/members', requirePermission('crm:admin'), validate(addTerritoryMemberSchema), crmController.addTerritoryMember);
router.delete('/territories/:id/members/:userId', requirePermission('crm:admin'), crmController.removeTerritoryMember);
router.put('/territories/:id/members/:userId', requirePermission('crm:admin'), crmController.updateTerritoryMember);

// ======== QUOTAS ========
router.get('/quotas', requirePermission('crm:read'), crmController.listQuotas);
router.get('/quotas/dashboard', requirePermission('crm:read'), crmController.getQuotaDashboard);
router.get('/quotas/attainment', requirePermission('crm:read'), crmController.getQuotaAttainment);
router.get('/quotas/:id', requirePermission('crm:read'), crmController.getQuota);
router.post('/quotas', requirePermission('crm:admin'), validate(createQuotaSchema), crmController.createQuota);
router.put('/quotas/:id', requirePermission('crm:admin'), validate(updateQuotaSchema), crmController.updateQuota);
router.delete('/quotas/:id', requirePermission('crm:admin'), crmController.deleteQuota);

// ======== DASHBOARD LAYOUT ========
router.get('/dashboard/widgets', requirePermission('crm:read'), crmController.getWidgetRegistry);
router.get('/dashboard/layout', requirePermission('crm:read'), crmController.getDashboardLayout);
router.put('/dashboard/layout', requirePermission('crm:read'), crmController.saveDashboardLayout);
router.post('/dashboard/layout/reset', requirePermission('crm:read'), crmController.resetDashboardLayout);

// ======== WORKFLOW AUTOMATION ========
router.get('/workflows', requirePermission('crm:read'), crmController.listWorkflows);
router.get('/workflows/templates', requirePermission('crm:read'), crmController.getWorkflowTemplates);
router.get('/workflows/executions', requirePermission('crm:admin'), crmController.getAllExecutions);
router.post('/workflows', requirePermission('crm:admin'), validate(createWorkflowSchema), crmController.createWorkflow);
router.get('/workflows/:id', requirePermission('crm:read'), crmController.getWorkflow);
router.put('/workflows/:id', requirePermission('crm:admin'), validate(updateWorkflowSchema), crmController.updateWorkflow);
router.delete('/workflows/:id', requirePermission('crm:admin'), crmController.deleteWorkflow);
router.patch('/workflows/:id/toggle', requirePermission('crm:admin'), crmController.toggleWorkflow);
router.get('/workflows/:id/executions', requirePermission('crm:read'), crmController.getWorkflowExecutions);

// ======== EMAIL / CALENDAR INTEGRATION ========
router.get('/integrations', requirePermission('crm:read'), crmController.listIntegrations);
router.get('/integrations/google/auth', requirePermission('crm:read'), crmController.getGoogleAuthUrl);
router.get('/integrations/google/callback', crmController.handleGoogleCallback);
router.get('/integrations/outlook/auth', requirePermission('crm:read'), crmController.getOutlookAuthUrl);
router.get('/integrations/outlook/callback', crmController.handleOutlookCallback);
router.delete('/integrations/:id', requirePermission('crm:admin'), crmController.disconnectIntegration);
router.patch('/integrations/:id', requirePermission('crm:admin'), validate(updateSyncPreferencesSchema), crmController.updateSyncPreferences);
router.post('/integrations/:id/sync', requirePermission('crm:read'), crmController.triggerSync);

router.get('/emails', requirePermission('crm:read'), crmController.listSyncedEmails);
router.get('/emails/:id', requirePermission('crm:read'), crmController.getEmail);
router.post('/emails/send', requirePermission('crm:write'), validate(sendEmailSchema), crmController.sendEmail);
router.get('/events', requirePermission('crm:read'), crmController.listSyncedEvents);

// ======== ANOMALY DETECTION ========
router.get('/anomalies', requirePermission('crm:read'), crmController.getAnomalies);
router.get('/anomalies/config', requirePermission('crm:admin'), crmController.getAnomalyConfig);
router.put('/anomalies/config/:id', requirePermission('crm:admin'), crmController.updateAnomalyConfig);
router.post('/anomalies/refresh', requirePermission('crm:read'), crmController.refreshAnomalies);

// ======== CUSTOM FIELDS ========
router.get('/custom-fields', requirePermission('crm:read'), crmController.getCustomFieldDefinitions);
router.post('/custom-fields', requirePermission('crm:admin'), validate(createCustomFieldSchema), crmController.createCustomFieldDefinition);
router.put('/custom-fields/:id', requirePermission('crm:admin'), validate(updateCustomFieldSchema), crmController.updateCustomFieldDefinition);
router.delete('/custom-fields/:id', requirePermission('crm:admin'), crmController.deleteCustomFieldDefinition);

// ======== DUPLICATE DETECTION & MERGE ========
router.get('/duplicates', requirePermission('crm:read'), crmController.listDuplicates);
router.post('/duplicates/:id/merge', requirePermission('crm:write'), crmController.mergeDuplicates);
router.post('/duplicates/:id/dismiss', requirePermission('crm:write'), crmController.dismissDuplicate);

// Lead Scoring Rules (admin-only)
router.get('/lead-scoring-rules', requirePermission('crm:admin'), crmController.listScoringRules);
router.post('/lead-scoring-rules', requirePermission('crm:admin'), crmController.createScoringRule);
router.put('/lead-scoring-rules/:id', requirePermission('crm:admin'), crmController.updateScoringRule);
router.delete('/lead-scoring-rules/:id', requirePermission('crm:admin'), crmController.deleteScoringRule);
router.post('/lead-scoring-rules/recompute', requirePermission('crm:admin'), crmController.recomputeScores);

// Assignment Rules (admin-only)
router.get('/assignment-rules', requirePermission('crm:admin'), crmController.listAssignmentRules);
router.post('/assignment-rules', requirePermission('crm:admin'), crmController.createAssignmentRule);
router.put('/assignment-rules/:id', requirePermission('crm:admin'), crmController.updateAssignmentRule);
router.delete('/assignment-rules/:id', requirePermission('crm:admin'), crmController.deleteAssignmentRule);

export default router;