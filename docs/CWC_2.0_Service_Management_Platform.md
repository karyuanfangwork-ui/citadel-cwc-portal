# CWC 2.0 — Enterprise Service Management Platform
## Master Documentation

| Field | Value |
|:---|:---|
| **Document Version** | 1.0 |
| **System Version** | CWC 2.0 |
| **Status** | Pre-Launch — Internal Review |
| **Date** | April 22, 2026 |
| **Author** | Platform Team |
| **Classification** | Internal |

---

## How to Read This Document

This is a multi-audience master reference. Navigate by your role:

| If you are... | Read... |
|:---|:---|
| **Executive / Department Head** | Part 1, Part 8 |
| **End User (submitting requests)** | Part 1 + your desk chapter (3, 4, or 5) |
| **Agent / Specialist** | Part 2, then your desk chapter |
| **System Administrator** | Part 2, Part 6 |
| **Developer / Technical Team** | All parts, especially Part 2 and Part 7 |

---

## Glossary

| Term | Definition |
|:---|:---|
| **Request** | A formal service ticket submitted by an end user |
| **Agent** | A specialist assigned to fulfill a request |
| **SLA** | Service Level Agreement — the time commitment to resolve a request |
| **Workflow Transition** | A permitted change from one request status to another |
| **Approval Chain** | Ordered sequence of approvers who must sign off before a request proceeds |
| **LOA** | Letter of Appointment — formal employment offer document in the hiring workflow |
| **RBAC** | Role-Based Access Control — permissions determined by user role |
| **Reference Number** | Unique ticket identifier (e.g., `IT-4921`, `HR-1044`, `FIN-882`) |

---

# PART 1 — EXECUTIVE OVERVIEW

## 1.1 System Purpose

CWC 2.0 is an enterprise service management platform that consolidates IT, HR, and Finance service requests into a single, auditable system. It replaces email-based request handling with structured workflows, multi-tier approvals, SLA enforcement, and a full activity trail.

**Business value delivered:**
- Eliminates lost or untracked requests via reference-numbered tickets
- Enforces approval chains with documented audit logs
- Reduces resolution time through SLA visibility and escalation rules
- Provides a unified interface for employees across all departments

## 1.2 Feature Inventory — At a Glance

| Desk | Request Types | Approval Required | Max SLA |
|:---|:---|:---:|:---:|
| **IT Support** | Get IT Help, Email Management, Report System Problem, Software Installation, New Hardware Request | Hardware only | 72 hrs |
| **HR Services** | HR Question, New Hiring Request, Employee Onboarding, Employee Offboarding | Hiring only | 48 hrs |
| **Group Finance** | Purchase Requisition, Inter-Company Chargeback, Budget Proposal | All three | 72 hrs |

**Total request types:** 12  
**Request types with multi-tier approval:** 4  
**Maximum approval tiers:** 3 (Manager → VP/Department Head → C-Level)

## 1.3 Role Matrix

| Capability | End User | Agent | Admin |
|:---|:---:|:---:|:---:|
| Submit requests | ✅ | ✅ | ✅ |
| View own requests | ✅ | ✅ | ✅ |
| View all requests | — | ✅ | ✅ |
| Update request status | — | ✅ | ✅ |
| Approve / reject requests | — | ✅ | ✅ |
| Upload documents | ✅ | ✅ | ✅ |
| Manage users | — | — | ✅ |
| Configure workflows | — | — | ✅ |
| Configure status definitions | — | — | ✅ |
| View reports | — | ✅ | ✅ |
| Manage knowledge base | — | ✅ | ✅ |
| Manage notification templates | — | — | ✅ |

## 1.4 SLA Commitments Summary

| Priority | Target Response | Target Resolution | Applies To |
|:---|:---:|:---:|:---|
| **Critical** | < 4 hours | < 24 hours | System outages, security incidents |
| **High** | < 8 hours | < 48 hours | New Hiring, Onboarding, Offboarding, Email Management |
| **Standard** | < 24 hours | < 72 hours | Hardware, Software, Finance requests |
| **Low** | < 48 hours | < 96 hours | HR Questions, informational requests |

---

# PART 2 — PLATFORM-WIDE ARCHITECTURE

## 2.1 Authentication & Access Control

The platform uses JWT-based authentication with Redis-backed token revocation.

**Authentication flow:**
1. User submits credentials → Server validates and issues a short-lived **access token** (JWT) and a long-lived **refresh token** (HttpOnly cookie)
2. All API requests include the access token in the Authorization header
3. On logout or password change, the token's `jti` claim is added to a Redis blocklist — all subsequent requests with that token are rejected
4. Refresh tokens are rotated on every use — a stolen refresh token is invalidated on its first reuse

**Authorization model (RBAC):**

| Role | Description |
|:---|:---|
| `ADMIN` | Full system access including configuration and user management |
| `AGENT` | Operational access — view and manage all tickets, run reports |
| `END_USER` | Self-service access — create and view own requests |
| `CEO / CFO / CTO` | String-checked executive roles for specific approval gates |

## 2.2 DB-Driven Workflow Engine

Request state transitions are validated against the `WorkflowTransition` table. A transition is only permitted if a record exists for the `(fromStatus, toStatus, requestTypeId)` combination.

**Benefits:**
- Admins can add or remove permitted transitions via the Admin UI without code changes
- Invalid transitions return a `400` error with a clear message
- `autoAssignRole` field on a transition can trigger automatic agent assignment when that transition occurs

**Transition validation logic:**
```
PATCH /requests/:id/status
  → Lookup WorkflowTransition WHERE fromStatus = current AND toStatus = requested AND requestTypeId = request.requestTypeId
  → If not found → 400 "Transition not permitted"
  → If found → Update status, log activity, trigger notifications
```

