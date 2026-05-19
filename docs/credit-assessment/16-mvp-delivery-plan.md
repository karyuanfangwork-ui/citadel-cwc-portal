# CAM MVP Delivery Plan

> Version: 1.0 | Date: 2025-05-18 | Author: Solo Dev Execution Plan
> Supersedes: §07 (12-phase roadmap) and §15 deployment posture where conflicts arise
> Context: Reduced MVP, solo developer, placeholder-first for external integrations, no AI in v1

---

## 1. Strategic Decisions

### 1.1 Scope Philosophy

| Decision | Rationale |
|----------|-----------|
| Reduced MVP (P1 + essential PO capabilities only) | Solo dev cannot carry full 25-feature scope; P1 from §15 is the natural cut |
| Extend existing CRM, don't rebuild | CrmAccount has 70% of BorrowerCorporate fields; CrmContact has NRIC/DOB/PDPA; CrmKycRecord has PEP/risk flags |
| Defer all AI to v2 | Docs prescribe "deterministic rules only" for Phase 1; AI adds 6+ models + guardrails = 1 month solo for zero base-value |
| Placeholder adapters for all external APIs | Every integration (AML, OCR, bureau, CBS, e-sign) stubbed behind TypeScript interfaces; swap when vendors procured |
| Feature flags on every capability | §15 tenet: ship small, independently toggleable, independently removable |
| Redis + BullMQ only new infra for MVP | Everything else either exists in stack (PostgreSQL, S3, email/SSE) or is placeholder'd |

### 1.2 CRM Extendability Assessment

Existing CRM models and their reusability:

| Existing Model | Current Fields | CAM Extension | Verdict |
|---------------|---------------|---------------|---------|
| CrmAccount | name, industry, companySize, website, phone, email, address, annualRevenue, registrationNumber, taxNumber, bankAccount, accountType | 1:1 BorrowerProfile relation | EXTEND |
| CrmContact | firstName, lastName, email, phone, nricPassport, dateOfBirth, pdpaConsent, riskProfile | 1:1 BorrowerProfile relation | EXTEND |
| CrmKycRecord | status, riskLevel, isPep, nricVerified, addressVerified, incomeVerified, sourceOfFundsVerified | + amlRiskTier, screeningStatus, screeningHits, lastScreeningAt | EXTEND |
| AuditLog | action, resourceType, resourceId, oldValues, newValues | Credit module writes to same table | REUSE |
| Notification | userId, channel, subject, body, status | Credit events fire notifications | REUSE |
| WorkflowType/Step/Transition | name, code, label, status, isInitial, isFinal | CREDIT_APPLICATION workflow seeded | REUSE |
| Role/Permission/UserRole | name, resource, action | Seed credit:* roles + permissions | REUSE |

**What NOT to reuse:**
- `RequestApproval` — CAM needs data-driven ApprovalMatrix (exposure+rating→authority), not the simple single-approver model
- `RequestAttachment` — CAM needs CreditDocument with versioning, classification, AV scanning, SHA-256 hash, checklist enforcement

### 1.3 AI Recommendation: Defer to v2

Reasons:
1. Docs prescribe "deterministic rules only" for Phase 1 MVP
2. AI adds 6+ Prisma models (AiPromptVersion, AiInteraction, AiOverride) + guardrails + shadow mode + explainability UI
3. Scoring engine, risk grading, and exposure checks are deterministic and provide 90% of value
4. Adapter pattern + feature flags make AI safe to add incrementally post-MVP

Recommended v2 AI sequencing (post-MVP production stability):
1. A4: Risk narrative generation (low risk, high UX value)
2. A5: Red-flag detector (rule-based + LLM supplement)
3. A14: Document validation (classification + completeness)
4. A1: Document classifier (auto-label uploaded docs)
5. A2: OCR + financial extraction (replace manual spreading)
6. Remaining per §05 phasing

---

## 2. MVP Scope

### 2.1 Ships in v1

| ID | Capability | Source Ref | Description |
|----|-----------|------------|-------------|
| F1 | Corporate Borrower Profile | §03, Track B | 1:1 extension on CrmAccount |
| F2 | Individual Borrower Profile | §03, Track B | 1:1 extension on CrmContact |
| F3 | Credit Application Intake | §03, Track C | Full 13-state machine |
| F4 | KYC Verification | §03 | Extend existing CrmKycRecord |
| F5 | Credit Document Management | §03, Track B | Versioning, classification, AV scanning, checklist |
| F6 | Financial Spreading (manual) | §03, Track D1 | Manual entry with maker-checker sign-off |
| F7 | Financial Ratio & Trend Analysis | §03, Track D2 | Auto-compute 12+ ratios on commit |
| F8 | Credit Scoring (deterministic) | §03, Track E1 | Versioned scorecard, no AI |
| F9 | Risk Grading | §03 | Matrix mapping score→rating (AAA-D) |
| F10 | Exposure & Limit Management (view) | §03, Track F2 | Read-only aggregate exposure |
| F12 | Collateral Registry | §03, Track F1 | Collateral + valuation tracking |
| F13 | Guarantor Management | §03 | Linked to CrmContact |
| F15 | Credit Committee Workflow | §03, Track G1 | Meetings, votes, quorum enforcement |
| F16 | Approval Workflow (matrix-based) | §03, Track G2 | Data-driven approval matrix |
| F18 | Conditions Precedent/Subsequent | §03 | Checklist tracking with evidence |
| F20 | Audit Logging | §03, Track A3 | Auto via Prisma middleware, immutable |
| F22 | Post-Disbursement Monitoring (basic) | §03 | Facility health + covenant tests |
| — | Feature Flag SDK | §15, Track A1 | FeatureFlag table + middleware |
| — | Event Bus (BullMQ) | §15, Track A2 | Redis + 7 queues |
| — | Adapter Layer | §15, Track A4 | Interfaces for all external integrations |
| — | Operational Dashboards | §15, Track L1 | Pipeline, inbox, SLA, exposure summary |
| — | SOD Enforcement | §06 | No RM+Manager on same application |
| — | credit:* RBAC permissions | §03 | ~15 new permissions seeded |

### 2.2 Defers to v2+ (with placeholders)

