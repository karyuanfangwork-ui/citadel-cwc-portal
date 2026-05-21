import prisma from '../../utils/prisma';
import { CounterpartyRole, Prisma } from '@prisma/client';

export interface CreateKeyCounterpartyData {
  role: CounterpartyRole;
  name: string;
  address?: string | null;
  telephone?: string | null;
  yearsOfRelationship?: number | null;
  creditTermsDays?: number | null;
  salesOrPurchasePct?: string | null;
  modeOfPayment?: string | null;
  sortOrder?: number;
}

export async function listByProfile(borrowerProfileId: string) {
  return prisma.keyCounterparty.findMany({
    where: { borrowerProfileId },
    orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function create(borrowerProfileId: string, data: CreateKeyCounterpartyData) {
  return prisma.keyCounterparty.create({
    data: {
      borrowerProfileId,
      role: data.role,
      name: data.name,
      address: data.address ?? null,
      telephone: data.telephone ?? null,
      yearsOfRelationship: data.yearsOfRelationship ?? null,
      creditTermsDays: data.creditTermsDays ?? null,
      salesOrPurchasePct: data.salesOrPurchasePct ? new Prisma.Decimal(data.salesOrPurchasePct) : null,
      modeOfPayment: data.modeOfPayment ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function update(id: string, data: Partial<CreateKeyCounterpartyData>) {
  return prisma.keyCounterparty.update({
    where: { id },
    data: {
      ...('role' in data && { role: data.role }),
      ...('name' in data && { name: data.name }),
      address: data.address ?? undefined,
      telephone: data.telephone ?? undefined,
      yearsOfRelationship: data.yearsOfRelationship ?? undefined,
      creditTermsDays: data.creditTermsDays ?? undefined,
      salesOrPurchasePct: data.salesOrPurchasePct ? new Prisma.Decimal(data.salesOrPurchasePct) : undefined,
      modeOfPayment: data.modeOfPayment ?? undefined,
      sortOrder: data.sortOrder ?? undefined,
    },
  });
}

export async function remove(id: string) {
  return prisma.keyCounterparty.delete({ where: { id } });
}
