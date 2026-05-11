# CRM Notification Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRM notification bugs — raw event names displayed in the bell dropdown, duplicate notifications flooding users, missing admin template registry entries, and the startup-fires-immediately bug in the CRM scheduler.

**Architecture:** Three layers of fixes: (1) seed human-readable notification templates for all 7 CRM event types so the bell shows real text; (2) add deduplication guards in the CRM automation service using a `lastNotifiedAt` pattern stored in-memory per scheduler run; (3) fix the CRM scheduler to not fire every check immediately on every server startup.

**Tech Stack:** Node.js + Express + TypeScript, Prisma + PostgreSQL, node-cron

---

## Bug Summary

| ID | Severity | Root Cause | Fix |
|----|----------|------------|-----|
| B1 | CRITICAL | No notification templates for 7 CRM event types → fallback renders raw event name | Task 1–2 |
| B2 | HIGH | `scheduleTask()` calls `task()` immediately on startup — server restart = instant duplicate notifications | Task 3 |
| B3 | HIGH | No deduplication: same stale lead notified on every scheduler run | Task 4 |
| B4 | MEDIUM | CRM event types absent from `EVENT_TYPE_REGISTRY` → admins can't manage CRM templates in Admin Settings | Task 5 |

---

## File Map

| File | Action | What Changes |
|------|--------|--------------|
| `backend/prisma/seed-admin-config.ts` | Modify | Add 7 CRM notification template objects to `SEED_NOTIFICATION_TEMPLATES` |
| `backend/src/controllers/notificationTemplate.controller.ts` | Modify | Add 7 CRM entries to `EVENT_TYPE_REGISTRY` (lines 23–68) |
| `backend/src/jobs/crm-checker.ts` | Modify | Remove startup immediate-run from `scheduleTask()`; add optional `runOnStartup` config flag |
| `backend/src/services/crm-automation.service.ts` | Modify | Add per-run deduplication sets for lead aging and overdue follow-up checks |

---

## Task 1: Seed CRM Notification Templates — Part A (Lead Events)

**Files:**
- Modify: `backend/prisma/seed-admin-config.ts`

- [ ] **Step 1: Open the file and find the end of the SEED_NOTIFICATION_TEMPLATES array**

```bash
grep -n "SEED_NOTIFICATION_TEMPLATES\|\]\s*;" backend/prisma/seed-admin-config.ts | tail -5
```

The array ends before the closing `];`. You will append entries before that closing bracket.

- [ ] **Step 2: Add the four lead-related CRM templates**

Append these four objects inside the `SEED_NOTIFICATION_TEMPLATES` array (before the closing `];`):

```typescript
  // ── CRM: Lead Aging (owner) ──────────────────────────────────────────────
  {
    name: 'CRM Lead Aging — Owner',
    eventType: 'crm_lead_aging',
    emailSubject: 'Action Required: Lead "{{leadTitle}}" has been inactive for {{daysStale}} days',
    emailBody: `<p>Hi {{userName}},</p>
<p>Your lead <strong>{{leadTitle}}</strong> has had no activity for <strong>{{daysStale}} days</strong>.</p>
<p>Please log an activity or update the status to keep your pipeline healthy.</p>
<p><a href="{{appUrl}}/crm/leads">View Leads</a></p>`,
    pushTitle: 'Lead inactive: {{leadTitle}}',
    pushBody: 'No activity for {{daysStale}} days. Tap to review.',
    isActive: true,
  },

  // ── CRM: Lead Aging (manager) ────────────────────────────────────────────
  {
    name: 'CRM Lead Aging — Manager',
    eventType: 'crm_lead_aging_manager',
    emailSubject: 'Pipeline Alert: {{ownerName}}\'s lead "{{leadTitle}}" is stale ({{daysStale}} days)',
    emailBody: `<p>Hi {{userName}},</p>
