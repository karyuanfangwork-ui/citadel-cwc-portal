# Implementation Plan: Batch Upload Modal + Candidate Model + Doc Completeness Enforcement

**Target:** Replace the one-by-one upload modal with a batch upload experience and enforce that every candidate must have all 3 doc types (Resume, Certificate, Transcript) before routing to Hiring Manager.

---

## Phase 1 — Database Schema (Candidate Model + Unique Constraint)

### 1.1 Create `Candidate` model in Prisma schema

**File:** `backend/prisma/schema.prisma`

Add a new model above `CandidateResume`:

```prisma
model Candidate {
  id        String   @id @default(uuid()) @db.Uuid
  requestId String   @map("request_id") @db.Uuid
  fullName  String   @map("full_name") @db.VarChar(200)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  request   Request           @relation(fields: [requestId], references: [id], onDelete: Cascade)
  documents CandidateResume[]

  @@unique([requestId, fullName], name: "unique_candidate_per_request")
  @@index([requestId])
  @@map("candidates")
}
```

### 1.2 Update `CandidateResume` model

**File:** `backend/prisma/schema.prisma` — modify the existing model:

- Add `candidateId String @map("candidate_id") @db.Uuid` field
- Add `candidate Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)` relation
- Keep `candidateName` as optional for backward compat (denormalized display cache), but add unique constraint:

```prisma
model CandidateResume {
  id            String   @id @default(uuid()) @db.Uuid
  requestId     String   @map("request_id") @db.Uuid
  candidateId   String   @map("candidate_id") @db.Uuid
  fileName      String   @map("file_name") @db.VarChar(255)
  fileUrl       String   @map("file_url") @db.Text
  fileSize      BigInt   @map("file_size")
  mimeType      String?  @map("mime_type") @db.VarChar(100)
  uploadedById  String   @map("uploaded_by_id") @db.Uuid
  candidateName String?  @map("candidate_name") @db.VarChar(200) // kept for denormalized display
  documentType  String   @default("RESUME") @map("document_type") @db.VarChar(50)
  notes         String?  @db.Text
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  request            Request             @relation(fields: [requestId], references: [id], onDelete: Cascade)
  uploadedBy         User                @relation(fields: [uploadedById], references: [id])
  candidate          Candidate           @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  interviewSchedules InterviewSchedule[]
  interviewFeedbacks InterviewFeedback[]

  @@unique([candidateId, documentType], name: "unique_doc_type_per_candidate")
  @@index([requestId])
  @@map("candidate_resumes")
}
```

### 1.3 Update `Request` model

Add `candidates Candidate[]` relation alongside existing `candidateResumes CandidateResume[]`.

### 1.4 Update `InterviewSchedule` + `InterviewFeedback`

These currently reference `CandidateResume.id` via `candidateId`. They should reference `Candidate.id` instead (a schedule/feedback is for a candidate, not for a document):

```prisma
model InterviewSchedule {
  // Change:
  candidateId String  @map("candidate_id") @db.Uuid
  candidateResume CandidateResume @relation(...)  // REMOVE this

  // To:
  candidateId String   @map("candidate_id") @db.Uuid
  candidate   Candidate @relation(fields: [candidateId], references: [id])
}

model InterviewFeedback {
  // Change:
  candidateId String? @map("candidate_id") @db.Uuid
  candidateResume CandidateResume? @relation(...)  // REMOVE this

  // To:
  candidateId String?  @map("candidate_id") @db.Uuid
  candidate   Candidate? @relation(fields: [candidateId], references: [id])
}
```

### 1.5 Migration

> ⚠️ **Do NOT use `npx prisma db push` for this migration.** Adding a NOT NULL foreign key column to `candidate_resumes` while rows already exist will fail — Prisma cannot perform the backfill step. Run the manual SQL below against both dev and production databases.

**Pre-flight check:** Before running, audit any rows with null `candidate_name` that share the same `request_id`. If multiple distinct candidates were uploaded without names they will be collapsed into a single "Unnamed Candidate" row, which may cause a `unique_doc_type_per_candidate` conflict. Clean these up manually first if needed:

```sql
SELECT request_id, COUNT(*) FROM candidate_resumes
WHERE candidate_name IS NULL GROUP BY request_id HAVING COUNT(*) > 3;
```

**Migration SQL (dev + production):**

```sql
-- 1. Create candidates table
CREATE TABLE candidates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  full_name  VARCHAR(200) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, full_name)
);
CREATE INDEX idx_candidates_request_id ON candidates(request_id);

-- 2. Add candidate_id to candidate_resumes (nullable first for migration)
ALTER TABLE candidate_resumes ADD COLUMN candidate_id UUID;

-- 3. Backfill: create Candidate rows from existing candidateName values
INSERT INTO candidates (id, request_id, full_name, created_at)
SELECT DISTINCT ON (request_id, candidate_name)
  gen_random_uuid(), request_id, COALESCE(candidate_name, 'Unnamed Candidate'), NOW()
FROM candidate_resumes;

-- 4. Backfill candidate_id on candidate_resumes
UPDATE candidate_resumes cr
SET candidate_id = c.id
FROM candidates c
WHERE cr.request_id = c.request_id
  AND COALESCE(cr.candidate_name, 'Unnamed Candidate') = c.full_name;

-- 5. Make candidate_id NOT NULL + add FK + unique constraint
ALTER TABLE candidate_resumes ALTER COLUMN candidate_id SET NOT NULL;
ALTER TABLE candidate_resumes
  ADD CONSTRAINT fk_resume_candidate
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE candidate_resumes
  ADD CONSTRAINT unique_doc_type_per_candidate
  UNIQUE (candidate_id, document_type);

-- 6. Remap interview_schedules.candidate_id from CandidateResume.id → Candidate.id
ALTER TABLE interview_schedules DROP CONSTRAINT IF EXISTS interview_schedules_candidate_id_fkey;
UPDATE interview_schedules is_
SET candidate_id = c.id
FROM candidate_resumes cr
JOIN candidates c ON c.request_id = cr.request_id
  AND COALESCE(cr.candidate_name, 'Unnamed Candidate') = c.full_name
WHERE is_.candidate_id = cr.id;
ALTER TABLE interview_schedules
  ADD CONSTRAINT fk_schedule_candidate
  FOREIGN KEY (candidate_id) REFERENCES candidates(id);

-- 7. Remap interview_feedbacks.candidate_id from CandidateResume.id → Candidate.id
ALTER TABLE interview_feedbacks DROP CONSTRAINT IF EXISTS interview_feedbacks_candidate_id_fkey;
UPDATE interview_feedbacks if_
SET candidate_id = c.id
FROM candidate_resumes cr
JOIN candidates c ON c.request_id = cr.request_id
  AND COALESCE(cr.candidate_name, 'Unnamed Candidate') = c.full_name
WHERE if_.candidate_id = cr.id;
ALTER TABLE interview_feedbacks
  ADD CONSTRAINT fk_feedback_candidate
  FOREIGN KEY (candidate_id) REFERENCES candidates(id);
```

**After migration**, run `npx prisma generate` to regenerate the Prisma client from the updated schema.

---

## Phase 2 — Backend API Changes

### 2.1 New batch upload endpoint

**File:** `backend/src/controllers/resume.controller.ts`

Add `batchUploadDocs` controller:

```typescript
export const batchUploadDocs = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const candidateName = req.body.candidateName?.trim();
  const notes = req.body.notes || null;

  // files comes as req.files (array from multer array)
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  // Validate request exists and is in JOB_POSTED status
  const request = await prisma.request.findUnique({
    where: { id },
    include: { candidates: true },
  });
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.status !== 'JOB_POSTED') {
    return res.status(400).json({ message: 'Can only upload documents when request is JOB_POSTED' });
  }

  // Parse docTypes from form fields: docTypes is JSON array like ['RESUME','CERTIFICATE']
  let docTypes: string[] = [];
  try {
    docTypes = JSON.parse(req.body.docTypes || '[]');
  } catch { /* fallthrough */ }
  if (docTypes.length !== files.length) {
    return res.status(400).json({ message: `Expected ${files.length} docTypes, got ${docTypes.length}` });
  }

  // Validate docTypes
  const validTypes = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'];
  for (const dt of docTypes) {
    if (!validTypes.includes(dt)) {
      return res.status(400).json({ message: `Invalid document type: ${dt}` });
    }
  }

  // Find or create Candidate
  const candidate = await prisma.candidate.upsert({
    where: { requestId_fullName: { requestId: id, fullName: candidateName || 'Unnamed Candidate' } },
    create: { requestId: id, fullName: candidateName || 'Unnamed Candidate' },
    update: {},
  });

  // Check for duplicate doc types
  const existingDocs = await prisma.candidateResume.findMany({
    where: { candidateId: candidate.id },
    select: { documentType: true },
  });
  const existingTypes = new Set(existingDocs.map(d => d.documentType));
  const duplicates = docTypes.filter(dt => existingTypes.has(dt));
  if (duplicates.length > 0) {
    return res.status(409).json({
      message: `Document types already exist for this candidate: ${duplicates.join(', ')}`,
      existingTypes: [...existingTypes],
    });
  }

  // Create all CandidateResume records in a transaction
  const results = await prisma.$transaction(
    files.map((file, i) =>
      prisma.candidateResume.create({
        data: {
          requestId: id,
          candidateId: candidate.id,
          candidateName: candidate.fullName,
          fileName: file.originalname,
          fileUrl: file.key, // S3 key from multer-s3
          fileSize: BigInt(file.size),
          mimeType: file.mimetype,
          uploadedById: userId,
          documentType: docTypes[i],
          notes,
        },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      })
    )
  );

  // Activity log
  await prisma.requestActivity.create({
    data: {
      requestId: id,
      authorId: userId,
      authorName: `${(req as any).user?.firstName} ${(req as any).user?.lastName}`,
      authorRole: 'HR Agent',
      activityType: 'DOCUMENT_UPLOADED',
      message: `${files.length} documents uploaded for candidate "${candidate.fullName}" (${docTypes.join(', ')})`,
      isSystemGenerated: true,
    },
  });

  // Serialize BigInt
  const serialized = results.map(r => ({ ...r, fileSize: r.fileSize.toString() }));
  res.status(201).json({ data: serialized });
};
```

### 2.2 Add single-doc convenience endpoint (keep for individual re-upload)

Keep existing `uploadResume` but modify to use `candidateId` instead of `candidateName`:

- Accept `candidateId` (existing candidate) or `candidateName` (new candidate) in body
- Upsert `Candidate` row when creating
- Enforce unique `documentType` per `candidateId`
- Return 409 if doc type already exists for this candidate

### 2.3 Update `getResumes` to include `candidateId`

**File:** `backend/src/controllers/resume.controller.ts`

```typescript
// In getResumes, update the Prisma query:
include: {
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
  candidate: { select: { id: true, fullName: true } },  // ADD
}
```

### 2.4 Update `deleteResume` to also handle Candidate cleanup

When deleting the last document for a candidate, also delete the Candidate row (or keep it orphaned — prefer keeping it so the candidate slot persists with "Not uploaded" placeholders).

### 2.5 Update `routeToManager` — enforce 3-doc completeness

**File:** `backend/src/controllers/approval.controller.ts`, lines 438-444

Replace the current check with:

```typescript
const candidates = await prisma.candidate.findMany({
  where: { requestId: id },
  include: { documents: true },
});

if (candidates.length === 0) {
  return res.status(400).json({
    status: 'error',
    message: 'At least one candidate must be uploaded before routing to manager',
  });
}

const missingDocs: string[] = [];
for (const cand of candidates) {
  const presentTypes = new Set(cand.documents.map(d => d.documentType));
  const missing = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'].filter(t => !presentTypes.has(t));
  if (missing.length > 0) {
    missingDocs.push(`${cand.fullName}: missing ${missing.join(', ')}`);
  }
}
if (missingDocs.length > 0) {
  return res.status(400).json({
    status: 'error',
    message: `All documents required before routing to manager: ${missingDocs.join('; ')}`,
  });
}
```

Also update the activity log message on line ~474 — it currently uses `candidateResumes.length`. Change it to use the `candidates` array fetched above:

```typescript
// Before:
`...${(request as any).candidateResumes.length} candidate(s) submitted.`

// After:
`...${candidates.length} candidate(s) submitted.`
```

### 2.6 Add `uploadMultipleFiles` to upload middleware + fix `upload` export

**File:** `backend/src/middleware/upload.middleware.ts` — append at the bottom:

```typescript
// Middleware factory for multiple file upload
export const uploadMultipleFiles = (fieldName: string, maxCount: number) =>
  uploader.array(fieldName, maxCount);
```

**File:** `backend/src/controllers/resume.controller.ts` — update the `upload` export (line 11):

```typescript
// Before:
export const upload = { single: (field: string) => uploadSingleFile(field) };

// After:
import { uploadSingleFile, uploadMultipleFiles } from '../middleware/upload.middleware';
export const upload = {
  single: (field: string) => uploadSingleFile(field),
  array: (field: string, maxCount: number) => uploadMultipleFiles(field, maxCount),
};
```

### 2.7 Add route for batch upload

**File:** `backend/src/routes/approval.routes.ts`

```typescript
// Add:
router.post(
  '/requests/:id/upload-candidate-docs',
  authenticate,
  authorizeRoles('ADMIN', 'AGENT'),
  upload.array('files', 5),  // max 5 files (3 doc types + buffer)
  resumeController.batchUploadDocs
);
```

### 2.8 Add Candidate CRUD endpoints + implement controllers

**File:** `backend/src/routes/approval.routes.ts`

```typescript
// List candidates for a request
router.get('/requests/:id/candidates', authenticate, resumeController.getCandidates);

// Delete a candidate (cascades to docs)
router.delete('/requests/:id/candidates/:candidateId', authenticate, authorizeRoles('ADMIN', 'AGENT'), resumeController.deleteCandidate);
```

**File:** `backend/src/controllers/resume.controller.ts` — add these two functions:

```typescript
export const getCandidates = async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const candidates = await prisma.candidate.findMany({
      where: { requestId: id },
      include: {
        documents: {
          select: { id: true, documentType: true, fileName: true, fileUrl: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: candidates });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch candidates' });
  }
};

export const deleteCandidate = async (req: Request, res: Response): Promise<any> => {
  const { id, candidateId } = req.params;
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, requestId: id },
    });
    if (!candidate) return res.status(404).json({ status: 'error', message: 'Candidate not found' });

    await prisma.candidate.delete({ where: { id: candidateId } }); // cascades to documents
    res.json({ status: 'success', message: 'Candidate deleted' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete candidate' });
  }
};
```

### 2.9 Update InterviewSchedule + InterviewFeedback references

**Files:** Interview schedule/feedback controllers need updating to reference `Candidate` instead of `CandidateResume`:

- When creating interview schedule: look up by `Candidate.id` instead of `CandidateResume.id`
- When displaying: use `candidate.fullName` instead of `candidateResume.candidateName`
- This is a search-and-replace across `interview.controller.ts` and `interview.service.ts`

---

## Phase 3 — Frontend API Service Layer

### 3.1 Update `CandidateResume` interface

**File:** `frontend/src/services/approval.service.ts`

```typescript
export interface CandidateResume {
  id: string;
  candidateId: string;         // NEW
  fileName: string;
  fileUrl: string;
  fileSize: string;
  mimeType: string | null;
  candidateName: string | null;
  documentType: string;        // was optional, now required
  notes: string | null;
  uploadedBy: { id: string; firstName: string; lastName: string; email: string };
  candidate?: { id: string; fullName: string };  // NEW
  createdAt: string;
}
```

### 3.2 Add batch upload API function

**File:** `frontend/src/services/approval.service.ts`

```typescript
export const batchUploadDocs = async (
  requestId: string,
  files: { file: File; documentType: string }[],
  candidateName: string,
  notes?: string
): Promise<ApiResponse<CandidateResume[]>> => {
  const formData = new FormData();
  files.forEach(({ file, documentType }) => {
    formData.append('files', file);
  });
  formData.append('docTypes', JSON.stringify(files.map(f => f.documentType)));
  formData.append('candidateName', candidateName);
  if (notes) formData.append('notes', notes);

  const response = await api.post(`/approvals/requests/${requestId}/upload-candidate-docs`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Also add a convenience for single uploads to existing candidate:
export const uploadDocToCandidate = async (
  requestId: string,
  candidateId: string,
  file: File,
  documentType: string,
  notes?: string
): Promise<ApiResponse<CandidateResume>> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  formData.append('candidateId', candidateId);
  if (notes) formData.append('notes', notes);

  const response = await api.post(`/approvals/requests/${requestId}/upload-resume`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
```

