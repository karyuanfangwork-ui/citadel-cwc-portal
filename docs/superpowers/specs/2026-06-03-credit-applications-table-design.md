# Credit Applications — Smart Table View

**Date:** 2026-06-03
**Status:** Approved
**Replaces:** Kanban board (`CreditApplicationList.tsx`)

---

## Problem

The current 6-column kanban requires horizontal scrolling, cannot sort by amount or SLA urgency, and mixes poorly with server-side pagination. Users cannot quickly identify which applications need attention.

---

## Solution

Replace the kanban with a **Smart Data Table** — a vertically-scrollable list that keeps workflow visibility through a Stage/Status column while enabling sort, filter, and SLA urgency scanning.

A **view toggle** (Table / Kanban) is preserved so power users can switch back.

---

## Layout

```
┌─ Page header ──────────────────────────────────────────────┐
│  Breadcrumb: Credit › Applications                         │
│  H1: "Credit Applications"  [2 pending]    [+ New App]     │
└────────────────────────────────────────────────────────────┘
┌─ Card ─────────────────────────────────────────────────────┐
│  Filter bar: [🔍 Search] [Stage▼] [Product▼] [RM▼]  [Table|Kanban] │
│  SLA urgency strip: ⚠ 2 Overdue  ⏱ 3 Due within 24h  ✓ 18 On track │
│  ─────────────────────────────────────────────────────────  │
│  Table:                                                     │
│    Borrower | Product | Amount ↕ | Stage/Status | SLA ↑ | RM | Created | › │
│    rows…                                                    │
│  ─────────────────────────────────────────────────────────  │
│  Pagination: 1–20 of 47  [← 1 2 3 →]  Per page: [20▼]     │
└────────────────────────────────────────────────────────────┘
```

---

## Columns

| Column | Notes |
|---|---|
| **Borrower** | Name (bold) + application ref (`#CA-YYYY-NNNN`) below |
| **Product** | Product type label |
| **Amount** | Amount figure (bold) + currency label below; sortable |
| **Stage / Status** | State badge using `STATE_COLORS` from `creditUtils.ts` + stage group label below (e.g. "KYC stage") |
| **SLA** | Default sort column (ascending = most urgent first). Overdue = red + warning icon; 1–2d = orange; healthy = green; Draft = `—` |
| **RM** | Navy pill with initial avatar + first name |
| **Created** | Human-relative date ("8d ago", "Today") |
| *(arrow)* | `chevron_right` icon; entire row is clickable |

---

## SLA Urgency Strip

A slim coloured band below the filter bar showing aggregate counts:
- **Overdue** — `--color-danger` on `#fef2f2` background
- **Due within 24h** — orange on `#fff7ed`
- **On track** — `--color-success` on `#f0fdf4`

Counts derived from existing `getSLAInfo()` logic applied across the loaded page.

---

## Sorting & Filtering

- **Default sort:** SLA ascending (overdue first)
- **Sortable columns:** Amount, SLA (toggle asc/desc on click; active column shows arrow icon in brand navy)
- **Filters:** Stage (maps to `KANBAN_COLUMNS` groups), Product type, RM — all existing API params, no new backend work
- **Search:** existing debounced search, unchanged

---

## Row States

- **Overdue rows** — `background: #fff8f8` (subtle red tint); hover = `#fde8e8`
- **Even rows** — `--color-surface-subtle` (zebra stripe, matches `.credit-table` pattern)
- **Draft rows** — 70% opacity
- **Hover** — `--color-brand-50` background, `chevron_right` turns navy

---

## Design Tokens Used

All values come from `frontend/src/styles/tokens.css`:

| Token | Usage |
|---|---|
| `--color-brand-700` | Primary button, active toggle, RM chip, sorted column icon |
| `--color-brand-50` | Row hover, RM chip background |
| `--color-text-primary/secondary/tertiary` | Typography hierarchy |
| `--color-surface / subtle / muted` | Row backgrounds, filter bar, pagination |
| `--color-border / border-subtle` | Table borders |
| `--color-danger / warning / success` | SLA colouring |
| `--radius-sm / md / lg` | Inputs, buttons, card shell |
| `--shadow-sm` | Card shell, primary button |
| `--font-sans` | All text (Plus Jakarta Sans) |

State badge colours from `STATE_COLORS` in `creditUtils.ts` (existing values, no change).

---

## View Toggle

A segmented control in the filter bar (Table / Kanban). Active state uses `--color-brand-700` fill. Persisted to `localStorage` under key `credit-applications-view` so preference survives navigation.

---

## Out of Scope

- Drag-and-drop (kanban only)
- Column customisation / show-hide
- Bulk actions
- Inline editing

---

## Files Affected

| File | Change |
|---|---|
| `frontend/pages/CreditApplicationList.tsx` | Replace kanban render with table; add view toggle |
| `frontend/src/styles/credit-tables.css` | Already has `.credit-table` sticky-header + zebra rules — reuse |
| No backend changes required | All filters already supported by `listApplications()` API |
