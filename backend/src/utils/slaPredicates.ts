import { Prisma } from '@prisma/client';

/**
 * SLA reporting predicates.
 *
 * A paused request's raw slaDueAt is intentionally not adjusted until the
 * clock resumes. Reporting must therefore exclude paused requests from
 * breach/at-risk counts and treat paused requests with an SLA deadline as
 * currently within SLA.
 */
export function activeSlaBreachWhere(now = new Date()): Prisma.RequestWhereInput {
  return {
    slaPausedAt: null,
    slaDueAt: { lte: now },
  };
}

export function activeSlaAtRiskWhere(now = new Date()): Prisma.RequestWhereInput {
  return {
    slaPausedAt: null,
    slaDueAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
  };
}

export function withinSlaWhere(now = new Date()): Prisma.RequestWhereInput {
  return {
    OR: [
      {
        slaPausedAt: null,
        slaDueAt: { gt: now },
      },
      {
        slaPausedAt: { not: null },
        slaDueAt: { not: null },
      },
    ],
  };
}

export function noSlaWhere(): Prisma.RequestWhereInput {
  return { slaDueAt: null };
}
