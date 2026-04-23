# T-001: Decompose RequestDetail.tsx

> Breaking `frontend/pages/RequestDetail.tsx` (2,395 LOC) into focused sub-components.
> Ref: `IMPLEMENTATION_PLAN.md` § T-001

**Last Updated:** April 22, 2026
**Status:** Not started

---

## Guiding Rule

`RequestDetail` remains the **single data owner**. All sub-components receive data via props and emit callbacks. No new context or global state introduced.

---

## Step 1 — `RequestHeader.tsx`

**Source lines:** ~L991–1044 (breadcrumb nav + status progress stepper + ActionBanner)

**Output path:** `frontend/src/components/request/RequestHeader.tsx`

**Props:**
```ts
interface RequestHeaderProps {
  request: Request;
  steps: Step[];
  statusTimestamps: Record<string, string>;
  currentRole: string;
  onActionClick: () => void;
}
```

---

## Step 2 — `RequestFormFields.tsx`

**Source lines:** ~L1133–1220 (Request Summary card + Structured Custom Fields grid)

**Output path:** `frontend/src/components/request/RequestFormFields.tsx`

**Props:**
```ts
interface RequestFormFieldsProps {
  request: Request;
}
```

---

## Step 3 — `RequestAttachments.tsx`

**Source lines:** ~L1438–1522 (LOA Documents — draft LOA, signed LOA, approval comments)

**Output path:** `frontend/src/components/request/RequestAttachments.tsx`

**Props:**
```ts
interface RequestAttachmentsProps {
  loaDetails: LetterOfAcceptance | null;
  request: Request;
  onUploadSignedLOA: (file: File) => Promise<void>;
}
```

---

## Step 4 — `HiringWorkflowPanel.tsx`

**Source lines:** ~L1157–1522 (Resumes, Interview Details, HR Screening Details, LOA Documents — entire hiring-specific middle section)

**Output path:** `frontend/src/components/request/HiringWorkflowPanel.tsx`

**Props:**
```ts
interface HiringWorkflowPanelProps {
  request: Request;
  resumes: CandidateResume[];
  interviewDetails: InterviewDetails | null;
  screeningDetails: HRScreening | null;
  loaDetails: LetterOfAcceptance | null;
  uploadingResume: boolean;
  onUploadResume: (file: File, name: string, notes: string) => Promise<void>;
  onDeleteResume: (id: string) => Promise<void>;
  onUploadSignedLOA: (file: File) => Promise<void>;
}
```

---

## Step 5 — `ApprovalActions.tsx`

**Source lines:** ~L1690–1842 (status dropdown + all hiring-workflow action buttons in sidebar)

**Output path:** `frontend/src/components/request/ApprovalActions.tsx`

**Props:**
```ts
interface ApprovalActionsProps {
  request: Request;
  user: AuthUser;
  currentRole: string;
  loaDetails: LetterOfAcceptance | null;
  screeningDetails: HRScreening | null;
  processingAction: boolean;
  updatingStatus: boolean;
  onStatusChange: (status: string) => void;
  onRouteToCEO: () => void;
  onRouteToManager: () => void;
  onShowModal: (modal: ModalName) => void;
  onMarkLOAIssued: () => void;
  onMarkLOAAccepted: () => void;
  onAdvanceOnboarding: () => void;
  onCompleteOnboarding: () => void;
  onAdvanceOffboarding: () => void;
  onCompleteOffboarding: () => void;
}
```

---

## Step 6 — `SlaBadge.tsx`

**Source lines:** SLA countdown/breach display in sidebar (search `slaBreached` / `slaDeadline`)

**Output path:** `frontend/src/components/request/SlaBadge.tsx`

**Props:**
```ts
interface SlaBadgeProps {
  slaDeadline: string | null;
  slaBreached: boolean;
  resolutionTime: number | null;
}
```

---

## Step 7 — Modals → `frontend/src/components/request/modals/`

Move inline modal JSX into dedicated files:

| File | Source lines |
|------|-------------|
| `ResolutionModal.tsx` | ~L1843–1944 |
| `RejectionConfirmModal.tsx` | ~L1945–2007 |
| `CompleteOnboardingModal.tsx` | ~L2008–2065 |

> CEO/Manager/Interview/LOA modals already live in `src/components/` — no change needed.

---

## Step 8 — `StatusTimeline.tsx`

**Source lines:** Activity log rendering inside the right-column sidebar

**Output path:** `frontend/src/components/request/StatusTimeline.tsx`

**Props:**
```ts
interface StatusTimelineProps {
  activities: Activity[];
  request: Request;
  user: AuthUser;
  onCommentSubmit: (comment: string) => Promise<void>;
}
```

---

## Execution Order

| Order | Step | Component | Risk | Effort |
|:-----:|------|-----------|:----:|:------:|
| 1 | Step 1 | `RequestHeader` | Low — pure display | S |
| 2 | Step 2 | `RequestFormFields` | Low — pure display | S |
| 3 | Step 6 | `SlaBadge` | Low — pure display | S |
| 4 | Step 7 | Modals | Low — inline JSX move | M |
| 5 | Step 8 | `StatusTimeline` | Medium — comment callback | M |
| 6 | Steps 3–4 | `HiringWorkflowPanel` + `RequestAttachments` | Medium — many props | M |
| 7 | Step 5 | `ApprovalActions` | High — most state callbacks | L |

Test in browser after each step. Parent `RequestDetail.tsx` should be under ~400 LOC after all steps complete.
