import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { collateralService } from '../services/collateral.service';

class CollateralController {
  /**
   * GET /applications/:applicationId/collateral
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const collateral = await collateralService.listCollateral(applicationId);
    res.json({ status: 'success', data: { collateral } });
  });

  /**
   * GET /collateral/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const collateral = await collateralService.getCollateral(id);
    if (!collateral) {
      throw new AppError('Collateral not found', 404);
    }
    res.json({ status: 'success', data: { collateral } });
  });

  /**
   * POST /applications/:applicationId/collateral
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateral = await collateralService.createCollateral(req.body);
    res.status(201).json({ status: 'success', data: { collateral } });
  });

  /**
   * PATCH /collateral/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const collateral = await collateralService.updateCollateral(id, req.body);
    if (!collateral) {
      throw new AppError('Collateral not found', 404);
    }
    res.json({ status: 'success', data: { collateral } });
  });

  /**
   * DELETE /collateral/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const collateral = await collateralService.deleteCollateral(id);
    if (!collateral) {
      throw new AppError('Collateral not found', 404);
    }
    res.json({ status: 'success', message: 'Collateral deleted successfully' });
  });

  // -------------------------------------------------------------------------
  // Valuations
  // -------------------------------------------------------------------------

  /**
   * POST /collateral/:id/valuations
   */
  addValuation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateralId = String(req.params.id);
    const valuation = await collateralService.addValuation({ ...req.body, collateralId });
    res.status(201).json({ status: 'success', data: { valuation } });
  });

  /**
   * GET /collateral/:id/valuations
   */
  listValuations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateralId = String(req.params.id);
    const valuations = await collateralService.listValuations(collateralId);
    res.json({ status: 'success', data: { valuations } });
  });

  // -------------------------------------------------------------------------
  // Liens
  // -------------------------------------------------------------------------

  /**
   * POST /collateral/:id/liens
   */
  addLien = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateralId = String(req.params.id);
    const lien = await collateralService.addLien({ ...req.body, collateralId });
    res.status(201).json({ status: 'success', data: { lien } });
  });

  /**
   * GET /collateral/:id/liens
   */
  listLiens = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateralId = String(req.params.id);
    const liens = await collateralService.listLiens(collateralId);
    res.json({ status: 'success', data: { liens } });
  });

  /**
   * PATCH /liens/:lienId/discharge
   */
  dischargeLien = asyncHandler(async (req: AuthRequest, res: Response) => {
    const lienId = String(req.params.lienId);
    const dischargeDate = req.body.dischargeDate ?? new Date().toISOString();
    const lien = await collateralService.dischargeLien(lienId, dischargeDate);
    if (!lien) {
      throw new AppError('Lien not found', 404);
    }
    res.json({ status: 'success', data: { lien } });
  });

  // -------------------------------------------------------------------------
  // Insurance
  // -------------------------------------------------------------------------

  /**
   * POST /collateral/:id/insurance
   */
  addInsurance = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateralId = String(req.params.id);
    const insurance = await collateralService.addInsurance({ ...req.body, collateralId });
    res.status(201).json({ status: 'success', data: { insurance } });
  });

  /**
   * GET /collateral/:id/insurance
   */
  listInsurance = asyncHandler(async (req: AuthRequest, res: Response) => {
    const collateralId = String(req.params.id);
    const insurance = await collateralService.listInsurance(collateralId);
    res.json({ status: 'success', data: { insurance } });
  });

  // -------------------------------------------------------------------------
  // Aggregate
  // -------------------------------------------------------------------------

  /**
   * GET /applications/:applicationId/collateral/total-value
   */
  totalValue = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const result = await collateralService.getTotalCollateralValue(applicationId);
    res.json({ status: 'success', data: result });
  });
}

export const collateralController = new CollateralController();