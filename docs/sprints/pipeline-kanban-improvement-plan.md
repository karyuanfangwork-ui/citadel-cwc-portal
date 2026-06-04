# Pipeline Kanban Board Improvement Plan

## Current State

CrmPipeline.tsx (393 lines) is a monolithic page that:
- Has **inline duplicate helpers** — `formatCurrency`, `formatDate`, `winProbStyle` redefined locally (lines 9–16) instead of importing from `crmConstants.ts` (same anti-pattern we just fixed on CrmOpportunities)
- Uses **`StateBadge` with static name-keyed color map** for stage column headers — `STATUS_COLORS[state.toUpperCase()]` only has entries for 6 hardcoded CRM stage names (`PROSPECTING`, `QUALIFICATION`, `NEGOTIATION`, `WON`, `LOST`, etc.). Custom/renamed stages fall back to grey `#6b7280`. Pipeline stages have a `.color` field from the backend and a `displayOrder` for dynamic palette rotation — neither is used.
- Has **no mobile-responsive view** — `CrmMobilePipeline.tsx` (150 lines) exists but is dead code: never imported, never rendered. On mobile, the kanban is just horizontally scrollable 288px columns with no stacked/tabbed alternative.
- **CrmMobilePipeline.tsx** uses raw inline styles with hardcoded hex colors (`#2563eb`, `#6b7280`, `#9ca3af`, `#e5e7eb`) instead of design system tokens/CSS variables.
- Has **no optimistic drag** — dropping a card calls `await crmService.moveStage()` + full `await crmService.getPipeline()` re-fetch before UI updates. Noticeable delay on each drag. The Opportunities page now has optimistic stage changes; the pipeline board doesn't.
- **Card content truncated without tooltip** — Account names are truncated with `max-w-[120px]` but no `title` attribute (line 286). Long account names are silently cut off.
- **No search/filter on the board** — If a pipeline has many cards, there's no way to find a specific opportunity by name, owner, or account.
- **Create modal is inconsistent** — "New Opportunity" modal on this page is missing fields that the Opportunities page create form has (no description, no manual probability input, no contact selector). Two separate create flows produce different opportunity records.
- **No stage/pipeline CRUD** — Users cannot add, rename, reorder, or delete pipeline stages from the UI. Cannot create/edit/delete pipelines. Admin requires direct API access.

## Goals

1. **Remove inline duplicate helpers** — Import `formatCurrency`, `formatDate`, `winProbStyle` from `crmConstants.ts`
2. **Replace `StateBadge` with dynamic stage badge** — Use `stageBadgeColor(stage)` from `crmConstants.ts` (respects `stage.color` from backend, falls back to `STAGE_PALETTE[displayOrder % length]`). Custom/renamed stages get correct colors.
3. **Wire in `CrmMobilePipeline`** below `lg` breakpoint — rewrite it to use Tailwind + design tokens, fix hardcoded hex, accept full `CrmPipelineStage[]` with nested opportunities (not the simplified `PipelineCard` interface)
4. **Add optimistic drag** — move card in local state immediately, call API in background, revert on failure
5. **Add tooltips on truncated text** — `title` attribute on account name, opportunity name, and other truncated content
6. **Add board search/filter** — text search + owner filter above the kanban
7. **Unify create opportunity modal** — share a single `CreateOpportunityModal` component between Pipeline and Opportunities pages
8. **Add stage inline edit** — ability to rename/reorder stages from column header (stretch goal)
9. **Add pipeline CRUD** — create/edit/delete pipelines from a settings area (stretch goal)

## Key Differences from Opportunities Page

| Aspect | Opportunities (Table) | Pipeline (Kanban) |
|--------|---------------------|-------------------|
| View | Flat table with columns | Kanban board with stage columns |
| Stage interaction | `StageDropdown` (inline select) | Drag-and-drop between columns |
| Lost reason | Intercepted inside `StageDropdown` popover | `ConfirmDialog` modal (already works) |
| Stage color source | `stageBadgeColor(stage)` via `StageDropdown` | `StateBadge` → static `STATUS_COLORS` map (wrong) |
| Mobile | Stacked cards in `OpportunitiesTable` | Dead `CrmMobilePipeline` — just horizontal scroll |
| Create form | Full fields (description, manual probability, contact) | Minimal (name, account, stage, value, close date) |
| Sort/search | Column sort + search bar | None |
| Bulk actions | Select all + bulk stage change | None |

