# 11 — Data Model — Prisma Schema Extensions

This is a **design-level schema** suitable for engineering to translate into Prisma migrations. All models are namespaced with the `Credit…`, `Borrower…`, `Aml…`, etc. prefix to coexist with existing 60 models.

## 1. Conventions

- IDs: `cuid()` (consistent with existing models).
- Timestamps: `createdAt`, `updatedAt`.
- Soft delete: `deletedAt DateTime?` where relevant.
- Versioning: separate `*Version` tables for scorecards, policies, prompts, approval matrix.
- Audit: all models written via Prisma middleware that emits to `AuditLog`.
- Sensitive fields: tagged in code; FLE applied at service boundary.

## 2. Core entities

### 2.1 Borrowers

```prisma
model BorrowerIndividual {
  id              String   @id @default(cuid())
  contactId       String   @unique  // FK -> existing CrmContact
  nricEncrypted   String
  nricLast4       String   // for display
  dob             DateTime
  nationality     String
  pepStatus       PepStatus @default(NOT_SCREENED)
  amlRiskTier     AmlRiskTier?
  occupation      String?
  employerName    String?
  monthlyIncome   Decimal? @db.Decimal(18,2)
  sourceOfFunds   String?
  // links
  identifications BorrowerIdentification[]
  incomes         BorrowerIncome[]
  guarantees      Guarantee[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BorrowerCorporate {
  id               String   @id @default(cuid())
  accountId        String   @unique  // FK -> existing CrmAccount
  ssmNo            String   @unique
  incorporationDate DateTime
  paidUpCapital    Decimal  @db.Decimal(18,2)
  msicCode         String
  countryOfIncorp  String
  groupId          String?  // FK -> RelatedPartyGroup
  amlRiskTier      AmlRiskTier?
  directors        Director[]
  shareholders     Shareholder[]
  ubos             UltimateBeneficialOwner[]
  financialStatements FinancialStatement[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Director { id String @id @default(cuid()); corporateId String; name String; nricEncrypted String? }
model Shareholder { id String @id @default(cuid()); corporateId String; name String; sharePct Decimal @db.Decimal(7,4) }
model UltimateBeneficialOwner { id String @id @default(cuid()); corporateId String; name String; ownershipPct Decimal @db.Decimal(7,4); controlBasis String }
model RelatedPartyGroup { id String @id @default(cuid()); name String; members BorrowerCorporate[] }
```

### 2.2 Applications & Facilities

```prisma
enum ApplicationState { DRAFT SUBMITTED ANALYSING UNDER_DECISION COMMITTEE DECISIONED CONDITIONS_PRECEDENT READY_FOR_DRAWDOWN ACTIVE CLOSED DEFAULT WRITTEN_OFF DECLINED WITHDRAWN LAPSED }

model CreditApplication {
  id              String @id @default(cuid())
  reference       String @unique  // CR-YYYY-NNNNN
  state           ApplicationState @default(DRAFT)
  borrowerCorpId  String?
  borrowerIndId   String?
  rmUserId        String
  purpose         String
  totalAmount     Decimal @db.Decimal(18,2)
  currency        String  @default("MYR")
  tenorMonths     Int
  facilities      ApplicationFacility[]
  parties         ApplicationParty[]
  documents       ApplicationDocument[]
  conditions      Condition[]
  decisions       CreditDecision[]
  scoreRuns       ScoreRun[]
  exceptions      PolicyException[]
  meetings        CommitteeAgendaItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([state])
  @@index([rmUserId])
}

model ApplicationFacility {
  id            String @id @default(cuid())
  applicationId String
  type          String  // TL, OD, BG, TF...
  amount        Decimal @db.Decimal(18,2)
  tenorMonths   Int
  pricingBps    Int?
  repaymentMode String?
  collateral    Collateral[]
  guarantees    Guarantee[]
}

model ApplicationParty {
  id            String @id @default(cuid())
  applicationId String
  role          String  // PRIMARY_BORROWER, CO_BORROWER, GUARANTOR
  individualId  String?
  corporateId   String?
}
```

