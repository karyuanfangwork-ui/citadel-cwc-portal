import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { CreditEncryptionService } from './encryption.service';
import { PiiReadLogService } from './piiReadLog.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDirectorData {
  borrowerProfileId: string;
  contactId?: string | null;
  name: string;
  nricPassport?: string | null;
  position?: string | null;
  appointmentDate?: string | null;
  resignationDate?: string | null;
  isExecutive?: boolean;
}

export interface UpdateDirectorData {
  contactId?: string | null;
  name?: string;
  nricPassport?: string | null;
  position?: string | null;
  appointmentDate?: string | null;
  resignationDate?: string | null;
  isExecutive?: boolean;
}

export interface ListDirectorsOptions {
  borrowerProfileId: string;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function decryptNric(record: any) {
  return {
    ...record,
    nricPassport: record.nricPassportEncrypted
      ? CreditEncryptionService.decrypt(record.nricPassportEncrypted)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DirectorService {
  /**
   * List directors for a borrower profile with pagination and optional active-only filter.
   */
  async listDirectors(options: ListDirectorsOptions) {
    const { borrowerProfileId, activeOnly = false, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.DirectorWhereInput = {
      borrowerProfileId,
      ...(activeOnly && { resignationDate: null }),
    };

    const [directors, total] = await Promise.all([
      prisma.director.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appointmentDate: 'desc' },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.director.count({ where }),
    ]);

    return {
      directors: directors.map(decryptNric),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single director by ID.
   */
  async getDirector(id: string, requestingUserId?: string) {
    const director = await prisma.director.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!director) return null;

    // Log PII access when nricPassportEncrypted is present
    if (director.nricPassportEncrypted && requestingUserId) {
      await PiiReadLogService.logPiiAccess(
        requestingUserId,
        'Director',
        id,
        'nricPassport',
      ).catch(() => {/* non-blocking */});
    }

    return decryptNric(director);
  }

  /**
   * Create a new director.
   */
  async createDirector(data: CreateDirectorData) {
    const createData: Prisma.DirectorCreateInput = {
      name: data.name,
      nricPassportEncrypted: data.nricPassport?.trim()
        ? CreditEncryptionService.encrypt(data.nricPassport.trim())
        : null,
      position: data.position ?? undefined,
      appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : undefined,
      resignationDate: data.resignationDate ? new Date(data.resignationDate) : undefined,
      isExecutive: data.isExecutive ?? false,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
      ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
    };

    const director = await prisma.director.create({
      data: createData,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return decryptNric(director);
  }

  /**
   * Update an existing director.
   */
  async updateDirector(id: string, data: UpdateDirectorData) {
    const existing = await prisma.director.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.DirectorUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nricPassport !== undefined) {
      updateData.nricPassportEncrypted = data.nricPassport?.trim()
        ? CreditEncryptionService.encrypt(data.nricPassport.trim())
        : null;
    }
    if (data.position !== undefined) updateData.position = data.position;
    if (data.appointmentDate !== undefined) updateData.appointmentDate = data.appointmentDate ? new Date(data.appointmentDate) : null;
    if (data.resignationDate !== undefined) updateData.resignationDate = data.resignationDate ? new Date(data.resignationDate) : null;
    if (data.isExecutive !== undefined) updateData.isExecutive = data.isExecutive;
    if (data.contactId !== undefined) {
      updateData.contact = data.contactId ? { connect: { id: data.contactId } } : { disconnect: true };
    }

    const director = await prisma.director.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return decryptNric(director);
  }

  /**
   * Delete a director.
   */
  async deleteDirector(id: string) {
    const existing = await prisma.director.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.director.delete({ where: { id } });
  }
}

export const directorService = new DirectorService();
