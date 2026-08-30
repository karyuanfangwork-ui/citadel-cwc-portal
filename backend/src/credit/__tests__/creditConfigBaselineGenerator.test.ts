import { parseCreditConfigBaselineMode } from '../../../prisma/scripts/generate-credit-config-baseline';

describe('credit config baseline generator mode', () => {
  it('defaults to a read-only dry-run', () => {
    expect(parseCreditConfigBaselineMode([])).toBe('dry-run');
  });

  it('accepts explicit dry-run mode', () => {
    expect(parseCreditConfigBaselineMode(['--dry-run'])).toBe('dry-run');
  });

  it('requires an explicit apply-draft flag before any writes', () => {
    expect(parseCreditConfigBaselineMode(['--apply-draft'])).toBe('apply-draft');
  });

  it('rejects unknown or conflicting flags', () => {
    expect(() => parseCreditConfigBaselineMode(['--apply'])).toThrow('Unknown argument: --apply');
    expect(() => parseCreditConfigBaselineMode(['--dry-run', '--apply-draft'])).toThrow(
      'Use either --dry-run or --apply-draft, not both',
    );
  });
});
