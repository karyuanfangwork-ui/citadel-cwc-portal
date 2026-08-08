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

# [citadel-cwc-portal] recent context, 2026-08-08 12:06pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,981t read) | 736,704t work | 97% savings

### Aug 5, 2026
3399 11:29a ⚖️ ESM Portal: Visual Workflow Builder for Request Type Configuration Commissioned
S873 ESM Portal: Visual Workflow Builder — Design Phase Status Check ("where are we") (Aug 5 at 11:47 AM)
S875 ESM Portal: Visual Workflow Designer Backend Foundation Plan Committed to Git (Aug 5 at 11:50 AM)
3400 11:54a ⚖️ ESM Portal: Visual Workflow Designer — Full Design Spec Written
3401 11:55a 🔵 ESM Portal: New Spec Files Require Explicit .gitignore Exceptions
3402 12:48p ⚖️ ESM Portal: Visual Workflow Builder Implementation Plan Commissioned
3403 " 🔵 ESM Backend: transitionPolicy.test.ts — All 6 Tests Passing
3404 12:49p 🔵 ESM Backend: Seed Script Pattern Uses PrismaClient Directly with Tenant ID Constant
3405 1:12p ⚖️ ESM Portal: Visual Workflow Builder Implementation Plan Commissioned
3406 1:13p ✅ ESM Portal: Visual Workflow Designer Backend Foundation Implementation Plan Written
3407 " ✅ ESM Portal: Visual Workflow Designer Backend Foundation Plan Committed to Git
S877 ESM Portal Visual Workflow Builder: Diagnose why publishing workflow draft v4 is blocked by validator (Aug 5 at 1:13 PM)
3408 5:35p 🔵 ESM Portal: Workflow Validator Service Architecture Confirmed
3410 " 🔵 ESM Portal: Live Request Occupancy Data + Request Model Has No `requestNumber` Field
S880 ESM Portal: Workflow Status Remap on Publish — Full Implementation Plan Written (Aug 5 at 5:36 PM)
3411 5:39p ⚖️ ESM Portal: Workflow Publish Status-Remap Feature Selected (Option D)
3412 5:47p ✅ ESM Portal: IT-00001 and IT-00020 Manually Drained to Unblock Workflow Publish
3413 5:50p 🔵 ESM Portal: Workflow Builder Backend Architecture — Full Service/Controller Map
3414 5:51p 🔵 ESM Portal: Visual Workflow Builder Frontend Architecture — useWorkflowGraph Hook and Designer Page
3415 " 🔵 ESM Portal Workflow Builder: Test Coverage Map and Existing Plans Directory
3416 5:56p ✅ ESM Portal: Workflow Status Remap on Publish — Full Implementation Plan Written
S882 ESM Portal Workflow List: Admin Cannot Identify Which Workflow Handles Purchase Requisitions (Aug 5 at 5:56 PM)
3417 11:17p 🔵 ESM Portal: Admin Workflow List Screen Lacks Purchase Requisition Context
3419 " 🔵 ESM Portal: WorkflowListCard Shows Count But Not Names of Bound Request Types
3420 11:18p 🔵 ESM Portal Workflow List: Admin Cannot Identify Which Workflow Handles Purchase Requisitions
S884 ESM Portal Workflow List: UX gap where admins cannot identify which workflow handles purchase requisitions from the list view (Aug 5 at 11:18 PM)
S885 ESM Portal Workflow List: Request Type Visibility Design Spec Written and Committed (Aug 5 at 11:19 PM)
3421 11:21p ⚖️ ESM Portal Workflow List: Request Type Visibility Design Spec Written and Committed
S886 ESM Portal: Workflow List Request Type Visibility Implementation Plan Written and Committed (Aug 5 at 11:21 PM)
3422 11:24p ⚖️ ESM Portal: Approval Routing Implementation Plan Commissioned
3423 11:25p ✅ ESM Portal: Workflow List Request Type Visibility Implementation Plan Written and Committed
S887 ESM Portal Frontend: Build Passes but index.js Bundle Critically Oversized (Aug 5 at 11:25 PM)
3424 11:39p 🔵 ESM Portal Workflow List: Request Type Visibility Plan Audit Requested
3425 11:40p 🔵 ESM Portal Frontend: Build Passes but index.js Bundle Critically Oversized
### Aug 7, 2026
3479 8:17p ⚖️ ESM Portal: Service Desk Admin UX Remediation Plan Assessment Requested
S902 ESM Portal: Service Desk Admin UX Remediation Plan Assessment Requested (Aug 7 at 8:17 PM)
3480 9:37p 🔵 ESM Portal: Service Desk Admin UX Remediation Plan Audit Initiated
3481 " 🟣 ESM Portal Service Desk Admin: P2-01, P2-04, P2-05 Backend Implementation Confirmed
3482 9:38p 🟣 ESM Portal Service Desk Admin: Frontend useAdminState Fully Updated for P1-03, P2-04, P2-05, P2-06
3483 9:39p 🔵 ESM Portal Backend: TypeScript Compilation Passes Clean After Service Desk Remediation
3484 " 🔵 ESM Portal: service-desk-catalog.test.ts — All 5 Tests Pass for P2-01 and P1-03 Contracts
3485 " 🔵 ESM Portal Service Desk Admin UX Remediation: Full Plan Audit Complete — All Tasks Verified
### Aug 8, 2026
3491 10:59a ⚖️ Credit Assessment + LOS End-to-End Audit Commissioned
3492 11:00a ⚖️ Credit Assessment + LOS: Full End-to-End Audit Commissioned
3493 " ⚖️ Credit Assessment + LOS Full End-to-End Audit Commissioned
3494 11:01a ⚖️ Credit Assessment + LOS End-to-End Audit Commissioned
3495 " ⚖️ Credit Assessment + LOS: Full End-to-End Audit Commissioned
3496 " ⚖️ Credit Assessment + LOS Full End-to-End Audit Commissioned
3497 11:02a ⚖️ Credit Assessment + LOS: Full End-to-End Audit Commissioned
3498 " 🔵 Credit LOS: Core Backend Services — Scoring, Override, and Assessment Result Architecture
3499 " 🔵 Credit LOS: Application 360 Tab Structure — 12 Tabs, Full Component Map
3500 " 🔵 Credit LOS: Borrower Creation — Multi-Step Wizard with Real-Time Duplicate Detection
3501 " 🔵 Credit LOS: External Integration Adapters — All Placeholder, No Live Providers Wired
3502 " 🔵 Credit LOS: Frontend Service Layer — 60+ API Methods Covering Full LOS Lifecycle
3503 11:05a ⚖️ Credit Assessment + LOS Full End-to-End Audit Commissioned
3504 11:40a 🔵 CWC Portal: Credit Module Service Architecture Confirmed
3505 11:41a 🔵 CWC Portal: Approval Action and Score Override Governance Architecture
3506 " 🔵 CWC Portal: Backend Integration Tests Failing — Postgres Not Running on localhost:5432
3507 11:42a 🔵 CWC Portal: Credit Scoring Engine Factor Architecture and Missing-Data Policy
3508 11:46a ✅ CWC Portal: Full Credit LOS Audit Commissioned — 4 Documents Written to docs/credit-los-audit-2026-08-08/

Access 737k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>