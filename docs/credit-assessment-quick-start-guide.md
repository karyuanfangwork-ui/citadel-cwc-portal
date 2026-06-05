# CWC Credit Assessment Module — Quick Start Guide

> **Version:** 1.2 | **Last Updated:** June 2026 | **Audience:** Staff & Stakeholders

---

## Who Should Read This?

Find your role below and jump straight to your journey:

| Your Role | Start Here |
|---|---|
| **Relationship Manager (RM)** | [Journey 1 — Create an Application](#journey-1-rm-creates-a-new-credit-application) · [Journey 7 — Manage Borrowers](#journey-7-borrower-profile-management) |
| **KYC / Compliance Officer** | [Journey 2 — KYC Review](#journey-2-kyc-officer-reviews-application) |
| **Credit Analyst / Underwriter** | [Journey 3 — Credit Assessment](#journey-3-underwriter-performs-credit-assessment) |
| **Committee Member / Approver** | [Journey 4 — Committee Review](#journey-4-committee-member-reviews--votes) |
| **Operations** | [Journey 5 — Post-Approval & Disbursement](#journey-5-post-approval--disbursement) |
| **Credit Manager** | [Journey 6 — Dashboard & Portfolio](#journey-6-dashboard--portfolio-monitoring) |
| **New to the module?** | Read [Section 1](#1-module-overview) and [Section 2](#2-access--navigation) first |

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Access & Navigation](#2-access--navigation)
3. [User Journeys](#3-user-journeys)
4. [Application Lifecycle](#4-application-lifecycle)
5. [Approval Workflow](#5-approval-workflow)
6. [CA Memo Structure](#6-ca-memo-structure)
7. [Feature Reference](#7-feature-reference)
8. [Permissions & Roles](#8-permissions--roles)
9. [Data Security & Compliance](#9-data-security--compliance)
10. [Key Concepts & Glossary](#10-key-concepts--glossary)
11. [Frequently Asked Questions](#11-frequently-asked-questions)
12. [Getting Access & Support](#12-getting-access--support)

---

## 1. Module Overview

The Credit Assessment module is a full-lifecycle credit origination and assessment system within CWC (Citadel Workplace Connect). It handles everything from borrower intake and KYC review through financial analysis, risk scoring, committee approval, and post-disbursement monitoring — all in one integrated platform.

### What It Delivers

| Capability | Description |
|---|---|
| **Borrower Management** | Create and maintain borrower profiles (individual, corporate, joint, sole proprietor) with directors, shareholders, and UBOs |
| **Application Intake** | Wizard-based application creation with smart defaults, product-type selection, and facility structuring |
| **KYC & Compliance** | Bureau checks, AML screening, document verification, and PII encryption |
| **Financial Spreading** | Financial statement upload, spreading (BS/PL/CF), and ratio computation |
| **Risk Scoring** | Configurable scorecards with factor groups, weight bands, and risk rating derivation |
| **Approval Chain** | Multi-tier approval matrix (RM → Senior Manager → Committee) with delegation of authority |
| **Committee Review** | Meeting scheduling, agenda management, quorum, and voting |
| **CA Memo** | 7-section Credit Assessment Memo with PDF generation |
| **Conditions & Covenants** | Tracking of conditions precedent/subsequent and financial covenants |
| **Post-Disbursement Monitoring** | Facility health tracking, early warning signals, and covenant compliance |
| **Dashboard & Reports** | Pipeline metrics, SLA monitoring, aging analysis, and portfolio reports |
| **Data Security** | AES-256-GCM PII encryption, hash-chain audit trail, DLP export control |

---

## 2. Access & Navigation

### Getting There

1. Log in to CWC at [https://cwc.citadelgroup.com.my/login](https://cwc.citadelgroup.com.my/login)
2. Click the **"More"** dropdown in the main navigation bar
3. Select **Credit** from the dropdown menu

### Test Accounts

| Role | Email | Password | Access Level |
|---|---|---|---|
| Admin | `admin@test.local` | `abc@123` | Full access (all features) |
| HR / Analyst | `hr@test.local` | `abc@123` | Read/write access |
| CEO | `ceo@test.local` | `abc@123` | Approval authority |
| Group Deputy CEO | `groupceo@company.com` | `groupceo123` | Group-level approval |

### Credit Navigation Bar

Once inside the Credit module, a secondary navigation bar provides access to all sections:

| Tab | Label | Permission Required |
|---|---|---|
| `/credit` | Dashboard | — |
| `/credit/borrowers` | Borrowers | — |
| `/credit/applications` | Applications | — |
| `/credit/approvals` | My Approvals | `credit:approve` |
| `/credit/committee` | Committee | `credit:read` |
| `/credit/scorecards` | Scorecards | `credit:admin` |
| `/credit/analysis` | Analysis | `credit:read` |
| `/credit/reports` | Reports | `credit:read` |

> Financials and Collateral are accessed via tabs inside individual application detail pages, not top-level nav items.

---

## 3. User Journeys

### Journey 1: RM Creates a New Credit Application

**Persona:** Relationship Manager (RM)  
**Test Account:** `admin@test.local` / `abc@123`

1. Navigate to **Credit → Applications**
2. Click **"+ New Application"** button
3. The **Application Wizard** opens with 3 steps:
   - **Step 1 — Loan & Borrower:** Select or create a borrower, choose product type, enter requested amount and tenor
   - **Step 2 — Risk & Mitigants:** Fill in financials or retail income, risk score, bureau checks, industry, mitigants
   - **Step 3 — Decision:** Collateral, security, approvals, sign-off, conditions
4. Smart defaults are applied automatically:
   - Currency derived from borrower's domicile country
   - Tenor defaults by product type (e.g., Term Loan = 60 months)
   - RM auto-assigned to current user
5. Save as **DRAFT** at any point, or proceed to completion
6. When all required sections are filled, click **Submit** to move the application to `SUBMITTED` state

#### Retail vs Corporate — Key Differences

The wizard adapts based on the **Borrower Type** selected. The two main paths are:

| Section | Corporate / Joint (`CORPORATE`) | Retail / Individual (`INDIVIDUAL`, `SOLE_PROPRIETOR`) |
|---|---|---|
| **Step 1 — Borrower Profile** | Company registration number required + at least one director or party | Borrower type alone is sufficient (NRIC is held on the linked CRM Contact) |
| **Step 1 — Parties tab** | "Directors & UBOs" — add directors, shareholders, and UBOs | "Guarantors & Parties" — add guarantors and co-borrowers only; no directors required |
| **Step 2 — Financials** | Upload 3-year financial statements (Balance Sheet, P&L, Cash Flow) for spreading | **Retail Income** tab instead — enter employment type, monthly gross income, EPF contributions, and monthly commitments. Cross-check against payslip / bank statements before verifying |
| **Step 2 — Risk Score** | Corporate scorecard weights (Debt Service, Leverage, Profitability, etc.) | Retail scorecard weights (separate factor group set) |
| **Step 3 — Collateral** | Required if the facility is secured; optional for unsecured lending | Same rules apply |

> **Corporate Walkthrough:** "I select the borrower — a registered company. The wizard asks for the SSM registration number. I add the three directors under the Directors & UBOs tab. Under Financials, I upload three years of audited accounts and the system computes the ratios automatically."

> **Retail Walkthrough:** "I select the borrower — an individual. The wizard does not ask for a registration number or directors. Under Financials, I see the Retail Income tab instead — I enter the borrower's employment type (Salaried), monthly gross income of RM8,000, EPF contribution, and total monthly commitments. The system computes DSR for me. I mark it as verified once I've checked against the payslip."

### Journey 2: KYC Officer Reviews Application

**Persona:** KYC / Compliance Officer  
**Test Account:** `it@test.local` / `abc@123`

1. Application is in `KYC_REVIEW` state
2. Navigate to **Credit → Applications** and filter by `KYC_REVIEW`
3. Open the application detail page
4. Review the **Borrower Profile & KYC** tab
5. Review the **Bureau Checks** tab — verify all required checks are completed
6. Review uploaded **Documents** — verify NRIC, financial statements, etc.
7. Take one of two actions:
   - **Approve** → Application moves to `KYC_APPROVED`, then `UNDERWRITING`
   - **Return** → Application goes back to `DRAFT` with a comment explaining what needs correction
   - **Reject** → Application moves to `KYC_REJECTED`

### Journey 3: Underwriter Performs Credit Assessment

**Persona:** Credit Analyst / Underwriter  
**Test Account:** `admin@test.local` / `abc@123`

1. Application is in `UNDERWRITING` or `CREDIT_ASSESSMENT` state
2. Open the application detail page
3. Work through the tabs:
   - **Financials:** Upload financial statements, review spreading, check ratios
   - **Risk Score & Rating:** Run the scoring model, verify the computed risk rating
   - **Payment Capability:** Review income, cash flow, DSCR
   - **Bureau Checks:** Review bureau reports (CTOS, CCRIS borrower self-pull via eCCRIS, Experian RAMCI, Credit Bureau Malaysia, etc.)
   - **Industry Outlook:** Assess sector risk
   - **Risk & Mitigators:** Document risks and mitigating factors
4. Navigate to **Collateral** tab — add collateral items with valuations
5. Navigate to **Security & Guarantees** — add guarantee details
6. All findings are compiled into the **CA Memo** structure
7. When assessment is complete, advance the state to `COMMITTEE_REVIEW`

### Journey 4: Committee Member Reviews & Votes

**Persona:** Committee Member  
**Test Account:** `ceo@test.local` / `abc@123`

1. Navigate to **Credit → Approvals** (My Approvals)
2. See pending applications requiring your approval
3. Open an application in `COMMITTEE_REVIEW` state
4. Review the CA Memo and all supporting tabs
5. Record your decision:
   - **Approve** — Application advances toward `APPROVED`
   - **Reject** — Application moves to `REJECTED`
   - **Return** — Application goes back to the previous state
   - **Escalate** — Application escalates to the next authority tier
   - **Defer** — Decision postponed, SLA timer paused

### Journey 5: Post-Approval & Disbursement

**Persona:** Operations / RM  
**Test Account:** `admin@test.local` / `abc@123`

1. After all required approvals, application is in `APPROVED` state
2. Navigate to **Conditions** tab — ensure all conditions precedent are met
3. Generate the **CA Memo PDF** or **Approval Pack PDF** for archiving
4. Advance through: `APPROVED` → `OFFER` → `ACCEPTED` → `DISBURSED`
5. Once disbursed, the application enters `ACTIVE` monitoring
6. Navigate to **Monitoring** tab to set up:
   - Facility health checks (healthy, watch, at risk, default)
   - Early warning signals (covenant breach, payment overdue, etc.)
   - Covenant compliance tracking

### Journey 6: Dashboard & Portfolio Monitoring

**Persona:** Credit Manager  
**Test Account:** `admin@test.local` / `abc@123`

1. Navigate to **Credit → Dashboard**
2. See key metrics at a glance:
   - Total applications by state (pipeline)
   - SLA compliance and breaches
   - Approver queue (pending decisions)
3. Click **Pipeline** to see detailed funnel metrics
4. Click **SLA** to see breach reports
5. Navigate to **Credit → Reports** for:
   - Portfolio overview report
   - Aging analysis (performing, watch, impaired)
   - SLA breach report (filterable by product type, date range)

### Journey 7: Borrower Profile Management

**Persona:** Relationship Manager (RM)  
**Test Account:** `admin@test.local` / `abc@123`

#### Step-by-Step Flow

**Step 1 — Navigate to Borrowers**

1. Log in at [https://cwc.citadelgroup.com.my/login](https://cwc.citadelgroup.com.my/login)
2. Click **"More"** in the main navigation → select **Credit**
3. Click **Borrowers** in the Credit sub-navigation

**Step 2 — Create a New Borrower Profile**

1. Click **"+ New Borrower"** button
2. Fill in the borrower details:
   - **Borrower Type** — choose from:
     | Type | When to Use |
     |---|---|
     | `INDIVIDUAL` | Personal loans, sole applicants |
     | `CORPORATE` | Companies, partnerships, societies |
     | `JOINT` | Multiple applicants on one facility |
     | `SOLE_PROPRIETOR` | Individual trading under a business name (validator default) |

3. **Core Profile Fields:**
   | Field | Required | Encrypted | Notes |
   |---|---|---|---|
   | Borrower Type | Yes (defaults to CORPORATE) | No | Determines which sub-sections appear |
   | Account ID | No | No | Link to an existing CRM Account (optional) |
   | Contact ID | No | No | Link to an existing CRM Contact (optional) |
   | Credit Risk Rating | No | No | AAA through D, or NR (Not Rated). Assigned later by scoring |
   | AML Risk Tier | No | No | LOW, MEDIUM, HIGH, PROHIBITED |
   | Exposure Limit | No | No | Total approved exposure cap (MYR) |
   | Total Exposure | No | No | Current total exposure across all applications |
   | Is Sanctioned Entity | No (defaults false) | No | Flags sanctioned entities for enhanced due diligence |
   | Annual Income | No | **Yes (AES-256-GCM)** | PII — encrypted at rest |
   | Net Worth | No | **Yes (AES-256-GCM)** | PII — encrypted at rest |
   | Source of Wealth | No | **Yes (AES-256-GCM)** | PII — encrypted at rest |
   | Purpose of Account | No | No | Free text |
   | Occupation | No | No | For individual borrowers |
   | Employer | No | No | For individual borrowers |

4. Click **Save** — the borrower profile is created

**Step 3 — Add Directors, Shareholders & UBOs (for Corporate borrowers)**

After creating the profile, add related persons:

| Sub-Section | Route | Required Fields | Key Detail |
|---|---|---|---|
| **Directors** | `/credit/borrowers/:id/directors` | Name, Position | NRIC/Passport is **encrypted at rest**. Flag `isExecutive` and `isKeyManagement` |
| **Shareholders** | `/credit/borrowers/:id/shareholders` | Name, Shareholding %, Share Class | Track ownership structure |
| **UBOs** | `/credit/borrowers/:id/ubos` | Name, Ownership %, Is PEP | Ultimate Beneficial Owners (25%+ ownership). Source of Wealth is **encrypted**. PEP = Politically Exposed Person |

**Step 4 — Upload Supporting Documents**

1. Navigate to the **Documents** tab on the borrower profile
2. Upload documents with classification:
   - NRIC / Passport (NRIC_PASSPORT)
   - SSM Certificate (SSM_CERT)
   - Memorandum & Articles (MEMORANDUM_ARTICLES / MOA_AOA)
   - Audited Financials (AUDITED_FINANCIALS)
   - Bank Statements (BANK_STATEMENT)
   - Tax Returns (TAX_RETURN)
   - Business Plan (BUSINESS_PLAN)
   - Board Resolution (BOARD_RESOLUTION)
   - Other (OTHER)
3. Each document can be **verified** or **rejected** by users with `credit:approve`

**Step 5 — Link to CRM (Optional)**

- If the borrower corresponds to an existing CRM Account or Contact, link them via `accountId` or `contactId`
- This enables cross-module visibility between Credit and CRM

#### What Happens Automatically

| Automation | Trigger | Effect |
|---|---|---|
| **PII Encryption** | On create/update | `annualIncome`, `netWorth`, `sourceOfWealth`, `nricPassport` fields are encrypted via AES-256-GCM middleware before database write. They are decrypted on read for authorized users. |
| **Connected Party Detection** | When an application is created or updated | System checks if the borrower (via shared directors, shareholders, or UBOs) belongs to a Related Party Group. If flagged, `connectedPartyFlag` is set to `true` on the application, requiring enhanced review. |
| **AML Sanction Screening** | On profile creation | If `isSanctionedEntity` is flagged, the application flow requires enhanced due diligence. |
| **Auto RM Assignment** | On application creation | If the current user holds `credit:rm` role, they are auto-assigned as the RM. |
| **Audit Trail** | Every state change, approval, document action | Immutable `CreditAuditEvent` with hash-chain for tamper evidence. |

#### Permission Gates for Borrower Onboarding

| Action | Required Permission | Who Can Do This |
|---|---|---|
| List / View borrowers | `credit:read` | All credit users |
| Create a borrower profile | `credit:create` | RM, Admin only |
| Update a borrower profile | `credit:write` | RM, Analyst |
| Delete a borrower profile | `credit:admin` | Admin only (soft delete) |
| Verify / Reject documents | `credit:approve` | Approver, Committee |
| Override connected party flag | `credit:admin` | Admin only |

> **Walkthrough Script:** "I log in and go to Credit → Borrowers. I click '+ New Borrower'. I select 'Corporate' as the type. I fill in the company name, SSM number, and link it to an existing CRM account. I enter the annual income — notice it's encrypted at rest, so it won't appear in database exports. I add the company's three directors — their NRIC numbers are also encrypted. I add two shareholders with their shareholding percentages. I identify one UBO who holds 30% ownership and flag them as a PEP — Politically Exposed Person. I upload the SSM certificate and audited financials. When I create a credit application for this borrower next, the system automatically checks if any of these directors or shareholders appear in other companies — if they do, the connected party flag is set and the committee will review it during approval."

---

## 4. Application Lifecycle

### State Machine

The credit application follows a 16-state workflow with 24+ transitions:

```
DRAFT ──submit──▶ SUBMITTED
  │                  │
  │              (KYC review)
  │                  ▼
  │              KYC_REVIEW ──approve──▶ KYC_APPROVED
  │                  │                       │
  │              (reject)              (underwrite)
  │                  ▼                       ▼
  │              KYC_REJECTED          UNDERWRITING
  │                  │                       │
  │              (resubmit)            (assess credit)
  │                  ▼                       ▼
  │              SUBMITTED          CREDIT_ASSESSMENT
  │                                        │
  │                                 (committee review)
  │                                        ▼
  │                               COMMITTEE_REVIEW
  │                                  │       │
  │                          (approve)   (reject)
  │                                  ▼       ▼
  │                              APPROVED  REJECTED
  │                                  │       │
  │                          (offer)   (resubmit→DRAFT)
  │                                  ▼
  │                              OFFER
  │                                  │
  │                          (accept)
  │                                  ▼
  │                              ACCEPTED
  │                                  │
  │                          (disburse)
  │                                  ▼
  │                              DISBURSED
  │                                  │
  │                          (activate)
  │                                  ▼
  ◀──withdraw──────          ACTIVE ──close──▶ CLOSED

Any non-terminal state can transition to WITHDRAWN (requires comment).
Return paths: KYC_REVIEW→DRAFT, UNDERWRITING→KYC_APPROVED
```

### SLA-Paused States

SLA timer pauses during these review states:
- `KYC_REVIEW`
- `UNDERWRITING`
- `CREDIT_ASSESSMENT`
- `COMMITTEE_REVIEW`

### State Colors (UI)

| State | Color | Label |
|---|---|---|
| DRAFT | Gray | Draft |
| SUBMITTED | Blue | Submitted |
| KYC_REVIEW | Amber | KYC Review |
| KYC_APPROVED | Green | KYC Approved |
| KYC_REJECTED | Red | KYC Rejected |
| UNDERWRITING | Amber | Underwriting |
| CREDIT_ASSESSMENT | Orange | Credit Assessment |
| COMMITTEE_REVIEW | Purple | Committee Review |
| APPROVED | Green | Approved |
| REJECTED | Red | Rejected |
| OFFER | Teal | Offer |
| ACCEPTED | Green | Accepted |
| DISBURSED | Green | Disbursed |
| ACTIVE | Green | Active |
| CLOSED | Gray | Closed |
| WITHDRAWN | Gray | Withdrawn |

---

## 5. Approval Workflow

### 3-Tier Approval Matrix

The system uses a tiered approval matrix based on **total exposure amount** and **risk rating**. All risk ratings (AAA through D) are covered at each tier.

| Tier | Name | Exposure Range | Authority Level | Required Approvers |
|---|---|---|---|---|
| 1 | RM Authority | MYR 0 – 499,999 | `CREDIT_RM` | 1 |
| 2 | Senior Manager Authority | MYR 500,000 – 4,999,999 | `CREDIT_MANAGER` | 2 |
| 3 | Committee Authority | MYR 5,000,000+ | `CREDIT_COMMITTEE` | 3 |

### Approval Decision Types

| Decision | Code | Effect |
|---|---|---|
| Approve | `APPROVE` | Advances application toward approval |
| Reject | `REJECT` | Moves application to `REJECTED` state |
| Return | `RETURN` | Sends application back to previous state with comments |
| Escalate | `ESCALATE` | Moves application to next approval authority tier |
| Defer | `DEFER` | Postpones decision, SLA timer pauses |

### Delegation of Authority

- An approver can delegate their authority to another user for a specified time period
- Delegated authority respects the same matrix rules as the original approver
- Navigate to **Credit → Settings → Delegation** (requires `credit:admin`)

---

## 6. CA Memo Structure

The Credit Assessment Memo is organized into 7 sections across 3 steps, plus metadata and advanced tabs:

### Step 1 — Loan & Borrower

| Tab | Description |
|---|---|
| **Loan Request** | Product type, amount, tenor, currency, purpose |
| **Borrower Profile & KYC** | Borrower details, KYC status |
| **Directors & UBOs** | Directors, shareholders, UBOs, co-borrowers, guarantors |

### Step 2 — Risk & Mitigants

| Tab | Description |
|---|---|
| **Financials** | Financial statement spreading (BS/PL/CF), ratio computation |
| **Risk Score & Rating** | Scorecard results, risk rating derivation |
| **Payment Capability** | Income, cash flow, DSCR analysis |
| **Bureau Checks** | CTOS, CCRIS, BNM screening results |
| **Industry Outlook** | Sector risk, industry assessment |
| **Risk & Mitigators** | Risk factors and mitigating actions |

### Step 3 — Decision

| Tab | Description |
|---|---|
| **Collateral** | Collateral items, valuations, forced sale values, margins |
| **Security & Guarantees** | Security documentation, guarantee details |
| **Approvals** | Approval decisions and progress tracking |
| **Sign-off** | Prepared/Reviewed/Concurred sign-off |
| **Conditions Precedent** | Conditions precedent and subsequent |
| **Summary** | Consolidated CA Memo summary |

### Operations Tabs (Step 3)

| Tab | Description |
|---|---|
| **Documents** | All uploaded documents with verification status |
| **Audit Trail** | Hash-chain tamper-evident audit log |

### Advanced Tabs (enabled by administrator)

These tabs are visible only when your administrator has enabled the Advanced CA Memo feature:

| Tab | Description |
|---|---|
| **Risk Rating & ECL** | MFRS 9 staging, ECL snapshots and forecasts |
| **Profitability** | Account profitability analysis |
| **Counterparties** | Key counterparties (suppliers, buyers, competitors) |
| **Account Conduct** | Wallet share, account utilisation |
| **ESG / SICR / FL Risk** | ESG, SICR, and forward-looking risk assessments |
| **Header & Background** | CA Memo header fields, application background |

---

## 7. Feature Reference

### 7.1 Borrower Profiles

- Create individual, corporate, joint, or sole proprietor profiles
- Manage directors, shareholders, and UBOs
- PII fields encrypted at rest (AES-256-GCM): annual income, net worth, source of wealth, NRIC/passport
- Link to CRM accounts and contacts
- Document upload with classification (NRIC, financials, corporate, etc.)

**Supported Borrower Types:**

| Code | Label |
|---|---|
| `INDIVIDUAL` | Individual |
| `CORPORATE` | Corporate |
| `JOINT` | Joint |
| `SOLE_PROPRIETOR` | Sole Proprietor |

### 7.2 Credit Documents

- Upload documents per borrower or per application
- Document classification: Financial, Legal, Corporate, Supporting, Collateral, KYC, Other
- Document versions (upload new versions, view history)
- Verification workflow: Pending → Verified or Rejected
- Automatic virus and data-loss-prevention scanning on every upload
- Download and share with export tokens (time-limited, audited)

**Commonly Used Document Types:**

| Type | Description |
|---|---|
| NRIC / Passport | Identity document for individuals or directors |
| Audited Financials | Audited financial statements (company) |
| Management Accounts | Unaudited interim accounts |
| Bank Statement | Bank statements (3–6 months) |
| Payslip | Pay slips for individual borrowers |
| SSM Certificate | Company registration certificate |
| Valuation Report | Collateral property valuation |
| Guarantee Letter | Personal or corporate guarantee |
| Other | Any supporting document not listed above |

> Additional document types (Board Resolution, MOA/AOA, Credit Bureau Reports, etc.) are available when uploading — select the type that best describes the document.

### 7.3 Financial Spreading

- Upload financial statements (Balance Sheet, Profit & Loss, Cash Flow)
- Annual or quarterly periods
- Statement status workflow: `DRAFT` → `REVIEWED` → `APPROVED`
- Automatic ratio computation:
  - Profitability ratios
  - Leverage ratios
  - Liquidity ratios
  - Coverage ratios
  - Activity ratios

### 7.4 Risk Scoring

- Configurable scorecard templates with 9 factor groups and weighted scoring
- Scorecard factor groups:
  - Debt Service (18%)
  - Profitability (15%)
  - Leverage (14%)
  - Liquidity (13%)
  - Coverage (12%)
  - Activity (10%)
  - Management Quality (8%)
  - Industry Risk (6%)
  - Collateral Quality (4%)
- Score-to-rating mapping:

| Score Range | Risk Rating |
|---|---|
| 90–100 | AAA |
| 80–89 | AA |
| 70–79 | A |
| 60–69 | BBB |
| 50–59 | BB |
| 40–49 | B |
| 30–39 | CCC |
| 20–29 | CC |
| 10–19 | C |
| 0–9 | D |
| N/A | NR (Not Rated) |

- Score overrides require `credit:admin` approval

### 7.5 Committee

- Schedule committee meetings with quorum requirements
- Add agenda items (applications for review)
- Committee members vote: Approve, Reject, or Abstain
- Formal voting flow available via `credit:committee_formal` feature flag

### 7.6 Collateral & Security

- Collateral types: Property, Vehicle, Fixed Deposit, Securities, Guarantee Deposit, Other
- Track market value, forced sale value, and margin percentage
- Guarantees: Personal, Corporate, Bank
- Insurance tracking and valuation history

### 7.7 Conditions & Covenants

| Type | Description |
|---|---|
| **Conditions Precedent** | Must be met before disbursement |
| **Conditions Subsequent** | Must be met after disbursement |

| Status | Meaning |
|---|---|
| `PENDING` | Not yet fulfilled |
| `COMPLETED` | Fulfilled |
| `WAIVED` | Condition waived by authority |
| `EXPIRED` | Condition lapsed |

**Covenants** have frequencies (quarterly, semi-annually, annually) with threshold monitoring.

### 7.8 Monitoring (Post-Disbursement)

| Feature | Description |
|---|---|
| **Facility Health** | Health status tracking: Healthy, Watch, At Risk, Default |
| **Early Warning Signals** | Signal types: Covenant Breach, Payment Overdue, Review Overdue, Financial Deterioration, Collateral Valuation Stale, Insurance Expiry |
| **Signal Severity** | Low, Medium, High, Critical |
| **Payment Status** | On Time, Late 30/60/90, Missed |

### 7.9 Dashboard & Reports

| Feature | Description |
|---|---|
| **Dashboard Overview** | Application counts by state, total exposure, pending actions |
| **Pipeline** | Funnel metrics from DRAFT through DISBURSED |
| **SLA Metrics** | Policy compliance, breach alerts, auto-escalation |
| **Approver Queue** | Pending decisions for current user |
| **Portfolio Report** | Portfolio overview by product type, risk rating, exposure |
| **Aging Report** | Account classification: Performing, Early Care, Watchlist, Impaired |
| **SLA Breach Report** | Detailed breach listing |

### 7.10 Smart Defaults

The system automatically fills in common values to speed up application creation:

| Field | Default Logic |
|---|---|
| **Currency** | Derived from borrower's domicile country (country → currency mapping) |
| **Tenor** | By product type: Term Loan=60mo, Overdraft=12mo, etc. |
| **RM** | Auto-assigned to current user if they hold `credit:rm` role |
| **Suggested Reviewer** | First approval user excluding current user |

---

## 8. Permissions & Roles

### Credit Permission Set

| Permission | Description | Typical Roles |
|---|---|---|
| `credit:read` | View credit data, dashboards, reports | All credit users |
| `credit:write` | Create/edit applications, borrowers, documents | RM, Analyst |
| `credit:create` | Create new applications and borrowers | RM |
| `credit:approve` | Approve/reject applications, verify documents | Approver, Committee |
| `credit:admin` | Admin settings, scorecards, SLA policies, feature flags | Credit Admin |
| `credit:export` | Export data (with PII redaction controls) | RM, Analyst |

### Optional Features

Some capabilities are disabled by default and must be enabled by your system administrator:

| Feature | What It Enables |
|---|---|
| Bureau & AML Checks | Live CCRIS, CTOS, and AML adapter calls |
| Advanced CA Memo Tabs | Risk Rating & ECL, Profitability, Counterparties, Forward-Looking Risk |
| Formal Committee Voting | Full formal quorum and recorded vote flow |

If you need one of these enabled, contact your Credit Module administrator.

---

## 9. Data Security & Compliance

### PII Encryption

The following fields are encrypted at rest using AES-256-GCM:

| Field | Model |
|---|---|
| NRIC / Passport | Director |
| Annual Income | BorrowerProfile |
| Net Worth | BorrowerProfile |
| Source of Wealth | UltimateBeneficialOwner |

### Audit Trail

- Every state change, approval decision, and document action creates a `CreditAuditEvent`
- Events are hash-chained for tamper evidence — each event includes a SHA-256 hash of the previous event
- Audit trail is viewable on the **Audit** tab of every application

### Data Loss Prevention (DLP)

- Exports require a time-limited token (`POST /credit/export-token`)
- PII is redacted in exports unless `credit:export:pii` permission is held
- All PII reads are logged in the PII Read Access Log

### Regulatory Alignment

| Regulation | Module Coverage |
|---|---|
| **BNM Policy Documents** | Approval matrix tiers, exposure limits, delegation of authority |
| **PDPA** | PII encryption, consent tracking, audit trail |
| **MFRS 9** | ECL snapshots, SICR staging, forward-looking risk assessment |
| **AMLA** | AML screening, AML risk tiers, connected party detection |
| **SSM Requirements** | Company registration, director/shareholder disclosure |

---

## 10. Key Concepts & Glossary

| Term | Definition |
|---|---|
| **CA Memo** | Credit Assessment Memo — the structured document summarizing the full credit analysis |
| **CA Request Type** | Type of credit request: New, Additional, Renewal, Variation |
| **Borrower Profile** | Complete profile of the applicant — individual or corporate entity |
| **UBO** | Ultimate Beneficial Owner — person who ultimately owns or controls 25%+ of the entity |
| **DSCR** | Debt Service Coverage Ratio — measures cash flow available to service debt |
| **ECL** | Expected Credit Loss — MFRS 9 impairment methodology |
| **SICR** | Significant Increase in Credit Risk — MFRS 9 Stage 1→2 trigger |
| **MFRS 9** | Malaysian Financial Reporting Standard 9 — Financial Instruments |
| **CCIR** | Committee Review — the approval committee review stage |
| **SLA** | Service Level Agreement — defines target processing time per product type |
| **Exposure** | Total credit exposure to a borrower across all applications |
| **Forced Sale Value** | Estimated value of collateral if sold quickly under duress |
| **Condition Precedent** | Condition that must be fulfilled before disbursing the facility |
| **Condition Subsequent** | Condition that must be fulfilled after disbursement |
| **Delegation of Authority** | Temporary transfer of approval authority to another user |
| **Connected Party** | Related borrowers flagged automatically via shared directors/UBOs/shareholders |

### Acronym Expansion

| Acronym | Full Form |
|---|---|
| BNM | Bank Negara Malaysia |
| CCRIS | Central Credit Reference Information System |
| CTOS | Credit Tip-Off Service |
| CRM | Customer Relationship Management |
| DLP | Data Loss Prevention |
| KYC | Know Your Customer |
| AML | Anti-Money Laundering |
| SSM | Suruhanjaya Syarikat Malaysia (Companies Commission) |
| PII | Personally Identifiable Information |

---

## 11. Frequently Asked Questions

### General

**Q: How do I access the Credit module?**  
A: Log in → Click "More" in the top navigation → Select "Credit". You need at least one credit permission (`credit:read` minimum).

**Q: What's the difference between `credit:write` and `credit:create`?**  
A: `credit:create` is required to originate new applications and borrower profiles. `credit:write` allows editing existing records. Some roles have `credit:write` but not `credit:create`.

**Q: Can I withdraw an application?**  
A: Yes. Any application in a non-terminal state (not CLOSED, REJECTED, or already WITHDRAWN) can be withdrawn. You must provide a reason/comment.

### Approvals

**Q: How many approvals does an application need?**  
A: Depends on the total exposure and risk rating, determined by the 3-tier approval matrix:
- < MYR 500K: 1 RM approver
- MYR 500K–5M: 2 Senior Manager approvers
- > MYR 5M: 3 Committee approvers

**Q: What happens if an approver is unavailable?**  
A: Use **Delegation of Authority** to temporarily transfer your approval rights to another user.

**Q: What is "Escalate" in approval decisions?**  
A: Escalate moves the application to the next authority tier. For example, if a CREDIT_RM cannot decide, they can escalate to CREDIT_MANAGER level.

### Documents & Security

**Q: Are uploaded documents scanned for viruses?**  
A: Yes. All documents are automatically scanned for viruses and sensitive data upon upload. If you believe a document needs re-scanning, contact your system administrator.

**Q: Can I export credit data with PII?**  
A: Only users with `credit:export:pii` permission can export PII fields. Standard exports redact PII. All exports require a time-limited token and are audit-logged.

**Q: How is the audit trail protected from tampering?**  
A: Every `CreditAuditEvent` record includes a SHA-256 hash of the previous event, forming a hash chain. Any modification to a historical event breaks the chain, making tampering detectable.

### Configuration

**Q: How do I enable advanced CA Memo tabs?**  
A: Navigate to **Credit → Settings → Feature Flags** and toggle `credit:advanced_memo` to ON. This enables Risk Rating & ECL, Profitability, Counterparties, Account Conduct, and Forward-Looking Risk tabs.

**Q: Can I customize the scoring model weights?**  
A: Yes. Navigate to **Credit → Scorecards** (requires `credit:admin`). Each scorecard template has configurable factor group weights that sum to 100%.

**Q: How do I configure SLA policies?**  
A: Navigate to **Credit → Settings → SLA Policies** (requires `credit:admin`). Define target days per product type and state, with auto-escalation thresholds.

---

---

## 12. Getting Access & Support

### Before You Begin — Access Checklist

Confirm the following before your first use:

- [ ] You have a CWC account (contact IT if not)
- [ ] You can log in to [https://cwc.citadelgroup.com.my/login](https://cwc.citadelgroup.com.my/login)
- [ ] The **Credit** option appears when you click **"More"** in the top navigation
- [ ] You can see at least one tab inside the Credit module (Dashboard or Applications)

If any of the above is missing, your account may not have the required credit permissions. Contact your Credit Module administrator to have the appropriate role assigned.

### Who to Contact

| Need | Contact |
|---|---|
| **Access / Permissions** | Your Credit Module administrator |
| **Technical issue / bug** | IT Support via CWC → IT Support → New Request |
| **Training / onboarding** | Your team lead or Credit Manager |
| **Feature not visible** | Ask your administrator to check feature flag settings |

### Minimum Permissions by Role

| Role | Minimum Permission Needed |
|---|---|
| RM / Analyst | `credit:read`, `credit:write`, `credit:create` |
| KYC Officer | `credit:read`, `credit:approve` |
| Committee Member / Approver | `credit:read`, `credit:approve` |
| Credit Manager | `credit:read` |
| Credit Admin | `credit:admin` |

---

*End of Quick Start Guide — CWC Credit Assessment Module v1.2*