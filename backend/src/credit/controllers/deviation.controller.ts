import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { deviationService } from '../services/deviation.service';
import { AUTHORITY_HIERARCHY, getHighestAuthorityLevelName } from '../services/authority.service';

class DeviationController {
  // ===========================================================================
  // Deviation CRUD
  // ===========================================================================

  /**
   * POST /deviations — Create a new deviation record
   */
  createDeviation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = req.body;
    const actorId = req.user?.id;

    const deviation = await deviationService.createDeviation(data, actorId);
    res.status(201).json({ status: 'success', data: { deviation } });
  });

  /**
   * PATCH /deviations/:id — Update a pending deviation
   */
  updateDeviation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const data = req.body;

    const deviation = await deviationService.updateDeviation(id, data);
    res.json({ status: 'success', data: { deviation } });
  });

  /**
   * PATCH /deviations/:id/approve — Approve a pending deviation
   */
  approveDeviation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const approverId = req.user!.id;
    const comments = req.body.comments;

    // Determine approver's authority level from their role/permissions
    const approverAuthorityLevel = getApproverAuthorityLevel(req);

    const deviation = await deviationService.approveDeviation(
      id,
      approverId,
      approverAuthorityLevel,
      comments
    );
    res.json({ status: 'success', data: { deviation } });
  });

  /**
   * PATCH /deviations/:id/reject — Reject a pending deviation
   */
  rejectDeviation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const rejecterId = req.user!.id;
    const reason = req.body.reason;

    const deviation = await deviationService.rejectDeviation(id, rejecterId, reason);
    res.json({ status: 'success', data: { deviation } });
  });

  /**
   * GET /deviations/:id — Get a single deviation record
   */
  getDeviation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const deviation = await deviationService.getDeviation(id);
    res.json({ status: 'success', data: { deviation } });
  });

  /**
   * GET /deviations/application/:applicationId — List deviations for an application
   */
  getApplicationDeviations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const deviations = await deviationService.getApplicationDeviations(applicationId);
    res.json({ status: 'success', data: { deviations } });
  });

  /**
   * GET /deviations/application/:applicationId/check — Check deviation resolution status
   */
  checkApplicationDeviations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const result = await deviationService.checkApplicationDeviations(applicationId);
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /deviations — List deviations (register view) with filters and pagination
   */
  listDeviations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { applicationId, status, policyRule, severity, page, limit } = req.query as any;

    const result = await deviationService.listOpenDeviations({
      applicationId,
      status,
      policyRule,
      severity,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.json({ status: 'success', data: result });
  });
}

/**
 * Derive the approver's authority level from their highest credit role.
 * This maps user roles to approval matrix authority levels.
 */
function getApproverAuthorityLevel(req: AuthRequest): string {
  const roles: string[] = req.user?.roles ?? [];
  const permissions: string[] = (req.user as any).permissions ?? [];

  const roleAuthority = getHighestAuthorityLevelName(roles);
  if ((AUTHORITY_HIERARCHY[roleAuthority] ?? 0) > AUTHORITY_HIERARCHY.RM) {
    return roleAuthority;
  }

  if (permissions.includes('credit:admin') || permissions.includes('admin:full')) {
    return 'BOARD';
  }

  if (permissions.includes('credit:committee')) {
    return 'COMMITTEE';
  }

  if (permissions.includes('credit:senior_approve')) {
    return 'SENIOR_MANAGER';
  }

  if (permissions.includes('credit:approve')) {
    return 'MANAGER';
  }

  if (permissions.includes('credit:write')) {
    return 'RM';
  }

  return 'RM';
}

export const deviationController = new DeviationController();