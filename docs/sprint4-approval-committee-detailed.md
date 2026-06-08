# Sprint 4 — Approval & Committee: Detailed Implementation Plan

**Parent:** 2026-06-09-credit-audit-implementation-plan.md
**Sprint:** 4 of 8
**Estimate:** 7 dev-days (4 BE + 3 FE)
**Prerequisite:** Sprint 3 complete (UX Quick Wins)
**Sprint 1 status:** COMPLETE (DisbursementTab, REFER_BACK, breadcrumbs, sticky header)
**Sprint 2 status:** COMPLETE (My Work tab, SLA breach widget, duplicate borrower enforcement)
**Sprint 3 status:** COMPLETE (Readiness checklist, tab badges, SLA dots, URL tabs, autosave flash)

---

## 4.1 Committee Finalize UX (HIGH — Finding #13)

### Problem

Committee vote casting doesn't auto-transition. `finalizeDecision()` must be called separately, and the current UI provides only small inline finalize buttons with no visual indicator that all votes have been cast. The finalize decision flow needs:

1. Detection that quorum is met and all present members have voted
2. A prominent CTA showing "Ready to Finalize" with vote tally
3. A comment/reason field for REJECT and DEFER finalization
4. The `isChairOrSecretary` check is broken (has a TODO)
5. Mobile view has no finalize capability at all

### Current State

- **`CommitteeMeetingDetail.tsx`** (318 lines):
  - `handleVote` (line 114): calls `committeeApi.castVote(agendaItemId, { memberId, vote, comment })`
  - `handleFinalize` (line 128): calls `committeeApi.finalizeDecision(agendaItemId, { decision })` — passes `{ decision }` but backend ignores it
  - Finalize UI (lines 298-307): three small inline buttons shown only if `isChairOrSecretary` — no banner, no vote count
  - `isChairOrSecretary` (line 144): incomplete TODO — `/* TODO: && m.userId === currentUser.id */`
  - No "all votes cast" detection logic
  - No comment field on finalize

- **`CommitteeMobileVote.tsx`** (372 lines):
  - Vote-only view with swipe navigation
  - REJECT checks `if (voteChoice === 'REJECT' && !comment.trim())` but no 10-char minimum
  - No finalize decision button — purely for casting individual votes

- **`committee.service.ts`** (backend):
  - `finalizeDecision(agendaItemId, actorId?)` — tallies votes automatically, determines APPROVE/REJECT/DEFER
  - Quorum check before finalization (lines 475-480)
  - Vote tally: majority rules, ties → DEFER
  - The frontend's `{ decision }` param is **ignored** — backend always auto-determines result

### Implementation Steps

#### FE Step 1: Add "All Votes Cast" detection to CommitteeMeetingDetail

**File:** `frontend/pages/credit/CommitteeMeetingDetail.tsx`

Add computed state to detect vote completion per agenda item:

```tsx
// After meeting data is loaded:
const votesForItem = (agendaItemId: string) =>
  meeting?.votes?.filter(v => v.agendaItemId === agendaItemId) ?? [];

const allVotesCast = (agendaItemId: string) => {
  const item = meeting?.agendaItems?.find(i => i.id === agendaItemId);
  if (!item) return false;
  const votes = votesForItem(agendaItemId);
  const presentMembers = meeting?.attendees?.filter(a => a.present) ?? [];
  return votes.length >= presentMembers.length && presentMembers.length >= (meeting?.quorum ?? 0);
};

const voteTally = (agendaItemId: string) => {
  const votes = votesForItem(agendaItemId);
  return {
    approve: votes.filter(v => v.vote === 'APPROVE').length,
    reject: votes.filter(v => v.vote === 'REJECT').length,
    abstain: votes.filter(v => v.vote === 'ABSTAIN').length,
    total: votes.length,
  };
};
```

#### FE Step 2: Replace inline finalize buttons with prominent Finalize banner

**File:** `frontend/pages/credit/CommitteeMeetingDetail.tsx`