### 3.3 Add Candidate API functions

```typescript
export const getCandidates = async (requestId: string): Promise<ApiResponse<Candidate[]>> => {
  const response = await api.get(`/approvals/requests/${requestId}/candidates`);
  return response.data;
};

export const deleteCandidate = async (requestId: string, candidateId: string): Promise<ApiResponse<void>> => {
  const response = await api.delete(`/approvals/requests/${requestId}/candidates/${candidateId}`);
  return response.data;
};
```

---

## Phase 4 — Batch Upload Modal (New Component)

### 4.1 Create `BatchUploadModal.tsx`

**File:** `frontend/src/components/request-detail/BatchUploadModal.tsx`

**UI Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  📄 Upload Candidate Documents                                │
│  HR Workflow · Submit all required documents for a candidate   │
│────────────────────────────────────────────────────────────────│
│                                                                │
│  Candidate Name *                                              │
│  ┌────────────────────────────────────────────┐              │
│  │ [Existing ▼] or [New: ________________]    │              │
│  └────────────────────────────────────────────┘              │
│                                                                │
│  Required Documents (3/3 to proceed)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 📄 RESUME    │  │ 🏅 CERTS      │  │ 🎓 TRANSCRIPT │        │
│  │              │  │              │  │              │        │
│  │  ⬆ Drop or   │  │  ⬆ Drop or   │  │  ⬆ Drop or   │        │
│  │  click to    │  │  click to    │  │  click to    │        │
│  │  upload      │  │  upload      │  │  upload      │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                │
│  Notes (optional)                                              │
│  ┌────────────────────────────────────────────────┐          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
│                                                                │
│  ⚠ Upload all 3 document types before routing to manager      │
│                                                                │
│  ─────────────────────────────────────────────                 │
│  [ Cancel ]                          [ Upload 3 Documents ]    │
│                                     (disabled until all 3     │
│                                      files are attached)      │
└────────────────────────────────────────────────────────────────┘
```

**Key behaviors:**

1. **Three drop zones** side-by-side in a responsive grid, each for one doc type
2. **Each zone** accepts drag-and-drop or click-to-browse (single file per zone)
3. **File preview pill** in each zone once file is attached (filename, size, remove X button)
4. **Candidate name** — dropdown of existing candidates (from `getCandidates` API) OR free-text "New Candidate" toggle
5. **Submit button** disabled until all 3 files are attached — shows "Upload 3 Documents" with count
6. **On submit:** calls `batchUploadDocs()` — single API call sends all 3 files
7. **On success:** closes modal, calls `onDocsChanged()` to refresh HiringWorkflowPanel
8. **On 409 conflict:** shows per-slot error "Certificate already exists for this candidate" with option to replace
9. **Notes field** applies to all docs in the batch (or remove entirely, since notes per-slot is better for the future)

### 4.2 Existing candidate name dropdown

When the modal opens for a request that already has candidates:
- Show a segmented toggle: "Existing Candidate" / "New Candidate"
- If "Existing": show `<select>` with candidate names from `getCandidates()`
- If "New": show text input
- This replaces the current free-text-only approach and eliminates typo-based duplicates

### 4.3 Drag-and-drop implementation

Use a lightweight approach (no new dependencies):

```typescript
const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

