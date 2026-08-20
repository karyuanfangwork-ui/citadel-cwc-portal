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

# [citadel-cwc-portal] recent context, 2026-08-20 3:54pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,138t read) | 543,447t work | 97% savings

### Aug 10, 2026
3593 11:03a 🔵 ESM Portal: Credit Module Route Probe — All Routes Render, Collateral Missing Heading
3594 " 🔵 ESM Portal: /credit/collateral Route Hangs — 30s Timeout in Playwright Probe
3595 11:04a 🔵 ESM Portal: /credit/collateral, /credit/reports, /credit/group-exposure Silently Redirect to ESM Shell
3596 11:07a 🔵 ESM Portal: /credit/collateral Shows Context-Dependent Empty State, Not a Bug
3597 " 🔵 ESM Portal Backend: Credit Jest Suite — 108 Suites, 1256 Tests All Pass
3598 11:09a ⚖️ ESM Portal: Credit LOS Phase 8 Implementation Plan Committed
S920 ESM Portal Credit LOS Phase 8a — Implementation plan authored and committed for closing BullMQ queue leak, fixing 2 failing E2E specs, unblocking the release gate, and correcting audit documentation (Aug 10 at 11:09 AM)
3599 11:29a ⚖️ ESM Portal: Credit LOS Phase 8 Implementation Verification Requested
3600 11:30a 🔵 ESM Portal Frontend: TypeScript Errors in ScoreOutdatedBanner After Phase 8
3602 11:31a 🔵 ESM Portal Credit LOS: ApprovalInboxItem Shape Uses currentState and Flat borrowerName
3604 11:41a 🔵 ESM Portal Backend: Jest Open Handle from pdfQueue Module-Level Redis Connection
3605 " 🔵 ESM Portal Backend: seed-credit.ts --demo Fails with chk_crm_accounts_tenant_id_required Constraint
3606 " 🔵 ESM Portal Credit LOS: Backend Jest Suite Passes (1256/1256) — Jest Hang Is Open Handle Only
3607 " 🔵 ESM Portal Credit LOS Phase 8: E2E — 2 New Failures, 29 Passed, 4 Skipped
3608 " 🔵 ESM Portal Credit LOS: CreditApplicationList Reads borrowerProfileId and quickFilter from URL SearchParams
3611 11:52a 🔵 ESM Portal Credit E2E: Borrower List DOM Structure and Navigation Wiring Confirmed
3612 " 🔵 ESM Portal Credit Seed: Most Tenant-Constrained Models Missing tenantId in creditDemoSeed.ts
S921 ESM Portal Credit LOS Phase 8: Plan Closure Blocked by Natural Jest Shutdown (Aug 10 at 11:54 AM)
3613 3:01p ⚖️ ESM Portal Credit LOS Phase 8: Plan Closure Blocked by Natural Jest Shutdown
3614 " ⚖️ ESM Portal Credit LOS Phase 8: Plan Closure Blocked by Natural Jest Shutdown
3615 3:02p ⚖️ ESM Portal Credit LOS Phase 8: Plan Closure Blocked by Natural Jest Shutdown
3616 " ⚖️ ESM Portal Credit LOS Phase 8: Plan Closure Blocked by Natural Jest Shutdown
S922 ESM Portal Backend: Jest test suite status check — confirming pass/fail counts and hang behavior (Aug 10 at 3:02 PM)
S925 ESM Portal Backend: Jest Hang Root-Cause Diagnosis — Unclosed Redis and Postgres Handles Identified (Aug 10 at 3:04 PM)
3617 3:06p 🔵 ESM Portal Frontend: Jest Suite Hung — Re-ran with --detectOpenHandles
3619 3:07p 🔵 ESM Portal Backend: Jest Re-run with --detectOpenHandles Backgrounded
3620 3:08p 🔵 ESM Portal Backend: Jest Hung Process Killed, --detectOpenHandles Run Initiated
3621 " 🔵 ESM Portal Backend: Jest Open Handle Debugging Initiated
3623 3:12p 🔵 ESM Portal Backend: Jest Hangs Due to Unclosed PostgreSQL and Redis Connection Pool
S928 ESM Portal: Credit LOS Phase 8b Implementation Plan Written (Aug 10 at 3:12 PM)
3624 3:20p 🔵 ESM Portal Backend: Jest Open Handles Root Cause and Fix in setup.ts
3626 " 🔵 ESM Portal Backend: queue-monitor.test.ts Fails Due to BullMQ Redis Handle Not Closed
3628 3:21p 🔵 ESM Portal Backend: BullMQ Queue Architecture — All Queues Have close() Functions
3629 3:24p ✅ ESM Portal: Credit LOS Phase 8b Implementation Plan Written
S929 ESM Portal Backend: Jest Suite Passes But Process Does Not Terminate — Open Handles Persist (Aug 10 at 3:24 PM)
3630 4:12p 🔵 ESM Portal Backend: Jest Full Suite Passes But Process Does Not Terminate — Open Handles Persist
3631 " 🔵 ESM Portal Backend: Jest Suite Passes All Tests But Process Does Not Terminate Naturally
3632 " 🔵 ESM Portal Backend: Jest Suite Passes But Process Does Not Terminate — Open Handles Persist
S930 ESM Portal Backend: Phase 8b Credit LOS Jest Teardown Fix — forceExit adopted after natural termination measured as unachievable (Aug 10 at 4:12 PM)
3633 4:26p ⚖️ ESM Portal Backend: Phase 8b Natural-Termination Gate Amended — forceExit Adopted
3634 4:29p 🔵 ESM Portal Backend: Release Gate Fails — 2 CRM AuthZ Integration Tests Flaky
3635 " 🔵 ESM Portal Backend: crm-authz Integration Tests Are Flaky Under Full Suite Load
3636 " ✅ ESM Portal Backend: Phase 8b Release Gate Passes — 230/230 Suites, 2387/2387 Tests
3637 4:32p ✅ ESM Portal: Phase 8b Audit Evidence Files Updated Across All Three Audit Documents
S998 ESM Portal Credit LOS: Approver Lane UX Redesign — Inbox structure, decision card, and component audit (Aug 10 at 4:34 PM)
### Aug 20, 2026
3803 10:26a ⚖️ ESM Portal Credit Dashboard: UX Redesign Commissioned for Relationship Manager and Approver Roles
3804 10:29a ⚖️ ESM Portal Credit Dashboard: UX Redesign Commissioned for Relationship Manager and Approver Roles
3805 " 🔵 ESM Portal Credit Dashboard: PriorityWorkQueue Component and Data Flow Mapped
3806 " 🔵 ESM Portal Credit Dashboard: `recentAssigned` Data Flow — Backend Service Confirmed
3807 " 🔵 ESM Portal Credit Dashboard: `toMyWorkItem` SLA Logic Has Known Simplification — WARNING State Never Set
3808 10:38a 🔵 ESM Portal Credit Dashboard: `getOperationalGuidance` and `toMyWorkItem` Logic Confirmed
S999 ESM Portal Backend: SLA Breach Detection Uses createdAt Not State-Entry Timestamp (Aug 20 at 10:43 AM)
3809 10:46a 🔵 ESM Portal Backend: CreditSlaPolicy and CreditSlaBreach Prisma Schema Confirmed
3810 " 🔵 ESM Portal Backend: SLA Breach Detection Uses createdAt Not State-Entry Timestamp
3811 10:49a ✅ ESM Portal: Credit Dashboard Role-Lane Redesign Spec Committed
S1000 ESM Portal: Credit Dashboard Role-Lane Redesign Spec Committed (Aug 20 at 10:49 AM)
3812 10:52a 🔵 ESM Portal Credit Dashboard: Test File Structure and KPI Count Architecture
3813 " 🔵 ESM Portal Credit Dashboard API: Full Endpoint Map and MyWorkItem Interface
3814 10:58a 🔵 ESM Portal Credit: Full Permission String Inventory and hasPermission Implementation
3815 " ✅ ESM Portal Credit Dashboard: Role Lanes Implementation Plan Committed

Access 543k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>