Replace the current small inline finalize buttons (lines 298-307) with a prominent CTA banner:

```tsx
{/* Vote completion banner */}
{allVotesCast(item.id) && !item.decisionResult && (
  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <span className="material-symbols-outlined text-blue-600">how_to_vote</span>
      <span className="font-semibold text-blue-900">
        ✓ All {voteTally(item.id).total} votes cast
      </span>
    </div>
    <div className="text-sm text-blue-800 mb-3">
      {voteTally(item.id).approve} Approve · {voteTally(item.id).reject} Reject · {voteTally(item.id).abstain} Abstain
    </div>
    {isChairOrSecretary ? (
      <div className="flex gap-2">
        <button
          onClick={() => handleFinalize(item.id, 'APPROVE')}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
        >
          Finalize as Approved
        </button>
        <button
          onClick={() => setShowFinalizeRejectDialog(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
        >
          Finalize as Rejected
        </button>
        <button
          onClick={() => handleFinalize(item.id, 'DEFER')}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
        >
          Defer
        </button>
      </div>
    ) : (
      <div className="text-sm text-blue-700 italic">
        Awaiting finalization by Chair/Secretary
      </div>
    )}
  </div>
)}

{/* Vote progress (when not all cast yet) */}
{!allVotesCast(item.id) && !item.decisionResult && (
  <div className="mt-2 text-xs text-text-secondary">
    {votesForItem(item.id).length} / {meeting?.attendees?.filter(a => a.present).length ?? '?'} votes cast
    {meeting ? ` (quorum: ${meeting.quorum})` : ''}
  </div>
)}
```

#### FE Step 3: Add finalize reject dialog with mandatory comment

**File:** `frontend/pages/credit/CommitteeMeetingDetail.tsx`

Add a `showFinalizeRejectDialog` state and a modal/dialog for REJECT finalization that requires a comment:

```tsx
const [showFinalizeRejectDialog, setShowFinalizeRejectDialog] = useState(false);
const [finalizeRejectComment, setFinalizeRejectComment] = useState('');
const [finalizeRejectReason, setFinalizeRejectReason] = useState('');

const handleFinalize = async (agendaItemId: string, decision: 'APPROVE' | 'REJECT' | 'DEFER', comment?: string) => {
  setFinalizeLoading(true);
  try {
    await committeeApi.finalizeDecision(agendaItemId, { decision, comment: comment ?? undefined });
    toast.success('Decision finalized');
    await fetchMeeting(); // refresh
  } catch (err) {
    toast.error('Failed to finalize decision');
  } finally {
    setFinalizeLoading(false);
  }
};
```

The reject dialog enforces `comment.trim().length >= 10`.

#### FE Step 4: Fix isChairOrSecretary check

**File:** `frontend/pages/credit/CommitteeMeetingDetail.tsx`

Replace the broken TODO check with actual user comparison:

```tsx
// BEFORE (line 144, has TODO comment):
const isChairOrSecretary = meeting?.attendees?.some(
  m => m.role === 'CHAIR' || m.role === 'SECRETARY' /* TODO: && m.userId === currentUser.id */
);

// AFTER:
const isChairOrSecretary = meeting?.attendees?.some(
  m => (m.role === 'CHAIR' || m.role === 'SECRETARY') && m.userId === user?.id
) ?? false;
```

Requires `user` from `AuthContext`.

#### FE Step 5: Add finalize capability to CommitteeMobileVote

**File:** `frontend/pages/credit/CommitteeMobileVote.tsx`

Add a "Finalize" action bar that appears when all votes are cast:

```tsx
const allVotesCast = useMemo(() => {
  const present = meeting?.attendees?.filter(a => a.present) ?? [];
  const votes = meeting?.votes?.filter(v => v.agendaItemId === currentItem?.id) ?? [];
  return votes.length >= present.length && present.length >= (meeting?.quorum ?? 0);
}, [meeting, currentItem]);

// In render, after the vote/action bar:
{allVotesCast && isChairOrSecretary && (
  <div className="sticky bottom-0 bg-white border-t p-4">
    <p className="text-sm font-medium text-center mb-2">All votes cast · Ready to finalize</p>
    <div className="flex gap-2">
      <button onClick={() => handleFinalize('APPROVE')} className="flex-1 ...">Finalize Approved</button>
      <button onClick={() => setShowRejectDialog(true)} className="flex-1 ...">Finalize Rejected</button>
      <button onClick={() => handleFinalize('DEFER')} className="...">Defer</button>
    </div>
  </div>
)}
```

#### BE Step 6: Update finalizeDecision to accept optional comment

**File:** `backend/src/credit/services/committee.service.ts`

Update `finalizeDecision` signature to accept an optional comment parameter for rejection/deferral:

```ts
async finalizeDecision(agendaItemId: string, actorId: number, comment?: string): Promise<CommitteeDecision> {
  // ... existing quorum and tally logic ...
  
  // After transition:
  if (comment) {
    await AuditChainService.appendEvent(appId, 'COMMITTEE_FINALIZE', actorId, comment, null, null);
  }
}
```

**File:** `backend/src/credit/controllers/committee.controller.ts`

Update the finalize handler to pass comment from `req.body`:

```ts
const { comment } = req.body;
const decision = await committeeService.finalizeDecision(agendaItemId, actorId, comment);
```

**File:** `backend/src/credit/validators/committee.validator.ts`

Add optional `comment` field:

```ts
finalizeDecisionSchema: z.object({
  comment: z.string().max(5000).optional(),
})
```

### Pitfalls

- `meeting.attendees` may have `present` as a boolean — confirm the field name and default (some attendees may be absent)
- `meeting.votes` is an array — verify it's included in the query (check Prisma include for the meeting detail endpoint)
- `isChairOrSecretary` must be based on `userId` comparison, not just role existence — multiple attendees may have CHAIR/SECRETARY role
- The frontend currently passes `{ decision }` to `finalizeDecision()` but backend ignores it — keep passing it for future use but note that backend tally auto-determines the result. The finalizer's role is to *confirm and record* the auto-determined result, not override it.
- Mobile finalize needs the same `isChairOrSecretary` check based on `user.id`

### Verification

1. Open committee meeting with 5 members, 3 vote APPROVE, 1 REJECT, 1 ABSTAIN → banner shows "All 5 votes cast" with tally
2. As Chair, click "Finalize as Approved" → meeting finalized, app state transitions
3. As non-Chair member → see "Awaiting finalization by Chair/Secretary" message
4. Click "Finalize as Rejected" → dialog opens requiring comment (min 10 chars) → finalize completes
5. On mobile viewport (width < 768), finalize bar appears at bottom when all votes cast
6. Navigate to `/credit/m/committee/:meetingId` on mobile → finalize buttons work

---

## 4.2 Approval Auto-Routing (HIGH — Finding #12)

### Problem

Approval routing is passive. After one approver acts, the next approver in the chain has no automatic notification or pending action. The `ApprovalMatrix` lookup exists but there's no `autoRouteNextApprover()` function.

### Current State

- **`approvalAction.service.ts`** (362 lines):
  - `submitApprovalAction` method records a `CreditDecision` and checks if `approvalsCollected >= requiredApproverCount`
  - When all approvals collected, transitions app state (e.g., UNDERWRITING → CREDIT_ASSESSMENT → COMMITTEE_REVIEW → APPROVED)
  - But at each level transition, only state changes — no auto-creation of the next approver's decision record or notification

- **`approvalMatrix.service.ts`** (275 lines):
  - `lookupApprovalAuthority(exposure, riskRating, branchId?)` returns `{ authorityLevel, requiredApproverCount, matrixId, matrixName }`
  - Already works correctly with branch-specific precedence

- **No notification system** triggers when a new approver needs to act

### Implementation Steps

