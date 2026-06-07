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
  | 'BANK_GUARANTEE' | 'TRADE_FINANCE' | 'BRIDGE_LOAN' | 'PROJECT_FINANCE'
  // CA Memo Phase 2 — Islamic variants (match Prisma enum)
  | 'REVOLVING' | 'LC' | 'BG' | 'TRUST_RECEIPT' | 'BRIDGING'
  | 'CASHLINE' | 'RWC_I' | 'LC_I' | 'BG_I' | 'ICMTD_I';

export type CaRequestType =
  | 'FACILITY_RENEWAL' | 'VARIATION' | 'POLICY_BREACH_RATIFICATION' | 'SICR_IMPAIRMENT';

export type CurrencyCode = 'MYR' | 'USD' | 'SGD' | 'GBP' | 'EUR' | 'JPY' | 'CNY' | 'THB' | 'IDR' | 'AUD' | 'HKD';

export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE' | 'CONDITIONAL';

// §2.8 — AML Rescreen Event types
export type AmlRescreenOutcome = 'CLEAR' | 'POTENTIAL_HIT' | 'CONFIRMED_HIT' | 'FALSE_POSITIVE';
export type AmlRescreenAction = 'NO_ACTION' | 'ESCALATED_TO_COMPLIANCE' | 'RELATIONSHIP_EXITED' | 'FILED_STR';

export interface AmlRescreenEvent {
  id: string;
  borrowerProfileId: string;
  applicationId: string | null;
  triggeredById: string;
  triggeredAt: string;
  screeningSource: string;
  outcome: AmlRescreenOutcome;
  hitDetails: string | null;
  actionTaken: AmlRescreenAction;
  actionNotes: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  triggeredBy?: { id: string; firstName: string; lastName: string; email: string };
  reviewedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
}


// CA Memo Phase 1 — header classification enums
export type ApplicationType = 'NEW' | 'ADDITIONAL' | 'RENEWAL' | 'VARIATION';
export type AccountClassification =
  | 'PERFORMING' | 'EARLY_CARE' | 'WATCHLIST' | 'NON_CCRIS_RR' | 'CCRIS_RR' | 'IMPAIRED';
export type AccountStrategy = 'GROW' | 'MAINTAIN' | 'EXIT';

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
  // Phase 4
  dateOfBirth: string | null;
  nationality: string | null;
  experienceQualification: string | null;
  isKeyManagement: boolean;
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
  // Phase 4
  dateOfBirthOrIncorporation: string | null;
  nationality: string | null;
  businessRegNo: string | null;
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
  name?: string | null;
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
  contact?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; mobile: string | null; jobTitle: string | null; dateOfBirth: string | null; nricPassport: string | null } | null;
  directors?: Director[];
  shareholders?: Shareholder[];
  beneficialOwners?: UltimateBeneficialOwner[];
  // Legacy compat — may be populated by list endpoints
  documents?: CreditDocument[];
  applications?: CreditApplication[];
  financialStatements?: FinancialStatement[];
  _count?: { documents: number; applications: number };
}

export interface CreateBorrowerProfilePayload {
  borrowerType: 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR';
  name?: string | null;
  accountId?: string | null;
  contactId?: string | null;
}

export interface CreditDocument {
  id: string;
  borrowerProfileId: string;
  documentType: DocumentType;
  classification?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  verificationStatus: DocumentStatus | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
  uploadedBy: string;
  createdAt?: string;
  uploader?: CreditUserRef;
  verifier?: CreditUserRef;
}

/**
...[truncated]
 * Prisma returns assignedRm / assignedAnalyst / assignedRmId / assignedAnalystId,
 * but the frontend interface uses rm / analyst / rmId / analystId.
 */
function normalizeApplication(raw: any): CreditApplication {
  if (!raw) return raw;
  const app = { ...raw };
  if ('assignedRm' in app) {
    app.rm = app.assignedRm;
    delete app.assignedRm;
  }
  if ('assignedAnalyst' in app) {
    app.analyst = app.assignedAnalyst;
    delete app.assignedAnalyst;
  }
  if ('assignedRmId' in app) {
    app.rmId = app.assignedRmId;
    delete app.assignedRmId;
  }
  if ('assignedAnalystId' in app) {
    app.analystId = app.assignedAnalystId;
    delete app.assignedAnalystId;
  }
  return app as CreditApplication;
}

export interface CreditApplication {
  id: string;
  applicationNo: string;
  borrowerProfileId: string;
  productType: CreditProductType;
  requestedAmount: number;
  requestedTenor: number | null;
  currency: CurrencyCode;
  purpose: string | null;
  state: ApplicationState;
  riskRating: string | null;
  rmId: string | null;
  analystId: string | null;
  submittedAt: string | null;
  decisionedAt: string | null;
  rejectionReason: string | null;
  withdrawalReason: string | null;
  closedAt: string | null;
  withdrawnAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // CA Memo Phase 1 — header
  customerGroupName?: string | null;
  cifNo?: string | null;
  applicationType?: ApplicationType | null;
  originatingDepartment?: string | null;
  teamLeadName?: string | null;
  referredBy?: string | null;
  accountClassification?: AccountClassification | null;
  connectedPartyFlag?: boolean;
  connectedPartyStaffName?: string | null;
  completeDocsDate?: string | null;
  lastReviewDate?: string | null;
  nextReviewDate?: string | null;
  relationshipSince?: string | null;
  lastSiteVisitDate?: string | null;
  // CA Memo Phase 1 — narratives
  preambleText?: string | null;
  mattersToHighlight?: string | null;
  transactionDetailsText?: string | null;
  // CA Memo Phase 1 — Section 9 hook
  accountStrategy?: AccountStrategy | null;
  crossSellingInitiatives?: string | null;
  // CA Memo Phase 3 — Section 7 Way Out narratives
  firstWayOut?: string | null;
  secondWayOut?: string | null;
  otherWayOut?: string | null;
  // Phase 5 sign-off timestamps
  preparedAt?: string | null;
  reviewedAt?: string | null;
  concurredAt?: string | null;
  // legacy compat
  status?: ApplicationState;
  productName?: string;
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
  currency?: CurrencyCode;
  amount: number | string;
  tenorMonths: number | null;
  ratePct: number | string | null;
  purpose: string | null;
  approvedAmount: number | string | null;
  approvedTenor: number | null;
  approvedRate: number | string | null;
  conditions?: string | null;
  // CA Memo Phase 2
  pricingLabel?: string | null;
  existingLimit?: number | string | null;
  proposedChange?: number | string | null;
  newLimit?: number | string | null;
  outstandingBalance?: number | string | null;
  undisbursedLimit?: number | string | null;
  approvingLevel?: string | null;
  requestItemId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  applicationId: string;
  requestType: CaRequestType;
  sortOrder: number;
  approvingLevel: string | null;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
  facilities?: Pick<CreditFacility, 'id' | 'facilityType' | 'amount'>[];
}

