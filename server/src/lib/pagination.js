const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 200;

function parsePagination(query) {
  const limit  = Math.min(parseInt(query.limit)  || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}

module.exports = { parsePagination };