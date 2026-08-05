export interface StageGate {
  displayOrder: number;
  requiredFields: string[];
  enforceForwardOnly: boolean;
  requiresApproval: boolean;
  approvalThreshold: number | null;
  isWonStage: boolean;
}

export type TransitionOk = { ok: true };
export type TransitionFail = { ok: false; needsApproval?: boolean; reason: string };
export type TransitionResult = TransitionOk | TransitionFail;

/**
 * Validate whether an opportunity may move from `from` stage to `to` stage.
 *
 * Checks:
 * 1. Forward-only enforcement: if the target stage has `enforceForwardOnly`,
 *    the move is blocked when going backward (target displayOrder < source displayOrder).
 * 2. Required fields: every field in `to.requiredFields` must have a truthy value
 *    on the opportunity object.
 * 3. Approval gate: if `to.requiresApproval` and `to.approvalThreshold` is set,
 *    opportunities with `value >= approvalThreshold` require approval.
 */
export function validateStageTransition(
  opp: Record<string, any>,
  from: StageGate,
  to: StageGate,
): TransitionResult {
  // 1. Forward-only check
  if (to.enforceForwardOnly && to.displayOrder < from.displayOrder) {
    return { ok: false, reason: 'This stage only allows forward progression.' };
  }

  // 2. Required fields check
  for (const field of to.requiredFields) {
    const v = opp[field];
    if (v === null || v === undefined || v === '') {
      return { ok: false, reason: `Field "${field}" is required to enter this stage.` };
    }
  }

  // 3. Approval gate
  if (to.requiresApproval && to.approvalThreshold != null && Number(opp.value) >= Number(to.approvalThreshold)) {
    return { ok: false, needsApproval: true, reason: `Deals ≥ ${to.approvalThreshold} require approval to enter this stage.` };
  }

  return { ok: true };
}