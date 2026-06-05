import api from './api';
import { AuditLogEntry } from './auditLog.service';

// ── CRM Types ───────────────────────────────────────────────────

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED' | 'LOST';
export type LeadSource = 'WEBSITE' | 'REFERRAL' | 'COLD_CALL' | 'TRADE_SHOW' | 'LINKEDIN' | 'ADVERTISEMENT' | 'PARTNER' | 'OTHER';
export type OpportunityStage = 'PROSPECTING' | 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type CrmActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK' | 'FOLLOW_UP' | 'WHATSAPP' | 'SITE_VISIT';

export interface UserRef { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null; }

export interface CrmUser { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null; }

export interface CrmAccount {
  id: string; name: string; industry: string | null; companySize: string | null;
  website: string | null; phone: string | null; email: string | null;
  address: string | null; city: string | null; state: string | null;
  country: string | null; postalCode: string | null; description: string | null;
  annualRevenue: number | null; ownerId: string; isActive: boolean;
  registrationNumber: string | null; taxNumber: string | null;
  bankAccount: string | null;
  createdAt: string; updatedAt: string;
  owner?: UserRef; contacts?: CrmContact[]; opportunities?: CrmOpportunity[];
  leads?: CrmLead[]; activities?: CrmActivity[]; notes?: CrmNote[];
  _count?: { contacts: number; opportunities: number; leads: number; linkedRequests: number };
  parentAccountId?: string | null;
  parent?: { id: string; name: string } | null;
  children?: { id: string; name: string; industry?: string | null }[];
}

export interface CrmContact {
  id: string; accountId: string; firstName: string; lastName: string;
  email: string | null; phone: string | null; mobile: string | null;
  jobTitle: string | null; department: string | null; isPrimary: boolean;
  description: string | null; isActive: boolean; createdAt: string; updatedAt: string;
  followUpDate: string | null; followUpNote: string | null;
  nricPassport?: string | null; dateOfBirth?: string | null;
  account?: { id: string; name: string; industry?: string };
  opportunities?: CrmOpportunity[];
  leads?: CrmLead[];
  activities?: CrmActivity[];
  notes?: CrmNote[];
}

export interface CrmLead {
  id: string; title: string; status: LeadStatus; source: LeadSource;
  accountId: string | null; contactId: string | null; ownerId: string;
  contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  companyName: string | null; estimatedValue: number | null; description: string | null;
  followUpDate: string | null; followUpNote: string | null;
  lostReason: string | null; convertedAt: string | null; convertedToOppId: string | null;
  // AI scoring fields
  aiScore: number | null; aiScoreReason: string | null; aiScoredAt: string | null;
  // Rule-based scoring
  ruleScore: number | null;
  createdAt: string; updatedAt: string;
  owner?: UserRef; account?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string; email?: string; phone?: string };
  activities?: CrmActivity[]; notes?: CrmNote[];
}

export interface CrmPipeline {
  id: string; name: string; description: string | null;
  isDefault: boolean; isActive: boolean; createdAt: string;
  stages?: CrmPipelineStage[];
  _count?: { opportunities: number };
}

export interface CrmPipelineStage {
  id: string; pipelineId: string; name: string; displayOrder: number;
  probability: number; color: string; isWonStage: boolean; isLostStage: boolean;
  requiredFields?: string[]; enforceForwardOnly?: boolean;
  requiresApproval?: boolean; approvalThreshold?: number | null;
  opportunities?: CrmOpportunity[];
  _count?: { opportunities: number };
}

export interface CrmOpportunity {
  id: string; name: string; accountId: string; contactId: string | null;
  pipelineId: string; stageId: string; ownerId: string;
  value: number; currency: string; probability: number;
  forecastCategory?: string;
  expectedCloseDate: string | null; description: string | null;
  lostReason: string | null; wonAt: string | null; lostAt: string | null;
  // AI scoring fields
  aiWinProbability: number | null; aiWinReason: string | null; aiScoredAt: string | null;
  createdAt: string; updatedAt: string;
  account?: { id: string; name: string; industry?: string };
  contact?: { id: string; firstName: string; lastName: string; email?: string; phone?: string };
  stage?: CrmPipelineStage; pipeline?: CrmPipeline; owner?: UserRef;
  activities?: CrmActivity[]; notes?: CrmNote[];
  stageHistory?: CrmStageHistory[];
  trustProduct?: any;
}

