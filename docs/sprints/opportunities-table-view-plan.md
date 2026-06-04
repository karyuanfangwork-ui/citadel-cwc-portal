# Opportunities Table View Improvement Plan

## Current State

CrmOpportunities.tsx (624 lines) is a monolithic page that:
- Has a **single table view** only — no card/table toggle
- Table is hard-coded inline (no extracted component)
- No sortable columns — users cannot sort by any field
- No inline stage editing — clicking "Edit" opens a full modal
- Edit/Delete buttons are text links at row end (no sticky column, require scroll)
- No mobile/card fallback — just one big table
- Stage uses `StateBadge` (static pill) instead of an interactive dropdown
- Container max-width is 1200px, tight for 9 columns
- No title tooltip or description preview — long names get truncated
- Repeated `formatCurrency` and `formatDate` defined inline instead of shared

## Goals

Same improvements applied to the Leads page:
1. **Extract `OpportunitiesTable` component** — desktop table + mobile stacked card view
2. **Add view toggle** (table / card) with localStorage persistence
3. **Sortable columns** with 3-cycle click (asc → desc → none), client-side sort
4. **Inline stage editing** — portal-based `StageDropdown` component (like Leads' `StatusDropdown`)
5. **Sticky actions column** — edit/delete icons always visible, no horizontal scroll needed
6. **Responsive column hiding** — Account and Close Date hidden below `xl` breakpoint
7. **Opportunity name with tooltip + 2-line clamp + description preview**
8. **Wider container** — 1400px in table mode (vs current 1200)
9. **Extract shared constants** — add opportunity-specific helpers to `crmConstants.ts`
10. **Optimistic stage updates** — update local state immediately, revert on API failure

## Key Differences from Leads

| Aspect | Leads | Opportunities |
|--------|-------|---------------|
| Status field | `LeadStatus` (enum: NEW, CONTACTED, QUALIFIED, etc.) | `Stage` — comes from `CrmPipelineStage` (dynamic per pipeline) |
| Status change API | `crmService.updateLead(id, { status })` | `crmService.moveStage(id, stageId)` — uses pipeline stage ID, not name |
| Score field | `aiScore` (0–100) | `aiWinProbability` (0–100) + manual `probability` |
| Value field | `estimatedValue` | `value` |
| Date field | `followUpDate` | `expectedCloseDate` |
| Contact field | `contactName` + `companyName` (denormalized) | `contact.firstName + lastName` (nested relation) |
| Unique columns | Source, AI Score | Account, Probability bar + AI badge |

## Implementation Steps

### Step 1: Extend `crmConstants.ts` with opportunity helpers

Add:
- ~~`OPPORTUNITY_STAGE_STYLES`~~ — **Do not create a static name→style map.** Pipeline stages are user-defined and dynamic; hardcoding `PROSPECTING`, `CLOSED_WON`, etc. will break the moment a user renames or adds a stage. Instead, derive badge color from `stage.color` (if the model exposes it) or use a deterministic color from `stage.displayOrder % palette.length`. The `StageDropdown` must style badges dynamically, not from a constant keyed to stage names.
- `formatCurrency` already exists — reuse
- `formatDate` already exists — reuse
- `winProbStyle` moved from inline in CrmOpportunities.tsx → crmConstants.ts
- `isOverdue` for close date (reuse existing `isOverdue` — works for any date string)

### Step 2: Create `StageDropdown.tsx` component

Like `StatusDropdown.tsx` but for opportunity stages. Differences:
- Props: `currentStage: { id: string; name: string }`, `stages: { id: string; name: string; probability: number }[]`, `onChange: (stageId: string) => void`
- Renders the current stage name as a pill button
- Dropdown shows all stages from the pipeline (not a fixed enum like LeadStatus)
- Uses `createPortal` for overflow clipping avoidance (same pattern as `StatusDropdown` — `getBoundingClientRect` + `position: fixed`)
- Compact mode for table rows

> **⚠️ Audit note — `lostReason` required for CLOSED_LOST (HIGH):** `crmService.moveStage(id, stageId, lostReason?)` accepts an optional `lostReason`. When the user selects a stage whose name contains "LOST" (case-insensitive) or whose `probability === 0` and it's a terminal stage, the dropdown must **intercept** the selection rather than immediately calling `onChange`. Show a brief inline form (a small textarea within the popover) to capture the lost reason before confirming. Then call `onChange(stageId, lostReason)` and update `StageDropdown`'s `onChange` type to `(stageId: string, lostReason?: string) => void`.
>
> Without this, every CLOSED_LOST move leaves `opportunity.lostReason` permanently null.

> **⚠️ Audit note — dynamic stage colors:** Do not use a static name→color map. Style each stage badge from its `displayOrder` index into a fixed palette (e.g. the 6 brand/semantic CSS vars), or use `stage.color` if the backend exposes it. Example:
> ```ts
> const STAGE_PALETTE = ['var(--color-brand-500)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-success)', 'var(--color-danger)', 'var(--color-text-secondary)'];
> const stageBadgeColor = (stage: CrmPipelineStage) => STAGE_PALETTE[stage.displayOrder % STAGE_PALETTE.length];
> ```

### Step 3: Create `OpportunitiesTable.tsx` component

Desktop table columns (left → right):

| # | Column | Sortable | Responsive | Notes |
|---|--------|----------|------------|-------|
| 1 | Checkbox | No | Always | Select-all toggle |
| 2 | Opportunity | Yes (name) | Always | 2-line clamp + tooltip + description preview, minWidth 180 |
| 3 | Stage | Yes (stageId) | Always | Inline `StageDropdown`, not static `StateBadge` |
| 4 | Value | Yes | Always | formatCurrency |
| 5 | Probability | Yes | Always | Progress bar + manual % + AI badge if exists |
| 6 | Contact | No | Always | firstName + lastName, fallback dash |
| 7 | Account | No | `hidden xl:table-cell` | Account name, can be long |
| 8 | Close Date | Yes (expectedCloseDate) | `hidden xl:table-cell` | formatShortDate + overdue indicator |
| 9 | Owner | No | Always | Avatar + firstName |
| 10 | Actions | No | Always | Sticky right, bg-white + left shadow |

Mobile stacked cards (below `lg` breakpoint): same pattern as `MobileLeadRow`.

> **⚠️ Audit note — pipeline stages prop:** `StageDropdown` needs the stages for each row's specific pipeline. Each opportunity has a `pipelineId`; opportunities can span multiple pipelines. Add `pipelines` to `OpportunitiesTable`'s props interface:
> ```ts
> pipelines: { id: string; stages: { id: string; name: string; probability: number }[] }[];
> ```
> Inside the table, look up stages per row: `const stages = pipelines.find(p => p.id === opp.pipelineId)?.stages ?? []` and pass to `<StageDropdown>`.

> **⚠️ Audit note — loading skeleton:** Add a loading state for table mode. During `loading === true`, render `<CrmTableSkeleton rows={6} cols={10} />` (already exists at `frontend/src/components/crm/CrmTableSkeleton.tsx`). Do not create a new skeleton component.

> **⚠️ Audit note — probability bar color:** The current code uses `STATUS_COLORS[opp.stage?.name?.toUpperCase()]` (lead-status color map) for the probability bar fill — a misuse. Replace with the dynamic stage color from the palette above or a neutral brand color (`var(--color-brand-500)`).

### Step 4: Patch `CrmOpportunities.tsx`

1. Add `viewMode` state with localStorage key `crm-opportunities-view` (default: `'table'`)
2. Add `sortConfig` state with `SortField` type and 3-cycle handler
3. Add `handleStageChange` — optimistic update: update local `opportunities` state, call `crmService.moveStage`, revert on failure (see optimistic revert pattern below)
4. Add view toggle UI (table/card icons beside the "New Opportunity" button)
5. Widen container from 1200 → 1400 when `viewMode === 'table'`
6. Remove inline `formatCurrency`, `formatDate`, `winProbStyle` — import from `crmConstants`
7. Replace inline table with `<OpportunitiesTable>` (when `viewMode === 'table'`)
8. Keep existing inline table as the "card"/"compact" view fallback — **see decision note below**
9. Import and use `StageDropdown` instead of `StateBadge` for stage column
10. Fix probability bar color: replace `STATUS_COLORS[opp.stage?.name?.toUpperCase()]` with dynamic stage palette color
11. Fix `isAllSelected` derivation: replace `selectedIds.size === opportunities.length` with `opportunities.length > 0 && opportunities.every(o => selectedIds.has(o.id))`

> **⚠️ Audit note — "card" view decision required (BLOCKER):** The current Opportunities view is already a table — there is no existing card grid to fall back to (unlike Leads). "Keep existing table as card view" is not meaningful. Two options before coding:
> - **(A — recommended)** Drop the view toggle entirely. Opportunities is table-only; just extract and improve it. No localStorage key needed. Simpler, no dead UI.
> - **(B)** Build a Kanban-by-stage board as the "card" alternative (`viewMode === 'kanban'`). High value for sales, but doubles scope.
>
> **Decide before starting Step 4.**

> **⚠️ Audit note — optimistic revert pattern:** Capture the old opportunity before updating, and revert in `catch` before `fetchOpportunities()` to avoid race conditions:
> ```ts
> const handleStageChange = async (id: string, stageId: string, lostReason?: string) => {
>   const prev = opportunities.find(o => o.id === id)!;
>   const stageObj = pipelines.flatMap(p => p.stages ?? []).find(s => s.id === stageId);
>   setOpportunities(opps => opps.map(o => o.id === id ? { ...o, stageId, stage: stageObj } : o));
>   try {
>     await crmService.moveStage(id, stageId, lostReason);
>     fetchOpportunities();
>   } catch {
>     setOpportunities(opps => opps.map(o => o.id === id ? prev : o));
>   }
> };
> ```

### Step 5: Sort configuration

```typescript
type SortField = 'name' | 'stageId' | 'value' | 'probability' | 'expectedCloseDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}
```

Sort is client-side only (same as Leads) — operates on current page of max 20 items.

> **⚠️ Audit note — sort scope:** Same caveat as Leads: client-side sort only orders the current page, not all opportunities globally. If global ordering matters (e.g. "show all highest-value opps"), sort params should be passed to `listOpportunities()` as `orderBy` / `orderDir` query params and handled server-side. Decide before coding.

### Step 6: TypeScript verification

Run `npx tsc --noEmit` to ensure zero new compilation errors.

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/crm/crmConstants.ts` | Add `OPPORTUNITY_STAGE_STYLES`, move `winProbStyle` here |
| `frontend/src/components/crm/StageDropdown.tsx` | Create — portal-based pipeline stage dropdown |
| `frontend/src/components/crm/OpportunitiesTable.tsx` | Create — desktop table + mobile cards |
| `frontend/pages/CrmOpportunities.tsx` | Modify — add viewMode, sort, optimistic stage change, use extracted components |

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/crm/crmConstants.ts` | Add `winProbStyle`; move `formatCurrency`/`formatDate` imports; **no** static stage name map |
| `frontend/src/components/crm/StageDropdown.tsx` | Create — portal-based, dynamic stage colors, `lostReason` intercept for LOST stages |
| `frontend/src/components/crm/OpportunitiesTable.tsx` | Create — desktop table + mobile cards, receives `pipelines` prop for stage lookup |
| `frontend/pages/CrmOpportunities.tsx` | Modify — viewMode, sortConfig, optimistic stage change with revert, fix isAllSelected, fix probability bar color |

## Decisions Required Before Coding

| # | Decision | Options |
|---|---|---|
| 1 | **Card view** — what is it? | (A) Drop toggle, table-only. (B) Build Kanban board as alt view. |
| 2 | **Sort scope** — client or server? | (A) Client-side, page-scoped (simple). (B) Pass params to API (globally correct). |

## Estimated Effort

- If card view = dropped (Option A): ~3–4 hours
- If card view = Kanban (Option B): ~6–8 hours (Kanban is a significant feature)

Most patterns are directly reusable from `LeadsTable.tsx`, `StatusDropdown.tsx`, and `crmConstants.ts`. Main new complexity is the `lostReason` intercept in `StageDropdown` and dynamic stage colors.