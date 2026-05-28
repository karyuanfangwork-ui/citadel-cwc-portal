# CRM Phase 1 — Implementation Plan

**Based on:** CRM Enterprise Audit, Section 11 — Prioritized Improvement Roadmap  
**Timeline:** 3 sprints × 2 weeks = 6 weeks  
**Approach:** Reuse Create modals (pre-populated) for Edit; full CRUD tabs for Trust Products & Beneficiaries  
**Delete scope:** Core 4 entities (Lead, Contact, Account, Opportunity) + Notes/Delete endpoints  
**Reference:** All item numbers map to audit Section 11 Phase 1 items #1–#10

---

## SPRINT 1 (Week 1–2): Critical Fixes + Edit Modals

### 1.1 — Fix Notes Tab (Audit Item #1)

**Bug:** ContactDetail & AccountDetail Notes tabs never fetch existing notes.  
**Root cause:** ContactDetail's `NotesTab` initializes `notes = []` and discards the `listActivities` result. No `listNotes` method exists in `crm.service.ts`. AccountDetail relies on `account.notes` from `getAccount()` — works on initial load but not after navigation.

**Files to modify:**

| File | Change |
|------|--------|
| `frontend/src/services/crm.service.ts` | Add `listNotes(params)` method: `GET /crm/notes` with `accountId`, `contactId`, `leadId`, or `opportunityId` as query params |
| `backend/src/routes/crm.routes.ts` | Add `GET /crm/notes` route with query filter support (verify controller exists) |
| `backend/src/services/crm.service.ts` | Add `listNotes` method (may already exist — verify) |
| `frontend/pages/CrmContactDetail.tsx` | Replace broken `NotesTab` useEffect: call `crmService.listNotes({ contactId })` → `setNotes(res.notes)` |
| `frontend/pages/CrmAccountDetail.tsx` | Replace `account.notes` dependency with dedicated `crmService.listNotes({ accountId })` call |

**Verification:** Navigate to a contact/account with existing notes → Notes tab shows all notes, not just newly-created ones.

**Effort:** 0.5 day

---

### 1.2 — Add Toast Notifications for AI Failures (Audit Item #2)

**Bug:** All AI hooks (9 of 10) use `catch { /* fail silently */ }`. No user feedback on failure.  
**Only exception:** `useDailyBriefing` sets `setError('Could not generate briefing')`.

**Files to modify:**

| File | Change |
|------|--------|
| `frontend/src/hooks/useCrmAi.ts` | Add `error` state to all hooks. Replace every `catch { /* fail silently */ }` with `catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }` |
| `frontend/pages/CrmLeadDetail.tsx` | Show `error` from AI hooks — display inline error in `AiInsightCard` using `<p className="text-sm text-red-600">{error}</p>` below the loading/empty state |
| `frontend/pages/CrmOpportunityDetail.tsx` | Same pattern for Win Probability, Note Analyzer |
| `frontend/pages/CrmContactDetail.tsx` | Same pattern for KYC Gaps, Risk Profile, Draft Message |
| `frontend/pages/CrmDashboard.tsx` | Daily Briefing already has error handling — verify it shows in UI |

**Shared pattern for each hook update:**

```tsx
// BEFORE (in useCrmAi.ts)
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(false);
// ... 
catch { /* fail silently */ }

// AFTER
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const fetch = useCallback(async (id: string) => {
  setLoading(true);
  setError(null);
  try { setData(await crmService.someMethod(id)); }
  catch (err) { setError(err instanceof Error ? err.message : 'Feature unavailable'); }
  finally { setLoading(false); }
}, []);

return { data, loading, error, fetch };
```

**Component-level rendering:**

```tsx
// In any detail page using AI hooks
const { data: score, loading: scoreLoading, error: scoreError } = useLeadScore();

// In JSX:
{scoreError && <p className="text-sm text-red-600 mt-1">{scoreError}</p>}
{scoreLoading && <SkeletonLine />}
{score && <span className="...">{score.score}</span>}
```

**Verification:** Temporarily make an AI endpoint return 500 → confirm toast/inline error appears instead of silent failure.

**Effort:** 1 day

---

