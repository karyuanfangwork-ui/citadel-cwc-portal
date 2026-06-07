import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { fatcaCrsService } from '../services/fatcaCrs.service';

class FatcaCrsController {
  /**
   * GET /borrowers/:borrowerId/fatca-crs
   */
  get = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.borrowerId);
    const declaration = await fatcaCrsService.getByBorrower(borrowerId);
    res.json({ status: 'success', data: { declaration } });
  });

  /**
   * PUT /borrowers/:borrowerId/fatca-crs
   */
  upsert = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.borrowerId);
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);

    const declaration = await fatcaCrsService.upsert(borrowerId, req.user.id, req.body);
    res.json({ status: 'success', data: { declaration } });
  });

  /**
   * PATCH /borrowers/:borrowerId/fatca-crs/verify
   */
  verify = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.borrowerId);
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);

    const existing = await fatcaCrsService.getByBorrower(borrowerId);
    if (!existing) throw new AppError('No FATCA/CRS declaration on file for this borrower', 404);

    try {
      const declaration = await fatcaCrsService.verify(existing.id, req.user.id);
      res.json({ status: 'success', data: { declaration } });
    } catch (err: any) {
      throw new AppError(err.message || 'Verification failed', 400);
    }
  });
}

export const fatcaCrsController = new FatcaCrsController();
