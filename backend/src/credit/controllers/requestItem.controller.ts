import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { requestItemService } from '../services/requestItem.service';

class RequestItemController {
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const items = await requestItemService.listByApplication(applicationId);
    res.json({ status: 'success', data: { requestItems: items } });
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const item = await requestItemService.create({ ...req.body, applicationId });
    res.status(201).json({ status: 'success', data: { requestItem: item } });
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.itemId);
    const item = await requestItemService.update(id, req.body);
    if (!item) throw new AppError('Request item not found', 404);
    res.json({ status: 'success', data: { requestItem: item } });
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.itemId);
    const item = await requestItemService.delete(id);
    if (!item) throw new AppError('Request item not found', 404);
    res.json({ status: 'success', message: 'Request item deleted' });
  });
}

export const requestItemController = new RequestItemController();