### 2.3 Documents

```prisma
model CreditDocument {
  id            String @id @default(cuid())
  applicationId String?
  borrowerCorpId String?
  borrowerIndId  String?
  docType       String       // financial-statement, ssm-search, bank-statement, ...
  classification String      // public, internal, confidential, restricted
  currentVersionId String?
  retentionUntil DateTime?
  legalHold     Boolean @default(false)
  versions      CreditDocumentVersion[]
}

model CreditDocumentVersion {
  id          String @id @default(cuid())
  documentId  String
  versionNo   Int
  s3Key       String
  contentHash String
  mimeType    String
  sizeBytes   Int
  avStatus    String  // PENDING, CLEAN, INFECTED, SKIPPED
  uploadedBy  String
  uploadedAt  DateTime @default(now())
  ocrStatus   String?
  ocrResultId String?
  signedAt    DateTime?
  signedBy    String?
}

model DocumentRequirement {
  id            String @id @default(cuid())
  facilityType  String
  borrowerType  String
  docType       String
  requiredAt    String  // SUBMISSION, ANALYSIS, SANCTION, DRAWDOWN
  mandatory     Boolean
}
```

### 2.4 Financial Spreading

```prisma
model FinancialStatement {
  id          String @id @default(cuid())
  corporateId String
  periodStart DateTime
  periodEnd   DateTime
  basis       String  // AUDITED, MANAGEMENT, INTERIM
  sourceDocId String?
  lineItems   FinancialLineItem[]
  ratios      FinancialRatio[]
  status      String  // DRAFT, SUBMITTED, CHECKED, FINAL
  makerId     String?
  checkerId   String?
}

model FinancialLineItem {
  id     String @id @default(cuid())
  statementId String
  canonicalCode String  // e.g., REV, COGS, OPEX, NPAT, TOTAL_ASSETS...
  rawLabel String?
  amount Decimal @db.Decimal(20,2)
  pageRef Json?   // OCR provenance
}

model FinancialRatio {
  id String @id @default(cuid())
  statementId String
  code String  // DSCR, ICR, CURRENT_RATIO, ...
  value Decimal @db.Decimal(20,6)
}
```

### 2.5 Scoring & Rating

```prisma
model Scorecard {
  id String @id @default(cuid())
  name String
  productScope String  // SME_CORPORATE, ...
  versions ScorecardVersion[]
}

model ScorecardVersion {
  id String @id @default(cuid())
  scorecardId String
  versionNo Int
  effectiveFrom DateTime
  effectiveTo DateTime?
  factorsJson Json   // declarative factor/weight/band config
  approvedByUserId String
  approvedAt DateTime
}

model ScoreRun {
  id String @id @default(cuid())
  applicationId String
  scorecardVersionId String
  inputsHash String
  rawScore Decimal @db.Decimal(8,4)
  rating String
  pd Decimal? @db.Decimal(8,6)
  factorBreakdownJson Json
  analystOverride String?  // rating override
  overrideReason String?
  overrideApprovedBy String?
  runAt DateTime @default(now())
}
```

### 2.6 Collateral & Guarantees

