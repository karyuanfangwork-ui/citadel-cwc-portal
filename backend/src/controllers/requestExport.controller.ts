/**
 * requestExport.controller.ts — Export multiple tickets as XLSX.
 *
 * POST /api/v1/requests/export/xlsx
 * Body: { ids: string[] }
 * Permission: request:export (agents & admins only)
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { generateRequestsXlsx } from '../services/requestExport.service';
import { AppError } from '../middleware/error.middleware';

export const exportRequestsXlsx = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Please provide an array of request IDs to export', 400);
  }

  if (ids.length > 500) {
    throw new AppError('Cannot export more than 500 tickets at once', 400);
  }

  const xlsxBuffer = await generateRequestsXlsx(ids);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `tickets-export-${timestamp}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', xlsxBuffer.length);
  res.send(xlsxBuffer);
});