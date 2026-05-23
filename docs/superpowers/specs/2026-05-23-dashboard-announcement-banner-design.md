# Dashboard Announcement Banner — Design Spec
**Date:** 2026-05-23
**Status:** Approved

## Overview

Move the announcement widget from the bottom of `Dashboard.tsx` to a prominent card-stack banner positioned **between the greeting and the stats strip**. Up to 3 cards are shown (pinned first, then latest by recency). The existing bottom widget is removed. No new API calls — the data already comes from `announcementService.getDashboard()` in the current `useEffect`.

## Placement

```
[Greeting]
[AnnouncementBanner]   ← new position
[Stats Strip]
[Service Desks]
[Recent Requests]
```

The banner only renders when `pinned.length > 0 || latestAnnouncements.length > 0`. When there are no announcements the layout collapses cleanly — greeting goes straight into stats, identical to today.

## Card Stack Rules

- Show at most **3 cards** total: `[...pinned, ...latestAnnouncements].slice(0, 3)`
- Pinned items always appear first (📌 icon)
- Each card is color-coded by priority:

| Priority | Background | Border | Text |
|---|---|---|---|
| CRITICAL | `#fef2f2` | `#fecaca` | `#991b1b` / badge `#dc2626` |
| HIGH | `#fffbeb` | `#fde68a` | `#92400e` / badge `#d97706` |
| MEDIUM | `#eff6ff` | `#bfdbfe` | `#1e3a8a` / badge `#2563eb` |
| LOW | `#f0fdf4` | `#bbf7d0` | `#166534` / badge `#16a34a` |
| (none/fallback) | `var(--color-surface-subtle)` | `var(--color-border)` | `var(--color-text-primary)` |

## Card Anatomy

Each card is a `<Link to={/announcements?open=${a.id}}>` wrapping:

```
[📌 pin icon — if pinned]  [title (bold, truncated)]  [excerpt (muted, truncated)]  [Priority badge]  [relative time]
```

- Title: `font-weight: 700`, one line, `text-overflow: ellipsis`
- Excerpt: `font-size: var(--text-xs)`, one line, `text-overflow: ellipsis`, shown only if `a.excerpt` exists
- Unread indicator: `3px solid` left border in the priority color (same as existing bottom widget)
- Pinned badge: `📌` emoji at the far left, only when `pinned.includes(a)`

## "View all" Footer

Below the card stack, a single right-aligned link:

```
View all announcements →
```

Links to `/announcements`. Styled: `font-size: var(--text-sm)`, `font-weight: 700`, `color: var(--color-brand-700)`.

Separated from the card stack by a `1px solid var(--color-border-subtle)` divider above it.

## Loading State

During `loading === true`, render a skeleton version of the banner:
- 2 placeholder cards, each `height: 52px`, `background: var(--color-border)`, `border-radius: var(--radius-md)`, pulse animation (same `SkeletonBox` pattern already used in the dashboard)

## Bottom Widget Removal

Delete the entire `{/* ── ANNOUNCEMENTS WIDGET ── */}` block (lines 346–421 in current `Dashboard.tsx`). The banner above replaces it entirely.

## Component Structure

All changes stay in `frontend/pages/Dashboard.tsx`. No new files.

Extract a small `AnnouncementBanner` sub-component inside the file (above `Dashboard`) that accepts:
```tsx
interface AnnouncementBannerProps {
  pinned: DashboardAnnouncement[];
  latest: DashboardAnnouncement[];
  loading: boolean;
}
```

This keeps `Dashboard`'s JSX readable and the banner logic self-contained.

## What Does NOT Change

- `announcementService.getDashboard()` call and state variables (`pinned`, `latestAnnouncements`)
- `PRIORITY_BADGE` and `CATEGORY_COLOR` constants (already defined, reused)
- `formatRelativeTime` utility
- Stats strip, service desks section, recent requests table
- All auth, navigation, and data-fetching logic
