import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';
import { requireUser } from '../utils/requireUser';

class DashboardController {
  /**
   * GET /credit/dashboard/pipeline
   * Pipeline dashboard — application counts by state, avg days, SLA breaches
   */
  getPipelineDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
    const branchId = req.query.branchId as string | undefined;
    const assignedToMe = req.query.assignedToMe === 'true' ? req.user!.id : undefined;

    const result = await dashboardService.getPipelineDashboard({ dateFrom, dateTo, branchId, assignedToMe });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/approval-inbox
   * Approval inbox for the current user — grouped by urgency
   */
  getApprovalInbox = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const urgency = req.query.urgency as 'HIGH' | 'MEDIUM' | 'LOW' | undefined;

    const result = await dashboardService.getApprovalInbox(
      user.id,
      user.roles ?? [],
      user.permissions ?? [],
      { urgency },
    );
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/my-work
   * My Work dashboard — pending approvals, assigned cases, SLA breaches for the current user
   */
  getMyWork = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = requireUser(req).id;
    const branchId = req.query.branchId as string | undefined;

    const result = await dashboardService.getMyWorkDashboard(userId, branchId);
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/exposure
   * Exposure dashboard — top borrowers, sector breakdown, rating distribution
   */
  getExposureDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const topN = parseInt(req.query.topN as string, 10) || 10;
    const branchId = req.query.branchId as string | undefined;

    const result = await dashboardService.getExposureDashboard({ topN, branchId });
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

  /**
   * GET /credit/dashboard/exposure-summary
   * §2.6 — Exposure summary with approaching/breached limits
   */
  getExposureSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      rmId: req.query.rmId as string | undefined,
      borrowerGroupId: req.query.borrowerGroupId as string | undefined,
      riskRating: req.query.riskRating as string | undefined,
      branchId: req.query.branchId as string | undefined,
    };
    const result = await dashboardService.getExposureSummary(filters);
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/work-queue
   * 6 operational buckets with per-bucket SLA compliance %.
   */
  getWorkQueue = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branchId = req.query.branchId as string | undefined;
    const result = await dashboardService.getWorkQueue({ branchId });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/alerts
   * Alert tiles: High DSR, Expired Bureau, AML Review.
   */
  getDashboardAlerts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branchId = req.query.branchId as string | undefined;
    const result = await dashboardService.getDashboardAlerts({ branchId });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/activity
   * Cross-application recent activity feed.
   */
  getActivityFeed = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branchId = req.query.branchId as string | undefined;
    const assignedToMe = req.query.assignedToMe === 'true' ? req.user!.id : undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await dashboardService.getActivityFeed({ branchId, assignedToMe, page, limit });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit/dashboard/team-performance
   * SLA compliance, approval turnaround, bottleneck.
   */
  getTeamPerformance = asyncHandler(async (req: AuthRequest, res: Response) => {
    const branchId = req.query.branchId as string | undefined;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
    const result = await dashboardService.getTeamPerformance({ branchId, dateFrom, dateTo });
    res.json({ status: 'success', data: result });
  });
}

export const dashboardController = new DashboardController();