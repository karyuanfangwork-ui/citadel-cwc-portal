import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AuditChainService } from '../services/auditChain.service';
import { PiiReadLogService } from '../services/piiReadLog.service';
import { ExportControlService } from '../services/exportControl.service';
import { requireUser } from '../utils/requireUser';

class SecurityController {
  /**
   * POST /credit/security/audit-verify
   * Verify audit chain integrity for a credit application.
   * Requires: credit:read
   */
  verifyAuditChain = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'applicationId is required',
      });
    }

    const result = await AuditChainService.verifyChain(applicationId);

    res.json({
      status: 'success',
      data: result,
    });
  });

  /**
   * GET /credit/security/pii-logs
   * Get PII read-access logs with filters and pagination.
   * Requires: credit:admin
   */
  getPiiLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.query.userId as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const field = req.query.field as string | undefined;
    const dateFrom = req.query.dateFrom
      ? new Date(req.query.dateFrom as string)
      : undefined;
    const dateTo = req.query.dateTo
      ? new Date(req.query.dateTo as string)
      : undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = await PiiReadLogService.getPiiReadLogs({
      userId,
      resourceType,
      resourceId,
      field,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    res.json({
      status: 'success',
      data: result,
    });
  });

  /**
   * POST /credit/security/export
   * Request a PII data export with permission check and reason capture.
   * Requires: credit:export:pii
   */
  requestExport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = requireUser(req).id;
    const { resourceType, resourceId, format, reason } = req.body;

    if (!resourceType || !resourceId || !format || !reason) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'resourceType, resourceId, format, and reason are required',
      });
    }

    const result = await ExportControlService.requestExport(
      userId,
      resourceType,
      resourceId,
      format,
      reason,
    );

    res.json({
      status: 'success',
      data: result,
    });
  });
}

export const securityController = new SecurityController();