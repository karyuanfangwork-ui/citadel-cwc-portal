# Credit Assessment Borrower List UI Design

**Date:** 2026-08-11

**Viewport:** Desktop web, 1440px primary width

**Primary user:** Credit Officer

**Approved direction:** Operational ledger within the shared CWC application shell

## 1. Purpose and scope

This first Credit Assessment screen establishes the reusable enterprise UI shell and the Borrower List experience. It helps a credit officer find and verify an existing individual, SME, or corporate borrower before creating a new borrower. It does not redesign Borrower 360, application creation, or the wider credit journey.

Success means a user can identify the page, search for a borrower, recognize borrower type and relationship status, see active applications and total exposure, open Borrower 360, and begin controlled borrower creation within approximately five seconds.

## 2. Visual direction

The screen uses a dense, trustworthy financial-operations style rather than consumer-banking aesthetics:

- Existing CWC shared white left rail, using the portal's brand tokens, icons, grouping, and collapse/pin behavior.
- White application header and content panels on a pale neutral workspace.
- A horizontal Credit module navigation track below the shared top header, consistent with the existing CRM and Credit layouts.
- Existing credit-module typography direction: Geist for display labels and Inter for operational content.
- Existing credit-module action blue `#0051D5`, dark ink, neutral borders, and compact 4–8px radii.
- No gradients, decorative graphics, oversized typography, or visually dominant KPI cards.
- An 8px spacing base with 24–32px workspace gutters and a 12-column content grid.

## 3. Global application shell

### Shared left rail

The screen inherits the existing CWC left rail used by ESM, CRM, Credit, and the rest of the portal. It is 64px when collapsed and 240px when pinned or expanded. It contains global destinations rather than Credit page-level navigation:

- Main: Dashboard, My Requests, Announcements, Approvals, Notifications, and permission-aware Support Queue
- Service Desks: IT Support, Group HR, Group Finance, and Executive Services/ESM when enabled in shared navigation
- Modules/Tools: IT Assets, CRM, Credit, and Knowledge Base, subject to permissions and feature flags
- Admin: Reports, Insights, Admin Settings, Workflow Designer, Audit Trail, and Manage Announcements, subject to permissions

`Credit` is the active global destination. CRM and ESM remain visible when the user can access them. The global rail does not contain Borrower List, Create Borrower, Application List, or other Credit-internal routes.

### Shared top header

The existing shared 56px top header contains the portal search, notification control, help affordance, and user profile menu. It remains visually secondary to page-level borrower search.

### Credit module navigation

A sticky 48px horizontal navigation track sits between the shared top header and the Credit workspace. It uses the existing Credit action blue and contains permission-aware module destinations:

- Dashboard
- Borrowers
- Applications
- Group Exposure
- My Approvals when the user has `credit:approve`
- Analysis
- Spreading
- Collateral
- Reports
- More for lower-frequency or administrative destinations such as Scorecards and Risk Rating Configuration

`Borrowers` is the active module item. `Create Borrower` and `New Application` remain contextual page actions rather than persistent global destinations. Administrative destinations are absent for a normal Credit Officer.

### Main workspace

The workspace uses a pale neutral background, a maximum readable content width that fills the available shell, and 24px vertical rhythm. Breadcrumb, page title, subtitle, and contextual action form a single coherent page header.

The corrected reference mockup shows the shared rail pinned at 240px so the cross-module hierarchy—especially ESM, CRM, and Credit—is explicit. In production, the user can collapse it to 64px when maximum table width is more valuable; this does not change the information architecture.

## 4. Borrower List composition

### Page header

- Breadcrumb: `Credit Assessment / Borrowers`
- Title: `Borrowers`
- Subtitle: `Search and manage individuals, SMEs and corporate borrowers.`
- Primary CTA: `Create Borrower`
- Supporting cue: a small shield/search icon and `Search first to prevent duplicates` near the CTA.

The CTA is visible to Credit Officers with create permission and hidden for reviewer- and manager-only roles.

### Summary strip

A single compact horizontal panel shows:

- Total Borrowers: 1,248
- Active Borrowers: 1,106
- Individual: 782
- SME: 351
- Corporate: 115

The strip uses subtle dividers and small labels instead of five dominant cards.

### Search and filters

The prominent search field spans most of the available row and uses the placeholder `Search borrower name, NRIC or registration no.` A small supporting line identifies mobile number and Borrower ID as additional accepted identifiers.

Filters include Borrower Type, Status, Relationship Owner, and Has Active Application. Borrower Type and Status are compact selects; owner supports searchable selection; active application is a Yes/No select. `Clear filters` appears only when filtering is active. Search and filter state is reflected in the URL so the view survives navigation and can be shared.

### Borrower table

The table is the primary content surface. It uses a sticky neutral header, 52–56px body rows, restrained zebra treatment, row hover, and right alignment for numeric financial values.

Columns:

1. Borrower ID
2. Borrower
3. Type
4. NRIC / Registration No.
5. Contact
6. Relationship Owner
7. Active Applications
8. Total Exposure
9. Status
10. Last Updated
11. Action

Borrower names are blue text links to Borrower 360. Borrower ID is stable and visually scannable. Type uses a neutral icon-plus-text badge. Active application counts are links when greater than zero. Total Exposure uses Malaysian Ringgit formatting and tabular numerals. Status uses icon, label, shape, and color so meaning does not depend on color alone. The Action column contains one overflow menu rather than multiple buttons.

