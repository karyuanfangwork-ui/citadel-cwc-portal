# New Credit Application Wizard Implementation Plan

> **For Hermes:** Implement this plan task-by-task, verifying each step before moving on.

**Goal:** Build a production-grade, desktop-first New Credit Application Wizard for the credit module that guides users through applicant search, applicant creation/selection, product selection, application setup, financial capture, document upload, and final review/submission.

**Architecture:**
Use the existing credit module shell (`CreditLayout`) and add a new dedicated route for application origination. The wizard should be a full-page experience, not a modal, with a left progress rail, a central step canvas, and a persistent right-side summary panel. Applicant duplicate prevention should reuse the borrower profile search / duplicate-check APIs first; application submission should reuse the existing credit application create endpoint and DRAFT lifecycle. Draft persistence should be server-backed where possible, with local fallback only for early-stage data.

**Tech Stack:** React 19 + TypeScript + React Router, existing credit frontend service layer, existing backend credit routes/controllers/services, Prisma-backed API, existing enterprise banking UI tokens/components.

---

## Scope

### In Scope
- New route: `/credit/applications/new`
- 7-step wizard UI with progress indicator and sticky right summary panel
- Applicant search and duplicate prevention
- Applicant selection / creation flow
- Product selection with product summary cards
- Application detail capture with conditional secured-product fields
- Financial information capture with calculated metrics
- Document checklist / upload step
- Review & submit step with blocker validation
- Save Draft / Cancel / Previous / Next actions
- Responsive behavior for desktop and tablet breakpoints

### Out of Scope for this first delivery
- Full LOS underwriting engine
- Committee / approval workflow redesign
- Complex workflow orchestration beyond create + draft + review + submit
- Deep CRM entity reconciliation unless required by the current borrower search surface
- PDF generation or e-signature changes

---

## Current Codebase Context

### Frontend anchors already present
- `frontend/src/components/CreditLayout.tsx` — credit module shell with horizontal top nav and `<Outlet />`
- `frontend/src/components/CreditNav.tsx` — credit sub-navigation
- `frontend/pages/CreateBorrowerPage.tsx` — existing multi-step borrower creation pattern
- `frontend/src/components/credit/create-borrower/*` — stepper, draft, duplicate conflict modal, review page patterns
- `frontend/src/services/credit.service.ts` — credit API client and shared types
- `frontend/App.tsx` — route registration point

### Backend anchors already present
- `backend/src/credit/routes/credit.routes.ts` — credit API mount point
- `backend/src/credit/routes/borrowerProfile.routes.ts` — applicant search / duplicate-check endpoints
- `backend/src/credit/routes/creditApplication.routes.ts` — create/update/readiness/transition endpoints
- `backend/src/credit/controllers/creditApplication.controller.ts` — create and transition handlers
- `backend/src/credit/services/creditApplication.service.ts` — DRAFT creation and application lifecycle logic
- `backend/src/credit/controllers/borrowerProfile.controller.ts` — search and duplicate detection logic
- `backend/src/credit/services/borrowerProfile.service.ts` — borrower lookup / duplicate logic

---

## Proposed Build Plan

### Task 1: Add a route entry for the wizard

**Objective:** Expose the new wizard at a stable credit-module URL.

**Files:**
- Modify: `frontend/App.tsx`
- Create: `frontend/pages/CreditApplicationCreate.tsx` (or the final chosen page name)

**Implementation notes:**
- Add a protected route under `/credit/applications/new`.
- Keep it inside `CreditLayout` so it inherits the enterprise banking shell.
- If navigation should expose a CTA, add only the minimal hook needed in the credit module entry points.

**Verification:**
- Run frontend build / typecheck.
- Confirm the route renders under the credit layout.

---

### Task 2: Build the wizard page shell and layout primitives

**Objective:** Create the production-grade page frame before wiring business logic.