## Implementation Steps

### Step 1: Remove inline helpers → import from crmConstants

**HIGH severity** — same anti-pattern already fixed on CrmOpportunities.

CrmPipeline.tsx lines 9–16 define `formatCurrency`, `formatDate`, `winProbStyle` locally. These already exist in `crmConstants.ts`.

Actions:
- Delete lines 9–16 (the three local function definitions)
- Add import: `import { formatCurrency, formatDate, winProbStyle } from '../src/components/crm/crmConstants';`
- Fix `formatDate` usage: the shared version includes year (`'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }`), while the local one omitted year. On the kanban card, close dates benefit from showing year. If space-constrained, use `formatShortDate` from crmConstants instead (which omits year).
- Update the `formatDate` call on line 289 accordingly

### Step 2: Replace StateBadge with dynamic stage badge

**HIGH severity** — `StateBadge` uses a static `STATUS_COLORS` map keyed by stage name. Custom/renamed stages fall back to grey.

The `CrmPipelineStage` model already has:
- `.color` — a hex color string from the backend (e.g. `#f97316`)
- `.displayOrder` — integer for ordering

`crmConstants.ts` already has `stageBadgeColor(stage)` that returns `stage.color` if present, otherwise `STAGE_PALETTE[displayOrder % length]`.

Actions in CrmPipeline.tsx:
- Remove `import StateBadge from '../src/components/ui/StateBadge';`
- Replace `<StateBadge state={stage.name} size="sm" />` (line 241) with a new inline `StagePill` or use the same badge pattern from `StageDropdown`:

```tsx
// Replace line 241
<span
  className="inline-flex items-center gap-1 font-bold rounded-full text-[10px] px-1.5 py-0.5"
  style={{
    background: `${stageBadgeColor(stage)}18`,  // hex + alpha suffix
    color: stageBadgeColor(stage),
  }}
>
  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
    {stage.isWonStage ? 'emoji_events' : stage.isLostStage ? 'trending_down' : 'group'}
  </span>
  {stage.name}
</span>
```

- Import `stageBadgeColor` from `crmConstants.ts`
- Apply the same dynamic color to the column's left border accent for visual cohesion:

```tsx
// In the column container div (line 232), add a top border accent:
style={{ borderTop: `3px solid ${stageBadgeColor(stage)}` }}
```

- The `CollapsedColumnPill` already uses `stage.color` (line 222: `color={stage.color || 'var(--color-text-secondary)'}`). Update it to also use `stageBadgeColor(stage)` for consistency.

### Step 3: Wire in CrmMobilePipeline below lg breakpoint

**HIGH severity** — on mobile, the kanban is just a horizontal scroll of narrow columns with no tabbed/stage navigation.

Current `CrmMobilePipeline.tsx` problems:
- Never imported or used
- Accepts simplified `PipelineCard[]` interface (not the real `CrmOpportunity`)
- Uses raw inline styles with hardcoded hex colors (`#2563eb`, `#6b7280`, etc.)
- No design token usage
- Stage tabs at top + swipe gestures for stage navigation
- Cards don't show AI win probability, owner avatar, or account link

Actions:
1. **Rewrite `CrmMobilePipeline.tsx`** to accept `CrmPipelineStage[]` directly:

```tsx
interface Props {
  stages: CrmPipelineStage[];
  onCardClick: (oppId: string) => void;
  onStageChange?: (oppId: string, stageId: string) => void;
  formatCurrency: (val: number | null) => string;
  formatShortDate: (d: string | null) => string;
}
```

2. **Use Tailwind + design tokens** — replace all hardcoded hex with `text-brand-600`, `text-text-secondary`, `text-text-tertiary`, `bg-surface`, `border-border`, etc.
3. **Show full card content** — AI win probability badge, owner avatar, account name with tooltip
4. **Add stage color** — use `stageBadgeColor(stage)` for active tab indicator and card accent
5. **Wire into CrmPipeline.tsx** below `lg` breakpoint:

```tsx
// In CrmPipeline.tsx (Kanban Board section, around line 194)
<div className="flex-1 overflow-x-auto px-4 sm:px-8 py-5" style={{ background: 'var(--color-surface-muted)' }}>
  {loading ? (
    <LoadingSkeleton />
  ) : (
    <>
      {/* Desktop: kanban columns — hidden below lg */}
      <div className="hidden lg:flex gap-4 h-full min-w-max items-stretch">
        {stages.map(stage => ( /* existing kanban columns */ ))}
      </div>
      {/* Mobile: tabbed stage view — hidden above lg */}
      <div className="lg:hidden">
        <CrmMobilePipeline
          stages={stages}
          onCardClick={(oppId) => navigate(`/crm/opportunities/${oppId}`)}
          onStageChange={handleMobileStageChange}
          formatCurrency={formatCurrency}
          formatShortDate={formatShortDate}
        />
      </div>
    </>
  )}
</div>
```

6. **Add `handleMobileStageChange`** — for the mobile view, when a user swipes a card to a different stage (or uses a stage action button), call the same `crmService.moveStage()` with optimistic update pattern.

### Step 4: Add optimistic drag

**MEDIUM severity** — current drag waits for full API round-trip before moving card.

Current flow (lines 75–106):
```
handleDrop → await moveStage() → await getPipeline() → setStages()
```

Replace with optimistic flow:
```
handleDrop → setStages(optimistic) → await moveStage() → on failure: revert
```

```tsx
const handleDrop = async (e: React.DragEvent, stageId: string) => {
  e.preventDefault();
  setDragOverStage(null);
  const oppId = e.dataTransfer.getData('text/plain');
  if (!oppId) return;

  // Find source stage
  let sourceStageId = '';
  for (const stage of stages) {
    if (stage.opportunities?.some(o => o.id === oppId)) {
      sourceStageId = stage.id;
      break;
    }
  }
  if (sourceStageId === stageId) { setDraggedOpp(null); return; }

  const targetStage = stages.find(s => s.id === stageId);
  if (targetStage?.isLostStage) {
    setPendingLostOpp({ oppId, stageId });
    setShowLostReason(true);
    setDraggedOpp(null);
    return;
  }

  // Optimistic: move card in local state immediately
  const opp = stages.flatMap(s => s.opportunities ?? []).find(o => o.id === oppId);
  if (!opp) { setDraggedOpp(null); return; }

  const prevStages = stages; // snapshot for revert
  setStages(prev => prev.map(s => {
    if (s.id === sourceStageId) {
      return { ...s, opportunities: (s.opportunities ?? []).filter(o => o.id !== oppId) };
    }
    if (s.id === stageId) {
      return { ...s, opportunities: [...(s.opportunities ?? []), { ...opp, stageId }] };
    }
    return s;
  }));
  setDraggedOpp(null);

  try {
    await crmService.moveStage(oppId, stageId);
  } catch (e) {
    console.error(e);
    setStages(prevStages); // revert
  }
};
```

Note: for the lost reason flow (`handleConfirmLost`), apply the same optimistic pattern.

### Step 5: Add tooltips on truncated text

**MEDIUM severity** — silent truncation with no way to see full text.

Actions:
- Line 286: `<span className="text-xs text-text-secondary truncate max-w-[120px]">` → add `title={opp.account?.name ?? ''}`
- Line 268: `<div className="text-sm font-bold text-text-primary mb-1 line-clamp-2">` → add `title={opp.name}`
- Add `title` to owner name span (line 297)

### Step 6: Add board search/filter

**MEDIUM severity** — no way to find a specific card in a large pipeline.

Add a search bar + owner dropdown filter in the header area (between pipeline selector and "New Opportunity" button):

```tsx
// State
const [searchQuery, setSearchQuery] = useState('');
const [ownerFilter, setOwnerFilter] = useState<string>(''); // '' = all

// Derive filtered stages
const filteredStages = stages.map(stage => ({
  ...stage,
  opportunities: (stage.opportunities ?? []).filter(opp => {
    const matchesSearch = !searchQuery ||
      opp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.account?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOwner = !ownerFilter || opp.ownerId === ownerFilter;
    return matchesSearch && matchesOwner;
  }),
}));

// Extract unique owners from all stages for the filter dropdown
const owners = useMemo(() => {
  const map = new Map<string, string>();
  stages.forEach(s => (s.opportunities ?? []).forEach(o => {
    if (o.owner && !map.has(o.owner.id)) {
      map.set(o.owner.id, `${o.owner.firstName} ${o.owner.lastName}`);
    }
  }));
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}, [stages]);
```