## 2.3 Notification Architecture

| Event | Recipient | Channel |
|:---|:---|:---|
| `REQUEST_CREATED` | Assigned agent(s), Admin | In-app + Email |
| `STATUS_CHANGED` | Requester | In-app + Email |
| `APPROVAL_REQUIRED` | Designated approver | In-app + Email (High priority) |
| `APPROVAL_DECISION` | Requester, assigned agent | In-app + Email |
| `SLA_WARNING` (50% elapsed) | Assigned agent, Team lead | In-app |
| `SLA_BREACHED` (100% elapsed) | Assigned agent, Manager | In-app (Critical) |
| `COMMENT_ADDED` | Requester + agent on ticket | In-app |
| `FILE_UPLOADED` | Assigned agent | In-app |

**SLA checker:** Runs as a background job every 15 minutes. Computes `now() > slaDueAt` for all open requests and fires `SLA_BREACHED` events where breached and not yet notified.

## 2.4 File Upload System

| Attribute | Value |
|:---|:---|
| **Max file size** | 10 MB per file |
| **Allowed image types** | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| **Allowed document types** | `application/pdf`, `application/msword`, `.docx`, `.xls`, `.xlsx` |
| **Allowed text types** | `text/plain`, `text/csv` |
| **Blocked types** | `.exe`, `.php`, `.bat`, `.sh`, any `application/javascript` |
| **Virus scanning** | Scan stub active — files flagged `isScanned: false` for manual review |
| **Storage location** | Local filesystem (S3/MinIO migration planned — Phase 2) |

## 2.5 Cross-Platform Business Rules

**R-001: Reference Number Generation**
Every submitted request receives a unique reference number in the format `{DESK}-{4-digit random}` (e.g., `IT-4921`). Reference numbers are immutable after creation.

**R-002: Audit Trail**
Every status change, comment, file upload, and approval decision is appended to the request's `RequestActivity` log with a timestamp and actor ID. This log is append-only and cannot be edited.

**R-003: SLA Clock**
The SLA clock starts at submission (`createdAt`). `slaDueAt = createdAt + requestType.slaHours`. The clock does not pause for weekends or public holidays in the current implementation (planned for Phase 2).

**R-004: Approval Hierarchy**
Multi-tier approvals follow a strict ordered chain. Level 2 cannot be actioned until Level 1 is approved. Rejection at any level terminates the chain and returns the request to a rejected state.

**R-005: Input Sanitization**
All user-submitted text fields (summary, description, comments, names) are sanitized server-side to prevent XSS injection. Rich text is stripped of script tags before storage.

## 2.6 Escalation Matrix

| Level | Trigger | Escalation Target | Response Target |
|:---|:---|:---|:---:|
| **L1 — Agent** | Ticket submitted | Assigned agent | < 4 hours |
| **L2 — Team Lead** | SLA at 50% elapsed | Department lead | < 8 hours |
| **L3 — Manager** | SLA breached (100%) | Department manager | < 24 hours |
| **L4 — Executive** | Critical system failure | CTO / CFO | Immediate |

---

# PART 3 — IT SUPPORT DESK

## 3.1 Feature Inventory

| Request Type | Category | SLA | Approval | Reference Prefix |
|:---|:---|:---:|:---:|:---:|
| Get IT Help | General Support | 24 hrs | No | IT- |
| Email Management | Account & Access | 24 hrs | No | IT- |
| Report System Problem | Incident | 48 hrs | No | IT- |
| Software Installation | Provisioning | 48 hrs | No | IT- |
| New Hardware Request | Procurement | 72 hrs | **Yes (3-tier)** | IT- |

## 3.2 User Journeys

### 3.2.1 Get IT Help

**Persona:** Sarah, a Finance Analyst whose Excel formulas are not calculating correctly.

```
STEP 1 — Submit
  Sarah logs in → IT Support → "Get IT Help"
  Fills in: Summary: "Excel formulas returning #REF error after update"
  Description: detailed steps to reproduce
  Priority: Medium
  → Submits → Reference: IT-5823

STEP 2 — Triage
  Agent receives in-app notification → reviews ticket
  Status: SUBMITTED → IN_REVIEW
  Agent adds comment: "Checking version compatibility. Will call within 2 hours."

STEP 3 — Resolution
  Agent resolves issue remotely → updates status: IN_REVIEW → RESOLVED
  Sarah receives notification: "Your request IT-5823 has been resolved."
  Sarah can view resolution notes in the activity timeline.

STEP 4 — Closure
  System auto-closes or agent closes: RESOLVED → CLOSED (after 48hrs with no reopen)
```

**Status flow:** `SUBMITTED` → `IN_REVIEW` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

---

### 3.2.2 Email Management

**Persona:** James, IT Admin, needs to create a shared mailbox for a new project team.

```
STEP 1 — Submit
  James → IT Support → "Email Management"
  Fills in: Summary: "Create shared mailbox: projectalpha@company.com"
  Members to add: 5 email addresses listed
  → Submits → Reference: IT-6102

STEP 2 — Fulfillment
  IT Agent reviews → Status: SUBMITTED → IN_PROGRESS
  Agent provisions mailbox in AD/Exchange
  Agent uploads confirmation screenshot as attachment

STEP 3 — Resolution
  Status: IN_PROGRESS → RESOLVED
  James notified. Can access mailbox immediately.
```

**Status flow:** `SUBMITTED` → `IN_REVIEW` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

---

### 3.2.3 Report System Problem

**Persona:** The entire Marketing team cannot access the CRM system after a server update.

