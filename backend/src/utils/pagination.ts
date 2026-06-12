export interface PaginationInput {
  page?: unknown;
  limit?: unknown;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(input: PaginationInput, maxLimit = 100): PaginationResult {
  const parsedPage = Number(input.page);
  const parsedLimit = Number(input.limit);

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, maxLimit)
    : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
