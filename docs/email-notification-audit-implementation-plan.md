# Email Notification Audit — Implementation Plan

## Summary of Findings

The CWC email notification system has 5 categories of issues discovered during audit:

1. **CRITICAL**: Multiple event types send emails to multiple people simultaneously, violating the "one dedicated person" rule
2. **MEDIUM**: `notifyMultiple()` lacks deduplication — same person can receive duplicate emails
3. **MEDIUM**: Misleading `recipientDescription` labels in the admin UI
4. **LOW**: Dead event types (`MANAGER_APPROVAL_REQUIRED`, `COMMENT_ADDED`) registered but never triggered
5. **LOW**: No email delivery audit trail persisted to DB

---

## Phase 1 — Quick Wins (Safe, No Behavior Change)

### 1.1 Add deduplication to `notifyMultiple()`

**File:** `backend/src/services/notification.service.ts:175-184`

**Current code:**
```typescript
export async function notifyMultiple(
  userIds: string[],
  eventType: string,
  variables: Record<string, string>,
  relatedRequestId?: string
): Promise<void> {
  await Promise.allSettled(
    userIds.map((userId) => notify({ userId, eventType, variables, relatedRequestId }))
  );
}
```

**Change:**
```typescript
export async function notifyMultiple(
  userIds: string[],
  eventType: string,
  variables: Record<string, string>,
  relatedRequestId?: string
): Promise<void> {
  const unique = [...new Set(userIds)];
  await Promise.allSettled(
    unique.map((userId) => notify({ userId, eventType, variables, relatedRequestId }))
  );
}
```

**Why:** Defensive — prevents duplicate emails if the same userId appears twice in the array. Currently `disbursement.service.ts` builds a plain `string[]` with no dedup.

**Risk:** Zero — same behavior, just idempotent.

---

### 1.2 Add email delivery audit trail

**File:** `backend/src/services/notification.service.ts:155-168`

**Current state:** `sendEmail()` returns `boolean`. A `Notification` record with `channel: 'EMAIL'` is created with `status: 'SENT' | 'FAILED'`, but there is no dedicated audit log of who was emailed what and when.

**Change:** The existing `Notification` record with `channel: 'EMAIL'` (lines 156-167) already captures `userId`, `subject`, `body`, `status`, `sentAt`, `errorMessage`. This IS the audit trail. However, it's not queryable from the admin UI.

**Action:** No code change needed for audit logging itself — it's already there. Optionally add an admin endpoint to query notification history by userId/eventType, but this is separate scope.

---

## Phase 2 — Single-Recipient Enforcement (Behavior Changes)

This is the core business rule fix: **each notification event should send to exactly one dedicated person.**

### 2.1 REQUEST_CREATED — Remove agent notification

**File:** `backend/src/controllers/request.controller.ts:1290-1314`

**Current behavior:** Two separate `notify()` calls:
1. Line 1291: Notify `request.requesterId` with `REQUEST_CREATED`
2. Line 1305: Notify `request.assignedToId` with `REQUEST_CREATED` (only if no auto-assignment happened)

**Problem:** The assigned agent already gets a `REQUEST_ASSIGNED` notification (line 1280). Sending `REQUEST_CREATED` to the agent as well means two emails for the same ticket creation event.

**Change:** Remove the second `notify()` block (lines 1304-1313). The agent gets informed via `REQUEST_ASSIGNED`, not `REQUEST_CREATED`.

```typescript
// REMOVE THIS BLOCK:
// if (!assignResult.success && request.assignedToId) {
//     await notify({
//         userId: request.assignedToId,
//         eventType: 'REQUEST_CREATED',
//         variables: { ... },
//         relatedRequestId: request.id,
//     });
// }
```

**Update registry:** Change `recipientDescription` from `'Requester + Assigned agent'` to `'Requester'`

**File:** `backend/src/controllers/notificationTemplate.controller.ts:23`

```typescript
// BEFORE:
recipientDescription: 'Requester + Assigned agent',
// AFTER:
recipientDescription: 'Requester',
```

**Risk:** Low — the agent still gets `REQUEST_ASSIGNED`. The requester still gets `REQUEST_CREATED`. No one loses information.

---

### 2.2 SLA_BREACHED — Send to assigned agent only

**File:** `backend/src/services/sla.service.ts:49-58`

**Current behavior:**
```typescript
const notifyIds: string[] = [];
if (req.assignedToId) notifyIds.push(req.assignedToId);
adminIds.forEach((id) => {
  if (!notifyIds.includes(id)) notifyIds.push(id);
});
await notifyMultiple(notifyIds, 'SLA_BREACHED', { ... });
```