```
STEP 1 — Submit
  Marketing Manager → IT Support → "Report System Problem"
  Fills in: System affected: CRM (Salesforce), Severity: Critical
  Description: "500 error on login for all 12 Marketing users since 09:00"
  → Submits → Reference: IT-7001

STEP 2 — Escalation
  Agent receives HIGH PRIORITY notification
  Status: SUBMITTED → IN_REVIEW
  SLA clock: 48 hours started
  If no action within 24 hours → L2 escalation to Team Lead

STEP 3 — Investigation & Fix
  Status: IN_REVIEW → IN_PROGRESS
  Agent adds updates in activity log every hour during active incident

STEP 4 — Resolution
  Root cause documented in resolution notes
  Status: IN_PROGRESS → RESOLVED
  All affected users notified
```

**Status flow:** `SUBMITTED` → `IN_REVIEW` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

---

### 3.2.4 Software Installation

**Persona:** David, a new Data Analyst, needs Power BI Desktop and Python 3.12 installed.

```
STEP 1 — Submit
  David → IT Support → "Software Installation"
  Fills in: Software: "Power BI Desktop, Python 3.12"
  Business justification: "Required for data pipeline work"
  Machine type: Windows 11 Pro
  → Submits → Reference: IT-6345

STEP 2 — Verification
  Agent checks software whitelist — both are pre-approved
  Status: SUBMITTED → IN_PROGRESS (no additional approval needed for whitelisted software)

STEP 3 — Fulfillment
  Agent deploys via SCCM/remote tools
  Confirms installation with screenshot attachment

STEP 4 — Resolution
  Status: IN_PROGRESS → RESOLVED
  David notified to restart machine
```

**Status flow:** `SUBMITTED` → `IN_REVIEW` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

---

### 3.2.5 New Hardware Request

**Persona:** Priya, Engineering Manager, needs a MacBook Pro M4 for a new senior hire starting in 3 weeks.

```
STEP 1 — Submit
  Priya → IT Support → "New Hardware Request"
  Fills in: Hardware type: MacBook Pro M4 14", Quantity: 1
  Estimated cost: SGD 3,200, Business justification: "New hire — Senior Engineer"
  Required by: 2026-05-12
  → Submits → Reference: IT-4822

STEP 2 — Manager Approval
  Priya's line manager (Michael) receives APPROVAL_REQUIRED notification
  Michael reviews request in portal → Approves with comment
  Status: SUBMITTED → PENDING_MANAGER_APPROVAL_IT → PENDING_VP_APPROVAL_IT

STEP 3 — VP Approval
  VP of Engineering receives notification → Reviews and approves
  Status: PENDING_VP_APPROVAL_IT → PENDING_CFO_APPROVAL_IT

STEP 4 — CFO Approval
  CFO reviews procurement value → Approves
  Status: PENDING_CFO_APPROVAL_IT → PROCUREMENT_IN_PROGRESS

STEP 5 — Procurement
  IT Procurement orders device
  Status: PROCUREMENT_IN_PROGRESS → HARDWARE_ORDERED
  Tracking number added as comment

STEP 6 — Receipt & Setup
  Hardware arrives → Status: HARDWARE_ORDERED → HARDWARE_RECEIVED
  IT Agent provisions device → Status: HARDWARE_RECEIVED → SOFTWARE_PROVISIONED

STEP 7 — Delivery
  Device handed to new hire → Status: SOFTWARE_PROVISIONED → RESOLVED
  Priya notified: "IT-4822 has been resolved. Device delivered."
```

**Full status flow:**
`SUBMITTED` → `PENDING_MANAGER_APPROVAL_IT` → `PENDING_VP_APPROVAL_IT` → `PENDING_CFO_APPROVAL_IT` → `PROCUREMENT_IN_PROGRESS` → `HARDWARE_ORDERED` → `HARDWARE_RECEIVED` → `SOFTWARE_PROVISIONED` → `RESOLVED` → `CLOSED`

## 3.3 Functional Specifications

### 3.3.1 New Hardware Request — Field Specification

| Field | Type | Required | Validation | Notes |
|:---|:---|:---:|:---|:---|
| `summary` | String | ✅ | Max 200 chars, sanitized | Auto-populated from form |
| `description` | Text | ✅ | Max 5,000 chars, sanitized | Business justification |
| `hardwareType` | Enum | ✅ | Pre-defined list | Laptop / Desktop / Monitor / Peripheral |
| `quantity` | Integer | ✅ | 1–10 | Single request max 10 units |
| `estimatedCost` | Decimal | ✅ | > 0, 2 decimal places | In SGD |
| `requiredByDate` | Date | ✅ | Must be > today + 7 days | Procurement lead time |
| `assignedUserId` | UUID | — | Valid user ID | Who the hardware is for |
| `attachments` | File[] | — | Max 10MB each, allowed types | Supporting quotes, specs |
| `priority` | Enum | ✅ | LOW / MEDIUM / HIGH / CRITICAL | Determines SLA urgency |

### 3.3.2 IT Support Approval Chain

| Step | Approver Role | Trigger Status | Approved Status | Rejected Status |
|:---|:---|:---|:---|:---|
| 1 | Hiring Manager / Line Manager | `SUBMITTED` | `PENDING_VP_APPROVAL_IT` | `REJECTED` |
| 2 | VP / Department Head | `PENDING_MANAGER_APPROVAL_IT` | `PENDING_CFO_APPROVAL_IT` | `REJECTED` |
| 3 | CFO | `PENDING_VP_APPROVAL_IT` | `PROCUREMENT_IN_PROGRESS` | `REJECTED` |

