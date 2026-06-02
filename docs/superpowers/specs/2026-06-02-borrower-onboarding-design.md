# Borrower Onboarding — Design Spec
**Date:** 2026-06-02  
**Status:** Approved  
**Author:** KY + Claude

---

## Problem Statement

The current "New Borrower" modal is a thin DB wrapper that exposes raw schema fields with no UX thinking. It requires RMs to type raw CRM UUIDs, has no duplicate detection, crashes silently on `SOLE_PROPRIETOR` type, shows all fields regardless of borrower type, and swallows errors without feedback. As a result, RMs almost never use it directly — borrowers are created by admins via seed/import.

---

## Goals

1. RM can onboard a new borrower from the Borrower list in under 60 seconds
2. No duplicate borrower profiles — hard block via SSM/NRIC check with auto-redirect
3. CRM link is searchable by name (no UUID entry), optional at creation time
4. Inline borrower creation available inside the Credit Application wizard
5. Fix silent `SOLE_PROPRIETOR` type crash

---

## Design

### 1. Two-Step Creation Wizard (Borrower List)

Replaces the current flat modal with a two-step wizard. Both steps run inside the existing `Modal` component (`size="lg"`).

#### Step 1 — Identity

**Fields by type:**

| Type | Fields |
|---|---|
| Corporate | Company Name *(required)*, SSM Registration No. *(required)* |
| Individual | Full Name *(required)*, NRIC / Passport No. *(required)*, Date of Birth *(required)* |
| Sole Prop | Company Name *(required)*, SSM Registration No. *(required)* |

- Borrower type selected via 3-button toggle group (Corporate / Individual / Sole Prop), not a dropdown
- Fields are type-conditional — only the relevant fields render
- On blur of SSM / NRIC field → call `GET /api/v1/credit/borrowers/check-duplicate`
  - If `exists: false` → green success banner "No duplicate found"
  - If `exists: true` → amber warning banner with existing borrower card + "View Existing Borrower" button → modal closes, navigate to existing profile
- "Next" button disabled until all required fields pass and duplicate check returns `exists: false`
- A `name` field is stored on `BorrowerProfile` itself (Corporate/Sole Prop: Company Name; Individual: Full Name) so unlinked borrowers still display correctly in the list

#### Step 2 — CRM Link *(optional)*

- Identity summary chip (read-only) with "Edit" back-link
- Searchable CRM typeahead — search by name or SSM/NRIC, returns matching `CrmAccount` (Corporate/Sole Prop) or `CrmContact` (Individual) records
- "Create new CRM Account/Contact" option — pre-filled from Step 1 data, no re-entry
- "Skip for now" option — creates borrower profile without CRM link; a nudge banner appears on the detail page until linked
- On confirm → `POST /api/v1/credit/borrowers` → navigate to new borrower detail page

---

### 2. Backend Changes

#### New endpoint — duplicate check
```
GET /api/v1/credit/borrowers/check-duplicate?ssm=<value>
GET /api/v1/credit/borrowers/check-duplicate?nric=<value>
```
Response: `{ exists: boolean, borrowerId?: string }`

Logic:
- `ssm` param: find `CrmAccount` where `registrationNumber = value` that has a linked `BorrowerProfile`
- `nric` param: find `CrmContact` where `nricPassport = value` that has a linked `BorrowerProfile`

#### BorrowerProfile schema — add `name` field
```prisma
name  String?  // display name for unlinked profiles
```

#### Remove mandatory CRM link constraint
- Remove the `if (!data.accountId && !data.contactId) throw` guard in `borrowerProfile.service.ts`
- `name` becomes required when both `accountId` and `contactId` are null

#### Fix SOLE_PROPRIETOR type
- Add `SOLE_PROPRIETOR` to `borrowerTypeEnum` in `borrowerProfile.validator.ts`
- Frontend and backend now agree on all three types: `CORPORATE`, `INDIVIDUAL`, `SOLE_PROPRIETOR`

#### Error surfacing
- All `createBorrowerProfile` failures must return structured error responses
- Frontend shows inline error message inside the modal footer on failure

---

### 3. Inline Borrower Creation in Credit Application Wizard

- The "Add Party" step in `PartiesTab.tsx` gains a **"+ New Borrower"** button alongside the existing party search
- Clicking it opens the same two-step wizard in a modal
- On success: newly created borrower is immediately selected as the party — no page reload required
- No changes to the rest of the credit application flow

---

### 4. Detail Page — Unlinked CRM Nudge

When a borrower profile has no `accountId` and no `contactId`:
- Show an amber `link_off` banner at the top of the Overview tab: *"No CRM Account linked — Linking a CRM account pulls in contact details, activities, and notes."*
- Banner has a "Link CRM Account" button that opens a search modal (same CRM typeahead from Step 2)
- Banner is dismissed permanently once a CRM record is linked
- No other functionality is blocked by missing CRM link

---

### 5. Borrower List — Name Display

- `displayName()` helper updated: prefer `profile.name` when `account` and `contact` are both null
- Fallback order: `account.name` → `contact.firstName + lastName` → `profile.name` → "Unnamed Borrower"

---

## Out of Scope (deferred)

- Credit Risk Rating, AML Tier, Exposure Limit at creation — these belong on the detail page post-assessment
- Occupation, employer, source of wealth, net worth at creation — filled via detail page edit
- Bulk import / CSV upload of borrowers
- Sanctioned entity flag at creation

---

## Affected Files

### Frontend
- `frontend/pages/BorrowerProfileList.tsx` — replace flat modal with two-step wizard component
- `frontend/pages/BorrowerProfileDetail.tsx` — add unlinked CRM nudge banner
- `frontend/pages/credit/tabs/PartiesTab.tsx` — add inline "New Borrower" creation option
- `frontend/src/services/credit.service.ts` — add `checkDuplicate()`, update `createBorrowerProfile()` payload type

### Backend
- `backend/src/credit/validators/borrowerProfile.validator.ts` — add `SOLE_PROPRIETOR`, add `name` field
- `backend/src/credit/services/borrowerProfile.service.ts` — remove mandatory CRM constraint, handle `name` field
- `backend/src/credit/controllers/borrowerProfile.controller.ts` — add `check-duplicate` handler
- `backend/src/credit/routes/borrowerProfile.routes.ts` — add `GET /check-duplicate` route
- `backend/prisma/schema.prisma` — add `name String?` to `BorrowerProfile` model
- `backend/prisma/migrations/` — migration for `name` field
