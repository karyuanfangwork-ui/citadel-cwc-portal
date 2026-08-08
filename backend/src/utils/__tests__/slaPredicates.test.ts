import {
  activeSlaAtRiskWhere,
  activeSlaBreachWhere,
  noSlaWhere,
  withinSlaWhere,
} from '../slaPredicates';

describe('SLA reporting predicates', () => {
  const now = new Date('2026-08-07T07:00:00.000Z');

  it('only treats expired active clocks as breached', () => {
    expect(activeSlaBreachWhere(now)).toEqual({
      slaPausedAt: null,
      slaDueAt: { lte: now },
    });
  });

  it('only treats active clocks due within 24 hours as at risk', () => {
    expect(activeSlaAtRiskWhere(now)).toEqual({
      slaPausedAt: null,
      slaDueAt: { lte: new Date('2026-08-08T07:00:00.000Z') },
    });
  });

  it('counts an active future deadline or paused deadline as within SLA', () => {
    expect(withinSlaWhere(now)).toEqual({
      OR: [
        { slaPausedAt: null, slaDueAt: { gt: now } },
        { slaPausedAt: { not: null }, slaDueAt: { not: null } },
      ],
    });
  });

  it('identifies requests without an SLA deadline', () => {
    expect(noSlaWhere()).toEqual({ slaDueAt: null });
  });
});
