# CRM Full Implementation Plan
**Based on:** `docs/CRM_AUDIT_FINDINGS.md` (2026-05-09)
**Target:** Bring CRM from maturity 3.8/10 to production-ready (8/10+) in 4 phases

---

## Phase 0 — Documentation Discovery

Before executing any phase, the executing agent MUST:

1. Read `backend/src/routes/crm.routes.ts` — verify exact route paths and middleware pattern
2. Read `backend/src/controllers/crm.controller.ts` — verify controller function signatures
3. Read `backend/src/services/crm.service.ts` — verify service function signatures
4. Read `backend/prisma/schema.prisma` lines 1432–1690 — verify current CRM models
5. Read `frontend/App.tsx` lines 395–415 — verify current route component assignments
6. Read `frontend/src/services/crm.service.ts` — verify frontend API interfaces
7. Read `docs/superpowers/plans/2026-05-08-crm-gaps.md` — absorb already-scoped gap tasks
8. Read `backend/src/routes/index.ts` — verify how crm.routes is mounted
9. Check existing detail pages: `frontend/pages/CrmContactDetail.tsx`, `frontend/pages/CrmOpportunityDetail.tsx`
10. Read one existing routes file with validators applied (e.g., `backend/src/routes/asset.routes.ts`) for middleware pattern

**Anti-patterns to avoid:**
- Do NOT invent Prisma field names — read the schema first
- Do NOT invent middleware names — read an existing working routes file
- Do NOT create new service functions without checking if they already exist in `crm.service.ts`

---

## Phase 1 — Critical Bug Fixes & Security (Go-Live Blockers)

**Goal:** Make the CRM minimally usable and secure. After this phase, agents can open leads, contacts, accounts, and opportunities, and no critical security holes exist.

**Estimated effort:** 1–2 days

### Task 1.1 — Fix Frontend Routing (B1, UX1)

**File:** `frontend/App.tsx`

Fix the 4 broken routes:

```tsx
// BEFORE (broken — all these loop back to list pages):
{ path: "/crm/accounts/:id", element: <CrmAccounts /> }
{ path: "/crm/contacts/:id", element: <CrmContacts /> }  // should be CrmContactDetail
{ path: "/crm/leads/:id", element: <CrmLeads /> }
{ path: "/crm/opportunities/:id", element: <CrmPipelineView /> }

// AFTER:
{ path: "/crm/accounts/:id", element: <CrmAccountDetail /> }   // needs to be built
{ path: "/crm/contacts/:id", element: <CrmContactDetail /> }   // already exists
{ path: "/crm/leads/:id", element: <CrmLeadDetail /> }         // needs to be built
{ path: "/crm/opportunities/:id", element: <CrmOpportunityDetail /> }  // already exists
```

Import the existing detail pages (`CrmContactDetail`, `CrmOpportunityDetail`) and build the two missing pages (`CrmAccountDetail`, `CrmLeadDetail`).

**Pattern to follow for new pages:** `frontend/pages/CrmContactDetail.tsx` (127 lines) and `frontend/pages/CrmOpportunityDetail.tsx` (367 lines)

**`CrmAccountDetail` must show:**
- Account name, industry, website, phone, email
- Malaysian fields: registrationNumber, taxNumber, purchaseCashTrust badge
- Tabs: Overview, Contacts (linked contacts), Deals (linked opportunities), Activity, Notes
- Edit modal for account fields

**`CrmLeadDetail` must show:**
- Lead info (title, company, contact, status, source, estimated value)
- "Convert Lead" button → triggers convert modal (existing service: `convertLead()`)
- "Mark as Lost" button
- Activity log tab
- Notes tab
- Follow-up date display (after schema migration in Task 1.3)

**Verification:**
- Navigate to `/crm/accounts/[any-id]` → should render account detail, not list
- Navigate to `/crm/contacts/[any-id]` → should render contact detail
- Navigate to `/crm/leads/[any-id]` → should render lead detail with convert button
- Navigate to `/crm/opportunities/[any-id]` → should render opportunity detail with stage movement

