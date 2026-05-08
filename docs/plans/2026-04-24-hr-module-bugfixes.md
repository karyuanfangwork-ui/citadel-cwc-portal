# HR Support Module Bug Fixes — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix the 3 known bugs from the HR Support Module audit (Section 5) — LOA stepper, frontend transition mismatch, and candidate name display.

**Architecture:** Targeted frontend fixes in the stepper component, workflow transitions map, and hiring panel. One backend guard for candidate name null-safety. No schema changes, no new dependencies.

**Tech Stack:** React 19, TypeScript, Prisma, Express

---

## Bug Status Summary

| # | Bug | Status | Action Needed |
|---|-----|--------|---------------|
| 1 | LOA_ACCEPTED dead-end → COMPLETED | Already fixed in codebase | Add missing frontend COMPLETED→ONBOARDING_SUBMITTED transition |
| 2 | HR stepper missing LOA sub-statuses | ACTIVE BUG | Expand stepper allSteps + statusOrder to show LOA_APPROVED, LOA_ISSUED, LOA_ACCEPTED |
| 3 | selectedCandidateName null display | ACTIVE BUG | Add null fallback in HiringWorkflowPanel + backend guard |

---

## Task 1: Fix frontend workflow transitions — COMPLETED→ONBOARDING_SUBMITTED

**Objective:** Sync the frontend transition map with the backend. Backend allows `COMPLETED → ['ONBOARDING_SUBMITTED']` but frontend defines `COMPLETED: []`. This means the frontend cannot show the onboarding advance action after a hiring request completes.

**Files:**
- Modify: `frontend/src/utils/workflowTransitions.ts:24`

**Step 1: Update the frontend transition map**

Change line 24 from:
```typescript
COMPLETED: [],
```
to:
```typescript
COMPLETED: ['ONBOARDING_SUBMITTED'],
```

Also add `LOA_REJECTED` to the `LOA_PENDING_APPROVAL` transitions on line 20. Backend line 28 defines `LOA_PENDING_APPROVAL: ['LOA_APPROVED', 'LOA_REJECTED']` but frontend line 20 has `LOA_PENDING_APPROVAL: []`. Change:
```typescript
LOA_PENDING_APPROVAL: [],
```
to:
```typescript
LOA_PENDING_APPROVAL: ['LOA_APPROVED', 'LOA_REJECTED'],
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add frontend/src/utils/workflowTransitions.ts
git commit -m "fix: sync frontend workflow transitions with backend (COMPLETED→ONBOARDING_SUBMITTED, LOA_PENDING_APPROVAL→LOA_APPROVED/LOA_REJECTED)"
```

---

## Task 2: Fix HR stepper — add LOA sub-status steps

**Objective:** The HR_RECRUITMENT stepper in RequestHeader only shows a single "LOA" step for `LOA_PENDING_APPROVAL`. When the request progresses to `LOA_APPROVED`, `LOA_ISSUED`, or `LOA_ACCEPTED`, the stepper stays on the same "LOA" step and gives no visual feedback of sub-phase progression. Add 2 more LOA steps so agents can see which sub-phase the LOA process is in.

**Files:**
- Modify: `frontend/src/components/request/RequestHeader.tsx:188-211`

**Step 1: Expand the HR_RECRUITMENT allSteps array**

Within the `if (workflowCode === 'HR_RECRUITMENT')` block, replace the `allSteps` array (lines 190-198):

FROM:
```typescript
const allSteps = [
  { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
  { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
  { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
  { label: 'Interview', status: 'INTERVIEW_SCHEDULED', icon: 'radio_button_checked' },
  { label: 'Feedback', status: 'INTERVIEW_FEEDBACK_PENDING', icon: 'radio_button_checked' },
  { label: 'Screening', status: 'HR_SCREENING', icon: 'radio_button_checked' },
  { label: 'LOA', status: 'LOA_PENDING_APPROVAL', icon: 'radio_button_checked' },
  { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
];
```

TO:
```typescript
const allSteps = [
  { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
  { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
  { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
  { label: 'Interview', status: 'INTERVIEW_SCHEDULED', icon: 'radio_button_checked' },
  { label: 'Feedback', status: 'INTERVIEW_FEEDBACK_PENDING', icon: 'radio_button_checked' },
  { label: 'Screening', status: 'HR_SCREENING', icon: 'radio_button_checked' },
  { label: 'LOA Pending', status: 'LOA_PENDING_APPROVAL', icon: 'radio_button_checked' },
  { label: 'LOA Approved', status: 'LOA_APPROVED', icon: 'radio_button_checked' },
  { label: 'LOA Issued', status: 'LOA_ISSUED', icon: 'radio_button_checked' },
  { label: 'LOA Accepted', status: 'LOA_ACCEPTED', icon: 'radio_button_checked' },
  { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
];
```