export interface ExposureSummary {
  id: string;
  applicationId: string;
  thisAppSecured: number | string | null;
  thisAppUnsecured: number | string | null;
  otherAppSecured: number | string | null;
  otherAppUnsecured: number | string | null;
  customerTotalSecured: number | string | null;
  customerTotalUnsecured: number | string | null;
  relatedCounterpartySecured: number | string | null;
  relatedCounterpartyUnsecured: number | string | null;
  groupTotalSecured: number | string | null;
  groupTotalUnsecured: number | string | null;
  createdAt: string;
  updatedAt: string;
}

// CA Memo Phase 3 types
export type MfrsStage = 'STAGE_1' | 'STAGE_2' | 'STAGE_3';
export type RatingAgency = 'RAM' | 'MARC' | 'SP' | 'MOODYS' | 'FITCH';
export type ProjectionScenario = 'BASE' | 'SCENARIO_1' | 'SCENARIO_2' | 'SCENARIO_3';

export interface ExternalRating {
  id: string;
  applicationId: string;
  subjectType: string;
  subjectName: string | null;
  agency: RatingAgency;
  rating: string;
  ratingDate: string | null;
  outlook: string | null;
  fiscalYear: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EclSnapshot {
  id: string;
  applicationId: string;
  subjectType: string;
  subjectName: string | null;
  snapshotDate: string;
  miaCount: number | null;
  mfrsStage: MfrsStage | null;
  totalOutstanding: number | string | null;
  pdPct: number | string | null;
  lgdPct: number | string | null;
  lossRatePct: number | string | null;
  eclAmount: number | string | null;
  potentialEclWriteback: number | string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EclForecast {
  id: string;
  applicationId: string;
  forecastYear: number;
  mfrsStage: MfrsStage | null;
  eclAmount: number | string | null;
  pdPct: number | string | null;
  lgdPct: number | string | null;
  assumptions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionLineItem {
  id: string;
  projectionId: string;
  lineKey: string;
  lineLabel: string;
  projectionYear: number;
  amount: number | string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CashflowProjection {
  id: string;
  applicationId: string;
  assumptions: string | null;
  lineItems: ProjectionLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SensitivityScenario {
  id: string;
  applicationId: string;
  scenario: ProjectionScenario;
  label: string | null;
  assumptions: string | null;
  revenueAmount: number | string | null;
  opCashflow: number | string | null;
  ebitda: number | string | null;
  financingCosts: number | string | null;
  gearingRatio: number | string | null;
  dscr: number | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditApplicationParty {
  id: string;
  applicationId: string;
  borrowerProfileId: string;
  role: string;
  liabilityPct: string | number | null;
  createdAt: string;
  updatedAt: string;
  borrowerProfile: {
    id: string;
    borrowerType: string;
    name?: string | null;
    account: { id: string; name: string } | null;
    contact: { id: string; firstName: string; lastName: string } | null;
  } | null;
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
  authorityLevel: string | null;
  approver?: { id: string; firstName: string; lastName: string; department: string | null } | null;
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
  requiredApproverCount: number;
  matrixName?: string;
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
  // CA Memo Phase 3 — Section 12 audit + commentary
  auditorName?: string | null;
  isQualified?: boolean | null;
  qualificationNotes?: string | null;
  isDraftAccounts?: boolean;
  commentarySalesProfitability?: string | null;
  commentaryAssetMgmt?: string | null;
  commentaryDebtMgmt?: string | null;
  commentaryCashflow?: string | null;
  commentaryConclusion?: string | null;
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
  statementId: string;
  ratioKey: string;
  ratioLabel: string;
  category: RatioCategory;
  value: number;
  previousValue: number | null;
  trend: 'UP' | 'DOWN' | 'STABLE' | null;
  // §1.4 — Threshold enrichment from backend
  threshold?: {
    ratioKey: string;
    passMin?: number;
    passMax?: number;
    warnMin?: number;
    warnMax?: number;
    unit: 'x' | '%' | 'days';
    formatHint: string;
  } | null;
  badge?: 'pass' | 'warn' | 'fail' | 'neutral';
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

export interface ExposureDashboardSummary {
  totalExposure: number;
  facilities: ExposureFacility[];
  limits: {
    exposureLimit: number | null;
    utilizationPct: number | null;
  };
}

export interface ExposureFacility {
  applicationId: string;
  facilityType: string;
  amount: number;
  approvedAmount: number | null;
  currency: string;
}

// ── Sprint 3: Scorecard Types ─────────────────────────────────

export interface CreditScorecard {
  id: string;
  name: string;
  description: string | null;
  productType: CreditProductType | null;
  activeVersionId: string | null;
  isActive: boolean;
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
  retailFactors: ScorecardFactor[];
  effectiveFrom: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  approvedBy?: CreditUserRef | null;
  createdAt: string;
  updatedAt: string;
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
  /** Factor scores keyed by factor key — the shape returned by the API */
  factorScores?: Record<string, { score: number; weight: number; weightedScore: number }>;
  overriddenRating: RiskRating | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  /** The timestamp when this score run was executed. API field name: runAt */
  runAt: string;
  /** @deprecated Use runAt — the API returns runAt, not executedAt */
  executedAt?: string;
  executedBy?: string;
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

/** Normalize a single CreditScoreRun so that factorBreakdown is always populated */
function normalizeScoreRun(run: CreditScoreRun): CreditScoreRun {
  if ((!run.factorBreakdown || run.factorBreakdown.length === 0) && run.factorScores) {
    run = { ...run, factorBreakdown: Object.entries(run.factorScores).map(([key, val]) => ({
      factorKey: key,
      factorLabel: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      score: Math.round(val.score * 10) / 10,   // round to 1 decimal (e.g. 93.3 instead of 93.333…)
      weight: val.weight / 100,   // API weight is pct (e.g. 30), interface expects ratio (0.30)
      weightedScore: Math.round(val.weightedScore * 10) / 10,
    }))};
  }
  return run;
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

  async createBorrowerProfile(data: CreateBorrowerProfilePayload) {
    const res = await apiClient.post('/credit/borrowers', data);
    return res.data.data.profile as BorrowerProfile;
  },

  async checkDuplicateBorrower(params: { ssm?: string; nric?: string }): Promise<{ exists: boolean; borrowerId?: string }> {
    const res = await apiClient.get('/credit/borrowers/check-duplicate', { params });
    return res.data.data as { exists: boolean; borrowerId?: string };
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

  async listApplicationDocuments(applicationId: string) {
    const res = await apiClient.get(`/credit/credit-documents`, { params: { applicationId } });
    return res.data.data.documents as CreditDocument[];
  },

  async uploadDocument(borrowerProfileId: string, formData: FormData) {
    const res = await apiClient.post(`/credit/borrowers/${borrowerProfileId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.document as CreditDocument;
  },

  async uploadApplicationDocument(borrowerProfileId: string, applicationId: string, formData: FormData) {
    formData.append('borrowerProfileId', borrowerProfileId);
    formData.append('applicationId', applicationId);
    const res = await apiClient.post(`/credit/credit-documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.document as CreditDocument;
  },

  async getDocumentDownloadUrl(documentId: string): Promise<string> {
    const res = await apiClient.get(`/credit/credit-documents/${documentId}/download`);
    return res.data.data.downloadUrl as string;
  },

  async verifyDocument(documentId: string) {
    const res = await apiClient.post(`/credit/credit-documents/${documentId}/verify`);
    return res.data.data.document as CreditDocument;
  },

  async rejectDocument(documentId: string, reason: string) {
    const res = await apiClient.post(`/credit/credit-documents/${documentId}/reject`, { rejectionReason: reason });
    return res.data.data.document as CreditDocument;
  },

  async deleteDocument(documentId: string) {
    await apiClient.delete(`/credit/documents/${documentId}`);
  },

  // Credit Applications
  async listApplications(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/applications', { params });
    const data = res.data.data as { applications: CreditApplication[]; pagination: Pagination };
    data.applications = data.applications.map(normalizeApplication);
    return data;
  },

  async getApplication(id: string) {
    const res = await apiClient.get(`/credit/applications/${id}`);
    return normalizeApplication(res.data.data.application);
  },

  async createApplication(data: Partial<CreditApplication>) {
    const res = await apiClient.post('/credit/applications', data);
    return normalizeApplication(res.data.data.application);
  },

  async updateApplication(id: string, data: Partial<CreditApplication>) {
    const res = await apiClient.patch(`/credit/applications/${id}`, data);
    return normalizeApplication(res.data.data.application);
  },

  async deleteApplication(id: string) {
    await apiClient.delete(`/credit/applications/${id}`);
  },

  async checkReadiness(id: string): Promise<{
    ready: boolean;
    errors: { field: string; message: string; severity: 'error' | 'warning' }[];
    warnings: { field: string; message: string; severity: 'error' | 'warning' }[];
    satisfied: { field: string; message: string; severity: 'info' }[];
  }> {
    const res = await apiClient.get(`/credit/applications/${id}/readiness`);
    return res.data.data;
  },

  async checkEsignReadiness(id: string): Promise<{ ready: boolean; signedLoo: { id: string; fileName: string; verificationStatus: string } | null }> {
    const res = await apiClient.get(`/credit/applications/${id}/esign-readiness`);
    return res.data.data;
  },

  async listFeatureFlags(): Promise<{ key: string; enabled: boolean }[]> {
    const res = await apiClient.get('/credit/feature-flags');
    return res.data.data.flags as { key: string; enabled: boolean }[];
  },

  // State Machine Transitions
  async transitionApplication(id: string, data: { action: string; reason?: string }) {
    const res = await apiClient.post(`/credit/applications/${id}/transition`, data);
    return normalizeApplication(res.data.data.application);
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
    const res = await apiClient.patch(`/credit/applications/facilities/${id}`, data);
    return res.data.data.facility as CreditFacility;
  },

  async deleteFacility(id: string) {
    await apiClient.delete(`/credit/applications/facilities/${id}`);
  },

  // ── Pricing Worksheet (§2.1) ───────────────────────────────────────────────
  async getPricingWorksheet(facilityId: string) {
    const res = await apiClient.get(`/credit/applications/${facilityId}/pricing`);
    return res.data.data.worksheet as any;
  },

  async upsertPricingWorksheet(facilityId: string, data: any) {
    const res = await apiClient.put(`/credit/applications/${facilityId}/pricing`, data);
    return res.data.data.worksheet as any;
  },

  async computePricingPreview(data: any, tenorMonths?: number) {
    const params = tenorMonths ? `?tenorMonths=${tenorMonths}` : '';
    const res = await apiClient.post(`/credit/applications/facilities/pricing/compute${params}`, data);
    return res.data.data as { effectiveRatePct: number; effectiveYieldPct: number | null };
  },

  // Request Items (CA Memo Phase 2)
  async listRequestItems(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/request-items`);
    return res.data.data.requestItems as RequestItem[];
  },

  async createRequestItem(applicationId: string, data: Partial<RequestItem>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/request-items`, data);
    return res.data.data.requestItem as RequestItem;
  },

  async updateRequestItem(applicationId: string, itemId: string, data: Partial<RequestItem>) {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/request-items/${itemId}`, data);
    return res.data.data.requestItem as RequestItem;
  },

  async deleteRequestItem(applicationId: string, itemId: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/request-items/${itemId}`);
  },

  // Exposure Summary (CA Memo Phase 2)
  async getExposureSummary(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/exposure-summary`);
    return res.data.data.exposureSummary as ExposureSummary | null;
  },

  async upsertExposureSummary(applicationId: string, data: Partial<ExposureSummary>) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/exposure-summary`, data);
    return res.data.data.exposureSummary as ExposureSummary;
  },

  // External Ratings (Phase 3)
  async listExternalRatings(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/external-ratings`);
    return res.data.data.externalRatings as ExternalRating[];
  },
  async createExternalRating(applicationId: string, data: Partial<ExternalRating>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/external-ratings`, data);
    return res.data.data.externalRating as ExternalRating;
  },
  async updateExternalRating(applicationId: string, ratingId: string, data: Partial<ExternalRating>) {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/external-ratings/${ratingId}`, data);
    return res.data.data.externalRating as ExternalRating;
  },
  async deleteExternalRating(applicationId: string, ratingId: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/external-ratings/${ratingId}`);
  },

  // ECL (Phase 3)
  async listEclSnapshots(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/ecl-snapshots`);
    return res.data.data.eclSnapshots as EclSnapshot[];
  },
  async createEclSnapshot(applicationId: string, data: Partial<EclSnapshot>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/ecl-snapshots`, data);
    return res.data.data.eclSnapshot as EclSnapshot;
  },
  async updateEclSnapshot(applicationId: string, snapshotId: string, data: Partial<EclSnapshot>) {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/ecl-snapshots/${snapshotId}`, data);
    return res.data.data.eclSnapshot as EclSnapshot;
  },
  async deleteEclSnapshot(applicationId: string, snapshotId: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/ecl-snapshots/${snapshotId}`);
  },
  async listEclForecasts(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/ecl-forecasts`);
    return res.data.data.eclForecasts as EclForecast[];
  },
  async upsertEclForecast(applicationId: string, year: number, data: Partial<EclForecast>) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/ecl-forecasts/${year}`, data);
    return res.data.data.eclForecast as EclForecast;
  },

  // Cashflow Projection (Phase 3)
  async getCashflowProjection(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/cashflow-projection`);
    return res.data.data.cashflowProjection as CashflowProjection | null;
  },
  async upsertCashflowProjection(applicationId: string, assumptions: string | null) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/cashflow-projection`, { assumptions });
    return res.data.data.cashflowProjection as CashflowProjection;
  },
  async upsertProjectionLines(applicationId: string, lines: Partial<ProjectionLineItem>[]) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/cashflow-projection/lines`, { lines });
    return res.data.data.cashflowProjection as CashflowProjection;
  },

  // Sensitivity Scenarios (Phase 3)
  async listSensitivityScenarios(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/sensitivity-scenarios`);
    return res.data.data.sensitivityScenarios as SensitivityScenario[];
  },
  async upsertSensitivityScenario(applicationId: string, scenario: ProjectionScenario, data: Partial<SensitivityScenario>) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/sensitivity-scenarios/${scenario}`, data);
    return res.data.data.sensitivityScenario as SensitivityScenario;
  },

  // Parties
  async listParties(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/parties`);
    return res.data.data.parties as CreditApplicationParty[];
  },

  async createParty(applicationId: string, data: { borrowerProfileId: string; role: string; liabilityPct?: string | number | null }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/parties`, data);
    return res.data.data.party as CreditApplicationParty;
  },

  // Approvals
  async listApprovals(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/approvals`);
    return (res.data.data.decisions || res.data.data.approvals || []) as CreditApproval[];
  },

  async submitApproval(applicationId: string, data: { decision: ApprovalDecision; comment?: string; isCommitteeVote?: boolean; rejectionReasonCode?: string; conditions?: { title: string; description?: string; category?: string; conditionType?: string; dueDate?: string | null }[] }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/approvals`, data);
    return res.data.data.approval as CreditApproval;
  },

  // §2.7 — Rejection reason codes
  async listRejectionReasonCodes() {
    const res = await apiClient.get('/credit/applications/rejection-reasons');
    return res.data.data as { value: string; label: string }[];
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

  // CA Memo PDF download (authenticated blob)
  async downloadCaMemo(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/ca-memo`, {
      responseType: 'blob',
    });
    return res;
  },

  // Approval Pack Preview (Wave 3)
  getApprovalPackUrl(applicationId: string, format: 'html' | 'pdf' = 'html'): string {
    const base = (apiClient as any).defaults?.baseURL || '';
    return `${base}/credit/applications/${applicationId}/approval-pack?format=${format}`;
  },

  async getApprovalPackHtml(applicationId: string): Promise<string> {
    const res = await apiClient.get(`/credit/applications/${applicationId}/approval-pack?format=html`, {
      responseType: 'text',
    });
    return res.data as string;
  },

  async downloadApprovalPackPdf(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/approval-pack?format=pdf`, {
      responseType: 'blob',
    });
    return res;
  },

  // Credit Scoring (Phase 4C)
  async listScoreRuns(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/scores`);
    const runs = res.data.data.scoreRuns as CreditScoreRun[];
    return runs.map(normalizeScoreRun);
  },

  async executeScore(applicationId: string) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/score`);
    return normalizeScoreRun(res.data.data.scoreRun as CreditScoreRun);
  },

  async overrideScore(scoreRunId: string, data: { rating: RiskRating; reason: string; approverId: string }) {
    const res = await apiClient.post(`/credit/score-runs/${scoreRunId}/override`, data);
    return normalizeScoreRun(res.data.data.scoreRun as CreditScoreRun);
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
    return res.data.data as ExposureDashboardSummary;
  },
};

// ── Sprint 3: Scorecard API ───────────────────────────────────

export const scorecardApi = {
  async list(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/scorecards', { params });
    const raw = res.data.data;
    // API may return { scorecards, pagination } or direct array
    const list: any[] = raw.scorecards ?? raw;
    return list.map((sc: any) => ({
      ...sc,
      productType: sc.productType ?? null,
      activeVersionId: sc.activeVersionId ?? null,
      isActive: sc.isActive ?? true,
    })) as CreditScorecard[];
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
    // API returns flat factorWeights/retailFactorWeights objects — convert to ScorecardFactor[]
    const FACTOR_LABELS: Record<string, string> = {
      financial_performance: 'Financial Performance',
      leverage: 'Leverage',
      liquidity: 'Liquidity',
      cashflow: 'Cash Flow',
      management: 'Management Quality',
      industry: 'Industry Risk',
      collateral: 'Collateral Coverage',
      relationship: 'Relationship History',
      market_conditions: 'Market Conditions',
    };
    const toFactors = (obj: Record<string, number> | undefined): ScorecardFactor[] => {
      if (!obj || typeof obj !== 'object') return [];
      // If stored as {factors: [...]} (legacy), use that; otherwise flat key→weight
      if (Array.isArray((obj as any).factors)) return (obj as any).factors;
      return Object.entries(obj)
        .filter(([k]) => k in FACTOR_LABELS)
        .map(([key, weight]) => ({ key, label: FACTOR_LABELS[key] || key, weight: Number(weight) }));
    };
    const raw: any[] = res.data.data.versions;
    const mapped: CreditScorecardVersion[] = raw.map((v: any) => ({
      id: v.id,
      scorecardId: v.scorecardId,
      versionNumber: v.version ?? v.versionNumber ?? 0,
      isActive: v.isActive,
      factors: toFactors(v.factorWeights),
      retailFactors: toFactors(v.retailFactorWeights),
      effectiveFrom: v.effectiveFrom ?? null,
      approvedById: v.approvedById ?? v.createdBy ?? null,
      approvedAt: v.approvedAt ?? null,
      approvedBy: v.approvedBy ?? v.creator ?? null,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt ?? v.createdAt,
    }));
    return mapped;
  },

  async createVersion(scorecardId: string, data: {
    factors: Array<{ key: string; label: string; weight: number }>;
    retailFactors?: Array<{ key: string; label: string; weight: number }>;
  }) {
    // Transform factors array to { factorWeights: { key: weight, ... } } for backend
    const factorWeights: Record<string, number> = {};
    for (const f of data.factors) {
      factorWeights[f.key] = f.weight;
    }
    const payload: Record<string, unknown> = { factorWeights };
    if (data.retailFactors) {
      const retailFactorWeights: Record<string, number> = {};
      for (const f of data.retailFactors) {
        retailFactorWeights[f.key] = f.weight;
      }
      payload.retailFactorWeights = retailFactorWeights;
    }
    const res = await apiClient.post(`/credit/scorecards/${scorecardId}/versions`, payload);
    return res.data.data.version as CreditScorecardVersion;
  },

  async activateVersion(versionId: string) {
    const res = await apiClient.post(`/credit/scorecard-versions/${versionId}/activate`);
    return res.data.data.version as CreditScorecardVersion;
  },
};

// ── Sprint 4: Committee Types ─────────────────────────────────

export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MeetingType = 'REGULAR' | 'ADHOC';
export type MemberRole = 'CHAIR' | 'SECRETARY' | 'MEMBER';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';
export type DecisionType = 'APPROVE' | 'REJECT' | 'DEFER';
export type VoteChoice = 'APPROVE' | 'REJECT' | 'ABSTAIN';

export interface CommitteeMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  quorumMin: number;
  meetingType: MeetingType;
  status: MeetingStatus;
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
  decisionResult: DecisionType | null;
  decidedAt: string | null;
  createdAt: string;
  application?: CreditApplication;
  votes?: CommitteeVote[];
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

export type SecurityCategory = 'TANGIBLE' | 'SUPPORTING';

export interface Collateral {
  id: string;
  applicationId: string;
  collateralType: CollateralType;
  description: string;
  ownershipDoc: string | null;
  registeredOwner: string | null;
  // Phase 4 — dual valuation + classification
  securityCategory: SecurityCategory | null;
  securitySubType: string | null;
  isExisting: boolean;
  isNewToBeObtained: boolean;
  pmmdMarketValue: number | null;
  pmmdForcedSaleValue: number | null;
  panelValuerName: string | null;
  securityCoverageRatio: number | null;
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
  // Phase 4 — guarantor financial profile
  contingentLiabilities: number | null;
  estimatedNetWorth: number | null;
  guarantorRiskRatingSnapshot: string | null;
  remarks: string | null;
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
  conditionType: 'PRECEDENT' | 'SUBSEQUENT' | null;
  status: ConditionStatus;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  waiverReason: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  decisionId: string | null;
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
    return normalizeScoreRun(res.data.data.scoreRun as CreditScoreRun);
  },

  async listScores(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/scores`);
    return (res.data.data.scoreRuns as CreditScoreRun[]).map(normalizeScoreRun);
  },

  async overrideScore(scoreRunId: string, data: { rating: RiskRating; reason: string; approverId: string }) {
    const res = await apiClient.post(`/credit/score-runs/${scoreRunId}/override`, data);
    return normalizeScoreRun(res.data.data.scoreRun as CreditScoreRun);
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

  async reorderAgenda(meetingId: string, itemIds: string[]) {
    const res = await apiClient.put(`/credit/committee/meetings/${meetingId}/agenda/reorder`, { itemIds });
    return res.data.data.agendaItems as CommitteeAgendaItem[];
  },

  async generateMemo(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/memo`);
    return res.data.data as any;
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
    const res = await apiClient.post(`/credit/conditions/${id}/waive`, { waiverReason: data.reason });
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
  // §2.6 — Exposure Summary
  getExposureSummary: async (filters?: { rmId?: string; borrowerGroupId?: string; riskRating?: string }) => {
    const res = await apiClient.get('/credit/dashboard/exposure-summary', { params: filters });
    return res.data.data as ExposureSummary;
  },
};

// ── Reports API ─────────────────────────────────────────────

export interface PipelineStateCount {
  state: string;
  count: number;
  avgDaysInState: number;
}

export interface PipelineReport {
  states: PipelineStateCount[];
  totalApplications: number;
  slaBreachCount: number;
}

export interface ExposureByBorrower {
  borrowerProfileId: string;
  borrowerName: string;
  industry: string | null;
  totalExposure: number;
  rating: string | null;
}

export interface SectorBreakdown {
  sector: string;
  totalExposure: number;
  count: number;
}

export interface RatingDistribution {
  rating: string;
  count: number;
  totalExposure: number;
}

// §2.6 — Exposure Summary
export interface ExposureLimitEntry {
  borrowerProfileId: string;
  borrowerName: string;
  totalExposure: number;
  exposureLimit: number;
  utilisationPct: number;
}

export interface ExposureSummary {
  totalPortfolioExposure: number;
  topBorrowers: ExposureByBorrower[];
  ratingDistribution: RatingDistribution[];
  approachingLimit: ExposureLimitEntry[];
  breachedLimit: ExposureLimitEntry[];
  byProductType: Record<string, number>;
}

export interface ExposureReport {
  topBorrowers: ExposureByBorrower[];
  sectorBreakdown: SectorBreakdown[];
  ratingDistribution: RatingDistribution[];
  totalPortfolio: number;
}

export const reportsApi = {
  getPipelineReport: (params?: { dateFrom?: string; dateTo?: string; format?: 'json' | 'csv' }) => {
    const q = new URLSearchParams();
    if (params?.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params?.dateTo) q.set('dateTo', params.dateTo);
    if (params?.format === 'csv') q.set('format', 'csv');
    const qs = q.toString();
    return apiClient.get(`/credit/reports/pipeline${qs ? '?' + qs : ''}`, params?.format === 'csv' ? { responseType: 'blob' } : undefined);
  },
  getExposureReport: (params?: { topN?: number; format?: 'json' | 'csv' }) => {
    const q = new URLSearchParams();
    if (params?.topN) q.set('topN', String(params.topN));
    if (params?.format === 'csv') q.set('format', 'csv');
    const qs = q.toString();
    return apiClient.get(`/credit/reports/exposure${qs ? '?' + qs : ''}`, params?.format === 'csv' ? { responseType: 'blob' } : undefined);
  },
};

// ── Phase 4: Types ─────────────────────────────────────────

export type CounterpartyRole = 'SUPPLIER' | 'BUYER' | 'COMPETITOR';

export interface ProfitabilityLine {
  id: string;
  profitabilityId: string;
  productCategory: string;
  netProfitYtd: number | null;
  netProfitProjected: number | null;
  feeIncomeYtd: number | null;
  feeIncomeProjected: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfitability {
  id: string;
  applicationId: string;
  reportingPeriod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ProfitabilityLine[];
}

export interface WalletShare {
  id: string;
  applicationId: string;
  facilityType: string;
  ourLimitAmount: number | null;
  totalMarketAmount: number | null;
  ourSharePct: number | null;
  yoyChangePct: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KeyCounterparty {
  id: string;
  borrowerProfileId: string;
  role: CounterpartyRole;
  name: string;
  address: string | null;
  telephone: string | null;
  yearsOfRelationship: number | null;
  creditTermsDays: number | null;
  salesOrPurchasePct: number | null;
  modeOfPayment: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountUtilisationSnapshot {
  id: string;
  applicationId: string;
  accountNo: string;
  facilityType: string;
  snapshotMonth: string;
  withdrawalAmount: number | null;
  depositAmount: number | null;
  monthEndBalance: number | null;
  returnedChequesCount: number | null;
  approvedLimit: number | null;
  outstandingAmount: number | null;
  overdueAmount: number | null;
  instalmentsInArrears: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Phase 4: API ─────────────────────────────────────────

export const profitabilityApi = {
  async get(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/profitability`);
    return res.data as AccountProfitability | null;
  },
  async upsert(applicationId: string, data: { reportingPeriod?: string | null; notes?: string | null; lines?: any[] }) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/profitability`, data);
    return res.data as AccountProfitability;
  },
};

export const walletShareApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/wallet-shares`);
    return res.data as WalletShare[];
  },
  async bulkUpsert(applicationId: string, shares: Partial<WalletShare>[]) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/wallet-shares`, shares);
    return res.data as WalletShare[];
  },
  async remove(applicationId: string, shareId: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/wallet-shares/${shareId}`);
  },
};

