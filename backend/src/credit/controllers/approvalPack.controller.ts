import { Request, Response, NextFunction } from 'express';
import { getCaMemoData } from '../services/caMemoPdf.service';
import { buildApprovalPackHtml } from '../services/approvalPack.service';
import { htmlToPdf } from '../services/htmlToPdf.service';

export async function getApprovalPack(req: Request, res: Response, next: NextFunction) {
  const format = String(req.query.format || 'html').toLowerCase();

  try {
    const app = await getCaMemoData(String(req.params.appId));
    const html = buildApprovalPackHtml(app);

    if (format === 'pdf') {
      const pdf = await htmlToPdf(html);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${app.applicationNo}-approval-pack.pdf"`);
      return res.send(pdf);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${app.applicationNo}-approval-pack.html"`);
    res.send(html);
  } catch (e) {
    next(e);
  }
}