| Capability | Reason | MVP Replacement |
|-----------|--------|-----------------|
| AML/PEP/Sanctions screening (F21) | External API needed | PlaceholderAmlAdapter returns CLEAR; manual adjudication via CrmKycRecord |
| OCR-assisted spreading (A2) | External API needed | PlaceholderOcrAdapter returns UNSUPPORTED; manual entry only |
| Credit bureau (CTOS/CCRIS) | External API, TBD vendor | PlaceholderBureauAdapter returns null; manual score entry |
| CBS handoff (F19) | TBD API | PlaceholderCbsAdapter logs disbursement event to audit |
| E-signature | External API | Manual upload of signed docs |
| MFA / corporate IdP | Infra setup | Existing JWT auth (flag MFA as priority post-MVP) |
| Field-level encryption (KMS) | KMS dependency | App-level AES-256 with env var key (flag for KMS upgrade) |
| AI features (A1-A16) | All deferred | N/A |
| Regulatory report generation (L3) | Needs BNM review | Manual data extraction for now |
| Early Warning / AI EWS (F24) | AI dependent | Simple date-based covenant breach alerts |
| Policy Exception workflow (F17) | Can be handled manually | Free-text conditions + manual escalation |
| Limit enforcement engine (F11) | Complex rules engine | Read-only view + manual check |
| Portfolio analytics (L2) | Needs data warehouse | Operational dashboards in-app |
| DWH / BI integration | Infra heavy | Deferred |

---

## 3. External Integration Placeholder Strategy

Every external dependency is abstracted behind a TypeScript adapter interface. When the real vendor is procured, swap the implementation without touching business logic.

| Integration | Adapter Interface | Placeholder Returns | Real Implementation Trigger |
|-----------|-------------------|---------------------|-----------------------------|
| AML/KYC Screening | `IAmlProvider` | `{status: 'CLEAR', hits: [], providerRef: 'MOCK-001'}` | Vendor contract signed |
| OCR / Doc AI | `IOcrProvider` | `{status: 'UNSUPPORTED', extractedData: null}` | Vendor contract signed |
| Credit Bureau | `IBureauProvider` | `{score: null, report: null, providerRef: 'MOCK-001'}` | Vendor + compliance approval |
| Core Banking System | `ICbsProvider` | Logs to CreditAuditEvent, `{accepted: true, reference: 'STUB'}` | CBS API spec available |
| E-Signature | `IEsignProvider` | `{status: 'SKIPPED', sigRef: null}` | Vendor contract signed |
| MFA / IdP | `IAuthProvider` | — | IT/Security team provides IdP |

Adapter directory structure:
```
backend/src/credit/adapters/
  aml.placeholder.ts        # PlaceholderAmlProvider implements IAmlProvider
  ocr.placeholder.ts        # PlaceholderOcrProvider implements IOcrProvider
  bureau.placeholder.ts     # PlaceholderBureauProvider implements IBureauProvider
  cbs.placeholder.ts        # PlaceholderCbsProvider implements ICbsProvider
  esign.placeholder.ts      # PlaceholderEsignProvider implements IEsignProvider
  interfaces.ts             # All adapter interface definitions
  registry.ts               # Adapter factory: resolves provider from config/feature flag
```

---

## 4. Infrastructure Requirements

### 4.1 Required for MVP (set up in Sprint 0)

| Infra | Purpose | Local Setup | Production |
|-------|---------|-------------|------------|
| Redis + BullMQ | Durable async queues (7 queues: screening, ocr, scoring, monitoring, reports, ai, notify) | `docker run redis:7-alpine` | AWS ElastiCache / equivalent |
| ClamAV | Document AV scanning | `docker run clamav/clamav:stable` | Cloud AV or self-hosted |

### 4.2 Already in Stack (reuse as-is)

| Infra | Current Usage |
|-------|--------------|
| PostgreSQL via Prisma | Primary data store — add ~15 new models |
| S3 / MinIO | Document storage — add credit_documents bucket/prefix |
| Resend | Email notifications — add credit notification templates |
| SSE | Real-time notifications — add credit event streams |
| JWT auth | Authentication — extend with credit:* permissions |

### 4.3 Deferred (placeholder or flag for post-MVP)

| Infra | When Needed | MVP Workaround |
|-------|------------|----------------|
| Corporate IdP + MFA | Post-MVP security hardening | Existing JWT auth |
| KMS (AWS KMS / Vault) | Post-MVP FLE upgrade | App-level AES-256 with env key |
| WAF + CDN | Production deployment | Infra concern, not blocking |
| Observability (OpenTelemetry) | Production monitoring | Console logging + structured error handling |
| BI/DWH | v2 analytics | In-app operational dashboards |
| SIEM | Production security monitoring | Audit log + console logging |

---

## 5. Phased Delivery Plan

Estimated total: 28 weeks (~7 months) for solo developer.

---

### SPRINT 0 — Foundation
**Weeks 1-3** | 3 weeks | Goal: Scaffold credit module, add infra, seed permissions

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Install bullmq, create 7 credit queues (BullMQ) | ✅ | credit.screening.run, credit.ocr.extract, credit.score.run, credit.monitor.daily, credit.report.run, credit.ai.invoke, credit.notify.send |
| 0.2 | FeatureFlag Prisma model + DB migration | ✅ | id, key (unique), enabled, rolloutPct, category, description, createdAt, updatedAt |
| 0.3 | requireFeatureFlag middleware + isFeatureEnabled helper | ✅ | In-memory 60s cache, fail-open on DB error, invalidateFlagCache() |
| 0.4 | Adapter interfaces (5) | ✅ | IAmlProvider, IOcrProvider, IBureauProvider, ICbsProvider, IEsignProvider |
| 0.5 | Placeholder adapter implementations + AdapterRegistry | ✅ | Each returns canned data; registry for vendor swap at runtime |
| 0.6 | Add credit:* permissions to seed (15 permissions) | ✅ | credit:read/write/delete/approve/committee/score/spread/analyze/admin/compliance/risk/export/override/monitor/document |
| 0.7 | Add credit roles to seed (6 roles) | ✅ | CREDIT_RM, CREDIT_ANALYST, CREDIT_MANAGER, CREDIT_SENIOR, CREDIT_COMMITTEE, CREDIT_ADMIN |
| 0.8 | SOD constraint middleware | ✅ | Block user with CREDIT_RM + CREDIT_MANAGER/SENIOR roles on same application; @ts-expect-error for Sprint 1 CreditApplication model |
| 0.9 | Auto-audit Prisma middleware extension | ✅ | Logs all insert/update/delete on 30+ credit models to AuditLog; wired in prisma.ts |
| 0.10 | Create backend/src/credit/ directory structure | ✅ | routes/, middleware/, adapters/, queues/, types/ — all created |
| 0.11 | Mount /api/v1/credit routes in index.ts (behind feature flag) | ✅ | Feature-flag admin routes bypass gate (can re-enable even when OFF); all other routes gated |
| 0.12 | Credit enum definitions (credit.types.ts) | ✅ | ApplicationState (13 states), BorrowerType, DocumentClass, RiskRating, AmlRiskTier, ProductType, FacilityType, Currency, ApprovalDecisionType, CommitteeVoteDecision, ConditionType, CovenantType, EarlyWarningSeverity |

