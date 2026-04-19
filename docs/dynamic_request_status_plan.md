# Dynamic Request Status — Implementation Plan

## Decision: Hybrid Approach (Recommended)

Converting the Prisma `enum RequestStatus` to a fully database-driven table is **possible but high-risk** because the enum is deeply integrated into:
- Prisma schema (used on `Request.status` field)
- Backend validator (`z.nativeEnum(RequestStatus)`)
- Backend controllers (typed casts like `status as RequestStatus`)
- Frontend types (`RequestStatus` imported from `../../types`)
- Frontend utility logic (hard-coded status string comparisons in `roleDetection.ts`)

Fully replacing the enum with a DB table would require a migration that drops the existing typed column and re-creates it as `String`, touching dozens of files.

### ✅ Recommended: Keep the Prisma Enum, Add a `RequestStatusDefinition` Table for Admin Management

The `RequestStatus` enum stays as the source of truth for the Prisma ORM type-safety. We add a **parallel `request_status_definitions` table** that stores human-readable metadata per status (label, description, color, etc.) and is manageable via the Admin Console. `BannerConfig` continues using plain strings, but the status dropdown in the Admin UI populates from this new table.

This gives you:
- **Zero breaking changes** to existing code
- **Dynamic CRUD** for status metadata in the Admin Console
- **BannerConfig** status picker populated from the DB (no more hardcoded lists)
- Path to fully dynamic statuses in a future phase if desired

---

## Architecture

### New Table: `RequestStatusDefinition`

```prisma
model RequestStatusDefinition {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique @db.VarChar(100)  // e.g. "SUBMITTED", matches enum value
  label       String   @db.VarChar(200)           // e.g. "Request Submitted"
  description String?  @db.Text                   // optional tooltip/help text
  category    String?  @db.VarChar(50)            // e.g. "IT", "HR", "FINANCE", "GENERAL"
  displayOrder Int     @default(0) @map("display_order")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("request_status_definitions")
  @@index([isActive])
  @@index([category])
}
```

### Data Flow

```
Admin Console
  └─ Status Management Tab (CRUD on request_status_definitions)
        ↓ list of codes
  └─ Banner Config Tab (status dropdown populated from DB)
        ↓ saves { role, status: code, ... } to banner_configs
              ↓
Frontend ActionBanner reads from banner_configs (unchanged)
```

---

## Files to Create / Modify

### Phase 1 — Database (Backend)

| File | Action | Change |
|---|---|---|
| `prisma/schema.prisma` | **Add** | New `model RequestStatusDefinition` |
| `prisma/seed.ts` | **Add** | Seed all 40+ existing enum values as rows |

### Phase 2 — Backend API

| File | Action | Change |
|---|---|---|
| `src/controllers/requestStatusDefinition.controller.ts` | **Create** | CRUD controller for status definitions |
| `src/routes/requestStatusDefinition.routes.ts` | **Create** | Protected admin routes |
| `src/routes/index.ts` | **Edit** | Register new routes under `/admin/status-definitions` |

### Phase 3 — Frontend Admin UI

| File | Action | Change |
|---|---|---|
| `src/services/requestStatusService.ts` | **Create** | API calls for status definitions |
| `src/services/bannerConfigService.ts` | **Edit** | Add `getStatusCodes()` helper |
| `src/services/admin.service.ts` | **Edit** | Add status definition methods |

#### Admin Console Status Management Tab
> This is the new UI tab inside the existing admin settings panel (wherever `BannerConfig` is managed today). Since there's no dedicated admin page yet in the frontend, this becomes a new section.

| File | Action | Change |
|---|---|---|
| `src/components/admin/StatusDefinitionsTab.tsx` | **Create** | Full CRUD table for status definitions |
| `src/components/admin/BannerConfigTab.tsx` | **Create** | BannerConfig editor with status dropdown from DB |

---

## Detailed Implementation Steps

### Step 1: Schema Migration

Add to `schema.prisma`:

```prisma
model RequestStatusDefinition {
  id           String   @id @default(uuid()) @db.Uuid
  code         String   @unique @db.VarChar(100)
  label        String   @db.VarChar(200)
  description  String?  @db.Text
  category     String?  @db.VarChar(50)
  displayOrder Int      @default(0) @map("display_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("request_status_definitions")
  @@index([isActive])
  @@index([category])
}
```

Run: `npm run prisma:migrate`

### Step 2: Seed All Existing Statuses

Add to `seed.ts` — 40 rows covering all `RequestStatus` enum values, grouped by category:

```ts
const statusDefinitions = [
  // GENERAL
  { code: 'SUBMITTED',           label: 'Submitted',              category: 'GENERAL', displayOrder: 1 },
  { code: 'IN_REVIEW',           label: 'In Review',              category: 'GENERAL', displayOrder: 2 },
  { code: 'ACTION_REQUIRED',     label: 'Action Required',        category: 'GENERAL', displayOrder: 3 },
  { code: 'APPROVED',            label: 'Approved',               category: 'GENERAL', displayOrder: 4 },
  { code: 'REJECTED',            label: 'Rejected',               category: 'GENERAL', displayOrder: 5 },
  { code: 'RESOLVED',            label: 'Resolved',               category: 'GENERAL', displayOrder: 6 },
  { code: 'IN_PROGRESS',         label: 'In Progress',            category: 'GENERAL', displayOrder: 7 },
  { code: 'WAITING',             label: 'Waiting',                category: 'GENERAL', displayOrder: 8 },
  { code: 'COMPLETED',           label: 'Completed',              category: 'GENERAL', displayOrder: 9 },
  // HR / HIRING
  { code: 'PENDING_CEO_APPROVAL',            label: 'Pending CEO Approval',            category: 'HR', displayOrder: 10 },
  { code: 'CEO_APPROVED',                    label: 'CEO Approved',                    category: 'HR', displayOrder: 11 },
  { code: 'CEO_REJECTED',                    label: 'CEO Rejected',                    category: 'HR', displayOrder: 12 },
  { code: 'JOB_POSTED',                      label: 'Job Posted',                      category: 'HR', displayOrder: 13 },
  { code: 'PENDING_MANAGER_REVIEW',          label: 'Pending Manager Review',          category: 'HR', displayOrder: 14 },
  { code: 'MANAGER_APPROVED',                label: 'Manager Approved',                category: 'HR', displayOrder: 15 },
  { code: 'INTERVIEW_SCHEDULED',             label: 'Interview Scheduled',             category: 'HR', displayOrder: 16 },
  { code: 'INTERVIEW_FEEDBACK_PENDING',      label: 'Interview Feedback Pending',      category: 'HR', displayOrder: 17 },
  { code: 'CANDIDATE_REJECTED_INTERVIEW',    label: 'Candidate Rejected (Interview)',  category: 'HR', displayOrder: 18 },
  { code: 'HR_SCREENING',                    label: 'HR Screening',                    category: 'HR', displayOrder: 19 },
  { code: 'LOA_PENDING_APPROVAL',            label: 'LOA Pending Approval',            category: 'HR', displayOrder: 20 },
  { code: 'LOA_APPROVED',                    label: 'LOA Approved',                    category: 'HR', displayOrder: 21 },
  { code: 'LOA_ISSUED',                      label: 'LOA Issued',                      category: 'HR', displayOrder: 22 },
  { code: 'LOA_ACCEPTED',                    label: 'LOA Accepted',                    category: 'HR', displayOrder: 23 },
  // ONBOARDING
  { code: 'ONBOARDING_SUBMITTED',             label: 'Onboarding Submitted',             category: 'ONBOARDING', displayOrder: 30 },
  { code: 'ONBOARDING_PENDING_HR_APPROVAL',   label: 'Pending HR Approval',              category: 'ONBOARDING', displayOrder: 31 },
  { code: 'ONBOARDING_PRE_ARRIVAL_SETUP',     label: 'Pre-Arrival Setup',                category: 'ONBOARDING', displayOrder: 32 },
  { code: 'ONBOARDING_READY_FOR_DAY_1',       label: 'Ready for Day 1',                  category: 'ONBOARDING', displayOrder: 33 },
  { code: 'ONBOARDING_DAY_1_ORIENTATION',     label: 'Day 1 Orientation',                category: 'ONBOARDING', displayOrder: 34 },
  { code: 'ONBOARDING_WEEK_1_INTEGRATION',    label: 'Week 1 Integration',               category: 'ONBOARDING', displayOrder: 35 },
  { code: 'ONBOARDING_MONTH_1_MILESTONE',     label: 'Month 1 Milestone',                category: 'ONBOARDING', displayOrder: 36 },
  { code: 'ONBOARDING_MONTH_2_MILESTONE',     label: 'Month 2 Milestone',                category: 'ONBOARDING', displayOrder: 37 },
  { code: 'ONBOARDING_MONTH_3_MILESTONE',     label: 'Month 3 Milestone',                category: 'ONBOARDING', displayOrder: 38 },
  { code: 'ONBOARDING_COMPLETED',             label: 'Onboarding Completed',             category: 'ONBOARDING', displayOrder: 39 },
  // IT WORKFLOW
  { code: 'PENDING_MANAGER_APPROVAL_IT', label: 'Pending Manager Approval (IT)', category: 'IT', displayOrder: 40 },
  { code: 'MANAGER_APPROVED_IT',         label: 'Manager Approved (IT)',         category: 'IT', displayOrder: 41 },
  { code: 'MANAGER_REJECTED_IT',         label: 'Manager Rejected (IT)',         category: 'IT', displayOrder: 42 },
  { code: 'PENDING_VP_APPROVAL_IT',      label: 'Pending VP Approval (IT)',      category: 'IT', displayOrder: 43 },
  { code: 'VP_APPROVED_IT',              label: 'VP Approved (IT)',              category: 'IT', displayOrder: 44 },
  { code: 'VP_REJECTED_IT',              label: 'VP Rejected (IT)',              category: 'IT', displayOrder: 45 },
  { code: 'PROCUREMENT_IN_PROGRESS',     label: 'Procurement In Progress',       category: 'IT', displayOrder: 46 },
  { code: 'HARDWARE_ORDERED',            label: 'Hardware Ordered',              category: 'IT', displayOrder: 47 },
  { code: 'HARDWARE_RECEIVED',           label: 'Hardware Received',             category: 'IT', displayOrder: 48 },
  { code: 'SOFTWARE_PROVISIONED',        label: 'Software Provisioned',          category: 'IT', displayOrder: 49 },
  { code: 'ACKNOWLEDGED_IT',             label: 'Acknowledged (IT)',             category: 'IT', displayOrder: 50 },
  { code: 'PENDING_CEO_APPROVAL_IT',     label: 'Pending CEO Approval (IT)',     category: 'IT', displayOrder: 51 },
  { code: 'CEO_APPROVED_IT',             label: 'CEO Approved (IT)',             category: 'IT', displayOrder: 52 },
  { code: 'CEO_REJECTED_IT',             label: 'CEO Rejected (IT)',             category: 'IT', displayOrder: 53 },
  { code: 'PENDING_CTO_APPROVAL_IT',     label: 'Pending CTO Approval (IT)',     category: 'IT', displayOrder: 54 },
  { code: 'CTO_APPROVED_IT',             label: 'CTO Approved (IT)',             category: 'IT', displayOrder: 55 },
  { code: 'CTO_REJECTED_IT',             label: 'CTO Rejected (IT)',             category: 'IT', displayOrder: 56 },
  { code: 'PENDING_INVOICE_IT',          label: 'Pending Invoice (IT)',          category: 'IT', displayOrder: 57 },
  { code: 'PENDING_CFO_APPROVAL_IT',     label: 'Pending CFO Approval (IT)',     category: 'IT', displayOrder: 58 },
  { code: 'CFO_APPROVED_IT',             label: 'CFO Approved (IT)',             category: 'IT', displayOrder: 59 },
  { code: 'CFO_REJECTED_IT',             label: 'CFO Rejected (IT)',             category: 'IT', displayOrder: 60 },
  { code: 'PAYMENT_PROCESSING_IT',       label: 'Payment Processing (IT)',       category: 'IT', displayOrder: 61 },
  { code: 'PAYMENT_DONE_IT',             label: 'Payment Done (IT)',             category: 'IT', displayOrder: 62 },
  { code: 'PENDING_DELIVERY_IT',         label: 'Pending Delivery (IT)',         category: 'IT', displayOrder: 63 },
  // FINANCE WORKFLOW
  { code: 'PENDING_MANAGER_APPROVAL_FIN', label: 'Pending Manager Approval (Finance)', category: 'FINANCE', displayOrder: 70 },
  { code: 'MANAGER_APPROVED_FIN',         label: 'Manager Approved (Finance)',          category: 'FINANCE', displayOrder: 71 },
  { code: 'MANAGER_REJECTED_FIN',         label: 'Manager Rejected (Finance)',          category: 'FINANCE', displayOrder: 72 },
  { code: 'PENDING_FINANCE_HEAD_APPROVAL',label: 'Pending Finance Head Approval',       category: 'FINANCE', displayOrder: 73 },
  { code: 'FINANCE_HEAD_APPROVED',        label: 'Finance Head Approved',               category: 'FINANCE', displayOrder: 74 },
  { code: 'FINANCE_HEAD_REJECTED',        label: 'Finance Head Rejected',               category: 'FINANCE', displayOrder: 75 },
  { code: 'PAYMENT_PROCESSING',           label: 'Payment Processing',                  category: 'FINANCE', displayOrder: 76 },
  { code: 'PAYMENT_COMPLETED',            label: 'Payment Completed',                   category: 'FINANCE', displayOrder: 77 },
  { code: 'REIMBURSEMENT_CLOSED',         label: 'Reimbursement Closed',                category: 'FINANCE', displayOrder: 78 },
];
```

