# Sprint: CRM Leads — Table/List View Redesign

## Problem

Current Leads page uses a 3-column card grid. When leads grow beyond ~10, the card layout becomes unmanageable for sales managers and reps:

- **Low information density** — Only ~6 leads visible per viewport
- **No column alignment** — Status, value, owner scattered across cards; impossible to compare at a glance
- **No sortable columns** — Only "Priority" toggle exists (binary AI-score sort); cannot sort by value, date, owner, etc.
- **Slow bulk ops** — Small checkboxes buried inside cards; no header "select all" in context
- **No inline status changes** — Must open edit modal just to change status

## Solution

Add a **table/list view** as the default display, with a toggle to switch back to the existing card view. Both views share the same data, filters, and modals.

---

## Design Decisions (Confirmed)

| Decision | Choice |
|---|---|
| Default view | **Table** (list view) |
| Inline status change | **Yes** — click status badge opens a small dropdown |
| View preference persistence | **Yes** — localStorage key `crm-leads-view` |
| Column visibility | **Fixed columns** (no show/hide for now) |
| Row click behavior | **Title only** — clicking lead title navigates to detail; rest of row is inert |
| Mobile behavior | **Responsive compact list** — collapses into a stacked layout (not horizontal scroll) |

---

## Architecture Overview

```
CrmLeads.tsx
├── viewMode state: 'table' | 'card'  (default: 'table')
├── persistViewMode() → localStorage('crm-leads-view')
├── sortConfig state: { field, direction }
├── <ViewToggle />  — table/card icon buttons
├── <LeadsTable />  — NEW component (conditional render)
│   ├── <TableHeader /> — clickable column headers for sorting
│   ├── <LeadRow />  × N
│   │   ├── Checkbox
│   │   ├── Title (link to /crm/leads/:id)
│   │   ├── <StatusDropdown /> — inline status change
│   │   ├── AI Score
│   │   ├── Contact + Company
│   │   ├── Estimated Value
│   │   ├── Follow-up Date (overdue highlighting)
│   │   ├── Source
│   │   ├── Owner (avatar + name)
│   │   ├── Created Date
│   │   └── Actions (Edit icon, Delete icon)
│   └── <Pagination />
├── <LeadsCardGrid /> — EXISTING card layout (conditionally rendered)
│   └── (unchanged from current implementation)
├── <BulkActionBar />  — (existing, unchanged)
├── <CreateModal />    — (existing, unchanged)
├── <EditModal />       — (existing, unchanged)
└── <ConfirmDialog />   — (existing, unchanged)
```

---

## Columns (Left → Right)

| # | Column | Width | Sortable | Details |
|---|---|---|---|---|
| 1 | ☐ Checkbox | 40px | No | Header has "select all" checkbox |
| 2 | Lead Title | flex (fills) | Yes | Clickable link → `/crm/leads/:id`. Bold, hover underline |
| 3 | Status | 120px | Yes | Color badge. **Click opens inline dropdown** to change status |
| 4 | Score | 70px | Yes | AI score "/100". Color-coded (green/amber/red) |
| 5 | Contact | 160px | No | Name + Company stacked. Muted secondary line |
| 6 | Value | 110px | Yes | RM currency. Right-aligned. Bold |
| 7 | Follow-up | 100px | Yes | Date. Red + bold if overdue. Show "—" if none |
| 8 | Source | 100px | No | Pill/badge format (same colors as current) |
| 9 | Owner | 90px | No | Avatar initials + first name |
| 10 | Created | 90px | Yes | Short date format |
| 11 | Actions | 70px | No | Edit icon + Delete icon |

### Urgency badges
Overdue, Due Today, Stale — shown as small dot indicators next to the Status badge (not a separate column). Red dot for overdue, amber for due today, grey for stale.

