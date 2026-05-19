# CRM Module — User Guide & Stakeholder Walkthrough

**Citadel Group Technologies Sdn Bhd**
**CWC 2.0 Enterprise Service Desk**

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Navigation & Access](#2-navigation--access)
3. [User Journey 1: Dashboard & Daily Briefing](#3-user-journey-1-dashboard--daily-briefing)
4. [User Journey 2: Account Management](#4-user-journey-2-account-management)
5. [User Journey 3: Contact Management & KYC](#5-user-journey-3-contact-management--kyc)
6. [User Journey 4: Lead Management & AI Scoring](#6-user-journey-4-lead-management--ai-scoring)
7. [User Journey 5: Opportunity Pipeline (Kanban)](#7-user-journey-5-opportunity-pipeline-kanban)
8. [User Journey 6: Activities & Notes](#8-user-journey-6-activities--notes)
9. [User Journey 7: Trust Products & Beneficiaries](#9-user-journey-7-trust-products--beneficiaries)
10. [User Journey 8: Team Dashboard & Manager AI](#10-user-journey-8-team-dashboard--manager-ai)
11. [User Journey 9: Reports & Analytics](#11-user-journey-9-reports--analytics)
12. [AI Feature Catalogue](#12-ai-feature-catalogue)
13. [Automated Jobs & Notifications](#13-automated-jobs--notifications)
14. [Governance & Malaysian Compliance](#14-governance--malaysian-compliance)
15. [Permission Reference](#15-permission-reference)
16. [Data Model Reference](#16-data-model-reference)

---

## 1. Module Overview

The CRM Module is a full-lifecycle customer relationship management system designed for Malaysian financial services (trust products, KYC/AML compliance). It manages the complete sales pipeline from lead capture through to deal closure and post-sale trust product management, with AI-powered intelligence at every stage.

| Layer | Capability | What It Delivers |
|-------|-----------|-----------------|
| **Core CRM** | Accounts, Contacts, Leads, Opportunities | Company and individual records, lead qualification, deal pipeline |
| **Pipeline** | Kanban Board | Visual drag-and-drop deal management with configurable stages |
| **AI Productivity** | Draft Messages, Note Analysis, Lead Summary | AI-assisted communication and insight extraction (Phase 1) |
| **AI Intelligence** | Lead Scoring, Win Probability, Daily Briefing | Predictive analytics and smart prioritisation (Phase 2) |
| **AI Compliance** | KYC Gaps, Risk Profile, Document Checklist | BNM-aligned compliance assist (Phase 3) |
| **Trust Products** | Trust setup, Beneficiaries, Status lifecycle | Living/Testamentary/Charitable/Cash trust management |
| **Reporting** | 7 report types + CSV export | Lead conversion, sales performance, pipeline forecast, KYC compliance |
| **Automation** | 7 scheduled jobs | Activity reminders, lead aging, stale deals, KYC expiry, rep inactivity |

---

## 2. Navigation & Access

Access CRM from the main navigation sidebar. The CRM module has its own **sub-navigation bar** (CrmNav) on the left side with these tabs:

```
┌──────────────────┐
│  Dashboard       │
│  Accounts        │
│  Contacts        │
│  Leads           │
│  Pipeline        │
│  Team            │  ← Admin/Manager only
│  Reports         │
│  Guide           │
└──────────────────┘
```

| Tab | Route | Permission | Who Sees It |
|-----|-------|-----------|-------------|
| Dashboard | `/crm` | crm:read | All CRM users |
| Accounts | `/crm/accounts` | crm:read | All CRM users |
| Contacts | `/crm/contacts` | crm:read | All CRM users |
| Leads | `/crm/leads` | crm:read | All CRM users |
| Pipeline | `/crm/pipeline` | crm:read | All CRM users |
| Team | `/crm/team` | crm:admin | Managers/Admins only |
| Reports | `/crm/reports` | crm:read | All CRM users |
| Guide | `/crm/guide` | crm:read | All CRM users |

---

## 3. User Journey 1: Dashboard & Daily Briefing

**Persona:** Sales Representative

### 3.1 CRM Dashboard

Navigate to **Dashboard** tab — the CRM landing page with 4 sections:

**1. KPI Stats Bar**
- Total Leads count
- Total Opportunities count
- Won Deals count
- Total Revenue (won deal value)

**2. AI Daily Briefing Card**
- AI-generated summary of your day: upcoming activities, at-risk deals, stale leads
- Session-cached (won't re-query AI on every page load)
- Click **Refresh** to get a fresh briefing

**3. Global Search**
- Search across accounts, contacts, leads, and opportunities by name or email
- Results grouped by entity type with direct links

**4. Recent Activities & My Deals Toggle**
- **Recent Activities**: Your latest activity log entries
- **My Deals**: Toggle to show only opportunities assigned to you

### Walkthrough Demo Script

> "I log in and land on the CRM Dashboard. The KPI bar shows 15 leads, 8 opportunities, 3 won deals, RM2.4M revenue. The AI Daily Briefing tells me: 'You have 2 meetings today, your Petronas deal has been in Qualification for 21 days, and 3 leads have no activity in over a week.' I use global search to find 'AirAsia' — it returns the account, 2 contacts, and 1 active opportunity. I switch to My Deals to focus on my pipeline."

---

## 4. User Journey 2: Account Management

**Persona:** Sales Rep / Admin

### 4.1 Account List

Navigate to **Accounts** tab:
- Paginated list of all company/individual accounts
- **Filters**: Industry type
- **Search**: By name
- **Inline create**: Click "New Account" to add without leaving the page

### 4.2 Create an Account

| Field | Description | Malaysian-Specific |
|-------|-------------|-------------------|
| Name | Company or individual name | |
| Industry | Sector classification | |
| Company Size | Employee count range | |
| Website | URL | |
| Phone / Email | Primary contact details | |
| Address | Street, City, State, Country, Postal Code | |
| Annual Revenue | In MYR | |
| Registration Number | SSM registration number | Yes (MY) |
| Tax Number | Tax identification | Yes (MY) |
| Bank Account | Bank account details | Yes (MY) |
| Purchase Cash Trust | Trust purchase indicator | Yes (MY) |
| Account Type | INDIVIDUAL or CORPORATE | |

### 4.3 Account Detail Page

Click on an account to see its detail page with 6 tabs:

| Tab | Shows |
|-----|-------|
| **Overview** | Account info grid, description, industry, revenue, registration/tax/bank (for Malaysian accounts) |
| **Contacts** | All contacts linked to this account, with Primary badge on key contact |
| **Deals** | Linked opportunities with stage colour badges and deal value |
| **Activities** | Chronological activity log linked to this account |
| **Notes** | Notes with pinned notes first, add-note form |
| **Trust Products** | Trust products linked to this account, with status badges and deed references |

### Walkthrough Demo Script

> "I click Accounts and see our 6 Malaysian company accounts. I create a new corporate account for 'CIMB Investment Holdings' — I fill in their SSM registration number, tax number, industry as 'Financial Services', and annual revenue of RM12B. After saving, I'm on their detail page where I can add contacts, track deals, and later set up trust products."

---

## 5. User Journey 3: Contact Management & KYC

**Persona:** Sales Rep → KYC Officer / Admin

### 5.1 Contact List

Navigate to **Contacts** tab:
- Paginated list of all contacts
- **Follow-up urgency badges**: Visual indicators for contacts needing attention
- **Duplicate detection**: System checks for duplicate email/phone before creation
- **Inline create**: Add contact without page navigation

### 5.2 Create a Contact

| Field | Description | Malaysian-Specific |
|-------|-------------|-------------------|
| First Name / Last Name | Contact name | |
| Email / Phone / Mobile | Contact channels | |
| Job Title / Department | Professional details | |
| Account | Link to parent company account | |
| Is Primary | Primary contact for the account | |
| Follow-Up Date | Next scheduled follow-up | |
| NRIC/Passport | ID number | Yes (MY) |
| Date of Birth | DOB | |
| Preferred Language | EN / BM / ZH | Yes (MY) |
| PDPA Consent | Personal data consent flag | Yes (MY) |
| PDPA Consent Date | When consent was given | Yes (MY) |
| Marketing Opt-In | Marketing communications | Yes (MY) |

### 5.3 Contact Detail Page

Click on a contact to see their detail page with 4 tabs:

| Tab | Features |
|-----|----------|
| **Overview** | Contact info, account link, follow-up scheduling |
| **KYC** | Full KYC checklist, risk assessment, AI compliance tools |
| **Linked Deals** | Opportunities linked to this contact |
| **Notes** | Contact-specific notes pinned first |

### 5.4 KYC Workflow

On the Contact Detail → **KYC** tab:

**5 Verification Checklist Items:**

| Check | What It Verifies |
|-------|-------------------|
| NRIC Verified | National ID authentication |
| Address Verified | Residential/business address confirmed |
| Income Verified | Income documentation validated |
| Source of Funds Verified | Anti-money laundering check |
| Risk Profile Done | BNM risk-based assessment complete |

**KYC Status Flow:**
```
PENDING → IN_PROGRESS → APPROVED
                     → REJECTED (with reason)
                     → EXPIRED (auto via scheduled job)
```

**KYC Record Fields:**
- Risk Level: LOW / MEDIUM / HIGH
- PEP (Politically Exposed Person) flag
- AML Risk Tier
- Screening Status + Hits
- Last Screening Date + Next Screening Due Date
- Expiry Date + Approved By + Approved At
- Rejection Reason (if rejected)

**KYC Approval:** Requires `crm:admin` permission (segregation of duties)

### 5.5 AI-Powered KYC Assistance

Two AI features assist with compliance:

**1. KYC Gap Detector** (auto-loaded on KYC tab)
- Scans the contact record for missing KYC fields
- Labels each gap as: **Required** (mandatory for compliance) or **Recommended** (best practice)
- Example output: "NRIC not verified [Required], Source of Funds not verified [Required], Risk Profile incomplete [Recommended]"

**2. AI Risk Profile** (auto-loaded on KYC tab)
- Analyses contact data and suggests a BNM-aligned risk tier
- Provides regulatory basis for the suggestion
- Example output: "Suggested: MEDIUM — Contact is a director of a regulated entity, BNM para 9.1 applies"

### Walkthrough Demo Script

> "I add a new contact, Encik Ahmad, who is CFO at CIMB Investment. I fill in his NRIC, set PDPA consent to true with today's date, and preferred language to BM. On the KYC tab, I start the verification process — I tick off NRIC Verified and Address Verified. The AI Gap Detector immediately highlights that Income and Source of Funds verification are still Required. The AI Risk Profile suggests MEDIUM risk because he's a director of a financial institution. I complete all 5 checks and save. The KYC Admin later reviews and approves, setting a 12-month expiry."

---

## 6. User Journey 4: Lead Management & AI Scoring

**Persona:** Sales Rep

### 6.1 Lead List

Navigate to **Leads** tab:
- Paginated list with **urgency badges** (colour-coded by follow-up date proximity)
- **AI Score** column (0–100, auto-computed)
- **Priority sort**: Leads sorted by AI score + urgency
- **Duplicate detection**: Checks contact email/phone before creation
- **Filters**: Status, Source
- **Inline create**: Add lead without page navigation

### 6.2 Lead Status Pipeline

```
NEW ──contact──▶ CONTACTED ──qualify──▶ QUALIFIED ──convert──▶ CONVERTED
                                                  → UNQUALIFIED (terminal)
                                                  → LOST (terminal, reason required)
```

| Status | Meaning | Action Available |
|--------|---------|------------------|
| NEW | Fresh lead, not yet contacted | Mark Contacted |
| CONTACTED | Initial outreach done | Mark Qualified or Unqualified |
| QUALIFIED | Meets criteria for opportunity | Convert to Opportunity |
| UNQUALIFIED | Does not meet criteria | Terminal (no further action) |
| CONVERTED | Turned into an opportunity | Terminal (links to opportunity) |
| LOST | No longer viable | Terminal (lost reason required) |

### 6.3 Lead Sources

| Source | Description |
|--------|-------------|
| WEBSITE | Inbound from website |
| REFERRAL | Referred by existing client/partner |
| COLD_CALL | Outbound cold call |
| TRADE_SHOW | Met at trade show/event |
| LINKEDIN | LinkedIn connection |
| ADVERTISEMENT | Responded to ad |
| PARTNER | Channel partner referral |
| OTHER | Any other source |

### 6.4 Lead Detail Page

Click on a lead to see:
- Header: Title, status badge (colour-coded), source badge
- **AI Lead Summary**: Auto-generated profile of the lead
- Status change dropdown
- **Convert to Opportunity** button (only when Qualified)
- **Draft Message** button (AI-generated WhatsApp/Email)
- Activities timeline
- Notes section

### 6.5 Convert Lead to Opportunity

When a lead is **QUALIFIED**, click **Convert to Opportunity**:

1. Modal opens with conversion options:

   | Field | Description |
   |-------|-------------|
   | Opportunity Name | e.g., "Petronas — Term Loan RM5M" |
   | Pipeline | Select which pipeline to add to |
   | Stage | Starting stage (usually Prospecting) |
   | Value | Estimated deal value in MYR |
   | Expected Close Date | Target close date |
   | Create Account | Auto-create CRM account if lead has no existing account |
   | Account Name | Name for auto-created account |

2. System actions on conversion:
   - Lead status → **CONVERTED** with `convertedAt` timestamp
   - New **CrmOpportunity** created and linked via `convertedToOppId`
   - Optional new **CrmAccount** created if `createAccount = true`
   - Lead remains linked to the new opportunity for traceability

### 6.6 AI Lead Scoring

- Click **Score** on a lead → AI evaluates lead quality (0–100)
- Score includes:
  - **Numeric score** (0–100)
  - **Reason** (explanation of why this score)
  - **Scored At** (timestamp)
- Higher scores = hotter leads
- Helps prioritize which leads to pursue first

### Walkthrough Demo Script

> "A new lead comes in from the website: 'Grab — Trust Product Enquiry'. It enters as NEW status. I mark it CONTACTED after my initial email. Then I meet with the client and mark it QUALIFIED. The AI scores it at 82/100 — 'Large Malaysian company with existing relationship, strong indicators of conversion'. I click Convert to Opportunity, name it 'Grab — Cash Trust Setup', set value at RM800,000, pipeline stage Prospecting. The lead status flips to CONVERTED and now I have a deal in my pipeline."

---

## 7. User Journey 5: Opportunity Pipeline (Kanban)

**Persona:** Sales Rep / Manager

### 7.1 Pipeline View (Kanban Board)

Navigate to **Pipeline** tab:
- **Visual Kanban board** with columns for each pipeline stage
- Each column shows opportunity cards with: name, value, owner, close date
- **Drag and drop** cards between stages to move opportunities
- **Inline creation**: Add new opportunity directly in any stage column

### 7.2 Default Pipeline Stages

| Stage | Win Probability | Description |
|-------|-----------------|-------------|
| Prospecting | 10% | Initial exploration |
| Qualification | 25% | Needs confirmed |
| Proposal | 50% | Proposal submitted |
| Negotiation | 75% | Terms under negotiation |
| Closed Won | 100% | Deal closed successfully |
| Closed Lost | 0% | Deal lost (reason required) |

> Pipelines are configurable — admin can create multiple pipelines with custom stages.

### 7.3 Opportunity Detail Page

Click on an opportunity to see:

**Header Section:**
- **Stage Progress Bar**: Visual step indicator showing completed, current, and future stages
- **KPI Chips**: Deal Value, Probability %, Close Date
- **AI Win Probability**: One-click prediction with confidence level and reasoning

**Tabs:**

| Tab | Features |
|-----|----------|
| **Overview** | Deal details, linked account/contact, owner, pipeline info |
| **Activities** | Chronological log of all deal activities |
| **Notes** | Deal notes with pinning |
| **Stage History** | Timeline of all stage transitions with who moved and when |

### 7.4 Move Stage

Two ways to move a deal forward:

1. **Kanban drag-and-drop** on the Pipeline page
2. **Move Stage modal** on the detail page:
   - Select target stage
   - If moving to **Closed Lost**: Lost Reason is required
   - System records: who moved, when, from stage, to stage

### 7.5 Stage History

Every stage transition is recorded in `CrmOpportunityStageHistory`:
- From Stage Name → To Stage Name
- Moved By (user)
- Moved At (timestamp)
- Visible on the **Stage History** tab

### 7.6 AI Win Probability

- Click the **AI Win Probability** chip on opportunity detail
- System analyses deal data and returns:
  - **Win probability** (e.g., 73%)
  - **Confidence level** (how certain the AI is)
  - **Reason** (key factors driving the prediction)
- Helps reps prioritise deals most likely to close

### 7.7 AI Win/Loss Debrief

- Available only on **Closed Won** or **Closed Lost** deals
- Click **Win/Loss Debrief** → AI analyses:
  - **Key factors** that influenced the outcome
  - **Lessons learned**
  - **Follow-on actions** (cross-sell, relationship maintenance)
- Valuable for institutional knowledge and coaching

### Walkthrough Demo Script

> "I open the Pipeline Kanban board. I see 8 deals across 4 active stages. I drag the AirAsia deal from Qualification to Proposal — the system records the move. On the Grab deal detail, I click AI Win Probability — it predicts 68% with 'Strong client relationship but price sensitivity noted'. We negotiate and close the deal as Won. The AI Win/Loss Debrief tells me: 'Key factor: existing trust product relationship. Lesson: early engagement with compliance speeds up close. Follow-on: propose trust review service'."

---

## 8. User Journey 6: Activities & Notes

**Persona:** Sales Rep

### 8.1 Activity Types

| Type | Icon Purpose |
|------|-------------|
| CALL | Phone call record |
| EMAIL | Email correspondence |
| MEETING | In-person or virtual meeting |
| NOTE | Quick information note |
| TASK | To-do or action item |
| FOLLOW_UP | Scheduled follow-up |
| WHATSAPP | WhatsApp conversation |
| SITE_VISIT | Physical site visit |

### 8.2 Log an Activity

1. From any detail page (Account, Contact, Lead, Opportunity) → click **Log Activity**
2. Or from the Opportunity detail → **Log Activity** button

| Field | Description |
|-------|-------------|
| Activity Type | Select from 8 types above |
| Subject | Brief description |
| Description | Detailed notes |
| Scheduled At | Future date for planned activities |
| Completed At | Date for past activities |
| Duration | In minutes (for calls, meetings) |
| Linked To | Auto-linked to the current record |

3. Activity is recorded and appears in the timeline

### 8.3 AI Activity Note Analysis

- On CALL, MEETING, WHATSAPP activities, click **Analyze** button
- AI extracts:

  | Output | Description |
  |--------|-------------|
  | Sentiment | Positive / Neutral / Negative |
  | Next Action | Suggested follow-up action |
  | Key Facts | Important information extracted |
  | Suggested Stage Change | If the AI thinks the deal should move stage |

- Example: After logging a meeting, AI says: "Sentiment: Positive. Key facts: Client wants RM3M trust setup by March. Next action: Send proposal. Suggested stage change: Qualification → Proposal"

### 8.4 Notes

- Add notes to any Account, Contact, Lead, or Opportunity
- **Pin** important notes (pinned notes appear first)
- Notes are chronological
- Author and timestamp recorded

### 8.5 AI Draft Message

- Available on **Lead** and **Contact** detail pages
- Click **Draft Message** → AI generates a communication draft
- Options: **Formal** or **Friendly** tone
- Channel: **Email** or **WhatsApp**
- Review, edit, and send

### Walkthrough Demo Script

> "After my meeting with the AirAsia team, I log a MEETING activity with subject 'Trust product proposal presentation'. I note that they're interested in a Cash Trust of RM1.5M. I click Analyze — AI says: 'Sentiment: Positive. Key facts: Budget confirmed at RM1.5M, decision by end of month. Next action: Send formal proposal. Suggested stage change: Qualification → Proposal.' I update the stage and draft a formal WhatsApp message to the contact thanking them for the meeting."

---

## 9. User Journey 7: Trust Products & Beneficiaries

**Persona:** Sales Rep → Admin

### 9.1 Trust Product Types

| Type | Description |
|------|-------------|
| LIVING_TRUST | Trust established during settlor's lifetime |
| TESTAMENTARY_TRUST | Trust created via will, activated on death |
| CHARITABLE_TRUST | Trust for charitable purposes |
| CASH_TRUST | Cash-only trust product |

### 9.2 Create a Trust Product

From Account Detail → **Trust Products** tab → Create:

| Field | Description |
|-------|-------------|
| Account | Linked account (settlor) |
| Contact | Linked contact (primary contact) |
| Opportunity | Linked opportunity (1:1 on deal closure) |
| Trust Type | Living / Testamentary / Charitable / Cash |
| Deed Reference Number | Legal deed number |
| Asset Value | Trust value in MYR |
| Currency | Default MYR |
| Trustee Name | Assigned trustee |
| Trustee Contact | Trustee contact details |
| Settlement Date | Date trust was settled |
| Maturity Date | Trust maturity / review date |
| Next Review Date | Scheduled review date |

### 9.3 Trust Product Status Lifecycle

```
ACTIVE ──review──▶ UNDER_REVIEW ──approve──▶ ACTIVE
                                ──suspend──▶ SUSPENDED ──reinstate──▶ UNDER_REVIEW
                           ──close──▶ CLOSED (terminal)
```

| Status | Meaning | Who Can Change |
|--------|---------|---------------|
| ACTIVE | Trust is active and operational | Admin |
| UNDER_REVIEW | Trust is being reviewed | Admin |
| SUSPENDED | Trust suspended (compliance issue) | Admin |
| CLOSED | Trust closed/terminated | Admin |

> Status changes require `crm:admin` permission.

### 9.4 Manage Beneficiaries

On a contact's detail page, manage beneficiaries:

| Field | Description |
|-------|-------------|
| First Name / Last Name | Beneficiary name |
| Relationship | SPOUSE, CHILD, PARENT, SIBLING, OTHER |
| Allocation % | Percentage of trust allocation |
| Email / Phone | Contact details |
| NRIC/Passport | ID (Malaysian) |
| Date of Birth | DOB |
| Is Minor | Under 18 flag |
| Guardian Name | If minor, guardian name |

### 9.5 AI Document Checklist

- On a Trust Product detail, AI can generate a **Document Checklist**
- Lists all documents required for the specific trust type setup
- Example for Cash Trust: "NRIC copies of settlor and beneficiaries, bank statements, source of funds declaration, PDPA consent forms"

### Walkthrough Demo Script

> "The Grab deal closes as Won — RM800,000 Cash Trust. I create a Trust Product linked to the account and opportunity, set deed reference 'CT-2024-0042', trustee as 'Citadel Trustee Services'. I add 3 beneficiaries: spouse (40%), child 1 (30%), child 2 (30%). The AI Document Checklist tells me I need settlor NRIC, beneficiary NRICs, bank statements, and PDPA forms. I set the trust to ACTIVE. The scheduled job will notify me when nextReviewDate approaches."

---

## 10. User Journey 8: Team Dashboard & Manager AI

**Persona:** Sales Manager (requires `crm:admin`)

### 10.1 Team Dashboard

Navigate to **Team** tab:

**Team Performance Table:**
| Metric | Description |
|--------|-------------|
| Rep Name | Sales rep identity |
| Total Deals | All opportunities assigned |
| Won Deals | Closed Won count |
| Win Rate | Won / Total percentage |
| Revenue | Total won deal value |
| Avg Deal Size | Average value per won deal |

**AI Manager Briefing:**
- System analyses the team's pipeline and provides:
  - **Pipeline health**: Overall pipeline strength and balance
  - **At-risk deals**: Opportunities showing warning signs
  - **Rep activity gaps**: Reps with insufficient activity levels
  - **Manager actions**: Suggested coaching or intervention actions

**Rep Inactivity Detection:**
- Flags reps with fewer than 3 activities in the current week
- Notified via the automated **Rep Inactivity** job (Fridays 4 PM)

### Walkthrough Demo Script

> "As the sales manager, I open the Team Dashboard. The performance table shows Sarah has 5 deals and 60% win rate, but Ahmad has only 1 won deal this quarter. The AI Manager Briefing flags: 'Pipeline is weighted toward early stages — insufficient deals in Negotiation. Ahmad has been inactive for 5 days. Action: Schedule 1-on-1 with Ahmad, focus on moving Sarah's Grab deal to Negotiation.' I immediately know where to focus my coaching time."

---

## 11. User Journey 9: Reports & Analytics

**Persona:** Manager / Analyst

### 11.1 Available Reports

Navigate to **Reports** tab — 7 report types with date range and filter options:

| # | Report | Key Metrics | Filters |
|---|--------|------------|---------|
| 1 | **Lead Conversion** | Conversion rate by source, by status, overall rate | Date range, Owner |
| 2 | **Sales Performance** | Deals, win rate, won/lost value, avg deal size — by owner | Date range |
| 3 | **Pipeline Forecast** | Deal count, total value, weighted value by stage; overdue deals | Date range, Pipeline |
| 4 | **Activity Summary** | Activity counts by type, by user with breakdown | Date range |
| 5 | **Lead Aging** | Avg/max age by status, 30/60/90+ day buckets, stale leads | Date range |
| 6 | **Win/Loss Analysis** | By loss reason, overall win rate | Date range |
| 7 | **KYC Compliance** | By status, expiring soon, PEP flagged, compliance rate | Date range |

### 11.2 CSV Export

- Each report has a **CSV Export** button
- Downloads current report data as CSV for external analysis

### Walkthrough Demo Script

> "I need to present quarterly CRM performance to management. I open Reports → Sales Performance, set the date range to Q4. The report shows: team win rate of 42%, total pipeline value RM8.2M, weighted forecast RM3.1M. The Pipeline Forecast shows 60% of deals are stuck in Prospecting — I'll highlight the need for faster qualification. I export all 7 reports to CSV for the PowerPoint deck."

---

## 12. AI Feature Catalogue

All 10 AI features, organised by deployment phase:

### Phase 1 — Agent Productivity

| Feature | Where | What It Does |
|---------|-------|-------------|
| **Draft Message** | Lead/Contact detail | Generates WhatsApp/Email message in Formal or Friendly tone |
| **Activity Note Analysis** | CALL/MEETING/WHATSAPP activity | Extracts sentiment, next action, key facts, suggests stage change |
| **AI Lead Summary** | Lead detail page | Auto-generates a profile summary of the lead |

### Phase 2 — Sales Intelligence

| Feature | Where | What It Does |
|---------|-------|-------------|
| **Lead Scoring** | Lead list/detail | Scores lead quality 0–100 with reasoning |
| **Win Probability** | Opportunity detail | Predicts win % with confidence level and key factors |
| **Daily Briefing** | Dashboard | AI summary of today's tasks, at-risk deals, stale leads |

### Phase 3 — Compliance Assist

| Feature | Where | What It Does |
|---------|-------|-------------|
| **KYC Gap Detector** | Contact KYC tab | Lists missing KYC fields with Required/Recommended severity |
| **Risk Profile** | Contact KYC tab | Suggests BNM-aligned risk tier with regulatory basis |
| **Document Checklist** | Trust Product detail | Generates setup document checklist by trust type |

### Phase 3 — Manager Intelligence

| Feature | Where | What It Does |
|---------|-------|-------------|
| **Manager Briefing** | Team Dashboard | Pipeline health, at-risk deals, rep gaps, manager actions |
| **Win/Loss Debrief** | Closed opportunity | Key factors, lessons learned, follow-on actions |

---

## 13. Automated Jobs & Notifications

7 scheduled jobs run automatically on node-cron:

| Job | Schedule | What It Detects | Notification |
|-----|----------|----------------|-------------|
| **Activity Reminders** | Every 4 hours | Activities scheduled within next 24h | Reminds assigned user |
| **Lead Aging** | Mon–Fri 8:00 AM | Leads with no activity in 7+ days | Notifies owner + manager |
| **Overdue Follow-Ups** | Mon–Fri 8:30 AM | Leads past `followUpDate`, not CONVERTED/LOST | Notifies owner |
| **Stale Deals** | Mon–Fri 9:00 AM | Opportunities not updated in 14+ days | Notifies owner + manager |
| **Trust Review Dates** | Mon–Fri 10:00 AM | Trust products with `nextReviewDate` within 7 days | Notifies owner |
| **KYC Expiration** | Mon–Fri 6:00 AM | KYC records expiring within 30 days | Notifies owner + manager |
| **Rep Inactivity** | Mon–Fri 4:00 PM | Reps with fewer than 3 activities this week | Notifies manager |

**Deduplication**: The system won't notify the same user about the same item twice in one day.

**Configuration**: Jobs can be set to `cron`, `interval`, or `disabled` mode via `config.crmSchedule.mode`.

---

## 14. Governance & Malaysian Compliance

### 14.1 PDPA (Personal Data Protection Act)

- **PDPA Consent** field on every Contact record
- **PDPA Consent Date** tracks when consent was given
- **Marketing Opt-In** separate from general consent
- Contacts cannot receive marketing without explicit opt-in

### 14.2 BNM KYC/AML Compliance

- **KYC Verification Checklist**: 5-item mandatory verification
- **PEP (Politically Exposed Person)** flag on contacts
- **AML Risk Tier** and **Screening Status** tracked
- **KYC Expiry**: Auto-notified 30 days before expiry via scheduled job
- **Risk-Based Approach**: AI suggests LOW/MEDIUM/HIGH per BNM guidelines
- **Source of Funds verification** mandatory before approval

### 14.3 SSM (Suruhanjaya Syarikat Malaysia)

- **Registration Number** on Accounts corresponds to SSM registration
- **Tax Number** for LHDN compliance
- **Bank Account** for financial verification

### 14.4 Data Integrity

- **Duplicate detection** on Contacts (email/phone) and Leads (email/phone)
- **Soft delete** on CRM records (data retained, flagged as deleted)
- **Stage history trail** on Opportunities (every move is tracked)
- **KYC audit trail** (approved by, approved at, rejection reasons)

---

## 15. Permission Reference

| Permission | Description | Who Typically Has It |
|-----------|-------------|---------------------|
| `crm:read` | View all CRM data, use AI features, search, daily briefing | All CRM users |
| `crm:write` | Create/edit accounts, contacts, leads, opportunities, activities, notes, trust products, beneficiaries, KYC updates | Sales Reps, Analysts |
| `crm:delete` | Soft-delete accounts, contacts, leads, opportunities, activities, beneficiaries, trust products | Admin, Managers |
| `crm:admin` | Pipeline CRUD, trust product status changes, KYC approval, team performance, manager briefing | Admin, Sales Manager |

---

## 16. Data Model Reference

### Entity Relationships

```
Account ──1:N──▶ Contact ──1:1──▶ KYC Record
   │               │
   │               └──1:N──▶ Beneficiary
   │
   ├──1:N──▶ Lead ──1:1──▶ Opportunity (on conversion)
   │
   ├──1:N──▶ Opportunity ──1:1──▶ Trust Product
   │                  │
   │                  └──1:N──▶ Stage History
   │
   └──polymorphic──▶ Activity / Note

Pipeline ──1:N──▶ Pipeline Stage ──1:N──▶ Opportunity
```

### Key Enums

**Lead Status:**
| Status | Description |
|--------|-------------|
| NEW | Fresh, not contacted |
| CONTACTED | Initial outreach done |
| QUALIFIED | Meets opportunity criteria |
| UNQUALIFIED | Does not meet criteria |
| CONVERTED | Turned into opportunity |
| LOST | No longer viable |

**Lead Source:**
WEBSITE | REFERRAL | COLD_CALL | TRADE_SHOW | LINKEDIN | ADVERTISEMENT | PARTNER | OTHER

**Activity Types:**
CALL | EMAIL | MEETING | NOTE | TASK | FOLLOW_UP | WHATSAPP | SITE_VISIT

**KYC Status:**
| Status | Description |
|--------|-------------|
| PENDING | Not started |
| IN_PROGRESS | Verification underway |
| APPROVED | All checks passed |
| REJECTED | Failed verification |
| EXPIRED | Passed expiry date |

**Trust Product Status:**
| Status | Description |
|--------|-------------|
| ACTIVE | Operational |
| UNDER_REVIEW | Being reviewed |
| SUSPENDED | Suspended (compliance) |
| CLOSED | Terminated |

**Risk Levels:**
LOW | MEDIUM | HIGH

---

*Document generated for stakeholder walkthrough of the CWC 2.0 CRM Module.*
*Citadel Group Technologies Sdn Bhd*