import { Request, Response, NextFunction } from 'express';
import {
  createOrder,
  approveOrder,
  disburseOrder,
  cancelOrder,
  getOrder,
  checkDisbursementReadiness,
} from '../services/disbursement.service';

export async function createDisbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const applicationId = String(req.params.appId);
    const order = await createOrder(applicationId, userId, req.body);
    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
}

export async function getDisbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const order = await getOrder(applicationId);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
}

export async function approveDisbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const applicationId = String(req.params.appId);
    // Find the order for this application
    const { default: prisma } = await import('../../utils/prisma');
    const order = await prisma.disbursementOrder.findUnique({ where: { applicationId } });
    if (!order) {
      res.status(404).json({ error: { message: 'No disbursement order found for this application.' } });
      return;
    }
    const updated = await approveOrder(order.id, userId);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function confirmDisbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const applicationId = String(req.params.appId);
    const { default: prisma } = await import('../../utils/prisma');
    const order = await prisma.disbursementOrder.findUnique({ where: { applicationId } });
    if (!order) {
      res.status(404).json({ error: { message: 'No disbursement order found for this application.' } });
      return;
    }
    const updated = await disburseOrder(order.id, userId);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelDisbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const { reason } = req.body;
    const applicationId = String(req.params.appId);
    const { default: prisma } = await import('../../utils/prisma');
    const order = await prisma.disbursementOrder.findUnique({ where: { applicationId } });
    if (!order) {
      res.status(404).json({ error: { message: 'No disbursement order found for this application.' } });
      return;
    }
    const updated = await cancelOrder(order.id, userId, reason || 'No reason provided');
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getDisbursementReadiness(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const result = await checkDisbursementReadiness(applicationId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}