### Mobile (below `lg` breakpoint)
Collapse to compact stacked rows:
```
┌─────────────────────────────────┐
│ ☐ [Lead Title]                 │
│ Status badge  ·  RM 120,000    │
│ Contact · Owner · FollowUp     │
└─────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Scaffold & View Toggle (CrmLeads.tsx)

**File:** `frontend/pages/CrmLeads.tsx`

1. Add state: `viewMode: 'table' | 'card'`
2. Initialize from localStorage: `const saved = localStorage.getItem('crm-leads-view'); const [viewMode, setViewMode] = useState(saved || 'table');`
3. Sync to localStorage on change: `useEffect(() => { localStorage.setItem('crm-leads-view', viewMode); }, [viewMode]);`
4. Add view toggle buttons next to Priority/New Lead buttons:
   ```
   [▤ Table] [▦ Cards]   [auto_awesome Priority]   [+ New Lead]
   ```
5. Conditionally render either `<LeadsTable>` or the existing card grid based on `viewMode`
6. No changes to filters, status pills, search bar, pagination, modals, or bulk actions

### Phase 2: Sort Functionality (CrmLeads.tsx)

1. Add state: `sortConfig: { field: string, direction: 'asc' | 'desc' } | null`
2. Default sort: null (server order) — user can click any sortable column to sort
3. Update `displayedLeads` useMemo to apply client-side sorting after prioritySort:
   ```
   if (sortConfig) {
     result = [...result].sort((a, b) => {
       // compare based on sortConfig.field
       // direction flips on second click
     });
   }
   ```
4. Sortable fields: `title`, `status`, `aiScore`, `estimatedValue`, `followUpDate`, `createdAt`

> **⚠️ Audit note — sort scope:** Client-side sort only operates on the current page (max 20 leads from API). This means "sort by value" shows the top values *on this page*, not globally. Two options:
> - **(A — chosen default)** Keep client-side sort; add a subtle tooltip on column headers: "Sorted within this page". Simple, no backend change.
> - **(B — preferred for production)** Pass `sortField` + `sortDirection` as query params to `fetchLeads()` and let the backend apply `ORDER BY`. Requires adding `orderBy` to the leads API endpoint.
>
> **Decision required before coding Phase 2.** If in doubt, implement Option B.

> **⚠️ Audit note — `followUpDate` type:** Confirm `CrmLead.followUpDate` is typed as `string | null` (not `Date`) before implementing sort and display logic — JSON deserialization means it arrives as an ISO string. The `isOverdue()` / `isToday()` helpers must parse it explicitly (`new Date(lead.followUpDate)`).

### Phase 3: LeadsTable Component

**New file:** `frontend/src/components/crm/LeadsTable.tsx`

Props:
```ts
interface LeadsTableProps {
  leads: CrmLead[];
  sortConfig: SortConfig | null;
  onSort: (field: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  isAllSelected: boolean;
  user: any; // for permission checks
}
```

> **⚠️ Audit note — `isAllSelected` derivation:** Compute this in `CrmLeads.tsx`, not inside `LeadsTable`. The correct expression is:
> ```ts
> const isAllSelected = displayedLeads.length > 0 && displayedLeads.every(l => selectedIds.has(l.id));
> ```
> Do **not** compare `selectedIds.size === leads.length` — `leads` is the raw API array and may differ from `displayedLeads` after client-side filtering.

> **⚠️ Audit note — "select all" scope:** The header checkbox selects all leads **on the current page only** (i.e. `displayedLeads`). If the user wants to bulk-delete across all pages, show a secondary action inside `BulkActionBar`: "Select all N leads" — this is a separate future task and out of scope here.

Structure:
- `<table>` with sticky `<thead>` and `<tbody>`
- Column headers show sort indicator (↑/↓/—) when sortable
- Hover row highlight
- Row border-bottom for separation
- Compact vertical padding (`py-2.5`) for density

### Phase 4: Inline Status Dropdown

**New file:** `frontend/src/components/crm/StatusDropdown.tsx`

1. Renders the current status badge (colored pill with icon)
2. On click, opens a small popover/dropdown with all 6 statuses
3. Clicking a status calls `crmService.updateLead(id, { status })` then refreshes the list
4. Clicking outside or pressing Escape closes the dropdown
5. Uses `useState` for open/close, `useRef` + `useEffect` for outside-click detection
6. Visual: same color badges as the existing STATUS_STYLES map

> **⚠️ Audit note — portal required (HIGH):** The dropdown must be rendered via `ReactDOM.createPortal` into `document.body`, **not** as a child of the table cell. The `<table>` wrapper will have `overflow: hidden` (or a scrollable container ancestor), which clips any `position: absolute` child. Without a portal, the dropdown will be invisibly cut off.
>
> Implementation pattern:
> ```tsx
> // In StatusDropdown.tsx
> const [rect, setRect] = useState<DOMRect | null>(null);
> const triggerRef = useRef<HTMLButtonElement>(null);
>
> const handleOpen = () => {
>   setRect(triggerRef.current?.getBoundingClientRect() ?? null);
>   setOpen(true);
> };
>
> // In render:
> {open && rect && createPortal(
>   <div style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}>
>     {/* status options */}
>   </div>,
>   document.body
> )}
> ```

> **⚠️ Audit note — optimistic update:** After a status selection, do **not** wait for `fetchLeads()` to complete before updating the UI. Apply an optimistic local update first:
> ```ts
> // In CrmLeads.tsx onStatusChange handler:
> setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
> await crmService.updateLead(leadId, { status: newStatus });
> fetchLeads(); // reconcile with server
> ```
> This makes triage feel instant. On failure, `fetchLeads()` will revert the optimistic state.

### Phase 5: Responsive Compact List

Inside `LeadsTable.tsx`, use Tailwind responsive classes:

1. **Desktop (lg+):** Full table with all 11 columns
2. **Tablet (md):** Hide Source, Created columns. Compact spacing.
3. **Mobile (below md):** Switch to stacked `<div>` layout instead of `<table>` — each lead becomes a compact card-row with title on first line, status + value on second line, contact + owner on third line

Use CSS media queries within the component:
```tsx
{/* Desktop: <table> */}
<div className="hidden lg:block">
  <table>...</table>
</div>

{/* Mobile: stacked list */}
<div className="lg:hidden space-y-2">
  {leads.map(lead => <MobileLeadRow key={lead.id} ... />)}
