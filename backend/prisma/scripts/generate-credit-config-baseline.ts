import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type CreditConfigBaselineMode = 'dry-run' | 'apply-draft';

const REQUIRED_FIELDS = [
  { fieldPath: 'productType', fieldLabel: 'Credit product', sortOrder: 10 },
  { fieldPath: 'requestedAmount', fieldLabel: 'Requested amount', sortOrder: 20 },
  { fieldPath: 'currency', fieldLabel: 'Currency', sortOrder: 30 },
  { fieldPath: 'purpose', fieldLabel: 'Loan purpose', sortOrder: 40 },
] as const;

const RATING_BANDS = [
  { scoreMin: 85, scoreMax: 100, rating: 'AAA', riskCategory: 'LOW' },
  { scoreMin: 78, scoreMax: 84, rating: 'AA', riskCategory: 'LOW' },
  { scoreMin: 70, scoreMax: 77, rating: 'A', riskCategory: 'LOW' },
  { scoreMin: 62, scoreMax: 69, rating: 'BBB', riskCategory: 'MODERATE' },
  { scoreMin: 55, scoreMax: 61, rating: 'BB', riskCategory: 'MODERATE' },
  { scoreMin: 48, scoreMax: 54, rating: 'B', riskCategory: 'MODERATE' },
  { scoreMin: 40, scoreMax: 47, rating: 'CCC', riskCategory: 'HIGH' },
  { scoreMin: 30, scoreMax: 39, rating: 'CC', riskCategory: 'HIGH' },
  { scoreMin: 20, scoreMax: 29, rating: 'C', riskCategory: 'HIGH' },
  { scoreMin: 0, scoreMax: 19, rating: 'D', riskCategory: 'PROHIBITED' },
] as const;

const CORPORATE_WEIGHTS = {
  financial_performance: 20,
  leverage: 15,
  liquidity: 12,
  cashflow: 18,
  management: 10,
  industry: 8,
  collateral: 7,
  relationship: 5,
  market_conditions: 5,
};

const RETAIL_WEIGHTS = {
  financial_performance: 15,
  leverage: 10,
  liquidity: 10,
  cashflow: 30,
  management: 10,
  industry: 8,
  collateral: 7,
  relationship: 5,
  market_conditions: 5,
};

const SCORECARD_NAME = 'Draft Canonical Credit Scorecard v1';
const BAND_SET_NAME = 'Draft Canonical Rating Bands v1';

