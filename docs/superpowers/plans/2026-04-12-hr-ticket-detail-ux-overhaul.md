# HR Ticket Detail UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 12+ UX issues identified in the HR Ticket Detail audit — role-aware views, internal notes, SLA visibility, workflow state machine, and dead-button fixes — to make the system production-ready for Staff, Hiring Managers, and Agents.

**Architecture:** Decompose the monolithic 2443-line `RequestDetail.tsx` into role-aware sub-components. Add backend workflow validation. Surface existing SLA data. Add internal notes toggle. Fix dead UI elements.

**Tech Stack:** React 19, TypeScript, TailwindCSS, Express, Prisma, PostgreSQL, Jest

---

## Phase Overview

| Phase | Name | Issues Resolved | Estimated Tasks |
|-------|------|----------------|-----------------|
| 1 | Quick Wins — Dead Buttons & Stepper Fix | #1 (stepper), #10 (dead buttons) | 3 tasks |
| 2 | Internal Notes System | #2 (no internal notes), #7 (audit trail) | 4 tasks |
| 3 | Role-Aware Action Banner ("What Do I Do Next?") | #4 (no guidance), #9 (decorative stepper) | 3 tasks |
| 4 | Status Transition Validation | #6 (invalid transitions) | 3 tasks |
| 5 | SLA Visibility | #5 (SLA absent from UI) | 2 tasks |
| 6 | Custom Fields Display & Hiring Manager Identity | #3 (requester=manager), #8 (raw JSON fields) | 3 tasks |
| 7 | Role-Based View Decomposition | Cross-role UX, component decomposition | 4 tasks |
| 8 | Agent Tooling — Assignment & Audit Log | Agent issues (A1, A2, A5) | 3 tasks |

---

## File Structure

### New Files to Create
```
frontend/src/components/request-detail/
  ActionBanner.tsx              — Role-aware "next action" callout
  StatusStepper.tsx             — Extracted stepper with timestamps
  InternalNoteToggle.tsx        — Internal/public comment toggle
  SLAIndicator.tsx              — SLA countdown badge
  CustomFieldsPanel.tsx         — Structured custom fields display
  AgentActions.tsx              — Agent-specific action sidebar
  HiringManagerActions.tsx      — Hiring manager action sidebar
  StaffActions.tsx              — Staff read-only sidebar
  CommunicationTimeline.tsx     — Extracted comment/activity timeline
  AuditLogTab.tsx               — Filterable audit trail for agents
  AssignToDropdown.tsx          — Agent assignment dropdown

frontend/src/utils/
  workflowTransitions.ts        — Valid status transitions map
  roleDetection.ts              — Determine user's role context for a request

backend/src/utils/
  workflowTransitions.ts        — Server-side transition validation
```

### Files to Modify
```
frontend/pages/RequestDetail.tsx           — Decompose into sub-components
frontend/src/services/request.service.ts   — Add isInternal param, SLA fetch
frontend/types.ts                          — Add SLA types, transition types
frontend/constants.tsx                     — Add transition map export
backend/src/controllers/request.controller.ts — Add transition validation, SLA in response
backend/src/routes/request.routes.ts       — Add agent list endpoint
backend/src/controllers/user.controller.ts — Add getAgents endpoint
```

---

## Phase 1: Quick Wins — Dead Buttons & Stepper Fix