### 1.3 — Add Edit Modals for Core 4 Entities (Audit Item #3)

**Approach:** Reuse existing Create modal structures. Pre-populate `form` state with entity data. Swap `crmService.createX()` → `crmService.updateX(id, payload)`.

#### 1.3.1 — Create Shared Utilities

**New file: `frontend/src/utils/crmFormHelper.ts`**

```ts
/**
 * Strips empty/null/undefined values from a form object
 * and casts specified numeric keys to Number.
 */
export function cleanFormPayload(
  form: Record<string, any>,
  numericKeys: string[] = []
): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v === undefined || v === null) continue;
    if (numericKeys.includes(k)) {
      payload[k] = Number(v);
      if (isNaN(payload[k])) delete payload[k];
    } else {
      payload[k] = v;
    }
  }
  return payload;
}

/** Numeric keys per entity type */
export const NUMERIC_KEYS = {
  lead: ['estimatedValue'],
  account: ['annualRevenue'],
  contact: [],
  opportunity: ['value', 'probability'],
} as const;
```

#### 1.3.2 — Add Update Methods to Frontend Service

**File: `frontend/src/services/crm.service.ts`** — Verify these exist (they should from backend routes):

```ts
async updateLead(id: string, data: Partial<CrmLead>) {
  const res = await api.patch(`/crm/leads/${id}`, data);
  return res.data.data;
}
async updateAccount(id: string, data: Partial<CrmAccount>) {
  const res = await api.patch(`/crm/accounts/${id}`, data);
  return res.data.data;
}
async updateContact(id: string, data: Partial<CrmContact>) {
  const res = await api.patch(`/crm/contacts/${id}`, data);
  return res.data.data;
}
async updateOpportunity(id: string, data: Partial<CrmOpportunity>) {
  const res = await api.patch(`/crm/opportunities/${id}`, data);
  return res.data.data;
}
```

If they don't exist, add them. Backend PATCH routes already exist for all 4 entities.

#### 1.3.3 — Edit Modal Pattern (repeated per entity)

**Pattern for each entity page (CrmLeads, CrmAccounts, CrmContacts, CrmOpportunities):**

1. Add state: `const [editingItem, setEditingItem] = useState<EntityType | null>(null);`
2. Add `showEdit` boolean: `const [showEdit, setShowEdit] = useState(false);`
3. Add "Edit" button to each list item / card:
   ```tsx
   <button onClick={() => { setEditingItem(item); setShowEdit(true); }}
           className="text-sm text-brand-600 hover:underline">
     Edit
   </button>
   ```
4. Duplicate the Create modal JSX block, but:
   - Title: `"Edit {Entity}"` instead of `"New {Entity}"`
   - Form init: When `showEdit` opens, `setForm(editingItem)` instead of `{}`
   - Submit: `crmService.updateX(editingItem.id, payload)` instead of `crmService.createX(payload)`
   - Button text: `"Save Changes"` instead of `"Create {Entity}"`
   - On close: `setForm({}); setEditingItem(null); setShowEdit(false);`

**Per-entity specifics:**

