import { Router } from 'express';
import { crmController } from '../controllers/crm.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
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
router.delete('/activities/:id', requirePermission('crm:delete'), crmController.deleteActivity);

// ======== NOTES ========
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

export default router;