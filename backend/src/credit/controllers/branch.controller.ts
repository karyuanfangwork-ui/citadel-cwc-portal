import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { branchService } from '../services/branch.service';

class BranchController {
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const branches = await branchService.list(includeInactive);
    res.json({ status: 'success', data: { branches } });
  });

  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branch = await branchService.getOne(String(req.params.id));
    if (!branch) throw new AppError('Branch not found', 404);
    res.json({ status: 'success', data: { branch } });
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branch = await branchService.create(req.body);
    res.status(201).json({ status: 'success', data: { branch } });
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branch = await branchService.update(String(req.params.id), req.body);
    res.json({ status: 'success', data: { branch } });
  });

  deactivate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branch = await branchService.deactivate(String(req.params.id));
    res.json({ status: 'success', data: { branch } });
  });
}

export const branchController = new BranchController();
