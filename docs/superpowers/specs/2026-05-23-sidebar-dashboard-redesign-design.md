# Sidebar & Dashboard Redesign — Design Spec
**Date:** 2026-05-23
**Status:** Approved

## Problem Statement

Company staff logging into the CWC system cannot easily access the core ITSM services (IT Support, HR Services, Group Finance). The sidebar navigation creates confusion across all roles due to duplicate labels, poor grouping, and missing critical links. The dashboard search is duplicated and service desk cards are buried below the fold.

## Scope

- `frontend/src/components/layout/navConfig.ts` — restructure nav groups and add new items
- `frontend/src/components/layout/LeftRail.tsx` — add "New Request" CTA button
- `frontend/pages/Dashboard.tsx` — remove hero search bar, elevate service desk cards above the fold

## Design

### 1. Sidebar Nav Groups (navConfig.ts)

Replace the current 3-group structure (primary / secondary / admin) with 4 groups:

| Group | Label | Items | Visibility |
|-------|-------|-------|------------|
| `primary` | Main | Dashboard, My Requests, Inbox, Announcements, Approvals, Support Queue | All users; Support Queue gated to ADMIN/AGENT |
| `service-desks` | Service Desks | IT Support, HR Services, Group Finance | All users |
| `tools` | Tools | IT Assets, CRM, Credit, Knowledge Base | Permission-gated per item (unchanged) |
| `admin` | Admin | Reports, Insights, Admin Settings, Audit Trail, Manage Announcements | Admin-only |

**Changes from current state:**
- "Agent" renamed → "Support Queue"
- `Announcements` in `primary` stays (route: `/announcements`, view-only)
- `Announcements` in `admin` renamed → "Manage Announcements" (route: `/admin/announcements`, write)
- `Reports` and `Insights` moved from `secondary` (Tools) → `admin` group
- New `service-desks` group added with 3 direct links: `/service-desks/it`, `/service-desks/hr`, `/service-desks/finance`
- Group label `secondary` renamed → `tools` in code; display label `Modules` → `Tools`

### 2. "New Request" CTA (LeftRail.tsx)

Add a prominent "New Request" button at the top of the sidebar nav area, above the group labels. Renders as a filled button (brand color) in expanded state, icon-only in collapsed state.

- Route: `/new-request` (existing request creation flow, or navigates to service desk picker)
- Visible to all roles
- Positioned between the brand header and the first nav group

### 3. Dashboard Hero Cleanup (Dashboard.tsx)

- **Remove** the large hero search banner (the dark blue card with "How can we help you today?" + search input + quick chips)
- **Keep** a single-line compact greeting row: date + "Good [time], [Name]." — plain text, no card
- **Move** the stats row (Open Requests, Action Required, Resolved) directly under the greeting
- **Elevate** Service Desks cards to appear immediately after the stats — above the fold without scrolling
- The TopBar search bar remains as the sole search entry point

### 4. LeftRail Group Labels

Update `groupLabels` map in `LeftRail.tsx`:

```ts
const groupLabels: Record<string, string> = {
  primary: 'Main',
  'service-desks': 'Service Desks',
  tools: 'Tools',
  admin: 'Admin',
};
```

Update `groups` array to iterate the 4 new group keys in order.

## Routes for New Service Desk Links

Routes confirmed in `frontend/App.tsx`:
- IT Support → `/it`
- HR Services → `/hr`
- Group Finance → `/finance`

## Out of Scope

- Mobile/responsive nav (no changes to mobile drawer)
- Announcement content or notification logic
- Any backend changes
- CRM, Credit, or IT Assets module internals

## Success Criteria

1. A regular staff member (END_USER role) can reach IT Support, HR Services, or Group Finance in one click from anywhere in the shell
2. Admin sidebar shows no duplicate "Announcements" entries
3. Service desk cards are visible on the Dashboard without scrolling on a 1080p screen
4. "New Request" button is reachable from the sidebar at all times
5. TypeScript compilation passes with zero errors after changes
