# CWC 2.0 — Email Notification Fix Implementation Plan

**Related:** EMAIL_NOTIFICATION_ANALYSIS.md, EMAIL_TEMPLATE_SEED_DATA.md
**Audit Reference:** FULL_PROJECT_AUDIT_2026-04-24.md (Sprint 1–4 priority)
**Status:** Plan ready, implementation pending

---

## Problem Statement

The audit flagged: "Email notification templates — structured, not inline HTML. Current inline HTML strings in controllers will break, are unmaintainable, and are not testable."

**Root causes:**
1. Password reset email uses hardcoded inline HTML in auth.controller.ts
2. No seeded NotificationTemplate rows — all `notify()` calls produce unstyled fallback text
3. No shared branded email layout wrapper
4. No admin UI/API for managing email templates

---

## Implementation Plan — 4 Layers

### Layer 1: Create HTML Email Layout Template

**New file:** `backend/src/templates/email-layout.ts`

**Purpose:** Provides a branded, responsive HTML wrapper applied to all outgoing emails.

**Design decisions:**
- Table-based layout (email-client-safe — Outlook, Gmail, Apple Mail)
- Inline CSS only (no `<style>` blocks — many email clients strip them)
- Max-width 600px (standard email width)
- Citadel branded colors (dark navy `#1a1a2e` header, white body, light gray footer)
- Copyright footer: © 2026 Citadel Group Technologies Sdn Bhd
- Dynamic year via `new Date().getFullYear()`
- Parameterized: `content` (inner HTML body), optional `title`, optional `accentColor`

**Key function signature:**
```typescript
export function emailLayout(content: string, opts?: { title?: string; accentColor?: string }): string
```

**Verification:** Create a test script that calls `emailLayout()` with sample content and outputs the HTML to a file for visual review in a browser.

---

### Layer 2: Modify `email.service.ts` to Use Layout + Text Fallback

**Modify file:** `backend/src/services/email.service.ts`

**Changes:**
1. Import `emailLayout` from `../templates/email-layout`
2. Add `options` parameter to `sendEmail()` with `wrapInLayout` (default `true`)
3. When `wrapInLayout` is true, wrap `body` in `emailLayout()` before sending
4. Add `text` field to Resend payload for plain-text fallback (strip HTML tags from body)
5. Keep `renderTemplate()` unchanged (simple `{{key}}` is sufficient for DB templates)

**Modified `sendEmail` signature:**
```typescript
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options?: { wrapInLayout?: boolean }
): Promise<boolean>
```

**Modified Resend call:**
```typescript
const htmlBody = options?.wrapInLayout !== false ? emailLayout(body) : body;
const textBody = body.replace(/<[^>]*>/g, ''); // strip HTML for plain-text fallback

await resend.emails.send({
  from: config.email.from,
  to,
  subject,
  html: htmlBody,
  text: textBody,      // NEW: plain-text fallback
  replyTo: config.email.replyTo,
});
```

---

### Layer 3: Move Password Reset to NotificationTemplate System

**Modify file:** `backend/src/controllers/auth.controller.ts`

**Changes:**
1. Remove `import { sendEmail } from '../services/email.service'`
2. Add `import { notify } from '../services/notification.service'`
3. Replace lines 282-289 with:
```typescript
await notify({
  userId: user.id,
  eventType: 'PASSWORD_RESET',
  variables: { resetUrl, userName: user.name || 'User' },
});
```

**Impact:**
- Password reset email now uses the NotificationTemplate system
- Gets branded layout wrapper automatically (via Layer 2)
- Gets tracked in DB as IN_APP + EMAIL notification records (currently untracked)
- Can be edited without code changes (once admin UI exists)

---

### Layer 4: Seed All NotificationTemplates

**Modify file:** `backend/prisma/seed.ts`

**Add:** 27 NotificationTemplate seed rows (1 existing shared STATUS_CHANGED = 26 unique + 1 shared)

**See:** EMAIL_TEMPLATE_SEED_DATA.md for all template content

**Seed approach:**
```typescript
const notificationTemplates = [
  {
    name: 'New Request Created',
    eventType: 'REQUEST_CREATED',
    emailSubject: 'New Request #{{requestId}} — {{requestTitle}}',
    emailBody: '<h2 style=...>...</h2>...',  // from EMAIL_TEMPLATE_SEED_DATA.md
    isActive: true,
  },
  // ... 26 more
];

for (const t of notificationTemplates) {
  await prisma.notificationTemplate.upsert({
    where: { name: t.name },
    update: { emailSubject: t.emailSubject, emailBody: t.emailBody, isActive: t.isActive },
    create: t,
  });
}
```

**Important:** Use `upsert` by `name` (unique field) so re-seeding is idempotent.

**Variable injection — `appUrl`:** The controllers currently do not pass `{{appUrl}}` to `notify()`. This means the "View Request" buttons in email templates will have empty links.

**Fix approaches:**
- **Option A (quick):** In `notification.service.ts`, auto-inject `appUrl` from `config.app.url` into every `variables` object before rendering
- **Option B (proper):** Update every controller `notify()` call to include `appUrl: config.app.url` in variables

**Recommendation:** Option A — auto-inject in `notification.service.ts`. One line, covers all templates, no controller changes needed.

```typescript
// notification.service.ts — auto-inject appUrl
const vars = { ...variables, appUrl: config.app.url };
const subject = template ? renderTemplate(template.emailSubject ?? '', vars) : ...;
const body = template ? renderTemplate(template.emailBody ?? '', vars) : ...;
```

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/src/templates/email-layout.ts` | CREATE | Branded HTML email layout wrapper |
| `backend/src/services/email.service.ts` | MODIFY | Add layout wrapping + text/plain fallback |
| `backend/src/services/notification.service.ts` | MODIFY | Auto-inject `appUrl` into variables |
| `backend/src/controllers/auth.controller.ts` | MODIFY | Replace inline HTML with `notify()` call |
| `backend/prisma/seed.ts` | MODIFY | Add 27 NotificationTemplate seed rows |

---

## Verification Checklist

After implementation:

- [ ] `npm run build` in backend — no TypeScript errors
- [ ] `npm run prisma:seed` — templates seeded successfully
- [ ] Query `notification_templates` table — 27 rows present
- [ ] Trigger a REQUEST_CREATED notification — email should have branded layout
- [ ] Trigger PASSWORD_RESET flow — email should use template (not inline HTML)
- [ ] Check email in Gmail/Outlook — layout renders correctly
- [ ] Check email plain-text view — fallback text is readable
- [ ] Verify Notification records in DB — both IN_APP and EMAIL tracked for password reset

---

## Out of Scope (Future Work)

These are NOT part of this fix but noted for roadmap:

1. **Admin UI for NotificationTemplate CRUD** — allow non-devs to edit email templates
2. **Email template preview** — show rendered email before saving
3. **Handlebars/MJML engine** — replace naive `renderTemplate()` with conditional/loop support
4. **Email queue with retry** — currently fire-and-forget; failed emails are not retried
5. **Per-department email branding** — IT, HR, Finance each get different accent colors
6. **Unsubscribe links** — required for some jurisdictions
7. **Email open/click tracking** — Resend supports this but not wired up

---

*Generated by Hermes Agent on 2026-04-25. Implementation plan for email notification template system fix.*