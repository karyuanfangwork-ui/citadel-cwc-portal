# Workflow Status Remap on Publish — Design

**Date:** 2026-08-05
**Status:** Approved
**Area:** Visual Workflow Designer (backend + frontend)

## Problem

Publishing a draft workflow version is blocked when the draft removes a status
that live requests still occupy. `validateLiveData()` in
`backend/src/services/workflowValidator.service.ts` emits a blocking
`STATUS_IN_USE_REMOVED` finding for each such status, and `publishVersion()`
re-runs the same check inside the publish transaction.

The check is correct — publishing without it would leave requests in a status
with no node and no transitions — but it offers no way forward. The admin must
leave the designer, hunt down each request, and move it by hand.

Observed instance: workflow type `a1fe4977-3da2-43b6-92c9-7402ba14d50c`
("Get IT Help Request" and two siblings). Draft v4 removed `ACTION_REQUIRED`
and `IN_REVIEW`; one request sits in each.

## Goal

When publishing would strand requests, the designer surfaces each stranded
status, suggests where those requests should go, and lets the admin confirm a
mapping that is applied atomically as part of the publish.

## Non-goals

- Background/asynchronous remapping. Publish stays atomic.
- Recalculating SLA clocks. See "SLA handling" below.
- Notifying requesters or assignees of a remap.
- Persisting the mapping as a reusable workflow-level configuration.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Suggestion source | Walk the ACTIVE version's outgoing edges | The suggestion is a hop the workflow already sanctions, so it is genuinely "nearest" rather than a guess |
| Side effects | `workflowHistory` + `activities` rows per request | Audit trail plus visibility on the request timeline |
| SLA clocks | Left untouched | Predictability; mismatches surfaced as a UI warning instead |
| Volume | Synchronous, with a configurable cap | Preserves publish atomicity; cap prevents a long transaction from locking the requests table |

## Data model

No migration. The mapping is a transient input to the publish call. The durable
record is the per-request `workflowHistory` and `activities` rows.

## Backend

### New service: `backend/src/services/statusRemap.service.ts`

#### `planStatusRemap({ workflowTypeId, draftGraph }, client) → RemapPlan`

Compares live occupancy against the draft's surviving status codes. Returns one
entry per stranded status:

```ts
interface RemapEntry {
  statusCode: string;
  requestCount: number;
  suggestedTarget: string | null;
  suggestionReason: string;
  allowedTargets: string[];
  sourcePausesSla: boolean;
}

interface RemapPlan {
  entries: RemapEntry[];
  totalRequests: number;
}
```

Occupancy is read the same way `validateLiveData()` reads it: resolve the
workflow type's request types, then `groupBy` status over their requests.

**Suggestion algorithm.** Load the currently-ACTIVE version's graph. Locate the
node whose `statusCode` matches the stranded status. Breadth-first over its
outgoing edges; the first node whose `statusCode` survives in the draft wins.
Depth 1 is preferred over depth 2, and ties at the same depth are broken by edge
display order, so the result is deterministic. Visited-set guards against cycles.
`suggestedTarget` is `null` when no surviving status is reachable.

`suggestionReason` carries provenance for the UI, e.g.
`"v3 allows ACTION_REQUIRED → IN_PROGRESS"`.

`allowedTargets` is every surviving status code in the draft.

#### `applyStatusRemap(tx, { requestTypeIds, remap, actorId }) → { movedCount }`

Runs inside the publish transaction, before the version swap. Per stranded
status: select the affected request ids, `updateMany` their status, then
`createMany` the corresponding `workflowHistory` and `activities` rows. History
records from-status, to-status, actor, and the reason
`workflow version publish remap`.

SLA columns (`slaPausedAt`, `slaDueAt`, `slaPauseDurationMs`) are not written.

### Validator changes: `workflowValidator.service.ts`

`ValidateGraphInput` gains an optional field:

```ts
statusRemap?: Record<string, string>;  // removed status code → target status code
```

A stranded status with a valid mapping no longer emits `STATUS_IN_USE_REMOVED`.
Four new blocking codes validate the mapping itself:

| Code | Fires when |
|---|---|
| `REMAP_TARGET_MISSING` | Target is not a status node in the draft graph |
| `REMAP_TARGET_NO_EXIT` | Target is non-final and has no outgoing edges — would strand the requests again |
| `REMAP_SELF` | Target equals the removed status |
| `REMAP_VOLUME_EXCEEDED` | Total remapped requests exceed `WORKFLOW_REMAP_MAX_REQUESTS` (default 1000) |

