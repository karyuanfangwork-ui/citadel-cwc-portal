# Workflow Engine Audit

## Verdict

**Partial foundation; not production-ready. Risk: High. Priority: P1 (with P0 authorization/scheduler blockers).**

The platform has more than hardcoded statuses: `WorkflowType`, `WorkflowStep`, `WorkflowTransition`, transition metadata, guards, a central transition service, admin endpoints, approval policies, delegation records, SLA pause/resume and scheduler jobs. However, the runtime is still hybrid. Many controllers write request status directly, definitions are mutable and unversioned, state/activities/audit/SLA are non-atomic, concurrency protection is absent, and the approval-policy executor does not implement the semantics its schema suggests.

## Capability matrix

| Capability | Current implementation | Status | Risk | Priority | Effort | Production ready |
|---|---|---|---|---|---|---|
| Workflow isolation | Definitions mostly global; request data tenant-scoped; desk checks controller-specific | Fail | Critical | P0 | Large | No |
| Transition validation | DB-first plus fallback map and guards | Partial | High | P1 | Large | No |
| Approval routing | Hardcoded role/status paths plus ApprovalPolicy | Partial | High | P1 | Large | No |
| Sequential approval | `stepOrder` exists but all steps can be created PENDING | Fail | High | P1 | Large | No |
| Parallel approval | Entity approvals and credit committee patterns only; no generic join/quorum | Partial | High | P1 | Large | No |
| Conditional approval | `autoApproveIf` stored, not evaluated; controller conditions hardcoded | Fail | High | P1 | Large | No |
| Delegation | One-off ESM delegation; richer credit-specific delegation | Partial | High | P1 | Medium | No |
| Vacation/OOO | User OOO exists; no generic ESM effective-date/fallback policy | Partial | High | P1 | Medium | No |
| Auto assignment | Round-robin/least-loaded/random and entity routing | Partial | High | P1 | Medium | No |
| SLA | Single wall-clock target, pause/resume, breach/escalation | Partial | High | P1 | Large | No |
| Timers | node-cron jobs | Partial | High | P0 | Large | No |
| Retries | PDF queue only; workflow/notification jobs lack durable retry | Fail | High | P1 | Large | No |
| Workflow versioning | None | Missing | High | P1 | XLarge | No |
| Rollback | No definition/runtime rollback | Missing | High | P1 | XLarge | No |
| Recovery | No outbox/replay/reconciliation state | Missing | High | P1 | Large | No |
| Audit | Activity and audit hooks | Partial | High | P1 | Medium | No |
| Simulation/preview | None | Missing | Medium | P2 | Large | No |

## Runtime data flow and failure points

```text
Controller action
  -> controller-specific role/status/object checks
  -> transitionRequest OR direct prisma.request.update(status)
       -> validate current state
       -> run guards
       -> pause/resume SLA
       -> update request
       -> write activity
       -> write audit (failure swallowed)
       -> notify requester/participants (failure swallowed)
```

There is no single transaction across durable state, activity and outbox. A crash can leave a paused SLA without a status change, a changed status without activity/audit, or a business transition whose notification is never retried (`backend/src/services/requestTransition.service.ts:302-408`).

## Findings

### WF-01 — Non-atomic state transition

SLA, request state, activity and audit are separate writes. Expected enterprise behavior is one optimistic, transactional state change plus a durable outbox. **Business impact:** inconsistent case state and disputed approvals. **Security impact:** incomplete audit evidence. **High / P1 / Large / Backend Architecture.**

### WF-02 — Stale-state concurrency race

The service reads, validates, then updates by ID without version or current-status predicate. Two decisions can validate the same old state. Add `version`, conditional `updateMany(where id,status,version)` and idempotency keys. **High / P1 / Medium / Backend.**

### WF-03 — Central engine is bypassed

Approval, interview, screening, LOA, onboarding, offboarding, finance and chargeback controllers still contain direct request status updates. Side effects and guards therefore differ by path. Migrate all transitions and block direct writes through architecture tests. **High / P1 / Large / Workflow Team.**

### WF-04 — Definitions are global and mutable

Workflow models lack tenant/department owner, version, draft/published state, effective dates and request snapshot. Live edits can change in-flight behavior. Add immutable published versions and bind each request to a version. **High / P1 / XLarge / Product Architecture.**

