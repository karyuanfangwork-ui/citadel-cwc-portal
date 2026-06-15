import { Request, Response, NextFunction } from 'express';
import { getCaMemoData } from '../services/caMemoPdf.service';
import { buildApprovalPackHtml } from '../services/approvalPack.service';
import { enqueuePdf } from '../../services/pdfJob.service';

export async function getApprovalPack(req: Request, res: Response, next: NextFunction) {
  const format = String(req.query.format || 'html').toLowerCase();

  try {
    const app = await getCaMemoData(String(req.params.appId));
    const html = buildApprovalPackHtml(app);

    if (format === 'pdf') {
      const jobId = await enqueuePdf(html, 'credit/approval-pack/');
      return res.json({ status: 'success', data: { jobId, message: 'PDF generation started. Poll /api/v1/pdf-jobs/:jobId for the download URL.' } });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${app.applicationNo}-approval-pack.html"`);
    res.send(html);
  } catch (e) {
    next(e);
  }
}