`REMAP_VOLUME_EXCEEDED` messaging tells the admin to drain requests manually
before retrying.

### Race behaviour

The mapping is keyed by status code, not request id. A request that enters a
doomed status between the admin previewing the plan and clicking Publish is
swept up automatically. The only late-breaking failure is a status becoming
occupied that has no mapping at all; the in-transaction re-validation catches
that and aborts the publish with 422, leaving the active version untouched.

### API

- `GET /api/v1/workflows/versions/:id` — detail response gains `remapPlan`,
  `null` when nothing is stranded.
- `POST /api/v1/workflows/versions/:id/publish` — request body gains optional
  `statusRemap: Record<string, string>`.

`rollbackToVersion()` is not given a remap path in this change. Rolling back to
an archived version that removes an occupied status remains blocked.

## Frontend

### Placement

The remap lives inside the Publish dialog, not the Validation panel. The panel
reports; publishing is where an irreversible decision about live requests is
made. Panel rows for `STATUS_IN_USE_REMOVED` gain a "Resolve on publish" hint so
the blocker reads as addressable rather than fatal.

### `PublishDialog` — two steps

Step 1 appears only when `remapPlan` has entries:

```
Publish workflow v4                                    Step 1 of 2
─────────────────────────────────────────────────────────────────
2 statuses are being removed but still hold live requests.
Choose where those requests should go.

  ACTION_REQUIRED          1 request
  Move to  [ IN_PROGRESS          ▾ ]
  Suggested — v3 allows ACTION_REQUIRED → IN_PROGRESS
  ⚠ ACTION_REQUIRED pauses SLA, IN_PROGRESS does not.
    Clocks are left untouched — this request's SLA will stay paused.

  IN_REVIEW                1 request
  Move to  [ IN_PROGRESS          ▾ ]
  Suggested — v3 allows IN_REVIEW → IN_PROGRESS

                                        [ Cancel ]  [ Continue ]
```

Dropdowns are pre-filled with `suggestedTarget` and list every entry in
`allowedTargets`. Final statuses are grouped under a "Closes the request"
heading to prevent force-resolving a live ticket by misclick. Where
`suggestedTarget` is `null` the dropdown starts empty and Continue is disabled
until a target is chosen.

**SLA mismatch warning.** When the source status's `pauseSla` flag differs from
the chosen target's, the row shows a non-blocking warning explaining that clocks
are not adjusted and what the consequence is. The admin may pick a matching
target or proceed knowingly.

Step 2 is the existing dialog plus a summary line ("2 requests will be moved
when you publish") and a second confirmation checkbox. Both the warnings
checkbox and the remap checkbox must be ticked to enable Publish.

When `remapPlan` is empty, step 1 is skipped and the dialog behaves exactly as
it does today.

### State

`useWorkflowGraph` holds `remapPlan` (from the detail fetch) alongside the
existing validation state, plus `remapSelections: Record<string, string>` seeded
from the suggestions. Selections are passed to `publishVersion()` in
`frontend/src/services/workflow-version.service.ts`.

If the server rejects with a remap validation error, the dialog returns to step 1
with the offending row flagged rather than closing back to the canvas.

## Testing

**Backend**
- `planStatusRemap`: suggestion at depth 1; suggestion at depth 2 when depth 1 is
  also removed; `null` when no surviving successor exists; cycle in the old graph
  terminates; deterministic tie-breaking.
- Validator: one test per new blocking code; a mapped status no longer emits
  `STATUS_IN_USE_REMOVED`; an unmapped stranded status still does.
- `publishVersion` integration: requests move, `workflowHistory` and `activities`
  rows are written, SLA columns are unchanged, and a failure mid-remap rolls back
  the version swap.

**Frontend**
- `PublishDialog`: two-step flow with a non-empty plan; step 1 skipped when the
  plan is empty; Continue disabled until every entry has a target; SLA mismatch
  warning renders on flag divergence; server rejection returns to step 1.

## Verification against the observed instance

After implementation, publishing v4 of workflow type
`a1fe4977-3da2-43b6-92c9-7402ba14d50c` should offer `IN_PROGRESS` for both
`ACTION_REQUIRED` (1 request, `IT-00020`) and `IN_REVIEW` (1 request,
`IT-00001`), and on confirmation move both, write four audit rows, and activate
v4 in a single transaction.
