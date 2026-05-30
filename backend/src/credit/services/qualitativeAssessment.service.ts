import prisma from '../../utils/prisma';

export const SLIDER_TO_SCORE: Record<number, number> = {
  1: 10,
  2: 32,
  3: 50,
  4: 68,
  5: 90,
};

export interface QualitativeScores {
  managementScore: number;   // 1–5
  relationshipScore: number; // 1–5
  industryScore: number;     // 1–5
  collateralScore: number;   // 1–5
}

export function toFactorScores(qa: QualitativeScores): {
  management: number;
  relationship: number;
  industry: number;
  collateral: number;
} {
  return {
    management: SLIDER_TO_SCORE[qa.managementScore] ?? 50,
    relationship: SLIDER_TO_SCORE[qa.relationshipScore] ?? 50,
    industry: SLIDER_TO_SCORE[qa.industryScore] ?? 50,
    collateral: SLIDER_TO_SCORE[qa.collateralScore] ?? 50,
  };
}

export async function upsertQualitativeAssessment(
  applicationId: string,
  assessedById: string,
  scores: QualitativeScores,
) {
  return prisma.qualitativeAssessment.upsert({
    where: { applicationId },
    create: { applicationId, assessedById, assessedAt: new Date(), ...scores },
    update: { assessedById, assessedAt: new Date(), ...scores },
  });
}

export async function getQualitativeAssessment(applicationId: string) {
  return prisma.qualitativeAssessment.findUnique({ where: { applicationId } });
}
