# CWC 2.0 — IMPLEMENTATION PLAN CHECKLIST

> **Tracking document for all audit findings and remediation tasks**  
> **Source:** `CWC_2.0_FULL_PROJECT_AUDIT_REPORT.md` (April 23, 2026)  
> **Last Updated:** April 23, 2026  
> **Overall Status:** ⚠️ NOT READY FOR PRODUCTION

---

## HOW TO USE THIS CHECKLIST

- [ ] **Unchecked** = Not started
- [x] **Checked** = Completed
- [~] **In Progress** = Currently being worked on
- [!] **Blocked** = Waiting on dependency or decision

Each task has:
- **Priority:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
- **Effort:** Estimated days to complete
- **Owner:** Assignee name
- **Phase:** When this should be completed

---

## PHASE 0 — P0 CRITICAL (MUST COMPLETE BEFORE PRODUCTION)

**Target Completion:** May 7, 2026 (10-12 business days)

### Security & Authentication

|| ID | Task | Priority | Effort | Owner | Status | Notes |
||----|------|----------|--------|-------|--------|-------|
|| **SEC-001** | Implement MFA (TOTP-based) | P0 | 3 days | | [ ] | Use `speakeasy` or `otplib` library |
|| **SEC-002** | Add MFA setup UI in user settings | P0 | 2 days | | [ ] | QR code generation, backup codes |
|| **SEC-003** | Add password policy validation | P0 | 1 day | | [x] | ✅ Complete - See SEC_003_004_005_IMPLEMENTATION_SUMMARY.md |
|| **SEC-004** | Add rate limiting on auth endpoints | P0 | 1 day | | [x] | ✅ Complete - Redis store added, logging enabled |
|| **SEC-005** | Add executive role enum to User model | P0 | 1 day | | [x] | ✅ Complete - Enum + UI + validation implemented |
|| **SEC-006** | Add JWT key rotation mechanism | P1 | 2 days | | [ ] | Not critical but recommended |

### Monitoring & Operations

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **OPS-001** | Set up monitoring (Grafana Cloud) | P0 | 2 days | | [ ] | Free tier, basic metrics |
| **OPS-002** | Add health check endpoint with dependencies | P0 | 1 day | | [ ] | Include DB, Redis, S3 status |
| **OPS-003** | Add error alerting (Slack/Email) | P0 | 1 day | | [ ] | Critical errors only |
| **OPS-004** | Implement backup automation script | P0 | 1 day | | [ ] | Daily PostgreSQL dump to S3 |
| **OPS-005** | Document disaster recovery plan | P0 | 2 days | | [ ] | RTO/RPO definition, restoration steps |
| **OPS-006** | Add structured JSON logging | P1 | 1 day | | [ ] | For ELK/Splunk integration |

### Data Integrity

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **DATA-001** | Add optimistic locking to Request model | P0 | 1 day | | [ ] | Add `version` field |
| **DATA-002** | Add 409 Conflict handling in frontend | P0 | 1 day | | [ ] | Show "updated by another user" dialog |
| **DATA-003** | Add SLA pause logic for approval waits | P0 | 2 days | | [ ] | Track `approvalStartedAt` timestamps |
| **DATA-004** | Add database indexes for frequent queries | P1 | 1 day | | [ ] | `Request.status`, `Request.requesterId` |

### Finance Controls

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **FIN-001** | Add segregation of duties check | P0 | 1 day | | [ ] | Prevent self-approval of expenses |
| **FIN-002** | Add spending limits per user/category | P1 | 2 days | | [ ] | Monthly caps |
| **FIN-003** | Add duplicate receipt detection | P1 | 2 days | | [ ] | Hash-based comparison |

### HR Data Protection

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **HR-001** | Add confidential flag UI | P0 | 1 day | | [ ] | Allow marking requests as confidential |
| **HR-002** | Enforce confidential flag access restrictions | P0 | 1 day | | [ ] | HR-only access to sensitive data |
| **HR-003** | Add access logging for HR documents | P1 | 1 day | | [ ] | Log all S3 presigned URL requests |

---

