# Credit Assessment Module — Stakeholder Walkthrough Checklist

## Pre-Meeting Setup
- [ ] Seed data loaded (`npm run prisma:seed` or creditDemoSeed) — 24 applications, 22 borrowers
- [ ] Log in as `admin@test.local` / `abc@123` for full access
- [ ] Confirm backend and frontend dev servers are running
- [ ] Have a second browser tab logged in as `hr@test.local` or `it@test.local` to demo Segregation of Duties (SOD)

---

## 1. Credit Dashboard
**Checkpoint:** Does the dashboard reflect real data?
- [ ] Dashboard shows 4 key metrics: Total Borrowers, Pending Reviews, Approved Today, Total Disbursed
- [ ] "Applications by Stage" breakdown renders (DRAFT / SUBMITTED / UNDER_REVIEW / APPROVED / REJECTED)
- [ ] "Recent Activities" feed populates

---

## 2. Borrower Profile Management
**Checkpoint:** Can the team onboard a new borrower end-to-end?

### Corporate Borrower
- [ ] Create a new **CORPORATE** borrower profile (Company Name, SSM No., ROC No., Business Type)
- [ ] **Overview tab** — all fields editable and save correctly
- [ ] **Directors tab** — add a director with NRIC/Passport (confirm PII is stored encrypted, not plaintext)
- [ ] **Shareholders tab** — add shareholder with shareholding %, share class
- [ ] **UBOs tab** — add UBO with ownership %, PEP flag, source of wealth
- [ ] **Applications tab** — linked applications appear
- [ ] **Exposure tab** — total exposure aggregated from active facilities
- [ ] **Financials tab** — financial statements accessible (N/A for Individual borrowers — confirm guard shown)

### Individual Borrower
- [ ] Create an **INDIVIDUAL** borrower
- [ ] Directors / Shareholders / UBOs tabs hidden or not applicable
- [ ] Financials tab shows "Not Applicable" screen (not an error)

---

## 3. Credit Application Lifecycle (State Machine)
**Checkpoint:** Does the workflow enforce the correct sequence?
- [ ] Create application in **DRAFT** state (applicationNo auto-generated)
- [ ] Assign Product Type, Requested Amount, Tenor, Currency, RM and Analyst
- [ ] **Submit** application → transitions to SUBMITTED
- [ ] Application moves to **UNDER_REVIEW** after analyst picks up
- [ ] Confirm invalid transitions are blocked (e.g. DRAFT → APPROVED directly)
- [ ] Show audit trail on Audit tab — every state change logged with timestamp and user

### Application Tabs
- [ ] **Summary tab** — application details + score run results visible
- [ ] **Facilities tab** — add/edit requested facilities (amount, tenor, rate, purpose)
- [ ] **Parties tab** — borrower, guarantors, co-borrowers, sponsors with liability %
- [ ] **Documents tab** — document checklist per application type
- [ ] **Approvals tab** — approval decisions & decision history
- [ ] **Collateral tab** — collateral items, valuations, liens, insurance
- [ ] **Conditions tab** — Conditions Precedent (CP) and Conditions Subsequent (CS)
- [ ] **Audit tab** — full immutable audit trail

---

## 4. Document Management
**Checkpoint:** Can the team manage credit documents with version control?
- [ ] Upload a document (PDF) against an application
- [ ] Document appears in checklist with status (PENDING / VERIFIED / REJECTED)
- [ ] Verify a document → status changes to VERIFIED
- [ ] Reject a document with a reason → status changes to REJECTED
- [ ] Upload a new version of an existing document → version history preserved
- [ ] AV scan status shown (PENDING / CLEAN / INFECTED)

---

## 5. Credit Scoring
**Checkpoint:** Can analysts run and interpret a credit score?
- [ ] Confirm at least one active Scorecard exists with 9 preset system factors
- [ ] Run a score on an application (`Execute Score` action)
- [ ] Score run result visible on Summary tab (rating band, factor breakdown)
- [ ] Override a score — requires override reason and approver ID
- [ ] Score override logged in audit trail
- [ ] Multiple score runs displayed chronologically (history preserved)

---

## 6. Approval Workflow & Segregation of Duties
**Checkpoint:** Does the approval matrix and SOD enforcement work?
- [ ] View Approval Authority Matrix (exposure range + risk rating → authority level)
- [ ] Submit an approval decision (APPROVE / REJECT / RETURN / ESCALATE)
- [ ] Confirm the **same user who submitted the application cannot approve it** (SOD middleware)
- [ ] Multi-level approvals — second level triggered when exposure exceeds threshold
- [ ] Approval decision captured with timestamp, user, comments, and conditions attached

