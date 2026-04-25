# CWC 2.0 — Email Notification System Analysis

**Analysis Date:** April 25, 2026
**Related Audit:** FULL_PROJECT_AUDIT_2026-04-24.md (Section 1 — Sprint 1–4 priority item)
**Status:** Analysis complete, implementation pending

---

## 1. Current Architecture

```
Controller → notify() → lookup NotificationTemplate (DB) → renderTemplate() → sendEmail() → Resend API
    OR
Controller → sendEmail() directly (auth.controller.ts only — password reset)
```

### Flow Breakdown

1. **Notification via template system:** Most controllers call `notify()` from `notification.service.ts`. It looks up a `NotificationTemplate` row by `eventType`, applies `{{variable}}` substitution via `renderTemplate()`, then calls `sendEmail()` which sends the HTML body to Resend.

2. **Bypass (1 instance only):** `auth.controller.ts` line 282-289 constructs inline HTML directly and calls `sendEmail()` — completely bypasses the template system.

3. **No templates seeded:** The `NotificationTemplate` table has zero seed data. Unless manually populated, every `notify()` call falls back to generic plain-text (`"Notification: REQUEST_CREATED"`, `"Event: REQUEST_CREATED"`) — meaning emails arrive as unstyled text.

4. **No layout wrapper:** Whether template or inline, the HTML is sent raw to Resend with no shared header, footer, or styling. No branded email layout at all.

---

## 2. Key Source Files

| File | Role |
|------|------|
| `backend/src/services/email.service.ts` (42 lines) | Resend integration, `sendEmail()`, `renderTemplate()` |
| `backend/src/services/notification.service.ts` (83 lines) | `notify()`, `notifyMultiple()` orchestrator |
| `backend/src/controllers/auth.controller.ts` (lines 282-289) | ONLY inline HTML email (password reset) |
| `backend/src/controllers/request.controller.ts` | REQUEST_CREATED, COMMENT_ADDED, REQUEST_ASSIGNED, STATUS_CHANGED |
| `backend/src/controllers/it-workflow.controller.ts` | 15 eventTypes (IT hardware approval chain) |
| `backend/src/controllers/finance-workflow.controller.ts` | 6 eventTypes (finance workflow) |
| `backend/src/controllers/onboarding.controller.ts` | STATUS_CHANGED |
| `backend/src/controllers/offboarding.controller.ts` | STATUS_CHANGED |
| `backend/src/services/sla.service.ts` | SLA_BREACHED |
| `backend/prisma/schema.prisma` (lines 686-702) | NotificationTemplate model |
| `backend/src/utils/sseClients.ts` | In-memory SSE client registry, `pushToUser()`, `broadcast()` |
| `backend/src/controllers/notification.controller.ts` | CRUD for Notification records + SSE stream |
| `backend/src/config/index.ts` (lines 55-60) | RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO |

---

## 3. What the Audit Flagged

> "Email notification templates — structured, not inline HTML. Current inline HTML strings in controllers will break, are unmaintainable, and are not testable."

### Problems Identified

| # | Problem | Why It Matters | Severity |
|---|---------|----------------|----------|
| 1 | Inline HTML in `auth.controller.ts` | Hardcoded, no styling, can't be edited by non-devs | HIGH |
| 2 | No seeded templates in DB | All `notify()` calls produce unstyled fallback text | HIGH |
| 3 | No shared email layout | No branded header/footer/CSS wrapper | HIGH |
| 4 | No admin UI for templates | Only a dev can edit email content | MEDIUM |
| 5 | `renderTemplate()` is naive | Only does `{{key}}` substitution — no conditionals, loops, or partials | MEDIUM |
| 6 | No text/plain fallback | Resend only gets `html:` — no plain-text version for clients that don't render HTML | LOW |

---

## 4. Detailed Code Examination

### 4.1 Email Service (`email.service.ts`)

```typescript
import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';

const resend = new Resend(config.email.resendApiKey);

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // Silently skip if Resend is not configured (no API key)
  if (!config.email.resendApiKey) {
    logger.warn(`Resend not configured — email to ${to} skipped (set RESEND_API_KEY to enable)`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: config.email.from,
      to,
      subject,
      html: body,            // <-- always sends as HTML, no text/plain fallback
      replyTo: config.email.replyTo,
    });

    if (error) {
      logger.error(`Resend error sending to ${to}: ${error.message}`);
      return false;
    }

    logger.info(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${to}`, { error });
    return false;
  }
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}
```

**Issues:**
- `sendEmail()` sends raw HTML with no layout wrapper
- No `text` field provided for plain-text fallback
- `renderTemplate()` only handles simple `{{key}}` replacement
- Fire-and-forget — no retry queue on failure

### 4.2 Notification Service (`notification.service.ts`)

```typescript
import prisma from '../utils/prisma';
import { sendEmail, renderTemplate } from './email.service';
import { logger } from '../utils/logger';
import { pushToUser } from '../utils/sseClients';

