import { Request, Response, NextFunction } from 'express';
import { upsertRetailIncome, getRetailIncome, verifyFinancials, getDsrStatus, computeNetDsr } from '../services/retailIncome.service';
import { resolveRetailDsr } from '../services/scoring.service';

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

export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const { verified } = req.body;
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'verified (boolean) is required' });
    }
    const income = await verifyFinancials(String(req.params.appId), verified);
    res.json({ data: income });
  } catch (err) {
    next(err);
  }
}

export async function previewDsr(req: Request, res: Response, next: NextFunction) {
  try {
    const computed = computeNetDsr(req.body);
    const dsrPercent = resolveRetailDsr({
      dsrPercent: computed.grossDsrPercent,
      netDsrPercent: computed.netDsrPercent,
      dsrBasis: computed.dsrBasis,
    });
    res.json({
      data: {
        dsrPercent,
        netDsrPercent: computed.netDsrPercent,
        grossDsrPercent: computed.grossDsrPercent,
        dsrBasis: computed.dsrBasis,
      },
    });
  } catch (err) {
    next(err);
  }
}