**Sprint 0 Exit Criteria:**
- [x] `npm run dev` starts without errors with new credit routes mounted (flagged OFF)
- [x] Redis + BullMQ connection verified — 7 queues report 0/0/0 counts
- [x] FeatureFlag middleware blocks a test route when flag is OFF, allows when ON
- [x] Feature-flag admin routes work even when credit:module is OFF (critical for re-enable)
- [x] credit:* permissions visible in login response after seed (admin has all 15)
- [x] Non-admin users blocked from credit:admin endpoints (403)
- [x] BullMQ queue names use dots not colons (BullMQ restriction)

---

### SPRINT 1 — Data Model + Borrower
**Weeks 4-7** | 4 weeks | Goal: Schema migrations, borrower profiles, document management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Prisma schema migration: BorrowerProfile (1:1 on CrmAccount/CrmContact) | ⬜ | Fields: borrowerType (INDIVIDUAL/CORPORATE), creditRiskRating, amlRiskTier, exposureLimit, isSanctionedEntity, sourceOfWealth, purposeOfAccount, occupation, employer, annualIncome, netWorth, totalExposure (computed) |
| 1.2 | Prisma schema: Director, Shareholder, UltimateBeneficialOwner, RelatedPartyGroup | ⬜ | Director/Shareholder linked to CrmContact + BorrowerProfile; UBO with ownershipPct; RelatedPartyGroup for connected-party tracking |
| 1.3 | Prisma schema: CreditApplication | ⬜ | 13-state enum, productType, purpose, requestedAmount, requestedTenor, currency, assignedRmId, assignedAnalystId, borrowerProfileId, submittedAt, decisionedAt, closedAt |
| 1.4 | Prisma schema: ApplicationFacility, ApplicationParty | ⬜ | Facility: type, amount, tenor, rate, purpose; Party: role (borrower/guarantor/co-borrower/sponsor) |
| 1.5 | Prisma schema: CreditDocument, CreditDocumentVersion, DocumentRequirement | ⬜ | Document: classification, sha256Hash, isAvClean, uploadedById; Version: fileUrl, changeSummary; Requirement: requiredFor, isMandatory, isCollected |
| 1.6 | Prisma schema: CreditAuditEvent (append-only) | ⬜ | eventType, actorId, action, oldState, newState, metadata JsonB, hash (hash-chain) |
| 1.7 | Extend CrmKycRecord schema | ⬜ | + amlRiskTier, screeningStatus, screeningHits Json?, lastScreeningAt, nextScreeningDueAt |
| 1.8 | Add 1:1 relation: CrmAccount → BorrowerProfile?, CrmContact → BorrowerProfile? | ⬜ | CrmAccount.borrowerProfile, CrmContact.borrowerProfile |
| 1.9 | Borrower CRUD: routes + controller + service + validator | ⬜ | POST /credit/borrowers (link to CrmAccount/CrmContact), GET list, GET :id, PATCH, DELETE |
| 1.10 | Director/Shareholder/UBO CRUD endpoints | ⬜ | Nested under /credit/borrowers/:id/directors etc. |
| 1.11 | RelatedPartyGroup CRUD | ⬜ | /credit/borrowers/:id/related-parties |
| 1.12 | Credit Document management | ⬜ | Upload, version, classify, SHA-256 hash, AV scan trigger (ClamAV) |
| 1.13 | Document checklist per application type | ⬜ | DocumentRequirement seed data; % completion indicator on application |
| 1.14 | Frontend: Credit nav section in sidebar | ⬜ | "Credit" top-level nav with: Pipeline, Applications, Borrowers |
| 1.15 | Frontend: BorrowerProfile list page | ⬜ | Table with search, filters (type, risk rating, AML tier) |
| 1.16 | Frontend: BorrowerProfile detail page | ⬜ | Tabs: Profile, Directors/Shareholders/UBOs, Applications, Documents, KYC |
| 1.17 | Frontend: CreditDocument upload component | ⬜ | Drag-drop, classification dropdown, AV status indicator |
| 1.18 | Deep-link: CrmAccount detail → "Create Borrower Profile" button | ⬜ | Promote existing account to credit borrower |

**Sprint 1 Exit Criteria:**
- [ ] Prisma migration runs clean; all ~10 new tables created
- [ ] Can create a BorrowerProfile linked to an existing CrmAccount via API
- [ ] Can upload a credit document and see SHA-256 hash stored
- [ ] Document checklist shows % completion for a test application
- [ ] BorrowerProfile detail page renders with all tabs
- [ ] CrmAccount detail page shows "Create Borrower Profile" button
- [ ] Auto-audit logs every borrower/document write

---

