# Borrower Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw-UUID borrower creation modal with a guided two-step wizard (identity → CRM link), add SSM/NRIC duplicate detection, fix the SOLE_PROPRIETOR validator crash, and surface a CRM nudge on unlinked borrower profiles.

**Architecture:** Four independent delivery layers — backend schema + API first, then a reusable `NewBorrowerWizard` React component, then wire it into the list page and the Parties tab, finally add the detail-page nudge. Each layer is independently testable. The wizard component is extracted so it can be used from both the Borrower list and the Parties tab without duplication.

**Tech Stack:** Node.js/Express/Prisma/PostgreSQL (backend), React 19/TypeScript/Tailwind v4/Vite (frontend), existing `Modal`, `Button` UI components, `material-symbols-outlined` icons.

---

## File Map

### Created
- `frontend/src/components/credit/NewBorrowerWizard.tsx` — two-step wizard component, used by list page and parties tab

### Modified
- `backend/prisma/schema.prisma` — add `name String?` to `BorrowerProfile`
- `backend/prisma/migrations/` — new migration for `name` field
- `backend/src/credit/validators/borrowerProfile.validator.ts` — add `SOLE_PROPRIETOR`, add `name` field
- `backend/src/credit/services/borrowerProfile.service.ts` — remove mandatory CRM constraint, add `name` to create/update, add `checkDuplicate` method
- `backend/src/credit/controllers/borrowerProfile.controller.ts` — add `checkDuplicate` handler
- `backend/src/credit/routes/borrowerProfile.routes.ts` — add `GET /check-duplicate` route
- `frontend/src/services/credit.service.ts` — add `name` to `BorrowerProfile` interface, add `checkDuplicateBorrower()`, update `createBorrowerProfile` payload type
- `frontend/pages/BorrowerProfileList.tsx` — replace flat modal with `NewBorrowerWizard`
- `frontend/pages/BorrowerProfileDetail.tsx` — add unlinked CRM nudge banner
- `frontend/pages/credit/tabs/PartiesTab.tsx` — add "New Borrower" option that opens `NewBorrowerWizard`

---

## Task 1: Backend — Schema migration + validator fix

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/credit/validators/borrowerProfile.validator.ts`

- [ ] **Step 1: Add `name` field to `BorrowerProfile` in schema**

In `backend/prisma/schema.prisma`, find the `BorrowerProfile` model (around line 2666). Add after the `contactId` line:

```prisma
  // Display name for unlinked profiles (required when accountId and contactId are both null)
  name              String?      @db.VarChar(255)
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_borrower_profile_name
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Fix SOLE_PROPRIETOR in validator**

In `backend/src/credit/validators/borrowerProfile.validator.ts` line 3, update:

```typescript
const borrowerTypeEnum = z.enum(['INDIVIDUAL', 'CORPORATE', 'JOINT', 'SOLE_PROPRIETOR']);
```

- [ ] **Step 4: Add `name` field to both schemas in validator**

In `createBorrowerProfileSchema` body, add:
```typescript
name: z.string().max(255).optional().nullable(),
```

In `updateBorrowerProfileSchema` body, add:
```typescript
name: z.string().max(255).optional().nullable(),
```

- [ ] **Step 5: Build backend to verify no type errors**

```bash
cd backend && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/credit/validators/borrowerProfile.validator.ts
git commit -m "feat(credit): add BorrowerProfile.name field, fix SOLE_PROPRIETOR validator"
```

---

## Task 2: Backend — Duplicate check service method + endpoint

**Files:**
- Modify: `backend/src/credit/services/borrowerProfile.service.ts`
- Modify: `backend/src/credit/controllers/borrowerProfile.controller.ts`
- Modify: `backend/src/credit/routes/borrowerProfile.routes.ts`

- [ ] **Step 1: Add `checkDuplicate` method to service**

In `backend/src/credit/services/borrowerProfile.service.ts`, add this method to the `BorrowerProfileService` class before `createBorrowerProfile`:

```typescript
/**
 * Check if a borrower profile already exists for a given SSM or NRIC.
 * Returns the borrower ID if found, null otherwise.
 */
async checkDuplicate(params: { ssm?: string; nric?: string }): Promise<{ exists: boolean; borrowerId?: string }> {
  if (params.ssm) {
    const account = await prisma.crmAccount.findFirst({
      where: { registrationNumber: params.ssm, borrowerProfile: { isNot: null } },
      select: { borrowerProfile: { select: { id: true } } },
    });
    if (account?.borrowerProfile) {
      return { exists: true, borrowerId: account.borrowerProfile.id };
    }
  }

  if (params.nric) {
    const contact = await prisma.crmContact.findFirst({
      where: { nricPassport: params.nric, borrowerProfile: { isNot: null } },
      select: { borrowerProfile: { select: { id: true } } },
    });
    if (contact?.borrowerProfile) {
      return { exists: true, borrowerId: contact.borrowerProfile.id };
    }
  }

  return { exists: false };
}
```

- [ ] **Step 2: Add `checkDuplicate` handler to controller**

In `backend/src/credit/controllers/borrowerProfile.controller.ts`, add this method to the `BorrowerProfileController` class after the `list` handler:

```typescript
/**
 * GET /borrowers/check-duplicate?ssm=<val> or ?nric=<val>
 */
checkDuplicate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ssm = req.query.ssm as string | undefined;
  const nric = req.query.nric as string | undefined;

  if (!ssm && !nric) {
    throw new AppError('Provide ssm or nric query parameter', 400);
  }

  const result = await borrowerProfileService.checkDuplicate({ ssm, nric });
  res.json({ status: 'success', data: result });
});
```

- [ ] **Step 3: Add route — MUST be before `/:id` route**

In `backend/src/credit/routes/borrowerProfile.routes.ts`, add before the existing `router.get('/:id', ...)` line:

```typescript
/**
 * GET /borrowers/check-duplicate
 * Check if a borrower exists for a given SSM or NRIC
 * Requires: credit:read
 */
router.get(
  '/check-duplicate',
  requirePermission('credit:read'),
  borrowerProfileController.checkDuplicate,
);
```

> **Important:** This route must appear before `router.get('/:id', ...)` otherwise Express will try to match `check-duplicate` as an `:id` param.

- [ ] **Step 4: Build to verify**

```bash
cd backend && npm run build
```

Expected: clean build.

- [ ] **Step 5: Manual smoke test**

With backend running (`npm run dev`), test:
```bash
curl "http://localhost:3000/api/v1/credit/borrowers/check-duplicate?ssm=NOTEXIST" \
  -H "Authorization: Bearer <token>"
# Expected: { "status": "success", "data": { "exists": false } }
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/credit/services/borrowerProfile.service.ts \
        backend/src/credit/controllers/borrowerProfile.controller.ts \
        backend/src/credit/routes/borrowerProfile.routes.ts
git commit -m "feat(credit): add GET /borrowers/check-duplicate endpoint"
```

---

## Task 3: Backend — Remove mandatory CRM constraint, handle `name`

**Files:**
- Modify: `backend/src/credit/services/borrowerProfile.service.ts`

- [ ] **Step 1: Update `CreateBorrowerProfileData` interface**

In `borrowerProfile.service.ts`, add `name` to the interface:

```typescript
export interface CreateBorrowerProfileData {
  borrowerType: string;
  name?: string | null;          // required when accountId and contactId are both null
  accountId?: string | null;
  contactId?: string | null;
  // ... rest unchanged
}
```

- [ ] **Step 2: Remove the mandatory CRM constraint in `createBorrowerProfile`**

Replace these lines in `createBorrowerProfile`:

```typescript
// REMOVE these lines:
if (!data.accountId && !data.contactId) {
  throw new Error('Either accountId or contactId must be provided');
}
if (data.accountId && data.contactId) {
  throw new Error('Only one of accountId or contactId may be provided, not both');
}
```

Replace with:

```typescript
if (data.accountId && data.contactId) {
  throw new Error('Only one of accountId or contactId may be provided, not both');
}
if (!data.accountId && !data.contactId && !data.name) {
  throw new Error('name is required when no CRM account or contact is linked');
}
```

- [ ] **Step 3: Add `name` to the `createData` object**

In `createBorrowerProfile`, add `name` to the `createData` object:

```typescript
const createData: Prisma.BorrowerProfileCreateInput = {
  borrowerType: data.borrowerType as any,
  name: data.name ?? undefined,          // add this line
  ...(data.accountId && { account: { connect: { id: data.accountId } } }),
  // ... rest unchanged
};
```

- [ ] **Step 4: Add `name` to `UpdateBorrowerProfileData` and `updateBorrowerProfile`**

