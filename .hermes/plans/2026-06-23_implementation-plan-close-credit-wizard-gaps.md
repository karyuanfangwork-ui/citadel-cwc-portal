# New Credit Application Wizard Gap-Closure Implementation Plan

> **For Hermes:** Implement this plan task-by-task, verifying each step before moving on.

**Goal:** Close the remaining gaps in the New Credit Application Wizard so `/credit/applications/new` is a production-ready, fully aligned origination flow that matches the feature brief and persists data correctly into the credit application detail pages.

**Architecture:** Keep the existing credit module shell and route, but move the wizard into a feature-scoped component subtree so the page is maintainable. Make the wizard state explicit and source-of-truth driven: applicant, product, details, financials, documents, review, and submit. Prefer reusing existing credit services and detail-tab data models instead of inventing parallel create-only shapes. Where the detail screen reads from child records (retail income, PL/BS statements, ratios, document status), the create flow must write those same records before redirecting.

**Tech Stack:** React 19 + TypeScript + React Router, existing credit frontend service layer, existing backend credit routes/controllers/services, Prisma-backed API, existing enterprise banking UI tokens/components.

---

## Current State Summary

The current `frontend/pages/credit/CreditApplicationCreate.tsx` already provides a working single-file wizard with:
- route entry at `/credit/applications/new`
- applicant search, selection, and inline create
- product selection
- application details
- financial input capture
- document checklist UI
- review and submit
- local draft persistence
- post-create financial snapshot sync

However, the implementation is still incomplete relative to the original plan:
- draft persistence is local-only, not server-backed
- the wizard is still monolithic instead of feature-scoped
- secured-product conditional fields are not fully modeled
- business financial calculations do not yet match the full spec
- document state is local UI state only
- browser smoke verification has not been completed against the live route

---

## Scope to Close in This Pass

### Must close
1. Convert the monolithic create page into a maintainable component subtree
2. Ensure create-time financial mapping matches the detail tab’s source model
3. Add the missing secure-product conditional fields and validation behavior
4. Align calculations for retail and business flows with the detailed spec
5. Persist draft state in a way that survives refresh and route re-entry
6. Make document completion state and review gating consistent
7. Verify the live route and build outputs after changes

### Not expanding in this pass
- full LOS underwriting engine
- committee workflow redesign
- CRM reconciliation beyond borrower lookup
- PDF generation / e-signature changes

---

## Step-by-Step Plan

### Task 1: Extract the wizard into a feature-scoped component subtree

**Objective:** Move the wizard UI and state out of `frontend/pages/credit/CreditApplicationCreate.tsx` into reusable feature components without changing behavior.

**Files:**
- Create: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Create: `frontend/src/components/credit/new-application/WizardStepper.tsx`
- Create: `frontend/src/components/credit/new-application/RightSummaryPanel.tsx`
- Create: `frontend/src/components/credit/new-application/WizardActions.tsx`
- Create: `frontend/src/components/credit/new-application/types.ts`
- Create: `frontend/src/components/credit/new-application/step-config.ts`
- Modify: `frontend/pages/credit/CreditApplicationCreate.tsx`

**Implementation notes:**
- Keep `CreditApplicationCreate.tsx` as a thin route wrapper that reads query params and renders the new wizard.
- Move the step list, summary panel, quick checks, and action footer into dedicated components.
- Keep all existing behavior unchanged during the extraction.
- Preserve the current route and permission gating in `frontend/App.tsx`.

**Verification:**
- `npm run build` from `frontend/`
- Confirm `/credit/applications/new` still renders the wizard under `CreditLayout`

---

### Task 2: Replace local-only draft persistence with a durable draft model

**Objective:** Make the wizard resume reliably after reload or re-entry, not just via localStorage.

**Files:**
- Modify: `frontend/src/services/credit.service.ts`
- Modify: `backend/src/credit/routes/creditApplication.routes.ts`
- Modify: `backend/src/credit/controllers/creditApplication.controller.ts`
- Modify: `backend/src/credit/services/creditApplication.service.ts`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Create: `backend/src/credit/validators/creditApplication.validator.ts` if a dedicated schema is needed

**Implementation notes:**
- Add a server draft save/load endpoint only if the existing create/update/readiness flow cannot store draft state safely.
- Persist only fields the wizard genuinely owns: applicant selection, product, amount, tenor, purpose, branch, RM, financials, document completion, and current step.
- Keep localStorage as a fallback cache for early-stage data only if server draft is not yet available.
- Prefer a single draft schema that both frontend and backend understand.

**Verification:**
- Save draft on step 1 or 2, reload the page, and confirm state is restored
- Clear browser storage and confirm server-backed draft still resumes if implemented
- Build both frontend and backend if API contracts change

---

