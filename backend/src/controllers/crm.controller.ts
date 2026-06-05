import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import crmService from '../services/crm.service';
import { respondOrCsv } from '../utils/csv-response';
import { resolveVisibleOwnerIds, applyOwnerScope } from '../services/crm-scope.service';
import { detectCycle } from '../services/crm-account-hierarchy.service';
import * as crmForecastService from '../services/crm-forecast.service';
import { recomputeLeadRuleScore } from '../services/crm-lead-scoring.service';
import { notify } from '../services/notification.service';
import { autoAssignLead } from '../services/crm-automation.service';
import { trackFieldChanges } from '../services/crm-field-change.service';
import crmReportsService from '../services/crm-reports.service';
import { scoreLead, predictWinProbability } from '../services/crm-ai.service';
import { logger } from '../utils/logger';
import * as importExportService from '../services/crm-import-export.service';
import * as territoryService from '../services/crm-territory.service';
import * as dashboardLayoutService from '../services/crm-dashboard-layout.service';
import * as workflowService from '../services/crm-workflow.service';
import * as emailSyncService from '../services/crm-email-sync.service';
import * as anomalyService from '../services/crm-anomaly.service';
import * as customFieldsService from '../services/crm-custom-fields.service';
import * as duplicateService from '../services/crm-duplicate.service';
import { broadcast } from '../utils/sseClients';

const prisma = new PrismaClient();

const userSelect = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true };

/** Mask bankAccount in API responses — only show last 4 digits */
const maskBankAccount = (account: any): any => {
  if (!account) return account;
  if (Array.isArray(account)) return account.map(maskBankAccount);
  if (typeof account === 'object' && account.bankAccount !== undefined) {
    const { bankAccount, ...rest } = account;
    return { ...rest, bankAccount: bankAccount ? `****${bankAccount.slice(-4)}` : null };
  }
  return account;
};

