export function getPagination(page: number, perPage: number) {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePerPage = Number.isFinite(perPage) ? Math.max(1, Math.min(perPage, 100)) : 20;

  return {
    page: safePage,
    perPage: safePerPage,
    skip: (safePage - 1) * safePerPage,
    take: safePerPage
  };
}
