import apiClient from './api';

// ── Credit Module Types ───────────────────────────────────────

export type BorrowerProfileStatus = 'DRAFT' | 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type DocumentType = 'NRIC' | 'PASSPORT' | 'BUSINESS_REG' | 'TAX_RETURN' | 'BANK_STATEMENT' | 'FINANCIAL_STATEMENT' | 'UTILITY_BILL' | 'OTHER';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type ApplicationState =
  | 'DRAFT' | 'SUBMITTED' | 'KYC_REVIEW' | 'KYC_APPROVED' | 'KYC_REJECTED'
  | 'UNDERWRITING' | 'CREDIT_ASSESSMENT' | 'COMMITTEE_REVIEW'
  | 'APPROVED' | 'REJECTED' | 'OFFER' | 'ACCEPTED'
  | 'DISBURSED' | 'ACTIVE' | 'CLOSED' | 'WITHDRAWN';

export type CreditProductType =
  | 'TERM_LOAN' | 'REVOLVING_CREDIT' | 'TRADE_FINANCE' | 'PROJECT_FINANCE'
  | 'SYNDICATED' | 'BRIDGE_LOAN' | 'OVERDRAFT' | 'LETTER_OF_CREDIT' | 'BANK_GUARANTEE';

export type FacilityType =
  | 'TERM_LOAN' | 'REVOLVING_CREDIT' | 'OVERDRAFT' | 'LETTER_OF_CREDIT'
  | 'BANK_GUARANTEE' | 'TRADE_FINANCE' | 'BRIDGE_LOAN' | 'PROJECT_FINANCE';

export type CurrencyCode = 'MYR' | 'USD' | 'SGD' | 'GBP' | 'EUR' | 'JPY' | 'CNY' | 'THB' | 'IDR' | 'AUD' | 'HKD';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'RETURNED' | 'ESCALATED';

// Keep backward compat alias
export type CreditApplicationStatus = ApplicationState;

// ── Sprint 3 Types ────────────────────────────────────────────

export type FinancialStatementType = 'BS' | 'PL' | 'CF';
export type FinancialPeriod = 'ANNUAL' | 'QUARTERLY';
export type FinancialStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED';
export type RatioCategory = 'PROFITABILITY' | 'LEVERAGE' | 'LIQUIDITY' | 'COVERAGE' | 'ACTIVITY';
export type RiskRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' | 'NR';

export interface CreditUserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface BorrowerProfile {
  id: string;
  accountId: string;
  contactId: string | null;
  status: BorrowerProfileStatus;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nricPassport: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  occupation: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  creditScore: number | null;
  riskRating: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string; industry: string | null };
  contact?: { id: string; firstName: string; lastName: string; email: string | null };
  owner?: CreditUserRef;
  documents?: CreditDocument[];
  applications?: CreditApplication[];
  _count?: { documents: number; applications: number };
}

export interface CreditDocument {
  id: string;
  borrowerProfileId: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
  uploadedBy: string;
  uploader?: CreditUserRef;
  verifier?: CreditUserRef;
}

export interface CreditApplication {
  id: string;
  borrowerProfileId: string;
  productType: CreditProductType;
  requestedAmount: number;
  currency: CurrencyCode;
  tenureMonths: number;
  purpose: string | null;
  state: ApplicationState;
  approvedAmount: number | null;
  interestRate: number | null;
  riskRating: string | null;
  rmId: string | null;
  analystId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  // legacy compat
  status?: ApplicationState;
  productName?: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  // relations
  borrowerProfile?: BorrowerProfile;
  rm?: CreditUserRef;
  analyst?: CreditUserRef;
  reviewer?: CreditUserRef;
  facilities?: CreditFacility[];
  parties?: CreditApplicationParty[];
  approvals?: CreditApproval[];
}

