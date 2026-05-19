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

export interface Director {
  id: string;
  borrowerProfileId: string;
  contactId: string | null;
  name: string;
  nricPassportEncrypted: string | null;
  position: string | null;
  appointmentDate: string | null;
  resignationDate: string | null;
  isExecutive: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: { id: string; firstName: string; lastName: string; email: string | null };
}

export interface Shareholder {
  id: string;
  borrowerProfileId: string;
  contactId: string | null;
  name: string;
  nricPassportEncrypted: string | null;
  shareholdingPct: number | null;
  shareClass: string | null;
  numberOfShares: number | null;
  createdAt: string;
  updatedAt: string;
  contact?: { id: string; firstName: string; lastName: string; email: string | null };
}

export interface UltimateBeneficialOwner {
  id: string;
  borrowerProfileId: string;
  name: string;
  nricPassportEncrypted: string | null;
  ownershipPct: number;
  isPep: boolean;
  sourceOfWealth: string | null;
  countryOfResidence: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BorrowerProfile {
  id: string;
  borrowerType: string;
  accountId: string | null;
  contactId: string | null;
  creditRiskRating: string | null;
  amlRiskTier: string | null;
  exposureLimit: number | string | null;
  totalExposure: number | string | null;
  isSanctionedEntity: boolean;
  sourceOfWealth: string | null;
  purposeOfAccount: string | null;
  occupation: string | null;
  employer: string | null;
  annualIncome: number | string | null;
  netWorth: number | string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string } | null;
  contact?: { id: string; firstName: string; lastName: string; email: string | null } | null;
  directors?: Director[];
  shareholders?: Shareholder[];
  beneficialOwners?: UltimateBeneficialOwner[];
  // Legacy compat — may be populated by list endpoints
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
  applicationNo: string;
  borrowerProfileId: string;
  productType: CreditProductType;
  requestedAmount: number;
  requestedTenor: number | null;
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
  withdrawalReason: string | null;
  closedAt: string | null;
  withdrawnAt: string | null;
  deletedAt: string | null;
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
  eventType: string;
  action: string;
  actorId: string | null;
  oldState: string | null;
  newState: string | null;
  metadata: Record<string, any> | null;
  hash: string | null;
  createdAt: string;
  actor?: { firstName: string; lastName: string; email: string };
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
  fiscalYearEnd: string;
  currency: CurrencyCode;
  status: FinancialStatus;
  enteredById: string;
  reviewedById: string | null;
  enteredBy: CreditUserRef | null;
  reviewedBy: CreditUserRef | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: FinancialLineItem[];
  ratios?: FinancialRatio[];
  _count?: { lineItems: number; ratios: number };
}

export interface FinancialLineItem {
  id?: string;
  financialStatementId: string;
  lineKey: string;
  lineLabel: string;
  amount: number | string;
  displayOrder: number;
  parentLineKey?: string | null;
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

export interface TrendDataPoint {
  fiscalYearEnd: string;
  statementId: string;
  value: number;
}

export interface TrendItem {
  ratioKey: string;
  ratioLabel: string;
  category: RatioCategory;
  dataPoints: TrendDataPoint[];
  direction: 'improving' | 'stable' | 'declining';
}

export interface TrendAnalysis {
  borrowerProfileId: string;
  statements: number;
  trends: TrendItem[];
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
    const res = await apiClient.get('/credit/borrowers', { params });
    return res.data.data as { profiles: BorrowerProfile[]; pagination: Pagination };
  },

  async getBorrowerProfile(id: string) {
    const res = await apiClient.get(`/credit/borrowers/${id}`);
    return res.data.data.profile as BorrowerProfile;
  },

  async createBorrowerProfile(data: Partial<BorrowerProfile>) {
    const res = await apiClient.post('/credit/borrowers', data);
    return res.data.data.profile as BorrowerProfile;
  },

  async updateBorrowerProfile(id: string, data: Partial<BorrowerProfile>) {
    const res = await apiClient.patch(`/credit/borrowers/${id}`, data);
    return res.data.data.profile as BorrowerProfile;
  },

  async deleteBorrowerProfile(id: string) {
    await apiClient.delete(`/credit/borrowers/${id}`);
  },

