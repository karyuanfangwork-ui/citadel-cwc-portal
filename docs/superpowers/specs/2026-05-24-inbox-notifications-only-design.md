# Inbox → Notifications-Only Design Spec
**Date:** 2026-05-24
**Status:** Approved

## Overview

Simplify `UnifiedInbox` (`/inbox`) to a pure notifications centre. Remove all approval-related data fetching, state, and rendering from the component. `ApprovalCenter` (`/approvals`) remains the single destination for all approval work (ITSM + Credit). The sidebar nav is unchanged — "Approvals" link stays.

## What Changes

### `frontend/pages/UnifiedInbox.tsx`

**Remove entirely:**
- `approvalService` import and usage
- `creditService` import and usage
- `ItsmItem` and `CreditItem` interfaces
- `itsmItems`, `creditItems` state
- `canApproveITSM`, `canApproveCredit` permission checks
- ITSM and Credit fetch branches inside `fetchData`
- `filterByTime` merging of `filteredItsm` and `filteredCredit`
- `approvalCount` computation
- `totalCount` — replaced by `notifCount` only
- Approvals tab from the `tabs` array
- `'all'` tab (no longer meaningful with one data type)
- `renderItem` branches for `kind === 'itsm'` and `kind === 'credit'`
- `InboxItem` union type — replaced by `NotificationItem` only
- `getSlaStatus` helper function

**Keep:**
- `notificationService` import and all notification fetching
- `NotificationItem` interface
- `markRead` and `markAllRead` handlers
- Time frame filter (All Time / Today / This Week / This Month)
- Notification render logic
- Refresh button
- Mark All Read button

**Simplify:**
- Tabs: remove "All" and "Approvals" tabs. Keep only "Notifications" tab — or remove the tab bar entirely since there's only one category. **Decision: remove the tab bar.** A single-tab UI adds no value. The page becomes a flat notification list with the time filter.
- Page subtitle: change from `"{totalCount} items · {unreadCount} unread"` to `"{notifCount} notification{s} · {unreadCount} unread"` (or `"All caught up"` when zero)
- `activeTab` state: remove entirely

### `frontend/src/components/layout/navConfig.ts`

No changes. "Approvals" link stays. "Inbox" link stays. Their purposes are now clearly distinct.

### `frontend/App.tsx`

No changes. Routes unchanged.

## What Does NOT Change

- `ApprovalCenter` (`/approvals`) — all ITSM and Credit approval functionality untouched
- `MyApprovals` (`/credit/approvals`) — credit-specific approvals within Credit module nav
- Sidebar navigation structure
- TopBar notification bell badge (already counts only unread notifications, not approvals)
- `notificationService` and all notification API calls

## Result

| Page | Purpose after change |
|---|---|
| `/inbox` | Notifications only — system alerts, request updates, email-linked notifications |
| `/approvals` | All approval work — ITSM (with desk/priority filter, bulk actions) + Credit (urgency grouping, quick-view) |
| `/credit/approvals` | Credit approval queue within the Credit module context |
