# Pipeline List-as-Default + Kanban Toggle Implementation Plan

## Goal

Change `/crm/pipeline` so it defaults to a **list (table) view** of opportunities with a toggle to switch to **kanban mode**. This replaces the current behavior where `/crm/pipeline` always shows kanban.

## Decision

**Option A** — Add list view + toggle to `CrmPipeline.tsx`, keep `/crm/opportunities` as-is for now. Additive, nothing breaks.

## Scope

| In Scope | Out of Scope |
|----------|-------------|
| View mode toggle (list ↔ kanban) with localStorage persistence | Merging /crm/opportunities into /crm/pipeline |
| Reuse `OpportunitiesTable` in list mode | Server-side paginated list mode (uses client data from pipeline) |
| Sort state for table columns | Full edit modal (navigate to detail page instead) |
| Selection state + bulk actions in list mode | URL filter params (?filter=overdue, ?ownerId=...) |
| Flatten pipeline stages → `CrmOpportunity[]` for table | Removing /crm/opportunities route or CrmNav tab |
| CrmNav relabel: "Pipeline" icon changes with view | `useCrmUpdate` real-time refresh (can add later) |

## Implementation Steps

### Step 1: Add viewMode state to CrmPipeline.tsx

Add `viewMode: 'list' | 'kanban'` state with localStorage persistence:

```tsx
const [viewMode, setViewMode] = useState<'list' | 'kanban>(() => {
  try { return localStorage.getItem('crm-pipeline-view') as 'list' | 'kanban' || 'list'; }
  catch { return 'list'; }
});

useEffect(() => {
  try { localStorage.setItem('crm-pipeline-view', viewMode); } catch {}
}, [viewMode]);
```

Default is `'list'`. Toggle buttons go in the header next to "List View" / "New Opportunity".

### Step 2: Add toggle UI in header

Replace the current "List View" button (which navigates to `/crm/opportunities`) with a **view mode toggle**:

```
Currently:
  [New Opportunity] [List View →]

After:
  [view_list | view_kanban toggle] [New Opportunity]
```

The toggle is two icon buttons side by side — `view_list` and `view_kanban` — with the active one highlighted. No more "List View" button that navigates away.

