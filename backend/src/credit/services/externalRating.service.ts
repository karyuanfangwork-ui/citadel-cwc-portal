import prisma from '../../utils/prisma';
import { RatingAgency, Prisma } from '@prisma/client';

export interface CreateExternalRatingData {
  applicationId: string;
  subjectType: string;
  subjectName?: string | null;
  agency: RatingAgency;
  rating: string;
  ratingDate?: string | null;
  outlook?: string | null;
  fiscalYear?: number | null;
}

export interface UpdateExternalRatingData {
  subjectType?: string;
  subjectName?: string | null;
  agency?: RatingAgency;
  rating?: string;
  ratingDate?: string | null;
  outlook?: string | null;
  fiscalYear?: number | null;
}

class ExternalRatingService {
  async listByApplication(applicationId: string) {
    return prisma.externalRating.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: CreateExternalRatingData) {
    return prisma.externalRating.create({
      data: {
        applicationId: data.applicationId,
        subjectType: data.subjectType,
        subjectName: data.subjectName ?? undefined,
        agency: data.agency,
        rating: data.rating,
        ratingDate: data.ratingDate ? new Date(data.ratingDate) : undefined,
        outlook: data.outlook ?? undefined,
        fiscalYear: data.fiscalYear ?? undefined,
      },
    });
  }

  async update(id: string, data: UpdateExternalRatingData) {
    const existing = await prisma.externalRating.findUnique({ where: { id } });
    if (!existing) return null;

    const patch: Prisma.ExternalRatingUpdateInput = {};
    if (data.subjectType !== undefined) patch.subjectType = data.subjectType;
    if (data.subjectName !== undefined) patch.subjectName = data.subjectName;
    if (data.agency !== undefined) patch.agency = data.agency;
    if (data.rating !== undefined) patch.rating = data.rating;
    if (data.ratingDate !== undefined) patch.ratingDate = data.ratingDate ? new Date(data.ratingDate) : null;
    if (data.outlook !== undefined) patch.outlook = data.outlook;
    if (data.fiscalYear !== undefined) patch.fiscalYear = data.fiscalYear;

    return prisma.externalRating.update({ where: { id }, data: patch });
  }

  async delete(id: string) {
    const existing = await prisma.externalRating.findUnique({ where: { id } });
    if (!existing) return null;
    return prisma.externalRating.delete({ where: { id } });
  }
}

export const externalRatingService = new ExternalRatingService();
