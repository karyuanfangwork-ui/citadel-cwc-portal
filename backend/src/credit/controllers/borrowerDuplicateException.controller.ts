import { Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { borrowerDuplicateExceptionService } from '../services/borrowerDuplicateException.service';

export class BorrowerDuplicateExceptionController {
  listPending = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 25);
    const branchId = req.user?.permissions.includes('credit:admin') ? undefined : (req.user as any)?.branchId ?? null;
    const result = await borrowerDuplicateExceptionService.listPending(page, limit, branchId);
    res.json({ status: 'success', data: result });
  });

  request = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);
    const exception = await borrowerDuplicateExceptionService.request({ ...req.body, requestedById: req.user.id });
    res.status(201).json({ status: 'success', data: exception });
  });

  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);
    const canApprove = req.user.permissions.includes('credit:approve');
    const exception = await borrowerDuplicateExceptionService.getById(String(req.params.id), req.user.id, canApprove);
    res.json({ status: 'success', data: exception });
  });

  decision = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);
    const exception = await borrowerDuplicateExceptionService.decide(String(req.params.id), req.user.id, req.body.decision, req.body.comment);
    res.json({ status: 'success', data: exception });
  });
}

export const borrowerDuplicateExceptionController = new BorrowerDuplicateExceptionController();
