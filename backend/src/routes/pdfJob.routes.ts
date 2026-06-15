import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPdfResult } from '../services/pdfJob.service';

const router = Router();

/**
 * GET /api/v1/pdf-jobs/:jobId
 * Poll for PDF generation status.
 * Returns { status: 'pending' | 'done' | 'error', presignedUrl?, error? }
 */
router.get('/:jobId', authenticate, async (req: Request, res: Response) => {
  const result = await getPdfResult(req.params.jobId as string);
  res.json({ status: 'success', data: result });
});

export default router;