export interface CreditFacility {
  id: string;
  applicationId: string;
  facilityType: FacilityType;
  currency: CurrencyCode;
  approvedAmount: number;
  interestRate: number | null;
  tenureMonths: number;
  purpose: string | null;
  conditions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditApplicationParty {
  id: string;
  applicationId: string;
  partyType: 'BORROWER' | 'GUARANTOR' | 'COVENANTOR' | 'DIRECTOR' | 'SHAREHOLDER';
  firstName: string;
  lastName: string;
  nricPassport: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  createdAt: string;
}

export interface CreditApproval {
  id: string;
  applicationId: string;
  approverId: string;
  decision: ApprovalDecision;
  comment: string | null;
  isCommitteeVote: boolean;
  decidedAt: string | null;
  createdAt: string;
  approver?: CreditUserRef;
}

export interface ApprovalMatrix {
  id: string;
  name: string;
  productType: CreditProductType;
  minExposure: number;
  maxExposure: number | null;
  riskRating: string;
  authorityLevel: string;
  approverIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditAuditEvent {
  id: string;
  applicationId: string;
  action: string;
  fromState: ApplicationState | null;
  toState: ApplicationState | null;
  performedBy: string | null;
  comment: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  performer?: CreditUserRef;
}

export interface ApplicationTransition {
  action: string;
  label: string;
  fromState: ApplicationState;
  toState: ApplicationState;
  requiresComment: boolean;
}

export interface ApprovalMatrixLookup {
  authorityLevel: string;
  approverIds: string[];
  matrixId: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Sprint 3: Financial Spreading Types ───────────────────────

export interface FinancialStatement {
  id: string;
  borrowerProfileId: string;
  statementType: FinancialStatementType;
  period: FinancialPeriod;
  periodDate: string;
  currency: CurrencyCode;
  status: FinancialStatus;
  enteredBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: FinancialLineItem[];
  enterer?: CreditUserRef;
  reviewer?: CreditUserRef;
  approverRef?: CreditUserRef;
}

export interface FinancialLineItem {
  id?: string;
  financialStatementId: string;
  lineKey: string;
  lineLabel: string;
  amount: number;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancialRatio {
  id: string;
  financialStatementId: string;
  ratioKey: string;
  ratioLabel: string;
  category: RatioCategory;
  value: number;
  previousValue: number | null;
  trend: 'UP' | 'DOWN' | 'STABLE' | null;
  createdAt: string;
}

export interface TrendAnalysis {
  borrowerProfileId: string;
  ratios: FinancialRatio[];
  periods: string[];
}

export interface ExposureSummary {
  borrowerProfileId: string;
  totalExposure: number;
  currency: CurrencyCode;
  breakdown: ExposureBreakdownItem[];
  utilization: number | null;
}

export interface ExposureBreakdownItem {
  facilityType: FacilityType;
  approvedAmount: number;
  outstandingAmount: number;
  availableAmount: number;
  count: number;
}

// ── Sprint 3: Scorecard Types ─────────────────────────────────

export interface CreditScorecard {
  id: string;
  name: string;
  description: string | null;
  productType: CreditProductType | null;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
  versions?: CreditScorecardVersion[];
  activeVersion?: CreditScorecardVersion;
}

export interface CreditScorecardVersion {
  id: string;
  scorecardId: string;
  versionNumber: number;
  isActive: boolean;
  factors: ScorecardFactor[];
  createdAt: string;
  createdBy: string;
  creator?: CreditUserRef;
}

export interface ScorecardFactor {
  key: string;
  label: string;
  weight: number;
}

export interface CreditScoreRun {
  id: string;
  applicationId: string;
  scorecardVersionId: string;
  totalScore: number;
  riskRating: RiskRating;
  factorBreakdown: ScoreFactorResult[];
  overriddenRating: RiskRating | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  executedAt: string;
  executedBy: string;
  executor?: CreditUserRef;
  overrider?: CreditUserRef;
}

export interface ScoreFactorResult {
  factorKey: string;
  factorLabel: string;
  score: number;
  weight: number;
  weightedScore: number;
}

// ── Credit API Service ─────────────────────────────────────────

const creditService = {
  // Borrower Profiles
  async listBorrowerProfiles(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/borrower-profiles', { params });
    return res.data.data as { profiles: BorrowerProfile[]; pagination: Pagination };
  },

  async getBorrowerProfile(id: string) {
    const res = await apiClient.get(`/credit/borrower-profiles/${id}`);
    return res.data.data.profile as BorrowerProfile;
  },

  async createBorrowerProfile(data: Partial<BorrowerProfile>) {
    const res = await apiClient.post('/credit/borrower-profiles', data);
    return res.data.data.profile as BorrowerProfile;
  },

  async updateBorrowerProfile(id: string, data: Partial<BorrowerProfile>) {
    const res = await apiClient.patch(`/credit/borrower-profiles/${id}`, data);
    return res.data.data.profile as BorrowerProfile;
  },

  async deleteBorrowerProfile(id: string) {
    await apiClient.delete(`/credit/borrower-profiles/${id}`);
  },

  // Documents
  async listDocuments(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrower-profiles/${borrowerProfileId}/documents`);
    return res.data.data.documents as CreditDocument[];
  },

  async uploadDocument(borrowerProfileId: string, formData: FormData) {
    const res = await apiClient.post(`/credit/borrower-profiles/${borrowerProfileId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.document as CreditDocument;
  },

  async verifyDocument(documentId: string) {
    const res = await apiClient.post(`/credit/documents/${documentId}/verify`);
    return res.data.data.document as CreditDocument;
  },

  async rejectDocument(documentId: string, reason: string) {
    const res = await apiClient.post(`/credit/documents/${documentId}/reject`, { rejectionReason: reason });
    return res.data.data.document as CreditDocument;
  },

  async deleteDocument(documentId: string) {
    await apiClient.delete(`/credit/documents/${documentId}`);
  },

  // Credit Applications
  async listApplications(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/applications', { params });
    return res.data.data as { applications: CreditApplication[]; pagination: Pagination };
  },

  async getApplication(id: string) {
    const res = await apiClient.get(`/credit/applications/${id}`);
    return res.data.data.application as CreditApplication;
  },

  async createApplication(data: Partial<CreditApplication>) {
    const res = await apiClient.post('/credit/applications', data);
    return res.data.data.application as CreditApplication;
  },

  async updateApplication(id: string, data: Partial<CreditApplication>) {
    const res = await apiClient.patch(`/credit/applications/${id}`, data);
    return res.data.data.application as CreditApplication;
  },

  async deleteApplication(id: string) {
    await apiClient.delete(`/credit/applications/${id}`);
  },

  // State Machine Transitions
  async transitionApplication(id: string, data: { action: string; reason?: string }) {
    const res = await apiClient.post(`/credit/applications/${id}/transition`, data);
    return res.data.data.application as CreditApplication;
  },

  async getApplicationTransitions(id: string) {
    const res = await apiClient.get(`/credit/applications/${id}/transitions`);
    return res.data.data.transitions as ApplicationTransition[];
  },

  async getApplicationAudit(id: string) {
    const res = await apiClient.get(`/credit/applications/${id}/audit`);
    return res.data.data.audit as CreditAuditEvent[];
  },

  // Facilities
  async listFacilities(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/facilities`);
    return res.data.data.facilities as CreditFacility[];
  },

  async createFacility(applicationId: string, data: Partial<CreditFacility>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/facilities`, data);
    return res.data.data.facility as CreditFacility;
  },

  async updateFacility(id: string, data: Partial<CreditFacility>) {
    const res = await apiClient.patch(`/credit/facilities/${id}`, data);
    return res.data.data.facility as CreditFacility;
  },

  async deleteFacility(id: string) {
    await apiClient.delete(`/credit/facilities/${id}`);
  },

  // Parties
  async listParties(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/parties`);
    return res.data.data.parties as CreditApplicationParty[];
  },

  async createParty(applicationId: string, data: Partial<CreditApplicationParty>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/parties`, data);
    return res.data.data.party as CreditApplicationParty;
  },