export interface ScoringRule {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'starts_with' | 'not_empty';
  value: string;
  points: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentRule {
  id: string;
  name: string;
  territoryId: string | null;
  sourceMatch: string | null;
  roundRobin: boolean;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  territory?: { id: string; name: string };
}

export interface ContactAccountRole {
  id: string;
  contactId: string;
  accountId: string;
  role: string;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string };
  account?: { id: string; name: string };
}

export interface CrmActivity {
  id: string; activityType: CrmActivityType; subject: string; description: string | null;
  userId: string; accountId: string | null; contactId: string | null;
  leadId: string | null; opportunityId: string | null;
  scheduledAt: string | null; completedAt: string | null; durationMinutes: number | null;
  reminderSent: boolean;
  createdAt: string; updatedAt: string;
  user?: UserRef; account?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string };
  opportunity?: { id: string; name: string };
}

export interface CrmStageHistory {
  id: string;
  fromStageName: string | null;
  toStageName: string;
  movedByUserId: string;
  movedAt: string;
}

export interface CrmNote {
  id: string; content: string; authorId: string;
  accountId: string | null; contactId: string | null;
  leadId: string | null; opportunityId: string | null;
  isPinned: boolean; createdAt: string; updatedAt: string;
  author?: UserRef;
}

export interface Pagination { page: number; limit: number; total: number; totalPages: number; }

export interface DashboardStats {
  totalAccounts: number; totalContacts: number; totalLeads: number; totalOpportunities: number;
  pipelineValue: number; wonDeals: { count: number; value: number }; lostDeals: { count: number; value: number };
  winRate: number; recentActivities: CrmActivity[];
  leadsByStatus: { status: LeadStatus; _count: number }[];
  opportunitiesByStage: { stageId: string; _count: number; _sum: { value: number } }[];
  followUpDueToday: number;
  staleLeads: number;
  overdueDeals: number;
}

export interface TeamPerformance {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  leads: number;
  openDeals: number;
  pipelineValue: number;
  wonThisMonth: { count: number; value: number };
  staleLeads: number;
}

