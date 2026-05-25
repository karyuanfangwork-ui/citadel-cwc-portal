# Citadel Workplace Connect (CWC) — Production Documentation

**Document Version:** 2.2
**Date:** 2026-05-25
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

| Segment      | Description                                                                 | Priority |
|--------------|-----------------------------------------------------------------------------|----------|
| **End Users**    | Employees submitting IT, HR, or Finance requests                        | P0       |
| **Agents**       | Department staff assigned to process and resolve requests               | P0       |
| **Managers**     | Line managers who approve requests before escalation                    | P0       |
| **Executives**   | CEO, CTO, CFO, COO, CHRO who approve high-value requests                | P1       |
| **Admins**       | System administrators managing service desks, workflows, users, and configuration | P0 |

### 1.4 Core Value Proposition

| Value                              | Description |
|------------------------------------|-------------|
| **Unified Service Desk**           | IT, HR, and Finance requests managed from a single portal |
| **Multi-Level Approval Workflows** | Configurable approval chains (Manager → VP → CTO → CEO → CFO) per request type |
| **SLA Management**                 | Automatic SLA tracking with breach detection, pause/resume, and escalation rules |
| **Role-Based Access Control**      | Granular permissions system (roles + permissions matrix) |
| **Real-Time Notifications**        | SSE-based live notifications with email alerts via Resend |
| **Knowledge Base**                 | Self-service articles with search, categories, and helpfulness voting |
| **Comprehensive Admin Panel**      | Full configuration of service desks, categories, workflows, users, entities, templates, and SLA rules |
| **IT Asset Management**            | Complete asset lifecycle tracking — registry, assignment/return, active assignment list by employee, bulk CSV import/export (with Excel utility for Device_Inventory.xlsx), 9 statuses, 9 categories (incl. PRINTER), serial number + asset tag captured at hardware receipt, linked to procurement requests |
| **CRM Module**                     | Full Customer Relationship Management — Accounts, Contacts, Leads, Opportunities, Pipeline (Kanban), Activities, Notes, Trust Products, KYC records, Beneficiaries, Team Dashboard, 7 report types, automation engine, Malaysian-specific fields (NRIC/Passport, PDPA consent, registration number, trust products) |
| **Announcement Board**             | Rich-text announcement/newsletter board for staff — pinned announcements, categories, priorities, unread tracking, dashboard widget, admin management interface, PDF/DOCX parsing, image upload |
| **Dark Mode**                      | System-wide dark mode with light/dark/system themes, CSS custom property token system, persisted to localStorage |
| **Error Monitoring**               | Sentry integration for production error tracking with browser tracing and session replay |
| **Internationalization Foundation**| i18next integrated for multi-language support (v26.0.8) |

---

## 2. Product Features

### 2.1 Feature Inventory

#### Service Desk Features

| #  | Feature                    | Purpose                                                                  | Module                    |
|----|----------------------------|--------------------------------------------------------------------------|---------------------------|
| 1  | **Dashboard**              | Overview of request statistics, recent activity, and quick actions       | `Dashboard.tsx`           |
| 2  | **Create Request**         | Dynamic form-based request submission across IT/HR/Finance service desks | `CreateRequest.tsx`       |
| 3  | **My Requests**            | Employee view of all submitted requests with status filtering            | `MyRequests.tsx`          |
| 4  | **Request Detail**         | Full request lifecycle view with activity feed, attachments, and workflow actions | `RequestDetail.tsx` |
| 5  | **Agent Dashboard**        | Agent/admin view of assigned tickets with workload management            | `AgentDashboard.tsx`      |
| 6  | **Knowledge Base**         | Self-service article browser with search and category filtering          | `KnowledgeBase.tsx`       |
| 7  | **Article Detail**         | Full article view with helpfulness voting                                | `ArticleDetail.tsx`       |
| 8  | **Search**                 | Global search across requests and knowledge base articles                | `SearchResults.tsx`       |
| 9  | **Reports**                | Analytics and reporting for admins (permission-gated)                    | `Reports.tsx`             |
| 10 | **Real-Time Notifications**| SSE-based live notification feed with in-app dropdown                    | `NotificationDropdown.tsx`|
| 11 | **Approval Center**        | Executive approval dashboard showing pending requests by role            | `ApprovalCenter.tsx`      |
| 12 | **IT Asset Management**    | IT asset registry with CRUD, assignment/return, employee assets view, CSV import/export | `AssetManagement.tsx` |
| 13 | **Announcements**          | Staff announcement board — list, detail, unread badge, dashboard widget  | `Announcements.tsx`, `AnnouncementDetail.tsx`, `AnnouncementWidget.tsx` |
| 14 | **Announcements Admin**    | Create/edit/publish/pin/delete announcements; PDF/DOCX parsing; image upload | `AnnouncementsManage.tsx` |
| 15 | **CRM Dashboard**          | Sales metrics, pipeline value, lead funnel, follow-up alerts, recent activities | `CrmDashboard.tsx` |
| 16 | **CRM Accounts**           | Account list and detail — company profile, contacts, opportunities, activities | `CrmAccounts.tsx`, `CrmAccountDetail.tsx` |
| 17 | **CRM Contacts**           | Contact list and detail — profile, NRIC/Passport, PDPA consent, KYC, beneficiaries | `CrmContacts.tsx`, `CrmContactDetail.tsx` |
| 18 | **CRM Leads**              | Lead list and detail — status pipeline, convert to opportunity           | `CrmLeads.tsx`, `CrmLeadDetail.tsx` |
| 19 | **CRM Opportunities**      | Opportunity list and detail — value, stage, expected close date          | `CrmOpportunities.tsx`, `CrmOpportunityDetail.tsx` |
| 20 | **CRM Pipeline**           | Kanban pipeline board — drag-and-drop opportunity stage management       | `CrmPipeline.tsx` |
| 21 | **CRM Team Dashboard**     | Team performance metrics (admin-only)                                    | `CrmTeamDashboard.tsx` |
| 22 | **CRM Reports**            | 7 report types: lead conversion, sales performance, pipeline forecast, activity summary, lead aging, win/loss, KYC compliance | `CrmReports.tsx` |
| 23 | **CRM Guide**              | User guide / onboarding reference for the CRM module                    | `CrmGuide.tsx` |
| 24 | **Unified Inbox**          | Consolidated inbox for all pending actions across all request types      | `UnifiedInbox.tsx` |
| 25 | **Insights**               | AI-powered analytics and insights dashboard (`report:read`)              | `Insights.tsx` |
| 26 | **Audit Trail**            | Standalone admin audit trail viewer — immutable log of all system actions | `AuditTrail.tsx` |

#### Credit Assessment Module (12 main pages + 22 tab components)

| #  | Feature                        | Purpose                                                                    | Module |
|----|--------------------------------|----------------------------------------------------------------------------|--------|
| 27 | **Credit Dashboard**           | Overview of credit pipeline, application KPIs, risk exposure              | `CreditDashboard.tsx` |
| 28 | **Borrower Profiles**          | List and detail of borrower profiles with risk ratings                     | `BorrowerProfileList.tsx`, `BorrowerProfileDetail.tsx` |
| 29 | **Credit Applications**        | Full credit application lifecycle — list, detail, multi-tab review        | `CreditApplicationList.tsx`, `CreditApplicationDetail.tsx` |
| 30 | **Financial Spreading**        | Financial statement spreading and analysis tool                            | `FinancialSpreading.tsx` |
| 31 | **Financial Analysis**         | Financial ratio and trend analysis for credit assessment                   | `FinancialAnalysis.tsx` |
| 32 | **Scorecard Management**       | Credit scoring model management                                            | `ScorecardManagement.tsx` |
| 33 | **Committee Meetings**         | Credit committee meeting management and decision recording                 | `CommitteeMeetings.tsx` |
| 34 | **Collateral Management**      | Collateral registry and valuation tracking                                 | `CollateralManagement.tsx` |
| 35 | **Credit Reports**             | Credit assessment reporting and analytics                                  | `CreditReports.tsx` |
| 36 | **My Approvals (Credit)**      | Credit-specific approval queue                                             | `MyApprovals.tsx` |

> **Credit Application tab components (22):** AccountConductTab, ApprovalsTab, AuditTab, CollateralTab, ConditionsTab, CounterpartiesTab, CreditChecksTab, DocumentsTab, EsgTab, FacilitiesTab, HeaderBackgroundTab, IndustryOutlookTab, PartiesTab, PaymentCapabilityTab, ProfitabilityWalletTab, RequestsFacilitiesTab, RiskMitigatorsTab, RiskRatingEclTab, SecurityGuaranteesTab, SicrTab, SignoffTab, SummaryTab

#### IT Support Service Desk (5 Categories)

| # | Category                          | Request Types |
|---|-----------------------------------|---------------|
| 1 | **Get IT Help**                   | General IT support requests (direct to IN_REVIEW, no approval) |
| 2 | **Email Management**              | Email-related issue requests (direct to IN_REVIEW, no approval) |
| 3 | **Report System Problem**         | System/infrastructure issue reporting (direct to IN_REVIEW) |
| 4 | **Request Software Installation** | Software provisioning with CEO → CTO → Invoice → CFO approval chain, then delivery → resolved (no asset registration) |
| 5 | **Request New Hardware**          | Hardware procurement with executive approval chain (Acknowledge → CEO → CTO → Invoice → CFO → Payment → Procurement → Ordered → Received → Provisioned → Resolved) |

#### HR Services (4 Categories)

| # | Category                  | Request Types |
|---|---------------------------|---------------|
| 1 | **New Hiring Request**    | Full hiring pipeline: CEO approval → Job posting → Resume upload → Interview → Feedback → HR Screening → LOA → Onboarding |
| 2 | **Report an HR Issue**    | HR incident/complaint reporting |
| 3 | **Onboard a New Hire**    | 10-phase onboarding lifecycle (PRE_ARRIVAL → DAY_1 → WEEK_1 → MONTH_1/2/3 → COMPLETED) with task tracking |
| 4 | **Offboard an Employee**  | 5-phase offboarding lifecycle (NOTICE_PERIOD → KNOWLEDGE_TRANSFER → FINAL_WEEK → EXIT_PROCEDURES → COMPLETED) |

#### Group Finance (3 Categories)

| # | Category                      | Request Types |
|---|-------------------------------|---------------|
| 1 | **Expense Reimbursement**     | Manager → Finance Head approval chain with payment tracking |
| 2 | **Purchase Requisition**      | Multi-level approval: Acknowledge → CFO → Group CEO (if > RM15,000) → Payment → Confirmation |
| 3 | **Inter-Company Chargeback**  | Entity-based dual-approval: From-Entity → To-Entity → Finance Review → Confirmation |

### 2.2 Admin Settings Feature Breakdown

