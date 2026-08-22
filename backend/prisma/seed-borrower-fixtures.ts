#!/usr/bin/env tsx
/**
 * Idempotent local borrower fixtures for the Credit Borrower Management page.
 * Synthetic data only; this script does not create login users.
 *
 * Usage:
 *   npx tsx prisma/seed-borrower-fixtures.ts
 */

import {
  BorrowerLifecycleStatus,
  BorrowerSegment,
  BorrowerType,
  PrismaClient,
  RiskRating,
  AmlRiskTier,
} from '@prisma/client';

const prisma = new PrismaClient();

const FIXTURES = [
  {
    borrowerNumber: 'SEED-BRW-001',
    borrowerType: BorrowerType.INDIVIDUAL,
    segment: BorrowerSegment.INDIVIDUAL,
    name: 'Aisha Rahman',
    nricPassport: '900101-14-5001',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Female',
    nationality: 'Malaysian',
    phone: '+6012-555-1001',
    email: 'aisha.rahman.seed@example.test',
    address: '12 Jalan Sentosa, Petaling Jaya, Selangor',
    mailingAddress: '12 Jalan Sentosa, Petaling Jaya, Selangor',
    occupation: 'Senior Finance Manager',
    employer: 'Citadel Manufacturing Sdn Bhd',
    annualIncome: 180000,
    netWorth: 650000,
    exposureLimit: 750000,
    totalExposure: 180000,
    creditRiskRating: RiskRating.A,
    amlRiskTier: AmlRiskTier.LOW,
    sourceOfWealth: 'Employment income and savings',
    purposeOfAccount: 'Personal credit facility',
  },
  {
    borrowerNumber: 'SEED-BRW-002',
    borrowerType: BorrowerType.INDIVIDUAL,
    segment: BorrowerSegment.INDIVIDUAL,
    name: 'Daniel Wong Wei Jian',
    nricPassport: '850612-10-5002',
    dateOfBirth: new Date('1985-06-12'),
    gender: 'Male',
    nationality: 'Malaysian',
    phone: '+6013-555-1002',
    email: 'daniel.wong.seed@example.test',
    address: '8 Persiaran Damai, Shah Alam, Selangor',
    mailingAddress: '8 Persiaran Damai, Shah Alam, Selangor',
    occupation: 'Architect',
    employer: 'Wong Design Studio',
    annualIncome: 240000,
    netWorth: 1100000,
    exposureLimit: 1000000,
    totalExposure: 420000,
    creditRiskRating: RiskRating.BBB,
    amlRiskTier: AmlRiskTier.LOW,
    sourceOfWealth: 'Professional income and property investment',
    purposeOfAccount: 'Property renovation facility',
  },
  {
    borrowerNumber: 'SEED-BRW-003',
    borrowerType: BorrowerType.SOLE_PROPRIETOR,
    segment: BorrowerSegment.SME,
    name: 'Kencana Retail Enterprise',
    registrationNumber: '202401012003',
    dateOfIncorporation: new Date('2014-03-10'),
    businessNature: 'Wholesale and retail distribution of household goods',
    businessType: 'Sole Proprietorship',
    authorizedRepresentative: 'Farid Ismail',
    industry: 'Retail Distribution',
    phone: '+603-555-2003',
    email: 'kencana.retail.seed@example.test',
    address: '25 Jalan Industri, Johor Bahru, Johor',
    mailingAddress: '25 Jalan Industri, Johor Bahru, Johor',
    annualTurnover: 4200000,
    annualIncome: 480000,
    netWorth: 1800000,
    yearsTrading: 10,
    sicCode: '47190',
    exposureLimit: 2500000,
    totalExposure: 1250000,
    creditRiskRating: RiskRating.BBB,
    amlRiskTier: AmlRiskTier.LOW,
    sourceOfWealth: 'Business trading income',
    purposeOfAccount: 'Working capital and inventory financing',
  },
  {
    borrowerNumber: 'SEED-BRW-004',
    borrowerType: BorrowerType.CORPORATE,
    segment: BorrowerSegment.SME,
    name: 'Northstar Engineering Sdn Bhd',
    registrationNumber: '201801045678',
    dateOfIncorporation: new Date('2018-11-22'),
    businessNature: 'Precision engineering and industrial equipment manufacturing',
    businessType: 'Sdn Bhd',
    authorizedRepresentative: 'Mei Ling Tan',
    industry: 'Manufacturing',
    phone: '+603-555-2004',
    email: 'northstar.engineering.seed@example.test',
    address: '17 Kawasan Perindustrian Glenmarie, Shah Alam, Selangor',
    mailingAddress: '17 Kawasan Perindustrian Glenmarie, Shah Alam, Selangor',
    annualTurnover: 18500000,
    annualIncome: 2100000,
    netWorth: 9200000,
    yearsTrading: 7,
    sicCode: '25999',
    exposureLimit: 10000000,
    totalExposure: 4800000,
    creditRiskRating: RiskRating.BBB,
    amlRiskTier: AmlRiskTier.LOW,
    sourceOfWealth: 'Business operations',
    purposeOfAccount: 'Factory expansion and equipment financing',
  },
  {
    borrowerNumber: 'SEED-BRW-005',
    borrowerType: BorrowerType.CORPORATE,
    segment: BorrowerSegment.CORPORATE,
    name: 'Greenfield Logistics Berhad',
    registrationNumber: '200901023456',
    dateOfIncorporation: new Date('2009-07-15'),
    businessNature: 'Regional logistics, warehousing, and supply-chain services',
    businessType: 'Berhad',
    authorizedRepresentative: 'Ravi Kumar',
    industry: 'Logistics',
    phone: '+603-555-2005',
    email: 'greenfield.logistics.seed@example.test',
    address: '3 Jalan Pelabuhan, Port Klang, Selangor',
    mailingAddress: '3 Jalan Pelabuhan, Port Klang, Selangor',
    annualTurnover: 92000000,
    annualIncome: 8600000,
    netWorth: 41000000,
    yearsTrading: 16,
    sicCode: '52290',
    exposureLimit: 35000000,
    totalExposure: 12800000,
    creditRiskRating: RiskRating.A,
    amlRiskTier: AmlRiskTier.MEDIUM,
    sourceOfWealth: 'Operating revenue and retained earnings',
    purposeOfAccount: 'Fleet renewal and warehouse automation',
  },
  {
    borrowerNumber: 'SEED-BRW-006',
    borrowerType: BorrowerType.CORPORATE,
    segment: BorrowerSegment.CORPORATE,
    name: 'Harbourview Property Holdings Sdn Bhd',
    registrationNumber: '201501067890',
    dateOfIncorporation: new Date('2015-09-03'),
    businessNature: 'Commercial property investment and development',
    businessType: 'Sdn Bhd',
    authorizedRepresentative: 'Sofia Lim',
    industry: 'Property Development',
    phone: '+603-555-2006',
    email: 'harbourview.property.seed@example.test',
    address: '41 Jalan Tun Razak, Kuala Lumpur',
    mailingAddress: '41 Jalan Tun Razak, Kuala Lumpur',
    annualTurnover: 56000000,
    annualIncome: 5200000,
    netWorth: 68000000,
    yearsTrading: 11,
    sicCode: '68100',
    exposureLimit: 30000000,
    totalExposure: 17400000,
    creditRiskRating: RiskRating.BB,
    amlRiskTier: AmlRiskTier.MEDIUM,
    sourceOfWealth: 'Property investment and development income',
    purposeOfAccount: 'Commercial property acquisition facility',
  },
] as const;

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: 'admin@test.local' }, select: { id: true } });
  if (!owner) throw new Error('admin@test.local is required before seeding borrower fixtures');

  let created = 0;
  let updated = 0;
  for (const fixture of FIXTURES) {
    const existing = await prisma.borrowerProfile.findUnique({
      where: { borrowerNumber: fixture.borrowerNumber },
      select: { id: true },
    });

    await prisma.borrowerProfile.upsert({
      where: { borrowerNumber: fixture.borrowerNumber },
      update: {
        ...fixture,
        relationshipOwnerId: owner.id,
        lifecycleStatus: BorrowerLifecycleStatus.ACTIVE,
        isActive: true,
      },
      create: {
        ...fixture,
        relationshipOwnerId: owner.id,
        lifecycleStatus: BorrowerLifecycleStatus.ACTIVE,
        isActive: true,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  const seeded = await prisma.borrowerProfile.count({
    where: { borrowerNumber: { in: FIXTURES.map(fixture => fixture.borrowerNumber) } },
  });
  console.log(`Borrower fixtures ready: ${seeded}/${FIXTURES.length} (created ${created}, updated ${updated})`);
}

main()
  .catch(error => {
    console.error('Borrower fixture seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
