/**
 * P2-3: SME Financial Assessment Controller
 *
 * API endpoints for SME-specific financial assessment.
 */

import { Request, Response } from 'express';
import { smeFinancialService } from '../services/smeFinancial.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /sme/assessment/:borrowerProfileId
 * Returns the full SME financial assessment for a borrower profile.
 */
export const getSmeAssessment = async (req: Request, res: Response) => {
  const borrowerProfileId = req.params.borrowerProfileId as string;

  try {
    const assessment = await smeFinancialService.getSmeAssessment(borrowerProfileId);
    res.json({ status: 'success', data: assessment });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ status: 'error', message: err.message });
    }
    throw err;
  }
};

/**
 * GET /sme/dual-assessment/:borrowerProfileId
 * Returns the dual assessment (owner DSR + business DSCR) for a sole proprietor.
 */
export const getDualAssessment = async (req: Request, res: Response) => {
  const borrowerProfileId = req.params.borrowerProfileId as string;

  try {
    const dualAssessment = await smeFinancialService.computeDualAssessment(borrowerProfileId);
    res.json({ status: 'success', data: dualAssessment });
  } catch (err: any) {
    throw err;
  }
};

/**
 * POST /sme/validate-statement-type
 * Validates whether the provided financial statement type is acceptable for the borrower.
 * Body: { borrowerProfileId, smeFinancialStatementType, yearsTrading, annualAmount }
 */
export const validateStatementType = async (req: Request, res: Response) => {
  const { smeFinancialStatementType, yearsTrading, annualAmount } = req.body;

  const result = smeFinancialService.validateFinancialStatementType(
    smeFinancialStatementType ?? null,
    yearsTrading ?? null,
    annualAmount ?? null,
  );

  res.json({ status: 'success', data: result });
};

/**
 * POST /sme/recommend-statement-type/:borrowerProfileId
 * Recommends the required/acceptable financial statement type based on borrower profile.
 */
export const recommendStatementType = async (req: Request, res: Response) => {
  const borrowerProfileId = req.params.borrowerProfileId as string;

  const profile = await prisma.borrowerProfile.findUnique({
    where: { id: borrowerProfileId },
    select: {
      borrowerType: true,
      annualTurnover: true,
      yearsTrading: true,
      smeFinancialStatementType: true,
    },
  });

  if (!profile) {
    return res.status(404).json({ status: 'error', message: 'Borrower profile not found' });
  }

  const annualAmount = profile.annualTurnover ? Number(profile.annualTurnover) : null;
  const requiresAudited = smeFinancialService.requiresAuditedAccounts(profile.yearsTrading, annualAmount);
  const acceptsManagement = smeFinancialService.acceptsManagementAccounts(profile.yearsTrading);

  let recommendation: string;
  if (requiresAudited) {
    recommendation = 'AUDITED';
  } else if (acceptsManagement) {
    recommendation = 'MANAGEMENT';
  } else {
    recommendation = 'AUDITED';
  }

  res.json({
    status: 'success',
    data: {
      borrowerProfileId,
      borrowerType: profile.borrowerType,
      yearsTrading: profile.yearsTrading,
      annualTurnover: annualAmount,
      requiresAudited,
      acceptsManagement,
      recommendation,
      currentStatementType: profile.smeFinancialStatementType,
    },
  });
};