### Task 3: Finalize applicant search and duplicate-prevention behavior

**Objective:** Ensure the applicant lookup and duplicate prevention logic matches the feature brief.

**Files:**
- Modify: `frontend/src/services/credit.service.ts`
- Modify: `frontend/src/components/credit/new-application/steps/ApplicantSearchStep.tsx`
- Modify: `backend/src/credit/controllers/borrowerProfile.controller.ts`
- Modify: `backend/src/credit/services/borrowerProfile.service.ts`
- Modify: `backend/src/credit/routes/borrowerProfile.routes.ts`

**Implementation notes:**
- Confirm the search request supports NRIC, passport, CIF/customer number, phone, email, and registration number.
- Show existing applications and KYC status in search results.
- Make duplicate detection explicit when creating a new applicant.
- Ensure “Use Existing Applicant” and “View Applicant 360” are wired for every match row.

**Verification:**
- Search by each supported identifier
- Confirm duplicates are surfaced before create
- Confirm the create-new path is blocked when the backend returns a conflict

---

### Task 4: Complete applicant selection / creation flow

**Objective:** Support all required applicant types and ensure created borrowers are linked back into the wizard state.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ApplicantSelectionStep.tsx`
- Create: `frontend/src/components/credit/new-application/steps/ApplicantCreationForm.tsx`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`

**Implementation notes:**
- Support the applicant types from the plan: Individual, Joint Applicant, Guarantor, Sole Proprietor, SME Company, Corporate Company.
- Use the existing borrower profile create API.
- Validate mandatory identity fields per applicant type.
- Keep “selected borrower” as the canonical link in wizard state.

**Verification:**
- Create individual and business applicants
- Confirm the created borrower remains selected across step changes
- Confirm duplicate validation blocks unsafe creation

---

### Task 5: Align financial capture with the detail screen’s source model

**Objective:** Ensure every financial input in the wizard maps to the exact model the credit application detail tab reads.

**Files:**
- Modify: `frontend/pages/credit/CreditApplicationCreate.tsx` or the extracted wizard step component
- Modify: `frontend/src/services/credit.service.ts`
- Modify: `backend/src/credit/services/retailIncome.service.ts`
- Modify: `backend/src/credit/services/borrowerCreditData.service.ts`
- Modify: `frontend/pages/credit/tabs/FinancialProfileTab.tsx`
- Modify: `frontend/pages/credit/tabs/sections/RetailIncomeTab.tsx`
- Modify: `frontend/pages/credit/tabs/sections/RetailBorrowerProfile.tsx`
- Modify: `frontend/pages/credit/tabs/sections/SmeFinancialsTab.tsx`

**Implementation notes:**
- Keep the already-fixed mapping: wizard “Monthly Commitments” must persist into `otherCommitments` / “Other Obligations”, not `existingLoanCommitment`.
- Confirm the create flow writes the same child records the detail tab queries.
- Verify the post-create sync writes retail income for individuals and PL/BS line items for businesses.
- If the detail tab displays additional ratios or totals, make the create flow populate the underlying source values rather than faking derived display values.

**Verification:**
- Create an individual application and verify the Financial Profile tab shows the entered commitments under “Other Obligations”
- Create a business application and verify the detail tab shows populated PL/BS data and ratios
- Reload the detail page and confirm the values persist after refresh

---

### Task 6: Finish secured-product conditional fields and validation

**Objective:** Show collateral and asset-specific fields only when the selected product requires them.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ApplicationDetailsStep.tsx`
- Create: `frontend/src/components/credit/new-application/policy-validation.ts`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`

**Implementation notes:**
- Add conditional fields for secured products:
  - Property Type
  - Vehicle Type
  - Collateral Type
- Make the policy validation explicit and visible in the review step.
- Keep validation rules data-driven, not hardcoded into the JSX.

**Verification:**
- Toggle secured vs unsecured products and confirm the conditional fields appear/disappear correctly
- Confirm policy violations surface before submit

---

### Task 7: Make business financial calculations match the spec

**Objective:** Ensure SME/corporate calculations reflect the intended screening metrics instead of ad hoc display values.

**Files:**
- Create: `frontend/src/components/credit/new-application/financial-calculations.ts`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Modify: `frontend/pages/credit/tabs/sections/SmeFinancialsTab.tsx`

**Implementation notes:**
- Centralize calculation helpers for:
  - retail gross income, net income, commitments, DSR
  - SME/corporate current ratio, DSCR, gearing ratio
- Reuse the same calculation functions in the review step and the right summary panel.
- Avoid duplicated formulas in JSX.

**Verification:**
- Confirm each ratio changes as inputs change
- Confirm the same numbers are shown in both the wizard and the detail/review surfaces

---

### Task 8: Harden document checklist and completion gating