export const keyCounterpartyApi = {
  async list(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrower-profiles/${borrowerProfileId}/counterparties`);
    return res.data as KeyCounterparty[];
  },
  async create(borrowerProfileId: string, data: Partial<KeyCounterparty>) {
    const res = await apiClient.post(`/credit/borrower-profiles/${borrowerProfileId}/counterparties`, data);
    return res.data as KeyCounterparty;
  },
  async update(id: string, data: Partial<KeyCounterparty>) {
    const res = await apiClient.patch(`/credit/borrower-profiles/counterparties/${id}`, data);
    return res.data as KeyCounterparty;
  },
  async remove(id: string) {
    await apiClient.delete(`/credit/borrower-profiles/counterparties/${id}`);
  },
};

// ── Phase 5: Types ─────────────────────────────────────────

export type BureauProvider =
  | 'CCRIS'                       // historical only
  | 'CCRIS_BORROWER_UPLOAD'
  | 'CTOS'
  | 'EXPERIAN'
  | 'CBM'
  | 'SSM_EINFO'
  | 'BANK_STATEMENT_ANALYSIS'
  | 'PEP_WATCHLIST'
  | 'IF_ACTIVA'
  | 'PUBLIC_DOMAIN';
export type RiskCategory = 'PROJECT' | 'PERFORMANCE' | 'PACKAGING' | 'PAYMENT' | 'OTHER';
export type EsgGuidingPrinciple = 'GP1' | 'GP2' | 'GP3' | 'GP4' | 'GP5';
export type EsgCategory = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
export type SicrTriggerType = 'OBLIGATORY_WATCHLIST' | 'OBLIGATORY_IMPAIRED' | 'OBJECTIVE_JUDGMENTAL' | 'SUBJECTIVE_JUDGMENTAL';
export type SignoffRole = 'PREPARED_BY' | 'REVIEWED_BY' | 'CONCURRED_BY';

export interface CreditBureauCheck {
  id: string;
  applicationId: string;
  provider: BureauProvider;
  subjectName: string | null;
  runDate: string | null;
  runById: string | null;
  hasHits: boolean | null;
  findings: string | null;
  attachedDocId: string | null;
  createdAt: string;
  updatedAt: string;
  runBy?: { id: string; firstName: string; lastName: string } | null;
  attachedDoc?: { id: string; verificationStatus: string | null; fileName: string; classification: string } | null;
}

export interface IndustryAssessment {
  id: string;
  applicationId: string;
  sectorName: string | null;
  subsectorName: string | null;
  sectorOutlook: string | null;
  subsectorOutlook: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskAssessment {
  id: string;
  applicationId: string;
  riskCategory: RiskCategory;
  description: string | null;
  mitigation: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RmdIssue {
  id: string;
  applicationId: string;
  sortOrder: number;
  issueDescription: string;
  businessUnitResponse: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EsgAssessment {
  id: string;
  applicationId: string;
  assignedGp: EsgGuidingPrinciple | null;
  assignedCategory: EsgCategory | null;
  justification: string | null;
  mitigatingFactors: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SicrAssessment {
  id: string;
  applicationId: string;
  triggerType: SicrTriggerType;
  triggeringEvent: string | null;
  hasHit: boolean | null;
  rationale: string | null;
  resultingClassification: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSignoff {
  id: string;
  applicationId: string;
  role: SignoffRole;
  signedById: string;
  designationSnapshot: string;
  signedAt: string;
  ipAddress: string | null;
  createdAt: string;
  signedBy?: { id: string; firstName: string; lastName: string; email: string };
}

// ── Phase 5: API ─────────────────────────────────────────

export const bureauCheckApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/bureau-checks`);
    return res.data as CreditBureauCheck[];
  },
  async create(applicationId: string, data: Partial<CreditBureauCheck>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/bureau-checks`, data);
    return res.data as CreditBureauCheck;
  },
  async update(applicationId: string, id: string, data: Partial<CreditBureauCheck>) {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/bureau-checks/${id}`, data);
    return res.data as CreditBureauCheck;
  },
  async remove(applicationId: string, id: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/bureau-checks/${id}`);
  },
};

export const industryAssessmentApi = {
  async get(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/industry-assessment`);
    return res.data as IndustryAssessment | null;
  },
  async upsert(applicationId: string, data: Partial<IndustryAssessment>) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/industry-assessment`, data);
    return res.data as IndustryAssessment;
  },
};

export const riskAssessmentApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/risk-assessments`);
    return res.data as RiskAssessment[];
  },
  async bulkUpsert(applicationId: string, items: Partial<RiskAssessment>[]) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/risk-assessments`, items);
    return res.data as RiskAssessment[];
  },
};

export const rmdIssueApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/rmd-issues`);
    return res.data as RmdIssue[];
  },
  async create(applicationId: string, data: Partial<RmdIssue>) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/rmd-issues`, data);
    return res.data as RmdIssue;
  },
  async update(applicationId: string, id: string, data: Partial<RmdIssue>) {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/rmd-issues/${id}`, data);
    return res.data as RmdIssue;
  },
  async remove(applicationId: string, id: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/rmd-issues/${id}`);
  },
};

export const esgApi = {
  async get(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/esg-assessment`);
    return res.data as EsgAssessment | null;
  },
  async upsert(applicationId: string, data: Partial<EsgAssessment>) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/esg-assessment`, data);
    return res.data as EsgAssessment;
  },
};

export const sicrApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/sicr-assessments`);
    return res.data as SicrAssessment[];
  },
  async bulkUpsert(applicationId: string, items: Partial<SicrAssessment>[]) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/sicr-assessments`, items);
    return res.data as SicrAssessment[];
  },
};

export const signoffApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/signoffs`);
    return res.data as ApplicationSignoff[];
  },
  async create(applicationId: string, data: { role: SignoffRole; designationSnapshot: string }) {
    const res = await apiClient.post(`/credit/applications/${applicationId}/signoffs`, data);
    return res.data as ApplicationSignoff;
  },
  async revoke(applicationId: string, role: SignoffRole) {
    await apiClient.delete(`/credit/applications/${applicationId}/signoffs/${role}`);
  },
};

