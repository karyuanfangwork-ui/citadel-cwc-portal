// LOS-017 — duplicate override governance
import { borrowerProfileService } from '../services/borrowerProfile.service';

describe('LOS-017 — duplicate override governance', () => {
  const base = { name: 'Override Probe', borrowerType: 'INDIVIDUAL', nricPassport: '910303-10-2222' } as any;

  it('rejects an override from a user without credit:admin', async () => {
    await expect(
      borrowerProfileService.createBorrowerProfile(base, {
        overrideDuplicate: true,
        overrideReason: 'Confirmed distinct person after manual KYC review of both files.',
        userId: 'u1',
        userPermissions: ['credit:create'],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects an override with no reason', async () => {
    await expect(
      borrowerProfileService.createBorrowerProfile(base, {
        overrideDuplicate: true,
        userId: 'u1',
        userPermissions: ['credit:admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an override with a token reason', async () => {
    await expect(
      borrowerProfileService.createBorrowerProfile(base, {
        overrideDuplicate: true,
        overrideReason: 'ok',
        userId: 'u1',
        userPermissions: ['credit:admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});