**Files:**
- Create: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Create: `frontend/src/components/credit/new-application/WizardStepper.tsx`
- Create: `frontend/src/components/credit/new-application/RightSummaryPanel.tsx`
- Create: `frontend/src/components/credit/new-application/WizardActions.tsx`
- Create: `frontend/src/components/credit/new-application/types.ts`

**Implementation notes:**
- Full-page desktop layout with three columns:
  - left progress rail
  - center form canvas
  - right summary panel
- Keep high information density, strong section headings, status badges, and clear validation states.
- Use the current credit design tokens and existing button / card / badge primitives where practical.
- Persist the summary panel across all steps.

**Verification:**
- Visual check in browser at desktop and narrower widths.
- Confirm sticky actions / summary do not overlap content.

---

### Task 3: Implement step state, navigation, and draft state model

**Objective:** Establish the wizard flow engine and save/resume behavior.

**Files:**
- Create/modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`
- Create: `frontend/src/components/credit/new-application/wizard-state.ts`
- Modify: `frontend/src/services/credit.service.ts` if new draft helpers are needed

**Implementation notes:**
- Model the wizard as 7 steps:
  1. Applicant Search
  2. Applicant Selection / Creation
  3. Product Selection
  4. Application Details
  5. Financial Information
  6. Documents
  7. Review & Submit
- Track current step, completed step set, blocker state, and draft state.
- Support Save Draft at any step.
- Recommended persistence strategy:
  - local draft cache for early steps before a server draft exists
  - server-backed DRAFT once the borrower and core application payload are available
- Keep a single source of truth for the wizard state to avoid drift between right summary, step forms, and final review.

**Verification:**
- Refresh page and confirm draft restoration behavior.
- Verify Previous / Next / Save Draft / Cancel behavior.

---

### Task 4: Build Step 1 — Applicant Search

**Objective:** Prevent duplicate applicants before any application is created.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ApplicantSearchStep.tsx`
- Modify: `frontend/src/services/credit.service.ts`

**Implementation notes:**
- Search fields: NRIC, Passport Number, CIF Number, Customer Number, Phone Number, Email, Company Registration Number.
- Display a results table with applicant name, type, CIF number, existing applications, KYC status, last updated.
- Actions per row: Use Existing Applicant, View Applicant 360, Create New Applicant.
- Empty state: “No matching applicant found.” with Create New Applicant CTA.
- Wire search to the borrower profile search endpoint first.
- If CIF/customer number is not covered by the borrower search payload, add the smallest backend adjustment needed rather than simulating it in the UI.

**Backend dependency check:**
- If the search API doesn’t expose all required lookup keys, extend the borrower search controller/service and update the service layer response typing.

**Verification:**
- Search by NRIC / phone / email / registration number.
- Confirm duplicate matches are shown and can open existing borrower profile.
- Confirm no-result state routes to create applicant flow.

---

### Task 5: Build Step 2 — Applicant Selection / Creation

**Objective:** Let the user either bind an existing applicant or create a new one safely.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ApplicantSelectionStep.tsx`
- Create: `frontend/src/components/credit/new-application/steps/ApplicantCreationForm.tsx`
- Possibly modify: `frontend/src/components/credit/new-application/NewApplicationWizard.tsx`

**Implementation notes:**
- Support applicant types:
  - Individual
  - Joint Applicant
  - Guarantor
  - Sole Proprietor
  - SME Company
  - Corporate Company
- Reuse existing borrower profile creation behavior where possible, but trim fields to the wizard’s needs.
- Enforce duplicate NRIC / registration number / phone / email validation visibly in the step.
- Provide a path to view the selected applicant in Applicant 360.

**Verification:**
- Confirm existing applicant selection survives step transitions.
- Confirm new applicant creation stores the linked borrower reference in wizard state.
- Confirm duplicate validation blocks unsafe creation.

---

### Task 6: Build Step 3 — Product Selection

**Objective:** Capture the target credit product and product-specific constraints.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ProductSelectionStep.tsx`
- Create: `frontend/src/components/credit/new-application/product-config.ts`