UI: search input + owner dropdown in the header bar, hidden below `sm` breakpoint.

### Step 7: Unify create opportunity modal

**MEDIUM severity** — two separate create flows with different fields.

Create `frontend/src/components/crm/CreateOpportunityModal.tsx` that both pages use.

Fields (consistent set):
- Opportunity Name (required)
- Account (select, required)
- Contact (select, optional, filtered by account)
- Stage (select, from pipeline stages)
- Value (MYR)
- Probability (manual %, auto-set from stage default)
- Expected Close Date
- Description (textarea, optional)
- Owner (select from CRM team)

Both `CrmPipeline.tsx` and `CrmOpportunities.tsx` will render this same modal component. The pipeline page will default the stage to the first pipeline stage; the opportunities page will default to whichever pipeline/stage is active.

### Step 8: Add inline stage edit (stretch goal)

**LOW severity** — feature request, no current CRUD for stages.

From the column header, add a small "edit" icon that opens an inline rename input. This requires a backend API for `PATCH /crm/pipelines/:id/stages/:stageId`.

Out of scope for this sprint — requires backend route + controller + permission check.

### Step 9: Add pipeline CRUD (stretch goal)

**LOW severity** — feature request.

`crmService.createPipeline()` and `crmService.updatePipeline()` already exist in the service. Need:
- UI to create a new pipeline (name, description, stages with names/colors/probabilities)
- UI to edit pipeline settings (rename, add/remove/reorder stages)
- UI to delete/deactivate a pipeline

Out of scope for this sprint — significant UX design needed (stage reorder drag, color picker, etc.).

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `frontend/pages/CrmPipeline.tsx` | Modify — remove inline helpers, replace StateBadge, wire mobile view, optimistic drag, tooltips, search/filter | HIGH |
| `frontend/src/components/crm/CrmMobilePipeline.tsx` | Rewrite — accept `CrmPipelineStage[]`, Tailwind + tokens, full card content, design token colors | HIGH |
| `frontend/src/components/crm/CreateOpportunityModal.tsx` | Create — unified create modal shared by Pipeline + Opportunities | MEDIUM |
| `frontend/pages/CrmOpportunities.tsx` | Modify — use shared `CreateOpportunityModal` instead of inline form | MEDIUM |
| `frontend/src/components/CollapsibleKanbanColumn.tsx` | Minor — use `stageBadgeColor()` instead of raw `stage.color` | LOW |
| `frontend/src/components/ui/StateBadge.tsx` | No change — keep for non-CRM usage; CRM pipeline no longer uses it | — |

## Decisions Required Before Coding

| # | Decision | Choice | Rationale |
|---|----------|-------|-----------|
| 1 | **Mobile view approach** | **A — Tabbed swipe** | Horizontal scroll of narrow columns is unreadable on mobile. Tabbed view gives each stage full width. Standard pattern (Trello, Jira mobile). Existing CrmMobilePipeline already has the skeleton. |
| 2 | **Search scope** | **A — Inline filter** | Cards dim/hide in-place on the board. Keeps context. No page navigation needed. |
| 3 | **Create modal unification** | **B — Later** | Leave separate forms for now. Unify in a future sprint to keep scope manageable. |

## Estimated Effort

| Priority | Steps | Effort |
|----------|-------|--------|
| HIGH (Steps 1–3) | Remove helpers, dynamic stage colors, wire mobile view | ~3–4 hours |
| MEDIUM (Steps 4–7) | Optimistic drag, tooltips, search/filter, unified create modal | ~4–5 hours |
| LOW (Steps 8–9) | Stage/pipeline CRUD | ~6–8 hours (requires backend) |

**Total for HIGH + MEDIUM: ~7–9 hours**

Most patterns reuse what we already built for Opportunities:
- `stageBadgeColor()` from `crmConstants.ts` — same function
- Optimistic revert — same pattern as `handleStageChange` on CrmOpportunities
- Tooltips — trivial `title` attribute additions
- `CrmMobilePipeline` rewrite follows same token/styling patterns as `MobileLeadRow` / mobile cards in `OpportunitiesTable`