### Step 3: Backend Controller & Routes

**`src/controllers/requestStatusDefinition.controller.ts`** — Standard CRUD:
- `GET /admin/status-definitions` → list all (with optional `?category=` filter)
- `GET /admin/status-definitions/active` → list active only
- `POST /admin/status-definitions` → create
- `PUT /admin/status-definitions/:id` → update
- `DELETE /admin/status-definitions/:id` → delete (with guard: can't delete if used in a `BannerConfig`)

### Step 4: Frontend Admin UI

Two tabs in admin settings:

#### Tab A: "Request Statuses"
- Table showing `code | label | category | displayOrder | isActive`
- Add / Edit modal (fields: code, label, description, category, displayOrder, isActive)
- Delete with confirmation (shows warning if BannerConfig entries exist for that code)

#### Tab B: "Banner Configs"  
- Status dropdown **populated from the DB** via `GET /admin/status-definitions/active`
- No more hardcoded string list

---

## ⚠️ Key Constraints / Risks

> [!WARNING]
> **Do NOT remove or rename values from the `RequestStatus` Prisma enum** unless you also migrate all existing `Request.status` column data. The enum must stay in sync with the DB table's `code` column.

> [!IMPORTANT]
> Admin **cannot create** new status codes that don't exist in the Prisma enum. The `code` field in `RequestStatusDefinition` is purely a metadata label layer over the existing enum. New status values require a Prisma migration.

> [!NOTE]
> In a future Phase 2, if you want fully dynamic statuses (no Prisma enum), the `Request.status` column type must be changed from `RequestStatus` (Prisma enum) to `String`, and all type-cast references updated. That is a larger migration worth a separate plan.

---

## Summary Checklist

- [ ] Add `RequestStatusDefinition` model to `schema.prisma`
- [ ] Run `npm run prisma:migrate` in `/backend`
- [ ] Seed all 60+ status rows in `seed.ts`
- [ ] Create `requestStatusDefinition.controller.ts`
- [ ] Create `requestStatusDefinition.routes.ts`
- [ ] Register routes in `src/routes/index.ts`
- [ ] Create `src/services/requestStatusService.ts` (frontend)
- [ ] Create `StatusDefinitionsTab.tsx` (Admin Console)
- [ ] Update `BannerConfigTab.tsx` to load statuses from DB
