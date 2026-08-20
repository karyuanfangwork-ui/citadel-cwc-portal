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
      dateOfBirth: '1988-01-01',
      nationality: 'Malaysian',
      phone: '+60111000001',
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
      dateOfIncorporation: '2023-01-01',
      businessNature: 'Software services',
      phone: '+60111000002',
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
      dateOfBirth: '1990-02-02',
      nationality: 'Malaysian',
      phone: '+60111000003',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id);

    await expect(
      borrowerProfileService.createBorrowerProfile({
        name: 'LOS017 Probe Three Again',
        borrowerType: 'INDIVIDUAL',
        nricPassport: '9002021 0 1111',
        dateOfBirth: '1990-02-02',
        nationality: 'Malaysian',
        phone: '+60111000004',
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

  it('rejects an update that removes required individual identity fields', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Update Integrity Individual',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '920404-10-3333',
      dateOfBirth: '1992-04-04',
      nationality: 'Malaysian',
      phone: '+60111000005',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id);

    await expect(
      borrowerProfileService.updateBorrowerProfile(first.id, { nricPassport: null }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('excludes the current borrower from its own update duplicate check', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Update Self Match',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '930505-10-4444',
      dateOfBirth: '1993-05-05',
      nationality: 'Malaysian',
      phone: '+60111000006',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id);

    await expect(
      borrowerProfileService.updateBorrowerProfile(first.id, { phone: '+60123456789' }),
    ).resolves.toMatchObject({ id: first.id, phone: '+60123456789' });
  });

  it('rejects an update that changes identity to another borrower', async () => {
    const first = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Update Duplicate Source',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '940606-10-5555',
      dateOfBirth: '1994-06-06',
      nationality: 'Malaysian',
      phone: '+60111000007',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    const second = await borrowerProfileService.createBorrowerProfile({
      name: 'LOS017 Update Duplicate Target',
      borrowerType: 'INDIVIDUAL',
      nricPassport: '950707-10-6666',
      dateOfBirth: '1995-07-07',
      nationality: 'Malaysian',
      phone: '+60111000008',
    } as any, { overrideDuplicate: true, overrideReason: 'Integration test probe — distinct from real borrowers.', userId: 'test-actor', userPermissions: ['credit:admin'] });
    created.push(first.id, second.id);

    await expect(
      borrowerProfileService.updateBorrowerProfile(second.id, { nricPassport: first.nricPassport }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
