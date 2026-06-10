# Comment Attachment Implementation Plan

**Date:** 2026-06-10
**Author:** Hermes Agent
**Status:** Pending Review

---

## Overview

Enable requesters and agents to upload files (images, PDFs, documents) and paste screenshots into the comment section of a request detail page. Attachments are linked to the specific comment activity and rendered inline in the activity feed.

---

## Current State

| Layer | What Exists | Gap |
|---|---|---|
| **DB** | `RequestAttachment` model with `activityId` (nullable FK → `RequestActivity`) | `activityId` is never populated — always NULL |
| **Backend Upload** | `POST /requests/:id/attachments` (multer+S3, 10MB limit, MIME allowlist) | Upload is standalone — no way to link to a specific comment |
| **Backend Activity** | `POST /requests/:id/activities` (text-only `message` + `isInternal`) | No file support, returns activity without `attachments` |
| **Backend Fetch** | `GET /requests/:id/activities` returns flat list, no `attachments` include | Missing attachment data per activity |
| **Frontend Service** | `requestService.uploadAttachment()`, `.downloadAttachment()`, `.addActivity()` | Upload and comment are separate calls, no integration |
| **Frontend UI** | `ActivityFeed.tsx` — plain `<textarea>`, no file picker/drag-drop/paste | Zero attachment UX |

---

## Architecture: Two-Step Upload Flow

**Why not multipart comment+file in one request?** Because S3 upload via `multer` processes files before the request body is parsed. Combining text + file in one multipart request makes optimistic UI harder and error recovery messier (failed upload vs failed comment).

**Chosen pattern:**

1. User selects files → upload immediately to S3 (show preview/thumbnail)
2. User submits comment → create activity, backend auto-links pending unlinked attachments by setting their `activityId`

```
User selects file(s) → [pending files shown in UI]
User types comment
User clicks "Send Reply"
  ├─ Upload all pending files in parallel
  │   POST /requests/:id/attachments  (each file)
  │   → Returns { id, fileName, storageUrl, ... }
  │   → Files stored in S3, attachment rows created (activityId = NULL)
  │
  └─ POST /requests/:id/activities  { message, isInternal }
      → Backend creates activity
      → Backend auto-links: UPDATE request_attachments
        SET activityId = activity.id
        WHERE requestId = ? AND activityId IS NULL AND uploadedById = ?
      → Backend returns activity WITH included attachments
      → Frontend appends to activities list (attachments render inline)
```

---

## Phase 1: Backend — Link Attachments to Activities

**File:** `backend/src/controllers/request.controller.ts`

### 1.1 Modify `addActivity` to auto-link attachments

After creating the activity, update all unlinked attachments for this request by the current user:

```ts
// After prisma.requestActivity.create(...)
await prisma.requestAttachment.updateMany({
  where: {
    requestId: id,
    activityId: null,
    uploadedById: req.user!.id,
    deletedAt: null,
  },
  data: {
    activityId: activity.id,
  },
});

// Then fetch the activity with attachments included
const fullActivity = await prisma.requestActivity.findUnique({
  where: { id: activity.id },
  include: { attachments: { where: { deletedAt: null } } },
});

// Transform BigInt fileSize to string for JSON serialization
const serializedAttachments = fullActivity!.attachments.map(a => ({
  ...a,
  fileSize: a.fileSize.toString(),
}));

res.status(201).json({
  status: 'success',
  data: {
    activity: {
      ...fullActivity!,
      attachments: serializedAttachments,
    },
  },
});
```

### 1.2 Modify `getRequestActivities` to include attachments

```ts
const activities = await prisma.requestActivity.findMany({
  where: { requestId: id },
  orderBy: { createdAt: 'asc' },
  include: { attachments: { where: { deletedAt: null } } },
});

// Transform BigInt fileSize in attachments
const transformed = activities.map(a => ({
  ...a,
  attachments: a.attachments.map(att => ({
    ...att,
    fileSize: att.fileSize.toString(),
  })),
}));
```

### 1.3 Modify `getRequestDetail` activities include

In the `getRequestDetail` method, update the activities include to also include attachments:

```ts
activities: {
  orderBy: { createdAt: 'asc' },
  include: { attachments: { where: { deletedAt: null } } },
},
```

Also add BigInt-to-string transformation for the attachments in the response serialization section.

### 1.4 Modify `uploadAttachment` response to include activityId info

No change needed — the current response already returns all attachment fields. The `activityId` will be NULL at upload time and later set by `addActivity`.

---

## Phase 2: Frontend — Attachment Upload UX in ActivityFeed

**Files:** `frontend/src/components/request-detail/ActivityFeed.tsx`, `frontend/src/services/request.service.ts`

### 2.1 Add `requestId` prop to ActivityFeed

Currently ActivityFeed doesn't know the request ID. Add it as a required prop:

```ts
interface ActivityFeedProps {
  requestId: string;  // NEW
  activities: Activity[];
  onSubmitComment: (text: string, isInternal: boolean) => Promise<void>;
  canPostInternal: boolean;
  currentUser?: { firstName: string; lastName: string } | null;
}
```

Pass it from `RequestDetail.tsx`:

```tsx
<ActivityFeed
  requestId={request.id}
  activities={activities}
  ...
/>
```

### 2.2 Add file input button + drag-drop zone