*Only New Hardware Request follows this approval chain. All other IT request types skip directly to `IN_REVIEW`.*

## 3.4 IT SLA Rules

| Request Type | SLA Hours | Breach Action |
|:---|:---:|:---|
| Get IT Help | 24 | Notify agent + team lead |
| Email Management | 24 | Notify agent + team lead |
| Report System Problem | 48 | Notify agent + team lead + manager |
| Software Installation | 48 | Notify agent + team lead |
| New Hardware Request | 72 | Notify agent + team lead (approval time excluded from SLA — planned Phase 2) |

## 3.5 IT Notifications Matrix

| Trigger | Recipient | Message |
|:---|:---|:---|
| Request created | IT Agents, Admin | "New IT request [IT-XXXX]: {summary}" |
| Status → IN_REVIEW | Requester | "Your request is being reviewed by our IT team." |
| Status → IN_PROGRESS | Requester | "Work has begun on your request." |
| Approval required | Designated approver | "Action required: Approve hardware request [IT-XXXX]" |
| Approval granted | Requester | "Your request has been approved and is moving to procurement." |
| Approval rejected | Requester | "Your request [IT-XXXX] was not approved. Reason: {comments}" |
| SLA warning (50%) | Assigned agent | "SLA warning: [IT-XXXX] is at 50% of its SLA window." |
| SLA breached | Agent + Manager | "URGENT: [IT-XXXX] has breached SLA." |
| Resolved | Requester | "Your request [IT-XXXX] has been resolved." |

---

# PART 4 — HR SERVICES DESK

## 4.1 Feature Inventory

| Request Type | Category | SLA | Approval | Reference Prefix |
|:---|:---|:---:|:---:|:---:|
| HR Question | General Inquiry | 24 hrs | No | HR- |
| New Hiring Request | Recruitment | 48 hrs | **Yes (2-tier)** | HR- |
| Employee Onboarding | Onboarding | 48 hrs | No | HR- |
| Employee Offboarding | Offboarding | 48 hrs | No | HR- |

## 4.2 User Journeys

### 4.2.1 HR Question

**Persona:** Marcus needs to know the maternity leave entitlement for a team member.

```
STEP 1 — Submit
  Marcus → HR Services → "Question for HR"
  Fills in: Summary: "Maternity leave entitlement query"
  Description: "Team member is 3 months pregnant. What is the paid leave entitlement?"
  → Submits → Reference: HR-2201

STEP 2 — Response
  HR Agent reviews → Status: SUBMITTED → IN_REVIEW
  Agent adds response as comment with relevant policy excerpt

STEP 3 — Resolution
  Agent marks RESOLVED with full policy answer in resolution notes
  Marcus receives notification with answer
```

**Status flow:** `SUBMITTED` → `IN_REVIEW` → `RESOLVED` → `CLOSED`

---

### 4.2.2 New Hiring Request (Full Workflow)

**Persona:** Lisa, Head of Engineering, needs to hire a Senior Backend Engineer.

```
STAGE 1 — REQUISITION
  Lisa → HR Services → "New Hiring Request"
  Fills in: Role title, department, headcount, salary band, justification
  → Submits → Reference: HR-3044
  Status: SUBMITTED

STAGE 2 — CEO APPROVAL
  CEO receives APPROVAL_REQUIRED notification
  CEO reviews: role justification, budget impact
  CEO approves → Status: SUBMITTED → CEO_APPROVED
  (If rejected → CEO_REJECTED — process ends)

STAGE 3 — JOB POSTING
  HR Agent posts job description → Status: CEO_APPROVED → JOB_POSTED
  Job is listed internally/externally

STAGE 4 — RESUME COLLECTION
  HR uploads candidate resumes against this request
  Each resume: candidate name, file, notes
  Status: JOB_POSTED → PENDING_MANAGER_REVIEW

STAGE 5 — MANAGER REVIEW
  Lisa logs in → reviews uploaded resumes
  Lisa selects preferred candidate
  Status: PENDING_MANAGER_REVIEW → MANAGER_APPROVED

STAGE 6 — INTERVIEW SCHEDULING
  HR schedules interview: date, time, location or meeting link, interviewers
  Status: MANAGER_APPROVED → INTERVIEW_SCHEDULED
  Candidate and interviewers receive notification

STAGE 7 — INTERVIEW FEEDBACK
  Post-interview: Lead interviewer submits structured feedback
  Status: INTERVIEW_SCHEDULED → INTERVIEW_FEEDBACK_PENDING
  Decision: Proceed to screening OR reject candidate
    → Rejected: CANDIDATE_REJECTED_INTERVIEW
    → Proceed: INTERVIEW_FEEDBACK_PENDING → HR_SCREENING

STAGE 8 — HR SCREENING
  HR conducts background/reference checks
  Status: HR_SCREENING

STAGE 9 — LOA WORKFLOW
  HR prepares Letter of Appointment
  Status: HR_SCREENING → LOA_PENDING_APPROVAL

  Line Manager reviews LOA terms → Approves
  Status: LOA_PENDING_APPROVAL → LOA_APPROVED

  HR issues LOA to candidate
  Status: LOA_APPROVED → LOA_ISSUED

STAGE 10 — ACCEPTANCE
  Candidate signs and uploads LOA
  Status: LOA_ISSUED → LOA_ACCEPTED

STAGE 11 — CLOSURE
  HR confirms and closes hiring ticket
  Status: LOA_ACCEPTED → COMPLETED
```

