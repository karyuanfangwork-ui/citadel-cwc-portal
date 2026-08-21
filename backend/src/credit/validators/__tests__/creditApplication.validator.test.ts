import { createCreditApplicationSchema } from '../creditApplication.validator';

const validBody = {
  borrowerProfileId: '11111111-1111-1111-1111-111111111111',
  productType: 'TERM_LOAN',
  requestedAmount: '50000',
};

function parse(overrides: Record<string, unknown>) {
  return createCreditApplicationSchema.safeParse({ body: { ...validBody, ...overrides } });
}

describe('createCreditApplicationSchema — amount & tenor', () => {
  it('accepts a positive requested amount', () => {
    expect(parse({ requestedAmount: '50000' }).success).toBe(true);
  });

  it('rejects a zero requested amount', () => {
    const r = parse({ requestedAmount: '0' });
    expect(r.success).toBe(false);
  });

  it('rejects a negative requested amount', () => {
    expect(parse({ requestedAmount: -100 }).success).toBe(false);
  });

  it('rejects a non-numeric requested amount', () => {
    expect(parse({ requestedAmount: 'abc' }).success).toBe(false);
  });

  it('accepts tenor of 360 months', () => {
    expect(parse({ requestedTenor: 360 }).success).toBe(true);
  });

  it('rejects tenor above 360 months', () => {
    expect(parse({ requestedTenor: 361 }).success).toBe(false);
  });

  it('accepts a DRAFT without a purpose or tenor', () => {
    expect(parse({ purpose: null, requestedTenor: null }).success).toBe(true);
  });

  it('rejects an invalid borrower UUID', () => {
    expect(parse({ borrowerProfileId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects an unsupported product type', () => {
    expect(parse({ productType: 'PERSONAL_FAST' }).success).toBe(false);
  });
});