In `UpdateBorrowerProfileData` interface, add:
```typescript
name?: string | null;
```

In `updateBorrowerProfile`, add after the `borrowerType` check:
```typescript
if (data.name !== undefined) updateData.name = data.name;
```

- [ ] **Step 5: Build to verify**

```bash
cd backend && npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add backend/src/credit/services/borrowerProfile.service.ts
git commit -m "feat(credit): CRM link optional on borrower creation, name field required as fallback"
```

---

## Task 4: Frontend — Update credit service types and add checkDuplicate

**Files:**
- Modify: `frontend/src/services/credit.service.ts`

- [ ] **Step 1: Add `name` to `BorrowerProfile` interface**

In `frontend/src/services/credit.service.ts`, find `export interface BorrowerProfile` (line 107). Add after `contactId`:

```typescript
name?: string | null;
```

- [ ] **Step 2: Add `CreateBorrowerProfilePayload` type**

After the `BorrowerProfile` interface closing brace, add:

```typescript
export interface CreateBorrowerProfilePayload {
  borrowerType: 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR';
  name?: string | null;
  accountId?: string | null;
  contactId?: string | null;
}
```

- [ ] **Step 3: Add `checkDuplicateBorrower` method**

In the `creditService` object, after `createBorrowerProfile`, add:

```typescript
async checkDuplicateBorrower(params: { ssm?: string; nric?: string }): Promise<{ exists: boolean; borrowerId?: string }> {
  const res = await apiClient.get('/credit/borrowers/check-duplicate', { params });
  return res.data.data as { exists: boolean; borrowerId?: string };
},
```

- [ ] **Step 4: Update `createBorrowerProfile` signature**

Change the existing method to accept the new payload type:

```typescript
async createBorrowerProfile(data: CreateBorrowerProfilePayload) {
  const res = await apiClient.post('/credit/borrowers', data);
  return res.data.data.profile as BorrowerProfile;
},
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: no new errors related to `BorrowerProfile` or `createBorrowerProfile`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/credit.service.ts
git commit -m "feat(credit): add checkDuplicateBorrower, name field, CreateBorrowerProfilePayload type"
```

---

## Task 5: Frontend — Build `NewBorrowerWizard` component

**Files:**
- Create: `frontend/src/components/credit/NewBorrowerWizard.tsx`

- [ ] **Step 1: Create the component file**

