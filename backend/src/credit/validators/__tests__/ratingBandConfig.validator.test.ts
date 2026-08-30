import {
  createRatingBandSchema,
  updateRatingBandSchema,
  upsertRiskFactorMatrixSchema,
  createDraftBandSetRouteSchema,
  bandIdsSchema,
} from '../ratingBandConfig.validator';

const validBand = { scoreMin: 0, scoreMax: 10, rating: 'AAA', riskCategory: 'LOW' };

describe('rating-band admin route validators', () => {
  it('accepts a valid band create', () => {
    expect(createRatingBandSchema.safeParse({ body: validBand }).success).toBe(true);
  });

  it('rejects invalid rating and inverted ranges', () => {
    expect(createRatingBandSchema.safeParse({ body: { ...validBand, rating: 'UNKNOWN' } }).success).toBe(false);
    expect(createRatingBandSchema.safeParse({ body: { ...validBand, scoreMin: 20, scoreMax: 10 } }).success).toBe(false);
  });

  it('rejects an inverted range in a patch', () => {
    expect(updateRatingBandSchema.safeParse({ body: { scoreMin: 20, scoreMax: 10 } }).success).toBe(false);
  });

  it('requires a known risk factor and bounded weight', () => {
    expect(upsertRiskFactorMatrixSchema.safeParse({ body: { factor: 'FRAUD', weight: 20 } }).success).toBe(true);
    expect(upsertRiskFactorMatrixSchema.safeParse({ body: { factor: 'UNKNOWN', weight: 20 } }).success).toBe(false);
    expect(upsertRiskFactorMatrixSchema.safeParse({ body: { factor: 'FRAUD', weight: 101 } }).success).toBe(false);
  });

  it('validates band-set payloads and UUID lists', () => {
    expect(createDraftBandSetRouteSchema.safeParse({ body: { name: 'Set', bands: [{ ...validBand, scoreMax: 100 }] } }).success).toBe(true);
    expect(bandIdsSchema.safeParse({ body: { bandIds: ['not-a-uuid'] } }).success).toBe(false);
  });
});
