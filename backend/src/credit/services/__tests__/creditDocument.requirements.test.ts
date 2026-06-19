jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    documentRequirement: {
      count: jest.fn(),
      createMany: jest.fn(),
    },
    creditApplication: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../creditRuleEngine.service', () => ({
  resolveRequiredDocuments: jest.fn(),
}));

import prisma from '../../../utils/prisma';
import { creditDocumentService } from '../creditDocument.service';
import { resolveRequiredDocuments } from '../creditRuleEngine.service';

const mockedCount = prisma.documentRequirement.count as jest.Mock;
const mockedCreateMany = prisma.documentRequirement.createMany as jest.Mock;
const mockedFindUnique = prisma.creditApplication.findUnique as jest.Mock;
const mockedResolveRequiredDocuments = resolveRequiredDocuments as jest.Mock;

describe('seedDefaultRequirements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates checklist rows resolved by the rule engine', async () => {
    mockedCount.mockResolvedValue(0);
    mockedFindUnique.mockResolvedValue({
      id: 'app-1',
      productType: 'TERM_LOAN',
      lane: 'PERSONAL_FAST',
      borrowerProfile: { borrowerType: 'INDIVIDUAL' },
    });
    mockedResolveRequiredDocuments.mockResolvedValue([
      {
        documentClass: 'NRIC_PASSPORT',
        label: 'NRIC / Passport',
        isMandatory: true,
        sortOrder: 0,
      },
      {
        documentClass: 'PAYSLIP',
        label: 'Payslip (latest 3 months)',
        isMandatory: true,
        sortOrder: 1,
      },
      {
        documentClass: 'BANK_STATEMENT',
        label: 'Bank Statement',
        isMandatory: true,
        sortOrder: 2,
      },
    ]);
    mockedCreateMany.mockResolvedValue({ count: 3 });

    const result = await creditDocumentService.seedDefaultRequirements('app-1');

    expect(mockedResolveRequiredDocuments).toHaveBeenCalledWith({
      productType: 'TERM_LOAN',
      lane: 'PERSONAL_FAST',
      borrowerType: 'INDIVIDUAL',
    });
    expect(result).toEqual({ created: 3, skipped: false });
    expect(mockedCreateMany).toHaveBeenCalledWith({
      data: [
        {
          applicationId: 'app-1',
          documentClass: 'NRIC_PASSPORT',
          label: 'NRIC / Passport',
          isMandatory: true,
          sortOrder: 0,
        },
        {
          applicationId: 'app-1',
          documentClass: 'PAYSLIP',
          label: 'Payslip (latest 3 months)',
          isMandatory: true,
          sortOrder: 1,
        },
        {
          applicationId: 'app-1',
          documentClass: 'BANK_STATEMENT',
          label: 'Bank Statement',
          isMandatory: true,
          sortOrder: 2,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('skips seeding when requirements already exist', async () => {
    mockedCount.mockResolvedValue(2);

    const result = await creditDocumentService.seedDefaultRequirements('app-1');

    expect(result).toEqual({ created: 0, skipped: true });
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedCreateMany).not.toHaveBeenCalled();
    expect(mockedResolveRequiredDocuments).not.toHaveBeenCalled();
  });
});
