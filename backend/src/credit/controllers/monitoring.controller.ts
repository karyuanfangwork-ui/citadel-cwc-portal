import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { monitoringService } from '../services/monitoring.service';
import { requireUser } from '../utils/requireUser';

class MonitoringController {
  // -------------------------------------------------------------------------
  // FacilityHealth
  // -------------------------------------------------------------------------

  /**
   * GET /applications/:applicationId/health
   */
  getHealth = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const health = await monitoringService.getFacilityHealth(applicationId);
    res.json({ status: 'success', data: { health } });
  });

  /**
   * POST /applications/:applicationId/health
   */
  createHealth = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const health = await monitoringService.createFacilityHealth({
      ...req.body,
      applicationId,
    });
    res.status(201).json({ status: 'success', data: { health } });
  });

  /**
   * PATCH /applications/:applicationId/health
   */
  updateHealth = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const health = await monitoringService.updateFacilityHealth(applicationId, req.body);
    if (!health) {
      throw new AppError('Facility health record not found', 404);
    }
    res.json({ status: 'success', data: { health } });
  });

  // -------------------------------------------------------------------------
  // CovenantDefinition
  // -------------------------------------------------------------------------

  /**
   * GET /applications/:applicationId/covenants
   */
  listCovenants = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const covenants = await monitoringService.listCovenants(applicationId);
    res.json({ status: 'success', data: { covenants } });
  });

  /**
   * POST /applications/:applicationId/covenants
   */
  createCovenant = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const covenant = await monitoringService.createCovenant({
      ...req.body,
      applicationId,
    });
    res.status(201).json({ status: 'success', data: { covenant } });
  });

  // -------------------------------------------------------------------------
  // CovenantTest
  // -------------------------------------------------------------------------

  /**
   * POST /covenants/:id/tests
   */
  createTest = asyncHandler(async (req: AuthRequest, res: Response) => {
    const covenantId = String(req.params.id);
    const test = await monitoringService.createTest({
      ...req.body,
      covenantId,
    });
    res.status(201).json({ status: 'success', data: { test } });
  });

  /**
   * GET /covenants/:id/tests
   */
  listTests = asyncHandler(async (req: AuthRequest, res: Response) => {
    const covenantId = String(req.params.id);
    const tests = await monitoringService.listTests(covenantId);
    res.json({ status: 'success', data: { tests } });
  });

  // -------------------------------------------------------------------------
  // PaymentEvent
  // -------------------------------------------------------------------------

  /**
   * GET /applications/:applicationId/payments
   */
  listPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const payments = await monitoringService.listPayments(applicationId);
    res.json({ status: 'success', data: { payments } });
  });

  /**
   * POST /applications/:applicationId/payments
   */
  createPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const payment = await monitoringService.createPayment({
      ...req.body,
      applicationId,
    });
    res.status(201).json({ status: 'success', data: { payment } });
  });

  /**
   * PATCH /payments/:id
   */
  updatePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const paymentId = String(req.params.id);
    const payment = await monitoringService.updatePaymentStatus(paymentId, req.body);
    if (!payment) {
      throw new AppError('Payment event not found', 404);
    }
    res.json({ status: 'success', data: { payment } });
  });

  // -------------------------------------------------------------------------
  // EarlyWarningSignal
  // -------------------------------------------------------------------------

  /**
   * GET /applications/:applicationId/signals
   */
  listSignals = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const signals = await monitoringService.listSignals(applicationId);
    res.json({ status: 'success', data: { signals } });
  });

  /**
   * GET /signals — watchlist (all active signals)
   */
  listActiveSignals = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const signals = await monitoringService.listActiveSignals();
    res.json({ status: 'success', data: { signals } });
  });

  /**
   * POST /signals/:id/resolve
   */
  resolveSignal = asyncHandler(async (req: AuthRequest, res: Response) => {
    const signalId = String(req.params.id);
    const resolvedById = requireUser(req).id;
    const signal = await monitoringService.resolveSignal(signalId, resolvedById);
    if (!signal) {
      throw new AppError('Early warning signal not found', 404);
    }
    res.json({ status: 'success', data: { signal } });
  });

  // -------------------------------------------------------------------------
  // Reviews Due
  // -------------------------------------------------------------------------

  /**
   * GET /monitoring/reviews-due
   */
  listReviewsDue = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const reviews = await monitoringService.checkReviewDue();
    res.json({ status: 'success', data: { reviews } });
  });
}

export const monitoringController = new MonitoringController();