# HELP CENTER — PRIORITIZED IMPLEMENTATION PLAN

**Based on:** Audit Report dated April 21, 2026
**Approach:** Impact-first, one task at a time

---

## HOW TO READ THIS PLAN

Each task has:
- **Priority:** P0 (launch blocker) / P1 (high impact) / P2 ( polish)
- **Impact:** Security / Workflow / UX / Operations
- **Effort:** Small / Medium / Large
- **Prerequisite:** What must be done first

---

## PHASE 1 — P0 CRITICAL (Fix Before Anything Else)

These are launch blockers. Do not build anything new until these are done.

---

### TASK 1: Add Input Sanitization (XSS Prevention) ✅ DONE
**Priority:** P0 | **Impact:** Security | **Effort:** Small | **Files:** ~5

**Why huge impact:**
Your system accepts user text in descriptions, comments, and activity feeds. Without sanitization, any user can inject malicious JavaScript that steals session tokens of anyone who views that ticket. This is a critical data breach vector.

**What to do:**
```
Backend:
- npm install validator (or dompurify on frontend)
- Add sanitization to request.controller.ts — summary, description fields
- Add sanitization to requestActivity — message field
- Add sanitization to user firstName/lastName fields

Frontend:
- npm install dompurify
- Sanitize all {dangerouslySetInnerHTML} usage in RequestDetail.tsx
- Sanitize comment/message rendering in ActivityFeed.tsx
```

**Verification:** Try creating a ticket with `<script>alert('xss')</script>` in the title. It should display as text, not execute.

---

### TASK 2: Fix File Upload Validation ✅ DONE
**Priority:** P0 | **Impact:** Security | **Effort:** Small | **Files:** ~3

**Why huge impact:**
Right now anyone can upload an .exe, .php, or .bat file. This is the #1 way attackers gain initial access in internal tools.

**What to do:**
```
Backend — request.controller.ts or a dedicated upload middleware:

Allowed MIME types:
- Images: image/jpeg, image/png, image/gif, image/webp
- Documents: application/pdf, application/msword, 
  application/vnd.openxmlformats-officedocument.wordprocessingml.document
- Spreadsheets: application/vnd.ms-excel, 
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Text: text/plain, text/csv

Max file size: 10MB (already in app.ts body limit)

Block list (reject outright):
- application/x-msdownload
- application/x-executable
- application/x-sh
- text/x-shellscript
- Any application/javascript

Virus scan stub (add now, integrate ClamAV later):
- Save a flag `isScanned: false` (already in schema)
- Log un-scanned files for manual review
```

---

### TASK 3: Make Workflow Transitions DB-Driven ✅ DONE
**Priority:** P0 | **Impact:** Workflow | **Effort:** Large | **Files:** ~8

**Why huge impact:**
Right now every status transition lives in `workflowTransitions.ts` as a hardcoded map. To add a single new status or change approval logic you need a developer and a code deployment. This makes the system unmaintainable. Your 5 broken workflow transitions (VP_APPROVED_IT loop, rejection dead-ends) prove this approach has already caused bugs.

**What to do:**

```
Step 1 — Seed current transitions into DB
Use the existing RequestStatusDefinition table (which already exists!)
Add a `nextStatuses` JSON field or a separate WorkflowTransition table:

Table: WorkflowTransition
- id
- fromStatus (the current status)
- toStatus (allowed next status)
- transitionLabel: "Approve" | "Reject" | "Request Info"
- requiresComment: boolean
- autoAssignTo: optional role/userId hint

Step 2 — Replace workflowTransitions.ts usage
Change isValidTransition() to query DB instead of the hardcoded map.
Keep the VALID_TRANSITIONS map as a SEED reference, not the source of truth.

Step 3 — Fix the broken transitions
- VP_APPROVED_IT → PROCUREMENT_IN_PROGRESS (not back to MANAGER_APPROVED_IT)
- MANAGER_REJECTED_FIN → SUBMITTED (notify requester)
- MANAGER_REJECTED_IT → SUBMITTED (notify requester, refund budget hold)
- HR_SCREENING completion → auto-create LOA_PENDING_APPROVAL record
- Onboarding COMPLETED → RESOLVED (close parent request)

Step 4 — Add admin UI
Use existing AdminSettings → workflow-config tab
Read from DB, allow admin to add/remove transitions (with caution UX)
```

**Effort breakdown:**
- DB schema change: 1 hour
- Seed data migration: 2 hours
- Refactor isValidTransition(): 3 hours
- Fix 5 broken transitions: 4 hours
- Admin UI: 6 hours
- **Total: ~16 hours**

---

### TASK 4: SLA Checker — 1 Minute Interval ✅ DONE
**Priority:** P0 | **Impact:** Operations / Compliance | **Effort:** Tiny | **Files:** 1

