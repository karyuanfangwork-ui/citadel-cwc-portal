# CRM Enterprise Audit Findings
**citadel-cwc-portal — Malaysia Trust & Trustee Industry**
**Audit Date: 2026-05-09**
**Auditor: Claude Code (AI Enterprise Audit)**

---

## Overall Maturity Scorecard

| Dimension | Score | Verdict |
|---|---|---|
| Backend Architecture | 7.5/10 | Solid foundation; validation and ownership scoping missing |
| Frontend UX | 5.5/10 | Functional but incomplete — 4 detail pages unreachable |
| Workflow Completeness | 4.5/10 | Core flows broken by routing bugs |
| Trust Industry Fit | 3.5/10 | Generic CRM, surface-level Malaysian customization only |
| Sales Productivity | 4/10 | Too many clicks, no automation, no quick actions |
| Manager Visibility | 3/10 | No team performance views, no KPI tracking |
| Reporting & Analytics | 2/10 | Single stat card only, nothing actionable |
| Automation | 1/10 | None exists |
| Compliance Readiness | 2/10 | AML/KYC/BNM awareness absent |
| Mobile Readiness | 3/10 | Not designed for mobile-first field sales |
| **Overall CRM Maturity** | **3.8/10** | **Not production-ready for live sales operations** |

---

## Executive Summary

### What This CRM Is
A **generic B2B CRM skeleton** with sound database design (leads, contacts, accounts, opportunities, pipelines, activities, notes) but critically incomplete UX, zero automation, and no trust-industry-specific functionality.

The data model is structurally professional — multi-pipeline support, stage probability, polymorphic activities, Malaysian-specific account fields. The execution layer (UI routing, workflow automation, compliance, reporting) is largely absent.

### Business Alignment Gap
The company sells trust products (Cash Trust, estate planning, wealth protection) to Malaysian individuals and companies. A **generic B2B pipeline model is insufficient for this business**. Trust product sales are:
- Long-cycle (3–18 months), relationship-driven
- Compliance-gated (KYC, risk profiling, BNM requirements)
- Document-heavy (trust deeds, beneficiary forms, NRIC verification)
- Beneficiary-centric — a trust client has a family structure, asset schedule, beneficiaries, legal documents — none of this is modeled

### Key Strengths
- Prisma schema normalized correctly with proper indexes
- Multi-pipeline architecture is enterprise-grade
- Service layer has clean separation of concerns
- `convertLead()` uses database transactions — correct
- Audit logging on all CRM mutations
- Pagination on all list endpoints
- Zod validators defined (even if not yet wired)

### Key Weaknesses
- 4 critical routing bugs make entity detail pages unreachable
- 2 create modals missing (contacts, pipeline deals)
- No ownership/data scoping — agents see all other agents' data
- `bankAccount` stored in plaintext — financial data breach risk
- Zero automation (no reminders, alerts, SLA, escalation)
- No manager team performance view
- No trust-industry models (KYC, Beneficiary, TrustProduct)
- No PDPA compliance tracking
- No reporting beyond global stat cards

---

## Section 1 — Critical Bugs (P0 — Blockers)

### B1: Routing Bug — 4 Entity Detail Pages Unreachable

**File:** `frontend/App.tsx` lines 402–411

| Route | Current Component | Correct Component | Status |
|---|---|---|---|
| `/crm/accounts/:id` | `CrmAccounts` (list loops) | `CrmAccountDetail` | BUG |
| `/crm/contacts/:id` | `CrmContacts` (list loops) | `CrmContactDetail` | BUG |
| `/crm/leads/:id` | `CrmLeads` (list loops) | `CrmLeadDetail` | BUG |
| `/crm/opportunities/:id` | `CrmPipelineView` (kanban) | `CrmOpportunityDetail` | BUG |

**Impact:** Every individual entity is inaccessible. No agent can open a lead, view a contact, see a deal, or log an activity. The entire CRM workflow is broken.

`CrmContactDetail.tsx` (127 lines) and `CrmOpportunityDetail.tsx` (367 lines) already exist but are never mounted. `CrmAccountDetail` and `CrmLeadDetail` need to be built.

### B2: "New Contact" Button Missing

**File:** `frontend/pages/CrmContacts.tsx`

The contacts list has no create modal. Agents cannot add new contacts from the CRM. This leaves contact data orphaned to imports only.

### B3: "New Deal" Button Missing on Kanban

**File:** `frontend/pages/CrmPipeline.tsx`

The most-used action on a sales pipeline board — adding a new deal — is absent. The kanban can only receive deals via the Opportunities list, which itself requires navigating away.

### B4: Zod Validators Not Wired to Routes

**File:** `backend/src/routes/crm.routes.ts`

