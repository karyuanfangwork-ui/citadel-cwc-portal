import api from './api';

// ── CRM Types ───────────────────────────────────────────────────

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED' | 'LOST';
export type LeadSource = 'WEBSITE' | 'REFERRAL' | 'COLD_CALL' | 'TRADE_SHOW' | 'LINKEDIN' | 'ADVERTISEMENT' | 'PARTNER' | 'OTHER';
export type OpportunityStage = 'PROSPECTING' | 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type CrmActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK' | 'FOLLOW_UP' | 'WHATSAPP' | 'SITE_VISIT';

export interface UserRef { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null; }

export interface CrmAccount {
  id: string; name: string; industry: string | null; companySize: string | null;
  website: string | null; phone: string | null; email: string | null;
  address: string | null; city: string | null; state: string | null;
  country: string | null; postalCode: string | null; description: string | null;
  annualRevenue: number | null; ownerId: string; isActive: boolean;
  registrationNumber: string | null; taxNumber: string | null;
  bankAccount: string | null; purchaseCashTrust: boolean;
  createdAt: string; updatedAt: string;
  owner?: UserRef; contacts?: CrmContact[]; opportunities?: CrmOpportunity[];
  leads?: CrmLead[]; activities?: CrmActivity[]; notes?: CrmNote[];
  _count?: { contacts: number; opportunities: number; leads: number; linkedRequests: number };
}

export interface CrmContact {
  id: string; accountId: string; firstName: string; lastName: string;
  email: string | null; phone: string | null; mobile: string | null;
  jobTitle: string | null; department: string | null; isPrimary: boolean;
  description: string | null; isActive: boolean; createdAt: string; updatedAt: string;
  account?: { id: string; name: string; industry?: string };
  opportunities?: CrmOpportunity[];
}

export interface CrmLead {
  id: string; title: string; status: LeadStatus; source: LeadSource;
  accountId: string | null; contactId: string | null; ownerId: string;
  contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  companyName: string | null; estimatedValue: number | null; description: string | null;
  followUpDate: string | null; followUpNote: string | null;
  lostReason: string | null; convertedAt: string | null; convertedToOppId: string | null;
  createdAt: string; updatedAt: string;
  owner?: UserRef; account?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string };
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
  opportunities?: CrmOpportunity[];
  _count?: { opportunities: number };
}

export interface CrmOpportunity {
  id: string; name: string; accountId: string; contactId: string | null;
  pipelineId: string; stageId: string; ownerId: string;
  value: number; currency: string; probability: number;
  expectedCloseDate: string | null; description: string | null;
  lostReason: string | null; wonAt: string | null; lostAt: string | null;
  createdAt: string; updatedAt: string;
  account?: { id: string; name: string; industry?: string };
  contact?: { id: string; firstName: string; lastName: string; email?: string; phone?: string };
  stage?: CrmPipelineStage; pipeline?: CrmPipeline; owner?: UserRef;
  activities?: CrmActivity[]; notes?: CrmNote[];
}

export interface CrmActivity {
  id: string; activityType: CrmActivityType; subject: string; description: string | null;
  userId: string; accountId: string | null; contactId: string | null;
  leadId: string | null; opportunityId: string | null;
  scheduledAt: string | null; completedAt: string | null; durationMinutes: number | null;
  createdAt: string; updatedAt: string;
  user?: UserRef; account?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string };
  opportunity?: { id: string; name: string };
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

// ── CRM API Service ─────────────────────────────────────────────

const crmService = {
  // Dashboard
  async getDashboard(myDeals = false) {
    const res = await api.get('/crm/dashboard', { params: { myDeals } });
    return res.data.data as DashboardStats;
  },

  // Global Search
  async globalSearch(q: string) {
    const res = await api.get('/crm/search', { params: { q } });
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

  // Notes
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
};

export default crmService;
