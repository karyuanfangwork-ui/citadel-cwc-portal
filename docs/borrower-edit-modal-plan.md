# Borrower Profile Edit Modal — Implementation Plan

## Overview

Add an "Edit Profile" modal to `BorrowerProfileDetail.tsx` that allows users with `credit:write` permission to update all editable fields on a borrower profile via `PATCH /credit/borrowers/:id`.

## New File

**`frontend/src/components/credit/EditBorrowerModal.tsx`** — Self-contained modal component

## Existing Files to Modify

1. **`frontend/pages/BorrowerProfileDetail.tsx`** — Import modal, add "Edit" button, wire up open/close/refresh

## Modal Component Specification

```
EditBorrowerModal.tsx
├── Props: { profile: BorrowerProfile, isOpen, onClose, onSaved(profile) }
├── State: form field values (initialized from profile), saving, error
├── Layout (size="lg"):
│   ├── Section: "Identity"
│   │   ├── Name (text input) — disabled if linked to CRM (accountId/contactId set)
│   │   ├── Borrower Type (select: CORPORATE / INDIVIDUAL / SOLE_PROPRIETOR / JOINT)
│   │   └── Active toggle (isActive)
│   ├── Section: "Credit Risk"
│   │   ├── Risk Rating (select: AAA, AA, A, BBB, BB, B, CCC, CC, C, D, NR)
│   │   ├── AML Tier (select: LOW, MEDIUM, HIGH, PROHIBITED)
│   │   ├── Sanctioned Entity (toggle)
│   │   └── Exposure Limit (number input)
│   ├── Section: "Business Information"
│   │   ├── Occupation (text input)
│   │   ├── Employer (text input)
│   │   ├── Annual Income (number input)
│   │   ├── Net Worth (number input)
│   │   ├── Source of Wealth (text input)
│   │   └── Purpose of Account (text input)
│   └── Footer: Cancel (ghost) + Save Changes (primary, with loading state)
```

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Modal component | Shared `<Modal>` from `ui/Modal.tsx` | Consistent with NewBorrowerWizard, handles focus trap + escape + scroll lock |
| Dropdown component | `<Combobox>` from `ui/Combobox.tsx` | Searchable, keyboard-navigable, clearable |
| Form field styling | Match NewBorrowerWizard pattern | `w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-300` |
| Payload | Only send changed fields (dirty check) | Minimizes risk, works with `encryptBorrowerFields` middleware |
| Error handling | Inline error in modal footer | Keep it simple, consistent with wizard |
| Permission gate | `credit:write` on Edit button, same as "New Application" | Already computed as `canWrite` |

## Backend API

- **Endpoint**: `PATCH /api/v1/credit/borrowers/:id`
- **Auth**: Requires `credit:write` permission
- **Body**: Partial `BorrowerProfile` fields (see validator)
- **Response**: `{ status: 'success', data: { profile } }`
- **Encrypted fields** (`annualIncome`, `netWorth`, `sourceOfWealth`): Middleware `encryptBorrowerFields()` handles encryption transparently

## Form Field → API Field Mapping

| Form Label | API Field | Type | Component |
|------------|-----------|------|-----------|
| Full/Company Name | `name` | string (max 255) | Text input |
| Borrower Type | `borrowerType` | enum | Combobox |
| Active | `isActive` | boolean | Toggle |
| Risk Rating | `creditRiskRating` | enum (nullable) | Combobox |
| AML Tier | `amlRiskTier` | enum (nullable) | Combobox |
| Sanctioned Entity | `isSanctionedEntity` | boolean | Toggle |
| Exposure Limit | `exposureLimit` | Decimal (nullable) | Number input |
| Occupation | `occupation` | string (max 100) | Text input |
| Employer | `employer` | string (max 255) | Text input |
| Annual Income | `annualIncome` | Decimal (nullable) | Number input |
| Net Worth | `netWorth` | Decimal (nullable) | Number input |
| Source of Wealth | `sourceOfWealth` | string (max 255) | Text input |
| Purpose of Account | `purposeOfAccount` | string (max 255) | Text input |

## Enum Values

### BorrowerType (for Combobox)
- `CORPORATE` — Corporate
- `INDIVIDUAL` — Individual
- `SOLE_PROPRIETOR` — Sole Proprietor
- `JOINT` — Joint

### RiskRating (for Combobox, nullable)
- `AAA`, `AA`, `A`, `BBB`, `BB`, `B`, `CCC`, `CC`, `C`, `D`, `NR`

### AmlRiskTier (for Combobox, nullable)
- `LOW` — Low
- `MEDIUM` — Medium
- `HIGH` — High
- `PROHIBITED` — Prohibited

## User Flow

1. User clicks "Edit" button (shown next to "New Application" in the header area)
2. Modal opens, pre-populated with current profile data
3. User edits fields
4. On "Save Changes":
   - Build payload of only changed fields (dirty check against original values)
   - Call `creditService.updateBorrowerProfile(id, payload)`
   - On success: `onSaved(updatedProfile)` → parent refreshes detail page data
   - On error: show error message in modal footer
5. Modal closes, detail page reflects updated data

## Implementation Steps

1. **Create `EditBorrowerModal.tsx`** — Full form modal component with:
   - Three sections (Identity, Credit Risk, Business Information)
   - Pre-populated form fields from `profile` prop
   - Dirty checking to send only changed fields
   - Loading state on Save button
   - Error display in footer
   - Name field disabled when CRM-linked (accountId or contactId is set)

2. **Modify `BorrowerProfileDetail.tsx`** — Add:
   - `const [showEditModal, setShowEditModal] = useState(false)`
   - "Edit" button in header area (gated by `canWrite`)
   - `<EditBorrowerModal>` component with `onSaved` callback that calls `fetchProfile()`

3. **Test** — Open borrower detail, click Edit, change fields, save, verify updates persist

## Reusable UI Components Used

- `Modal` from `frontend/src/components/ui/Modal.tsx`
- `Button` from `frontend/src/components/ui/Button.tsx`
- `Combobox` from `frontend/src/components/ui/Combobox.tsx`

## Styling Conventions (from NewBorrowerWizard)

- Section heading: `text-xs font-bold text-text-secondary uppercase tracking-wide` with `mb-4`
- Field group container: `flex flex-col gap-4`
- Label: `block text-xs font-bold text-text-primary mb-1`
- Input: `w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all`
- Required asterisk: `<span className="text-red-500">*</span>`
- Section card wrapper: `p-4 bg-surface-subtle rounded-cwc-md border border-cwc-border`