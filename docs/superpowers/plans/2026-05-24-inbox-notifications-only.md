# Inbox Simplification — Notifications Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip all approval-related code from `UnifiedInbox.tsx` so the page becomes a pure notifications centre. `ApprovalCenter` remains the single destination for all approval work.

**Architecture:** All changes are confined to `frontend/pages/UnifiedInbox.tsx`. No other files change. The component retains notification fetching, time-frame filtering, mark-read/mark-all-read, and the refresh button. The tab bar is removed entirely (single content type no longer needs tabs). The page subtitle and empty state copy are updated to reflect notifications-only context.

**Tech Stack:** React 19, TypeScript, `notificationService` (already used), inline Tailwind classes matching existing patterns.

---

### Task 1: Strip approval imports, types, and state

**Files:**
- Modify: `frontend/pages/UnifiedInbox.tsx`

- [ ] **Step 1: Remove approval-related imports**

Find and delete these two import lines at the top of the file:

```tsx
import approvalService from '../src/services/approval.service';
import creditService, { CreditApplication, ApplicationState } from '../src/services/credit.service';
```

- [ ] **Step 2: Remove approval-related interfaces**

Delete the `ItsmItem` and `CreditItem` interfaces (lines 15–41 in the original file):

```tsx
interface ItsmItem {
  kind: 'itsm';
  ...
}

interface CreditItem {
  kind: 'credit';
  ...
}
```

Also delete the `InboxItem` union type:

```tsx
type InboxItem = ItsmItem | CreditItem | NotificationItem;
```

Replace it with a simple alias (or just use `NotificationItem` directly everywhere — the alias makes the transition cleaner):

```tsx
type InboxItem = NotificationItem;
```

- [ ] **Step 3: Remove `getSlaStatus` helper**

Delete the entire `getSlaStatus` function:

```tsx
function getSlaStatus(item: ItsmItem) {
  if (item.slaPaused) return { label: 'Paused', color: 'blue' };
  if (item.slaDueAt) {
    ...
  }
  return { label: 'N/A', color: 'gray' };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors about `itsmItems`, `creditItems`, etc. still being referenced — that's fine, we'll fix in the next task.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/UnifiedInbox.tsx
git commit -m "refactor(inbox): remove approval imports, types, and getSlaStatus helper"
```

---

### Task 2: Remove approval state and fetch logic from the component

**Files:**
- Modify: `frontend/pages/UnifiedInbox.tsx` — inside the `UnifiedInbox` component body

- [ ] **Step 1: Remove permission checks and approval state**

Delete these lines from the component body:

```tsx
const canApproveITSM = hasPermission(user, 'request:approve');
const canApproveCredit = hasPermission(user, 'credit:approve');
```

Also delete the `hasPermission` import if it's no longer used anywhere else in the file:

```tsx
import { hasPermission } from '../src/utils/permissions';
```

Delete the approval state declarations:

```tsx
// ITSM approvals
const [itsmItems, setItsmItems] = useState<ItsmItem[]>([]);
// Credit approvals
const [creditItems, setCreditItems] = useState<CreditItem[]>([]);
```

- [ ] **Step 2: Remove approval fetch branches from `fetchData`**

The current `fetchData` has three branches: ITSM (guarded by `canApproveITSM`), Credit (guarded by `canApproveCredit`), and Notifications. Delete the ITSM and Credit branches. The result should look like:

```tsx
const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const data = await notificationService.getNotifications(1, 50);
    const notifs = data?.data || [];
    setNotifications(notifs.map((n: Notification) => ({
      kind: 'notification' as const, id: n.id, subject: n.subject, body: n.body,
      channel: n.channel, status: n.status, readAt: n.readAt,
      createdAt: n.createdAt, relatedRequestId: n.relatedRequestId,
    })));
  } catch {
    setNotifications([]);
  } finally {
    setLoading(false);
  }
}, []);
```

- [ ] **Step 3: Remove approval filter and count computations**

Delete these lines:

```tsx
const filteredItsm = filterByTime(itsmItems);
const filteredCredit = filterByTime(creditItems);
```

```tsx
const approvalCount = filteredItsm.length + filteredCredit.length;
const totalCount = approvalCount + notifCount;
```