**Full status flow:**
`SUBMITTED` → `PENDING_CEO_APPROVAL` → `CEO_APPROVED` → `JOB_POSTED` → `PENDING_MANAGER_REVIEW` → `MANAGER_APPROVED` → `INTERVIEW_SCHEDULED` → `INTERVIEW_FEEDBACK_PENDING` → `HR_SCREENING` → `LOA_PENDING_APPROVAL` → `LOA_APPROVED` → `LOA_ISSUED` → `LOA_ACCEPTED` → `COMPLETED`

**Rejection branches:**
- `PENDING_CEO_APPROVAL` → `CEO_REJECTED`
- `INTERVIEW_FEEDBACK_PENDING` → `CANDIDATE_REJECTED_INTERVIEW`
- `LOA_PENDING_APPROVAL` → `HR_SCREENING` (loops back for revised LOA)

---

### 4.2.3 Employee Onboarding

**Persona:** New hire Kevin Chen starts as a Data Engineer on May 1, 2026.

```
STEP 1 — HR Initiates
  HR creates Onboarding request for Kevin
  System generates onboarding task checklist from active OnboardingTaskTemplate
  Tasks auto-assigned by role and department

STEP 2 — Task Execution
  Tasks include:
    [ ] IT: Create AD account and email
    [ ] IT: Provision laptop
    [ ] IT: Set up VPN access
    [ ] HR: Prepare employment contract
    [ ] HR: Schedule orientation session
    [ ] Facilities: Prepare workstation/access card
    [ ] Finance: Set up payroll record

STEP 3 — Completion
  Each task marked complete by assigned agent
  Progress visible to HR on request detail
  Status: IN_PROGRESS → COMPLETED when all tasks done

STEP 4 — Closure
  HR confirms onboarding complete
  Kevin receives welcome email with first-day instructions
```

**Status flow:** `SUBMITTED` → `IN_PROGRESS` → `COMPLETED` → `CLOSED`

---

### 4.2.4 Employee Offboarding

**Persona:** Tom is leaving the company. His last day is April 30, 2026.

```
STEP 1 — HR Initiates
  HR creates Offboarding request for Tom
  System generates offboarding task checklist from OffboardingTaskTemplate
  Tasks auto-assigned

STEP 2 — Task Execution
  Tasks include:
    [ ] IT: Disable AD account and email (on last day)
    [ ] IT: Revoke VPN and system access
    [ ] IT: Retrieve company laptop and devices
    [ ] HR: Process final payroll
    [ ] HR: Collect signed exit forms
    [ ] Finance: Settle expense claims
    [ ] Facilities: Collect access card and keys

STEP 3 — Completion
  All tasks completed and checked off
  Status: IN_PROGRESS → COMPLETED

STEP 4 — Audit
  Full activity log retained for compliance (IT access revocation timestamps, asset return records)
```

**Status flow:** `SUBMITTED` → `IN_PROGRESS` → `COMPLETED` → `CLOSED`

## 4.3 Functional Specifications

### 4.3.1 New Hiring Request — Field Specification

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `summary` | String | ✅ | Auto-populated as "New Hire: {roleName}" |
| `roleName` | String | ✅ | Max 100 chars |
| `department` | String | ✅ | Mapped to service desk |
| `headcount` | Integer | ✅ | 1–10 |
| `salaryBand` | String | ✅ | e.g., "SGD 8,000 – 12,000/month" |
| `startDate` | Date | ✅ | Must be > today + 14 days |
| `justification` | Text | ✅ | Business case for headcount |
| `jobDescription` | File / Text | ✅ | JD document or inline text |

### 4.3.2 Resume Upload Specification

| Field | Type | Notes |
|:---|:---|:---|
| `candidateName` | String | Required |
| `resumeFile` | File | PDF / DOCX only, max 10MB |
| `notes` | Text | Recruiter notes on the candidate |
| `uploadedById` | UUID | Agent who uploaded the resume |

### 4.3.3 Interview Schedule Specification

| Field | Type | Notes |
|:---|:---|:---|
| `candidateId` | UUID | Links to selected CandidateResume |
| `interviewDate` | Date | Required |
| `interviewTime` | String | e.g., "14:00" |
| `location` | String | Room name or "Virtual" |
| `meetingLink` | URL | Optional — for virtual interviews |
| `interviewers` | JSON Array | List of interviewer names/IDs |
| `notes` | Text | Logistics or special instructions |

### 4.3.4 HR Approval Chain

| Step | Approver | Trigger Status | Approved → | Rejected → |
|:---|:---|:---|:---|:---|
| 1 | CEO | `SUBMITTED` | `CEO_APPROVED` → `JOB_POSTED` | `CEO_REJECTED` |
| 2 | Line Manager | `LOA_PENDING_APPROVAL` | `LOA_APPROVED` | Loops back to `HR_SCREENING` |

## 4.4 HR SLA Rules

| Request Type | SLA Hours | Clock Starts |
|:---|:---:|:---|
| HR Question | 24 | Submission |
| New Hiring Request | 48 | Post-CEO approval (approval wait excluded) |
| Employee Onboarding | 48 | Submission |
| Employee Offboarding | 48 | Submission |

## 4.5 HR Notifications Matrix

| Trigger | Recipient | Message |
|:---|:---|:---|
| New hiring request created | HR Agent, Admin | "New hiring request [HR-XXXX]: {roleName}" |
| CEO approval required | CEO | "Action required: Approve new hire requisition [HR-XXXX]" |
| CEO approves | Requester, HR Agent | "Hiring request approved. Job can now be posted." |
| CEO rejects | Requester | "Hiring request [HR-XXXX] was not approved by CEO. Reason: {comments}" |
| Resumes uploaded | Hiring Manager | "Resumes ready for review on [HR-XXXX]. {count} candidate(s) submitted." |
| Interview scheduled | Interviewers, HR | "Interview scheduled for [HR-XXXX] on {date} at {time}" |
| LOA issued | HR, Line Manager | "LOA has been issued to candidate for [HR-XXXX]" |
| LOA accepted | HR, Line Manager | "Candidate has signed the LOA for [HR-XXXX]. Proceed to onboarding." |
| Onboarding task completed | HR Agent | "Task '{taskName}' completed for onboarding [HR-XXXX]" |
| All onboarding tasks done | HR Agent, Manager | "Onboarding complete for [HR-XXXX]." |