  // Documents
  async listDocuments(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrowers/${borrowerProfileId}/documents`);
    return res.data.data.documents as CreditDocument[];
  },

  async uploadDocument(borrowerProfileId: string, formData: FormData) {
    const res = await apiClient.post(`/credit/borrowers/${borrowerProfileId}/documents`, formData, {
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
    return (res.data.data.events || res.data.data.audit || []) as CreditAuditEvent[];
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
    return (res.data.data.decisions || res.data.data.approvals || []) as CreditApproval[];
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
    fiscalYearEnd: string;
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

  async reviewStatement(statementId: string, data: { decision: 'approve' | 'reject'; comment?: string }) {
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

// ── Sprint 4: Committee Types ─────────────────────────────────

export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MeetingType = 'CREDIT_COMMITTEE' | 'RISK_COMMITTEE' | 'MANAGEMENT' | 'ADHOC';
export type MemberRole = 'CHAIR' | 'SECRETARY' | 'MEMBER';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type DecisionType = 'APPROVE' | 'REJECT' | 'DEFER' | 'ESCALATE';
export type VoteChoice = 'APPROVE' | 'REJECT' | 'ABSTAIN';

export interface CommitteeMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  quorumMin: number;
  meetingType: MeetingType;
  status: MeetingStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator?: CreditUserRef;
  members?: CommitteeMember[];
  agendaItems?: CommitteeAgendaItem[];
  _count?: { members: number; agendaItems: number };
}

export interface CommitteeMember {
  id: string;
  meetingId: string;
  userId: string;
  role: MemberRole;
  attendance: AttendanceStatus;
  joinedAt: string | null;
  createdAt: string;
  user?: CreditUserRef;
}

export interface CommitteeAgendaItem {
  id: string;
  meetingId: string;
  applicationId: string;
  decisionType: DecisionType;
  displayOrder: number;
  memoGenerated: boolean;
  finalizedAt: string | null;
  finalizedBy: string | null;
  finalDecision: DecisionType | null;
  createdAt: string;
  application?: CreditApplication;
  votes?: CommitteeVote[];
  finalizer?: CreditUserRef;
}

export interface CommitteeVote {
  id: string;
  agendaItemId: string;
  memberId: string;
  vote: VoteChoice;
  comment: string | null;
  votedAt: string;
  member?: CommitteeMember;
}

// ── Sprint 4: Collateral Types ────────────────────────────────

export type CollateralType = 'PROPERTY' | 'VEHICLE' | 'FIXED_DEPOSIT' | 'SHARES' | 'INSURANCE' | 'MACHINERY' | 'INVENTORY' | 'RECEIVABLES' | 'OTHER';
export type LienStatus = 'ACTIVE' | 'DISCHARGED';

export interface Collateral {
  id: string;
  applicationId: string;
  collateralType: CollateralType;
  description: string;
  ownershipDoc: string | null;
  registeredOwner: string | null;
  createdAt: string;
  updatedAt: string;
  valuations?: CollateralValuation[];
  liens?: CollateralLien[];
  insurance?: InsuranceCover[];
}

export interface CollateralValuation {
  id: string;
  collateralId: string;
  valuedAmount: number;
  currency: CurrencyCode;
  valuedAt: string;
  valuer: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CollateralLien {
  id: string;
  collateralId: string;
  lienHolder: string;
  lienAmount: number | null;
  currency: CurrencyCode;
  status: LienStatus;
  registeredAt: string;
  dischargedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InsuranceCover {
  id: string;
  collateralId: string;
  insurerName: string;
  policyNumber: string;
  coverAmount: number;
  currency: CurrencyCode;
  validFrom: string;
  validTo: string;
  createdAt: string;
}

// ── Sprint 4: Guarantee Types ─────────────────────────────────

export type GuaranteeType = 'PERSONAL' | 'CORPORATE' | 'BANK' | 'GOVERNMENT' | 'OTHER';

export interface Guarantee {
  id: string;
  applicationId: string;
  guarantorId: string;
  guarantorName: string;
  guaranteeType: GuaranteeType;
  amount: number;
  currency: CurrencyCode;
  documentRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Sprint 4: Condition Types ─────────────────────────────────

export type ConditionStatus = 'PENDING' | 'WAIVED' | 'COMPLETED' | 'EXPIRED';
export type ConditionCategory = 'PRE_DISBURSEMENT' | 'POST_DISBURSEMENT' | 'FINANCIAL_COVENANT' | 'REPORTING' | 'OTHER';

export interface ConditionPrecedent {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  category: ConditionCategory;
  status: ConditionStatus;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  waiverReason: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completer?: CreditUserRef;
  waiver?: CreditUserRef;
}

export interface ConditionWaiver {
  conditionId: string;
  reason: string;
  waivedBy: string;
}

export interface CpCompletionStatus {
  applicationId: string;
  totalConditions: number;
  completedCount: number;
  waivedCount: number;
  pendingCount: number;
  isComplete: boolean;
}

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

// ── Sprint 4: Committee API ─────────────────────────────────

export const committeeApi = {
  async listMeetings(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/committee/meetings', { params });
    return res.data.data as { meetings: CommitteeMeeting[]; pagination: Pagination };
  },

  async getMeeting(id: string) {
    const res = await apiClient.get(`/credit/committee/meetings/${id}`);
    return res.data.data.meeting as CommitteeMeeting;
  },

  async createMeeting(data: {
    title: string;
    scheduledAt: string;
    location?: string;
    quorumMin: number;
    meetingType: MeetingType;
  }) {
    const res = await apiClient.post('/credit/committee/meetings', data);
    return res.data.data.meeting as CommitteeMeeting;
  },

  async updateMeeting(id: string, data: Partial<CommitteeMeeting>) {
    const res = await apiClient.patch(`/credit/committee/meetings/${id}`, data);
    return res.data.data.meeting as CommitteeMeeting;
  },

  async deleteMeeting(id: string) {
    await apiClient.delete(`/credit/committee/meetings/${id}`);
  },

  async addMember(meetingId: string, data: { userId: string; role: MemberRole }) {
    const res = await apiClient.post(`/credit/committee/meetings/${meetingId}/members`, data);
    return res.data.data.member as CommitteeMember;
  },

  async removeMember(meetingId: string, userId: string) {
    await apiClient.delete(`/credit/committee/meetings/${meetingId}/members/${userId}`);
  },

  async updateAttendance(meetingId: string, userId: string, data: { attendance: AttendanceStatus }) {
    const res = await apiClient.patch(`/credit/committee/meetings/${meetingId}/members/${userId}/attendance`, data);
    return res.data.data.member as CommitteeMember;
  },

  async checkQuorum(meetingId: string) {
    const res = await apiClient.get(`/credit/committee/meetings/${meetingId}/quorum`);
    return res.data.data as { quorumMet: boolean; presentCount: number; quorumMin: number };
  },

  async addAgendaItem(meetingId: string, data: { applicationId: string; decisionType: DecisionType; displayOrder?: number }) {
    const res = await apiClient.post(`/credit/committee/meetings/${meetingId}/agenda`, data);
    return res.data.data.agendaItem as CommitteeAgendaItem;
  },

  async removeAgendaItem(itemId: string) {
    await apiClient.delete(`/credit/committee/agenda/${itemId}`);
  },

  async castVote(agendaItemId: string, data: { memberId: string; vote: VoteChoice; comment?: string }) {
    const res = await apiClient.post(`/credit/committee/agenda/${agendaItemId}/vote`, data);
    return res.data.data.vote as CommitteeVote;
  },

  async getVoteResults(agendaItemId: string) {
    const res = await apiClient.get(`/credit/committee/agenda/${agendaItemId}/results`);
    return res.data.data as { approve: number; reject: number; abstain: number; total: number; votes: CommitteeVote[] };
  },

  async finalizeDecision(agendaItemId: string, data: { decision: DecisionType }) {
    const res = await apiClient.post(`/credit/committee/agenda/${agendaItemId}/finalize`, data);
    return res.data.data.agendaItem as CommitteeAgendaItem;
  },

  async generateMemo(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/memo`);
    return res.data.data as { memo: string; generatedAt: string };
  },
};

