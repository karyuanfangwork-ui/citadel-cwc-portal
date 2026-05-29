import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { exportTokenController } from '../controllers/exportToken.controller';
import { requireExportToken } from '../middleware/dlp.middleware';
import { dlpService } from '../services/dlp.service';
import { dashboardService } from '../services/dashboard.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { Response } from 'express';
import { creditExportLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// §2.5 — Export Token Management
// ---------------------------------------------------------------------------

/**
 * POST /export-tokens
 * Request a short-lived export token. Must be used within 5 minutes.
 * Requires: credit:read
 */
router.post(
  '/export-tokens',
  requirePermission('credit:read'),
  exportTokenController.createToken,
);

// ---------------------------------------------------------------------------
// §2.5 — Protected Export Endpoints (require export token)
// ---------------------------------------------------------------------------

/**
 * GET /exports/pipeline
 * Export pipeline dashboard data (CSV or JSON).
 * Requires: credit:read + valid export token + rate limit + DLP
 */
router.get(
  '/exports/pipeline',
  creditExportLimiter,
  requireExportToken,
  async (req: AuthRequest, res: Response) => {
    const isAdmin = (req as any).exportMeta?.userId && req.user?.roles?.some((r: any) =>
      ['CREDIT_ADMIN', 'CREDIT_MANAGER', 'ADMIN'].includes(r.role?.name ?? r.name)
    );

    const format = (req.query.format as string) || 'json';
    const data = await dashboardService.getPipelineDashboard({
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    });

    if (format === 'csv') {
      const header = 'State,Count,Avg Days In State';
      const rows = data.states.map((s: any) => `${s.state},${s.count},${s.avgDaysInState}`);
      let csv = [header, ...rows].join('\n');

      // §2.5 — Redact PII patterns from CSV content
      csv = dlpService.redactPiiPatterns(csv);
      // §2.5 — Inject watermark
      csv = dlpService.injectCsvWatermark(csv, req.user?.id ?? 'unknown');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=pipeline-report.csv');
      return res.send(csv);
    }

    // §2.5 — Redact PII in JSON response
    const redactedData = isAdmin ? data : dlpService.redactObject(data, false);
    const watermarkedData = dlpService.injectJsonWatermark(redactedData, req.user?.id ?? 'unknown');

    res.json({ status: 'success', data: watermarkedData });
  },
);

/**
 * GET /exports/exposure
 * Export exposure dashboard data (CSV or JSON).
 * Requires: credit:read + valid export token + rate limit + DLP
 */
router.get(
  '/exports/exposure',
  creditExportLimiter,
  requireExportToken,
  async (req: AuthRequest, res: Response) => {
    const format = (req.query.format as string) || 'json';
    const data = await dashboardService.getExposureDashboard({
      topN: req.query.topN ? Number(req.query.topN) : undefined,
    });

    if (format === 'csv') {
      const header = 'Type,Name,Sector,Rating,Exposure';
      let rows = data.topBorrowers.map((b: any) =>
        `Borrower,${b.borrowerName},${b.industry || 'Unknown'},${b.rating || 'NR'},${b.totalExposure}`
      );
      // §2.5 — Redact PII patterns from CSV rows
      rows = rows.map((row: string) => dlpService.redactPiiPatterns(row));
      const sectorRows = data.sectorBreakdown.map((s: any) =>
        `Sector,${s.sector},-,${s.count},${s.totalExposure}`
      );
      let csv = [header, ...rows, ...sectorRows].join('\n');
      // §2.5 — Inject watermark
      csv = dlpService.injectCsvWatermark(csv, req.user?.id ?? 'unknown');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=exposure-report.csv');
      return res.send(csv);
    }

    // §2.5 — Redact PII in JSON response for non-admin users
    const redactedData = dlpService.redactObject(data, false);
    const watermarkedData = dlpService.injectJsonWatermark(redactedData, req.user?.id ?? 'unknown');

    res.json({ status: 'success', data: watermarkedData });
  },
);

export default router;