### Task 1.2 — Add Missing Create Modals (B2, B3)

**File 1:** `frontend/pages/CrmContacts.tsx`

Add a "New Contact" button that opens a create modal. Pattern to follow: the "New Lead" modal in `CrmLeads.tsx`.

Modal fields:
- First name (required), Last name (required)
- Email, Phone, Mobile
- Job title, Department
- Account (dropdown — fetch from `/api/v1/crm/accounts`)
- Is Primary contact toggle

API call: `POST /api/v1/crm/contacts` (already exists)

**File 2:** `frontend/pages/CrmPipeline.tsx`

Add a "New Deal" button at the top of the kanban board that opens a create modal.

Modal fields:
- Deal name (required)
- Account (dropdown, required)
- Pipeline (pre-selected, readonly if in single-pipeline view)
- Stage (dropdown from selected pipeline's stages)
- Value (MYR, numeric)
- Expected close date
- Owner (dropdown — users with crm:write)

API call: `POST /api/v1/crm/opportunities` (already exists)

**Verification:**
- CrmContacts page shows "New Contact" button
- Submitting the form creates a contact visible in the list
- CrmPipeline page shows "New Deal" button
- New deal card appears in the correct stage column

### Task 1.3 — Wire Zod Validators as Middleware (B4)

**File:** `backend/src/routes/crm.routes.ts`

Import validation middleware. Read an existing routes file that uses validators (e.g., `asset.routes.ts` or `request.routes.ts`) for the exact middleware pattern.

Wire the following validators (all already defined in `crm.validator.ts`):
- `createAccountSchema` → POST /accounts
- `updateAccountSchema` → PUT /accounts/:id
- `createContactSchema` → POST /contacts
- `updateContactSchema` → PUT /contacts/:id
- `createLeadSchema` → POST /leads
- `updateLeadSchema` → PUT /leads/:id
- `convertLeadSchema` → POST /leads/:id/convert
- `createOpportunitySchema` → POST /opportunities
- `updateOpportunitySchema` → PUT /opportunities/:id
- `moveStageSchema` → POST /opportunities/:id/move-stage
- `createPipelineSchema` → POST /pipelines
- `updatePipelineSchema` → PUT /pipelines/:id
- `createActivitySchema` → POST /activities
- `updateActivitySchema` → PUT /activities/:id
- `createNoteSchema` → POST /notes
- `updateNoteSchema` → PUT /notes/:id

**Verification:**
- POST /api/v1/crm/accounts with missing `name` field → 422 validation error
- POST /api/v1/crm/leads with invalid `status` enum → 422 error
- POST /api/v1/crm/accounts with valid payload → 201 created

### Task 1.4 — Mask/Encrypt bankAccount Field (B5, S1)

**File:** `backend/prisma/schema.prisma`

Keep `bankAccount String?` in schema (do not change DB type). Apply application-level masking:

**File:** `backend/src/controllers/crm.controller.ts`

In `getAccount()` and `listAccounts()` responses, mask bankAccount:
```typescript
bankAccount: account.bankAccount 
  ? `****${account.bankAccount.slice(-4)}` 
  : null
```

In `createAccount()` and `updateAccount()`, if bankAccount is provided, encrypt before storing using the existing crypto utility (check `backend/src/utils/` for existing crypto helpers). If no crypto util exists, use Node.js `crypto.createCipheriv` with AES-256-CBC and a `BANK_ACCOUNT_ENCRYPTION_KEY` env var.

Add `BANK_ACCOUNT_ENCRYPTION_KEY` to `.env.example`.

**Verification:**
- Create account with bankAccount `"1234567890"`
- GET account → bankAccount shows `"******7890"` (last 4 digits only)
- Raw DB query shows encrypted/hashed value, not plaintext

### Task 1.5 — Add Ownership Scoping to List Queries (B6, S2)

**File:** `backend/src/controllers/crm.controller.ts`

For `listAccounts()`, `listLeads()`, `listOpportunities()`, `listContacts()`:

```typescript
// Add ownership filter for non-admin users
const ownerFilter = req.user.role !== 'ADMIN' 
  ? { ownerId: req.user.id } 
  : {};

// Merge into existing where clause
where: { ...ownerFilter, ...existingFilters }
```

Admin users should still see all records (for management oversight).

Also update `getDashboardStats()` in `crm.service.ts` to accept an optional `userId` parameter and apply ownership filter when provided. Wire the "My Deals" toggle in `CrmDashboard.tsx` to pass the current user's ID.

**Verification:**
- Log in as Agent A, create a lead → visible in list
- Log in as Agent B → Agent A's lead is NOT visible
- Log in as Admin → all leads from all agents visible
- Dashboard "My Deals" toggle → stats reflect only current user's pipeline

### Phase 1 Verification Checklist

```bash
# Run backend build
cd backend && npm run build  # must succeed with 0 errors

# Run tests
npm test  # must pass

# Manual smoke test
# 1. Navigate to /crm/leads → click any lead → opens CrmLeadDetail
# 2. Navigate to /crm/contacts → click "New Contact" → modal opens → submit → contact appears
# 3. Navigate to /crm/pipeline → click "New Deal" → modal opens → submit → card appears in stage
# 4. POST /api/v1/crm/accounts without name → 422 response
# 5. GET /api/v1/crm/accounts → bankAccount shows masked value
# 6. Agent A cannot see Agent B's leads in list
```

---

## Phase 2 — Sales Operations & Workflow (P1 Items)

**Goal:** Enable real daily sales agent workflow — daily priorities, follow-up tracking, activity reminders, manager team view.

**Estimated effort:** 3–4 days

### Task 2.1 — Schema Additions (Prisma Migration)

**File:** `backend/prisma/schema.prisma`

Add the following fields:

**CrmLead additions:**
```prisma
followUpDate    DateTime?
followUpNote    String?
```

**CrmContact additions:**
```prisma
nricPassport    String?        // Store encrypted — see Task 1.4 pattern
dateOfBirth     DateTime?
preferredLanguage  String?     // EN | BM | ZH
pdpaConsent     Boolean        @default(false)
pdpaConsentDate DateTime?
marketingOptIn  Boolean        @default(false)
```

**CrmAccount additions:**
```prisma
accountType     String         @default("CORPORATE")  // INDIVIDUAL | CORPORATE
```

**Add soft-delete to all CRM entities (CrmAccount, CrmContact, CrmLead, CrmOpportunity):**
```prisma
deletedAt       DateTime?
```

**Update all list query where clauses to exclude soft-deleted records:**
```typescript
where: { deletedAt: null, ...otherFilters }
```

**Run migration:**
```bash
cd backend && npx prisma migrate dev --name crm-phase2-fields
```

### Task 2.2 — Add WhatsApp Activity Type

**File:** `backend/prisma/schema.prisma`

Add `WHATSAPP` and `SITE_VISIT` to `CrmActivityType` enum:
```prisma
enum CrmActivityType {
  CALL
  EMAIL
  MEETING
  NOTE
  TASK
  FOLLOW_UP
  WHATSAPP    // ADD
  SITE_VISIT  // ADD
}
```

Update `crm.validator.ts` to include new types in the activity enum.

Update activity type display labels in `CrmOpportunityDetail.tsx` and anywhere activity types are rendered.

### Task 2.3 — Activity Reminder Notifications

**File:** Create `backend/src/services/crm-automation.service.ts`

Pattern to follow: `backend/src/services/sla.service.ts` (existing SLA cron logic)

Implement the following cron jobs:

**Job 1: Activity reminders (run every 30 minutes)**
```typescript
export async function checkActivityReminders() {
  const upcoming = await prisma.crmActivity.findMany({
    where: {
      scheduledAt: {
        gte: new Date(),
        lte: addHours(new Date(), 24)
      },
      completedAt: null,
    },
    include: { lead: true, opportunity: true, assignedTo: true }
  });
  // Send in-app notification to activity owner
  // Use existing notificationService.notify() pattern
}
```

**Job 2: Lead aging alerts (run daily at 8:00 AM)**
```typescript
export async function checkLeadAging() {
  const staleLeads = await prisma.crmLead.findMany({
    where: {
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
      activities: {
        none: {
          createdAt: { gte: subDays(new Date(), 7) }
        }
      }
    },
    include: { owner: true }
  });
  // Notify owner + their manager
}
```

**Job 3: Overdue follow-ups (run daily at 8:00 AM)**
```typescript
export async function checkOverdueFollowUps() {
  const overdue = await prisma.crmLead.findMany({
    where: {
      followUpDate: { lt: new Date() },
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null
    },
    include: { owner: true }
  });
  // Notify owner
}
```

**Job 4: Deals past close date (run daily at 8:00 AM)**
```typescript
export async function checkStaledDeals() {
  const pastClose = await prisma.crmOpportunity.findMany({
    where: {
      expectedCloseDate: { lt: new Date() },
      wonAt: null,
      lostAt: null,
      deletedAt: null
    },
    include: { owner: true, account: true }
  });
  // Notify owner + manager
}
```

Wire all jobs into the existing cron scheduler. Check `backend/src/app.ts` or `backend/src/index.ts` for how SLA cron jobs are scheduled and follow the same pattern.

### Task 2.4 — Agent Dashboard Redesign

**File:** `frontend/pages/CrmDashboard.tsx`

Replace the single stat card row with a two-section layout:

**Section A: "Today's Priorities" (top of page)**
```
┌─────────────────────────────────────────────────────────┐
│  TODAY'S PRIORITIES                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Follow-ups   │  │ Overdue      │  │ Scheduled    │  │
│  │ Due Today    │  │ Leads (7d)   │  │ Activities   │  │
│  │     [N]      │  │    [N]       │  │    [N]       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

Each card links to the filtered list (e.g., clicking "Follow-ups Due Today" goes to `/crm/leads?followUpDate=today`).

**Section B: Pipeline Performance (existing stats, enhanced)**

Add `followUpDueToday`, `staleleads`, `overdueDeals` counts to `getDashboardStats()` response.

**Wire "My Deals" toggle:** Pass `userId` query param when toggle is ON.

### Task 2.5 — Manager Team Performance View

**File:** Create `frontend/pages/CrmTeamDashboard.tsx`

Only visible to users with `crm:admin` permission (managers, directors).

Sections:
1. **Team Pipeline Summary Table:**
   | Agent | Leads | Contacted | Qualified | Open Deals | Pipeline Value | Closed This Month |
   |---|---|---|---|---|---|---|

2. **Alerts Section:**
   - Agents with leads not contacted in 7+ days
   - Agents with deals past expected close date
   - Agents below monthly target (if target field added)

3. **Lead Source Effectiveness:**
   - Bar chart: lead source vs conversion rate

**Backend:** Add `GET /api/v1/crm/reports/team-performance` to `crm.routes.ts`.

Add `getTeamPerformance(managerUserId?)` to `crm.service.ts`:
```typescript
async function getTeamPerformance() {
  const agents = await prisma.user.findMany({
    where: { role: { in: ['AGENT', 'SALES'] } },
    select: {
      id: true, name: true,
      _count: {
        select: {
          crmLeadsOwned: { where: { deletedAt: null } },
          crmOpportunitiesOwned: { where: { wonAt: null, lostAt: null, deletedAt: null } }
        }
      }
    }
  });
  // Return per-agent stats
}
```

**Route:** Add `/crm` sidebar link for "Team Dashboard" visible only to `crm:admin` users.

### Task 2.6 — Lead List UX Improvements (UX3, UX6)

**File:** `frontend/pages/CrmLeads.tsx`

Enhance lead cards to show:
- **Last activity date** with "X days ago" label
- **Follow-up due date** with red color if overdue
- **Owner avatar** (initials circle)
- **Age since created** (e.g., "Created 12d ago")
- **Urgency badge:** RED if no activity 7+ days, AMBER if follow-up overdue

This requires updating the `listLeads` API to include last activity date in the response (add `_max: { createdAt: true }` in activities aggregate or include latest activity).

### Phase 2 Verification Checklist

```bash
# Schema migration
cd backend && npx prisma migrate dev  # 0 errors

# Build
npm run build  # 0 errors

# Test automation
# 1. Create a lead with followUpDate = yesterday → dashboard shows in "Follow-ups Due Today"
# 2. Create lead with no activity → after 7 days, should appear in aging alerts
# 3. Admin user visits /crm/team → sees Team Dashboard
# 4. Agent user visits /crm/team → 403 or redirect
# 5. Lead card shows last contacted date and owner avatar
# 6. "My Deals" dashboard toggle shows only current user's stats
```

---

## Phase 3 — Trust Industry Models & Reporting

**Goal:** Build the trust-industry-specific data layer and actionable reporting.

**Estimated effort:** 5–7 days

### Task 3.1 — Prisma Schema: Trust Industry Models

**File:** `backend/prisma/schema.prisma`

Add the following models:

```prisma
model CrmBeneficiary {
  id              String     @id @default(cuid())
  contactId       String
  contact         CrmContact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  firstName       String
  lastName        String
  relationship    String     // SPOUSE | CHILD | PARENT | SIBLING | OTHER
  allocationPct   Decimal    // 0-100
  email           String?
  phone           String?
  nricPassport    String?    // encrypted
  dateOfBirth     DateTime?
  isMinor         Boolean    @default(false)
  guardianName    String?
  notes           String?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model CrmTrustProduct {
  id              String     @id @default(cuid())
  accountId       String
  account         CrmAccount @relation(fields: [accountId], references: [id])
  contactId       String?
  contact         CrmContact? @relation(fields: [contactId], references: [id])
  opportunityId   String?    @unique
  opportunity     CrmOpportunity? @relation(fields: [opportunityId], references: [id])
  
  trustType       String     // LIVING_TRUST | TESTAMENTARY_TRUST | CHARITABLE_TRUST | CASH_TRUST
  deedRefNumber   String?    @unique
  status          String     @default("ACTIVE")  // ACTIVE | UNDER_REVIEW | SUSPENDED | CLOSED
  
  assetValue      Decimal?
  currency        String     @default("MYR")
  assetDescription String?
  
  trusteeName     String?
  trusteeContact  String?
  settlementDate  DateTime?
  maturityDate    DateTime?
  nextReviewDate  DateTime?
  
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  ownerId         String
  owner           User       @relation(fields: [ownerId], references: [id])
  
  @@index([accountId])
  @@index([contactId])
  @@index([nextReviewDate])
}

model CrmKycRecord {
  id              String     @id @default(cuid())
  contactId       String     @unique
  contact         CrmContact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  status          String     @default("PENDING")  // PENDING | IN_PROGRESS | APPROVED | EXPIRED | REJECTED
  riskLevel       String?    // LOW | MEDIUM | HIGH
  isPep           Boolean    @default(false)  // Politically Exposed Person
  
  nricVerified    Boolean    @default(false)
  addressVerified Boolean    @default(false)
  incomeVerified  Boolean    @default(false)
  sourceOfFundsVerified Boolean @default(false)
  riskProfileDone Boolean    @default(false)
  
  approvedAt      DateTime?
  approvedBy      String?
  expiresAt       DateTime?
  rejectionReason String?
  
  notes           String?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  
  @@index([status])
  @@index([expiresAt])
}
```

Also add to `CrmContact`:
```prisma
riskProfile     String?    // CONSERVATIVE | MODERATE | AGGRESSIVE
kycRecord       CrmKycRecord?
beneficiaries   CrmBeneficiary[]
trustProducts   CrmTrustProduct[]
```

Run migration:
```bash
npx prisma migrate dev --name crm-trust-industry-models
```

### Task 3.2 — Backend: Trust Product & KYC Controllers

**File:** `backend/src/controllers/crm.controller.ts`

Add controllers:
- `listTrustProducts(req, res)` — filter by accountId, contactId, status
- `getTrustProduct(req, res)` — includes beneficiaries, kyc, account
- `createTrustProduct(req, res)` — validates fields, logs audit
- `updateTrustProduct(req, res)`

- `getKycRecord(req, res)` — by contactId
- `createOrUpdateKycRecord(req, res)` — upsert pattern
- `approveKyc(req, res)` — sets status APPROVED, approvedAt, expiresAt (+2 years)

- `listBeneficiaries(req, res)` — by contactId
- `createBeneficiary(req, res)`
- `updateBeneficiary(req, res)`
- `deleteBeneficiary(req, res)`

**File:** `backend/src/routes/crm.routes.ts`

Add routes:
```
GET    /trust-products          crm:read
POST   /trust-products          crm:write
GET    /trust-products/:id      crm:read
PUT    /trust-products/:id      crm:write
DELETE /trust-products/:id      crm:delete

GET    /contacts/:id/kyc        crm:read
PUT    /contacts/:id/kyc        crm:write
POST   /contacts/:id/kyc/approve  crm:admin

GET    /contacts/:id/beneficiaries   crm:read
POST   /contacts/:id/beneficiaries   crm:write
PUT    /beneficiaries/:id            crm:write
DELETE /beneficiaries/:id            crm:delete
```

### Task 3.3 — Frontend: Trust Product Tab in Contact Detail

**File:** `frontend/pages/CrmContactDetail.tsx`

Add tabs: **Overview | KYC | Trust Products | Beneficiaries | Linked Deals | Notes**

**KYC Tab:**
- KYC status badge (PENDING/IN_PROGRESS/APPROVED/EXPIRED)
- Checklist: NRIC verified, address verified, income verified, source of funds, risk profile
- Risk level badge (LOW/MEDIUM/HIGH)
- PEP flag
- Approval date + expiry date
- "Approve KYC" button for crm:admin users

**Trust Products Tab:**
- List of trust product records (trust type, value, status, next review date)
- "New Trust Product" button

**Beneficiaries Tab:**
- List of beneficiaries with name, relationship, allocation %
- "Add Beneficiary" button
- Allocation total must sum to 100% (frontend validation)

### Task 3.4 — Reporting Service & Pages

**File:** `backend/src/services/crm-reports.service.ts`

Implement:

```typescript
// Monthly performance by agent
async function getAgentPerformanceReport(startDate: Date, endDate: Date) { ... }

// Lead source effectiveness
async function getLeadSourceReport(startDate: Date, endDate: Date) { ... }

// Pipeline forecast (weighted by probability)
async function getPipelineForecast() { ... }

// Win/loss analysis by reason
async function getWinLossReport(startDate: Date, endDate: Date) { ... }

// Sales cycle duration
async function getSalesCycleDuration() { ... }
```

**File:** Create `frontend/pages/CrmReports.tsx`

Tabs:
1. **Agent Performance** — table with date range picker
2. **Pipeline Forecast** — bar chart of weighted value by month
3. **Lead Sources** — pie/bar chart of source vs close rate
4. **Win/Loss Analysis** — table of loss reasons with counts
5. **KYC Compliance** — count of contacts by KYC status

Add `/crm/reports` route in `App.tsx`.

### Task 3.5 — Lead Auto-Assignment Rules

**File:** `backend/src/services/crm-automation.service.ts`

Add round-robin assignment when a lead is created without an owner:

```typescript
async function autoAssignLead(leadId: string) {
  // Get all active agents with crm:write permission
  // Sort by current lead count (ascending)
  // Assign to agent with fewest leads
  // Log assignment as CrmActivity (type: NOTE)
}
```

Wire into `createLead()` controller: if no `ownerId` in request, call `autoAssignLead()`.

### Phase 3 Verification Checklist

```bash
# Schema migration
npx prisma migrate dev  # 0 errors

# Build
npm run build  # 0 errors

# Manual tests
# 1. Navigate to /crm/contacts/:id → KYC tab shows checklist
# 2. Approve KYC as admin → status changes to APPROVED, expiry set 2 years out
# 3. Add beneficiary → allocation % shows running total
# 4. Navigate to /crm/reports → all 5 report tabs load without error
# 5. Create lead without owner → auto-assigned to agent with fewest leads
# 6. KYC expiry < 30 days → notification sent to contact owner
```

---

## Phase 4 — Advanced Features & Long-Term Foundation

**Goal:** Automation depth, mobile optimization, and the will writing pipeline.

**Estimated effort:** 5–7 days

### Task 4.1 — Document Attachment System

The existing system likely has a file upload mechanism for the IT/HR modules. Check `backend/src/routes/` for an upload route.

If file upload exists: extend it to accept CRM entity IDs (accountId, contactId, leadId, opportunityId, trustProductId) and store file references in a `CrmDocument` model:

```prisma
model CrmDocument {
  id            String    @id @default(cuid())
  fileName      String
  fileUrl       String
  fileSize      Int
  mimeType      String
  documentType  String    // NRIC | PASSPORT | TRUST_DEED | BENEFICIARY_FORM | ASSET_SCHEDULE | OTHER
  uploadedBy    String
  uploader      User      @relation(fields: [uploadedBy], references: [id])
  
  accountId     String?
  contactId     String?
  leadId        String?
  opportunityId String?
  trustProductId String?
  
  createdAt     DateTime  @default(now())
}
```

Add document upload tab to: CrmContactDetail, CrmOpportunityDetail, CrmAccountDetail.

### Task 4.2 — Will Writing Pipeline

Add a second default pipeline to the seed:

```typescript
// In seed-crm.ts or a new migration seed
const willWritingPipeline = await prisma.crmPipeline.create({
  data: {
    name: 'Will Writing',
    description: 'Will writing and estate planning sales process',
    stages: {
      create: [
        { name: 'Initial Inquiry', displayOrder: 1, probability: 10, color: '#94a3b8' },
        { name: 'Needs Assessment', displayOrder: 2, probability: 30, color: '#3b82f6' },
        { name: 'Draft Prepared', displayOrder: 3, probability: 60, color: '#8b5cf6' },
        { name: 'Review & Sign', displayOrder: 4, probability: 80, color: '#f59e0b' },
        { name: 'Completed', displayOrder: 5, probability: 100, color: '#22c55e', isWonStage: true },
        { name: 'Cancelled', displayOrder: 6, probability: 0, color: '#ef4444', isLostStage: true },
      ]
    }
  }
});
```

Also add:
- `Estate Planning` pipeline (similar structure)
- `Trustee Services` pipeline

### Task 4.3 — Trust Review Date Automation

**File:** `backend/src/services/crm-automation.service.ts`

Add Job 5: Trust review reminders (run daily at 8:00 AM):
```typescript
export async function checkTrustReviewDates() {
  const thresholds = [60, 30, 7]; // days before review date
  for (const days of thresholds) {
    const upcoming = await prisma.crmTrustProduct.findMany({
      where: {
        nextReviewDate: {
          gte: new Date(),
          lte: addDays(new Date(), days)
        },
        status: 'ACTIVE'
      },
      include: { owner: true, contact: true, account: true }
    });
    // Notify owner with urgency scaled to days remaining
  }
}
```

### Task 4.4 — Mobile UX Pass

**Files:** `CrmLeads.tsx`, `CrmContacts.tsx`, `CrmOpportunities.tsx`, `CrmDashboard.tsx`

Replace table layouts with card-based layouts on small screens using Tailwind responsive prefixes:

```tsx
// Contacts: hide less-critical columns on mobile
<td className="hidden md:table-cell">{contact.department}</td>
<td className="hidden lg:table-cell">{contact.jobTitle}</td>
```

For CrmLeads (already card-based): reduce to single column on mobile:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

Add floating action button (FAB) on mobile for "New Lead" / "New Contact":
```tsx
<button className="fixed bottom-6 right-6 md:hidden rounded-full w-14 h-14 bg-blue-600 ...">
  +
</button>
```

### Task 4.5 — Global CRM Search

**File:** `backend/src/controllers/crm.controller.ts`

Add `globalSearch(req, res)`:
```typescript
export const globalSearch = async (req: Request, res: Response) => {
  const { q } = req.query as { q: string };
  if (!q || q.length < 2) return res.json({ results: [] });
  
  const [accounts, contacts, leads, opportunities] = await Promise.all([
    prisma.crmAccount.findMany({ where: { name: { contains: q, mode: 'insensitive' }, deletedAt: null }, take: 5 }),
    prisma.crmContact.findMany({ where: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }], deletedAt: null }, take: 5 }),
    prisma.crmLead.findMany({ where: { title: { contains: q, mode: 'insensitive' }, deletedAt: null }, take: 5 }),
    prisma.crmOpportunity.findMany({ where: { name: { contains: q, mode: 'insensitive' }, deletedAt: null }, take: 5 }),
  ]);
  
  res.json({ results: { accounts, contacts, leads, opportunities } });
};
```

**Route:** `GET /api/v1/crm/search?q=...`

**File:** Add search input to CRM sidebar or top navigation bar in the CRM layout. Show results in a dropdown overlay grouped by entity type.

### Task 4.6 — Empty State Onboarding (UX7)

**Files:** `CrmLeads.tsx`, `CrmContacts.tsx`, `CrmOpportunities.tsx`, `CrmAccounts.tsx`

Replace empty `<tbody></tbody>` or empty card grid with a helpful empty state:

```tsx
{leads.length === 0 && (
  <div className="text-center py-16">
    <p className="text-gray-500">No leads yet</p>
    <p className="text-sm text-gray-400 mt-1">Start by adding your first lead</p>
    <button onClick={() => setShowCreate(true)} className="mt-4 ...">
      + New Lead
    </button>
  </div>
)}
```

### Phase 4 Verification Checklist

```bash
# Build
npm run build  # 0 errors

