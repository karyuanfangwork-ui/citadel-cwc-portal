import { z } from 'zod';
import { FACILITY_TYPES } from '../services/applicationFacility.service';

const facilityTypeEnum = z.enum(FACILITY_TYPES);

const decimalString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

const phase2Fields = {
  pricingLabel: z.string().max(100).optional().nullable(),
  existingLimit: decimalString.optional().nullable(),
  proposedChange: decimalString.optional().nullable(),
  newLimit: decimalString.optional().nullable(),
  outstandingBalance: decimalString.optional().nullable(),
  undisbursedLimit: decimalString.optional().nullable(),
  approvingLevel: z.string().max(100).optional().nullable(),
  requestItemId: z.string().uuid().optional().nullable(),
};

export const createApplicationFacilitySchema = z.object({
  body: z.object({
    facilityType: facilityTypeEnum,
    amount: decimalString,
    tenorMonths: z.number().int().min(0).optional().nullable(),
    ratePct: decimalString.optional().nullable(),
    purpose: z.string().max(2000).optional().nullable(),
    approvedAmount: decimalString.optional().nullable(),
    approvedTenor: z.number().int().min(0).optional().nullable(),
    approvedRate: decimalString.optional().nullable(),
    ...phase2Fields,
  }),
});

export const updateApplicationFacilitySchema = z.object({
  body: z.object({
    facilityType: facilityTypeEnum.optional(),
    amount: decimalString.optional(),
    tenorMonths: z.number().int().min(0).optional().nullable(),
    ratePct: decimalString.optional().nullable(),
    purpose: z.string().max(2000).optional().nullable(),
    approvedAmount: decimalString.optional().nullable(),
    approvedTenor: z.number().int().min(0).optional().nullable(),
    approvedRate: decimalString.optional().nullable(),
    ...phase2Fields,
  }),
});

export type CreateApplicationFacilityInput = z.infer<typeof createApplicationFacilitySchema>['body'];
export type UpdateApplicationFacilityInput = z.infer<typeof updateApplicationFacilitySchema>['body'];