// ── Sprint 4: Collateral API ─────────────────────────────────

export const collateralApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/collateral`);
    return res.data.data.collateral as Collateral[];
  },

  async create(applicationId: string, data: {
    collateralType: CollateralType;
    description: string;
    ownershipDoc?: string;
    registeredOwner?: string;
  }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/collateral`, data);
    return res.data.data.collateral as Collateral;
  },

  async get(id: string) {
    const res = await apiClient.get(`/credit/collateral/${id}`);
    return res.data.data.collateral as Collateral;
  },

  async update(id: string, data: Partial<Collateral>) {
    const res = await apiClient.patch(`/credit/collateral/${id}`, data);
    return res.data.data.collateral as Collateral;
  },

  async delete(id: string) {
    await apiClient.delete(`/credit/collateral/${id}`);
  },

  async addValuation(collateralId: string, data: {
    valuedAmount: number;
    currency: CurrencyCode;
    valuedAt: string;
    valuer?: string;
    notes?: string;
  }) {
    const res = await apiClient.post(`/credit/collateral/${collateralId}/valuations`, data);
    return res.data.data.valuation as CollateralValuation;
  },

  async listValuations(collateralId: string) {
    const res = await apiClient.get(`/credit/collateral/${collateralId}/valuations`);
    return res.data.data.valuations as CollateralValuation[];
  },

  async addLien(collateralId: string, data: {
    lienHolder: string;
    lienAmount?: number;
    currency: CurrencyCode;
    notes?: string;
  }) {
    const res = await apiClient.post(`/credit/collateral/${collateralId}/liens`, data);
    return res.data.data.lien as CollateralLien;
  },

  async listLiens(collateralId: string) {
    const res = await apiClient.get(`/credit/collateral/${collateralId}/liens`);
    return res.data.data.liens as CollateralLien[];
  },

  async dischargeLien(lienId: string) {
    const res = await apiClient.patch(`/credit/liens/${lienId}/discharge`);
    return res.data.data.lien as CollateralLien;
  },

  async addInsurance(collateralId: string, data: {
    insurerName: string;
    policyNumber: string;
    coverAmount: number;
    currency: CurrencyCode;
    validFrom: string;
    validTo: string;
  }) {
    const res = await apiClient.post(`/credit/collateral/${collateralId}/insurance`, data);
    return res.data.data.insurance as InsuranceCover;
  },

  async listInsurance(collateralId: string) {
    const res = await apiClient.get(`/credit/collateral/${collateralId}/insurance`);
    return res.data.data.insurance as InsuranceCover[];
  },
};