<p><strong>{{ownerName}}</strong>'s lead <strong>{{leadTitle}}</strong> has had no activity for <strong>{{daysStale}} days</strong>.</p>
<p>You may want to follow up with your team member.</p>
<p><a href="{{appUrl}}/crm/leads">View Leads</a></p>`,
    pushTitle: 'Stale lead: {{leadTitle}}',
    pushBody: '{{ownerName}} has not updated this lead in {{daysStale}} days.',
    isActive: true,
  },

  // ── CRM: Overdue Follow-Up ───────────────────────────────────────────────
  {
    name: 'CRM Overdue Follow-Up',
    eventType: 'crm_overdue_followup',
    emailSubject: 'Overdue Follow-Up: "{{leadTitle}}" was due on {{followUpDate}}',
    emailBody: `<p>Hi {{userName}},</p>
<p>Your follow-up for lead <strong>{{leadTitle}}</strong> was scheduled for <strong>{{followUpDate}}</strong> and is now overdue.</p>
<p>Please contact the lead or reschedule the follow-up date.</p>
<p><a href="{{appUrl}}/crm/leads">View Leads</a></p>`,
    pushTitle: 'Overdue follow-up: {{leadTitle}}',
    pushBody: 'Follow-up was due {{followUpDate}}. Take action now.',
    isActive: true,
  },

  // ── CRM: Activity Reminder ───────────────────────────────────────────────
  {
    name: 'CRM Activity Reminder',
    eventType: 'crm_activity_reminder',
    emailSubject: 'Reminder: "{{activitySubject}}" is scheduled for {{scheduledTime}}',
    emailBody: `<p>Hi {{userName}},</p>
<p>This is a reminder that your CRM activity <strong>{{activitySubject}}</strong> is coming up on <strong>{{scheduledTime}}</strong>.</p>
<p><a href="{{appUrl}}/crm">Open CRM</a></p>`,
    pushTitle: 'Activity reminder: {{activitySubject}}',
    pushBody: 'Scheduled for {{scheduledTime}}.',
    isActive: true,
  },
```

- [ ] **Step 3: Verify the array is syntactically valid**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "seed-admin-config" | head -10
```

Expected: no errors mentioning `seed-admin-config.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed-admin-config.ts
git commit -m "feat(notifications): seed CRM lead/activity/follow-up notification templates"
```

---

## Task 2: Seed CRM Notification Templates — Part B (Deal & Trust Events)

**Files:**
- Modify: `backend/prisma/seed-admin-config.ts`

- [ ] **Step 1: Append three more templates to the array (after the four from Task 1)**

```typescript
  // ── CRM: Stale Deal ──────────────────────────────────────────────────────
  {
    name: 'CRM Stale Deal',
    eventType: 'crm_stale_deal',
    emailSubject: 'Deal Alert: "{{dealName}}" expected close date {{expectedCloseDate}} has passed',
    emailBody: `<p>Hi {{userName}},</p>
<p>Your deal <strong>{{dealName}}</strong> had an expected close date of <strong>{{expectedCloseDate}}</strong> which has now passed.</p>
<p>Please update the deal status or revise the expected close date.</p>
<p><a href="{{appUrl}}/crm/opportunities">View Deals</a></p>`,
    pushTitle: 'Stale deal: {{dealName}}',
    pushBody: 'Expected close {{expectedCloseDate}} has passed. Update required.',
    isActive: true,
  },

  // ── CRM: Trust Review Due ────────────────────────────────────────────────
  {
    name: 'CRM Trust Product Review Due',
    eventType: 'crm_trust_review_due',
    emailSubject: 'Trust Review Due in {{daysUntilReview}} Days: {{trustType}} — {{accountName}}',
    emailBody: `<p>Hi {{userName}},</p>
<p>The trust product <strong>{{trustType}}</strong> for account <strong>{{accountName}}</strong> is due for review in <strong>{{daysUntilReview}} days</strong> ({{nextReviewDate}}).</p>
<p>Please schedule a client review meeting and prepare the necessary documentation.</p>
<p><a href="{{appUrl}}/crm/accounts">View Accounts</a></p>`,
    pushTitle: 'Trust review in {{daysUntilReview}} days',
    pushBody: '{{trustType}} for {{accountName}} — review due {{nextReviewDate}}.',
    isActive: true,
  },

  // ── CRM: Lead Auto-Assigned ──────────────────────────────────────────────
  {
    name: 'CRM Lead Auto-Assigned',
    eventType: 'crm_lead_auto_assigned',
    emailSubject: 'New Lead Assigned to You',
    emailBody: `<p>Hi {{userName}},</p>
<p>A new lead has been automatically assigned to you via round-robin assignment.</p>
<p>Please review and begin outreach as soon as possible.</p>
<p><a href="{{appUrl}}/crm/leads">View Your Leads</a></p>`,
    pushTitle: 'New lead assigned to you',
    pushBody: 'A new lead has been auto-assigned. Tap to view.',
    isActive: true,
  },
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "seed-admin-config" | head -10
```

Expected: no output (no errors).

- [ ] **Step 3: Re-seed the database to apply templates**

```bash
cd backend && npm run prisma:seed
```

Expected output includes lines like:
```
✓ Notification templates upserted
```

- [ ] **Step 4: Verify templates in the database**

```bash
cd backend && npx prisma studio
```

Open NotificationTemplate table in browser. Confirm 7 new CRM rows exist with `isActive: true`.

Alternatively verify via psql/query:
```bash
cd backend && npx ts-node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.notificationTemplate.findMany({where:{eventType:{startsWith:'crm_'}},select:{eventType:true,name:true}}).then(r=>console.log(r)).finally(()=>p.\$disconnect());
"
```

Expected: 7 rows with crm_* eventTypes.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/seed-admin-config.ts
git commit -m "feat(notifications): seed CRM deal/trust/auto-assign notification templates"
```