`crm.validator.ts` (239 lines) defines complete Zod schemas for all entities but is never imported into the routes file. All 15+ CRM endpoints accept raw unvalidated request bodies.

**Risk:** Malformed data insertion, business logic bypass, inconsistent data quality in database.

### B5: `bankAccount` Stored in Plaintext

**File:** `backend/prisma/schema.prisma` — `CrmAccount.bankAccount String?`

Bank account numbers are stored as unencrypted plain text in PostgreSQL. For a financial services company processing trust product sales, this is a **data breach liability** under Malaysia's PDPA and general financial regulations.

**Fix:** Encrypt at application level (AES-256) or mask on display (show last 4 digits only).

### B6: No Ownership Scoping on List Queries

**File:** `backend/src/controllers/crm.controller.ts` — `listAccounts()`, `listLeads()`, `listOpportunities()`

All list queries return ALL records regardless of the requesting user's ownership. Agent A can see Agent B's entire pipeline. In a competitive sales team this is both a data privacy issue and a potential for data tampering.

**Fix:** For non-admin users, add `where: { ownerId: req.user.id }` to list queries.

---

## Section 2 — High Priority Findings (P1)

### H1: No Follow-Up Due Date on Leads

The `CrmLead` model has no `followUpDate` field. Agents have no way to commit to "call this lead on Friday" and the system has no way to surface overdue follow-ups. This is the single largest driver of lead drop-off in trust product sales.

### H2: No Activity Reminder System

`CrmActivity` has `scheduledAt` but there is no notification when a scheduled activity becomes due. Scheduled activities silently pass. The existing SLA notification infrastructure (`sla.service.ts`) demonstrates the team knows how to build this — it just has not been extended to CRM.

### H3: No Daily Task/Priority View for Agents

The dashboard shows global stats (total accounts, open leads, pipeline value, win rate). It does not tell an agent: "You have 3 follow-ups due today, 2 leads uncontacted for 7 days, 1 deal past its close date."

A sales agent visiting the dashboard cannot determine what to work on.

### H4: No Manager Team Performance View

Managers see the same 4 stat cards as agents. There is no:
- Per-agent lead count, contact rate, pipeline value, closed deals
- Team conversion funnel
- Inactive lead detection
- Monthly target vs actual

Management cannot monitor, coach, or intervene in the sales process.

### H5: "My Deals" Toggle Not Wired End-to-End

`CrmDashboard.tsx` has a "My Deals" toggle but `getDashboardStats()` in `crm.service.ts` accepts no `userId` parameter. The toggle has no backend effect.

### H6: No Soft Delete

All CRM entities use hard delete. Accidental deletion of a lead, contact, or opportunity is permanent and unrecoverable. No `deletedAt` timestamp exists on any CRM model.

### H7: No Duplicate Lead Detection

No unique constraint on lead email/phone. Two agents can create duplicate leads for the same prospect with no warning. In a trust sales team where referral sources are shared, this causes attribution disputes and duplicate client contact.

---

## Section 3 — Trust Industry Compliance Gaps (P2)

### T1: No Beneficiary Model

Trust products exist to protect and distribute assets to beneficiaries. There is no `Beneficiary` model in the schema. Relationship managers cannot record who the client's beneficiaries are, their share allocation, relationship to the settlor, or their contact details. This is a **core functional gap** for the primary product being sold.

### T2: No Trust Product Record

When a client purchases a Cash Trust, there is no record of:
- Trust type (Living Trust, Testamentary Trust, Charitable Trust)
- Asset value and asset schedule
- Trust deed reference number
- Maturity/review date
- Trustee name and contact
- Beneficiary allocations

Post-sale lifecycle management is impossible without this model.

### T3: No KYC Workflow

Malaysia's Anti-Money Laundering Act (AMLA) and BNM guidelines require documented KYC before trust product purchases. There is no:
- KYC status field on contacts
- KYC document checklist
- Risk classification (Low/Medium/High)
- PEP (Politically Exposed Person) flag
- Source of funds documentation status
- KYC expiry date (refresh required periodically)

**Regulatory exposure:** Selling trust products to unverified clients is an AMLA compliance violation.

### T4: No PDPA Consent Tracking

Malaysia's Personal Data Protection Act (PDPA 2010) requires documented consent before collecting, processing, or using personal data. The `CrmContact` model has no:
- `pdpaConsent` boolean
- `pdpaConsentDate` timestamp
- `pdpaConsentMethod` (verbal/written/digital)
- `marketingOptIn` boolean

Any marketing activity conducted via this CRM without consent tracking is a PDPA violation.

### T5: No Document Management

Trust sales require: NRIC/passport copies, trust deed drafts, beneficiary consent forms, asset schedules, power of attorney documents, witness signatures. The CRM has zero document storage capability. Notes exist but cannot have file attachments.

### T6: No Individual Account Type

