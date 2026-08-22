import prisma from '../utils/prisma';
import { LEGACY_REQUEST_STATUS_CODES } from '../constants/requestStatusCompat';
import { CLOSED_STATUSES, RESOLVED_STATUSES } from '../constants/requestStatuses';

function categoryFor(code: string): string | null {
  if (code.includes('_IT')) return 'IT';
  if (code.includes('_FIN') || code.startsWith('FINANCE_') || code.includes('CHARGEBACK')) return 'FINANCE';
  if (code.startsWith('ONBOARDING_') || code.startsWith('OFFBOARDING_') || code.includes('LOA_') || code.includes('INTERVIEW_') || code === 'HR_SCREENING') return 'HR';
  return 'GENERAL';
}

function lifecycleFor(code: string): 'OPEN' | 'RESOLVED' | 'CLOSED' | 'CANCELLED' {
  if (code === 'CANCELLED') return 'CANCELLED';
  if (RESOLVED_STATUSES.includes(code)) return 'RESOLVED';
  if (CLOSED_STATUSES.includes(code)) return 'CLOSED';
  return 'OPEN';
}

function labelFor(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function main() {
  let created = 0;
  let preserved = 0;
  for (const code of LEGACY_REQUEST_STATUS_CODES) {
    const existing = await prisma.requestStatusDefinition.findUnique({ where: { code } });
    const data = {
      label: existing?.label ?? labelFor(code),
      description: existing?.description ?? null,
      category: existing?.category ?? categoryFor(code),
      displayOrder: existing?.displayOrder ?? 0,
      lifecycleType: lifecycleFor(code),
    } as const;
    if (existing) {
      // Existing labels, categories, lifecycle, active state, and retirement
      // state are admin-owned and must never be overwritten by deployment.
      preserved += 1;
    } else {
      await prisma.requestStatusDefinition.create({
        data: { code, ...data, isActive: true },
      });
      created += 1;
    }
  }
  console.log(JSON.stringify({ writePerformed: true, created, preserved, total: LEGACY_REQUEST_STATUS_CODES.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