---

## Task 3: Fix Scheduler Startup Immediate-Run Bug

**Files:**
- Modify: `backend/src/jobs/crm-checker.ts`

**Problem:** `scheduleTask()` at line 74–76 unconditionally calls `task()` on every server startup. In development (frequent restarts) and in production (container restarts), this causes all CRM checks to fire immediately, generating duplicate notifications for the same stale leads.

- [ ] **Step 1: Read the current scheduleTask function (lines 64–90)**

```bash
sed -n '64,90p' backend/src/jobs/crm-checker.ts
```

Current code:
```typescript
function scheduleTask(
  label: string,
  cronExpr: string,
  task: () => Promise<void>,
): ScheduledTask | null {
  if (!cron.validate(cronExpr)) {
    logger.error(`[CRM] Invalid cron expression for ${label}: "${cronExpr}" — skipping`);
    return null;
  }

  // Run once immediately on startup
  task();

  const scheduled = cron.schedule(cronExpr, () => {
    ...
  });
  ...
}
```

- [ ] **Step 2: Remove the startup immediate-run call**

In `backend/src/jobs/crm-checker.ts`, replace the `scheduleTask` function body to remove the immediate call:

```typescript
function scheduleTask(
  label: string,
  cronExpr: string,
  task: () => Promise<void>,
): ScheduledTask | null {
  if (!cron.validate(cronExpr)) {
    logger.error(`[CRM] Invalid cron expression for ${label}: "${cronExpr}" — skipping`);
    return null;
  }

  const scheduled = cron.schedule(cronExpr, () => {
    logger.info(`[CRM] Running ${label} (cron: ${cronExpr})`);
    task();
  });

  logger.info(`[CRM] ${label} scheduled (cron: ${cronExpr})`);
  return scheduled;
}
```

Also remove the startup immediate-run block in the `interval` mode branch (lines ~106–115):

