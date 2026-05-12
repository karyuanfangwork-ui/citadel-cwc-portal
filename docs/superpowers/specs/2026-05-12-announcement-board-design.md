# Announcement Board & Management — Design Spec
**Date:** 2026-05-12  
**Status:** Approved

---

## Overview

An internal announcement/newsletter board that lets management (HR, Finance, C-suite) publish memos and announcements to all company staff. Admins with `announcement:write` permission manage content via a dedicated page. Staff see announcements on their dashboard and a full board page.

---

## 1. Backend Wiring

### Route Registration
Register the announcement router in `backend/src/routes/index.ts`:
```ts
import announcementRoutes from './announcement.routes';
router.use('/announcements', announcementRoutes);
```
The route file, controller, and service are already fully implemented and untracked in git.

### Document Parse Endpoint
Add `POST /announcements/parse-doc` to `announcement.routes.ts` (requires `announcement:write`).

**Controller handler:**
- Accepts multipart/form-data with a single file field
- Detects type: `.pdf` → `pdf-parse`, `.docx` → `mammoth`
- Max size: 10MB
- Accepted MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Stores file via existing file service, returns `{ text, filename, fileUrl }`
- If extracted text < 50 characters, returns `{ text: '', filename, fileUrl, warning: 'Could not extract text from document' }`

### Dependencies to Install (backend)
- `pdf-parse` + `@types/pdf-parse`
- `mammoth`

### Permissions Seed
Add to `backend/prisma/seed.ts` — ensure these permissions exist and are assigned to the Admin role:
- `announcement:write` — create, edit, publish announcements
- `announcement:admin` — delete announcements

---

## 2. Frontend Pages

### 2a. Staff Announcement Board — `/announcements`
**Access:** All authenticated users  
**File:** `frontend/pages/Announcements.tsx`

Layout:
- Page header: "Announcements" with unread count badge
- Filter bar: category dropdown (All / HR / IT / Finance / General / Policy), priority filter
- Pinned section (if any): gold-tinted cards with 📌 badge
- Main feed: paginated list of announcement cards

Announcement card shows:
- Colour-coded category tag (HR = hr-500, IT = it-500, Finance = fin-500, General = brand-700)
- Priority badge (Critical = red, High = orange, Medium = blue, Low = grey)
- Title (bold)
- Excerpt or first 120 chars of body
- Author name + publish date (relative)
- Unread indicator: blue left border + bold title if unread

Clicking a card opens a **detail modal** (not a new route):
- Full announcement body (rendered as HTML/markdown)
- Author, category, publish date
- "Download original" button if `attachmentUrl` is set
- Marks as read on open (via `POST /announcements/:id/read`)

### 2b. Admin Management Page — `/announcements/manage`
**Access:** Users with `announcement:write` permission  
**File:** `frontend/pages/AnnouncementsManage.tsx`

Redirect to `/` with error toast if user lacks `announcement:write`.

Layout:
- Page header: "Manage Announcements" + "New Announcement" button
- Filter bar: status (All / Draft / Published), category
- Table columns: Title, Category, Priority, Status, Pinned, Expiry, Author, Created, Actions
- Row actions: Edit (opens slide-over), Publish (if draft, one-click), Delete (confirm dialog)

**Create/Edit slide-over form fields:**
| Field | Type | Notes |
|---|---|---|
| Title | text input | required |
| Body | textarea (rich text) | required; auto-filled on doc upload |
| Excerpt | text input | optional; shown in dashboard widget preview |
| Category | select | HR / IT / Finance / Policy / General |
| Priority | select | Low / Medium / High / Critical |
| Pin to top | toggle | isPinned |
| Expiry date | date picker | optional; auto-unpublishes |
| Upload Document | file input | .pdf or .docx; triggers parse-doc endpoint |
| Attachment | read-only | shown after upload, links to fileUrl |

Upload flow:
1. Admin selects file → `POST /announcements/parse-doc`
2. On success: extracted text fills Body field; `attachmentUrl` stored in form state
3. Warning toast if text extraction failed (attachment still stored)
4. "Remove attachment" button clears `attachmentUrl`

Save actions:
- "Save Draft" → `POST /announcements` with `isPublished: false`
- "Publish" → `POST /announcements` with `isPublished: true`
- Edit existing → `PATCH /announcements/:id`

### 2c. Dashboard Widget
**File:** `frontend/pages/Dashboard.tsx` — added below the Recent Requests section

Fetches `GET /announcements/dashboard` on load (alongside existing data fetches).

Widget shows:
- Section header "Announcements" with "View all →" link to `/announcements`
- Up to 3 pinned items (gold-tinted row, 📌 icon)
- Up to 3 latest non-pinned items
- Each row: category dot + title + author dept + relative time + unread indicator
- Empty state: "No announcements at this time"
- Skeleton loader while loading

---

## 3. Permissions & Access Control

| Permission | Who has it | Gates |
|---|---|---|
| `announcement:write` | Admin role (seeded); grantable to specific users via AdminSettings | Management page access, create/edit/publish API |
| `announcement:admin` | Admin role (seeded) | Delete API |
| *(none)* | All authenticated users | Read board, dashboard widget, mark as read |

The management page checks `user.permissions` (already available in `AuthContext`) and redirects if `announcement:write` is absent.

---

## 4. Document Parsing

**Endpoint:** `POST /announcements/parse-doc`  
**Auth:** `announcement:write`  
**Request:** `multipart/form-data`, field name `file`  
**Response:**
```json
{
  "status": "success",
  "data": {
    "text": "..extracted text..",
    "filename": "Q2-memo.pdf",
    "fileUrl": "/uploads/...",
    "warning": null
  }
}
```

**Libraries:** `pdf-parse` (PDF), `mammoth` (DOCX)  
**Limits:** 10MB max, `.pdf` and `.docx` only  
**Fallback:** If extraction yields < 50 chars, returns `text: ''` and `warning: 'Could not extract readable text'`

Staff view: if `attachmentUrl` is present on an announcement, a "Download original" button appears in the detail modal.

---

## 5. Routing

Add to `frontend/App.tsx`:
```tsx
<Route path="/announcements" element={<Announcements />} />
<Route path="/announcements/manage" element={<AnnouncementsManage />} />
```

Add to nav/sidebar: "Announcements" link visible to all staff; "Manage Announcements" link visible only to users with `announcement:write`.

---

## 6. Frontend Service

**File:** `frontend/src/services/announcement.service.ts`

Methods:
- `getDashboardAnnouncements()` → `GET /announcements/dashboard`
- `listAnnouncements(params)` → `GET /announcements`
- `getAnnouncement(id)` → `GET /announcements/:id`
- `markAsRead(id)` → `POST /announcements/:id/read`
- `markAllAsRead()` → `POST /announcements/mark-all-read`
- `adminListAll(params)` → `GET /announcements/admin/all` (requires write permission)
- `createAnnouncement(data)` → `POST /announcements`
- `updateAnnouncement(id, data)` → `PATCH /announcements/:id`
- `publishAnnouncement(id)` → `PATCH /announcements/:id/publish`
- `togglePin(id, isPinned)` → `PATCH /announcements/:id/pin`
- `deleteAnnouncement(id)` → `DELETE /announcements/:id`
- `parseDocument(file)` → `POST /announcements/parse-doc`

---

## 7. Out of Scope

- Email notifications when a new announcement is published (can be added later via existing notification system)
- Rich text WYSIWYG editor (textarea sufficient for v1)
- Per-user audience targeting (targetAudience field exists in DB but UI shows all to all staff)
- Unread badge in the top navigation bar (deferred to v2)