const handleDrop = (e: React.DragEvent, docType: string) => {
  e.preventDefault();
  setDragOverSlot(null);
  const file = e.dataTransfer.files[0];
  if (file) setFiles(prev => ({ ...prev, [docType]: file }));
};
```

Each zone also has a hidden `<input type="file">` for click-to-browse fallback.

---

## Phase 5 — Update HiringWorkflowPanel

### 5.1 Switch from free-text grouping to `candidateId`

**File:** `frontend/src/components/request/HiringWorkflowPanel.tsx`

**Current grouping (lines 120-125):**
```typescript
const groupedByCandidate = resumes.reduce<Record<string, CandidateResume[]>>((acc, resume) => {
  const key = resume.candidateName?.trim() || 'Unnamed Candidate';
  if (!acc[key]) acc[key] = [];
  acc[key].push(resume);
  return acc;
}, {});
```

**New grouping using candidateId:**
```typescript
// Get unique candidates from resumes
const candidates = useMemo(() => {
  const map = new Map<string, { id: string; name: string; docs: CandidateResume[] }>();
  for (const r of resumes) {
    const cid = r.candidateId;
    if (!map.has(cid)) {
      map.set(cid, { id: cid, name: r.candidate?.fullName || r.candidateName || 'Unnamed', docs: [] });
    }
    map.get(cid)!.docs.push(r);
  }
  return [...map.values()];
}, [resumes]);
```

### 5.2 Show completeness warning per candidate

For each candidate card, if `docs.length < 3` or any doc type is missing, show a warning:

```tsx
const missingTypes = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'].filter(
  t => !docsByType[t]
);
{missingTypes.length > 0 && (
  <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
    ⚠ Missing: {missingTypes.map(t => DOC_TYPE_CONFIG[t].label).join(', ')}
  </div>
)}
```

### 5.3 Gate "Route to Hiring Manager" button

The button should only be enabled when ALL candidates have all 3 doc types:

```typescript
const allCandidatesComplete = candidates.every(c => {
  const docTypes = new Set(c.docs.map(d => d.documentType));
  return ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'].every(t => docTypes.has(t));
});

// Pass this to the action button:
<button disabled={!allCandidatesComplete} ... >
```

### 5.4 Fix hardcoded localhost URLs

There are **3 occurrences** in `HiringWorkflowPanel.tsx` — all must be fixed:

- **Line 250** — candidate document download
- **Line 574** — LOA file download
- **Line 603** — signed LOA file download

```diff
- href={`http://localhost:3000/api/v1/files/download/${doc.fileUrl}`}
+ href={`${import.meta.env.VITE_API_URL || '/api/v1'}/files/download/${doc.fileUrl}`}

- href={`http://localhost:3000/api/v1/files/download/${loaDetails.loaFileUrl}`}
+ href={`${import.meta.env.VITE_API_URL || '/api/v1'}/files/download/${loaDetails.loaFileUrl}`}

