/**
 * Seed: Credit Approval Matrix
 *
 * Creates 3 approval authority tiers based on total exposure and risk rating:
 *   (a) Below 500K, any rating → 1 RM-level approver
 *   (b) 500K – 5M, any rating   → 2 Senior Manager approvers
 *   (c) Above 5M, any rating    → 3 Committee-level approvers
 *
 * Run: npx tsx prisma/seed-credit-approvals.ts
 */

import { PrismaClient, RiskRating } from '@prisma/client';

const prisma = new PrismaClient();

const APPROVAL_MATRICES = [
  {
    name: 'Tier 1 — RM Authority (<500K)',
    description:
      'All risk ratings. Single RM-level approval required for credit exposure below MYR 500,000.',
    minExposure: 0,
    maxExposure: 499999.99,
    minRating: RiskRating.AAA,
    maxRating: RiskRating.D,
    authorityLevel: 'CREDIT_RM',
    requiredApproverCount: 1,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
  },
  {
    name: 'Tier 2 — Senior Manager Authority (500K–5M)',
    description:
      'All risk ratings. Two Senior Manager approvals required for credit exposure between MYR 500,000 and MYR 5,000,000.',
    minExposure: 500000,
    maxExposure: 4999999.99,
    minRating: RiskRating.AAA,
    maxRating: RiskRating.D,
    authorityLevel: 'CREDIT_MANAGER',
    requiredApproverCount: 2,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
  },
  {
    name: 'Tier 3 — Committee Authority (>5M)',
    description:
      'All risk ratings. Three Committee-level approvals required for credit exposure above MYR 5,000,000.',
    minExposure: 5000000,
    maxExposure: 999999999999.99,
    minRating: RiskRating.AAA,
    maxRating: RiskRating.D,
    authorityLevel: 'CREDIT_COMMITTEE',
    requiredApproverCount: 3,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
  },
];

async function main() {
  console.log('🌱 Seeding credit approval matrices...');

  for (const matrix of APPROVAL_MATRICES) {
    // Check if a matrix with this name already exists
    const existing = await prisma.creditApprovalMatrix.findFirst({
      where: { name: matrix.name },
    });

    let result;
    if (existing) {
      result = await prisma.creditApprovalMatrix.update({
        where: { id: existing.id },
        data: {
          description: matrix.description,
          minExposure: matrix.minExposure,
          maxExposure: matrix.maxExposure,
          minRating: matrix.minRating,
          maxRating: matrix.maxRating,
          authorityLevel: matrix.authorityLevel,
          requiredApproverCount: matrix.requiredApproverCount,
          effectiveFrom: matrix.effectiveFrom,
          effectiveTo: matrix.effectiveTo,
          isActive: true,
        },
      });
    } else {
      result = await prisma.creditApprovalMatrix.create({
        data: {
          name: matrix.name,
          description: matrix.description,
          minExposure: matrix.minExposure,
          maxExposure: matrix.maxExposure,
          minRating: matrix.minRating,
          maxRating: matrix.maxRating,
          authorityLevel: matrix.authorityLevel,
          requiredApproverCount: matrix.requiredApproverCount,
          effectiveFrom: matrix.effectiveFrom,
          effectiveTo: matrix.effectiveTo,
          isActive: true,
        },
      });
    }

    console.log(`  ✅ ${matrix.name} (id: ${result.id})`);
  }

  console.log('✅ Credit approval matrices seeded.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());