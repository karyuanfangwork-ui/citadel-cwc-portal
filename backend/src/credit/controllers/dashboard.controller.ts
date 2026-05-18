import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';

class DashboardController {
  /**
   * GET /credit/dashboard/pipeline
   * Pipeline dashboard — application counts by state, avg days, SLA breaches
   */
  getPipelineDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const result = await dashboardService.getPipelineDashboard({ dateFrom, dateTo });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/approval-inbox
   * Approval inbox for the current user — grouped by urgency
   */
  getApprovalInbox = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const urgency = req.query.urgency as 'HIGH' | 'MEDIUM' | 'LOW' | undefined;

    const result = await dashboardService.getApprovalInbox(userId, { urgency });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/exposure
   * Exposure dashboard — top borrowers, sector breakdown, rating distribution
   */
  getExposureDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const topN = parseInt(req.query.topN as string, 10) || 10;

    const result = await dashboardService.getExposureDashboard({ topN });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/committee-calendar
   * Committee calendar — upcoming meetings with agenda counts
   */
  getCommitteeCalendar = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const result = await dashboardService.getCommitteeCalendar({ dateFrom, dateTo, limit });
    res.json({ status: 'success', data: result });
  });
}

export const dashboardController = new DashboardController();