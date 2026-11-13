import { AppError } from '../middleware/error.middleware';

/**
 * HR-only command invariant. Global transition rows are shared with ESM/Finance;
 * an HR graph edge disappearing does not by itself revoke that global edge.
 */
export function assertHrExecutiveTransition(
  request: { requestType?: { code?: string | null } | null; status: string; executiveApproverId?: string | null; executiveApproverRole?: string | null },
  target: string,
  actorId: string,
  hasAtomicApprovalMutation: boolean,
): void {
  if (request.requestType?.code !== 'NEW_HIRING') return;
  const from = request.status;
  const choice = request.executiveApproverRole;
  const selected = request.executiveApproverId;
  if (from === 'CEO_APPROVED' && (target === 'PENDING_GROUP_DCEO_APPROVAL' || target === 'GROUP_DCEO_APPROVED')) {
    throw new AppError('HR recruitment has only one executive approval', 409);
  }
  const gate = target === 'PENDING_CEO_APPROVAL' ? 'CEO'
    : target === 'PENDING_GROUP_DCEO_APPROVAL' ? 'GROUP_DCEO' : null;
  if (gate) {
    if (!['SUBMITTED', 'IN_REVIEW'].includes(from) || !choice || !selected || choice !== gate) {
      throw new AppError('The requester must choose the matching executive before routing', 409);
    }
    if (!hasAtomicApprovalMutation) throw new AppError('Executive routing requires an atomic approval record', 409);
  }
  const decision = from === 'PENDING_CEO_APPROVAL' && ['CEO_APPROVED', 'CEO_REJECTED'].includes(target) ? 'CEO'
    : from === 'PENDING_GROUP_DCEO_APPROVAL' && ['GROUP_DCEO_APPROVED', 'GROUP_DCEO_REJECTED'].includes(target) ? 'GROUP_DCEO' : null;
  if (decision) {
    // Historical unselected, already-routed requests require a separate reviewed
    // data decision. Never let a generic role-based approval claim them.
    if (!choice || !selected || choice !== decision || actorId !== selected) {
      throw new AppError('Only the requester-selected executive may decide this approval', 403);
    }
    if (!hasAtomicApprovalMutation) throw new AppError('Executive decision requires an atomic approval update', 409);
  }
  if (target === 'JOB_POSTED' && ['CEO_APPROVED', 'GROUP_DCEO_APPROVED'].includes(from)
    && choice && choice !== (from === 'CEO_APPROVED' ? 'CEO' : 'GROUP_DCEO')) {
    throw new AppError('The approved executive does not match the saved selection', 409);
  }
}
