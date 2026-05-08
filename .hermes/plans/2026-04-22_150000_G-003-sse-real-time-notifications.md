# Plan: G-003 — Real-time Notifications (SSE)

## Goal
Implement real-time in-app notifications so agents receive instant alerts without page refresh. No WebSocket/SSE infrastructure exists yet.

## Current Context

### What's Already Done
- `notification.service.ts` already calls `pushToUser(userId, 'notification', {...})` after creating each in-app notification (line 42)
- `notification.controller.ts` has a `streamNotifications` SSE endpoint already wired up
- Both files import `pushToUser` / `addClient` / `removeClient` from `../utils/sseClients`
- **Problem:** `backend/src/utils/sseClients.ts` does not exist — these imports are broken

### Existing Architecture (partial)
```
notification.service.ts
  └─ pushToUser(userId, 'notification', data)   ← BROKEN: sseClients.ts missing

notification.controller.ts
  └─ streamNotifications() SSE endpoint          ← exists but unusable
  └─ addClient(userId, res) / removeClient()     ← BROKEN: sseClients.ts missing
```

### Event Types Already Wired (via `notify()` calls)
- `MANAGER_APPROVAL_REQUIRED`
- `MANAGER_APPROVED` / `MANAGER_REJECTED`
- `VP_APPROVAL_REQUIRED` / `VP_APPROVED` / `VP_REJECTED`
- `PROCUREMENT_INITIATED` / `HARDWARE_ORDERED` / `HARDWARE_RECEIVED` / `HARDWARE_DELIVERED`
- `REQUEST_REJECTED` / `ACTION_REQUIRED`
- `REQUEST_RESOLVED`

## Proposed Approach

**Technology:** Server-Sent Events (SSE) — already partially architected. No Socket.IO or new infrastructure needed. SSE is simpler than WebSocket, works over HTTP/2, and is well-suited for one-way server→client push.

### Step-by-Step Plan

#### Step 1: Create `sseClients.ts` — SSE Client Registry
**File:** `backend/src/utils/sseClients.ts`

A simple in-memory Map storing active SSE response objects per user:
- `addClient(userId, res)` — register a client connection
- `removeClient(userId, res)` — deregister on disconnect
- `pushToUser(userId, event, data)` — send an SSE event to all connections for that user
- `getClientCount()` — for monitoring

```typescript
// Design: Map<userId, Set<Response>>
// Each user can have multiple tabs/devices open simultaneously
```

#### Step 2: Verify `app.ts` Exports the HTTP Server
**File:** `backend/src/server.ts` (or wherever `http.createServer(app)` is called)

The SSE client registry needs access to the underlying HTTP server to detect when it closes. Ensure the server instance is exported or accessible.

#### Step 3: Wire Up SSE Endpoint Route
**File:** `backend/src/routes/notification.routes.ts`

Mount `streamNotifications` at `GET /notifications/stream`:
```typescript
router.get('/stream', authMiddleware, notificationController.streamNotifications);
```

#### Step 4: Add Frontend SSE Client Hook
**File:** `frontend/src/hooks/useNotificationStream.ts` (new)

React hook that:
- Connects to `GET /api/v1/notifications/stream` via `EventSource`
- Maintains reconnection logic (SSE auto-reconnects on drop)
- Exposes `{ notifications, unreadCount }` via context
- Cleans up `EventSource` on unmount

#### Step 5: Create `NotificationContext`
**File:** `frontend/src/context/NotificationContext.tsx`

Wraps the app in a provider that:
- Holds notification state (list + unread count)
- Subscribes to SSE stream via the hook
- Exposes `markAsRead(id)`, `markAllAsRead()` methods

#### Step 6: Wire Context into `App.tsx`
**File:** `frontend/src/App.tsx`

Wrap the app with `<NotificationProvider>` inside the auth context.

#### Step 7: Wire `NotificationBell` Component
**File:** `frontend/src/components/NotificationBell.tsx` (existing)

Already exists — verify it reads from context instead of polling.

## Files to Create

| File | Purpose |
|:---|:---|
| `backend/src/utils/sseClients.ts` | In-memory SSE client registry |
| `frontend/src/hooks/useNotificationStream.ts` | SSE EventSource hook |
| `frontend/src/context/NotificationContext.tsx` | Notification state + SSE subscription |

## Files to Modify

| File | Change |
|:---|:---|
| `backend/src/server.ts` | Ensure HTTP server is exported |
| `backend/src/routes/notification.routes.ts` | Mount SSE stream route |
| `frontend/src/App.tsx` | Add NotificationProvider |
| `frontend/src/context/NotificationContext.tsx` | Replace polling/batch-fetch with SSE |

## Tests / Validation
1. Open two browser tabs logged in as the same user
2. Perform an action that triggers a notification (e.g., submit a hardware request)
3. Both tabs should receive the notification in real-time without refresh
4. Mark as read in one tab — verify badge count syncs in both
5. Close one tab — verify SSE connection cleans up (no memory leak)

## Risks / Tradeoffs / Open Questions

| Item | Detail |
|:---|:---|
| **In-memory registry** | `sseClients.ts` uses a `Map` — SSE connections are per-process. In a multi-worker Node.js deployment (cluster/pm2), connections won't be shared across workers. Acceptable for single-instance dev; for production consider Redis pub/sub + Socket.IO adapter. |
| **Reconnection** | Browser `EventSource` auto-reconnects, but the in-memory client set will accumulate duplicate entries if reconnect happens before the old connection fully closes. Add a timeout or use a unique client ID per tab to deduplicate. |
| **Scaling** | Current design is single-instance. Add a note in the implementation that production multi-instance requires moving to Redis-backed pub/sub. |
| **SLA/SLA_BREACHED events** | The IMPLEMENTATION_PLAN mentions SLA events — check if the SLA checker service (`sla.service.ts`) also calls `notify()`. If so, SSE push will work for those too automatically. |

## Implementation Order
1. `sseClients.ts` (backend foundation)
2. SSE route mount (backend)
3. `useNotificationStream` hook + `NotificationContext` (frontend)
4. Wire into `App.tsx`
5. Validate with two-tab test