Sends to: assigned agent + ALL admin users.

**Change:** Only notify the assigned agent. Remove the admin broadcast.

```typescript
// BEFORE:
const notifyIds: string[] = [];
if (req.assignedToId) notifyIds.push(req.assignedToId);
adminIds.forEach((id) => {
  if (!notifyIds.includes(id)) notifyIds.push(id);
});
await notifyMultiple(notifyIds, 'SLA_BREACHED', { ... }, req.id);

// AFTER:
if (req.assignedToId) {
  await notify({
    userId: req.assignedToId,
    eventType: 'SLA_BREACHED',
    variables: {
      referenceNumber: req.referenceNumber,
      slaDeadline: req.slaDueAt?.toISOString() ?? '',
    },
    relatedRequestId: req.id,
  });
} else {
  // No agent assigned — fall back to admin notification
  await notifyMultiple(adminIds, 'SLA_BREACHED', {
    referenceNumber: req.referenceNumber,
    slaDeadline: req.slaDueAt?.toISOString() ?? '',
  }, req.id);
}
```

**Logic:** If an agent is assigned, that one person is responsible. If no agent is assigned (edge case), fall back to notifying admins — but still as individual emails, not a broadcast where everyone sees each other.

**Update registry:** Change `recipientDescription` from `'Agent + Managers'` to `'Assigned agent (or admins if unassigned)'`

**File:** `backend/src/controllers/notificationTemplate.controller.ts:27`

---

### 2.3 SLA_ESCALATED — Send to one escalation handler

**File:** `backend/src/services/sla.service.ts:131-143`

**Current behavior:**
```typescript
const usersToNotify = await prisma.user.findMany({
  where: { roles: { some: { role: { name: { in: rule.notifyRoles } } } } },
  select: { id: true },
});
const notifyIds = usersToNotify.map((u) => u.id);
await notifyMultiple(notifyIds, 'SLA_ESCALATED', { ... });
```

Sends to: ALL users matching the escalation rule's `notifyRoles` (e.g., all ADMINs, all MANAGERs).

**Change:** Notify only the first eligible user in the escalation role hierarchy — the most senior person who should handle it.

```typescript
// BEFORE:
const usersToNotify = await prisma.user.findMany({
  where: { roles: { some: { role: { name: { in: rule.notifyRoles } } } } },
  select: { id: true },
});
const notifyIds = usersToNotify.map((u) => u.id);
if (notifyIds.length > 0) {
  await notifyMultiple(notifyIds, 'SLA_ESCALATED', { ... }, req.id);
}

// AFTER:
// Pick the first eligible escalation handler — one dedicated person
const escalationHandlers = await prisma.user.findMany({
  where: {
    isActive: true,
    roles: { some: { role: { name: { in: rule.notifyRoles } } } },
  },
  select: { id: true },
  orderBy: { createdAt: 'asc' }, // longest-serving = most senior
  take: 1,
});
if (escalationHandlers.length > 0) {
  await notify({
    userId: escalationHandlers[0].id,
    eventType: 'SLA_ESCALATED',
    variables: {
      referenceNumber: req.referenceNumber,
      escalationHours: String(rule.triggerHoursAfterBreach),
      escalationLabel: rule.label || '',
      notifyRoles: rule.notifyRoles.join(', '),
    },
    relatedRequestId: req.id,
  });
}
```

**Risk:** Medium — this is a deliberate behavior change. If the business wants ALL managers to see SLA escalations, this change narrows it to one person. However, the in-app notification (SSE push) still creates records for visibility in dashboards. We're only changing the EMAIL to one person.

**Optional enhancement:** Change from `notify()` to `notify()` for email + keep `notifyMultiple()` but with `channel: 'IN_APP'` only for the others. This requires a deeper refactor (adding channel filtering to `notify()`), so we defer to Phase 3.

**Update registry:** Change `recipientDescription` from `'Escalation target roles'` to `'Escalation handler (senior-most in role)'`

---

### 2.4 Credit events — Split multi-recipient into single-recipient

**File:** `backend/src/credit/services/creditNotification.service.ts`

**Current behavior:** Events like `credit_application_submitted` notify both RM and Analyst via `notifyMultiple()`.

**Philosophy:** In credit workflows, different roles need different information. The RM needs to know a new application was assigned to them. The Analyst needs to know they have a new application to review. These are different contexts — they should get different, role-specific notifications.

**Change:** For each multi-recipient credit event, split into role-specific single-recipient notifications:

| Current Event | Recipients | Split Into |
|---|---|---|
| `credit_application_submitted` | RM + Analyst | RM gets `credit_rm_assigned`, Analyst gets `credit_analyst_assigned` |
| `credit_application_approved` | RM + Analyst | RM gets `credit_application_approved` (notify RM), Analyst gets `credit_application_approved` (notify Analyst) — same event type but separate `notify()` calls |
| `credit_approval_requested` | RM + all approvers | Keep RM notification, but for approvers: only notify the NEXT-level approver (single person), not all eligible approvers |
| `credit_application_withdrawn` | RM + Analyst + approvers | Same as approved — separate `notify()` per role |
| `disbursement_completed` | RM + Analyst + approvers | Same pattern — separate `notify()` per role |

**Implementation approach:** Instead of `notifyMultiple()`, use individual `notify()` calls per role:

```typescript
// BEFORE (creditNotification.service.ts ~line 260):
await notifyMultiple(targetUserIds, eventType, variables, undefined);

// AFTER:
for (const userId of targetUserIds) {
  await notify({ userId, eventType, variables });
}
// This already sends one email per person — but the semantic change
// is that we now document this as intentional single-recipient behavior
// and will later split event types per role for clearer templates.
```

**Actually — wait.** Looking at the code more carefully, `notifyMultiple()` already calls `notify()` per person. Each person gets their OWN individual email. The real issue is: should a single event trigger notifications to multiple people at all?

Business decision needed:
- **Option A (Strict single-recipient):** Each credit event sends to exactly ONE person (the most relevant role). RM for status changes, next-level approver for approvals, etc.
- **Option B (Role-specific multi-notify OK):** Multiple people CAN get notified, but each gets a role-appropriate message with distinct event types.
- **Option C (Current + dedup):** Keep current behavior but add dedup so nobody gets duplicate emails. Accept that multiple people get notified.

**Recommendation:** Option B is the most practical. Different roles need different email content. Split event types per role, each going to exactly one person.

For Phase 2, we do **Option C** (keep current, add dedup from 1.1). Phase 3 will handle the role-specific event type split for credit.

---

### 2.5 Disbursement events — Fix potential double-notify

**File:** `backend/src/credit/services/disbursement.service.ts:409-420`

**Current code:**
```typescript
const targetIds: string[] = [];
if (app.assignedRmId && app.assignedRmId !== actorId) targetIds.push(app.assignedRmId);
if (app.assignedAnalystId && app.assignedAnalystId !== actorId) targetIds.push(app.assignedAnalystId);
await notifyMultiple(targetIds, eventType, { ... });
```

**Issue:** If `assignedRmId === assignedAnalystId` (same person holds both roles), they'd get two emails without the Phase 1 dedup fix.

**Fix:** After Phase 1.1 is applied, this is automatically fixed by `[...new Set(userIds)]` in `notifyMultiple()`.

No additional code change needed here.

---

### 2.6 CRM lead_aging — Two events, two people (acceptable)

**File:** `backend/src/services/crm-automation.service.ts:144-167`

**Current behavior:**
1. Owner gets `crm_lead_aging` (one event, one person)
2. Owner's manager gets `crm_lead_aging_manager` (different event, different person)

**Assessment:** This is actually CORRECT behavior. These are two distinct event types, each going to one dedicated person. The manager's notification is a separate, appropriate escalation — not a duplicate blast.

**No change needed.** The registry already correctly describes them:
- `crm_lead_aging` → "Lead owner"
- `crm_lead_aging_manager` → "Owner's manager"

---

### 2.7 CRM rep_inactivity — Verify current behavior

**Note:** The `crm_rep_inactivity` event type is registered in the template controller but was not found as a trigger in the searched service files. If it uses `notifyMultiple()` with all SALES_MANAGER users, it should be changed to notify only the specific rep's manager (one person).

**Action:** Search and update when the CRM rep inactivity job is implemented or located.

---

## Phase 3 — Admin UI Label Corrections

### 3.1 Fix misleading `recipientDescription` values

**File:** `backend/src/controllers/notificationTemplate.controller.ts`

| Line | Event Type | Current Label | New Label |
|---|---|---|---|
| 23 | `REQUEST_CREATED` | "Requester + Assigned agent" | "Requester" (after fix 2.1) |
| 27 | `SLA_BREACHED` | "Agent + Managers" | "Assigned agent (or admins if unassigned)" |
| 28 | `SLA_ESCALATED` | "Escalation target roles" | "Escalation handler (senior-most in role)" |
| 35 | `VP_APPROVAL_REQUIRED` | "VP users" | "VP approver" |
| 42 | `APPROVAL_REQUIRED` | "CEO / CTO" | "Executive approver" |