```prisma
model Collateral {
  id String @id @default(cuid())
  facilityId String
  type String  // PROPERTY, SECURITIES, RECEIVABLES, INVENTORY, CASH
  description String
  ownerName String
  marketValue Decimal @db.Decimal(18,2)
  forcedSaleValue Decimal? @db.Decimal(18,2)
  haircutPct Decimal @db.Decimal(5,2)
  ltvPct Decimal? @db.Decimal(5,2)
  insurance InsuranceCover[]
  lien CollateralLien[]
  valuations CollateralValuation[]
  perfectionStatus String
}

model CollateralValuation { id String @id @default(cuid()); collateralId String; valuationDate DateTime; valuer String; value Decimal @db.Decimal(18,2); methodology String }
model CollateralLien { id String @id @default(cuid()); collateralId String; rank Int; registry String; registeredAt DateTime? }
model InsuranceCover { id String @id @default(cuid()); collateralId String; insurer String; sumInsured Decimal @db.Decimal(18,2); expiry DateTime }

model Guarantee {
  id String @id @default(cuid())
  facilityId String
  guarantorIndId String?
  guarantorCorpId String?
  amount Decimal @db.Decimal(18,2)
  jointAndSeveral Boolean
  expiry DateTime?
}
```

### 2.7 Exposure & Limits

```prisma
model LimitDefinition {
  id String @id @default(cuid())
  scope String  // SINGLE_NAME, GROUP, SECTOR, COUNTRY, RELATED_PARTY
  scopeKey String
  hardLimit Decimal @db.Decimal(20,2)
  softLimit Decimal? @db.Decimal(20,2)
  effectiveFrom DateTime
  effectiveTo DateTime?
}

model Exposure {
  id String @id @default(cuid())
  borrowerCorpId String?
  borrowerIndId String?
  groupId String?
  sectorCode String?
  countryCode String?
  outstanding Decimal @db.Decimal(20,2)
  approved Decimal @db.Decimal(20,2)
  asOf DateTime
  @@index([groupId])
  @@index([sectorCode])
}

model LimitBreach {
  id String @id @default(cuid())
  limitDefinitionId String
  observedValue Decimal @db.Decimal(20,2)
  detectedAt DateTime @default(now())
  status String  // OPEN, WAIVED, REMEDIATED
  waiverId String?
}
```

### 2.8 Approval Matrix & Decisions

```prisma
model ApprovalMatrix { id String @id @default(cuid()); name String; versions ApprovalMatrixVersion[] }
model ApprovalMatrixVersion {
  id String @id @default(cuid())
  matrixId String
  versionNo Int
  effectiveFrom DateTime
  rulesJson Json    // declarative routing rules
  approvedBy String
}

model CreditDecision {
  id String @id @default(cuid())
  applicationId String
  decisionType String  // RECOMMEND, APPROVE, DECLINE, REFER
  authorityLevel String
  decidedBy String
  decidedAt DateTime
  termsJson Json?
  declineReason String?
  conditionsId String?
}

model PolicyException {
  id String @id @default(cuid())
  applicationId String
  policyClause String
  justification String
  compensatingControl String
  approvedBy String
  expiresAt DateTime?
}
```

### 2.9 Committee

```prisma
model CommitteeMeeting { id String @id @default(cuid()); date DateTime; chairUserId String; minutesDocId String?; status String }
model CommitteeMember  { id String @id @default(cuid()); meetingId String; userId String; role String; recused Boolean @default(false) }
model CommitteeAgendaItem { id String @id @default(cuid()); meetingId String; applicationId String; orderNo Int }
model CommitteeVote { id String @id @default(cuid()); agendaItemId String; userId String; vote String; comment String?; votedAt DateTime }
```

### 2.10 Conditions, monitoring, EWS

```prisma
model Condition { id String @id @default(cuid()); applicationId String; type String /* CP | CS */ ; description String; ownerUserId String; dueDate DateTime?; status String; evidenceDocId String? }
model CovenantDefinition { id String @id @default(cuid()); facilityId String; description String; testFrequency String; threshold Json }
model CovenantTest { id String @id @default(cuid()); covenantId String; testedAt DateTime; result String; evidence Json? }
model EarlyWarningSignal { id String @id @default(cuid()); facilityId String; source String; severity String; signalCode String; payload Json; openedAt DateTime; closedAt DateTime?; closedBy String? }
model FacilityHealth { id String @id @default(cuid()); facilityId String @unique; dpd Int; bucket String; lastReviewedAt DateTime; nextReviewAt DateTime }
model PaymentEvent { id String @id @default(cuid()); facilityId String; eventDate DateTime; eventType String; amount Decimal @db.Decimal(18,2); externalRef String }
```