### Task 1: Conditionally Hide Hiring Stepper for Non-HR Tickets

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:599-665` (getStatusSteps function)
- Modify: `frontend/pages/RequestDetail.tsx:707-732` (stepper render)

The `getStatusSteps` function already has a `isHiringWorkflow` check at line 600 and returns a simpler 4-step stepper for non-HR tickets. However, the 9-step hiring stepper still renders for ALL HR tickets, even non-hiring ones like leave requests. The fix: only show the hiring stepper when the request's `requestType` or `customFields` indicate a hiring workflow.

- [ ] **Step 1: Update the stepper condition to check for hiring-specific request types**

In `frontend/pages/RequestDetail.tsx`, find the `getStatusSteps` function at line 599:

```typescript
const getStatusSteps = (currentStatus: string) => {
    const isHiringWorkflow = request?.serviceDesk?.code === 'HR';
```

Replace with:

```typescript
const getStatusSteps = (currentStatus: string) => {
    // Only show hiring stepper for actual hiring workflow statuses
    const hiringStatuses = [
      'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
      'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
      'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW',
      'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED',
      'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL',
      'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1',
      'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION',
      'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE',
      'ONBOARDING_MONTH_3_MILESTONE', 'ONBOARDING_COMPLETED'
    ];
    const isHiringWorkflow = request?.serviceDesk?.code === 'HR' && hiringStatuses.includes(currentStatus);
```

- [ ] **Step 2: Verify the stepper renders correctly**

Run the dev server: `cd frontend && npm run dev`

Test cases:
1. Open an HR hiring request (status PENDING_CEO_APPROVAL or later) → should see 9-step hiring stepper
2. Open an HR non-hiring request (status SUBMITTED, IN_REVIEW, etc.) → should see simple 4-step stepper
3. Open an IT ticket → should see simple 4-step stepper

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "fix: show hiring stepper only for actual hiring workflow tickets

Non-hiring HR tickets (leave, address change) now see simplified 4-step stepper
instead of the confusing 9-step hiring workflow."
```

---

### Task 2: Wire Up Dead Action Buttons (Attach, Share, Print)

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1773-1785` (common action buttons)
- Modify: `frontend/src/services/request.service.ts` (already has uploadAttachment)

- [ ] **Step 1: Replace non-functional buttons with working implementations**

In `frontend/pages/RequestDetail.tsx`, find lines 1773-1785 (the three dead buttons). Replace:

```tsx
              {/* Common Actions */}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">attach_file</span>
                Add Attachment
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">share</span>
                Share Request
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">print</span>
                Print Details
              </button>
```

With:

```tsx
              {/* Common Actions */}
              <label className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-lg">attach_file</span>
                Add Attachment
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !id) return;
                    try {
                      await requestService.uploadAttachment(id, file);
                      await fetchRequestData();
                      alert('Attachment uploaded successfully');
                    } catch (err: any) {
                      alert(err.message || 'Failed to upload attachment');
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url).then(() => {
                    alert('Request link copied to clipboard');
                  });
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-lg">share</span>
                Share Request
              </button>
              <button
                onClick={() => window.print()}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-lg">print</span>
                Print Details
              </button>
```

- [ ] **Step 2: Test all three buttons**

1. Click "Add Attachment" → file picker opens, file uploads, page refreshes
2. Click "Share Request" → clipboard has the URL, alert confirms
3. Click "Print Details" → browser print dialog opens

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "fix: wire up attachment, share, and print action buttons

Attachment uses existing requestService.uploadAttachment.
Share copies URL to clipboard. Print opens browser print dialog."
```

---

### Task 3: Show Assigned Agent Name Prominently in Sidebar

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1476-1525` (sidebar details)

- [ ] **Step 1: Add assigned agent display after status in sidebar**

In `frontend/pages/RequestDetail.tsx`, find the sidebar `<dl>` section. After the Status `<div>` block (around line 1490), add:

```tsx
              <div>
                <dt className="text-[#5e718d] mb-1">Assigned To</dt>
                <dd>
                  {request.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-[#0052cc]/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm text-[#0052cc]">person</span>
                      </div>
                      <span className="font-semibold text-[#101418]">
                        {request.assignedTo.firstName} {request.assignedTo.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-orange-600 font-semibold text-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      Unassigned
                    </span>
                  )}
                </dd>
              </div>
```

- [ ] **Step 2: Verify display**

1. Open an assigned ticket → shows agent name with avatar
2. Open an unassigned ticket → shows orange "Unassigned" warning

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: show assigned agent name in sidebar with unassigned warning"
```

---

## Phase 2: Internal Notes System

### Task 4: Add Internal Note Toggle to Comment Form

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1439-1470` (comment form)
- Modify: `frontend/pages/RequestDetail.tsx:196-213` (handleSubmitComment)

- [ ] **Step 1: Add isInternalNote state variable**

In `frontend/pages/RequestDetail.tsx`, after line 76 (`const [submitting, setSubmitting] = useState(false);`), add:

```typescript
  const [isInternalNote, setIsInternalNote] = useState(false);
```

- [ ] **Step 2: Update handleSubmitComment to pass isInternal flag**

Replace line 202:

```typescript
      const newActivity = await requestService.addActivity(id, comment, false);
```

With:

```typescript
      const newActivity = await requestService.addActivity(id, comment, isInternalNote);
```

And after `setComment('');` on line 206, add:

```typescript
      setIsInternalNote(false);
```

- [ ] **Step 3: Add internal note toggle checkbox to the comment form UI**

In the comment form (line 1439-1470), after the `<textarea>` closing tag and before the button `<div>`, add:

```tsx
                {(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) && (
                  <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="material-symbols-outlined text-sm text-amber-600">lock</span>
                    <span className="text-sm font-semibold text-amber-700">Internal note (not visible to requester)</span>
                  </label>
                )}
```

- [ ] **Step 4: Verify**

1. Login as agent → comment form shows "Internal note" checkbox
2. Login as regular user → checkbox is hidden
3. Post an internal note as agent → activity is saved with isInternal=true

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: add internal note toggle for agents in comment form

Agents/admins can check 'Internal note' to post comments not visible to requesters.
Uses existing isInternal field on RequestActivity."
```

---

### Task 5: Filter Internal Notes from Non-Agent Views

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1387-1436` (activity rendering)

- [ ] **Step 1: Filter activities based on user role**

In `frontend/pages/RequestDetail.tsx`, find line 1393 where activities are mapped. Replace:

```tsx
                activities.map((activity, idx) => {
```

With:

```tsx
                activities
                  .filter(activity => {
                    // Hide internal notes from non-agent/admin users
                    if (activity.isInternal && !user?.roles?.includes('AGENT') && !user?.roles?.includes('ADMIN')) {
                      return false;
                    }
                    return true;
                  })
                  .map((activity, idx) => {
```

- [ ] **Step 2: Add visual indicator for internal notes**

Inside the activity bubble (after the message `<p>` tag around line 1424), add before the `isSystemGenerated` check:

```tsx
                          {activity.isInternal && (
                            <div className="flex items-center gap-1 mt-2 text-amber-600">
                              <span className="material-symbols-outlined text-xs">lock</span>
                              <span className="text-[10px] font-bold uppercase">Internal Note</span>
                            </div>
                          )}
```

- [ ] **Step 3: Style internal note bubbles differently**

In the activity bubble className (line 1409-1412), update the condition:

Replace:

```tsx
                          className={`p-5 rounded-2xl shadow-sm border ${isUser
                            ? 'bg-blue-50 border-blue-100 rounded-tr-none'
                            : 'bg-white border-gray-100 rounded-tl-none'
                            }`}
```

With:

```tsx
                          className={`p-5 rounded-2xl shadow-sm border ${
                            activity.isInternal
                              ? 'bg-amber-50 border-amber-200 border-dashed rounded-tl-none'
                              : isUser
                                ? 'bg-blue-50 border-blue-100 rounded-tr-none'
                                : 'bg-white border-gray-100 rounded-tl-none'
                            }`}
```

- [ ] **Step 4: Verify**

1. Agent posts internal note → amber dashed border, lock icon, "Internal Note" badge
2. Regular user views same ticket → internal note is hidden
3. Another agent views ticket → sees the internal note

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: filter internal notes from non-agent views and style distinctly

Internal notes show amber dashed border with lock icon for agents.
Non-agent users cannot see internal notes at all."
```

---

### Task 6: Add Communication Tab Filtering (All / Comments / System / Internal)

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1380-1390` (communication section header)

- [ ] **Step 1: Add filter state**

After the `isInternalNote` state (added in Task 4), add:

```typescript
  const [activityFilter, setActivityFilter] = useState<'all' | 'comments' | 'system' | 'internal'>('all');
```

- [ ] **Step 2: Add filter tabs to communication section header**

Replace lines 1381-1385:

```tsx
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="material-symbols-outlined text-[#0052cc]">encrypted</span>
              <h3 className="font-bold text-xl">Secure Communication</h3>
            </div>
```

With:

```tsx
            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[#0052cc]">encrypted</span>
                <h3 className="font-bold text-xl">Secure Communication</h3>
              </div>
              <div className="flex gap-2">
                {(['all', 'comments', 'system'] as const).concat(
                  (user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) ? ['internal' as const] : []
                ).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setActivityFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      activityFilter === filter
                        ? 'bg-[#0052cc] text-white'
                        : 'bg-gray-100 text-[#5e718d] hover:bg-gray-200'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'comments' ? 'Comments' : filter === 'system' ? 'Activity Log' : 'Internal'}
                  </button>
                ))}
              </div>
            </div>
```

- [ ] **Step 3: Update the activity filter logic**

Update the `.filter()` added in Task 5 to also respect the tab filter:

```tsx
                activities
                  .filter(activity => {
                    // Hide internal notes from non-agent/admin users
                    if (activity.isInternal && !user?.roles?.includes('AGENT') && !user?.roles?.includes('ADMIN')) {
                      return false;
                    }
                    // Tab filter
                    if (activityFilter === 'comments') return !activity.isSystemGenerated && !activity.isInternal;
                    if (activityFilter === 'system') return activity.isSystemGenerated;
                    if (activityFilter === 'internal') return activity.isInternal;
                    return true; // 'all'
                  })
                  .map((activity, idx) => {
```

- [ ] **Step 4: Verify**

1. "All" tab shows everything (except internal for non-agents)
2. "Comments" tab shows only user comments
3. "Activity Log" tab shows system-generated entries (status changes, assignments)
4. "Internal" tab (agents only) shows only internal notes

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: add communication tab filters for comments, activity log, internal notes

Agents see 4 tabs: All, Comments, Activity Log, Internal.
Regular users see 3 tabs (no Internal). Filters apply to timeline view."
```

---

### Task 7: Backend — Filter Internal Activities for Non-Agents

**Files:**
- Modify: `backend/src/controllers/request.controller.ts` (getRequestActivities handler)

- [ ] **Step 1: Find the getRequestActivities controller method**

Read the file to locate it, then add a role check to filter out internal activities for non-agents:

After fetching activities from Prisma, add:

```typescript
    // Filter internal activities for non-agent/admin users
    const userRoles = req.user!.roles || [];
    const isAgentOrAdmin = userRoles.includes('ADMIN') || userRoles.includes('AGENT');

    const filteredActivities = isAgentOrAdmin
      ? activities
      : activities.filter((a: any) => !a.isInternal);
```

Return `filteredActivities` instead of `activities`.

- [ ] **Step 2: Test with existing backend test suite**

```bash
cd backend && npm test
```

Expected: All existing tests pass. Internal note filtering is a new behavior added on top.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: filter internal activities from API response for non-agent users

Server-side enforcement ensures internal notes never leak to requesters
even if frontend filtering is bypassed."
```

---

## Phase 3: Role-Aware Action Banner

### Task 8: Create Role Detection Utility

**Files:**
- Create: `frontend/src/utils/roleDetection.ts`

- [ ] **Step 1: Create the utility file**

```typescript
// frontend/src/utils/roleDetection.ts

export type RequestRole = 'agent' | 'hiring_manager' | 'ceo' | 'staff';

interface RoleDetectionParams {
  userRoles: string[];
  userId: string;
  requesterId: string;
  requestStatus: string;
  serviceDeskCode: string;
}

const HIRING_STATUSES = [
  'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
  'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
  'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW',
  'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED',
  'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL',
  'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1',
  'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION',
  'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE',
  'ONBOARDING_MONTH_3_MILESTONE', 'ONBOARDING_COMPLETED'
];

export function isHiringRequest(serviceDeskCode: string, status: string): boolean {
  return serviceDeskCode === 'HR' && HIRING_STATUSES.includes(status);
}

export function detectRequestRole(params: RoleDetectionParams): RequestRole {
  const { userRoles, userId, requesterId, requestStatus, serviceDeskCode } = params;

  if (userRoles.includes('AGENT') || userRoles.includes('ADMIN')) {
    return 'agent';
  }

  if (userRoles.includes('CEO') && requestStatus === 'PENDING_CEO_APPROVAL') {
    return 'ceo';
  }

  if (userId === requesterId && isHiringRequest(serviceDeskCode, requestStatus)) {
    return 'hiring_manager';
  }

  return 'staff';
}

export { HIRING_STATUSES };
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/roleDetection.ts
git commit -m "feat: add role detection utility for request context

Determines whether current user is agent, CEO, hiring manager, or staff
relative to a specific request, not just their global role."
```

---

### Task 9: Create Action Banner Component

**Files:**
- Create: `frontend/src/components/request-detail/ActionBanner.tsx`

- [ ] **Step 1: Create the ActionBanner component**

```tsx
// frontend/src/components/request-detail/ActionBanner.tsx

import React from 'react';
import { RequestRole } from '../../utils/roleDetection';

interface ActionBannerProps {
  role: RequestRole;
  status: string;
  assignedToName?: string;
  onActionClick?: () => void;
}

interface BannerConfig {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  bgClass: string;
  borderClass: string;
  iconBgClass: string;
  iconColor: string;
}

function getBannerConfig(role: RequestRole, status: string, assignedToName?: string): BannerConfig | null {
  // STAFF view — what's happening with my ticket?
  if (role === 'staff') {
    if (status === 'SUBMITTED') return {
      icon: 'hourglass_top', title: 'Request Submitted',
      description: 'Your request has been received and is waiting to be picked up by our team.',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-200', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'IN_REVIEW') return {
      icon: 'visibility', title: 'Under Review',
      description: assignedToName ? `${assignedToName} is reviewing your request.` : 'Your request is being reviewed.',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    if (status === 'IN_PROGRESS') return {
      icon: 'engineering', title: 'In Progress',
      description: assignedToName ? `${assignedToName} is working on your request.` : 'Your request is being worked on.',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-200', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'ACTION_REQUIRED') return {
      icon: 'warning', title: 'Action Required From You',
      description: 'The team needs more information. Please check the comments below.',
      actionLabel: 'View Comments',
      bgClass: 'bg-orange-50', borderClass: 'border-orange-300', iconBgClass: 'bg-orange-500', iconColor: 'text-white'
    };
    if (status === 'RESOLVED' || status === 'COMPLETED') return {
      icon: 'check_circle', title: 'Resolved',
      description: 'Your request has been completed.',
      bgClass: 'bg-green-50', borderClass: 'border-green-200', iconBgClass: 'bg-green-600', iconColor: 'text-white'
    };
    return null;
  }

  // CEO view
  if (role === 'ceo') {
    if (status === 'PENDING_CEO_APPROVAL') return {
      icon: 'approval', title: 'Your Approval Required',
      description: 'This hiring request needs your approval to proceed. Review the details and make a decision.',
      actionLabel: 'Review Request',
      bgClass: 'bg-purple-50', borderClass: 'border-purple-300', iconBgClass: 'bg-purple-600', iconColor: 'text-white'
    };
    return null;
  }

  // HIRING MANAGER view
  if (role === 'hiring_manager') {
    if (status === 'PENDING_MANAGER_REVIEW') return {
      icon: 'rate_review', title: 'Your Action: Review Candidates',
      description: 'Candidate resumes are ready for your review. Select a candidate to proceed.',
      actionLabel: 'Review Candidates',
      bgClass: 'bg-orange-50', borderClass: 'border-orange-300', iconBgClass: 'bg-orange-500', iconColor: 'text-white'
    };
    if (status === 'INTERVIEW_SCHEDULED') return {
      icon: 'feedback', title: 'Your Action: Submit Interview Feedback',
      description: 'The interview has been completed. Please submit your feedback and decision.',
      actionLabel: 'Submit Feedback',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-300', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    if (status === 'LOA_PENDING_APPROVAL') return {
      icon: 'fact_check', title: 'Your Action: Approve Letter of Acceptance',
      description: 'The LOA document is ready for your review and approval.',
      actionLabel: 'Review LOA',
      bgClass: 'bg-emerald-50', borderClass: 'border-emerald-300', iconBgClass: 'bg-emerald-600', iconColor: 'text-white'
    };
    if (status === 'PENDING_CEO_APPROVAL') return {
      icon: 'hourglass_top', title: 'Waiting: CEO Approval',
      description: 'Your hiring request is pending CEO approval. You will be notified when a decision is made.',
      bgClass: 'bg-purple-50', borderClass: 'border-purple-200', iconBgClass: 'bg-purple-500', iconColor: 'text-white'
    };
    if (status === 'HR_SCREENING') return {
      icon: 'fact_check', title: 'In Progress: HR Screening',
      description: 'Background and reference checks are being conducted by HR.',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-200', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    return null;
  }

  // AGENT view
  if (role === 'agent') {
    if (status === 'SUBMITTED') return {
      icon: 'inbox', title: 'New Request — Needs Assignment',
      description: 'This request has not been assigned yet. Assign it to yourself or another agent.',
      actionLabel: 'Assign',
      bgClass: 'bg-yellow-50', borderClass: 'border-yellow-300', iconBgClass: 'bg-yellow-500', iconColor: 'text-white'
    };
    if (status === 'CEO_APPROVED') return {
      icon: 'work', title: 'Next Step: Post the Job',
      description: 'CEO has approved. Mark the job as posted to proceed.',
      actionLabel: 'Mark Job Posted',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-300', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'MANAGER_APPROVED') return {
      icon: 'calendar_month', title: 'Next Step: Schedule Interview',
      description: 'Hiring manager selected a candidate. Schedule the interview.',
      actionLabel: 'Schedule Interview',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-300', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    if (status === 'INTERVIEW_FEEDBACK_PENDING') return {
      icon: 'play_arrow', title: 'Next Step: Start HR Screening',
      description: 'Interview feedback received. Begin background and reference checks.',
      actionLabel: 'Start Screening',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-300', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    return null;
  }

  return null;
}

const ActionBanner: React.FC<ActionBannerProps> = ({ role, status, assignedToName, onActionClick }) => {
  const config = getBannerConfig(role, status, assignedToName);
  if (!config) return null;

  return (
    <div className={`mb-8 ${config.bgClass} border-2 ${config.borderClass} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className={`size-11 rounded-full ${config.iconBgClass} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-xl ${config.iconColor}`}>{config.icon}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
        </div>
        {config.actionLabel && onActionClick && (
          <button
            onClick={onActionClick}
            className="px-5 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            {config.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionBanner;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/ActionBanner.tsx
git commit -m "feat: create role-aware ActionBanner component

Shows contextual guidance per role and status:
- Staff: what's happening with their ticket
- CEO: approval required callout
- Hiring Manager: next action with direct button
- Agent: next workflow step guidance"
```

---

### Task 10: Integrate Action Banner into RequestDetail

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

- [ ] **Step 1: Add imports**

At the top of `RequestDetail.tsx`, after the existing imports (line 20), add:

```typescript
import ActionBanner from '../src/components/request-detail/ActionBanner';
import { detectRequestRole, isHiringRequest } from '../src/utils/roleDetection';
```

- [ ] **Step 2: Add role detection in render**

After `const steps = getStatusSteps(request.status);` (line 691), add:

```typescript
  const currentRole = detectRequestRole({
    userRoles: user?.roles || [],
    userId: user?.id || '',
    requesterId: request.requesterId || request.requester?.id || '',
    requestStatus: request.status,
    serviceDeskCode: request.serviceDesk?.code || '',
  });
```

- [ ] **Step 3: Insert ActionBanner after the stepper**

After the stepper closing `</div>` (line 732), before the Resolution Summary section, add:

```tsx
      <ActionBanner
        role={currentRole}
        status={request.status}
        assignedToName={request.assignedTo ? `${request.assignedTo.firstName} ${request.assignedTo.lastName}` : undefined}
        onActionClick={() => {
          // Scroll to actions sidebar or trigger the relevant modal
          const actionsSection = document.querySelector('[data-actions-sidebar]');
          if (actionsSection) actionsSection.scrollIntoView({ behavior: 'smooth' });
        }}
      />
```

- [ ] **Step 4: Add data attribute to sidebar for scroll target**

On the sidebar Actions section (around line 1528), add a data attribute:

```tsx
          <div data-actions-sidebar className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
```

- [ ] **Step 5: Verify**

1. Staff user on SUBMITTED ticket → "Request Submitted" blue banner
2. Hiring Manager on PENDING_MANAGER_REVIEW → "Review Candidates" orange banner with action button
3. Agent on unassigned ticket → "Needs Assignment" yellow banner
4. CEO on PENDING_CEO_APPROVAL → "Your Approval Required" purple banner

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: integrate role-aware action banner into request detail page

Banner appears between stepper and content. Shows contextual guidance
based on user role and ticket status. Action button scrolls to sidebar."
```

---

## Phase 4: Status Transition Validation

### Task 11: Create Workflow Transitions Map (Frontend)

**Files:**
- Create: `frontend/src/utils/workflowTransitions.ts`

- [ ] **Step 1: Create the transitions utility**

```typescript
// frontend/src/utils/workflowTransitions.ts

// Maps each status to its valid next statuses
const VALID_TRANSITIONS: Record<string, string[]> = {
  // Generic workflow
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL_IT', 'PENDING_MANAGER_APPROVAL_FIN'],
  IN_REVIEW: ['IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING', 'REJECTED', 'RESOLVED'],
  IN_PROGRESS: ['ACTION_REQUIRED', 'WAITING', 'RESOLVED', 'REJECTED'],
  ACTION_REQUIRED: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'REJECTED'],
  WAITING: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED'],
  APPROVED: ['RESOLVED'],
  RESOLVED: [],
  REJECTED: [],

  // HR Hiring workflow (agent-driven transitions)
  PENDING_CEO_APPROVAL: [], // Only CEO can act
  CEO_APPROVED: ['JOB_POSTED'],
  CEO_REJECTED: [],
  JOB_POSTED: ['PENDING_MANAGER_REVIEW'],
  PENDING_MANAGER_REVIEW: [], // Only hiring manager can act
  MANAGER_APPROVED: ['INTERVIEW_SCHEDULED'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_FEEDBACK_PENDING'],
  INTERVIEW_FEEDBACK_PENDING: ['HR_SCREENING', 'CANDIDATE_REJECTED_INTERVIEW'],
  CANDIDATE_REJECTED_INTERVIEW: [],
  HR_SCREENING: ['LOA_PENDING_APPROVAL'],
  LOA_PENDING_APPROVAL: [], // Only hiring manager can approve
  LOA_APPROVED: ['LOA_ISSUED'],
  LOA_ISSUED: ['LOA_ACCEPTED'],
  LOA_ACCEPTED: ['COMPLETED'],
  COMPLETED: [],

  // IT workflow
  PENDING_MANAGER_APPROVAL_IT: [],
  MANAGER_APPROVED_IT: ['PROCUREMENT_IN_PROGRESS'],
  MANAGER_REJECTED_IT: [],
  PROCUREMENT_IN_PROGRESS: ['HARDWARE_ORDERED'],
  HARDWARE_ORDERED: ['HARDWARE_RECEIVED'],
  HARDWARE_RECEIVED: ['SOFTWARE_PROVISIONED'],
  SOFTWARE_PROVISIONED: ['RESOLVED'],

  // Finance workflow
  PENDING_MANAGER_APPROVAL_FIN: [],
  MANAGER_APPROVED_FIN: ['PENDING_FINANCE_HEAD_APPROVAL'],
  MANAGER_REJECTED_FIN: [],
  PENDING_FINANCE_HEAD_APPROVAL: [],
  FINANCE_HEAD_APPROVED: ['PAYMENT_PROCESSING'],
  FINANCE_HEAD_REJECTED: [],
  PAYMENT_PROCESSING: ['PAYMENT_COMPLETED'],
  PAYMENT_COMPLETED: ['REIMBURSEMENT_CLOSED'],
  REIMBURSEMENT_CLOSED: [],
};

export function getValidNextStatuses(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

export function isValidTransition(from: string, to: string): boolean {
  const valid = VALID_TRANSITIONS[from];
  return valid ? valid.includes(to) : false;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/workflowTransitions.ts
git commit -m "feat: add workflow transition map for status validation

Defines valid next-status options per current status.
Covers generic, HR hiring, IT hardware, and finance workflows."
```

---

### Task 12: Replace Free-Form Status Dropdown with Valid Options Only

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1547-1565` (status dropdown)

- [ ] **Step 1: Import transition utility**

At the top of `RequestDetail.tsx`, add:

```typescript
import { getValidNextStatuses } from '../src/utils/workflowTransitions';
```

- [ ] **Step 2: Replace the hardcoded status dropdown**

Find lines 1547-1565 (the status dropdown). Replace:

```tsx
                  {/* Update Status dropdown */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-[#5e718d] mb-2">Update Status</label>
                    <select
                      value={request.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                      className="w-full px-4 py-2.5 text-sm font-semibold text-[#44546f] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="SUBMITTED">Submitted</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ACTION_REQUIRED">Action Required</option>
                      <option value="WAITING">Waiting</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>
```

With:

```tsx
                  {/* Update Status dropdown — only valid transitions */}
                  {getValidNextStatuses(request.status).length > 0 && (
                    <div className="relative">
                      <label className="block text-xs font-bold text-[#5e718d] mb-2">Update Status</label>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleStatusChange(e.target.value);
                        }}
                        disabled={updatingStatus}
                        className="w-full px-4 py-2.5 text-sm font-semibold text-[#44546f] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select next status...</option>
                        {getValidNextStatuses(request.status).map(status => (
                          <option key={status} value={status}>
                            {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
```

- [ ] **Step 3: Verify**

1. Ticket at SUBMITTED → dropdown shows IN_REVIEW, IN_PROGRESS, REJECTED (not RESOLVED directly)
2. Ticket at CEO_APPROVED → dropdown shows only JOB_POSTED
3. Ticket at RESOLVED → no dropdown appears (no valid transitions)
4. Ticket at PENDING_CEO_APPROVAL → no dropdown (CEO must act via button)

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "fix: replace free-form status dropdown with valid transitions only

Agents can only select statuses that are valid next steps for the current
workflow state. Prevents skipping steps or invalid transitions."
```

---

### Task 13: Backend — Validate Status Transitions on Update

**Files:**
- Create: `backend/src/utils/workflowTransitions.ts`
- Modify: `backend/src/controllers/request.controller.ts` (updateStatus handler)

- [ ] **Step 1: Create server-side transition validation**

```typescript
// backend/src/utils/workflowTransitions.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL_IT', 'PENDING_MANAGER_APPROVAL_FIN'],
  IN_REVIEW: ['IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING', 'REJECTED', 'RESOLVED'],
  IN_PROGRESS: ['ACTION_REQUIRED', 'WAITING', 'RESOLVED', 'REJECTED'],
  ACTION_REQUIRED: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'REJECTED'],
  WAITING: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED'],
  APPROVED: ['RESOLVED'],
  RESOLVED: [],
  REJECTED: [],
  PENDING_CEO_APPROVAL: ['CEO_APPROVED', 'CEO_REJECTED'],
  CEO_APPROVED: ['JOB_POSTED'],
  CEO_REJECTED: [],
  JOB_POSTED: ['PENDING_MANAGER_REVIEW'],
  PENDING_MANAGER_REVIEW: ['MANAGER_APPROVED'],
  MANAGER_APPROVED: ['INTERVIEW_SCHEDULED'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_FEEDBACK_PENDING'],
  INTERVIEW_FEEDBACK_PENDING: ['HR_SCREENING', 'CANDIDATE_REJECTED_INTERVIEW'],
  CANDIDATE_REJECTED_INTERVIEW: [],
  HR_SCREENING: ['LOA_PENDING_APPROVAL'],
  LOA_PENDING_APPROVAL: ['LOA_APPROVED', 'LOA_REJECTED'],
  LOA_APPROVED: ['LOA_ISSUED'],
  LOA_ISSUED: ['LOA_ACCEPTED'],
  LOA_ACCEPTED: ['COMPLETED'],
  COMPLETED: ['ONBOARDING_SUBMITTED'],
  PENDING_MANAGER_APPROVAL_IT: ['MANAGER_APPROVED_IT', 'MANAGER_REJECTED_IT'],
  MANAGER_APPROVED_IT: ['PROCUREMENT_IN_PROGRESS'],
  MANAGER_REJECTED_IT: [],
  PROCUREMENT_IN_PROGRESS: ['HARDWARE_ORDERED'],
  HARDWARE_ORDERED: ['HARDWARE_RECEIVED'],
  HARDWARE_RECEIVED: ['SOFTWARE_PROVISIONED'],
  SOFTWARE_PROVISIONED: ['RESOLVED'],
  PENDING_MANAGER_APPROVAL_FIN: ['MANAGER_APPROVED_FIN', 'MANAGER_REJECTED_FIN'],
  MANAGER_APPROVED_FIN: ['PENDING_FINANCE_HEAD_APPROVAL'],
  MANAGER_REJECTED_FIN: [],
  PENDING_FINANCE_HEAD_APPROVAL: ['FINANCE_HEAD_APPROVED', 'FINANCE_HEAD_REJECTED'],
  FINANCE_HEAD_APPROVED: ['PAYMENT_PROCESSING'],
  FINANCE_HEAD_REJECTED: [],
  PAYMENT_PROCESSING: ['PAYMENT_COMPLETED'],
  PAYMENT_COMPLETED: ['REIMBURSEMENT_CLOSED'],
  REIMBURSEMENT_CLOSED: [],
};

export function isValidTransition(from: string, to: string): boolean {
  const valid = VALID_TRANSITIONS[from];
  return valid ? valid.includes(to) : false;
}

export function getValidNextStatuses(from: string): string[] {
  return VALID_TRANSITIONS[from] || [];
}
```

- [ ] **Step 2: Add validation to the updateStatus controller**

In `backend/src/controllers/request.controller.ts`, find the `updateStatus` method. At the beginning (after fetching the current request), add:

```typescript
    import { isValidTransition } from '../utils/workflowTransitions';

    // Validate transition
    if (!isValidTransition(request.status, status)) {
      throw new AppError(`Invalid status transition from ${request.status} to ${status}`, 400);
    }
```

- [ ] **Step 3: Test**

```bash
cd backend && npm test
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/utils/workflowTransitions.ts backend/src/controllers/request.controller.ts
git commit -m "feat: enforce workflow status transitions on backend

Server rejects invalid transitions with 400 error.
Covers all workflow types: generic, hiring, IT, finance."
```

---

## Phase 5: SLA Visibility

### Task 14: Create SLA Indicator Component

**Files:**
- Create: `frontend/src/components/request-detail/SLAIndicator.tsx`

- [ ] **Step 1: Create the SLA component**

```tsx
// frontend/src/components/request-detail/SLAIndicator.tsx

import React from 'react';

interface SLAIndicatorProps {
  slaDueAt: string | null | undefined;
  status: string;
}

const TERMINAL_STATUSES = ['RESOLVED', 'COMPLETED', 'REJECTED', 'CEO_REJECTED',
  'CANDIDATE_REJECTED_INTERVIEW', 'MANAGER_REJECTED_IT', 'MANAGER_REJECTED_FIN',
  'FINANCE_HEAD_REJECTED', 'REIMBURSEMENT_CLOSED', 'ONBOARDING_COMPLETED'];

const SLAIndicator: React.FC<SLAIndicatorProps> = ({ slaDueAt, status }) => {
  if (!slaDueAt || TERMINAL_STATUSES.includes(status)) return null;

  const now = new Date();
  const due = new Date(slaDueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  const isBreached = diffMs < 0;
  const isWarning = !isBreached && diffHours < 24;
  const isOk = !isBreached && !isWarning;

  let label: string;
  if (isBreached) {
    const overHours = Math.abs(diffHours);
    const overDays = Math.floor(overHours / 24);
    label = overDays > 0 ? `${overDays}d ${overHours % 24}h overdue` : `${overHours}h overdue`;
  } else if (diffDays > 0) {
    label = `${diffDays}d ${remainingHours}h remaining`;
  } else {
    label = `${diffHours}h remaining`;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${
      isBreached ? 'bg-red-100 text-red-700 border border-red-200' :
      isWarning ? 'bg-amber-100 text-amber-700 border border-amber-200' :
      'bg-green-100 text-green-700 border border-green-200'
    }`}>
      <span className="material-symbols-outlined text-sm">
        {isBreached ? 'error' : isWarning ? 'warning' : 'timer'}
      </span>
      <span>SLA: {label}</span>
      <span className="text-[10px] font-normal opacity-75">
        (Due: {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
      </span>
    </div>
  );
};

export default SLAIndicator;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/SLAIndicator.tsx
git commit -m "feat: create SLA indicator component with breach/warning/ok states

Shows countdown with color-coded urgency:
- Green: >24h remaining
- Amber: <24h remaining
- Red: overdue with duration"
```

---

### Task 15: Integrate SLA Indicator into Request Detail

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx` (sidebar + interface)

- [ ] **Step 1: Add slaDueAt to the Request interface**

In `frontend/pages/RequestDetail.tsx`, update the `Request` interface (line 22-55). Add after `candidateResumes?`:

```typescript
  slaDueAt?: string | null;
```

- [ ] **Step 2: Import SLAIndicator**

Add to imports:

```typescript
import SLAIndicator from '../src/components/request-detail/SLAIndicator';
```

- [ ] **Step 3: Add SLA indicator to the sidebar**

In the sidebar details section, after the "Priority" display (around line 1510), add:

```tsx
              {request.slaDueAt && (
                <div>
                  <dt className="text-[#5e718d] mb-1">SLA Status</dt>
                  <dd>
                    <SLAIndicator slaDueAt={request.slaDueAt} status={request.status} />
                  </dd>
                </div>
              )}
```

- [ ] **Step 4: Ensure backend returns slaDueAt in getRequestById**

Check `backend/src/controllers/request.controller.ts` — the `getRequestById` should already include `slaDueAt` in the Prisma select. If not, add it to the select/include clause.

- [ ] **Step 5: Verify**

1. Ticket with SLA due in 3 days → green "3d Xh remaining"
2. Ticket with SLA due in 12 hours → amber "12h remaining"
3. Ticket overdue by 2 days → red "2d Xh overdue"
4. Resolved ticket → no SLA indicator

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/RequestDetail.tsx frontend/src/components/request-detail/SLAIndicator.tsx
git commit -m "feat: add SLA indicator to request detail sidebar

Shows real-time SLA countdown using existing slaDueAt field.
Color-coded: green (ok), amber (<24h), red (breached)."
```

---

## Phase 6: Custom Fields Display & Hiring Manager Identity

### Task 16: Create Structured Custom Fields Panel

**Files:**
- Create: `frontend/src/components/request-detail/CustomFieldsPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/request-detail/CustomFieldsPanel.tsx

import React from 'react';

interface CustomFieldsPanelProps {
  customFields: Record<string, any> | undefined;
  serviceDeskCode: string;
}

// Known field labels for HR hiring requests
const HR_FIELD_LABELS: Record<string, string> = {
  jobTitle: 'Job Title',
  department: 'Department',
  salary: 'Salary Range',
  salaryRange: 'Salary Range',
  justification: 'Justification',
  employmentType: 'Employment Type',
  reportingTo: 'Reporting To',
  startDate: 'Desired Start Date',
  headcount: 'Headcount',
  location: 'Location',
  jobDescription: 'Job Description',
  requirements: 'Requirements',
  budget: 'Budget',
};

const IT_FIELD_LABELS: Record<string, string> = {
  hardwareType: 'Hardware Type',
  model: 'Model',
  specifications: 'Specifications',
  reason: 'Reason',
  urgency: 'Urgency',
  currentDevice: 'Current Device',
};

const FINANCE_FIELD_LABELS: Record<string, string> = {
  expenseType: 'Expense Type',
  amount: 'Amount',
  currency: 'Currency',
  receiptDate: 'Receipt Date',
  vendor: 'Vendor',
  costCenter: 'Cost Center',
  projectCode: 'Project Code',
};

function getFieldLabels(code: string): Record<string, string> {
  if (code === 'HR') return HR_FIELD_LABELS;
  if (code === 'IT') return IT_FIELD_LABELS;
  if (code === 'FINANCE') return FINANCE_FIELD_LABELS;
  return {};
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({ customFields, serviceDeskCode }) => {
  if (!customFields || Object.keys(customFields).length === 0) return null;

  const labels = getFieldLabels(serviceDeskCode);
  const entries = Object.entries(customFields).filter(([_, v]) => v !== null && v !== undefined && v !== '');

  if (entries.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
        <span className="material-symbols-outlined text-[#0052cc]">description</span>
        <h3 className="font-bold text-xl">Request Details</h3>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <dl className="divide-y divide-gray-100">
          {entries.map(([key, value]) => (
            <div key={key} className="flex px-6 py-3.5">
              <dt className="w-44 shrink-0 text-sm font-semibold text-[#5e718d]">
                {labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </dt>
              <dd className="text-sm text-[#101418] flex-1">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default CustomFieldsPanel;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/request-detail/CustomFieldsPanel.tsx
git commit -m "feat: create structured custom fields panel component

Renders customFields JSON as labeled key-value pairs.
Recognizes HR, IT, Finance field names with human-readable labels."
```

---

### Task 17: Integrate Custom Fields Panel into Request Detail

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

- [ ] **Step 1: Import the component**

```typescript
import CustomFieldsPanel from '../src/components/request-detail/CustomFieldsPanel';
```

- [ ] **Step 2: Add after the Description section**

After the description `</div>` closing tag (around line 799, after the `</section>` for Case Summary), add:

```tsx
          {/* Structured Custom Fields */}
          <CustomFieldsPanel
            customFields={request.customFields}
            serviceDeskCode={request.serviceDesk?.code || ''}
          />
```

- [ ] **Step 3: Verify**

1. HR hiring request with customFields `{jobTitle: "Engineer", salary: "80k-100k"}` → shows labeled table
2. Request with empty customFields → nothing renders
3. IT request with customFields → uses IT-specific labels

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: display structured custom fields in request detail

Replaces raw JSON with formatted table. Shows after description section.
Field labels auto-detected by service desk type."
```

---

### Task 18: Fix Hiring Manager Role Detection (Not Just Requester ID)

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:1732-1771` (Hiring Manager actions section)

Currently line 1733 uses `user?.id === request.requester?.id` which means ANY requester of an HR ticket sees hiring manager actions. The fix: only show hiring manager actions when the request is actually in the hiring workflow.

- [ ] **Step 1: Update the hiring manager actions conditional**

Replace line 1732-1733:

```tsx
              {/* Hiring Manager Actions (Requester) */}
              {user?.id === request.requester?.id && (
```

With:

```tsx
              {/* Hiring Manager Actions (Requester of hiring workflow tickets only) */}
              {user?.id === request.requester?.id && isHiringRequest(request.serviceDesk?.code || '', request.status) && (
```

The `isHiringRequest` function was already imported in Task 10.

- [ ] **Step 2: Verify**

1. Requester of a leave request → NO hiring manager action buttons
2. Requester of a hiring request at PENDING_MANAGER_REVIEW → sees "Review Candidates" button
3. Non-requester of a hiring request → no hiring manager buttons

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "fix: show hiring manager actions only for hiring workflow tickets

Prevents non-hiring HR requesters from seeing candidate review,
interview feedback, and LOA approval buttons."
```

---

## Phase 7: Agent Tooling — Assignment & Stepper Timestamps

### Task 19: Add "Assign To" Agent Dropdown

**Files:**
- Create: `frontend/src/components/request-detail/AssignToDropdown.tsx`
- Modify: `frontend/pages/RequestDetail.tsx`
- Modify: `backend/src/controllers/user.controller.ts` (add getAgents endpoint)
- Modify: `backend/src/routes/user.routes.ts`

- [ ] **Step 1: Add backend endpoint to list agents**

In `backend/src/controllers/user.controller.ts`, add a new method:

```typescript
    getAgents = asyncHandler(async (req: AuthRequest, res: Response) => {
        const agents = await prisma.user.findMany({
            where: {
                roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
                deletedAt: null,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
            },
            orderBy: { firstName: 'asc' },
        });

        res.json({ success: true, data: { agents } });
    });
```

- [ ] **Step 2: Add route**

In `backend/src/routes/user.routes.ts`, add:

```typescript
router.get('/agents', authenticate, authorize('ADMIN', 'AGENT'), userController.getAgents);
```

- [ ] **Step 3: Create AssignToDropdown component**

```tsx
// frontend/src/components/request-detail/AssignToDropdown.tsx

import React, { useState, useEffect } from 'react';
import apiClient from '../../src/services/api';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AssignToDropdownProps {
  currentAssigneeId?: string;
  onAssign: (agentId: string) => Promise<void>;
}

const AssignToDropdown: React.FC<AssignToDropdownProps> = ({ currentAssigneeId, onAssign }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/users/agents');
        setAgents(response.data.data.agents);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const handleChange = async (agentId: string) => {
    if (!agentId || agentId === currentAssigneeId) return;
    try {
      setAssigning(true);
      await onAssign(agentId);
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <div className="text-xs text-gray-400">Loading agents...</div>;

  return (
    <div>
      <label className="block text-xs font-bold text-[#5e718d] mb-2">Assign To</label>
      <select
        value={currentAssigneeId || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={assigning}
        className="w-full px-4 py-2.5 text-sm font-semibold text-[#44546f] bg-white border border-gray-200 rounded-lg disabled:opacity-50"
      >
        <option value="">Select agent...</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.firstName} {agent.lastName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AssignToDropdown;
```

- [ ] **Step 4: Integrate into RequestDetail**

Import at top:

```typescript
import AssignToDropdown from '../src/components/request-detail/AssignToDropdown';
```

In the agent actions section, after the "Assign to Me" button (line 1544), add:

```tsx
                  {/* Assign to another agent */}
                  <AssignToDropdown
                    currentAssigneeId={request.assignedTo?.id}
                    onAssign={async (agentId) => {
                      const updatedRequest = await requestService.assignRequest(id!, agentId);
                      setRequest(updatedRequest);
                      const updatedActivities = await requestService.getRequestActivities(id!);
                      setActivities(updatedActivities);
                    }}
                  />
```

- [ ] **Step 5: Verify**

1. Agent sees dropdown with list of all agents
2. Selecting an agent assigns the ticket
3. Activity log shows assignment event

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/request-detail/AssignToDropdown.tsx frontend/pages/RequestDetail.tsx backend/src/controllers/user.controller.ts backend/src/routes/user.routes.ts
git commit -m "feat: add assign-to-agent dropdown for ticket reassignment

Agents can now reassign tickets to any other agent/admin.
New GET /users/agents endpoint returns available agents."
```

---

### Task 20: Add Timestamps to Status Stepper

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx:707-732` (stepper render)

The stepper currently shows icons and labels but no indication of WHEN each step was completed. We can derive timestamps from the activity log (STATUS_CHANGE activities).

- [ ] **Step 1: Build a status-to-timestamp map from activities**

After `const steps = getStatusSteps(request.status);` (line 691), add:

```typescript
  // Build timestamp map from status change activities
  const statusTimestamps: Record<string, string> = {};
  activities
    .filter(a => a.activityType === 'STATUS_CHANGE' || (a.isSystemGenerated && a.message.includes('status')))
    .forEach(a => {
      // Extract status from the activity message or metadata
      const match = a.message.match(/status.*?to\s+(\w+)/i) || a.message.match(/(\w+_?\w+)/);
      if (match) {
        statusTimestamps[match[1]] = a.createdAt;
      }
    });
  // The initial SUBMITTED timestamp is always the request creation time
  statusTimestamps['SUBMITTED'] = request.createdAt;
```

- [ ] **Step 2: Display timestamps under each stepper step**

In the stepper rendering (lines 710-722), update the step label to include timestamp:

Replace:

```tsx
                <span className="text-xs font-bold uppercase tracking-wider">{step.label}</span>
```

With:

```tsx
                <span className="text-xs font-bold uppercase tracking-wider">{step.label}</span>
                {step.active && statusTimestamps[step.status] && (
                  <span className="text-[9px] text-[#8993a4] font-normal">
                    {new Date(statusTimestamps[step.status]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
```

- [ ] **Step 3: Verify**

1. Stepper shows dates below completed step labels
2. Future (inactive) steps show no date
3. Current step shows its activation date

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "feat: add completion timestamps to status stepper

Each completed step now shows the date it was reached,
derived from status change activities in the audit trail."
```

---

### Task 21: Hide Hiring Workflow Sections for Non-Hiring Tickets

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx` (interview, screening, LOA sections)

The interview details (lines 909-1013), screening details (lines 1015-1074), and LOA details (lines 1076-1156) render for ALL HR tickets. They should only render for hiring workflow tickets.

- [ ] **Step 1: Wrap hiring-specific sections with isHiringRequest check**

Already have `isHiringRequest` imported. Wrap the interview section (~line 909), screening section (~line 1015), and LOA section (~line 1076) with:

```tsx
          {isHiringRequest(request.serviceDesk?.code || '', request.status) && (
            <>
              {/* Interview Details section */}
              ...existing interview JSX...

              {/* Screening Details section */}
              ...existing screening JSX...

              {/* LOA Details section */}
              ...existing LOA JSX...
            </>
          )}
```

- [ ] **Step 2: Also wrap the resume section (~line 826) the same way**

```tsx
          {isHiringRequest(request.serviceDesk?.code || '', request.status) && resumes.length > 0 && (
            ...existing resume section...
          )}
```

- [ ] **Step 3: Verify**

1. Non-hiring HR ticket → no interview/screening/LOA/resume sections
2. Hiring workflow ticket → all sections render as before

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "fix: hide hiring workflow sections for non-hiring HR tickets

Interview, screening, LOA, and resume sections now only render
when the ticket is in the hiring workflow."
```

---

## Phase 8: Rejection Handling

### Task 22: Add Re-route Option After CEO Rejection

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx` (agent actions for CEO_REJECTED status)

- [ ] **Step 1: Add a re-submit/revise option for CEO-rejected tickets**

In the agent hiring workflow actions (after the CEO_APPROVED block around line 1592), add a section for CEO_REJECTED:

```tsx
                      {/* Re-route rejected request - Show when status is CEO_REJECTED */}
                      {request.status === 'CEO_REJECTED' && (
                        <div className="space-y-2">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-red-700 font-semibold">CEO has rejected this request.</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!id) return;
                              try {
                                setProcessingAction(true);
                                await requestService.updateStatus(id, 'SUBMITTED' as any);
                                await fetchRequestData();
                                alert('Request returned to SUBMITTED for revision');
                              } catch (err: any) {
                                alert(err.message || 'Failed to re-open request');
                              } finally {
                                setProcessingAction(false);
                              }
                            }}
                            disabled={processingAction}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-lg">replay</span>
                            {processingAction ? 'Processing...' : 'Revise & Resubmit'}
                          </button>
                        </div>
                      )}
```

- [ ] **Step 2: Update backend transition map to allow CEO_REJECTED → SUBMITTED**

In `backend/src/utils/workflowTransitions.ts`, update:

```typescript
  CEO_REJECTED: ['SUBMITTED'],  // Allow revision and resubmission
```

And in `frontend/src/utils/workflowTransitions.ts`:

```typescript
  CEO_REJECTED: ['SUBMITTED'],
```

- [ ] **Step 3: Do the same for CANDIDATE_REJECTED_INTERVIEW**

Add to agent actions:

```tsx
                      {request.status === 'CANDIDATE_REJECTED_INTERVIEW' && (
                        <button
                          onClick={async () => {
                            if (!id) return;
                            try {
                              setProcessingAction(true);
                              await requestService.updateStatus(id, 'JOB_POSTED' as any);
                              await fetchRequestData();
                              alert('Request returned to Job Posted for new candidates');
                            } catch (err: any) {
                              alert(err.message || 'Failed');
                            } finally {
                              setProcessingAction(false);
                            }
                          }}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">replay</span>
                          {processingAction ? 'Processing...' : 'Re-open for New Candidates'}
                        </button>
                      )}
```

And update transitions:

```typescript
  CANDIDATE_REJECTED_INTERVIEW: ['JOB_POSTED'],
```

- [ ] **Step 4: Verify**

1. CEO_REJECTED ticket → agent sees "Revise & Resubmit" button → returns to SUBMITTED
2. CANDIDATE_REJECTED_INTERVIEW → agent sees "Re-open for New Candidates" → returns to JOB_POSTED

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/RequestDetail.tsx frontend/src/utils/workflowTransitions.ts backend/src/utils/workflowTransitions.ts
git commit -m "feat: add rejection recovery paths for CEO and interview rejections

CEO-rejected tickets can be revised and resubmitted.
Interview-rejected tickets can re-open for new candidates."
```

---

## Summary: Task Execution Order

Execute these tasks **sequentially within each phase**, but **phases can be done in order**:

| Task | Phase | Description | Dependencies |
|------|-------|-------------|--------------|
| 1 | 1 | Hide hiring stepper for non-hiring tickets | None |
| 2 | 1 | Wire up dead buttons | None |
| 3 | 1 | Show assigned agent in sidebar | None |
| 4 | 2 | Internal note toggle in comment form | None |
| 5 | 2 | Filter internal notes from non-agents | Task 4 |
| 6 | 2 | Communication tab filtering | Task 5 |
| 7 | 2 | Backend internal note filtering | Task 4 |
| 8 | 3 | Role detection utility | None |
| 9 | 3 | Action banner component | Task 8 |
| 10 | 3 | Integrate action banner | Task 9 |
| 11 | 4 | Workflow transitions map (frontend) | None |
| 12 | 4 | Replace status dropdown | Task 11 |
| 13 | 4 | Backend transition validation | None |
| 14 | 5 | SLA indicator component | None |
| 15 | 5 | Integrate SLA indicator | Task 14 |
| 16 | 6 | Custom fields panel | None |
| 17 | 6 | Integrate custom fields | Task 16 |
| 18 | 6 | Fix hiring manager role detection | Task 8 |
| 19 | 7 | Agent assign-to dropdown | None |
| 20 | 7 | Stepper timestamps | None |
| 21 | 7 | Hide hiring sections for non-hiring | Task 8 |
| 22 | 8 | Rejection recovery paths | Task 11, Task 13 |

---

## Audit Issues → Tasks Mapping

| Audit Issue | Task(s) |
|-------------|---------|
| #1 One-size-fits-all stepper | Task 1, Task 21 |
| #2 No internal notes | Tasks 4, 5, 6, 7 |
| #3 Requester = Hiring Manager | Task 8, Task 18 |
| #4 No "what do I do next?" | Tasks 8, 9, 10 |
| #5 SLA absent from UI | Tasks 14, 15 |
| #6 Invalid status transitions | Tasks 11, 12, 13 |
| #7 No audit trail differentiation | Task 6 |
| #8 Raw JSON custom fields | Tasks 16, 17 |
| #9 Decorative stepper | Task 20 |
| #10 Dead buttons | Task 2 |
| A1 No reassignment | Task 19 |
| Rejection dead-ends | Task 22 |