**CrmLeads.tsx — Edit Lead Modal**
- Fields: Same 8 fields as Create (title, contactName, contactEmail, contactPhone, companyName, ownerId, source, estimatedValue)
- Duplicate check: Skip `checkDuplicateLead` on edit (or run it and warn but don't block)
- Status field: Not editable in modal (changed via status dropdown on detail page)

**CrmAccounts.tsx — Edit Account Modal**
- Fields: Same 15 fields as Create (name, registrationNumber, taxNumber, industry, companySize, website, email, phone, annualRevenue, bankAccount, address, city, state, postalCode, country, description)
- No duplicate check needed on edit

**CrmContacts.tsx — Edit Contact Modal**
- Fields: Same 10 fields as Create (firstName, lastName, email, phone, mobile, jobTitle, department, accountId, isPrimary)
- Duplicate check: Skip on edit (the contact IS the existing record)

**CrmOpportunities.tsx — Edit Opportunity Modal**
- Fields: Same 7 fields as Create (name, accountId, pipelineId, stageId, value, probability, expectedCloseDate, description)
- Cascading dropdown: Pipeline → Stage still works; pre-populate both from existing data

#### 1.3.4 — Edit Buttons on Detail Pages (LeadDetail, ContactDetail, AccountDetail, OpportunityDetail)

Each detail page header needs an "Edit" button next to the entity name:

```tsx
<div className="flex items-center gap-3">
  <h1 className="text-2xl font-bold">{entity.name}</h1>
  <button onClick={() => { setEditingItem(entity); setShowEdit(true); }}
          className="text-sm text-brand-600 hover:underline flex items-center gap-1">
    <span className="material-symbols-outlined text-base">edit</span>
    Edit
  </button>
</div>
```

Add the same Edit modal pattern from the list page (reuse identical modal JSX + form state).

**Effort:** 3–5 days (0.5 day per shared utility, 0.5 day per entity × 4, 0.5 day per detail page × 4, 0.5 day testing)

---

### 1.4 — Add Delete with Confirmation (Audit Item #4)

**Scope:** Core 4 entities (Lead, Contact, Account, Opportunity)

**Backend status:** All 4 DELETE endpoints exist:
- `DELETE /crm/leads/:id` (requires `crm:delete`)
- `DELETE /crm/contacts/:id` (requires `crm:delete`)
- `DELETE /crm/accounts/:id` (requires `crm:delete`)
- `DELETE /crm/opportunities/:id` (requires `crm:delete`)

**Frontend service:** Verify these exist in `crm.service.ts`:
```ts
async deleteLead(id: string) { ... }
async deleteAccount(id: string) { ... }
async deleteContact(id: string) { ... }
async deleteOpportunity(id: string) { ... }
```

#### Implementation Pattern

**New shared component: `frontend/src/components/ConfirmDialog.tsx`**

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;  // default: "Delete"
  confirmVariant?: 'danger' | 'primary';  // default: 'danger'
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}
```

- Uses same modal overlay pattern (`bg-black/30 backdrop-blur-sm`)
- Red "Delete" button for danger variant
- Cancel button to dismiss

**Add delete to each list page:**

1. Each card/row gets a "Delete" button (icon: `delete`, small, gray → red on hover)
2. Clicking opens `ConfirmDialog` with message: `"Are you sure you want to delete \"{entity.name}\"? This action cannot be undone."`
3. On confirm: `await crmService.deleteX(item.id)` → refresh list → close modal

**Add delete to each detail page:**

1. Page header gets a "Delete" button (red, with trash icon)
2. Same `ConfirmDialog` pattern
3. On confirm: `await crmService.deleteX(id)` → navigate back to list page (`navigate('/crm/leads')`)

**Permission gate:** Only show delete button if `hasPermission(user, 'crm:delete')` is true.

**Effort:** 2 days (0.5 day for ConfirmDialog, 0.25 day per entity × 4 list pages, 0.25 day per entity × 4 detail pages, 0.5 day testing)

---

## SPRINT 2 (Week 3–4): Domain-Specific Tabs + UI Polish

### 2.1 — Add Trust Products Tab to AccountDetail (Audit Item #5)

**Backend status:** Full CRUD exists:
- `GET /crm/accounts/:id/trust-products` → list
- `POST /crm/trust-products` → create (with `accountId`)
- `PATCH /crm/trust-products/:id` → update
- `DELETE /crm/trust-products/:id` → delete
- `GET /crm/ai/trust-products/:id/document-checklist` → AI checklist

**Prisma model fields:**
```
trustType, deedRefNumber, status, assetValue, currency, assetDescription,
trusteeName, trusteeContact, settlementDate, maturityDate, nextReviewDate, ownerId
```

**Frontend service additions** (`crm.service.ts`):
```ts
async listTrustProducts(accountId: string) { ... }
async createTrustProduct(data: Partial<CrmTrustProduct>) { ... }
async updateTrustProduct(id: string, data: Partial<CrmTrustProduct>) { ... }
async deleteTrustProduct(id: string) { ... }
```

**New tab in CrmAccountDetail:**

| Tab | Content |
|-----|---------|
| Overview | Existing account info (unchanged) |
| Contacts | Existing contacts list (unchanged) |
| Deals | Existing opportunities list (unchanged) |
| Activities | Existing activities (unchanged) |
| Notes | Existing notes (fixed in Sprint 1) |
| Credit | Existing credit bridge (unchanged) |
| **Trust Products** | **NEW** — List of trust products for this account |

**Trust Products tab UI:**

```
┌──────────────────────────────────────────────────────┐
│ Trust Products                          [+ Add]      │
├──────────────────────────────────────────────────────┤
│ Card layout (same pattern as Leads cards):          │
│ ┌────────────────────────────────────────────┐       │
│ │ 📄 {trustType} — {deedRefNumber}           │       │
│ │ Status: {status}  Value: RM{assetValue}     │       │
│ │ Trustee: {trusteeName}                      │       │
│ │ Maturity: {maturityDate}                    │       │
│ │ Next Review: {nextReviewDate}               │       │
│ │                           [Edit] [Delete]    │       │
│ └────────────────────────────────────────────┘       │
│                                                      │
│ Empty state: "No trust products yet. Add one."       │
└──────────────────────────────────────────────────────┘
```

**Create Trust Product modal fields:**
trustType (select: TRUST, ESTATE, WILL, CUSTODY, OTHER), deedRefNumber, status (ACTIVE, PENDING, INACTIVE, MATURED), assetValue, currency (default MYR), assetDescription (textarea), trusteeName, trusteeContact, settlementDate, maturityDate, nextReviewDate, ownerId (select from CrmUsers)

**Edit:** Reuse create modal, pre-populate with existing data.  
**Delete:** Use ConfirmDialog from Sprint 1.

**Effort:** 3 days

---

### 2.2 — Add Beneficiaries Tab to ContactDetail (Audit Item #6)

**Backend status:** Full CRUD exists:
- `GET /crm/contacts/:id/beneficiaries` → list
- `POST /crm/beneficiaries` → create (with `contactId`)
- `PATCH /crm/beneficiaries/:id` → update
- `DELETE /crm/beneficiaries/:id` → delete

**Prisma model fields:**
```
firstName, lastName, relationship, allocationPct, email, phone,
nricPassport, dateOfBirth, isMinor, guardianName, notes
```

**Frontend service additions** (`crm.service.ts`):
```ts
async listBeneficiaries(contactId: string) { ... }
async createBeneficiary(data: Partial<CrmBeneficiary>) { ... }
async updateBeneficiary(id: string, data: Partial<CrmBeneficiary>) { ... }
async deleteBeneficiary(id: string) { ... }
```

**New tab in CrmContactDetail:**

| Tab | Content |
|-----|---------|
| Overview | Existing contact info |
| KYC | Existing KYC + AI features |
| Linked Deals | Existing opportunities |
| Notes | Existing notes (fixed in Sprint 1) |
| **Beneficiaries** | **NEW** — List of beneficiaries for this contact |

**Beneficiaries tab UI:**

```
┌──────────────────────────────────────────────────────┐
│ Beneficiaries                           [+ Add]      │
├──────────────────────────────────────────────────────┤
│ Table layout (beneficiaries are tabular data):       │
│ Name | Relationship | Allocation | NRIC | DOB | ... │
│──────|──────────────|────────────|──────|─────|────  │
│ John | Son          | 40%        | ***  | ... | ...  │
│ Mary | Spouse       | 60%        | ***  | ... | ... │
│                                                      │
│ Allocation bar: ██████████░░░░░ (should total 100%)  │
│                                                      │
│ [Edit] [Delete] per row                              │
│ Empty state: "No beneficiaries yet. Add one."        │
└──────────────────────────────────────────────────────┘
```

**Create Beneficiary modal fields:**
firstName (required), lastName (required), relationship (select: SPOUSE, CHILD, PARENT, SIBLING, OTHER), allocationPct (number, 0-100), email, phone, nricPassport, dateOfBirth, isMinor (checkbox), guardianName (shown if isMinor), notes (textarea)

**Allocation validation:** Show warning if total allocation ≠ 100%.

**Effort:** 3 days

---

### 2.3 — Add Empty State Components (Audit Item #7)

**New component: `frontend/src/components/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
  icon?: string;           // Material Symbols icon name, default: 'inbox'
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

