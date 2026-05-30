import { Request, Response, NextFunction } from 'express';
import { upsertRetailIncome, getRetailIncome, getDsrStatus } from '../services/retailIncome.service';

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const income = await getRetailIncome(String(req.params.appId));
    res.json({ data: income });
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction) {
  try {
    const { employmentType, monthlyGrossIncome } = req.body;
    if (!employmentType || monthlyGrossIncome == null) {
      return res.status(400).json({ error: 'employmentType and monthlyGrossIncome are required' });
    }
    const income = await upsertRetailIncome(String(req.params.appId), req.body);
    const dsrStatus = getDsrStatus(Number(income.dsrPercent ?? 0));
    res.json({ data: { ...income, dsrStatus } });
  } catch (err) {
    next(err);
  }
}