```typescript
  } else {
    // Legacy interval mode — run all checks on a shared interval
    const { intervalMs } = config.crmSchedule;
    logger.info(`[CRM] CRM checker started (interval: ${intervalMs / 1000}s)`);

    // REMOVED: immediate startup run that caused duplicates on restart
    setInterval(() => {
      logger.info(`[CRM] Running all checks (interval: ${intervalMs / 1000}s)`);
      runActivityReminders();
      runLeadAging();
      runOverdueFollowUps();
      runStaleDeals();
      runTrustReviewDates();
      runKycExpiration();
    }, intervalMs);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "crm-checker" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/jobs/crm-checker.ts
git commit -m "fix(crm): remove startup immediate-run from scheduler to prevent duplicate notifications on restart"
```

---

## Task 4: Add Deduplication to Lead Aging & Overdue Follow-Up Checks

**Files:**
- Modify: `backend/src/services/crm-automation.service.ts`

**Problem:** Every scheduler run notifies for every stale lead/overdue follow-up it finds. If a lead stays stale across multiple runs (daily), the owner gets daily spam. We add an in-memory per-run set to deduplicate within a single run, and a `lastAgingNotifiedDate` check using a Prisma query to skip leads notified today.

**Approach:** Check whether a `crm_lead_aging` notification was already sent for this user+lead today (by querying the `Notification` table). Skip if found. This is a lightweight guard that doesn't require schema migration.

- [ ] **Step 1: Update `checkLeadAging` to skip leads already notified today**

In `backend/src/services/crm-automation.service.ts`, replace the `checkLeadAging` function:

```typescript
export async function checkLeadAging(): Promise<void> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const activeLeads = await prisma.crmLead.findMany({
    where: {
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: {
        select: { id: true, firstName: true, lastName: true, managerId: true },
      },
    },
  });

  if (activeLeads.length === 0) {
    logger.info('[CRM][LeadAging] No active leads found');
    return;
  }

  const leadIds = activeLeads.map((l) => l.id);

  const recentActivities = await prisma.crmActivity.findMany({
    where: {
      leadId: { in: leadIds },
      createdAt: { gte: sevenDaysAgo },
    },
    select: { leadId: true },
  });

  const leadsWithRecentActivity = new Set(recentActivities.map((a) => a.leadId));
  const staleLeads = activeLeads.filter((l) => !leadsWithRecentActivity.has(l.id));

  if (staleLeads.length === 0) {
    logger.info('[CRM][LeadAging] No stale leads found');
    return;
  }

  logger.info(`[CRM][LeadAging] Found ${staleLeads.length} stale leads`);

  // Collect all owner IDs to check for today's already-sent notifications in bulk
  const ownerIds = [...new Set(staleLeads.map((l) => l.ownerId))];
  const alreadyNotifiedToday = await prisma.notification.findMany({
    where: {
      userId: { in: ownerIds },
      subject: { contains: 'inactive' },
      createdAt: { gte: todayStart },
      channel: 'IN_APP',
    },
    select: { userId: true, subject: true },
  });
  // Build a set of userId keys that already got a lead-aging notification today
  const notifiedSet = new Set(alreadyNotifiedToday.map((n) => n.userId));

  let skipped = 0;
  for (const lead of staleLeads) {
    const ownerName = `${lead.owner.firstName} ${lead.owner.lastName}`;

    if (notifiedSet.has(lead.ownerId)) {
      skipped++;
      continue;
    }

    try {
      await notify({
        userId: lead.ownerId,
        eventType: 'crm_lead_aging',
        variables: {
          leadTitle: lead.title,
          ownerName,
          daysStale: '7',
        },
      });

      if (lead.owner.managerId) {
        await notify({
          userId: lead.owner.managerId,
          eventType: 'crm_lead_aging_manager',
          variables: {
            leadTitle: lead.title,
            ownerName,
            daysStale: '7',
          },
        });
      }
    } catch (err) {
      logger.error(`[CRM][LeadAging] Failed to notify for lead ${lead.id}`, { error: err });
    }
  }

  if (skipped > 0) {
    logger.info(`[CRM][LeadAging] Skipped ${skipped} leads — owners already notified today`);
  }
}
```

