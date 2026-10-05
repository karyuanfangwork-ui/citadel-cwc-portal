jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    $disconnect = jest.fn();
  },
}));

import {
  buildCreditConfigBaselinePlan,
  creditConfigBaselineProposal,
  ExistingBaselineState,
} from '../../../../prisma/scripts/generate-credit-config-baseline';

const candidate = creditConfigBaselineProposal();

function emptyState(): ExistingBaselineState {
  return { requiredFields: [], ratingBands: [], scorecard: null };
}

function exactExistingState(): ExistingBaselineState {
  return {
    requiredFields: candidate.requiredFields.map((field, index) => ({
      id: `field-${index}`,
      fieldPath: field.fieldPath,
      fieldLabel: field.fieldLabel,
      isMandatory: field.isMandatory,
      sortOrder: field.sortOrder,
      isActive: false,
    })),
    ratingBands: candidate.ratingBands.map((band, index) => ({
      id: `band-${index}`,
      ...band,
      status: 'DRAFT',
    })),
    scorecard: {
      id: 'scorecard-1',
      isActive: false,
      productType: null,
      versions: [{
        id: 'version-1',
        version: 1,
        isActive: false,
        approvedById: null,
        approvedAt: null,
        factorWeights: candidate.scorecard.factorWeights,
        retailFactorWeights: candidate.scorecard.retailFactorWeights,
      }],
    },
  };
}

describe('credit configuration baseline reconciliation', () => {
  it('proposes the complete candidate when the database is empty', () => {
    const plan = buildCreditConfigBaselinePlan(emptyState());

    expect(plan.requiredFieldsToCreate).toHaveLength(candidate.requiredFields.length);
    expect(plan.ratingBandsToCreate).toHaveLength(candidate.ratingBands.length);
    expect(plan.createScorecard).toBe(true);
    expect(plan.createScorecardVersion).toBe(true);
    expect(plan.conflicts).toEqual([]);
  });

  it('creates only missing members of a partial inactive candidate set', () => {
    const state = emptyState();
    state.requiredFields = exactExistingState().requiredFields.slice(0, 2);
    state.ratingBands = exactExistingState().ratingBands.slice(0, 4);
    state.scorecard = {
      id: 'scorecard-1',
      isActive: false,
      productType: null,
      versions: [],
    };

    const plan = buildCreditConfigBaselinePlan(state);

    expect(plan.requiredFieldsToCreate).toHaveLength(candidate.requiredFields.length - 2);
    expect(plan.ratingBandsToCreate).toHaveLength(candidate.ratingBands.length - 4);
    expect(plan.createScorecard).toBe(false);
    expect(plan.createScorecardVersion).toBe(true);
    expect(plan.conflicts).toEqual([]);
  });

  it('reports duplicates and does not propose another copy of the ambiguous item', () => {
    const state = exactExistingState();
    state.requiredFields.push({ ...state.requiredFields[0], id: 'duplicate-field' });
    state.ratingBands.push({ ...state.ratingBands[0], id: 'duplicate-band' });

    const plan = buildCreditConfigBaselinePlan(state);

    expect(plan.requiredFieldsToCreate).toHaveLength(0);
    expect(plan.ratingBandsToCreate).toHaveLength(0);
    expect(plan.conflicts).toEqual(expect.arrayContaining([
      expect.stringContaining('has 2 matching global rows'),
      expect.stringContaining('has 2 rows'),
    ]));
  });

  it('refuses to overwrite mismatched, active, scoped, or approved candidate records', () => {
    const state = exactExistingState();
    state.requiredFields[0] = { ...state.requiredFields[0], fieldLabel: 'Different label' };
    state.ratingBands[0] = { ...state.ratingBands[0], scoreMin: 84 };
    state.scorecard!.isActive = true;
    state.scorecard!.versions[0].approvedById = 'approver-1';

    const plan = buildCreditConfigBaselinePlan(state);

    expect(plan.conflicts).toEqual(expect.arrayContaining([
      expect.stringContaining('differ from the candidate baseline'),
      expect.stringContaining('differs from the inactive candidate'),
      expect.stringContaining('is active or scoped'),
      expect.stringContaining('is active, approved, or differs'),
    ]));
  });

  it('is idempotent for the exact inactive candidate', () => {
    const plan = buildCreditConfigBaselinePlan(exactExistingState());

    expect(plan).toEqual({
      requiredFieldsToCreate: [],
      ratingBandsToCreate: [],
      createScorecard: false,
      createScorecardVersion: false,
      conflicts: [],
    });
  });
});