The `CrmAccount` model represents a company. Most trust clients are **private individuals**, not registered companies. There is no `accountType: INDIVIDUAL | CORPORATE` distinction. Forcing individual clients into the company model creates confusion and incorrect field requirements (e.g., `registrationNumber` for a personal client).

### T7: No Contact Risk Profile

Malaysian financial services regulations require a risk profile assessment before selling investment/trust products. No `riskProfile` field exists on contacts. Without this, there is no documented basis for product suitability.

### T8: NRIC/Passport Field Missing

KYC cannot be performed without an NRIC or passport number. The contact model has no such field. This is a baseline data gap for the Malaysian trust industry.

### T9: No Preferred Language Field

Malaysia is a multilingual market (English, Bahasa Malaysia, Mandarin). Without `preferredLanguage` on contacts, agents cannot prepare materials or route clients to the right relationship manager.

### T10: No Will Writing Integration

Will writing is the most common gateway product leading to trust sales. No `Will` model or will-writing workflow exists in the CRM. This is a missed pipeline entry point.

---

## Section 4 — Reporting & Analytics Gaps (P1)

### R1: No Per-Agent Performance Reports

| Report | Business Value |
|---|---|
| Monthly closed deals by agent | Commission calculation, performance management |
| Lead contact rate by agent | Activity compliance monitoring |
| Pipeline value by agent | Forecast contribution |
| Conversion rate by agent | Coaching identification |

None of these exist.

### R2: No Lead Source Effectiveness Report

8 lead sources are tracked (website, referral, cold call, LinkedIn, etc.) but there is no report showing which sources produce the most closed deals. Marketing budget allocation cannot be data-driven.

### R3: No Pipeline Forecast

No weighted pipeline forecast. No revenue projection by close date. Management cannot plan for the month or quarter.

### R4: No Win/Loss Analysis

The `lostReason` field exists on opportunities but there is no report aggregating lost reasons. Root cause analysis of deal losses is impossible.

### R5: No Sales Cycle Duration Report

No tracking of average days from lead creation to conversion to close. Cannot identify where deals stall or how to accelerate the pipeline.

---

## Section 5 — Automation Gaps (P1/P2)

### A1: No Follow-Up Reminder Automation

The single most important automation for trust sales is a reminder when a scheduled follow-up is due. Absent completely.

### A2: No Lead Aging Alert

No alert when a lead has had no activity for 7+ days. Neglected leads are invisible to managers.

### A3: No Deal Staleness Detection

No alert when an opportunity hasn't moved stages in N days. Stalled deals go undetected.

### A4: No KYC Expiry Reminder

No reminder when KYC documents are approaching expiry. Compliance violations happen silently.

### A5: No Trust Review Date Automation

Trust products have mandatory annual review dates. No automation to surface these to relationship managers.

### A6: No WhatsApp Activity Type

`CrmActivityType` supports: CALL, EMAIL, MEETING, NOTE, TASK, FOLLOW_UP. There is no `WHATSAPP` type despite WhatsApp being the dominant sales communication channel in Malaysia. Activity logs are incomplete by design.

### A7: No Lead Auto-Assignment

New leads are created without automatic assignment rules. Manual distribution creates workload imbalance and assignment delays.

---

## Section 6 — Security & Access Control Findings

### S1: Bank Account Data in Plaintext (HIGH)

`CrmAccount.bankAccount` stored as plain text string. Encrypt at application layer or mask to last 4 digits.

### S2: No Data Ownership Scoping (HIGH)

All agents can query all accounts, leads, and opportunities regardless of ownership assignment. Implement `ownerId` filter in list queries for non-admin roles.

### S3: Input Validation Absent (HIGH)

Zod schemas defined but not applied. All CRM API endpoints accept raw unvalidated input. Wire validators as middleware immediately.

### S4: No Export Audit Logging (MEDIUM)

No logging of bulk data exports or list queries on sensitive client records. Financial services companies require audit trails for data access events.

### S5: No Data Retention Policy (LOW)

No automated enforcement of data retention periods. PDPA requires personal data not be kept longer than necessary. No `retainUntil` or `deletedAt` timestamps exist.

---

## Section 7 — UX/UI Findings

### UX1: Detail Pages Unreachable (P0)

Covered in B1. Every click on a list row that should open a detail view instead loops back to the same list.

### UX2: Dashboard Is Not Actionable (P1)

4 stat cards show totals. No prioritized task list, no urgency indicators, no "what to do now" guidance for agents.

### UX3: Lead Cards Missing Context (P1)

Lead cards show: title, company, estimated value, status badge, source badge.
Missing: last contacted date, follow-up due date, owner avatar, days since created.
Agents cannot assess lead urgency without opening each card (which is broken anyway).

### UX4: No Global Search (P2)

