import {
  createBorrowerProfileSchema,
  getBorrowerIdentityValidationIssues,
} from '../borrowerProfile.validator';
import prisma from '../../../utils/prisma';
import { borrowerProfileService } from '../../services/borrowerProfile.service';

const validCorporateIdentity = {
  borrowerType: 'CORPORATE' as const,
  name: 'Primary Contact Test Sdn Bhd',
  registrationNumber: '202401012345',
  dateOfIncorporation: '2024-01-01',
  businessNature: 'Software services',
};

function parseCreate(overrides: Record<string, unknown>) {
  return createBorrowerProfileSchema.safeParse({
    body: { ...validCorporateIdentity, ...overrides },
  });
}

describe('borrower primary-contact validation', () => {
  it('rejects a create with neither phone nor email at the phoneOrEmail field', () => {
    const result = parseCreate({ phone: '  ', email: null });

    expect(getBorrowerIdentityValidationIssues({
      ...validCorporateIdentity,
      phone: '  ',
      email: null,
    })).toEqual(expect.arrayContaining([
      {
        field: 'phoneOrEmail',
        message: 'At least one primary contact method (phone or email) is required',
      },
    ]));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: ['body', 'body', 'phoneOrEmail'],
          message: 'At least one primary contact method (phone or email) is required',
        }),
      ]));
    }
  });

  it.each([
    ['phone', { phone: '+60123456789', email: null }],
    ['email', { phone: null, email: 'primary.contact@example.test' }],
  ])('accepts a create with only a %s', (_contactMethod, contact) => {
    expect(parseCreate(contact).success).toBe(true);
  });

  it('reports a merged update state that removes the only primary contact', () => {
    const mergedIdentity = {
      ...validCorporateIdentity,
      phone: null,
      email: '   ',
    };

    expect(getBorrowerIdentityValidationIssues(mergedIdentity)).toEqual(expect.arrayContaining([
      {
        field: 'phoneOrEmail',
        message: 'At least one primary contact method (phone or email) is required',
      },
    ]));
  });
});

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('borrower primary-contact service validation', () => {
  const created: string[] = [];
  const runId = Date.now().toString();

  afterAll(async () => {
    if (created.length) {
      await prisma.borrowerProfile.deleteMany({ where: { id: { in: created } } });
    }
    await prisma.$disconnect();
  });

  it('rejects a direct contactless create with field-addressable AppError details', async () => {
    const error = await borrowerProfileService.createBorrowerProfile({
      ...validCorporateIdentity,
      name: `Direct create contact check ${runId}`,
      registrationNumber: `T4-DIRECT-${runId}`,
      phone: null,
      email: '   ',
    } as any, {
      overrideDuplicate: true,
      overrideReason: 'Integration test creates a distinct temporary borrower.',
      userId: 'test-actor',
      userPermissions: ['credit:admin'],
    }).then((profile) => {
      created.push(profile.id);
      return null;
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      statusCode: 400,
      details: {
        fields: expect.arrayContaining([
          expect.objectContaining({ field: 'phoneOrEmail' }),
        ]),
      },
    });
  });

  it("rejects removal of a borrower's only primary contact through the service", async () => {
    const profile = await borrowerProfileService.createBorrowerProfile({
      ...validCorporateIdentity,
      name: `Update contact check ${runId}`,
      registrationNumber: `T4-UPDATE-${runId}`,
      phone: '+60123456789',
      email: null,
    } as any, {
      overrideDuplicate: true,
      overrideReason: 'Integration test creates a distinct temporary borrower.',
      userId: 'test-actor',
      userPermissions: ['credit:admin'],
    });
    created.push(profile.id);

    await expect(
      borrowerProfileService.updateBorrowerProfile(profile.id, { phone: null }),
    ).rejects.toMatchObject({
      statusCode: 400,
      details: {
        fields: expect.arrayContaining([
          expect.objectContaining({ field: 'phoneOrEmail' }),
        ]),
      },
    });
  });
});