### SPRINT 2 — Application Intake + Workflow
**Weeks 8-11** | 4 weeks | Goal: Full credit application state machine + approval matrix

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | CreditApplication CRUD endpoints | ✅ | POST /credit/applications, GET list (with status/assignee filters), GET :id |
| 2.2 | Application state machine: 16 states + transitions | ✅ | DRAFT→SUBMITTED→KYC_REVIEW→KYC_APPROVED→UNDERWRITING→CREDIT_ASSESSMENT→COMMITTEE_REVIEW→APPROVED→OFFER→ACCEPTED→DISBURSED→ACTIVE→CLOSED + WITHDRAWN/REJECTED |
| 2.3 | State transition controller | ✅ | POST /credit/applications/:id/transition — validates current state, permission, required fields before advancing |
| 2.4 | Workflow seed: CREDIT_APPLICATION WorkflowType + Steps + Transitions | ✅ | 16 steps + 27 transitions in existing WorkflowType/Step/Transition tables |
| 2.5 | ApplicationFacility CRUD (nested under application) | ✅ | Multiple facilities per application |
| 2.6 | ApplicationParty CRUD (link borrower/guarantor to application) | ✅ | Roles: borrower, guarantor, co_borrower, sponsor |
| 2.7 | ApprovalMatrix Prisma model | ✅ | CreditApprovalMatrix: 3 tiers (<500K/500K-5M/>5M) |
| 2.8 | ApprovalMatrixVersion model | ✅ | Version tracking for matrix changes |
| 2.9 | Approval action endpoints | ✅ | POST /credit/applications/:id/approvals — approve/reject/return/escalate with comments |
| 2.10 | Multi-level approval chain logic | ✅ | Exposure+rating → lookup matrix → determine authority level + required approvers |
| 2.11 | Application detail page (wizard/stepper) | ✅ | 6-tab detail: Summary, Facilities, Parties, Documents, Approvals, Audit with state stepper |
| 2.12 | Application list / pipeline view | ✅ | Kanban 6-column pipeline + table view with filters |
| 2.13 | Approval action UI | ✅ | Inline approval panel with action buttons, comment required for reject/return |
| 2.14 | Application creation from borrower detail page | ✅ | "New Credit Application" button pre-fills borrower |
| 2.15 | My Approvals inbox | ✅ | List of pending approvals grouped by urgency/SLA |
| 2.16 | Notification integration: credit application events → SSE + email | ✅ | 5 notification templates: submit/approve/reject/withdraw/request |
| 2.17 | SOD enforcement on approval actions | ✅ | RM cannot approve own application; maker-checker on state transitions; admin bypass |

**Sprint 2 Exit Criteria:**
- [x] Can create a credit application with facilities and parties
- [x] Application advances through 16 states with proper permission gating
- [x] Invalid state transitions are rejected (e.g. DRAFT → ACTIVE)
- [x] Approval matrix correctly routes to required authority level
- [x] Approval actions (approve/reject/return) logged and notifications sent
- [x] RM cannot approve their own application (SOD enforced; admin bypass)
- [x] Pipeline view shows applications by status with working filters
- [x] My Approvals inbox shows pending approvals grouped by urgency

---

### SPRINT 3 — Spreading + Scoring
**Weeks 12-15** | 4 weeks | Goal: Financial analysis engine, scorecard, risk grading

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | FinancialStatement Prisma model | ✅ | Fields: borrowerProfileId, period, fiscalYearEnd, statementType (BS/PL/CF), currency, enteredById, reviewedById, status (DRAFT/REVIEWED/APPROVED) |
| 3.2 | FinancialLineItem model | ✅ | Fields: statementId, lineKey, lineLabel, amount, parentLineKey, displayOrder; compound unique on [statementId, lineKey] |
| 3.3 | FinancialRatio model | ✅ | Fields: statementId, ratioKey, ratioLabel, value, category (profitability/leverage/liquidity/coverage/activity) |
| 3.4 | Financial statement CRUD endpoints | ✅ | POST /credit/borrowers/:id/financials, GET/PATCH/DELETE /credit/financials/:id |
| 3.5 | Line item entry (manual) | ✅ | Batch upsert by statementId+lineKey; balance sheet must balance (app-level validation) |
| 3.6 | Maker-checker workflow on financials | ✅ | DRAFT→REVIEWED→APPROVED; admin bypass for single-person testing |
| 3.7 | Ratio computation engine | ✅ | 13 ratios: ROS, ROA, ROE, D/E, D/A, Current, Quick, DSCR, Interest Coverage, Asset/Inventory/Receivables/Payables Turnover |
| 3.8 | Trend analysis | ✅ | Compare ratios across periods; direction (improving/stable/declining) per category |
| 3.9 | Scorecard Prisma model | ✅ | CreditScorecard: name, description, isActive |
| 3.10 | ScorecardVersion model | ✅ | CreditScorecardVersion: factorWeights (9 groups), isActive, effectiveFrom, approvedById? |
| 3.11 | ScoreRun model | ✅ | CreditScoreRun: factorScores, totalScore, riskRating (AAA-D), isOverride, overrideReason, overrideApprovedById |
| 3.12 | Scorecard CRUD + versioning endpoints | ✅ | POST /credit/scorecards, version endpoints, activate version; factor weights must sum to 100 |
| 3.13 | Score execution endpoint | ✅ | POST /credit/applications/:id/score — runs active scorecard against application financials |
| 3.14 | Manual override with reason + approval | ✅ | Override requires reason + second-person approval (real userId FK) |
| 3.15 | Risk grading: score → rating mapping | ✅ | ≥85→AAA, ≥78→AA, ≥70→A, ≥62→BBB, ≥55→BB, ≥48→B, ≥40→CCC, ≥30→CC, ≥20→C, <20→D |
| 3.16 | Exposure aggregation endpoint | ✅ | GET /credit/borrowers/:id/exposure — sum all active facilities per borrower |
| 3.17 | Spreading workspace UI | ✅ | Tab-based BS/PL/CF entry, inline validation, maker-checker status flow |
| 3.18 | Ratio & trend display UI | ✅ | Table with trend arrows (↑↓→), category grouping (5 categories) |
| 3.19 | Scorecard management UI | ✅ | Scorecard list, version history, 9-factor weight sliders, activate version |
| 3.20 | Score run display on application detail | ✅ | Score breakdown, risk rating badge, override button with approver field |
| 3.21 | Exposure summary on borrower detail | ✅ | Aggregate exposure card, utilization bars, breakdown by facility type |

**Sprint 3 Exit Criteria:**
- [x] Can enter financial statements with line items for a borrower
- [x] Balance sheet balance validation works (total assets = total liabilities + equity)
- [x] Maker-checker flow: analyst enters → second analyst reviews → approved (admin bypass)
- [x] 13 ratios auto-computed on approval; trend comparison across periods
- [x] Scorecard version created with 9 factor group weights (must sum to 100)
- [x] Score run produces total score + risk rating for an application
- [x] Manual override requires reason + approver (real userId FK enforced)
- [x] Exposure calculation sums all active facilities for a borrower