- [ ] **Step 2: Update `checkOverdueFollowUps` with the same deduplication pattern**

Replace the `checkOverdueFollowUps` function:

```typescript
export async function checkOverdueFollowUps(): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const overdueLeads = await prisma.crmLead.findMany({
    where: {
      followUpDate: { lt: now },
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      followUpDate: true,
      ownerId: true,
      owner: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (overdueLeads.length === 0) {
    logger.info('[CRM][OverdueFollowUps] No overdue follow-ups found');
    return;
  }

  logger.info(`[CRM][OverdueFollowUps] Found ${overdueLeads.length} overdue follow-ups`);

  const ownerIds = [...new Set(overdueLeads.map((l) => l.ownerId))];
  const alreadyNotifiedToday = await prisma.notification.findMany({
    where: {
      userId: { in: ownerIds },
      subject: { contains: 'Overdue Follow-Up' },
      createdAt: { gte: todayStart },
      channel: 'IN_APP',
    },
    select: { userId: true },
  });
  const notifiedSet = new Set(alreadyNotifiedToday.map((n) => n.userId));

  let skipped = 0;
  for (const lead of overdueLeads) {
    if (notifiedSet.has(lead.ownerId)) {
      skipped++;
      continue;
    }

    const ownerName = `${lead.owner.firstName} ${lead.owner.lastName}`;
    const followUpDate = lead.followUpDate!.toLocaleString();
    try {
      await notify({
        userId: lead.ownerId,
        eventType: 'crm_overdue_followup',
        variables: {
          leadTitle: lead.title,
          followUpDate,
          ownerName,
        },
      });
    } catch (err) {
      logger.error(`[CRM][OverdueFollowUps] Failed to notify owner for lead ${lead.id}`, { error: err });
    }
  }

  if (skipped > 0) {
    logger.info(`[CRM][OverdueFollowUps] Skipped ${skipped} leads — owners already notified today`);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "crm-automation" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/crm-automation.service.ts
git commit -m "fix(crm): add per-day deduplication to lead aging and overdue follow-up notification checks"
```

---

## Task 5: Register CRM Event Types in Admin Template Registry

**Files:**
- Modify: `backend/src/controllers/notificationTemplate.controller.ts`

**Problem:** The `EVENT_TYPE_REGISTRY` array (lines 23–68) does not include any CRM event types. This means:
- The `GET /api/v1/notification-templates/event-types` endpoint doesn't return CRM types
- Admin Settings cannot list, preview, or create CRM templates via the UI

- [ ] **Step 1: Open the file and find the end of EVENT_TYPE_REGISTRY (around line 68)**

```bash
sed -n '60,75p' backend/src/controllers/notificationTemplate.controller.ts
```

Locate the last entry (CHARGEBACK_COMPLETED) and the closing `];`.

- [ ] **Step 2: Append 7 CRM event type entries before the closing `];`**

```typescript
    // ── CRM ─────────────────────────────────────────────────────────────────
    { eventType: 'crm_lead_aging',         label: 'CRM Lead Aging (Owner)',      category: 'CRM', recipientDescription: 'Lead owner',          availableVariables: ['leadTitle', 'ownerName', 'daysStale', 'userName', 'appUrl'] },
    { eventType: 'crm_lead_aging_manager', label: 'CRM Lead Aging (Manager)',    category: 'CRM', recipientDescription: 'Owner\'s manager',     availableVariables: ['leadTitle', 'ownerName', 'daysStale', 'userName', 'appUrl'] },
    { eventType: 'crm_overdue_followup',   label: 'CRM Overdue Follow-Up',       category: 'CRM', recipientDescription: 'Lead owner',          availableVariables: ['leadTitle', 'followUpDate', 'ownerName', 'userName', 'appUrl'] },
    { eventType: 'crm_activity_reminder',  label: 'CRM Activity Reminder',       category: 'CRM', recipientDescription: 'Activity assignee',   availableVariables: ['activitySubject', 'scheduledTime', 'userName', 'appUrl'] },
    { eventType: 'crm_stale_deal',         label: 'CRM Stale Deal',              category: 'CRM', recipientDescription: 'Opportunity owner',   availableVariables: ['dealName', 'expectedCloseDate', 'ownerName', 'userName', 'appUrl'] },
    { eventType: 'crm_trust_review_due',   label: 'CRM Trust Review Due',        category: 'CRM', recipientDescription: 'Trust product owner', availableVariables: ['trustType', 'accountName', 'daysUntilReview', 'nextReviewDate', 'userName', 'appUrl'] },
    { eventType: 'crm_lead_auto_assigned', label: 'CRM Lead Auto-Assigned',      category: 'CRM', recipientDescription: 'Newly assigned user', availableVariables: ['leadId', 'userName', 'appUrl'] },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "notificationTemplate" | head -10
```

