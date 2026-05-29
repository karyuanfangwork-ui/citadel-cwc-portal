/**
 * Collateral & Insurance Monitoring Job — §1.3 + §1.4
 *
 * Runs daily (or on-demand) to:
 *   1. Check collateral valuation freshness
 *      - ≥9 months old → MEDIUM severity EarlyWarningSignal
 *      - ≥12 months old → HIGH severity EarlyWarningSignal
 *   2. Check insurance expiry
 *      - T-30 days → MEDIUM severity EarlyWarningSignal
 *      - T-7 days  → HIGH severity EarlyWarningSignal
 *      - Expired   → HIGH severity EarlyWarningSignal
 *   3. Hard-block state transition into ACTIVE/DISBURSED if any tangible
 *      collateral valuation > 12 months old
 *
 * Also provides a `checkCollateralFreshness()` function that can be called
 * from the transition service to enforce the hard-block.
 */

import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { SignalType, EarlyWarningSeverity } from '@prisma/client';

const NINE_MONTHS_MS = 9 * 30.44 * 24 * 60 * 60 * 1000;
const TWELVE_MONTHS_MS = 12 * 30.44 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30.44 * 24 * 60 * 60 * 1000;

// Tangible collateral types that require fresh valuations
const TANGIBLE_COLLATERAL_TYPES = [
  'PROPERTY',
  'LAND',
  'VEHICLE',
  'EQUIPMENT',
  'PLANT_MACHINERY',
  'FIXED_DEPOSIT',
  'MARKETABLE_SECURITIES',
  'INVENTORY',
];

// ---------------------------------------------------------------------------
// Collateral Valuation Freshness
// ---------------------------------------------------------------------------

interface StaleValuationResult {
  collateralId: string;
  applicationId: string;
  applicationNo: string;
  valuationDate: Date | null;
  ageMonths: number | null;
  severity: 'MEDIUM' | 'HIGH';
}

/**
 * Check all tangible collaterals for stale valuations.
 * Returns collaterals with valuations older than 9 months.
 */