### WF-05 — Sequential approval is not enforced by runtime state

Policy execution creates ordered human steps immediately as PENDING; `stepOrder` is metadata rather than activation. Later approvers may act early. Introduce approval-instance tokens with WAITING/ACTIVE/DECIDED states. **High / P1 / Large / Backend Product.**

### WF-06 — `autoApproveIf` is misleading

AUTO steps are unconditionally approved and the condition is placed in comments. This can bypass intended review. Build a typed expression evaluator, record inputs/results/version, and fail closed. **High / P1 / Medium / Workflow Security.**

### WF-07 — Approver resolution is nondeterministic

Role/department/team resolution uses `findFirst`/oldest active user. Department ID/type semantics also diverge between schema and service. Use explicit authority assignments, effective dates, fallback chains and scoped selection. **High / P1 / Medium / IAM + Product.**

### WF-08 — Delegation lacks governance

ESM delegation has no eligibility, department/tenant scope, SoD, self/cycle prevention, effective period, maximum chain, acceptance or revocation. Mutation and audit history are non-transactional, while history routes are authentication-only. **High / P1 / Medium / IAM.**

### WF-09 — Timeout implementation contradicts design

The code says “auto-escalate” but marks overdue approvals REJECTED. The 72-hour escalation creates a record for the same approver and does not notify an admin. Replace destructive timeout with configurable reminder/escalation/delegation actions. **High / P1 / Medium / Product Owner.**

### WF-10 — Reminder delivery is not reliable

Reminder record/counter are committed before best-effort notification. A send failure is swallowed and the record prevents retry. Use idempotent queued delivery with unique `(approval,reminderType,cycle)` and outcome tracking. **High / P1 / Medium / Notification Team.**

### WF-11 — Assignment races and scope gaps

Round robin is a read-compute-write flow without row locking; least-loaded and team reassignment lack tenant/desk conditions. Concurrent requests can select the same agent, and global role holders can be selected. **High / P1 / Medium / Backend.**

### WF-12 — SLA is not enterprise-caliber

Due dates are wall-clock additions. There are no business calendars, holidays, timezones, response/resolution targets, priority matrix, OLA/UC or multi-stage clocks. Stale pauses auto-resume after 14 days regardless of workflow. **High / P1 / Large / ESM Product.**

### WF-13 — Escalation can grant cross-department access

Escalation finds users by role globally and adds them as participants; fallback selects the first global admin. This can leak HR/Finance requests. Resolve only tenant+department duty roles and never use participation as an escalation transport. **Critical / P0 / Medium / Security.**

### WF-14 — Actual cron callbacks bypass distributed lock

The lock wraps manual `triggerJob`, not ordinary cron callbacks. With multiple API replicas jobs duplicate. Lock failure also runs jobs on every instance unless an opt-in flag is enabled. Move schedules to dedicated BullMQ repeatable workers or lock every callback and fail safe. **High / P0 / Large / Platform.**

### WF-15 — SLA schedule is too infrequent

Default SLA cron is 09:00 weekdays while approval timeouts/reminders share the job. Hour-based policies can be delayed across nights/weekends. Use minute-level durable timers or scheduled jobs per due item. **High / P0 / Medium / Platform + Product.**

## Target runtime

```text
Versioned Definition (draft -> approved -> published -> retired)
  -> Workflow Instance (definitionVersionId, departmentId, current tokens, version)
  -> Command (actor, action, idempotencyKey, expectedVersion)
  -> Policy decision + guards
  -> DB transaction:
       conditional state update
       task/approval token changes
       immutable history/audit event
       outbox events
  -> durable workers:
       notifications, integrations, SLA timers, escalation, search indexing
  -> retry / DLQ / reconciliation / operator replay
```

## Acceptance criteria

- All request status writes pass one transition API; architecture test finds zero direct writes outside it.
- Concurrent-decision tests prove one winner and idempotent replay.
- Published definitions are immutable and every instance references a version.
- Sequential, parallel/quorum, conditional, delegation/OOO, timeout and escalation semantics have integration tests.
- Durable outbox/worker retries survive process termination and duplicate delivery.
- Every assignment/escalation target is tenant+department scoped.
- SLA tests cover calendars, timezones, pauses, holidays and daylight boundaries.
- Operator tooling can inspect, retry, compensate and reconcile stuck instances without direct SQL.