#### BE Step 1: Add `autoRouteNextApprover` function

**File:** `backend/src/credit/services/approvalAction.service.ts`

Add a new function that runs after each approval action:

```ts
async autoRouteNextApprover(applicationId: number, currentAuthorityLevel: number, matrixId: number, requiredApproverCount: number, approvalsCollected: number): Promise<void> {
  // If all required approvals are collected, no routing needed — state will advance
  if (approvalsCollected >= requiredApproverCount) return;

  // Determine next authority level
  const nextLevel = currentAuthorityLevel + 1;
  const authorityNames: Record<number, string> = {
    1: 'CREDIT_RM',
    2: 'CREDIT_MANAGER',
    3: 'SENIOR_CREDIT_OFFICER',
    4: 'CREDIT_COMMITTEE',
    5: 'BOARD_RISK_COMMITTEE',
  };

  // Find users with the next authority level who can approve
  const nextApprovers = await prisma.user.findMany({
    where: {
      role: { name: { in: getRoleNamesForAuthorityLevel(nextLevel) } },
      isActive: true,
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (nextApprovers.length === 0) {
    // Fallback: route to credit admin or RM's manager
    logger.warn(`No approvers found for authority level ${nextLevel}, falling back to credit admin`);
    const creditAdmins = await prisma.user.findMany({
      where: { role: { name: 'CREDIT_ADMIN' }, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (creditAdmins.length === 0) return; // Cannot route — manual follow-up required
    await this.notifyApprovers(applicationId, creditAdmins, nextLevel);
    return;
  }

  // Create pending CreditDecision record(s) for next-level approvers
  // (The first approver in the next level will see this as a pending action)
  await this.notifyApprovers(applicationId, nextApprovers, nextLevel);
}
```

#### BE Step 2: Wire autoRouteNextApprover into submitApprovalAction

**File:** `backend/src/credit/services/approvalAction.service.ts`

In `submitApprovalAction`, after recording the approval decision and BEFORE state transition:

```ts
// After line where approvalsCollected is computed:
if (decision === 'APPROVE') {
  await this.autoRouteNextApprover(
    application.id,
    authorityLevel,
    matrixResult.matrixId,
    requiredApproverCount,
    approvalsCollected,
  );
}
```

#### BE Step 3: Add notification for next approver

**File:** `backend/src/credit/services/approvalAction.service.ts`