**Why huge impact:**
Every 15 minutes means a ticket can be in SLA breach for nearly 15 minutes before anyone is notified. In regulated environments (IT, HR compliance) this is unacceptable.

**What to do:**
```
backend/src/jobs/sla-checker.ts:

Change: const CHECK_INTERVAL_MS = 15 * 60 * 1000;
To:     const CHECK_INTERVAL_MS = 1 * 60 * 1000;

Also add to the check:
- resolvedAt should stop the SLA timer (already handled)
- On status = WAITING, consider pausing SLA (debate with stakeholders first)
```

---

### TASK 5: Audit Trail — Make It Mandatory ✅ DONE
**Priority:** P0 | **Impact:** Security / Compliance | **Effort:** Medium | **Files:** ~5

**Why huge impact:**
Your AuditLog table exists but is not consistently called. Role changes, status overrides, and permission grants are not logged. If something goes wrong, you have no forensic trail.

**What to do:**
```
Step 1 — Create an audit middleware/wrapper
backend/src/utils/audit.ts:

export function auditLog(action: string, resourceType: string) {
  return async (req: AuthRequest, newValues: any, oldValues?: any) => {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email,
        action,
        resourceType,
        resourceId: newValues.id,
        oldValues: oldValues ?? undefined,
        newValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    });
  };
}

Step 2 — Wrap these critical operations:
- user.controller.ts — role assignment, user deactivation, user creation
- request.controller.ts — status changes, assignment changes
- approval.controller.ts — all approval/rejection actions
- it-workflow.controller.ts — CFO/CTO/CEO approval actions

Step 3 — Add audit log viewer in Admin settings
```

---

## PHASE 2 — P1 HIGH IMPACT (Do After P0)

---

### TASK 6: Fix CFO/CTO Role — Put in Role Table ✅ DONE
**Priority:** P1 | **Impact:** Security | **Effort:** Small | **Files:** ~5

**Why huge impact:**
CEO, CTO, and CFO are checked as string literals in `request.controller.ts` (`req.user!.roles.includes('CTO')`). Everyone else uses the Role/Permission tables. This inconsistency means:
- You can't revoke CTO access via admin UI
- Permissions are not audited
- Role checks are scattered across the codebase

**What to do:**
```
1. Add CEO, CTO, CFO to the roles table (seed in prisma/seed.ts)
2. Replace all string literal role checks with proper Role table lookups
3. Search entire codebase:
   - "includes('CEO')" → use Role-based check
   - "includes('CTO')" → use Role-based check
   - "includes('CFO')" → use Role-based check
4. Remove the special case OR clauses in getAllRequests
   Replace with proper permission-based filtering
```

---

### TASK 7: Real-Time Notifications (WebSocket or SSE) ✅ DONE
**Priority:** P1 | **Impact:** UX / Engagement | **Effort:** Medium | **Files:** ~8

**Why huge impact:**
Right now users must refresh the page to see new notifications. This creates a poor experience and means urgent SLA breaches or approval requests are missed.

**Two options (choose one):**

**Option A — Server-Sent Events (Easier, recommended for MVP)**
```
Backend:
- npm install express-sse-ts
- Add SSE endpoint: GET /api/v1/notifications/stream
- On any notification.create, push to connected SSE clients

Frontend:
- In AuthContext, open EventSource to /notifications/stream
- On message, increment notification badge and show toast
- No page refresh needed
```

**Option B — Socket.io (More scalable later)**
```
- More setup, but handles reconnection automatically
- Better for if you add chat later
```

**Recommended:** Option A (SSE) — 1 day vs 3 days for Socket.io

---

### TASK 8: Replace HashRouter with BrowserRouter ✅ DONE
**Priority:** P1 | **Impact:** UX | **Effort:** Small | **Files:** 1

**Why huge impact:**
- URLs look unprofessional: `helpdesk.com/#/request/123`
- Cannot copy/share a clean link
- Poor SEO if any part goes public
- Analytics tools can't track hash routes properly

**What to do:**
```
1. In frontend/App.tsx:
   Change: import { HashRouter } from 'react-router-dom';
   To:     import { BrowserRouter, createHistory } from 'react-router-dom';

2. For production deployment, configure your server:
   - Nginx: try_files $uri $uri/ /index.html
   - Or deploy to Netlify/Vercel which handles this automatically

3. Update any hardcoded hash-based navigation:
   - Search for window.location.hash in codebase
   - Replace with navigate() from react-router-dom

4. Update Vite config for proper base path if not at root
```

---

### TASK 9: Mobile Responsive Layout ✅ DONE
**Priority:** P1 | **Impact:** UX | **Effort:** Medium | **Files:** ~10