---

### SPRINT 4 — Committee + Collateral + Conditions
**Weeks 16-19** | 4 weeks | Goal: Decision-making workflow, collateral tracking, CP/CS tracking

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | CommitteeMeeting Prisma model | ✅ | Fields: title, scheduledAt, location, status (SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED), quorumMin, meetingType (REGULAR/ADHOC) |
| 4.2 | CommitteeMember model | ✅ | Fields: meetingId, userId, role (CHAIR/MEMBER/SECRETARY), attendance (PRESENT/ABSENT/EXCUSED) |
| 4.3 | CommitteeAgendaItem model | ✅ | Fields: meetingId, applicationId, displayOrder, decisionType (APPROVE/REJECT/DEFER), presentedById |
| 4.4 | CommitteeVote model | ✅ | Fields: agendaItemId, memberId, vote (APPROVE/REJECT/ABSTAIN), comments, votedAt |
| 4.5 | Committee CRUD endpoints | ✅ | POST /credit/committee/meetings, GET, PATCH; agenda/vote sub-endpoints |
| 4.6 | Quorum enforcement | ✅ | ≥3 members including ≥1 risk function member; block vote if quorum not met |
| 4.7 | Committee decision → application state | ✅ | Vote outcome advances application from COMMITTEE → DECISIONED (or returns to UNDER_DECISION if deferred) |
| 4.8 | Committee meeting list UI | ✅ | Calendar-style list, status filters, create meeting |
| 4.9 | Committee agenda builder UI | ✅ | Drag-drop applications into agenda, set decision type |
| 4.10 | Committee one-page memo per application | ✅ | Auto-generated: borrower summary, facility details, score, risk rating, mitigants, recommendation |
| 4.11 | Committee vote panel UI | ✅ | Vote buttons, comment field, vote progress indicator |
| 4.12 | Collateral Prisma model | ✅ | Fields: applicationId, borrowerProfileId, type (PROPERTY/VEHICLE/FD/SECURITIES/OTHER), description, ownershipDoc, registeredOwner |
| 4.13 | CollateralValuation model | ✅ | Fields: collateralId, valuedAmount, valuationDate, valuerName, valuationReportUrl, valuerAccreditation |
| 4.14 | CollateralLien model | ✅ | Fields: collateralId, lienType (FIRST/SECOND), lienHolder, registrationDate, dischargeDate |
| 4.15 | InsuranceCover model | ✅ | Fields: collateralId, insurerName, policyNumber, coverageAmount, expiryDate |
| 4.16 | Guarantee model | ✅ | Fields: applicationId, guarantorId (CrmContact), guaranteeType (PERSONAL/CORPORATE), guaranteedAmount, guaranteeDocumentUrl |
| 4.17 | Collateral + guarantee CRUD endpoints | ✅ | Nested under /credit/applications/:id/collateral and /guarantees |
| 4.18 | Collateral management UI | ✅ | Collateral list on application detail, valuation history, lien status |
| 4.19 | Guarantee management UI | ✅ | Guarantor picker (CrmContact search), guarantee details |
| 4.20 | Condition Prisma model | ✅ | Fields: applicationId, type (PRECEDENT/SUBSEQUENT), description, dueDate, responsibleUserId, status (PENDING/WAIVED/COMPLETED/EXPIRED), completedAt, evidenceDocumentUrl |
| 4.21 | Condition CRUD endpoints | ✅ | POST /credit/applications/:id/conditions, PATCH to complete/waive |
| 4.22 | Condition tracker UI | ✅ | Checklist with status chips, evidence upload, due date warnings |
| 4.23 | CP completion → READY_FOR_DRAWDOWN transition | ✅ | All CPs must be COMPLETED or WAIVED before advancing |

**Sprint 4 Exit Criteria:**
- [ ] Can schedule a committee meeting and add applications to agenda
- [ ] Quorum enforcement blocks voting when <3 members or no risk function member
- [ ] Committee vote outcome correctly advances application state
- [ ] One-page memo auto-generates from application data + score + risk rating
- [ ] Can register collateral with valuation, lien, and insurance
- [ ] Can add a guarantor (linked to CrmContact) to an application
- [ ] Conditions tracker shows CP/CS with status, due dates, evidence
- [ ] All CPs completed → application can advance to READY_FOR_DRAWDOWN

---

### SPRINT 5 — Monitoring + Dashboards + Hardening
**Weeks 20-24** | 5 weeks | Goal: Post-disbursement monitoring, dashboards, security hardening

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | FacilityHealth Prisma model | ✅ | Fields: applicationId, healthStatus (HEALTHY/WATCH/AT_RISK/DEFAULT), lastReviewDate, nextReviewDate, reviewFrequency |
| 5.2 | CovenantDefinition model | ✅ | Fields: applicationId, description, type (FINANCIAL/Non-FINANCIAL), metricKey, threshold, frequency (QUARTERLY/SEMI_ANNUALLY/ANNUALLY) |
| 5.3 | CovenantTest model | ✅ | Fields: covenantId, testDate, reportedValue, isCompliant, testedById, notes |
| 5.4 | PaymentEvent model | ✅ | Fields: applicationId, dueDate, paidDate, amount, status (ON_TIME/LATE_30/LATE_60/LATE_90/MISSED) |
| 5.5 | EarlyWarningSignal model | ✅ | Fields: applicationId, signalType, severity (LOW/MEDIUM/HIGH/CRITICAL), description, openedAt, closedAt, resolvedById |
| 5.6 | Covenant test execution (BullMQ scheduled job) | ✅ | monitor.daily queue: check overdue covenants, flag breaches |
| 5.7 | Basic EWS: covenant breach detection | ✅ | CovenantTest.isCompliant=false → create EarlyWarningSignal |
| 5.8 | Payment overdue flagging | ✅ | PaymentEvent LATE_90+ → EarlyWarningSignal severity HIGH |
| 5.9 | Watchlist UI | ✅ | List of applications with active EWS signals, filter by severity |
| 5.10 | Periodic review scheduling | ✅ | FacilityHealth.nextReviewDate; BullMQ job triggers review reminders |
| 5.11 | Covenant test entry UI | ✅ | Entry form for test results, compliance indicator |
| 5.12 | Credit pipeline dashboard | ✅ | Applications by status (bar chart), SLA breach count, avg processing time |
| 5.13 | Approval inbox dashboard | ✅ | Pending approvals for current user, grouped by urgency |
| 5.14 | Borrower exposure summary dashboard | ✅ | Top exposures, sector breakdown, rating distribution |
| 5.15 | Committee calendar dashboard | ✅ | Upcoming meetings, agenda item counts |
| 5.16 | Audit trail hardening: hash-chain on CreditAuditEvent | ✅ | Each event includes hash of previous event; verify chain integrity endpoint |
| 5.17 | Read-logging for sensitive PII | ✅ | Access to borrower NRIC, bank account, financial details logged |
| 5.18 | App-level encryption for PII fields | ✅ | AES-256-CBC with env var CREDIT_ENCRYPTION_KEY; encrypt NRIC, bankAccount, financials at rest |
| 5.19 | Encrypt/decrypt service layer | ✅ | Encapsulate in CreditEncryptionService; transparent to API consumers |
| 5.20 | Document AV scanning: ClamAV integration | ✅ | Scan on upload; block if infected; log result to CreditDocument |
| 5.21 | Export controls | ✅ | credit:export:pii permission + reason capture + watermark on exported files |
| 5.22 | Export audit logging | ✅ | Every export action logged to AuditLog with reason |