export interface CrmBeneficiary {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  allocationPct: number;
  email?: string;
  phone?: string;
  nricPassport?: string;
  dateOfBirth?: string;
  isMinor: boolean;
  guardianName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmTrustProduct {
  id: string;
  accountId: string;
  contactId?: string;
  opportunityId?: string;
  trustType: string;
  deedRefNumber?: string;
  status: string;
  assetValue?: number;
  currency: string;
  assetDescription?: string;
  trusteeName?: string;
  trusteeContact?: string;
  settlementDate?: string;
  maturityDate?: string;
  nextReviewDate?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  account?: any;
  contact?: any;
  opportunity?: any;
  owner?: any;
}

export interface CrmKycRecord {
  id: string;
  contactId: string;
  status: string;
  riskLevel?: string;
  isPep: boolean;
  nricVerified: boolean;
  addressVerified: boolean;
  incomeVerified: boolean;
  sourceOfFundsVerified: boolean;
  riskProfileDone: boolean;
  approvedAt?: string;
  approvedBy?: string;
  expiresAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDuplicateMatch {
  id: string;
  entityType: 'LEAD' | 'CONTACT';
  entityAId: string;
  entityBId: string;
  matchFields: string[];
  confidence: number;
  status: 'OPEN' | 'MERGED' | 'DISMISSED';
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── CRM API Service ─────────────────────────────────────────────

const crmService = {
  // Dashboard
  async getDashboard(myDeals = false) {
    const res = await api.get('/crm/dashboard', { params: { myDeals } });
    return res.data.data as DashboardStats;
  },

  // Global Search
  async globalSearch(q: string, signal?: AbortSignal) {
    const res = await api.get('/crm/search', { params: { q }, signal });
    return res.data.data as {
      accounts: Array<{ id: string; name: string; industry: string | null; isActive: boolean }>;
      contacts: Array<{ id: string; firstName: string; lastName: string; email: string | null; jobTitle: string | null; account?: { id: string; name: string } }>;
      leads: Array<{ id: string; title: string; status: string; companyName: string | null }>;
      opportunities: Array<{ id: string; name: string; value: number; account?: { id: string; name: string }; stage?: { name: string; color: string } }>;
    };
  },

  // Team Performance
  async getTeamPerformance() {
    const res = await api.get('/crm/team-performance');
    return res.data.data as { agents: TeamPerformance[] };
  },

  // CRM Users (for owner dropdown)
  async listCrmUsers() {
    const res = await api.get('/crm/users');
    return res.data.data.users as CrmUser[];
  },

  // Accounts
  async listAccounts(params: Record<string, any> = {}) {
    const res = await api.get('/crm/accounts', { params });
    return res.data.data as { accounts: CrmAccount[]; pagination: Pagination };
  },
  async getAccount(id: string) {
    const res = await api.get(`/crm/accounts/${id}`);
    return res.data.data.account as CrmAccount;
  },
  async createAccount(data: Partial<CrmAccount>) {
    const res = await api.post('/crm/accounts', data);
    return res.data.data.account as CrmAccount;
  },
  async updateAccount(id: string, data: Partial<CrmAccount>) {
    const res = await api.patch(`/crm/accounts/${id}`, data);
    return res.data.data.account as CrmAccount;
  },
  async deleteAccount(id: string) { await api.delete(`/crm/accounts/${id}`); },

  // Contacts
  async listContacts(params: Record<string, any> = {}) {
    const res = await api.get('/crm/contacts', { params });
    return res.data.data as { contacts: CrmContact[]; pagination: Pagination };
  },
  async getContact(id: string) {
    const res = await api.get(`/crm/contacts/${id}`);
    return res.data.data.contact as CrmContact;
  },
  async createContact(data: Partial<CrmContact>) {
    const res = await api.post('/crm/contacts', data);
    return res.data.data.contact as CrmContact;
  },
  async updateContact(id: string, data: Partial<CrmContact>) {
    const res = await api.patch(`/crm/contacts/${id}`, data);
    return res.data.data.contact as CrmContact;
  },
  async deleteContact(id: string) { await api.delete(`/crm/contacts/${id}`); },

  // Leads
  async listLeads(params: Record<string, any> = {}) {
    const res = await api.get('/crm/leads', { params });
    return res.data.data as { leads: CrmLead[]; pagination: Pagination };
  },
  async getLead(id: string) {
    const res = await api.get(`/crm/leads/${id}`);
    return res.data.data.lead as CrmLead;
  },
  async createLead(data: Partial<CrmLead>) {
    const res = await api.post('/crm/leads', data);
    return res.data.data.lead as CrmLead;
  },
  async updateLead(id: string, data: Partial<CrmLead>) {
    const res = await api.patch(`/crm/leads/${id}`, data);
    return res.data.data.lead as CrmLead;
  },
  async convertLead(id: string, data: any) {
    const res = await api.post(`/crm/leads/${id}/convert`, data);
    return res.data.data.opportunity as CrmOpportunity;
  },
  async deleteLead(id: string) { await api.delete(`/crm/leads/${id}`); },

  // Opportunities
  async listOpportunities(params: Record<string, any> = {}) {
    const res = await api.get('/crm/opportunities', { params });
    return res.data.data as { opportunities: CrmOpportunity[]; pagination: Pagination };
  },
  async getOpportunity(id: string) {
    const res = await api.get(`/crm/opportunities/${id}`);
    return res.data.data.opportunity as CrmOpportunity;
  },
  async createOpportunity(data: Partial<CrmOpportunity>) {
    const res = await api.post('/crm/opportunities', data);
    return res.data.data.opportunity as CrmOpportunity;
  },
  async updateOpportunity(id: string, data: Partial<CrmOpportunity>) {
    const res = await api.patch(`/crm/opportunities/${id}`, data);
    return res.data.data.opportunity as CrmOpportunity;
  },
  async moveStage(id: string, stageId: string, lostReason?: string) {
    const res = await api.post(`/crm/opportunities/${id}/move-stage`, { stageId, lostReason });
    return res.data.data.opportunity as CrmOpportunity;
  },
  async deleteOpportunity(id: string) { await api.delete(`/crm/opportunities/${id}`); },

  // Pipelines
  async listPipelines() {
    const res = await api.get('/crm/pipelines');
    return res.data.data.pipelines as CrmPipeline[];
  },
  async getPipeline(id: string) {
    const res = await api.get(`/crm/pipelines/${id}`);
    return res.data.data as { pipeline: CrmPipeline; stages: CrmPipelineStage[]; totalValue: number };
  },
  async createPipeline(data: any) {
    const res = await api.post('/crm/pipelines', data);
    return res.data.data.pipeline as CrmPipeline;
  },
  async updatePipeline(id: string, data: Partial<CrmPipeline>) {
    const res = await api.patch(`/crm/pipelines/${id}`, data);
    return res.data.data.pipeline as CrmPipeline;
  },

  // Activities
  async listActivities(params: Record<string, any> = {}) {
    const res = await api.get('/crm/activities', { params });
    return res.data.data as { activities: CrmActivity[]; pagination: Pagination };
  },
  async createActivity(data: Partial<CrmActivity>) {
    const res = await api.post('/crm/activities', data);
    return res.data.data.activity as CrmActivity;
  },
  async updateActivity(id: string, data: Partial<CrmActivity>) {
    const res = await api.patch(`/crm/activities/${id}`, data);
    return res.data.data.activity as CrmActivity;
  },
  async deleteActivity(id: string) { await api.delete(`/crm/activities/${id}`); },
  async sendActivityReminder(id: string) {
    const res = await api.post(`/crm/activities/${id}/remind`);
    return res.data.data.activity as CrmActivity;
  },

  // Notes
  async listNotes(params?: Record<string, string>) {
    const res = await api.get('/crm/notes', { params });
    return res.data.data as { notes: CrmNote[]; pagination: Pagination };
  },
  async createNote(data: Partial<CrmNote>) {
    const res = await api.post('/crm/notes', data);
    return res.data.data.note as CrmNote;
  },
  async updateNote(id: string, data: Partial<CrmNote>) {
    const res = await api.patch(`/crm/notes/${id}`, data);
    return res.data.data.note as CrmNote;
  },
  async deleteNote(id: string) { await api.delete(`/crm/notes/${id}`); },

  // Trust Products
  async listTrustProducts(params?: Record<string, string>) {
    const res = await api.get('/crm/trust-products', { params });
    return res.data.data as { trustProducts: CrmTrustProduct[]; pagination: Pagination };
  },
  async getTrustProduct(id: string) {
    const res = await api.get(`/crm/trust-products/${id}`);
    return res.data.data.trustProduct as CrmTrustProduct;
  },
  async createTrustProduct(data: any) {
    const res = await api.post('/crm/trust-products', data);
    return res.data.data.trustProduct as CrmTrustProduct;
  },
  async updateTrustProduct(id: string, data: any) {
    const res = await api.patch(`/crm/trust-products/${id}`, data);
    return res.data.data.trustProduct as CrmTrustProduct;
  },
  async deleteTrustProduct(id: string) { await api.delete(`/crm/trust-products/${id}`); },

  // KYC
  async getKycRecord(contactId: string) {
    const res = await api.get(`/crm/contacts/${contactId}/kyc`);
    return res.data.data.kycRecord as CrmKycRecord;
  },
  async upsertKycRecord(contactId: string, data: any) {
    const res = await api.put(`/crm/contacts/${contactId}/kyc`, data);
    return res.data.data.kycRecord as CrmKycRecord;
  },
  async approveKyc(contactId: string) {
    const res = await api.post(`/crm/contacts/${contactId}/kyc/approve`);
    return res.data.data.kycRecord as CrmKycRecord;
  },

  // Beneficiaries
  async listBeneficiaries(contactId: string) {
    const res = await api.get(`/crm/contacts/${contactId}/beneficiaries`);
    return res.data.data.beneficiaries as CrmBeneficiary[];
  },
  async createBeneficiary(contactId: string, data: any) {
    const res = await api.post(`/crm/contacts/${contactId}/beneficiaries`, data);
    return res.data.data.beneficiary as CrmBeneficiary;
  },
  async updateBeneficiary(id: string, data: any) {
    const res = await api.patch(`/crm/beneficiaries/${id}`, data);
    return res.data.data.beneficiary as CrmBeneficiary;
  },
  async deleteBeneficiary(id: string) { await api.delete(`/crm/beneficiaries/${id}`); },

  // Reports
  async getLeadConversionReport(params?: Record<string, string>) {
    const res = await api.get('/crm/reports/lead-conversion', { params });
    return res.data.data;
  },
  async getSalesPerformanceReport(params?: Record<string, string>) {
    const res = await api.get('/crm/reports/sales-performance', { params });
    return res.data.data;
  },
  async getPipelineForecastReport(pipelineId: string) {
    const res = await api.get('/crm/reports/pipeline-forecast', { params: { pipelineId } });
    return res.data.data;
  },
  async getActivitySummaryReport(params?: Record<string, string>) {
    const res = await api.get('/crm/reports/activity-summary', { params });
    return res.data.data;
  },
  async getLeadAgingReport(params?: Record<string, string>) {
    const res = await api.get('/crm/reports/lead-aging', { params });
    return res.data.data;
  },
  async getWinLossReport(params?: Record<string, string>) {
    const res = await api.get('/crm/reports/win-loss', { params });
    return res.data.data;
  },
  async getKycComplianceReport() {
    const res = await api.get('/crm/reports/kyc-compliance');
    return res.data.data;
  },
  async getForecastCategoriesReport(pipelineId: string) {
    const res = await api.get('/crm/reports/forecast-categories', { params: { pipelineId } });
    return res.data.data;
  },
  async getForecastAccuracyReport(params?: { from?: string; to?: string }) {
    const res = await api.get('/crm/reports/forecast-accuracy', { params });
    return res.data.data;
  },

  // Lead Scoring Rules
  async listScoringRules() {
    const res = await api.get('/crm/lead-scoring-rules');
    return res.data.data.rules as ScoringRule[];
  },
  async createScoringRule(data: Omit<ScoringRule, 'id' | 'createdAt' | 'updatedAt'>) {
    const res = await api.post('/crm/lead-scoring-rules', data);
    return res.data.data.rule as ScoringRule;
  },
  async updateScoringRule(id: string, data: Partial<ScoringRule>) {
    const res = await api.put(`/crm/lead-scoring-rules/${id}`, data);
    return res.data.data.rule as ScoringRule;
  },
  async deleteScoringRule(id: string) {
    await api.delete(`/crm/lead-scoring-rules/${id}`);
  },
  async recomputeScores() {
    const res = await api.post('/crm/lead-scoring-rules/recompute');
    return res.data.data as { count: number };
  },

  // Assignment Rules
  async listAssignmentRules() {
    const res = await api.get('/crm/assignment-rules');
    return res.data.data as AssignmentRule[];
  },
  async createAssignmentRule(data: Omit<AssignmentRule, 'id' | 'createdAt' | 'updatedAt' | 'territory'>) {
    const res = await api.post('/crm/assignment-rules', data);
    return res.data.data.rule as AssignmentRule;
  },
  async updateAssignmentRule(id: string, data: Partial<AssignmentRule>) {
    const res = await api.put(`/crm/assignment-rules/${id}`, data);
    return res.data.data.rule as AssignmentRule;
  },
  async deleteAssignmentRule(id: string) {
    return api.delete(`/crm/assignment-rules/${id}`);
  },

  // Contact-Account Roles (multi-account contacts)
  async getContactAccountRoles(params?: { contactId?: string; accountId?: string }) {
    const res = await api.get('/crm/contact-account-roles', { params });
    return res.data.data as ContactAccountRole[];
  },
  async addContactAccountRole(contactId: string, accountId: string, role: string) {
    const res = await api.post('/crm/contact-account-roles', { contactId, accountId, role });
    return res.data.data.role as ContactAccountRole;
  },
  async removeContactAccountRole(id: string) {
    return api.delete(`/crm/contact-account-roles/${id}`);
  },

  // My Stats (Self-Service Rep Stats)
  async getMyStats() {
    const res = await api.get('/crm/my-stats');
    return res.data.data as {
      leads: number;
      opportunities: number;
      pipelineValue: number;
      wonThisMonth: number;
      staleLeads: number;
      activitiesThisWeek: number;
    };
  },

  // ── AI Features ───────────────────────────────────────────────────────────────────────────
  async analyzeActivityNote(activityId: string) {
    const { data } = await api.post(`/crm/ai/activities/${activityId}/analyze`);
    return data as { sentiment: 'positive' | 'neutral' | 'negative'; nextAction: string; suggestedStatusChange: string | null; keyFacts: string[] };
  },
  async draftLeadMessage(leadId: string, payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }) {
    const { data } = await api.post(`/crm/ai/leads/${leadId}/draft-message`, { entityType: 'lead', ...payload });
    return data as { subject: string | null; body: string };
  },
  async draftContactMessage(contactId: string, payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }) {
    const { data } = await api.post(`/crm/ai/contacts/${contactId}/draft-message`, { entityType: 'contact', ...payload });
    return data as { subject: string | null; body: string };
  },
  async getLeadSummary(leadId: string) {
    const { data } = await api.get(`/crm/ai/leads/${leadId}/summary`);
    return data as { statusSummary: string; keyFacts: string; recommendedNextStep: string };
  },
  async getLeadScore(leadId: string) {
    const { data } = await api.get(`/crm/ai/leads/${leadId}/score`);
    return data as { score: number; reason: string };
  },
  async getWinProbability(opportunityId: string) {
    const { data } = await api.get(`/crm/ai/opportunities/${opportunityId}/win-probability`);
    return data as { probability: number; confidence: 'high' | 'medium' | 'low'; reason: string };
  },
  async getDailyBriefing() {
    const { data } = await api.get(`/crm/ai/dashboard/briefing`);
    return data as { headline: string; bullets: string[]; topPriority: string };
  },
  async getManagerBriefing() {
    return (await api.get('/crm/ai/team/briefing')).data.data as {
      headline: string;
      atRiskDeals: string[];
      repActivityGaps: string[];
      recommendations: string[];
    };
  },
  async getWinLossDebrief(opportunityId: string) {
    return (await api.get(`/crm/ai/opportunities/${opportunityId}/win-loss-debrief`)).data.data as {
      outcome: 'WON' | 'LOST';
      summary: string;
      keyFactors: string[];
      lessonsLearned: string[];
      followOnActions: string[];
    };
  },
  async getKycGaps(contactId: string) {
    const { data } = await api.get(`/crm/ai/contacts/${contactId}/kyc-gaps`);
    return data as { gaps: Array<{ field: string; requirement: string; severity: 'required' | 'recommended' }>; complianceSummary: string; isCompliant: boolean };
  },
  async getRiskProfile(contactId: string) {
    const { data } = await api.get(`/crm/ai/contacts/${contactId}/risk-profile`);
    return data as { suggestedRiskTier: 'Low' | 'Medium' | 'High'; justification: string; regulatoryBasis: string };
  },
  async getDocumentChecklist(trustProductId: string) {
    const { data } = await api.get(`/crm/ai/trust-products/${trustProductId}/document-checklist`);
    return data as { documents: Array<{ name: string; description: string; required: boolean }>; notes: string };
  },
  async getNextBestAction(entityType: string, entityId: string) {
    const res = await api.post('/crm/ai/next-best-action', { entityType, entityId });
    return res.data as { actions: Array<{ action: string; priority: 'high' | 'medium' | 'low'; reason: string }> };
  },