export interface AccountUtilisationInput {
  accountNo: string;
  facilityType: string;
  snapshotMonth: string;
  withdrawalAmount?: string | number | null;
  depositAmount?: string | number | null;
  monthEndBalance?: string | number | null;
  returnedChequesCount?: number | null;
  approvedLimit?: string | number | null;
  outstandingAmount?: string | number | null;
  overdueAmount?: string | number | null;
  instalmentsInArrears?: number | null;
}

export const utilisationApi = {
  async list(applicationId: string) {
    const res = await apiClient.get(`/credit/applications/${applicationId}/account-utilisation`);
    return res.data as AccountUtilisationSnapshot[];
  },
  async upsert(applicationId: string, data: AccountUtilisationInput) {
    const res = await apiClient.put(`/credit/applications/${applicationId}/account-utilisation`, data);
    return res.data as AccountUtilisationSnapshot;
  },
  async remove(applicationId: string, id: string) {
    await apiClient.delete(`/credit/applications/${applicationId}/account-utilisation/${id}`);
  },
};

// ─── PII Reveal ──────────────────────────────────────────────────────────────

export const piiRevealApi = {
  director: async (id: string): Promise<string> => {
    const res = await apiClient.get(`/credit/directors/${id}/nric-reveal`);
    return res.data.data.nric as string;
  },
  shareholder: async (id: string): Promise<string> => {
    const res = await apiClient.get(`/credit/shareholders/${id}/nric-reveal`);
    return res.data.data.nric as string;
  },
  ubo: async (id: string): Promise<string> => {
    const res = await apiClient.get(`/credit/ubos/${id}/nric-reveal`);
    return res.data.data.nric as string;
  },
};

