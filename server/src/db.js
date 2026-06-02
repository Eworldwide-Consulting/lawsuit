const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

// Returns first row or null
async function one(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows[0] || null;
}

// Returns all rows
async function all(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

// Returns insertId or affectedRows
async function run(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

// Count shortcut
async function count(sql, params = []) {
  const row = await one(sql, params);
  return row ? Object.values(row)[0] : 0;
}

module.exports = { getPool, one, all, run, count };