  // ── Audit Trail ────────────────────────────────────────────────────────
  async getEntityAuditTrail(entityType: string, entityId: string, page = 1, limit = 20) {
    const res = await api.get(`/crm/audit/${entityType}/${entityId}?page=${page}&limit=${limit}`);
    return res.data.data as { logs: AuditLogEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
  },

  // ── Import / Export ───────────────────────────────────────────────
  async getFieldDefinitions(entity: string) {
    const res = await api.get(`/crm/import/field-definitions?entity=${entity}`);
    return res.data.data as { fields: Array<{ key: string; label: string; required: boolean; type: string; enumValues?: string[]; default?: unknown }> };
  },
  async downloadImportTemplate(entity: string, format: 'csv' | 'xlsx' = 'csv') {
    const res = await api.get(`/crm/import/template`, {
      params: { entity, format },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity}_template.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  async uploadImportFile(file: File, entity: string) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/crm/import/upload?entity=${entity}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as {
      jobId: string; preview: Record<string, unknown>[]; headers: string[];
      suggestedMapping: Record<string, string>; totalRows: number;
    };
  },
  async validateImportMapping(jobId: string, columnMapping: Record<string, string>) {
    const res = await api.post(`/crm/import/${jobId}/validate`, { columnMapping });
    return res.data.data as { valid: boolean; errors: Array<{ row: number; field: string; error: string }>; warnings: string[] };
  },
  async executeImport(jobId: string) {
    const res = await api.post(`/crm/import/${jobId}/execute`);
    return res.data.data as { importedRows: number; failedRows: number; errors: Array<{ row: number; error: string }> };
  },
  async getImportStatus(jobId: string) {
    const res = await api.get(`/crm/import/${jobId}/status`);
    return res.data.data as Record<string, unknown>;
  },
  async getImportHistory(page = 1, limit = 20) {
    const res = await api.get(`/crm/import/history?page=${page}&limit=${limit}`);
    return res.data.data as { jobs: Record<string, unknown>[]; total: number };
  },
  async requestExport(entity: string, filters?: Record<string, unknown>, format = 'CSV') {
    const res = await api.post('/crm/export', { entity, filters, format });
    return res.data.data as { jobId: string };
  },
  async downloadExport(jobId: string) {
    const res = await api.get(`/crm/export/${jobId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_export_${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  async getExportHistory(page = 1, limit = 20) {
    const res = await api.get(`/crm/export/history?page=${page}&limit=${limit}`);
    return res.data.data as { jobs: Record<string, unknown>[]; total: number };
  },

  // ── Territories ────────────────────────────────────────────────
  async listTerritories(page = 1, limit = 20) {
    const res = await api.get(`/crm/territories?page=${page}&limit=${limit}`);
    return res.data.data as { territories: any[]; total: number };
  },
  async getTerritory(id: string) {
    const res = await api.get(`/crm/territories/${id}`);
    return res.data.data as any;
  },
  async createTerritory(data: { name: string; description?: string; regions?: any }) {
    const res = await api.post('/crm/territories', data);
    return res.data.data as any;
  },
  async updateTerritory(id: string, data: any) {
    const res = await api.put(`/crm/territories/${id}`, data);
    return res.data.data as any;
  },
  async deleteTerritory(id: string) {
    const res = await api.delete(`/crm/territories/${id}`);
    return res.data.data as any;
  },
  async addTerritoryMember(territoryId: string, userId: string, role: string) {
    const res = await api.post(`/crm/territories/${territoryId}/members`, { userId, role });
    return res.data.data as any;
  },
  async removeTerritoryMember(territoryId: string, userId: string) {
    const res = await api.delete(`/crm/territories/${territoryId}/members/${userId}`);
    return res.data.data as any;
  },
  async lookupTerritory(state?: string, country?: string) {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (country) params.set('country', country);
    const res = await api.get(`/crm/territories/lookup?${params}`);
    return res.data.data as any[];
  },

  // ── Quotas ─────────────────────────────────────────────────────
  async listQuotas(filters?: Record<string, string>, page = 1, limit = 20) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (filters) for (const [k, v] of Object.entries(filters)) params.set(k, v);
    const res = await api.get(`/crm/quotas?${params}`);
    return res.data.data as { quotas: any[]; total: number };
  },
  async getQuota(id: string) {
    const res = await api.get(`/crm/quotas/${id}`);
    return res.data.data as any;
  },
  async createQuota(data: any) {
    const res = await api.post('/crm/quotas', data);
    return res.data.data as any;
  },
  async updateQuota(id: string, data: any) {
    const res = await api.put(`/crm/quotas/${id}`, data);
    return res.data.data as any;
  },
  async deleteQuota(id: string) {
    const res = await api.delete(`/crm/quotas/${id}`);
    return res.data.data as any;
  },
  async getQuotaAttainment(period: string, userId?: string, territoryId?: string) {
    const params = new URLSearchParams();
    params.set('period', period);
    if (userId) params.set('userId', userId);
    if (territoryId) params.set('territoryId', territoryId);
    const res = await api.get(`/crm/quotas/attainment?${params}`);
    return res.data.data as any[];
  },
  async getQuotaDashboard(period: string) {
    const res = await api.get(`/crm/quotas/dashboard?period=${period}`);
    return res.data.data as any;
  },

  // ── Dashboard Layout ──────────────────────────────────────────
  async getWidgetRegistry() {
    const res = await api.get('/crm/dashboard/widgets');
    return res.data.data as any[];
  },
  async getDashboardLayout() {
    const res = await api.get('/crm/dashboard/layout');
    return res.data.data as { layout: any[]; isDefault: boolean; updatedAt: string | null };
  },
  async saveDashboardLayout(layout: any[]) {
    const res = await api.put('/crm/dashboard/layout', { layout });
    return res.data.data as any;
  },
  async resetDashboardLayout() {
    const res = await api.post('/crm/dashboard/layout/reset');
    return res.data.data as { layout: any[]; isDefault: boolean };
  },

  // ── Workflow Automation ────────────────────────────────────
  async listWorkflows(page = 1, limit = 20) {
    const res = await api.get(`/crm/workflows?page=${page}&limit=${limit}`);
    return res.data.data as { workflows: any[]; total: number; page: number; limit: number };
  },
  async getWorkflow(id: string) {
    const res = await api.get(`/crm/workflows/${id}`);
    return res.data.data as any;
  },
  async createWorkflow(data: any) {
    const res = await api.post('/crm/workflows', data);
    return res.data.data as any;
  },
  async updateWorkflow(id: string, data: any) {
    const res = await api.put(`/crm/workflows/${id}`, data);
    return res.data.data as any;
  },
  async deleteWorkflow(id: string) {
    const res = await api.delete(`/crm/workflows/${id}`);
    return res.data.data as any;
  },
  async toggleWorkflow(id: string) {
    const res = await api.patch(`/crm/workflows/${id}/toggle`);
    return res.data.data as any;
  },
  async getWorkflowTemplates() {
    const res = await api.get('/crm/workflows/templates');
    return res.data.data as any[];
  },
  async getWorkflowExecutions(workflowId: string, page = 1, limit = 20) {
    const res = await api.get(`/crm/workflows/${workflowId}/executions?page=${page}&limit=${limit}`);
    return res.data.data as { executions: any[]; total: number };
  },
  async getAllExecutions(page = 1, limit = 20) {
    const res = await api.get(`/crm/workflows/executions?page=${page}&limit=${limit}`);
    return res.data.data as { executions: any[]; total: number };
  },

  // ── Email / Calendar Integration ──────────────────────────────────
  async listIntegrations() {
    const res = await api.get('/crm/integrations');
    return res.data.data;
  },
  async getGoogleAuthUrl() {
    const res = await api.get('/crm/integrations/google/auth');
    return res.data.data as { url: string };
  },
  async getOutlookAuthUrl() {
    const res = await api.get('/crm/integrations/outlook/auth');
    return res.data.data as { url: string };
  },
  async disconnectIntegration(id: string) {
    const res = await api.delete(`/crm/integrations/${id}`);
    return res.data.data;
  },
  async updateSyncPreferences(id: string, data: { syncEnabled?: boolean; syncFrequency?: string }) {
    const res = await api.patch(`/crm/integrations/${id}`, data);
    return res.data.data;
  },
  async triggerSync(id: string) {
    const res = await api.post(`/crm/integrations/${id}/sync`);
    return res.data.data;
  },
  async listSyncedEmails(filters?: { contactId?: string; leadId?: string; accountId?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.contactId) params.set('contactId', filters.contactId);
    if (filters?.leadId) params.set('leadId', filters.leadId);
    if (filters?.accountId) params.set('accountId', filters.accountId);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const res = await api.get(`/crm/emails?${params.toString()}`);
    return res.data.data as { emails: any[]; total: number; page: number; limit: number };
  },
  async getEmail(id: string) {
    const res = await api.get(`/crm/emails/${id}`);
    return res.data.data;
  },
  async sendEmail(data: { to: string; subject: string; body: string; cc?: string; contactId?: string; leadId?: string; accountId?: string }) {
    const res = await api.post('/crm/emails/send', data);
    return res.data.data;
  },
  async listSyncedEvents(page = 1, limit = 20) {
    const res = await api.get(`/crm/events?page=${page}&limit=${limit}`);
    return res.data.data as { events: any[]; total: number; page: number; limit: number };
  },

  // ── Anomaly Detection ──────────────────────────────────
  async getAnomalies() {
    const res = await api.get('/crm/anomalies');
    return res.data.data as { anomalies: any[] };
  },
  async getAnomalyConfig() {
    const res = await api.get('/crm/anomalies/config');
    return res.data.data;
  },
  async updateAnomalyConfig(id: string, data: { threshold?: number; severity?: string; isActive?: boolean }) {
    const res = await api.put(`/crm/anomalies/config/${id}`, data);
    return res.data.data;
  },
  async refreshAnomalies() {
    const res = await api.post('/crm/anomalies/refresh');
    return res.data.data;
  },

  // ── Custom Fields ───────────────────────────────────────
  async getCustomFieldDefinitions(entity?: string) {
    const url = entity ? `/crm/custom-fields?entity=${entity}` : '/crm/custom-fields';
    const res = await api.get(url);
    return res.data.data;
  },
  async createCustomFieldDefinition(data: any) {
    const res = await api.post('/crm/custom-fields', data);
    return res.data.data;
  },
  async updateCustomFieldDefinition(id: string, data: any) {
    const res = await api.put(`/crm/custom-fields/${id}`, data);
    return res.data.data;
  },
  async deleteCustomFieldDefinition(id: string) {
    const res = await api.delete(`/crm/custom-fields/${id}`);
    return res.data.data;
  },

  // ── Duplicate Detection & Merge ────────────────────────
  async listDuplicates(entityType?: string, status?: string) {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (status) params.set('status', status);
    const qs = params.toString();
    const res = await api.get(`/crm/duplicates${qs ? `?${qs}` : ''}`);
    return res.data.data.duplicates as any[];
  },
  async mergeDuplicates(id: string, masterEntityId: string, fieldSelections: Record<string, string>) {
    const res = await api.post(`/crm/duplicates/${id}/merge`, { masterEntityId, fieldSelections });
    return res.data;
  },
  async dismissDuplicate(id: string) {
    const res = await api.post(`/crm/duplicates/${id}/dismiss`);
    return res.data;
  },
};

export default crmService;
