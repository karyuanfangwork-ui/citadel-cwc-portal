import prisma from '../src/utils/prisma';
import { CreditEncryptionService } from '../src/credit/services/encryption.service';
import dotenv from 'dotenv';
dotenv.config();

async function backfill() {
  // Directors
  const directors = await prisma.$queryRaw<Array<{id: string, nric_passport: string | null}>>`
    SELECT id, nric_passport FROM directors WHERE nric_passport IS NOT NULL AND nric_passport_encrypted IS NULL
  `;
  console.log(`Backfilling ${directors.length} directors...`);
  for (const d of directors) {
    if (!d.nric_passport) continue;
    const encrypted = CreditEncryptionService.encrypt(d.nric_passport);
    await prisma.$executeRaw`UPDATE directors SET nric_passport_encrypted = ${encrypted} WHERE id = ${d.id}::uuid`;
  }

  // Shareholders
  const shareholders = await prisma.$queryRaw<Array<{id: string, nric_passport: string | null}>>`
    SELECT id, nric_passport FROM shareholders WHERE nric_passport IS NOT NULL AND nric_passport_encrypted IS NULL
  `;
  console.log(`Backfilling ${shareholders.length} shareholders...`);
  for (const s of shareholders) {
    if (!s.nric_passport) continue;
    const encrypted = CreditEncryptionService.encrypt(s.nric_passport);
    await prisma.$executeRaw`UPDATE shareholders SET nric_passport_encrypted = ${encrypted} WHERE id = ${s.id}::uuid`;
  }

  // UBOs
  const ubos = await prisma.$queryRaw<Array<{id: string, nric_passport: string | null}>>`
    SELECT id, nric_passport FROM ultimate_beneficial_owners WHERE nric_passport IS NOT NULL AND nric_passport_encrypted IS NULL
  `;
  console.log(`Backfilling ${ubos.length} UBOs...`);
  for (const u of ubos) {
    if (!u.nric_passport) continue;
    const encrypted = CreditEncryptionService.encrypt(u.nric_passport);
    await prisma.$executeRaw`UPDATE ultimate_beneficial_owners SET nric_passport_encrypted = ${encrypted} WHERE id = ${u.id}::uuid`;
  }

  console.log('Backfill complete.');
  await prisma.$disconnect();
}

backfill().catch(e => { console.error(e); process.exit(1); });