  // Approvals
  async listApprovals(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/approvals`);
    return res.data.data.approvals as CreditApproval[];
  },

  async submitApproval(applicationId: string, data: { decision: ApprovalDecision; comment?: string; isCommitteeVote?: boolean }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/approvals`, data);
    return res.data.data.approval as CreditApproval;
  },

  // Approval Matrices
  async listApprovalMatrices(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/approval-matrices', { params });
    return res.data.data as { matrices: ApprovalMatrix[]; pagination: Pagination };
  },

  async lookupApprovalAuthority(data: { exposure: number; riskRating: string }) {
    const res = await apiClient.post('/credit/approval-matrices/lookup', data);
    return res.data.data as ApprovalMatrixLookup;
  },

  // Legacy compat methods
  async submitApplication(id: string) {
    return creditService.transitionApplication(id, { action: 'submit' });
  },

  async approveApplication(id: string, data: { approvedAmount?: number; interestRate?: number }) {
    const res = await apiClient.post(`/credit/applications/${id}/approve`, data);
    return res.data.data.application as CreditApplication;
  },

  async rejectApplication(id: string, reason: string) {
    const res = await apiClient.post(`/credit/applications/${id}/reject`, { rejectionReason: reason });
    return res.data.data.application as CreditApplication;
  },