```ts
private async notifyApprovers(applicationId: number, approvers: { id: number; email: string; firstName: string; lastName: string }[], level: number): Promise<void> {
  const levelNames: Record<number, string> = {
    1: 'Relationship Manager',
    2: 'Credit Manager',
    3: 'Senior Credit Officer',
    4: 'Credit Committee',
    5: 'Board Risk Committee',
  };

  // Create notification for each next-level approver
  for (const approver of approvers) {
    await notificationService.send({
      userId: approver.id,
      type: 'APPROVAL_ACTION_REQUIRED',
      subject: `Approval Required — Level ${level} (${levelNames[level]})`,
      body: `Application #${applicationId} requires your approval at the ${levelNames[level]} level.`,
      channel: 'IN_APP', // Also send email if configured
      entity: 'CREDIT_APPLICATION',
      entityId: applicationId,
    });
  }

  // Also publish SSE event for My Work tab
  await sseService.publish(applicationId, 'APPROVAL_ROUTED', {
    authorityLevel: level,
    approverCount: approvers.length,
  });
}
```

#### BE Step 4: Add role-to-authority-level mapping

**File:** `backend/src/credit/services/approvalAction.service.ts` (or a shared utility)

```ts
function getRoleNamesForAuthorityLevel(level: number): string[] {
  const mapping: Record<number, string[]> = {
    1: ['CREDIT_RM'],           // RM approval
    2: ['CREDIT_MANAGER'],      // Manager approval
    3: ['SENIOR_CREDIT_OFFICER'], // Senior officer
    4: ['CREDIT_COMMITTEE'],    // Committee (handled differently)
    5: ['BOARD_RISK_COMMITTEE'], // Board level (rare)
  };
  return mapping[level] ?? ['CREDIT_ADMIN']; // Fallback
}
```

### Pitfalls

- Committee (level 4) approval is handled through `CommitteeMeeting` and `CommitteeMeetingVote` — not through `CreditDecision`. Auto-routing to level 4 should create a `CommitteeMeeting` instead of individual `CreditDecision` records.
- `user.isActive` field may not exist or may be named differently — verify with the Prisma schema.
- Notification deduplication: if `autoRouteNextApprover` is called multiple times (e.g., on page reload), don't send duplicate notifications. Add a check: `if pending CreditDecision exists for this user+app, skip notification`.
- The fallback to `CREDIT_ADMIN` when no approvers exist at a level must be logged and potentially alerted to admins.
- SOD check: the next approver should NOT be the same user as the current approver. Add `AND: { id: { not: currentApproverId } }` to the query.

### Verification

1. Submit an application for approval → RM (level 1) approves → auto-notification sent to Credit Manager (level 2)
2. Credit Manager approves → auto-notification sent to Senior Credit Officer (level 3)
3. SCO approves → if matrix requires committee, Committee Meeting is created (not individual decision)
4. Application with no matching matrix entry → notification falls back to CREDIT_ADMIN
5. Verify no duplicate notifications on repeated calls

---

## 4.3 Mandatory Comments on Rejection/Conditional Approval (MEDIUM)

### Problem

Approval comments are not mandatory for rejections or conditional approvals. The Zod validator has `comment: z.string().max(5000).optional()` with no conditional requirement. The frontend checks for truthiness but no minimum length.

### Current State

- **`approval.validator.ts`** (65 lines):
  - `submitApprovalActionSchema`: `decision: z.enum(['APPROVE', 'REJECT', 'RETURN', 'ESCALATE'])` — **CONDITIONAL is missing**
  - `comment: z.string().max(5000).optional()` — no `.refine()` for REJECT/CONDITIONAL
  - `rejectionReasonCode` and `conditions` are NOT in the Zod schema (passed from controller but unvalidated)

- **`ApprovalChainPanel.tsx`** (451 lines):
  - `commentRequired = requiredCount >= 3` — only checks tier count, not decision type
  - REJECT requires `rejectionReasonCode` (lines 112-115)
  - RETURN requires comment (lines 117-120)
  - CONDITIONAL requires at least 1 condition (lines 122-125)
  - **No minimum 10-char enforcement for REJECT/CONDITIONAL comment text**

- **`MobileApprovalInbox.tsx`** (350 lines):
  - REJECT checks `!comment.trim()` — no minimum length

- **`CommitteeMobileVote.tsx`** (372 lines):
  - REJECT checks `if (voteChoice === 'REJECT' && !comment.trim())` — no minimum length

### Implementation Steps

#### BE Step 1: Update Zod validator

**File:** `backend/src/credit/validators/approval.validator.ts`

```ts
export const submitApprovalActionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN', 'ESCALATE', 'CONDITIONAL']),
  comment: z.string().max(5000).optional(),
  isCommitteeVote: z.boolean().default(false),
  rejectionReasonCode: z.string().optional(),
  conditions: z.array(z.object({
    description: z.string().min(1),
    dueDate: z.string().optional(),
    type: z.enum(['PRE_DISBURSEMENT', 'POST_DISBURSEMENT']).default('PRE_DISBURSEMENT'),
  })).optional(),
}).superRefine((data, ctx) => {
  // Mandatory comment for REJECT or CONDITIONAL decisions
  if ((data.decision === 'REJECT' || data.decision === 'CONDITIONAL') && (!data.comment || data.comment.trim().length < 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Comment is required (minimum 10 characters) for REJECT and CONDITIONAL decisions',
      path: ['comment'],
    });
  }
  // Mandatory rejectionReasonCode for REJECT
  if (data.decision === 'REJECT' && !data.rejectionReasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Rejection reason code is required for REJECT decisions',
      path: ['rejectionReasonCode'],
    });
  }
  // Mandatory conditions for CONDITIONAL
  if (data.decision === 'CONDITIONAL' && (!data.conditions || data.conditions.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one condition is required for CONDITIONAL decisions',
      path: ['conditions'],
    });
  }
});
```

#### BE Step 2: Update committee validator

**File:** `backend/src/credit/validators/committee.validator.ts`

Add minimum comment length for REJECT votes:

```ts
castVoteSchema: z.object({
  vote: z.enum(['APPROVE', 'REJECT', 'ABSTAIN']),
  comment: z.string().max(5000).optional(),
}).superRefine((data, ctx) => {
  if (data.vote === 'REJECT' && (!data.comment || data.comment.trim().length < 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Comment is required (minimum 10 characters) for REJECT votes',
      path: ['comment'],
    });
  }
}),
```

#### FE Step 3: Update ApprovalChainPanel comment validation

**File:** `frontend/src/components/credit/ApprovalChainPanel.tsx`

Replace the current `commentRequired` logic with decision-aware validation:

```tsx
// BEFORE:
const commentRequired = requiredCount >= 3;