class CrmController {
  // ======== DASHBOARD ========
  getDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await crmService.getDashboardStats(req.query.myDeals === 'true' ? req.user!.id : undefined);
    res.json({ status: 'success', data: stats });
  });

  // ======== ACCOUNTS ========
  listAccounts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';
    const search = req.query.search as string | undefined;
    const industry = req.query.industry as string | undefined;
    const ownerId = req.query.ownerId as string | undefined;
    const isActive = req.query.isActive as string | undefined;
    const purchaseCashTrust = req.query.purchaseCashTrust as string | undefined;
    const accountType = req.query.accountType as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = { deletedAt: null };
    // Team-scoped RBAC: admins see all, managers see own+team, reps see only own
    const visibleOwnerIds = await resolveVisibleOwnerIds(req.user!);
    Object.assign(where, applyOwnerScope({}, visibleOwnerIds));
    if (visibleOwnerIds === null && ownerId) where.ownerId = ownerId; // admin may filter to one owner
    if (industry) where.industry = industry;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (purchaseCashTrust !== undefined) where.purchaseCashTrust = purchaseCashTrust === 'true';
    if (accountType) where.accountType = accountType;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [accounts, total] = await Promise.all([
      prisma.crmAccount.findMany({
        where, skip: (pageNum - 1) * limitNum, take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
        include: {
          owner: { select: userSelect },
          _count: { select: { contacts: true, opportunities: true, leads: true } },
        },
      }),
      prisma.crmAccount.count({ where }),
    ]);
    res.json({ status: 'success', data: { accounts: maskBankAccount(accounts), pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  });

  getAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await prisma.crmAccount.findFirst({
      where: { id: req.params.id as string, deletedAt: null },
      include: {
        owner: { select: userSelect },
        contacts: { where: { isActive: true }, orderBy: { isPrimary: 'desc' } },
        opportunities: { include: { stage: true, owner: { select: userSelect } }, orderBy: { updatedAt: 'desc' }, take: 10 },
        leads: { orderBy: { createdAt: 'desc' }, take: 10 },
        activities: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
        notes: { include: { author: { select: userSelect } }, orderBy: { isPinned: 'desc' }, take: 20 },
        _count: { select: { contacts: true, opportunities: true, leads: true, linkedRequests: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, industry: true } },
      },
    });
    if (!account) throw new AppError('Account not found', 404);

    // Optional roll-up: aggregate child-account opportunity values
    let rollup: { childCount: number; childOpportunityValue: number } | null = null;
    if (req.query.includeRollup === 'true') {
      const childIds = account.children?.map((c: any) => c.id) ?? [];
      if (childIds.length > 0) {
        const agg = await prisma.crmOpportunity.aggregate({
          _sum: { value: true },
          _count: true,
          where: { accountId: { in: childIds } },
        });
        rollup = { childCount: childIds.length, childOpportunityValue: Number(agg._sum?.value ?? 0) };
      } else {
        rollup = { childCount: 0, childOpportunityValue: 0 };
      }
    }

    res.json({ status: 'success', data: { account: maskBankAccount(account), rollup } });
  });

  createAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Cycle guard: validate parentAccountId doesn't create a loop
    if (req.body.parentAccountId) {
      const deps = { getParentId: async (id: string) => {
        const a = await prisma.crmAccount.findUnique({ where: { id }, select: { parentAccountId: true } });
        return a?.parentAccountId ?? null;
      }};
      const cycle = await detectCycle(req.body.id ?? 'new', req.body.parentAccountId, deps);
      if (!cycle.ok) throw new AppError(cycle.reason!, 422);
    }
    const account = await prisma.crmAccount.create({
      data: { ...req.body, ownerId: req.user!.id },
      include: { owner: { select: userSelect } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmAccount', resourceId: account.id, newValues: { ...req.body, bankAccount: req.body.bankAccount ? '****' : undefined } } });
    res.status(201).json({ status: 'success', data: { account: maskBankAccount(account) } });
    broadcast('crm_update', { type: 'account.created', entityType: 'account', id: account.id, changedBy: req.user!.id });
  });

  updateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmAccount.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Account not found', 404);
    // Cycle guard: validate parentAccountId doesn't create a loop
    if (req.body.parentAccountId !== undefined) {
      const deps = { getParentId: async (id: string) => {
        const a = await prisma.crmAccount.findUnique({ where: { id }, select: { parentAccountId: true } });
        return a?.parentAccountId ?? null;
      }};
      // For update, check if the *new* parent chain leads back to the account being updated
      const cycle = await detectCycle(req.params.id as string, req.body.parentAccountId, deps);
      if (!cycle.ok) throw new AppError(cycle.reason!, 422);
    }
    const account = await prisma.crmAccount.update({ where: { id: req.params.id as string }, data: req.body, include: { owner: { select: userSelect } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmAccount', resourceId: account.id, oldValues: existing as any, newValues: { ...req.body, bankAccount: req.body.bankAccount ? '****' : undefined } } });
    trackFieldChanges('ACCOUNT', account.id, existing as any, req.body, req.user!.id).catch(() => {});
    res.json({ status: 'success', data: { account: maskBankAccount(account) } });
    broadcast('crm_update', { type: 'account.updated', entityType: 'account', id: account.id, changedBy: req.user!.id });
  });

  deleteAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmAccount.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Account not found', 404);
    await prisma.crmAccount.update({ where: { id: req.params.id as string }, data: { isActive: false, deletedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmAccount', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Account deactivated' });
    broadcast('crm_update', { type: 'account.deleted', entityType: 'account', id: req.params.id as string, changedBy: req.user!.id });
  });

  // ======== CONTACTS ========
  listContacts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';
    const search = req.query.search as string | undefined;
    const accountId = req.query.accountId as string | undefined;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = { isActive: true, deletedAt: null };
    // Team-scoped RBAC: contacts scoped by parent account ownership
    const visibleOwnerIds = await resolveVisibleOwnerIds(req.user!);
    if (visibleOwnerIds !== null) {
      where.account = { ownerId: { in: visibleOwnerIds } };
    }
    if (accountId) where.accountId = accountId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [contacts, total] = await Promise.all([
      prisma.crmContact.findMany({
        where, skip: (pageNum - 1) * limitNum, take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { account: { select: { id: true, name: true } } },
      }),
      prisma.crmContact.count({ where }),
    ]);
    res.json({ status: 'success', data: { contacts, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  });

  getContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    const contact = await prisma.crmContact.findUnique({
      where: { id: req.params.id as string },
      include: {
        account: { select: { id: true, name: true, industry: true } },
        opportunities: { include: { stage: true }, orderBy: { updatedAt: 'desc' }, take: 5 },
        leads: { include: { owner: { select: userSelect } }, orderBy: { updatedAt: 'desc' }, take: 10 },
        activities: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
        notes: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!contact) throw new AppError('Contact not found', 404);
    res.json({ status: 'success', data: { contact } });
  });

  createContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.body.accountId) {
      const account = await prisma.crmAccount.findUnique({ where: { id: req.body.accountId } });
      if (!account) throw new AppError('Account not found', 404);
    }
    const { dateOfBirth, pdpaConsentDate, followUpDate, ...rest } = req.body;
    const contact = await prisma.crmContact.create({
      data: {
        ...rest,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        pdpaConsentDate: pdpaConsentDate ? new Date(pdpaConsentDate) : undefined,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      },
      include: { account: { select: { id: true, name: true } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmContact', resourceId: contact.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { contact } });
    broadcast('crm_update', { type: 'contact.created', entityType: 'contact', id: contact.id, changedBy: req.user!.id });
    // Background duplicate check for new contact
    setImmediate(() => {
      duplicateService.checkContactDuplicates(contact.id).catch((err: unknown) =>
        logger.warn(`[CRM] Duplicate check failed for contact ${contact.id}`, { error: err }),
      );
    });
  });

  updateContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmContact.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Contact not found', 404);
    const { dateOfBirth, pdpaConsentDate, followUpDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (pdpaConsentDate !== undefined) data.pdpaConsentDate = pdpaConsentDate ? new Date(pdpaConsentDate) : null;
    if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null;
    const contact = await prisma.crmContact.update({ where: { id: req.params.id as string }, data, include: { account: { select: { id: true, name: true } } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmContact', resourceId: contact.id, oldValues: existing as any, newValues: req.body } });
    trackFieldChanges('CONTACT', contact.id, existing as any, req.body, req.user!.id).catch(() => {});
    res.json({ status: 'success', data: { contact } });
    broadcast('crm_update', { type: 'contact.updated', entityType: 'contact', id: contact.id, changedBy: req.user!.id });
  });

  deleteContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmContact.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Contact not found', 404);
    await prisma.crmContact.update({ where: { id: req.params.id as string }, data: { isActive: false, deletedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmContact', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Contact deactivated' });
    broadcast('crm_update', { type: 'contact.deleted', entityType: 'contact', id: req.params.id as string, changedBy: req.user!.id });
  });

  // ======== LEADS ========
  listLeads = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const ownerId = req.query.ownerId as string | undefined;
    const stale = req.query.stale === 'true';
    const followup = req.query.followup === 'true';
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = { deletedAt: null };
    // Team-scoped RBAC: admins see all, managers see own+team, reps see only own
    const visibleOwnerIds = await resolveVisibleOwnerIds(req.user!);
    Object.assign(where, applyOwnerScope({}, visibleOwnerIds));
    if (visibleOwnerIds === null && ownerId) where.ownerId = ownerId; // admin may filter to one owner
    if (status) where.status = status;
    if (source) where.source = source;
    if (stale) {
      where.status = { notIn: ['CONVERTED', 'LOST'] };
      where.activities = { none: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } };
    }
    if (followup) {
      // Follow-ups due today or overdue (date <= end of today), excluding converted/lost
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      where.followUpDate = { lte: todayEnd };
      where.status = { notIn: ['CONVERTED', 'LOST'] };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [leads, total] = await Promise.all([
      prisma.crmLead.findMany({
        where, skip: (pageNum - 1) * limitNum, take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: userSelect },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.crmLead.count({ where }),
    ]);
    res.json({ status: 'success', data: { leads, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  });

  getLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const lead = await prisma.crmLead.findUnique({
      where: { id: req.params.id as string },
      include: {
        owner: { select: userSelect },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        activities: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
        notes: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!lead) throw new AppError('Lead not found', 404);
    res.json({ status: 'success', data: { lead } });
  });

  createLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Use ownerId from body if provided, otherwise default to logged-in user
    const ownerId = req.body.ownerId || req.user!.id;
    const { ownerId: _ownerId, autoAssign, ...restBody } = req.body;
    const lead = await prisma.crmLead.create({
      data: { ...restBody, ownerId },
      include: { owner: { select: userSelect }, account: { select: { id: true, name: true } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmLead', resourceId: lead.id, newValues: req.body } });

    // Auto-assign via round-robin if requested (e.g. no explicit owner preference)
    if (autoAssign === true) {
      const assigned = await autoAssignLead(lead.id);
      if (assigned) {
        // Re-fetch lead with updated owner for response
        const refreshed = await prisma.crmLead.findUnique({
          where: { id: lead.id },
          include: { owner: { select: userSelect }, account: { select: { id: true, name: true } } },
        });
        res.status(201).json({ status: 'success', data: { lead: refreshed } });
        broadcast('crm_update', { type: 'lead.created', entityType: 'lead', id: lead.id, changedBy: req.user!.id });
        const leadIdToScore = lead.id;
        setImmediate(() => {
          scoreLead(leadIdToScore).catch((err: unknown) =>
            logger.warn(`[CRM] Background lead scoring failed for ${leadIdToScore}`, { error: err }),
          );
        });
        // Emit workflow event for lead creation (auto-assigned path)
        const { emitWorkflowEvent } = await import('../services/crm-workflow.service');
        emitWorkflowEvent('lead.created', 'LEAD', lead.id, { ...refreshed });
        // Background duplicate check for new lead
        setImmediate(() => {
          duplicateService.checkLeadDuplicates(lead.id).catch((err: unknown) =>
            logger.warn(`[CRM] Duplicate check failed for lead ${lead.id}`, { error: err }),
          );
        });
        return;
      }
    }

    res.status(201).json({ status: 'success', data: { lead } });
    broadcast('crm_update', { type: 'lead.created', entityType: 'lead', id: lead.id, changedBy: req.user!.id });
    const leadIdToScore = lead.id;
    setImmediate(() => {
      scoreLead(leadIdToScore).catch((err: unknown) =>
        logger.warn(`[CRM] Background lead scoring failed for ${leadIdToScore}`, { error: err }),
      );
    });
    // Emit workflow event for lead creation (normal path)
    const { emitWorkflowEvent } = await import('../services/crm-workflow.service');
    emitWorkflowEvent('lead.created', 'LEAD', lead.id, { ...lead });
    // Background duplicate check for new lead
    setImmediate(() => {
      duplicateService.checkLeadDuplicates(lead.id).catch((err: unknown) =>
        logger.warn(`[CRM] Duplicate check failed for lead ${lead.id}`, { error: err }),
      );
    });
    // Recompute rule-based score
    setImmediate(() => {
      recomputeLeadRuleScore(lead.id).catch((err: unknown) =>
        logger.warn(`[CRM] Rule scoring failed for lead ${lead.id}`, { error: err }),
      );
    });
  });

  updateLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmLead.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Lead not found', 404);
    const { followUpDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null;
    const lead = await prisma.crmLead.update({ where: { id: req.params.id as string }, data, include: { owner: { select: userSelect } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmLead', resourceId: lead.id, oldValues: existing as any, newValues: req.body } });
    trackFieldChanges('LEAD', lead.id, existing as any, req.body, req.user!.id).catch(() => {});
    // Emit workflow event if status changed
    if (rest.status && rest.status !== existing.status) {
      const { emitWorkflowEvent } = await import('../services/crm-workflow.service');
      emitWorkflowEvent('lead.status.changed', 'LEAD', lead.id, { ...lead, previousStatus: existing.status });
    }
    res.json({ status: 'success', data: { lead } });
    broadcast('crm_update', { type: 'lead.updated', entityType: 'lead', id: lead.id, changedBy: req.user!.id });
    // Recompute rule-based score on update
    setImmediate(() => {
      recomputeLeadRuleScore(lead.id).catch((err: unknown) =>
        logger.warn(`[CRM] Rule scoring failed for lead ${lead.id}`, { error: err }),
      );
    });
  });

  convertLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const opportunity = await crmService.convertLead(req.params.id as string, req.body, req.user!.id);
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CONVERT', resourceType: 'CrmLead', resourceId: req.params.id as string, newValues: { opportunityId: opportunity.id } } });
    res.json({ status: 'success', data: { opportunity } });
  });

  deleteLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmLead.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Lead not found', 404);
    await prisma.crmLead.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmLead', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Lead deleted' });
    broadcast('crm_update', { type: 'lead.deleted', entityType: 'lead', id: req.params.id as string, changedBy: req.user!.id });
  });

  // ======== OPPORTUNITIES ========
  listOpportunities = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';
    const search = req.query.search as string | undefined;
    const pipelineId = req.query.pipelineId as string | undefined;
    const stageId = req.query.stageId as string | undefined;
    const ownerId = req.query.ownerId as string | undefined;
    const accountId = req.query.accountId as string | undefined;
    const overdue = req.query.overdue === 'true';
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = { deletedAt: null };
    // Team-scoped RBAC: admins see all, managers see own+team, reps see only own
    const visibleOwnerIds = await resolveVisibleOwnerIds(req.user!);
    Object.assign(where, applyOwnerScope({}, visibleOwnerIds));
    if (visibleOwnerIds === null && ownerId) where.ownerId = ownerId; // admin may filter to one owner
    if (pipelineId) where.pipelineId = pipelineId;
    if (stageId) where.stageId = stageId;
    if (accountId) where.accountId = accountId;
    if (overdue) {
      where.expectedCloseDate = { lt: new Date() };
      where.wonAt = null;
      where.lostAt = null;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [opportunities, total] = await Promise.all([
      prisma.crmOpportunity.findMany({
        where, skip: (pageNum - 1) * limitNum, take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          stage: true, pipeline: { select: { id: true, name: true } },
          owner: { select: userSelect },
        },
      }),
      prisma.crmOpportunity.count({ where }),
    ]);
    res.json({ status: 'success', data: { opportunities, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  });

  getOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const opportunity = await prisma.crmOpportunity.findUnique({
      where: { id: req.params.id as string },
      include: {
        account: { select: { id: true, name: true, industry: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        stage: true, pipeline: { include: { stages: { orderBy: { displayOrder: 'asc' } } } },
        owner: { select: userSelect },
        activities: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 15 },
        notes: { include: { author: { select: userSelect } }, orderBy: { isPinned: 'desc' }, take: 20 },
        stageHistory: {
          orderBy: { movedAt: 'asc' },
          select: {
            id: true,
            fromStageName: true,
            toStageName: true,
            movedByUserId: true,
            movedAt: true,
          },
        },
      },
    });
    if (!opportunity) throw new AppError('Opportunity not found', 404);
    res.json({ status: 'success', data: { opportunity } });
  });

  createOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { expectedCloseDate, ...rest } = req.body;
    // Auto-set probability from the selected stage if not explicitly provided
    let probability = req.body.probability;
    if (probability === undefined && rest.stageId) {
      const stage = await prisma.crmPipelineStage.findUnique({ where: { id: rest.stageId } });
      if (stage) probability = stage.probability;
    }
    const opportunity = await prisma.crmOpportunity.create({
      data: { ...rest, ownerId: req.user!.id, probability, expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined },
      include: { account: { select: { id: true, name: true } }, stage: true, owner: { select: userSelect } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmOpportunity', resourceId: opportunity.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { opportunity } });
    broadcast('crm_update', { type: 'opportunity.created', entityType: 'opportunity', id: opportunity.id, changedBy: req.user!.id });
  });

  updateOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Opportunity not found', 404);
    const { expectedCloseDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    const opportunity = await prisma.crmOpportunity.update({ where: { id: req.params.id as string }, data, include: { stage: true, owner: { select: userSelect } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmOpportunity', resourceId: opportunity.id, oldValues: existing as any, newValues: req.body } });
    trackFieldChanges('OPPORTUNITY', opportunity.id, existing as any, req.body, req.user!.id).catch(() => {});
    // Emit workflow event if stage changed
    if (rest.stageId && rest.stageId !== existing.stageId) {
      const { emitWorkflowEvent } = await import('../services/crm-workflow.service');
      emitWorkflowEvent('opportunity.stage.changed', 'OPPORTUNITY', opportunity.id, { ...opportunity, previousStageId: existing.stageId });
    }
    res.json({ status: 'success', data: { opportunity } });
    broadcast('crm_update', { type: 'opportunity.updated', entityType: 'opportunity', id: opportunity.id, changedBy: req.user!.id });
  });

  moveStage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
    try {
      const opportunity = await crmService.moveOpportunityStage(req.params.id as string, req.body.stageId, req.user!.id, req.body.lostReason);
      await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmOpportunity', resourceId: req.params.id as string, oldValues: existing ? { stageId: (existing as any).stageId } as any : undefined, newValues: { stageId: req.body.stageId } } });
      res.json({ status: 'success', data: { opportunity } });
      broadcast('crm_update', { type: 'opportunity.stage_moved', entityType: 'opportunity', id: req.params.id as string, changedBy: req.user!.id });

      // Fire-and-forget AI win probability after stage move
      const oppId = req.params.id as string;
      setImmediate(() => {
        predictWinProbability(oppId).catch((err: unknown) =>
          logger.warn(`[CRM] Background win probability scoring failed for ${oppId}`, { error: err }),
        );
      });
    } catch (err: any) {
      if (err.gateFailed) {
        return res.status(err.needsApproval ? 403 : 422).json({
          status: 'error',
          error: err.message,
          needsApproval: !!err.needsApproval,
        });
      }
      throw err;
    }
  });

  deleteOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Opportunity not found', 404);
    await prisma.crmOpportunity.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmOpportunity', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Opportunity deleted' });
    broadcast('crm_update', { type: 'opportunity.deleted', entityType: 'opportunity', id: req.params.id as string, changedBy: req.user!.id });
  });

  // ======== PIPELINES ========
  listPipelines = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const pipelines = await prisma.crmPipeline.findMany({
      where: { isActive: true },
      include: { stages: { orderBy: { displayOrder: 'asc' } }, _count: { select: { opportunities: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ status: 'success', data: { pipelines } });
  });

  getPipeline = asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await crmService.getPipelineStats(req.params.id as string);
    const pipeline = await prisma.crmPipeline.findUnique({ where: { id: req.params.id as string } });
    if (!pipeline) throw new AppError('Pipeline not found', 404);
    res.json({ status: 'success', data: { pipeline, ...stats } });
  });

  createPipeline = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { stages, ...pipelineData } = req.body;
    const pipeline = await prisma.crmPipeline.create({
      data: { ...pipelineData, stages: { create: stages } },
      include: { stages: { orderBy: { displayOrder: 'asc' } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmPipeline', resourceId: pipeline.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { pipeline } });
  });

  updatePipeline = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmPipeline.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Pipeline not found', 404);
    const pipeline = await prisma.crmPipeline.update({ where: { id: req.params.id as string }, data: req.body });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmPipeline', resourceId: pipeline.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { pipeline } });
  });

  // ======== ACTIVITIES ========
  listActivities = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';
    const activityType = req.query.activityType as string | undefined;
    const accountId = req.query.accountId as string | undefined;
    const contactId = req.query.contactId as string | undefined;
    const leadId = req.query.leadId as string | undefined;
    const opportunityId = req.query.opportunityId as string | undefined;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = {};
    if (activityType) where.activityType = activityType;
    if (accountId) where.accountId = accountId;
    if (contactId) where.contactId = contactId;
    if (leadId) where.leadId = leadId;
    if (opportunityId) where.opportunityId = opportunityId;
    const [activities, total] = await Promise.all([
      prisma.crmActivity.findMany({
        where, skip: (pageNum - 1) * limitNum, take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: userSelect },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          opportunity: { select: { id: true, name: true } },
        },
      }),
      prisma.crmActivity.count({ where }),
    ]);
    res.json({ status: 'success', data: { activities, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  });

  createActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { scheduledAt, completedAt, ...rest } = req.body;
    const activity = await prisma.crmActivity.create({
      data: {
        ...rest, userId: req.user!.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
      },
      include: { user: { select: userSelect }, account: { select: { id: true, name: true } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmActivity', resourceId: activity.id, newValues: req.body } });
    // Emit workflow event for activity creation
    const { emitWorkflowEvent } = await import('../services/crm-workflow.service');
    emitWorkflowEvent('activity.created', 'ACTIVITY', activity.id, { ...activity });
    res.status(201).json({ status: 'success', data: { activity } });
    broadcast('crm_update', { type: 'activity.created', entityType: 'activity', id: activity.id, changedBy: req.user!.id });
  });

  updateActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmActivity.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Activity not found', 404);
    const { scheduledAt, completedAt, ...rest } = req.body;
    const data: any = { ...rest };
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (completedAt !== undefined) data.completedAt = completedAt ? new Date(completedAt) : null;
    const activity = await prisma.crmActivity.update({ where: { id: req.params.id as string }, data });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmActivity', resourceId: activity.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { activity } });
    broadcast('crm_update', { type: 'activity.updated', entityType: 'activity', id: activity.id, changedBy: req.user!.id });
  });

  deleteActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmActivity.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmActivity', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Activity deleted' });
    broadcast('crm_update', { type: 'activity.deleted', entityType: 'activity', id: req.params.id as string, changedBy: req.user!.id });
  });

  remindActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const activityId = req.params.id as string;
    const activity = await prisma.crmActivity.findUnique({
      where: { id: activityId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!activity) throw new AppError('Activity not found', 404);
    if (activity.reminderSent) {
      res.json({ status: 'success', data: { activity } });
      return;
    }

    // Mark reminder as sent
    const updated = await prisma.crmActivity.update({
      where: { id: activityId },
      data: { reminderSent: true },
    });

    // Build variables for notification
    const scheduledLabel = activity.scheduledAt
      ? new Date(activity.scheduledAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

    // Send in-app notification to the activity's assigned user (or current user)
    const targetUserId = activity.userId || req.user!.id;
    await notify({
      userId: targetUserId,
      eventType: 'crm_activity_reminder',
      variables: {
        activityType: activity.activityType,
        subject: activity.subject || '(no subject)',
        scheduledAt: scheduledLabel,
        remindedBy: `${req.user!.firstName} ${req.user!.lastName}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        userEmail: req.user!.email,
        action: 'REMIND',
        resourceType: 'CrmActivity',
        resourceId: activityId,
      },
    });

    res.json({ status: 'success', data: { activity: updated } });
  });

  // ======== NOTES ========
  listNotes = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const accountId = req.query.accountId as string | undefined;
    const contactId = req.query.contactId as string | undefined;
    const leadId = req.query.leadId as string | undefined;
    const opportunityId = req.query.opportunityId as string | undefined;

    const where: any = {};
    if (accountId) where.accountId = accountId;
    if (contactId) where.contactId = contactId;
    if (leadId) where.leadId = leadId;
    if (opportunityId) where.opportunityId = opportunityId;

    const [notes, total] = await Promise.all([
      prisma.crmNote.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: userSelect } },
      }),
      prisma.crmNote.count({ where }),
    ]);

    res.json({ status: 'success', data: { notes, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  });

  createNote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const note = await prisma.crmNote.create({
      data: { ...req.body, authorId: req.user!.id },
      include: { author: { select: userSelect } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmNote', resourceId: note.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { note } });
    broadcast('crm_update', { type: 'note.created', entityType: 'note', id: note.id, changedBy: req.user!.id });
  });

  updateNote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmNote.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Note not found', 404);
    if (existing.authorId !== req.user!.id) throw new AppError('You can only edit your own notes', 403);
    const note = await prisma.crmNote.update({ where: { id: req.params.id as string }, data: req.body });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmNote', resourceId: note.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { note } });
    broadcast('crm_update', { type: 'note.updated', entityType: 'note', id: note.id, changedBy: req.user!.id });
  });

  deleteNote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmNote.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Note not found', 404);
    if (existing.authorId !== req.user!.id) throw new AppError('You can only delete your own notes', 403);
    await prisma.crmNote.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmNote', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Note deleted' });
    broadcast('crm_update', { type: 'note.deleted', entityType: 'note', id: req.params.id as string, changedBy: req.user!.id });
  });

  // ======== TEAM PERFORMANCE ========
  getTeamPerformance = asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Get only users with CRM-specific roles (SALES_MANAGER or SALES_REP), excluding IT/HR/Finance agents
    const usersWithRoles = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: { in: ['SALES_MANAGER', 'SALES_REP'] } } } } },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });

    const agentIds = usersWithRoles.map(u => u.id);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count per agent
    const [leadCounts, dealCounts, pipelineValues, wonThisMonthResults, staleLeadCounts] = await Promise.all([
      // Open leads per agent
      prisma.crmLead.groupBy({ by: ['ownerId'], _count: true, where: { ownerId: { in: agentIds }, status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null } }),
      // Open deals per agent
      prisma.crmOpportunity.groupBy({ by: ['ownerId'], _count: true, where: { ownerId: { in: agentIds }, wonAt: null, lostAt: null, deletedAt: null } }),
      // Pipeline value per agent
      prisma.crmOpportunity.groupBy({ by: ['ownerId'], _sum: { value: true }, where: { ownerId: { in: agentIds }, wonAt: null, lostAt: null, deletedAt: null } }),
      // Won this month per agent
      prisma.crmOpportunity.groupBy({ by: ['ownerId'], _count: true, _sum: { value: true }, where: { ownerId: { in: agentIds }, wonAt: { gte: monthStart }, deletedAt: null } }),
      // Stale leads per agent
      prisma.crmLead.groupBy({ by: ['ownerId'], _count: true, where: { ownerId: { in: agentIds }, status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, activities: { none: { createdAt: { gte: sevenDaysAgo } } } } }),
    ]);

    const leadsMap = new Map(leadCounts.map(r => [r.ownerId, r._count]));
    const dealsMap = new Map(dealCounts.map(r => [r.ownerId, r._count]));
    const pipelineMap = new Map(pipelineValues.map(r => [r.ownerId, Number(r._sum.value || 0)]));
    const wonMap = new Map(wonThisMonthResults.map(r => [r.ownerId, { count: r._count, value: Number(r._sum.value || 0) }]));
    const staleMap = new Map(staleLeadCounts.map(r => [r.ownerId, r._count]));

    const teamStats = usersWithRoles.map(agent => ({
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      email: agent.email,
      avatarUrl: agent.avatarUrl,
      leads: leadsMap.get(agent.id) || 0,
      openDeals: dealsMap.get(agent.id) || 0,
      pipelineValue: pipelineMap.get(agent.id) || 0,
      wonThisMonth: wonMap.get(agent.id) || { count: 0, value: 0 },
      staleLeads: staleMap.get(agent.id) || 0,
    }));

    res.json({ status: 'success', data: { agents: teamStats } });
  });

  // ======== MY STATS (Self-Service Rep Stats) ========
  getMyStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(now.getTime() - now.getDay() * 86_400_000);

    const [leads, opportunities, pipelineValue, wonThisMonth, staleLeads, activitiesThisWeek] = await Promise.all([
      // Open leads owned by user
      prisma.crmLead.count({ where: { ownerId: userId, status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null } }),
      // Open opportunities owned by user
      prisma.crmOpportunity.count({ where: { ownerId: userId, wonAt: null, lostAt: null, deletedAt: null } }),
      // Pipeline value (sum of open deal values)
      prisma.crmOpportunity.aggregate({ _sum: { value: true }, where: { ownerId: userId, wonAt: null, lostAt: null, deletedAt: null } }),
      // Won this month count
      prisma.crmOpportunity.count({ where: { ownerId: userId, wonAt: { gte: monthStart }, deletedAt: null } }),
      // Stale leads (no activity in 7+ days)
      prisma.crmLead.count({ where: { ownerId: userId, status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, activities: { none: { createdAt: { gte: sevenDaysAgo } } } } }),
      // Activities this week
      prisma.crmActivity.count({ where: { userId, createdAt: { gte: weekStart } } }),
    ]);

    res.json({
      status: 'success',
      data: {
        leads,
        opportunities,
        pipelineValue: Number(pipelineValue._sum.value || 0),
        wonThisMonth,
        staleLeads,
        activitiesThisWeek,
      },
    });
  });

  // ======== TRUST PRODUCTS ========
  listTrustProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountId = req.query.accountId as string | undefined;
    const contactId = req.query.contactId as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const where: any = { status: { not: 'CLOSED' } };
    if (accountId) where.accountId = accountId;
    if (contactId) where.contactId = contactId;
    if (status) where.status = status;
    const [trustProducts, total] = await Promise.all([
      prisma.crmTrustProduct.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          opportunity: { select: { id: true, name: true } },
          owner: { select: userSelect },
        },
      }),
      prisma.crmTrustProduct.count({ where }),
    ]);
    res.json({ status: 'success', data: { trustProducts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  });

  getTrustProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const trustProduct = await prisma.crmTrustProduct.findUnique({
      where: { id: req.params.id as string },
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
        owner: { select: userSelect },
      },
    });
    if (!trustProduct) throw new AppError('Trust product not found', 404);
    res.json({ status: 'success', data: { trustProduct } });
  });

  createTrustProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { trustType, accountId, settlementDate, maturityDate, nextReviewDate, ...rest } = req.body;
    if (!trustType) throw new AppError('trustType is required', 400);
    if (!accountId) throw new AppError('accountId is required', 400);
    const account = await prisma.crmAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);
    const trustProduct = await prisma.crmTrustProduct.create({
      data: {
        ...rest,
        trustType,
        accountId,
        ownerId: req.user!.id,
        settlementDate: settlementDate ? new Date(settlementDate) : undefined,
        maturityDate: maturityDate ? new Date(maturityDate) : undefined,
        nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : undefined,
      },
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
        owner: { select: userSelect },
      },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmTrustProduct', resourceId: trustProduct.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { trustProduct } });
  });

  updateTrustProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmTrustProduct.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Trust product not found', 404);
    const { settlementDate, maturityDate, nextReviewDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (settlementDate !== undefined) data.settlementDate = settlementDate ? new Date(settlementDate) : null;
    if (maturityDate !== undefined) data.maturityDate = maturityDate ? new Date(maturityDate) : null;
    if (nextReviewDate !== undefined) data.nextReviewDate = nextReviewDate ? new Date(nextReviewDate) : null;
    const trustProduct = await prisma.crmTrustProduct.update({
      where: { id: req.params.id as string },
      data,
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
        owner: { select: userSelect },
      },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmTrustProduct', resourceId: trustProduct.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { trustProduct } });
  });

  deleteTrustProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmTrustProduct.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Trust product not found', 404);
    await prisma.crmTrustProduct.update({ where: { id: req.params.id as string }, data: { status: 'CLOSED' } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmTrustProduct', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Trust product closed' });
  });

  // ======== KYC ========
  getKycRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
    const contactId = req.params.contactId as string;
    const kycRecord = await prisma.crmKycRecord.findUnique({
      where: { contactId },
      include: { approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!kycRecord) throw new AppError('KYC record not found', 404);
    res.json({ status: 'success', data: { kycRecord } });
  });

  createOrUpdateKycRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
    const contactId = req.params.contactId as string;
    const contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new AppError('Contact not found', 404);
    const existing = await prisma.crmKycRecord.findUnique({ where: { contactId } });
    if (existing) {
      const kycRecord = await prisma.crmKycRecord.update({
        where: { contactId },
        data: req.body,
        include: { approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
      await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmKycRecord', resourceId: kycRecord.id, newValues: req.body } });
      res.json({ status: 'success', data: { kycRecord } });
    } else {
      const kycRecord = await prisma.crmKycRecord.create({
        data: { ...req.body, contactId },
      });
      await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmKycRecord', resourceId: kycRecord.id, newValues: req.body } });
      res.status(201).json({ status: 'success', data: { kycRecord } });
    }
  });

  approveKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
    const contactId = req.params.contactId as string;
    const existing = await prisma.crmKycRecord.findUnique({ where: { contactId } });
    if (!existing) throw new AppError('KYC record not found', 404);
    const now = new Date();
    const expiresAt = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    const kycRecord = await prisma.crmKycRecord.update({
      where: { contactId },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedBy: req.user!.id,
        expiresAt,
      },
      include: { approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'APPROVE', resourceType: 'CrmKycRecord', resourceId: kycRecord.id, newValues: { status: 'APPROVED', approvedAt: now, expiresAt } } });
    res.json({ status: 'success', data: { kycRecord } });
  });

  // ======== BENEFICIARIES ========
  listBeneficiaries = asyncHandler(async (req: AuthRequest, res: Response) => {
    const contactId = req.params.contactId as string;
    const beneficiaries = await prisma.crmBeneficiary.findMany({
      where: { contactId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ status: 'success', data: { beneficiaries } });
  });

  createBeneficiary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const contactId = req.params.contactId as string;
    const contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new AppError('Contact not found', 404);
    // Validate allocation sum does not exceed 100%
    const existingBeneficiaries = await prisma.crmBeneficiary.findMany({ where: { contactId } });
    const existingTotal = existingBeneficiaries.reduce((sum, b) => sum + Number(b.allocationPct || 0), 0);
    const newAllocation = req.body.allocationPct || 0;
    if (existingTotal + newAllocation > 100) {
      throw new AppError(`Total allocation would exceed 100% (current: ${existingTotal}%, adding: ${newAllocation}%)`, 400);
    }
    const beneficiary = await prisma.crmBeneficiary.create({
      data: { ...req.body, contactId },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmBeneficiary', resourceId: beneficiary.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { beneficiary } });
  });

  updateBeneficiary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmBeneficiary.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Beneficiary not found', 404);
    // Validate allocation sum if allocationPct is being updated
    if (req.body.allocationPct !== undefined) {
      const siblings = await prisma.crmBeneficiary.findMany({
        where: { contactId: existing.contactId, id: { not: existing.id } },
      });
      const otherTotal = siblings.reduce((sum, b) => sum + Number(b.allocationPct || 0), 0);
      if (otherTotal + req.body.allocationPct > 100) {
        throw new AppError(`Total allocation would exceed 100% (others: ${otherTotal}%, this: ${req.body.allocationPct}%)`, 400);
      }
    }
    const beneficiary = await prisma.crmBeneficiary.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmBeneficiary', resourceId: beneficiary.id, newValues: req.body } });
    res.json({ status: 'success', data: { beneficiary } });
  });

  deleteBeneficiary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmBeneficiary.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Beneficiary not found', 404);
    await prisma.crmBeneficiary.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmBeneficiary', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Beneficiary deleted' });
  });

  // ======== REPORTS ========
  getLeadConversionReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const ownerId = req.query.ownerId as string | undefined;
    const report = await crmReportsService.getLeadConversionReport(from, to, ownerId);
    respondOrCsv(res, report, 'lead-conversion.csv',
      ['period', 'leads', 'converted', 'conversionRate'], d => d.periods ?? d,
      req.query.format as string);
  });

  getSalesPerformanceReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const pipelineId = req.query.pipelineId as string | undefined;
    const report = await crmReportsService.getSalesPerformanceReport(from, to, pipelineId);
    respondOrCsv(res, report, 'sales-performance.csv',
      ['repId', 'repName', 'leadsCreated', 'opportunitiesCreated', 'wonDeals', 'wonValue', 'totalPipelineValue'], d => d.reps ?? d,
      req.query.format as string);
  });

  getPipelineForecastReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const pipelineId = req.query.pipelineId as string;
    if (!pipelineId) throw new AppError('pipelineId query parameter is required', 400);
    const report = await crmReportsService.getPipelineForecastReport(pipelineId);
    respondOrCsv(res, report, 'pipeline-forecast.csv',
      ['stageId', 'stageName', 'probability', 'dealCount', 'totalValue', 'weightedValue'], d => d.stages ?? d,
      req.query.format as string);
  });

  getActivitySummaryReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const userId = req.query.userId as string | undefined;
    const report = await crmReportsService.getActivitySummaryReport(from, to, userId);
    respondOrCsv(res, report, 'activity-summary.csv',
      ['date', 'calls', 'emails', 'meetings', 'notes'], d => d.daily ?? d,
      req.query.format as string);
  });

  getLeadAgingReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const ownerId = req.query.ownerId as string | undefined;
    const report = await crmReportsService.getLeadAgingReport(ownerId);
    respondOrCsv(res, report, 'lead-aging.csv',
      ['bucket', 'count', 'avgDays', 'totalValue'], d => d.buckets ?? d,
      (req.query.format as string));
  });

  getWinLossReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const ownerId = req.query.ownerId as string | undefined;
    const report = await crmReportsService.getWinLossReport(from, to, ownerId);
    respondOrCsv(res, report, 'win-loss.csv',
      ['reason', 'count', 'totalValue'], d => d.reasons ?? d,
      req.query.format as string);
  });

  getKycComplianceReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const report = await crmReportsService.getKycComplianceReport();
    respondOrCsv(res, report, 'kyc-compliance.csv',
      ['accountId', 'accountName', 'kycStatus', 'lastReviewDate'], d => d.accounts ?? d,
      req.query.format as string);
  });

  getForecastCategoriesReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const pipelineId = req.query.pipelineId as string;
    if (!pipelineId) {
      res.status(400).json({ status: 'error', message: 'pipelineId query parameter is required' });
      return;
    }
    const report = await crmForecastService.getPipelineForecastWithCategories(pipelineId);
    respondOrCsv(res, report, 'forecast-categories.csv',
      ['stageId', 'stageName', 'probability', 'dealCount', 'totalValue', 'weightedValue'], d => d.stages ?? d,
      req.query.format as string);
  });

  getForecastAccuracyReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const report = await crmForecastService.getForecastAccuracyReport({ from, to });
    respondOrCsv(res, report, 'forecast-accuracy.csv',
      [{ key: 'commitTotal', label: 'Committed Forecast' }, { key: 'actualWonTotal', label: 'Actual Won Revenue' }, { key: 'accuracyPct', label: 'Accuracy %' }],
      d => [d],
      req.query.format as string);
  });

  // ======== GLOBAL SEARCH ========
  globalSearch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = (req.query.q as string | undefined)?.trim() ?? '';
    if (!q || q.length < 2) {
      res.json({ success: true, data: { accounts: [], contacts: [], leads: [], opportunities: [] } });
      return;
    }

    const [accounts, contacts, leads, opportunities] = await Promise.all([
      prisma.crmAccount.findMany({
        where: { name: { contains: q, mode: 'insensitive' }, deletedAt: null },
        select: { id: true, name: true, industry: true, isActive: true },
        take: 5,
      }),
      prisma.crmContact.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true, account: { select: { id: true, name: true } } },
        take: 5,
      }),
      prisma.crmLead.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { contactName: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, status: true, companyName: true },
        take: 5,
      }),
      prisma.crmOpportunity.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { account: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: { id: true, name: true, value: true, account: { select: { id: true, name: true } }, stage: { select: { name: true, color: true } } },
        take: 5,
      }),
    ]);

    res.json({ success: true, data: { accounts, contacts, leads, opportunities } });
  });

  // ======== CRM USERS (for owner dropdown) ========
  listCrmUsers = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              name: { in: ['CRM_USER', 'CRM_ADMIN', 'SALES_MANAGER', 'SALES_REP', 'ADMIN'] },
            },
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      orderBy: { firstName: 'asc' },
    });
    res.json({ status: 'success', data: { users } });
  });

  /** CRM-scoped audit trail — returns audit logs for a specific CRM entity */
  getEntityAuditTrail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Map frontend entity type to audit resourceType
    const resourceTypeMap: Record<string, string> = {
      account: 'CrmAccount',
      contact: 'CrmContact',
      lead: 'CrmLead',
      opportunity: 'CrmOpportunity',
    };
    const resourceType = resourceTypeMap[entityType];
    if (!resourceType) {
      return res.status(400).json({ status: 'error', message: `Invalid entity type: ${entityType}. Valid: account, contact, lead, opportunity` });
    }

    const where = { resourceType, resourceId: entityId };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // ======== IMPORT ========
  uploadImportFile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entity } = req.body;
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    if (!entity || !['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY'].includes(entity.toUpperCase())) {
      return res.status(400).json({ status: 'error', message: 'Invalid entity type' });
    }
    const result = await importExportService.uploadAndParseFile(file, entity.toUpperCase(), req.user!.id);
    res.json({ status: 'success', data: result });
  });

  getFieldDefinitions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entity } = req.query;
    if (!entity || !['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY'].includes(String(entity).toUpperCase())) {
      return res.status(400).json({ status: 'error', message: 'Invalid entity type' });
    }
    const fields = importExportService.getFieldDefinitions(String(entity).toUpperCase());
    res.json({ status: 'success', data: { fields } });
  });

  downloadImportTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entity, format } = req.query;
    const entityUpper = String(entity || 'LEAD').toUpperCase();
    if (!['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY'].includes(entityUpper)) {
      return res.status(400).json({ status: 'error', message: 'Invalid entity type' });
    }
    const fields = importExportService.getFieldDefinitions(entityUpper);
    const labels = fields.map((f: { label: string }) => f.label);
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([labels]);
    // Set column widths
    ws['!cols'] = fields.map((f: { label: string; type: string }) => ({ wch: Math.max(f.label.length + 4, 15) }));
    XLSX.utils.book_append_sheet(wb, ws, entityUpper);
    const fmt = String(format || 'csv').toLowerCase();
    if (fmt === 'xlsx') {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${entityUpper}_template.xlsx"`);
      res.send(buf);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entityUpper}_template.csv"`);
      res.send(csv);
    }
  });

  validateImportMapping = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { columnMapping } = req.body;
    const result = await importExportService.validateImportMapping(id, columnMapping, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  executeImport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await importExportService.executeImport(id, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  getImportStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await importExportService.getImportStatus(id, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  getImportHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await importExportService.getImportHistory(req.user!.id, page, limit);
    res.json({ status: 'success', data: result });
  });

  // ======== EXPORT ========
  requestExport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entity, filters, format } = req.body;
    const result = await importExportService.requestExport(entity, filters || null, format || 'CSV', req.user!.id);
    res.json({ status: 'success', data: result });
  });

  downloadExport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { filePath, fileName } = await importExportService.getExportDownload(id, req.user!.id);
    res.download(filePath, fileName);
  });

  getExportHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await importExportService.getExportHistory(req.user!.id, page, limit);
    res.json({ status: 'success', data: result });
  });

  // ======== TERRITORIES ========
  listTerritories = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await territoryService.listTerritories(page, limit);
    res.json({ status: 'success', data: result });
  });

  getTerritory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await territoryService.getTerritory(id);
    res.json({ status: 'success', data: result });
  });

  createTerritory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await territoryService.createTerritory(req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: result });
  });

  updateTerritory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await territoryService.updateTerritory(id, req.body);
    res.json({ status: 'success', data: result });
  });

  deleteTerritory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await territoryService.deleteTerritory(id);
    res.json({ status: 'success', data: result });
  });

  addTerritoryMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const territoryId = String(req.params.id);
    const { userId, role } = req.body;
    const result = await territoryService.addTerritoryMember(territoryId, userId, role);
    res.status(201).json({ status: 'success', data: result });
  });

  removeTerritoryMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const territoryId = String(req.params.id);
    const userId = String(req.params.userId);
    const result = await territoryService.removeTerritoryMember(territoryId, userId);
    res.json({ status: 'success', data: result });
  });

  updateTerritoryMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const territoryId = String(req.params.id);
    const userId = String(req.params.userId);
    const { role } = req.body;
    const result = await territoryService.updateTerritoryMember(territoryId, userId, role);
    res.json({ status: 'success', data: result });
  });

  lookupTerritory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const state = req.query.state as string | undefined;
    const country = req.query.country as string | undefined;
    const result = await territoryService.lookupTerritory(state, country);
    res.json({ status: 'success', data: result });
  });

  // ======== QUOTAS ========
  listQuotas = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filters: Record<string, string> = {};
    if (req.query.period) filters.period = req.query.period as string;
    if (req.query.userId) filters.userId = req.query.userId as string;
    if (req.query.territoryId) filters.territoryId = req.query.territoryId as string;
    const result = await territoryService.listQuotas(filters, page, limit);
    res.json({ status: 'success', data: result });
  });

  getQuota = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await territoryService.getQuota(id);
    res.json({ status: 'success', data: result });
  });

  createQuota = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await territoryService.createQuota(req.body);
    res.status(201).json({ status: 'success', data: result });
  });

  updateQuota = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await territoryService.updateQuota(id, req.body);
    res.json({ status: 'success', data: result });
  });

  deleteQuota = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await territoryService.deleteQuota(id);
    res.json({ status: 'success', data: result });
  });

  getQuotaAttainment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const period = req.query.period as string;
    const userId = req.query.userId as string | undefined;
    const territoryId = req.query.territoryId as string | undefined;
    const result = await territoryService.getQuotaAttainment(period, userId, territoryId);
    res.json({ status: 'success', data: result });
  });

  getQuotaDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const period = req.query.period as string;
    const result = await territoryService.getQuotaDashboard(period);
    res.json({ status: 'success', data: result });
  });

  // ======== DASHBOARD LAYOUT ========
  getWidgetRegistry = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const registry = dashboardLayoutService.getWidgetRegistry();
    res.json({ status: 'success', data: registry });
  });

  getDashboardLayout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const role = (req.user as any).role || 'AGENT';
    const result = await dashboardLayoutService.getDashboardLayout(userId, role);
    res.json({ status: 'success', data: result });
  });

  saveDashboardLayout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { layout } = req.body;
    if (!Array.isArray(layout)) throw new AppError('Layout must be an array', 400);
    const result = await dashboardLayoutService.saveDashboardLayout(userId, layout);
    res.json({ status: 'success', data: result });
  });

  resetDashboardLayout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const role = (req.user as any).role || 'AGENT';
    const defaultLayout = dashboardLayoutService.getDefaultLayout(role);
    await dashboardLayoutService.resetDashboardLayout(userId);
    res.json({ status: 'success', data: { layout: defaultLayout, isDefault: true } });
  });

  // ── Workflow Automation ──────────────────────────────────────────────────
  listWorkflows = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await workflowService.listWorkflows(page, limit);
    res.json({ status: 'success', data: result });
  });

  getWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await workflowService.getWorkflow(id);
    if (!result) throw new AppError('Workflow not found', 404);
    res.json({ status: 'success', data: result });
  });

  createWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const result = await workflowService.createWorkflow(req.body, userId);
    res.status(201).json({ status: 'success', data: result });
  });

  updateWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await workflowService.updateWorkflow(id, req.body);
    res.json({ status: 'success', data: result });
  });

  deleteWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    await workflowService.deleteWorkflow(id);
    res.json({ status: 'success', data: { deleted: true } });
  });

  toggleWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await workflowService.toggleWorkflow(id);
    res.json({ status: 'success', data: result });
  });

  getWorkflowTemplates = asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ status: 'success', data: workflowService.WORKFLOW_TEMPLATES });
  });

  getWorkflowExecutions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const workflowId = String(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await workflowService.getWorkflowExecutions(workflowId, page, limit);
    res.json({ status: 'success', data: result });
  });

  getAllExecutions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await workflowService.getAllExecutions(page, limit);
    res.json({ status: 'success', data: result });
  });

  // ── Email/Calendar Integration ────────────────────────────────────────
  listIntegrations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await emailSyncService.listIntegrations(req.user!.id);
    res.json({ status: 'success', data: result });
  });

  getGoogleAuthUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
    const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64');
    const url = emailSyncService.getOAuthUrl('GOOGLE', state);
    res.json({ status: 'success', data: { url } });
  });

  getOutlookAuthUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
    const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64');
    const url = emailSyncService.getOAuthUrl('OUTLOOK', state);
    res.json({ status: 'success', data: { url } });
  });

  handleGoogleCallback = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code, state } = req.query;
    const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
    await emailSyncService.handleOAuthCallback('GOOGLE', code as string, decoded.userId);
    res.redirect('/crm/integrations?connected=google');
  });

  handleOutlookCallback = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code, state } = req.query;
    const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
    await emailSyncService.handleOAuthCallback('OUTLOOK', code as string, decoded.userId);
    res.redirect('/crm/integrations?connected=outlook');
  });

  disconnectIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
    await emailSyncService.disconnectIntegration(String(req.params.id), req.user!.id);
    res.json({ status: 'success', data: { disconnected: true } });
  });

  updateSyncPreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await emailSyncService.updateSyncPreferences(String(req.params.id), req.user!.id, req.body);
    res.json({ status: 'success', data: result });
  });

  triggerSync = asyncHandler(async (req: AuthRequest, res: Response) => {
    const emailResult = await emailSyncService.syncEmails(String(req.params.id));
    const calendarResult = await emailSyncService.syncCalendarEvents(String(req.params.id));
    res.json({ status: 'success', data: { emails: emailResult, events: calendarResult } });
  });

  listSyncedEmails = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await emailSyncService.listSyncedEmails(req.user!.id, {
      contactId: req.query.contactId as string,
      leadId: req.query.leadId as string,
      accountId: req.query.accountId as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json({ status: 'success', data: result });
  });

  getEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await emailSyncService.getEmail(String(req.params.id));
    if (!result) throw new AppError('Email not found', 404);
    res.json({ status: 'success', data: result });
  });

  sendEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await emailSyncService.sendEmailFromCrm(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: result });
  });

  listSyncedEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await emailSyncService.listSyncedEvents(req.user!.id, page, limit);
    res.json({ status: 'success', data: result });
  });

  // ── Anomaly Detection ────────────────────────────────────────
  getAnomalies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await anomalyService.detectAnomalies(req.user!.id);
    res.json({ status: 'success', data: { anomalies: result } });
  });

  getAnomalyConfig = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const configs = await anomalyService.getConfigs();
    res.json({ status: 'success', data: configs });
  });

  updateAnomalyConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
    const config = await anomalyService.updateConfig(String(req.params.id), req.body);
    res.json({ status: 'success', data: config });
  });

  refreshAnomalies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const anomalies = await anomalyService.detectAnomalies(req.user!.id);
    res.json({ status: 'success', data: { anomalies, refreshedAt: new Date().toISOString() } });
  });

  // ── Custom Fields ─────────────────────────────────────────────
  getCustomFieldDefinitions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const entity = req.query.entity as string | undefined;
    const definitions = entity
      ? await customFieldsService.getDefinitionsByEntity(entity as any)
      : await customFieldsService.getDefinitions();
    res.json({ status: 'success', data: definitions });
  });

  createCustomFieldDefinition = asyncHandler(async (req: AuthRequest, res: Response) => {
    const definition = await customFieldsService.createDefinition(req.body);
    res.status(201).json({ status: 'success', data: definition });
  });

  updateCustomFieldDefinition = asyncHandler(async (req: AuthRequest, res: Response) => {
    const definition = await customFieldsService.updateDefinition(String(req.params.id), req.body);
    res.json({ status: 'success', data: definition });
  });

  deleteCustomFieldDefinition = asyncHandler(async (req: AuthRequest, res: Response) => {
    const definition = await customFieldsService.deleteDefinition(String(req.params.id));
    res.json({ status: 'success', data: definition });
  });

  // ======== DUPLICATES ========
  listDuplicates = asyncHandler(async (req: AuthRequest, res: Response) => {
    const entityType = req.query.entityType as string | undefined;
    const status = req.query.status as string | undefined;
    const duplicates = await duplicateService.listDuplicates(entityType, status);
    res.json({ status: 'success', data: { duplicates } });
  });

  mergeDuplicates = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { masterEntityId, fieldSelections } = req.body;
    if (!masterEntityId) throw new AppError('masterEntityId is required', 400);
    await duplicateService.mergeDuplicates(req.params.id as string, masterEntityId, fieldSelections ?? {}, req.user!.id);
    broadcast('crm_update', { type: 'duplicate.merged', entityType: 'lead', id: req.params.id as string, changedBy: req.user!.id });
    res.json({ status: 'success', message: 'Records merged' });
  });

  dismissDuplicate = asyncHandler(async (req: AuthRequest, res: Response) => {
    await duplicateService.dismissDuplicate(req.params.id as string, req.user!.id);
    res.json({ status: 'success', message: 'Duplicate dismissed' });
  });

  // ======== LEAD SCORING RULES ========

  listScoringRules = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const rules = await prisma.crmLeadScoringRule.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ status: 'success', data: { rules } });
  });

  createScoringRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { field, operator, value, points, isActive } = req.body;
    const rule = await prisma.crmLeadScoringRule.create({
      data: { field, operator, value, points, isActive: isActive ?? true },
    });
    res.status(201).json({ status: 'success', data: { rule } });
  });

  updateScoringRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmLeadScoringRule.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Scoring rule not found', 404);
    const rule = await prisma.crmLeadScoringRule.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ status: 'success', data: { rule } });
  });

  deleteScoringRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmLeadScoringRule.delete({ where: { id: req.params.id as string } });
    res.json({ status: 'success', message: 'Scoring rule deleted' });
  });

  // Recompute all lead scores
  recomputeScores = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const { recomputeAllLeadScores } = await import('../services/crm-lead-scoring.service');
    const result = await recomputeAllLeadScores();
    res.json({ status: 'success', data: result });
  });

  // ======== ASSIGNMENT RULES ========

  listAssignmentRules = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const rules = await prisma.crmAssignmentRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { territory: { select: { id: true, name: true } } },
    });
    res.json({ status: 'success', data: rules });
  });

  createAssignmentRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const rule = await prisma.crmAssignmentRule.create({ data: req.body });
    res.status(201).json({ status: 'success', data: { rule } });
  });

  updateAssignmentRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const rule = await prisma.crmAssignmentRule.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ status: 'success', data: { rule } });
  });

  deleteAssignmentRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmAssignmentRule.delete({ where: { id: req.params.id as string } });
    res.json({ status: 'success', message: 'Assignment rule deleted' });
  });

  // ======== CONTACT-ACCOUNT ROLES (Multi-account contacts) ========

  addContactAccountRole = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { contactId, accountId, role } = req.body;
    const entry = await prisma.crmContactAccountRole.create({
      data: { contactId, accountId, role },
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, account: { select: { id: true, name: true } } },
    });
    res.status(201).json({ status: 'success', data: { role: entry } });
  });

  removeContactAccountRole = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmContactAccountRole.delete({ where: { id: req.params.id as string } });
    res.json({ status: 'success', message: 'Contact-account role removed' });
  });

  getContactAccountRoles = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { contactId, accountId } = req.query;
    const where: any = {};
    if (contactId) where.contactId = contactId as string;
    if (accountId) where.accountId = accountId as string;
    const roles = await prisma.crmContactAccountRole.findMany({
      where,
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, account: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: roles });
  });

  // ======== TAGS & TAG ASSIGNMENTS ========

  listTags = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const tags = await prisma.crmTag.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { assignments: true } } } });
    res.json({ status: 'success', data: tags });
  });

  createTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const tag = await prisma.crmTag.create({ data: req.body });
    res.status(201).json({ status: 'success', data: { tag } });
  });

  deleteTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmTag.delete({ where: { id: req.params.id as string } });
    res.json({ status: 'success', message: 'Tag deleted' });
  });

  assignTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { tagId, entityType, entityId } = req.body;
    const assignment = await prisma.crmTagAssignment.create({
      data: { tagId, entityType, entityId, assignedBy: req.user!.id },
      include: { tag: true },
    });
    res.status(201).json({ status: 'success', data: { assignment } });
  });

  removeTagAssignment = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmTagAssignment.delete({ where: { id: req.params.id as string } });
    res.json({ status: 'success', message: 'Tag assignment removed' });
  });

  getEntityTags = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.query;
    const assignments = await prisma.crmTagAssignment.findMany({
      where: { entityType: entityType as string, entityId: entityId as string },
      include: { tag: true },
      orderBy: { assignedAt: 'desc' },
    });
    res.json({ status: 'success', data: assignments });
  });

  // ======== FIELD-LEVEL CHANGE HISTORY ========

  getFieldChanges = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const changes = await prisma.crmFieldChange.findMany({
      where: {
        entityType: entityType as string,
        entityId: entityId as string,
      },
      orderBy: { changedAt: 'desc' },
      take: limit,
    });
    res.json({ status: 'success', data: changes });
  });
}

export const crmController = new CrmController();
