import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import crmService from '../services/crm.service';
import { autoAssignLead } from '../services/crm-automation.service';
import crmReportsService from '../services/crm-reports.service';

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
    // Ownership scoping: non-admin users only see their own records
    const isAdmin = req.user!.roles.includes('ADMIN') || req.user!.permissions.includes('crm:admin');
    if (!isAdmin) {
      where.ownerId = req.user!.id;
    } else if (ownerId) {
      where.ownerId = ownerId;
    }
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
      },
    });
    if (!account) throw new AppError('Account not found', 404);
    res.json({ status: 'success', data: { account: maskBankAccount(account) } });
  });

  createAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await prisma.crmAccount.create({
      data: { ...req.body, ownerId: req.user!.id },
      include: { owner: { select: userSelect } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmAccount', resourceId: account.id, newValues: { ...req.body, bankAccount: req.body.bankAccount ? '****' : undefined } } });
    res.status(201).json({ status: 'success', data: { account: maskBankAccount(account) } });
  });

  updateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmAccount.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Account not found', 404);
    const account = await prisma.crmAccount.update({ where: { id: req.params.id as string }, data: req.body, include: { owner: { select: userSelect } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmAccount', resourceId: account.id, oldValues: existing as any, newValues: { ...req.body, bankAccount: req.body.bankAccount ? '****' : undefined } } });
    res.json({ status: 'success', data: { account: maskBankAccount(account) } });
  });

  deleteAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmAccount.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Account not found', 404);
    await prisma.crmAccount.update({ where: { id: req.params.id as string }, data: { isActive: false, deletedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmAccount', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Account deactivated' });
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
    // Ownership scoping: non-admin users only see contacts in their own accounts
    const isAdmin = req.user!.roles.includes('ADMIN') || req.user!.permissions.includes('crm:admin');
    if (!isAdmin) {
      where.account = { ownerId: req.user!.id };
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
        activities: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
        notes: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!contact) throw new AppError('Contact not found', 404);
    res.json({ status: 'success', data: { contact } });
  });

  createContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await prisma.crmAccount.findUnique({ where: { id: req.body.accountId } });
    if (!account) throw new AppError('Account not found', 404);
    const { dateOfBirth, pdpaConsentDate, ...rest } = req.body;
    const contact = await prisma.crmContact.create({
      data: {
        ...rest,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        pdpaConsentDate: pdpaConsentDate ? new Date(pdpaConsentDate) : undefined,
      },
      include: { account: { select: { id: true, name: true } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmContact', resourceId: contact.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { contact } });
  });

  updateContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmContact.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Contact not found', 404);
    const { dateOfBirth, pdpaConsentDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (pdpaConsentDate !== undefined) data.pdpaConsentDate = pdpaConsentDate ? new Date(pdpaConsentDate) : null;
    const contact = await prisma.crmContact.update({ where: { id: req.params.id as string }, data, include: { account: { select: { id: true, name: true } } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmContact', resourceId: contact.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { contact } });
  });

  deleteContact = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmContact.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Contact not found', 404);
    await prisma.crmContact.update({ where: { id: req.params.id as string }, data: { isActive: false, deletedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmContact', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Contact deactivated' });
  });

  // ======== LEADS ========
  listLeads = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const ownerId = req.query.ownerId as string | undefined;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = { deletedAt: null };
    // Ownership scoping: non-admin users only see their own leads
    const isAdmin = req.user!.roles.includes('ADMIN') || req.user!.permissions.includes('crm:admin');
    if (!isAdmin) {
      where.ownerId = req.user!.id;
    } else if (ownerId) {
      where.ownerId = ownerId;
    }
    if (status) where.status = status;
    if (source) where.source = source;
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
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        activities: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
        notes: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!lead) throw new AppError('Lead not found', 404);
    res.json({ status: 'success', data: { lead } });
  });

  createLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const lead = await prisma.crmLead.create({
      data: { ...req.body, ownerId: req.user!.id },
      include: { owner: { select: userSelect }, account: { select: { id: true, name: true } } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmLead', resourceId: lead.id, newValues: req.body } });

    // Auto-assign via round-robin if requested (e.g. no explicit owner preference)
    if (req.body.autoAssign === true) {
      const assigned = await autoAssignLead(lead.id);
      if (assigned) {
        // Re-fetch lead with updated owner for response
        const refreshed = await prisma.crmLead.findUnique({
          where: { id: lead.id },
          include: { owner: { select: userSelect }, account: { select: { id: true, name: true } } },
        });
        return res.status(201).json({ status: 'success', data: { lead: refreshed } });
      }
    }

    res.status(201).json({ status: 'success', data: { lead } });
  });

  updateLead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmLead.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Lead not found', 404);
    const { followUpDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null;
    const lead = await prisma.crmLead.update({ where: { id: req.params.id as string }, data, include: { owner: { select: userSelect } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmLead', resourceId: lead.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { lead } });
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
    res.json({ status: 'success', message: 'Lead deleted' });
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
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const where: any = { deletedAt: null };
    // Ownership scoping: non-admin users only see their own opportunities
    const isAdmin = req.user!.roles.includes('ADMIN') || req.user!.permissions.includes('crm:admin');
    if (!isAdmin) {
      where.ownerId = req.user!.id;
    } else if (ownerId) {
      where.ownerId = ownerId;
    }
    if (pipelineId) where.pipelineId = pipelineId;
    if (stageId) where.stageId = stageId;
    if (accountId) where.accountId = accountId;
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
      },
    });
    if (!opportunity) throw new AppError('Opportunity not found', 404);
    res.json({ status: 'success', data: { opportunity } });
  });

  createOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { expectedCloseDate, ...rest } = req.body;
    const opportunity = await prisma.crmOpportunity.create({
      data: { ...rest, ownerId: req.user!.id, expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined },
      include: { account: { select: { id: true, name: true } }, stage: true, owner: { select: userSelect } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmOpportunity', resourceId: opportunity.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { opportunity } });
  });

  updateOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Opportunity not found', 404);
    const { expectedCloseDate, ...rest } = req.body;
    const data: any = { ...rest };
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    const opportunity = await prisma.crmOpportunity.update({ where: { id: req.params.id as string }, data, include: { stage: true, owner: { select: userSelect } } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmOpportunity', resourceId: opportunity.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { opportunity } });
  });

  moveStage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
    const opportunity = await crmService.moveOpportunityStage(req.params.id as string, req.body.stageId, req.user!.id, req.body.lostReason);
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmOpportunity', resourceId: req.params.id as string, oldValues: existing ? { stageId: (existing as any).stageId } as any : undefined, newValues: { stageId: req.body.stageId } } });
    res.json({ status: 'success', data: { opportunity } });
  });

  deleteOpportunity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Opportunity not found', 404);
    await prisma.crmOpportunity.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
    res.json({ status: 'success', message: 'Opportunity deleted' });
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
    res.status(201).json({ status: 'success', data: { activity } });
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
  });

  deleteActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.crmActivity.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmActivity', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Activity deleted' });
  });

  // ======== NOTES ========
  createNote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const note = await prisma.crmNote.create({
      data: { ...req.body, authorId: req.user!.id },
      include: { author: { select: userSelect } },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'CREATE', resourceType: 'CrmNote', resourceId: note.id, newValues: req.body } });
    res.status(201).json({ status: 'success', data: { note } });
  });

  updateNote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmNote.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Note not found', 404);
    if (existing.authorId !== req.user!.id) throw new AppError('You can only edit your own notes', 403);
    const note = await prisma.crmNote.update({ where: { id: req.params.id as string }, data: req.body });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmNote', resourceId: note.id, oldValues: existing as any, newValues: req.body } });
    res.json({ status: 'success', data: { note } });
  });

  deleteNote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.crmNote.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError('Note not found', 404);
    if (existing.authorId !== req.user!.id) throw new AppError('You can only delete your own notes', 403);
    await prisma.crmNote.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'DELETE', resourceType: 'CrmNote', resourceId: req.params.id as string } });
    res.json({ status: 'success', message: 'Note deleted' });
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
    res.json({ status: 'success', data: report });
  });

  getSalesPerformanceReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const pipelineId = req.query.pipelineId as string | undefined;
    const report = await crmReportsService.getSalesPerformanceReport(from, to, pipelineId);
    res.json({ status: 'success', data: report });
  });

  getPipelineForecastReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const pipelineId = req.query.pipelineId as string;
    if (!pipelineId) throw new AppError('pipelineId query parameter is required', 400);
    const report = await crmReportsService.getPipelineForecastReport(pipelineId);
    res.json({ status: 'success', data: report });
  });

  getActivitySummaryReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const userId = req.query.userId as string | undefined;
    const report = await crmReportsService.getActivitySummaryReport(from, to, userId);
    res.json({ status: 'success', data: report });
  });

  getLeadAgingReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const ownerId = req.query.ownerId as string | undefined;
    const report = await crmReportsService.getLeadAgingReport(ownerId);
    res.json({ status: 'success', data: report });
  });

  getWinLossReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const ownerId = req.query.ownerId as string | undefined;
    const report = await crmReportsService.getWinLossReport(from, to, ownerId);
    res.json({ status: 'success', data: report });
  });

  getKycComplianceReport = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const report = await crmReportsService.getKycComplianceReport();
    res.json({ status: 'success', data: report });
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
}

export const crmController = new CrmController();