**Why huge impact:**
Your entire UI is desktop-first. Staff who work in warehouses, factories, or field locations will be on mobile. A broken mobile experience means they bypass the system entirely.

**What to do:**
```
Priority pages to make mobile-friendly (in order):
1. Dashboard — service desk cards (already likely responsive)
2. MyRequests — table → card list on mobile
3. RequestDetail — sidebar collapses, action buttons stack
4. HRServices / ITSupport / GroupFinance — category grid → scrollable list
5. CreateRequest — form fields stack vertically

Quick wins with existing Tailwind:
- Replace hidden sm:block with proper responsive classes
- tables → div-based cards on mobile (use sm:grid for breakpoint)
- Sticky headers work on mobile already
- Action buttons in RequestDetail need a sticky bottom bar on mobile

Time estimate: 1-2 days focused work
```

---

### TASK 10: Build Permission Matrix UI ✅ DONE
**Priority:** P1 | **Impact:** Security / Admin | **Effort:** Medium | **Files:** ~6

**Why huge impact:**
You have a full Role/Permission/UserRole schema but the only way to assign permissions is through direct database manipulation. Admins cannot manage who can do what.

**What to do:**
```
1. In AdminSettings.tsx — add a new tab: "Permissions"
2. Show all roles in a matrix: Rows = roles, Columns = resources
3. Each cell: checkbox for CREATE / READ / UPDATE / DELETE
4. On change, update RolePermission table
5. Replace hardcoded permission checks in controllers with:
   - A hasPermission(user, resource, action) helper
   - Use it in all controllers

Permissions to model:
- request: create, read, read-own, read-all, update, delete
- user: create, read, update, delete, assign-role
- report: read
- admin: access-settings, manage-workflow, manage-templates
- approval: approve, reject
```

---

## PHASE 3 — P2 POLISH (Do After P1)

---

### TASK 11: Add Report Export (CSV)
**Priority:** P2 | **Impact:** Operations | **Effort:** Small | **Files:** ~3

**Why:** Reports page has data but no way to export. Managers need to share with leadership.

---

### TASK 12: Empty States & Loading Skeletons
**Priority:** P2 | **Impact:** UX | **Effort:** Small | **Files:** ~5

**Why:** Blank pages with no guidance confuse users. Every table and list needs an empty state illustration + CTA.

---

### TASK 13: Add Breadcrumbs
**Priority:** P2 | **Impact:** UX | **Effort:** Small | **Files:** ~3

**Why:** Users in deep IT workflows (12+ status changes) lose track of where they are.

---

### TASK 14: Notification Read/Unread + Pagination
**Priority:** P2 | **Impact:** UX | **Effort:** Small | **Files:** ~3

**Why:** NotificationDropdown grows forever. No way to mark as read.

---

### TASK 15: Onboarding Auto-Create System User
**Priority:** P2 | **Impact:** Operations | **Effort:** Medium | **Files:** ~4

**Why:** When onboarding completes, the new hire still doesn't have a system account. Must be created manually.

---

## EXECUTION ORDER (One-by-One)

```
Week 1: ✅ COMPLETE
  [x] Task 1 — Input Sanitization (P0)
  [x] Task 2 — File Upload Validation (P0)

Week 2: ✅ COMPLETE
  [x] Task 4 — SLA 1-Minute Interval (P0)
  [x] Task 6 — CFO/CTO Roles in DB (P1)

Week 3: ✅ COMPLETE
  [x] Task 3 — DB-Driven Workflows (P0)

Week 4: ✅ COMPLETE
  [x] Task 5 — Mandatory Audit Trail (P0)
  [x] Task 8 — BrowserRouter (P1)

Week 5: ✅ COMPLETE
  [x] Task 7 — Real-Time Notifications (P1)
  [x] Task 9 — Mobile Responsive (P1)

Week 6: ✅ COMPLETE
  [x] Task 10 — Permission Matrix UI (P1)

Week 7-8: ← CURRENT
  [ ] Tasks 11-15 (P2 items)

Total: ~8 weeks for MVP-ready
```

---

## QUICK WINS FIRST (1-Day Tasks)

These give immediate wins with minimal effort:

1. **Task 4** — SLA 1 minute (change 1 number, 5 minutes)
2. **Task 8** — HashRouter → BrowserRouter (1 file change + nginx config)
3. **Task 12** — Empty states (add conditional renders with friendly messages)
4. **Task 14** — Notification read/unread (add a boolean column + toggle)
5. **Task 2** — File type block list (30 lines of validation code)

---

*Plan version: 1.1*
*Created: April 21, 2026*
*Last updated: April 21, 2026 — Tasks 1–6 complete (all P0s + Task 6 P1)*
