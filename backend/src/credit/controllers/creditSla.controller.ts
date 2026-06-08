import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { creditSlaService } from '../services/creditSla.service';

/**
 * §2.2 — Credit SLA Policy & Breach Controller
 */
class CreditSlaController {
  // -------------------------------------------------------------------------
  // Policy CRUD
  // -------------------------------------------------------------------------

  /** POST /sla/policies — Create a new SLA policy */
  createPolicy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, targetState, slaHours, notifyRoles, escalateAfterHours, escalateToState, productType } = req.body;

    if (!name || !targetState || slaHours === undefined) {
      throw new AppError('name, targetState, and slaHours are required', 400);
    }

    const policy = await creditSlaService.createPolicy({
      name,
      description,
      targetState,
      slaHours,
      notifyRoles: notifyRoles ?? [],
      escalateAfterHours,
      escalateToState,
      productType,
    });

    res.status(201).json({ status: 'success', data: { policy } });
  });

  /** GET /sla/policies — List SLA policies */
  listPolicies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const targetState = req.query.targetState as string | undefined;
    const productType = req.query.productType as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const policies = await creditSlaService.listPolicies({ targetState, productType, isActive });
    res.json({ status: 'success', data: { policies } });
  });

  /** GET /sla/policies/:id — Get a single SLA policy */
  getPolicy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const policy = await creditSlaService.getPolicy(String(req.params.id));
    if (!policy) throw new AppError('SLA policy not found', 404);
    res.json({ status: 'success', data: { policy } });
  });

  /** PATCH /sla/policies/:id — Update an SLA policy */
  updatePolicy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const policy = await creditSlaService.updatePolicy(String(req.params.id), req.body);
    res.json({ status: 'success', data: { policy } });
  });

  /** DELETE /sla/policies/:id — Soft-delete (deactivate) an SLA policy */
  deletePolicy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const policy = await creditSlaService.deletePolicy(String(req.params.id));
    res.json({ status: 'success', data: { policy } });
  });

  // -------------------------------------------------------------------------
  // Breach Management
  // -------------------------------------------------------------------------

  /** GET /sla/breaches — Get all active breaches (dashboard widget), optionally filtered by assignedToMe */
  getActiveBreaches = asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignedToMe = req.query.assignedToMe === 'true' ? req.user!.id : undefined;
    const breaches = assignedToMe
      ? await creditSlaService.getMyActiveBreaches(assignedToMe)
      : await creditSlaService.getAllActiveBreaches();
    res.json({ status: 'success', data: { breaches } });
  });

  /** GET /sla/breaches/:applicationId — Get breaches for a specific application */
  getApplicationBreaches = asyncHandler(async (req: AuthRequest, res: Response) => {
    const breaches = await creditSlaService.getApplicationBreaches(String(req.params.applicationId));
    res.json({ status: 'success', data: { breaches } });
  });

  /** POST /sla/breaches/:id/acknowledge — Acknowledge a breach */
  acknowledgeBreach = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentication required', 401);

    const breach = await creditSlaService.acknowledgeBreach(String(req.params.id), userId);
    res.json({ status: 'success', data: { breach } });
  });

  /** POST /sla/breaches/:id/resolve — Resolve a breach */
  resolveBreach = asyncHandler(async (req: AuthRequest, res: Response) => {
    const breach = await creditSlaService.resolveBreach(String(req.params.id));
    res.json({ status: 'success', data: { breach } });
  });

  // -------------------------------------------------------------------------
  // Manual trigger (for testing / admin)
  // -------------------------------------------------------------------------

  /** POST /sla/check — Manually trigger breach detection */
  checkBreaches = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const breachCount = await creditSlaService.checkAndRecordBreaches();
    const escalationCount = await creditSlaService.processEscalations();
    res.json({ status: 'success', data: { breachesDetected: breachCount, escalationsProcessed: escalationCount } });
  });
}

export const creditSlaController = new CreditSlaController();