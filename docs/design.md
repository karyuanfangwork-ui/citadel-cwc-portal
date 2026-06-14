# CWC Frontend Design Document

> **Last updated:** June 2026  
> **Stack:** React 19 + TypeScript + Vite  
> **Monorepo:** `citadel-cwc-portal` (`backend/` + `frontend/`)

---

## 1. Architecture Overview

### 1.1 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite 6 |
| Routing | React Router v7 (BrowserRouter) |
| State | React Context (Auth, Theme, Notification, Toast) |
| HTTP Client | Axios (`src/services/api.ts`) |
| Styling | Tailwind CSS + CSS custom properties (design tokens) |
| Icons | Material Symbols Outlined (Google Fonts CDN) |
| Typography | Plus Jakarta Sans (body), JetBrains Mono (code) |
| Charts | Recharts |
| Rich Text | Tiptap (editor), react-markdown (viewer) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| i18n | i18next + react-i18next (English only for now) |
| Error Tracking | Sentry (@sentry/react) |
| Table Export | xlsx (SheetJS) |

### 1.2 Project Structure

```
frontend/
├── App.tsx                          # Root: routing, layout shell, providers
├── src/
│   ├── components/
│   │   ├── ui/                      # Design-system primitives (Button, Card, Modal, etc.)
│   │   ├── layout/                  # LeftRail, TopBar, MobileDrawer, navConfig
│   │   ├── admin/                   # Admin settings tabs & modals
│   │   ├── create-request/          # New request wizard (multi-step)
│   │   ├── credit/                  # Credit module shared components
│   │   ├── credit-ai/               # AI insight panels (narrative, red flags, compliance, duplicates)
│   │   ├── crm/                     # CRM shared components (tables, cards, inline edit, etc.)
│   │   ├── request-detail/          # Request detail modals & action panels
│   │   ├── request/                 # Request form fields, workflow modals
│   │   ├── CreditNav.tsx            # Credit sub-navigation
│   │   ├── CrmNav.tsx               # CRM sub-navigation
│   │   ├── FormBuilder.tsx          # Dynamic form builder (admin)
│   │   ├── RichTextEditor.tsx        # Tiptap wrapper
│   │   ├── Breadcrumbs.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── NotificationDropdown.tsx
│   │   ├── OnboardingDashboard.tsx
│   │   ├── OffboardingDashboard.tsx
│   │   ├── ProtectedRoute.tsx        # RBAC route guard
│   │   ├── SessionExpiryBanner.tsx
│   │   ├── SkeletonRow.tsx
│   │   └── SkeletonCategoryCard.tsx
│   ├── context/
│   │   ├── AuthContext.tsx           # User state, login/logout, OOO, delegation
│   │   ├── ThemeContext.tsx          # Light/dark/system theme switcher
│   │   ├── NotificationContext.tsx    # SSE notifications + toast state
│   │   └── ToastContext.tsx          # Global toast messages
│   ├── hooks/                       # Custom hooks (18 total)
│   ├── i18n/
│   │   ├── config.ts                # i18next initialization
│   │   └── en.json                  # English translations
│   ├── lib/
│   │   └── featureFlags.ts          # Feature flag gate (currently: `kb`)
│   ├── services/                    # API service modules (30 files)
│   ├── styles/
│   │   ├── tokens.css               # Design tokens (colors, spacing, typography, shadows)
│   │   ├── credit-tables.css        # Credit table sticky headers + zebra striping
│   │   ├── crm-mobile.css           # CRM mobile-first responsive overrides
│   │   └── editor.css               # Tiptap rich text editor styles
│   └── utils/
│       ├── permissions.ts           # RBAC helpers (hasPermission, hasAnyPermission, hasRole)
│       ├── roleDetection.ts          # Role classification utilities
│       ├── tokenManager.ts          # JWT token lifecycle
│       ├── workflowTransitions.ts    # Workflow state machine
│       ├── workflowModalConfig.ts    # Modal config per workflow step
│       ├── workflowActions.ts        # Workflow action generators
│       ├── crmValidation.ts         # CRM form validation rules
│       ├── crmFormHelper.ts         # CRM form helpers
│       ├── creditSort.ts            # Credit data sorting utilities
│       ├── errorMessages.ts         # Centralized error message mapping
│       └── creditEnums.ts           # Credit enum constants
├── pages/
│   ├── Dashboard.tsx                # Home dashboard
│   ├── ITSupport.tsx                # IT service desk landing
│   ├── HRServices.tsx               # HR service desk landing
│   ├── GroupFinance.tsx             # Group Finance landing
│   ├── CreateRequest.tsx            # Multi-step request creation wizard
│   ├── RequestDetail.tsx            # Request detail with workflow cockpit
│   ├── MyRequests.tsx               # End-user request list
│   ├── AgentDashboard.tsx           # Agent support queue
│   ├── ApprovalCenter.tsx           # Unified approvals
│   ├── ApprovalQueue.tsx            # Approval queue list
│   ├── MyApprovals.tsx              # Credit approvals
│   ├── UnifiedInbox.tsx             # Notification inbox
│   ├── AssetManagement.tsx          # ITAM registry
│   ├── Announcements.tsx            # Announcement board
│   ├── KnowledgeBase.tsx            # KB search & browse
│   ├── Reports.tsx                  # Reports dashboard
│   ├── Insights.tsx                 # Insights dashboard
│   ├── SearchResults.tsx            # Global search
│   ├── AdminSettings.tsx            # Admin settings (tabbed)
│   ├── AuditTrail.tsx               # Audit log viewer
│   ├── FinancialSpreading.tsx      # Financial spreading
│   ├── FinancialAnalysis.tsx        # Financial analysis
│   ├── ScorecardManagement.tsx      # Scorecard admin
│   ├── CommitteeMeetings.tsx         # Credit committee meetings
│   ├── CollateralManagement.tsx     # Collateral management
│   ├── BorrowerProfileList.tsx      # Borrower profiles list
│   ├── BorrowerProfileDetail.tsx    # Borrower profile detail
│   ├── CreditApplicationList.tsx    # Credit applications list
│   ├── CreditApplicationDetail.tsx  # Credit application detail (36 tabs!)
│   ├── Crm*.tsx                     # ~20 CRM pages (dashboard, accounts, contacts, leads, etc.)
│   ├── credit/                      # Credit sub-pages
│   │   ├── CreditDashboard.tsx
│   │   ├── CreditReports.tsx
│   │   ├── GroupExposurePage.tsx
│   │   ├── CommitteeMeetingDetail.tsx
│   │   ├── CommitteeMobileVote.tsx
│   │   ├── MobileApprovalInbox.tsx
│   │   ├── CreditApplicationMobileSummary.tsx
│   │   ├── PersonalFastView.tsx
│   │   ├── RejectionBanner.tsx
│   │   ├── creditUtils.ts
│   │   └── tabs/                    # 36 tab components for credit application detail
│   └── NotFound.tsx                 # 404 page
└── index.html                       # Entry HTML with fonts & icon CDN links
```