**Usage pattern:**
```tsx
{leads.length === 0 && (
  <EmptyState
    icon="lightbulb"
    title="No leads yet"
    description="Create your first lead to start tracking potential customers."
    actionLabel="New Lead"
    onAction={() => setShowCreate(true)}
  />
)}
```

**Apply to all CRM list pages:**
- CrmLeads (icon: `lightbulb`, title: "No leads yet")
- CrmAccounts (icon: `business`, title: "No accounts yet")
- CrmContacts (icon: `person`, title: "No contacts yet")
- CrmOpportunities (icon: `monetization_on`, title: "No opportunities yet")
- Pipeline empty state per column (icon: `trending_up`, title: "No deals in this stage")
- CrmTeamDashboard when no agents (icon: `groups`, title: "No team members")
- All detail page tabs when no data (Activities, Notes, Deals, etc.)

**Effort:** 1 day

---

### 2.4 — Add Loading Skeletons on All Pages (Audit Item #8)

**Current state:** `CrmDashboard` has `SkeletonLine` components. Other pages show blank during load.

**New component: `frontend/src/components/crm/CrmCardSkeleton.tsx`**

```tsx
// Reusable skeleton matching the card pattern on list pages
function CrmCardSkeleton() {
  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
    </div>
  );
}
```

**Add to each page:**