export const bureauChecklistApi = {
  get: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/bureau-checklist`);
    return res.data.data as {
      ccrisUploaded: boolean;
      ctosUploaded: boolean;
      noAdverseRecord: boolean;
      adverseExceptionReason?: string | null;
      amlScreeningDone: boolean;
      tickedById?: string | null;
      tickedAt?: string | null;
      tickedBy?: { id: string; firstName: string; lastName: string } | null;
      verifiedById?: string | null;
      verifiedAt?: string | null;
      verifiedBy?: { id: string; firstName: string; lastName: string } | null;
    } | null;
  },
  upsert: async (applicationId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/credit/applications/${applicationId}/bureau-checklist`, data);
    return res.data.data;
  },
  verify: async (applicationId: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/bureau-checklist/verify`);
    return res.data.data;
  },
  updateCheckStructured: async (applicationId: string, checkId: string, data: Record<string, unknown>) => {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/bureau-checks/${checkId}/structured`, data);
    return res.data.data;
  },
};

export const retailIncomeApi = {
  get: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/retail-income`);
    return res.data.data as {
      employmentType: string;
      employerName?: string;
      monthlyGrossIncome: string;
      epfMonthlyAmount?: string;
      hirePurchaseCommitment: string;
      creditCardCommitment: string;
      existingLoanCommitment: string;
      otherCommitments: string;
      proposedInstalment?: string;
      dsrPercent?: string;
      dsrStatus?: 'pass' | 'warning' | 'fail';
      financialsVerified?: boolean;
      financialsVerifiedAt?: string | null;
    } | null;
  },
  upsert: async (applicationId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/credit/applications/${applicationId}/retail-income`, data);
    return res.data.data;
  },
  verify: async (applicationId: string, verified: boolean) => {
    const res = await apiClient.patch(`/credit/applications/${applicationId}/retail-income/verify`, { verified });
    return res.data.data as { financialsVerified: boolean; financialsVerifiedAt: string | null };
  },
};

