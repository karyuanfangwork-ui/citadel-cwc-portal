import prisma from '../../utils/prisma';
import { getBorrowerIdentityValidationIssues } from '../validators/borrowerProfile.validator';

export type BorrowerApplicationReadinessTarget = 'profile' | 'income' | 'kyc';

export interface BorrowerApplicationReadinessBlocker {
  code: string;
  title: string;
  description: string;
  target: BorrowerApplicationReadinessTarget;
}

const IDENTITY_MESSAGES: Record<string, Omit<BorrowerApplicationReadinessBlocker, 'code'>> = {
  name: { title: 'Add borrower name', description: 'A borrower name is required before an application can be started.', target: 'profile' },
  nricPassport: { title: 'Add NRIC / Passport', description: 'The identity reference is required for this borrower type.', target: 'profile' },
  dateOfBirth: { title: 'Add date of birth', description: 'Date of birth is required for this borrower type.', target: 'profile' },
  nationality: { title: 'Add nationality', description: 'Nationality is required for this borrower type.', target: 'profile' },
  registrationNumber: { title: 'Add registration number', description: 'The registration number is required for this borrower type.', target: 'profile' },
  dateOfIncorporation: { title: 'Add incorporation date', description: 'The incorporation date is required for this borrower type.', target: 'profile' },
  businessNature: { title: 'Add business nature', description: 'Business nature is required for this borrower type.', target: 'profile' },
  phoneOrEmail: { title: 'Add primary contact', description: 'At least one phone number or email is required before an application can be started.', target: 'profile' },
};

const CODE_BY_FIELD: Record<string, string> = {
  name: 'IDENTITY_NAME_MISSING',
  nricPassport: 'IDENTITY_REFERENCE_MISSING',
  dateOfBirth: 'IDENTITY_DOB_MISSING',
  nationality: 'IDENTITY_NATIONALITY_MISSING',
  registrationNumber: 'BUSINESS_REGISTRATION_MISSING',
  dateOfIncorporation: 'BUSINESS_INCORPORATION_DATE_MISSING',
  businessNature: 'BUSINESS_NATURE_MISSING',
  phoneOrEmail: 'CONTACT_MISSING',
};

export async function getBorrowerApplicationReadiness(borrowerId: string) {
  const profile = await prisma.borrowerProfile.findFirst({
    where: { id: borrowerId, deletedAt: null },
    select: {
      id: true,
      borrowerType: true,
      name: true,
      nricPassport: true,
      dateOfBirth: true,
      nationality: true,
      registrationNumber: true,
      dateOfIncorporation: true,
      businessNature: true,
      phone: true,
      email: true,
      kycVerifiedAt: true,
      annualTurnover: true,
    },
  });

  if (!profile) return null;

  const [income, financialStatement] = await Promise.all([
    prisma.borrowerIncome.findUnique({ where: { borrowerId }, select: { id: true } }),
    prisma.financialStatement.findFirst({
      where: { borrowerProfileId: borrowerId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const blockers: BorrowerApplicationReadinessBlocker[] = getBorrowerIdentityValidationIssues(profile).map((issue) => ({
    code: CODE_BY_FIELD[issue.field] ?? issue.field.toUpperCase(),
    ...(IDENTITY_MESSAGES[issue.field] ?? { title: 'Complete borrower identity', description: issue.message, target: 'profile' }),
  }));

  if (!profile.kycVerifiedAt) {
    blockers.push({
      code: 'KYC_PENDING',
      title: 'Verify KYC',
      description: 'KYC verification is required before an application can be started.',
      target: 'kyc',
    });
  }

  const isRetail = profile.borrowerType === 'INDIVIDUAL' || profile.borrowerType === 'JOINT';
  const hasFinancials = isRetail
    ? Boolean(income)
    : Boolean(profile.annualTurnover != null || financialStatement);
  if (!hasFinancials) {
    blockers.push({
      code: 'INCOME_MISSING',
      title: isRetail ? 'Add income information' : 'Add financial information',
      description: isRetail
        ? 'Income and commitments are required before an application can be started.'
        : 'Turnover or financial statements are required before an application can be started.',
      target: 'income',
    });
  }

  return { ready: blockers.length === 0, blockers };
}