export async function checkCollateralValuationFreshness(): Promise<StaleValuationResult[]> {
  logger.info('[CollateralMonitor] Checking collateral valuation freshness...');

  const now = new Date();
  const nineMonthsAgo = new Date(now.getTime() - NINE_MONTHS_MS);

  // Find collaterals with valuations older than 9 months (or no valuation date)
  const staleCollaterals = await prisma.collateral.findMany({
    where: {
      collateralType: { in: TANGIBLE_COLLATERAL_TYPES },
      valuationDate: { lt: nineMonthsAgo },
    },
    include: {
      facility: {
        select: {
          applicationId: true,
          application: {
            select: { id: true, applicationNo: true, state: true },
          },
        },
      },
      valuations: {
        orderBy: { valuationDate: 'desc' },
        take: 1,
      },
    },
  });

  // Also find collaterals with no valuation date at all
  const noValuationCollaterals = await prisma.collateral.findMany({
    where: {
      collateralType: { in: TANGIBLE_COLLATERAL_TYPES },
      valuationDate: null,
    },
    include: {
      facility: {
        select: {
          applicationId: true,
          application: {
            select: { id: true, applicationNo: true, state: true },
          },
        },
      },
    },
  });

  const results: StaleValuationResult[] = [];

  for (const collateral of staleCollaterals) {
    const valuationDate = collateral.valuationDate ?? collateral.valuations[0]?.valuationDate ?? null;
    const ageMonths = valuationDate
      ? Math.floor((now.getTime() - valuationDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
      : null;

    const ageMs = valuationDate ? now.getTime() - valuationDate.getTime() : Infinity;
    const severity: 'MEDIUM' | 'HIGH' = ageMs >= TWELVE_MONTHS_MS ? 'HIGH' : 'MEDIUM';

    results.push({
      collateralId: collateral.id,
      applicationId: collateral.facility.applicationId,
      applicationNo: collateral.facility.application.applicationNo,
      valuationDate,
      ageMonths,
      severity,
    });

    // Upsert EarlyWarningSignal (deduplicate by applicationId + signalType + open)
    await prisma.earlyWarningSignal.upsert({
      where: { id: `${collateral.id}-stale-valuation` },
      update: { severity, description: `Collateral valuation stale: ${ageMonths ?? 'N/A'} months old (threshold: 9 months). Collateral: ${collateral.description ?? collateral.collateralType}` },
      create: {
        id: `${collateral.id}-stale-valuation`,
        applicationId: collateral.facility.applicationId,
        signalType: SignalType.COLLATERAL_VALUATION_STALE,
        severity: severity === 'HIGH' ? EarlyWarningSeverity.HIGH : EarlyWarningSeverity.MEDIUM,
        description: `Collateral valuation stale: ${ageMonths ?? 'N/A'} months old (threshold: 9 months). Collateral: ${collateral.description ?? collateral.collateralType}`,
      },
    });
  }

  // Collaterals with no valuation at all → HIGH severity
  for (const collateral of noValuationCollaterals) {
    const alreadyTracked = results.some((r) => r.collateralId === collateral.id);
    if (alreadyTracked) continue;

    results.push({
      collateralId: collateral.id,
      applicationId: collateral.facility.applicationId,
      applicationNo: collateral.facility.application.applicationNo,
      valuationDate: null,
      ageMonths: null,
      severity: 'HIGH',
    });

    await prisma.earlyWarningSignal.upsert({
      where: { id: `${collateral.id}-no-valuation` },
      update: { severity: EarlyWarningSeverity.HIGH, description: `Collateral has no valuation date. Collateral: ${collateral.description ?? collateral.collateralType}` },
      create: {
        id: `${collateral.id}-no-valuation`,
        applicationId: collateral.facility.applicationId,
        signalType: SignalType.COLLATERAL_VALUATION_STALE,
        severity: EarlyWarningSeverity.HIGH,
        description: `Collateral has no valuation date. Collateral: ${collateral.description ?? collateral.collateralType}`,
      },
    });
  }

  logger.info(`[CollateralMonitor] Found ${results.length} stale valuations (${results.filter((r) => r.severity === 'HIGH').length} HIGH)`);
  return results;
}

// ---------------------------------------------------------------------------
// Insurance Expiry
// ---------------------------------------------------------------------------

interface InsuranceExpiryResult {
  insuranceId: string;
  collateralId: string;
  applicationId: string;
  applicationNo: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  severity: 'MEDIUM' | 'HIGH';
}

/**
 * Check all insurance covers for approaching/expired expiry dates.
 */
export async function checkInsuranceExpiry(): Promise<InsuranceExpiryResult[]> {
  logger.info('[InsuranceMonitor] Checking insurance expiry...');

  const now = new Date();

  // Find insurance covers expiring within 30 days or already expired
  const thirtyDaysFromNow = new Date(now.getTime() + THIRTY_DAYS_MS);

  const expiringInsurance = await prisma.insuranceCover.findMany({
    where: {
      expiryDate: { lte: thirtyDaysFromNow },
    },
    include: {
      collateral: {
        include: {
          facility: {
            select: {
              applicationId: true,
              application: {
                select: { id: true, applicationNo: true },
              },
            },
          },
        },
      },
    },
  });

  const results: InsuranceExpiryResult[] = [];

  for (const insurance of expiringInsurance) {
    const daysUntilExpiry = Math.ceil((insurance.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const severity: 'MEDIUM' | 'HIGH' = daysUntilExpiry <= 7 || daysUntilExpiry <= 0 ? 'HIGH' : 'MEDIUM';

    results.push({
      insuranceId: insurance.id,
      collateralId: insurance.collateralId,
      applicationId: insurance.collateral.facility.applicationId,
      applicationNo: insurance.collateral.facility.application.applicationNo,
      expiryDate: insurance.expiryDate,
      daysUntilExpiry,
      severity,
    });

    const description = daysUntilExpiry <= 0
      ? `Insurance EXPIRED on ${insurance.expiryDate.toISOString().split('T')[0]}. Policy: ${insurance.policyNumber ?? 'N/A'}, Insurer: ${insurance.insurer}`
      : `Insurance expires in ${daysUntilExpiry} days (on ${insurance.expiryDate.toISOString().split('T')[0]}). Policy: ${insurance.policyNumber ?? 'N/A'}, Insurer: ${insurance.insurer}`;

    await prisma.earlyWarningSignal.upsert({
      where: { id: `${insurance.id}-expiry` },
      update: {
        severity: severity === 'HIGH' ? EarlyWarningSeverity.HIGH : EarlyWarningSeverity.MEDIUM,
        description,
      },
      create: {
        id: `${insurance.id}-expiry`,
        applicationId: insurance.collateral.facility.applicationId,
        signalType: SignalType.INSURANCE_EXPIRY,
        severity: severity === 'HIGH' ? EarlyWarningSeverity.HIGH : EarlyWarningSeverity.MEDIUM,
        description,
      },
    });
  }

  logger.info(`[InsuranceMonitor] Found ${results.length} expiring/expired insurance covers (${results.filter((r) => r.severity === 'HIGH').length} HIGH)`);
  return results;
}

// ---------------------------------------------------------------------------
// Hard-block check: disallow ACTIVE/DISBURSED if stale collateral valuations
// ---------------------------------------------------------------------------

/**
 * Check if an application has any tangible collateral valuations older than 12 months.
 * Used by the transition service to block ACTIVE/DISBURSED transitions.
 */
export async function hasStaleCollateralValuations(applicationId: string): Promise<{
  blocked: boolean;
  staleCollaterals: Array<{ id: string; type: string; valuationDate: Date | null; ageMonths: number | null }>;
}> {
  const twelveMonthsAgo = new Date(Date.now() - TWELVE_MONTHS_MS);

  const facilities = await prisma.applicationFacility.findMany({
    where: { applicationId },
    select: { id: true },
  });

  const facilityIds = facilities.map((f) => f.id);

  const staleCollaterals = await prisma.collateral.findMany({
    where: {
      facilityId: { in: facilityIds },
      collateralType: { in: TANGIBLE_COLLATERAL_TYPES },
      OR: [
        { valuationDate: { lt: twelveMonthsAgo } },
        { valuationDate: null },
      ],
    },
    select: {
      id: true,
      collateralType: true,
      valuationDate: true,
    },
  });

  // Also check the latest valuation record for each collateral
  const results: Array<{ id: string; type: string; valuationDate: Date | null; ageMonths: number | null }> = [];

  for (const c of staleCollaterals) {
    const latestValuation = c.valuationDate
      ? c.valuationDate
      : null;

    if (!latestValuation) {
      results.push({ id: c.id, type: c.collateralType, valuationDate: null, ageMonths: null });
    } else {
      const ageMonths = Math.floor((Date.now() - latestValuation.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
      if (latestValuation < twelveMonthsAgo) {
        results.push({ id: c.id, type: c.collateralType, valuationDate: latestValuation, ageMonths });
      }
    }
  }

  return {
    blocked: results.length > 0,
    staleCollaterals: results,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point — run all monitoring checks
// ---------------------------------------------------------------------------
async function main() {
  console.log('🔍 Running Collateral & Insurance Monitor...\n');

  const [staleValuations, insuranceExpiry] = await Promise.all([
    checkCollateralValuationFreshness(),
    checkInsuranceExpiry(),
  ]);

  console.log('\n📊 Collateral Valuation Freshness:');
  console.log('─'.repeat(60));
  if (staleValuations.length === 0) {
    console.log('  ✅ No stale valuations found');
  } else {
    for (const r of staleValuations) {
      console.log(`  ${r.severity === 'HIGH' ? '🔴' : '🟡'} ${r.applicationNo} — ${r.ageMonths ?? 'N/A'} months old (valuation: ${r.valuationDate?.toISOString().split('T')[0] ?? 'NONE'})`);
    }
  }

  console.log('\n📊 Insurance Expiry:');
  console.log('─'.repeat(60));
  if (insuranceExpiry.length === 0) {
    console.log('  ✅ No expiring/expired insurance covers found');
  } else {
    for (const r of insuranceExpiry) {
      console.log(`  ${r.severity === 'HIGH' ? '🔴' : '🟡'} ${r.applicationNo} — ${r.daysUntilExpiry <= 0 ? 'EXPIRED' : `expires in ${r.daysUntilExpiry} days`} (${r.expiryDate.toISOString().split('T')[0]})`);
    }
  }

  await prisma.$disconnect();
}

// Run if called directly
if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Monitor failed:', err);
    process.exit(1);
  });
}