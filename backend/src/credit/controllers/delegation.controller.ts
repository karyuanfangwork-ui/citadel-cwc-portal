import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { delegationService } from '../services/delegation.service';
import { approvalActionService } from '../services/approvalAction.service';

/**
 * §2.6 — Delegation controller
 *
 * Endpoints for viewing delegated approval tasks and submitting
 * approval actions on behalf of a delegator.
 */
class DelegationController {
  /**
   * GET /delegation/pending-approvals
   * List pending approval items for the current user, including
   * items delegated to them by other approvers.
   */
  listPendingApprovals = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const items = await delegationService.getPendingApprovals(userId);
    res.json({ status: 'success', data: items });
  });

  /**
   * POST /delegation/approve-on-behalf
   * Submit an approval action on behalf of a delegator.
   *
   * Body: {
   *   applicationId: string,
   *   delegatorId: string,   // the original approver who delegated
   *   decision: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE',
   *   comment?: string
   * }
   */
  approveOnBehalf = asyncHandler(async (req: AuthRequest, res: Response) => {
    const delegateId = req.user?.id;
    if (!delegateId) {
      throw new AppError('Authentication required', 401);
    }

    const { applicationId, delegatorId, decision, comment } = req.body;

    if (!applicationId || !delegatorId || !decision) {
      throw new AppError('applicationId, delegatorId, and decision are required', 400);
    }

    // Validate the delegation relationship
    const validation = await delegationService.validateDelegatedAction(
      delegatorId,
      delegateId,
      applicationId,
    );

    if (!validation.valid) {
      throw new AppError(validation.reason || 'Delegation validation failed', 403);
    }

    // Submit the approval as the delegate
    const result = await approvalActionService.submitApprovalAction({
      applicationId,
      decision,
      comment,
      actorId: delegateId,
      actorRoles: req.user?.roles as string[] || [],
    });

    // Record the delegation in the audit trail
    await delegationService.recordDelegatedAction(
      applicationId,
      delegateId,
      delegatorId,
      decision,
      comment,
    );

    res.json({ status: 'success', data: { ...result, delegatedBy: delegatorId } });
  });

  /**
   * GET /delegation/status
   * Get the current user's delegation status — who they delegate to
   * and who delegates to them.
   */
  getDelegationStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Resolve if this user has delegation enabled
    const resolution = await delegationService.resolveDelegation(userId);

    // Find incoming delegations (who delegates to this user)
    const incomingDelegators = await delegationService.getPendingApprovals(userId);

    res.json({
      status: 'success',
      data: {
        delegation: {
          enabled: resolution.isDelegated,
          delegatedTo: resolution.isDelegated ? resolution.effectiveActorId : null,
          onBehalfOf: resolution.onBehalfOfId,
        },
        incomingDelegationsCount: incomingDelegators.filter(i => i.delegatedFromId).length,
      },
    });
  });
}

export const delegationController = new DelegationController();