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

export function creditConfigBaselineProposal() {
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

export interface ExistingBaselineState {
  requiredFields: Array<{
    id: string;
    fieldPath: string | null;
    fieldLabel: string | null;
    isMandatory: boolean;
    sortOrder: number;
    isActive: boolean;
  }>;
  ratingBands: Array<{
    id: string;
    scoreMin: number;
    scoreMax: number;
    rating: string;
    riskCategory: string;
    status: string;
  }>;
  scorecard: null | {
    id: string;
    isActive: boolean;
    productType: string | null;
    versions: Array<{
      id: string;
      version: number;
      isActive: boolean;
      approvedById: string | null;
      approvedAt: Date | null;
      factorWeights: unknown;
      retailFactorWeights: unknown;
    }>;
  };
}

export interface CreditConfigBaselinePlan {
  requiredFieldsToCreate: typeof REQUIRED_FIELDS[number][];
  ratingBandsToCreate: typeof RATING_BANDS[number][];
  createScorecard: boolean;
  createScorecardVersion: boolean;
  conflicts: string[];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildCreditConfigBaselinePlan(existing: ExistingBaselineState): CreditConfigBaselinePlan {
  const conflicts: string[] = [];
  const requiredFieldsToCreate: typeof REQUIRED_FIELDS[number][] = [];
  for (const field of REQUIRED_FIELDS) {
    const rows = existing.requiredFields.filter((row) => row.fieldPath === field.fieldPath);
    if (rows.length > 1) {
      conflicts.push(`Required field ${field.fieldPath} has ${rows.length} matching global rows; review duplicates.`);
      continue;
    }
    const row = rows[0];
    if (!row) {
      requiredFieldsToCreate.push(field);
      continue;
    }
    if (row.isActive) {
      conflicts.push(`Required field ${field.fieldPath} already has an active global row; do not create a duplicate draft.`);
    } else if (row.fieldLabel !== field.fieldLabel || !row.isMandatory || row.sortOrder !== field.sortOrder) {
      conflicts.push(`Required field ${field.fieldPath} exists with values that differ from the candidate baseline.`);
    }
  }

  const ratingBandsToCreate: typeof RATING_BANDS[number][] = [];
  for (const band of RATING_BANDS) {
    const rows = existing.ratingBands.filter((row) => row.rating === band.rating);
    if (rows.length > 1) {
      conflicts.push(`Rating ${band.rating} has ${rows.length} rows in ${BAND_SET_NAME}; review duplicates.`);
      continue;
    }
    const row = rows[0];
    if (!row) {
      ratingBandsToCreate.push(band);
      continue;
    }
    if (
      row.status !== 'DRAFT' || row.scoreMin !== band.scoreMin || row.scoreMax !== band.scoreMax ||
      row.riskCategory !== band.riskCategory
    ) {
      conflicts.push(`Rating ${band.rating} in ${BAND_SET_NAME} differs from the inactive candidate; review instead of overwriting.`);
    }
  }

  const unexpectedBands = existing.ratingBands.filter(
    (row) => !RATING_BANDS.some((band) => band.rating === row.rating),
  );
  for (const row of unexpectedBands) {
    conflicts.push(`Unexpected rating ${row.rating} exists in ${BAND_SET_NAME}; review the set before applying.`);
  }

  let createScorecard = false;
  let createScorecardVersion = false;
  if (!existing.scorecard) {
    createScorecard = true;
    createScorecardVersion = true;
  } else {
    if (existing.scorecard.isActive || existing.scorecard.productType !== null) {
      conflicts.push(`Scorecard ${SCORECARD_NAME} is active or scoped; the generator will not modify it.`);
    }
    const versions = existing.scorecard.versions.filter((version) => version.version === 1);
    if (versions.length > 1) {
      conflicts.push(`Scorecard ${SCORECARD_NAME} has duplicate v1 versions.`);
    } else if (versions.length === 0) {
      createScorecardVersion = true;
    } else {
      const version = versions[0];
      const weightsMatch = stableJson(version.factorWeights) === stableJson(CORPORATE_WEIGHTS);
      const retailWeightsMatch = stableJson(version.retailFactorWeights) === stableJson(RETAIL_WEIGHTS);
      if (version.isActive || version.approvedById || version.approvedAt || !weightsMatch || !retailWeightsMatch) {
        conflicts.push(`Scorecard ${SCORECARD_NAME} v1 is active, approved, or differs from the candidate; review instead of overwriting.`);
      }
    }
  }

  return { requiredFieldsToCreate, ratingBandsToCreate, createScorecard, createScorecardVersion, conflicts };
}

async function inspectExisting(client: any = prisma): Promise<ExistingBaselineState> {
  const [requiredFields, ratingBands, scorecard] = await Promise.all([
    client.creditRuleConfig.findMany({
      where: {
        kind: 'REQUIRED_FIELD',
        productType: null,
        lane: null,
        borrowerType: null,
        fieldPath: { in: REQUIRED_FIELDS.map((field) => field.fieldPath) },
      },
      select: { id: true, fieldPath: true, fieldLabel: true, isMandatory: true, sortOrder: true, isActive: true },
    }),
    client.ratingBandConfig.findMany({
      where: { name: BAND_SET_NAME, version: 1 },
      select: { id: true, scoreMin: true, scoreMax: true, rating: true, riskCategory: true, status: true },
    }),
    client.creditScorecard.findUnique({
      where: { name: SCORECARD_NAME },
      select: {
        id: true,
        isActive: true,
        productType: true,
        versions: {
          select: {
            id: true,
            version: true,
            isActive: true,
            approvedById: true,
            approvedAt: true,
            factorWeights: true,
            retailFactorWeights: true,
          },
        },
      },
    }),
  ]);

  return { requiredFields, ratingBands, scorecard };
}

export async function generateCreditConfigBaseline(mode: CreditConfigBaselineMode): Promise<void> {
  const existing = await inspectExisting();
  const reconciliation = buildCreditConfigBaselinePlan(existing);
  const candidate = creditConfigBaselineProposal();

  if (mode === 'dry-run') {
    console.log(JSON.stringify({
      mode,
      candidate,
      existing,
      reconciliation: {
        wouldCreate: {
          requiredFields: {
            count: reconciliation.requiredFieldsToCreate.length,
            items: reconciliation.requiredFieldsToCreate,
          },
          ratingBands: {
            count: reconciliation.ratingBandsToCreate.length,
            items: reconciliation.ratingBandsToCreate,
          },
          scorecard: reconciliation.createScorecard,
          scorecardVersion: reconciliation.createScorecardVersion,
        },
        conflicts: reconciliation.conflicts,
      },
    }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction so a concurrent change cannot turn a reviewed
    // dry-run into a duplicate or overwrite after the operator approves apply.
    const current = await inspectExisting(tx);
    const plan = buildCreditConfigBaselinePlan(current);
    if (plan.conflicts.length > 0) {
      throw new Error(`Credit configuration baseline apply refused: ${plan.conflicts.join(' ')}`);
    }

    const createdRequiredFields: string[] = [];
    for (const field of plan.requiredFieldsToCreate) {
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

    const createdRatingBands: string[] = [];
    for (const band of plan.ratingBandsToCreate) {
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
      createdRatingBands.push(created.id);
    }

    let scorecardId = current.scorecard?.id ?? null;
    let createdScorecard = false;
    if (!scorecardId && plan.createScorecard) {
      const scorecard = await tx.creditScorecard.create({
        data: {
          name: SCORECARD_NAME,
          description: 'Candidate canonical v1 scorecard; inactive pending policy approval.',
          isActive: false,
          productType: null,
        },
      });
      scorecardId = scorecard.id;
      createdScorecard = true;
    }

    let createdScorecardVersion: string | null = null;
    if (scorecardId && plan.createScorecardVersion) {
      const version = await tx.creditScorecardVersion.create({
        data: {
          scorecardId,
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
      createdScorecard: createdScorecard ? scorecardId : null,
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
