/**
 * Insights Controller
 *
 * Thin controller layer that delegates to the insights service
 * and enforces auth/permission checks.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import insightsService from '../services/insights.service';

/** Parse optional from/to query params into a Prisma date filter. */
function parseDateFilter(req: AuthRequest): { createdAt?: { gte?: Date; lte?: Date } } {
  const filter: { createdAt?: { gte?: Date; lte?: Date } } = {};
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.gte = new Date(from);
    if (to) filter.createdAt.lte = new Date(to);
  }
  return Object.keys(filter).length ? filter : {};
}

class InsightsController {
  getOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.roles?.[0] || 'USER';
      const userId = req.user?.id || '';
      const data = await insightsService.getOverview(role, userId);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getItsmSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dateFilter = parseDateFilter(req);
      const data = await insightsService.getItsmSummary(dateFilter);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getItsmTrends = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const granularity = (req.query.granularity as string) || 'day';

      // Validate granularity
      if (!['day', 'week', 'month'].includes(granularity)) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid granularity. Must be one of: day, week, month',
        });
        return;
      }

      // Default date range: last 30 days
      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const from = req.query.from ? new Date(req.query.from as string) : defaultFrom;
      const to = req.query.to ? new Date(req.query.to as string) : now;

      // Validate: max 90 days for daily granularity
      if (granularity === 'day') {
        const daysDiff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 90) {
          res.status(400).json({
            status: 'error',
            message: 'Daily granularity requires a date range of 90 days or less',
          });
          return;
        }
      }

      const data = await insightsService.getItsmTrends(
        from,
        to,
        granularity as 'day' | 'week' | 'month',
      );
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getItsmByServiceDesk = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dateFilter = parseDateFilter(req);
      const data = await insightsService.getItsmByServiceDesk(dateFilter);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getItsmByPriority = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dateFilter = parseDateFilter(req);
      const data = await insightsService.getItsmByPriority(dateFilter);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getItsmAgentWorkload = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await insightsService.getItsmAgentWorkload();
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getItsmSlaCompliance = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dateFilter = parseDateFilter(req);
      const data = await insightsService.getItsmSlaCompliance(dateFilter);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getCrmOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.roles?.[0] || 'USER';
      const userId = req.user?.id || '';
      const data = await insightsService.getCrmOverview(role, userId);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getCreditOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.roles?.[0] || 'USER';
      const userId = req.user?.id || '';
      const data = await insightsService.getCreditOverview(role, userId);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };
}

export default new InsightsController();