---

# PART 5 — GROUP FINANCE DESK

## 5.1 Feature Inventory

| Request Type | Category | SLA | Approval Tiers | Reference Prefix |
|:---|:---|:---:|:---:|:---:|
| Purchase Requisition | Procurement | 72 hrs | 3 (Manager → VP → CFO) | FIN- |
| Inter-Company Chargeback | Fiscal Transfer | 72 hrs | 3 (Manager → VP → CFO) | FIN- |
| Budget Proposal | Planning | 72 hrs | 3 (Manager → VP → CFO) | FIN- |

## 5.2 User Journeys

### 5.2.1 Purchase Requisition

**Persona:** Operations Manager Rachel needs to procure 20 ergonomic chairs (total SGD 14,000).

```
STEP 1 — Submit
  Rachel → Group Finance → "Purchase Requisition"
  Fills in:
    - Item description: Ergonomic office chairs (20 units)
    - Vendor: ErgoOffice Pte Ltd
    - Unit cost: SGD 700
    - Total: SGD 14,000
    - Cost centre: Operations — OPEX
    - GL code: 6500 (Office Equipment)
    - Delivery address, required-by date
  → Submits → Reference: FIN-8831

STEP 2 — Manager Approval
  Rachel's line manager receives APPROVAL_REQUIRED notification
  Manager reviews line items and budget availability
  Manager approves → Status: SUBMITTED → PENDING_VP_APPROVAL_FIN

STEP 3 — VP Approval
  VP of Operations reviews → Approves
  Status: PENDING_VP_APPROVAL_FIN → PENDING_CFO_APPROVAL_FIN

STEP 4 — CFO Approval
  CFO reviews total procurement value (SGD 14,000 exceeds SGD 5,000 threshold)
  CFO approves → Status: PENDING_CFO_APPROVAL_FIN → APPROVED

STEP 5 — Procurement Execution
  Finance team raises PO → Status: APPROVED → IN_PROGRESS
  PO number added as comment

STEP 6 — Resolution
  Delivery confirmed → Status: IN_PROGRESS → RESOLVED
  Invoice attached, GL entry posted
  Rachel notified: "Your purchase requisition FIN-8831 has been fulfilled."
```

**Full status flow:**
`SUBMITTED` → `PENDING_MANAGER_APPROVAL_FIN` → `PENDING_VP_APPROVAL_FIN` → `PENDING_CFO_APPROVAL_FIN` → `APPROVED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

---

### 5.2.2 Inter-Company Chargeback

**Persona:** Finance Controller Wei needs to charge SGD 25,000 of shared services costs from HQ to the Regional subsidiary.

```
STEP 1 — Submit
  Wei → Group Finance → "Inter-Company Chargeback"
  Fills in:
    - Charging entity: HQ (SG)
    - Receiving entity: Regional Subsidiary (MY)
    - Amount: SGD 25,000
    - Period: Q1 2026 (Jan–Mar)
    - Cost description: IT Infrastructure shared services allocation
    - Supporting schedule: PDF attachment with cost breakdown
  → Submits → Reference: FIN-9102

STEP 2–4 — Approval Chain (same 3-tier as Purchase Requisition)
  Manager → VP → CFO
  CFO approval triggers: Status → APPROVED

STEP 5 — Processing
  Finance posts journal entry
  Intercompany reconciliation document uploaded
  Status: APPROVED → IN_PROGRESS → RESOLVED
```

**Full status flow:**
`SUBMITTED` → `PENDING_MANAGER_APPROVAL_FIN` → `PENDING_VP_APPROVAL_FIN` → `PENDING_CFO_APPROVAL_FIN` → `APPROVED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

---

### 5.2.3 Budget Proposal

**Persona:** Marketing Director Aiden submits Q3 2026 campaign budget of SGD 180,000.

```
STEP 1 — Submit
  Aiden → Group Finance → "Submit Budget Proposal"
  Fills in:
    - Proposal name: Q3 2026 Marketing Campaign Budget
    - Department: Marketing
    - Period: July–September 2026
    - Total proposed: SGD 180,000
    - Line items: Digital ads / Events / Creative production
    - Supporting workbook: Excel attachment
    - Prior year comparison: included in workbook
  → Submits → Reference: FIN-9250

STEP 2–4 — Approval Chain
  Line Manager → VP of Marketing → CFO
  CFO may: Approve in full, Approve with amendments, Reject

STEP 5 — Approved Budget
  Finance records approved budget
  Status: APPROVED → RESOLVED
  Aiden notified with approved amount and any conditions
```

**Full status flow:**
`SUBMITTED` → `PENDING_MANAGER_APPROVAL_FIN` → `PENDING_VP_APPROVAL_FIN` → `PENDING_CFO_APPROVAL_FIN` → `APPROVED` → `RESOLVED` → `CLOSED`

## 5.3 Functional Specifications