| Page | Skeleton Pattern |
|------|-----------------|
| CrmLeads | 6 × CrmCardSkeleton in grid |
| CrmAccounts | 6 × CrmCardSkeleton in grid |
| CrmContacts | 6 × CrmCardSkeleton in grid |
| CrmOpportunities | Table row skeletons (th + 3 td × 5 rows) |
| CrmPipeline | Column header + 2 × CrmCardSkeleton per column |
| CrmTeamDashboard | KPI card skeletons + table row skeletons |
| CrmLeadDetail | Page skeleton: heading + info grid + tab bar |
| CrmContactDetail | Same as LeadDetail |
| CrmAccountDetail | Same as LeadDetail |
| CrmOpportunityDetail | Same as LeadDetail |
| CrmReports | Tab bar skeleton + table skeleton |

**Effort:** 1 day

---

### 2.5 — Replace Native `prompt()` with Modal (Audit Item #9)

**Current:** `CrmPipeline.tsx` uses `window.prompt('Reason for loss:')` when dragging a deal to the "Closed Lost" column.

**New component:** Reuse `ConfirmDialog` from Sprint 1 with a textarea.

**Change in `CrmPipeline.tsx`:**

```tsx
// BEFORE
const reason = window.prompt('Reason for loss:');

// AFTER
const [showLostReason, setShowLostReason] = useState(false);
const [lostReason, setLostReason] = useState('');
const [pendingLostOpp, setPendingLostOpp] = useState<Opportunity | null>(null);

// In onDrop handler:
if (targetStage.isLostStage) {
  setPendingLostOpp(opp);
  setShowLostReason(true);
  return; // don't move yet
}

// In modal:
<ConfirmDialog
  open={showLostReason}
  title="Mark as Lost"
  message="Please provide a reason for marking this deal as lost."
  confirmLabel="Confirm Lost"
  onConfirm={() => {
    moveStage(pendingLostOpp!.id, targetStageId, lostReason);
    setShowLostReason(false);
    setLostReason('');
  }}
  onCancel={() => {
    // revert the card to original stage
    setShowLostReason(false);
    setLostReason('');
  }}
>
  <textarea
    value={lostReason}
    onChange={e => setLostReason(e.target.value)}
    className="..."
    rows={3}
    placeholder="Reason for loss..."
  />
</ConfirmDialog>
```

**Effort:** 0.5 day

---

## SPRINT 3 (Week 5–6): Actionability + Navigation

### 3.1 — Add KPI Click-Through (Audit Item #10)

**Current:** Dashboard KPI cards (Accounts: 6, Open Leads: 20, Pipeline Value: RM320,000, Win Rate: 0%) are display-only.

**Change:** Wrap each KPI card in a `<Link>` element.

