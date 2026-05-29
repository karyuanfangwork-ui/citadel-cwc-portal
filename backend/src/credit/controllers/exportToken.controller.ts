import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { dlpService } from '../services/dlp.service';

/**
 * §2.5 — Export Token Controller
 * Generates short-lived, single-use export tokens to prevent
 * unauthorized link sharing of PII data.
 */
class ExportTokenController {
  /**
   * POST /export-tokens — Request a new export token
   * Body: { exportType: string } — e.g. 'pipeline', 'exposure', 'applications'
   */
  createToken = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentication required', 401);

    const exportType = (req.body.exportType as string) || 'general';
    const token = await dlpService.createExportToken(userId, exportType);

    res.status(201).json({
      status: 'success',
      data: {
        token,
        exportType,
        expiresIn: 300, // 5 minutes in seconds
      },
    });
  });
}

export const exportTokenController = new ExportTokenController();