### 2.11 AML / Screening

```prisma
enum PepStatus { NOT_SCREENED CLEAR HIT_OPEN HIT_ADJUDICATED_FALSE HIT_TRUE }
enum AmlRiskTier { LOW MEDIUM HIGH }

model ScreeningRun { id String @id @default(cuid()); borrowerCorpId String?; borrowerIndId String?; runType String; vendor String; runAt DateTime @default(now()); resultSummary String; hits ScreeningHit[] }
model ScreeningHit { id String @id @default(cuid()); runId String; listName String; matchScore Decimal; payload Json; adjudication ScreeningAdjudication? }
model ScreeningAdjudication { id String @id @default(cuid()); hitId String @unique; decision String /* CLEAR | TRUE_MATCH | REFER */; reason String; decidedBy String; decidedAt DateTime }
model OngoingScreeningSchedule { id String @id @default(cuid()); borrowerCorpId String?; borrowerIndId String?; frequency String; nextRunAt DateTime }
```

### 2.12 AI governance

```prisma
model AiPromptVersion { id String @id @default(cuid()); featureKey String; versionNo Int; template String; createdAt DateTime @default(now()); approvedBy String? }
model AiInteraction {
  id String @id @default(cuid())
  featureKey String
  promptVersionId String
  model String
  params Json
  inputHash String
  outputJson Json
  tokensIn Int
  tokensOut Int
  latencyMs Int
  costUsd Decimal? @db.Decimal(12,6)
  userId String?
  correlationId String
  createdAt DateTime @default(now())
  @@index([featureKey, createdAt])
}
model AiOverride { id String @id @default(cuid()); interactionId String; humanDecision String; reason String; userId String; decidedAt DateTime }
```

### 2.13 Regulatory reporting

```prisma
model RegulatoryReportRun {
  id String @id @default(cuid())
  reportCode String
  periodKey String
  payloadHash String
  generatedBy String
  generatedAt DateTime
  archiveLocation String
}
```

## 3. Integration with existing schema

| Existing model | Linkage |
|---|---|
| `User`, `Role`, `Permission` | New permissions: `credit:*`, `credit:rm`, `credit:analyst`, `credit:manager`, `credit:senior`, `credit:committee`, `credit:risk`, `credit:compliance`, `credit:admin`, `credit:audit:read`, `credit:export:pii` |
| `CrmAccount` | 1:1 with `BorrowerCorporate.accountId` |
| `CrmContact` | 1:1 with `BorrowerIndividual.contactId` |
| `CrmKycRecord` | Extended by `ScreeningRun` / `ScreeningHit` lineage |
| `AuditLog` | Receives writes via Prisma middleware from all CAM models |
| `WorkflowType / Step / Transition` | Reused for credit application lifecycle |
| `RequestApproval` | **Not reused** — CAM introduces its own approval matrix model; if a unified approval concept emerges, extract later |
| `Notification` / `NotificationTemplate` | Reused for credit events |
| `RequestAttachment` | Not reused — CAM has its own `CreditDocument` with stricter controls |

## 4. Indexes (selected)

- `CreditApplication(state, updatedAt)` — inbox queries.
- `Exposure(groupId, asOf)` — concentration.
- `ScreeningHit(runId, matchScore)` — adjudication.
- `EarlyWarningSignal(severity, openedAt)` — watchlist.
- Composite unique: `(borrowerCorpId, periodStart, periodEnd)` on `FinancialStatement`.

## 5. Data-quality constraints

- DB-level checks (Postgres `CHECK`) for percentages 0–100, non-negative amounts, currency length.
- Application-level checks for balance-sheet balance, ratio sanity, document checksum.
- Quarterly data-quality job emits report.