# Manual tests
# 1. Upload a document to a contact → appears in Documents tab
# 2. Create a deal in Will Writing pipeline → appears in correct pipeline kanban
# 3. Trust product with nextReviewDate 25 days out → automation job generates notification
# 4. Visit /crm/leads on mobile viewport (375px) → single column layout, FAB visible
# 5. Global search "Lim" → shows matching contacts and accounts in dropdown
# 6. Empty leads list → shows empty state with "New Lead" button
```

---

## Execution Summary

| Phase | Focus | Effort | Go-Live Impact |
|---|---|---|---|
| Phase 1 | Critical bugs + security | 1–2 days | Blockers removed — system is usable |
| Phase 2 | Daily sales workflow + automation | 3–4 days | Real agents can use it daily |
| Phase 3 | Trust industry + reporting | 5–7 days | Competitive for Malaysian trust market |
| Phase 4 | Advanced features + mobile | 5–7 days | Enterprise-grade product |

**Total: ~16–20 days of focused development**

Execute phases sequentially. Phase 1 is the only hard prerequisite for Phase 2. Phases 3 and 4 can be parallelized if multiple developers are available.

---

## Anti-Pattern Guards (For Executing Agents)

1. **Do NOT** invent Prisma field names — read the schema before each task
2. **Do NOT** assume a service function exists — grep for it first
3. **Do NOT** skip the Prisma migration step — schema changes require `npx prisma migrate dev`
4. **Do NOT** use `prisma generate` instead of `migrate dev` — the former doesn't create SQL migrations
5. **Do NOT** mark a phase complete without running `npm run build` successfully
6. **Do NOT** add permissions that don't exist in the system's permission enum — read existing permission constants first
7. **Do NOT** use `req.user` without importing the correct typed `Request` from `../types/express` (existing TypeScript pattern in the codebase)
8. **Do NOT** create new notification functions — use the existing `notificationService` pattern from SLA or HR workflow controllers