**Sprint 5 Exit Criteria:**
- [ ] Covenant test job runs on schedule and detects breaches
- [ ] Covenant breach creates EarlyWarningSignal with correct severity
- [ ] Payment overdue >90 days creates HIGH severity EWS
- [ ] Watchlist shows applications with active signals
- [ ] Periodic review reminders sent when review date approaches
- [ ] All 4 dashboards render with real data
- [ ] Audit hash-chain verifies: tampering with a single event breaks chain
- [ ] PII read access is logged
- [ ] NRIC/bank account fields encrypted at rest in DB
- [ ] Infected document upload is blocked after ClamAV scan
- [ ] Export requires credit:export:pii permission and reason text

---

### SPRINT 6 — Polish + Integration Validation
**Weeks 25-28** | 4 weeks | Goal: UAT-ready, seed data, edge cases, runbooks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Seed demo data: 5-10 borrower profiles (mix individual/corporate) | ⬜ | Including directors, shareholders, UBOs |
| 6.2 | Seed demo data: 15-20 applications across all states | ⬜ | Including at least 1 in each major state |
| 6.3 | Seed demo data: 2 committee meetings with votes | ⬜ | One approved, one deferred |
| 6.4 | Seed demo data: financial statements + ratios for 3 borrowers | ⬜ | 2-3 years each |
| 6.5 | Seed demo data: scorecard with weights, 5+ score runs | ⬜ | Including 1 override |
| 6.6 | Integration spike: test placeholder→real adapter swap procedure | ⬜ | Document step-by-step swap for each adapter |
| 6.7 | RBAC verification matrix test | ⬜ | Every credit:* permission tested across every credit role |
| 6.8 | Edge case: duplicate application detection | ⬜ | Warn if same borrower + same product type already in pipeline |
| 6.9 | Edge case: concurrent approval race condition | ⬜ | Optimistic locking on approval count |
| 6.10 | Edge case: SOD violation on role change | ⬜ | If user's roles change mid-application, re-check SOD |
| 6.11 | Edge case: invalid state transition attempts | ⬜ | Comprehensive error messages for each invalid transition |
| 6.12 | Pagination on all list endpoints | ⬜ | Default 20, max 100; cursor-based for large datasets |
| 6.13 | Feature flags: verify every capability behind a flag | ⬜ | Document flag key ↔ capability mapping |
| 6.14 | Performance: verify 200 concurrent applications | ⬜ | Load test with k6 or similar |
| 6.15 | Admin runbook: approval matrix setup | ⬜ | Step-by-step guide with screenshots |
| 6.16 | Admin runbook: scorecard versioning | ⬜ | Create version → configure weights → activate → backtest |
| 6.17 | Admin runbook: committee scheduling | ⬜ | Schedule → add agenda → present → vote |
| 6.18 | Admin runbook: feature flag management | ⬜ | Toggle capabilities, rollback procedure |
| 6.19 | Adapter swap procedure documentation | ⬜ | Per integration: replace placeholder → configure credentials → test → enable |
| 6.20 | End-to-end smoke test script | ⬜ | Automated test: borrower → application → spreading → scoring → committee → approval → drawdown |

**Sprint 6 Exit Criteria:**
- [ ] Demo seed creates realistic test data without errors
- [ ] Every credit:* permission returns 403 for unauthorized roles
- [ ] Duplicate application detection shows warning
- [ ] Concurrent approval doesn't double-count
- [ ] All list endpoints return paginated results
- [ ] Feature flags correctly enable/disable capabilities
- [ ] Performance test passes at 200 concurrent applications
- [ ] All 4 admin runbooks complete with screenshots
- [ ] Adapter swap procedure documented for all 5 integrations
- [ ] End-to-end smoke test passes from borrower creation through drawdown

---

## 6. Prisma Schema Delta Summary

New models to add (grouped by sprint):

**Sprint 0 (2 models):**
- FeatureFlag
- (BullMQ queue state managed by Redis, not Prisma)

**Sprint 1 (~10 models):**
- BorrowerProfile
- Director
- Shareholder
- UltimateBeneficialOwner
- RelatedPartyGroup
- CreditApplication
- ApplicationFacility
- ApplicationParty
- CreditDocument
- CreditDocumentVersion
- DocumentRequirement
- CreditAuditEvent

**Sprint 2 (2 models):**
- ApprovalMatrix
- ApprovalMatrixVersion

**Sprint 3 (5 models):**
- FinancialStatement
- FinancialLineItem
- FinancialRatio
- Scorecard + ScorecardVersion
- ScoreRun

**Sprint 4 (8 models):**
- CommitteeMeeting
- CommitteeMember
- CommitteeAgendaItem
- CommitteeVote
- Collateral
- CollateralValuation
- CollateralLien
- InsuranceCover
- Guarantee
- Condition

