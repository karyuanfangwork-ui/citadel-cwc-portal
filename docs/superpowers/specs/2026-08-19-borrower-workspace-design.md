# Borrower Workspace for Relationship Managers — Design Specification

**Date:** 2026-08-19  
**Status:** Proposed design approved for specification review  
**Scope:** Credit borrower detail route at `/credit/borrowers/:id`

## Goal

Redesign the borrower detail page into an RM-focused Borrower Workspace that lets a relationship manager determine within five seconds whether a borrower is ready to progress, understand what is blocking progress, and take the next appropriate action.

## Context and current implementation

The current page is implemented by `frontend/pages/BorrowerProfileDetail.tsx`. It loads the borrower profile, Borrower 360 summary, and activity, then renders `Borrower360Header`, `BorrowerKpiBand`, and either `RetailOverview` or `CorporateOverview`. Detailed information is split across profile, financials, exposure, risk, bureau, and documents tabs.

The backend already supports the required borrower-level data through borrower profile, summary, activity, risk-score, income, bureau-report, KYC, documents, and application routes. The Prisma model also contains borrower relationships, applications, documents, income, bureau reports, activities, risk runs, relationship owner, segment, lifecycle status, and CRM links.

The redesign should therefore be primarily an information-architecture and frontend component change. A consolidated backend workspace endpoint is optional and should be introduced only if frontend readiness rules cannot remain consistent and testable with the existing contracts.

## Primary user and workflow

The primary user is a relationship manager who sources and brings in borrowers.

The page optimizes for these tasks:

1. Identify the borrower and relationship context.
2. See whether onboarding or application progression is blocked.
3. Complete missing borrower, KYC, income, bureau, and document information.
4. Start or continue an application.
5. Check existing applications and exposure before progressing the relationship.
6. Review recent RM-visible activity.

Deep underwriting analysis remains available in the existing detail tabs but is not the dominant first-view experience.

## Design principles

- Action-oriented: every blocker has a clear action or explanation.
- RM-first: relationship context and pipeline progression appear before deep risk detail.
- Progressive disclosure: detailed underwriting data stays available without competing with onboarding work.
- Reuse existing domain contracts and permissions before introducing new backend structures.
- Preserve borrower-type differences for individual, sole proprietor, joint, SME, and corporate borrowers.
- Never expose restricted PII or write actions beyond the existing permission model.
- Use the existing Financial Core tokens and credit component conventions.
- Make status understandable through text, labels, and icons, not color alone.

## Proposed information architecture

The first view becomes:

```text
Borrower identity and relationship context       Primary application action
Status badges and contact context

Readiness status and completion                    Outstanding count

Next actions                  Active applications
Relationship snapshot          Exposure snapshot
Recent activity

Tabs: Overview | Applications | Profile | Financials | Exposure |
      Risk & Compliance | Documents
```

### Borrower workspace header

The header must show:

- Borrower display name.
- Borrower number when available.
- Borrower type and segment.
- Registration number for business borrowers when available.
- KYC status.
- Risk status or risk-not-assessed status.
- Bureau freshness status.
- Relationship owner and relationship age when available.
- Useful contact context for the borrower type.

The primary action is stateful:

- `Start application` when there is no active or draft application.
- `Continue application` when a draft application exists.
- `View application` when an active application exists and is the most relevant next step.

Secondary actions are retained but moved into a secondary action group or menu:

- Edit borrower.
- Upload bureau report.
- Verify KYC.
- Recalculate risk.
- Link CRM record.

Write actions remain hidden or disabled according to existing `credit:write` and related permissions.

### Readiness strip

The readiness strip appears directly below the header and communicates:

- Overall status: `Ready`, `Ready with warnings`, `Not ready`, or `Blocked`.
- Completion percentage.
- Number of outstanding items.
- Short explanation of the most important blocker.

Readiness is a progression aid for the RM, not an approval decision. It must not imply credit approval or override application-level submission gates.

### Next actions

The overview presents a prioritized list of outstanding actions. Each action contains:

- Stable identifier.
- Severity: `BLOCKER`, `WARNING`, `INFO`, or `DONE`.
- Short title.
- Plain-language explanation.
- Action label.
- Target area or action handler.

Initial readiness checks are:

- Required identity fields are present.
- KYC is verified.
- Required borrower documents are complete.
- Income or financial information is present for the borrower type.
- Bureau report exists and is within the configured freshness window.
- Duplicate or identity-check state is not unresolved.
- Risk assessment has been calculated when required by the borrower workflow.

The exact required-field matrix must follow existing validators and application submission rules. The UI must not invent a more permissive definition of readiness than the backend.

### Summary cards

Replace the eight equal-weight KPI cards in the overview with focused summary cards:

- Borrower readiness.
- Exposure snapshot.
- Relationship/application activity.

Detailed credit score, DSR, facilities, document completion, and bureau age remain available in the relevant overview sections or tabs. Existing formatting helpers and `KpiCell` primitives may be reused inside those details.

### Active applications

Show the borrower’s current applications with:

- Application number.
- Product/facility type.
- Requested amount where available.
- Current state.
- Last updated timestamp.
- Link to existing `/credit/applications/:id` detail.

Draft applications expose `Continue`; active applications expose `View`. Application functionality is not duplicated in the borrower workspace.

### Relationship snapshot

Show RM-relevant context:

- Relationship owner.
- Borrower segment and type.
- Borrower since/created date.
- Industry or occupation.
- Preferred contact method.
- CRM account/contact link status.

### Recent activity

Use the existing borrower activity endpoint and present a readable timeline. The first release keeps the existing activity scope and limit; filtering and RM notes are future enhancements unless already available through existing contracts.

## Tabs

The recommended tabs are:

1. `Overview`
2. `Applications`
3. `Profile`
4. `Financials`
5. `Exposure`
6. `Risk & Compliance`
7. `Documents`

The bureau view becomes a subsection of `Risk & Compliance` or `Documents` for the RM-oriented navigation. Existing bureau upload functionality remains available from the header and next-action item.

The selected tab should be representable in the URL, for example `/credit/borrowers/:id?tab=documents`, while preserving a safe default for invalid or missing values.

## Component architecture

Refactor the page toward focused units:

- `frontend/pages/BorrowerProfileDetail.tsx`: route-level orchestration, loading/error state, tab state, permissions, and modal coordination.
- `frontend/src/components/credit/borrower360/BorrowerWorkspaceHeader.tsx`: identity, relationship context, status badges, and primary/secondary actions.
- `frontend/src/components/credit/borrower360/BorrowerReadinessStrip.tsx`: overall readiness state and progress presentation.
- `frontend/src/components/credit/borrower360/BorrowerNextActions.tsx`: prioritized action list.
- `frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx`: application cards and navigation.
- `frontend/src/components/credit/borrower360/BorrowerRelationshipSnapshot.tsx`: relationship context.
- `frontend/src/components/credit/borrower360/BorrowerExposureSnapshot.tsx`: compact exposure summary.
- `frontend/src/components/credit/borrower360/BorrowerActivityTimeline.tsx`: activity presentation.
- `frontend/src/components/credit/borrower360/BorrowerOverview.tsx`: overview composition and borrower-type branching.
- `frontend/src/components/credit/borrower360/borrowerReadiness.ts`: pure readiness calculation and typed action definitions.
- `frontend/src/components/credit/borrower360/borrowerPresentation.ts`: shared labels, status tones, and formatting rules where current page-local helpers should be consolidated.

Existing `Borrower360Header`, `BorrowerKpiBand`, `RetailOverview`, and `CorporateOverview` should be adapted or decomposed rather than duplicated. No unrelated global refactor is in scope.

## Data flow

Initial implementation may continue using the existing requests:

- `getBorrowerProfile(id)`.
- `getBorrower360Summary(id)`.
- `getBorrower360Activity(id, limit)`.
- Existing borrower application query or application list contract.
- Existing exposure query when the Exposure tab is active.

