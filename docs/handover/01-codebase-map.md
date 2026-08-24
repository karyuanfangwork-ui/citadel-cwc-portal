# ESM Credit LOS — Codebase Map

A directory-by-directory guide to the credit module, backend and frontend. All paths relative to repo root.

---

## 1. Backend module root: `backend/src/credit/`

```
backend/src/credit/
├── routes/         Express routers (~74 files) — credit.routes.ts is the master
├── controllers/    69 HTTP controllers (thin; delegate to services)
├── services/       ~108 service files (business logic — the meat)
├── middleware/     14 dedicated middleware (authz, scoping, flags, MFA, DLP, SOD, audit)
├── adapters/       External integrations (bureau, AI, AV-scanner registry)
├── validators/     Joi request validators
├── queues/         BullMQ queue setup (queues/index.ts)
├── jobs/           Recurring jobs (SLA checker, AML rescreen, collateral insurance, audit retention, LOO expiry, monitor)
├── schedulers/     node-cron schedulers (looExpiry.scheduler.ts)
├── templates/      Email/PDF templates
├── types/          Shared types & enums (credit.types.ts)
├── constants/      Domain constants (e.g. financialStatementTemplates.ts)
├── utils/          Helpers
└── __tests__/      Tests (also per-directory __tests__/)
```

### Routes — the entry points

**`routes/credit.routes.ts`** is the **master router**. Everything mounts here. Its structure (by comment grouping):

- Global gates: service-API-key AV-callback (unauthenticated) + `feature-flags` endpoints (before auth), then `authenticate` + `requireFeatureFlag('credit:module')`, then `health`.
- **`/applications/:applicationId`** parent guard (line 242): `applyRmScope()` + `requireApplicationAccess()` — inherited by all nested app-scoped routers.
- Mounted domains (each is a sub-router under `routes/`):
  - **Borrower & parties:** `/borrowers` (borrowerProfile, director, fatcaCrs, shareholder, ubo), `/borrowers/duplicate-exceptions`, `/related-party-groups`, `/branches`
  - **Documents:** `creditDocumentRoutes` (mounted at root), `/applications/.../ca-memo*`, `/applications/.../ca-memo-versions*`, `/applications/.../approval-pack`
  - **Applications:** `/applications` (application, applicationFacility, applicationParty, requestItem, exposureSummary, externalRating, ecl, projection, sensitivityScenario)
  - **Approval:** `approvalRoutes` (root), `/approvals`
  - **Webhooks:** `/webhooks`
  - **Financials:** `/borrowers`, `/financials`, `/scorecards`, `/scorecard-versions`, `/applications`, `/score-runs`
  - **Committee:** `/committee`
  - **Collateral:** `/applications`, `/collateral`
  - **Guarantees:** `/applications`
  - **Conditions:** `/applications`, `/conditions`
  - **Dashboard:** `/dashboard`; **Reports:** `/reports`
  - **Monitoring:** `/applications`, `monitoringItemRoutes`
  - **Security:** `/security`
  - **Recommendation:** `creditRecommendationRoutes`; **Borrower risk:** `borrowerRiskRoutes`
  - **CA Memo Phase 4:** `/applications` (profitability, walletShare, keyCounterparty, accountUtilisation)
  - **Score override:** `/score-overrides`; **Delegation:** `/delegation`
  - **SLA:** `/sla`; **DLP:** root; **Disbursement:** `/applications`; **Pricing:** `/applications`; **LOO:** `/applications`; **Rejection:** `/applications`; **AML rescreen:** root
  - **Policy limits:** `/policy-limits`; **Rule config:** root; **FX rates:** `/fx-rates`
  - **Credit AI:** `/applications`
  - **Deviation:** `/deviations`; **Consent:** `/consent`; **STR:** `/str`; **MFA:** `/mfa`
  - **Lane:** `/applications/:id/lane`, `/applications/:id/tabs`
  - **SME financial:** `/sme`; **Comments:** root

> The route file comments are grouped by **sprint / phase / §section** (Sprint 1–5, CA Memo Phases 2–5, §1.x/§2.x/§6.x, P-x). This is the fastest way to understand the module's build history and intent.

### Controllers — the HTTP handlers

`backend/src/credit/controllers/` (69 files). Naming is `domain.controller.ts`. Thin: parse/validate request, call a service, shape the response. Notable non-per-domain ones:
- `caMemoPdf.controller.ts` — generates CA memo PDF.
- `approvalPack.controller.ts` — builds the approval pack.
- `lane.controller.ts` — lane determination + tab routing.
- `clamav.controller.ts` — AV-scanning callback.
- `exportToken.controller.ts` — DLP export tokens.

### Services — business logic (the meat)