export function parseCreditConfigBaselineMode(argv: string[]): CreditConfigBaselineMode {
  const args = new Set(argv);
  const dryRun = args.has('--dry-run');
  const applyDraft = args.has('--apply-draft');
  const unknown = [...args].filter((arg) => arg !== '--dry-run' && arg !== '--apply-draft');

  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown[0]}`);
  }
  if (dryRun && applyDraft) {
    throw new Error('Use either --dry-run or --apply-draft, not both');
  }

  return applyDraft ? 'apply-draft' : 'dry-run';
}

function proposal() {
  return {
    requiredFields: REQUIRED_FIELDS.map((field) => ({
      kind: 'REQUIRED_FIELD',
      productType: null,
      lane: null,
      borrowerType: null,
      ...field,
      isMandatory: true,
      isActive: false,
    })),
    ratingBands: RATING_BANDS.map((band) => ({
      ...band,
      status: 'DRAFT',
      version: 1,
      name: BAND_SET_NAME,
    })),
    scorecard: {
      name: SCORECARD_NAME,
      isActive: false,
      version: 1,
      factorWeights: CORPORATE_WEIGHTS,
      retailFactorWeights: RETAIL_WEIGHTS,
    },
    governanceNotes: [
      'Candidate baseline only; not an approved lending methodology.',
      'Required fields are inactive until explicitly reviewed and activated.',
      'Rating bands remain DRAFT and cannot affect scoring.',
      'Scorecard and version remain inactive and cannot affect scoring.',
      'market_conditions has no live provider and retains the canonical 5% compatibility weight; review before activation.',
    ],
  };
}

async function inspectExisting() {
  const [requiredFields, draftBands, scorecard] = await Promise.all([
    prisma.creditRuleConfig.count({
      where: {
        kind: 'REQUIRED_FIELD',
        productType: null,
        lane: null,
        borrowerType: null,
        isActive: false,
        fieldPath: { in: REQUIRED_FIELDS.map((field) => field.fieldPath) },
      },
    }),
    prisma.ratingBandConfig.count({
      where: { name: BAND_SET_NAME, version: 1, status: 'DRAFT' },
    }),
    prisma.creditScorecard.findUnique({
      where: { name: SCORECARD_NAME },
      select: { id: true, isActive: true, versions: { select: { id: true, version: true, isActive: true } } },
    }),
  ]);

  return {
    requiredFields,
    draftBands,
    scorecard,
  };
}

export async function generateCreditConfigBaseline(mode: CreditConfigBaselineMode): Promise<void> {
  const existing = await inspectExisting();
  const candidate = proposal();

  if (mode === 'dry-run') {
    console.log(JSON.stringify({
      mode,
      candidate,
      existing,
      wouldCreate: {
        requiredFields: REQUIRED_FIELDS.length - existing.requiredFields,
        ratingBands: RATING_BANDS.length - existing.draftBands,
        scorecard: existing.scorecard ? 0 : 1,
        scorecardVersion: existing.scorecard?.versions.some((version) => version.version === 1) ? 0 : 1,
      },
    }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const createdRequiredFields: string[] = [];
    for (const field of REQUIRED_FIELDS) {
      const existingRule = await tx.creditRuleConfig.findFirst({
        where: {
          kind: 'REQUIRED_FIELD',
          productType: null,
          lane: null,
          borrowerType: null,
          fieldPath: field.fieldPath,
          isActive: false,
        },
        select: { id: true },
      });
      if (existingRule) continue;

      const rule = await tx.creditRuleConfig.create({
        data: {
          kind: 'REQUIRED_FIELD',
          productType: null,
          lane: null,
          borrowerType: null,
          fieldPath: field.fieldPath,
          fieldLabel: field.fieldLabel,
          isMandatory: true,
          sortOrder: field.sortOrder,
          isActive: false,
        },
        select: { id: true },
      });
      createdRequiredFields.push(rule.id);
    }

    const existingBands = await tx.ratingBandConfig.findMany({
      where: { name: BAND_SET_NAME, version: 1, status: 'DRAFT' },
      select: { id: true },
    });
    const createdRatingBands = existingBands.length === RATING_BANDS.length
      ? []
      : await Promise.all(RATING_BANDS.map(async (band) => {
        const created = await tx.ratingBandConfig.create({
          data: {
            ...band,
            status: 'DRAFT',
            version: 1,
            name: BAND_SET_NAME,
            description: 'Candidate canonical 0–100 rating bands; review before activation.',
            approvedById: null,
            effectiveFrom: new Date(),
          },
          select: { id: true },
        });
        return created.id;
      }));

    let scorecard = await tx.creditScorecard.findUnique({ where: { name: SCORECARD_NAME } });
    let createdScorecard = false;
    if (!scorecard) {
      scorecard = await tx.creditScorecard.create({
        data: {
          name: SCORECARD_NAME,
          description: 'Candidate canonical v1 scorecard; inactive pending policy approval.',
          isActive: false,
          productType: null,
        },
      });
      createdScorecard = true;
    }

    const existingVersion = await tx.creditScorecardVersion.findUnique({
      where: { scorecardId_version: { scorecardId: scorecard.id, version: 1 } },
      select: { id: true },
    });
    let createdScorecardVersion: string | null = null;
    if (!existingVersion) {
      const version = await tx.creditScorecardVersion.create({
        data: {
          scorecardId: scorecard.id,
          version: 1,
          factorWeights: CORPORATE_WEIGHTS,
          retailFactorWeights: RETAIL_WEIGHTS,
          isActive: false,
          effectiveFrom: new Date(),
          approvedById: null,
          approvedAt: null,
        },
        select: { id: true },
      });
      createdScorecardVersion = version.id;
    }

    return {
      createdRequiredFields,
      createdRatingBands,
      createdScorecard: createdScorecard ? scorecard.id : null,
      createdScorecardVersion,
    };
  });

  console.log(JSON.stringify({ mode, result, safety: {
    requiredFieldsActive: false,
    ratingBandsStatus: 'DRAFT',
    scorecardActive: false,
    scorecardVersionActive: false,
  } }, null, 2));
}

if (require.main === module) {
  const mode = parseCreditConfigBaselineMode(process.argv.slice(2));
  generateCreditConfigBaseline(mode)
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
