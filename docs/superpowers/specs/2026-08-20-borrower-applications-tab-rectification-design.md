# Borrower Applications Tab Rectification

## Context

The borrower detail page loads applications once using the borrower profile ID. The Overview tab renders a workspace-style Applications card, while the Applications tab renders a separate minimal list and a plain paragraph when empty. This creates inconsistent UX and makes a legitimate empty result look unfinished. The page also requests `updatedAt` sorting even though the backend list service only supports `amount`, `createdAt`, and `state`.

## Goals

- Keep borrower filtering and RM row-level access unchanged.
- Make the Applications tab visually and behaviorally consistent with the Overview application presentation.
- Show a clear, useful empty state, including a create/start-application action when permitted.
- Request a backend-supported sort field.
- Add regression coverage for the shared presentation and query contract.

## Design

The existing borrower application summary component becomes the single compact-list presentation for both locations. It will support the existing application rows and an optional empty-state action. The Overview continues to show the summary card; the Applications tab wraps the same component in its tab panel and may use a wider layout, without introducing a second table pattern.

The borrower detail fetch will request `sortBy: 'createdAt'` and `sortDir: 'desc'`, preserving the intended newest-first behavior using a supported backend field. No backend authorization or filtering changes are required.

Application loading errors remain distinct from a valid empty result. Empty results show that no applications are currently associated or visible to the borrower workspace and provide a direct start-application action when the current user can create applications.

## Testing

- Component tests verify the empty state, create action, and application row details/links.
- Borrower workspace tests verify the Applications tab remains available and its content is rendered through the shared presentation.
- Existing backend list-service tests continue to verify borrower filtering and supported sorting.

## Non-goals

- Changing RM scope or application visibility rules.
- Adding application creation records to the database or changing seed ownership.
- Replacing the compact list with a full data table.