Expected: no output.

- [ ] **Step 4: Verify the API returns CRM types**

Start the dev server and test:
```bash
cd backend && npm run dev &
sleep 5
curl -s -H "Authorization: Bearer <admin-jwt-token>" http://localhost:3000/api/v1/notification-templates/event-types | jq '.data.eventTypes[] | select(.category == "CRM") | .eventType'
```

Expected output:
```
"crm_lead_aging"
"crm_lead_aging_manager"
"crm_overdue_followup"
"crm_activity_reminder"
"crm_stale_deal"
"crm_trust_review_due"
"crm_lead_auto_assigned"
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/notificationTemplate.controller.ts
git commit -m "feat(notifications): add CRM event types to admin template registry"
```

---

## Task 6: End-to-End Verification

- [ ] **Step 1: Re-seed the database**

```bash
cd backend && npm run prisma:seed
```

Confirm no errors in output.

- [ ] **Step 2: Start backend**

```bash
cd backend && npm run dev
```

- [ ] **Step 3: Manually trigger a CRM notification by calling the internal endpoint or running the checker directly**

```bash
cd backend && npx ts-node -e "
import { checkLeadAging } from './src/services/crm-automation.service';
checkLeadAging().then(() => { console.log('Done'); process.exit(0); });
" 2>&1 | tail -20
```

- [ ] **Step 4: Check the notifications table — confirm subject and body are human-readable**

```bash
cd backend && npx ts-node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.notification.findMany({
  where: { subject: { not: { startsWith: 'Notification:' } }, channel: 'IN_APP' },
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { subject: true, body: true, createdAt: true }
}).then(r => console.log(JSON.stringify(r, null, 2))).finally(()=>p.\$disconnect());
"
```

Expected: subjects like `"Lead inactive: [Lead Name]"`, not `"Notification: crm_lead_aging"`.

- [ ] **Step 5: Log into the app as admin@test.local / abc@123 and open the bell icon**

Confirm:
- Notifications show human-readable titles and bodies
- No new `crm_lead_aging` duplicates appear on page refresh (deduplication working)

- [ ] **Step 6: Check Admin Settings → Notification Templates**

Confirm 7 CRM event types appear in the "Event Type" dropdown when creating a new template.

- [ ] **Step 7: Final commit (if any cleanup needed)**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(notifications): verify CRM notification templates end-to-end"
```

---

## Rollback Notes

If the seed fails or causes issues:
- Templates can be individually deleted via Admin Settings → Notification Templates
- No schema migrations were made; all changes are data + code only
- The scheduler fix (Task 3) is safe to revert by adding back the `task()` call in `scheduleTask()` if needed

---

## Out of Scope (Future Work)

- Notification grouping/aggregation (e.g. "5 stale leads" summary instead of 5 separate alerts)
- Adding a `lastAgingNotifiedAt` column to `CrmLead` for persistent per-lead deduplication across days
- Idempotency unique constraint on the `Notification` table
- `crm_lead_auto_assigned` currently passes only `leadId` (UUID) as a variable — a future improvement would resolve the lead title and pass it as `leadTitle`
