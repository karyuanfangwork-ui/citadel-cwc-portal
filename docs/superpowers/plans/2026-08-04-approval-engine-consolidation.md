# Approval Engine Consolidation Plan

**Date:** 2026-08-04  
**Status:** Decision Document — No Code Changes Yet  
**Author:** Workflow Engine Remediation

## 1. Current State

Two approval engines exist in the codebase:

| Engine | File | Lines | Production Callers | Capabilities |
|--------|------|-------|-------------------|--------------|
| **Inline** | Controllers (`requestApproval.create`) | 29 call sites across 4 controllers | Active | Create approval records only; no versioning, no conditions, no delegation, no timeout |
| **Policy-based** | `approvalPolicy.service.ts` + `approvalRuntime.service.ts` | 239 + 728 = 967 lines | 2 callers (`approvalPolicy.controller.ts`, `request.controller.ts`) | Versioned policies, parallel/sequential groups, conditions, delegation, timeout actions, approval states |
| **Policy admin** | `approvalPolicy.controller.ts` | ~160 lines | Routes | CRUD for ApprovalPolicy, resolve policy, create approvals from policy |

**Key findings:**
- `approvalRuntime.service.ts` (728 lines) has **zero production callers** — it is dormant
- `approvalPolicy.service.ts` has 2 callers, both in request creation/admin flows
- All 4 workflow controllers create `RequestApproval` records inline with `prisma.requestApproval.create()`, bypassing both engines entirely
- The inline approach cannot express conditions (e.g., "skip CEO if amount < 500"), parallel groups, or delegation

## 2. Recommendation

**Migrate to the versioned runtime (`approvalRuntime`) as the single approval engine.**

Rationale:
- The runtime already implements versioning, parallel groups, conditions, delegation, and timeout actions — capabilities that would each require controller-level code changes with the inline approach
- The inline `requestApproval.create()` calls are scattered across 4 controllers and 29 sites, making routing changes require a deploy
- The runtime has comprehensive test coverage (integration tests exist in `approvalRuntime.integration.test.ts`)
- Shadow-mode comparison is possible: run both engines and diff approver resolution before cutover

## 3. Pilot Flow: Purchase Requisition

The Purchase Requisition (Finance) flow is the best pilot because:
- It has documented workflow behaviour (in code and recent transition fixes)
- It covers the most approval scenarios: Manager → Finance Head → CFO → Group DCEO
- It already uses `approvalPolicyService.createApprovalsFromPolicy` for initial creation in one path
- The controller code (`finance-workflow.controller.ts`) is the largest single source of inline `requestApproval.create()` calls (10 sites)

### Migration Steps for Purchase Requisition

1. **Seed an `ApprovalPolicy` + `ApprovalPolicyVersion`** for Purchase Requisition with:
   - Sequential groups: Manager → Finance Head, then CFO, then Group DCEO
   - Condition: "skip Group DCEO if amount < threshold" (configurable)
   - Timeout action: auto-escalate after N days
   - Status: `PUBLISHED`

2. **Wire `approvalRuntime` into the transition pipeline**:
   - In `requestTransition.service.ts`, after a transition that requires approval (detected from `WorkflowTransition.autoAssignRole` or a new `requiresApproval` flag), call `approvalRuntime.startInstance()`
   - The runtime creates the approval groups, sets up timeouts, and emits an `APPROVAL_REQUIRED` outbox event

3. **Shadow mode**: For 2 weeks, both engines run. The inline `requestApproval.create()` calls continue, and `approvalRuntime` also creates its own `ApprovalInstance` records. A diff script compares the two sets of approvers and reports mismatches.

4. **Cutover**: Remove the inline `requestApproval.create()` calls from the Purchase Requisition paths in `finance-workflow.controller.ts`. Delete the corresponding `findCfo`, `findGroupDceo` helper functions.

5. **Delete pilot inline code**: Remove the 10 `requestApproval.create()` sites in `finance-workflow.controller.ts` that are now handled by the runtime.

## 4. Rollout to Other Flows

After the Purchase Requisition pilot is stable for 2 weeks in production:

| Flow | Controller | Inline Sites | Complexity |
|------|-----------|-------------|------------|
| Purchase Requisition | `finance-workflow.controller.ts` | 10 | High (3 approval levels) |
| CWC Travel Request | `esm-workflow.controller.ts` | 6 | Medium (CEO → DCEO → CFO) |
| IT Support | `it-workflow.controller.ts` | 3 | Low (CEO → CTO) |
| Chargeback | `chargeback-workflow.controller.ts` | 2 | Low (single approval) |

Each flow follows the same 5-step process: seed policy, wire runtime, shadow mode, cutover, delete inline code.

## 5. No-Go Criteria

- If the runtime cannot express a condition that the inline code handles (e.g., entity-based routing), the flow stays inline until the runtime is extended
- If shadow-mode diff reveals >5% mismatches, the pilot is paused for investigation
- If approval timeouts fire incorrectly in shadow mode, the runtime is paused and the inline path remains active

## 6. Effort Estimate

| Phase | Effort | Risk |
|-------|--------|------|
| Seed policy + wire runtime | 2 days | Low |
| Shadow mode monitoring | 2 weeks (calendar) | Low |
| Cutover + delete inline code (Purch Req) | 1 day | Medium |
| Rollout to remaining 3 flows | 3 days | Low |
| **Total** | ~6 dev-days + 2 weeks calendar | — |

## 7. Decision Required

- [ ] Approve Purchase Requisition as the pilot flow
- [ ] Approve shadow-mode comparison period (2 weeks)
- [ ] Approve deletion of inline `requestApproval.create()` calls after cutover