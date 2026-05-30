import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { conditionService } from '../services/condition.service';

class ConditionController {
  /**
   * GET /applications/:applicationId/conditions
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const conditionType = req.query.type as string | undefined;
    const conditions = await conditionService.listConditions(applicationId, {
      conditionType: conditionType as 'PRECEDENT' | 'SUBSEQUENT' | undefined,
    });
    res.json({ status: 'success', data: { conditions } });
  });

  /**
   * GET /conditions/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const condition = await conditionService.getCondition(id);
    if (!condition) {
      throw new AppError('Condition not found', 404);
    }
    res.json({ status: 'success', data: { condition } });
  });

  /**
   * POST /applications/:applicationId/conditions
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const condition = await conditionService.createCondition({ ...req.body, applicationId });
    res.status(201).json({ status: 'success', data: { condition } });
  });

  /**
   * PATCH /conditions/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const condition = await conditionService.updateCondition(id, req.body);
    if (!condition) {
      throw new AppError('Condition not found', 404);
    }
    res.json({ status: 'success', data: { condition } });
  });

  /**
   * POST /conditions/:id/complete
   */
  complete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.id;
    const condition = await conditionService.completeCondition(id, {
      ...req.body,
      fulfilledById: userId,
    });
    if (!condition) {
      throw new AppError('Condition not found', 404);
    }
    res.json({ status: 'success', data: { condition } });
  });

  /**
   * POST /conditions/:id/waive
   */
  waive = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.id;
    const condition = await conditionService.waiveCondition(id, {
      ...req.body,
      waivedById: userId,
    });
    if (!condition) {
      throw new AppError('Condition not found', 404);
    }
    res.json({ status: 'success', data: { condition } });
  });

  /**
   * GET /applications/:applicationId/cp-completion
   */
  cpCompletion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const result = await conditionService.checkCpCompletion(applicationId);
    res.json({ status: 'success', data: result });
  });
}

export const conditionController = new ConditionController();