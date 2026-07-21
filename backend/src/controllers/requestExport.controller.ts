/**
 * requestExport.controller.ts — Export multiple tickets as XLSX.
 *
 * POST /api/v1/requests/export/xlsx
 * Body: { ids: string[] }
 * Permission: request:export (agents & admins only)
 *
 * P02-11: Exports are now scoped to the principal's visible requests.
 * Any IDs not visible to the requesting user are silently excluded.
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { generateRequestsXlsx } from '../services/requestExport.service';
import { AppError } from '../middleware/error.middleware';
import { principalFromAuth } from '../security/resource-scope.service';

// Express AuthRequest has user; cast from Request for safety
interface AuthenticatedRequest extends Request {
    user?: any;
}

export const exportRequestsXlsx = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Please provide an array of request IDs to export', 400);
  }

  if (ids.length > 500) {
    throw new AppError('Cannot export more than 500 tickets at once', 400);
  }

  // P02-11: Build principal from authenticated user to scope the export
  const principal = principalFromAuth(req.user!);
  const xlsxBuffer = await generateRequestsXlsx(ids, principal);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `tickets-export-${timestamp}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', xlsxBuffer.length);
  res.send(xlsxBuffer);
});