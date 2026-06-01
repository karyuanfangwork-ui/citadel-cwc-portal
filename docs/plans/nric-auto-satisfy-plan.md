# Plan: Auto-Satisfy NRIC_PASSPORT from Borrower Profile (Method 3)

## Problem

When a retail (INDIVIDUAL/SOLE_PROPRIETOR) borrower creates a credit application, the
Submission Readiness check blocks submission with:

> "Required document missing: NRIC PASSPORT"

This requires the user to **upload a scanned NRIC document** even though the borrower's
NRIC may already exist in the system — stored on the linked `CrmContact.nricPassport`
field (populated during CRM onboarding or S2 Profile & KYC data entry).

The current readiness check (`submissionReadiness.service.ts` Check 3) only looks at
`application.documents` (the `CreditDocument` model with `classification === 'NRIC_PASSPORT'`).
It does NOT check whether the borrower profile already has NRIC data.

## Approach: Method 3 — OR Logic with Profile NRIC

**Core rule:** A document class is satisfied if **EITHER** condition is met:
1. An uploaded `CreditDocument` with that `classification` exists, OR
2. The borrower profile data can satisfy the requirement (NRIC on file)

This is the most flexible approach because:
- If profile HAS NRIC → requirement auto-satisfied, no upload needed
- If profile has NO NRIC → upload still required (existing behavior)
- User can still upload a scanned copy optionally (for audit trail)

---

## Changes Required

### 1. Backend: `submissionReadiness.service.ts` — Expand Check 3

**File:** `backend/src/credit/services/submissionReadiness.service.ts`

**Current logic (lines ~70-80):**
```ts
const mandatoryClasses = getRequiredDocuments(application.borrowerProfile.borrowerType);
for (const docClass of mandatoryClasses) {
  const hasDoc = application.documents.some((d) => d.classification === docClass);
  if (!hasDoc) {
    errors.push({ field: 'documents', message: `Required document missing: ${docClass}`, severity: 'error' });
  }
}
```

**New logic:**
```ts
// Profile-derived satisfaction: certain doc classes can be satisfied by borrower data
const PROFILE_SATISFIABLE: Record<string, (bp: any) => boolean> = {
  NRIC_PASSPORT: (bp) => {
    // Check CrmContact.nricPassport (via include)
    return !!bp.contact?.nricPassport;
  },
};

const mandatoryClasses = getRequiredDocuments(application.borrowerProfile.borrowerType);
for (const docClass of mandatoryClasses) {
  const hasDoc = application.documents.some((d) => d.classification === docClass);

  // Check if profile data satisfies this requirement
  const profileSatisfier = PROFILE_SATISFIABLE[docClass];
  const satisfiedByProfile = profileSatisfier ? profileSatisfier(application.borrowerProfile) : false;

  if (!hasDoc && !satisfiedByProfile) {
    errors.push({
      field: 'documents',
      message: `Required document missing: ${docClass.replace(/_/g, ' ')}`,
      severity: 'error',
    });
  } else if (!hasDoc && satisfiedByProfile) {
    // Downgrade from error → info (not blocking, but user may want to upload anyway)
    // We add a "satisfied" list so the frontend can show a different badge
  }
}
```

**Prisma query change** — need to include `contact.nricPassport`:
```ts
const application = await prisma.creditApplication.findUnique({
  where: { id: applicationId },
  include: {
    borrowerProfile: {
      select: {
        accountId: true,
        contactId: true,
        borrowerType: true,
        contact: { select: { nricPassport: true } },   // <-- ADD
      },
    },
    facilities: { select: { id: true } },
    documents: { select: { id: true, classification: true } },
    parties: { select: { id: true, role: true, borrowerProfileId: true } },
  },
});
```

**New field in ReadinessIssue & ReadinessResult:**

Add a `satisfied` list to the response so the frontend knows which requirements
are met via profile data (not just via document upload):

```ts
export interface ReadinessIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';   // <-- ADD 'info'
}

export interface ReadinessResult {
  ready: boolean;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
  satisfied: ReadinessIssue[];   // <-- ADD: requirements met via profile data
}
```

When NRIC is satisfied by profile:
```ts
if (!hasDoc && satisfiedByProfile) {
  satisfied.push({
    field: 'documents',
    message: `NRIC / Passport verified from borrower profile — document upload optional`,
    severity: 'info',
  });
}
```

### 2. Backend: No schema changes needed

- `CrmContact.nricPassport` already exists (varchar(50), nullable)
- `BorrowerProfile → CrmContact` relation already exists
- No new models, no migration required

### 3. Frontend: `credit.service.ts` — Update Readiness type

**File:** `frontend/src/services/credit.service.ts` (line ~697)

Add `satisfied` to the return type:
```ts
async checkReadiness(id: string): Promise<{
  ready: boolean;
  errors: { field: string; message: string; severity: 'error' | 'warning' }[];
  warnings: { field: string; message: string; severity: 'error' | 'warning' }[];
  satisfied: { field: string; message: string; severity: 'info' }[];   // <-- ADD
}> {
```

### 4. Frontend: `CreditApplicationDetail.tsx` — Render satisfied items

**File:** `frontend/pages/CreditApplicationDetail.tsx` (line ~101, ~531)