## PHASE 1 — P1 HIGH PRIORITY (SPRINT 1-2 POST-LAUNCH)

**Target Completion:** May 21, 2026

### Admin UI Enhancements

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **ADMIN-001** | Add audit log viewer UI | P1 | 2 days | | [ ] | Searchable, filterable table |
| **ADMIN-002** | Add SLA configuration UI | P1 | 2 days | | [ ] | Edit SLA hours per request type |
| **ADMIN-003** | Add notification template editor | P1 | 2 days | | [ ] | Customize email templates |
| **ADMIN-004** | Add session management admin UI | P1 | 1 day | | [ ] | Force-logout users, view active sessions |
| **ADMIN-005** | Add dead-end detection in workflow builder | P1 | 2 days | | [ ] | Warn about statuses with no outgoing paths |

### Code Quality & Maintainability

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
|| **CODE-001** | Decompose `AdminSettings.tsx` (1,808 LOC) | P1 | 2 days | | [x] | ✅ Complete - Extracted into 10 components + hook + constants. AdminSettings reduced from 1,808 → 339 lines.
| **CODE-002** | Decompose `RequestDetail.tsx` (665 LOC) | P1 | 2 days | | [x] | ✅ Complete - Extracted into custom hook + FinanceWorkflowPanel. RequestDetail reduced from 665 → 257 lines.
| **CODE-003** | Add React error boundaries | P1 | 1 day | | [x] | ✅ Complete - ErrorBoundary, ErrorFallback, withErrorBoundary HOC. Wrapped App + key routes.
| **CODE-004** | Add loading states/skeleton loaders | P1 | 2 days | | [ ] | For all async operations |
| **CODE-005** | Add toast notification system | P1 | 2 days | | [x] | ✅ Complete - ToastContext, ToastContainer. Replaced 38 alert() calls with toast.error/success/warning.

### Reporting & Export

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **RPT-001** | Add CSV export for reports | P1 | 2 days | | [ ] | All report views |
| **RPT-002** | Add PDF export for reports | P1 | 2 days | | [ ] | Compliance-ready format |
| **RPT-003** | Add finance-specific audit reports | P1 | 2 days | | [ ] | "Expenses approved by X in last 30 days" |

### Workflow Improvements

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **WF-001** | Add approval delegation system | P1 | 3 days | | [ ] | Designate backup approvers |
| **WF-002** | Add auto-assignment based on category | P1 | 2 days | | [ ] | Round-robin or skill-based |
| **WF-003** | Add auto-escalation at 50% SLA | P1 | 2 days | | [ ] | Notify team lead automatically |
| **WF-004** | Add auto-closure after 7 days resolved | P1 | 1 day | | [ ] | No response = closed |

### SSE Scaling

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **SSE-001** | Migrate SSE from in-memory Map to Redis pub/sub | P1 | 3 days | | [ ] | Required for multi-instance deployment |

---

## PHASE 2 — P2 MEDIUM PRIORITY (Q3 2026)

**Target Completion:** August 2026

### Enterprise Integrations

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **ENT-001** | Implement SSO/SAML 2.0 integration | P2 | 5 days | | [ ] | Enterprise IdP (Okta, Azure AD) |
| **ENT-002** | Add accounting system integration | P2 | 5 days | | [ ] | QuickBooks or Xero API |
| **ENT-003** | Add vendor management model | P2 | 2 days | | [ ] | Vendor whitelist for finance |

### Asset Management

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **ASM-001** | Add Asset/Inventory model to Prisma schema | P2 | 2 days | | [ ] | Asset tags, serial numbers |
| **ASM-002** | Add asset assignment tracking | P2 | 2 days | | [ ] | Link assets to users and requests |
| **ASM-003** | Add asset return tracking (offboarding) | P2 | 2 days | | [ ] | Hardware return checklist |

### Search & Performance

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **SRCH-001** | Add PostgreSQL GIN indexes for full-text search | P2 | 1 day | | [ ] | Short-term improvement |
| **SRCH-002** | Implement Elasticsearch integration | P2 | 5 days | | [ ] | Long-term scalable search |
| **PERF-001** | Conduct load testing | P2 | 3 days | | [ ] | Identify breaking point |
| **PERF-002** | Optimize slow Prisma queries | P2 | 2 days | | [ ] | Add select optimization |