  // Dashboard stats
  async getDashboard() {
    const res = await apiClient.get('/credit/dashboard');
    return res.data.data as {
      totalBorrowers: number;
      pendingReviews: number;
      approvedToday: number;
      totalDisbursed: number;
      recentActivities: Array<{ id: string; type: string; description: string; createdAt: string }>;
    };
  },
};

// ── Sprint 3: Financial Spreading API ──────────────────────────

export const financialApi = {
  async listStatements(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrowers/${borrowerProfileId}/financials`);
    return res.data.data.statements as FinancialStatement[];
  },

  async createStatement(borrowerProfileId: string, data: {
    statementType: FinancialStatementType;
    period: FinancialPeriod;
    periodDate: string;
    currency?: CurrencyCode;
  }) {
    const res = await apiClient.post(`/credit/borrowers/${borrowerProfileId}/financials`, data);
    return res.data.data.statement as FinancialStatement;
  },

  async getStatement(id: string) {
    const res = await apiClient.get(`/credit/financials/${id}`);
    return res.data.data.statement as FinancialStatement;
  },

  async updateStatement(id: string, data: Partial<FinancialStatement>) {
    const res = await apiClient.patch(`/credit/financials/${id}`, data);
    return res.data.data.statement as FinancialStatement;
  },

  async deleteStatement(id: string) {
    await apiClient.delete(`/credit/financials/${id}`);
  },

  async listLineItems(statementId: string) {
    const res = await apiClient.get(`/credit/financials/${statementId}/line-items`);
    return res.data.data.lineItems as FinancialLineItem[];
  },

  async upsertLineItems(statementId: string, items: Array<{ lineKey: string; lineLabel: string; amount: number; displayOrder: number; id?: string }>) {
    const res = await apiClient.post(`/credit/financials/${statementId}/line-items`, { items });
    return res.data.data.lineItems as FinancialLineItem[];
  },

  async validateBalanceSheet(statementId: string) {
    const res = await apiClient.post(`/credit/financials/${statementId}/validate`);
    return res.data.data as { valid: boolean; difference: number; totalAssets: number; totalLiabilitiesEquity: number };
  },

  async submitForReview(statementId: string) {
    const res = await apiClient.post(`/credit/financials/${statementId}/submit`);
    return res.data.data.statement as FinancialStatement;
  },

  async reviewStatement(statementId: string, data: { decision: 'APPROVED' | 'REJECTED'; comment?: string }) {
    const res = await apiClient.post(`/credit/financials/${statementId}/review`, data);
    return res.data.data.statement as FinancialStatement;
  },

  async computeRatios(statementId: string) {
    const res = await apiClient.post(`/credit/financials/${statementId}/compute-ratios`);
    return res.data.data.ratios as FinancialRatio[];
  },

  async listRatios(statementId: string) {
    const res = await apiClient.get(`/credit/financials/${statementId}/ratios`);
    return res.data.data.ratios as FinancialRatio[];
  },
};

// ── Sprint 3: Trend API ───────────────────────────────────────

export const trendApi = {
  async getTrends(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrowers/${borrowerProfileId}/trends`);
    return res.data.data as TrendAnalysis;
  },
};

// ── Sprint 3: Exposure API ─────────────────────────────────────

export const exposureApi = {
  async getExposure(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrowers/${borrowerProfileId}/exposure`);
    return res.data.data as ExposureSummary;
  },
};

// ── Sprint 3: Scorecard API ───────────────────────────────────

export const scorecardApi = {
  async list(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/scorecards', { params });
    return res.data.data.scorecards as CreditScorecard[];
  },

  async create(data: { name: string; description?: string; productType?: CreditProductType }) {
    const res = await apiClient.post('/credit/scorecards', data);
    return res.data.data.scorecard as CreditScorecard;
  },

  async get(id: string) {
    const res = await apiClient.get(`/credit/scorecards/${id}`);
    return res.data.data.scorecard as CreditScorecard;
  },

  async update(id: string, data: Partial<CreditScorecard>) {
    const res = await apiClient.patch(`/credit/scorecards/${id}`, data);
    return res.data.data.scorecard as CreditScorecard;
  },

  async delete(id: string) {
    await apiClient.delete(`/credit/scorecards/${id}`);
  },

  async listVersions(scorecardId: string) {
    const res = await apiClient.get(`/credit/scorecards/${scorecardId}/versions`);
    return res.data.data.versions as CreditScorecardVersion[];
  },

  async createVersion(scorecardId: string, data: { factors: Array<{ key: string; label: string; weight: number }> }) {
    const res = await apiClient.post(`/credit/scorecards/${scorecardId}/versions`, data);
    return res.data.data.version as CreditScorecardVersion;
  },

  async activateVersion(versionId: string) {
    const res = await apiClient.post(`/credit/scorecard-versions/${versionId}/activate`);
    return res.data.data.version as CreditScorecardVersion;
  },
};

// ── Sprint 3: Scoring API ─────────────────────────────────────

export const scoringApi = {
  async executeScore(applicationId: string) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/score`);
    return res.data.data.scoreRun as CreditScoreRun;
  },

  async listScores(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/scores`);
    return res.data.data.scoreRuns as CreditScoreRun[];
  },

  async overrideScore(scoreRunId: string, data: { rating: RiskRating; reason: string; approverId: string }) {
    const res = await apiClient.post(`/credit/score-runs/${scoreRunId}/override`, data);
    return res.data.data.scoreRun as CreditScoreRun;
  },
};

export default creditService;