// ── Sprint 4: Guarantee API ─────────────────────────────────

export const guaranteeApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/guarantees`);
    return res.data.data.guarantees as Guarantee[];
  },

  async create(applicationId: string, data: {
    guarantorId: string;
    guarantorName: string;
    guaranteeType: GuaranteeType;
    amount: number;
    currency: CurrencyCode;
    documentRef?: string;
  }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/guarantees`, data);
    return res.data.data.guarantee as Guarantee;
  },

  async get(id: string) {
    const res = await apiClient.get(`/credit/guarantees/${id}`);
    return res.data.data.guarantee as Guarantee;
  },

  async update(id: string, data: Partial<Guarantee>) {
    const res = await apiClient.patch(`/credit/guarantees/${id}`, data);
    return res.data.data.guarantee as Guarantee;
  },

  async delete(id: string) {
    await apiClient.delete(`/credit/guarantees/${id}`);
  },
};

// ── Sprint 4: Condition API ─────────────────────────────────

export const conditionApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/conditions`);
    return res.data.data.conditions as ConditionPrecedent[];
  },

  async create(applicationId: string, data: {
    title: string;
    description?: string;
    category: ConditionCategory;
    dueDate?: string;
  }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/conditions`, data);
    return res.data.data.condition as ConditionPrecedent;
  },

  async get(id: string) {
    const res = await apiClient.get(`/credit/conditions/${id}`);
    return res.data.data.condition as ConditionPrecedent;
  },

  async update(id: string, data: Partial<ConditionPrecedent>) {
    const res = await apiClient.patch(`/credit/conditions/${id}`, data);
    return res.data.data.condition as ConditionPrecedent;
  },

  async completeCondition(id: string) {
    const res = await apiClient.post(`/credit/conditions/${id}/complete`);
    return res.data.data.condition as ConditionPrecedent;
  },

  async waiveCondition(id: string, data: { reason: string }) {
    const res = await apiClient.post(`/credit/conditions/${id}/waive`, data);
    return res.data.data.condition as ConditionPrecedent;
  },

  async checkCpCompletion(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/cp-completion`);
    return res.data.data as CpCompletionStatus;
  },
};

// ── Sprint 5: Dashboard API ─────────────────────────────────

export const dashboardApi = {
  getPipelineDashboard: () => apiClient.get('/credit/dashboard/pipeline'),
  getApprovalInbox: () => apiClient.get('/credit/dashboard/approval-inbox'),
  getExposureDashboard: () => apiClient.get('/credit/dashboard/exposure'),
  getCommitteeCalendar: () => apiClient.get('/credit/dashboard/committee-calendar'),
};

export default creditService;