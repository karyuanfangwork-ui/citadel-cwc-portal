import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { strService } from '../services/str.service';

class StrController {
  /** POST /str — Create draft STR */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const str = await strService.createStr(req.body);
    res.status(201).json({ status: 'success', data: { str } });
  });

  /** PATCH /str/:id — Update STR (before filing) */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const str = await strService.updateStr(id, req.body);
    res.json({ status: 'success', data: { str } });
  });

  /** PATCH /str/:id/submit — Submit for review (DRAFT → UNDER_REVIEW) */
  submitForReview = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const str = await strService.submitForReview(id);
    res.json({ status: 'success', data: { str } });
  });

  /** PATCH /str/:id/file — File with authority (→ FILED) */
  file = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const str = await strService.fileStr(id, {
      filingReference: req.body.filingReference,
      filingDate: req.body.filingDate ? new Date(req.body.filingDate) : undefined,
    });
    res.json({ status: 'success', data: { str } });
  });

  /** PATCH /str/:id/acknowledge — Acknowledge filed STR */
  acknowledge = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const str = await strService.acknowledgeStr(id, userId);
    res.json({ status: 'success', data: { str } });
  });

  /** PATCH /str/:id/close — Close STR */
  close = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { reason } = req.body;
    const str = await strService.closeStr(id, reason);
    res.json({ status: 'success', data: { str } });
  });

  /** GET /str — List STRs with filters */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await strService.listStrs({
      status: req.query.status as any,
      severity: req.query.severity as string,
      applicationId: req.query.applicationId as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ status: 'success', data: result });
  });

  /** GET /str/:id — Get single STR */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const str = await strService.getStr(id);
    res.json({ status: 'success', data: { str } });
  });

  /** POST /str/:id/link-aml — Link to AML rescreen event */
  linkAml = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { eventId } = req.body;
    const str = await strService.linkAmlRescreenEvent(id, eventId);
    res.json({ status: 'success', data: { str } });
  });
}

export const strController = new StrController();