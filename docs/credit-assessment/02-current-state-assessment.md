# 02 — Current-State Assessment

All findings are code-grounded. Evidence cited as `path:line`.

## 1. Architecture snapshot

**Backend**: Node.js + Express `4.21.2` + TypeScript `5.8` + Prisma `5.22` on PostgreSQL. JWT auth via passport-jwt. API prefix `/api/v1` (`backend/src/config/index.ts:8`). Middleware stack: helmet → cookie-parser → CORS → JSON/urlencoded (50MB) → compression → morgan → rate-limit → routes → 404 → error handler (`backend/src/app.ts:27-62`). 36 route modules mounted (`backend/src/routes/index.ts`). 60 Prisma models (`backend/prisma/schema.prisma`).

**Frontend**: React 19.2 + Vite 6 + React Router v7 + Axios. Page split: `frontend/pages/` (feature pages) and `frontend/src/pages/` (auth). Services per domain in `frontend/src/services/`.

**Storage**: AWS S3 (or MinIO fallback) via `@aws-sdk/client-s3`; 10MB upload cap; MIME allowlist + extension double-check (`backend/src/middleware/upload.middleware.ts:11-141`); **no AV scanning**, the `RequestAttachment.isScanned` flag exists but is never set true.

**Async / scheduled work**: `node-cron`; SLA checker and CRM automation jobs (`backend/src/config/index.ts:114-128`). **No durable job queue** (no BullMQ/Redis-queue, no Temporal).

## 2. Existing domain modules

| Domain | Mounted at | Notes |
|---|---|---|
| Auth, Users, Roles, Permissions | `/auth`, `/users` | Solid. RBAC works via `requirePermission(...names)` (`backend/src/middleware/auth.middleware.ts:314-333`). |
| Service Desk + Requests | `/requests`, `/service-desks` | Ticket lifecycle; configurable workflow steps and transitions. |
| Approvals (generic) | `/approvals` | `RequestApproval` model with approver types `CEO`, `HIRING_MANAGER`, `ENTITY` (`schema.prisma:731-752`). **No bare-route permission gates.** |
| Onboarding/Offboarding/Hiring/LOA | various | Workflow templates exist. Not credit-relevant but proves workflow engine is reusable. |
| IT/Finance/Chargeback workflows | `/it-workflow`, `/finance-workflow`, `/chargeback-workflow` | Expense reimbursement up to thresholds. |
| Assets (ITAM) | `/assets` | Demonstrates registry + assignment pattern reusable for collateral. |
| CRM (Accounts, Contacts, Leads, Opportunities, Pipeline, Activities, KYC) | `/crm` | 60 endpoints, 59 permission gates. Closest existing module to credit. |
| CRM-AI | `/crm-ai` | OpenAI-powered scoring, briefings, KYC-gap detection, win/loss debrief. Uses `gpt-4o-mini` and `gpt-4o` (`backend/src/services/crm-ai.service.ts:18-19`). |
| Audit Logs | `/admin/audit-logs` | `AuditLog` model with JSONB old/new values (`schema.prisma:889-918`). Manual call-site coverage only. |
| Notifications | `/notifications`, `/notifications/sse` | SSE stream + email via Resend + templated. |
| Reporting | `/reports` | Generic request/perf reports. |

## 3. Reusable foundations for credit

| Capability | Reusable? | Evidence |
|---|---|---|
| Authn / JWT / session | ✅ As-is | `auth.middleware.ts` |
| RBAC fine-grained | ✅ Extend with `credit:*` permissions | `requirePermission` |
| Audit trail | 🟡 Extend to auto-log via Prisma middleware | `utils/audit.ts:7-33` |
| Approval engine | 🟡 Extend with conditional / matrix / quorum logic | `RequestApproval` model |
| Document upload | 🟡 Add AV, OCR, versioning, classification | `upload.middleware.ts` |
| Workflow / state machine | 🟡 Reuse `WorkflowType/Step/Transition` for credit lifecycle | `schema.prisma:305-341` |
| Notifications (SSE + email) | ✅ As-is | `email.service.ts` |
| Customer entity (CRM Account) | ✅ As "Borrower" with extensions | `CrmAccount:1458-1498` |
| KYC scaffolding | 🟡 PEP flag exists; needs ongoing screening hook | `CrmKycRecord:1838-1866` |
| AI infrastructure | ✅ Extend with credit-specific prompts + guardrails | `crm-ai.service.ts` |

## 4. Gaps relative to corporate/SME credit (BNM-aligned)

### 4.1 Data-model gaps (most critical)

No model exists for any of:

- **Credit facility**: `CreditApplication`, `CreditFacility`, `FacilityTranche`, `Drawdown`, `RepaymentSchedule`, `InterestRate`, `Tenor`
- **Financial spreading**: `FinancialStatement`, `FinancialPeriod`, `FinancialLineItem`, `FinancialRatio`
- **Scoring / rating**: `Scorecard`, `ScorecardVersion`, `ScoreFactor`, `ScoreRun`, `InternalRating`, `RatingHistory`, `PDLossGivenDefault`
- **Collateral**: `Collateral`, `CollateralValuation`, `CollateralLien`, `CollateralHaircut`, `InsuranceCover`
- **Guarantees**: `Guarantor`, `PersonalGuarantee`, `CorporateGuarantee`, `GuarantorFinancial`
- **Exposure**: `Exposure`, `CounterpartyExposure`, `RelatedPartyGroup`, `SectorExposure`, `LimitDefinition`, `LimitBreach`
- **Approval matrix**: `ApprovalMatrix`, `ApprovalRule`, `CommitteeMeeting`, `CommitteeMember`, `CommitteeDecision`, `Quorum`
- **Monitoring**: `EarlyWarningSignal`, `CovenantDefinition`, `CovenantTest`, `WatchlistAssignment`, `CreditEvent`
- **Compliance**: `AmlScreeningRun`, `SanctionMatch`, `PepReview`, `AdverseMediaHit`, `OngoingScreeningSchedule`, `RegulatoryReportRun`

### 4.2 Process / control gaps

- **No segregation of duties enforcement** at credit decision (one user could create, score, and approve today).
- **No maker-checker pattern** in any approval flow.
- **No four-eyes review** for high-risk artefacts (e.g., scorecard overrides).
- **No formal credit policy codification** — rules would live in code, not data.
- **No conflict-of-interest / related-party detection.**
- **No ongoing AML screening loop** — KYC is a one-time capture.
- **No covenant compliance testing.**

### 4.3 Document-management gaps

- No AV scanning despite `isScanned` field (`schema.prisma:589`).
- No OCR / text extraction.
- No document versioning (replace = lose history).
- No document-required-by-stage checklist.
- No signature / e-sign integration.
- 10MB cap too low for full credit dossiers (large PDFs of financials).

### 4.4 AI governance gaps

- CRM-AI is unbounded in terms of explainability — outputs are stored as JSON blobs without prompt/response audit on every call.
- No model versioning, no champion/challenger, no drift monitoring.
- No human-override audit field on AI suggestions.

### 4.5 Security gaps relative to financial-services baseline

- No MFA (codebase shows only JWT + password).
- No session lockout / device binding.
- No field-level encryption (e.g., NRIC, bank account, financials at rest beyond DB-level encryption).
- No DLP / data-loss prevention controls on exports.
- Rate limiting at app-tier only; no WAF mentioned.
- No PII tokenisation / pseudonymisation in lower environments.

### 4.6 Operational gaps

- No durable job queue → AML re-screening, batch ratio computation, scheduled reporting would be brittle on cron.
- No structured observability (Morgan logs only; no metrics, no tracing).
- No BCP/DR runbook in repo.
- No load/performance test artefacts.

## 5. Maturity scoring

Scale: 1 (Ad-hoc) → 5 (Optimised). Score against **what a BNM-supervised credit-origination platform needs**.

| Dimension | Score | Comment |
|---|---|---|
| Architecture | 3 / 5 | Modular, but no queue/eventing for credit-scale durability |
| Business process | 1 / 5 | No credit process exists yet |
| Technical maturity | 3 / 5 | Modern stack, decent patterns, low test coverage assumed |
| Operational maturity | 2 / 5 | Cron-driven, no SRE practices in repo |
| Security maturity | 2 / 5 | OWASP basics covered; missing MFA, FLE, DLP, WAF |
| Compliance readiness (BNM RMiT) | 1 / 5 | No DPIA, no outsourcing register, no formal control library |
| Risk exposure | 🔴 High if launched as-is | See §13 risk register |
| Integration readiness | 2 / 5 | No CBS connector, no bureau, no AML provider |
| Production readiness | 2 / 5 | Works for service-desk; not for sanctioning loans |
| Dependency mapping | 2 / 5 | Implicit; no formal dependency register |

## 6. Key dependency map (high-level)

```
[CWC Portal / CAM]
   ├── PostgreSQL (existing)
   ├── S3 / MinIO (existing)
   ├── Resend (email, existing)
   ├── OpenAI (existing — extend)
   ├── Identity provider / MFA (NEW — Auth0 / WSO2 / Cognito)
   ├── AML/PEP/Sanctions screening (NEW — Refinitiv / Dow Jones / LSEG)
   ├── Credit bureau (NEW — CTOS / RAM Credit Info / CCRIS data feed)
   ├── OCR / document AI (NEW — Azure Document Intelligence / Textract)
   ├── E-signature (NEW — DocuSign / Adobe Sign)
   ├── Core Banking System / G/L (NEW connector — for booked facilities)
   └── BI / DWH (NEW — for portfolio analytics, regulatory reporting)
```

## 7. Conclusion

The platform is a **solid origination chassis**, not a credit system. To deliver corporate/SME credit assessment safely, we must add ~15–18 new data models, an approval-matrix engine, an AML/screening integration, an OCR/spreading pipeline, a scorecard service, a portfolio monitor, and harden security to financial-services baseline. The 12-phase roadmap (§07) sequences this work to minimise disruption.