export const qualitativeAssessmentApi = {
  get: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/qualitative-assessment`);
    return res.data.data as {
      managementScore: number;
      relationshipScore: number;
      industryScore: number;
      collateralScore: number;
    } | null;
  },
  upsert: async (
    applicationId: string,
    scores: { managementScore: number; relationshipScore: number; industryScore: number; collateralScore: number },
  ) => {
    const res = await apiClient.put(`/credit/applications/${applicationId}/qualitative-assessment`, scores);
    return res.data.data;
  },
};

// ── Disbursement API ──────────────────────────────────────────────────────
export interface DisbursementOrder {
  id: string;
  applicationId: string;
  orderNo: string;
  requestedById: string;
  requestedAt: string;
  approvedById: string | null;
  approvedAt: string | null;
  disbursedById: string | null;
  disbursedAt: string | null;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'CANCELLED';
  totalAmount: string;
  currency: string;
  disbursementMethod: string | null;
  beneficiaryBank: string | null;
  beneficiaryAccount: string | null;
  referenceNote: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy: { id: string; firstName: string; lastName: string } | null;
  approvedBy: { id: string; firstName: string; lastName: string } | null;
  disbursedBy: { id: string; firstName: string; lastName: string } | null;
  cancelledBy: { id: string; firstName: string; lastName: string } | null;
}

export interface DisbursementReadinessResult {
  ready: boolean;
  checks: { pass: boolean; reason: string }[];
}

export const disbursementApi = {
  get: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/disbursement`);
    return res.data.data as DisbursementOrder | null;
  },
  create: async (applicationId: string, data: {
    totalAmount: number;
    currency?: string;
    disbursementMethod?: string;
    beneficiaryBank?: string;
    beneficiaryAccount?: string;
    referenceNote?: string;
  }) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/disbursement`, data);
    return res.data.data as DisbursementOrder;
  },
  approve: async (applicationId: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/disbursement/approve`);
    return res.data.data as DisbursementOrder;
  },
  disburse: async (applicationId: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/disbursement/disburse`);
    return res.data.data as DisbursementOrder;
  },
  cancel: async (applicationId: string, reason: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/disbursement/cancel`, { reason });
    return res.data.data as DisbursementOrder;
  },
  readiness: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/disbursement/readiness`);
    return res.data.data as DisbursementReadinessResult;
  },
};

// ── LOO (Letter of Offer) API ─────────────────────────────────────────────
export interface LooStatus {
  generatedAt: string | null;
  expiryDate: string | null;
  generatedBy: { id: string; firstName: string; lastName: string } | null;
  version: number;
  expired: boolean;
  daysRemaining: number | null;
  documentId: string | null;
}

export interface LooGenerateResult {
  documentId: string;
  fileName: string;
  version: number;
  generatedAt: string;
  expiryDate: string;
}

export const looApi = {
  generate: async (applicationId: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/loo/generate`);
    return res.data.data as LooGenerateResult;
  },
  regenerate: async (applicationId: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/loo/regenerate`);
    return res.data.data as LooGenerateResult;
  },
  status: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/loo/status`);
    return res.data.data as LooStatus;
  },
  documentId: async (applicationId: string) => {
    const res = await apiClient.get(`/credit/applications/${applicationId}/loo/document`);
    return res.data.data?.documentId as string | null;
  },
};