### 3.2 Add or remove dead event types

**Option A — Wire them up:**
- `MANAGER_APPROVAL_REQUIRED`: Implement trigger in IT workflow when a request requires manager approval
- `COMMENT_ADDED`: Implement trigger in comment controller when a new comment is added

**Option B — Remove from registry:**
Remove these entries from `EVENT_TYPE_REGISTRY` so they don't show as "Unconfigured" in the admin UI.

**Recommendation:** Wire them up. `COMMENT_ADDED` is especially important for user experience — requesters should be notified when someone comments on their ticket.

---

## Phase 4 — Dead Event Type Cleanup

### 4.1 Implement `COMMENT_ADDED` trigger

**File to modify:** `backend/src/controllers/request.controller.ts` (or a new comment controller if comments have their own endpoint)

**Add after comment creation:**
```typescript
// Notify the relevant parties about the new comment
const isRequesterComment = comment.authorId === request.requesterId;
const isAssigneeComment = comment.authorId === request.assignedToId;

if (isRequesterComment) {
  // Comment from requester → notify assignee
  if (request.assignedToId) {
    await notify({
      userId: request.assignedToId,
      eventType: 'COMMENT_ADDED',
      variables: { ... },
      relatedRequestId: request.id,
    });
  }
} else {
  // Comment from agent or third party → notify requester
  await notify({
    userId: request.requesterId,
    eventType: 'COMMENT_ADDED',
    variables: { ... },
    relatedRequestId: request.id,
  });
}
```

### 4.2 Implement `MANAGER_APPROVAL_REQUIRED` trigger

**Where:** In the IT workflow approval flow, when a request requires manager-level approval (e.g., hardware request over a price threshold).

This requires identifying the specific controller point where manager approval kicks in. Likely in `request.controller.ts` or `it-workflow.controller.ts` where the approval routing logic lives.

---

## Phase 5 — Optional Enhancements (Future Sprint)

### 5.1 Credit module: Split event types per role

Currently credit events use one event type for multiple roles. Splitting gives:
- Better per-role email templates
- Clearer `recipientDescription` in admin UI
- True single-recipient per event type

Example:
- `credit_application_submitted_rm` → "Assigned RM"
- `credit_application_submitted_analyst` → "Assigned Analyst"

### 5.2 Notification preferences per user

Allow users to opt in/out of specific event types. This requires a new `NotificationPreference` model and UI.

### 5.3 Email delivery audit UI

Add an admin page to search/filter notification history by userId, eventType, channel, status, date range.

---

## Execution Order & Risk Assessment

| Phase | Item | Risk | Effort | Sprint |
|---|---|---|---|---|
| 1.1 | `notifyMultiple()` dedup | Zero | 5 min | Current |
| 2.1 | Remove agent from `REQUEST_CREATED` | Low | 15 min | Current |
| 2.2 | `SLA_BREACHED` → single agent | Low | 20 min | Current |
| 2.3 | `SLA_ESCALATED` → single handler | Medium | 30 min | Current |
| 3.1 | Fix `recipientDescription` labels | Zero | 10 min | Current |
| 4.1 | Implement `COMMENT_ADDED` trigger | Low | 45 min | Next |
| 4.2 | Implement `MANAGER_APPROVAL_REQUIRED` trigger | Low | 45 min | Next |
| 5.1 | Credit event type split per role | Medium | 2-3 hrs | Future |
| 5.2 | User notification preferences | Medium | 1-2 days | Future |
| 5.3 | Email delivery audit UI | Low | 4-6 hrs | Future |

**Total Phase 1+2+3 effort:** ~1.5 hours
**Total Phase 4 effort:** ~1.5 hours
**Total Phase 5 effort:** 2-4 days

---

## Test Plan

After each phase:

1. **Phase 1:** Create a request where RM and Analyst are the same person → verify only ONE email sent (dedup works)
2. **Phase 2.1:** Create a request as a regular user, verify only the requester gets `REQUEST_CREATED` email, and the agent only gets `REQUEST_ASSIGNED`
3. **Phase 2.2:** Trigger SLA breach (or test with existing breached request) → verify only the assigned agent gets the email, admins do not
4. **Phase 2.3:** Create an escalation rule, trigger SLA escalation → verify only ONE handler gets the email
5. **Phase 3.1:** Login as admin, go to Email Notifications settings page → verify all labels match the new descriptions
6. **Phase 4.1:** Add a comment on a request → verify the other party (requester or assignee) gets `COMMENT_ADDED` notification