interface NotifyOptions {
  userId: string;
  eventType: string;
  variables: Record<string, string>;
  relatedRequestId?: string;
}

export async function notify(options: NotifyOptions): Promise<void> {
  const { userId, eventType, variables, relatedRequestId } = options;

  try {
    // Find template
    const template = await prisma.notificationTemplate.findFirst({
      where: { eventType, isActive: true },
    });

    const subject = template
      ? renderTemplate(template.emailSubject ?? '', variables)
      : `Notification: ${eventType}`;               // <-- generic fallback
    const body = template
      ? renderTemplate(template.emailBody ?? '', variables)
      : `Event: ${eventType}`;                        // <-- generic fallback

    // Create in-app notification
    const inAppNotification = await prisma.notification.create({
      data: { userId, channel: 'IN_APP', subject, body, relatedRequestId, status: 'SENT' },
    });

    // Push real-time SSE event
    pushToUser(userId, 'notification', {
      id: inAppNotification.id,
      subject,
      body,
      relatedRequestId: relatedRequestId ?? null,
      createdAt: inAppNotification.createdAt,
    });

    // Send email notification
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const emailSent = await sendEmail(user.email, subject, body);
      // Create EMAIL notification record for tracking
      await prisma.notification.create({
        data: {
          userId, channel: 'EMAIL', subject, body, relatedRequestId,
          status: emailSent ? 'SENT' : 'FAILED',
          sentAt: emailSent ? new Date() : undefined,
          errorMessage: emailSent ? undefined : 'SMTP delivery failed',
        },
      });
    }
  } catch (error) {
    logger.error(`Failed to create notification for user ${userId}`, { error, eventType });
  }
}
```

**Issues:**
- Generic fallback means all emails are unstyled if no template exists
- No layout wrapping — body sent raw
- Duplicate body content used for both IN_APP and EMAIL channels

### 4.3 Inline HTML in Auth Controller (`auth.controller.ts`)

```typescript
// Lines 282-289 — the ONLY inline HTML email in the codebase
await sendEmail(
    user.email,
    'Password Reset Request',
    `<p>You requested a password reset for your Help Center account.</p>
     <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
     <p><a href="${resetUrl}">${resetUrl}</a></p>
     <p>If you did not request this, you can safely ignore this email.</p>`
);
```

**Issues:**
- Completely bypasses the NotificationTemplate system
- No branded styling
- Can only be changed by editing source code and redeploying
- Not tracked in Notification records (no IN_APP or EMAIL delivery record)

### 4.4 NotificationTemplate Prisma Model

```prisma
model NotificationTemplate {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @unique @db.VarChar(100)
  eventType    String   @map("event_type") @db.VarChar(100)

  emailSubject String?  @map("email_subject") @db.Text
  emailBody    String?  @map("email_body") @db.Text
  smsBody      String?  @map("sms_body") @db.Text
  pushTitle    String?  @map("push_title") @db.VarChar(200)
  pushBody     String?  @map("push_body") @db.Text

  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("notification_templates")
}
```

**Issues:**
- No seed data — table is empty
- `emailBody` stored as plain Text — no structure, no layout
- No admin CRUD API or UI to manage templates
- `name` is unique but `eventType` is not — potential for confusion about which template wins

---

## 5. All EventTypes in the Codebase

### IT Support (15 types)

| eventType | Controller | Context |
|---|---|---|
| MANAGER_APPROVAL_REQUIRED | it-workflow.controller.ts | Manager needs to approve |
| VP_APPROVAL_REQUIRED | it-workflow.controller.ts | VP approval for high-value hardware |
| MANAGER_APPROVED | it-workflow.controller.ts | Manager approved |
| MANAGER_REJECTED | it-workflow.controller.ts | Manager rejected |
| VP_APPROVED | it-workflow.controller.ts | VP approved |
| VP_REJECTED | it-workflow.controller.ts | VP rejected |
| PROCUREMENT_INITIATED | it-workflow.controller.ts | Procurement started |
| HARDWARE_ORDERED | it-workflow.controller.ts | Hardware ordered |
| HARDWARE_RECEIVED | it-workflow.controller.ts | Hardware received |
| HARDWARE_DELIVERED | it-workflow.controller.ts | Software provisioned / delivered |
| REQUEST_RESOLVED | it-workflow.controller.ts | Request resolved |
| ACTION_REQUIRED | it-workflow.controller.ts | Agent action needed (various subtypes) |
| APPROVAL_REQUIRED | it-workflow.controller.ts | CEO/CTO/CFO approval needed |
| REQUEST_REJECTED | it-workflow.controller.ts | Rejected by CEO/CTO/CFO |
| REQUEST_CREATED | request.controller.ts | New request submitted |

### Finance (6 types)

| eventType | Controller | Context |
|---|---|---|
| FINANCE_ACKNOWLEDGED | finance-workflow.controller.ts | Finance acknowledgment |
| FINANCE_ROUTED_CFO | finance-workflow.controller.ts | Routed to CFO |
| FINANCE_CFO_DECISION | finance-workflow.controller.ts | CFO decision |
| FINANCE_GROUP_CEO_DECISION | finance-workflow.controller.ts | Group CEO decision |
| FINANCE_PAYMENT_COMPLETE | finance-workflow.controller.ts | Payment complete |
| FINANCE_TICKET_CLOSED | finance-workflow.controller.ts | Ticket closed |

### General (6 types)

| eventType | Controller | Context |
|---|---|---|
| REQUEST_CREATED | request.controller.ts | New request submitted |
| COMMENT_ADDED | request.controller.ts | Comment on request |
| REQUEST_ASSIGNED | request.controller.ts | Agent assigned |
| STATUS_CHANGED | request.controller.ts | Request status changed |
| PASSWORD_RESET | auth.controller.ts (FIX) | Password reset — currently inline |
| SLA_BREACHED | sla.service.ts | SLA deadline exceeded |

**Total: 27 unique eventTypes** (note: STATUS_CHANGED used by request, onboarding, and offboarding controllers — shares same template)

---

## 6. Proposed Fix — 4 Layers

### Layer 1: Create HTML Email Layout Template

**New file:** `backend/src/templates/email-layout.ts`

- Branded HTML wrapper with Citadel styling
- Responsive table-based layout (email-safe CSS)
- Shared header (Citadel Help Center logo/wordmark)
- Shared footer (copyright — Citadel Group Technologies Sdn Bhd)
- Parameterized: `content` (inner body), optional `title`, `accentColor`

### Layer 2: Modify `email.service.ts` to Use Layout

**Modify:** `backend/src/services/email.service.ts`

- Import `emailLayout` from `../templates/email-layout`
- Add `wrapInLayout` option to `sendEmail()` (default `true`)
- Auto-wrap body in layout before sending to Resend
- Add `text` field for plain-text fallback

### Layer 3: Move Password Reset to NotificationTemplate System

**Modify:** `backend/src/controllers/auth.controller.ts`

- Remove inline HTML (lines 282-289)
- Replace with `notify()` call using `PASSWORD_RESET` eventType
- Add PASSWORD_RESET to the template seed data

### Layer 4: Seed All NotificationTemplates

**Modify:** `backend/prisma/seed.ts`

- Add ~27 NotificationTemplate seed rows
- Each row: `name`, `eventType`, `emailSubject` (with `{{variables}}`), `emailBody` (structured HTML fragment)
- Body content is the inner content only — the layout wrapper is applied by Layer 2
- All bodies use branded HTML: styled buttons for CTAs, colored status badges, proper link formatting

---

## 7. Implementation Checklist

- [ ] Create `backend/src/templates/email-layout.ts`
- [ ] Modify `backend/src/services/email.service.ts` — layout wrapping + text fallback
- [ ] Modify `backend/src/services/notification.service.ts` — pass wrapInLayout option
- [ ] Modify `backend/src/controllers/auth.controller.ts` — replace inline HTML with notify()
- [ ] Add all 27 NotificationTemplate seeds to `backend/prisma/seed.ts`
- [ ] Run `npx prisma db push` to sync schema
- [ ] Run `npm run prisma:seed` to populate templates
- [ ] Build verification: `npm run build` in backend
- [ ] Manual test: trigger each notification type, verify email layout

---

*Generated by Hermes Agent on 2026-04-25. Based on full codebase analysis of CWC 2.0 backend email notification system.*