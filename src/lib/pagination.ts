export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export function normalizePagination(page?: number, limit?: number): { page: number; limit: number; skip: number } {
  const safePage = page && page > 0 ? page : DEFAULT_PAGE;
  const safeLimit = limit && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit
  };
}

export function buildPageMeta(page: number, limit: number, total: number): {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
} {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}
