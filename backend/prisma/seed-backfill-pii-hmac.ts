/**
 * Backfill HMAC for existing Director, Shareholder, and UBO records
 * that have nricPassportEncrypted but no nricPassportHmac.
 *
 * Usage:
 *   npx tsx prisma/seed-backfill-pii-hmac.ts          # dry-run (no writes)
 *   npx tsx prisma/seed-backfill-pii-hmac.ts --apply  # apply changes
 */

import { PrismaClient } from '@prisma/client';
import { CreditEncryptionService } from '../src/credit/services/encryption.service';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

function getPlainNric(encoded: string): string | null {
  // Legacy seed format: "encrypt:NRIC"
  if (encoded.startsWith('encrypt:')) return encoded.slice('encrypt:'.length);
  // Proper AES-CBC format: "hexiv:hexciphertext"
  if (CreditEncryptionService.isEncrypted(encoded)) return CreditEncryptionService.decrypt(encoded);
  return null;
}

async function backfill(
  label: string,
  findMany: () => Promise<{ id: string; nricPassportEncrypted: string | null; nricPassportHmac: string | null }[]>,
  update: (id: string, encrypted: string, hmac: string) => Promise<void>,
) {
  const records = await findMany();
  const toUpdate = records.filter(r => r.nricPassportEncrypted && !r.nricPassportHmac);
  console.log(`${label}: ${toUpdate.length} records to backfill (${records.length} total)`);

  for (const record of toUpdate) {
    const plain = getPlainNric(record.nricPassportEncrypted!);
    if (!plain) { console.log(`  SKIP ${record.id} — unrecognised format`); continue; }
    const encrypted = CreditEncryptionService.encrypt(plain);
    const hmac = CreditEncryptionService.hmacNric(plain);
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would update ${record.id} → hmac: ${hmac.slice(0, 8)}…`);
    } else {
      await update(record.id, encrypted, hmac);
      console.log(`  Updated ${record.id}`);
    }
  }
}

async function main() {
  console.log(`PII HMAC backfill — ${DRY_RUN ? 'DRY RUN (pass --apply to write)' : 'APPLYING CHANGES'}\n`);

  await backfill(
    'Director',
    () => prisma.director.findMany({ select: { id: true, nricPassportEncrypted: true, nricPassportHmac: true } }),
    (id, encrypted, hmac) => prisma.director.update({ where: { id }, data: { nricPassportEncrypted: encrypted, nricPassportHmac: hmac } }).then(() => {}),
  );

  await backfill(
    'Shareholder',
    () => prisma.shareholder.findMany({ select: { id: true, nricPassportEncrypted: true, nricPassportHmac: true } }),
    (id, encrypted, hmac) => prisma.shareholder.update({ where: { id }, data: { nricPassportEncrypted: encrypted, nricPassportHmac: hmac } }).then(() => {}),
  );

  await backfill(
    'UltimateBeneficialOwner',
    () => prisma.ultimateBeneficialOwner.findMany({ select: { id: true, nricPassportEncrypted: true, nricPassportHmac: true } }),
    (id, encrypted, hmac) => prisma.ultimateBeneficialOwner.update({ where: { id }, data: { nricPassportEncrypted: encrypted, nricPassportHmac: hmac } }).then(() => {}),
  );

  console.log('\nDone.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
