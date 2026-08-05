// Test that each material-input change point dispatches recalcScore.
// Each sub-test mocks recalc.service and the service's own prisma calls.

jest.mock('../recalc.service', () => ({
  recalcScore: jest.fn().mockResolvedValue({ recalculated: true }),
}));

// ── Retail income save ──────────────────────────────────────────────────────
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    retailIncome: {
      upsert: jest.fn().mockResolvedValue({ id: 'ri-1', applicationId: 'app-1' }),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    qualitativeAssessment: {
      upsert: jest.fn().mockResolvedValue({ id: 'qa-1', applicationId: 'app-1' }),
      findUnique: jest.fn(),
    },
    bureauChecklist: {
      upsert: jest.fn().mockResolvedValue({ id: 'bc-1', applicationId: 'app-1' }),
    },
    creditDocument: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'doc-1', applicationId: 'app-1', deletedAt: null,
        verificationStatus: 'VERIFIED', documentClass: 'CCRIS_BORROWER_UPLOAD',
      }),
      update: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    },
    creditApplication: {
      findUnique: jest.fn().mockResolvedValue({ id: 'app-1', lane: 'CORPORATE' }),
    },
  },
}));

import { recalcScore } from '../recalc.service';
import prisma from '../../../utils/prisma';

import { upsertRetailIncome } from '../retailIncome.service';
import { upsertQualitativeAssessment } from '../qualitativeAssessment.service';
import { upsertBureauChecklist } from '../bureauCheck.service';

// creditDocumentService is a class instance — import the singleton
import { creditDocumentService } from '../creditDocument.service';

describe('Phase 2 recalc hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retail income save dispatches recalc', async () => {
    await upsertRetailIncome('app-1', {
      employmentType: 'SALARIED',
      monthlyGrossIncome: 5000,
    } as any);
    expect(recalcScore).toHaveBeenCalledWith(
      'app-1', 'retail_income_save',
      expect.objectContaining({ sourceUpdatedAt: expect.any(Date) }),
    );
  });

  it('qualitative assessment save dispatches recalc', async () => {
    await upsertQualitativeAssessment('app-1', 'u-1', {
      managementScore: 4, relationshipScore: 4, industryScore: 3, collateralScore: 3,
    } as any);
    expect(recalcScore).toHaveBeenCalledWith(
      'app-1', 'qualitative_assessment_save',
      expect.objectContaining({ sourceUpdatedAt: expect.any(Date) }),
    );
  });

  it('bureau checklist update dispatches recalc', async () => {
    // Use noAdverseRecord to avoid the verified-doc enforcement path
    await upsertBureauChecklist('app-1', 'u-1', { noAdverseRecord: true });
    expect(recalcScore).toHaveBeenCalledWith(
      'app-1', 'bureau_checklist_update',
      expect.objectContaining({ sourceUpdatedAt: expect.any(Date) }),
    );
  });

  it('document verify dispatches recalc', async () => {
    await creditDocumentService.verifyDocument('doc-1', 'u-1');
    expect(recalcScore).toHaveBeenCalledWith(
      'app-1', 'document_verified',
      expect.objectContaining({ sourceUpdatedAt: expect.any(Date) }),
    );
  });
});