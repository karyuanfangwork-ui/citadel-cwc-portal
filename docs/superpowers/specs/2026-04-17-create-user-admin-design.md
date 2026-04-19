# Create User — Admin Console Design

**Date:** 2026-04-17
**Status:** Approved

## Overview

Add "Create User" capability to Admin Console → User Accounts tab. Admin fills a modal form (firstName, lastName, email, department), system creates the account with USER role and temp password `abc@123`, then displays the temp password once for the admin to hand off.

## Backend

### New endpoint
`POST /api/v1/users` — admin-only (existing `authorize('ADMIN')` middleware)

**Request body:**
```json
{ "firstName": "string", "lastName": "string", "email": "string", "department": "string?" }
```

**Logic:**
1. Validate all required fields present
2. Check email uniqueness → 409 if duplicate
3. Hash `abc@123` with bcrypt
4. `prisma.user.create(...)` with `isActive: true`
5. Assign USER role via `prisma.userRole.create(...)`
6. Return `{ id, firstName, lastName, email, tempPassword: 'abc@123' }`

**Files changed:**
- `backend/src/controllers/user.controller.ts` — add `createUser` handler
- `backend/src/routes/user.routes.ts` — add `router.post('/', authorize('ADMIN'), userController.createUser)`

## Frontend

### New component
`frontend/src/components/admin/CreateUserModal.tsx`

**Two-phase modal:**
- **Phase 1 — Form:** firstName, lastName, email, department (optional text). Submit button calls `adminService.createUser()`. Inline error on failure (e.g. "Email already in use").
- **Phase 2 — Success:** Shows temp password `abc@123` in highlighted monospace box with copy-to-clipboard button. "Done" button closes modal and refreshes user list.

### Button placement
"+ Create User" button — top-right of User Accounts tab header, primary blue style consistent with existing screen.

### Service
Add `createUser(data)` method to existing `frontend/src/services/admin.service.ts` calling `POST /api/v1/users`.

### AdminSettings integration
- Import + lazy-load `CreateUserModal`
- Add `showCreateUserModal` boolean state
- Wire button → open modal, modal onSuccess → close + refetch users

## Data Flow

```
Admin clicks "+ Create User"
  → CreateUserModal opens (Phase 1)
  → Admin fills form → Submit
  → adminService.createUser() → POST /api/v1/users
  → Backend creates user + USER role + hashed abc@123
  → Modal switches to Phase 2 (temp password display)
  → Admin clicks Done → modal closes → user list refreshes
```

## Validation

- firstName, lastName, email: required
- email: valid format (frontend) + unique (backend)
- department: optional

## Out of Scope

- Email delivery (no SMTP)
- Force password change on first login
- Role assignment at creation time (use existing role modal post-creation)