**Objective:** Make document tracking consistent with submission gating and review summary.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/DocumentsStep.tsx`
- Create: `frontend/src/components/credit/new-application/document-config.ts`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Modify: `frontend/src/components/credit/new-application/validation-summary.ts` if added

**Implementation notes:**
- Keep the required docs data-driven per borrower type / product family.
- Track upload state, verification state, and completion state separately.
- Make required-document completion the source for review blockers, not a separate manually maintained flag.
- If actual upload persistence exists in the current credit services, wire it; otherwise keep this step honest that it is checklist state only and do not pretend files were uploaded.

**Verification:**
- Confirm required docs block submit when incomplete
- Confirm completion percentage updates from the checklist state
- Confirm reloaded draft preserves document status if persistence is implemented

---

### Task 9: Tighten review and submit gating

**Objective:** Ensure the final submit gate uses the same blockers the user sees in the review step.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ReviewSubmitStep.tsx`
- Create: `frontend/src/components/credit/new-application/validation-summary.ts`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`

**Implementation notes:**
- Show grouped summaries:
  - Applicant Summary
  - Product Summary
  - Financial Summary
  - Document Summary
  - Validation Summary
- Block submit on:
  - missing applicant
  - missing product
  - invalid amount / tenor / purpose
  - missing required docs
  - policy violations
  - unresolved duplicate issues
- Submit should call the same create flow already used today, including the financial snapshot sync.

**Verification:**
- Confirm submit is disabled when blockers exist
- Confirm valid submit creates the application and redirects correctly

---

### Task 10: Sync route, query params, and state restoration behavior

**Objective:** Make `/credit/applications/new` work cleanly from all entry points.

**Files:**
- Modify: `frontend/App.tsx`
- Modify: `frontend/pages/credit/CreditApplicationCreate.tsx`
- Modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Modify: `frontend/pages/BorrowerProfileList.tsx`
- Modify: `frontend/pages/BorrowerProfileDetail.tsx`
- Modify: `frontend/pages/credit/CreditDashboard.tsx`
- Modify: `frontend/pages/CreditApplicationList.tsx`

**Implementation notes:**
- Support direct entry from borrower detail/list pages with `borrowerId` query params.
- Preserve selected borrower if passed in from another page.
- Keep the route inside `CreditLayout` and preserve the existing permissions.

**Verification:**
- Open the wizard from each CTA entry point
- Confirm borrower preselection works
- Confirm direct route access still uses the correct shell and permission gate

---

### Task 11: Add regression tests and smoke tests

**Objective:** Lock the fixed behavior so the same gaps do not reopen later.

**Files:**
- Create/modify frontend tests under `frontend/src/__tests__/` or the repo’s existing frontend test location
- Create/modify backend tests only if API contracts change

**Test coverage to add:**
- “Monthly Commitments” maps to “Other Obligations” on create
- financial snapshot sync runs after application create
- applicant duplicate detection blocks unsafe creation
- draft restore works after reload if server-backed draft is implemented
- review blockers prevent submit

**Verification:**
- Run the relevant frontend test command from `frontend/package.json`
- Run backend tests only if backend routes/services changed
- Run `npm run build` in both frontend and backend if contracts changed

---

### Task 12: Browser smoke verify the live wizard

**Objective:** Prove the route and the updated mapping work in the live UI, not just in build output.

**Files:**
- No code changes unless the browser smoke reveals a defect

**Smoke script:**
1. Open `/credit/applications/new`
2. Search/select an existing applicant or create a new one
3. Choose a product
4. Enter amount, tenor, purpose, branch, and RM
5. Enter financial info including Monthly Commitments
6. Complete or mark required documents
7. Review the payload and submit
8. Open the created application’s Financial Profile tab
9. Confirm the entered Monthly Commitments are shown as Other Obligations

**Verification:**
- Capture the browser result and network response if anything fails
- Do not call the feature complete until the live UI path passes

---

## Recommended Delivery Order

1. Extract the monolithic wizard into feature components
2. Align draft persistence and applicant state restoration
3. Finalize applicant search / create behavior
4. Finish financial source-model mapping and business calculations
5. Add secured-product conditionals
6. Harden documents and review gating
7. Add tests
8. Browser smoke verify the live route

---

## Acceptance Criteria

- `/credit/applications/new` is reachable under `CreditLayout`
- user can search, select, or create an applicant
- product and application details are captured correctly
- financial inputs persist into the same data model the detail page reads
- “Monthly Commitments” appears on the detail page as “Other Obligations”
- business financial metrics match the intended calc model
- required documents are tracked and block submission when incomplete
- draft state survives refresh if the selected persistence approach is implemented
- submit creates an application and redirects successfully
- frontend build passes, and backend build passes if backend contracts change
- live browser smoke test passes end-to-end