### Background Jobs

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **JOB-001** | Migrate from setInterval to BullMQ | P2 | 3 days | | [ ] | Redis-backed job queue |
| **JOB-002** | Add idempotent SLA checker job | P2 | 2 days | | [ ] | Prevent duplicate notifications |

---

## PHASE 3 — P3 LOW PRIORITY / FUTURE ENHANCEMENTS

**Target Completion:** Q4 2026+

### Advanced Features

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **ADV-001** | Add KPI dashboard with charts | P3 | 4 days | | [ ] | Recharts or Chart.js |
| **ADV-002** | Add mobile app (React Native) | P3 | 20 days | | [ ] | iOS + Android |
| **ADV-003** | Add chatbot for self-service | P3 | 10 days | | [ ] | FAQ automation |
| **ADV-004** | Add advanced SLA (business hours, holidays) | P3 | 3 days | | [ ] | Exclude weekends and public holidays |
| **ADV-005** | Add multi-language support (i18n) | P3 | 5 days | | [ ] | English + local languages |
| **ADV-006** | Add accessibility compliance (WCAG 2.1 AA) | P3 | 5 days | | [ ] | Screen reader support, keyboard nav |

### IT Module Enhancements

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **IT-001** | Add VPN Access Request form | P3 | 1 day | | [ ] | Dedicated workflow |
| **IT-002** | Add printer/peripheral request types | P3 | 1 day | | [ ] | New request types |
| **IT-003** | Add Meeting Room AV Setup request | P3 | 1 day | | [ ] | New request type |
| **IT-004** | Add IT-specific dashboard with queue metrics | P3 | 2 days | | [ ] | Agent workload view |

### HR Module Enhancements

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **HR-101** | Add leave balance display | P3 | 2 days | | [ ] | Widget in dashboard |
| **HR-102** | Add policy document library | P3 | 2 days | | [ ] | Searchable policy repository |
| **HR-103** | Add org chart browser | P3 | 3 days | | [ ] | Visual hierarchy |
| **HR-104** | Add manager dashboard for pending approvals | P3 | 2 days | | [ ] | Bulk approval actions |
| **HR-105** | Add payroll inquiry form | P3 | 1 day | | [ ] | New request type |
| **HR-106** | Add staff confirmation workflow | P3 | 2 days | | [ ] | Probation → Permanent |

### Finance Module Enhancements

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **FIN-101** | Add invoice request form | P3 | 1 day | | [ ] | Dedicated workflow |
| **FIN-102** | Add budget request workflow | P3 | 2 days | | [ ] | Budget tracking |
| **FIN-103** | Add general purchase request (non-IT) | P3 | 2 days | | [ ] | Procurement workflow |
| **FIN-104** | Add OCR for receipt data extraction | P3 | 3 days | | [ ] | Auto-fill amount, date, merchant |
| **FIN-105** | Add tax code handling (GST/VAT) | P3 | 2 days | | [ ] | Tax calculation |
| **FIN-106** | Add budget validation before approval | P3 | 2 days | | [ ] | Check remaining budget |

### Developer Experience

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **DX-001** | Add API documentation (OpenAPI/Swagger) | P3 | 3 days | | [ ] | Auto-generated from routes |
| **DX-002** | Add Architecture Decision Records (ADR) | P3 | 2 days | | [ ] | Document key decisions |
| **DX-003** | Add local dev environment setup script | P3 | 1 day | | [ ] | One-command setup |
| **DX-004** | Add seed data for testing | P3 | 1 day | | [ ] | Sample requests, users |

### Compliance & Governance

| ID | Task | Priority | Effort | Owner | Status | Notes |
|----|------|----------|--------|-------|--------|-------|
| **CMP-001** | Add data retention policies | P3 | 2 days | | [ ] | Auto-delete old requests |
| **CMP-002** | Add right-to-be-forgotten automation | P3 | 2 days | | [ ] | GDPR compliance |
| **CMP-003** | Add audit log export for external auditors | P3 | 2 days | | [ ] | PDF/CSV export with digital signature |
| **CMP-004** | Add data classification labels | P3 | 1 day | | [ ] | Public, Internal, Confidential, Restricted |