**State type update (line 101):**
```ts
const [readiness, setReadiness] = useState<{
  ready: boolean;
  errors: { field: string; message: string; severity: string }[];
  warnings: { field: string; message: string; severity: string }[];
  satisfied: { field: string; message: string; severity: string }[];   // <-- ADD
} | null>(null);
```

**Render section (after warnings, before "all checks passed", ~line 544):**
```tsx
{readiness.satisfied?.map((s, i) => (
  <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">verified</span>
    {s.message}
  </li>
))}
```

**Update count badge** — subtract satisfied from blocking count:
Currently shows `readiness.errors.length issues blocking`. No change needed —
satisfied items are NOT errors, so the count is already correct.

### 5. Frontend: `DocumentsTab.tsx` — Show "Verified from profile" badge

**File:** `frontend/pages/credit/tabs/DocumentsTab.tsx`

When NRIC is satisfied by profile, show a green "Verified from profile" badge
instead of showing it in the "missing required" warning list.

**Add a new helper (near line 142-146):**
```ts
// Check if NRIC is satisfied from profile
const nricFromProfile = !!(app.borrowerProfile as any)?.contact?.nricPassport;

// Adjust missing required: if NRIC is from profile, don't list it as missing
const effectiveMissing = missingRequired.filter(c =>
  !(c === 'NRIC_PASSPORT' && nricFromProfile)
);
```

**In the "Required documents missing" banner (line 151):**
Use `effectiveMissing` instead of `missingRequired`.

**Below the banner, add a "Verified from profile" section:**
```tsx
{nricFromProfile && !uploadedClasses.has('NRIC_PASSPORT') && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
    <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">verified</span>
    <div>
      <p className="text-sm font-bold text-blue-800 mb-0.5">NRIC / Passport — Verified from profile</p>
      <p className="text-xs text-blue-600">
        Borrower's NRIC/Passport is on file from their profile. A scanned copy can still
        be uploaded below for your records.
      </p>
    </div>
  </div>
)}
```

### 6. Frontend: Ensure `borrowerProfile.contact` is included in app data

**File:** `frontend/src/services/credit.service.ts`

The `getApplication()` response must include `borrowerProfile.contact.nricPassport`.
Check the backend `getApplication` endpoint — if it doesn't include `contact`,
add it to the Prisma query:

**File:** `backend/src/credit/services/creditApplication.service.ts`

In the `getApplication` method, expand the `borrowerProfile` include:
```ts
borrowerProfile: {
  select: {
    id: true,
    borrowerType: true,
    accountId: true,
    contactId: true,
    contact: { select: { nricPassport: true } },   // <-- ADD
  },
},
```

---

## File Change Summary

| # | File | Change Type | Description |
|---|------|------------|-------------|
| 1 | `backend/src/credit/services/submissionReadiness.service.ts` | MODIFY | Expand Check 3 with OR logic; add `satisfied` list; include `contact.nricPassport` in query |
| 2 | `backend/src/credit/services/creditApplication.service.ts` | MODIFY | Add `contact: { select: { nricPassport: true } }` to getApplication borrowerProfile include |
| 3 | `frontend/src/services/credit.service.ts` | MODIFY | Add `satisfied` field to checkReadiness return type |
| 4 | `frontend/pages/CreditApplicationDetail.tsx` | MODIFY | Add `satisfied` to readiness state type; render satisfied items with blue "verified" badges |
| 5 | `frontend/pages/credit/tabs/DocumentsTab.tsx` | MODIFY | Check `borrowerProfile.contact.nricPassport`; show "Verified from profile" badge; exclude from missing-required warning |

**No schema migration needed.** `CrmContact.nricPassport` already exists.

---

## Testing Checklist

1. **INDIVIDUAL borrower WITH NRIC in profile:**
   - Readiness shows blue "NRIC verified from profile — upload optional"
   - NRIC no longer appears as blocking error
   - Documents tab shows green "Verified from profile" badge
   - Application can be submitted without NRIC upload

2. **INDIVIDUAL borrower WITHOUT NRIC in profile:**
   - Readiness still shows "Required document missing: NRIC PASSPORT" (error)
   - Documents tab shows "Required documents missing" banner as before
   - Must upload NRIC document to submit

3. **SOLE_PROPRIETOR borrower:**
   - Same behavior as INDIVIDUAL for NRIC_PASSPORT
   - SSM_CERT still required as upload (no profile shortcut)

4. **CORPORATE borrower:**
   - No change — NRIC_PASSPORT is not in their required list
   - Required docs: SSM_CERT, AUDITED_FINANCIALS, MOA_AOA (all upload-only)

5. **Regression: other readiness checks:**
   - Facility check, guarantor check, financials warning, bureau checks
     all still work identically

6. **Edge case: NRIC uploaded AND on profile:**
   - Document takes priority; satisfied list still shows info message
   - Both badge and uploaded document shown in Documents tab

---

## Future Extensions (Out of Scope)

- **PAYSLIP auto-satisfy:** Could derive from `BorrowerProfile.employer` + `annualIncome`
  if employer payroll integration exists (future)
- **BANK_STATEMENT auto-satisfy:** Could derive from open banking API (future)
- **SSM_CERT auto-satisfy:** Could derive from SSM API integration for CORPORATE/SOLE_PROPRIETOR (future)

The `PROFILE_SATISFIABLE` map is designed to be extended — just add new entries
for additional doc classes as integrations become available.