---

## 2. Design System

### 2.1 Design Tokens (`src/styles/tokens.css`)

All visual constants are defined as CSS custom properties on `:root` (light) and `.dark` (dark mode).

#### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-brand-900` | `#13214a` | `#eaf5fc` | Deep navy / reversed light |
| `--color-brand-700` | `#1D2D5E` | `#5BBFE8` | Primary brand (navy / sky) |
| `--color-brand-600` | `#2E4A7A` | `#2563EB` | Active / tab accent |
| `--color-brand-500` | `#4A8DB8` | `#7DD3F0` | Steel blue / hover |
| `--color-brand-300` | `#5BBFE8` | `#a3dfee` | Citadel sky blue |
| `--color-brand-100` | `#d0e8f5` | `#1a3a5c` | Light brand bg |
| `--color-brand-50` | `#eaf5fc` | `#0f2540` | Subtle brand bg |

**Service desk accents:**
- IT: `--color-it-500` (#0052cc), `--color-it-100` (#deebff), `--color-it-50` (#eff6ff)
- HR: `--color-hr-500` (#059669), `--color-hr-100` (#d1fae5), `--color-hr-50` (#ecfdf5)
- Finance: `--color-fin-500` (#d97706), `--color-fin-100` (#fde68a), `--color-fin-50` (#fffbeb)

**Semantic status:**
- Success: `--color-success` (#059669 / #34d399)
- Warning: `--color-warning` (#d97706 / #fbbf24)
- Danger: `--color-danger` (#dc2626 / #f87171)
- Info: `--color-info` (#0052cc / #4da6ff)

**Surface & borders:**
- `--color-surface` (#ffffff / #0f172a)
- `--color-surface-subtle` (#f8fafc / #1e293b)
- `--color-surface-muted` (#f3f4f6 / #334155)
- `--color-border` (#e5e7eb / #475569)

#### Spacing (4px base unit)

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

#### Border Radius

| Token | Value |
|---|---|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 16px |
| `--radius-xl` | 20px |
| `--radius-full` | 9999px |

#### Shadows

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)` |

#### Typography

| Token | Value |
|---|---|
| `--font-sans` | `'Plus Jakarta Sans', sans-serif` |
| `--font-mono` | `'JetBrains Mono', monospace` |
| `--text-xs` | 11px |
| `--text-sm` | 13px |
| `--text-base` | 15px |
| `--text-lg` | 17px |
| `--text-xl` | 20px |
| `--text-2xl` | 24px |
| `--text-3xl` | 30px |
| `--text-4xl` | 36px |

### 2.2 UI Component Library (`src/components/ui/`)

| Component | Props | Notes |
|---|---|---|
| **Button** | `variant` (primary/secondary/danger/ghost), `size` (sm/md/lg), `icon`, `iconPosition`, `loading`, `fullWidth` | Material Symbols icons, spinner on loading |
| **Card** | `variant` (default/elevated/outlined/filled), `padding` (none/sm/md/lg), `hoverable` | Compound: `Card.Header`, `Card.Body`, `Card.Footer` |
| **Modal** | `isOpen`, `onClose`, `title`, `size` (sm/md/lg/xl/full), `footer` | Portal-based, focus trap, escape dismiss |
| **Drawer** | `isOpen`, `onClose`, `title`, `side` (left/right), `width` (sm/md/lg/xl), `footer` | Slide-in panel, focus trap |
| **Tabs** | `tabs` (TabItem[]), `defaultTab`, `onChange` | Horizontal tab bar with optional icons + badges |
| **Combobox** | — | Autocomplete dropdown |
| **Tooltip** | — | Hover tooltip |
| **StateBadge** | `state` (string), `showIcon`, `size` (sm/md) | Universal status pill — maps 50+ status strings to color + icon |
| **RiskBadge** | — | Risk level indicator |
| **EmptyState** | — | No-data placeholder |
| **Skeleton** | — | Loading skeleton |
| **EnvironmentBanner** | — | Shows dev/staging banner |
| **OutOfOfficeModal** | — | OOO status editor |
| **AutosaveTextField** | — | Auto-saving text input |
| **PolicyExplainer** | — | Permission policy explainer |

### 2.3 StateBadge Status Color Map

The `StateBadge` component maps **50+ status strings** across all modules to consistent color + icon pairs:

| Category | Statuses | Color Pattern |
|---|---|---|
| IT/HR/Finance requests | OPEN, IN_PROGRESS, PENDING, ESCALATED, RESOLVED, CLOSED, CANCELLED, REOPENED | Blue → Amber → Gray spectrum |
| Approvals | APPROVED, REJECTED, WITHDRAWN | Green / Red / Gray |
| Credit application | DRAFT → SUBMITTED → KYC_REVIEW → UNDERWRITING → COMMITTEE_REVIEW → APPROVED → DISBURSED | Indigo → Amber → Purple → Cyan progression |
| CRM pipeline | LEAD → PROSPECT → QUALIFIED → NEGOTIATION → WON/LOST | Indigo → Blue → Amber → Orange → Green/Red |
| Asset lifecycle | AVAILABLE, IN_USE, IN_REPAIR, DECOMMISSIONED, RETIRED, DAMAGED | Green / Purple / Amber / Gray / Red |
| Priority | LOW, MEDIUM, HIGH, CRITICAL, URGENT | Green → Amber → Orange → Red |

---

## 3. Layout & Navigation

### 3.1 App Shell

```
┌──────────────────────────────────────────────────────────┐
│  LeftRail    │   TopBar (search, notifications, user)    │
│  (sidebar)   │────────────────────────────────────────── │
│              │                                            │
│  ┌────────┐ │   ┌─────────────────────────────────────┐ │
│  │ Brand  │ │   │                                     │ │
│  │ Logo   │ │   │         Main Content Area           │ │
│  ├────────┤ │   │         (scrollable)                │ │
│  │ Main   │ │   │                                     │ │
│  │ Nav    │ │   │                                     │ │
│  │ Links  │ │   │                                     │ │
│  ├────────┤ │   │                                     │ │
│  │Service │ │   │                                     │ │
│  │Desks   │ │   │                                     │ │
│  ├────────┤ │   │                                     │ │
│  │Tools   │ │   │                                     │ │
│  ├────────┤ │   │                                     │ │
│  │Admin   │ │   │                                     │ │
│  └────────┘ │   └─────────────────────────────────────┘ │
│              │────────────────────────────────────────── │
│              │   Footer (copyright, links)               │
└──────────────────────────────────────────────────────────┘
```

### 3.2 LeftRail (Sidebar)

- **Collapsed**: 64px wide, icons only
- **Expanded**: 240px wide, icons + labels
- **Pin toggle**: Click pin icon to lock expanded; defaults to collapsed
- **Hover expand**: Mouse hover expands temporarily (if not pinned)
- **Brand**: Citadel Workplace Connect logo + text
- **Nav groups**: Primary, Service Desks, Tools, Admin — each with section headers
- **RBAC filtering**: `buildNavLinks(user)` filters nav items by permissions and roles
- **New Request CTA**: Primary blue button at top, links to `/it`
- **Mobile**: Hidden on `<lg`, replaced by `MobileDrawer`

### 3.3 TopBar

- **Breadcrumb**: Current page context
- **Global search**: Links to `/search?q=...`
- **Notification bell**: Dropdown with recent notifications (SSE-powered)
- **Out-of-office indicator**: Shows OOO badge, click to open modal
- **Theme toggle**: Light/Dark/System
- **User menu**: Avatar, role badge (color-coded), Change Password, Sign Out
- **Role badge**: Priority order: ADMIN > GROUP_DCEO > CEO > CTO > CFO > AGENT > END_USER

### 3.4 Mobile Layout

- `MobileDrawer`: Full-height slide-in from left, same nav links as LeftRail
- Bottom tab bar for CRM module (`CrmMobileNav`)
- Card-based layouts instead of tables (`CrmMobileList`, `CrmMobileForm`)
- Safe area insets supported (`crm-mobile.css`)
- Responsive breakpoints: `sm` (640), `md` (768), `lg` (1024), `xl` (1280)

### 3.5 Route Structure

| Path | Page | Permission |
|---|---|---|
| `/` | Dashboard | Authenticated |
| `/it` | IT Support | Authenticated |
| `/hr` | HR Services | Authenticated |
| `/finance` | Group Finance | Authenticated |
| `/my-requests` | My Requests | Authenticated |
| `/request/:id` | Request Detail | Authenticated |
| `/:deskType/:deskId/create/:categoryId` | Create Request | Authenticated |
| `/agent` | Support Queue | ADMIN, AGENT |
| `/approvals` | Approval Center | `request:approve` or `credit:approve` |
| `/inbox` | Notifications | Authenticated |
| `/announcements` | Announcements | Authenticated |
| `/assets` | IT Assets | `asset:read` |
| `/crm/*` | CRM (20+ routes) | `crm:read` or `crm:admin` |
| `/credit/*` | Credit (15+ routes) | `credit:read` or `credit:approve` |
| `/reports` | Reports | `report:read` |
| `/insights` | Insights | `report:read` |
| `/admin/settings` | Admin Settings | `admin:access` |
| `/admin/audit` | Audit Trail | `admin:access` |
| `/kb` | Knowledge Base | Feature flag `kb` |
| `/change-password` | Change Password | Authenticated |

---

## 4. Domain Modules

### 4.1 Service Desks (IT / HR / Finance)

Each service desk has:
- **Landing page**: Category cards with icons, descriptions, and "Create Request" CTA
- **Request creation**: 3-step wizard (StepRequestType → StepDetails → StepReview)
- **Request detail**: WorkflowStepper + action modals per step + activity feed + participants + SLA indicator
- **Workflow modals**: 20+ domain-specific action modals (HR interview scheduling, IT procurement, finance approvals, etc.)

**IT Support** categories: Hardware Request, Software Request, Access Request, Network Issue, General IT  
**HR Services** categories: Leave Management, Employee Onboarding, Employee Offboarding, Interview Scheduling  
**Group Finance** categories: Expense Claims, Purchase Requisitions, Chargeback Requests

### 4.2 CRM Module

| Route | Page | Permission |
|---|---|---|
| `/crm` | Dashboard | `crm:read` |
| `/crm/accounts` | Accounts list | `crm:read` |
| `/crm/accounts/:id` | Account detail | `crm:read` |
| `/crm/contacts` | Contacts list | `crm:read` |
| `/crm/contacts/:id` | Contact detail | `crm:read` |
| `/crm/leads` | Leads list | `crm:read` |
| `/crm/leads/:id` | Lead detail | `crm:read` |
| `/crm/opportunities` | Opportunities list | `crm:read` |
| `/crm/opportunities/:id` | Opportunity detail | `crm:read` |
| `/crm/pipeline` | Kanban pipeline | `crm:read` |
| `/crm/team` | Team dashboard | `crm:admin` |
| `/crm/reports` | Reports | `crm:read` |
| `/crm/guide` | Guide | `crm:read` |
| `/crm/import-export` | Import/Export | `crm:admin` |
| `/crm/territories` | Territories | `crm:read` |
| `/crm/quotas` | Quota dashboard | `crm:read` |
| `/crm/workflows` | Workflow list | `crm:admin` |
| `/crm/workflows/new` | Workflow builder | `crm:admin` |
| `/crm/workflows/:id` | Workflow detail | `crm:admin` |
| `/crm/integrations` | Integrations settings | `crm:read` |
| `/crm/anomalies` | Anomaly config | `crm:admin` |
| `/crm/custom-fields` | Custom field admin | `crm:admin` |
| `/crm/duplicates` | Duplicate manager | `crm:admin` |
| `/crm/lead-scoring` | Lead scoring admin | `crm:admin` |
| `/crm/assignment-rules` | Assignment rules admin | `crm:admin` |

**Key CRM components:**
- `CrmNav`: Sub-navigation with tabs (Dashboard, Accounts, Contacts, Leads, Opportunities, Pipeline, etc.)
- `CrmTable` / `LeadsTable` / `OpportunitiesTable`: Data tables with sorting, filtering, bulk actions
- `CrmMobileList` / `CrmMobileForm` / `CrmMobileNav`: Mobile-first card views
- `CrmResponsiveLayoutProvider`: Adaptive layout (table on desktop, cards on mobile)
- `CrmCardSkeleton` / `CrmTableSkeleton`: Loading states
- `CrmCustomFieldRenderer` / `CrmCustomFieldDisplay` / `CrmCustomFieldFilter`: Custom field system
- `ActivityCardActions` / `ActivityEditModal`: Activity timeline
- `AiInsightCard`: CRM AI insights
- `BulkActionBar`: Multi-select actions
- `StageDropdown` / `StatusDropdown`: Inline stage/status editing
- `InlineEdit`: Click-to-edit fields
- `WidgetPicker` / `WidgetRenderer` / `DashboardLayoutProvider`: Customizable dashboard widgets

### 4.3 Credit Module

| Route | Page | Permission |
|---|---|---|
| `/credit` | Credit Dashboard | `credit:read` |
| `/credit/borrowers` | Borrower Profile List | `credit:read` |
| `/credit/borrowers/:id` | Borrower Profile Detail | `credit:read` |
| `/credit/applications` | Application List | `credit:read` |
| `/credit/applications/:id` | Application Detail | `credit:read` |
| `/credit/approvals` | My Approvals | `credit:approve` |
| `/credit/financials` | Financial Spreading | `credit:read` |
| `/credit/analysis` | Financial Analysis | `credit:read` |
| `/credit/scorecards` | Scorecard Management | `credit:admin` |
| `/credit/committee` | Committee Meetings | `credit:read` |
| `/credit/committee/:meetingId` | Meeting Detail | `credit:read` |
| `/credit/collateral` | Collateral Management | `credit:read` |
| `/credit/reports` | Credit Reports | `credit:read` |
| `/credit/group-exposure` | Group Exposure | `credit:read` |
| `/credit/m/approvals` | Mobile Approval Inbox | `credit:approve` |
| `/credit/m/committee/:meetingId` | Mobile Vote | `credit:approve` |
| `/credit/m/applications/:id` | Mobile Application Summary | `credit:read` |

**Credit Application Detail** has **36 tab components** in `pages/credit/tabs/`:
- Summary, Parties, Borrower Profile, Loan Request, Facilities, Retail Facilities
- Financials, SME Financials, Profitability Wallet, Retail Income
- Credit Checks, Risk Score, Risk Rating/ECL, Risk Mitigators
- Forward Looking Risk, Industry Outlook, Payment Capability, Security Guarantees
- Guarantor Financial Assessment, ESG, SICR, Conditions, Disbursement
- Collateral, Documents, Approvals, Counterparties
- Account Conduct, Audit, Signoff, Header Background
- LOO Section, Pricing Worksheet Panel

**Key Credit components:**
- `CreditNav`: Sub-navigation tabs
- `CreditTable`: Sticky-header zebra-striped data table
- `ApprovalChainPanel` / `ApprovalQuickView`: Multi-level approval chain display
- `CommitteeWidget`: Committee voting interface
- `FinancialCharts`: Recharts-based financial visualizations
- `ApplicationTimeline`: Activity timeline with comments
- `DocumentUpload` / `BulkDocumentUpload`: File upload with progress
- `NewBorrowerWizard` / `EditBorrowerModal`: Borrower profile forms
- `ReadinessChecklistModal`: Pre-submission checklist
- `S7ProcessBanner`: S7 regulatory process indicator
- `ScoreOutdatedBanner`: Score recalculation warning
- `SlaBreachWidget`: SLA breach alert
- `ProgressOverlay`: Full-screen loading overlay for async operations

**Credit AI panels** (`components/credit-ai/`):
- `AiNarrativePanel`: AI-generated credit narrative
- `AiRedFlagPanel`: Risk red flags detection
- `AiCompliancePanel`: Regulatory compliance checks
- `AiAutoExceptionPanel`: Auto-exception processing
- `AiDuplicateAlert`: Duplicate application detection

### 4.4 Admin Module

`AdminSettings` page with tabs:
- **User Accounts**: User CRUD, role assignment, password reset, staff import
- **Service Desks**: Service desk configuration with categories and workflows
- **Permissions**: RBAC permission matrix
- **SLA & Escalation**: SLA hours per request type, escalation rules
- **Status Definitions**: Request status lifecycle configuration
- **Workflow Transitions**: Workflow state machine editor
- **Onboarding Tasks**: Onboarding checklist templates
- **Offboarding Tasks**: Offboarding checklist templates
- **Email Notifications**: Notification template editor
- **Audit Log**: Audit trail viewer
- **Banner Config**: Announcement banner management
- **Scheduler Settings**: Job scheduler configuration

### 4.5 Knowledge Base

Feature-flagged (`VITE_FEATURE_KB`):
- `/kb`: Browse and search articles
- `/kb/:slug`: Article detail with markdown rendering
- Rich text editor (Tiptap) for article creation

### 4.6 IT Asset Management

- `/assets`: Asset registry with assignment tracking
- Categories: LAPTOP, DESKTOP, MONITOR, PERIPHERAL, PHONE, NETWORK, PRINTER, SOFTWARE_LICENSE, OTHER
- Lifecycle states: AVAILABLE, IN_USE, IN_REPAIR, DECOMMISSIONED, STORED, RETIRED, DAMAGED, LOST_STOLEN

---

## 5. Authentication & Authorization

### 5.1 Auth Flow

- **JWT-based**: Access token stored in memory, refresh via HTTP-only cookie
- **Session recovery**: On mount, `AuthContext` calls `authService.getCurrentUser()` to restore session
- **Login**: Email + password → `authService.login()` → stores user + token in context
- **Register**: Email + password + name + department → `authService.register()`
- **Logout**: `authService.logout()` → clears user state

### 5.2 RBAC

**Roles**: ADMIN, GROUP_DCEO, CEO, CTO, CFO, COO, CHRO, CMO, AGENT, END_USER

**Permission system** (`src/utils/permissions.ts`):
- `hasPermission(user, 'resource:action')` — exact permission check
- `hasAnyPermission(user, ['perm1', 'perm2'])` — OR check
- `hasAllPermissions(user, ['perm1', 'perm2'])` — AND check
- `hasRole(user, 'ROLE')` — role check
- `hasAnyRole(user, ['ROLE1', 'ROLE2'])` — OR role check
- **ADMIN role bypasses all permission checks**

**Route protection** (`ProtectedRoute`):
```tsx
<ProtectedRoute>                          // Authenticated only
<ProtectedRoute requirePermission="crm:read">  // Permission-gated
```

### 5.3 Delegation & Out-of-Office

- Users can set OOO status with date range and message
- Delegation: assign another user to handle requests while OOO
- Both managed via `OutOfOfficeModal` in TopBar

---

## 6. Theming & Dark Mode

### 6.1 Theme System

`ThemeContext` provides `theme` (light/dark/system) and `resolvedTheme`.

- Theme preference stored in `localStorage` key `cwc-theme`
- System preference detected via `prefers-color-scheme` media query
- Dark mode applied by toggling `.dark` class on `<html>` element
- All design tokens have corresponding `.dark` overrides

### 6.2 Dark Mode Color Strategy

- Brand colors invert: deep navy → light blue, sky blue → muted cyan
- Service desk accents shift to higher-luminosity variants (e.g., `#0052cc` → `#4da6ff`)
- Surfaces darken progressively: surface → subtle → muted
- Text inverts: primary → `#f1f5f9`, secondary → `#94a3b8`
- Status colors maintain semantic meaning with appropriate contrast

---

## 7. Notification System

### 7.1 Real-time Notifications

- **SSE endpoint**: `/api/v1/notifications/sse` — pushed to `NotificationContext`
- **NotificationDropdown**: Bell icon in TopBar with unread count badge
- **NotificationToast**: Bottom-right toast with subject, body, and optional navigation link
- **Auto-read on click**: Clicking a toast marks the notification as read via `notificationService.markAsRead()`

### 7.2 Session Management

- `SessionExpiryBanner`: Warns user before session expires
- `tokenManager.ts`: JWT lifecycle management (access + refresh tokens)

---

## 8. Internationalization (i18n)

- **i18next** initialized in `src/i18n/config.ts`
- Translation file: `src/i18n/en.json`
- Currently English only; structure supports adding languages
- Translation keys organized by domain: `common`, `nav`, `dashboard`, etc.

---

## 9. Feature Flags

```typescript
// src/lib/featureFlags.ts
export const featureFlags = {
  kb: truthy(import.meta.env.VITE_FEATURE_KB) || import.meta.env.DEV,
};
```

Controlled via `VITE_FEATURE_KB` env var. Dev mode enables all features by default.

---

## 10. Error Handling & Loading States

- **ErrorBoundary**: React error boundary wrapping protected routes
- **Sentry**: `@sentry/react` ErrorBoundary at app root
- **EmptyState**: Consistent no-data placeholder component
- **Skeleton** / **SkeletonRow** / **SkeletonCategoryCard** / **CrmCardSkeleton** / **CrmTableSkeleton**: Loading skeletons per module
- **ConfirmDialog**: Confirmation dialog for destructive actions
- **ProgressOverlay**: Full-screen loading overlay (credit module)
- **ToastContainer**: Global toast notifications (react-hot-toast)

---

## 11. Custom Hooks

| Hook | Purpose |
|---|---|
| `useApplicationLane` | Credit application kanban lane state |
| `useAutosave` | Auto-save form data with debounce |
| `useBannerConfigs` | Fetch announcement banner configs |
| `useCreditFeatureFlags` | Credit module feature flags |
| `useCrmAi` | CRM AI insight API |
| `useCrmUpdate` | CRM entity update with optimistic UI |
| `useDebouncedValue` | Debounced value hook |
| `useDirtyFormGuard` | Prevent navigation with unsaved changes |
| `useEscapeKey` | Escape key handler |
| `useFocusTrap` | Focus trap for modals |
| `useIdleSession` | Idle session timeout warning |
| `useIsMobile` | Mobile detection (matches `useMediaQuery`) |
| `useLazyTab` | Lazy tab content loading |
| `useMediaQuery` | CSS media query hook |
| `useModalDismiss` | Click-outside dismiss for modals |
| `useProgressOverlay` | Progress overlay state management |
| `useScrollLock` | Body scroll lock for modals/drawers |

---

## 12. API Layer

### 12.1 Service Modules (`src/services/`)

| Service | Purpose |
|---|---|
| `api.ts` | Axios instance with base URL from `VITE_API_URL`, JWT interceptors |
| `auth.service.ts` | Login, register, logout, current user, OOO, delegation |
| `request.service.ts` | CRUD for service desk requests |
| `approval.service.ts` | Approval actions and queries |
| `asset.service.ts` | ITAM CRUD |
| `crm.service.ts` | CRM entities, search, import/export |
| `credit.service.ts` | Credit applications, borrowers, facilities |
| `creditAi.service.ts` | AI narrative, red flags, compliance |
| `admin.service.ts` | Admin settings CRUD |
| `announcement.service.ts` | Announcements |
| `auditLog.service.ts` | Audit trail |
| `bannerConfigService.ts` | Banner configuration |
| `chargeback-workflow.service.ts` | Chargeback workflow |
| `entity.service.ts` | Entity routing |
| `finance-workflow.service.ts` | Finance workflows |
| `insights.service.ts` | Insights dashboard data |
| `interview.service.ts` | Interview scheduling |
| `it-workflow.service.ts` | IT workflow actions |
| `kb.service.ts` | Knowledge base |
| `loa.service.ts` | Leave of absence |
| `notification.service.ts` | Notifications + SSE |
| `reports.service.ts` | Reports data |
| `requestStatusService.ts` | Request status transitions |
| `scheduler.service.ts` | Job scheduler |
| `screening.service.ts` | Employee screening |
| `search.service.ts` | Global search |
| `sentry.ts` | Sentry initialization |
| `serviceDesk.service.ts` | Service desk config |
| `smeFinancial.service.ts` | SME financial data |
| `workflow.service.ts` | Workflow transitions |

### 12.2 API Base URL

Configured via `VITE_API_URL` environment variable. Default prefix: `/api/v1`.

---

## 13. File Sizes & Scale

| Category | Count |
|---|---|
| Page components | ~105 files |
| Shared components | ~185 files |
| UI primitives | 15 components |
| Credit tabs | 36 components |
| CRM components | 25+ components |
| Custom hooks | 16 hooks |
| API services | 30 files |
| CSS stylesheets | 4 files (431 lines total) |
| Design tokens | 123 lines (tokens.css) |
| Routes | 60+ protected routes |
| i18n translations | ~100 keys (English) |

---

## 14. Naming Conventions

| Pattern | Example |
|---|---|
| Pages | PascalCase: `Dashboard.tsx`, `CrmAccountDetail.tsx` |
| Components | PascalCase: `StateBadge.tsx`, `ApprovalChainPanel.tsx` |
| Hooks | camelCase with `use` prefix: `useAutosave.ts`, `useIsMobile.ts` |
| Services | camelCase with `.service.ts` suffix: `crm.service.ts` |
| Utils | camelCase: `permissions.ts`, `workflowTransitions.ts` |
| Contexts | PascalCase with `Context` suffix: `AuthContext.tsx` |
| CSS custom properties | `--color-{domain}-{shade}`, `--space-{n}`, `--radius-{size}`, `--text-{size}` |
| Tailwind classes | Uses custom `rounded-cwc-*` (mapped from tokens) and `bg-brand-*`/`text-brand-*` |

---

## 15. Browser Support & Performance

- **Target**: Modern evergreen browsers (ES2022)
- **Module**: ESNext with bundler module resolution
- **Code splitting**: Vite automatic code splitting per route
- **Font loading**: Google Fonts with `preconnect` + `display=swap`
- **Icon loading**: Material Symbols Outlined via Google Fonts CDN (variable font)
- **Tree-shaking**: Enabled via Vite production build