### 5.3.1 Purchase Requisition — Field Specification

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `summary` | String | ✅ | Auto-populated |
| `itemDescription` | Text | ✅ | What is being purchased |
| `vendor` | String | ✅ | Vendor name |
| `quantity` | Integer | ✅ | > 0 |
| `unitCost` | Decimal | ✅ | > 0, 2 d.p., SGD |
| `totalCost` | Decimal | Computed | `quantity × unitCost` |
| `costCentre` | String | ✅ | Department cost centre code |
| `glCode` | String | ✅ | General ledger account code |
| `requiredByDate` | Date | ✅ | > today |
| `deliveryAddress` | Text | ✅ | Delivery location |
| `attachments` | File[] | ✅ | Vendor quote required |

### 5.3.2 Finance Approval Chain

| Step | Approver | Trigger | Threshold Logic |
|:---|:---|:---|:---|
| 1 | Line Manager | On submission | All Finance requests |
| 2 | VP / Department Head | Post Manager approval | All Finance requests |
| 3 | CFO | Post VP approval | All Finance requests (no threshold bypass currently) |

*Note: A threshold-based bypass (e.g., skip CFO for amounts < SGD 5,000) is a planned Phase 2 feature.*

## 5.4 Finance SLA Rules

| Request Type | SLA Hours | Notes |
|:---|:---:|:---|
| Purchase Requisition | 72 | Clock starts at submission |
| Inter-Company Chargeback | 72 | Clock starts at submission |
| Budget Proposal | 72 | Clock starts at submission |

*SLA measures fulfilment from submission to `RESOLVED`, inclusive of approval wait time. Threshold-based exclusion of approval time is planned for Phase 2.*

## 5.5 Finance Notifications Matrix

| Trigger | Recipient | Message |
|:---|:---|:---|
| Request submitted | Finance team, Admin | "New Finance request [FIN-XXXX]: {summary}" |
| L1 approval required | Line Manager | "Action required: Approve [FIN-XXXX] — {totalCost}" |
| L2 approval required | VP | "Action required: VP approval needed for [FIN-XXXX]" |
| L3 approval required | CFO | "Action required: CFO sign-off required for [FIN-XXXX]" |
| Any approval rejection | Requester | "[FIN-XXXX] was not approved at {level}. Reason: {comments}" |
| All approvals granted | Requester, Finance | "All approvals obtained. [FIN-XXXX] is being processed." |
| Resolved | Requester | "Your Finance request [FIN-XXXX] has been completed." |

---

# PART 6 — ADMIN & CONFIGURATION

## 6.1 Status Definition Management

Admins can create, edit, and deactivate request status definitions from the Admin Settings UI.

| Field | Description |
|:---|:---|
| `statusKey` | Unique machine-readable key (e.g., `PENDING_CFO_APPROVAL_FIN`) |
| `label` | Human-readable label shown in UI (e.g., "Awaiting CFO Approval") |
| `color` | Hex color for status badge |
| `description` | Internal description of what this status means |
| `isActive` | Whether this status is available for assignment |

**Business rule:** Deactivating a status that is currently in use does not affect existing requests. New requests can no longer transition to a deactivated status.

## 6.2 Workflow Transition Configuration

Admins configure which status transitions are permitted per request type.

| Field | Description |
|:---|:---|
| `requestTypeId` | Which request type this transition applies to |
| `fromStatus` | The current status |
| `toStatus` | The permitted next status |
| `label` | Action label shown on the transition button (e.g., "Send for VP Approval") |
| `requiredRole` | Role required to perform this transition |
| `autoAssignRole` | If set, auto-assigns an agent of this role when transition occurs |
| `isActive` | Toggle to enable/disable the transition without deletion |

## 6.3 User & Permissions Management

Admins can:
- Create, edit, deactivate user accounts
- Assign roles: `ADMIN`, `AGENT`, `END_USER`
- Assign executive flags: `CEO`, `CFO`, `CTO` (used for approval gates)
- Reset passwords and revoke sessions
- View per-user permission matrix

## 6.4 Banner Configuration

A system-wide announcement banner can be configured with:
- Message text (supports basic HTML)
- Display type: `info`, `warning`, `critical`
- Active/inactive toggle
- Start and end date for automatic display window

## 6.5 Template Management

### Onboarding Templates
Define task checklists that are auto-applied when a new Onboarding request is created.

| Field | Description |
|:---|:---|
| `templateName` | e.g., "Standard Engineer Onboarding" |
| `department` | Department this template applies to |
| `tasks[]` | Ordered list of tasks with title, assignedRole, dueOffsetDays |

### Offboarding Templates
Same structure as Onboarding. Applied automatically when Offboarding request is created.

## 6.6 Knowledge Base Management

Agents and Admins can:
- Create and publish KB articles
- Assign articles to categories
- Search across all articles
- Archive outdated articles

*Article versioning and "Was this helpful?" ratings are planned for Phase 2.*

---

# PART 7 — KNOWN LIMITATIONS (Internal)

*This section is for the development and operations team. It documents gaps, partial implementations, and technical debt discovered during the pre-launch audit.*

## 7.1 Critical Gaps (Must Fix Before Go-Live)

| ID | Area | Issue | Impact |
|:---|:---|:---|:---|
| **G-001** | HR Workflow | `LOA_ACCEPTED → COMPLETED` transition is missing. Hiring tickets cannot be formally closed after LOA is signed. | Hiring requests remain perpetually in `LOA_ACCEPTED` state. Audit trail incomplete. |
| **G-002** | File Storage | Files stored on local filesystem. No redundancy, no CDN, no backup strategy. | Data loss risk in production. File URLs break if server is restarted or redeployed. |
| **G-003** | Real-time Notifications | No WebSocket/SSE. Notifications are in-app but require page refresh to appear. | Agents miss time-sensitive approvals and SLA alerts without refreshing. |
| **G-004** | Email Delivery | Nodemailer is configured but email delivery is not verified in production. `SMTP_HOST` may be undefined. | No email notifications reach users. Approval chain relies on in-app only. |

