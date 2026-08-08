import { submitApprovalActionSchema } from '../approval.validator';

// The schema is wrapped for the validate() middleware; unwrap to the body shape
// used by the route. Match whatever the export actually is — if the schema is
// `z.object({ body: ... })`, parse `{ body: payload }`.
function parse(payload: Record<string, unknown>) {
  return submitApprovalActionSchema.safeParse({ body: payload });
}

describe('submitApprovalActionSchema — RETURN reason (LOS-019)', () => {
  it('rejects a RETURN with no comment', () => {
    const result = parse({ decision: 'RETURN' });
    expect(result.success).toBe(false);
  });

  it('rejects a RETURN with a whitespace-only comment', () => {
    const result = parse({ decision: 'RETURN', comment: '     ' });
    expect(result.success).toBe(false);
  });

  it('rejects a RETURN with a comment under 10 characters', () => {
    const result = parse({ decision: 'RETURN', comment: 'too short' });
    expect(result.success).toBe(false);
  });

  it('accepts a RETURN with a substantive reason', () => {
    const result = parse({
      decision: 'RETURN',
      comment: 'Latest audited financials are missing for FY2025.',
    });
    expect(result.success).toBe(true);
  });

  it('still accepts an APPROVE with no comment', () => {
    expect(parse({ decision: 'APPROVE' }).success).toBe(true);
  });
});