| #  | Tab                      | Purpose                   | Key Capabilities |
|----|--------------------------|---------------------------|------------------|
| 1  | **User Accounts**        | User management           | List users; edit name/email/department/job title; activate/deactivate; assign manager |
| 2  | **Role Assignment**      | Role management           | Assign roles (ADMIN, AGENT, USER) to users; create agent teams — accessed via modal within User Accounts tab (no separate tab) |
| 3  | **Permissions**          | Permission management     | View role-permission matrix; manage granular permissions (resource:action format) |
| 4  | **Service Desks**        | Service desk CRUD         | Create/edit service desks, categories, and request types with form configuration |
| 5  | **Entities**             | Entity management         | Create/edit organizational entities with designated approvers for entity-based routing |
| 6  | **Onboarding Tasks**     | Onboarding templates      | CRUD for onboarding task templates (category, priority, due day offset, display order) |
| 7  | **Offboarding Tasks**    | Offboarding templates     | CRUD for offboarding task templates |
| 8  | **Email Notifications**  | Notification templates    | Edit email/push notification templates per event type with variable substitution |
| 9  | **Banner Configs**       | Dashboard banners         | Configure role+status-based dashboard banners (icon, title, description, color scheme) |
| 10 | **Status Definitions**   | Status management         | CRUD for request status definitions (code, label, category, display order) |
| 11 | **Workflow Transitions** | Workflow rules            | Manage valid status transitions (from → to, label, requires comment, auto-assign) |
| 12 | **SLA & Escalation**     | SLA rules                 | Configure escalation rules per request type (trigger hours, notify roles); toggle SLA pause per status |
| 12 | **Audit Log**            | Audit trail               | View immutable audit log (user, action, resource, old/new values, IP, timestamp) |