---

## 7. Collateral Management
**Checkpoint:** Is collateral tracked with full lifecycle?
- [ ] Add a collateral item (Property, Vehicle, Fixed Deposit, etc.) with market value and forced-sale value
- [ ] Add a valuation entry (valuer name, valuation date, amount)
- [ ] Add a lien (lienholder, amount, priority ranking)
- [ ] Discharge a lien → discharge date recorded
- [ ] Add insurance cover (insurer, policy number, coverage amount, expiry date)
- [ ] Total collateral value displayed on application

---

## 8. Conditions Management (CP/CS)
**Checkpoint:** Are conditions tracked to completion?
- [ ] Add a Condition Precedent (CP) with a due date
- [ ] Mark CP as complete with fulfillment notes
- [ ] Waive a condition with reason
- [ ] CP Completion Status check — shows how many CPs fulfilled vs outstanding
- [ ] Add a Condition Subsequent (CS) with monitoring period

---

## 9. Credit Committee
**Checkpoint:** Can a committee meeting be conducted and decisions recorded?
- [ ] Create a committee meeting (type, date, agenda)
- [ ] Add committee members (CHAIR / SECRETARY / MEMBER roles)
- [ ] Add an application as an agenda item
- [ ] Mark member attendance (PRESENT / ABSENT / EXCUSED)
- [ ] Check quorum — system confirms quorum met/not met
- [ ] Cast votes per member (APPROVE / REJECT / ABSTAIN)
- [ ] Finalize decision on agenda item
- [ ] Generate credit memo for the application
- [ ] Meeting status transitions: SCHEDULED → IN_PROGRESS → COMPLETED

---

## 10. Financial Spreading
**Checkpoint:** Can corporate financials be captured and analyzed?
- [ ] Open a corporate borrower's Financials tab
- [ ] Create a financial statement (ANNUAL / QUARTERLY, Balance Sheet / P&L / Cash Flow)
- [ ] Enter financial line items (with parent-child hierarchy)
- [ ] Validate Balance Sheet (Assets = Liabilities + Equity check)
- [ ] Submit statement for review
- [ ] Review/approve financial statement
- [ ] Compute financial ratios (profitability, leverage, liquidity, coverage, activity)
- [ ] View trends across multiple periods
- [ ] Confirm Individual borrower sees "Not Applicable" screen

---

## 11. Post-Disbursement Monitoring
**Checkpoint:** Is the portfolio monitored after approval?
- [ ] View facility health record for an approved application
- [ ] Add a covenant (e.g. Debt/EBITDA ≤ 3.5x) and test results
- [ ] Record a payment event
- [ ] View early warning signals for distressed facilities
- [ ] Resolve a warning signal with notes
- [ ] View "Compliance Reviews Due" list

---

## 12. Related Party / Group Exposure
**Checkpoint:** Is connected-party exposure tracked?
- [ ] Create a Related Party Group and add borrower members
- [ ] View consolidated group exposure across all members
- [ ] Exposure limit flagged when total exceeds threshold

---

## 13. Security & Compliance Controls
**Checkpoint:** Are regulatory and audit controls in place?
- [ ] NRIC / Passport fields are encrypted at rest (not visible as plaintext in DB)
- [ ] PII masking audit log accessible (`/security/audit-trail`)
- [ ] Feature flag for the entire credit module (`credit:module`) — can be toggled on/off
- [ ] Permissions enforced: `credit:read`, `credit:write`, `credit:approve`, `credit:admin`
- [ ] SOD enforced on approval actions (submitter ≠ approver)
- [ ] Every data change recorded in `CreditAuditEvent`

---

## Known Gaps to Flag in Meeting

| Gap | Impact | Status |
|-----|--------|--------|
| No **Documents tab** on BorrowerProfileDetail (only on application) | Cannot view borrower-level documents directly | Open |
| No **Related Party Groups UI** (backend ready, no frontend page) | Connected-party exposure view missing | Open |
| NRIC/Passport in Director/Shareholder/UBO — confirm encryption is active in prod | PII compliance risk | Needs verification |
| Financial Spreading only for Corporate borrowers | Individual borrower financials out of scope | By design |

---

## Quick Demo Flow (15-min condensed version)
1. Dashboard → show metrics
2. Create corporate borrower → add director → add shareholder
3. Create application → add facility → submit
4. Run credit score → show rating
5. Submit approval decision (demonstrate SOD block with second user)
6. Add collateral item + valuation
7. Add CP condition → mark complete
8. Show audit trail on application