</div>
```

### Phase 6: Integrations & Cleanup

1. Wire `StatusDropdown.onStatusChange` to call optimistic `setLeads()` update → `crmService.updateLead()` → `fetchLeads()` (see Phase 4 audit note)
2. Ensure bulk actions work in table view (select all checkbox, BulkActionBar)
3. Ensure owner filter pill (`?ownerId=`) still works in table view
4. Ensure `?filter=stale` and `?filter=followup` still work
5. Test empty state in table view (show same EmptyState component)
6. Test loading state in table view — use **existing** `<CrmTableSkeleton rows={6} cols={11} />` (already at `frontend/src/components/crm/CrmTableSkeleton.tsx`). **Do not create a new `LeadTableSkeleton.tsx`.**

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `frontend/src/components/crm/LeadsTable.tsx` | **CREATE** | Table view component with header, rows, sorting |
| `frontend/src/components/crm/StatusDropdown.tsx` | **CREATE** | Inline status change dropdown — **must use `createPortal`** (see Phase 4 notes) |
| ~~`frontend/src/components/crm/LeadTableSkeleton.tsx`~~ | ~~CREATE~~ | ~~Removed~~ — reuse existing `CrmTableSkeleton` instead |
| `frontend/pages/CrmLeads.tsx` | **MODIFY** | Add viewMode state, sort state, toggle UI, optimistic status update, conditionally render table vs cards |

No backend changes needed — all data is already served by the existing `crmService.listLeads()` API.

> **Optional backend upgrade (recommended):** If server-side sort is chosen in Phase 2, add `orderBy` + `orderDir` query params to `GET /api/v1/crm/leads` and apply `prisma.crmLead.findMany({ orderBy: { [field]: dir } })`.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Inline status change feels "too easy" — accidental clicks | Show a subtle toast "Status changed to QUALIFIED" that auto-dismisses. No confirmation dialog needed. |
| Table on mobile is cramped | Responsive compact list mode (not horizontal scroll) |
| Status dropdown click conflict with row interactions | Only title is a clickable link; status dropdown is separate `<button>` with `stopPropagation` |
| Accessibility | Add `aria-sort` on table headers, `role="button"` on status badges, keyboard navigation for status dropdown |
| Sort performance with large datasets | Client-side sort operates on current page only (max 20 leads). Consider server-side sort for global ordering — see Phase 2 decision note. |
| **Status dropdown clipped by table overflow** | **Use `createPortal` + `getBoundingClientRect` — see Phase 4 audit note. This will definitely bug without it.** |
| Status update latency makes triage feel slow | Apply optimistic local state update before API call — see Phase 4 audit note. |
| "Select all" semantics ambiguous | Header checkbox = current page only. Global bulk select is out of scope. |

---

## Estimated Effort

- Phase 1 (View Toggle): ~30 min
- Phase 2 (Sort): ~20 min
- Phase 3 (LeadsTable): ~1.5 hr
- Phase 4 (StatusDropdown): ~1 hr (portal + optimistic update adds complexity)
- Phase 5 (Responsive): ~30 min
- Phase 6 (Integration & Testing): ~30 min

**Total: ~4.25 hours**

---

## Visual Mockup — Desktop Table View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CRM / Leads                                                                                                 │
│                                                         [▤ Table] [▦ Cards] [⚡Priority] [+ New Lead]       │
│                                                                                                             │
│ [All] [NEW] [CONTACTED] [QUALIFIED] [UNQUALIFIED] [CONVERTED] [LOST]                                        │
│ 🔍 Search leads...        [All Sources ▾]                                                                   │
│                                                                                                             │
│ ☐ │ Lead Title              │ Status        │ Score │ Contact           │ Value       │ Follow-up │ Source     │ Owner  │ Created │ ⋮  │
│───┼─────────────────────────┼───────────────┼───────┼───────────────────┼─────────────┼────────────┼───────────┼────────┼─────────┼────│
│ ☐ │ Corporate Trust Conv… → │ ● CONVERTED   │ 95    │ Datin Rosnah      │ RM 120,000  │ 4 Jun      │ Website    │ Emily  │ 4 Jun   │ ✎🗑│
│ ☐ │ Family Office Onboard… →│ ● UNQUALIFIED │ 20    │ Lim Chee Wai      │ RM 30,000   │ —          │ Referral   │ Emily  │ 4 Jun   │ ✎🗑│
│ ☐ │ Unit Trust Distribution →│ ● LOST 🔴     │ 12    │ Jonathan Teh      │ RM 75,000   │ 🔴12 May   │ LinkedIn   │ Emily  │ 4 Jun   │ ✎🗑│
│ ☐ │ Digital Asset Trust … → │ ● NEW         │ 68    │ Kwok Wei Lin      │ RM 200,000  │ ⚡Today    │ Cold Call  │ Sarah  │ 3 Jun   │ ✎🗑│
│   │ ...                      │               │       │                   │             │            │           │        │         │    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Clicking ● CONVERTED opens status dropdown inline
- Clicking lead title text navigates to `/crm/leads/:id`
- Column headers with ▲/▼ are sortable
- ☐ header checkbox selects/deselects all on current page