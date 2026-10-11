# Agent dashboard data invariants

## Verified lifecycle evidence

- The legacy request pause path stores `slaPausedAt`. `resumeSla()` extends the persisted `slaDueAt` by the just-completed pause and also increments `slaPauseDurationMs` (`backend/src/services/sla-pause.service.ts`). The versioned workflow command performs the same paired mutation (`backend/src/services/workflowCommand.service.ts`). Repeated pause/resume cycles therefore already extend the persisted deadline cumulatively.
- `getEffectiveSlaDueAt()` previously added the cumulative `slaPauseDurationMs` to that already-extended `slaDueAt`, double-applying completed pauses. It now trusts the persisted deadline and adds only the currently-open pause interval. Regression coverage checks completed and current pause behavior in `backend/src/services/__tests__/sla-pause.service.test.ts`.
- Legacy pause state is attached to request workflow transitions (`backend/src/services/requestTransition.service.ts`), not to the durable `SlaClock` lifecycle. Durable clock pause/resume helpers in `backend/src/queues/timer.queue.ts` update `SlaClock` and `SlaPauseLedger`, but `startSlaClock()` has no production caller found outside its own module and timer integration tests. The durable clock path therefore cannot be assumed to cover all existing dashboard requests.
- Legacy completion/reopen paths are not shown to finalize/restart a matching durable resolution clock consistently. For dashboard history, a closed request without reliable completed-clock evidence must classify as UNKNOWN; do not reconstruct a historical outcome from today's deadline.
- Pause status is derived from workflow step configuration and stored in the request’s `slaPausedAt`; existing code can auto-resume stale pauses after `SLA_MAX_PAUSE_DAYS` (default 14), which means the dashboard must treat the persisted current pause state as authoritative rather than infer it from status alone.

## Visibility predicate

`buildRequestListScope(principal)` is now the shared request-list predicate. It combines the policy service’s tenant/ownership/assignee/team/participant/executive visibility, the existing confidential-request exceptions (owner, assignee, designated approver, participant, or explicit confidential permission; admins included), and `deletedAt: null`. `getAllRequests()` uses this helper. Dashboard aggregates, options, rows, and attention must all apply it before dashboard-specific scope and filters.

## Constraints for implementation

- Do not treat absence of a durable resolution clock as evidence of a successful SLA outcome.
- Prefer a single current RESOLUTION clock only when the selection is unambiguous; duplicate/current-clock ambiguity or invalid timestamps classify UNKNOWN.
- A paused legacy request uses `slaPausedAt` and the persisted extended `slaDueAt`; do not add `slaPauseDurationMs` to it again.
- Keep positive resolution outcomes limited to `RESOLVED`, `COMPLETED`, and `PAYMENT_COMPLETED`; other terminal outcomes are not positive resolutions.
- No schema migration or historical data repair is justified by these findings.
