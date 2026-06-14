# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

CWC 2.0 is an Enterprise Help Center / Service Desk system supporting IT Support, HR Services, and Group Finance workflows. Monorepo with separate `backend/` and `frontend/` directories.

## Commands

### Backend (run from `backend/`)
- **Dev server:** `npm run dev` (tsx watch, port 3000)
- **Build:** `npm run build` (tsc)
- **Tests:** `npm test` / `npm run test:watch` / `npm run test:coverage`
- **Lint:** `npm run lint` / `npm run lint:fix`
- **DB migrations:** `npx prisma migrate dev`
- **DB seed:** `npm run prisma:seed`
- **DB studio:** `npm run prisma:studio`
- **Generate Prisma client:** `npm run prisma:generate`

### Frontend (run from `frontend/`)
- **Dev server:** `npm run dev` (Vite, port 5173)
- **Build:** `npm run build`

## Architecture

### Backend
- **Runtime:** Node.js + Express + TypeScript
- **ORM:** Prisma with PostgreSQL (`backend/prisma/schema.prisma`)
- **Auth:** JWT via passport-jwt, bcrypt password hashing
- **API prefix:** `/api/v1` (configurable via `API_PREFIX` env var)
- **Config:** `backend/src/config/index.ts` — centralized env var config
- **Route structure:** `backend/src/routes/index.ts` mounts all sub-routers. Each domain has its own `*.routes.ts` and `*.controller.ts`.
- **Middleware stack:** helmet → CORS → body parser → compression → morgan → rate limiter → routes → 404 → error handler
- **Services layer:** `backend/src/services/` for business logic

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Routing:** React Router v7 (defined in `frontend/App.tsx`)
- **Path alias:** `@` maps to `frontend/` root
- **API client:** Axios, base URL from `VITE_API_URL` env var
- **Auth context:** `frontend/src/context/AuthContext`
- **Page components split across two dirs:** `frontend/pages/` (main pages) and `frontend/src/pages/` (auth pages like Login/Register)
- **Shared components:** `frontend/src/components/`
- **Frontend services:** `frontend/src/services/` — one file per domain (e.g. `asset.service.ts`, `approval.service.ts`, `it-workflow.service.ts`, etc.)
- **RBAC:** `requirePermission()` middleware enforces fine-grained permissions (loaded in auth middleware, cached in Redis 5min TTL)

### Key Domain Areas
- **Service Desks:** IT Support (5 categories), HR Services (4 categories), Group Finance (3 categories)
- **Workflows:** Request creation, approvals, interviews, screening, LOA, onboarding, offboarding, chargeback
- **Roles:** Admin, Agent, End User
- **IT Asset Management (ITAM):** Asset registry, assignment tracking, lifecycle management (`frontend/pages/AssetManagement.tsx`, `backend/src/routes/asset.routes.ts`, `frontend/src/services/asset.service.ts`)
  - Asset categories: LAPTOP, DESKTOP, MONITOR, PERIPHERAL, PHONE, NETWORK, PRINTER, SOFTWARE_LICENSE, OTHER
  - Models: `Asset`, `AssetAssignment` in Prisma schema
- **SLA & Escalation:** SLA hours configurable per request type; `EscalationRule` model with CRUD at `/api/v1/sla`; `checkEscalations()` in `sla.service.ts`; pause/resume via `sla-pause.service.ts`
- **Notifications:** SSE (`/api/v1/notifications/sse`), templates (`notificationTemplate.routes.ts`), email via `email.service.ts`
- **Reports:** `reports.routes.ts` + `reports.service.ts`
- **Knowledge Base:** `kb.routes.ts` + `kb.service.ts`
- **Entity routing:** `entityRouting.service.ts` — determines which agent/team handles a request

### Seed Accounts (use @test.local domain, see `.env` for passwords)
- Admin: `admin@test.local`
- HR: `hr@test.local`
- IT: `it@test.local`
- CEO: `ceo@test.local`
- Group CEO: `groupceo@company.com`
- Legacy: `user@helpdesk.com`


<claude-mem-context>
# Memory Context

# [citadel-cwc-portal] recent context, 2026-06-14 6:17pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (17,858t read) | 434,882t work | 96% savings