`backend/src/credit/services/` (~108 files). Key ones for orientation:
- **`creditApplication.service.ts`** (1,943 lines) — the state machine (`TRANSITIONS`), `createApplication/updateApplication/transitionApplication`, application number generation, audit trail, evidence mapping, clone. **Read this first.**
- `stateGuard.util.ts` — sub-resource edit/deletion guards by parent state.
- `creditRuleEngine.service.ts`, `creditRuleDefaults.ts`, `missingDataPolicy.service.ts` — rules engine.
- `scoring.service.ts`, `scorecard.service.ts`, `scoreFactorDefinition.service.ts`, `ratingBand.service.ts`, `scoreOverride.service.ts`, `recalc.service.ts` — scoring & risk rating.
- `approvalMatrix.service.ts`, `approvalAction.service.ts`, `committee.service.ts`, `committeeEntryGate.ts`, `approvalPack.service.ts`, `signoff.service.ts` — approval chain.
- `creditSla.service.ts`, `lane.service.ts`, `dashboard.service.ts`, `reports.service.ts` — ops.
- `auditChain.service.ts`, `dlp.service.ts`, `exportAudit.service.ts`, `piiReadLog.service.ts`, `encryption.service.ts` — security/audit.
- `credit-ai.service.ts`, `creditAiCompliance.service.ts` — AI-assisted credit.
- `borrowerOnboarding.service.ts`, `borrowerProfile.service.ts`, `borrowerCreditData.service.ts`, `borrowerDuplicateException.service.ts`, `borrowerRisk.service.ts` — borrower.
- `caMemoPdf.service.ts`, `htmlToPdf.service.ts` — document generation.
- `disbursement.service.ts`, `loo.service.ts`, `condition.service.ts`, `rejection.service.ts` — downstream lifecycle.

### Middleware — cross-cutting

`backend/src/credit/middleware/` (14): `applicationAccess`, `assertBorrowerAccess`, `assertCreditDocumentAccess`, `autoAudit`, `consent`, `dlp`, `featureFlag`, `fieldEncryption`, `mfa`, `piiReadLog`, `rmScope`, `sod`. (Plus `__tests__`.)

### Jobs & schedulers

`backend/src/credit/jobs/`: `amlRescreenChecker.ts`, `auditRetention.job.ts`, `collateralInsuranceMonitor.job.ts`, `creditSlaChecker.ts`, `looExpiry.job.ts`, `monitor.job.ts`.
`backend/src/credit/schedulers/`: `looExpiry.scheduler.ts`.
`backend/src/credit/queues/`: `index.ts` (BullMQ).

---

## 2. Backend mount point (outside the module)

`backend/src/routes/index.ts:95` → `router.use('/credit', creditRoutes)` → all endpoints under **`/api/v1/credit`**. The `API_PREFIX` env var is configurable.

---

## 3. Prisma schema (`backend/prisma/schema.prisma`)

- **210 models** total; ~60+ are credit-related (see **[02-data-model.md](02-data-model.md)**).
- `ApplicationState`, `FacilityType`, `RiskRating`, `CommitteeVoteChoice`, `DisbursementStatus`, etc. are Prisma **enums** here — single source of truth. Import from `@prisma/client`, don't duplicate.
- God-models to treat carefully: `CreditApplication` (~68 fields / 40+ relations), `BorrowerProfile`, `User` (~106 fields / 80+ relations).

---

## 4. Frontend

```
frontend/
├── App.tsx                        React Router — /credit subtree (see 06-frontend-map.md)
├── pages/credit/                  Credit pages (dashboard, create, committee, reports, mobile)
├── pages/CreditApplicationList.tsx / CreditApplicationDetail.tsx   (root pages dir)
├── src/components/credit/         Credit components, incl. borrower360/ workspace
└── src/services/
    ├── credit.service.ts          (3,775 lines) — main credit API client
    ├── credit.types.ts            shared types/enums
    └── creditAi.service.ts        AI-assisted credit client
```

See **[06-frontend-map.md](06-frontend-map.md)** for the full frontend breakdown.

---

## 5. How to navigate a feature end-to-end (worked example)

Take **"make an offer on a credit application"**:

1. **Frontend** — application detail workspace → Conditions/Offer tab calls `frontend/src/services/credit.service.ts`.
2. **HTTP** — `POST /api/v1/credit/applications/:id/transition` (mounted in `credit.routes.ts` → `creditApplicationRoutes`).
3. **Controller** — `creditApplication.controller.ts` parses `{ action: 'make_offer' }`, applies `requireTransitionPermission`.
4. **Service** — `creditApplication.service.ts::transitionApplication` → finds transition, runs **CP-fulfilment gate**, guarded `$transaction`, writes audit event.
5. **Prisma** — updates `CreditApplication.state` to `OFFER`, increments `version`.

Follow this same path for any feature: route → controller → service → schema.
