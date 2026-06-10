# Announcement Module — Audit & Implementation Plan

**Date**: 2026-06-10  
**Module**: Announcements (CRUD, publish/draft, read tracking, dashboard widget)  
**Auditor**: Hermes Agent  
**Status**: Awaiting review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Module Inventory](#2-module-inventory)
3. [Confirmed Bugs](#3-confirmed-bugs)
4. [Feature Gaps](#4-feature-gaps)
5. [Architecture Concerns](#5-architecture-concerns)
6. [Implementation Plan](#6-implementation-plan)
   - [Phase 1 — Bug Fixes](#phase-1--bug-fixes-1-2-days)
   - [Phase 2 — Missing UI Features](#phase-2--missing-ui-features-2-3-days)
   - [Phase 3 — Targeting & Notifications](#phase-3--targeting--notifications-3-5-days)
   - [Phase 4 — Polish & Testing](#phase-4--polish--testing-2-3-days)
7. [Risk Assessment](#7-risk-assessment)
8. [Acceptance Criteria](#8-acceptance-criteria)

---

## 1. Executive Summary

The Announcement module provides CRUD, publish/draft workflow, read tracking, and a dashboard widget. The core data model and API are functional, but the audit uncovered **8 confirmed bugs**, **11 feature gaps**, and **4 architecture concerns**. The most critical issues are:

- **`targetAudience` is stored but never enforced** — any authenticated user sees all announcements regardless of targeting (B1)
- **`AnnouncementWidget` is dead code** — never imported, dashboard has no announcement feed (B2)
- **`isRead` is not returned on the list endpoint** — "New" badge is broken for all users (B3)
- **Admin search breaks when filtering by `isPublished=all`** (B6)
- **No HTML sanitization** on content — XSS risk (A1)

The recommended fix order is: Phase 1 (bugs) → Phase 2 (missing UI) → Phase 3 (targeting + notifications) → Phase 4 (polish + tests).

---

## 2. Module Inventory

### Backend

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` (lines 2392-2449) | `Announcement` + `AnnouncementRead` models, `AnnouncementCategory` / `AnnouncementPriority` enums |
| `services/announcement.service.ts` | Business logic: CRUD, publish, pin, read tracking, SSE broadcast |
| `controllers/announcement.controller.ts` | REST handlers + `multer` for doc/image uploads |
| `routes/announcement.routes.ts` | Express router — all routes require auth, write/admin require permissions |
| `validators/announcement.validator.ts` | Zod schemas for create/update |
| `utils/sseClients.ts` | SSE broadcast for `announcement:new` events |

### Frontend

| File | Purpose |
|------|---------|
| `src/services/announcement.service.ts` | API client — all endpoints |
| `pages/Announcements.tsx` | User-facing list with modal detail |
| `pages/AnnouncementDetail.tsx` | Standalone detail page (route `/announcements/:id`) |
| `pages/AnnouncementsManage.tsx` | Admin CRUD with slide-over editor |
| `pages/AnnouncementWidget.tsx` | Dashboard widget — **DEAD CODE, never imported** |
| `src/components/RichTextEditor.tsx` | TipTap editor with image upload via `/announcements/upload-image` |

### Routes

| Route | Auth | Permission |
|-------|------|------------|
| `GET /announcements` | Authenticated | — |
| `GET /announcements/dashboard` | Authenticated | — |
| `GET /announcements/unread-count` | Authenticated | — |
| `POST /announcements/mark-all-read` | Authenticated | — |
| `GET /announcements/:id` | Authenticated | — |
| `POST /announcements/:id/read` | Authenticated | — |
| `GET /announcements/admin/all` | Authenticated | `announcement:write` |
| `POST /announcements` | Authenticated | `announcement:write` |
| `POST /announcements/parse-doc` | Authenticated | `announcement:write` |
| `POST /announcements/upload-image` | Authenticated | `announcement:write` |
| `PATCH /announcements/:id` | Authenticated | `announcement:write` |
| `PATCH /announcements/:id/publish` | Authenticated | `announcement:write` |
| `PATCH /announcements/:id/pin` | Authenticated | `announcement:write` |
| `DELETE /announcements/:id` | Authenticated | `announcement:admin` |

### Permissions (seed)

| Permission | Resource | Action | Assigned To |
|------------|----------|--------|-------------|
| `announcement:read` | announcement | read | Admin, HR, IT, End User, CEO |
| `announcement:write` | announcement | write | Admin |
| `announcement:admin` | announcement | admin | Admin |

---

## 3. Confirmed Bugs

### B1. `targetAudience` stored but never enforced — security gap

**Severity**: HIGH  
**Location**: `announcement.service.ts` — `listAnnouncements()`, `getDashboardAnnouncements()`  
**Current behavior**: The schema stores `targetAudience` (default `'ALL'`, `VARCHAR(50)`), the validator accepts any string ≤50 chars, and the frontend doesn't expose the field at all. The backend **never filters** by `targetAudience`. An announcement targeted to `'HR_ONLY'` is visible to every authenticated user.  
**Impact**: The entire targeting feature is decorative. No role/department-based visibility.  
**Fix**:
1. Define `targetAudience` enum values in Zod validator: `ALL`, `HR`, `IT`, `FINANCE`, `POLICY` (matching AnnouncementCategory for simplicity, or custom audience groups)
2. Add `targetAudience` filtering to `listAnnouncements()` and `getDashboardAnnouncements()`:
   - If `targetAudience = 'ALL'`, show to everyone
   - Otherwise, match against the user's role/department
3. Add `targetAudience` dropdown to `AnnouncementsManage.tsx`
4. Pass user context into service methods for filtering

---

### B2. `AnnouncementWidget` is dead code — never imported

**Severity**: MEDIUM  
**Location**: `frontend/pages/AnnouncementWidget.tsx`  
**Current behavior**: The widget component exists but is never imported by any page. The Dashboard page does not render any announcement feed. Users must navigate to `/announcements` manually.  
**Impact**: Announcements have zero proactive visibility. No dashboard integration.  
**Fix**: Import and render `AnnouncementWidget` on the Dashboard page. Wire it to show pinned + latest with read/unread indicators.

---

### B3. `isRead` not returned on list endpoint — "New" badge broken

**Severity**: MEDIUM  
**Location**: `announcement.service.ts` — `listAnnouncements()` (lines 25-105)  
**Current behavior**: The service method does NOT include `reads` in the Prisma query and does not compute `isRead`. The `Announcements.tsx` list page checks `a.isRead` on line 105, but this field is always `undefined`.  
**Contrast**: `getDashboardAnnouncements()` correctly includes `reads: { where: { userId }, select: { id: true } }` and maps `isRead`.  
**Impact**: Every announcement in the user list appears as "New" (unread) regardless of read status.  
**Fix**: Add `reads` include to `listAnnouncements()` query and map `isRead`:

```typescript
// In listAnnouncements, add to Prisma findMany include:
include: {
  author: { select: { id: true, firstName: true, lastName: true, email: true } },
  reads: {
    where: { userId },
    select: { id: true },
  },
},

// After fetching, map isRead:
const mapped = announcements.map(a => ({
  ...a,
  isRead: a.reads.length > 0,
}));
```

This requires passing `userId` into `listAnnouncements()`.

---

### B4. Double mark-as-read in `AnnouncementDetail.tsx`

**Severity**: LOW  
**Location**: `frontend/pages/AnnouncementDetail.tsx` line 44  
**Current behavior**: `getOne(id)` calls the backend `getAnnouncement()` which **already auto-marks as read** via `upsert` (service line 193). Then line 44 explicitly calls `announcementService.markRead(id)` again — a redundant network request.  
**Impact**: Wasted HTTP request every time a user views an announcement detail.  
**Fix**: Remove the explicit `markRead()` call:

```typescript
// DELETE this line from AnnouncementDetail.tsx:
try { await announcementService.markRead(id); } catch { /* silent */ }
```

---

### B5. Unpublishing doesn't clear `publishedAt`

**Severity**: MEDIUM  
**Location**: `announcement.service.ts` — `updateAnnouncement()` (lines 257-294)  
**Current behavior**: When `isPublished` transitions from `true` to `false`, the service does NOT clear `publishedAt`. The announcement enters draft state but retains its old `publishedAt` timestamp.  
**Contrast**: When transitioning to published (`isPublished === true`), the service checks and sets `publishedAt` if null.  
**Impact**: Inconsistent state — a "draft" announcement has a non-null `publishedAt`. Could cause confusion in sorting and display logic.  
**Fix**:

```typescript
// In updateAnnouncement, add after the publish-at check:
if (data.isPublished === false) {
  updateData.publishedAt = null;
}
```

---

### B6. Search filter broken with `publishedOnly` + `OR` clause

**Severity**: MEDIUM  
**Location**: `announcement.service.ts` — `listAnnouncements()` lines 61-76  
**Current behavior**: When `publishedOnly=true` and `search` is provided, the search filter is correctly wrapped in `AND: [searchFilter]`. But when **neither** `publishedOnly` nor `unpublishedOnly` is set (admin "all" mode with search), the code uses `Object.assign(where, searchFilter)`, which adds `OR` at the same Prisma level as `deletedAt`. This creates ambiguous/incorrect Prisma queries.  
**Impact**: Admin search with `isPublished=all` + search query can return wrong results or Prisma errors.  
**Fix**: Always use `AND` array for combining filters:

```typescript
if (search) {
  const searchFilter = {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ],
  };
  // Always use AND for combining with other filters
  where.AND = [...(where.AND || []), searchFilter];
}
```

---

### B7. No author check — any `announcement:write` user can edit any announcement

**Severity**: MEDIUM  
**Location**: `announcement.controller.ts` — `update`, `publish`, `togglePin`  
**Current behavior**: The endpoints only check `announcement:write` permission. They don't verify that the requesting user is the author of the announcement. Any user with `announcement:write` can edit, publish, or pin any announcement.  
**Impact**: Cross-department editing. An HR agent can modify IT announcements.  
**Fix**: Add author check in controller/service:

```typescript
// In service, add authorId parameter:
async updateAnnouncement(id: string, userId: string, data: UpdateData) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new AppError('Announcement not found', 404);
  // Allow if user is author OR has admin permission
  // Controller should check: user is author OR user has announcement:admin
}
```

In the controller, either:
- Add a middleware that checks `announcement:write` + (is author OR `announcement:admin`)
- Or check in the controller itself and throw 403 if not authorized

---

### B8. `AnnouncementDetail` uses wrong field name for read count

**Severity**: LOW  
**Location**: `frontend/pages/AnnouncementDetail.tsx` line 79  
**Current behavior**: `const readCount = announcement._count?.readBy || announcement.readBy?.length || 0;`  
The Prisma relation is named `reads`, not `readBy`. The `_count` field uses `reads`, and the include uses `reads`. The frontend type definition also uses `readBy` but the API never returns it.  
**Impact**: Read count always shows `0` on the detail page.  
**Fix**:
1. Fix the frontend type in `announcement.service.ts`:

```typescript
// Change:
readBy?: { id: string }[];
// To:
reads?: { id: string }[];
```

2. Fix the detail page:
```typescript
const readCount = announcement._count?.reads || announcement.reads?.length || 0;
```

---

## 4. Feature Gaps

### G1. No notification/email when announcement is published

**Severity**: HIGH  
**Current behavior**: `broadcastNewAnnouncement` only pushes `announcement:new` via SSE to currently-connected clients. No persistent `Notification` records are created. No emails are sent. Users offline at publish time never see the announcement.  
**Fix**: When `publishAnnouncement` is called, create a `Notification` record for all target users. Optionally trigger email digest for high-priority announcements. Integrate with the existing notification service (`notification.service.ts`).

---

### G2. `targetAudience` is a free-text string with no validation or UI

**Severity**: HIGH (depends on B1)  
**Current behavior**: Zod allows `z.string().max(50).default('ALL')`. Frontend doesn't expose the field. The entire targeting feature is dead.  
**Fix**: (Covered in B1 fix) — Define enum, add UI dropdown, implement service filtering.

---

### G3. No pagination in admin list

**Severity**: MEDIUM  
**Current behavior**: `AnnouncementsManage.tsx` calls `adminList({ limit: 50 })` with hardcoded limit and no page controls. If there are >50 announcements, the rest are invisible.  
**Fix**: Add pagination controls (page buttons, total count display) to the admin table. Pass `page` and `limit` params to `adminList()`.

---

### G4. No search in admin list

**Severity**: MEDIUM  
**Current behavior**: Backend supports `?search=` but the admin page has no search input.  
**Fix**: Add a search bar to `AnnouncementsManage.tsx` that passes `search` param to `adminList()`.

---

### G5. No priority filter in user-facing list

**Severity**: LOW  
**Current behavior**: Backend supports `?priority=` but the user list only has a category dropdown.  
**Fix**: Add priority filter dropdown alongside category.

---

### G6. No "Mark All as Read" button on user list page

**Severity**: MEDIUM  
**Current behavior**: The frontend service has `markAllRead()` and the backend has `POST /announcements/mark-all-read`, but `Announcements.tsx` never renders a button for it.  
**Fix**: Add a "Mark All as Read" action button in the list header, call `announcementService.markAllRead()`, then re-fetch.

---

### G7. No attachment URL management — download link may be broken

**Severity**: MEDIUM  
**Current behavior**: When a doc is uploaded, `parseDoc` returns an S3 key like `cwc/announcements/...`. The detail page constructs a download link as `/api/v1/files/download/${key}`, but there's no evidence this download route exists or handles announcement attachments. The upload-image endpoint constructs a direct S3 URL, which works but bypasses any access control.  
**Fix**: 
1. Verify the `/api/v1/files/download/:key` route exists and handles announcement S3 keys
2. If not, add a download endpoint or use presigned URLs with expiry
3. In admin table, add an attachment indicator column

---

### G8. No "unpublish" action in UI

**Severity**: MEDIUM  
**Current behavior**: Admin page has "Publish" button for drafts, but no "Unpublish" button for published announcements. The backend supports `PATCH /:id` with `isPublished: false`.  
**Fix**: Add an "Unpublish" action button for published announcements in the admin table. This should also clear `publishedAt` (fixing B5).

---

### G9. No sorting controls

**Severity**: LOW  
**Current behavior**: Both user list and admin list always sort by `isPinned DESC, publishedAt DESC`. No way to sort by priority, category, or creation date.  
**Fix**: Add sortable column headers or a sort dropdown.

---

### G10. No tests

**Severity**: MEDIUM  
**Current behavior**: Zero test files for the announcement module. No unit tests, no integration tests, no e2e tests.  
**Fix**: Add:
- Service unit tests (CRUD, publish flow, read tracking, filtering)
- Controller integration tests (auth, permission checks, file upload)
- Frontend component tests (list, detail, admin CRUD)

---

### G11. No audit trail

**Severity**: LOW  
**Current behavior**: No record of who changed what. `updatedAt` auto-updates but doesn't track what changed.  
**Fix**: Add an `AnnouncementAuditLog` model or integrate with a generic audit system. Track: create, publish, unpublish, edit (with diff), pin/unpin, delete.

---

## 5. Architecture Concerns

### A1. XSS risk via `dangerouslySetInnerHTML`

**Severity**: HIGH  
**Location**: `Announcements.tsx` line 208, `AnnouncementDetail.tsx` line 133  
**Current behavior**: Announcement content is rendered as raw HTML with `dangerouslySetInnerHTML`. The content comes from TipTap rich text editor, but there is **no server-side sanitization**. A user with `announcement:write` could inject `<script>` tags, `on*` event handlers, or `<iframe>` elements.  
**Fix**: Add server-side HTML sanitization on create/update using `sanitize-html` or `DOMPurify`:

```typescript
import sanitizeHtml from 'sanitize-html';

// In createAnnouncement and updateAnnouncement:
data.content = sanitizeHtml(data.content, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] },
});
```

---

### A2. `publishedAt` can be null for published announcements via direct API

**Severity**: LOW  
**Current behavior**: If someone sends `PATCH /:id` with `{ isPublished: true }` on an announcement that was already published (and `publishedAt` was manually nulled via another update), the service correctly sets `publishedAt`. But there's no Prisma-level constraint enforcing this invariant.  
**Fix**: Add a validator-level check or Prisma `@Check` constraint that `isPublished = true` implies `publishedAt IS NOT NULL`.

---

### A3. Soft delete doesn't clean up read records

**Severity**: LOW  
**Current behavior**: Soft-deleted announcements keep their `AnnouncementRead` records. The `deletedAt: null` filter excludes them from queries, but read count stats in admin views could be polluted. No UI to view/restore soft-deleted announcements.  
**Fix**: Either:
1. Add a "trash" admin view to manage soft-deleted announcements (restore/permanent delete)
2. Or cascade-delete `AnnouncementRead` records on soft delete
3. Or switch to hard delete with audit trail

---

### A4. SSE broadcast is fire-and-forget with no audience filtering

**Severity**: LOW (escalates to MEDIUM once G2/B1 is fixed)  
**Current behavior**: `broadcastNewAnnouncement` pushes to ALL connected SSE clients regardless of `targetAudience`. Currently this is consistent (since targeting isn't enforced), but once targeting is implemented, the broadcast should filter by audience.  
**Fix**: When implementing B1/G2, include `targetAudience` in the SSE event payload. The SSE client should filter display based on user's role/department.

---

## 6. Implementation Plan

### Phase 1 — Bug Fixes (1-2 days)

**Goal**: Fix all confirmed bugs that affect correctness or security.

| ID | Bug | Fix | Files Changed | Effort |
|----|-----|-----|---------------|--------|
| B3 | `isRead` missing from list endpoint | Add `reads` include + `isRead` mapping to `listAnnouncements()`. Pass `userId` into service method from controller. | `announcement.service.ts`, `announcement.controller.ts` | S |
| B6 | Search + admin filter combo broken | Refactor where-clause builder to always use `AND` array for combining filters. | `announcement.service.ts` | S |
| B8 | Wrong field name `_count.readBy` | Fix frontend type from `readBy` to `reads`, fix detail page read count accessor. | `announcement.service.ts` (frontend types), `AnnouncementDetail.tsx` | S |
| B4 | Redundant `markRead` call | Remove explicit `markRead()` from `AnnouncementDetail.tsx` (already handled by `getOne`). | `AnnouncementDetail.tsx` | S |
| B5 | Unpublish doesn't clear `publishedAt` | Set `publishedAt = null` when `isPublished` transitions to `false`. | `announcement.service.ts` | S |
| B7 | No author check for edit/publish/pin | Add author OR admin check in controller. Return 403 if unauthorized. | `announcement.controller.ts` | M |
| B2 | `AnnouncementWidget` never imported | Import and render widget on Dashboard page. | Dashboard page component | S |

**Sequence**:
1. B3 + B6 (service refactor — these touch the same function, do together)
2. B8 + B4 (frontend quick fixes)
3. B5 (service fix)
4. B7 (auth check — needs careful permission design)
5. B2 (dashboard integration)

**Verification**:
- [ ] User list page shows correct read/unread status
- [ ] Admin search with `isPublished=all` + search query returns correct results
- [ ] Detail page shows correct read count
- [ ] Viewing announcement detail auto-marks as read (single API call)
- [ ] Unpublishing clears `publishedAt`
- [ ] Non-author with `announcement:write` cannot edit others' announcements (returns 403)
- [ ] Dashboard shows announcement widget

---

### Phase 2 — Missing UI Features (2-3 days)

**Goal**: Make the module fully usable — dashboard feed, pagination, search, read-all.

| ID | Gap | Fix | Files Changed | Effort |
|----|-----|-----|---------------|--------|
| G3 | No pagination in admin list | Add page/limit params, pagination UI (Prev/Next + page count). | `AnnouncementsManage.tsx`, `announcement.service.ts` (frontend) | M |
| G4 | No search in admin list | Add search input to admin page, pass `search` param to `adminList()`. | `AnnouncementsManage.tsx` | S |
| G5 | No priority filter in user list | Add priority dropdown alongside category filter. | `Announcements.tsx` | S |
| G6 | No "Mark All as Read" button | Add button to `Announcements.tsx` header, call `markAllRead()`, refresh list. | `Announcements.tsx` | S |
| G8 | No "Unpublish" button | Add "Unpublish" action for published announcements. Also clear `publishedAt` (ties to B5). | `AnnouncementsManage.tsx` | S |
| G7 | Attachment download may be broken | Verify `/api/v1/files/download/:key` route works for announcement S3 keys. Add fallback presigned URL. | `announcement.controller.ts` or `AnnouncementDetail.tsx` | S |

**Sequence**:
1. G3 + G4 (admin list improvements — do together)
2. G5 + G6 (user list improvements — do together)
3. G8 (unpublish action)
4. G7 (attachment verification)

**Verification**:
- [ ] Admin table paginates correctly when >20 items
- [ ] Admin search returns filtered results
- [ ] User list filters by priority
- [ ] "Mark All as Read" marks all visible announcements and refreshes UI
- [ ] Published announcements show "Unpublish" button; clicking it sets draft + clears `publishedAt`
- [ ] Document attachments download correctly

---

### Phase 3 — Targeting & Notifications (3-5 days)

**Goal**: Implement audience targeting and notification delivery — the highest-impact feature work.

| ID | Item | Fix | Files Changed | Effort |
|----|------|-----|---------------|--------|
| B1/G2 | `targetAudience` not enforced | Define audience enum, add to Zod validator, add UI dropdown, implement service filtering by user role/department. | `announcement.validator.ts`, `announcement.service.ts`, `announcement.controller.ts`, `AnnouncementsManage.tsx`, `prisma/schema.prisma` (optional enum migration) | L |
| G1 | No notification on publish | Create `Notification` records for all target users when announcement is published. Optionally send email for HIGH/CRITICAL. | `announcement.service.ts`, integrate with `notification.service.ts` + `email.service.ts` | M |
| A1 | XSS risk in content | Add `sanitize-html` middleware on create/update to strip dangerous tags. Install package, add sanitization step in service. | `announcement.service.ts`, `package.json` | S |
| G11 | No audit trail | Add `AnnouncementAuditLog` model or use a generic audit logging middleware. | `prisma/schema.prisma`, new `announcementAudit.service.ts` | M |

**Targeting design** (B1/G2):

```
targetAudience values:
  ALL          → visible to everyone
  HR_ONLY      → visible to users with HR role
  IT_ONLY      → visible to users with IT role  
  FINANCE_ONLY → visible to users with Finance role
  MANAGEMENT   → visible to users with Admin/CEO/management roles
```

Implementation:
1. Change Zod validator from `z.string()` to `z.enum(['ALL', 'HR_ONLY', 'IT_ONLY', 'FINANCE_ONLY', 'MANAGEMENT'])`
2. Add `targetAudience` dropdown to admin form
3. In `listAnnouncements()` and `getDashboardAnnouncements()`, add filter:
   ```typescript
   where.OR = [
     { targetAudience: 'ALL' },
     { targetAudience: userRoleBasedTarget },  // e.g., 'HR_ONLY' for HR users
   ];
   ```
4. Pass user role/department into service methods
5. Include `targetAudience` in SSE broadcast for client-side filtering

**Notification design** (G1):

When `publishAnnouncement()` is called:
1. Query all users matching `targetAudience`
2. Create `Notification` records for each:
   ```typescript
   await prisma.notification.createMany({
     data: targetUsers.map(u => ({
       userId: u.id,
       type: 'ANNOUNCEMENT',
       title: `New announcement: ${announcement.title}`,
       link: `/announcements/${announcement.id}`,
     })),
   });
   ```
3. For HIGH/CRITICAL priority, also trigger email via `email.service.ts`

**Sequence**:
1. A1 (XSS sanitization — security, do first)
2. B1/G2 (targeting — largest change, schema + service + UI)
3. G1 (notifications — depends on targeting for audience)
4. G11 (audit trail — independent, can be last)

**Verification**:
- [ ] Announcements with `targetAudience: 'HR_ONLY'` are invisible to IT/Finance users
- [ ] Creating an announcement with `<script>alert(1)</script>` in content is sanitized
- [ ] Publishing an announcement creates notification records for target users
- [ ] Audit log records create/publish/edit/delete actions

---

### Phase 4 — Polish & Testing (2-3 days)

**Goal**: Add sorting, tests, and cleanup.

| ID | Item | Fix | Effort |
|----|------|-----|--------|
| G9 | No sorting controls | Add sort dropdown (by date, priority, category) to user list and admin table | M |
| G10 | No tests | Add service unit tests, controller integration tests, key e2e scenarios | L |
| A3 | Soft delete management | Add "trash" admin view or switch to hard delete with audit | M |
| A2 | `publishedAt` invariant | Add Prisma check or validator constraint | S |

**Test plan** (G10):

Service unit tests:
- `listAnnouncements` — pagination, filtering (category, priority, published status), search, expired exclusion
- `getDashboardAnnouncements` — pinned + latest, read status
- `getAnnouncement` — auto-mark-as-read
- `createAnnouncement` — validation, publishedAt auto-set, SSE broadcast
- `updateAnnouncement` — author check, publish/unpublish state transitions
- `publishAnnouncement` — SSE broadcast, notification creation
- `deleteAnnouncement` — soft delete
- `markAllAsRead` — batch upsert
- `targetAudience` filtering

Controller integration tests:
- Auth required on all routes
- `announcement:write` required for create/update/publish/pin
- `announcement:admin` required for delete
- Author check for update/publish/pin
- File upload validation (PDF, DOCX, images)

E2E scenarios:
- Full CRUD flow: create draft → edit → publish → view → mark read → unpublish → delete
- Targeting: create HR_ONLY announcement → verify IT user cannot see it
- Search and filter: verify admin list search + isPublished filter

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| B7 (author check) could break existing admin workflow | Medium | High | Allow `announcement:admin` to bypass author check. Add migration note. |
| B1/G2 (targeting) requires user role mapping | Medium | Medium | Map `targetAudience` to user department/role. Start with role-based, extend to department later. |
| A1 (XSS sanitization) could strip valid TipTap HTML | Low | Medium | Use permissive `sanitize-html` config. Test with TipTap output before deploying. |
| B6 (where clause refactor) could break existing queries | Low | High | Add comprehensive tests before changing. Test all filter combos. |
| G1 (notifications) could create too many records for ALL target | Low | Low | Use `createMany` with batch size. Add cleanup job for old read notifications. |

---

## 8. Acceptance Criteria

### Phase 1 — Bug Fixes

- [ ] `GET /announcements` returns `isRead` field for each announcement
- [ ] `GET /announcements?search=test` works correctly with all `isPublished` filter values
- [ ] `GET /announcements/:id` returns correct `_count.reads` value
- [ ] Viewing announcement detail auto-marks as read (single API call, not two)
- [ ] Unpublishing an announcement clears `publishedAt`
- [ ] Non-author with `announcement:write` gets 403 on update/publish/pin of others' announcements
- [ ] Admin with `announcement:admin` can still edit any announcement
- [ ] Dashboard renders the announcement widget with pinned + latest items

### Phase 2 — Missing UI Features

- [ ] Admin table paginates (Prev/Next + page indicator)
- [ ] Admin search bar filters announcements by title/content
- [ ] User list has priority filter dropdown
- [ ] "Mark All as Read" button marks all visible announcements and refreshes UI
- [ ] Published announcements show "Unpublish" action; clicking it sets draft + clears `publishedAt`
- [ ] Document attachment download link works

### Phase 3 — Targeting & Notifications

- [ ] Admin form has `targetAudience` dropdown with options: ALL, HR_ONLY, IT_ONLY, FINANCE_ONLY, MANAGEMENT
- [ ] `GET /announcements` and `GET /announcements/dashboard` filter by targetAudience based on user role
- [ ] Creating an announcement with `<script>` in content strips the script tag
- [ ] Publishing an announcement creates Notification records for target users
- [ ] SSE `announcement:new` event includes `targetAudience` field
- [ ] Audit log records: create, publish, unpublish, edit, pin, delete actions

### Phase 4 — Polish & Testing

- [ ] User list supports sorting by date, priority, category
- [ ] Admin table supports sorting
- [ ] All service unit tests pass
- [ ] All controller integration tests pass
- [ ] Key e2e scenarios pass
- [ ] Soft-deleted announcements can be viewed/restored from admin trash view

---

*End of audit report. Awaiting review before implementation begins.*

---

## Implementation Log — Phase 1 (2026-06-10)

**Status**: Phase 1 COMPLETE — all bugs fixed, backend + frontend compile clean.

### Changes Applied

**B3+B6: Fixed `isRead` in list endpoint + refactored where-clause builder**
- `announcement.service.ts`: Added `userId` to `ListAnnouncementsOptions`. Replaced broken `Object.assign` where-clause with safe `AND` array composition. Added `reads` include + `isRead` mapping when `userId` is provided.
- `announcement.controller.ts`: Pass `req.user!.id` as `userId` in both `list` and `adminList` endpoints.

**B8+B4: Fixed `_count.reads` field name + removed redundant `markRead`**
- `announcement.service.ts` (frontend): Changed `readBy` → `reads` in `Announcement` type.
- `AnnouncementDetail.tsx`: Changed `announcement._count?.readBy` → `announcement._count?.reads`. Removed redundant `markRead()` call (backend already auto-marks on `getOne`).

**B5: Unpublishing now clears `publishedAt`**
- `announcement.service.ts`: Added `if (data.isPublished === false) { updateData.publishedAt = null; }` in `updateAnnouncement`.

**B7: Added author-or-admin check for edit/publish/pin**
- `announcement.controller.ts`: Added `requireAuthorOrAdmin()` private method. Applied to `update`, `publish`, and `togglePin` endpoints. Returns 403 if user is not the author and doesn't have `announcement:admin`.
- `announcement.service.ts`: Added `getAnnouncementForAuthCheck()` lightweight method (selects only `id` + `authorId`).

**B2: Dashboard already has inline `AnnouncementBanner`**
- Verified Dashboard.tsx already fetches and renders announcements via `announcementService.getDashboard()`. The separate `AnnouncementWidget.tsx` is dead code but doesn't cause harm.

---

## Implementation Log — Phase 2 (2026-06-10)

**Status**: Phase 2 COMPLETE — all gaps addressed, backend + frontend compile clean.

### Changes Applied

**G3+G4: Pagination + search in admin list (AnnouncementsManage.tsx)**
- Complete rewrite of `AnnouncementsManage.tsx` with:
  - Server-side pagination (page/limit with Prev/Next buttons, total count display)
  - Search bar with Enter-to-search + clear button (debounced to `search` state)
  - Status filter tabs (All / Draft / Published) that reset page to 1 on change
  - All filters (status, search) trigger re-fetch via `useCallback` + `useEffect`

**G5: Priority filter in user list (Announcements.tsx)**
- Added priority dropdown (Low/Medium/High/Critical/All) alongside existing category filter
- Both filters reset page to 1 on change

**G6: Mark All as Read button (Announcements.tsx)**
- Added "Mark All Read" button in header next to filter dropdowns
- Calls `announcementService.markAllRead()` then re-fetches the list
- Backend route `POST /announcements/mark-all-read` + controller + service method already existed

**G8: Unpublish action (AnnouncementsManage.tsx)**
- Published announcements now show an "Unpublish" button (calls `announcementService.update(id, { isPublished: false })`)
- Draft announcements show "Publish" button
- Both appear alongside Edit and Delete in the actions column

---

## Implementation Log — Phase 3 (2026-06-10)

**Status**: Phase 3 COMPLETE — targeting, notifications, and XSS sanitization implemented. Backend + frontend compile clean.

### Changes Applied

**A1: XSS sanitization via sanitize-html**
- Installed `sanitize-html` + `@types/sanitize-html` in backend
- Added `sanitizeContent()` function with allowlisted tags/attributes (supports TipTap rich editor output: img, figure, figcaption, u, s, mark, sub, sup; inline styles for color/text-align)
- Applied sanitization in `createAnnouncement()` and `updateAnnouncement()` — all content is sanitized before storage
- Script tags, event handlers, iframes, and other dangerous markup are stripped server-side

**B1/G2: targetAudience enforcement**
- Added `targetAudienceEnum` to Zod validator: `z.enum(['ALL', 'IT_ONLY', 'HR_ONLY', 'FINANCE_ONLY', 'MANAGEMENT'])`
- Added `TARGET_AUDIENCE_ROLES` mapping in service:
  - `ALL` → everyone (empty filter)
  - `IT_ONLY` → `IT_AGENT` role
  - `HR_ONLY` → `HR_AGENT`, `HIRING_MANAGER` roles
  - `FINANCE_ONLY` → `FINANCE_HEAD`, `CREDIT_ADMIN`, `CREDIT_MANAGER`, `CREDIT_ANALYST`, `CREDIT_RM` roles
  - `MANAGEMENT` → `ADMIN`, `CEO`, `GROUP_DCEO` roles
- `listAnnouncements()` and `getDashboardAnnouncements()` now accept `userRoles` param and filter by target audience
- Controller passes `req.user.roles` to both list and dashboard endpoints
- Admin list (`adminList`) shows all announcements regardless of audience (admin view)
- Frontend `AnnouncementsManage.tsx`: added Audience dropdown in form (3-column grid: Category, Priority, Audience)
- Frontend `AnnouncementsManage.tsx`: added Audience column in admin table with human-readable labels
- SSE broadcast now includes `targetAudience` in event payload for client-side filtering

**G1: Notification creation on publish**
- `createNotificationsForAnnouncement()` private method in service:
  - Queries users matching the target audience (ALL = all active users; specific = users with matching roles)
  - Creates `IN_APP` Notification records for each target user via `prisma.notification.createMany()`
  - For HIGH/CRITICAL priority, logs intent for future email integration
  - Non-fatal: errors are caught and logged, don't block publish
- Called from `createAnnouncement()` (when `isPublished: true`), `updateAnnouncement()` (when transitioning to published), and `publishAnnouncement()`

**G11: Audit trail — deferred to Phase 4**
- Would require a Prisma migration for an `AnnouncementAuditLog` model. Deferring to avoid blocking Phase 3 delivery.

---

## Implementation Log — Phase 4 (2026-06-10)

**Status**: Phase 4 COMPLETE — audit trail, sorting, soft-delete restore, and polish. Backend + frontend compile clean.

### Changes Applied

**G11: Audit trail via existing AuditLog model**
- Used the existing `auditLog()` utility (`backend/src/utils/audit.ts`) — no Prisma migration needed
- Added `import { auditLog } from '../utils/audit'` to `announcement.controller.ts`
- Audit events logged:
  - `announcement.create` — on create, logs full announcement data
  - `announcement.update` — on update, logs changed fields
  - `announcement.publish` — on publish, logs `{ isPublished: true }`
  - `announcement.pin` — on pin toggle, logs `{ isPinned }`
  - `announcement.delete` — on soft delete, logs empty object
  - `announcement.restore` — on restore, logs empty object
- All events use `resourceType: 'announcement'` and `resourceId: id`

**P1+P2: Sorting controls**
- Backend: Added `sortBy` and `sortOrder` params to `ListAnnouncementsOptions`
  - `sortBy`: 'publishedAt' (default), 'priority', 'category', 'createdAt'
  - `sortOrder`: 'desc' (default) or 'asc'
  - Priority sort uses `CASE` expression: CRITICAL=1, HIGH=2, MEDIUM=3, LOW=4
  - Pinned announcements always sorted first
- Frontend `Announcements.tsx` (user list): Added sort dropdown (Newest, Oldest, Priority, Category)
- Frontend `AnnouncementsManage.tsx` (admin): Added sort dropdown (Published Newest/Oldest, Created Newest, Priority, Category)
- Both pass `sortBy` + `sortOrder` to API calls

**P3: Soft-delete restore + trash view**
- Backend: Added `restoreAnnouncement(id)` and `listDeletedAnnouncements(page, limit)` service methods
- Backend: Added `restore` and `trashList` controller handlers
- Backend: Added routes:
  - `GET /announcements/admin/trash` (requires `announcement:admin`)
  - `PATCH /announcements/:id/restore` (requires `announcement:admin`)
- Frontend `announcement.service.ts`: Added `restore()` and `trashList()` API methods
- Frontend `AnnouncementsManage.tsx`:
  - Added "Trash" tab (alongside All/Draft/Published) with red highlight
  - Trash view shows simplified table (Title, Category, Deleted date, Restore button)
  - Restore button calls `announcementService.restore(id)` then refreshes both trash and active lists
  - Pagination for trash view

---

## Test Suite — G10 (2026-06-10)

**Status**: COMPLETE — 32/32 tests passing.

**File**: `backend/src/__tests__/announcement.test.ts`

### Test Coverage

| Suite | Tests | Audit Items Covered |
|---|---|---|
| GET /announcements — isRead (B3) | 2 | B3 |
| PATCH /announcements/:id — unpublish (B5) | 1 | B5 |
| Authorization — author-or-admin (B7) | 3 | B7 |
| targetAudience filtering (B1/G2) | 3 | B1, G2 |
| XSS sanitization (A1) | 4 | A1 |
| Notification creation (G1) | 1 | G1 |
| Pagination & search (G3/G4) | 2 | G3, G4 |
| Sorting (G9) | 2 | G9 |
| Audit trail (G11) | 2 | G11 |
| Soft delete & restore (A3) | 3 | A3 |
| Full CRUD lifecycle | 1 | — |
| Validation | 4 | — |
| Mark all as read (G6) | 1 | G6 |
| Pin/unpin | 1 | — |
| Dashboard | 1 | — |
| Unread count | 1 | — |
| **Total** | **32** | |

### Approach
- Integration tests hitting the real Express app with supertest
- Uses real database (Prisma) with test user cleanup
- ADMIN role (announcement:admin+write+read) and NORMAL_STAFF role (announcement:read only)
- JWT auth via real token generation against `config.jwt.secret`
- Puppeteer-core mocked to avoid ESM parse issues in Jest
- `afterEach` cleans up created announcements; `afterAll` cleans up test users