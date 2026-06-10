/**
 * requestPdf.controller.ts — Export a single ticket as PDF.
 *
 * GET /api/v1/requests/:id/export/pdf
 * Permission: request:export (agents & admins only)
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { generateRequestPdf } from '../services/requestPdf.service';

export const exportRequestPdf = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const id = String(req.params.id);

  const pdfBuffer = await generateRequestPdf(id);

  // Determine filename from reference number if possible
  // The service already validated the request exists, so we can use the id as fallback
  const filename = `request-${id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});