// AFTER:
const commentRequired = requiredCount >= 3 || 
  selectedDecision === 'REJECT' || 
  selectedDecision === 'CONDITIONAL';
const commentMinLength = (selectedDecision === 'REJECT' || selectedDecision === 'CONDITIONAL') ? 10 : 0;

// In the submit handler, add length check:
if (commentMinLength > 0 && (!comment || comment.trim().length < commentMinLength)) {
  setCommentError(`Comment must be at least ${commentMinLength} characters for ${selectedDecision} decisions`);
  return;
}
```

Update the textarea UI to show the minimum length indicator:

```tsx
<textarea
  value={comment}
  onChange={e => setComment(e.target.value)}
  placeholder={commentRequired ? `Comment required (${commentMinLength || 1}+ characters)` : 'Optional comment...'}
  className={cn(
    'w-full border rounded-md p-2 text-sm',
    commentError ? 'border-red-500' : 'border-gray-300',
  )}
  rows={3}
/>
{commentError && <p className="text-xs text-red-500 mt-1">{commentError}</p>}
{commentMinLength > 0 && comment && (
  <p className={cn(
    'text-xs mt-1',
    comment.trim().length >= commentMinLength ? 'text-green-600' : 'text-amber-500',
  )}>
    {comment.trim().length}/{commentMinLength} characters minimum
  </p>
)}
```

#### FE Step 4: Update MobileApprovalInbox validation

**File:** `frontend/pages/credit/MobileApprovalInbox.tsx`

Add 10-char minimum to the REJECT comment check:

```tsx
// BEFORE:
if (voteChoice === 'REJECT' && !comment.trim()) {
  setCommentError('Comment is required for rejection');
  return;
}

// AFTER:
if ((voteChoice === 'REJECT' || voteChoice === 'CONDITIONAL') && comment.trim().length < 10) {
  setCommentError(`Comment must be at least 10 characters for ${voteChoice} decisions`);
  return;
}
```

Update the comment textarea label:

```tsx
<label className="text-sm font-medium">
  Comment (required for REJECT — minimum 10 characters)