```tsx
const allItems: InboxItem[] = [
  ...filteredItsm,
  ...filteredCredit,
  ...filteredNotifs,
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

Replace with:

```tsx
const notifCount = filteredNotifs.length;
const unreadCount = filteredNotifs.filter(n => !n.readAt).length;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors about `activeTab`, tabs array, and `renderItem` — fix in next task.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/UnifiedInbox.tsx
git commit -m "refactor(inbox): remove approval state and fetch logic"
```

---

### Task 3: Remove tab bar and approval render logic from JSX

**Files:**
- Modify: `frontend/pages/UnifiedInbox.tsx` — component JSX and `renderItem`

- [ ] **Step 1: Remove `activeTab` state and the `tabs` array**

Delete:

```tsx
const [activeTab, setActiveTab] = useState<'approvals' | 'notifications' | 'all'>('all');
```

Delete the entire `tabs` array:

```tsx
const tabs: { key: 'approvals' | 'notifications' | 'all'; label: string; icon: string; count: number; unread?: number }[] = [
  { key: 'all', label: 'All', icon: 'layers', count: totalCount },
  { key: 'approvals', label: 'Approvals', icon: 'approval', count: approvalCount },
  { key: 'notifications', label: 'Notifications', icon: 'notifications', count: notifCount, unread: unreadCount },
];
```

Delete the `displayedItems` computed variable:

```tsx
const displayedItems = activeTab === 'approvals'
  ? [...]
  : activeTab === 'notifications'
  ? filteredNotifs
  : allItems;
```

Replace with a simple:

```tsx
const displayedItems = filteredNotifs;
```

- [ ] **Step 2: Simplify `renderItem` to notifications only**

Delete the `if (item.kind === 'itsm')` block (the ITSM render, which includes `getSlaStatus`, SLA badge, escalation badge, etc.).

Delete the `if (item.kind === 'credit')` block.

The `renderItem` function body should contain only the notification render (currently the final `// Notification` block). Since `InboxItem` is now just `NotificationItem`, remove the `kind` check — the render is always a notification:

```tsx
const renderItem = (item: NotificationItem) => (
  <div key={item.id}
    className={`flex items-start gap-3 px-4 py-3 border rounded-lg transition-colors cursor-pointer ${
      item.readAt ? 'bg-surface border-cwc-border' : 'bg-brand-50 border-brand-200 hover:bg-brand-100'
    }`}
    onClick={() => { if (!item.readAt) markRead(item.id); }}
  >
    <span className={`material-symbols-outlined mt-0.5 ${item.readAt ? 'text-text-tertiary' : 'text-brand-700'}`}>
      {item.readAt ? 'notifications' : 'notifications_active'}
    </span>
    <div className="flex-1 min-w-0">
      {item.subject && <p className={`text-sm font-semibold ${item.readAt ? 'text-text-primary' : 'text-brand-900'}`}>{item.subject}</p>}
      <p className="text-sm text-text-secondary line-clamp-2">{item.body}</p>
      <p className="text-xs text-text-tertiary mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
    </div>
    {item.relatedRequestId && (
      <Link to={`/request/${item.relatedRequestId}`}
        className="flex items-center gap-1 text-xs text-brand-700 font-semibold hover:underline"
        onClick={e => e.stopPropagation()}
      >
        View <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
      </Link>
    )}
    <span className="material-symbols-outlined text-text-tertiary text-lg mt-0.5">chevron_right</span>
  </div>
);
```

- [ ] **Step 3: Remove the Tab Bar from JSX**

In the return JSX, delete the entire `{/* Tab Bar */}` block:

```tsx
{/* Tab Bar */}
<div className="flex gap-1 mb-4 border-b border-cwc-border">
  {tabs.map(tab => (
    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
      ...
    >
      ...
    </button>
  ))}
</div>
```

- [ ] **Step 4: Update page subtitle**

Find:

```tsx
<p className="text-sm text-text-secondary mt-1">{totalCount} item{totalCount !== 1 ? 's' : ''} · {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
```

Replace with:

```tsx
<p className="text-sm text-text-secondary mt-1">
  {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
</p>
```

- [ ] **Step 5: Verify TypeScript compiles with no errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: clean compile.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/UnifiedInbox.tsx
git commit -m "refactor(inbox): remove tab bar and approval render — notifications only"
```

---

### Task 4: Visual QA in browser

**Files:** none — verification only

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

Log in at `http://localhost:5173` with `admin@test.local` / `abc@123`.

- [ ] **Step 2: Verify Inbox is notifications-only**

Navigate to `/inbox`. Confirm:
- No "Approvals" tab
- No "All" tab
- Only notification items rendered
- Time filter (All Time / Today / This Week / This Month) still works
- Subtitle shows unread count or "All caught up"
- "Mark All Read" button appears when there are unread notifications
- "Refresh" button works

- [ ] **Step 3: Verify Approval Center is unaffected**

Navigate to `/approvals`. Confirm:
- ITSM approvals still load with desk filter and priority filter
- Bulk approve/reject still works
- Credit tab (if user has `credit:approve`) still loads with urgency grouping

- [ ] **Step 4: Verify sidebar nav is clear**

Confirm both "Inbox" and "Approvals" appear in sidebar. Click each — they go to clearly distinct pages.

- [ ] **Step 5: Final commit**

```bash
git add frontend/pages/UnifiedInbox.tsx
git commit -m "feat(inbox): inbox is now notifications-only — approvals consolidated to ApprovalCenter"
```