```tsx
<div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
  <button
    onClick={() => setViewMode('list')}
    className={`p-2 text-sm ${viewMode === 'list' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
    style={{ border: 'none', cursor: 'pointer' }}
    title="Table view"
  >
    <span className="material-symbols-outlined text-base">view_list</span>
  </button>
  <button
    onClick={() => setViewMode('kanban')}
    className={`p-2 text-sm ${viewMode === 'kanban' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
    style={{ border: 'none', cursor: 'pointer' }}
    title="Kanban view"
  >
    <span className="material-symbols-outlined text-base">view_kanban</span>
  </button>
</div>
```

### Step 3: Flatten pipeline stages → CrmOpportunity[] for list mode

> **Audit note:** `filteredStages` already applies search + owner filter (see `useMemo` at line 69 of `CrmPipeline.tsx`). Flattening from `filteredStages` (not the raw `stages`) ensures search and owner filter are respected in list mode automatically.

When `viewMode === 'list'`, flatten the stages data into a flat `CrmOpportunity[]`:

```tsx
const flatOpportunities = useMemo(() => {
  return filteredStages.flatMap(stage =>
    (stage.opportunities ?? []).map(opp => ({
      ...opp,
      stage: {
        id: stage.id,
        name: stage.name,
        probability: stage.probability,
        displayOrder: stage.displayOrder,
        color: stage.color,
        isWonStage: stage.isWonStage,
        isLostStage: stage.isLostStage,
        pipelineId: stage.pipelineId,
        _count: stage._count,
      },
    }))
  );
}, [filteredStages]);
```

This ensures each opportunity has its `stage` relation populated, which `OpportunitiesTable` needs for the `StageDropdown`.

### Step 4: Add sort state

Same pattern as CrmOpportunities — 3-cycle click (asc → desc → none), client-side sort:

```tsx
import { SortConfig } from '../src/components/crm/OpportunitiesTable';

const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

const handleSort = useCallback((field: SortConfig['field']) => {
  setSortConfig(prev => {
    if (!prev || prev.field !== field) return { field, direction: 'asc' };
    if (prev.direction === 'asc') return { field, direction: 'desc' };
    return null;
  });
}, []);

const sortedOpportunities = useMemo(() => {
  if (!sortConfig) return flatOpportunities;
  const sorted = [...flatOpportunities];
  const dir = sortConfig.direction === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortConfig.field) {
      case 'name': cmp = (a.name ?? '').localeCompare(b.name ?? ''); break;
      case 'stageId': cmp = (a.stage?.name ?? '').localeCompare(b.stage?.name ?? ''); break;
      case 'value': cmp = (a.value ?? 0) - (b.value ?? 0); break;
      case 'probability': cmp = (a.probability ?? 0) - (b.probability ?? 0); break;
      case 'expectedCloseDate':
        const da = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
        const db = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
        cmp = da - db; break;
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
    }
    return cmp * dir;
  });
  return sorted;
}, [flatOpportunities, sortConfig]);
```

### Step 5: Add selection state + bulk actions

CrmOpportunities has full bulk actions (assign owner, change stage, delete). The pipeline list view should support the same:

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const toggleSelect = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
};

const selectAll = () => setSelectedIds(new Set(sortedOpportunities.map(o => o.id)));
const clearSelection = () => setSelectedIds(new Set());
const isAllSelected = sortedOpportunities.length > 0 && sortedOpportunities.every(o => selectedIds.has(o.id));
```

Wire bulk actions to the same `crmService.moveStage` / `crmService.updateOpportunity` / `crmService.deleteOpportunity` calls that CrmOpportunities uses. After bulk action, re-fetch pipeline data.

**Bulk assign-owner:** Copy the owner assignment bulk action from `CrmOpportunities.tsx` — look for the `bulkActions` array and the `handleBulkAssignOwner` handler. It calls `crmService.updateOpportunity(id, { ownerId })` for each selected id in parallel via `Promise.all`, then re-fetches.

### Step 6: Wire onEdit, onDelete, onStageChange

`OpportunitiesTable` expects these callbacks:

- **`onEdit`** — navigate to opportunity detail page: `navigate('/crm/opportunities/${opp.id}')`. No full edit modal needed for V1.
- **`onDelete`** — show the existing `ConfirmDialog` with delete confirmation, call `crmService.deleteOpportunity(id)`, re-fetch pipeline.
- **`onStageChange`** — use the existing optimistic `moveStage` logic (already in CrmPipeline for drag-and-drop). Same `handleMobileStageChange` pattern.

### Step 7: Render OpportunitiesTable in list mode

> **Mobile behavior:** When `viewMode === 'list'`, render `OpportunitiesTable` for all screen sizes (mobile included). The `CrmMobilePipeline` component only renders in kanban mode. The toggle UI in the header is visible on both mobile and desktop, so users can switch views on any device.

In the Kanban Board section of CrmPipeline.tsx, add a conditional branch:

```tsx
{loading ? (
  <LoadingSkeleton />
) : viewMode === 'list' ? (
  <>
    {/* Bulk action bar */}
    {selectedIds.size > 0 && (
      <BulkActionBar
        selectedCount={selectedIds.size}
        actions={bulkActions}
        onClear={clearSelection}
        processing={bulkProcessing}
      />
    )}
    <OpportunitiesTable
      opportunities={sortedOpportunities}
      pipelines={pipelines.map(p => ({
        id: p.id,
        stages: p.stages?.map(s => ({
          id: s.id, name: s.name, probability: s.probability,
          displayOrder: s.displayOrder, color: s.color,
          isWonStage: s.isWonStage, isLostStage: s.isLostStage,
        })),
      }))}
      sortConfig={sortConfig}
      onSort={handleSort}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelect}
      onSelectAll={selectAll}
      onClearSelection={clearSelection}
      onEdit={(opp) => navigate(`/crm/opportunities/${opp.id}`)}
      onDelete={(opp) => { setDeleteItem(opp); setShowDelete(true); }}
      onStageChange={handleMobileStageChange}
      isAllSelected={isAllSelected}
      user={user}
    />
    {/* Note: pipelines prop is derived from the existing `pipelines` state array.
        StageDropdown inside OpportunitiesTable uses it to list available stages per pipeline.
        activePipeline (the selected pipeline id) does not need to be passed separately —
        each opportunity already carries its stage.pipelineId from the flatten in Step 3. */}
  </>
) : (
  <>
    {/* Desktop kanban + Mobile tabbed view (existing code) */}
  </>
)}
```

### Step 8: Update CrmNav "Pipeline" tab

Change the Pipeline tab icon from `view_kanban` to a more neutral icon like `trending_up` or `waterfall_chart` since the default view is now a list, not kanban. Keep the label as "Pipeline".

```tsx
// CrmNav.tsx line 19
{ to: '/crm/pipeline', label: 'Pipeline', icon: 'trending_up' },  // was 'view_kanban'
```

Also update the mobile bottom nav:
```tsx
// CrmNav.tsx line 44
{ to: '/crm/pipeline', label: 'Pipeline', icon: 'trending_up' },  // was 'view_kanban'
```

### Step 9: TypeScript verification

Run `npx tsc --noEmit` — zero new errors.

## Files to Modify

| File | Action |
|------|--------|
| `frontend/pages/CrmPipeline.tsx` | Major — add viewMode state, toggle UI, flatten logic, sort state, selection state, wire OpportunitiesTable, delete confirmation |
| `frontend/src/components/CrmNav.tsx` | Minor — change Pipeline icon from `view_kanban` → `trending_up` |

## New Imports for CrmPipeline.tsx

```tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // add useCallback
import OpportunitiesTable, { SortConfig } from '../src/components/crm/OpportunitiesTable';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { useAuth } from '../src/context/AuthContext';
```

> **Note:** `useCallback` is required for `handleSort` in Step 4. Add it to the existing React import line — don't add a second React import.

## Key Differences from CrmOpportunities (what list mode doesn't have)

| Feature | CrmOpportunities | Pipeline List Mode | Reason |
|---------|-----------------|-------------------|--------|
| Server-side pagination | Yes (`listOpportunities` page/limit) | No (loads all via `getPipeline`) | Pipeline data is already client-side. Fine for <100 opps. |
| Full edit modal | Yes | No (click → detail page) | Simpler V1. Can add later. |
| URL filter params | Yes (?filter=overdue, ?ownerId=...) | No | Client-side search+owner filter already works on pipeline |
| `useCrmUpdate` real-time | Yes | No | Can add later — pipeline re-fetches on stage move |
| Create form fields | Full (description, contact, probability) | Minimal (name, account, stage, value, date) | Decision B — unify later |

## Estimated Effort

~1.5–2 hours. Most patterns copy-paste from CrmOpportunities. No new components needed.

## Risks

- **No pagination in list mode** — if a pipeline has >100 opportunities, the table will be long. Mitigated by search + owner filter. Can add server-side pagination in a future sprint if needed.
- **Two separate create forms** — intentional for now (Decision B). Minor inconsistency.
- **CrmOpportunities page becomes semi-redundant** — both pages now show a table of the same data. This is expected as a transitional state. Eventually CrmOpportunities can redirect to /crm/pipeline?view=table.