</label>
```

#### FE Step 5: Update CommitteeMobileVote validation

**File:** `frontend/pages/credit/CommitteeMobileVote.tsx`

Same 10-char minimum for REJECT votes:

```tsx
// BEFORE:
if (voteChoice === 'REJECT' && !comment.trim()) {

// AFTER:
if (voteChoice === 'REJECT' && comment.trim().length < 10) {
  setCommentError('Comment must be at least 10 characters for rejection');
  return;
}
```

### Pitfalls

- **CONDITIONAL is not in the Zod enum** — the service accepts it but the validator rejects it. Adding it to the enum is required.
- **`rejectionReasonCode` and `conditions` are not validated at all** by the Zod schema today — they're destructured in the controller from `req.body` but never validated. Adding them to the schema fixes a data integrity gap.
- **Frontend comment validation must match backend** — if the backend requires 10 chars, the frontend must enforce the same minimum. Off-by-one discrepancies cause frustrating UX.
- **CONDITIONAL approval flow** — the `ApprovalChainPanel` already checks for at least 1 condition (lines 122-125). The new Zod schema mirrors this on the backend.
- **Error message specificity** — Zod `.superRefine()` adds issues to specific paths, which means the API error response will include field-level errors that the frontend can display inline.

### Verification

1. Submit REJECT decision with empty comment → API returns 400 with "Comment is required (minimum 10 characters)"
2. Submit CONDITIONAL with 8-char comment → API returns 400 with "Comment is required (minimum 10 characters)"
3. Submit CONDITIONAL with 10+ char comment and 1 condition → API accepts (200)
4. Submit REJECT without `rejectionReasonCode` → API returns 400 with "Rejection reason code is required"
5. On mobile, REJECT vote with 5-char comment → inline error "Comment must be at least 10 characters"
6. Committee REJECT vote with 10+ char comment → accepted

---

## 4.4 Mobile Auto-Redirect (MEDIUM)

### Problem

Mobile users navigating to `/credit/committee/:meetingId` or `/credit/approvals` get the desktop view. Mobile-optimized views exist at `/credit/m/committee/:meetingId` and `/credit/m/approvals`, but there's no automatic redirect.

### Current State

- **`App.tsx`** has routes for both desktop and mobile:
  - `/credit/committee/:meetingId` → `CommitteeMeetingDetail`
  - `/credit/m/committee/:meetingId` → `CommitteeMobileVote`
  - `/credit/approvals` → `MyApprovals`
  - `/credit/m/approvals` → `MobileApprovalInbox`
- **No viewport detection** exists anywhere in the app
- **No `useIsMobile` hook** exists

### Implementation Steps

#### FE Step 1: Create `useIsMobile` hook

**New file:** `frontend/src/hooks/useIsMobile.ts`

```ts
import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
```

#### FE Step 2: Add redirect in CommitteeMeetingDetail

**File:** `frontend/pages/credit/CommitteeMeetingDetail.tsx`

```tsx
import { useIsMobile } from '../../src/hooks/useIsMobile';

// Inside component:
const isMobile = useIsMobile();

useEffect(() => {
  if (isMobile) {
    navigate(`/credit/m/committee/${meetingId}`, { replace: true });
  }
}, [isMobile, meetingId, navigate]);
```

#### FE Step 3: Add redirect in MyApprovals

**File:** `frontend/pages/MyApprovals.tsx`

```tsx
import { useIsMobile } from '../src/hooks/useIsMobile';

// Inside component:
const isMobile = useIsMobile();

useEffect(() => {
  if (isMobile) {
    navigate('/credit/m/approvals', { replace: true });
  }
}, [isMobile, navigate]);
```

### Pitfalls

- **`navigate` with `replace: true`** — prevents the desktop URL from remaining in browser history. If the user rotates their phone back to landscape, they'll need to manually navigate back to the desktop view.
- **Server-side rendering consideration** — `useIsMobile` uses `typeof window !== 'undefined'` guard for SSR compatibility, even though this app is SPA.
- **Resize listener** — the hook listens to `resize` events. This is important for tablet rotation. The redirect should only fire on initial mount or when crossing the 768px threshold, not on every resize. Consider debouncing or only redirecting on mount.
- **Avoid redirect loops** — if a mobile user navigates to `/credit/m/approvals`, the redirect should NOT fire. The hook must only be used in desktop components, not in the mobile components.
- **Accessibility consideration** — some users may prefer the desktop view even on mobile. Consider adding a "View desktop version" link in the mobile views instead of forcing redirect. However, the audit finding specifically calls for auto-redirect, so implement as specified with an escape hatch.

### Verification

1. Open `/credit/approvals` on viewport width < 768px → page redirects to `/credit/m/approvals`
2. Open `/credit/committee/123` on viewport width < 768px → page redirects to `/credit/m/committee/123`
3. Open `/credit/approvals` on width >= 768px → stays on desktop MyApprovals
4. Resize browser from 1024px to 600px → redirect fires
5. Mobile pages (`/credit/m/*`) do NOT redirect (no redirect hook in those components)

---

## Execution Order

| Day | Task | Files |
|-----|------|-------|
| 1 | BE: Update Zod validators (approval + committee) with comment requirement + CONDITIONAL enum | `approval.validator.ts`, `committee.validator.ts` |
| 1 | BE: Update `finalizeDecision` to accept optional comment | `committee.service.ts`, `committee.controller.ts` |
| 2 | BE: Create `autoRouteNextApprover()` + notification logic | `approvalAction.service.ts` |
| 2 | BE: Wire autoRoute into `submitApprovalAction` | `approvalAction.service.ts` |
| 3 | FE: Create `useIsMobile` hook + mobile redirects | `useIsMobile.ts`, `CommitteeMeetingDetail.tsx`, `MyApprovals.tsx` |
| 3 | FE: Update `ApprovalChainPanel` comment validation (10-char min, CONDITIONAL) | `ApprovalChainPanel.tsx` |
| 4 | FE: Update `CommitteeMeetingDetail` finalize UX (vote detection, CTA banner, dialog) | `CommitteeMeetingDetail.tsx` |
| 4 | FE: Update `MobileApprovalInbox` + `CommitteeMobileVote` comment validation | `MobileApprovalInbox.tsx`, `CommitteeMobileVote.tsx` |
| 5 | FE: Add finalize capability to `CommitteeMobileVote` | `CommitteeMobileVote.tsx` |
| 5 | QA: End-to-end testing of all 4 features | — |

---

## Dependencies

- Sprint 3 complete (existing approval chain works, committee meetings functional)
- `ApprovalMatrix` data exists (seeded or live matrix entries for lookup to work)
- `notificationService` infrastructure exists (SSE + in-app notifications from Sprint 2)
- Meeting data includes `attendees` with `present` boolean and `role` field (verify schema)
- User role names in DB match the mapping in `getRoleNamesForAuthorityLevel()` (verify with seed data)

## Key Decisions

1. **Finalize UX is informational, not override** — the backend tally auto-determines APPROVE/REJECT/DEFER. The "Finalize as Approved/Rejected" buttons confirm and record the result, not override it. The button labels reflect the predicted tally outcome, but the actual result comes from the backend tally.
2. **Auto-routing creates notifications, not CreditDecision placeholders** — we notify the next approver but don't pre-create a `CreditDecision` record. The next approver's action creates the decision when they act. This avoids phantom pending records.
3. **Mandatory comment is 10 chars minimum** — not a high bar, but prevents "ok" or "." as a rejection reason. The committee REJECT minimum also applies.
4. **Mobile redirect uses `replace: true`** — prevents the desktop URL staying in history. Users can always navigate back via the app's nav bar.
5. **`useIsMobile` hook is reusable** — other components can import it for responsive behavior without duplicating window width logic.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Approval matrix gaps (no rule for amount range) | Auto-route falls back to CREDIT_ADMIN and logs a warning |
| Multiple committee members finalize simultaneously | Backend `finalizeDecision` uses DB transaction with row-level lock — only one can finalize |
| Condition Zod validation may break existing CONDITIONAL approvals | Add `CONDITIONAL` to enum with migration note; existing data with "CONDITIONAL" string works since Prisma stores strings |
| Resize redirect fires too often on tablets | `useIsMobile` only redirects on mount, not on every resize — add a `hasRedirected` ref guard |
| `notificationService.send()` signature may differ | Verify the actual notification service interface before implementing — it may use different field names (see memory: "subject, body, channel, NOT title/message") |