**Sprint 5 (5 models):**
- FacilityHealth
- CovenantDefinition
- CovenantTest
- PaymentEvent
- EarlyWarningSignal

**Total: ~32 new Prisma models**

Schema modifications to existing models:
- CrmAccount: + borrowerProfileId (1:1)
- CrmContact: + borrowerProfileId (1:1)
- CrmKycRecord: + amlRiskTier, screeningStatus, screeningHits, lastScreeningAt, nextScreeningDueAt
- User: + credit-* role relations (via UserRole)
- WorkflowType/Step/Transition: seed CREDIT_APPLICATION workflow

---

## 7. New credit:* Permissions

| Permission | Resource | Action | Description |
|-----------|----------|--------|-------------|
| credit:read | credit | read | View credit module data |
| credit:write | credit | write | Create/edit credit data |
| credit:delete | credit | delete | Delete credit data |
| credit:approve | credit | approve | Approve/reject credit applications |
| credit:committee | credit | committee | Participate in committee votes |
| credit:score | credit | score | Run scorecards, override ratings |
| credit:spread | credit | spread | Enter/review financial spreading |
| credit:analyze | credit | analyze | Access analytics and dashboards |
| credit:admin | credit | admin | Configure credit module settings |
| credit:compliance | credit | compliance | Access compliance/AML functions |
| credit:risk | credit | risk | Access risk management functions |
| credit:export | credit | export | Export credit data (with reason capture) |
| credit:override | credit | override | Override automated decisions with justification |
| credit:monitor | credit | monitor | Access post-disbursement monitoring |
| credit:document | credit | document | Manage credit documents, upload/download |

Role → Permission mapping (seed):

| Permission | credit:rm | credit:analyst | credit:manager | credit:senior | credit:committee | credit:admin |
|-----------|:---------:|:--------------:|:-------------:|:------------:|:--------------:|:----------:|
| credit:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| credit:write | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| credit:delete | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| credit:approve | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| credit:committee | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| credit:score | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| credit:spread | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| credit:analyze | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| credit:admin | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| credit:compliance | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| credit:risk | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| credit:export | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| credit:override | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| credit:monitor | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| credit:document | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## 8. API Surface Summary

All endpoints under `/api/v1/credit/`, behind `authenticate` + feature flag + `requirePermission('credit:*')`.

### Borrowers
- `GET    /borrowers` — list (paginated, filterable)
- `GET    /borrowers/:id` — detail
- `POST   /borrowers` — create (link to CrmAccount/CrmContact)
- `PATCH  /borrowers/:id` — update
- `DELETE /borrowers/:id` — soft delete
- `GET    /borrowers/:id/exposure` — aggregate exposure summary
- `POST   /borrowers/:id/directors` — add director
- `POST   /borrowers/:id/shareholders` — add shareholder
- `POST   /borrowers/:id/ubos` — add UBO
- `GET    /borrowers/:id/related-parties` — list related parties

### Applications
- `GET    /applications` — list (filtered by status, assignee, borrower)
- `GET    /applications/:id` — detail (includes facilities, parties, documents, approvals, score, conditions)
- `POST   /applications` — create
- `PATCH  /applications/:id` — update (DRAFT only)
- `POST   /applications/:id/transition` — state transition
- `POST   /applications/:id/facilities` — add facility
- `POST   /applications/:id/parties` — add party (borrower/guarantor)
- `POST   /applications/:id/approvals` — approve/reject/return
- `POST   /applications/:id/score` — run scorecard
- `GET    /applications/:id/conditions` — list conditions
- `POST   /applications/:id/conditions` — add condition
- `PATCH  /applications/:id/conditions/:condId` — complete/waive
- `POST   /applications/:id/collateral` — add collateral
- `POST   /applications/:id/guarantees` — add guarantee

### Documents
- `GET    /applications/:id/documents` — list
- `POST   /applications/:id/documents` — upload
- `GET    /documents/:id` — detail + download URL
- `POST   /documents/:id/versions` — upload new version
- `GET    /applications/:id/checklist` — document requirements + completion %

### Financials (under borrower)
- `GET    /borrowers/:id/financials` — list statements
- `POST   /borrowers/:id/financials` — create statement + line items
- `PATCH  /financials/:id` — update line items
- `POST   /financials/:id/review` — maker-checker review
- `POST   /financials/:id/approve` — maker-checker approve
- `GET    /borrowers/:id/financials/ratios` — computed ratios + trends

### Scorecards
- `GET    /scorecards` — list
- `POST   /scorecards` — create
- `GET    /scorecards/:id` — detail + versions
- `POST   /scorecards/:id/versions` — create version with factor weights
- `PATCH  /scorecard-versions/:id/activate` — activate a version

### Committee
- `GET    /committee/meetings` — list
- `POST   /committee/meetings` — schedule
- `GET    /committee/meetings/:id` — detail + agenda + votes
- `PATCH  /committee/meetings/:id` — update
- `POST   /committee/meetings/:id/agenda` — add agenda item
- `POST   /committee/agenda/:id/vote` — cast vote
- `POST   /committee/meetings/:id/close` — close meeting + process outcomes

### Dashboards
- `GET    /dashboard/pipeline` — pipeline stats
- `GET    /dashboard/approvals` — my pending approvals
- `GET    /dashboard/exposure` — borrowing exposure summary
- `GET    /dashboard/committee` — committee calendar

### Admin
- `GET    /approval-matrix` — list matrix entries
- `POST   /approval-matrix` — create entry
- `PATCH  /approval-matrix/:id` — update
- `GET    /feature-flags` — list flags
- `PATCH  /feature-flags/:key` — toggle flag

---

## 9. Frontend Navigation Structure

New "Credit" top-level nav section:

```
Credit
├── Pipeline          — Application pipeline view (all applications by status)
├── Applications       — List + detail (CRUD, state machine, documents, approvals)
├── Borrowers         — Borrower profiles (linked to CRM)
├── Decisions         — Approval inbox (pending my action)
├── Committee         — Committee meetings, agenda, votes
├── Conditions        — CP/CS tracker across all applications
├── Watchlist         — EWS signals + flagged applications
├── Scorecards        — Scorecard management (admin)
├── Approval Matrix   — Matrix config (admin)
└── Settings          — Feature flags, adapter config (admin)
```