The page should avoid fetching tab-only data before it is needed, except for data required to calculate the first-view readiness state.

If the current API contracts cannot provide applications or required document readiness without excessive client-side requests, add a typed workspace endpoint:

```ts
GET /api/v1/credit/borrowers/:id/workspace

interface BorrowerWorkspaceResponse {
  borrower: BorrowerProfile;
  summary: Borrower360Summary;
  readiness: BorrowerReadiness;
  applications: BorrowerApplicationSummary[];
  relationship: BorrowerRelationshipSummary;
  activity: Borrower360Activity[];
}
```

This endpoint must reuse existing permission, branch-scope, PII-decryption, and audit behavior. It must not expose new restricted fields merely because the page is consolidated.

## Error and empty states

- Loading state: skeletons preserve header, readiness, and card geometry.
- Not found: show an explicit borrower-not-found state with a link back to Borrowers.
- Transient load error: show a recoverable error state with retry; do not silently redirect for every error.
- Missing summary: show the borrower identity and an explanation that summary data is unavailable, while retaining available actions.
- No applications: explain that no application exists and provide `Start application` when permitted.
- No activity: show a neutral empty timeline with a clear explanation.
- Missing bureau/income/documents: show action-oriented empty states, not generic blank panels.

## Permissions and safety

- `credit:read` is required to view the workspace.
- `credit:write` controls editing, KYC verification, bureau upload, income updates, and risk recalculation as already enforced by backend routes.
- `credit:create` controls creating a new application where applicable.
- Approval controls remain application-level and are not added to the borrower workspace.
- PII reveal remains explicit, permission-gated, and PII-logged.
- Read-only users can see readiness and blockers but cannot see write controls.

## Accessibility and responsive behavior

- Use semantic headings and named buttons.
- Preserve visible keyboard focus states.
- Status must include text, not only color.
- Tabs must be keyboard navigable and expose the selected state.
- Modal actions retain focus behavior already established by existing components.
- Desktop uses a two-column summary layout.
- Tablet collapses cards to one column while retaining priority order.
- Mobile uses a compact/sticky identity and action treatment without forcing horizontal page scrolling.

## Testing strategy

Unit tests:

- Readiness calculation for each blocker and completed state.
- Action severity ordering.
- Primary application action state.
- Header status presentation.
- Individual versus corporate readiness requirements.
- Empty and partial-data rendering.

Component tests:

- Readiness strip renders status and completion.
- Next actions expose direct action buttons.
- Applications navigate to the existing detail route.
- Read-only users do not receive write controls.
- Relationship snapshot handles missing CRM links.
- Activity timeline handles empty and populated states.

End-to-end tests:

- Existing borrower detail render smoke remains green.
- A borrower with blockers displays the next-action workflow.
- A borrower with a draft application displays `Continue application`.
- A borrower with an active application displays `View application`.
- Read-only user cannot edit, verify KYC, upload bureau, or create an application.
- Tab state is preserved in the URL.
- Desktop and mobile borrower detail routes render without uncaught errors.

Backend tests, if a workspace endpoint is introduced:

- Response contract and readiness consistency.
- Permission enforcement.
- Branch and relationship scope behavior.
- Restricted PII handling.
- No regression to existing borrower summary, activity, KYC, bureau, or risk routes.

## Explicit non-goals

- Redesigning Credit Application Detail.
- Changing credit approval authority or submission gates.
- Replacing the existing credit navigation.
- Introducing a new borrower database model.
- Building RM notes, messaging, or CRM synchronization unless already supported by existing contracts.
- Reworking analyst-only scoring, committee, or approval experiences.

## Success criteria

The redesign is successful when an RM can open a borrower and, within five seconds:

1. Identify the borrower and relationship context.
2. See whether progress is ready, warned, or blocked.
3. See the highest-priority missing items.
4. Start or continue the relevant application.
5. Navigate to detailed borrower, application, exposure, risk, and document information without losing context.