## 7.2 High Priority Gaps (Fix in Sprint 1 Post-Launch)

| ID | Area | Issue | Impact |
|:---|:---|:---:|:---|
| **G-005** | SLA Engine | SLA clock does not pause during approval wait time or business hours. | Finance and HR requests appear to breach SLA even when waiting on external approvers. |
| **G-006** | Reporting | No chart visualizations. No data export (CSV/PDF). Reports page shows counts only. | Management cannot generate compliance reports or present KPI dashboards. |
| **G-007** | Concurrent Edits | No optimistic locking on request updates. Two agents editing simultaneously can overwrite each other. | Risk of lost comments/status updates under concurrent use. |
| **G-008** | Admin Workflow Builder | Workflow transitions can be configured but there is no visual builder or validation UI. Misconfiguration can create dead-end states. | Admin error can break entire request type workflows silently. |
| **G-009** | HR Approval | Approval is tracked as status changes rather than a dedicated `ApprovalQueue` object. Parallel approval (multiple approvers at same level) is not supported. | Single point of failure if designated approver is unavailable. |

## 7.3 Technical Debt

| ID | Area | Debt |
|:---|:---|:---|
| **T-001** | RequestDetail.tsx | 2,395 lines. Too large to maintain safely. Needs decomposition into sub-components. |
| **T-002** | AdminSettings.tsx | 1,805 lines. Same issue. |
| **T-003** | Executive Role Checks | CEO/CFO/CTO roles are string-checked inline rather than part of RBAC. Not manageable via Admin UI. |
| **T-004** | Background Jobs | SLA checker uses `setInterval`. Not resilient — dies silently if process crashes. Needs a proper job queue (BullMQ/pg-boss). |
| **T-005** | Search | Full-text search is SQL `ILIKE`. Does not scale past ~100k records. Elasticsearch planned but not scoped. |

---

# PART 8 — PRODUCT ROADMAP (Stakeholder)

*This section presents the enhancement pipeline for leadership and department stakeholders. Gaps from Part 7 are reframed as prioritized investments.*

## 8.1 Phase 2 — Operational Maturity (Q2–Q3 2026)

**Theme:** Close workflow gaps, harden infrastructure, add real-time capabilities.

| Initiative | Business Value | Priority |
|:---|:---|:---:|
| **Real-time notifications** (WebSocket) | Agents receive instant alerts for approvals and SLA breaches without refreshing | P0 |
| **Cloud file storage** (AWS S3 / MinIO) | Secure, scalable document storage with CDN delivery and automatic backups | P0 |
| **Email delivery verification** | Ensure all approval requests and status updates reach users reliably | P0 |
| **Hiring workflow closure** | Complete the LOA → COMPLETED transition to formally close hiring tickets | P0 |
| **SLA business-hours engine** | SLA clock respects business hours and approval wait time — fairer commitments | P1 |
| **Approval delegation** | Designate backup approvers so workflows are never blocked by unavailability | P1 |
| **Report export** (CSV / PDF) | Finance and HR can extract compliance-ready reports for audits | P1 |
| **KPI dashboard** | Visual charts for resolution time, SLA performance, and request volume by department | P1 |

## 8.2 Phase 3 — Intelligence & Collaboration (Q3–Q4 2026)

**Theme:** AI-assisted workflows, inline collaboration, and self-service optimization.

| Initiative | Business Value | Priority |
|:---|:---|:---:|
| **AI-powered ticket categorization** | Auto-suggest request type and service desk from submitted summary — reduces mis-routing | P1 |
| **Smart KB suggestions** | Surface relevant knowledge base articles during ticket creation — reduces simple tickets | P1 |
| **Inline ticket messaging** | Secure threaded chat within each ticket for agent–requester collaboration | P1 |
| **Threshold-based approval bypass** | Skip CFO approval for Finance requests below SGD 5,000 — faster low-value procurement | P2 |
| **Dynamic form logic** | "If department = Engineering, show laptop spec fields" — reduces irrelevant form fields | P2 |
| **Approval delegation UI** | Self-service out-of-office delegation in user profile settings | P2 |

## 8.3 Phase 4 — Enterprise Scale (2027)

**Theme:** Multi-tenancy, integrations, and compliance infrastructure.

| Initiative | Business Value |
|:---|:---|
| **Active Directory / SSO integration** | Single sign-on with corporate identity — no separate credentials to manage |
| **Finance ERP integration** | Auto-validate GL codes and cost centres against live ERP data |
| **Vendor portal** | External access for vendors to track Purchase Requisition status |
| **Candidate portal** | External access for job candidates to track their application status |
| **Kubernetes + Redis caching** | Handle 10× request volume without performance degradation |
| **Multilingual UI** | Support Bahasa Malaysia, Mandarin for regional subsidiaries |
| **Compliance audit reports** | Pre-built reports for MAS/ISO 27001 audits with full chain-of-custody |

## 8.4 Investment Summary

| Phase | Timeline | Theme | Investment Level |
|:---|:---|:---|:---:|
| Phase 2 | Q2–Q3 2026 | Operational Maturity | Medium |
| Phase 3 | Q3–Q4 2026 | Intelligence & Collaboration | Medium–High |
| Phase 4 | 2027 | Enterprise Scale | High |

---

*End of Document*

---

> **Document Control**
>
> | Version | Date | Author | Changes |
> |:---|:---|:---|:---|
> | 1.0 | 2026-04-22 | Platform Team | Initial release — pre-launch baseline |