Page component files:
```
frontend/pages/
  credit/
    CreditPipeline.tsx
    CreditApplications.tsx
    CreditApplicationDetail.tsx
    CreditApplicationCreate.tsx
    CreditBorrowers.tsx
    CreditBorrowerDetail.tsx
    CreditBorrowerCreate.tsx
    CreditDecisionInbox.tsx
    CreditCommittee.tsx
    CreditCommitteeDetail.tsx
    CreditConditions.tsx
    CreditWatchlist.tsx
    CreditScorecards.tsx
    CreditApprovalMatrix.tsx
    CreditSettings.tsx
```

Frontend service file:
```
frontend/src/services/credit.service.ts
```

---

## 10. Risk Mitigation for Solo Dev

| Risk | Severity (from §13) | Mitigation |
|------|---------------------|------------|
| Scope creep | High | Strict MVP scope above; every addition goes through backlog grooming with justification |
| Single point of failure | High | Feature flags = incomplete capabilities stay OFF; comprehensive runbooks; auto-audit trail |
| SOD failure | High | Enforce in middleware, not UI; test in Sprint 6 |
| Override misuse | High | Every override requires reason + second-person approval; auto-logged |
| AML false-clear | High | Placeholder returns CLEAR but CrmKycRecord requires manual sign-off before app advances; flag as TOP PRIORITY for post-MVP |
| Scorecard miscalibration | Medium | Versioned scorecards; manual review before activating version; backtest endpoint |
| Credential theft / PII exposure | High | App-level AES-256 FLE for PII in MVP; MFA queued as first post-MVP priority |
| Data exfiltration | Medium | Export permission + reason capture + watermark |
| Concurrent approval race | Medium | Optimistic locking on approval count (Sprint 6) |
| Document malware | Medium | ClamAV scanning in pipeline (Sprint 5) |
| Audit log tampering | Medium | Hash-chain verification (Sprint 5) |

---

## 11. Post-MVP Priority Queue

Ordered by risk + value after MVP ships:

1. **MFA + corporate IdP** — Highest security risk mitigant
2. **AML screening provider (real)** — Highest compliance risk mitigant
3. **KMS-based FLE upgrade** — Replace env-key AES-256 with proper key management
4. **Credit bureau integration** — Reduces manual data entry + improves scoring accuracy
5. **OCR-assisted spreading** — Biggest time-saver for analysts
6. **CBS handoff** — Required before real disbursement
7. **E-signature** — Process efficiency
8. **Regulatory report generation** — BNM compliance
9. **AI features** (per §05 v2 sequencing) — Incremental value-add
10. **WAF + CDN + SIEM** — Production security hardening

---

## 12. Progress Tracking

Update Status column in each sprint table as work progresses:
- ⬜ Not started
- 🔄 In progress
- ✅ Done
- ❌ Blocked (add note)
- ⏭️ Deferred (add note + reason)

When all exit criteria for a sprint are checked off, the sprint is complete and the next sprint begins.

---

## Appendix A: Credit Application State Machine

```
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
                    v                                                  │
  DRAFT ──► SUBMITTED ──► ANALYSING ──► UNDER_DECISION ──► COMMITTEE ─┤
    │          │              │               │                │       │
    │          │              │               │                │       │
    │          ▼              ▼               │         ┌──────┘       │
    │       WITHDRAWN    RETURNED             │         │              │
    │                          │              │         ▼              │
    │                          └──► DRAFT     │    DECISIONED          │
    │                                         │      │    │           │
    │                                         │      │    ▼           │
    │                                         │      │  DECLINED     │
    │                                         │      │               │
    │                                         │      ▼               │
    │                                         │ CONDITIONS_          │
    │                                         │  PRECEDENT          │
    │                                         │      │               │
    │                                         │      ▼               │
    │                                         │ READY_FOR_           │
    │                                         │  DRAWDOWN            │
    │                                         │      │               │
    │                                         │      ▼               │
    │                                         │    ACTIVE ───────────┘
    │                                         │      │
    │                                         │      ├──► CLOSED
    │                                         │      ├──► DEFAULT
    │                                         │      └──► WRITTEN_OFF
    │                                         │
    └─────────────────────────────────────────┘
    
    LAPSED ← any active state (timeout)
```

---

## Appendix B: Approval Authority Matrix (Seed Default)

| Exposure Range | Risk Rating | Authority Level | Required Approvals |
|---------------|-------------|----------------|-------------------|
| ≤ RM 500K | AAA–BBB | Credit Manager | 1 |
| ≤ RM 500K | BB–B | Senior Credit Officer | 2 |
| ≤ RM 2M | AAA–BBB | Senior Credit Officer | 2 |
| ≤ RM 2M | BB–CCC | Credit Committee | Committee quorum |
| ≤ RM 10M | AAA–BBB | Credit Committee | Committee quorum |
| ≤ RM 10M | BB–CCC | Board Risk Committee | Committee + Board |
| > RM 10M | Any | Board Risk Committee | Committee + Board |
| Related-party | Any | +1 tier from normal | Per above + 1 |

---

## Appendix C: Scorecard Factor Weights (Seed Default)

Per §04 Framework:

| Factor Group | Weight | ID |
|-------------|--------|-----|
| Financial Profitability | 15% | F1 |
| Leverage | 15% | F2 |
| Liquidity | 12% | F3 |
| Debt Service Coverage | 18% | F4 |
| Business Quality | 10% | F5 |
| Market Position | 8% | F6 |
| Industry / Country Risk | 7% | F7 |
| Behavioural / Track Record | 10% | F8 |
| Collateral / Structure | 5% | F9 |

Qualitative overlay: ±5% (manual adjustment by analyst, requires justification).

Risk Rating mapping (score → rating):
- 90–100 → AAA
- 80–89 → AA
- 70–79 → A
- 60–69 → BBB
- 50–59 → BB
- 40–49 → B
- 30–39 → CCC
- 20–29 → CC
- 10–19 → C
- 0–9 → D

Mandatory red-flag downgrade triggers:
- Unresolved PEP match
- Active sanctions hit
- Confirmed fraud indicator
- Covenant breach in existing facility