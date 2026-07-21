import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPdfResult } from '../services/pdfJob.service';

const router = Router();

/**
 * GET /api/v1/pdf-jobs/:jobId
 * Poll for PDF generation status.
 * Returns { status: 'pending' | 'done' | 'error', presignedUrl?, error? }
 *
 * P01 Task 4 (Finding #13): Only the user who created the job can poll it.
 * The jobId is a cryptographically random string (unpredictable), but we also
 * pass the userId so getPdfResult can verify ownership.
 */
router.get('/:jobId', authenticate, async (req, res) => {
  const userId = (req as any).user?.id;
  const result = await getPdfResult(req.params.jobId as string, userId);
  res.json({ status: 'success', data: result });
});

export default router;