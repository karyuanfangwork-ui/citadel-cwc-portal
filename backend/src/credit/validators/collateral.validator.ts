import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

export const createCollateralSchema = z.object({
  body: z.object({
    facilityId: z.string().uuid(),
    collateralType: z.enum(['PROPERTY', 'VEHICLE', 'FD', 'SECURITIES', 'OTHER']),
    description: z.string().max(2000).optional().nullable(),
    titleReference: z.string().max(255).optional().nullable(),
    registeredTo: z.string().max(255).optional().nullable(),
    marketValue: decimalString.optional().nullable(),
    forcedSaleValue: decimalString.optional().nullable(),
    valuationDate: z.coerce.date().optional().nullable(),
    valuer: z.string().max(255).optional().nullable(),
    insuranceCoverRequired: z.boolean().optional(),
  }),
});

export const updateCollateralSchema = z.object({
  body: z.object({
    collateralType: z.enum(['PROPERTY', 'VEHICLE', 'FD', 'SECURITIES', 'OTHER']).optional(),
    description: z.string().max(2000).optional().nullable(),
    titleReference: z.string().max(255).optional().nullable(),
    registeredTo: z.string().max(255).optional().nullable(),
    marketValue: decimalString.optional().nullable(),
    forcedSaleValue: decimalString.optional().nullable(),
    valuationDate: z.coerce.date().optional().nullable(),
    valuer: z.string().max(255).optional().nullable(),
    insuranceCoverRequired: z.boolean().optional(),
  }),
});

export const createValuationSchema = z.object({
  body: z.object({
    marketValue: decimalString,
    forcedSaleValue: decimalString,
    valuationDate: z.coerce.date(),
    valuer: z.string().max(255),
    reportReference: z.string().max(255).optional().nullable(),
  }),
});

export const createLienSchema = z.object({
  body: z.object({
    lienHolder: z.string().max(255),
    lienAmount: decimalString.optional().nullable(),
    priority: z.number().int().min(1).optional(),
    registeredAt: z.coerce.date().optional().nullable(),
  }),
});

export const dischargeLienSchema = z.object({
  body: z.object({
    dischargeDate: z.coerce.date(),
  }),
});

export const createInsuranceSchema = z.object({
  body: z.object({
    insurer: z.string().max(255),
    policyNumber: z.string().max(100).optional().nullable(),
    coverageAmount: decimalString,
    effectiveDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
  }),
});