// ── Rejection API ──────────────────────────────────────────────────────────
export interface RejectionReasonOption {
  value: string;
  label: string;
}

export const rejectionApi = {
  listReasonCodes: async () => {
    const res = await apiClient.get('/credit/applications/rejection-reasons');
    return res.data.data as RejectionReasonOption[];
  },
  cloneFromRejected: async (applicationId: string) => {
    const res = await apiClient.post(`/credit/applications/${applicationId}/clone`);
    return res.data.data as { id: string };
  },
};

export default creditService;

// §2.8 — AML Rescreen Event Log API
export const amlRescreenApi = {
  trigger: async (borrowerId: string, data: {
    applicationId?: string;
    screeningSource: string;
    outcome: string;
    hitDetails?: string;
    actionTaken: string;
    actionNotes?: string;
  }) => {
    const res = await apiClient.post(`/credit/borrowers/${borrowerId}/aml-rescreen`, data);
    return res.data.data;
  },
  getHistory: async (borrowerId: string) => {
    const res = await apiClient.get(`/credit/borrowers/${borrowerId}/aml-rescreen`);
    return res.data.data as AmlRescreenEvent[];
  },
  reviewEvent: async (eventId: string, reviewNotes?: string) => {
    const res = await apiClient.patch(`/credit/aml-rescreen/${eventId}/review`, { reviewNotes });
    return res.data.data as AmlRescreenEvent;
  },
};