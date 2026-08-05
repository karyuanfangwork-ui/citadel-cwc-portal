// Re-export the tenant-aware Prisma singleton from lib/prisma.ts
// This maintains backward compatibility for all existing imports.
export { prisma, default, PrismaClientWithTenant } from '../lib/prisma';