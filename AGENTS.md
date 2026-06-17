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

# [citadel-cwc-portal] recent context, 2026-06-17 7:52pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (17,535t read) | 316,456t work | 94% savings

### Jun 16, 2026
2080 12:35p 🔵 CrmDashboard "My Deals Only" filter: live feature, not dead code
2082 12:39p 🔴 CrmDashboard Hot Leads Card: Blank Space and LendScore Layout Fixed
2083 12:55p 🔵 CRM Lead Score: ruleScore ?? aiScore fallback chain
2084 12:57p ✅ CrmDashboard: "LendScore" label renamed to "Lead Score"
2085 5:02p 🔵 Multi-tenancy implementation started: new files untracked, 60+ backend/frontend files modified uncommitted
2086 10:53p ⚖️ CRIT-1: OAuth Access Tokens Stored in Plaintext — Implementation Plan Commissioned
2088 " 🔵 CRIT-1: OAuth Tokens Stored Plaintext — Full Attack Surface Mapped
2089 10:54p ⚖️ CRIT-1: OAuth Access Tokens Stored in Plaintext — Implementation Plan Commissioned
2091 " 🔵 CRIT-1 OAuth Token Plaintext Storage: Full Codebase Audit Complete
2092 10:58p ⚖️ CRIT-1: OAuth Access Tokens Stored in Plaintext — Implementation Plan Commissioned
2093 11:01p ⚖️ CRIT-1: OAuth Access Tokens Stored in Plaintext — Implementation Plan Commissioned
2094 11:14p 🔵 Pipeline progress UI bug investigation: no dedicated PipelineProgress component found
2095 " 🔵 Progress pipeline UI not correctly reflecting Qualification stage
S551 CrmOpportunityDetail: Pipeline progress bar now correctly renders "Closed Lost" state in red (Jun 16 at 11:14 PM)
2096 11:16p 🔵 CRM Opportunity Detail: Pipeline progress bar uses displayOrder and stage flags for rendering
2097 11:17p 🔴 CrmOpportunityDetail: Pipeline progress bar now correctly renders "Closed Lost" state in red
S552 Credit Dashboard Redesign: HTML Mockup Study Commissioned (Jun 16 at 11:17 PM)
2098 11:19p 🔵 CRM "Create New Lead" modal header render issue investigated
2099 11:21p 🔵 CRM "Create New Lead" modal was redesigned — top header rendering issue traced
2100 11:23p 🔵 CrmLayout.tsx: z-index and sticky/fixed layers mapped for search bar blend issue
2101 " 🔵 TopBar.tsx search bar uses hardcoded bg-[#f0f2f5] — won't blend with translucent header
2102 11:24p 🔴 TopBar.tsx: z-index reduced from z-[65] to z-40 to fix search bar blending
### Jun 17, 2026
2103 10:33a ⚖️ Credit Dashboard Redesign: HTML Mockup Study Commissioned
2104 10:34a ⚖️ Credit Dashboard Redesign: HTML Mockup Study Commissioned
S553 CWC Navigation: Option B chosen — shared sidebar approach (Jun 17 at 10:34 AM)
2105 10:37a ⚖️ CWC Navigation: Option B chosen — shared sidebar approach
S554 Credit Officer Dashboard Redesign — architecture option recommendation (Option C: phased delivery) (Jun 17 at 10:37 AM)
S556 Credit Officer Dashboard: Work Queue Table — Option B selected (visual upgrade only) (Jun 17 at 10:42 AM)
2106 10:44a 🔵 credit.service.ts: MyWorkDashboard and MyWorkItem interfaces located
2107 10:47a ⚖️ Credit Officer Dashboard: Work Queue Table — Option B selected (visual upgrade only)
S557 Credit Officer Dashboard Redesign — Full Design Spec Created (Jun 17 at 10:47 AM)
2109 10:50a 🔵 citadel-cwc-portal dev2.0 branch: recent commits focused on CRM module and multi-tenancy
2110 " ⚖️ Credit Officer Dashboard Redesign — Full Design Spec Created
S559 Codex hyperpersonalized suggestions for citadel-cwc-portal — Jun 17 afternoon scan (Jun 17 at 10:50 AM)
2111 10:51a 🔵 Credit Module Design System Tokens: Full CSS Variable Map
2112 " 🔵 CreditApplication Prisma Schema: Full Field Map Around Core and CA Memo Sections
2113 11:06a 🔵 Credit module redesign: large uncommitted working tree on dev2.0
2114 11:11a 🟣 Full Multi-Tenancy Isolation Implemented Across citadel-cwc-portal
2116 11:12a 🔵 Tenant Isolation Implementation: AsyncLocalStorage + Prisma Extension Pattern
2118 11:15a 🔵 Playwright Tests Require Running Dev Server at localhost:5173
2119 11:16a ✅ Credit Dashboard E2E Verification Script Created
2121 11:18a 🔵 Credit Dashboard: 2 Tabs Confirmed, Chevron and Arrow Links Missing
2122 11:19a 🔵 Backend CORS Hardcoded to Port 5173, Frontend Runs on 5174
2123 11:20a 🔵 Frontend Dev Server Also Running on Port 5173
2125 1:17p 🟣 Credit officer dashboard Phase 1 shipped: KPI cards + enhanced work queue
2126 " 🔴 CRIT-1 and CRIT-2 security fixes landed: OAuth token encryption and tenant isolation enforced
2127 4:18p 🔵 citadel-cwc-portal dev2.0 branch: credit redesign phases 1-3 shipped, CRM and multi-tenancy complete
2128 4:44p 🟣 Credit officer dashboard Phase 2: backend endpoints shipped, frontend still on mock data
2129 4:45p 🔵 CRIT-1 and CRIT-2 implementation plans: full architecture mapped and ready to execute
2130 4:46p 🔵 Codex hyperpersonalized suggestions: Phase 2 credit officer dashboard backend endpoints identified as top priority
2131 " 🔵 Codex hyperpersonalized suggestions: Phase 2 credit officer dashboard backend endpoints identified as top priority
2132 4:47p 🔵 Codex hyperpersonalized suggestions: Phase 2 credit officer dashboard backend endpoints are the top actionable candidate
S561 Application 360 Workspace: Existing Credit Module Architecture Mapped (Jun 17 at 4:47 PM)
2133 6:17p ⚖️ Application 360 Universal LOS Workspace — Design Commissioned
2135 " 🔵 Application 360 Workspace: Existing Credit Module Architecture Mapped
S562 Universal Application 360 Workspace — Enterprise LOS redesign delivery strategy decision (phased vs full vs tabs) (Jun 17 at 6:17 PM)
2136 6:53p ⚖️ Universal Application 360 Workspace — Full Design Spec Written
S563 Universal Application 360 Workspace — Full Design Spec Written (Jun 17 at 6:53 PM)
2137 6:54p 🔵 CreditApplicationDetail.tsx: Full architecture and state management mapped
2138 6:56p 🔵 creditUtils.ts: Complete TAB_GROUPS and DetailTab type structure mapped

Access 316k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>