> **Note:** There are 12 tabs total. Role Assignment (#2) is a modal launched within the User Accounts tab, not a standalone tab. The actual tab IDs are: `users`, `permissions`, `service-desks`, `entities`, `email-notifications`, `onboarding-tasks`, `offboarding-tasks`, `workflow-config`, `status-definitions`, `sla-escalation`, `audit-logs`, `banner-config`.

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

### 3.3 IT Hardware Procurement Flow

**Request type:** Request New Hardware (code: `NEW_HARDWARE`)
**Workflow:** IT_HARDWARE_PROCUREMENT (12-step stepper)
**Initial status:** SUBMITTED

```
SUBMITTED
  → [IT agent acknowledges & routes to CEO] ACKNOWLEDGED_IT → PENDING_CEO_APPROVAL_IT
  → [CEO approves] PENDING_CTO_APPROVAL_IT
  → [CTO approves] PENDING_INVOICE_IT
  → [IT agent uploads invoice & routes to CFO] PENDING_CFO_APPROVAL_IT
  → [CFO approves] PAYMENT_PROCESSING_IT  ← reassigns to FINANCE team
  → [Finance agent marks payment done] PROCUREMENT_IN_PROGRESS  ← reassigns back to IT team
  → [IT agent marks procurement started] HARDWARE_ORDERED
  → [IT agent marks hardware delivered] HARDWARE_RECEIVED  ← auto-creates Asset if registerAsAsset=true
  → [IT agent marks provisioned] SOFTWARE_PROVISIONED
  → RESOLVED

[Rejection at any approval step]:
  CEO rejects  → CEO_REJECTED_IT → RESOLVED
  CTO rejects  → CTO_REJECTED_IT → RESOLVED
  CFO rejects  → CFO_REJECTED_IT → RESOLVED

[Simple IT types (GET_IT_HELP, EMAIL_MANAGEMENT, REPORT_SYSTEM_PROBLEM)]:
  SUBMITTED → IN_REVIEW → IN_PROGRESS → RESOLVED (no approval chain)

[Software Installation (IT_PROCUREMENT workflow, 9-step stepper)]:
  Same executive chain (CEO → CTO → Invoice → CFO → Payment)
  but after payment → PENDING_DELIVERY_IT → RESOLVED (no procurement/asset steps)
```

**Key behaviors:**
- Agent's ONLY action from SUBMITTED is "Acknowledge & Route to CEO" (no "Start Review" shortcut)
- Procurement lifecycle actions gated by assignment: `canActOnProcurement = canAct && (isAdmin || isAssignedToMe)`
- `markPaymentDone` branches on `workflow.code`: IT_HARDWARE_PROCUREMENT → PROCUREMENT_IN_PROGRESS; IT_PROCUREMENT → PENDING_DELIVERY_IT
- `markHardwareReceived` auto-creates Asset record if `registerAsAsset=true` and `assetTag` provided
- Transient intermediate statuses (CEO_APPROVED_IT, CTO_APPROVED_IT, CFO_APPROVED_IT) exist in enum but are NOT in the WorkflowStep stepper — they are skipped in favor of the next real step
- SLA pauses during PENDING_*_APPROVAL steps (CEO, CTO, CFO)
- Team handoffs: CFO approval → FINANCE team; payment done → IT team

### 3.4 HR Hiring Workflow

```
SUBMITTED → [HR agent routes to CEO] PENDING_CEO_APPROVAL
  → [CEO approves] CEO_APPROVED
  → [HR agent routes to Group CEO] PENDING_GROUP_CEO_APPROVAL
  → [Group CEO approves] GROUP_CEO_APPROVED
  → [HR agent marks job posted] JOB_POSTED
  → [HR uploads resumes + routes to manager] PENDING_MANAGER_REVIEW
  → [Manager selects candidates] MANAGER_APPROVED
  → [HR schedules interview] INTERVIEW_SCHEDULED
  → [Hiring manager submits feedback] INTERVIEW_FEEDBACK_PENDING
  → [PROCEED] HR_SCREENING
  → [HR uploads LOA + routes for approval] LOA_PENDING_APPROVAL
  → [Manager/HR approves LOA] LOA_APPROVED
  → [HR issues LOA to candidate] LOA_ISSUED
  → [HR uploads signed LOA] LOA_ACCEPTED → COMPLETED
  → [Triggers onboarding child ticket]

[CEO rejects]          → CEO_REJECTED → RESOLVED
[Group CEO rejects]    → (stays REJECTED)
[Manager rejects]      → CANDIDATE_REJECTED_INTERVIEW
[Interview rejected]   → CANDIDATE_REJECTED_INTERVIEW
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
├── /login              → Login (public)
├── /forgot-password    → ForgotPassword (public)
├── /reset-password     → ResetPassword (public, token passed as query param)
├── /change-password    → ChangePassword (protected)
├── / (Dashboard)       → Dashboard (protected)
│   ├── Stats cards (open/in-progress/resolved/total, SLA-breach indicator)
│   ├── Recent requests table
│   ├── Role-based banner cards
│   └── Quick action buttons
├── /my-requests        → MyRequests (protected)
├── /request/:id        → RequestDetail (protected, ErrorBoundary)
│   ├── RequestHeader with context-aware breadcrumb
│   ├── WorkflowCockpit (right-pane container)
│   │   ├── WorkflowStepper (progress visualization)
│   │   ├── DecisionPanel (contextual action buttons + modals)
│   │   ├── ApprovalChain
│   │   ├── SLAIndicator (with pause state)
│   │   └── ParticipantsSection
│   ├── ActivityFeed
│   ├── CustomFieldsPanel
│   ├── HiringWorkflowPanel (HR hiring requests only)
│   ├── OnboardingDashboard / OffboardingDashboard (lifecycle requests)
│   └── ConfidentialDocumentsPanel (HR hiring resumes)
├── /hr                 → HRServices (protected)
├── /it                 → ITSupport (protected)
├── /finance            → GroupFinance (protected)
├── /it/hardware        → Redirect to /it
├── /:deskType/:deskId/create/:categoryId → CreateRequest (protected)
├── /agent              → AgentDashboard (protected, ADMIN/AGENT role)
├── /approvals          → ApprovalCenter (protected, request:approve permission)
├── /inbox              → UnifiedInbox (protected)
├── /assets             → AssetManagement (protected, asset:read permission)
├── /reports            → Reports (protected, report:read permission)
├── /insights           → Insights (protected, report:read permission)
├── /search             → SearchResults (protected)
├── /kb                 → KnowledgeBase (protected, feature-flagged)
├── /kb/:slug           → ArticleDetail (protected, feature-flagged)
├── /announcements      → Announcements (protected)
├── /announcements/:id  → AnnouncementDetail (protected)
├── /admin/announcements → AnnouncementsManage (protected, announcement:write)
├── /admin/audit        → AuditTrail (protected, admin:access)
├── /crm                → CrmDashboard (protected, crm:read)
├── /crm/accounts       → CrmAccounts (protected, crm:read)
├── /crm/accounts/:id   → CrmAccountDetail (protected, crm:read)
├── /crm/contacts       → CrmContacts (protected, crm:read)
├── /crm/contacts/:id   → CrmContactDetail (protected, crm:read)
├── /crm/leads          → CrmLeads (protected, crm:read)
├── /crm/leads/:id      → CrmLeadDetail (protected, crm:read)
├── /crm/opportunities  → CrmOpportunities (protected, crm:read)
├── /crm/opportunities/:id → CrmOpportunityDetail (protected, crm:read)
├── /crm/pipeline       → CrmPipeline/Kanban (protected, crm:read)
├── /crm/team           → CrmTeamDashboard (protected, crm:admin)
├── /crm/reports        → CrmReports (protected, crm:read)
├── /crm/guide          → CrmGuide (protected, crm:read)
├── /credit             → CreditDashboard (protected)
├── /credit/borrowers   → BorrowerProfileList (protected)
├── /credit/borrowers/:id → BorrowerProfileDetail (protected)
├── /credit/applications → CreditApplicationList (protected)
├── /credit/applications/:id → CreditApplicationDetail (protected)
├── /credit/approvals   → MyApprovals (protected)
├── /credit/financials  → FinancialSpreading (protected)
├── /credit/analysis    → FinancialAnalysis (protected)
├── /credit/scorecards  → ScorecardManagement (protected)
├── /credit/committee   → CommitteeMeetings (protected)
├── /credit/collateral  → CollateralManagement (protected)
├── /credit/reports     → CreditReports (protected)
└── /admin/settings     → AdminSettings (protected, admin:access)
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
    └── SLA & Escalation tab
```

---

## 4. Functional Specification (FSD)

### 4.1 Authentication & Registration

#### F-001: User Login

| Field              | Description |
|--------------------|-------------|
| **Description**    | Authenticate user with email and password |
| **Trigger**        | User submits login form |
| **Flow**           | 1. POST `/api/v1/auth/login` with credentials 2. Backend validates email/password via bcrypt 3. Issues JWT access token (httpOnly cookie) + refresh token 4. Client stores user state in AuthContext 5. Redirects to Dashboard |
| **Inputs**         | `email`, `password` |
| **Outputs**        | `accessToken` (cookie, 15min), `refreshToken` (cookie, 30d), `user` object with roles and permissions |
| **Error Handling** | 401 invalid credentials; 404 user not found; rate limited |

#### F-002: User Registration

| Field              | Description |
|--------------------|-------------|
| **Description**    | Register a new employee account |
| **Trigger**        | User submits registration form |
| **Flow**           | 1. POST `/api/v1/auth/register` 2. Backend validates, hashes password (bcrypt), creates User 3. Assigns default USER role 4. Issues JWT pair 5. Redirects to Dashboard |
| **Inputs**         | `firstName`, `lastName`, `email`, `password` |
| **Outputs**        | `accessToken`, `refreshToken`, `user` object |
| **Error Handling** | 409 email already registered; 400 validation errors |

### 4.2 Request Management

#### F-003: Create Request

| Field           | Description |
|-----------------|-------------|
| **Description** | Submit a new service request with dynamic form fields |
| **Trigger**     | User navigates to service desk, selects category and request type |
| **Flow**        | 1. GET `/api/v1/service-desks/:id` loads categories and request types 2. FormBuilder renders JSON-configured form fields 3. User fills form, attaches files 4. POST `/api/v1/requests` creates request 5. SLA timer starts based on request type slaHours 6. Notification sent to relevant agents/managers |
| **Inputs**      | `summary`, `description`, `priority`, `serviceDeskId`, `requestTypeId`, `customFields` (JSON), `attachments` (files) |
| **Outputs**     | `request` object with `referenceNumber`, `status: SUBMITTED` |

#### F-004: Request Workflow Actions

| Field           | Description |
|-----------------|-------------|
| **Description** | Agent/manager/executive performs workflow action on a request |
| **Trigger**     | Authorized user clicks action button in RequestDetail |
| **Flow**        | 1. Frontend checks valid transitions from WorkflowTransition table 2. Opens appropriate modal (26+ modals across request/modals/ and request-detail/) 3. User fills required fields (comments, decisions) 4. PATCH `/api/v1/requests/:id/status` or workflow-specific endpoint 5. Backend validates transition, updates status, logs activity 6. SLA pause/resume as needed 7. Notifications sent to relevant parties |
| **Modals**      | ManagerDecisionModal, CEODecisionModal, CfoDecisionModal, RejectionModal, ResolutionModal, ScheduleInterviewModal, EditInterviewModal, InterviewFeedbackModal, LOAApprovalModal, CompleteOnboardingModal, AssignAgentModal, ResubmitModal, WorkflowApproveModal, WorkflowRejectModal, CtoDecisionModal, WorkflowActionModal (general-purpose), and more (26+ modals across request/modals/ and request-detail/ directories) |

### 4.3 Onboarding & Offboarding

#### F-005: Employee Onboarding

| Field           | Description |
|-----------------|-------------|
| **Description** | Multi-phase onboarding lifecycle with task tracking |
| **Phases**      | PRE_ARRIVAL → DAY_1 → WEEK_1 → MONTH_1 → MONTH_2 → MONTH_3 → COMPLETED |
| **Flow**        | 1. HR creates onboarding request (can auto-spawn from hiring completion) 2. System creates tasks from OnboardingTaskTemplate 3. Tasks assigned to IT/HR/TRAINING/ADMIN categories 4. Assignees complete tasks, check flags (IT account, email, hardware, badges, HR docs, training) 5. Milestones tracked (day1, week1, day30, day60, day90) |
| **Dashboard**   | `OnboardingDashboard.tsx` — progress tracking, task management, milestone visualization |

#### F-006: Employee Offboarding

| Field           | Description |
|-----------------|-------------|
| **Description** | Structured employee departure process |
| **Phases**      | NOTICE_PERIOD → KNOWLEDGE_TRANSFER → FINAL_WEEK → EXIT_PROCEDURES → COMPLETED |
| **Flow**        | 1. Manager/HR creates offboarding request 2. Tasks from OffboardingTaskTemplate 3. IT revocation flags (accounts, email, hardware, badges) 4. HR flags (resignation letter, exit interview, payroll, benefits) 5. Knowledge transfer tracking |
| **Dashboard**   | `OffboardingDashboard.tsx` — checklist progress, task management |

---

## 5. Frontend Architecture

### 5.1 Architecture Pattern

**Pattern:** React SPA with Context-based state management

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Pages    │  │Components│  │  Modals   │  │ Layouts │ │
│  │ (17)     │  │ (15+)    │  │ (26+)     │  │         │ │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └─────────┘ │
│       │              │                                    │
│  ┌────▼──────────────▼────┐                              │
│  │  Context Providers      │                             │
│  │  AuthContext            │                             │
│  │  NotificationContext    │                             │
│  │  ToastContext           │                             │
│  │  ThemeContext           │                             │
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
│  │                        │  │  asset.service.ts      │  │
│  │                        │  │  approval.service.ts   │  │
│  │                        │  │  + 12 more services    │  │
│  └────────────────────────┘  └────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                    Utility Layer                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐  │
│  │permissions│  │roleDetect │  │ workflow │  │ token  │  │
│  │.ts        │  │ion.ts     │  │ Actions  │  │Manager │  │
│  │           │  │           │  │ .ts      │  │ .ts    │  │
│  └──────────┘  └───────────┘  └──────────┘  └────────┘  │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐             │
│  │ workflow │  │error-     │  │ sentry.ts │             │
│  │ Modal-   │  │ Messages  │  │ (prod)    │             │
│  │ Config.ts│  │ .ts       │  │           │             │
│  └──────────┘  └───────────┘  └───────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Module Structure

```
frontend/
├── App.tsx                         # Root component, routing, Header, Footer, Sentry init
├── index.tsx                       # Entry point
├── index.html                      # HTML template
├── constants.tsx                   # STATUS_CONFIG (94 statuses), MOCK_REQUESTS
├── types.ts                        # TypeScript types (RequestStatus enum, interfaces)
├── vite.config.ts                  # Vite configuration
├── pages/
│   ├── Dashboard.tsx               # Home dashboard with stats and banners
│   ├── MyRequests.tsx              # User's request list with SLA badges
│   ├── RequestDetail.tsx           # Request detail with workflow
│   ├── CreateRequest.tsx           # Dynamic form request creation
│   ├── AgentDashboard.tsx          # Agent ticket management
│   ├── ApprovalCenter.tsx          # Executive approval center (request:approve)
│   ├── AssetManagement.tsx         # IT asset registry + employee assignment view
│   ├── AdminSettings.tsx           # Admin configuration panel
│   ├── Reports.tsx                 # Analytics & reports
│   ├── KnowledgeBase.tsx           # KB article browser (DEV only)
│   ├── ArticleDetail.tsx           # KB article viewer (DEV only)
│   ├── SearchResults.tsx           # Global search
│   ├── HRServices.tsx              # HR service desk
│   ├── ITSupport.tsx               # IT service desk
│   ├── GroupFinance.tsx            # Finance service desk
│   ├── Announcements.tsx           # Announcement list (all staff)
│   ├── AnnouncementDetail.tsx      # Single announcement view
│   ├── AnnouncementWidget.tsx      # Dashboard widget (pinned + latest)
│   ├── AnnouncementsManage.tsx     # Admin announcement management
│   ├── CrmDashboard.tsx            # CRM overview + KPIs
│   ├── CrmAccounts.tsx             # Account list
│   ├── CrmAccountDetail.tsx        # Account detail (contacts, opportunities, activities)
│   ├── CrmContacts.tsx             # Contact list
│   ├── CrmContactDetail.tsx        # Contact detail (KYC, beneficiaries, trust products)
│   ├── CrmLeads.tsx                # Lead list
│   ├── CrmLeadDetail.tsx           # Lead detail + convert to opportunity
│   ├── CrmOpportunities.tsx        # Opportunity list
│   ├── CrmOpportunityDetail.tsx    # Opportunity detail
│   ├── CrmPipeline.tsx             # Kanban pipeline board
│   ├── CrmTeamDashboard.tsx        # Team performance (crm:admin)
│   ├── CrmReports.tsx              # 7 CRM report types
│   ├── CrmGuide.tsx                # CRM user guide
│   ├── UnifiedInbox.tsx            # Consolidated inbox for pending actions
│   ├── Insights.tsx                # AI-powered analytics dashboard (report:read)
│   ├── AuditTrail.tsx              # Standalone admin audit trail (admin:access)
│   ├── ApprovalCenter.tsx          # Executive approval queue (request:approve)
│   ├── NotFound.tsx                # 404 error page
│   ├── CreditDashboard.tsx         # Credit assessment overview
│   ├── BorrowerProfileList.tsx     # Borrower profile list
│   ├── BorrowerProfileDetail.tsx   # Borrower profile detail
│   ├── CreditApplicationList.tsx   # Credit application list
│   ├── CreditApplicationDetail.tsx # Credit application detail (multi-tab)
│   ├── MyApprovals.tsx             # Credit approval queue
│   ├── FinancialSpreading.tsx      # Financial statement spreading
│   ├── FinancialAnalysis.tsx       # Financial analysis
│   ├── ScorecardManagement.tsx     # Credit scorecard management
│   ├── CommitteeMeetings.tsx       # Credit committee meetings
│   ├── CollateralManagement.tsx    # Collateral registry
│   ├── CreditReports.tsx           # Credit reporting
│   └── [22 credit tab components]  # AccountConductTab, ApprovalsTab, AuditTab, CollateralTab,
│                                   # ConditionsTab, CounterpartiesTab, CreditChecksTab,
│                                   # DocumentsTab, EsgTab, FacilitiesTab, HeaderBackgroundTab,
│                                   # IndustryOutlookTab, PartiesTab, PaymentCapabilityTab,
│                                   # ProfitabilityWalletTab, RequestsFacilitiesTab,
│                                   # RiskMitigatorsTab, RiskRatingEclTab, SecurityGuaranteesTab,
│                                   # SicrTab, SignoffTab, SummaryTab
├── src/
│   ├── pages/
│   │   ├── Login.tsx               # Login page
│   │   ├── Register.tsx            # Registration page
│   │   ├── ForgotPassword.tsx      # Forgot password — request reset email
│   │   ├── ResetPassword.tsx       # Reset password — consume token from email link
│   │   └── ChangePassword.tsx      # Change password — authenticated users
│   ├── context/
│   │   ├── AuthContext.tsx          # Auth state, login/logout, token refresh
│   │   ├── NotificationContext.tsx  # SSE notifications, toast state
│   │   ├── ToastContext.tsx         # Global toast notifications
│   │   └── ThemeContext.tsx         # Dark mode (light/dark/system), localStorage persist
│   ├── components/
│   │   ├── ProtectedRoute.tsx       # Auth + permission guard
│   │   ├── ErrorBoundary.tsx        # Error boundary wrapper
│   │   ├── FormBuilder.tsx          # JSON-configured dynamic forms
│   │   ├── NotificationDropdown.tsx # Live notification feed
│   │   ├── OnboardingDashboard.tsx  # Onboarding progress tracker
│   │   ├── OffboardingDashboard.tsx # Offboarding progress tracker
│   │   ├── ToastContainer.tsx       # Toast notification renderer
│   │   ├── Breadcrumbs.tsx          # Context-aware breadcrumb navigation
│   │   ├── EntityApprovalsPanel.tsx # Entity-based approval routing panel
│   │   ├── withErrorBoundary.tsx    # HOC for error boundary wrapping
│   │   ├── ErrorFallback.tsx        # Error fallback UI component
│   │   ├── ModalPortal.tsx          # Portal for modal rendering outside DOM hierarchy
│   │   ├── ModalWrapper.tsx         # Reusable modal wrapper with backdrop
│   │   ├── SkeletonCategoryCard.tsx # Loading skeleton for category cards
│   │   ├── SkeletonRow.tsx          # Loading skeleton for table rows
│   │   ├── RichTextEditor.tsx       # Rich text editor component
│   │   ├── SessionExpiryBanner.tsx  # Session expiry warning banner
│   │   ├── EmptyState.tsx           # Generic empty state component
│   │   ├── NavMoreDropdown.tsx      # Navigation overflow dropdown
│   │   ├── CrmNav.tsx               # CRM module navigation bar
│   │   ├── CreditNav.tsx            # Credit assessment navigation bar
│   │   ├── CollapsibleKanbanColumn.tsx # Collapsible column for Kanban boards
│   │   ├── ui/                      # 16 design-system primitives (Button, Card, Tabs, Drawer,
│   │   │                            #   Modal, Combobox, Tooltip, Skeleton, StateBadge, RiskBadge,
│   │   │                            #   AutosaveTextField, EmptyState, EnvironmentBanner,
│   │   │                            #   OutOfOfficeModal, PolicyExplainer, index.ts)
│   │   ├── admin/                   # 21 admin setting components (12 tabs + 11 modals + 3 utils)
│   │   ├── request/                 # Request header, form fields, hiring panel, approval actions
│   │   ├── request/modals/          # 9 HR workflow modals (CEO, Manager, Rejection, Resolution, Interview, LOA, Onboarding)
│   │   ├── request-detail/          # 38 request detail components: WorkflowCockpit, WorkflowStepper,
│   │   │                            #   DecisionPanel, ActivityFeed, SLAIndicator, CustomFieldsPanel,
│   │   │                            #   ApprovalChain, ParticipantsSection, AssignAgentModal,
│   │   │                            #   WorkflowActionModal, + 28 workflow modals for IT/HR/Finance/Chargeback
│   │   └── create-request/          # WizardStepper, useCreateRequestWizard
│   ├── services/                   # 28 API service files — auth, request, admin, approval,
│   │                               #   asset, announcement, crm, interview, it-workflow,
│   │                               #   finance-workflow, chargeback-workflow, loa, screening,
│   │                               #   notification, kb, search, reports, serviceDesk, workflow,
│   │                               #   entity, bannerConfig, requestStatus, auditLog,
│   │                               #   credit, insights, scheduler, sentry (error monitoring), api
│   ├── hooks/
│   │   ├── useBannerConfigs.ts     # Dashboard banner config hook
│   │   ├── useModalDismiss.ts      # Modal click-outside dismiss
│   │   ├── useFocusTrap.ts         # Accessibility focus trap hook
│   │   ├── useEscapeKey.ts         # Escape key handler hook
│   │   ├── useAutosave.ts          # Autosave with debounce hook
│   │   ├── useCrmAi.ts             # CRM AI features hook
│   │   ├── useDebouncedValue.ts    # Debounce utility hook
│   │   ├── useIdleSession.ts       # Idle session detection hook
│   │   └── useScrollLock.ts        # Body scroll lock hook
│   ├── utils/
│   │   ├── permissions.ts          # RBAC permission checks
│   │   ├── roleDetection.ts        # User role detection
│   │   ├── tokenManager.ts         # JWT token management
│   │   ├── workflowActions.ts      # Workflow action definitions
│   │   ├── workflowTransitions.ts  # Valid status transition map
│   │   ├── workflowModalConfig.ts  # Modal configuration for workflow actions
│   │   └── errorMessages.ts        # Centralized error message mapping
│   └── styles/                     # CSS styles with dark mode custom properties
└── package.json
```

### 5.3 Technology Stack

| Layer             | Technology                       | Version              |
|-------------------|----------------------------------|----------------------|
| Framework         | React                            | ^19.2.3              |
| Language          | TypeScript                       | ~5.8.2               |
| Build Tool        | Vite                             | ^6.2.0               |
| Routing           | React Router DOM                 | ^7.12.0              |
| HTTP Client       | Axios                            | ^1.13.2              |
| CSS Framework     | TailwindCSS                      | ^4.2.2               |
| Drag & Drop       | @dnd-kit/core + sortable         | ^6.3.1 / ^10.0.0     |
| Markdown          | react-markdown                   | ^10.1.0              |
| Sanitization      | DOMPurify                        | ^3.4.0               |
| Forms Plugin      | @tailwindcss/forms               | ^0.5.11              |
| Error Monitoring  | @sentry/react                    | ^10.50.0             |
| i18n              | i18next                          | ^26.0.8              |
| Accessibility     | focus-trap-react                 | ^12.0.1              |

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
│  │  helmet → cookieParser → cors → json → compression       │ │
│  │  → morgan → rateLimit → authenticate/authorize            │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                    Routes (37 files + index)               │ │
│  │  /auth /users /requests /service-desks /notifications    │ │
│  │  /kb /search /approvals /interviews /screening /loa       │ │
│  │  /onboarding /offboarding /it-workflow /finance-workflow  │ │
│  │  /chargeback-workflow /reports /files /sla /assets        │ │
│  │  /announcements /crm /system-settings                     │ │
│  │  /insights /policyExplainer /scheduler                    │ │
│  │  /admin/* (entities, workflows, templates, configs)       │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                    Controllers (38 files)                  │ │
│  │  Auth, User, Request, Resume, ServiceDesk, Notification, │ │
│  │  KB, Search, Approval, Interview, Screening, LOA,         │ │
│  │  Onboarding, Offboarding, ITWorkflow, FinanceWorkflow,    │ │
│  │  ChargebackWorkflow, Reports, Entity, BannerConfig,       │ │
│  │  EscalationRule, WorkflowTransition, NotificationTemplate,│ │
│  │  Asset, File, Workflow, RequestStatusDef, SystemSetting,  │ │
│  │  OnboardingTemplate, OffboardingTemplate, AuditLog,       │ │
│  │  Announcement, CRM, CrmAI, Insights, PolicyExplainer,    │ │
│  │  Participant, Scheduler                                   │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                   Services (20 files)                    │ │
│  │  email, entityRouting, notification, onboarding,          │ │
│  │  password-reset, permission, s3, sla, sla-pause, token,  │ │
│  │  serviceDesk, autoAssignment, announcement,               │ │
│  │  crm, crm-automation, crm-reports, crm-ai,               │ │
│  │  insights, policyExplainer, scheduler                     │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                             │                                 │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │                  Data Layer (Prisma ORM)                  │ │
│  │  PostgreSQL — 121 models, 58 enums, 94 RequestStatus values│ │
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
│   ├── controllers/                # 38 controller files
│   ├── routes/                     # 37 route files + index.ts
│   ├── services/                   # 20 business logic services
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT auth, role/permission authorization, SSE auth
│   │   ├── error.middleware.ts      # Centralized error handler
│   │   ├── notFound.middleware.ts   # 404 handler
│   │   ├── rateLimit.middleware.ts  # API rate limiting (express-rate-limit + Redis)
│   │   ├── upload.middleware.ts     # Multer file upload (S3 or local)
│   │   └── validate.middleware.ts   # Request body validation (Zod)
│   ├── validators/                 # Zod schemas (auth, request, user, serviceDesk)
│   ├── templates/
│   │   └── email-layout.ts         # HTML email layout template
│   ├── jobs/
│   │   └── sla-checker.ts          # Cron-based SLA breach detection
│   └── utils/
│       └── logger.ts               # Winston logger
├── prisma/
│   ├── schema.prisma               # 121 models, 58 enums
│   ├── migrations/                 # Database migrations
│   ├── seed.ts                     # Database seeding (users, roles, permissions, service desks)
│   ├── seed-admin-config.ts        # Admin configuration seed data
│   ├── seed-workflows.ts           # Workflow type/step seed data (incl. slaPause flags)
│   ├── seed-workflow-transitions.sql # Transition SQL seed
│   ├── assign-imported-assets.ts   # Asset import/assignment utility
│   └── import-devices.ts           # Device Excel/CSV import utility
├── uploads/                        # Local file uploads (dev mode)
├── Dockerfile                      # Production Docker image
└── package.json
```

### 6.3 Technology Stack

| Layer         | Technology                          | Version              |
|---------------|-------------------------------------|----------------------|
| Runtime       | Node.js                             | ≥20.0.0              |
| Framework     | Express.js                          | ^4.21.2              |
| Language      | TypeScript                          | ^5.8.2               |
| ORM           | Prisma Client                       | ^5.22.0              |
| Database      | PostgreSQL                          | 15                   |
| Cache/Queue   | Redis (ioredis)                     | ^5.10.1              |
| Auth          | jsonwebtoken + bcryptjs             | ^9.0.2 / ^2.4.3      |
| Validation    | Zod + Joi                           | ^3.24.1 / ^17.13.3   |
| File Storage  | AWS S3 (@aws-sdk) / local           | ^3.1034.0            |
| Email         | Resend                              | ^6.12.2              |
| Logging       | Winston + Morgan                    | ^3.17.0 / ^1.10.0    |
| Security      | Helmet + CORS + express-rate-limit  | ^8.0.0 / ^2.8.5 / ^7.5.0 |
| Cron          | node-cron                           | ^4.2.1               |
| Upload        | Multer + multer-s3                  | ^1.4.5 / ^3.0.1      |
| Testing       | Jest + Supertest                    | ^29.7.0 / ^7.2.2     |

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
│    ├── AuditLog                                               │
│    ├── createdAssets (Asset[])                                │
│    ├── assetAssignments (AssetAssignment[])                   │
│    └── assetAssignedBy (AssetAssignment[])                    │
│                                                               │
│  ServiceDesk ──< ServiceCategory ──< RequestType             │
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
│    │      ── sourceAssets (Asset[])                           │
│    │      ── assetAssignments (AssetAssignment[])             │
│    └──< Request (parent/child self-relation)                  │
│                                                               │
│  Entity ──< User (user belongs to entity)                     │
│          ── RequestTypeEntityRouting                          │
│                                                               │
│  WorkflowType ──< WorkflowStep (incl. slaPause flags)         │
│  WorkflowTransition (from/to status pairs)                    │
│                                                               │
│  Asset ──< AssetAssignment (assignment tracking)              │
│    │      ──< ITHardwareRequest (procurement linkage)         │
│    └── sourceRequest (Request, optional)                      │
│                                                               │
│  AssetAssignment ── User (assignee, assigner)                 │
│    │            ── linkedRequest (Request, optional)           │
│    └── Asset                                                  │
│                                                               │
│  EscalationRule (per RequestType)                             │
│  BannerConfig (role + status based)                           │
│  RequestStatusDefinition                                      │
│  NotificationTemplate                                         │
│  OnboardingTaskTemplate                                       │
│  OffboardingTaskTemplate                                      │
│                                                               │
│  Announcement ──< AnnouncementRead (per-user read tracking)   │
│                                                               │
│  CrmAccount ──< CrmContact ──< CrmLead                        │
│    │         ──< CrmOpportunity                               │
│    │         ──< CrmActivity                                  │
│    │         ──< CrmNote                                      │
│    │         ──< CrmAccountRequest                            │
│    └─────────── CrmTrustProduct                               │
│                                                               │
│  CrmContact ──< CrmBeneficiary                                │
│            ── CrmKycRecord (one-to-one)                       │
│                                                               │
│  CrmPipeline ──< CrmPipelineStage ──< CrmOpportunity          │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. API Documentation

### 7.1 API Overview

**Base URL:** `/api/v1`
**Authentication:** JWT via httpOnly cookies (access_token) or Authorization: Bearer header
**Rate Limiting:** 2000 requests per 15-minute window for general API (configurable)

### 7.2 Route Summary

| Route Prefix                      | Controller                      | Auth      | Description |
|-----------------------------------|---------------------------------|-----------|-------------|
| `/auth`                           | auth.controller                 | Public    | Login, register, refresh token, logout, forgot/reset password |
| `/users`                          | user.controller                 | Protected | User CRUD, profile, manager hierarchy |
| `/requests`                       | request.controller              | Protected | Request CRUD, status transitions, activity, attachments, resume upload/list/delete |
| `/service-desks`                  | serviceDesk.controller          | Protected | Service desk/category/type listing |
| `/notifications`                  | notification.controller         | Protected | Notification list, mark read, SSE stream |
| `/notifications/sse`             | notificationSse.routes            | Protected | SSE notification stream (EventSource endpoint) |
| `/kb`                             | kb.controller                   | Protected | Knowledge base article CRUD, search, voting |
| `/search`                         | search.controller               | Protected | Global search (requests + KB articles) |
| `/approvals`                      | approval.controller             | Protected | Multi-level approval actions |
| `/interviews`                     | interview.controller            | Protected | Interview schedule/feedback CRUD |
| `/screening`                      | screening.controller            | Protected | HR screening CRUD |
| `/loa`                            | loa.controller                  | Protected | Letter of acceptance upload/approval |
| `/onboarding`                     | onboarding.controller           | Protected | Onboarding request/task management |
| `/offboarding`                    | offboarding.controller          | Protected | Offboarding request/task management |
| `/it-workflow`                    | it-workflow.controller          | Protected | IT hardware workflow transitions |
| `/finance-workflow`               | finance-workflow.controller     | Protected | Finance workflow transitions |
| `/chargeback-workflow`            | chargeback-workflow.controller  | Protected | Inter-company chargeback transitions |
| `/reports`                        | reports.controller              | Protected | Analytics and reporting data |
| `/files`                          | file.controller                 | Protected | File upload/download |
| `/assets`                         | asset.controller                | Protected (asset:read/write/import/delete) | IT asset CRUD, assignment/return, active assignments list, per-user assignment view, CSV import/export |
| `/sla`                            | escalationRule.controller       | Protected | SLA escalation rule management |
| `/admin/entities`                 | entity.controller               | Admin     | Entity CRUD |
| `/admin/workflows`                | workflow.controller             | Admin     | Workflow type/step management |
| `/admin/banner-configs`           | bannerConfig.controller         | Admin     | Banner configuration |
| `/admin/status-definitions`       | requestStatusDef.controller     | Admin     | Status definition CRUD |
| `/admin/workflow-transitions`     | workflowTransition.controller   | Admin     | Transition rule management |
| `/admin/notification-templates`   | notificationTemplate.controller | Admin     | Email template management |
| `/admin/onboarding-templates`     | onboardingTemplate.controller   | Admin     | Onboarding task templates |
| `/admin/offboarding-templates`    | offboardingTemplate.controller  | Admin     | Offboarding task templates |
| `/admin/audit-logs`               | auditLog.controller             | Admin     | Audit log viewer |
| `/system-settings`                | systemSetting.controller        | Admin     | Global system settings — enable/disable email notifications globally with cache invalidation |
| `/announcements`                  | announcement.controller         | Protected | Announcement CRUD, publish/pin/unpin, mark-read, unread count, dashboard feed, admin list, PDF/DOCX parse, image upload |
| `/crm`                            | crm.controller                  | Protected (crm:read/write/delete/admin) | Full CRM — Accounts, Contacts, Leads, Opportunities, Pipelines, Activities, Notes, Trust Products, KYC, Beneficiaries, Dashboard, Reports, Team Performance, Global Search |

### 7.3 Health Check

```
GET /health
Response: { status: "ok", timestamp, uptime, environment }
```

---

## 8. Security & Privacy

### 8.1 Authentication System

| Component               | Implementation |
|-------------------------|----------------|
| **Password Hashing**    | bcryptjs (salt rounds: 10) |
| **JWT Access Token**    | 15-minute TTL, httpOnly cookie, jti claim for revocation |
| **JWT Refresh Token**   | 30-day TTL, httpOnly cookie, separate secret |
| **Token Revocation**    | Redis blocklist (jti-based); user-level revocation on password change |
| **Session Management**  | Database-backed sessions with IP and user agent tracking |
| **SSE Authentication**  | Query parameter token (?token=) since EventSource cannot send cookies |

### 8.2 Authorization

| Layer                    | Mechanism |
|--------------------------|-----------|
| **Role-Based (RBAC)**    | User → UserRole → Role mapping; `authorize('ADMIN', 'AGENT')` middleware |
| **Permission-Based**     | Role → RolePermission → Permission; `requirePermission('report:read')` middleware |
| **Frontend Guards**      | `ProtectedRoute` component with `requirePermission` prop; `hasPermission()` / `hasAnyRole()` utilities |
| **Admin Bypass**         | ADMIN role has unconditional access to all permissions |

### 8.3 Security Middleware

| Middleware           | Protection |
|----------------------|------------|
| **Helmet**           | Security headers (CSP, HSTS, X-Frame-Options, etc.) |
| **CORS**             | Configurable origin whitelist with credentials support |
| **Rate Limiting**    | express-rate-limit with Redis store; 100 req/15min default |
| **Input Validation** | Zod + Joi schema validation middleware |
| **Cookie Security**  | httpOnly, secure (production), sameSite: lax |
| **Body Size Limit**  | 10MB JSON/URL-encoded body limit |
| **Compression**      | gzip compression for responses |
| **SQL Injection**    | Prevented by Prisma parameterized queries |
| **XSS**              | DOMPurify sanitization on frontend; Helmet CSP headers |

---

## 9. Workflow Engine

### 9.1 Overview

CWC uses a database-driven workflow engine with configurable status transitions. The `WorkflowTransition` table defines valid `fromStatus → toStatus` pairs with metadata (label, requires comment, auto-assign rules).

### 9.2 Status Enum (94 statuses)

```
General (9): SUBMITTED, IN_REVIEW, ACTION_REQUIRED, APPROVED, REJECTED,
  RESOLVED, IN_PROGRESS, WAITING, COMPLETED

CEO (3): PENDING_CEO_APPROVAL, CEO_APPROVED, CEO_REJECTED

HR Hiring (11): JOB_POSTED, PENDING_MANAGER_REVIEW, MANAGER_APPROVED,
  INTERVIEW_SCHEDULED, INTERVIEW_FEEDBACK_PENDING, CANDIDATE_REJECTED_INTERVIEW,
  HR_SCREENING, LOA_PENDING_APPROVAL, LOA_APPROVED, LOA_ISSUED, LOA_ACCEPTED

Onboarding (10): ONBOARDING_SUBMITTED, ONBOARDING_PENDING_HR_APPROVAL,
  ONBOARDING_PRE_ARRIVAL_SETUP, ONBOARDING_READY_FOR_DAY_1,
  ONBOARDING_DAY_1_ORIENTATION, ONBOARDING_WEEK_1_INTEGRATION,
  ONBOARDING_MONTH_1_MILESTONE, ONBOARDING_MONTH_2_MILESTONE,
  ONBOARDING_MONTH_3_MILESTONE, ONBOARDING_COMPLETED

Offboarding (6): OFFBOARDING_SUBMITTED, OFFBOARDING_NOTICE_PERIOD,
  OFFBOARDING_KNOWLEDGE_TRANSFER, OFFBOARDING_FINAL_WEEK,
  OFFBOARDING_EXIT_PROCEDURES, OFFBOARDING_COMPLETED

IT Workflow (24): PENDING_MANAGER_APPROVAL_IT, MANAGER_APPROVED_IT,
  MANAGER_REJECTED_IT, PENDING_VP_APPROVAL_IT, VP_APPROVED_IT,
  VP_REJECTED_IT, PROCUREMENT_IN_PROGRESS, HARDWARE_ORDERED,
  HARDWARE_RECEIVED, SOFTWARE_PROVISIONED, ACKNOWLEDGED_IT,
  PENDING_CEO_APPROVAL_IT, CEO_APPROVED_IT, CEO_REJECTED_IT,
  PENDING_CTO_APPROVAL_IT, CTO_APPROVED_IT, CTO_REJECTED_IT,
  PENDING_INVOICE_IT, PENDING_CFO_APPROVAL_IT, CFO_APPROVED_IT,
  CFO_REJECTED_IT, PAYMENT_PROCESSING_IT, PAYMENT_DONE_IT,
  PENDING_DELIVERY_IT

Finance Reimbursement (9): PENDING_MANAGER_APPROVAL_FIN,
  MANAGER_APPROVED_FIN, MANAGER_REJECTED_FIN,
  PENDING_FINANCE_HEAD_APPROVAL, FINANCE_HEAD_APPROVED,
  FINANCE_HEAD_REJECTED, PAYMENT_PROCESSING, PAYMENT_COMPLETED,
  REIMBURSEMENT_CLOSED

Finance Purchase (13): FINANCE_PENDING_ACK, FINANCE_ACKNOWLEDGED,
  FINANCE_IN_PROGRESS, PENDING_CFO_APPROVAL_FIN, CFO_APPROVED_FIN,
  CFO_REJECTED_FIN, PENDING_GROUP_CEO_APPROVAL, GROUP_CEO_APPROVED,
  GROUP_CEO_REJECTED, PAYMENT_PROCESSING_FIN,
  AWAITING_PAYMENT_CONFIRMATION, PAYMENT_CONFIRMED_FIN, TICKET_CLOSED_FIN

Chargeback (9): PENDING_FROM_ENTITY_APPROVAL, FROM_ENTITY_APPROVED,
  FROM_ENTITY_REJECTED, PENDING_TO_ENTITY_APPROVAL, TO_ENTITY_APPROVED,
  TO_ENTITY_REJECTED, CHARGEBACK_FINANCE_REVIEW,
  AWAITING_CHARGEBACK_CONFIRMATION, CHARGEBACK_COMPLETED
```

### 9.3 SLA Engine

| Component              | Details |
|------------------------|---------|
| **SLA Hours**          | Configured per RequestType (`slaHours` field) |
| **SLA Clock**          | Starts at request creation (`slaDueAt = createdAt + slaHours`) |
| **SLA Pause**          | Certain statuses pause SLA (tracked via `slaPausedAt` + `slaPauseDurationMs`); 14 statuses have `slaPause=true` in WorkflowStep seed data |
| **SLA Pause Service**  | `sla-pause.service.ts` — `isPauseStatus()` checks WorkflowStep.slaPause (Redis-cached 5min TTL); `pauseSla()` / `resumeSla()` called on status transitions |
| **Stale Pause Check**  | `checkStalePauses()` auto-resumes pauses older than 14 days (configurable via `SLA_MAX_PAUSE_DAYS` env var) |
| **SLA Checker**        | Background cron job (`sla-checker.ts`); configurable interval or cron expression |
| **Escalation Rules**   | Per-RequestType rules: trigger N hours after breach, notify specified roles |
| **Schedule Modes**     | `interval` (every N ms) or `cron` (Mon-Fri 9am default) |

**SLA Pause Statuses (14):** PENDING_CEO_APPROVAL_IT, PENDING_CTO_APPROVAL_IT,
PENDING_CFO_APPROVAL_IT, PENDING_CEO_APPROVAL, PENDING_MANAGER_REVIEW,
LOA_PENDING_APPROVAL, PENDING_CFO_APPROVAL_FIN, PENDING_GROUP_CEO_APPROVAL,
PENDING_FROM_ENTITY_APPROVAL, PENDING_TO_ENTITY_APPROVAL,
CHARGEBACK_FINANCE_REVIEW, ONBOARDING_PENDING_HR_APPROVAL,
PENDING_MANAGER_APPROVAL_FIN, PENDING_FINANCE_HEAD_APPROVAL

### 9.4 Entity-Based Approval Routing

For workflows requiring entity approval (e.g., inter-company chargebacks):

1. **Entity Model** — Organizations with designated approvers
2. **RequestTypeEntityRouting** — Maps request types to entity routing modes
3. **Routing Modes:**
   - `REQUESTER_ENTITY` — Route to the requester's assigned entity approver
   - `CUSTOM_FIELD` — Route based on a custom field value (e.g., target entity selection)
4. **EntityRoutingService** — Resolves the correct entity and approver at runtime

### 9.5 Executive Approval Routing

The `PENDING_APPROVAL_STATUSES` map in `request.controller.ts` controls which request statuses appear in each executive role's "Pending Approvals" dashboard:

```
PENDING_APPROVAL_STATUSES = {
    CEO:       ['PENDING_CEO_APPROVAL', 'PENDING_CEO_APPROVAL_IT', 'PENDING_CEO_APPROVAL_FIN'],
    CTO:       ['PENDING_CTO_APPROVAL_IT'],
    CFO:       ['PENDING_CFO_APPROVAL_IT', 'PENDING_CFO_APPROVAL_FIN', 'PENDING_FINANCE_HEAD_APPROVAL'],
    GROUP_CEO: ['PENDING_GROUP_CEO_APPROVAL'],
    VP:        [],
    HR:        ['LOA_PENDING_APPROVAL', 'ONBOARDING_PENDING_HR_APPROVAL'],
}
```

Users with a role matching a key see all requests in the mapped statuses in their Approvals tab (requires `request:approve` permission).

### 9.6 IT Asset Management

CWC integrates a full IT Asset Management module linked to the procurement workflow:

1. **Asset Model** — Tracks hardware/software assets with tag, serial number, category (9 types), status lifecycle (9 statuses: IN_STOCK → ASSIGNED → RESERVED → PENDING_RETURN → IN_REPAIR → RETIRED → LOST → STOLEN → DISPOSED)
2. **AssetAssignment Model** — Records who an asset is assigned to, when, by whom, and linked to which request; supports return with selectable post-return status
3. **ITHardwareRequest Linkage** — Procurement requests can generate assets via `assetId`, `assetTag`, `serialNumber`, `procurementStatus`, `orderNumber`, `trackingNumber` fields; `serialNumber` and `assetTag` are captured in `HardwareReceivedModal` and persisted to the `ITHardwareRequest` table
4. **API Endpoints:**
   - `GET /assets` — list with pagination, filters (status, category, search)
   - `GET /assets/:id` — full asset detail with assignment history
   - `POST /assets` — create asset
   - `PATCH /assets/:id` — update asset
   - `DELETE /assets/:id` — soft-delete (marks DISPOSED)
   - `POST /assets/:id/assign` — assign to user (with optional reason and linked request)
   - `POST /assets/:id/return` — return asset (with selectable post-return status)
   - `GET /assets/assignments` — list all active assignments grouped by user (paginated, searchable)
   - `GET /assets/by-user/:userId` — active assignments for a specific user
   - `GET /assets/export` — CSV export with status/category/search filters
   - `POST /assets/import` — bulk CSV import with duplicate checking and optional user assignment via email lookup
5. **Permissions** — `asset:read`, `asset:write`, `asset:import`, `asset:delete`
6. **Frontend** — `AssetManagement.tsx` page with two tabs:
   - **Asset Registry tab** — search/filter by name/tag/serial/brand/model/employee, category/status filters, CSV export, CSV import modal with template guidance, asset detail drawer (edit, assign/reassign/return, assignment history timeline)
   - **Employee Assets tab** — employees with active assignments grouped by user, live search by name/email, expandable rows showing asset details, bulk return support
7. **Database Utilities** — `backend/prisma/import-devices.ts` (Excel/XLSX bulk import from Device_Inventory.xlsx, supports Laptops/Desktops and Printers sheets, dry-run mode), `backend/prisma/assign-imported-assets.ts` (bulk employee-to-asset assignment from employee list, dry-run mode)

### 9.7 CRM Module

The CRM module is a standalone business development platform with 4-tier permission system (`crm:read`, `crm:write`, `crm:delete`, `crm:admin`).

#### CRM Entities

| Entity              | Description |
|---------------------|-------------|
| **CrmAccount**      | External company/organization with industry, size, Malaysian registration & tax numbers, bank account, trust product flag, annual revenue |
| **CrmContact**      | Person at an account with NRIC/Passport, PDPA consent date, marketing opt-in, risk profile |
| **CrmLead**         | Prospective customer with status pipeline (NEW → CONTACTED → QUALIFIED → UNQUALIFIED → CONVERTED/LOST), source tracking, follow-up date, stale detection |
| **CrmOpportunity**  | Sales opportunity with value (MYR), expected close date, stage (pipeline-driven), won/lost timestamps |
| **CrmPipeline**     | Configurable sales pipeline with ordered stages; supports isWonStage/isLostStage flags |
| **CrmActivity**     | Interaction log — types: CALL, EMAIL, MEETING, NOTE, TASK, FOLLOW_UP, WHATSAPP, SITE_VISIT |
| **CrmNote**         | Free-text notes attached to accounts, contacts, or opportunities |
| **CrmTrustProduct** | Trust/investment product linked to an account |
| **CrmKycRecord**    | KYC compliance record per contact (one-to-one); admin-approvable |
| **CrmBeneficiary**  | Beneficiary records linked to a contact |

#### CRM API Permissions

| Permission   | Access Level |
|--------------|-------------|
| `crm:read`   | View all CRM data, reports, pipeline |
| `crm:write`  | Create/update accounts, contacts, leads, opportunities, activities, notes, trust products, KYC |
| `crm:delete` | Delete CRM records |
| `crm:admin`  | Create/update pipelines, approve KYC, view team performance dashboard |

#### CRM Automation Service (`crm-automation.service.ts`)

Background automation functions run by the CRM automation job:

| Function                   | Trigger                                | Action |
|----------------------------|----------------------------------------|--------|
| `notifyStaleDealOwners`    | Opportunities with no activity for N days | Sends `crm_stale_deal` notification to owner |
| `notifyTrustReviewDue`     | Trust products with upcoming review date | Sends `crm_trust_review_due` notification |
| `autoAssignLeads`          | New unassigned leads                   | Assigns to available agent; fires `crm_lead_auto_assigned` notification |
| `checkKycExpiry`           | KYC records approaching expiry         | Sends expiry warning notifications |
| `checkFollowUpsDue`        | Leads with follow-up date = today      | Sends follow-up reminder notifications |

#### CRM Reports (7 types)

| Report                    | Endpoint |
|---------------------------|----------|
| Lead Conversion           | `GET /crm/reports/lead-conversion` |
| Sales Performance         | `GET /crm/reports/sales-performance` |
| Pipeline Forecast         | `GET /crm/reports/pipeline-forecast` |
| Activity Summary          | `GET /crm/reports/activity-summary` |
| Lead Aging                | `GET /crm/reports/lead-aging` |
| Win/Loss Analysis         | `GET /crm/reports/win-loss` |
| KYC Compliance            | `GET /crm/reports/kyc-compliance` |

### 9.8 Announcement Board

Staff announcement and newsletter system for internal communications.

#### Announcement Model

| Field            | Description |
|------------------|-------------|
| `title`          | Announcement headline |
| `content`        | Rich text (HTML) body |
| `excerpt`        | Short preview text (auto or manual) |
| `category`       | Enum: GENERAL, HR, IT, FINANCE, COMPANY_NEWS, POLICY, EVENT |
| `priority`       | Enum: LOW, MEDIUM, HIGH, CRITICAL |
| `targetAudience` | Role-based audience filter (default: ALL) |
| `isPinned`       | Pinned announcements shown first in widget |
| `isPublished`    | Draft (false) vs live (true) |
| `publishedAt`    | Timestamp set when transitioning to published |
| `expiresAt`      | Optional auto-expiry date |
| `attachmentUrl`  | S3 URL of uploaded PDF/DOCX document |

#### Announcement Permissions

| Permission              | Access |
|-------------------------|--------|
| (authenticated)         | Read published announcements, mark as read |
| `announcement:write`    | Create, edit, publish, pin, upload docs/images |
| `announcement:admin`    | Delete announcements |

#### API Endpoints

| Method | Endpoint                          | Description |
|--------|-----------------------------------|-------------|
| GET    | `/announcements`                  | List published, non-expired announcements |
| GET    | `/announcements/dashboard`        | Pinned + latest (for widget) |
| GET    | `/announcements/unread-count`     | Unread badge count |
| GET    | `/announcements/admin/all`        | All (incl. drafts) — requires `announcement:write` |
| GET    | `/announcements/:id`              | Single announcement |
| POST   | `/announcements`                  | Create (draft by default) |
| PATCH  | `/announcements/:id`              | Update |
| PATCH  | `/announcements/:id/publish`      | Publish (sets `publishedAt`) |
| PATCH  | `/announcements/:id/pin`          | Toggle pin |
| DELETE | `/announcements/:id`              | Delete — requires `announcement:admin` |
| POST   | `/announcements/:id/read`         | Mark as read (creates AnnouncementRead) |
| POST   | `/announcements/mark-all-read`    | Mark all as read |
| POST   | `/announcements/parse-doc`        | Upload PDF/DOCX, extract text |
| POST   | `/announcements/upload-image`     | Upload image for rich text |

### 9.9 Confidential Resume Handling

HR hiring requests support confidential resume management:

1. **Upload** — `POST /requests/:id/upload-resume` (S3-backed, only when status=JOB_POSTED)
2. **List** — `GET /requests/:id/resumes` (confidentiality check: non-requesters need ADMIN or `request:confidential` permission)
3. **Delete** — `DELETE /requests/:id/resumes/:resumeId` (only when status=JOB_POSTED)

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

| Environment     | Backend          | Database         | Redis            | Frontend         |
|-----------------|------------------|------------------|------------------|------------------|
| **Development** | localhost:3000   | localhost:5432   | localhost:6379   | localhost:5173   |
| **Production**  | Docker container :3000 | PostgreSQL container | Redis container | Nginx container :80 |

### 10.3 Required Environment Variables

| Variable                        | Required | Description |
|---------------------------------|----------|-------------|
| `DATABASE_URL`                  | Yes      | PostgreSQL connection string |
| `JWT_SECRET`                    | Yes      | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET`            | Yes      | Refresh token signing secret |
| `REDIS_URL`                     | No       | Redis connection (default: redis://localhost:6379) |
| `CORS_ORIGIN`                   | No       | Allowed origins (default: http://localhost:5173) |
| `PORT`                          | No       | Server port (default: 3000) |
| `NODE_ENV`                      | No       | Environment (development/test/production) |
| `RESEND_API_KEY`                | No       | Email sending via Resend |
| `S3_ENDPOINT`                   | No       | S3/MinIO storage endpoint |
| `S3_ACCESS_KEY`                 | No       | S3 access key |
| `S3_SECRET_KEY`                 | No       | S3 secret key |
| `S3_BUCKET`                     | No       | S3 bucket name |
| `HARDWARE_VP_APPROVAL_THRESHOLD`| No       | VP approval threshold (default: RM2,500) |
| `GROUP_CEO_APPROVAL_THRESHOLD`  | No       | Group CEO threshold (default: RM15,000) |
| `SLA_SCHEDULE_MODE`             | No       | SLA check mode: 'interval' or 'cron' |
| `SLA_CRON_EXPRESSION`           | No       | Cron expression (default: '0 9 * * 1-5') |

### 10.4 Database Management

| Command                      | Purpose |
|------------------------------|---------|
| `npm run prisma:generate`    | Generate Prisma Client |
| `npm run prisma:migrate`     | Run dev migrations |
| `npm run prisma:migrate:prod`| Deploy production migrations |
| `npm run prisma:seed`        | Seed database |
| `npm run prisma:reset`       | Reset database |
| `npm run prisma:studio`      | Open Prisma Studio GUI |

---

## 11. Monitoring & Logging

### 11.1 System Monitoring

| Component              | Tool                    | Details |
|------------------------|-------------------------|---------|
| **Request Logging**    | Morgan                  | Dev format (development), combined format (production) |
| **Application Logging**| Winston                 | JSON structured logging, configurable level |
| **Health Check**       | `/health` endpoint      | Database connectivity, uptime, environment |
| **SLA Monitoring**     | sla-checker.ts cron job | Breach detection and escalation |

### 11.2 Error Handling

| Layer               | Strategy |
|---------------------|----------|
| **Backend**         | Express `next(error)` chain → centralized error handler → structured JSON error responses |
| **Frontend**        | ErrorBoundary components wrapping critical routes (RequestDetail, AdminSettings) |
| **Background Jobs** | node-cron error handlers for SLA checker |

### 11.3 Audit Logging

| Event                    | Tracking |
|--------------------------|---------|
| All admin actions        | AuditLog table (userId, action, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent) |
| Status transitions       | RequestActivity entries (activityType: STATUS_CHANGE) |
| Login/logout             | Session creation/deletion |
| Configuration changes    | AuditLog with before/after snapshots |

---

## 12. Testing Strategy

### 12.1 Backend Testing

| Type                   | Framework          | Location |
|------------------------|--------------------|----------|
| **Unit Tests**         | Jest + ts-jest     | `backend/src/__tests__/`, `backend/src/services/__tests__/`, `backend/src/controllers/__tests__/`, `backend/src/utils/__tests__/` |
| **Integration Tests**  | Jest + supertest   | `backend/src/__tests__/`, `backend/src/controllers/__tests__/` |
| **Execution**          | `npm test` (single run) / `npm run test:watch` (watch) | — |
| **Coverage**           | `npm run test:coverage` | Jest Istanbul reports |

#### 12.1.1 Backend Test Coverage (11 suites, 121 unit/integration tests)

| Test Suite                        | Type        | Tests | Coverage Area |
|-----------------------------------|-------------|-------|---------------|
| `auth.test.ts`                    | Integration | 6     | Registration, login, token refresh (requires DB) |
| `request.test.ts`                 | Integration | 7     | CRUD + list + filter (requires DB) |
| `auth.integration.test.ts`        | Integration | 5     | Multi-browser session isolation (requires DB) |
| `token.service.test.ts`           | Unit        | 4     | JWT jti revocation, user revocation timestamps |
| `password-reset.service.test.ts`  | Unit        | 4     | Password reset token lifecycle |
| `sla-pause.service.test.ts`       | Unit        | 23    | SLA pause/resume, effective due date, Redis caching |
| `notification.service.test.ts`    | Unit        | 16    | notify(), notifyMultiple(), template rendering, SSE push, email send, variable merge |
| `sla.service.test.ts`             | Unit        | 14    | SLA breach detection, escalation rules, skip paused/terminal, error handling |
| `entityRouting.service.test.ts`   | Unit        | 15    | Entity routing (REQUESTER_ENTITY + CUSTOM_FIELD), dedup, inactive skip, approval resolution |
| `permission.service.test.ts`      | Unit        | 11    | getUserPermissions (Redis cache + DB fallback), hasPermission, checkPermission, cache invalidation |
| `sseClients.test.ts`              | Unit        | 16    | SSE client registry, Redis pub/sub adapter, addClient/removeClient, deliverLocal, pushToUser (local + Redis), broadcast, initSseRedis/disconnectSseRedis, disconnected client cleanup, multi-tab per user (`src/utils/__tests__/`) |

#### 12.1.2 Test Pattern

All service unit tests follow the same pattern:
- `jest.mock()` for external dependencies (Prisma, Redis, ioredis, logger) at module scope
- Inline mock objects (avoids `ReferenceError: Cannot access before initialization`)
- `beforeEach(() => jest.clearAllMocks())`
- No database required — all DB calls are mocked
- Integration tests use `supertest` against a real Express app with a seeded DB

### 12.2 Frontend Testing

| Type                       | Framework                           | Location |
|----------------------------|-------------------------------------|----------|
| **Unit/Component Tests**   | Vitest + @testing-library/react     | `frontend/src/**/*.test.{ts,tsx}` |
| **Execution**              | `npm test` (single run) / `npm run test:watch` (watch mode) | — |
| **Coverage**               | `npm run test:coverage`             | @vitest/coverage-v8 |

#### 12.2.1 Frontend Test Setup

| Item            | Details |
|-----------------|---------|
| **Config**      | `frontend/vitest.config.ts` — jsdom environment, globals enabled, React plugin |
| **Setup**       | `frontend/src/test/setup.ts` — imports `@testing-library/jest-dom` |
| **Path alias**  | `@` → project root (matches vite.config.ts) |
| **Smoke test**  | `frontend/src/App.test.tsx` — renders root without crashing |

#### 12.2.2 Frontend Test Coverage (8 suites, 91 tests)

| Test Suite                    | Type      | Tests | Coverage Area |
|-------------------------------|-----------|-------|---------------|
| `App.test.tsx`                | Smoke     | 1     | Root render without crash |
| `permissions.test.ts`         | Unit      | 23    | hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole (null user, ADMIN bypass, OR/AND logic, empty/undefined arrays) |
| `roleDetection.test.ts`       | Unit      | 28    | isHiringRequest, detectRequestRole (all 6 role paths: agent, ceo, cto, cfo, hiring_manager, staff; role precedence; exhaustive HIRING_STATUSES) |
| `workflowTransitions.test.ts` | Unit      | 12    | isValidTransition (valid/invalid/unknown), getValidNextStatuses (terminal states, non-terminal, COMPLETED→ONBOARDING_SUBMITTED, IN_REVIEW transitions) |
| `tokenManager.test.ts`        | Unit      | 6     | Deprecated token manager (getAccessToken→null, getRefreshToken→null, setTokens no-op, clearTokens no-op, isTokenExpired→false) |
| `ProtectedRoute.test.tsx`     | Component | 8     | Loading spinner, unauthenticated redirect, authenticated render, requireAdmin, requirePermission (string/array), permission mismatch redirect |
| `ErrorFallback.test.tsx`      | Component | 8     | Default title, custom title, error message display, fallback text, Try Again button, resetError click, showDetails toggle |
| `ToastContainer.test.tsx`    | Component | 5     | Empty state, success/error/warning/info toast rendering via ToastProvider |

### 12.3 CI/CD Test Gate

| Pipeline     | Step                    | Command |
|--------------|-------------------------|---------|
| **Backend**  | Lint → Build → Test     | `npm run lint` → `npm run build` → `npm test -- --forceExit` |
| **Frontend** | Build → Test            | `npm run build` → `npm test` |
| **Config**   | `.github/workflows/ci.yml` | Runs on push to main/develop and PRs to main |

### 12.4 Development Tools

| Tool              | Purpose |
|-------------------|---------|
| **ESLint**        | TypeScript linting (`npm run lint`) |
| **Prettier**      | Code formatting (`npm run format`) |
| **Prisma Studio** | Visual database browser |
| **tsx**           | TypeScript execution (dev server with watch mode) |

### 12.5 Default Test Users

| Role          | Email                 | Password    |
|---------------|-----------------------|-------------|
| **Admin**     | admin@test.local      | abc@123     |
| **Agent**     | it@test.local         | abc@123     |
| **HR**        | hr@test.local         | abc@123     |
| **CEO**       | ceo@test.local        | abc@123     |
| **End User**  | user@test.local       | abc@123     |
| **Group CEO** | groupceo@company.com  | groupceo123 |

---

## 13. Known Gaps & Backlog

### 13.1 Critical (P0)

| # | Component               | Impact                                            | Recommendation |
|---|-------------------------|---------------------------------------------------|----------------|
| 1 | **WAF**                 | Rate limiting + Helmet only; no WAF               | Cloudflare WAF or AWS WAF in front of API |
| 2 | **Secret Rotation**     | No rotation policy for JWT/DB secrets             | HashiCorp Vault or AWS Secrets Manager |
| 3 | **HTTPS Enforcement**   | No HTTP→HTTPS redirect in production              | Add redirect middleware or configure at reverse proxy |
| 4 | **Dependency Scanning** | No `npm audit` in CI                              | Add dependency scanning step |

### 13.2 Important (P1)

| #  | Component                   | Impact                                              | Recommendation |
|----|-----------------------------|-----------------------------------------------------|----------------|
| 5  | **Structured Logging**      | Console-based + Winston; no centralized log aggregation | ELK stack or CloudWatch |
| 6  | **APM**                     | No full APM dashboard                               | Prometheus + Grafana or Datadog |
| 7  | **Horizontal Scaling**      | Single-server Docker Compose deployment             | Kubernetes or Docker Swarm |
| 8  | **Database Read Replicas**  | Single PostgreSQL instance                          | Add read replica for reporting queries |
| 9  | **End-to-End Tests**        | No E2E test suite                                   | Playwright or Cypress for critical paths |
| 10 | **Load Testing**            | No load test suite                                  | k6 or Artillery scripts |
| 11 | ~~CI/CD Pipeline~~          | ~~No automated CI/CD yet~~                          | ✅ CI pipeline exists (lint + build + test gate); add deploy stage |
| 12 | ~~SSE Scaling~~             | ~~SSE notifications on single instance~~            | ✅ Redis pub/sub adapter implemented in `sseClients.ts` — horizontal SSE delivery via `cwc:sse:notify` channel |

### 13.3 Nice to Have (P2)

| #  | Component                    | Impact                                              | Recommendation |
|----|------------------------------|-----------------------------------------------------|----------------|
| 13 | **Admin 2FA**                | Admin accounts use same auth as users               | TOTP-based 2FA for admin accounts |
| 14 | **API Documentation**        | No Swagger/OpenAPI spec                             | Generate OpenAPI spec from route definitions |
| 15 | **Internationalization**     | ~~Error messages English only~~                     | ✅ i18next foundation integrated (v26.0.8); complete translations remaining |
| 16 | **Mobile App**               | Web-only portal                                     | React Native or PWA for mobile access |
| 17 | **Elasticsearch**            | Config exists but not integrated for search         | Full-text search via Elasticsearch |
| 18 | **File Virus Scan**          | Upload validates type/size only                     | ClamAV or VirusTotal scanning |
| 19 | **Canary Deployments**       | Rolling update only                                 | Blue-green or canary with traffic splitting |
| 20 | **Backup Strategy**          | No automated database backup cron                   | Scheduled pg_dump with offsite storage |

---

## Appendix A: Environment Variables Reference

See section 10.3 for required variables. Additional configuration:

| Variable                    | Default                                        | Description |
|-----------------------------|------------------------------------------------|-------------|
| `API_PREFIX`                | `/api/v1`                                      | API route prefix |
| `JWT_EXPIRES_IN`            | `15m`                                          | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN`    | `30d`                                          | Refresh token TTL |
| `COOKIE_SAME_SITE`          | `lax`                                          | Cookie SameSite attribute |
| `COOKIE_DOMAIN`             | —                                              | Cookie domain |
| `MAX_FILE_SIZE`             | `10485760`                                     | Max upload size (10MB) |
| `ALLOWED_FILE_TYPES`        | `image/jpeg,image/png,...,application/pdf`     | Allowed MIME types |
| `RATE_LIMIT_WINDOW_MS`      | `900000`                                       | Rate limit window (15min) |
| `RATE_LIMIT_MAX_REQUESTS`   | `100`                                          | Max requests per window |
| `LOG_LEVEL`                 | `debug`                                        | Winston log level |
| `APP_NAME`                  | `Enterprise Help Center`                       | Application name |
| `APP_URL`                   | `http://localhost:5173`                        | Frontend URL |
| `EMAIL_FROM`                | `Help Center <help@helpdesk.com>`              | Email sender address |
| `EMAIL_DEV_RECIPIENT`       | —                                              | Dev-only: redirect all emails |
| `CHECK_PASSWORD_BREACH`     | `false`                                        | Check password in breach databases |
| `PASSWORD_MIN_LENGTH`       | `8`                                            | Minimum password length |
| `SLA_CHECK_INTERVAL_MS`     | `60000`                                        | SLA checker interval (1min) |
| `SLA_MAX_PAUSE_DAYS`        | `14`                                           | Max days SLA can stay paused before auto-resume |

---

## Appendix B: Glossary

| Term                          | Definition |
|-------------------------------|------------|
| **CWC**                       | Citadel Workplace Connect — the internal service desk portal |
| **Service Desk**              | Top-level department grouping (IT, HR, Finance) |
| **Service Category**          | Sub-grouping within a service desk (e.g., "Email Management" under IT) |
| **Request Type**              | Specific service offering with form config and workflow (e.g., "New Hardware Request") |
| **Workflow Transition**       | Valid status change rule (from → to) with metadata |
| **SLA**                       | Service Level Agreement — target response/resolution time per request type |
| **Entity**                    | Organizational unit (e.g., subsidiary company) with designated approver |
| **Entity Routing**            | Mechanism to route approval requests to the correct entity approver |
| **Executive Role**            | CEO/CTO/CFO/COO/CHRO designation for high-value approval chains |
| **Onboarding**                | Multi-phase new hire integration process (PRE_ARRIVAL through 90-DAY) |
| **Offboarding**               | Structured employee departure process (NOTICE through EXIT) |
| **LOA**                       | Letter of Acceptance — formal job offer document in hiring workflow |
| **Chargeback**                | Inter-company billing transfer requiring dual-entity approval |
| **FormBuilder**               | Dynamic form renderer driven by JSON `formConfig` on RequestType |
| **SSE**                       | Server-Sent Events — used for real-time notification delivery |
| **RBAC**                      | Role-Based Access Control — User → Role → Permission authorization model |
| **Asset**                     | IT hardware/software item tracked in the asset registry with lifecycle status (IN_STOCK → ASSIGNED → ... → DISPOSED) |
| **AssetAssignment**           | Record linking an asset to a user with assignment/return timestamps and optional request linkage |
| **AssetCategory**             | Enum (9): LAPTOP, DESKTOP, MONITOR, PERIPHERAL, PHONE, NETWORK, PRINTER, SOFTWARE_LICENSE, OTHER |
| **AssetStatus**               | Enum (9): IN_STOCK, ASSIGNED, RESERVED, PENDING_RETURN, IN_REPAIR, RETIRED, LOST, STOLEN, DISPOSED |
| **SLA Pause**                 | Mechanism to pause SLA countdown during approval/pending statuses; auto-resumes after SLA_MAX_PAUSE_DAYS |
| **PENDING_APPROVAL_STATUSES** | Map of executive roles to request statuses they can approve; drives the Approvals tab visibility |
| **CRM**                       | Customer Relationship Management — module for managing external accounts, contacts, leads, and opportunities |
| **CrmAccount**                | External organization/company tracked in the CRM |
| **CrmContact**                | Individual person at a CRM account (with PDPA consent, NRIC/Passport, risk profile) |
| **CrmLead**                   | Prospective customer in the lead pipeline (NEW → CONVERTED/LOST) |
| **CrmOpportunity**            | Qualified sales deal in the pipeline with monetary value and close date |
| **CrmPipeline**               | Configurable ordered set of stages for tracking opportunities (Kanban) |
| **KYC**                       | Know Your Customer — compliance record per contact; includes identity verification and approval status |
| **PDPA**                      | Personal Data Protection Act — Malaysian data privacy regulation; consent tracking built into CrmContact |
| **Trust Product**             | Financial trust/investment product offered by the organization, tracked per CRM account |
| **Announcement**              | Internal staff communication published to the portal; can be pinned, categorized, and targeted by audience |
| **AnnouncementRead**          | Per-user read receipt for announcements; drives unread badge count |

---

*This document reflects Citadel Workplace Connect v2.2.0 as of 2026-05-25. Changes since v1.0: IT Asset Management module (CRUD, assign/return, active assignments list, Employee Assets tab, bulk CSV import/export, Excel device inventory import utility, PRINTER category, serialNumber+assetTag on ITHardwareRequest), ApprovalQueue page, SLA pause engine (14 statuses), dark mode (ThemeContext), Sentry error monitoring, executive approval routing (PENDING_APPROVAL_STATUSES), confidential resume handling, corrected RequestStatus enum (94 values), i18next foundation, notificationSse route, serviceDesk service, request-detail workflow modals (26+), accessibility hooks (useFocusTrap, useEscapeKey), password management pages (ForgotPassword, ResetPassword, ChangePassword), systemSetting controller + routes (global email toggle), autoAssignment service.*

**Doc sync (2026-05-05):** Updated RequestStatus count (76→94), controller count (31→30), route files (+notificationSse), service count (10→11, +serviceDesk), validator count (+serviceDesk), schema lines (1363→1364), Prisma data layer (76→94 statuses), backend test counts (112→121), frontend test counts (97→91), admin modals (6→11), request-detail components documented, STATUS_CONFIG count (76+→94), workflow modals (15→26+), FSD modal description (9→26+ with directory split), added hooks (useFocusTrap, useEscapeKey), added notificationSSE route, corrected individual test per-suite counts.

**Doc sync (2026-05-08):** Corrected controller count (30→31, +systemSetting), service count (11→12, +autoAssignment), route count (30→31, +systemSetting), admin tab count (13→12, Role Assignment is modal not a tab); added /forgot-password, /reset-password/:token, /change-password to navigation structure; added ForgotPassword/ResetPassword/ChangePassword to frontend module structure; added /system-settings to API route table and backend architecture diagrams.

**Doc sync (2026-05-25):** Added Credit Assessment module (12 main pages + 22 tab components, 12 `/credit/*` routes, credit.service.ts frontend service); added UnifiedInbox page (`/inbox`); added Insights page (`/insights`, `report:read`); added AuditTrail standalone page (`/admin/audit`); renamed ApprovalQueue → ApprovalCenter; corrected HR hiring workflow (added missing PENDING_GROUP_CEO_APPROVAL → GROUP_CEO_APPROVED steps between CEO_APPROVED and JOB_POSTED); fixed `/register` route (removed — does not exist in App.tsx); fixed `/reset-password/:token` → `/reset-password` (no token param); updated controller count (33→38, +interview, insights, policyExplainer, scheduler, participant); updated route count (34→37, +insights, policyExplainer, scheduler); updated service count backend (16→20, +crm-ai, insights, policyExplainer, scheduler); updated Prisma model count (58→121) and enum count (16→58) reflecting major schema growth; updated frontend services (23→28, +credit, insights, scheduler, auditLog, bannerConfig, entity, loa, requestStatus, screening, workflow); added `src/components/ui/` directory (16 primitives: Button, Card, Tabs, Drawer, Modal, Combobox, Tooltip, Skeleton, StateBadge, RiskBadge, AutosaveTextField, EmptyState, EnvironmentBanner, OutOfOfficeModal, PolicyExplainer); added new components (RichTextEditor, SessionExpiryBanner, NavMoreDropdown, CrmNav, CreditNav, CollapsibleKanbanColumn); updated hooks (4→9, added useAutosave, useCrmAi, useDebouncedValue, useIdleSession, useScrollLock); updated request-detail component count (25→38, added WorkflowCockpit, WorkflowStepper, DecisionPanel, ParticipantsSection, ActionBanner, AssignToDropdown, + new workflow modals); updated navigation section to reflect WorkflowCockpit/WorkflowStepper architecture in RequestDetail.

**Doc sync (2026-05-13):** Added CRM module (13 frontend pages, 3 backend services crm/crm-automation/crm-reports, 1 route file, 1 controller, 10 CRM Prisma models + 4 enums, 4 permissions crm:read/write/delete/admin, 7 report types, automation engine, Malaysian-specific fields); added Announcement Board (4 frontend pages/widget, 1 backend service, 1 route file, 1 controller, 2 Prisma models, 2 permissions announcement:write/admin, 14 API endpoints including PDF/DOCX parse and image upload); updated route count (31→34), controller count (31→33), service count (12→16), Prisma model count (43→58), enum count (16), KB routes flagged as DEV-only; updated rate limit to 2000/15min; updated navigation structure with all new CRM and announcement routes; added sections 9.7 CRM Module, 9.8 Announcement Board; updated glossary with 12 new terms.*