---

## COMPLETED ITEMS (ARCHIVE)

| ID | Task | Completed Date | Notes |
|----|------|----------------|-------|
| ~~G-001~~ | ~~Hiring Workflow LOA_ACCEPTED fix~~ | ~~Apr 22, 2026~~ | ~~2-part fix in `loa.controller.ts`~~ |
| ~~G-002~~ | ~~S3 file storage migration~~ | ~~Apr 22, 2026~~ | ~~Migrated to DigitalOcean Spaces~~ |
| ~~G-003~~ | ~~Real-time SSE notifications~~ | ~~Apr 22, 2026~~ | ~~SSE implemented via `sseClients.ts`~~ |
| ~~G-004~~ | ~~Email delivery verification~~ | ~~Apr 22, 2026~~ | ~~Replaced Nodemailer with Resend SDK~~ |
| ~~T3-6~~ | ~~Workflow-config tab in AdminSettings~~ | ~~Apr 22, 2026~~ | ~~`WorkflowTransitionTab.tsx` implemented~~ |

---

## PROGRESS TRACKING

### Summary by Phase

| Phase | Total Tasks | Completed | In Progress | Not Started | % Complete |
|-------|-------------|-----------|-------------|-------------|------------|
| **P0 Critical** | 25 | 5 | 0 | 20 | 20% |
| **P1 High** | 28 | 0 | 0 | 28 | 0% |
| **P2 Medium** | 15 | 0 | 0 | 15 | 0% |
| **P3 Low** | 35 | 0 | 0 | 35 | 0% |
| **TOTAL** | **103** | **5** | **0** | **98** | **5%** |

### Summary by Category

| Category | Total Tasks | Completed | % Complete |
|----------|-------------|-----------|------------|
| Security & Authentication | 6 | 0 | 0% |
| Monitoring & Operations | 6 | 0 | 0% |
| Data Integrity | 4 | 0 | 0% |
| Finance Controls | 3 | 0 | 0% |
| HR Data Protection | 3 | 0 | 0% |
| Admin UI | 5 | 0 | 0% |
| Code Quality | 5 | 0 | 0% |
| Reporting | 3 | 0 | 0% |
| Workflow | 4 | 0 | 0% |
| SSE Scaling | 1 | 0 | 0% |
| Enterprise Integrations | 3 | 0 | 0% |
| Asset Management | 3 | 0 | 0% |
| Search & Performance | 4 | 0 | 0% |
| Background Jobs | 2 | 0 | 0% |
| Advanced Features | 6 | 0 | 0% |
| IT Enhancements | 4 | 0 | 0% |
| HR Enhancements | 6 | 0 | 0% |
| Finance Enhancements | 6 | 0 | 0% |
| Developer Experience | 4 | 0 | 0% |
| Compliance | 4 | 0 | 0% |

---

## MILESTONES

| Milestone | Target Date | Status | Criteria |
|-----------|-------------|--------|----------|
| **P0 Complete** | May 7, 2026 | [ ] | All P0 tasks checked |
| **Soft Launch** | May 14, 2026 | [ ] | P0 complete + pilot group ready |
| **P1 Complete** | May 21, 2026 | [ ] | All P1 tasks checked |
| **Production Launch** | June 1, 2026 | [ ] | P0 + P1 complete + load testing passed |
| **P2 Complete** | August 31, 2026 | [ ] | All P2 tasks checked |
| **Enterprise Ready** | December 31, 2026 | [ ] | All P3 tasks checked |

---

## CHANGE LOG

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | April 23, 2026 | Platform Team | Initial checklist from full audit report |

---

## NOTES

- Update this checklist weekly during standup
- Move tasks between phases if priorities change
- Add new tasks as they are discovered
- Link to GitHub issues/tickets when created
- Record actual effort vs. estimated effort for future planning
