import { createApplicationFacilitySchema } from '../applicationFacility.validator';

const validBody = { facilityType: 'TERM_LOAN', amount: '100000' };

function parse(overrides: Record<string, unknown>) {
  return createApplicationFacilitySchema.safeParse({ body: { ...validBody, ...overrides } });
}

describe('createApplicationFacilitySchema — amount & tenor', () => {
  it('accepts a positive amount', () => {
    expect(parse({ amount: '100000' }).success).toBe(true);
  });

  it('rejects a zero amount', () => {
    expect(parse({ amount: '0' }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(parse({ amount: -1 }).success).toBe(false);
  });

  it('accepts tenor of 360 months', () => {
    expect(parse({ tenorMonths: 360 }).success).toBe(true);
  });

  it('rejects tenor above 360 months', () => {
    expect(parse({ tenorMonths: 361 }).success).toBe(false);
  });
});