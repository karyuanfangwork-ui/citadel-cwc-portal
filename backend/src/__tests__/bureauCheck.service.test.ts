jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findUnique: jest.fn(),
    },
    creditBureauCheck: {
      findFirst: jest.fn(),
    },
    bureauChecklist: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../utils/prisma';
import { applyBureauCaps, RATING_ORDER, upsertBureauChecklist } from '../credit/services/bureauCheck.service';
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

describe('upsertBureauChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips relation fields before calling prisma upsert', async () => {
    const upsert = (prisma as any).bureauChecklist.upsert as jest.Mock;
    upsert.mockResolvedValue({ id: 'checklist-1' });

    await upsertBureauChecklist('app-1', 'user-1', {
      ccrisUploaded: false,
      ctosUploaded: false,
      noAdverseRecord: true,
      adverseExceptionReason: '',
      amlScreeningDone: true,
      tickedBy: null,
      verifiedBy: null,
    } as any);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { applicationId: 'app-1' },
      create: {
        applicationId: 'app-1',
        tickedById: 'user-1',
        tickedAt: expect.any(Date),
        ccrisUploaded: false,
        ctosUploaded: false,
        noAdverseRecord: true,
        adverseExceptionReason: '',
        amlScreeningDone: true,
      },
      update: expect.objectContaining({
        tickedById: 'user-1',
        ccrisUploaded: false,
        ctosUploaded: false,
        noAdverseRecord: true,
        adverseExceptionReason: '',
        amlScreeningDone: true,
      }),
    }));

    const call = upsert.mock.calls[0][0];
    expect(call.create.tickedBy).toBeUndefined();
    expect(call.create.verifiedBy).toBeUndefined();
    expect(call.update.tickedBy).toBeUndefined();
    expect(call.update.verifiedBy).toBeUndefined();
  });

  it('allows Personal Fast checklist ticks without uploaded bureau PDFs', async () => {
    const findUnique = (prisma as any).creditApplication.findUnique as jest.Mock;
    const findFirst = (prisma as any).creditBureauCheck.findFirst as jest.Mock;
    const upsert = (prisma as any).bureauChecklist.upsert as jest.Mock;

    findUnique.mockResolvedValue({ lane: 'PERSONAL_FAST' });
    findFirst.mockResolvedValue(null);
    upsert.mockResolvedValue({ id: 'checklist-1' });

    await expect(
      upsertBureauChecklist('app-1', 'user-1', {
        ccrisUploaded: true,
        ctosUploaded: true,
        noAdverseRecord: true,
        adverseExceptionReason: '',
        amlScreeningDone: true,
      }),
    ).resolves.toEqual({ id: 'checklist-1' });

    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
  });
});
