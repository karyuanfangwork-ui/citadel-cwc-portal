/**
 * Validation middleware tests for credit mutation routes
 *
 * Tests that Zod validation middleware correctly rejects invalid payloads
 * with 400 status for the newly-validated route groups:
 *   1. Disbursement create/cancel
 *   2. Exposure summary upsert
 *   3. Score override request
 *   4. Credit document reject
 *   5. FX rate create (existing validation — sanity check)
 */

import { validate } from '../../../middleware/validate.middleware';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Helper to create mock req/res/next
function mockReqRes(body: unknown) {
  const req = { body, query: {}, params: {} } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

// ── 1. Disbursement create schema ──────────────────────────────────────

const createDisbursementSchema = z.object({
  body: z.object({
    totalAmount: z.number().positive('totalAmount must be a positive number'),
    currency: z.string().length(3, 'Currency must be a 3-letter ISO 4217 code').optional().default('MYR'),
    disbursementMethod: z.string().max(100).optional(),
    beneficiaryBank: z.string().max(200).optional(),
    beneficiaryAccount: z.string().max(50).optional(),
    referenceNote: z.string().max(2000).optional(),
  }),
});

describe('Disbursement validation', () => {
  it('rejects create with missing totalAmount', async () => {
    const { req, res, next } = mockReqRes({ currency: 'MYR' });
    const middleware = validate(createDisbursementSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects create with negative totalAmount', async () => {
    const { req, res, next } = mockReqRes({ totalAmount: -100 });
    const middleware = validate(createDisbursementSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid create payload', async () => {
    const { req, res, next } = mockReqRes({ totalAmount: 50000 });
    const middleware = validate(createDisbursementSchema);
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── 2. Exposure summary upsert schema ──────────────────────────────────

const upsertExposureSummarySchema = z.object({
  body: z.object({
    thisAppSecured: z.union([z.string(), z.number()]).nullable().optional(),
    thisAppUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    otherAppSecured: z.union([z.string(), z.number()]).nullable().optional(),
    otherAppUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    customerTotalSecured: z.union([z.string(), z.number()]).nullable().optional(),
    customerTotalUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    relatedCounterpartySecured: z.union([z.string(), z.number()]).nullable().optional(),
    relatedCounterpartyUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
    groupTotalSecured: z.union([z.string(), z.number()]).nullable().optional(),
    groupTotalUnsecured: z.union([z.string(), z.number()]).nullable().optional(),
  }),
});

describe('Exposure summary validation', () => {
  it('rejects upsert with non-numeric/non-string values for numeric fields', async () => {
    const { req, res, next } = mockReqRes({ thisAppSecured: [1, 2, 3] });
    const middleware = validate(upsertExposureSummarySchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid numeric upsert payload', async () => {
    const { req, res, next } = mockReqRes({ thisAppSecured: 100000, thisAppUnsecured: '50000' });
    const middleware = validate(upsertExposureSummarySchema);
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── 3. Score override request schema ────────────────────────────────────

const requestOverrideSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid('applicationId must be a valid UUID'),
    originalRating: z.string().min(1, 'originalRating is required').max(50),
    overrideRating: z.string().min(1, 'overrideRating is required').max(50),
    justification: z.string().max(5000).optional().default(''),
  }),
});

describe('Score override validation', () => {
  it('rejects override with missing applicationId', async () => {
    const { req, res, next } = mockReqRes({
      originalRating: 'A',
      overrideRating: 'B',
    });
    const middleware = validate(requestOverrideSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects override with invalid UUID', async () => {
    const { req, res, next } = mockReqRes({
      applicationId: 'not-a-uuid',
      originalRating: 'A',
      overrideRating: 'B',
    });
    const middleware = validate(requestOverrideSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid override payload', async () => {
    const { req, res, next } = mockReqRes({
      applicationId: '550e8400-e29b-41d4-a716-446655440000',
      originalRating: 'BB+',
      overrideRating: 'BBB-',
      justification: 'Strong collateral coverage',
    });
    const middleware = validate(requestOverrideSchema);
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── 4. Credit document reject schema ────────────────────────────────────

const rejectDocumentSchema = z.object({
  body: z.object({
    rejectionReason: z.string().min(1, 'rejectionReason is required').max(2000),
  }),
});

describe('Credit document reject validation', () => {
  it('rejects without rejectionReason', async () => {
    const { req, res, next } = mockReqRes({});
    const middleware = validate(rejectDocumentSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with empty rejectionReason', async () => {
    const { req, res, next } = mockReqRes({ rejectionReason: '' });
    const middleware = validate(rejectDocumentSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid reject payload', async () => {
    const { req, res, next } = mockReqRes({ rejectionReason: 'Document is blurry' });
    const middleware = validate(rejectDocumentSchema);
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── 5. FX rate create schema (existing — sanity check) ──────────────────

const createFxRateSchema = z.object({
  body: z.object({
    currency: z.string().length(3, 'Currency must be a 3-letter ISO 4217 code'),
    rateToBase: z.number().positive('Rate must be positive'),
    effectiveDate: z.string().datetime({ message: 'effectiveDate must be an ISO 8601 date string' }),
  }),
});

describe('FX rate validation (existing)', () => {
  it('rejects with missing fields', async () => {
    const { req, res, next } = mockReqRes({});
    const middleware = validate(createFxRateSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with invalid currency code length', async () => {
    const { req, res, next } = mockReqRes({
      currency: 'US',
      rateToBase: 1.0,
      effectiveDate: '2025-01-01T00:00:00Z',
    });
    const middleware = validate(createFxRateSchema);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});