- href={`http://localhost:3000/api/v1/files/download/${loaDetails.signedLoaFileUrl}`}
+ href={`${import.meta.env.VITE_API_URL || '/api/v1'}/files/download/${loaDetails.signedLoaFileUrl}`}
```

### 5.5 "Add Documents" button opens BatchUploadModal

Replace `UploadResumeModal` trigger with `BatchUploadModal`. The upload-button on each candidate card should pre-fill the candidate name and open the batch modal (not the old single-file modal).

---

## Phase 6 — Update Interview Flow References

### 6.1 InterviewSchedule + InterviewFeedback

**Files to update:**
- `backend/src/controllers/interview.controller.ts`
- `frontend/src/components/request/modals/InterviewScheduleModal.tsx`
- `frontend/src/components/request/modals/ManagerDecisionModal.tsx`
- `frontend/src/components/request/HiringWorkflowPanel.tsx`

**Changes:**
- When scheduling an interview, `candidateId` now references `Candidate.id` instead of `CandidateResume.id`
- When displaying candidate name in interview context, use `candidate.fullName` instead of `candidateResume.candidateName`
- The candidate dropdown in ManagerDecisionModal should list `Candidate` records, not derive names from `CandidateResume` records

---

## Phase 7 — Testing

### 7.1 Backend unit tests

**File:** `backend/src/__tests__/resume.controller.test.ts`

- Test `batchUploadDocs` with 3 files and valid docTypes → 201 with all 3 records
- Test `batchUploadDocs` with duplicate docType → 409 conflict
- Test `batchUploadDocs` with wrong number of docTypes vs files → 400
- Test `routeToManager` with incomplete docs → 400 with missing type names
- Test `routeToManager` with all 3 docs per candidate → 200
- Test duplicate candidate name creation → upsert returns existing
- Test delete candidate cascades to documents

### 7.2 Frontend integration tests

- BatchUploadModal: attach 3 files, submit, verify success callback
- BatchUploadModal: submit with 2/3 files → button disabled
- HiringWorkflowPanel: shows warning per incomplete candidate
- Route-to-manager button disabled when docs incomplete
- Drag-and-drop file into correct zone
- Existing candidate dropdown populates from API

### 7.3 Manual smoke test

1. Create HR hiring request → status JOB_POSTED
2. Open batch upload modal → enter new candidate name → drag 3 files → upload
3. Verify 3 docs appear in HiringWorkflowPanel under one candidate card
4. Verify "Route to Hiring Manager" is enabled
5. Try routing with only 2 docs → verify 400 error with missing types listed
6. Open slot for existing candidate → verify pre-fills name
7. Delete one doc → verify red warning badge appears
8. Re-upload the missing doc type → verify green checkmark returns

---

## Implementation Order (Priority Sequence)

| Step | What | Depends On | Est. Effort |
|------|------|------------|-------------|
| 1 | Add `Candidate` model to Prisma schema + migrate | — | 1 day |
| 2 | Backend: `batchUploadDocs` controller + route | Step 1 | 1 day |
| 3 | Backend: Update `uploadResume` to use `candidateId`, add `getCandidates`, `deleteCandidate` | Step 1 | 0.5 day |
| 4 | Backend: Update `routeToManager` completeness validation | Step 1 | 0.5 day |
| 5 | Frontend: `batchUploadDocs` API function + `getCandidates` | Steps 2-3 | 0.5 day |
| 6 | Frontend: `BatchUploadModal.tsx` (3-zone drag-and-drop) | Step 5 | 2 days |
| 7 | Frontend: Update `HiringWorkflowPanel` (candidateId grouping, warnings, URL fix) | Steps 5-6 | 1 day |
| 8 | Frontend: Gate "Route to Manager" on completeness check | Steps 4, 7 | 0.5 day |
| 9 | Frontend: Update `InterviewSchedule` + `ManagerDecisionModal` to use Candidate model | Step 1 | 1 day |
| 10 | Backend: Update interview controllers for Candidate model | Step 1 | 0.5 day |
| 11 | Testing: unit + integration + manual smoke | Steps 1-10 | 1.5 days |
| **Total** | | | **~9.5 days** |

---

## Risk & Considerations

1. **Data migration:** Existing `candidate_resumes` rows with null `candidateName` need handling. The migration script creates `Candidate` rows from distinct `candidateName` values and backfills `candidateId`. Any rows with `candidateName = null` get grouped under "Unnamed Candidate".

2. **InterviewSchedule / InterviewFeedback FK change:** Changing `candidateId` from referencing `CandidateResume` → `Candidate` is a breaking schema change. All existing rows must be migrated. Since `InterviewSchedule.candidateId` currently points to a `CandidateResume.id` (UUID), each needs to be updated to point to the corresponding `Candidate.id`. The migration SQL handles this with a JOIN.

3. **Backward compatibility:** Keep `candidateName` on `CandidateResume` as a denormalized display field so existing code that reads it doesn't break immediately. Remove it in a later sprint.

4. **Multer array upload:** The current `uploadSingleFile` uses `multer.single('file')`. The batch endpoint needs `upload.array('files', 5)`. This requires a new middleware entry in ` upload.middleware.ts`.

5. **S3 upload:** With `multer-s3` and `upload.array()`, all files are uploaded to S3 before the controller runs. If validation fails (e.g., duplicate doc types), files are already in S3 and won't be cleaned up. Consider adding a cleanup function for failed batch uploads, or validate first (check for duplicates), then upload.

6. **Frontend drag-and-drop:** Need to handle `e.preventDefault()` on `onDragOver` to prevent browser from opening the file. Also need visual feedback on the drop zone (border color change, background color).

7. **Progress indicator:** For the batch upload, consider showing upload progress per file or at minimum a "Uploading 3 documents..." spinner. Can be added as a stretch goal.