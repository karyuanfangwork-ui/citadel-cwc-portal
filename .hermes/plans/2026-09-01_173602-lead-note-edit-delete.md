# Lead Note Edit/Delete Implementation Plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Allow the author of a CRM lead note to edit or delete it from the lead detail page, while preserving the backend ownership and permission rules.

**Architecture:** Keep the existing CRM notes API and Prisma model unchanged. Add the missing lead-page state, handlers, controls, edit modal, and delete confirmation by following the already-working account detail implementation. The UI should only expose mutation controls when the signed-in user has `crm:write` and is the note author; the backend remains the authoritative authorization boundary.

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Axios CRM service, Express/Zod/Prisma backend.

---

## Current Context

- Lead notes are loaded through `lead.notes` in `frontend/pages/CrmLeadDetail.tsx`.
- Creating a note is implemented by `handleAddNote` at approximately lines 236-247.
- The notes render block at approximately lines 1139-1151 displays content, author, date, and pinned state, but no mutation controls.
- `frontend/src/services/crm.service.ts` already exposes `updateNote(id, data)` and `deleteNote(id)`.
- Backend routes already expose:
  - `PATCH /api/v1/crm/notes/:id`
  - `DELETE /api/v1/crm/notes/:id`
- `backend/src/controllers/crm.controller.ts` restricts both operations to the existing note author and scopes the note to visible CRM ownership.
- `CrmAccountDetail.tsx` contains a working reference implementation for edit, delete, and pin interactions.
- The existing frontend test is `frontend/src/__tests__/CrmLeadDetail.test.tsx` and uses Vitest mocks.

## Product Rules

1. A user with `crm:write` can see Edit/Delete controls only for notes where `note.authorId === user.id`.
2. A user without `crm:write` sees no note mutation controls and cannot create a new lead note.
3. Editing requires non-whitespace content and sends only `{ content }` to the existing service method.
4. Deleting requires an explicit confirmation and refreshes the lead after success.
5. Failed mutations must leave the note visible and close neither the edit modal nor delete confirmation unless the operation succeeds.
6. No schema, migration, route, validator, or service-contract change is needed.
7. Pin/unpin is optional for this fix and should not be added unless explicitly included in the acceptance decision; the reported gap is edit/delete.

---

## Implementation Tasks

### Task 1: Extend lead-page note state and mutation handlers

**Objective:** Add the state and handlers required to edit and delete an authored lead note.

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx` near the existing note state and `handleAddNote` implementation.

**Steps:**
1. Add state for the currently edited note, edit content, note pending deletion, and delete-dialog visibility.
2. Add `handleEditNote` that:
   - prevents default form submission;
   - returns for a missing note or blank trimmed content;
   - sets the existing `saving` state;
   - calls `crmService.updateNote(editingNote.id, { content: editNoteContent })`;
   - clears edit state and reloads the lead only after success;
   - logs errors consistently with the existing lead-page handlers;
   - always clears `saving` in `finally`.
3. Add `handleDeleteNote` that:
   - returns if no note is selected;
   - calls `crmService.deleteNote(deletingNote.id)`;
   - closes and clears the confirmation state and reloads the lead only after success;
   - always clears `saving` in `finally`.
4. Preserve the existing create-note flow and do not alter API payload shapes.

**Verification:** TypeScript should identify no unused state or handler symbols after the render changes in the next task.

### Task 2: Add permission- and author-aware note controls

**Objective:** Make the lead notes list expose only actions allowed by the backend contract.

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx` notes render block near lines 1139-1151.

**Steps:**
1. Change each note card to include a top-level flex layout matching the account detail pattern.
2. Keep the current pinned indicator, note content, author, and date rendering unchanged.
3. Add an action area only when both conditions are true:
   - `hasPermission(user, 'crm:write')`
   - `n.authorId === user?.id`
4. Add accessible buttons with stable user-facing names/titles:
   - `Edit note`
   - `Delete note`
5. Wire Edit to populate `editingNote` and `editNoteContent` and open the edit modal state.
6. Wire Delete to populate `deletingNote` and open the confirmation state.
7. Do not show the controls for another author, even if the current user has `crm:write`, because the backend returns 403 for those mutations.
8. Gate the lead-page `Add Note` action and any other note-creation entry point with `hasPermission(user, 'crm:write')`, matching the account detail permission pattern. This prevents a read-only user from opening a form that the API will reject.

### Task 3: Add the edit modal and delete confirmation

