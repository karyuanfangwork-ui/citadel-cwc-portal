import { applyBureauCaps, RATING_ORDER } from '../credit/services/bureauCheck.service';
import type { BureauCapInput } from '../credit/services/bureauCheck.service';

describe('RATING_ORDER', () => {
  it('has AAA at index 0 (highest)', () => expect(RATING_ORDER.indexOf('AAA')).toBe(0));
  it('has D at last index (lowest)', () => expect(RATING_ORDER.indexOf('D')).toBe(RATING_ORDER.length - 1));
  it('BBB is ranked below A', () => expect(RATING_ORDER.indexOf('BBB')).toBeGreaterThan(RATING_ORDER.indexOf('A')));
});

describe('applyBureauCaps', () => {
  it('returns base rating unchanged when no caps', () => {
    const result = applyBureauCaps('A', []);
    expect(result.effectiveRating).toBe('A');
    expect(result.capsApplied).toHaveLength(0);
  });

  it('caps to BBB when CCRIS SAA flag applied to AA base', () => {
    const caps: BureauCapInput[] = [{ reason: 'ccris_saa', maxRating: 'BBB' }];
    const result = applyBureauCaps('AA', caps);
    expect(result.effectiveRating).toBe('BBB');
    expect(result.capsApplied).toContain('ccris_saa');
  });

  it('applies the most restrictive cap when multiple apply', () => {
    const caps: BureauCapInput[] = [
      { reason: 'ccris_saa', maxRating: 'BBB' },
      { reason: 'ctos_adverse', maxRating: 'BB' },
    ];
    const result = applyBureauCaps('AAA', caps);
    expect(result.effectiveRating).toBe('BB');
    expect(result.capsApplied).toContain('ctos_adverse');
  });

  it('does not upgrade — cap never improves a low base rating', () => {
    const caps: BureauCapInput[] = [{ reason: 'ccris_missed_3', maxRating: 'BB' }];
    const result = applyBureauCaps('CCC', caps);
    expect(result.effectiveRating).toBe('CCC');
    expect(result.capsApplied).toHaveLength(0);
  });

  it('bankruptcy cap floors at C', () => {
    const caps: BureauCapInput[] = [{ reason: 'ccris_bankruptcy', maxRating: 'C' }];
    const result = applyBureauCaps('AAA', caps);
    expect(result.effectiveRating).toBe('C');
  });

  it('CTOS score < 300 caps at B', () => {
    const caps: BureauCapInput[] = [{ reason: 'ctos_score_lt_300', maxRating: 'B' }];
    const result = applyBureauCaps('AA', caps);
    expect(result.effectiveRating).toBe('B');
  });
});
