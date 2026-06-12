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

# [citadel-cwc-portal] recent context, 2026-06-12 12:14am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23,290t read) | 1,709,410t work | 99% savings

### Jun 9, 2026
S492 Credit Module Role-Permission Matrix Mapped in seed.ts (Jun 9 at 9:52 AM)
S493 AI Automation feasibility review for Credit Assessment Module (Jun 9 at 10:01 AM)
S494 Credit AI Phase 2 Implementation Plan: A4/A5/A6/A13/A15 with governance scaffold (Jun 9 at 12:46 PM)
S495 comment-attachment-implementation-plan.md: Plan Assessment Requested (Jun 9 at 1:08 PM)
### Jun 10, 2026
S497 Credit Module: Full 12-Stage Loan Lifecycle Mapped (Jun 10 at 9:59 AM)
### Jun 11, 2026
S498 Loan Origination Lifecycle Gap Analysis doc created (Jun 11 at 9:57 AM)
1818 10:02a ✅ Loan Origination Lifecycle Gap Analysis doc created
S502 Credit Module UI/UX Audit: Full Screen & Component Inventory Compiled (Jun 11 at 10:02 AM)
1819 10:03a ⚖️ Credit Assessment Module: Comprehensive Enterprise Audit Commissioned
1821 10:04a 🔵 Credit Assessment Module: Full Frontend Architecture Mapped for Audit
1822 " 🔵 Credit Module Security Architecture: JWT, SOD, Rate Limiting, PII Controls Mapped
1823 " 🔵 Prisma Schema: 5,063-line Data Model with Full Credit, CRM, HR, IT Modules
1824 10:06a 🔵 Credit Module Backend: 70 Services, 16 Credit-Specific Middleware Files, Zero Raw SQL — Full Architecture Confirmed
1825 " 🔵 Credit Bureau & DSR Logic: CCRIS via Borrower Self-Upload, CTOS Rating Caps, DSR Thresholds — Malaysia Non-Bank Compliant
1826 " 🔵 Prisma Schema Deep Dive: CreditApplication Has 30+ Relations, Full Compliance Models Mapped (FATCA/CRS, PII Logs, AI Governance, FX Rates)
1827 " 🔵 SECURITY FINDING: OpenAI API Key Exposed in backend/.env; Hardcoded Temp Password in User Controller; MFA Schema-Only (Not Enforced)
1828 " 🔵 RM Scope Middleware Confirmed: Row-Level Access Control for Non-Admin Credit Users — applyRmScope() Pattern
1829 10:08a ⚖️ Credit Assessment Module: Full 10-Part Enterprise Audit Commissioned for Malaysia Non-Bank Lender
1830 " 🔵 Credit Module Infrastructure: Puppeteer PDF Engine, 7 BullMQ Queues, 18 Credit-Domain Prisma Models Confirmed
1831 10:17a 🔵 Credit Module UI/UX Audit: Full Screen & Component Inventory Compiled
S503 Credit Module Multi-Perspective Audit: Action Plan and Roadmap Commissioned (Jun 11 at 10:17 AM)
1832 2:56p ⚖️ Credit Module Multi-Perspective Audit: Action Plan and Roadmap Commissioned
1833 2:58p ⚖️ Credit Module Action Plan and Roadmap Commissioned from Audit
1834 " ⚖️ Credit Module Multi-Perspective Audit: Action Plan and Roadmap Commissioned
S504 CRM Pre-Audit Discovery Phase Commissioned (Jun 11 at 2:58 PM)
1837 8:05p 🔵 CRM Pre-Audit Discovery Phase Commissioned
1838 " 🔵 CRM Pre-Audit Discovery Phase Commissioned
1839 " 🔵 citadel-cwc-portal: Full Module & Backend API Inventory Mapped
1840 " 🔵 citadel-cwc-portal: Database Schema — Full Auth, RBAC, and Service Desk Architecture
1841 8:07p 🔵 Credit Assessment Module: Security & Encryption Architecture Mapped
1842 " 🔵 Credit Application Data Model: Entity Relationships & Product/Borrower Types Mapped
1843 " 🔵 RBAC & Permission Model: 13 Roles & 40+ Permissions Seeded with SOD Enforcement
1844 " 🔵 Workflow Orchestration: 5 Multi-Step Approval Chains Identified (Approval, Finance, IT, Chargeback, Offboarding)
1845 " 🔵 CRM Pre-Audit Discovery Phase Commissioned
1846 8:08p 🔵 CRM Pre-Audit Discovery Phase Commissioned
1847 " 🔵 CRM Pre-Audit Discovery Phase Commissioned
1848 8:09p 🔵 CRM Pre-Audit Discovery Phase Commissioned
1849 8:11p 🔵 CRM Pre-Audit Discovery Phase Commissioned
1850 " 🔵 CRM Pre-Audit Discovery Phase Commissioned
1851 8:25p ⚖️ CRM Module: Comprehensive Enterprise Audit Commissioned (Phase 2)
1852 " 🔵 CRM Module: Full Service Layer and Data Model Mapped for Enterprise Audit
1853 8:26p 🔵 CRM Backend: Role-Based Access Control (RBAC) and Team-Scoped Visibility Implemented
1854 " 🔵 CRM Lead Management: Duplicate Detection, Auto-Assignment, and Workflow Events
1855 " 🔵 CRM Duplicate Management: Confidence-Based Detection and Field-Level Merge UI
1856 " 🔵 CRM Lead Scoring: Rule-Based Engine with Background Recomputation
1857 " 🔵 CRM Assignment Rules: Territory and Source-Based Lead Routing
1858 " 🔵 CRM AI Features: GPT-4o-powered Insights with Lazy Initialization
1859 " 🔵 CRM Import/Export: Multi-Step ETL Pipeline with Validation and History
1860 8:27p 🔵 CRM Duplicate Detection: Levenshtein-Based Confidence Scoring with Signal Weighting
1861 " 🔵 CRM Background Automation: Activity Reminders, Lead Aging, and Overdue Alerts
1862 " 🔵 CRM Workflow Automation: Event-Driven Rule Engine with Templates and Depth Limiting
1863 " 🔵 CRM Data Validation: Zod Schemas for All Endpoints with Type Safety
1864 " 🔵 CRM Pipeline Forecasting: Stage-Based and Category-Based Deal Grouping
1865 " 🔵 CRM Stage Gates: Enforcement of Forward-Only, Required Fields, and Approval Thresholds
1866 " 🔵 CRM Core Service: Dashboard Stats, Lead Conversion, Opportunity Stage Moves, and Pipeline Analytics
1867 8:32p 🔵 CRM Phase 2 Audit: Full 10-Dimension Scope Defined
1868 8:34p 🔵 CRM Database Index Coverage and Audit Log Density Confirmed
1869 8:36p 🔵 CRM Module Security Audit: IDOR Vulnerabilities and Production Readiness Gaps
1870 8:38p ✅ CRM Enterprise Audit Report Created: docs/CRM_AUDIT.md
S505 CRM Enterprise Audit Report Created: docs/CRM_AUDIT.md (Jun 11 at 8:38 PM)

Access 1709k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>