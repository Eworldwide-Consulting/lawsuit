const { getDb } = require('./database');

function toPostgresSql(sql, params = []) {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values: params };
}

async function one(sql, params = []) {
  const db = getDb();
  if (db.type === 'sqlite') {
    const stmt = db.sqlite.prepare(sql);
    const row = stmt.get(params);
    return row || null;
  }
  if (db.type === 'mysql') {
    const [rows] = await db.pool.execute(sql, params);
    return rows[0] || null;
  }
  const { text, values } = toPostgresSql(sql, params);
  const result = await db.pool.query({ text, values });
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const db = getDb();
  if (db.type === 'sqlite') {
    const stmt = db.sqlite.prepare(sql);
    return stmt.all(params);
  }
  if (db.type === 'mysql') {
    const [rows] = await db.pool.execute(sql, params);
    return rows;
  }
  const { text, values } = toPostgresSql(sql, params);
  const result = await db.pool.query({ text, values });
  return result.rows;
}

async function run(sql, params = []) {
  const db = getDb();
  if (db.type === 'sqlite') {
    const stmt = db.sqlite.prepare(sql);
    const result = stmt.run(params);
    return {
      ...result,
      insertId: result.lastInsertRowid,
      affectedRows: result.changes,
    };
  }
  if (db.type === 'mysql') {
    const [result] = await db.pool.execute(sql, params);
    return {
      insertId: result.insertId || null,
      affectedRows: result.affectedRows,
      rows: [],
    };
  }

  const { text, values } = toPostgresSql(sql, params);
  const shouldReturnId = /^\s*INSERT\s+/i.test(text) && !/\bRETURNING\b/i.test(text);
  const query = shouldReturnId ? `${text} RETURNING id` : text;
  const result = await db.pool.query({ text: query, values });
  return {
    insertId: result.rows?.[0]?.id ?? null,
    affectedRows: result.rowCount,
    rows: result.rows,
  };
}

async function count(sql, params = []) {
  const row = await one(sql, params);
  return row ? Object.values(row)[0] : 0;
}

module.exports = { one, all, run, count };
