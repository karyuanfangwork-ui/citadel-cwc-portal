# Request Type Column & Filter

**Date:** 2026-04-13  
**Status:** Approved

## Problem

The My Requests and Agent Dashboard ticket lists only show the Service Desk (IT Support / HR Services / Group Finance) in the "Type" column. Admins and agents cannot tell at a glance which specific request type a ticket belongs to (e.g. "Get IT Help" vs "Report an Incident" vs "New Hardware Request"). There is no way to filter the list by request type.

## Goal

Add a visible "Request Type" column and a filterable dropdown to both the My Requests page and the Agent Dashboard, so admins and agents can identify and filter tickets by request type.

## Scope

- **In scope:** My Requests page, Agent Dashboard (Mine + Unassigned tabs)
- **Out of scope:** Schema migrations, new API endpoints, Report pages, sorting by request type

## Approach

Backend filter via query param. The backend already returns `requestType` in the `getAllRequests` response — the gap is that the frontend doesn't surface it and there is no query param to filter by it.

---

## Backend Changes

**File:** `backend/src/controllers/request.controller.ts` — `getAllRequests`

1. Destructure `requestTypeId` from `req.query` alongside the existing filter params (`status`, `serviceDeskId`, `assignedToId`, `priority`, `search`).
2. Add a where clause condition:
   ```ts
   if (requestTypeId) {
     where.requestTypeId = requestTypeId;
   }
   ```

No schema changes. No new endpoints. The `requestType` relation is already included in the Prisma query (`include: { requestType: true }`).

---

## Frontend Changes

### My Requests — `frontend/pages/MyRequests.tsx`

**1. Extend `Request` interface:**
```ts
requestType?: {
  id: string;
  name: string;
} | null;
```

**2. Add Request Type filter dropdown:**
- Rendered above the table alongside the existing search input
- Populated from the unique request types present in the currently fetched results
- State: `selectedRequestTypeId` (string | null), resets page to 1 on change
- Passes `requestTypeId` param to `requestService.getAllRequests()`

**3. Add "Request Type" column to the table:**
- New `<th>`: `Request Type`, placed between Summary and Service Desk
- New `<td>`: `{req.requestType?.name || '—'}`

---

### Agent Dashboard — `frontend/pages/AgentDashboard.tsx`

**1. Extend `TicketRow` interface:**
```ts
requestType?: { id: string; name: string } | null;
```

**2. Map `requestType` in `extractTickets`:**
```ts
requestType: r.requestType ?? null,
```

**3. Add Request Type filter dropdown:**
- Rendered above the tab bar (applies to both Mine and Unassigned tabs)
- State: `selectedRequestTypeId` (string | null)
- Dropdown options derived from the union of `myTickets` and `unassignedTickets` request types (deduped by id)
- Passed as `requestTypeId` param in both `api.get('/requests', ...)` calls
- Re-fetches data when filter changes

**4. Add "Request Type" column to both ticket tables (Mine and Unassigned):**
- New `<th>`: `Request Type`
- New `<td>`: `{ticket.requestType?.name || '—'}`

---

## Data Flow

```
User selects Request Type from dropdown
       ↓
Frontend sets selectedRequestTypeId state + resets to page 1
       ↓
GET /api/v1/requests?requestTypeId=<uuid>&page=1&...
       ↓
Backend: where.requestTypeId = requestTypeId (Prisma filter)
       ↓
Response includes requestType: { id, name } on each ticket
       ↓
Table renders "Request Type" column + dropdown stays in sync
```

---

## Acceptance Criteria

1. My Requests table shows a "Request Type" column with the correct type name for each ticket
2. Agent Dashboard (both Mine and Unassigned tabs) shows a "Request Type" column
3. Selecting a request type from the dropdown filters the list server-side — results only show tickets of that type
4. Clearing the filter (selecting "All types") restores the unfiltered list
5. Tickets with no request type assigned show `—` in the column
6. Filter resets to page 1 when changed (My Requests only — Agent Dashboard has no pagination)
