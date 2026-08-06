# Recommended workflow bootstrap policy

Status: proposed for review. This policy is not applied to production.

## Decision summary

Use the canonical transition definitions in `backend/prisma/seed-esm-transitions.ts` as the baseline workflow graph. Do not infer authorization from empty role lists or from global fallback rows alone.

The bootstrap must preserve all existing request statuses. No live request status may be deleted or remapped automatically.

## Authorization policy

Approval and executive-routing transitions must carry explicit authorization metadata:

| Transition family | Required allowed role(s) |
|---|---|
| CEO approval/rejection | `CEO` |
| CTO approval/rejection | `CTO` |
| CFO approval/rejection | `CFO` |
| Group Deputy CEO approval/rejection | `GROUP_DCEO` |
| Finance Head approval/rejection | `FINANCE_HEAD` |
| Hiring manager review/approval | `HIRING_MANAGER` |
| HR approval/review | No generic `HR_AGENT` transition guard was found; remain blocked until the exact controller-enforced role is explicitly mapped |
| IT agent operational transitions | `IT_AGENT`, subject to the existing controller policy |
| General service-desk operational transitions | `AGENT` or `ADMIN`, subject to the existing controller policy |

The final role values must be reconciled against the actual role enum and controller guards before writing. If the exact production role name differs, the bootstrap remains blocked until the mapping is explicit.

Rejection transitions must preserve `requiresComment=true` where the existing controller or canonical definition requires a reason.

## CANCELLED policy

For workflows containing live `CANCELLED` requests:

1. Add `CANCELLED` as a terminal graph node.
2. Preserve every existing request with status `CANCELLED`.
3. Do not remap cancelled requests.
4. Add cancellation edges only from runtime-approved cancellable statuses.
5. Require a cancellation comment.
6. Do not make cancellation available to unrestricted authenticated users.
7. Verify the cancellation controller and transition policy use the same source/destination pairs.

Affected production workflows currently include IT Simple and IT Procurement. The complete list must be re-read from the production shadow report immediately before any write.

## Synthetic-edge policy

Synthetic edges are not automatically approved. Each must be explicitly reviewed:

- Finance approval/payment routing
- IT Procurement approval/delivery routing
- IT Hardware Procurement routing
- Expense Reimbursement sequential routing
- HR Recruitment `SUBMITTED → IN_REVIEW → PENDING_CEO_APPROVAL`
- IT Simple cancellation routing

A synthetic edge may be written only when:

- its source and target statuses are used by the runtime controller;
- its authorization roles are explicit;
- its comment requirement is explicit;
- its effect on occupied requests is understood;
- the workflow owner has approved it.

## Version/bootstrap policy

1. Create one version 1 per workflow only after the candidate graph passes validation.
2. Keep the version status `ACTIVE` only after all nodes and edges are inserted.
3. Compile workflow-scoped runtime transitions within the same transaction.
4. Preserve global fallback transitions unchanged.
5. Do not publish a designer draft during bootstrap.
6. Make the operation idempotent and rerunnable without duplicate nodes, edges, versions, or transitions.
7. Record a bootstrap audit event containing the approved report hash and operator identity.

## Mandatory gates before production write

All must be true:

- production backup verified;
- migration status is up to date;
- shadow report has `blockingCount: 0`;
- no occupied status is absent from the approved graph;
- no occupied status loses all exits;
- no edge has inferred or empty authorization metadata where authorization is required;
- no conflicting runtime policy rows exist;
- global fallback transition count and content are unchanged in the planned diff;
- workflow owner approval is recorded;
- rollback procedure has been tested against a backup or staging clone.

## Recommended rollout order

1. IT Simple, after cancellation and agent-role review.
2. HR General, after operational role review.
3. Other low-risk operational workflows.
4. Finance and procurement workflows only after approval-chain review.
5. HR Recruitment, onboarding, offboarding, and ESM Travel last because they contain executive or personnel-sensitive routing.

## Current implementation references

- Planner: `backend/src/services/workflowBootstrap.service.ts`
- Shadow command: `npm run workflow:bootstrap:shadow`
- Shadow entry point: `backend/prisma/bootstrap-workflow-versions.ts`
- Canonical definitions: `backend/prisma/seed-esm-transitions.ts`
- Existing runtime policy: workflow transition policy/controller services
- Operational runbook: `docs/runbooks/workflow-bootstrap-production.md`
