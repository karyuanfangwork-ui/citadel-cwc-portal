import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { guaranteeService } from '../services/guarantee.service';

class GuaranteeController {
  /**
   * GET /applications/:applicationId/guarantees
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const guarantees = await guaranteeService.listGuarantees(applicationId);
    res.json({ status: 'success', data: { guarantees } });
  });

  /**
   * GET /guarantees/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const guarantee = await guaranteeService.getGuarantee(id);
    if (!guarantee) {
      throw new AppError('Guarantee not found', 404);
    }
    res.json({ status: 'success', data: { guarantee } });
  });

  /**
   * POST /applications/:applicationId/guarantees
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const guarantee = await guaranteeService.createGuarantee(req.body);
    res.status(201).json({ status: 'success', data: { guarantee } });
  });

  /**
   * PATCH /guarantees/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const guarantee = await guaranteeService.updateGuarantee(id, req.body);
    if (!guarantee) {
      throw new AppError('Guarantee not found', 404);
    }
    res.json({ status: 'success', data: { guarantee } });
  });

  /**
   * PATCH /guarantees/:id/financial-assessment
   * S7.3 — Guarantor Financial Assessment (dedicated endpoint)
   */
  updateFinancialAssessment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const guarantee = await guaranteeService.updateFinancialAssessment(id, req.body);
    if (!guarantee) {
      throw new AppError('Guarantee not found', 404);
    }
    res.json({ status: 'success', data: { guarantee } });
  });

  /**
   * DELETE /guarantees/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const guarantee = await guaranteeService.deleteGuarantee(id);
    if (!guarantee) {
      throw new AppError('Guarantee not found', 404);
    }
    res.json({ status: 'success', message: 'Guarantee deleted successfully' });
  });

  /**
   * GET /guarantees/:id/capacity
   * P1-5 — Check guarantor capacity (aggregate exposure, utilization, related-party flag)
   */
  checkCapacity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await guaranteeService.checkGuarantorCapacity(id);
    res.json({ status: 'success', data: result });
  });
}

export const guaranteeController = new GuaranteeController();