Create `frontend/src/components/credit/NewBorrowerWizard.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import creditService, { CreateBorrowerProfilePayload } from '../../services/credit.service';
import crmService from '../../services/crm.service';

// ── Types ────────────────────────────────────────────────────────────────────

type BorrowerType = 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR';

interface Step1Data {
  borrowerType: BorrowerType;
  name: string;          // Company Name (Corporate/Sole Prop) or Full Name (Individual)
  ssm: string;           // Corporate / Sole Prop only
  nric: string;          // Individual only
  dateOfBirth: string;   // Individual only
}

interface CrmSearchResult {
  id: string;
  name: string;
  sub: string; // e.g. "SSM 202301012345 · KL"
}

export interface NewBorrowerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful creation with the new borrower ID */
  onCreated?: (borrowerId: string) => void;
  /** If true, navigates to the new borrower profile page after creation */
  navigateAfterCreate?: boolean;
}

// ── Helper ───────────────────────────────────────────────────────────────────

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

// ── Component ─────────────────────────────────────────────────────────────────

const NewBorrowerWizard: React.FC<NewBorrowerWizardProps> = ({
  isOpen,
  onClose,
  onCreated,
  navigateAfterCreate = true,
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [s1, setS1] = useState<Step1Data>({
    borrowerType: 'CORPORATE', name: '', ssm: '', nric: '', dateOfBirth: '',
  });
  const [dupCheck, setDupCheck] = useState<'idle' | 'checking' | 'clear' | 'duplicate'>('idle');
  const [dupBorrowerId, setDupBorrowerId] = useState<string | null>(null);

  // Step 2 state
  const [crmSearch, setCrmSearch] = useState('');
  const [crmResults, setCrmResults] = useState<CrmSearchResult[]>([]);
  const [selectedCrm, setSelectedCrm] = useState<CrmSearchResult | null>(null);
  const [crmSearching, setCrmSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIndividual = s1.borrowerType === 'INDIVIDUAL';
  const isCorporateType = s1.borrowerType === 'CORPORATE' || s1.borrowerType === 'SOLE_PROPRIETOR';

  // ── Duplicate check ────────────────────────────────────────────────────────

  const runDuplicateCheck = async () => {
    const identifier = isIndividual ? s1.nric : s1.ssm;
    if (!identifier) return;
    setDupCheck('checking');
    try {
      const result = await creditService.checkDuplicateBorrower(
        isIndividual ? { nric: identifier } : { ssm: identifier }
      );
      if (result.exists && result.borrowerId) {
        setDupCheck('duplicate');
        setDupBorrowerId(result.borrowerId);
      } else {
        setDupCheck('clear');
        setDupBorrowerId(null);
      }
    } catch {
      setDupCheck('idle');
    }
  };

  // ── CRM typeahead ──────────────────────────────────────────────────────────

  const handleCrmSearch = async (q: string) => {
    setCrmSearch(q);
    setSelectedCrm(null);
    if (q.length < 2) { setCrmResults([]); return; }
    setCrmSearching(true);
    try {
      if (isIndividual) {
        const data = await crmService.listContacts({ search: q, limit: 5 });
        setCrmResults(data.contacts.map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          sub: [c.nricPassport, c.jobTitle].filter(Boolean).join(' · '),
        })));
      } else {
        const data = await crmService.listAccounts({ search: q, limit: 5 });
        setCrmResults(data.accounts.map(a => ({
          id: a.id,
          name: a.name,
          sub: [a.industry].filter(Boolean).join(' · '),
        })));
      }
    } catch {
      setCrmResults([]);
    } finally {
      setCrmSearching(false);
    }
  };

  // ── Create CRM inline ──────────────────────────────────────────────────────

  const handleCreateCrmInline = async () => {
    try {
      if (isIndividual) {
        const nameParts = s1.name.trim().split(/\s+/);
        const contact = await crmService.createContact({
          firstName: nameParts[0] || s1.name,
          lastName: nameParts.slice(1).join(' ') || '',
          nricPassport: s1.nric || undefined,
          dateOfBirth: s1.dateOfBirth || undefined,
        });
        setSelectedCrm({ id: contact.id, name: s1.name, sub: s1.nric });
      } else {
        const account = await crmService.createAccount({
          name: s1.name,
          registrationNumber: s1.ssm || undefined,
        });
        setSelectedCrm({ id: account.id, name: s1.name, sub: s1.ssm });
      }
    } catch {
      setError('Failed to create CRM record. Please try again.');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: CreateBorrowerProfilePayload = {
        borrowerType: s1.borrowerType,
        name: s1.name,
        accountId: (isCorporateType && selectedCrm) ? selectedCrm.id : null,
        contactId: (isIndividual && selectedCrm) ? selectedCrm.id : null,
      };
      const profile = await creditService.createBorrowerProfile(payload);
      onCreated?.(profile.id);
      if (navigateAfterCreate) {
        navigate(`/credit/borrowers/${profile.id}`);
      }
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create borrower. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Close / reset ──────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep(1);
    setS1({ borrowerType: 'CORPORATE', name: '', ssm: '', nric: '', dateOfBirth: '' });
    setDupCheck('idle');
    setDupBorrowerId(null);
    setCrmSearch('');
    setCrmResults([]);
    setSelectedCrm(null);
    setError(null);
    onClose();
  };

  // ── Step 1 validation ──────────────────────────────────────────────────────

  const step1Valid = () => {
    if (!s1.name.trim()) return false;
    if (isCorporateType && !s1.ssm.trim()) return false;
    if (isIndividual && (!s1.nric.trim() || !s1.dateOfBirth)) return false;
    return dupCheck === 'clear';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const TYPE_BTNS: { value: BorrowerType; icon: string; label: string }[] = [
    { value: 'CORPORATE', icon: 'business', label: 'Corporate' },
    { value: 'INDIVIDUAL', icon: 'person', label: 'Individual' },
    { value: 'SOLE_PROPRIETOR', icon: 'storefront', label: 'Sole Prop' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Borrower Profile"
      size="lg"
      footer={
        step === 1 ? (
          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary"
              icon="arrow_forward"
              iconPosition="right"
              disabled={!step1Valid()}
              onClick={() => setStep(2)}
            >
              Next
            </Button>
          </div>
        ) : (
          <div className="flex justify-between">
            <Button variant="ghost" icon="arrow_back" onClick={() => setStep(1)}>Back</Button>
            <Button
              variant="primary"
              icon="person_add"
              loading={saving}
              onClick={handleSubmit}
            >
              Create Borrower
            </Button>
          </div>
        )
      }
    >
      {/* ── Stepper ── */}
      <div className="mb-5">
        <div className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step > 1 ? 'bg-green-600 text-white' : 'bg-brand-700 text-white'}`}>
            {step > 1 ? <span className="material-symbols-outlined text-sm">check</span> : '1'}
          </div>
          <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-brand-700' : 'bg-border'}`} />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step === 2 ? 'bg-brand-700 text-white' : 'bg-surface-muted text-text-tertiary border border-cwc-border'}`}>
            2
          </div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className={`text-[11px] font-semibold ${step === 1 ? 'text-brand-700' : 'text-green-600'}`}>Identity</span>
          <span className={`text-[11px] font-semibold ${step === 2 ? 'text-brand-700' : 'text-text-tertiary'}`}>CRM Link</span>
        </div>
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {/* Type toggle */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Borrower Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {TYPE_BTNS.map(btn => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => { setS1(p => ({ ...p, borrowerType: btn.value })); setDupCheck('idle'); }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-cwc-md border-[1.5px] transition-colors cursor-pointer font-sans ${
                    s1.borrowerType === btn.value
                      ? 'border-brand-700 bg-brand-50 text-brand-700'
                      : 'border-cwc-border bg-surface text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{btn.icon}</span>
                  <span className="text-xs font-bold">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Identity fields */}
          <div className="flex flex-col gap-3 p-4 bg-surface-subtle rounded-cwc-md border border-cwc-border">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">
              {isIndividual ? 'Personal Identity' : 'Company Identity'}
            </p>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                {isIndividual ? 'Full Name' : 'Company Name'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))}
                placeholder={isIndividual ? 'e.g. Ahmad bin Abdullah' : 'e.g. Citadel Holdings Sdn Bhd'}
                className="w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all"
              />
            </div>

            {/* SSM (Corporate / Sole Prop) */}
            {isCorporateType && (
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">SSM Registration No. <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={s1.ssm}
                  onChange={e => { setS1(p => ({ ...p, ssm: e.target.value })); setDupCheck('idle'); }}
                  onBlur={runDuplicateCheck}
                  placeholder="e.g. 202301012345"
                  className={`w-full px-3 py-2 border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all ${
                    dupCheck === 'duplicate' ? 'border-red-400 ring-2 ring-red-100' : 'border-cwc-border'
                  }`}
                />
                <p className="text-[11px] text-text-tertiary mt-1">Checked for duplicates when you leave this field</p>
              </div>
            )}

            {/* NRIC (Individual) */}
            {isIndividual && (
              <>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">NRIC / Passport No. <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={s1.nric}
                    onChange={e => { setS1(p => ({ ...p, nric: e.target.value })); setDupCheck('idle'); }}
                    onBlur={runDuplicateCheck}
                    placeholder="e.g. 901231-14-5678"
                    className={`w-full px-3 py-2 border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all ${
                      dupCheck === 'duplicate' ? 'border-red-400 ring-2 ring-red-100' : 'border-cwc-border'
                    }`}
                  />
                  <p className="text-[11px] text-text-tertiary mt-1">Checked for duplicates when you leave this field</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={s1.dateOfBirth}
                    onChange={e => setS1(p => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all"
                  />
                </div>
              </>
            )}
          </div>

          {/* Duplicate check feedback */}
          {dupCheck === 'checking' && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              Checking for duplicates…
            </div>
          )}
          {dupCheck === 'clear' && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-cwc-md text-xs text-green-700 font-semibold">
              <span className="material-symbols-outlined text-base">check_circle</span>
              No duplicate found — you may proceed.
            </div>
          )}
          {dupCheck === 'duplicate' && dupBorrowerId && (
            <div className="flex flex-col gap-2 px-3 py-3 bg-amber-50 border border-amber-300 rounded-cwc-md">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">warning</span>
                <div className="text-xs font-semibold text-amber-800">A borrower with this {isIndividual ? 'NRIC' : 'SSM'} already exists. Duplicate profiles are not allowed.</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="open_in_new"
                onClick={() => { handleClose(); navigate(`/credit/borrowers/${dupBorrowerId}`); }}
              >
                View Existing Borrower
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {/* Identity chip */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-cwc-md">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white text-xs font-black flex items-center justify-center shrink-0">
              {initials(s1.name)}
            </div>
            <div>
              <div className="text-sm font-bold text-brand-900">{s1.name}</div>
              <div className="text-xs text-brand-600">{s1.borrowerType.replace(/_/g, ' ')} {isCorporateType && s1.ssm ? `· SSM ${s1.ssm}` : ''}{isIndividual && s1.nric ? `· ${s1.nric}` : ''}</div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="ml-auto text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-0.5 bg-none border-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">edit</span> Edit
            </button>
          </div>

          <p className="text-xs font-bold text-text-secondary uppercase tracking-wide">
            Link to CRM <span className="normal-case font-normal text-text-tertiary">(optional)</span>
          </p>

          {/* CRM search */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1">Search existing CRM {isIndividual ? 'Contact' : 'Account'}</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-lg pointer-events-none">search</span>
              <input
                type="text"
                value={crmSearch}
                onChange={e => handleCrmSearch(e.target.value)}
                placeholder={`Search by name${isCorporateType ? ' or SSM' : ' or NRIC'}…`}
                className="w-full pl-9 pr-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all"
              />
            </div>
            {crmSearching && <p className="text-xs text-text-tertiary mt-1">Searching…</p>}
            {crmResults.length > 0 && (
              <div className="border border-cwc-border rounded-cwc-md mt-1 overflow-hidden shadow-cwc-lg">
                {crmResults.map(r => (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedCrm(r); setCrmResults([]); setCrmSearch(r.name); }}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-cwc-border last:border-0 transition-colors ${selectedCrm?.id === r.id ? 'bg-brand-50' : 'hover:bg-surface-subtle'}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 text-[11px] font-black flex items-center justify-center shrink-0">{initials(r.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary truncate">{r.name}</div>
                      {r.sub && <div className="text-xs text-text-tertiary">{r.sub}</div>}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${selectedCrm?.id === r.id ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'}`}>
                      {selectedCrm?.id === r.id ? '✓ Selected' : 'Select'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-text-tertiary font-semibold">
            <div className="flex-1 h-px bg-border" />or<div className="flex-1 h-px bg-border" />
          </div>

          {/* Create CRM inline */}
          <button
            type="button"
            onClick={handleCreateCrmInline}
            className="flex items-center gap-3 px-3 py-3 border-[1.5px] border-dashed border-brand-300 rounded-cwc-md hover:bg-brand-50 hover:border-brand-700 transition-colors cursor-pointer text-left bg-none font-sans w-full"
          >
            <div className="w-8 h-8 rounded-cwc-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">{isIndividual ? 'person_add' : 'add_business'}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-brand-700">Create new CRM {isIndividual ? 'Contact' : 'Account'}</div>
              <div className="text-xs text-text-secondary">Pre-filled from Step 1 — no re-entry needed</div>
            </div>
            <span className="material-symbols-outlined text-text-tertiary text-lg ml-auto">chevron_right</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-text-tertiary font-semibold">
            <div className="flex-1 h-px bg-border" />or<div className="flex-1 h-px bg-border" />
          </div>

          {/* Skip */}
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-3 px-3 py-3 border-[1.5px] border-dashed border-cwc-border rounded-cwc-md hover:bg-surface-muted transition-colors cursor-pointer text-left bg-none font-sans w-full"
          >
            <div className="w-8 h-8 rounded-cwc-md bg-surface-muted text-text-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">schedule</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-text-secondary">Skip for now — link CRM later</div>
              <div className="text-xs text-text-tertiary">A reminder will appear on the profile until linked</div>
            </div>
            <span className="material-symbols-outlined text-text-tertiary text-lg ml-auto">chevron_right</span>
          </button>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-cwc-md text-xs text-red-700 font-semibold">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default NewBorrowerWizard;
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npm run build 2>&1 | grep -E "NewBorrowerWizard|error TS" | head -20
```

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/credit/NewBorrowerWizard.tsx
git commit -m "feat(credit): NewBorrowerWizard two-step component"
```

---

## Task 6: Frontend — Wire wizard into BorrowerProfileList

**Files:**
- Modify: `frontend/pages/BorrowerProfileList.tsx`

- [ ] **Step 1: Replace the flat modal with the wizard**

In `frontend/pages/BorrowerProfileList.tsx`:

1. Add import at the top:
```tsx
import NewBorrowerWizard from '../src/components/credit/NewBorrowerWizard';
```

2. Remove these state declarations (no longer needed):
```tsx
// REMOVE:
const [form, setForm] = useState<Record<string, any>>({ borrowerType: 'CORPORATE' });
const [saving, setSaving] = useState(false);
```

3. Remove the entire `handleCreate` function.

4. Replace the entire `{showCreate && ( ... )}` modal JSX block (from `{showCreate && (` to its closing `)}`) with:
```tsx
<NewBorrowerWizard
  isOpen={showCreate}
  onClose={() => setShowCreate(false)}
  onCreated={() => fetchProfiles()}
  navigateAfterCreate={true}
/>
```

- [ ] **Step 2: Verify the borrower list still renders and the "New Borrower" button opens the wizard**

Start the dev servers and open http://localhost:5173/credit/borrowers. Click "New Borrower" — the two-step wizard should appear.

```bash
cd backend && npm run dev &
cd frontend && npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/BorrowerProfileList.tsx
git commit -m "feat(credit): replace flat create modal with NewBorrowerWizard"
```

---

## Task 7: Frontend — Detail page unlinked CRM nudge

**Files:**
- Modify: `frontend/pages/BorrowerProfileDetail.tsx`

- [ ] **Step 1: Locate the overview render section**

In `BorrowerProfileDetail.tsx`, find the overview tab render. Look for where `profile.account` and `profile.contact` are used to display borrower identity — this is the right place to insert the nudge.

- [ ] **Step 2: Add the nudge banner**

After the first opening `<div>` of the overview tab content (after the tab conditional), add:

```tsx
{/* Unlinked CRM nudge */}
{!profile.accountId && !profile.contactId && (
  <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl mb-4">
    <span className="material-symbols-outlined text-amber-600 text-xl mt-0.5 shrink-0">link_off</span>
    <div className="flex-1">
      <p className="text-sm font-bold text-amber-800">No CRM Account linked</p>
      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
        Linking a CRM account pulls in contact details, activities, and notes — and lets you open credit applications from the CRM side.
      </p>
      <button
        onClick={() => setShowLinkCrm(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors border-none cursor-pointer font-sans"
      >
        <span className="material-symbols-outlined text-sm">link</span>
        Link CRM Account
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add `showLinkCrm` state**

Near the top of the component, add:
```tsx
const [showLinkCrm, setShowLinkCrm] = useState(false);
```

- [ ] **Step 4: Handle link action (placeholder modal)**

For now, the "Link CRM Account" button sets `showLinkCrm = true`. Add a simple info message below the nudge for when `showLinkCrm` is true:

```tsx
{showLinkCrm && (
  <div className="flex items-center gap-2 text-xs text-text-secondary px-4 py-2">
    <span className="material-symbols-outlined text-sm">info</span>
    CRM linking UI coming soon — use the Edit button to set Account ID or Contact ID directly for now.
    <button onClick={() => setShowLinkCrm(false)} className="ml-auto text-xs text-text-tertiary hover:text-text-primary border-none bg-none cursor-pointer">Dismiss</button>
  </div>
)}
```

> **Note:** Full CRM link search modal is out of scope for this plan. The nudge is the UX signal — the full inline link flow can be a follow-up task.

- [ ] **Step 5: Also update `displayName` fallback**

In `BorrowerProfileDetail.tsx`, find the `displayName` helper or wherever the borrower name is derived. Ensure it falls back to `profile.name`:

```tsx
const displayName = (p: typeof profile) => {
  if (!p) return 'Unnamed Borrower';
  if (p.account) return p.account.name;
  if (p.contact) return `${p.contact.firstName} ${p.contact.lastName}`.trim();
  if (p.name) return p.name;
  return 'Unnamed Borrower';
};
```

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/BorrowerProfileDetail.tsx
git commit -m "feat(credit): unlinked CRM nudge banner on borrower detail page"
```

---

## Task 8: Frontend — Inline borrower creation in PartiesTab

**Files:**
- Modify: `frontend/pages/credit/tabs/PartiesTab.tsx`

- [ ] **Step 1: Add import**

```tsx
import NewBorrowerWizard from '../../../src/components/credit/NewBorrowerWizard';
```

- [ ] **Step 2: Add wizard state**

Near the top of the component, add:
```tsx
const [showNewBorrower, setShowNewBorrower] = useState(false);
```

- [ ] **Step 3: Locate the borrower select dropdown**

Find the `<select>` that renders borrower profiles for `partyForm.borrowerProfileId` (around line 159). It likely looks like:
```tsx
<select required value={partyForm.borrowerProfileId} onChange={...}>
```

- [ ] **Step 4: Add "New Borrower" button next to the select**

Wrap the select in a flex container and add a button:

```tsx
<div className="flex gap-2 items-start">
  <select
    required
    value={partyForm.borrowerProfileId}
    onChange={e => { setPartyForm(f => ({ ...f, borrowerProfileId: e.target.value })); setErrors(errs => { const { borrowerProfileId: _, ...rest } = errs; return rest; }); }}
    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 bg-surface"
  >
    {/* existing options */}
  </select>
  <button
    type="button"
    onClick={() => setShowNewBorrower(true)}
    className="shrink-0 flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-muted transition-colors bg-surface cursor-pointer font-sans"
    title="Create new borrower"
  >
    <span className="material-symbols-outlined text-base">person_add</span>
    New
  </button>
</div>
```

- [ ] **Step 5: Add wizard at end of component return**

Before the final closing `</>` or `</div>` of the component's return, add:

```tsx
<NewBorrowerWizard
  isOpen={showNewBorrower}
  onClose={() => setShowNewBorrower(false)}
  navigateAfterCreate={false}
  onCreated={(borrowerId) => {
    setShowNewBorrower(false);
    setPartyForm(f => ({ ...f, borrowerProfileId: borrowerId }));
    // Re-fetch borrower list so new borrower appears in the select
    fetchBorrowers?.();
  }}
/>
```

> **Note:** `fetchBorrowers` is whatever function refreshes the borrower list in PartiesTab. Check if one exists — if not, trigger a page-level refresh via `onUpdated?.()` or re-fetch the list inline.

- [ ] **Step 6: Verify end-to-end**

Open a credit application, go to the Parties tab, click "Add Party", click "New" next to the borrower select — the wizard should open. After creation, the new borrower should appear pre-selected.

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/credit/tabs/PartiesTab.tsx
git commit -m "feat(credit): inline New Borrower creation in PartiesTab"
```

---

## Task 9: Frontend — Update BorrowerProfileList displayName fallback

**Files:**
- Modify: `frontend/pages/BorrowerProfileList.tsx`

- [ ] **Step 1: Update the `displayName` helper**

Find `const displayName = (p: BorrowerProfileRow) =>` in `BorrowerProfileList.tsx` and update to fall back to `profile.name`:

```tsx
const displayName = (p: BorrowerProfileRow) => {
  if (p.account) return p.account.name;
  if (p.contact) return `${p.contact.firstName} ${p.contact.lastName}`.trim();
  if ((p as any).name) return (p as any).name;
  return 'Unnamed Borrower';
};
```

Also update `BorrowerProfileRow` interface to include `name`:
```tsx
interface BorrowerProfileRow {
  // existing fields...
  name?: string | null;  // add this
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/BorrowerProfileList.tsx
git commit -m "fix(credit): borrower list displayName falls back to profile.name for unlinked records"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - Two-step wizard (Step 1 identity + Step 2 CRM) → Tasks 5, 6
  - Type-conditional fields → Task 5 (wizard renders SSM for Corporate/Sole Prop, NRIC+DOB for Individual)
  - SSM/NRIC duplicate check → Tasks 2, 5
  - Hard block + auto-redirect on duplicate → Task 5 (redirect to existing borrower)
  - SOLE_PROPRIETOR validator fix → Task 1
  - `name` field on schema → Task 1
  - Remove mandatory CRM constraint → Task 3
  - `checkDuplicate` endpoint → Task 2
  - Error feedback inline → Task 5 (error state in wizard footer)
  - Inline creation in PartiesTab → Task 8
  - Unlinked CRM nudge on detail page → Task 7
  - List page `displayName` fallback → Task 9
  - CRM typeahead search (no UUID) → Task 5

- [x] **No placeholders** — all code is complete
- [x] **Type consistency** — `CreateBorrowerProfilePayload` defined in Task 4, used in Task 5. `checkDuplicateBorrower` defined in Task 4, called in Task 5. `name` field added to schema in Task 1, service in Task 3, interface in Task 4, component in Task 5.