| KPI | Links to |
|-----|-----------|
| Accounts | `/crm/accounts` |
| Open Leads | `/crm/leads?status=NEW,CONTACTED,QUALIFIED` |
| Pipeline Value | `/crm/pipeline` |
| Won This Month | `/crm/opportunities?filter=won` |
| My Leads | `/crm/leads?owner=me` |
| My Open Deals | `/crm/opportunities?owner=me` |
| Stale Leads | `/crm/leads?filter=stale` |

**Implementation:**

1. Add KPI cards as `<Link to={targetUrl}>` instead of plain `<div>`
2. Add hover state: `hover:bg-brand-50 cursor-pointer transition-colors rounded-lg`
3. Add `→` arrow icon on hover to indicate clickability

**Also on CrmDashboard:**
- "TODAY'S PRIORITIES" section alert cards should link to relevant filtered lists
- "Recent Activity" items should link to the relevant entity detail page
- AI Daily Briefing "topPriority" should link to the specific lead/deal

**Effort:** 1 day

---

### 3.2 — Polish: Form Validation with Error Messages (Audit Item #17 — moved up)

**Current:** Only HTML `required` attribute. No email format validation, no phone format validation, no business rule validation.

**New utility: `frontend/src/utils/crmValidation.ts`**

```ts
interface ValidationError {
  field: string;
  message: string;
}

export function validateLead(form: Partial<CrmLead>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.title?.trim()) errors.push({ field: 'title', message: 'Title is required' });
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
    errors.push({ field: 'contactEmail', message: 'Invalid email format' });
  if (form.estimatedValue && Number(form.estimatedValue) < 0)
    errors.push({ field: 'estimatedValue', message: 'Value cannot be negative' });
  return errors;
}

export function validateAccount(form: Partial<CrmAccount>): ValidationError[] { ... }
export function validateContact(form: Partial<CrmContact>): ValidationError[] { ... }
export function validateOpportunity(form: Partial<CrmOpportunity>): ValidationError[] { ... }
```

**Apply to all Create and Edit modals:**

1. On submit, run validation before API call
2. If errors exist, display `{errors.map(e => <p className="text-sm text-red-600">{e.message}</p>)}` below the relevant field
3. Add red border to invalid fields: `border-red-500 focus:ring-red-200`
4. Don't proceed with API call if errors exist

**Validation rules per entity:**

| Entity | Rules |
|--------|-------|
| Lead | title required; email format; estimatedValue >= 0 |
| Account | name required; email format; annualRevenue >= 0; website URL format |
| Contact | firstName + lastName required; email format; phone format (optional) |
| Opportunity | name required; accountId required; pipelineId + stageId required; value >= 0; probability 0-100 |
| Trust Product | trustType required; accountId required; assetValue >= 0 if provided |
| Beneficiary | firstName + lastName required; relationship required; allocationPct 0-100 |

**Effort:** 3 days (0.5 day for utility, 0.5 day per entity × 4, 0.5 day for Trust/Beneficiary, 0.5 day testing)

---

### 3.3 — Permission Gate for Delete Buttons

**Current backend:** DELETE endpoints require `crm:delete` permission.  
**Frontend:** No permission check on delete button visibility.

**Add to every delete button:**

```tsx
{hasPermission(user, 'crm:delete') && (
  <button onClick={() => handleDelete(item)} ...>
    <span className="material-symbols-outlined">delete</span>
  </button>
)}
```

**Also for Trust Products and Beneficiaries:**
- Delete uses `crm:delete` (same as other entities)
- Only users with `crm:delete` should see the Delete button

**For Notes:**
- Backend uses `crm:write` (not `crm:delete`) — this is inconsistent but we'll follow the backend
- Show delete on notes for users with `crm:write`

**Effort:** 0.5 day (sprinkled across all entity pages)

---

## SUMMARY — Phase 1 Timeline

