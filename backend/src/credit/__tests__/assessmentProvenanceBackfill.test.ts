import { parseBackfillMode } from '../../../prisma/scripts/backfill-assessment-provenance';

describe('assessment provenance backfill mode', () => {
  it('defaults to dry-run when no mode is supplied', () => {
    expect(parseBackfillMode([])).toBe('dry-run');
  });

  it('accepts explicit dry-run mode', () => {
    expect(parseBackfillMode(['--dry-run'])).toBe('dry-run');
  });

  it('requires the explicit apply flag for writes', () => {
    expect(parseBackfillMode(['--apply'])).toBe('apply');
  });

  it('rejects conflicting mode flags', () => {
    expect(() => parseBackfillMode(['--dry-run', '--apply'])).toThrow(
      'Use either --dry-run or --apply, not both',
    );
  });
});
