import { z } from 'zod';

export const identityCheckSchema = z.object({
  body: z.object({
    draftId: z.string().uuid(),
    segment: z.enum(['INDIVIDUAL', 'SME', 'CORPORATE']),
    identifier: z.string().trim().min(4).max(100),
    identifierType: z.enum(['NRIC', 'PASSPORT', 'BUSINESS_REGISTRATION']),
  }),
});