**Objective:** Provide complete, accessible UI flows for editing and deleting a lead note.

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx` near the existing Add Note modal and existing `ConfirmDialog` usages.

**Steps:**
1. Add an Edit Note modal using the existing page modal styling and form conventions.
2. Prepopulate the textarea from the selected note.
3. Provide Cancel and Save/Update actions.
4. Disable the submit action while `saving` and require non-empty content.
5. On successful update, close the modal, clear temporary edit state, reload the lead, and leave the refreshed note visible.
6. On cancel or backdrop close, clear temporary edit state without calling the API.
7. Add a `ConfirmDialog` for deletion using the existing imported component and the page's current confirmation-dialog conventions.
8. Use destructive wording that clearly names the result, such as `Delete note`, and explain that the action cannot be undone.
9. Disable the destructive action while `saving`.
10. On successful deletion, close the dialog, clear selection, reload the lead, and show the existing empty state when the deleted note was the last note.

### Task 4: Add frontend regression coverage before final implementation

**Objective:** Prevent the lead UI from regressing to create-only notes.

**Files:**
- Modify: `frontend/src/__tests__/CrmLeadDetail.test.tsx`.

**Test setup changes:**
1. Add `mockUpdateNote` and `mockDeleteNote` mocks to the CRM service mock.
2. Add `updateNote` and `deleteNote` to the mocked service object.
3. Extend the fixture note with a valid `id`, `authorId`, `content`, `createdAt`, `updatedAt`, `isPinned`, and author object as required by the rendered page.
4. Keep the existing authenticated fixture user as the note author for authorized tests.

**Tests to add:**
1. Authorized author sees Edit note and Delete note controls in the Notes & Documents tab.
2. Clicking Edit note opens the edit form with the existing content; submitting calls `updateNote` with the note ID and changed content; the lead is reloaded after success.
3. Clicking Delete note opens confirmation; confirming calls `deleteNote` with the note ID; the lead is reloaded after success.
4. A user with `crm:write` who is not the note author does not see either control.
5. A user without `crm:write` does not see note mutation controls and does not see the Add Note action.
6. Cancelling edit and cancelling delete do not call the mutation service methods.

**TDD sequence:**
1. Add each focused test against the current implementation and run it to confirm the expected failure.
2. Implement the smallest corresponding UI/handler change.
3. Re-run the focused test until it passes.
4. Keep the tests behavior-focused; do not assert CSS classes or implementation-only state names.

### Task 5: Verify the complete contract and build

**Objective:** Confirm the UI, service calls, permission behavior, and existing application remain healthy.

**Files:**
- No additional files expected.

**Commands:**

From `frontend/`:

```bash
npx vitest run src/__tests__/CrmLeadDetail.test.tsx
npx tsc --noEmit
npm run build
```

From the repository root:

```bash
git diff --check
git status --short
```

**Acceptance checks:**

- The lead notes tab displays Edit/Delete only for an authored note and a user with `crm:write`.
- Edit persists through `PATCH /crm/notes/:id` and the refreshed lead shows the new content.
- Delete persists through `DELETE /crm/notes/:id` and the refreshed lead no longer shows the note.
- Another user's note remains read-only in the UI and remains protected by the backend ownership check.
- Read-only users do not receive misleading note mutation/create affordances.
- Existing account note behavior is unchanged.
- No Prisma migration or API contract change is introduced.
- Focused tests, TypeScript, production build, and whitespace checks pass.

## Risks and Tradeoffs

- The lead detail component is large; keep changes localized and avoid whole-file formatting.
- The page currently logs errors to the console rather than showing a toast. Preserve that convention unless a broader notification pattern is intentionally chosen.
- The backend uses author ownership rather than an admin override. The frontend must mirror that rule instead of assuming `crm:admin` can edit any note.
- The existing `saving` state is shared across lead actions. Avoid changing its architecture in this focused fix; ensure every new mutation uses `finally`.
- The current lead note display uses plain text while some sibling CRM pages use Markdown. Preserve the lead display format in this fix.

## Out of Scope

- Changing note ownership rules or granting admins cross-author edit/delete access.
- Adding soft-delete, version history, or note audit-model changes.
- Adding pin/unpin controls to leads unless separately requested.
- Refactoring shared note components across lead, account, contact, and opportunity pages.
- Changing backend routes, Zod validators, Prisma schema, or migrations.
- Adding browser E2E coverage requiring authenticated runtime data; this can be a follow-up if the project’s local browser test harness is available.
