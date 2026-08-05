import { PrismaClient } from '@prisma/client';

export async function seedCreditRuleConfig(prisma: any) {
  const count = await prisma.creditRuleConfig.count();
  if (count > 0) return;

  const byBorrowerType: Record<string, { documentClass: any; label: string }[]> = {
    INDIVIDUAL: [
      { documentClass: 'NRIC_PASSPORT', label: 'NRIC / Passport' },
      { documentClass: 'PAYSLIP', label: 'Payslip (latest 3 months)' },
      { documentClass: 'BANK_STATEMENT', label: 'Bank Statement' },
    ],
    SOLE_PROPRIETOR: [
      { documentClass: 'NRIC_PASSPORT', label: 'NRIC / Passport' },
      { documentClass: 'SSM_CERT', label: 'SSM Certificate' },
      { documentClass: 'BANK_STATEMENT', label: 'Bank Statement' },
    ],
    JOINT: [
      { documentClass: 'JV_AGREEMENT', label: 'JV Agreement' },
      { documentClass: 'AUDITED_FINANCIALS', label: 'Audited Financials' },
    ],
    CORPORATE: [
      { documentClass: 'SSM_CERT', label: 'SSM Certificate' },
      { documentClass: 'AUDITED_FINANCIALS', label: 'Audited Financials' },
      { documentClass: 'MOA_AOA', label: 'Memorandum & Articles (MOA/AOA)' },
    ],
  };

  const data = Object.entries(byBorrowerType).flatMap(([borrowerType, documents]) =>
    documents.map((document, index) => ({
      kind: 'REQUIRED_DOCUMENT' as const,
      productType: null,
      lane: null,
      borrowerType: borrowerType as any,
      documentClass: document.documentClass,
      documentLabel: document.label,
      fieldPath: null,
      fieldLabel: null,
      isMandatory: true,
      sortOrder: index,
      isActive: true,
    })),
  );

  await prisma.creditRuleConfig.createMany({
    data,
    skipDuplicates: true,
  });
}
