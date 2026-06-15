/**
 * requestPdf.controller.ts — Enqueue a ticket PDF export job.
 *
 * GET /api/v1/requests/:id/export/pdf
 * Permission: request:export (agents & admins only)
 *
 * Returns { jobId } immediately. Client polls GET /api/v1/pdf-jobs/:jobId
 * for the presigned S3 download URL.
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { generateRequestPdf } from '../services/requestPdf.service';

export const exportRequestPdf = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const id = String(req.params.id);

  const jobId = await generateRequestPdf(id);

  res.json({ status: 'success', data: { jobId, message: 'PDF generation started. Poll /api/v1/pdf-jobs/:jobId for the download URL.' } });
});