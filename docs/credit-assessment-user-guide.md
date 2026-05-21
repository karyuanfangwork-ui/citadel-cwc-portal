# Credit Assessment Module — User Guide & Stakeholder Walkthrough

**Citadel Group Technologies Sdn Bhd**
**CWC 2.0 Enterprise Service Desk**

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Navigation & Access](#2-navigation--access)
3. [User Journey 1: Borrower Onboarding](#3-user-journey-1-borrower-onboarding)
4. [User Journey 2: Credit Application Lifecycle](#4-user-journey-2-credit-application-lifecycle)
5. [User Journey 3: Financial Spreading & Analysis](#5-user-journey-3-financial-spreading--analysis)
6. [User Journey 4: Credit Scoring](#6-user-journey-4-credit-scoring)
7. [User Journey 5: Committee Review & Decision](#7-user-journey-5-committee-review--decision)
8. [User Journey 6: Collateral & Guarantee Management](#8-user-journey-6-collateral--guarantee-management)
9. [User Journey 7: Approval Workflow](#9-user-journey-7-approval-workflow)
10. [User Journey 8: Post-Disbursement Monitoring](#10-user-journey-8-post-disbursement-monitoring)
11. [User Journey 9: Dashboard & Reporting](#11-user-journey-9-dashboard--reporting)
12. [Governance & Security Controls](#12-governance--security-controls)
13. [Permission Reference](#13-permission-reference)
14. [Application State Machine Reference](#14-application-state-machine-reference)
15. [Malaysia Regulatory & Market Context](#15-malaysia-regulatory--market-context)
16. [Known Gaps & Roadmap Items](#16-known-gaps--roadmap-items)

---

## 1. Module Overview

The Credit Assessment Module is a full-lifecycle credit risk management system integrated into the CWC 2.0 platform. It covers every stage from borrower onboarding through to post-disbursement monitoring, built in 5 incremental capability layers (sprints):

| Layer | Capability | What It Delivers |
|-------|-----------|-----------------|
| **Foundation** | Borrower & Documents | Borrower profiles (individual/corporate/joint), directors, shareholders, UBOs, related parties, document management with verification |
| **Core Workflow** | Applications & Approvals | Credit applications with 16-state workflow engine, facilities, parties, approval matrices, approval decisions |
| **Analysis** | Financials & Scoring | Financial statement spreading (BS/PL/CF), maker-checker review, ratio computation, trend analysis, scorecard engine |
| **Governance** | Committee, Collateral, Conditions | Committee meeting management with quorum & voting, collateral valuations/liens/insurance, guarantees, conditions precedent & subsequent |
| **Operations & Security** | Dashboard, Monitoring, Security | Pipeline/approval/exposure/committee dashboards, facility health, covenant testing, payment tracking, early warning signals, audit chain, PII controls, ClamAV scanning |

---

## 2. Navigation & Access

Access the Credit module via the CRM navigation bar ("Credit" tab, requires `credit:read` permission). Once inside, a dedicated **Credit sub-navigation bar** appears with these tabs:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Dashboard │ Borrowers │ Applications │ My Approvals │ Financials │ Committee │ Collateral │ Scorecards │ Analysis │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- Tabs are **permission-gated**: users only see tabs they have access to
- The bar is **responsive**: on smaller screens, items overflow into a "More" dropdown
- Each tab's access level is shown below

| Tab | Route | Requires Permission | Who Sees It |
|-----|-------|-------------------|-------------|
| Dashboard | `/credit` | credit:read | All credit users |
| Borrowers | `/credit/borrowers` | credit:read | All credit users |
| Applications | `/credit/applications` | credit:read | All credit users |
| My Approvals | `/credit/approvals` | credit:approve | Approvers only |
| Financials | `/credit/financials` | credit:read | All credit users |
| Committee | `/credit/committee` | credit:read | All credit users |
| Collateral | `/credit/collateral` | credit:read | All credit users |
| Scorecards | `/credit/scorecards` | credit:admin | Admins only |
| Analysis | `/credit/analysis` | credit:read | All credit users |

---

## 3. User Journey 1: Borrower Onboarding

**Persona:** Credit Analyst / Relationship Manager

### 3.1 Create a Borrower Profile

1. Navigate to **Borrowers** tab → Click **Create** button
2. Select borrower type: **Individual**, **Corporate**, or **Sole Proprietor**
3. Fill in profile details:

   | Field (Individual) | Field (Corporate) |
   |-------------------|------------------|
   | Full Name | Company Name |
   | NRIC/Passport | Registration Number |
   | Occupation | Industry/Sector |
   | Employer | Incorporation Date |
   | Annual Income | Annual Revenue |
   | Net Worth | Net Worth |
   | Source of Wealth | Source of Wealth |
   | Purpose of Account | Purpose of Account |

4. System assigns: **Credit Risk Rating** (default), **AML Risk Tier** (default), flags for **Sanctioned Entity** check (screened against BNM AMLA 2001, MOHA sanctions list, and UNSC consolidated list)
5. For corporate borrowers, optionally capture **Bumiputera status** (relevant for SME Bank, MIDF, BNM Fund for SMEs, TEKUN financing eligibility) and **MSIC 2008 sector code** (DOSM standard)
6. Click **Save** → Profile created in **`DRAFT`** status

> **External bureau checks:** During KYC/Underwriting, the system is designed to pull **CCRIS (Central Credit Reference Information System, BNM)** and **CTOS / Experian RAMCI** reports via the bureau adapter. The integration is currently a placeholder (`bureau.placeholder.ts`) — production deployment requires live adapter wiring.

### 3.2 Add Related Parties

On the Borrower detail page, add related entities:

**Directors (Corporate borrowers):**
- Name, NRIC/Passport, Position (Director/CEO/CFO/etc.), Appointment Date, Executive/Non-Executive flag
- Optionally link to an existing CRM Contact record

**Shareholders:**
- Name, NRIC/Passport, Shareholding %, Share Class, Number of Shares
- Optionally link to an existing CRM Contact record

**Ultimate Beneficial Owners (UBOs):**
- Name, NRIC/Passport, Ownership %, PEP (Politically Exposed Person) flag
- Country of Residence, Source of Wealth
- Required for AML/KYC compliance

**Related Party Groups:**
- Link multiple borrowers by common ownership/relationships
- Useful for group exposure analysis

### 3.3 Upload & Verify Documents

> **Note:** The Documents section is backend-ready (API and storage fully implemented) but is not yet surfaced as a tab in the Borrower detail UI. Document management is currently accessible via the API directly; the frontend tab is pending implementation.

On the Borrower detail page → **Documents** section (when available):

1. Click **Upload** or drag-and-drop files into the upload area
2. Select document type from 8 categories:

   | Document Type | Description |
   |--------------|-------------|
   | NRIC | National ID card |
   | Passport | International passport |
   | Business Registration | SSM registration (Suruhanjaya Syarikat Malaysia) — Form 9/13/24/49 or Section 14/17/58 documents under Companies Act 2016 |
   | Tax Return | Tax filing documents |
   | Bank Statement | Bank statements |
   | Financial Statement | Audited/unaudited financials |
   | Utility Bill | Proof of address |
   | Other | Any supporting document |

3. Documents upload with **PENDING** verification status
4. **Verification workflow:**
   - Click **Verify** → status changes to **VERIFIED** (document accepted)
   - Click **Reject** → enter rejection reason → status changes to **REJECTED**
5. Each document is automatically scanned by **ClamAV** for viruses
6. Document hash (SHA-256) is stored for integrity verification

### Walkthrough Demo Script

> "I'm onboarding a new corporate borrower, ABC Manufacturing. I create the profile with their SSM registration details, then add their 3 directors and 2 major shareholders. For UBOs, I identify 1 PEP. I upload their business registration cert and 3 years of financial statements. The system scans all documents for viruses and marks them pending verification. I verify the business registration and financials — they're now ready for credit application."

---

## 4. User Journey 2: Credit Application Lifecycle

**Persona:** Relationship Manager → Credit Analyst → Approver

### 4.1 Create Application

1. Navigate to **Applications** tab → Click **Create**
2. Fill in application details:

   | Field | Description |
   |-------|-------------|
   | Borrower | Select from existing borrower profiles |
   | Product Type | Term Loan, Revolving Credit, Trade Finance, Overdraft, Project Finance, Syndicated, Bridge Loan, Letter of Credit, Bank Guarantee |
   | Requested Amount | In currency (e.g., RM5,000,000.00) |
   | Requested Tenor | In months |
   | Currency | MYR, USD, etc. (foreign-currency facilities must comply with BNM **Foreign Exchange Administration (FEA)** rules) |
   | Purpose | Free-text purpose of the credit |
   | Assigned RM | Relationship Manager responsible |
   | Assigned Analyst | Credit Analyst assigned |

3. Application created in **DRAFT** state
4. System auto-generates an **Application Number** (unique identifier)

### 4.2 Add Facilities

On the Application detail page → **Facilities** section:

1. Click **Add Facility**
2. Define credit facility terms:

   | Field | Description |
   |-------|-------------|
   | Facility Type | Term Loan, Overdraft, Trade Finance, etc. |
   | Amount | Requested facility amount |
   | Tenor | In months |
   | Rate | Interest rate (%) |
   | Purpose | Facility-specific purpose |

3. After approval, facility records capture: **Approved Amount**, **Approved Tenor**, **Approved Rate**
4. **Cost disclosure (Malaysia):** Facility offer letters should include **Stamp Duty (Stamp Act 1949 — 0.5% on principal sum of loan agreement)**, legal/perfection fees, and applicable **SST (Service Tax)** on bank charges. GST is **not applicable** (abolished 2018).

### 4.3 Add Parties

On the Application detail page → **Parties** section:

1. Link borrower profiles to the application with roles:
   - **Borrower** — primary obligor
   - **Guarantor** — provides guarantee
   - **Co-Borrower** — joint obligor
   - **Sponsor** — supporting party
2. Assign **Liability %** for each party (allocation of responsibility)

### 4.4 Submit Application

1. Once all details are complete, click **Submit**
2. Application transitions from **DRAFT → SUBMITTED**
3. The workflow engine now controls all subsequent state transitions

### 4.5 Application States (Full Lifecycle)

```
DRAFT ──submit──▶ SUBMITTED
                     │
                     ▼
                 KYC_REVIEW ──approve──▶ KYC_APPROVED
                     │                       │
                     │ reject                ▼
                     ▼                   UNDERWRITING
                 KYC_REJECTED                │
                                             ▼
                                       CREDIT_ASSESSMENT
                                             │
                                             ▼
                                       COMMITTEE_REVIEW
                                        ╱          ╲
                               approve ╱            ╲ reject
                                      ▼                ▼
                                   APPROVED         REJECTED
                                      │
                                      ▼
                                    OFFER
                                      │
                                      ▼
                                   ACCEPTED
                                      │
                                      ▼
                                   DISBURSED
                                      │
                                      ▼
                                    ACTIVE
                                      │
                                      ▼
                                    CLOSED

WITHDRAWN ←── (available from any active state)
```

**Key behaviors:**
- Only the **valid transitions** for the current state are shown as action buttons
- Every transition is **audit-logged** with timestamp, actor, old state, new state, and optional reason
- The audit trail uses **hash-chained** events for tamper evidence
- Application can be **withdrawn** at any active state (requires reason)

### Walkthrough Demo Script

> "I'm an RM creating a term loan application for ABC Manufacturing. I select the borrower, choose Product Type 'Term Loan', enter RM5,000,000.00 for 60 months for factory expansion. I add a single facility matching these terms. I assign myself as RM and a credit analyst. Then I submit — the application moves to SUBMITTED and enters the automated workflow. The credit analyst can now see it in their queue."

---

## 5. User Journey 3: Financial Spreading & Analysis

**Persona:** Credit Analyst (Maker) → Senior Analyst (Checker)

### 5.1 Enter Financial Statements

1. Navigate to **Financials** tab (or from Borrower detail → Financials)
2. Click **Add Statement** for a borrower
3. Select statement type, period, and fiscal year:

   | Field | Options |
   |-------|--------|
   | Statement Type | Balance Sheet (BS), Profit & Loss (PL), Cash Flow (CF) |
   | Period | Annual, Quarterly |
   | Fiscal Year End | e.g., 31/12/2024 |
   | Currency | MYR, USD, etc. |

4. Statement created in **DRAFT** status
5. Enter **Line Items** (hierarchical structure):

   **Balance Sheet example:**
   ```
   Assets
     ├── Current Assets
   │     ├── Cash & Equivalents    RM 2,500,000
   │     ├── Trade Receivables      RM 1,800,000
   │     └── Inventories            RM 3,200,000
     └── Non-Current Assets
           ├── Property & Equipment  RM 8,000,000
           └── Intangible Assets     RM 500,000
   Liabilities & Equity
     ├── Current Liabilities
     │     ├── Trade Payables        RM 1,500,000
     │     └── Short-term Debt       RM 2,000,000
     ├── Non-Current Liabilities
     │     └── Long-term Debt        RM 4,000,000
     └── Shareholders' Equity       RM 8,500,000
   ```

6. System performs **Balance Sheet validation**: Assets = Liabilities + Equity (must balance)

### 5.2 Financial Ratios (Auto-Computed)

After line items are entered, the system computes ratios across 5 categories:

| Category | Example Ratios |
|----------|----------------|
| **Profitability** | Net Profit Margin, ROA, ROE |
| **Leverage** | Debt-to-Equity, Debt-to-Asset |
| **Liquidity** | Current Ratio, Quick Ratio |
| **Coverage** | Interest Coverage, DSCR |
| **Activity** | Asset Turnover, Receivable Days |

### 5.3 Maker-Checker Review

**SOD (Segregation of Duties)** enforced: the same user CANNOT both enter and review a financial statement.

1. **Maker** (Credit Analyst) enters all line items → clicks **Submit for Review**
2. Statement status: **DRAFT → REVIEWED**
3. **Checker** (Senior Analyst) reviews:
   - Click **Approve** → status: **REVIEWED → APPROVED**
   - Click **Reject** → status: **REVIEWED → DRAFT** (sent back for corrections)
4. Admin users can bypass the SOD check (escalation path)

### 5.4 Trend Analysis

Navigate to **Analysis** tab:
- Compare financial ratios across multiple periods
- Visualize trends for key metrics
- Identify deterioration or improvement patterns across years

### Walkthrough Demo Script

> "As a credit analyst, I enter ABC Manufacturing's balance sheet for FY2024. I key in the line items — the system validates that Assets = Liabilities + Equity. I submit for review. A senior analyst opens the statement, reviews the figures, and approves it. The system now auto-computes ratios: leverage at 2.1x, current ratio at 1.8x, DSCR at 1.5x. On the Analysis page, I can compare these against FY2023 and FY2022 — trending shows improving leverage but slightly declining DSCR."

---

## 6. User Journey 4: Credit Scoring

**Persona:** Credit Admin → Credit Analyst

### 6.1 Scorecard Setup (Admin)

1. Navigate to **Scorecards** tab (requires `credit:admin`)
2. Click **Create Scorecard** → define name and description
3. Add **Scoring Factors** with weights (must total 100%). The system provides **9 preset factors**:

   | Factor | Example |
   |--------|---------|
   | Financial Leverage | Debt-to-equity, gearing ratio |
   | Debt Service Coverage | DSCR, interest coverage |
   | Profitability | Net margin, ROE, ROA |
   | Liquidity | Current ratio, quick ratio |
   | Cash Flow Stability | Operating cash flow consistency |
   | Management Quality | Governance, track record |
   | Industry Risk | Sector outlook, cyclicality |
   | Collateral Coverage | LTV ratio |
   | Relationship History | Existing banking relationship |

4. **Version management**: Create new versions, activate a specific version for use
5. Only one version can be **active** at a time per scorecard

### 6.2 Execute Scoring

1. On application detail page → Click **Run Score**
2. System evaluates active scorecard factors against application/borrower data
3. Score run produces:
   - **Total Score** (numeric)
   - **Risk Rating** (mapped from score): AAA, AA, A, BBB, BB, B, CCC, CC, C, D
   - **Factor Scores** (breakdown JSON)

### 6.3 Score Override (Admin)

1. If the auto-assigned risk rating needs manual adjustment:
2. Click **Override** on the score run
3. Fill in the override dialog:
   - **New Risk Rating** — select the revised rating
   - **Override Reason** — mandatory justification text
   - **Approver** — select the approving user
4. System records: override flag, original rating, new rating, reason, approver, and timestamp
5. Override is audit-logged

### Walkthrough Demo Script

> "As the Credit Admin, I've defined a 'Corporate Credit Scorecard v3' with 6 weighted factors totaling 100%. I activate version 3. When the credit analyst runs the scorecard on ABC Manufacturing's application, the system scores them at 72/100 — mapping to a 'BBB' risk rating. The application now proceeds to committee review with this rating. Later, if we get additional information, I can override the rating with a documented reason."

---

## 7. User Journey 5: Committee Review & Decision

**Persona:** Committee Secretary → Committee Chair → Committee Members

### 7.1 Schedule a Committee Meeting

1. Navigate to **Committee** tab → Click **Schedule Meeting**
2. Fill in meeting details:

   | Field | Description |
   |-------|-------------|
   | Title | e.g., "Q4 2024 Credit Committee" |
   | Scheduled At | Date and time |
   | Location | Physical or virtual |
   | Meeting Type | Regular or Ad-hoc |
   | Quorum Minimum | Minimum present members for valid decisions |

3. Add **Members** with roles: **Chair**, **Secretary**, or **Member**
4. System tracks attendance: **Present**, **Absent**, **Excused**

### 7.2 Add Agenda Items

1. Open the meeting → **Agenda** section
2. Click **Add Agenda Item**
3. Select a credit application to present
4. Assign **Presented By** (who presents the application)
5. Multiple applications can be on a single meeting agenda

### 7.3 Quorum Check

Before finalizing any decision, the system checks:
- **Quorum met?** = Number of PRESENT members >= Quorum Minimum
- If quorum is NOT met, decisions cannot be finalized

### 7.4 Voting

1. Committee members cast votes per agenda item:
   - **APPROVE** — in favor
   - **REJECT** — against
   - **ABSTAIN** — neutral/no opinion
2. Members can add **Comments** with their vote
3. System tallies votes in real time

### 7.5 Finalize Decision

1. After voting completes, Secretary or Chair views **Vote Results**
2. Click **Finalize Decision** per agenda item:
   - **APPROVE** — credit approved
   - **REJECT** — credit denied
   - **DEFER** — send back for more information
3. Decision result is recorded against the agenda item and application

### 7.6 Generate Credit Memo

1. After a decision, click **Generate Memo**
2. System produces a **Credit Memorandum** summarizing:
   - Application details, borrower profile, financial analysis
   - Scorecard results, risk rating
   - Committee discussion, votes, and final decision

### Walkthrough Demo Script

> "The Committee Secretary schedules a quarterly credit committee meeting with 5 members, requiring quorum of 3. Three applications are added to the agenda. On meeting day, 4 members are marked present — quorum is met. Each member votes on the applications. For ABC Manufacturing's term loan, the vote is 3 Approve, 1 Abstain. The Chair finalizes the decision as 'Approved'. The system generates the credit memo for regulatory records."

---

## 8. User Journey 6: Collateral & Guarantee Management

**Persona:** Credit Analyst → Valuer → Admin

### 8.1 Add Collateral to a Facility

1. On Application detail → **Facilities** → Select a facility → **Collateral** section
2. Click **Add Collateral**
3. Record collateral details:

   | Field | Description |
   |-------|-------------|
   | Collateral Type | Property, Vehicle, Equipment, Securities, Cash Deposit, Guarantee, Other |
   | Description | e.g., "Double-storey factory at Lot 123, Jalan Industrial" |
   | Title Type (Property) | **Geran (Final Title)**, **HSD (Hakmilik Sementara Daftar)**, **PN (Pajakan Negeri)**, **Master Title**, or **Strata Title** |
   | Registration Authority | Pejabat Tanah dan Galian (PTG) / Pejabat Tanah Daerah (PTD) / Land Office |
   | Title Reference | Land title / registration number |
   | Registered To | Owner name |
   | Market Value | Current market valuation |
   | Forced Sale Value | Discounted value for forced sale scenario |
   | Valuation Date | Date of last valuation |
   | Valuer | Who performed the valuation |
   | Insurance Cover Required | Yes/No |

### 8.2 Manage Valuations

1. Open a collateral record → **Valuations** tab
2. Add new valuation entries over time (tracks valuation history):
   - Market Value, Forced Sale Value, Valuation Date, Valuer, Report Reference

### 8.3 Manage Liens

1. Open a collateral record → **Liens** tab
2. Record liens against the collateral:
   - Lien Holder, Lien Amount, Priority (1st, 2nd, etc.), Registration Date
3. **Discharge a Lien**: Click **Discharge** → enter Discharge Date
4. Discharged liens are retained for audit trail

### 8.4 Manage Insurance

1. Open a collateral record → **Insurance** tab
2. Record insurance coverage:
   - Insurer, Policy Number, Coverage Amount, Effective Date, Expiry Date
3. Track insurance expiry for compliance
4. **Typical Malaysia retail-property requirements:** **MRTA / MLTA** (Mortgage Reducing/Level Term Assurance) for borrower life cover, and **Houseowner / Fire Insurance or Takaful** on the secured property

### 8.5 Guarantees

1. On Application detail → **Guarantees** section
2. Click **Add Guarantee**
3. Link a guarantor (borrower profile) and define:
   - Guarantee Type (Corporate, Personal, Bank)
   - Amount
   - Limited / Unlimited

### Walkthrough Demo Script

> "ABC Manufacturing's term loan is secured by their factory property. I add the collateral with market value of RM6,000,000 and forced sale value of RM4,200,000. I record the existing bank lien (priority 1) for RM2,000,000. I add the insurance policy with RM6,000,000 coverage. The system shows total collateral value, and after deducting the first lien, the net available security is clear. The MD also provides a personal guarantee of RM1,000,000 — I add that as a guarantee on the application."

---

## 9. User Journey 7: Approval Workflow

**Persona:** Approver (various authority levels)

### 9.1 Approval Matrix Setup (Admin)

1. Admin defines **Approval Matrices** based on exposure and risk:

   | Exposure Range | Risk Rating Band | Authority Level | Required Approvals |
   |----------------|-----------------|-----------------|-------------------|
   | RM0 – RM500K | AAA – A | Level 1 | 1 |
   | RM500K – RM2M | AAA – BBB | Level 2 | 2 |
   | RM500K – RM2M | BB – C | Level 3 | 2 |
   | RM2M – RM10M | Any | Level 3 | 3 |
   | > RM10M | Any | Level 4 | 4 |

2. Matrices are **versioned** — changes create a new version; previous version retained for audit
3. **Regulatory ceiling:** All approval thresholds must remain within the **BNM Single Counterparty Exposure Limit (SCEL — 25% of bank's Total Capital)** and any sectoral/related-party limits set by BNM.
4. **Committee tiering:** Higher exposures typically escalate from **Management Credit Committee (MCC)** to **Board Credit Committee (BCC)**, in line with BNM Corporate Governance policy for financial institutions.

### 9.2 Approval Lookup

1. When an application needs approval, the system **automatically looks up** the approval matrix
2. Match criteria: Requested Amount (exposure) + Risk Rating → returns Authority Level + Required Approver Count
3. Determines who can approve and how many signatures are needed

### 9.3 Submit Approval Decision

1. Navigate to **My Approvals** tab → see pending approval queue
2. Or from Application detail → **Approvals** section
3. Submit a decision:

   | Action | Description |
   |--------|-------------|
   | **Approve** | Credit approved (with optional conditions) |
   | **Reject** | Credit denied (reason required) |
   | **Return** | Send back to analyst for more work |
   | **Escalate** | Escalate to higher authority |
   | **Defer** | Postpone decision to a later date |

4. **SOD enforcement**: The user who created/originated the application CANNOT approve it (Segregation of Duties)
5. Approval conditions (if any) become **Conditions Precedent** that must be fulfilled before disbursement

### Walkthrough Demo Script

> "ABC Manufacturing's RM5M term loan at BBB rating triggers Level 3 approval requiring 3 approvers. I'm one of the approvers — I see it in My Approvals queue. I review the application details, financials, scorecard results, and collateral. I click Approve with a condition that a legal opinion on the property title must be obtained. Two other approvers also approve. Now 3/3 required approvals are met — the application can proceed to Committee Review."

---

## 10. User Journey 8: Post-Disbursement Monitoring

**Persona:** Credit Monitoring Analyst

### 10.1 Facility Health Tracking

1. On Application detail → **Health** tab
2. Monitor facility health status:

   | Status | Meaning |
   |--------|---------|
   | HEALTHY | Performing within expectations |
   | WATCH | Early signs of concern |
   | AT_RISK | Significant concerns |
   | DEFAULT | Payment default or covenant breach |

3. Set **Review Frequency** and **Next Review Date**
4. System tracks **Last Review Date**

### 10.2 Covenant Compliance

1. On Application detail → **Covenants** tab
2. Define covenants with thresholds:

   | Covenant Type | Example |
   |--------------|---------|
   | Financial Ratio | DSCR > 1.25x |
   | Negative Pledge | No additional liens |
   | Minimum Turnover | Revenue > RM10M p.a. |
   | Debt Service Coverage | DSCR > 1.0x |
   | Loan to Value | LTV < 70% |
   | Insurance | Maintain property insurance |
   | Reporting | Submit quarterly financials |
   | Other | Any custom covenant |

3. Run **Covenant Tests**:
   - Enter **Reported Value** and **Test Date**
   - System checks: Is reported value compliant with threshold?
   - Result: **Compliant** or **Breached**

### 10.3 Payment Tracking

1. On Application detail → **Payments** tab
2. Record payment events:

   | Payment Status | Days Past Due |
   |---------------|--------------|
   | ON_TIME | 0 |
   | LATE_30 | 1–30 days |
   | LATE_60 | 31–60 days |
   | LATE_90 | 61–90 days |
   | MISSED | > 90 days |

3. Track: Due Date, Paid Date, Amount, Status

### 10.4 Early Warning Signals

1. System **auto-generates** warning signals from monitoring:
   - Covenant breach detected
   - Payment overdue
   - Review overdue
   - Financial deterioration (from new statements)

2. **Signal severity levels:**

   | Severity | Color | Action |
   |----------|-------|--------|
   | LOW | Green | Monitor |
   | MEDIUM | Yellow | Investigate |
   | HIGH | Orange | Escalate |
   | CRITICAL | Red | Immediate action |

3. Navigate to **Signals** (watchlist) to see all unresolved signals across the portfolio
4. **Resolve** signals with notes when issue is addressed
5. **Automated monitoring job** runs daily to detect new issues

### Walkthrough Demo Script

> "After ABC Manufacturing's loan is disbursed and in ACTIVE status, I set up covenants: DSCR > 1.25x and LTV < 70%. In Q2, their DSCR drops to 1.1x — the system flags a covenant breach with HIGH severity. An early warning signal appears in the watchlist. I review the signal, contact the borrower, and document the resolution. I update the facility health from HEALTHY to WATCH. The daily monitoring job will continue checking for overdue reviews and payment delays."

---

## 11. User Journey 9: Dashboard & Reporting

**Persona:** Credit Manager / Head of Credit

### 11.1 Credit Dashboard

Navigate to **Dashboard** tab — 4 widget panels:

**1. Pipeline Dashboard**
- Application counts by state (Submitted, KYC, Underwriting, Assessment, Committee, etc.)
- Average days in each state — identify bottlenecks
- SLA breach count — applications exceeding target processing time

**2. Approval Inbox**
- Your pending approvals grouped by urgency (HIGH / MEDIUM / LOW)
- Days-waiting metric per item
- Quick-action to approve/reject directly from dashboard

**3. Exposure Dashboard**
- Top borrowers by total exposure
- Sector breakdown (concentration risk)
- Risk rating distribution across portfolio

**4. Committee Calendar**
- Upcoming committee meetings
- Number of agenda items per meeting
- Quick-link to meeting details

### Walkthrough Demo Script

> "As Head of Credit, I open the Dashboard. The Pipeline shows 12 applications in underwriting with avg 8 days — one is SLA-breached. My Approval Inbox shows 2 HIGH urgency items waiting for me. The Exposure chart shows manufacturing sector concentration at 40% — a risk flag. Committee Calendar shows a meeting this Friday with 4 agenda items. I immediately click into the SLA-breached application to follow up."

---

## 12. Governance & Security Controls

### 12.1 Audit Trail

- **Every state change** on credit applications is recorded in `CreditAuditEvent`
- Events are **hash-chained**: each event's hash includes the previous event's hash
- **Tamper evidence**: Use **Audit Chain Verification** (Admin) to verify the chain integrity
- Records: who (actor), when (timestamp), what (action), from (old state), to (new state), why (reason)

### 12.2 PII Protection

- Sensitive fields (NRIC, Passport) on `BorrowerProfile` are **encrypted at rest** (AES-256-CBC via `CreditEncryptionService`, key from `CREDIT_ENCRYPTION_KEY` env var)
- **Governing statute:** All PII handling is subject to the **Personal Data Protection Act 2010 (PDPA), Malaysia** — consent, purpose limitation, retention, and access logs are mandatory
- **Known gap:** As of this release, NRIC/Passport on related-party tables (Director / Shareholder / UBO) are stored in plaintext. Encryption parity is on the remediation backlog — see §16.
- Every read access to PII fields is **logged** with:
  - Who accessed it, which resource, which field, reason for access
- Admin can view **PII Read Logs** to audit who has accessed sensitive data
- **PII Export** requests are permission-gated (`credit:export:pii`) with reason capture

### 12.3 Segregation of Duties (SOD)

- **Middleware enforcement**: The same user CANNOT both create and approve the same application
- Applied to: financial statement entry/review, application origination/approval
- Prevents single-person control over critical processes

### 12.4 Document Security

- All uploaded documents are **virus-scanned** via ClamAV integration
- Document **SHA-256 hash** stored for integrity verification
- Document **versioning** tracks all file replacements
- Scanning status (`isAvClean`) visible on each document record

### 12.5 Feature Flags

- Credit module capabilities can be **toggled on/off** via feature flags
- Supports **rollout percentage** for gradual deployment
- Flags follow convention: `credit:<capability>` (e.g., `credit:borrowers`, `credit:applications`)
- All credit routes require the `credit:module` feature flag to be enabled

---

## 13. Permission Reference

| Permission | Description | Who Typically Has It |
|-----------|-------------|---------------------|
| `credit:read` | View all credit data, dashboards, reports | All credit team members |
| `credit:write` | Create/update borrowers, applications, documents, financials | Credit Analysts, RMs |
| `credit:approve` | Access My Approvals, submit approval decisions | Approvers, Senior Analysts |
| `credit:admin` | Delete records, manage scorecards, feature flags, PII logs, override scores | Credit Admin, Head of Credit |
| `credit:export:pii` | Request PII data exports | Compliance, Audit |
| `credit:module` | Feature flag — must be enabled for any credit access | System-level toggle |

---

## 14. Application State Machine Reference

### Complete State Transition Map

| From State | Action | To State |
|-----------|--------|---------|
| DRAFT | submit | SUBMITTED |
| SUBMITTED | start_kyc | KYC_REVIEW |
| KYC_REVIEW | approve_kyc | KYC_APPROVED |
| KYC_REVIEW | reject_kyc | KYC_REJECTED |
| KYC_APPROVED | start_underwriting | UNDERWRITING |
| UNDERWRITING | start_assessment | CREDIT_ASSESSMENT |
| CREDIT_ASSESSMENT | submit_to_committee | COMMITTEE_REVIEW |
| COMMITTEE_REVIEW | approve | APPROVED |
| COMMITTEE_REVIEW | reject | REJECTED |
| APPROVED | make_offer | OFFER |
| OFFER | accept | ACCEPTED |
| ACCEPTED | disburse | DISBURSED |
| DISBURSED | activate | ACTIVE |
| ACTIVE | close | CLOSED |
| *(any active)* | withdraw | WITHDRAWN |

### Product Types

| Code | Description |
|------|-------------|
| TERM_LOAN | Term Loan |
| OVERDRAFT | Overdraft Facility |
| TRADE_FINANCE | Trade Finance |
| REVOLVING_CREDIT | Revolving Credit |
| SYNDICATED_LOAN | Syndicated Loan |
| PROJECT_FINANCE | Project Finance |
| BRIDGING_LOAN | Bridging Loan |
| GUARANTOR_FACILITY | Guarantor Facility |

### Risk Ratings

| Rating | Risk Level |
|--------|-----------|
| AAA | Lowest Risk |
| AA | Very Low Risk |
| A | Low Risk |
| BBB | Medium Risk |
| BB | Elevated Risk |
| B | High Risk |
| CCC | Very High Risk |
| CC | Near Default |
| C | Imminent Default |
| D | Default |

---

## 15. Malaysia Regulatory & Market Context

This section consolidates the Malaysia-specific regulatory and market conventions that govern how the Credit Assessment Module should be operated.

### 15.1 Governing Statutes & Regulators

| Area | Reference |
|------|-----------|
| Banking & prudential supervision | **Bank Negara Malaysia (BNM)** — Financial Services Act 2013 (FSA), Islamic Financial Services Act 2013 (IFSA) |
| Corporate registry | **Suruhanjaya Syarikat Malaysia (SSM)** — Companies Act 2016 |
| Personal data | **Personal Data Protection Act 2010 (PDPA)** |
| AML / CFT | **Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 (AMLA)**; BNM AML/CFT Policy Document |
| Sanctions | **MOHA Domestic Sanctions List**, **UNSC Consolidated List**, **OFAC** (where USD touchpoints exist) |
| Stamp / documentary | **Stamp Act 1949** (0.5% ad valorem on principal of loan agreements) |
| Tax | **Sales and Service Tax (SST)** — GST abolished 2018 |
| Foreign exchange | **BNM Foreign Exchange Administration (FEA) Notices** |
| Accounting / ECL | **MFRS 9 Financial Instruments** (3-stage ECL model) |

### 15.2 Credit Bureaus & External Data

| System | Operator | Use |
|--------|----------|-----|
| **CCRIS** (Central Credit Reference Information System) | BNM | Mandatory — credit history of borrower & related parties |
| **CTOS** | CTOS Data Systems | Litigation, bankruptcy, trade reference |
| **Experian RAMCI** | Experian Malaysia | Trade reference, directorship search |
| **FIS (Financial Information System)** | BNM (internal supervisory) | For licensed institutions |
| **MyKad e-KYC** | JPN / NRD | Identity verification |
| **SSM e-Info / MyData** | SSM | Real-time company profile pulls |

The adapter layer (`backend/src/credit/adapters/`) exposes interfaces for these — production deployment requires replacing placeholder adapters with live integrations and signed-API credentials.

### 15.3 Sectoral & Borrower Classification

- **MSIC 2008** (DOSM Malaysia Standard Industrial Classification) — recommended canonical sector code on `BorrowerProfile`
- **Bumiputera status** — optional flag for eligibility to government-linked SME programs (SME Bank, MIDF, BNM Fund for SMEs, TEKUN, CGC)
- **SME definition** — per SME Corp Malaysia thresholds (annual sales turnover / full-time employees); affects pricing and capital treatment

### 15.4 Property Collateral Conventions

- Title types: **Geran (Final Title)**, **HSD (Hakmilik Sementara Daftar)**, **PN (Pajakan Negeri)**, **Master Title**, **Strata Title**
- Registry: **Pejabat Tanah dan Galian (PTG)** (state) or **Pejabat Tanah Daerah (PTD)** (district)
- Charge instrument: **Form 16A** under National Land Code 1965 (presented at the land office for registration of charge)
- Insurance: **MRTA / MLTA** (life), **Houseowner / Fire Insurance or Takaful** (property)
- Valuation: by a registered valuer under **Board of Valuers, Appraisers, Estate Agents and Property Managers (BOVAEP)**

### 15.5 Approval Authority & Prudential Limits

- **Single Counterparty Exposure Limit (SCEL):** 25% of Total Capital (BNM SCEL Policy Document) — the absolute ceiling for any single borrower / group
- **Connected Party / Related Party limits:** per BNM Credit Transactions and Exposures with Connected Parties policy
- **Governance tiering:** Management Credit Committee (MCC) → Board Credit Committee (BCC) — required by BNM Corporate Governance policy for FIs
- **Internal rating to MFRS 9 staging:** map AAA-D internal grades to **Stage 1 (performing) / Stage 2 (significant increase in credit risk) / Stage 3 (credit-impaired)** for ECL provisioning

### 15.6 Currency, Pricing & Disclosure

- Domestic facility currency: **MYR** by default; foreign-currency facilities require **FEA** approval/notification thresholds
- Reference rates: **Standardised Base Rate (SBR)**, **Base Rate (BR)**, **Base Lending Rate (BLR)** (legacy)
- Stamp duty on loan agreement: **0.5% of principal**, payable to LHDN (Lembaga Hasil Dalam Negeri)
- All offer letters / facility agreements must comply with BNM **Fair Treatment of Financial Consumers (FTFC)** policy

---

## 16. Known Gaps & Roadmap Items

These items are scoped but not yet complete in the current release. They are tracked in the audit-remediation plan.

| # | Area | Gap | Status |
|---|------|-----|--------|
| 1 | PII encryption parity | Director / Shareholder / UBO `nricPassport` stored in plaintext; only `BorrowerProfile` fields are encrypted | P0 — remediation in progress |
| 2 | External bureau adapters | `bureau.placeholder.ts`, `aml.placeholder.ts`, `cbs.placeholder.ts`, `esign.placeholder.ts`, `ocr.placeholder.ts` are stubs | Production wiring pending vendor selection |
| 3 | Frontend routes | `/credit/reports`, `/credit/reviews`, `/credit/disbursements` are referenced in CreditNav but not yet wired in `App.tsx` | Stub pages to be scaffolded |
| 4 | Dashboard pipeline widget | Endpoint returns data but UI surfaces an error on load | Frontend fix scheduled |
| 5 | Scorecard weight validation | Doc states factor weights "must total 100%" — server-side validator enforcement to be re-confirmed | Verification |
| 6 | Audit chain verification UI | Hash-chained `CreditAuditEvent` exists; admin-facing verification view to be added | Backlog |
| 7 | MFRS 9 ECL staging | Internal rating to Stage 1/2/3 mapping not yet materialised on the facility record | Backlog |
| 8 | MSIC / Bumiputera fields | Borrower schema additions for MSIC 2008 sector code and Bumiputera flag | Backlog |

---

*Document generated for stakeholder walkthrough of the CWC 2.0 Credit Assessment Module.*
*Citadel Group Technologies Sdn Bhd*