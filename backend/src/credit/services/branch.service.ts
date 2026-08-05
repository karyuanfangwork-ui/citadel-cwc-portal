import prisma from '../../utils/prisma';

// ---------------------------------------------------------------------------
// §3.1 — Branch Service (multi-branch support)
// ---------------------------------------------------------------------------

export interface BranchInput {
  code: string;
  name: string;
  region?: string | null;
}

class BranchService {
  async list(includeInactive = false) {
    return prisma.branch.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async getOne(id: string) {
    return prisma.branch.findUnique({ where: { id } });
  }

  async create(dto: BranchInput) {
    return prisma.branch.create({
      data: {
        code: dto.code,
        name: dto.name,
        region: dto.region ?? null,
      },
    });
  }

  async update(id: string, dto: Partial<BranchInput>) {
    return prisma.branch.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
      },
    });
  }

  async deactivate(id: string) {
    return prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const branchService = new BranchService();