### Jun 13, 2026
S514 updateAccount and updateOpportunity Scope Guards Confirmed — applyOwnerScope Pattern Consistent (Jun 13 at 11:40 AM)
1946 7:55p 🔵 crm.controller.ts: Full Authorization Architecture Confirmed — 2232 Lines with Scope Helpers
1947 7:56p 🔵 CRM Scope Service and Reports Service: Owner Scoping Confirmed Live in Code
1948 " 🔵 crm-access.service.ts vs crm-scope.service.ts: Two Coexisting Scoping Services with Different null-owner Policies
1949 " 🔵 crm-authz.integration.test.ts: Comprehensive Authorization Coverage Confirmed Across All Plan Domains
1950 7:57p 🔵 createLead Missing Owner Assignment Scope Check — Plan Requirement Gap Identified
1951 7:58p 🔵 updateAccount and updateOpportunity Scope Guards Confirmed — applyOwnerScope Pattern Consistent
S515 CRM Audit Remediation: Next steps and action plan for completing Sprint 1-5 security remediations (Jun 13 at 7:58 PM)
S516 CRM Remediation Completion Plan — 9-phase implementation plan authored, awaiting greenlight to execute (Jun 13 at 10:23 PM)
S517 2026-06-13-crm-remediation-completion.md: 9-phase CRM security remediation plan created (Jun 13 at 10:29 PM)
1952 10:30p 🔵 docs/superpowers/plans: Full plan file inventory mapped
1953 " ✅ 2026-06-13-crm-remediation-completion.md: 9-phase CRM security remediation plan created
S519 CRM remediation test files lint-cleaned — warning count reduced from 1042 to 1039 (Jun 13 at 10:30 PM)
### Jun 14, 2026
1954 9:11a 🔵 CRM Remediation Completion Plan: 9-Phase Security Gap Closure
1955 " ⚖️ CRM Remediation Execution: Proceeding in Current Workspace Without Isolation
1956 9:12a 🔵 crm.routes.ts: CRM AI Routes and OAuth Callbacks Architecture Confirmed
1957 " 🔵 crm.controller.ts L393: createContact Uses Unscoped findUnique for accountId Validation
1958 9:14a 🔵 oauth-state.service.ts: verifyOAuthState Returns userId But Callback Never Checks It Against req.user
1959 " 🟣 CRM OAuth Session Binding and AI Rate-Limit Integration Tests Created
1960 9:15a 🔴 auditRetention.job.ts: Fixed Unconditional main() Execution on Import
1961 9:16a 🔵 Integration Tests Fail: PostgreSQL Not Running at localhost:5432 in Test Environment
1962 " 🔵 Test Run Results: CRM AI Rate Limit PASSES, OAuth Callback Returns 302 Instead of 403
1963 9:17a ✅ crm-authz.integration.test.ts: unassigned account seed removed, unassigned entities repoint to visibleAccount
1964 9:18a 🔴 crm.controller.ts: 7 security gaps fixed — owner assignment, account scoping, OAuth session binding, null-owner visibility, response contracts
1965 " 🔴 crm-import-export.service.ts: null-owner records now included in export scope
1966 9:19a 🔵 Test run results: OAuth + rate limit suites PASS; crm-authz still fails at null-owner crmLead seed (L283)
1967 9:20a ✅ crm-authz.integration.test.ts: unassigned lead/opportunity seeds and null-owner visibility tests fully removed
1968 " 🔵 crm-authz suite: 25 failures — 500 errors on most tests indicate runtime crash, not missing authz logic
1969 9:21a 🔴 CRM owner scope reverted to simple ownerId.in — OR null-owner pattern removed from all 4 files
1970 9:34a ✅ CRM Remediation Completion Plan execution started
1971 " ✅ CRM Remediation Completion Plan: Steps 1–3 done, step 4 in progress
1972 9:35a 🔴 OAuth callback session hijacking gap fixed — userId binding check now enforced
1973 " 🔵 Backend lint baseline: 1042 warnings, 0 errors — all pre-existing
1974 9:36a ✅ CRM remediation test files lint-cleaned — warning count reduced from 1042 to 1039
S520 CRM Remediation Plan: Implementation Status Cross-Check (Jun 14 at 9:36 AM)
1975 9:39a 🔵 CRM Remediation Plan: All 9 phases confirmed implemented in crm.controller.ts
1976 9:40a 🔵 CRM Remediation Plan: Implementation Status Cross-Check
S521 CRM Dashboard Redesign: HTML Mockup Assessment Requested (Jun 14 at 9:40 AM)
1977 9:42a 🔵 crm-scope.service.ts: Owner scoping architecture fully mapped
1978 9:43a 🔵 crm.controller.ts: Team-scoped RBAC authorization model in opportunities endpoint
1979 9:44a 🔵 crm-scope.service.test.ts: Authorization model test coverage and deduplication logic
1980 9:45a 🔴 applyOwnerScope: AND-composition fix to prevent OR-clause conflict with search filters
1981 3:46p ⚖️ CRM Dashboard Redesign: HTML Mockup Assessment Commissioned
1982 3:47p ⚖️ CRM Dashboard Redesign: HTML mockup assessment requested
1983 " ⚖️ CRM Dashboard Redesign: HTML Mockup Assessment Requested
S522 CRM Dashboard Redesign Implementation Plan created (Jun 14 at 3:47 PM)
1984 3:49p 🔵 CrmDashboard.tsx and CrmNav.tsx: Full architecture confirmed
1985 3:50p 🔵 getDashboardStats backend: 13-query parallel fetch confirmed
1986 3:54p ✅ CRM Dashboard Redesign Implementation Plan created
S523 Codex hyperpersonalized suggestion generation for citadel-cwc-portal project (Jun 14 at 3:54 PM)
1987 4:44p 🔵 Codex suggestion engine requested hyperpersonalized tasks for citadel-cwc-portal
1988 4:45p 🔵 Codex hyperpersonalized suggestion generation for citadel-cwc-portal
1989 " 🔵 CrmDashboard.tsx: widget visibility architecture and Task 10 AI Daily Briefing wiring confirmed
1990 6:11p ⚖️ CRM Dashboard Redesign: Implementation Plan Commissioned
1991 6:13p ⚖️ CRM Dashboard Redesign: Implementation Plan Commissioned
1992 " 🔵 CrmDashboard.tsx: Full widget inventory and render order confirmed
1993 " 🔵 docs/plans/crm/code.html: New CRM dashboard design mockup identified
1994 6:14p ⚖️ CRM Dashboard Redesign: Implementation Plan Commissioned
S524 CRM Dashboard Redesign: Implementation Plan Commissioned (Jun 14 at 6:14 PM)
1995 6:16p 🔵 CRM Dashboard redesign implementation plan exported to docs

Access 435k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>