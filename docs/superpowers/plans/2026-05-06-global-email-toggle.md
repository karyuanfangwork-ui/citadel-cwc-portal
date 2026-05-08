# Global Email Notifications Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a master on/off switch for all email notifications, controllable from the Admin Console, persisted in the database.

**Architecture:** A new `SystemSetting` key-value Prisma model stores `email_notifications_enabled` (boolean string). `notification.service.ts` reads this flag (30-second in-memory cache) before sending email. The Admin Console Email Notifications tab gains a prominent master toggle banner backed by two new REST endpoints.

**Tech Stack:** Prisma + PostgreSQL, Express/TypeScript, React 19

---

## File Map

| Action | File |
|--------|------|
| Create | `backend/prisma/migrations/<timestamp>_add_system_settings/migration.sql` |
| Modify | `backend/prisma/schema.prisma` — add `SystemSetting` model |
| Create | `backend/src/controllers/systemSetting.controller.ts` |
| Create | `backend/src/routes/systemSetting.routes.ts` |
| Modify | `backend/src/routes/index.ts` — register new route |
| Modify | `backend/src/services/notification.service.ts` — check global flag before email |
| Modify | `frontend/src/services/admin.service.ts` — add 2 API methods |
| Modify | `frontend/src/components/admin/EmailNotificationsTab.tsx` — master toggle banner |

---

### Task 1: Add SystemSetting Prisma model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [x] **Step 1: Add the model to schema.prisma**

Append this block before the final closing of the schema file (after the last `@@map` model):

```prisma
model SystemSetting {
  key       String   @id @db.VarChar(100)
  value     String   @db.Text
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("system_settings")
}
```

- [x] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_system_settings
```

Expected: Migration created and applied, Prisma client regenerated.

- [x] **Step 3: Seed the default row**

Run this one-off command to insert the default value (only needed in dev; prod migration handles it via SQL seed or first-read upsert logic):

```bash
cd backend
npx prisma studio
```

Or via psql/query — the controller will upsert on first read so no manual seed is strictly required.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add SystemSetting model for global email toggle"
```

---

### Task 2: Backend controller + routes for system settings

**Files:**
- Create: `backend/src/controllers/systemSetting.controller.ts`
- Create: `backend/src/routes/systemSetting.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [x] **Step 1: Create the controller**

Create `backend/src/controllers/systemSetting.controller.ts`:

```typescript
import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../types/auth';
import prisma from '../utils/prisma';

const EMAIL_ENABLED_KEY = 'email_notifications_enabled';

export const getEmailNotificationsEnabled = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: EMAIL_ENABLED_KEY } });
  const enabled = setting ? setting.value === 'true' : true; // default on
  res.json({ success: true, data: { enabled } });
});

export const setEmailNotificationsEnabled = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ success: false, message: '`enabled` must be a boolean' });
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key: EMAIL_ENABLED_KEY },
    create: { key: EMAIL_ENABLED_KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
  // Invalidate the in-memory cache in notification.service
  invalidateEmailEnabledCache();
  res.json({ success: true, data: { enabled } });
});

// Exported so notification.service can call it after upsert
let _cacheInvalidator: (() => void) | null = null;
export function registerEmailEnabledCacheInvalidator(fn: () => void) {
  _cacheInvalidator = fn;
}
function invalidateEmailEnabledCache() {
  _cacheInvalidator?.();
}
```

- [x] **Step 2: Create the route file**

Create `backend/src/routes/systemSetting.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { getEmailNotificationsEnabled, setEmailNotificationsEnabled } from '../controllers/systemSetting.controller';

const router = Router();

router.get('/email-notifications-enabled', authenticateJWT, getEmailNotificationsEnabled);
router.put('/email-notifications-enabled', authenticateJWT, requireRole('ADMIN'), setEmailNotificationsEnabled);

export default router;
```

- [x] **Step 3: Register the route in index.ts**

In `backend/src/routes/index.ts`, add after the notification-templates line:

```typescript
import systemSettingRoutes from './systemSetting.routes';
// ...
router.use('/admin/system-settings', systemSettingRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/systemSetting.controller.ts \
        backend/src/routes/systemSetting.routes.ts \
        backend/src/routes/index.ts
git commit -m "feat: add system settings API for global email toggle"
```

---

### Task 3: Guard email sending in notification.service.ts

**Files:**
- Modify: `backend/src/services/notification.service.ts`
- Modify: `backend/src/controllers/systemSetting.controller.ts` (register invalidator)

- [x] **Step 1: Add cache + guard to notification.service.ts**

At the top of `backend/src/services/notification.service.ts`, after the existing imports, add:

```typescript
import { registerEmailEnabledCacheInvalidator } from '../controllers/systemSetting.controller';

// ── Global email toggle cache (30-second TTL) ────────────────────────
let _emailEnabledCache: { value: boolean; expiresAt: number } | null = null;

registerEmailEnabledCacheInvalidator(() => { _emailEnabledCache = null; });

async function isEmailGloballyEnabled(): Promise<boolean> {
  const now = Date.now();
  if (_emailEnabledCache && now < _emailEnabledCache.expiresAt) {
    return _emailEnabledCache.value;
  }
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'email_notifications_enabled' } });
  const value = setting ? setting.value === 'true' : true;
  _emailEnabledCache = { value, expiresAt: now + 30_000 };
  return value;
}
```

- [x] **Step 2: Add the guard before the sendEmail call**

In `notification.service.ts`, find the block that calls `sendEmail` (around line 119–132). Wrap it with the global check:

```typescript
    // Send email notification
    if (recipientUser?.email) {
      const globallyEnabled = await isEmailGloballyEnabled();
      if (!globallyEnabled) {
        logger.info(`[EmailToggle] Email globally disabled — skipping email for ${eventType} to ${recipientUser.email}`);
      } else {
        const emailSent = await sendEmail(recipientUser.email, subject, body, { wrapInLayout });
        await prisma.notification.create({
          data: {
            userId,
            eventType,
            channel: 'EMAIL',
            subject,
            body,
            relatedRequestId: relatedRequestId ?? null,
            status: emailSent ? 'SENT' : 'FAILED',
            sentAt: emailSent ? new Date() : undefined,
            errorMessage: emailSent ? undefined : 'SMTP delivery failed',
          },
        });
      }
    }
