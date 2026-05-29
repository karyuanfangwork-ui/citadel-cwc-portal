import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { creditExportLimiter } from '../../middleware/rateLimit.middleware';
import { dashboardService } from '../services/dashboard.service';

const router = Router();

router.use(authenticate);

// Pipeline report — aggregated counts by state, SLA breach info, CSV export
// §2.8 — Export endpoints are rate-limited to prevent bulk PII extraction
router.get('/pipeline', creditExportLimiter, requirePermission('credit:read'), async (req, res) => {
  const format = (req.query.format as string) || 'json';
  const data = await dashboardService.getPipelineDashboard({
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
  });

  if (format === 'csv') {
    const header = 'State,Count,Avg Days In State';
    const rows = data.states.map(s => `${s.state},${s.count},${s.avgDaysInState}`);
    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=pipeline-report.csv');
    return res.send(csv);
  }

  res.json({ status: 'success', data });
});

// Exposure report — top borrowers, sector breakdown, rating distribution
// §2.8 — Export endpoints are rate-limited
router.get('/exposure', creditExportLimiter, requirePermission('credit:read'), async (req, res) => {
  const format = (req.query.format as string) || 'json';
  const data = await dashboardService.getExposureDashboard({
    topN: req.query.topN ? Number(req.query.topN) : undefined,
  });

  if (format === 'csv') {
    const header = 'Type,Name,Sector,Rating,Exposure';
    const rows = data.topBorrowers.map(b => `Borrower,${b.borrowerName},${b.industry || 'Unknown'},${b.rating || 'NR'},${b.totalExposure}`);
    const sectorRows = data.sectorBreakdown.map(s => `Sector,${s.sector},-,${s.count},${s.totalExposure}`);
    const csv = [header, ...rows, ...sectorRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=exposure-report.csv');
    return res.send(csv);
  }

  res.json({ status: 'success', data });
});

export default router;