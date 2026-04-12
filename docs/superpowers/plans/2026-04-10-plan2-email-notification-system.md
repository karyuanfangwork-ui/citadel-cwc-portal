# Plan 2: Email & Notification System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing notification infrastructure (Nodemailer, Notification model, templates) into request lifecycle events so users receive email and in-app notifications when tickets are created, updated, assigned, or commented on.

**Architecture:** Create an email service using Nodemailer, a notification service that creates DB records + sends emails, then integrate into controllers via direct calls. Frontend gets a notification dropdown from the existing `/notifications` API.

**Tech Stack:** Nodemailer, Prisma, Express, React, Axios

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/services/email.service.ts` | SMTP email sending via Nodemailer |
| Create | `backend/src/services/notification.service.ts` | Create DB notifications + trigger email |
| Modify | `backend/src/controllers/request.controller.ts` | Trigger notifications on create/status/assign/comment |
| Modify | `backend/src/controllers/approval.controller.ts` | Trigger notifications on approval events |
| Modify | `backend/prisma/seed.ts` | Add more notification templates |
| Create | `frontend/src/services/notification.service.ts` | API client for notifications |
| Create | `frontend/src/components/NotificationDropdown.tsx` | Bell icon dropdown with notification list |
| Modify | `frontend/App.tsx` | Wire notification dropdown into header |

---

### Task 1: Email Service

**Files:**
- Create: `backend/src/services/email.service.ts`

- [ ] **Step 1: Create `backend/src/services/email.service.ts`**

```typescript
import nodemailer from 'nodemailer';
import config from '../config';
import logger from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: config.email.smtp.user
    ? { user: config.email.smtp.user, pass: config.email.smtp.password }
    : undefined,
});

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html: body,
    });
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

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/email.service.ts
git commit -m "feat: add email service using Nodemailer"
```

---

### Task 2: Notification Service

**Files:**
- Create: `backend/src/services/notification.service.ts`

- [ ] **Step 1: Create `backend/src/services/notification.service.ts`**

```typescript
import prisma from '../utils/prisma';
import { sendEmail, renderTemplate } from './email.service';
import logger from '../utils/logger';

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
      : `Notification: ${eventType}`;
    const body = template
      ? renderTemplate(template.emailBody ?? '', variables)
      : `Event: ${eventType}`;

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId,
        channel: 'IN_APP',
        subject,
        body,
        relatedRequestId,
        status: 'SENT',
      },
    });

    // Send email notification
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const emailSent = await sendEmail(user.email, subject, body);

      // Also create an EMAIL notification record for tracking
      await prisma.notification.create({
        data: {
          userId,
          channel: 'EMAIL',
          subject,
          body,
          relatedRequestId,
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

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/notification.service.ts
git commit -m "feat: add notification service with in-app + email delivery"
```

---

### Task 3: Integrate Notifications into Request Controller

**Files:**
- Modify: `backend/src/controllers/request.controller.ts`

- [ ] **Step 1: Add import at top of `request.controller.ts`**

Add after existing imports:

```typescript
import { notify, notifyMultiple } from '../services/notification.service';
```

- [ ] **Step 2: Add notification to `createRequest` method**

After the `await prisma.request.create(...)` call and the activity creation, add:

```typescript
    // Notify requester
    await notify({
      userId: request.requesterId,
      eventType: 'REQUEST_CREATED',
      variables: {
        referenceNumber: request.referenceNumber,
        summary: request.summary,
      },
      relatedRequestId: request.id,
    });

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { roles: { some: { role: { name: 'ADMIN' } } } },
      select: { id: true },
    });
    await notifyMultiple(
      admins.map((a) => a.id),
      'REQUEST_CREATED',
      { referenceNumber: request.referenceNumber, summary: request.summary },
      request.id
    );
```

- [ ] **Step 3: Add notification to `updateStatus` method**

After the status update and activity creation, add:

```typescript
    // Notify requester of status change
    const updatedRequest = await prisma.request.findUnique({
      where: { id: req.params.id },
      select: { requesterId: true, referenceNumber: true },
    });
    if (updatedRequest) {
      await notify({
        userId: updatedRequest.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: {
          referenceNumber: updatedRequest.referenceNumber,
          newStatus: status,
        },
        relatedRequestId: req.params.id,
      });
    }
```

- [ ] **Step 4: Add notification to `assignRequest` method**

After the assignment update and activity creation, add:

```typescript
    // Notify the assigned agent
    await notify({
      userId: assignedToId,
      eventType: 'REQUEST_ASSIGNED',
      variables: {
        referenceNumber: request.referenceNumber,
        summary: request.summary,
      },
      relatedRequestId: request.id,
    });
```

- [ ] **Step 5: Add notification to `addActivity` method (comments)**

After the activity creation, add:

```typescript
    // Notify request owner about new comment
    const parentRequest = await prisma.request.findUnique({
      where: { id: req.params.id },
      select: { requesterId: true, referenceNumber: true, assignedToId: true },
    });
    if (parentRequest && parentRequest.requesterId !== (req as any).user.id) {
      await notify({
        userId: parentRequest.requesterId,
        eventType: 'COMMENT_ADDED',
        variables: { referenceNumber: parentRequest.referenceNumber },
        relatedRequestId: req.params.id,
      });
    }
    // Also notify assigned agent if they didn't write the comment
    if (parentRequest?.assignedToId && parentRequest.assignedToId !== (req as any).user.id) {
      await notify({
        userId: parentRequest.assignedToId,
        eventType: 'COMMENT_ADDED',
        variables: { referenceNumber: parentRequest.referenceNumber },
        relatedRequestId: req.params.id,
      });
    }
```

- [ ] **Step 6: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: trigger notifications on request create, status change, assign, comment"
```

---

### Task 4: Add Missing Notification Templates to Seed

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add new templates to the notification templates section in seed.ts**

Add these templates alongside the existing two:

```typescript
    {
      name: 'request_assigned',
      eventType: 'REQUEST_ASSIGNED',
      emailSubject: 'Request {{referenceNumber}} - Assigned to You',
      emailBody: 'You have been assigned to request {{referenceNumber}}: {{summary}}. Please review and take action.',
      pushTitle: 'New Assignment',
      pushBody: 'Request {{referenceNumber}} assigned to you.',
    },
    {
      name: 'comment_added',
      eventType: 'COMMENT_ADDED',
      emailSubject: 'New Comment on Request {{referenceNumber}}',
      emailBody: 'A new comment has been added to request {{referenceNumber}}. Please check the request for details.',
      pushTitle: 'New Comment',
      pushBody: 'New comment on {{referenceNumber}}.',
    },
```

- [ ] **Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add notification templates for assignment and comments"
```

---

### Task 5: Frontend Notification Service

**Files:**
- Create: `frontend/src/services/notification.service.ts`

- [ ] **Step 1: Create `frontend/src/services/notification.service.ts`**

```typescript
import api from './api';

export interface Notification {
  id: string;
  subject: string | null;
  body: string;
  channel: string;
  status: string;
  readAt: string | null;
  relatedRequestId: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const notificationService = {
  async getNotifications(page = 1): Promise<NotificationsResponse> {
    const response = await api.get(`/notifications?page=${page}`);
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/notification.service.ts
git commit -m "feat: add frontend notification service"
```

---

### Task 6: Notification Dropdown Component

**Files:**
- Create: `frontend/src/components/NotificationDropdown.tsx`

- [ ] **Step 1: Create `frontend/src/components/NotificationDropdown.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import notificationService, { Notification } from '../services/notification.service';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount and every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchUnreadCount() {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail — non-critical
    }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const result = await notificationService.getNotifications();
      setNotifications(result.data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  }

  async function handleMarkAllRead() {
    await notificationService.markAllAsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  async function handleClickNotification(notification: Notification) {
    if (!notification.readAt) {
      await notificationService.markAsRead(notification.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    }
    if (notification.relatedRequestId) {
      window.location.hash = `#/request/${notification.relatedRequestId}`;
      setOpen(false);
    }
  }

  function formatTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-[#e8edf2] hover:bg-[#d0d8e2] transition-colors"
      >
        <span className="material-symbols-outlined text-[#0e141b] text-xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[480px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-[#101418]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-[#0052cc] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="p-8 text-center text-[#5e718d]">Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="p-8 text-center text-[#5e718d]">
                <span className="material-symbols-outlined text-4xl mb-2 block">notifications_off</span>
                No notifications
              </div>
            )}
            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !n.readAt ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-[#0052cc] flex-shrink-0" />
                    )}
                    <div className={!n.readAt ? '' : 'ml-5'}>
                      <p className="text-sm font-medium text-[#101418] line-clamp-1">
                        {n.subject ?? 'Notification'}
                      </p>
                      <p className="text-xs text-[#5e718d] line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-xs text-[#8899aa] mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NotificationDropdown.tsx
git commit -m "feat: add notification dropdown component with polling"
```

---

### Task 7: Wire Notification Dropdown into Header

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 1: Add import at top of `App.tsx`**

```typescript
import NotificationDropdown from './src/components/NotificationDropdown';
```

- [ ] **Step 2: Replace the notification bell button in the header**

Find the existing notification button (around line 63-65) that looks like:

```tsx
<button className="...">
  <span className="material-symbols-outlined ...">notifications</span>
</button>
```

Replace it with:

```tsx
<NotificationDropdown />
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Successful build

- [ ] **Step 4: Commit**

```bash
git add frontend/App.tsx
git commit -m "feat: wire notification dropdown into app header"
```

---

## Summary

After completing all 7 tasks:
- Backend creates in-app + email notifications on: request created, status changed, assigned, comment added
- Email delivery via Nodemailer (Mailhog in dev, real SMTP in production)
- Templates rendered with variable substitution from seeded `NotificationTemplate` records
- Frontend polls for unread count every 30s, shows badge on bell icon
- Clicking notification navigates to related request and marks as read
- "Mark all read" bulk action available
