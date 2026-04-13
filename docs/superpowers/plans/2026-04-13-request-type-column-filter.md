# Request Type Column & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Request Type" column and filterable dropdown to My Requests and Agent Dashboard so admins and agents can identify and filter tickets by request type.

**Architecture:** The backend `getAllRequests` controller already returns `requestType` in the response — we only need to add a `requestTypeId` query param filter to the where clause. On the frontend, the `Request` interface and `TicketRow` interface are extended to include `requestType`, a new column is added to both tables, and a filter dropdown is wired to the backend filter param.

**Tech Stack:** Node.js + Express + Prisma (backend), React 19 + TypeScript + Vite (frontend), Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `backend/src/controllers/request.controller.ts` | Add `requestTypeId` to query destructure + where clause |
| `backend/src/__tests__/request.test.ts` | Add test for `requestTypeId` filter |
| `frontend/src/services/request.service.ts` | Add `requestTypeId` to `RequestFilters` interface + params |
| `frontend/pages/MyRequests.tsx` | Extend `Request` interface, add filter dropdown + column |
| `frontend/pages/AgentDashboard.tsx` | Extend `TicketRow`, map field, add filter dropdown + column |

---

## Task 1: Backend — add `requestTypeId` filter to `getAllRequests`

**Files:**
- Modify: `backend/src/controllers/request.controller.ts:13-22`

- [ ] **Step 1: Add `requestTypeId` to the query destructure**

In `backend/src/controllers/request.controller.ts`, find the `getAllRequests` destructure at line 14 and add `requestTypeId`:

```ts
const {
    page = '1',
    limit = '10',
    status,
    serviceDeskId,
    assignedToId,
    priority,
    search,
    requestTypeId,
} = req.query;
```

- [ ] **Step 2: Add the where clause condition**

In the same function, after the existing `if (priority)` block (around line 67), add:

```ts
if (requestTypeId) {
    where.requestTypeId = requestTypeId;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from `backend/`:
```bash
npm run build
```
Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: add requestTypeId filter param to getAllRequests"
```

---

## Task 2: Backend — add test for `requestTypeId` filter

**Files:**
- Modify: `backend/src/__tests__/request.test.ts`

- [ ] **Step 1: Add a test for filtering by `requestTypeId`**

Append this describe block after the last existing describe block in `backend/src/__tests__/request.test.ts`:

```ts
describe('GET /api/v1/requests with requestTypeId filter', () => {
  it('returns only requests matching the given requestTypeId', async () => {
    const res = await request(app)
      .get('/api/v1/requests')
      .query({ requestTypeId })
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    const requests = body.requests ?? body;
    expect(Array.isArray(requests)).toBe(true);
    // Every returned request must have the matching requestTypeId
    requests.forEach((r: any) => {
      expect(r.requestType?.id ?? r.requestTypeId).toBe(requestTypeId);
    });
  });

  it('returns empty list when no requests match the given requestTypeId', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get('/api/v1/requests')
      .query({ requestTypeId: nonExistentId })
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    const requests = body.requests ?? body;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests**

Run from `backend/`:
```bash
npm test -- --testPathPattern=request.test
```
Expected: all tests pass including the two new ones.

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/request.test.ts
git commit -m "test: add requestTypeId filter test to request controller"
```

---

## Task 3: Frontend service — add `requestTypeId` to `RequestFilters`

**Files:**
- Modify: `frontend/src/services/request.service.ts:4-31`

- [ ] **Step 1: Add `requestTypeId` to `RequestFilters` interface**

In `frontend/src/services/request.service.ts`, update the `RequestFilters` interface:

```ts
interface RequestFilters {
    page?: number;
    limit?: number;
    status?: RequestStatus;
    serviceDeskId?: string;
    search?: string;
    requestTypeId?: string;
}
```

- [ ] **Step 2: Append `requestTypeId` to the URLSearchParams builder**

In the `getAllRequests` function body, add after the existing `if (filters.search)` line:

```ts
if (filters.requestTypeId) params.append('requestTypeId', filters.requestTypeId);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npm run build
```
Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/request.service.ts
git commit -m "feat: add requestTypeId filter to request service"
```

---

## Task 4: My Requests — extend interface, add column and filter dropdown

**Files:**
- Modify: `frontend/pages/MyRequests.tsx`

- [ ] **Step 1: Extend the `Request` interface**

In `frontend/pages/MyRequests.tsx`, find the `Request` interface (line 6) and add `requestType`:

```ts
interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  serviceDesk?: {
    id: string;
    name: string;
    code: string;
  };
  requestType?: {
    id: string;
    name: string;
  } | null;
}
```

- [ ] **Step 2: Add `selectedRequestTypeId` state**

After the existing `const [total, setTotal] = useState(0);` line, add:

```ts
const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string | null>(null);
```

- [ ] **Step 3: Add `requestTypeOptions` derived state**

After the `selectedRequestTypeId` state line, add:

```ts
const [requestTypeOptions, setRequestTypeOptions] = useState<{ id: string; name: string }[]>([]);
```

- [ ] **Step 4: Update `fetchRequests` to pass `requestTypeId` and build options**

Find the `fetchRequests` function. Update the `filters` object construction and the `setRequests` call:

```ts
const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {
        page,
        limit,
      };

      if (searchTerm) {
        filters.search = searchTerm;
      }

      if (selectedRequestTypeId) {
        filters.requestTypeId = selectedRequestTypeId;
      }

      const data = await requestService.getAllRequests(filters);

      let filteredRequests = data.requests || [];

      // Client-side filtering for open requests
      if (filter === 'open') {
        filteredRequests = filteredRequests.filter(
          (r: Request) => r.status !== 'RESOLVED' && r.status !== 'CLOSED'
        );
      }

      setRequests(filteredRequests);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);

      // Build unique request type options from results
      const seen = new Set<string>();
      const options: { id: string; name: string }[] = [];
      filteredRequests.forEach((r: Request) => {
        if (r.requestType && !seen.has(r.requestType.id)) {
          seen.add(r.requestType.id);
          options.push({ id: r.requestType.id, name: r.requestType.name });
        }
      });
      setRequestTypeOptions(options);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 5: Add `selectedRequestTypeId` to the `useEffect` dependency array**

Find the `useEffect` that calls `fetchRequests` and add `selectedRequestTypeId`:

```ts
useEffect(() => {
    fetchRequests();
  }, [filter, searchTerm, page, selectedRequestTypeId]);
```

- [ ] **Step 6: Add the Request Type filter dropdown next to the search input**

Find the search input `<div>` wrapper (`<div className="flex flex-col md:flex-row gap-4 mb-6">`). Add the dropdown as a sibling after the search input div:

```tsx
<select
  className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none transition-all text-[#44546f]"
  value={selectedRequestTypeId || ''}
  onChange={(e) => {
    setSelectedRequestTypeId(e.target.value || null);
    setPage(1);
  }}
>
  <option value="">All request types</option>
  {requestTypeOptions.map((opt) => (
    <option key={opt.id} value={opt.id}>{opt.name}</option>
  ))}
</select>
```

- [ ] **Step 7: Add the "Request Type" column header to the table**

Find the `<thead>` row. Add a new `<th>` between `Summary` and `Service Desk`:

```tsx
<th className="px-6 py-4">Request Type</th>
```

- [ ] **Step 8: Add the "Request Type" cell to each table row**

Find the `<td>` for summary (`<td className="px-6 py-4 font-semibold">{req.summary}</td>`). Add a new `<td>` immediately after it:

```tsx
<td className="px-6 py-4 text-[#44546f]">
  {req.requestType?.name || '—'}
</td>
```

- [ ] **Step 9: Start the dev server and verify manually**

Run from `frontend/`:
```bash
npm run dev
```
Open http://localhost:5173, navigate to My Requests. Verify:
- "Request Type" column appears between Summary and Service Desk
- Dropdown shows "All request types" by default
- Selecting a type re-fetches and shows only matching tickets
- Selecting "All request types" restores the full list
- Tickets without a request type show `—`

- [ ] **Step 10: Commit**

```bash
git add frontend/pages/MyRequests.tsx
git commit -m "feat: add Request Type column and filter to My Requests"
```

---

## Task 5: Agent Dashboard — extend interface, map field, add column and filter dropdown

**Files:**
- Modify: `frontend/pages/AgentDashboard.tsx`

- [ ] **Step 1: Extend the `TicketRow` interface**

In `frontend/pages/AgentDashboard.tsx`, find the `TicketRow` interface (line 8) and add `requestType`:

```ts
interface TicketRow {
  id: string;
  reference: string;
  summary: string;
  priority: string;
  status: string;
  slaDeadline?: string | null;
  requester?: { firstName: string; lastName: string; email: string } | null;
  requestType?: { id: string; name: string } | null;
}
```

- [ ] **Step 2: Map `requestType` in `extractTickets`**

Find the `extractTickets` arrow function (line 66). Add `requestType` to the returned object:

```ts
const extractTickets = (res: any): TicketRow[] => {
  const raw = res.data?.data;
  const arr = Array.isArray(raw) ? raw : (raw?.requests ?? []);
  return arr.map((r: any) => ({
    id: r.id,
    reference: r.reference ?? r.referenceNumber ?? r.id,
    summary: r.summary,
    priority: r.priority ?? 'MEDIUM',
    status: r.status,
    slaDeadline: r.slaDeadline ?? r.sla_deadline ?? null,
    requester: r.requester ?? r.requestedBy ?? null,
    requestType: r.requestType ?? null,
  }));
};
```

- [ ] **Step 3: Add `selectedRequestTypeId` state**

After the existing `const [loading, setLoading] = useState(true);` line, add:

```ts
const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string | null>(null);
```

- [ ] **Step 4: Pass `requestTypeId` param to both fetch calls and add to dependency array**

Find the `fetchData` function inside `useEffect`. Update both `api.get` calls to include the filter:

```ts
const myParams: Record<string, any> = { assignedToId: user?.id, limit: 50 };
const unParams: Record<string, any> = { assignedToId: 'none', limit: 50 };
if (selectedRequestTypeId) {
  myParams.requestTypeId = selectedRequestTypeId;
  unParams.requestTypeId = selectedRequestTypeId;
}

const [summaryData, slaData, myRes, unRes] = await Promise.all([
  reportsService.getSummary(),
  reportsService.getSlaStatus(),
  api.get('/requests', { params: myParams }),
  api.get('/requests', { params: unParams }),
]);
```

Update the `useEffect` dependency array to include `selectedRequestTypeId`:

```ts
}, [user?.id, selectedRequestTypeId]);
```

- [ ] **Step 5: Derive `requestTypeOptions` from the combined ticket lists**

After `const tickets = activeTab === 'mine' ? myTickets : unassignedTickets;` (line 91), add:

```ts
const requestTypeOptions = React.useMemo(() => {
  const seen = new Set<string>();
  const options: { id: string; name: string }[] = [];
  [...myTickets, ...unassignedTickets].forEach((t) => {
    if (t.requestType && !seen.has(t.requestType.id)) {
      seen.add(t.requestType.id);
      options.push({ id: t.requestType.id, name: t.requestType.name });
    }
  });
  return options;
}, [myTickets, unassignedTickets]);
```

- [ ] **Step 6: Add the filter dropdown above the tab bar**

Find the tab toggle section (`{/* Tab Toggle */}`). Add the dropdown immediately before it:

```tsx
{/* Request Type Filter */}
<div className="mb-4">
  <select
    className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-500"
    value={selectedRequestTypeId || ''}
    onChange={(e) => setSelectedRequestTypeId(e.target.value || null)}
  >
    <option value="">All request types</option>
    {requestTypeOptions.map((opt) => (
      <option key={opt.id} value={opt.id}>{opt.name}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 7: Add "Request Type" column header to the ticket table**

Find the `<thead>` row inside the ticket table. Add a new `<th>` after the Summary header:

```tsx
<th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Request Type</th>
```

- [ ] **Step 8: Add "Request Type" cell to each ticket row**

Find the `<tbody>` ticket row rendering. Add the cell after the summary `<td>`. First, locate the existing table body to find the exact row structure:

The tbody renders `tickets.map(ticket => ...)`. Add a `<td>` for request type after the summary cell:

```tsx
<td className="px-4 py-3 text-gray-500">{ticket.requestType?.name || '—'}</td>
```

- [ ] **Step 9: Verify manually**

The dev server should still be running. Navigate to Agent Dashboard. Verify:
- "Request Type" column appears in both Mine and Unassigned tabs
- Dropdown filters both tabs simultaneously
- Options are derived from the union of both ticket lists
- Clearing the filter restores all tickets
- Tickets without a request type show `—`

- [ ] **Step 10: Commit**

```bash
git add frontend/pages/AgentDashboard.tsx
git commit -m "feat: add Request Type column and filter to Agent Dashboard"
```

---

## Self-Review Checklist

After all tasks are complete, verify against acceptance criteria:

- [ ] AC1: My Requests shows "Request Type" column with correct type names
- [ ] AC2: Agent Dashboard (Mine + Unassigned) shows "Request Type" column
- [ ] AC3: Dropdown filters server-side — only matching tickets returned
- [ ] AC4: "All request types" option restores unfiltered list
- [ ] AC5: Tickets with no request type show `—`
- [ ] AC6: Filter resets page to 1 on My Requests when changed
