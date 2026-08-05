import { Request, Response, NextFunction } from 'express';
import { pricingService } from '../services/pricing.service';

export async function getPricing(req: Request, res: Response, next: NextFunction) {
  try {
    const facilityId = String(req.params.facilityId);
    const worksheet = await pricingService.getByFacility(facilityId);
    res.json({ status: 'success', data: { worksheet } });
  } catch (err) {
    next(err);
  }
}

export async function upsertPricing(req: Request, res: Response, next: NextFunction) {
  try {
    const facilityId = String(req.params.facilityId);
    const userId = (req as any).user?.id;
    const worksheet = await pricingService.upsert(facilityId, userId, req.body);
    res.json({ status: 'success', data: { worksheet } });
  } catch (err) {
    next(err);
  }
}

export async function computePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body;
    const tenorMonths = req.query.tenorMonths ? Number(req.query.tenorMonths) : undefined;
    const result = pricingService.computeEffectiveRate(dto, tenorMonths);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}