# Workflow List — Request Type Visibility

Date: 2026-08-05
Status: Approved

## Problem

On `/admin/workflows`, each workflow card reports only a count of the request
types it governs:

> Bound request types: **1** · affects 1 request type

An admin looking for the workflow that drives Purchase Requisition cannot tell
which card to open. Two candidate cards — `IT_PROCUREMENT` and
`IT_HARDWARE_PROCUREMENT` — both read "affects 1 request type", so the admin
must open each version in the designer to find out. The count also restates
itself, spending a whole line to say the same number twice.

The data needed to resolve this is already on the client:
`WorkflowSummary.requestTypes` is `{ id, name }[]`
(`frontend/src/services/workflow-version.service.ts`). Only the count is
rendered. This is a presentation gap, not a data gap.

## Goals

1. An admin scanning the grid can see which request types each workflow covers.
2. An admin who knows a request type name can find its workflow without opening
   any card.
3. Workflows bound to nothing are visibly flagged as a configuration problem.

## Non-goals

- A separate "by request type" table view. Considered and deferred; the grid
  must be readable regardless, and search over it covers the reverse lookup.
- Grouping cards by service desk.
- Any backend, API, service, or type change.

## Design

### 1. Request type chips — `frontend/src/components/workflow/WorkflowListCard.tsx`

Replace the count paragraph (currently lines 23–26) with a chip list rendered
from `workflow.requestTypes`.

- Render the first three names as neutral pills, styled to match the existing
  `Draft v{n}` badge geometry but in a neutral tone (`bg-[#f1f4f9]`,
  `text-[#44546f]`).
- If `requestTypes.length > 3`, append a `+{length - 3} more` pill whose `title`
  attribute lists the remaining names, so hovering reveals them without a modal.
- If `requestTypes.length === 0`, render a single dashed-border pill reading
  `Not bound to any request type` in the warning tone (`text-[#8a5a00]`).

Capping at three keeps card height bounded so the `lg:grid-cols-2` grid stays
visually even.

### 2. Search — `frontend/pages/WorkflowList.tsx`

Add a search input to the header row, backed by `useState`, and derive the
rendered list:

```ts
const q = query.trim().toLowerCase();
const match = (value: string) => value.toLowerCase().includes(q);
const visible = q
  ? workflows.filter(
      (w) => match(w.code) || match(w.name) || w.requestTypes.some((rt) => match(rt.name)),
    )
  : workflows;
```

Matching request-type names is what makes the reverse lookup work: typing
`purchase` narrows the grid to the one workflow that governs Purchase
Requisition.

No debouncing — the list is client-side and small.

The input is labelled for screen readers and placeholdered
`Search workflows or request types`.

### 3. Empty states

Three distinct states, in this precedence:

| Condition | Rendering |
| --- | --- |
| `workflows.length === 0` | Existing "No active workflows" panel, unchanged. |
| `workflows.length > 0` and `visible.length === 0` | `No workflows match "<query>"` panel with a **Clear** button that resets the query. |
| otherwise | The card grid over `visible`. |

The search input stays visible in the no-match state so the query can be edited
in place.

## Testing

Vitest + React Testing Library, following the existing pattern in
`frontend/src/components/workflow/__tests__/` (`PublishDialog.test.tsx`,
`StatusNode.test.tsx`).

`WorkflowListCard.test.tsx`:
- renders each bound request type name
- renders `+N more` with the overflow names in its `title` when more than three
- renders the unbound warning when `requestTypes` is empty

`WorkflowList.test.tsx` (mocking `useWorkflowVersions`):
- typing a request type name filters the grid to the matching workflow
- typing a workflow code filters to that workflow
- a non-matching query shows the no-match panel, and **Clear** restores the grid

## Risks

Low. The change is confined to two presentational files with no shared
consumers; the underlying payload is unchanged, so a regression can only affect
this page.
