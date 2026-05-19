// ============================================================================
// Credit Module — Core Types & Enums
// ============================================================================

// ---- Application Lifecycle ----
// NOTE: ApplicationState is now sourced from @prisma/client to stay in sync
// with the Prisma schema. The transition machine lives in creditApplication.service.ts.
// Do not re-create a local enum here — always import from '@prisma/client'.

// ---- Borrower Types ----

export enum BorrowerType {
  INDIVIDUAL = 'INDIVIDUAL',
  CORPORATE = 'CORPORATE',
}

// ---- Document Classification ----

export enum DocumentClass {
  FINANCIAL = 'FINANCIAL',
  LEGAL = 'LEGAL',
  CORPORATE = 'CORPORATE',
  SUPPORTING = 'SUPPORTING',
  COLLATERAL = 'COLLATERAL',
  KYC = 'KYC',
  OTHER = 'OTHER',
}

// ---- Risk Rating Scale (BNM-aligned, 10 bands) ----

export enum RiskRating {
  AAA = 'AAA',
  AA = 'AA',
  A = 'A',
  BBB = 'BBB',
  BB = 'BB',
  B = 'B',
  CCC = 'CCC',
  CC = 'CC',
  C = 'C',
  D = 'D',
}

/** Maps numeric score (0-100) to risk rating */
export function scoreToRating(score: number): RiskRating {
  if (score >= 90) return RiskRating.AAA;
  if (score >= 80) return RiskRating.AA;
  if (score >= 70) return RiskRating.A;
  if (score >= 60) return RiskRating.BBB;
  if (score >= 50) return RiskRating.BB;
  if (score >= 40) return RiskRating.B;
  if (score >= 30) return RiskRating.CCC;
  if (score >= 20) return RiskRating.CC;
  if (score >= 10) return RiskRating.C;
  return RiskRating.D;
}

// ---- AML Risk Tiers ----

export enum AmlRiskTier {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  PROHIBITED = 'PROHIBITED',
}

// ---- Financial Statement Types ----

export enum FinancialStatementType {
  BALANCE_SHEET = 'BALANCE_SHEET',
  INCOME_STATEMENT = 'INCOME_STATEMENT',
  CASH_FLOW = 'CASH_FLOW',
}

export enum FinancialPeriod {
  ANNUAL = 'ANNUAL',
  QUARTERLY = 'QUARTERLY',
}

// ---- Scorecard ----

export enum ScorecardFactorGroup {
  PROFITABILITY = 'PROFITABILITY',
  LEVERAGE = 'LEVERAGE',
  LIQUIDITY = 'LIQUIDITY',
  DEBT_SERVICE = 'DEBT_SERVICE',
  BUSINESS_QUALITY = 'BUSINESS_QUALITY',
  MARKET_POSITION = 'MARKET_POSITION',
  INDUSTRY_COUNTRY = 'INDUSTRY_COUNTRY',
  BEHAVIOURAL = 'BEHAVIOURAL',
  COLLATERAL_STRUCTURE = 'COLLATERAL_STRUCTURE',
}

export const SCORECARD_FACTOR_WEIGHTS: Record<ScorecardFactorGroup, number> = {
  [ScorecardFactorGroup.PROFITABILITY]: 15,
  [ScorecardFactorGroup.LEVERAGE]: 15,
  [ScorecardFactorGroup.LIQUIDITY]: 12,
  [ScorecardFactorGroup.DEBT_SERVICE]: 18,
  [ScorecardFactorGroup.BUSINESS_QUALITY]: 10,
  [ScorecardFactorGroup.MARKET_POSITION]: 8,
  [ScorecardFactorGroup.INDUSTRY_COUNTRY]: 7,
  [ScorecardFactorGroup.BEHAVIOURAL]: 10,
  [ScorecardFactorGroup.COLLATERAL_STRUCTURE]: 5,
};

// ---- Collateral ----

export enum CollateralType {
  PROPERTY = 'PROPERTY',
  VEHICLE = 'VEHICLE',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT',
  SECURITIES = 'SECURITIES',
  GUARANTEE_DEPOSIT = 'GUARANTEE_DEPOSIT',
  OTHER = 'OTHER',
}

// ---- Guarantee ----

export enum GuaranteeType {
  PERSONAL = 'PERSONAL',
  CORPORATE = 'CORPORATE',
  BANK = 'BANK',
}

// ---- Application Party Roles ----

export enum ApplicationPartyRole {
  PRIMARY_BORROWER = 'PRIMARY_BORROWER',
  CO_BORROWER = 'CO_BORROWER',
  GUARANTOR = 'GUARANTOR',
  SPONSOR = 'SPONSOR',
}

// ---- Facility Types ----

export enum FacilityType {
  TERM_LOAN = 'TERM_LOAN',
  REVOLVING_CREDIT = 'REVOLVING_CREDIT',
  TRADE_FINANCE = 'TRADE_FINANCE',
  OVERDRAFT = 'OVERDRAFT',
  BRIDGING_LOAN = 'BRIDGING_LOAN',
  OTHER = 'OTHER',
}

// ---- Approval Authority Levels ----

export enum ApprovalAuthorityLevel {
  CREDIT_MANAGER = 'CREDIT_MANAGER',
  SENIOR_CREDIT_OFFICER = 'SENIOR_CREDIT_OFFICER',
  CREDIT_COMMITTEE = 'CREDIT_COMMITTEE',
  BOARD_RISK_COMMITTEE = 'BOARD_RISK_COMMITTEE',
}

// ---- Committee ----
// Use CommitteeVoteChoice from @prisma/client instead of a local enum
// (Prisma defines CommitteeVoteChoice with APPROVE, REJECT, ABSTAIN)

export enum CommitteeMemberRole {
  CHAIR = 'CHAIR',
  MEMBER = 'MEMBER',
  SECRETARY = 'SECRETARY',
}

// ---- Conditions ----

export enum ConditionType {
  PRECEDENT = 'PRECEDENT',
  SUBSEQUENT = 'SUBSEQUENT',
}

export enum ConditionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  WAIVED = 'WAIVED',
  EXPIRED = 'EXPIRED',
}

// ---- Monitoring ----

export enum FacilityHealthStatus {
  HEALTHY = 'HEALTHY',
  WATCH = 'WATCH',
  AT_RISK = 'AT_RISK',
  DEFAULT = 'DEFAULT',
}

export enum EarlyWarningSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum PaymentEventStatus {
  ON_TIME = 'ON_TIME',
  LATE_30 = 'LATE_30',
  LATE_60 = 'LATE_60',
  LATE_90 = 'LATE_90',
  MISSED = 'MISSED',
}

// ---- Currency ----

export enum Currency {
  MYR = 'MYR',
  USD = 'USD',
  SGD = 'SGD',
  GBP = 'GBP',
  EUR = 'EUR',
  JPY = 'JPY',
  CNY = 'CNY',
}

// ---- Screening Status ----

export enum ScreeningStatus {
  PENDING = 'PENDING',
  CLEAR = 'CLEAR',
  HIT = 'HIT',
  ADJUDICATED = 'ADJUDICATED',
  ESCALATED = 'ESCALATED',
}