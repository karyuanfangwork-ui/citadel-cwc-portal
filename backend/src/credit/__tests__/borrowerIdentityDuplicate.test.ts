// LOS-017 — duplicate detection on the profile's own identity fields
import prisma from '../../utils/prisma';
import { borrowerProfileService } from '../services/borrowerProfile.service';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-017 — duplicate detection on the profile\'s own identity fields', () => {
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await prisma.borrowerProfile.deleteMany({ where: { id: { in: created } } });
    }
    await prisma.$disconnect();
  });

  it('matches a differently-formatted NRIC with no CRM linkage', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Probe One',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '880101-14-5523',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id);

    const { duplicates } = await borrowerProfileService.checkDuplicateEnhanced({
      name: 'Completely Different Name',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '880101145523',
    });

    expect(duplicates.map((d) => d.borrowerId)).toContain(first.id);
    expect(duplicates.find((d) => d.borrowerId === first.id)?.matchField)
      .toBe('NRIC/Passport (direct)');
  });

  it('matches a differently-formatted company registration number', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Probe Two Sdn Bhd',
      borrowerType: 'CORPORATE',
      registrationNumber: '202301012345 (1234567-X)',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id);

    const { duplicates } = await borrowerProfileService.checkDuplicateEnhanced({
      name: 'Another Name Entirely Sdn Bhd',
      borrowerType: 'CORPORATE',
      registrationNumber: '2023010123451234567X',
    });

    expect(duplicates.map((d) => d.borrowerId)).toContain(first.id);
  });

  it('refuses to create a second borrower with the same identity', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Probe Three',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '900202-10-1111',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id);

    await expect(
      borrowerProfileService.createBorrowerProfile({
        name: 'LOS017 Probe Three Again',
        borrowerType: 'INDIVIDUAL',
        nricPassport: '9002021 0 1111',
      } as any, { userId: 'test-actor' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not match on short or empty identifiers', async () => {
    const { duplicates } = await borrowerProfileService.checkDuplicateEnhanced({
      name: 'No Such Borrower At All',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '12345',
    });
    expect(duplicates.filter((d) => d.matchField.includes('direct'))).toHaveLength(0);
  });
});