```

- [x] **Step 3: Verify TypeScript compiles**

```bash
cd backend
npm run build 2>&1 | tail -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/notification.service.ts \
        backend/src/controllers/systemSetting.controller.ts
git commit -m "feat: guard email sending behind global email toggle with 30s cache"
```

---

### Task 4: Frontend admin service methods

**Files:**
- Modify: `frontend/src/services/admin.service.ts`

- [x] **Step 1: Add two methods to adminService**

In `frontend/src/services/admin.service.ts`, append inside the `adminService` object (after `sendTestEmail`):

```typescript
    async getEmailNotificationsEnabled(): Promise<boolean> {
        const response = await apiClient.get('/admin/system-settings/email-notifications-enabled');
        return response.data.data.enabled as boolean;
    },

    async setEmailNotificationsEnabled(enabled: boolean): Promise<boolean> {
        const response = await apiClient.put('/admin/system-settings/email-notifications-enabled', { enabled });
        return response.data.data.enabled as boolean;
    },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/admin.service.ts
git commit -m "feat: add getEmailNotificationsEnabled/setEmailNotificationsEnabled to adminService"
```

---

### Task 5: Master toggle banner in EmailNotificationsTab

**Files:**
- Modify: `frontend/src/components/admin/EmailNotificationsTab.tsx`

- [x] **Step 1: Add state + fetch for global toggle**

In `EmailNotificationsTab.tsx`, add two new state variables after the existing state declarations:

```typescript
    const [globalEmailEnabled, setGlobalEmailEnabled] = useState<boolean>(true);
    const [togglingGlobal, setTogglingGlobal] = useState(false);
```

- [x] **Step 2: Fetch global setting in fetchData**

Update the `fetchData` callback to also fetch the global setting:

```typescript
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [tpls, evts, emailEnabled] = await Promise.all([
                adminService.listNotificationTemplates(),
                adminService.listEventTypes(),
                adminService.getEmailNotificationsEnabled(),
            ]);
            setTemplates(tpls);
            setEventTypes(evts);
            setGlobalEmailEnabled(emailEnabled);
        } catch (err: any) {
            setError(err.message || 'Failed to load notification data');
        } finally {
            setLoading(false);
        }
    }, []);
```

- [x] **Step 3: Add toggle handler**

After the existing `handleToggle` function, add:

```typescript
    const handleGlobalToggle = useCallback(async () => {
        setTogglingGlobal(true);
        try {
            const newValue = await adminService.setEmailNotificationsEnabled(!globalEmailEnabled);
            setGlobalEmailEnabled(newValue);
            showToast('success', newValue ? 'All email notifications enabled' : 'All email notifications paused');
        } catch {
            showToast('error', 'Failed to update global email setting');
        } finally {
            setTogglingGlobal(false);
        }
    }, [globalEmailEnabled, showToast]);
```

- [x] **Step 4: Add the master toggle banner to the JSX**

Inside the `return (...)`, right before the `{/* Stats row */}` div, insert:

```tsx
            {/* Master email toggle */}
            <div className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${globalEmailEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-300'}`}>
                <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-2xl ${globalEmailEnabled ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {globalEmailEnabled ? 'mark_email_read' : 'mail_off'}
                    </span>
                    <div>
                        <p className={`text-sm font-black ${globalEmailEnabled ? 'text-emerald-900' : 'text-amber-900'}`}>
                            {globalEmailEnabled ? 'Email Notifications Active' : 'Email Notifications Paused'}
                        </p>
                        <p className={`text-xs mt-0.5 ${globalEmailEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {globalEmailEnabled
                                ? 'All configured email notifications will be sent normally.'
                                : 'No email notifications are being sent system-wide, regardless of individual template settings.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleGlobalToggle}
                    disabled={togglingGlobal}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${globalEmailEnabled ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    title={globalEmailEnabled ? 'Pause all emails' : 'Enable all emails'}
                >
                    {togglingGlobal ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-sm animate-spin">progress_activity</span>
                        </span>
                    ) : (
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${globalEmailEnabled ? 'left-8' : 'left-1'}`} />
                    )}
                </button>
            </div>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/EmailNotificationsTab.tsx
git commit -m "feat: add global email notifications master toggle to admin console"
```

---

## Self-Review Checklist

- [x] All Prisma model fields mapped correctly
- [x] Upsert pattern used (no duplicate key errors on first call)
- [x] Cache invalidation wired between controller and service
- [x] Default-on behavior when no DB row exists (both backend and frontend)
- [x] Toggle disabled during async call (togglingGlobal state)
- [x] Admin-only guard on PUT endpoint
- [x] No placeholders or TODOs