**Step 2: Verify the statusOrder already includes all LOA sub-statuses**

The existing `statusOrder` array (lines 200-204) already contains `'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED'`. No change needed there. The `active` calculation at line 207-210 (`statusOrder.indexOf(step.status) <= currentIndex`) will now correctly light up each LOA sub-step as the request progresses through the LOA phases.

**Step 3: Consider stepper width**

The stepper grows from 8 to 11 steps. The horizontal stepper UI may overflow on narrow viewports. If the component uses a horizontal Material-style stepper, verify the `overflow-x-auto` is present on the stepper container. If not, add it. Check the stepper render section (should be nearby in the same file, around the return statement). Look for the container div wrapping `stepsWithActive` and ensure it has `overflow-x-auto` or that the stepper already handles overflow gracefully.

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add frontend/src/components/request/RequestHeader.tsx
git commit -m "fix: HR stepper shows LOA sub-statuses (Pending, Approved, Issued, Accepted)"
```

---

## Task 3: Fix selectedCandidateName null display — Frontend

**Objective:** When `selectedCandidateName` is null or undefined in customFields, the HiringWorkflowPanel renders "undefined has been approved for hire." or "null has been approved for hire." Add a fallback.

**Files:**
- Modify: `frontend/src/components/request/HiringWorkflowPanel.tsx:177`

**Step 1: Add null-safe fallback**

Change line 177 from:
```tsx
{request.customFields.selectedCandidateName} has been approved for hire.
```
to:
```tsx
{request.customFields.selectedCandidateName || 'The candidate'} has been approved for hire.
```

**Step 2: Also guard the condition on line 168**

The condition `{request.customFields?.selectedCandidateId && (` will show the entire "Selected Candidate" section even when `selectedCandidateId` is set but `selectedCandidateName` is missing. This is still correct behavior — we want to show the section, just with a fallback label. No change needed on line 168.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add frontend/src/components/request/HiringWorkflowPanel.tsx
git commit -m "fix: guard against null selectedCandidateName in HiringWorkflowPanel"
```

---

## Task 4: Fix selectedCandidateName null — Backend guard

**Objective:** Prevent null/undefined `candidateName` from being persisted into `customFields.selectedCandidateName` at the source. When the approval controller stores the selected candidate, it should use a fallback if `candidateName` is missing.

**Files:**
- Modify: `backend/src/controllers/approval.controller.ts:440`

**Step 1: Add null-safe fallback in the controller**

Change line 440 from:
```typescript
customFields.selectedCandidateName = selectedCandidate.candidateName;
```
to:
```typescript
customFields.selectedCandidateName = selectedCandidate.candidateName || 'Unknown Candidate';
```

**Step 2: Verify build**

Run: `cd backend && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add backend/src/controllers/approval.controller.ts
git commit -m "fix: guard against null candidateName in manager approval flow"
```

---

## Task 5: Final verification — full build + visual check

**Objective:** Confirm all changes compile and work together.

**Step 1: Full backend build**

Run: `cd backend && npm run build`
Expected: Build succeeds.

**Step 2: Full frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Manual verification checklist**

After user starts dev servers, verify:

1. **Stepper check:** Open an HR recruitment ticket in LOA_APPROVED or LOA_ISSUED status. The stepper should show separate "LOA Pending" → "LOA Approved" → "LOA Issued" steps highlighted appropriately.
2. **LOA_ACCEPTED → COMPLETED:** Open an HR ticket in LOA_ACCEPTED status. The "Mark LOA Accepted" action should be available and should transition to COMPLETED.
3. **Candidate name:** Open an HR ticket with a selected candidate. The "Selected Candidate" section should show the candidate name, not "undefined".
4. **Candidate name (edge case):** If a candidate was uploaded without a name, it should show "The candidate has been approved for hire." (frontend fallback) and "Unknown Candidate" (backend fallback).

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Adding 3 LOA steps to stepper | Low — purely visual, no logic change | statusOrder already includes these statuses |
| COMPLETED→ONBOARDING_SUBMITTED transition | Low — reveals existing backend capability | Only shows action that was impossible before |
| LOA_PENDING_APPROVAL→LOA_APPROVED/LOA_REJECTED | Low — syncs frontend with backend truth | Backend already defines these transitions |
| Candidate name fallback | Very low — defensive null guard | No behavior change for normal data |

## Files Changed Summary

| File | Change Type | Lines |
|------|-------------|-------|
| `frontend/src/utils/workflowTransitions.ts` | Modify | 20, 24 |
| `frontend/src/components/request/RequestHeader.tsx` | Modify | 190-198 |
| `frontend/src/components/request/HiringWorkflowPanel.tsx` | Modify | 177 |
| `backend/src/controllers/approval.controller.ts` | Modify | 440 |