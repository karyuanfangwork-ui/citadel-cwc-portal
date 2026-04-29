# Citadel Workplace Connect (CWC) — Production Documentation

**Document Version:** 1.0
**Date:** 2026-04-29
**Classification:** Internal / Confidential

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Product Features](#2-product-features)
3. [User Journey](#3-user-journey)
4. [Functional Specification (FSD)](#4-functional-specification-fsd)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [API Documentation](#7-api-documentation)
8. [Security & Privacy](#8-security--privacy)
9. [Workflow Engine](#9-workflow-engine)
10. [DevOps & Deployment](#10-devops--deployment)
11. [Monitoring & Logging](#11-monitoring--logging)
12. [Testing Strategy](#12-testing-strategy)
13. [Known Gaps & Backlog](#13-known-gaps--backlog)

---

## 1. Product Overview

### 1.1 Product Vision

Citadel Workplace Connect (CWC) is an enterprise-grade internal service desk portal designed for Citadel Group Technologies Sdn Bhd. It unifies IT Support, HR Services, and Group Finance operations into a single web-based platform with role-based access, multi-level approval workflows, SLA tracking, and real-time notifications.

### 1.2 Problem Statement

Enterprise organizations face fragmented internal service management:

- **Siloed request channels:** IT, HR, and Finance requests handled via email, chat, or spreadsheets with no unified tracking.
- **No approval workflow:** High-value requests (hardware purchases, hiring, reimbursements) lack structured multi-level approval chains.
- **No SLA enforcement:** Response times unmonitored; no escalation when deadlines are breached.
- **Poor visibility:** Employees cannot track request status; agents lack dashboards to manage workload.
- **Knowledge gaps:** Repetitive questions handled manually instead of via self-service knowledge base.

### 1.3 Target Users

| Segment | Description | Priority |
|---------|-------------|----------|
| **End Users** | Employees submitting IT, HR, or Finance requests | P0 |
| **Agents** | Department staff assigned to process and resolve requests | P0 |
| **Managers** | Line managers who approve requests before escalation | P0 |
| **Executives** | CEO, CTO, CFO, COO, CHRO who approve high-value requests | P1 |
| **Admins** | System administrators managing service desks, workflows, users, and configuration | P0 |

### 1.4 Core Value Proposition

| Value | Description |
|-------|-------------|
| **Unified Service Desk** | IT, HR, and Finance requests managed from a single portal |
| **Multi-Level Approval Workflows** | Configurable approval chains (Manager → VP → CTO → CEO → CFO) per request type |
| **SLA Management** | Automatic SLA tracking with breach detection, pause/resume, and escalation rules |
| **Role-Based Access Control** | Granular permissions system (roles + permissions matrix) |
| **Real-Time Notifications** | SSE-based live notifications with email alerts via Resend |
| **Knowledge Base** | Self-service articles with search, categories, and helpfulness voting |
| **Comprehensive Admin Panel** | Full configuration of service desks, categories, workflows, users, entities, templates, and SLA rules |

---

## 2. Product Features

### 2.1 Feature Inventory

#### Service Desk Features

| # | Feature | Purpose | Module |
|---|---------|---------|--------|
| 1 | **Dashboard** | Overview of request statistics, recent activity, and quick actions | `Dashboard.tsx` |
| 2 | **Create Request** | Dynamic form-based request submission across IT/HR/Finance service desks | `CreateRequest.tsx` |
| 3 | **My Requests** | Employee view of all submitted requests with status filtering | `MyRequests.tsx` |
| 4 | **Request Detail** | Full request lifecycle view with activity feed, attachments, and workflow actions | `RequestDetail.tsx` |
| 5 | **Agent Dashboard** | Agent/admin view of assigned tickets with workload management | `AgentDashboard.tsx` |
| 6 | **Knowledge Base** | Self-service article browser with search and category filtering | `KnowledgeBase.tsx` |
| 7 | **Article Detail** | Full article view with helpfulness voting | `ArticleDetail.tsx` |
| 8 | **Search** | Global search across requests and knowledge base articles | `SearchResults.tsx` |
| 9 | **Reports** | Analytics and reporting for admins (permission-gated) | `Reports.tsx` |
| 10 | **Real-Time Notifications** | SSE-based live notification feed with in-app dropdown | `NotificationDropdown.tsx` |

#### IT Support Service Desk (5 Categories)

| # | Category | Request Types |
|---|----------|---------------|
| 1 | **Get IT Help** | General IT support requests |
| 2 | **Email Management** | 4 request types for email-related issues |
| 3 | **Report System Problem** | System/infrastructure issue reporting |
| 4 | **Request Software Installation** | Software provisioning requests |
| 5 | **Request New Hardware** | Hardware procurement with multi-level approval (Manager → VP → CTO → CEO → CFO) |

#### HR Services (4 Categories)

| # | Category | Request Types |
|---|----------|---------------|
| 1 | **New Hiring Request** | Full hiring pipeline: CEO approval → Job posting → Resume upload → Interview → Feedback → HR Screening → LOA → Onboarding |
| 2 | **Report an HR Issue** | HR incident/complaint reporting |
| 3 | **Onboard a New Hire** | 10-phase onboarding lifecycle (PRE_ARRIVAL → DAY_1 → WEEK_1 → MONTH_1/2/3 → COMPLETED) with task tracking |
| 4 | **Offboard an Employee** | 5-phase offboarding lifecycle (NOTICE_PERIOD → KNOWLEDGE_TRANSFER → FINAL_WEEK → EXIT_PROCEDURES → COMPLETED) |

#### Group Finance (3 Categories)

| # | Category | Request Types |
|---|----------|---------------|
| 1 | **Expense Reimbursement** | Manager → Finance Head approval chain with payment tracking |
| 2 | **Purchase Requisition** | Multi-level approval: Acknowledge → CFO → Group CEO (if > RM15,000) → Payment → Confirmation |
| 3 | **Inter-Company Chargeback** | Entity-based dual-approval: From-Entity → To-Entity → Finance Review → Confirmation |

### 2.2 Admin Settings Feature Breakdown

| # | Tab | Purpose | Key Capabilities |
|---|-----|---------|-----------------|
| 1 | **User Accounts** | User management | List users; edit name/email/department/job title; activate/deactivate; assign manager |
| 2 | **Role Assignment** | Role management | Assign roles (ADMIN, AGENT, USER) to users; create agent teams |
| 3 | **Permissions** | Permission management | View role-permission matrix; manage granular permissions (resource:action format) |
| 4 | **Service Desks** | Service desk CRUD | Create/edit service desks, categories, and request types with form configuration |
| 5 | **Entities** | Entity management | Create/edit organizational entities with designated approvers for entity-based routing |
| 6 | **Onboarding Tasks** | Onboarding templates | CRUD for onboarding task templates (category, priority, due day offset, display order) |
| 7 | **Offboarding Tasks** | Offboarding templates | CRUD for offboarding task templates |
| 8 | **Email Notifications** | Notification templates | Edit email/push notification templates per event type with variable substitution |
| 9 | **Banner Configs** | Dashboard banners | Configure role+status-based dashboard banners (icon, title, description, color scheme) |
| 10 | **Status Definitions** | Status management | CRUD for request status definitions (code, label, category, display order) |
| 11 | **Workflow Transitions** | Workflow rules | Manage valid status transitions (from → to, label, requires comment, auto-assign) |
| 12 | **SLA & Escalation** | SLA rules | Configure escalation rules per request type (trigger hours, notify roles) |
| 13 | **Audit Log** | Audit trail | View immutable audit log (user, action, resource, old/new values, IP, timestamp) |

---

## 3. User Journey

### 3.1 First-Time User Flow

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│  App Launch  │───>│  Login Page  │───>│  Register (or  │───>│  Dashboard       │
│  (browser)   │    │  /login      │    │  Login)        │    │  / (home)        │
└─────────────┘    └──────────────┘    └────────────────┘    └──────────────────┘
```

### 3.2 Request Submission Flow

```
┌─────────────┐    ┌──────────────────────┐    ┌────────────────────────┐
│  User picks  │───>│  Service Desk        │───>│  Category Selection    │
│  department  │    │  (IT/HR/Finance)     │    │  (card-based picker)   │
│  from nav    │    │  /it, /hr, /finance  │    │                        │
└─────────────┘    └──────────────────────┘    └──────────┬─────────────┘
                                                          │
                                                ┌─────────▼──────────────┐
                                                │  Dynamic Form          │
                                                │  (FormBuilder.tsx)     │
                                                │  - JSON-configured     │
                                                │  - File attachments    │
                                                │  - Priority selection  │
                                                └──────────┬─────────────┘
                                                           │
                                                ┌──────────▼──────────────┐
                                                │  POST /api/v1/requests  │
                                                │  → Status: SUBMITTED    │
                                                │  → SLA clock starts     │
                                                │  → Notification sent    │
                                                └─────────────────────────┘
```

### 3.3 IT Hardware Approval Flow

```
SUBMITTED → PENDING_MANAGER_APPROVAL_IT → MANAGER_APPROVED_IT
  → [if price > VP threshold] PENDING_VP_APPROVAL_IT → VP_APPROVED_IT
  → [if price > CTO threshold] PENDING_CTO_APPROVAL_IT → CTO_APPROVED_IT
  → [if price > CEO threshold] PENDING_CEO_APPROVAL_IT → CEO_APPROVED_IT
  → PROCUREMENT_IN_PROGRESS → HARDWARE_ORDERED → HARDWARE_RECEIVED
  → [if invoice needed] PENDING_INVOICE_IT → PENDING_CFO_APPROVAL_IT → CFO_APPROVED_IT
  → PAYMENT_PROCESSING_IT → PAYMENT_DONE_IT → PENDING_DELIVERY_IT → RESOLVED
```

### 3.4 HR Hiring Workflow

```
SUBMITTED → PENDING_CEO_APPROVAL → CEO_APPROVED → JOB_POSTED
  → PENDING_MANAGER_REVIEW → MANAGER_APPROVED
  → INTERVIEW_SCHEDULED → INTERVIEW_FEEDBACK_PENDING
  → [PROCEED] HR_SCREENING → LOA_PENDING_APPROVAL → LOA_APPROVED
  → LOA_ISSUED → LOA_ACCEPTED → COMPLETED
  → [Triggers onboarding child ticket]
```

### 3.5 Finance Reimbursement Flow

```
SUBMITTED → PENDING_MANAGER_APPROVAL_FIN → MANAGER_APPROVED_FIN
  → PENDING_FINANCE_HEAD_APPROVAL → FINANCE_HEAD_APPROVED
  → PAYMENT_PROCESSING → PAYMENT_COMPLETED → REIMBURSEMENT_CLOSED
```

### 3.6 Finance Purchase Requisition Flow

```
SUBMITTED → FINANCE_PENDING_ACK → FINANCE_ACKNOWLEDGED → FINANCE_IN_PROGRESS
  → PENDING_CFO_APPROVAL_FIN → CFO_APPROVED_FIN
  → [if amount > RM15,000] PENDING_GROUP_CEO_APPROVAL → GROUP_CEO_APPROVED
  → PAYMENT_PROCESSING_FIN → AWAITING_PAYMENT_CONFIRMATION
  → PAYMENT_CONFIRMED_FIN → TICKET_CLOSED_FIN
```

### 3.7 Inter-Company Chargeback Flow

```
SUBMITTED → PENDING_FROM_ENTITY_APPROVAL → FROM_ENTITY_APPROVED
  → PENDING_TO_ENTITY_APPROVAL → TO_ENTITY_APPROVED
  → CHARGEBACK_FINANCE_REVIEW → AWAITING_CHARGEBACK_CONFIRMATION
  → CHARGEBACK_COMPLETED
```

### 3.8 Navigation Structure

```
AppShell (BrowserRouter)
├── /login              → Login
├── /register           → Register
├── / (Dashboard)       → Dashboard (protected)
│   ├── Stats cards (open/in-progress/resolved/total)
│   ├── Recent requests table
│   └── Quick action buttons
├── /my-requests        → MyRequests (protected)
├── /request/:id        → RequestDetail (protected, ErrorBoundary)
│   ├── ActionSidebar (37 workflow modals)
│   ├── ActivityFeed
│   ├── CustomFieldsPanel
│   ├── SLAIndicator
│   └── HiringWorkflowPanel (for HR hiring requests)
├── /hr                 → HRServices (protected)
├── /it                 → ITSupport (protected)
├── /finance            → GroupFinance (protected)
├── /:deskType/:deskId/create/:categoryId → CreateRequest (protected)
├── /agent              → AgentDashboard (protected, ADMIN/AGENT role)
├── /reports            → Reports (protected, report:read permission)
├── /search             → SearchResults (protected)
├── /kb                 → KnowledgeBase (protected)
├── /kb/:slug           → ArticleDetail (protected)
└── /admin/settings     → AdminSettings (protected, admin:access permission)
    ├── User Accounts tab
    ├── Role Assignment tab
    ├── Permissions tab
    ├── Service Desks tab
    ├── Entities tab
    ├── Onboarding Tasks tab
    ├── Offboarding Tasks tab
    ├── Email Notifications tab
    ├── Banner Configs tab
    ├── Status Definitions tab
    ├── Workflow Transitions tab
    ├── SLA & Escalation tab
    └── Audit Log tab
```

---

## 4. Functional Specification (FSD)

### 4.1 Authentication & Registration

#### F-001: User Login

| Field | Description |
|-------|-------------|
| **Description** | Authenticate user with email and password |
| **Trigger** | User submits login form |
| **Flow** | 1. POST `/api/v1/auth/login` with credentials 2. Backend validates email/password via bcrypt 3. Issues JWT access token (httpOnly cookie) + refresh token 4. Client stores user state in AuthContext 5. Redirects to Dashboard |
| **Inputs** | `email`, `password` |
| **Outputs** | `accessToken` (cookie, 15min), `refreshToken` (cookie, 30d), `user` object with roles and permissions |
| **Error Handling** | 401 invalid credentials; 404 user not found; rate limited |

#### F-002: User Registration

| Field | Description |
|-------|-------------|
| **Description** | Register a new employee account |
| **Trigger** | User submits registration form |
| **Flow** | 1. POST `/api/v1/auth/register` 2. Backend validates, hashes password (bcrypt), creates User 3. Assigns default USER role 4. Issues JWT pair 5. Redirects to Dashboard |
| **Inputs** | `firstName`, `lastName`, `email`, `password` |
| **Outputs** | `accessToken`, `refreshToken`, `user` object |
| **Error Handling** | 409 email already registered; 400 validation errors |

### 4.2 Request Management

#### F-003: Create Request

| Field | Description |
|-------|-------------|
| **Description** | Submit a new service request with dynamic form fields |
| **Trigger** | User navigates to service desk, selects category and request type |
| **Flow** | 1. GET `/api/v1/service-desks/:id` loads categories and request types 2. FormBuilder renders JSON-configured form fields 3. User fills form, attaches files 4. POST `/api/v1/requests` creates request 5. SLA timer starts based on request type slaHours 6. Notification sent to relevant agents/managers |
| **Inputs** | `summary`, `description`, `priority`, `serviceDeskId`, `requestTypeId`, `customFields` (JSON), `attachments` (files) |
| **Outputs** | `request` object with `referenceNumber`, `status: SUBMITTED` |

#### F-004: Request Workflow Actions

| Field | Description |
|-------|-------------|
| **Description** | Agent/manager/executive performs workflow action on a request |
| **Trigger** | Authorized user clicks action button in RequestDetail |
| **Flow** | 1. Frontend checks valid transitions from WorkflowTransition table 2. Opens appropriate modal (37 modals for different actions) 3. User fills required fields (comments, decisions) 4. PATCH `/api/v1/requests/:id/status` or workflow-specific endpoint 5. Backend validates transition, updates status, logs activity 6. SLA pause/resume as needed 7. Notifications sent to relevant parties |
| **Modals** | ManagerDecisionModal, VpApprovalModal, CtoDecisionModal, CeoDecisionModal, CfoDecisionModal, ProcurementModal, HardwareOrderedModal, HardwareReceivedModal, SoftwareProvisionedModal, PendingInvoiceModal, PaymentDoneModal, CompleteDeliveryModal, FinAcknowledgeModal, FinDecisionModal, RouteToCeoFinModal, MarkPaymentCompleteFinModal, CloseTicketFinModal, AssignAgentModal, ResubmitModal, WorkflowApproveModal, WorkflowRejectModal, and more |

### 4.3 Onboarding & Offboarding

#### F-005: Employee Onboarding

| Field | Description |
|-------|-------------|
| **Description** | Multi-phase onboarding lifecycle with task tracking |
| **Phases** | PRE_ARRIVAL → DAY_1 → WEEK_1 → MONTH_1 → MONTH_2 → MONTH_3 → COMPLETED |
| **Flow** | 1. HR creates onboarding request (can auto-spawn from hiring completion) 2. System creates tasks from OnboardingTaskTemplate 3. Tasks assigned to IT/HR/TRAINING/ADMIN categories 4. Assignees complete tasks, check flags (IT account, email, hardware, badges, HR docs, training) 5. Milestones tracked (day1, week1, day30, day60, day90) |
| **Dashboard** | `OnboardingDashboard.tsx` — progress tracking, task management, milestone visualization |

#### F-006: Employee Offboarding

| Field | Description |
|-------|-------------|
| **Description** | Structured employee departure process |
| **Phases** | NOTICE_PERIOD → KNOWLEDGE_TRANSFER → FINAL_WEEK → EXIT_PROCEDURES → COMPLETED |
| **Flow** | 1. Manager/HR creates offboarding request 2. Tasks from OffboardingTaskTemplate 3. IT revocation flags (accounts, email, hardware, badges) 4. HR flags (resignation letter, exit interview, payroll, benefits) 5. Knowledge transfer tracking |
| **Dashboard** | `OffboardingDashboard.tsx` — checklist progress, task management |

---

## 5. Frontend Architecture

### 5.1 Architecture Pattern

**Pattern:** React SPA with Context-based state management

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Pages    │  │Components│  │  Modals   │  │ Layouts │ │
│  │ (13)     │  │ (15+)    │  │  (37)     │  │         │ │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └─────────┘ │
│       │              │                                    │
│  ┌────▼──────────────▼────┐                              │
│  │  Context Providers      │                             │
│  │  AuthContext            │                             │
│  │  NotificationContext   │                             │
│  │  ToastContext          │                             │
│  └────────────┬───────────┘                              │
├───────────────┼──────────────────────────────────────────┤
│               │           Service Layer                   │
│  ┌────────────▼───────────┐  ┌────────────────────────┐  │
│  │  API Service (Axios)   │  │  Frontend Services     │  │
│  │  api.ts — base client  │  │  auth.service.ts       │  │
│  │  Token refresh via     │  │  request.service.ts    │  │
│  │  httpOnly cookies      │  │  admin.service.ts      │  │
│  │                        │  │  workflow.service.ts   │  │
│  │                        │  │  notification.service  │  │
│  │                        │  │  kb.service.ts         │  │
│  │                        │  │  search.service.ts     │  │
│  │                        │  │  reports.service.ts    │  │
│  │                        │  │  + 12 more services    │  │
│  └────────────────────────┘  └────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                    Utility Layer                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │permissions│  │ roleDetect│  │ workflow │  │ token  │ │
│  │.ts       │  │ ion.ts    │  │ Actions  │  │Manager │ │
│  │          │  │           │  │ .ts      │  │ .ts    │ │
│  └──────────┘  └───────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Module Structure

```
frontend/
├── App.tsx                         # Root component, routing, Header, Footer
├── index.tsx                       # Entry point
├── index.html                      # HTML template
├── constants.tsx                   # STATUS_CONFIG (100+ statuses), MOCK_REQUESTS
├── types.ts                        # TypeScript types (RequestStatus enum, interfaces)
├── vite.config.ts                  # Vite configuration
├── pages/
│   ├── Dashboard.tsx               # Home dashboard with stats
│   ├── MyRequests.tsx              # User's request list
│   ├── RequestDetail.tsx           # Request detail with workflow
│   ├── CreateRequest.tsx           # Dynamic form request creation
│   ├── AgentDashboard.tsx          # Agent ticket management
│   ├── AdminSettings.tsx           # Admin configuration panel
│   ├── Reports.tsx                 # Analytics & reports
│   ├── KnowledgeBase.tsx           # KB article browser
│   ├── ArticleDetail.tsx           # KB article viewer
│   ├── SearchResults.tsx           # Global search
│   ├── HRServices.tsx              # HR service desk
│   ├── ITSupport.tsx               # IT service desk
│   └── GroupFinance.tsx            # Finance service desk
├── src/
│   ├── context/
│   │   ├── AuthContext.tsx          # Auth state, login/logout, token refresh
│   │   ├── NotificationContext.tsx  # SSE notifications, toast state
│   │   └── ToastContext.tsx         # Global toast notifications
│   ├── components/
│   │   ├── ProtectedRoute.tsx       # Auth + permission guard
│   │   ├── ErrorBoundary.tsx        # Error boundary wrapper
│   │   ├── FormBuilder.tsx          # JSON-configured dynamic forms
│   │   ├── NotificationDropdown.tsx # Live notification feed
│   │   ├── OnboardingDashboard.tsx  # Onboarding progress tracker
│   │   ├── OffboardingDashboard.tsx # Offboarding progress tracker
│   │   ├── ToastContainer.tsx       # Toast notification renderer
│   │   ├── admin/                   # 21 admin setting components
│   │   ├── request/                 # Request header, form fields, hiring panel
│   │   └── request-detail/         # 37 workflow action modals
│   ├── services/                   # 21 API service files
│   ├── hooks/
│   │   ├── useBannerConfigs.ts     # Dashboard banner config hook
│   │   └── useModalDismiss.ts      # Modal click-outside dismiss
│   ├── utils/
│   │   ├── permissions.ts          # RBAC permission checks
│   │   ├── roleDetection.ts        # User role detection
│   │   ├── tokenManager.ts         # JWT token management
│   │   ├── workflowActions.ts      # Workflow action definitions
│   │   └── workflowTransitions.ts  # Valid status transition map
│   └── styles/                     # CSS styles
└── package.json

```

### 5.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------| 
| Framework | React | ^19.2.3 |
| Language | TypeScript | ~5.8.2 |
| Build Tool | Vite | ^6.2.0 |
| Routing | React Router DOM | ^7.12.0 |
| HTTP Client | Axios | ^1.13.2 |
| CSS Framework | TailwindCSS | ^4.2.2 |
| Drag & Drop | @dnd-kit/core + sortable | ^6.3.1 / ^10.0.0 |
| Markdown | react-markdown | ^10.1.0 |
| Sanitization | DOMPurify | ^3.4.0 |
| Forms Plugin | @tailwindcss/forms | ^0.5.11 |

---

## 6. Backend Architecture

### 6.1 Architecture Pattern

**Pattern:** Layered MVC (Express.js) with Prisma ORM

```
┌─────────────────────────────────────────────────────────────┐
│                     Express.js Application                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Middleware Stack                        │ │
│  │  helmet → cookieParser → cors → json → compression      │ │
│  │  → morgan → rateLimit → authenticate/authorize           │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                    Routes (30 files)                      │ │
│  │  /auth /users /requests /service-desks /notifications    │ │
│  │  /kb /search /approvals /interviews /screening /loa      │ │
│  │  /onboarding /offboarding /it-workflow /finance-workflow  │ │
│  │  /chargeback-workflow /reports /files /sla               │ │
│  │  /admin/* (entities, workflows, templates, configs)      │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                  Controllers (29 files)                   │ │
│  │  Auth, User, Request, ServiceDesk, Notification, KB,     │ │
│  │  Search, Approval, Interview, Screening, LOA,            │ │
│  │  Onboarding, Offboarding, ITWorkflow, FinanceWorkflow,   │ │
│  │  ChargebackWorkflow, Reports, Entity, BannerConfig,      │ │
│  │  EscalationRule, WorkflowTransition, NotificationTemplate│ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                   Services (10 files)                     │ │
│  │  email, entityRouting, notification, onboarding,         │ │
│  │  password-reset, permission, s3, sla, sla-pause, token   │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                  Data Layer (Prisma ORM)                  │ │
│  │  PostgreSQL — 30+ models, 100+ status enums              │ │
│  │  Redis (ioredis) — token blocklist, rate limiting,        │ │
│  │                    permission cache, SLA state            │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Module Structure

```
backend/
├── src/
│   ├── app.ts                      # Express app setup, middleware, routes
│   ├── index.ts                    # Server startup
│   ├── config/
│   │   └── index.ts                # Centralized config (env vars, thresholds)
│   ├── controllers/                # 29 controller files
│   ├── routes/                     # 30 route files + index.ts
│   ├── services/                   # 10 business logic services
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT auth, role/permission authorization, SSE auth
│   │   ├── error.middleware.ts      # Centralized error handler
│   │   ├── notFound.middleware.ts   # 404 handler
│   │   ├── rateLimit.middleware.ts  # API rate limiting (express-rate-limit + Redis)
│   │   ├── upload.middleware.ts     # Multer file upload (S3 or local)
│   │   └── validate.middleware.ts   # Request body validation (Zod)
│   ├── validators/                 # Zod schemas (auth, request, user)
│   ├── templates/
│   │   └── email-layout.ts         # HTML email layout template
│   ├── jobs/
│   │   └── sla-checker.ts          # Cron-based SLA breach detection
│   └── utils/
│       └── logger.ts               # Winston logger
├── prisma/
│   ├── schema.prisma               # 30+ models, 1275 lines
│   ├── migrations/                 # Database migrations
│   ├── seed.ts                     # Database seeding (users, roles, permissions, service desks)
│   ├── seed-admin-config.ts        # Admin configuration seed data
│   └── seed-workflows.ts           # Workflow type/step seed data
├── uploads/                        # Local file uploads (dev mode)
├── Dockerfile                      # Production Docker image
└── package.json
```

### 6.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | ≥20.0.0 |
| Framework | Express.js | ^4.21.2 |
| Language | TypeScript | ^5.8.2 |
| ORM | Prisma Client | ^5.22.0 |
| Database | PostgreSQL | 15 |
| Cache/Queue | Redis (ioredis) | ^5.10.1 |
| Auth | jsonwebtoken + bcryptjs | ^9.0.2 / ^2.4.3 |
| Validation | Zod + Joi | ^3.24.1 / ^17.13.3 |
| File Storage | AWS S3 (@aws-sdk) / local | ^3.1034.0 |
| Email | Resend | ^6.12.2 |
| Logging | Winston + Morgan | ^3.17.0 / ^1.10.0 |
| Security | Helmet + CORS + express-rate-limit | ^8.0.0 / ^2.8.5 / ^7.5.0 |
| Cron | node-cron | ^4.2.1 |
| Upload | Multer + multer-s3 | ^1.4.5 / ^3.0.1 |
| Testing | Jest + Supertest | ^29.7.0 / ^7.2.2 |

### 6.4 Data Model Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   CORE ENTITIES                               │
│                                                               │
│  User ──< UserRole >── Role ──< RolePermission >── Permission │
│    │                                                          │
│    ├── Session                                                │
│    ├── PasswordResetToken                                     │
│    ├── Notification                                           │
│    └── AuditLog                                               │
│                                                               │
│  ServiceDesk ──< ServiceCategory ──< RequestType              │
│    │               (formConfig: JSON)                         │
│    └── KnowledgeBaseArticle                                   │
│                                                               │
│  Request ──< RequestActivity (comments, status changes)       │
│    │      ──< RequestAttachment (S3/local files)              │
│    │      ──< RequestApproval (multi-level approvals)         │
│    │      ── ITHardwareRequest (procurement details)          │
│    │      ── HRLeaveRequest (leave details)                   │
│    │      ── FinanceExpenseReimbursement ──< ExpenseLineItem  │
│    │      ── CandidateResume                                  │
│    │      ── InterviewSchedule                                │
│    │      ── InterviewFeedback                                │
│    │      ── HRScreening                                      │
│    │      ── LetterOfAcceptance                               │
│    │      ── OnboardingRequest ──< OnboardingTask             │
│    │      ── OffboardingRequest ──< OffboardingTask           │
│    └──< Request (parent/child self-relation)                  │
│                                                               │
│  Entity ──< User (user belongs to entity)                     │
│          ── RequestTypeEntityRouting                           │
│                                                               │
│  WorkflowType ──< WorkflowStep                                │
│  WorkflowTransition (from/to status pairs)                    │
│                                                               │
│  EscalationRule (per RequestType)                             │
│  BannerConfig (role + status based)                           │
│  RequestStatusDefinition                                      │
│  NotificationTemplate                                         │
│  OnboardingTaskTemplate                                       │
│  OffboardingTaskTemplate                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. API Documentation

### 7.1 API Overview

**Base URL:** `/api/v1`
**Authentication:** JWT via httpOnly cookies (access_token) or Authorization: Bearer header
**Rate Limiting:** 100 requests per 15-minute window (configurable)

### 7.2 Route Summary

| Route Prefix | Controller | Auth | Description |
|--------------|-----------|------|-------------|
| `/auth` | auth.controller | Public | Login, register, refresh token, logout, forgot/reset password |
| `/users` | user.controller | Protected | User CRUD, profile, manager hierarchy |
| `/requests` | request.controller | Protected | Request CRUD, status transitions, activity, attachments |
| `/service-desks` | serviceDesk.controller | Protected | Service desk/category/type listing |
| `/notifications` | notification.controller | Protected | Notification list, mark read, SSE stream |
| `/kb` | kb.controller | Protected | Knowledge base article CRUD, search, voting |
| `/search` | search.controller | Protected | Global search (requests + KB articles) |
| `/approvals` | approval.controller | Protected | Multi-level approval actions |
| `/interviews` | interview.controller | Protected | Interview schedule/feedback CRUD |
| `/screening` | screening.controller | Protected | HR screening CRUD |
| `/loa` | loa.controller | Protected | Letter of acceptance upload/approval |
| `/onboarding` | onboarding.controller | Protected | Onboarding request/task management |
| `/offboarding` | offboarding.controller | Protected | Offboarding request/task management |
| `/it-workflow` | it-workflow.controller | Protected | IT hardware workflow transitions |
| `/finance-workflow` | finance-workflow.controller | Protected | Finance workflow transitions |
| `/chargeback-workflow` | chargeback-workflow.controller | Protected | Inter-company chargeback transitions |
| `/reports` | reports.controller | Protected | Analytics and reporting data |
| `/files` | file.controller | Protected | File upload/download |
| `/sla` | escalationRule.controller | Protected | SLA escalation rule management |
| `/admin/entities` | entity.controller | Admin | Entity CRUD |
| `/admin/workflows` | workflow.controller | Admin | Workflow type/step management |
| `/admin/banner-configs` | bannerConfig.controller | Admin | Banner configuration |
| `/admin/status-definitions` | requestStatusDef.controller | Admin | Status definition CRUD |
| `/admin/workflow-transitions` | workflowTransition.controller | Admin | Transition rule management |
| `/admin/notification-templates` | notificationTemplate.controller | Admin | Email template management |
| `/admin/onboarding-templates` | onboardingTemplate.controller | Admin | Onboarding task templates |
| `/admin/offboarding-templates` | offboardingTemplate.controller | Admin | Offboarding task templates |
| `/admin/audit-logs` | auditLog.controller | Admin | Audit log viewer |

### 7.3 Health Check

```
GET /health
Response: { status: "ok", timestamp, uptime, environment }
```

---

## 8. Security & Privacy

### 8.1 Authentication System

| Component | Implementation |
|-----------|---------------|
| **Password Hashing** | bcryptjs (salt rounds: 10) |
| **JWT Access Token** | 15-minute TTL, httpOnly cookie, jti claim for revocation |
| **JWT Refresh Token** | 30-day TTL, httpOnly cookie, separate secret |
| **Token Revocation** | Redis blocklist (jti-based); user-level revocation on password change |
| **Session Management** | Database-backed sessions with IP and user agent tracking |
| **SSE Authentication** | Query parameter token (?token=) since EventSource cannot send cookies |

### 8.2 Authorization

| Layer | Mechanism |
|-------|-----------|
| **Role-Based (RBAC)** | User → UserRole → Role mapping; `authorize('ADMIN', 'AGENT')` middleware |
| **Permission-Based** | Role → RolePermission → Permission; `requirePermission('report:read')` middleware |
| **Frontend Guards** | `ProtectedRoute` component with `requirePermission` prop; `hasPermission()` / `hasAnyRole()` utilities |
| **Admin Bypass** | ADMIN role has unconditional access to all permissions |

### 8.3 Security Middleware

| Middleware | Protection |
|-----------|------------|
| **Helmet** | Security headers (CSP, HSTS, X-Frame-Options, etc.) |
| **CORS** | Configurable origin whitelist with credentials support |
| **Rate Limiting** | express-rate-limit with Redis store; 100 req/15min default |
| **Input Validation** | Zod + Joi schema validation middleware |
| **Cookie Security** | httpOnly, secure (production), sameSite: lax |
| **Body Size Limit** | 10MB JSON/URL-encoded body limit |
| **Compression** | gzip compression for responses |
| **SQL Injection** | Prevented by Prisma parameterized queries |
| **XSS** | DOMPurify sanitization on frontend; Helmet CSP headers |

---

## 9. Workflow Engine

### 9.1 Overview

CWC uses a database-driven workflow engine with configurable status transitions. The `WorkflowTransition` table defines valid `fromStatus → toStatus` pairs with metadata (label, requires comment, auto-assign rules).

### 9.2 Status Enum (100+ statuses)

```
Base Statuses (11): SUBMITTED, IN_REVIEW, ACTION_REQUIRED, APPROVED, REJECTED,
  RESOLVED, IN_PROGRESS, WAITING, PENDING_CEO_APPROVAL, CEO_APPROVED, CEO_REJECTED

HR Hiring (12): JOB_POSTED, PENDING_MANAGER_REVIEW, MANAGER_APPROVED,
  INTERVIEW_SCHEDULED, INTERVIEW_FEEDBACK_PENDING, CANDIDATE_REJECTED_INTERVIEW,
  HR_SCREENING, LOA_PENDING_APPROVAL, LOA_APPROVED, LOA_ISSUED, LOA_ACCEPTED, COMPLETED

Onboarding (10): ONBOARDING_SUBMITTED through ONBOARDING_COMPLETED

Offboarding (5): OFFBOARDING_SUBMITTED through OFFBOARDING_COMPLETED

IT Workflow (19): PENDING_MANAGER_APPROVAL_IT through PENDING_DELIVERY_IT

Finance Reimbursement (9): PENDING_MANAGER_APPROVAL_FIN through REIMBURSEMENT_CLOSED

Finance Purchase (12): FINANCE_PENDING_ACK through TICKET_CLOSED_FIN

Chargeback (9): PENDING_FROM_ENTITY_APPROVAL through CHARGEBACK_COMPLETED
```

### 9.3 SLA Engine

| Component | Details |
|-----------|---------|
| **SLA Hours** | Configured per RequestType (`slaHours` field) |
| **SLA Clock** | Starts at request creation (`slaDueAt = createdAt + slaHours`) |
| **SLA Pause** | Certain statuses pause SLA (tracked via `slaPausedAt` + `slaPauseDurationMs`) |
| **SLA Checker** | Background cron job (`sla-checker.ts`); configurable interval or cron expression |
| **Escalation Rules** | Per-RequestType rules: trigger N hours after breach, notify specified roles |
| **Schedule Modes** | `interval` (every N ms) or `cron` (Mon-Fri 9am default) |

### 9.4 Entity-Based Approval Routing

For workflows requiring entity approval (e.g., inter-company chargebacks):

1. **Entity Model** — Organizations with designated approvers
2. **RequestTypeEntityRouting** — Maps request types to entity routing modes
3. **Routing Modes:**
   - `REQUESTER_ENTITY` — Route to the requester's assigned entity approver
   - `CUSTOM_FIELD` — Route based on a custom field value (e.g., target entity selection)
4. **EntityRoutingService** — Resolves the correct entity and approver at runtime

---

## 10. DevOps & Deployment

### 10.1 Infrastructure

```
Production Environment (Docker Compose)
├── docker-compose.prod.yml
│   ├── postgres (PostgreSQL 15-alpine)
│   │   └── Volume: postgres_data (persistent)
│   │   └── Healthcheck: pg_isready
│   ├── redis (Redis 7-alpine)
│   │   └── Volume: redis_data (persistent)
│   │   └── AOF persistence, password-protected
│   │   └── Healthcheck: redis-cli ping
│   ├── backend (Node.js Express API)
│   │   └── Built from backend/Dockerfile
│   │   └── Depends on: postgres (healthy), redis (healthy)
│   │   └── Port: 3000
│   │   └── Volume: uploads
│   └── frontend (React SPA, Nginx)
│       └── Built from frontend/Dockerfile
│       └── Port: 80
│       └── Depends on: backend
```

### 10.2 Environment Setup

| Environment | Backend | Database | Redis | Frontend |
|-------------|---------|----------|-------|----------|
| **Development** | localhost:3000 | localhost:5432 | localhost:6379 | localhost:5173 |
| **Production** | Docker container :3000 | PostgreSQL container | Redis container | Nginx container :80 |

### 10.3 Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `REDIS_URL` | No | Redis connection (default: redis://localhost:6379) |
| `CORS_ORIGIN` | No | Allowed origins (default: http://localhost:5173) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/test/production) |
| `RESEND_API_KEY` | No | Email sending via Resend |
| `S3_ENDPOINT` | No | S3/MinIO storage endpoint |
| `S3_ACCESS_KEY` | No | S3 access key |
| `S3_SECRET_KEY` | No | S3 secret key |
| `S3_BUCKET` | No | S3 bucket name |
| `HARDWARE_VP_APPROVAL_THRESHOLD` | No | VP approval threshold (default: RM2,500) |
| `GROUP_CEO_APPROVAL_THRESHOLD` | No | Group CEO threshold (default: RM15,000) |
| `SLA_SCHEDULE_MODE` | No | SLA check mode: 'interval' or 'cron' |
| `SLA_CRON_EXPRESSION` | No | Cron expression (default: '0 9 * * 1-5') |

### 10.4 Database Management

| Command | Purpose |
|---------|---------|
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run dev migrations |
| `npm run prisma:migrate:prod` | Deploy production migrations |
| `npm run prisma:seed` | Seed database |
| `npm run prisma:reset` | Reset database |
| `npm run prisma:studio` | Open Prisma Studio GUI |

---

## 11. Monitoring & Logging

### 11.1 System Monitoring

| Component | Tool | Details |
|-----------|------|---------|
| **Request Logging** | Morgan | Dev format (development), combined format (production) |
| **Application Logging** | Winston | JSON structured logging, configurable level |
| **Health Check** | `/health` endpoint | Database connectivity, uptime, environment |
| **SLA Monitoring** | sla-checker.ts cron job | Breach detection and escalation |

### 11.2 Error Handling

| Layer | Strategy |
|-------|----------|
| **Backend** | Express `next(error)` chain → centralized error handler → structured JSON error responses |
| **Frontend** | ErrorBoundary components wrapping critical routes (RequestDetail, AdminSettings) |
| **Background Jobs** | node-cron error handlers for SLA checker |

### 11.3 Audit Logging

| Event | Tracking |
|-------|---------|
| All admin actions | AuditLog table (userId, action, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent) |
| Status transitions | RequestActivity entries (activityType: STATUS_CHANGE) |
| Login/logout | Session creation/deletion |
| Configuration changes | AuditLog with before/after snapshots |

---

## 12. Testing Strategy

### 12.1 Backend Testing

| Type | Framework | Location |
|------|-----------|----------|
| **Unit Tests** | Jest + ts-jest | `backend/src/__tests__/`, `backend/src/services/__tests__/`, `backend/src/controllers/__tests__/` |
| **Integration Tests** | Jest + supertest | `backend/src/__tests__/`, `backend/src/controllers/__tests__/` |
| **Execution** | `npm test` (single run) / `npm run test:watch` (watch) | — |
| **Coverage** | `npm run test:coverage` | Jest Istanbul reports |

#### 12.1.1 Backend Test Coverage (11 suites, 105 unit tests)

| Test Suite | Type | Tests | Coverage Area |
|------------|------|-------|---------------|
| `auth.test.ts` | Integration | 4 | Registration, login, token refresh (requires DB) |
| `request.test.ts` | Integration | 5 | CRUD + list + filter (requires DB) |
| `auth.integration.test.ts` | Integration | 5 | Multi-browser session isolation (requires DB) |
| `token.service.test.ts` | Unit | 4 | JWT jti revocation, user revocation timestamps |
| `password-reset.service.test.ts` | Unit | 3 | Password reset token lifecycle |
| `sla-pause.service.test.ts` | Unit | 23 | SLA pause/resume, effective due date, Redis caching |
| `notification.service.test.ts` | Unit | 16 | notify(), notifyMultiple(), template rendering, SSE push, email send, variable merge |
| `sla.service.test.ts` | Unit | 12 | SLA breach detection, escalation rules, skip paused/terminal, error handling |
| `entityRouting.service.test.ts` | Unit | 15 | Entity routing (REQUESTER_ENTITY + CUSTOM_FIELD), dedup, inactive skip, approval resolution |
| `permission.service.test.ts` | Unit | 9 | getUserPermissions (Redis cache + DB fallback), hasPermission, checkPermission, cache invalidation |
| `sseClients.test.ts` | Unit | 16 | SSE client registry, Redis pub/sub adapter, addClient/removeClient, deliverLocal, pushToUser (local + Redis), broadcast, initSseRedis/disconnectSseRedis, disconnected client cleanup, multi-tab per user |

#### 12.1.2 Test Pattern

All service unit tests follow the same pattern:
- `jest.mock()` for external dependencies (Prisma, Redis, ioredis, logger) at module scope
- Inline mock objects (avoids `ReferenceError: Cannot access before initialization`)
- `beforeEach(() => jest.clearAllMocks())`
- No database required — all DB calls are mocked
- Integration tests use `supertest` against a real Express app with a seeded DB

### 12.2 Frontend Testing

| Type | Framework | Location |
|------|-----------|----------|
| **Unit/Component Tests** | Vitest + @testing-library/react | `frontend/src/**/*.test.{ts,tsx}` |
| **Execution** | `npm test` (single run) / `npm run test:watch` (watch mode) | — |
| **Coverage** | `npm run test:coverage` | @vitest/coverage-v8 |

#### 12.2.1 Frontend Test Setup

| Item | Details |
|------|---------|
| **Config** | `frontend/vitest.config.ts` — jsdom environment, globals enabled, React plugin |
| **Setup** | `frontend/src/test/setup.ts` — imports `@testing-library/jest-dom` |
| **Path alias** | `@` → project root (matches vite.config.ts) |
| **Smoke test** | `frontend/src/App.test.tsx` — renders root without crashing |

#### 12.2.2 Frontend Test Coverage (8 suites, 97 tests)

| Test Suite | Type | Tests | Coverage Area |
|------------|------|-------|---------------|
| `App.test.tsx` | Smoke | 1 | Root render without crash |
| `permissions.test.ts` | Unit | 17 | hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole (null user, ADMIN bypass, OR/AND logic, empty/undefined arrays) |
| `roleDetection.test.ts` | Unit | 24 | isHiringRequest, detectRequestRole (all 6 role paths: agent, ceo, cto, cfo, hiring_manager, staff; role precedence; exhaustive HIRING_STATUSES) |
| `workflowTransitions.test.ts` | Unit | 12 | isValidTransition (valid/invalid/unknown), getValidNextStatuses (terminal states, non-terminal, COMPLETED→ONBOARDING_SUBMITTED, IN_REVIEW transitions) |
| `tokenManager.test.ts` | Unit | 6 | Deprecated token manager (getAccessToken→null, getRefreshToken→null, setTokens no-op, clearTokens no-op, isTokenExpired→false) |
| `ProtectedRoute.test.tsx` | Component | 8 | Loading spinner, unauthenticated redirect, authenticated render, requireAdmin, requirePermission (string/array), permission mismatch redirect |
| `ErrorFallback.test.tsx` | Component | 8 | Default title, custom title, error message display, fallback text, Try Again button, resetError click, showDetails toggle |
| `ToastContainer.test.tsx` | Component | 5 | Empty state, success/error/warning/info toast rendering via ToastProvider |

### 12.3 CI/CD Test Gate

| Pipeline | Step | Command |
|----------|------|---------|
| **Backend** | Lint → Build → Test | `npm run lint` → `npm run build` → `npm test -- --forceExit` |
| **Frontend** | Build → Test | `npm run build` → `npm test` |
| **Config** | `.github/workflows/ci.yml` | Runs on push to main/develop and PRs to main |

### 12.4 Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | TypeScript linting (`npm run lint`) |
| **Prettier** | Code formatting (`npm run format`) |
| **Prisma Studio** | Visual database browser |
| **tsx** | TypeScript execution (dev server with watch mode) |

### 12.5 Default Test Users

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@helpdesk.com | admin123 |
| **Agent** | agent@helpdesk.com | agent123 |
| **End User** | user@helpdesk.com | user123 |
| **Group CEO** | groupceo@company.com | groupceo123 |

---

## 13. Known Gaps & Backlog

### 13.1 Critical (P0)

| # | Component | Impact | Recommendation |
|---|-----------|--------|----------------|
| 1 | **WAF** | Rate limiting + Helmet only; no WAF | Cloudflare WAF or AWS WAF in front of API |
| 2 | **Secret Rotation** | No rotation policy for JWT/DB secrets | HashiCorp Vault or AWS Secrets Manager |
| 3 | **HTTPS Enforcement** | No HTTP→HTTPS redirect in production | Add redirect middleware or configure at reverse proxy |
| 4 | **Dependency Scanning** | No `npm audit` in CI | Add dependency scanning step |

### 13.2 Important (P1)

|| # | Component | Impact | Recommendation ||
||---|-----------|--------|----------------||
|| 5 | **Structured Logging** | Console-based + Winston; no centralized log aggregation | ELK stack or CloudWatch ||
|| 6 | **APM** | No full APM dashboard | Prometheus + Grafana or Datadog ||
|| 7 | **Horizontal Scaling** | Single-server Docker Compose deployment | Kubernetes or Docker Swarm ||
|| 8 | **Database Read Replicas** | Single PostgreSQL instance | Add read replica for reporting queries ||
|| 9 | **End-to-End Tests** | No E2E test suite | Playwright or Cypress for critical paths ||
|| 10 | **Load Testing** | No load test suite | k6 or Artillery scripts ||
|| 11 | ~~CI/CD Pipeline~~ | ~~No automated CI/CD yet~~ | ✅ CI pipeline exists (lint + build + test gate); add deploy stage |
|| 12 | ~~SSE Scaling~~ | ~~SSE notifications on single instance~~ | ✅ Redis pub/sub adapter implemented in `sseClients.ts` — horizontal SSE delivery via `cwc:sse:notify` channel ||

### 13.3 Nice to Have (P2)

| # | Component | Impact | Recommendation |
|---|-----------|--------|----------------|
| 13 | **Admin 2FA** | Admin accounts use same auth as users | TOTP-based 2FA for admin accounts |
| 14 | **API Documentation** | No Swagger/OpenAPI spec | Generate OpenAPI spec from route definitions |
| 15 | **Internationalization** | Error messages English only | i18n for API errors + frontend |
| 16 | **Mobile App** | Web-only portal | React Native or PWA for mobile access |
| 17 | **Elasticsearch** | Config exists but not integrated for search | Full-text search via Elasticsearch |
| 18 | **File Virus Scan** | Upload validates type/size only | ClamAV or VirusTotal scanning |
| 19 | **Canary Deployments** | Rolling update only | Blue-green or canary with traffic splitting |
| 20 | **Backup Strategy** | No automated database backup cron | Scheduled pg_dump with offsite storage |

---

## Appendix A: Environment Variables Reference

See section 10.3 for required variables. Additional configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PREFIX` | `/api/v1` | API route prefix |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token TTL |
| `COOKIE_SAME_SITE` | `lax` | Cookie SameSite attribute |
| `COOKIE_DOMAIN` | — | Cookie domain |
| `MAX_FILE_SIZE` | `10485760` | Max upload size (10MB) |
| `ALLOWED_FILE_TYPES` | `image/jpeg,image/png,...,application/pdf` | Allowed MIME types |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `LOG_LEVEL` | `debug` | Winston log level |
| `APP_NAME` | `Enterprise Help Center` | Application name |
| `APP_URL` | `http://localhost:5173` | Frontend URL |
| `EMAIL_FROM` | `Help Center <help@helpdesk.com>` | Email sender address |
| `EMAIL_DEV_RECIPIENT` | — | Dev-only: redirect all emails |
| `CHECK_PASSWORD_BREACH` | `false` | Check password in breach databases |
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length |
| `SLA_CHECK_INTERVAL_MS` | `60000` | SLA checker interval (1min) |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **CWC** | Citadel Workplace Connect — the internal service desk portal |
| **Service Desk** | Top-level department grouping (IT, HR, Finance) |
| **Service Category** | Sub-grouping within a service desk (e.g., "Email Management" under IT) |
| **Request Type** | Specific service offering with form config and workflow (e.g., "New Hardware Request") |
| **Workflow Transition** | Valid status change rule (from → to) with metadata |
| **SLA** | Service Level Agreement — target response/resolution time per request type |
| **Entity** | Organizational unit (e.g., subsidiary company) with designated approver |
| **Entity Routing** | Mechanism to route approval requests to the correct entity approver |
| **Executive Role** | CEO/CTO/CFO/COO/CHRO designation for high-value approval chains |
| **Onboarding** | Multi-phase new hire integration process (PRE_ARRIVAL through 90-DAY) |
| **Offboarding** | Structured employee departure process (NOTICE through EXIT) |
| **LOA** | Letter of Acceptance — formal job offer document in hiring workflow |
| **Chargeback** | Inter-company billing transfer requiring dual-entity approval |
| **FormBuilder** | Dynamic form renderer driven by JSON `formConfig` on RequestType |
| **SSE** | Server-Sent Events — used for real-time notification delivery |
| **RBAC** | Role-Based Access Control — User → Role → Permission authorization model |

---

*This document reflects Citadel Workplace Connect v1.0.0 as of 2026-04-29.*

