import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';

const prisma = new PrismaClient();

export interface PricingWorksheetDto {
  baseRateType: 'BLR' | 'OPR' | 'FIXED' | 'SORA' | 'KLIBOR';
  baseRatePct: number;
  creditSpreadPct: number;
  riskPremiumPct: number;
  administrationFeePct?: number;
  processingFeeFlat?: number;
  pricingJustification?: string;
}

interface ComputedRate {
  effectiveRatePct: number;
  effectiveYieldPct: number | null;
}

/**
 * Compute effective rate and yield from worksheet inputs.
 *
 * effectiveRatePct = baseRatePct + creditSpreadPct + riskPremiumPct
 * effectiveYieldPct = effectiveRatePct + annualised admin fee uplift
 */
function computeEffectiveRate(dto: PricingWorksheetDto, _tenorMonths?: number): ComputedRate {
  const base = Number(dto.baseRatePct) || 0;
  const spread = Number(dto.creditSpreadPct) || 0;
  const risk = Number(dto.riskPremiumPct) || 0;

  const effectiveRatePct = base + spread + risk;

  const adminFeePct = Number(dto.administrationFeePct) || 0;

  if (adminFeePct === 0) {
    return { effectiveRatePct, effectiveYieldPct: null };
  }

  // effectiveYieldPct = effectiveRatePct + admin fee annualised uplift (simplified)
  const effectiveYieldPct = effectiveRatePct + adminFeePct;

  return { effectiveRatePct, effectiveYieldPct };
}

class PricingService {
  /**
   * Upsert pricing worksheet for a facility and sync effectiveRatePct to ApplicationFacility.ratePct.
   */
  async upsert(facilityId: string, preparedById: string, dto: PricingWorksheetDto): Promise<any> {
    const facility = await prisma.applicationFacility.findUnique({
      where: { id: facilityId },
      include: { application: { select: { id: true } } },
    });
    if (!facility) {
      throw new AppError('Facility not found', 404);
    }

    const { effectiveRatePct, effectiveYieldPct } = computeEffectiveRate(dto, facility.tenorMonths ?? undefined);

    const worksheet = await prisma.pricingWorksheet.upsert({
      where: { facilityId },
      create: {
        facilityId,
        baseRateType: dto.baseRateType,
        baseRatePct: new Prisma.Decimal(dto.baseRatePct),
        creditSpreadPct: new Prisma.Decimal(dto.creditSpreadPct),
        riskPremiumPct: new Prisma.Decimal(dto.riskPremiumPct),
        administrationFeePct: dto.administrationFeePct != null ? new Prisma.Decimal(dto.administrationFeePct) : null,
        processingFeeFlat: dto.processingFeeFlat != null ? new Prisma.Decimal(dto.processingFeeFlat) : null,
        effectiveRatePct: new Prisma.Decimal(effectiveRatePct),
        effectiveYieldPct: effectiveYieldPct != null ? new Prisma.Decimal(effectiveYieldPct) : null,
        pricingJustification: dto.pricingJustification ?? null,
        preparedById,
      },
      update: {
        baseRateType: dto.baseRateType,
        baseRatePct: new Prisma.Decimal(dto.baseRatePct),
        creditSpreadPct: new Prisma.Decimal(dto.creditSpreadPct),
        riskPremiumPct: new Prisma.Decimal(dto.riskPremiumPct),
        administrationFeePct: dto.administrationFeePct != null ? new Prisma.Decimal(dto.administrationFeePct) : null,
        processingFeeFlat: dto.processingFeeFlat != null ? new Prisma.Decimal(dto.processingFeeFlat) : null,
        effectiveRatePct: new Prisma.Decimal(effectiveRatePct),
        effectiveYieldPct: effectiveYieldPct != null ? new Prisma.Decimal(effectiveYieldPct) : null,
        pricingJustification: dto.pricingJustification ?? null,
        preparedById,
        preparedAt: new Date(),
      },
    });

    // Sync effectiveRatePct back to the facility's ratePct
    await prisma.applicationFacility.update({
      where: { id: facilityId },
      data: { ratePct: new Prisma.Decimal(effectiveRatePct) },
    });

    // Log audit event
    await AuditChainService.appendEvent(
      facility.applicationId,
      'PRICING_WORKSHEET_SAVED',
      preparedById,
      'upsert',
      undefined,
      undefined,
      {
        facilityId,
        effectiveRatePct,
        effectiveYieldPct,
        baseRateType: dto.baseRateType,
      },
    );

    return worksheet;
  }

  /** Get worksheet by facility */
  async getByFacility(facilityId: string): Promise<any> {
    const worksheet = await prisma.pricingWorksheet.findUnique({
      where: { facilityId },
      include: { preparedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!worksheet) {
      throw new AppError('Pricing worksheet not found for this facility', 404);
    }
    return worksheet;
  }

  /** Compute effective rate without saving — preview utility */
  computeEffectiveRate(dto: PricingWorksheetDto, tenorMonths?: number): ComputedRate {
    return computeEffectiveRate(dto, tenorMonths);
  }
}

export const pricingService = new PricingService();