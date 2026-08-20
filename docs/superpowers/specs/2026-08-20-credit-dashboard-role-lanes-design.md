# Credit Dashboard Redesign — Role Lanes

**Date:** 2026-08-20
**Status:** Approved for planning
**Scope:** `/credit` landing page, approver approval surface, three scoped `dashboard.service.ts` changes

---

## 1. Problem

Users report the credit dashboard is hard to understand and operate, most
acutely relationship managers (RMs) and approvers.

The page is built for a head of credit. It leads with the application
pipeline funnel, SLA compliance percentage, approval turnaround, and queue
bottleneck analysis. None of that is what an RM or an approver came to do.
Both must navigate away from the landing page to reach their actual work.

Three concrete defects compound the mismatch:

**Duplicate rendering of the same data.** `CreditDashboard.tsx:684-685`
passes the identical `myAssigned` array to both `PriorityWorkQueue` and
`NextActionsPanel`. The wide primary table shows a status word
("Approved", "Draft") that implies no action. The small panel below the
fold shows `currentTask` and `nextAction`, which is the genuinely useful
content. The useless rendering is given the visual priority.

**Borrower name renders as "Unknown".** `dashboard.service.ts:530` and
`:573` fall back to the literal string `'Unknown'` when
`borrowerProfile.name` is null. `BorrowerProfile.name` is nullable in the
schema. Every row in the reported screenshot reads "Unknown", making the
queue impossible to triage by borrower.

**The SLA column can never populate.** `dashboard.service.ts:538-545`
sets `slaRemainingHours` only when a breach record already exists, with a
comment stating the computation was skipped to avoid N+1 queries. Two
consequences: the SLA column always renders "—", and `slaStatus` can
never return `WARNING`, so the "Due soon" counter in the attention strip
is structurally always zero.

**Work is scattered.** Approval items appear on Dashboard, My Approvals,
and Applications with no single authoritative "mine".

## 2. Goals

- An RM lands on what is stuck, why it is stuck, and the one action that
  unstucks it.
- An approver lands on the decisions waiting on them, with enough context
  to decide, and decides without leaving the page.
- Management analytics remain available but stop being everyone's front
  door.
- The queue becomes triageable: real borrower names, real SLA countdowns.

## Non-goals

- No schema changes.
- No batch approval (see §6.3).
- No change to SLA clock semantics (see §6.1).
- No redesign of the Manager lane's widgets; they are relocated as-is.
- No change to the in-flight borrower-workspace work.

## 3. Information architecture

One route, `/credit`. A shared shell with a role-selected main column.

**Shell (all roles):** page header, branch filter, and `AttentionStrip`
(Overdue / Due soon / Information required / Returned). The strip is
retained unchanged in content because each of its four numbers is a call
to action. Each becomes a click-through filter into the lane below rather
than a static stat.

**Lane resolution**, in order:

1. Explicit user choice, persisted to `localStorage` under `credit.lane`.
2. Otherwise inferred from permissions via the existing `hasPermission`
   helper: approval permission -> Approver; portfolio/analytics
   permission -> Manager; otherwise RM.
3. A lane switcher is rendered whenever the user qualifies for more than
   one lane. Multi-hat users (an RM who also approves) are common, so the
   switcher is a first-class persistent control, not a fallback.

**Relocated to the Manager lane:** Application Pipeline funnel, SLA
Compliance, Approval Turnaround, Queue Bottlenecks. Nothing is deleted.

**Merged:** `PriorityWorkQueue` and `NextActionsPanel` are replaced by a
single action-first list. The status-word table is removed; next-action
content becomes the primary column.

## 4. RM lane

Answers, in order: what is stuck and why; how do I move it.

### 4.1 Primary column — "Needs you"

One row per application where the RM is the bottleneck. Reading order:

```
CA-2026-00016 · Lyra Manufacturing Sdn Bhd          RM 7,000,000
Returned by credit — 2 conditions outstanding        ! 4h left
                                        [ Review returned items -> ]
```

Line 1 is identity, line 2 is the blocker in plain language, the right
edge carries the SLA countdown, and there is exactly one primary action
button. One action per row, not a menu: choosing between actions is
itself friction, and the RM's stated need is speed.

### 4.2 The `blocker` field

Today `currentTask` derives from state alone ("Complete KYC review"),
which restates the status rather than naming the obstacle. A `blocker`
field is added per work item, resolved in this priority order:

1. SLA breached -> `Overdue {n} days — {policy name}`
2. Returned / referred back -> `Returned by credit — {n} conditions outstanding`
3. Compliance hold -> `Information requested — {subject}`
4. Data-quality flags already computed for `OperationalAlerts` (expired
   bureau report, high DSR, AML review) -> e.g. `Bureau report expired`
5. Fallback -> the existing state-derived `currentTask`

Rules 2 and 3 depend on condition and comment data being queryable in a
batched form. If a batch-safe query is not achievable, those rules
degrade to rule 5 and the degradation is stated in the implementation
notes rather than approximated.

Rows sort by the existing `derivePriority` (SLA dominates, then amount
band), so the top of the list is the correct next action.

### 4.3 Secondary column — "In flight"

