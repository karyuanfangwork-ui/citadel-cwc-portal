import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { createBureauReport, upsertCreditProfile, upsertIncome } from '../services/borrowerCreditData.service';
import { getBorrowerSummary } from '../services/borrowerSummary.service';
import { listBorrowerActivity, logBorrowerActivity } from '../services/borrowerActivity.service';
import prisma from '../../utils/prisma';

class BorrowerCreditDataController {
  summary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.id);
    const summary = await getBorrowerSummary(borrowerId);
    res.json({ status: 'success', data: summary });
  });

  activity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.id);
    const limit = req.query.limit ? Number(String(req.query.limit)) : 20;
    const activity = await listBorrowerActivity(borrowerId, Number.isFinite(limit) ? limit : 20);
    res.json({ status: 'success', data: activity });
  });

  upsertCreditProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.id);
    const profile = await upsertCreditProfile(borrowerId, req.body);
    res.json({ status: 'success', data: profile });
  });

  upsertIncome = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.id);
    const income = await upsertIncome(borrowerId, req.body);
    res.json({ status: 'success', data: income });
  });

  createBureauReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.id);
    const report = await createBureauReport(borrowerId, req.body, req.user?.id);
    res.status(201).json({ status: 'success', data: report });
  });

  markKycVerified = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerId = String(req.params.id);
    const borrower = await prisma.borrowerProfile.findUnique({
      where: { id: borrowerId },
      select: { id: true },
    });

    if (!borrower) {
      throw new AppError('Borrower profile not found', 404);
    }

    const updatedBorrower = await prisma.borrowerProfile.update({
      where: { id: borrowerId },
      data: { kycVerifiedAt: new Date() },
    });

    await logBorrowerActivity(
      borrowerId,
      'KYC_VERIFIED',
      'KYC verified',
      'Manual KYC verification marked as complete',
      req.user?.id,
    );

    res.json({ status: 'success', data: updatedBorrower });
  });
}

export const borrowerCreditDataController = new BorrowerCreditDataController();