No search across all CRM entities. Finding a specific contact requires navigating to contacts, scrolling through the table, and filtering manually.

### UX5: Mobile Layout Not Designed (P2)

Table layouts in Contacts and Opportunities pages do not collapse for mobile. Lead cards use 3-column CSS grid which breaks on small screens. Field sales agents on mobile cannot use the system effectively.

### UX6: No Urgency Visual Hierarchy (P2)

All leads and deals are displayed with equal visual weight. An overdue deal and a freshly-created lead look identical. No color coding, urgency badges, or priority indicators exist.

### UX7: No Empty State Onboarding (P3)

When a new user opens the CRM for the first time, empty tables and blank dashboards give no guidance on how to start. No "Create your first lead" prompt or walkthrough.

---

## Summary Finding Table

| ID | Severity | Category | Finding | Fix In |
|---|---|---|---|---|
| B1 | P0 CRITICAL | Routing | 4 detail page routes broken | Phase 1 |
| B2 | P0 CRITICAL | UI | No "New Contact" modal | Phase 1 |
| B3 | P0 CRITICAL | UI | No "New Deal" on kanban | Phase 1 |
| B4 | P0 CRITICAL | Security | Zod validators not wired | Phase 1 |
| B5 | P0 CRITICAL | Security | bankAccount in plaintext | Phase 1 |
| B6 | P0 CRITICAL | Security | No ownership scoping | Phase 1 |
| H1 | P1 HIGH | Workflow | No follow-up date on leads | Phase 2 |
| H2 | P1 HIGH | Automation | No activity reminders | Phase 2 |
| H3 | P1 HIGH | UX | No daily priority view | Phase 2 |
| H4 | P1 HIGH | Reporting | No manager team view | Phase 2 |
| H5 | P1 HIGH | UX | My Deals toggle not wired | Phase 2 |
| H6 | P1 HIGH | Data | No soft delete | Phase 2 |
| H7 | P1 HIGH | Data | No duplicate detection | Phase 2 |
| T1 | P2 MEDIUM | Industry | No Beneficiary model | Phase 3 |
| T2 | P2 MEDIUM | Industry | No TrustProduct model | Phase 3 |
| T3 | P2 MEDIUM | Compliance | No KYC workflow | Phase 3 |
| T4 | P2 MEDIUM | Compliance | No PDPA consent tracking | Phase 2 |
| T5 | P2 MEDIUM | Industry | No document attachments | Phase 3 |
| T6 | P2 MEDIUM | Industry | No individual account type | Phase 2 |
| T7 | P2 MEDIUM | Compliance | No contact risk profile | Phase 3 |
| T8 | P2 MEDIUM | Compliance | No NRIC/passport field | Phase 2 |
| T9 | P2 MEDIUM | UX | No preferred language field | Phase 2 |
| T10 | P2 MEDIUM | Industry | No will writing pipeline | Phase 4 |
| R1 | P1 HIGH | Reporting | No per-agent performance | Phase 3 |
| R2 | P1 HIGH | Reporting | No lead source effectiveness | Phase 3 |
| R3 | P1 HIGH | Reporting | No pipeline forecast | Phase 3 |
| R4 | P2 MEDIUM | Reporting | No win/loss analysis | Phase 3 |
| A1 | P1 HIGH | Automation | No follow-up reminders | Phase 2 |
| A2 | P1 HIGH | Automation | No lead aging alerts | Phase 2 |
| A3 | P1 HIGH | Automation | No deal staleness detection | Phase 2 |
| A4 | P2 MEDIUM | Compliance | No KYC expiry reminder | Phase 3 |
| A5 | P2 MEDIUM | Industry | No trust review reminders | Phase 3 |
| A6 | P1 HIGH | Data | No WhatsApp activity type | Phase 2 |
| A7 | P2 MEDIUM | Automation | No lead auto-assignment | Phase 3 |
| S1 | P0 CRITICAL | Security | bankAccount plaintext | Phase 1 |
| S2 | P0 CRITICAL | Security | No ownership scoping | Phase 1 |
| S3 | P0 CRITICAL | Security | Validators not applied | Phase 1 |
| S4 | P2 MEDIUM | Security | No export audit log | Phase 3 |
| UX1 | P0 CRITICAL | UX | Detail pages unreachable | Phase 1 |
| UX2 | P1 HIGH | UX | Dashboard not actionable | Phase 2 |
| UX3 | P1 HIGH | UX | Lead cards missing context | Phase 2 |
| UX4 | P2 MEDIUM | UX | No global search | Phase 3 |
| UX5 | P2 MEDIUM | UX | Mobile layout broken | Phase 3 |
| UX6 | P2 MEDIUM | UX | No urgency hierarchy | Phase 2 |
| UX7 | P3 LOW | UX | No empty state onboarding | Phase 4 |