**Implementation notes:**
- Group products into Retail and Business.
- Supported products from the brief:
  - Personal Financing
  - Mortgage Financing
  - Auto Financing
  - Credit Card
  - SME Financing
  - Commercial Lending
  - Corporate Lending
- Product summary should show product name, maximum amount, minimum amount, tenure range.
- Keep the product config data-driven so future product additions do not require rewiring the step.

**Verification:**
- Confirm summary updates when product changes.
- Confirm downstream step visibility can react to product category.

---

### Task 7: Build Step 4 — Application Details

**Objective:** Capture core application metadata and conditional collateral fields.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ApplicationDetailsStep.tsx`
- Create: `frontend/src/components/credit/new-application/policy-validation.ts`

**Implementation notes:**
- Capture:
  - Requested Amount
  - Requested Tenure
  - Purpose of Financing
  - Branch
  - Relationship Manager
- For secured products, conditionally show:
  - Property Type
  - Vehicle Type
  - Collateral Type
- Add visible real-time policy validation with clear severity states.
- Keep validation messages concise and action-oriented.

**Verification:**
- Confirm secured-product fields only render when applicable.
- Confirm invalid amounts / tenure / policy violations show immediately.

---

### Task 8: Build Step 5 — Financial Information

**Objective:** Capture retail or SME/corporate financials and surface calculated ratios.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/FinancialInformationStep.tsx`
- Create: `frontend/src/components/credit/new-application/financial-calculations.ts`

**Implementation notes:**
- Retail fields:
  - Basic Salary
  - Allowance
  - Bonus
  - Rental Income
  - Other Income
  - Mortgage / Auto Loan / Personal Loan / Credit Card / Other Obligations
- Retail calculations:
  - Gross Income
  - Net Income
  - Monthly Commitment
  - Disposable Income
  - DSR
- SME / Corporate fields:
  - Revenue
  - Gross Profit
  - Net Profit
  - Existing Borrowings
- SME / Corporate calculations:
  - Current Ratio
  - DSCR
  - Gearing Ratio
- Keep formulas reusable so review step can show the exact same computed values.

**Verification:**
- Confirm the displayed calculation values update from input changes.
- Confirm retail and business modes show only relevant fields.

---

### Task 9: Build Step 6 — Documents

