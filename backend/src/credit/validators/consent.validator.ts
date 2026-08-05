import { z } from 'zod';

const consentPurposeEnum = z.enum(['PROCESSING', 'BUREAU_PULL', 'THIRD_PARTY_SHARING', 'MARKETING']);
const consentStatusEnum = z.enum(['ACTIVE', 'WITHDRAWN', 'EXPIRED']);

export const recordConsentSchema = z.object({
  subjectId: z.string().uuid(),
  subjectType: z.enum(['BORROWER', 'CONTACT']),
  purpose: consentPurposeEnum,
  consentText: z.string().optional(),
  consentTextVersion: z.string().optional(),
  evidence: z.enum(['WEB_FORM', 'VERBAL', 'DOCUMENT', 'EMAIL']).optional(),
  channel: z.enum(['PORTAL', 'BRANCH', 'PHONE', 'EMAIL']).optional(),
  applicationId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const withdrawConsentSchema = z.object({
  reason: z.string().min(1, 'Withdrawal reason is required'),
});

export const listConsentsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  purpose: consentPurposeEnum.optional(),
  status: consentStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});