Everything else the RM owns, grouped by who is holding it — With credit /
With customer / With committee — rather than by state name. This answers
"why hasn't this moved" without opening anything and collapses roughly
ten state names into the three groups an RM reasons about.

### 4.4 Fast paths

New Application remains the header primary action. Drafts get a dedicated
compact "Resume" strip; a draft is the cheapest deal to advance and is
currently buried mid-table behind the status word "Draft".

## 5. Approver lane

`/credit` becomes the approver's decision inbox. The `MyApprovals`
content moves here. Two sibling tabs showing overlapping approval work is
the scatter problem; the front door wins.

### 5.1 Structure

One list, ordered by the urgency grouping the inbox endpoint already
returns (`high` / `medium` / `low`), with a header count:
"7 decisions waiting · 2 overdue". This answers "what needs me now".

### 5.2 Row to decision card

Collapsed, a row shows identity, amount, risk grade, and days waiting —
all present on the existing `ApprovalInboxItem` DTO.

Clicking expands the row in place. Not a modal and not a navigation: the
navigation round-trip is the bulk of the click cost being removed. The
expanded card carries the four things missing at decision time:

- **Exposure and amount** — requested amount, tenor, existing group exposure
- **Risk** — risk grade, DSR, and policy exceptions as explicit warning
  chips rather than buried fields
- **RM recommendation** — the case for the deal in the RM's words
- **Decision** — Approve / Return for information / Decline, inline

`ApprovalInboxItem` does not carry DSR, exposure, exceptions, or the
recommendation. The expanded card **lazy-fetches** detail for the single
row being opened. This keeps the change frontend-only, avoids an N+1
across the inbox, and leaves collapsed rows free.

### 5.3 Decision mechanics

Reuse the existing logic in `ApprovalQuickView`: mandatory rejection
reason codes, the approval chain display, and the SOD guard preventing an
RM approving their own application. The decision body is extracted from
the modal into a shared component so the inline card and the modal cannot
drift apart in behaviour.

SOD-excluded items remain visible, with the action area replaced by the
exclusion reason, so an approver never wonders where an application went.

## 6. Backend addendum

Three changes in `backend/src/credit/services/dashboard.service.ts`. No
schema changes.

### 6.1 Borrower name fallback

Replace `bp?.name ?? 'Unknown'` at lines 530 and 573 with the resolution
the frontend's `getBorrowerDisplayName` already implements: authoritative
`name`, then the individual/entity name fields, then a last-resort
`Borrower {applicationNo}`. The bare "Unknown" tells the user nothing and
reads as breakage.

Implementation first confirms whether the affected rows have null names
or no linked profile at all. If the cause is demo-seed gaps, the seed is
fixed as well, but the fallback lands regardless so the UI can never
render "Unknown" again.

### 6.2 Batched SLA countdown

The N+1 concern recorded in the existing comment does not require
per-row queries. Load active policies and branch overrides **once per
request** — the same two queries `checkAndRecordBreaches` already
performs — build a `targetState -> slaHours` map honouring branch
overrides and the product-type filter, then compute `slaRemainingHours`
in memory per row. Cost is constant in the number of rows.

This also makes `slaStatus === 'WARNING'` reachable for the first time,
which repairs the permanently-zero "Due soon" counter.

**The clock start stays `app.createdAt`,** mirroring
`creditSla.service.ts:186`, so the dashboard and the breach checker
agree. Measuring from state-entry time would be more correct, but there
is no state-history table to compute it from and changing it would
silently reclassify the SLA status of every application. This is recorded
as an open decision in §8, deliberately not folded into a UI redesign.

### 6.3 `blocker` field

Per §4.2, using data already loaded plus at most one batched query for
returned-condition counts, with the stated degradation path.

## 7. Manager lane

A relocation of the existing pipeline funnel, SLA compliance, approval
turnaround, and bottleneck widgets. No new backend and no visual
redesign.

## 8. Testing

- Component tests for each of the three lanes.
- Component tests for lane resolution: explicit choice wins over
  inference; permission inference order; the multi-hat switcher renders
  and persists to `localStorage`.
- Unit tests for `blocker` resolution covering each rung of the priority
  ladder and the fallback.
- Unit tests for the batched SLA computation: policy present, branch
  override present, product-type mismatch, and no applicable policy.
- Playwright specs extending `frontend/e2e/credit/`: an RM sees blockers
  with actions; an approver expands a row and decides inline; a
  SOD-excluded row shows its exclusion reason and offers no decision
  action.

## 9. Open decisions

1. **SLA clock semantics.** `createdAt` versus state-entry time. Deferred
   deliberately; resolving it requires a state-history source and
   reclassifies existing applications.
2. **Batch approval.** Excluded from this design. Bulk-approving credit
   decisions weakens the audit position and the per-decision reason codes
   the system enforces, and inline decisions already remove the
   navigation cost that dominates the click count. If required, it will
   be specified separately with explicit per-item confirmation.
3. **Returned-condition and comment data.** Whether rules 2 and 3 of the
   blocker ladder can be satisfied with a batch-safe query is confirmed
   during implementation; the fallback is defined.