The mockup uses realistic masked Malaysian data, including:

- BRW-000182 — Ahmad bin Rahman — Individual — 850412-10-XXXX — 2 active applications — RM 45,000
- BRW-000183 — Alpha Trading Sdn Bhd — SME — 202201012345 — 1 active application — RM 250,000
- BRW-000184 — Meridian Manufacturing Berhad — Corporate — 199801012345 — 3 active applications — RM 1,850,000

Additional rows cover inactive status, zero active applications, multiple owners, and varied exposure values to demonstrate the system rather than an idealized dataset.

### Pagination

The footer shows the displayed range and total, a 20/50/100 rows-per-page selector, and compact previous/page/next controls. Sorting is available on Borrower, Type, Active Applications, Total Exposure, Status, and Last Updated.

## 5. Interaction behavior

- **Global search:** searches across the wider portal and does not replace borrower search.
- **Borrower search:** debounces text input, searches supported identity and contact fields, and preserves the query in the URL.
- **Create Borrower:** opens `Create Borrower / Borrower Identity Check` before any creation form.
- **Borrower name:** opens Borrower 360 for that borrower.
- **Borrower row:** selects the row and reveals a lightweight preview affordance; it does not navigate unexpectedly.
- **Active application count:** opens the Application List filtered to the borrower and active statuses.
- **Overflow menu:** contains `View Borrower`, `Create Application`, and `Edit Borrower`. Create and Edit entries are permission-aware.
- **Filters:** apply without a full-page reload and update the result count.
- **Clear filters:** resets filters but preserves the current borrower search text unless the user explicitly clears search.
- **Pagination:** retains search, filters, and sort state.

## 6. Duplicate prevention

Borrower creation always starts with an identity search. The next screen asks for borrower type and NRIC or company registration number. If an existing match is found, it shows the borrower identity, Borrower ID, match strength, current status, and actions to view the existing record or continue.

An exact identifier match makes `View Existing Borrower` the primary action. Continuing requires a reason, records an audit event, and is permission-controlled. A possible non-exact match can be overridden with a lighter warning while still recording the decision.

## 7. System states

- **Loading:** retain the table structure with aligned skeleton rows and disable pagination; do not replace the entire page with a spinner.
- **No search results:** show `No borrowers found.` and `Try another name, NRIC or company registration number.` with `Create New Borrower` as a secondary action when permitted.
- **No borrowers exist:** use an onboarding empty state with search guidance and create permission awareness.
- **Error:** show an inline alert above the results with retry; preserve entered search and filters.
- **Validation:** invalid NRIC or registration patterns are identified near the search or identity-check field with examples and do not clear user input.
- **Tooltips:** explain truncated owner names, masked identifiers, exposure definitions, and permission-restricted actions.

## 8. Status language

Application status badges across later screens use the same compact icon-plus-text construction:

- Draft — document icon, neutral grey
- Information Required — info icon, amber
- Ready for Assessment — check-circle icon, blue
- Under Assessment — progress icon, indigo
- Ready for Submission — send-ready icon, cyan/blue
- Submitted — send icon, blue
- Under Review — review icon, violet
- Returned for Revision — return arrow, amber
- Pending Approval — clock icon, orange
- Approved — check icon, green
- Declined — close icon, red
- Cancelled — ban icon, grey

Labels are never abbreviated in badges, and color is never the only cue.

## 9. Financial and field semantics

- Currency uses `RM 10,000`, `RM 250,000`, and `RM 1,250,000` formatting with no unnecessary decimal places.
- Percentages and ratios use explicit units, such as `DSR 42%`, `DSCR 1.58x`, and `Risk Score 78 / 100`.
- User inputs use white fields with visible borders.
- Calculated values use a tinted read-only surface, calculator icon, and `Calculated` label where context requires it.
- System-generated values use a small system/spark icon and `System generated` label.
- Read-only values use plain text or a subdued read-only field; they never resemble editable inputs.

## 10. Accessibility and operational quality

- Text and controls meet WCAG AA contrast.
- Interactive targets are at least 36px in dense table contexts and 40px elsewhere.
- Keyboard focus is visible; search, filters, table links, action menus, and pagination follow a logical tab order.
- Table headers expose sort state programmatically.
- Masked identifiers remain distinguishable to authorized users without exposing full personal data in a list view.
- The layout avoids horizontal scrolling at 1440px by carefully sizing identity and financial columns; narrower desktop widths may use controlled horizontal table scrolling with sticky Borrower and Action columns.

## 11. Key UX risks and mitigations

- **Too many columns:** keep contact to one primary value, truncate owners safely, and reserve detail for Borrower 360.
- **Global search confused with borrower search:** differentiate them by placement, width, label, and helper text.
- **Duplicate creation despite warning:** make identity check mandatory and require audited justification for an exact match.
- **SME model mismatch:** the UI presents SME as an operational borrower segment while backend mapping remains explicit and validated.
- **Exposure ambiguity:** provide a tooltip defining included facilities and the data timestamp.
- **Unauthorized data visibility:** list and detail results must apply borrower-level access rules, not only route-level navigation permissions.

## 12. Next screen

The next screen is **Create Borrower / Borrower Identity Check**. It reuses the approved shell and introduces borrower type selection, exact identifier validation, duplicate-match presentation, and audited override behavior before the creation form begins.
