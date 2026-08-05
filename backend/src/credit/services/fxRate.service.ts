/**
 * §F23 — FX Rate Service
 *
 * Provides currency conversion to base currency (MYR) for exposure aggregation.
 * MYR passes through at 1.0. All other currencies require a rate in credit_fx_rates.
 * Fail-closed: throws BadRequestError if a non-MYR rate is missing.
 */

import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';

const BASE_CURRENCY = 'MYR';

/**
 * Convert an amount in the given currency to the base currency (MYR).
 *
 * @param amount   The monetary amount in the source currency
 * @param currency ISO 4217 currency code (e.g. 'USD', 'SGD', 'MYR')
 * @param asOf     Optional date — uses the most recent rate on or before this date.
 *                 Defaults to now (i.e. the latest available rate).
 * @returns The amount converted to base currency (MYR)
 */
export async function toBase(
  amount: number,
  currency: string,
  asOf?: Date,
): Promise<number> {
  const normalizedCurrency = currency.toUpperCase();

  // MYR is the base currency — pass through at 1:1
  if (normalizedCurrency === BASE_CURRENCY) {
    return amount;
  }

  const effectiveDate = asOf ?? new Date();

  // Find the most recent rate on or before the effective date
  const rate = await prisma.creditFxRate.findFirst({
    where: {
      currency: normalizedCurrency,
      effectiveDate: { lte: effectiveDate },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!rate) {
    throw new AppError(
      `No FX rate found for currency ${currency}. Cannot convert to base currency — please add a rate to credit_fx_rates.`,
      400,
    );
  }

  const rateToBase = Number(rate.rateToBase);
  return amount * rateToBase;
}

/**
 * Get the FX rate for a currency as of a given date.
 * Returns 1 for MYR, or the stored rate for other currencies.
 * Throws BadRequestError if no rate is found for a non-MYR currency.
 */
export async function getRate(
  currency: string,
  asOf?: Date,
): Promise<number> {
  const normalizedCurrency = currency.toUpperCase();

  if (normalizedCurrency === BASE_CURRENCY) {
    return 1;
  }

  const effectiveDate = asOf ?? new Date();

  const rate = await prisma.creditFxRate.findFirst({
    where: {
      currency: normalizedCurrency,
      effectiveDate: { lte: effectiveDate },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!rate) {
    throw new AppError(
      `No FX rate found for currency ${normalizedCurrency}.`,
      400,
    );
  }

  return Number(rate.rateToBase);
}

/**
 * Create a new FX rate entry.
 */
export async function createFxRate(data: {
  currency: string;
  rateToBase: number;
  effectiveDate: Date;
  createdById?: string;
}) {
  return prisma.creditFxRate.create({
    data: {
      currency: data.currency.toUpperCase(),
      rateToBase: data.rateToBase,
      effectiveDate: data.effectiveDate,
      createdById: data.createdById,
    },
  });
}

/**
 * List FX rates, optionally filtered by currency.
 */
export async function listFxRates(filters?: { currency?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.currency) {
    where.currency = filters.currency.toUpperCase();
  }
  return prisma.creditFxRate.findMany({
    where,
    orderBy: { effectiveDate: 'desc' },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}