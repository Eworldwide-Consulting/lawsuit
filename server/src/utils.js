// Backward-compat shim — all exports have moved to lib/ or domain/.
// Existing require('../utils') calls continue to work unchanged.

const { MATTER_STAGES, computeReadinessScore, aggregateDocsByCategory } = require('./domain/matter');
const { sanitizeUser }  = require('./domain/user');
const { inList }        = require('./lib/sql');
const { daysUntil, todayIso, nowIso } = require('./lib/dates');
const { parsePagination } = require('./lib/pagination');

const NOW_SQL = 'CURRENT_TIMESTAMP';

module.exports = {
  MATTER_STAGES,
  sanitizeUser,
  inList,
  NOW_SQL,
  computeReadinessScore,
  daysUntil,
  todayIso,
  nowIso,
  parsePagination,
  aggregateDocsByCategory,
};