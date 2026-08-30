import { config } from '../../config';
import { RiskRating } from '../types/credit.types';
import { GovernanceWarning } from './scoreFactorDefinition.service';
import { mapScoreToRatingFromBands } from './ratingBand.service';

export class RatingBandsUnconfiguredError extends Error {
  readonly scope: 'APPLICATION' | 'BORROWER';
  readonly subjectId: string;

  constructor(scope: 'APPLICATION' | 'BORROWER', subjectId: string) {
    super(`No active rating bands configured for ${scope.toLowerCase()} ${subjectId}`);
    this.name = 'RatingBandsUnconfiguredError';
    this.scope = scope;
    this.subjectId = subjectId;
  }
}

export interface RatingResolution {
  rating: RiskRating;
  usedFallback: boolean;
  warning?: GovernanceWarning & { code: string; scope: string; subjectId: string };
}

/** Resolve governed bands and fail closed in production when none are active. */
export async function resolveRatingOrFail(
  totalScore: number,
  context: { scope: 'APPLICATION' | 'BORROWER'; subjectId: string },
): Promise<RatingResolution> {
  const configured = await mapScoreToRatingFromBands(totalScore);
  if (configured !== null) {
    return { rating: configured, usedFallback: false };
  }
  if (config.env === 'production') {
    throw new RatingBandsUnconfiguredError(context.scope, context.subjectId);
  }
  return {
    rating: mapStaticRating(totalScore),
    usedFallback: true,
    warning: {
      code: 'STATIC_RATING_BAND_FALLBACK',
      scope: context.scope,
      subjectId: context.subjectId,
      field: 'ratingBand',
      message: `No active rating band configuration found for ${context.scope.toLowerCase()} ${context.subjectId}; using static fallback.`,
      severity: 'error',
    },
  };
}

/** Internal golden reference retained for tests and fallback resolution only. */
export function mapStaticRating(totalScore: number): RiskRating {
  if (totalScore >= 85) return RiskRating.AAA;
  if (totalScore >= 78) return RiskRating.AA;
  if (totalScore >= 70) return RiskRating.A;
  if (totalScore >= 62) return RiskRating.BBB;
  if (totalScore >= 55) return RiskRating.BB;
  if (totalScore >= 48) return RiskRating.B;
  if (totalScore >= 40) return RiskRating.CCC;
  if (totalScore >= 30) return RiskRating.CC;
  if (totalScore >= 20) return RiskRating.C;
  return RiskRating.D;
}
