import { Request, Response, NextFunction } from 'express';
import { generateCaMemo } from './caMemoPdf.controller';
import { getCaMemoData } from '../services/caMemoPdf.service';
import { buildApprovalPackHtml } from '../services/approvalPack.service';

/**
 * Approval Pack Preview — serves the full approval pack HTML with
 * named section anchors for in-app sidebar navigation.
 *
 * GET /credit/applications/:appId/approval-pack?format=html (default)
 * GET /credit/applications/:appId/approval-pack?format=pdf  (delegates to ca-memo)
 */
export async function getApprovalPack(req: Request, res: Response, next: NextFunction) {
  const format = String(req.query.format || 'html').toLowerCase();

  if (format === 'pdf') {
    // Delegate to existing CA Memo PDF download — same blob
    // In a future iteration we can assemble a richer PDF here
    return generateCaMemo(req, res, next);
  }

  // HTML preview with section anchors for sidebar navigation
  try {
    const app = await getCaMemoData(String(req.params.appId));
    const html = buildApprovalPackHtml(app);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${app.applicationNo}-approval-pack.html"`);
    res.send(html);
  } catch (e) {
    next(e);
  }
}