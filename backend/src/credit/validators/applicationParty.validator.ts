import { z } from 'zod';
import { PARTY_ROLES } from '../services/applicationParty.service';

const partyRoleEnum = z.enum(PARTY_ROLES);

const pctString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

export const createApplicationPartySchema = z.object({
  body: z.object({
    borrowerProfileId: z.string().uuid(),
    role: partyRoleEnum,
    liabilityPct: pctString.optional().nullable(),
  }),
});

export const updateApplicationPartySchema = z.object({
  body: z.object({
    role: partyRoleEnum.optional(),
    liabilityPct: pctString.optional().nullable(),
  }),
});

export type CreateApplicationPartyInput = z.infer<typeof createApplicationPartySchema>['body'];
export type UpdateApplicationPartyInput = z.infer<typeof updateApplicationPartySchema>['body'];