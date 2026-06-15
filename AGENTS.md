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

# [citadel-cwc-portal] recent context, 2026-06-14 11:55pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,016t read) | 582,140t work | 97% savings

### Jun 14, 2026
1975 9:39a 🔵 CRM Remediation Plan: All 9 phases confirmed implemented in crm.controller.ts
1976 9:40a 🔵 CRM Remediation Plan: Implementation Status Cross-Check
1977 9:42a 🔵 crm-scope.service.ts: Owner scoping architecture fully mapped
1978 9:43a 🔵 crm.controller.ts: Team-scoped RBAC authorization model in opportunities endpoint
1979 9:44a 🔵 crm-scope.service.test.ts: Authorization model test coverage and deduplication logic
1980 9:45a 🔴 applyOwnerScope: AND-composition fix to prevent OR-clause conflict with search filters
1981 3:46p ⚖️ CRM Dashboard Redesign: HTML Mockup Assessment Commissioned
1982 3:47p ⚖️ CRM Dashboard Redesign: HTML mockup assessment requested
1983 " ⚖️ CRM Dashboard Redesign: HTML Mockup Assessment Requested
1984 3:49p 🔵 CrmDashboard.tsx and CrmNav.tsx: Full architecture confirmed
1985 3:50p 🔵 getDashboardStats backend: 13-query parallel fetch confirmed
1986 3:54p ✅ CRM Dashboard Redesign Implementation Plan created
1987 4:44p 🔵 Codex suggestion engine requested hyperpersonalized tasks for citadel-cwc-portal
1988 4:45p 🔵 Codex hyperpersonalized suggestion generation for citadel-cwc-portal
1989 " 🔵 CrmDashboard.tsx: widget visibility architecture and Task 10 AI Daily Briefing wiring confirmed
1990 6:11p ⚖️ CRM Dashboard Redesign: Implementation Plan Commissioned
1991 6:13p ⚖️ CRM Dashboard Redesign: Implementation Plan Commissioned
1992 " 🔵 CrmDashboard.tsx: Full widget inventory and render order confirmed
1993 " 🔵 docs/plans/crm/code.html: New CRM dashboard design mockup identified
1994 6:14p ⚖️ CRM Dashboard Redesign: Implementation Plan Commissioned
1995 6:16p 🔵 CRM Dashboard redesign implementation plan exported to docs
1996 6:17p ✅ CRM Dashboard Redesign Plan Created
1997 " 🔵 CRM Dashboard Redesign Plan: Full Architecture Mapped
S526 CRM Dashboard Redesign: Nav/Sidebar Layout Conflict Identified (Jun 14 at 6:17 PM)
1998 6:21p 🔵 CRM Dashboard Redesign: 13-Task Plan Structure Fully Mapped
1999 6:22p 🔵 backend/src/lib/prisma.ts does not exist at expected path
2000 " 🔵 crm.service.ts instantiates PrismaClient locally — no shared prisma singleton
2001 " 🟣 crm-dashboard-stats.test.ts created with corrected @prisma/client mock
2002 6:23p 🟣 getDashboardStats extended with monthlyTrend, pipelineByName, upcomingFollowUps
2003 " 🔵 Backend test suite pre-existing failures: DB unreachable + Redis mock issue
2004 6:24p 🔵 App.tsx CRM route structure and AuthContext/permissions API confirmed for CrmLayout integration
2005 8:43p 🔵 CRM Dashboard Redesign: Nav Bar Conflicts with Sidebar
2006 8:44p ⚖️ CRM Dashboard Redesign: Nav/Sidebar Conflict — Refinement Plan Requested
2007 " 🔵 CRM Dashboard Redesign: Nav/Sidebar Layout Conflict Identified
S527 CrmLayout.tsx: Vertical sidebar replaced with horizontal top sub-nav (Jun 14 at 8:44 PM)
2008 8:46p 🔄 CrmLayout.tsx: Vertical sidebar replaced with horizontal top sub-nav
S528 CrmLayout.tsx: CRM nav bar has 17 items causing overflow (Jun 14 at 8:46 PM)
2009 8:50p 🔵 CrmLayout.tsx: CRM nav bar has 17 items causing overflow
S529 CRM Dashboard Design System: "Kinetic Enterprise" spec mapped (Jun 14 at 8:50 PM)
2010 9:24p 🔵 CRM Dashboard Design System: "Kinetic Enterprise" spec mapped
S530 CrmDashboard.tsx: Full redesign to match new teal design system (Jun 14 at 9:24 PM)
2011 9:26p 🔵 CrmDashboard.tsx: Current architecture mapped before redesign
2012 " 🟣 CrmKpiCard.tsx: Redesigned to match new CRM dashboard design
2013 9:27p 🟣 CrmDashboard.tsx: Full redesign to match new teal design system
S531 CRM Leads screen: design assets and current implementation mapped (Jun 14 at 9:27 PM)
2014 9:32p 🔵 CRM Leads screen: design assets and current implementation mapped
S532 CrmLeads.tsx: Full UI redesign with teal brand colors, stats bar, and consolidated filter bar (Jun 14 at 9:32 PM)
2015 9:33p 🔵 CrmLeads.tsx: Full architecture mapped — table/card views, bulk actions, AI scoring, urgency badges
2016 9:36p 🟣 CrmLeads.tsx: Full UI redesign with teal brand colors, stats bar, and consolidated filter bar
S533 CrmLeads.tsx: Duplicate "border" key in inline style object causes Vite warning (Jun 14 at 9:36 PM)
2017 9:38p 🔵 CrmLeads.tsx: Duplicate "border" key in inline style object causes Vite warning
S534 Stitch screen fetch: "Lead 360 View - Kinetic Refined" design for CRM Lead Detail page redesign (Jun 14 at 9:38 PM)
2018 9:59p 🔵 Stitch Screen: "Lead 360 View - Kinetic Refined" design retrieved
2019 " 🔵 CRM Lead 360 View design spec content: "Tan Boon Wah" sample persona
2020 10:02p ⚖️ CRM Lead Detail Layout: Redesign Action Plan Commissioned
2021 10:08p 🟣 CrmLeadDetail.tsx: Kinetic Enterprise "Lead 360 View" Redesign Plan Exported
S535 CrmLeadDetail.tsx: Kinetic Enterprise "Lead 360 View" Redesign Plan Exported (Jun 14 at 10:08 PM)
2023 10:12p 🟣 CrmLeadDetail header redesign test suite created
2024 10:13p ✅ CrmLeadDetail test file relocated to canonical src/__tests__ directory
2025 10:14p 🟣 CrmLeadDetail: Two-panel layout shell + header redesign with Actions dropdown implemented

Access 582k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>