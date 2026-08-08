/**
 * LOS-006 — approved financial statements are decision evidence and must not
 * drift after review.
 */
import { assertStatementMutable, MUTABLE_STATEMENT_STATUSES } from '../financial.service';
import { AppError } from '../../../middleware/error.middleware';
import { updateStatementSchema } from '../../validators/financial.validator';

describe('assertStatementMutable', () => {
  it.each(MUTABLE_STATEMENT_STATUSES)('allows a %s statement to be edited', (status) => {
    expect(() => assertStatementMutable(status, 'edit line items')).not.toThrow();
  });

  it.each(['REVIEWED', 'APPROVED'])('blocks edits to a %s statement', (status) => {
    try {
      assertStatementMutable(status, 'edit line items');
      throw new Error('expected assertStatementMutable to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(400);
      expect((e as AppError).message).toMatch(/edit line items/);
    }
  });
});

describe('updateStatementSchema — governance fields (LOS-006)', () => {
  it('strips or rejects status on the generic PATCH', () => {
    const parsed = updateStatementSchema.safeParse({ body: { status: 'APPROVED' } });
    // Either the schema rejects it outright, or it strips the field. Both are
    // acceptable; silently persisting it is not.
    if (parsed.success) {
      expect((parsed.data.body as Record<string, unknown>).status).toBeUndefined();
    } else {
      expect(parsed.success).toBe(false);
    }
  });

  it('strips or rejects reviewedById on the generic PATCH', () => {
    const parsed = updateStatementSchema.safeParse({
      body: { reviewedById: '11111111-1111-4111-8111-111111111111' },
    });
    if (parsed.success) {
      expect((parsed.data.body as Record<string, unknown>).reviewedById).toBeUndefined();
    } else {
      expect(parsed.success).toBe(false);
    }
  });

  it('still accepts legitimate descriptive edits', () => {
    const parsed = updateStatementSchema.safeParse({
      body: { auditorName: 'Ernst & Young', isQualified: false },
    });
    expect(parsed.success).toBe(true);
  });
});