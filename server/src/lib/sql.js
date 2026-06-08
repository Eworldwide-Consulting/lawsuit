// Builds the ?-placeholders for an SQL IN (...) clause.
// Works with the db client's ? → $N conversion for PostgreSQL.
function inList(ids) {
  if (!ids || !ids.length) throw new Error('inList called with empty array');
  return ids.map(() => '?').join(',');
}

// Rewrites ?-parameterised SQL to $1-style for PostgreSQL.
function toPostgresSql(sql, params = []) {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values: params };
}

module.exports = { inList, toPostgresSql };