**Objective:** Capture required documents with upload and verification states.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/DocumentsStep.tsx`
- Create: `frontend/src/components/credit/new-application/document-config.ts`

**Implementation notes:**
- Retail documents:
  - NRIC Front
  - NRIC Back
  - Payslip
  - Bank Statement
  - EPF Statement
  - EA Form
- SME documents:
  - SSM Registration
  - Financial Statements
  - Bank Statements
  - Director Identification
- For each document show:
  - Upload status
  - Verification status
  - Expiry date
- Track completion percentage for the right summary panel.

**Verification:**
- Upload state changes should update the summary and review step.
- Missing required documents should block submission in review.

---

### Task 10: Build Step 7 — Review & Submit

**Objective:** Present the final application summary and block submission on unresolved issues.

**Files:**
- Create: `frontend/src/components/credit/new-application/steps/ReviewSubmitStep.tsx`
- Create: `frontend/src/components/credit/new-application/validation-summary.ts`

**Implementation notes:**
- Show grouped summaries:
  - Applicant Summary
  - Product Summary
  - Financial Summary
  - Compliance Summary
  - Document Summary
  - Validation Summary
- Explicit blockers:
  - Missing Mandatory Fields
  - Missing Documents
  - Duplicate Applicant Detected
  - Invalid DSR
  - Compliance Issues
- Actions:
  - Save Draft
  - Submit Application
- On submit, call the existing create application path and route to the created application detail page.

**Verification:**
- Confirm submit is disabled or blocked when any blocker exists.
- Confirm valid submit reaches the backend and returns a created application.

---

### Task 11: Wire backend contract only where needed

**Objective:** Keep backend changes minimal and only add what the wizard truly needs.

**Files to inspect/modify if necessary:**
- `backend/src/credit/routes/borrowerProfile.routes.ts`
- `backend/src/credit/controllers/borrowerProfile.controller.ts`
- `backend/src/credit/services/borrowerProfile.service.ts`
- `backend/src/credit/routes/creditApplication.routes.ts`
- `backend/src/credit/controllers/creditApplication.controller.ts`
- `backend/src/credit/services/creditApplication.service.ts`
- `frontend/src/services/credit.service.ts`

**Implementation notes:**
- Prefer reusing the existing borrower search and duplicate endpoints.
- Only extend the backend if the wizard truly needs a missing identifier, draft field, or response shape.
- If backend response types change, update the shared frontend service types first.

**Verification:**
- Backend build passes after any API contract change.
- Frontend build passes against the updated types.

---

### Task 12: Final polish, accessibility, and responsive behavior

**Objective:** Make the wizard production-ready.

**Files:**
- Adjust any wizard component files created above
- Potentially update shared UI primitives if a gap appears

**Implementation notes:**
- Ensure consistent spacing, truncation, and sticky panel behavior.
- Add clear validation messages, status badges, and loading states.
- Make tab order and keyboard navigation sane.
- Ensure the wizard works on responsive desktop/tablet widths without losing the summary panel or action bar.

**Verification:**
- Browser smoke test on desktop and smaller widths.
- Keyboard navigation check for key actions and step transitions.

---

## Validation Strategy

### Frontend
- `npm run build` from `frontend/`
- If available in the repo, run the relevant frontend tests around the new wizard and existing borrower wizard patterns
- Browser smoke test of `/credit/applications/new`

### Backend
- `npm run build` from `backend/`
- If any backend route or validator changes are made, run the relevant targeted tests for those modules

### End-to-end smoke checks
- Search for an existing applicant
- Confirm duplicate detection
- Create a new applicant if needed
- Complete product selection and application details
- Save a draft and reload
- Reach the review step and confirm blockers are enforced
- Submit a valid application and confirm redirect to the application detail page

---

## Risks / Tradeoffs
- The requested wizard is broader than the current borrower creation wizard, so there is a risk of overfitting to the existing borrower flow. Keep this as an origination wizard, not a borrower wizard clone.
- Draft persistence can become messy if local and server-backed state diverge; use one state model and keep the local fallback minimal.
- CIF / customer number lookups may not already exist in the borrower search surface. If absent, add the smallest backend extension instead of hardcoding a fake client-only search.
- Financial formula accuracy matters; formulas should be centralized so the review screen and summary panel cannot disagree.

---

## Open Questions for Review
1. Should the wizard create the borrower profile first and then the credit application, or allow a temporary wizard draft before borrower creation is finalized?
2. Do you want the applicant search to also query CRM accounts / contacts, or keep the first delivery limited to credit borrower profiles?
3. Should Save Draft persist only locally until submit, or should the backend also support a dedicated draft-saving endpoint for the wizard?
4. Which default product categories should be shown first in the product selector for your business priority?

---

## Suggested Delivery Order
1. Route + page shell
2. Stepper + summary panel + state model
3. Applicant search / duplicate prevention
4. Applicant selection / creation
5. Product selection
6. Application details
7. Financials
8. Documents
9. Review & submit
10. Backend contract adjustments, if needed
11. Build + browser verification

---

## Acceptance Criteria
- New wizard is reachable from `/credit/applications/new`
- Duplicate applicants are prevented before submission
- User can select existing applicant or create a new one
- Product, application, financial, and document data are captured step-by-step
- Right summary panel stays visible and accurate throughout
- Save Draft works at any step
- Review step shows blockers clearly
- Valid submission creates a credit application and redirects successfully
- Frontend and backend builds pass after the change
