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

# [citadel-cwc-portal] recent context, 2026-07-21 3:52pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (30,340t read) | 2,281,279t work | 99% savings

### Jun 24, 2026
S623 CREDIT_SCORING_RISK_RATING_AUDIT.md: Post-Remediation Reconciliation and Implementation Plan Added (Jun 24 at 5:03 PM)
### Jun 25, 2026
S628 Credit Assessment Module: Complete FSD/SDD Commissioned for Malaysian Non-Bank Lender (Jun 25 at 11:02 AM)
### Jun 26, 2026
S631 Credit Decision Engine Design Document (Volume 2) — 15-section enterprise FDS/SDD generation, grounded in actual citadel-cwc-portal codebase (Jun 26 at 12:41 AM)
S634 Credit Decision Engine: Complete Architecture Map of citadel-cwc-portal (Jun 26 at 10:52 AM)
S638 Credit Assessment Module: Volume 4 Technical Architecture & Engineering Design Document (19 sections) commissioned (Jun 26 at 10:55 AM)
### Jun 27, 2026
S645 Implementation Plan: Tasks 6–9 Added for Full CANCELLED Status End-to-End Implementation (Jun 27 at 9:25 AM)
### Jul 6, 2026
2464 2:01p 🔵 Bulk Approval Workflow with Status Transitions and Cascading Routes
2465 " 🔵 Terminal Status Constants: 50+ Closed Statuses Across Six Workflow Types
2466 2:06p ⚖️ Ticket Workflow: Cancelled vs Rejected Status Distinction Required
2467 2:07p ⚖️ Ticket Request Workflow: CANCELLED vs REJECTED States Must Be Distinct
2468 2:08p 🔵 RequestStatus Enum: Precedent Pattern for Adding New Status Values via Migration
2469 2:10p ✅ Implementation Plan Updated: CANCELLED Status Added as Fourth Task Group
2470 2:13p ✅ Implementation Plan: Tasks 6–9 Added for Full CANCELLED Status End-to-End Implementation
S647 Phase 6 Workflow Engine Consolidation — Implementation Correctness Verification for citadel-cwc-portal ESM plan (Jul 6 at 2:13 PM)
### Jul 7, 2026
2471 12:20a 🔵 Phase 6 Workflow Engine Consolidation: Implementation Status Check Requested
2472 " 🔵 Phase 6 Workflow Engine Consolidation: Largely Implemented with Residual Direct DB Updates
S648 Phase 6 Workflow Engine Consolidation — Implementation Correctness Audit (citadel-cwc-portal) (Jul 7 at 12:21 AM)
2476 12:25a 🔵 citadel-cwc-portal: Phase 6 Workflow Engine Consolidation — Implementation Audit Commissioned
2477 " 🔵 citadel-cwc-portal: Workflow Engine — DB-First Runtime with Hardcoded Fallback Map
2478 12:26a 🔵 citadel-cwc-portal: Phase 6 Workflow Engine — Admin UI Exists for Transitions; P6-07/P6-08 Unimplemented
S651 ESM Platform: 16-Phase Enterprise Architecture Audit Commissioned (Jul 7 at 12:27 AM)
2479 9:52a ⚖️ ESM Platform: 16-Phase Enterprise Audit Commissioned
2480 " ⚖️ ESM Platform: Comprehensive 16-Phase Enterprise Audit Commissioned
2482 9:53a 🔵 citadel-cwc-portal: Full ESM Platform Architecture Deep Scan — Schema, Services, Routes, Frontend
2483 " 🔵 ESM Platform: Backend Architecture, Auth, Security Config, and Frontend Routing Deep Scan
2484 9:54a ⚖️ ESM Platform: 16-Phase Enterprise Architecture Audit Commissioned
2486 9:55a ⚖️ ESM Platform: 16-Phase Enterprise Architecture Audit Commissioned
2487 9:56a ⚖️ ESM Platform: 16-Phase Enterprise Architecture Audit Commissioned
2488 9:57a 🔵 citadel-cwc-portal: Workflow & Approval Engine Deep Audit
2489 9:58a 🔵 ESM Platform: Comprehensive Service Desk Module Architecture Audit
2490 " ⚖️ ESM Platform: 16-Phase Enterprise Architecture Audit Commissioned
2491 9:59a 🔵 ESM Platform: SSE Client Registry Located in utils/sseClients.ts
2492 10:00a 🔵 ESM Platform: 87 Potential N+1 Query Sites and Inconsistent Pagination
2493 10:06a ✅ ESM Platform: 16-Phase Enterprise Architecture Review Report Exported to docs/
S652 ESM Platform: 16-Phase Enterprise Architecture Review Report Exported to docs/ (Jul 7 at 10:06 AM)
### Jul 14, 2026
2719 10:01p ⚖️ Credit Assessment Module: Full 24-Domain Enterprise Audit Commissioned
2720 " ⚖️ Credit Assessment Module: Full 24-Domain Codebase Audit Commissioned
2721 10:02p ⚖️ Credit Assessment Module: Full 24-Domain Codebase Audit Commissioned
2722 " ⚖️ Credit Assessment Module: Full 24-Domain Enterprise Codebase Audit Commissioned
2725 10:03p 🔵 Credit Assessment: Application State Machine Fully Traced — 19-State Workflow with RBAC-Gated Transitions
2726 " 🔵 Credit Assessment: BorrowerProfile Service — Full CRUD with Encrypted PII, Duplicate Detection, and Activity Logging
2727 " 🔵 Credit Assessment: Borrower Risk Scoring Engine — Real Multi-Factor Scorecard with Bureau Caps and Versioned Runs
2728 " 🔵 Credit Assessment: Application 360 Workspace — 12 Primary Tabs + 27 Sub-Sections, 3-Column Layout
2729 " 🔵 Credit Assessment: Document Management — S3-backed with AV Scanning, SHA-256 Integrity, Versioning, and Rule Engine Checklist
2730 " 🔵 Credit Assessment: Borrower Financial Data — DSR/Net-DSR Calculation, Income Persistence, AML Manual Screening, Bureau Report Ingestion
### Jul 21, 2026
2867 2:08p ⚖️ ESM Platform: Full 16-Phase Enterprise Production Readiness Audit Commissioned
2868 " 🔵 ESM Platform (citadel-cwc-portal): Full Repository Structure Mapped for Production Audit
2869 2:09p ⚖️ ESM Platform: Full 16-Domain Production Readiness Audit Commissioned
2870 " ⚖️ ESM Production Readiness Audit: Parallel Subagents Spawned for Backend/Security/DB and Frontend/Isolation Domains
2881 " ⚖️ ESM Platform: Full 16-Domain Production Readiness Audit Commissioned
2872 " ⚖️ ESM Platform: Full 16-Domain Enterprise Production Readiness Audit Commissioned
2871 " 🔵 ESM Platform Prior Audit Findings: Overall Maturity Scored 62/100 (Jul 7, 2026)
2875 2:11p 🔵 Enterprise Service Management Platform Production Readiness Audit Initiated
2874 " 🔵 ESM Audit: Frontend Architecture Deep-Scan — Route Guards, Auth Flow, Nav, Test Coverage
2876 2:13p 🔵 ESM Backend Architecture — Core Infrastructure Stack Mapped
2877 " 🔵 Workflow Engine — Request Transition Service with Guard Registry
2878 " 🔵 Notification Engine — In-App + Email + SSE with Redis Pub/Sub Fan-out
2879 " 🔵 Approval Workflow — Multi-Level with Delegation, Timeouts, Reminders, and Entity Routing
2880 " 🔵 Codebase Structure — 647 Files, 2091 Symbols Across ESM, CRM, and Credit Modules
2882 2:14p 🔵 ESM Audit: Complete Build/Test Results + Full API/Service Layer Architecture Map

Access 2281k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>