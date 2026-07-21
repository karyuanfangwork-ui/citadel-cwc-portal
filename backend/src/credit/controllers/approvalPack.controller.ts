import { Request, Response, NextFunction } from 'express';
import { getCaMemoData } from '../services/caMemoPdf.service';
import { buildApprovalPackHtml } from '../services/approvalPack.service';
import { getLockedMemoVersion } from '../services/creditMemoVersion.service';
import { enqueuePdf } from '../../services/pdfJob.service';

export async function getApprovalPack(req: Request, res: Response, next: NextFunction) {
  const format = String(req.query.format || 'html').toLowerCase();
  const appId = String(req.params.appId);

  try {
    // P2.2d — If a locked memo version exists, use its data snapshot instead
    // of live data. This ensures the approval pack references the immutable
    // version that was locked at committee submission time.
    const lockedVersion = await getLockedMemoVersion(appId);

    let html: string;
    let applicationNo: string;

    if (lockedVersion?.dataSnapshot) {
      // Use the locked version's data snapshot and pre-built HTML
      html = buildApprovalPackHtml(lockedVersion.dataSnapshot as any);
      applicationNo = (lockedVersion.dataSnapshot as any).applicationNo ?? appId;
    } else {
      // No locked version — fall back to live data (pre-committee or draft)
      const app = await getCaMemoData(appId);
      html = buildApprovalPackHtml(app);
      applicationNo = app.applicationNo;
    }

    if (format === 'pdf') {
      const jobId = await enqueuePdf(html, 'credit/approval-pack/', (req as any).user?.id);
      return res.json({ status: 'success', data: { jobId, message: 'PDF generation started. Poll /api/v1/pdf-jobs/:jobId for the download URL.' } });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${applicationNo}-approval-pack.html"`);
    res.send(html);
  } catch (e) {
    next(e);
  }
}