- Paperclip icon button next to the "Send Reply" button
- `accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"` matching backend MIME allowlist
- Drag-drop zone wrapping the entire reply area (visual highlight on dragover)
- Max 5 files per comment (matching backend `multer` config `files: 5`)

### 2.3 Add clipboard paste handler on textarea

```tsx
onPaste={(e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) addPendingFile(file);
    }
  }
}}
```

### 2.4 Pending files state & preview grid

```tsx
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
```

Show thumbnail grid below textarea:
- Images: show actual thumbnail preview
- Other files: show file icon + name + size
- Each has an X button to remove from pending list

### 2.5 Upload-on-submit flow

On form submit:
1. Set `uploadingFiles = true`, disable submit button
2. Upload all pending files in parallel via `requestService.uploadAttachment(requestId, file)`
3. Once all uploads complete, call `onSubmitComment(commentText, isInternal)`
4. Backend `addActivity` auto-links the uploaded attachments
5. Clear pending files state, set `uploadingFiles = false`
6. If any upload fails, show error toast but allow submitting the text comment without attachments

### 2.6 No changes needed to `request.service.ts`

`uploadAttachment`, `downloadAttachment`, and `addActivity` already exist with correct signatures.

---

## Phase 3: Frontend — Render Attachments in Activity Feed

**File:** `frontend/src/components/request-detail/ActivityFeed.tsx`

### 3.1 Extend `Activity` interface

```ts
interface Attachment {
  id: string;
  fileName: string;
  storageUrl: string;
  mimeType: string;
  fileSize: string;  // BigInt serialized as string
}

interface Activity {
  id: string;
  activityType: string;
  message: string;
  authorName: string;
  authorRole: string | null;
  isSystemGenerated: boolean;
  isInternal: boolean;
  createdAt: string;
  attachments?: Attachment[];  // NEW
}
```

### 3.2 Image preview rendering

If `mimeType.startsWith('image/')`, render as `<img>` thumbnail:
- Fixed size ~120px, `object-cover`, rounded corners
- Click to open full-size in new tab via presigned download URL
- Lazy loading for performance

### 3.3 File download rendering

For non-image files, render as a compact file card:
- File type icon (PDF, DOC, XLS, ZIP, etc.)
- File name (truncated if long)
- File size in human-readable format (e.g., "2.4 MB", "156 KB")
- Click triggers download via `requestService.downloadAttachment`

### 3.4 Attachment grid layout

Below each comment's message text, render a responsive grid:
- Images: 2-3 columns of thumbnails
- Mixed: images get thumbnails, files get compact cards
- Gap between items, rounded corners, subtle border

### 3.5 Human-readable file size helper

```ts
function formatFileSize(bytes: number | string): string {
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
```

---

## Phase 4: Polish & Edge Cases

### 4.1 Requester permission check

- Verify `uploadAttachment` endpoint allows requesters to upload on their own requests
- Check the auth middleware on `POST /:id/attachments` — currently uses `requireAuth` only, no role restriction
- Confirm requesters can see attachments on their own comments

### 4.2 Internal comment attachments

- When `isInternal=true`, attachments should be hidden from requesters
- **Approach:** Filter attachments based on parent activity's `isInternal` flag
- In `getRequestActivities` response, for non-agent/admin users, exclude attachments from internal activities
- In frontend, `ActivityFeed` already hides internal activities from non-agents, so attachments ride along

### 4.3 Optimistic attachment rendering

- After successful upload+comment, show attachments immediately in the activity list
- Use the activity object returned from `addActivity` (which now includes attachments)
- Update parent `activities` state with the full activity including attachments

### 4.4 Upload error handling

- If an upload fails, show error toast with file name
- Remove the failed file from pending list
- Allow the user to submit the comment text without the failed attachment
- Never block the text comment submission due to an attachment failure

### 4.5 Delete attachment from comment

- Add small X button on each attachment thumbnail (visible only to the comment author and admins)
- Call `requestService.deleteAttachment(requestId, attachmentId)` on click
- Optimistically remove from UI, revert on failure
- The `DELETE /:id/attachments/:attachmentId` endpoint already exists with soft delete

---

## File Change Summary

| File | Type | Changes |
|---|---|---|
| `backend/src/controllers/request.controller.ts` | Modify | `addActivity`: auto-link attachments, include in response. `getRequestActivities`: include attachments. `getRequestDetail`: include attachments in activities. |
| `frontend/src/components/request-detail/ActivityFeed.tsx` | Major | Add `requestId` prop, file picker, drag-drop, paste handler, upload flow, attachment grid rendering. |
| `frontend/pages/RequestDetail.tsx` | Minor | Pass `requestId` prop to ActivityFeed. Update `onSubmitComment` to return activity with attachments. |

## What's NOT in Scope

- New DB migration (the `activityId` column already exists on `RequestAttachment`)
- New API endpoints (upload/download/delete already exist)
- New Prisma model changes
- Virus scanning (already stubbed with `isScanned: false`)
- Rich text editor for comments (separate feature)
- Notification badge for new comments (on hold per user request)

---

## Implementation Order

1. **Phase 1** (Backend) — Foundation, must be done first so frontend has data
2. **Phase 2** (Upload UX) — Depends on Phase 1 for linking
3. **Phase 3** (Rendering) — Depends on Phase 2 for data, but can be done in parallel with Phase 2
4. **Phase 4** (Polish) — After core flow works end-to-end