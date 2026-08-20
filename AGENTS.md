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

# [citadel-cwc-portal] recent context, 2026-08-20 11:24pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,402t read) | 495,297t work | 96% savings

### Aug 10, 2026
3621 3:08p 🔵 ESM Portal Backend: Jest Open Handle Debugging Initiated
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
S1000 ESM Portal: Credit Dashboard Role-Lane Redesign Spec Committed (Aug 20 at 10:46 AM)
3811 10:49a ✅ ESM Portal: Credit Dashboard Role-Lane Redesign Spec Committed
S1001 ESM Portal Credit Assessment: End-to-End Journey Audit — full discovery, gap analysis, and production readiness scorecard (Aug 20 at 10:49 AM)
3812 10:52a 🔵 ESM Portal Credit Dashboard: Test File Structure and KPI Count Architecture
3813 " 🔵 ESM Portal Credit Dashboard API: Full Endpoint Map and MyWorkItem Interface
3814 10:58a 🔵 ESM Portal Credit: Full Permission String Inventory and hasPermission Implementation
3815 " ✅ ESM Portal Credit Dashboard: Role Lanes Implementation Plan Committed
3816 4:05p ⚖️ ESM Portal: Credit Assessment End-to-End Journey Audit Commissioned
3817 " 🔵 ESM Portal Credit LOS: Full Module Structure Mapped — Backend, Frontend, Schema
3818 " 🔵 ESM Portal Credit LOS: Application State Machine — Full Transition Map Confirmed
3819 4:06p ⚖️ ESM Portal: Credit LOS End-to-End Journey Audit Commissioned
3820 " ⚖️ ESM Portal: Credit Assessment End-to-End Journey Audit Commissioned
3821 " 🔵 ESM Portal Credit: Score Recalculation Service Architecture Confirmed
3822 " 🔵 ESM Portal Credit: Borrower Duplicate Detection — Enhanced Multi-Signal Check with Admin Override
3823 4:07p ⚖️ ESM Portal: Credit LOS End-to-End Journey Audit Commissioned
3824 4:08p ⚖️ ESM Portal: Credit Assessment End-to-End Audit Commissioned
3825 4:13p ⚖️ ESM Portal: Credit LOS End-to-End Journey Audit Commissioned
3826 " ⚖️ ESM Portal: Credit Assessment End-to-End Journey Audit Commissioned
S1002 ESM Portal: Credit Assessment End-to-End Journey Audit — 82% Production Readiness, Zero P0 Blockers (Aug 20 at 4:13 PM)
3827 4:19p ⚖️ ESM Portal: Credit Assessment End-to-End Journey Audit — 82% Production Readiness, Zero P0 Blockers
S1003 ESM Portal Credit LOS: Borrower-Scoped Scorecard Design — Factor Set, Scope Model, and Validation Architecture (Aug 20 at 4:19 PM)
3828 4:28p 🔵 ESM Portal Credit LOS: Borrower UX Gap Identified — End-to-End Flow Unclear
3829 4:30p 🔵 ESM Portal Credit LOS: BorrowerRiskRun Has No Frontend Trigger — Only READ Endpoints Exposed
3830 4:36p 🔵 ESM Portal: CreditAuditEvent Hash-Chain Uses `sequence` Column for Ordering
S1004 ESM Portal: Borrower Risk Rating System — Architecture Design (Sections 1–3 of 4) (Aug 20 at 4:37 PM)
3831 4:41p 🔵 ESM Portal: Active Spec and Plan Files as of Aug 20, 2026
3832 4:43p ⚖️ ESM Portal Credit LOS: Borrower-Level Risk Rating Design Spec Created
3833 " ✅ ESM Portal: Borrower Risk Rating Design Spec Refined — Three Clarifications
3834 4:44p ✅ ESM Portal: Borrower Risk Rating Spec — Staleness UX and JOINT Out-of-Scope Additions
3835 4:47p 🔵 ESM Portal Credit Backend: Key Service Signatures and Architecture Confirmed
3836 4:57p ⚖️ ESM Portal: Borrower-Level Risk Rating Implementation Plan Written
3837 " ✅ ESM Portal: Borrower Risk Rating Plan — Tasks 1 & 2 Written (Schema Migration + Scope-Aware Weights)
3838 4:59p ✅ ESM Portal Borrower Risk Plan: Tasks 3 & 4 Written (Scope Filter + Types/Thresholds)

Access 495k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>