| Sprint | Item | Description | Effort |
|--------|------|-------------|--------|
| **Sprint 1 (W1-2)** | 1.1 | Fix Notes tab (fetch existing notes) | 0.5 day |
| | 1.2 | Toast/inline errors for AI failures | 1 day |
| | 1.3 | Edit modals (Lead, Contact, Account, Opportunity) | 4 days |
| | 1.4 | Delete with confirmation (core 4 entities) | 2 days |
| | — | **Sprint 1 total** | **7.5 days** |
| **Sprint 2 (W3-4)** | 2.1 | Trust Products tab (AccountDetail) | 3 days |
| | 2.2 | Beneficiaries tab (ContactDetail) | 3 days |
| | 2.3 | Empty state components (all list pages) | 1 day |
| | 2.4 | Loading skeletons (all pages) | 1 day |
| | 2.5 | Replace `prompt()` with modal | 0.5 day |
| | — | **Sprint 2 total** | **8.5 days** |
| **Sprint 3 (W5-6)** | 3.1 | KPI click-through + action links | 1 day |
| | 3.2 | Form validation with error messages | 3 days |
| | 3.3 | Permission gate for delete buttons | 0.5 day |
| | — | **Sprint 3 total** | **4.5 days** |
| | | **Phase 1 Total** | **20.5 days** |

---

## DEPENDENCIES & RISKS

| Risk | Mitigation |
|------|------------|
| Backend `GET /crm/notes` endpoint may not exist | Verify in Sprint 1. If missing, add route + controller in backend. The `CrmNote` model already supports filtering by `accountId`, `contactId`, etc. |
| Backend PATCH endpoints may not return updated entity | Test each PATCH endpoint. If they don't return the entity, frontend will need to re-fetch after edit. |
| `crm:delete` permission may not exist in seed data | Add `crm:delete` permission to admin role in seed data. Check `backend/prisma/seed.ts`. |
| Trust Product / Beneficiary UI may reveal data model gaps | Create modals should handle optional fields gracefully (hide or show as optional). |
| Edit modal cascading dropdowns (Opportunity: pipeline → stage) | Pre-populate both from existing data. On pipeline change, reset stage to first stage of new pipeline (same as Create). |
| ConfirmDialog may not match existing modal styling | Reuse the exact same overlay pattern (`bg-black/30 backdrop-blur-sm`) and panel pattern (`bg-white rounded-2xl shadow-2xl max-w-lg`) as existing Create modals. |

---

## TESTING CHECKLIST

For each item, verify:

- [ ] **1.1 Notes fix:** Navigate to contact with existing notes → Notes tab shows all notes
- [ ] **1.2 AI errors:** Make an AI endpoint return 500 → error message appears in UI (not console only)
- [ ] **1.3 Edit modals:** Open each entity → Click Edit → Verify pre-populated fields → Edit → Save → Entity updates
- [ ] **1.3 Edit modals — Cancel:** Open Edit → Cancel → Entity unchanged
- [ ] **1.3 Edit modals — Validation:** Open Edit → Clear required field → Submit → Error shown
- [ ] **1.4 Delete:** Open each entity → Click Delete → Confirm dialog → Entity removed from list
- [ ] **1.4 Delete — Cancel:** Open Delete → Cancel → Entity unchanged
- [ ] **1.4 Delete — Detail page:** Open detail → Click Delete → Confirm → Navigates back to list
- [ ] **2.1 Trust Products:** Account detail → Trust Products tab → Shows list → Create → Edit → Delete
- [ ] **2.2 Beneficiaries:** Contact detail → Beneficiaries tab → Shows list → Create → Edit → Delete → Allocation warning
- [ ] **2.3 Empty states:** Navigate to each entity list with 0 items → Empty state illustration + CTA shown
- [ ] **2.4 Loading skeletons:** Navigate to each page → Skeleton shown before data loads
- [ ] **2.5 Lost reason modal:** Drag deal to "Closed Lost" → Modal appears (not browser prompt) → Enter reason → Deal updated
- [ ] **3.1 KPI click-through:** Click Accounts KPI → Navigates to /crm/accounts. Click Leads KPI → Navigates to /crm/leads
- [ ] **3.2 Validation:** Create lead with no title → Error. Create account with invalid email → Error. Create opportunity with value < 0 → Error.
- [ ] **3.3 Permission gate:** Login as non-admin without `crm:delete` → Delete buttons not visible. Login as admin → Delete buttons visible.